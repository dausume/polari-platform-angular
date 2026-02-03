// Author: Dustin Etts
// solutionContext.ts - Context models for solution configuration and execution
//
// PotentialContext: Design-time context representing what COULD be available
//                   at a state based on the flow graph structure
//
// InstanceContext: Runtime context with actual values flowing through execution
//
// Branch Tracking: Variables track their path through parallel logic branches,
//                  allowing full differentiation of context based on flow path.

/**
 * Control flow state types that don't produce data variables.
 * These states control execution flow but don't add variables to context.
 */
export const CONTROL_FLOW_STATE_TYPES = [
  'InitialState',
  'VariableAssignment',
  'ConditionalChain',
  'ReturnStatement'
];

/**
 * Represents a point where the flow branched
 */
export interface BranchPoint {
  /** Name of the state where branching occurred */
  originStateName: string;

  /** The branch/output slot index taken (0 = first branch, 1 = second, etc.) */
  branchIndex: number;

  /** The step number (from initial) when this branch was taken */
  stepAtBranch: number;

  /** Optional label for the branch (e.g., "true", "false", "case_1") */
  branchLabel?: string;
}

/**
 * Represents a variable that is potentially available at a state
 * Based on flow analysis of the solution graph
 */
export interface PotentialVariable {
  /** Name of the variable */
  name: string;

  /** Data type of the variable (e.g., 'int', 'str', 'bool', 'float', or class name) */
  type: string;

  /** Name of the state that outputs this variable */
  sourceStateName: string;

  /** Index of the output slot that provides this variable */
  sourceSlotIndex: number;

  /** Number of steps (connectors) from the source to the current state */
  flowDistance: number;

  /** Index of the input slot where this variable arrives (at the current state) */
  inputSlotIndex?: number;

  /** Optional label for display purposes */
  label?: string;

  /**
   * The branch path taken to reach this variable.
   * Empty array means no branching (main/linear flow).
   * Each entry represents a branch point traversed.
   */
  branchPath: BranchPoint[];
}

/**
 * Represents an object type that is potentially available at a state
 * Objects flow through the graph maintaining their type identity
 */
export interface PotentialObjectType {
  /** The class/type name of the object */
  className: string;

  /** Available fields on this object type */
  fields: PotentialObjectField[];

  /** Name of the state that introduced this object into the flow */
  sourceStateName: string;

  /** Number of steps from where the object was introduced */
  flowDistance: number;

  /** Optional instance identifier if this is a specific bound instance */
  instanceId?: string;

  /**
   * The branch path taken to reach this object type.
   * Empty array means no branching (main/linear flow).
   */
  branchPath: BranchPoint[];

  /**
   * Whether this is the Solution Object (bound class of the solution itself)
   */
  isSolutionObject?: boolean;
}

/**
 * Represents a field available on a potential object type
 */
export interface PotentialObjectField {
  /** Path to access this field (e.g., 'self.order_id' or 'order.total') */
  path: string;

  /** Display name for the field */
  displayName: string;

  /** Data type of the field */
  type: string;

  /** Whether this field is writable */
  writable?: boolean;
}

/**
 * PotentialContext - Abstract context for design-time configuration
 *
 * This represents what variables and object types COULD be available
 * at a given state based on the solution's flow graph structure.
 * Used by ValueSourceSelector and other configuration UIs.
 *
 * Branch Tracking: The context tracks parallel logic branches, identifying
 * where branching occurred and which path was taken. This allows full
 * differentiation of context based on execution path.
 */
export class PotentialContext {
  /** The state this context is for */
  stateName: string;

  /** Name of the solution */
  solutionName: string;

  /**
   * Variables available at this state, keyed by a unique key that includes branch path.
   * Key format: variableName or variableName@branchPath for branched variables.
   */
  variables: Map<string, PotentialVariable> = new Map();

  /** Object types available at this state, keyed by class name */
  objectTypes: Map<string, PotentialObjectType> = new Map();

  /** The minimum flow distance from the initial state */
  distanceFromInitial: number = 0;

  /** States that directly feed into this state (one step back) */
  directUpstreamStates: string[] = [];

  /** All states that are upstream of this state (any distance) */
  allUpstreamStates: string[] = [];

  /**
   * All unique branch paths that lead to this state.
   * Each path represents a different execution route through branching states.
   */
  branchPaths: BranchPoint[][] = [];

  /**
   * The Solution Object (bound class of the solution itself).
   * This is always available regardless of flow position.
   */
  solutionObject: PotentialObjectType | null = null;

  constructor(solutionName: string, stateName: string) {
    this.solutionName = solutionName;
    this.stateName = stateName;
  }

  /**
   * Generate a unique key for a variable that includes its branch path
   */
  private getVariableKey(name: string, branchPath: BranchPoint[]): string {
    if (branchPath.length === 0) {
      return name;
    }
    const pathStr = branchPath.map(bp => `${bp.originStateName}:${bp.branchIndex}`).join('>');
    return `${name}@${pathStr}`;
  }

  /**
   * Format a branch path for display
   */
  static formatBranchPath(branchPath: BranchPoint[]): string {
    if (branchPath.length === 0) {
      return 'main flow';
    }
    return branchPath.map(bp => {
      const label = bp.branchLabel || `branch ${bp.branchIndex}`;
      return `${bp.originStateName}[${label}]`;
    }).join(' → ');
  }

  /**
   * Add a potential variable to this context
   * Variables are keyed by name + branch path to allow same-named variables
   * from different branches to coexist.
   */
  addVariable(variable: PotentialVariable): void {
    // Ensure branchPath is initialized
    if (!variable.branchPath) {
      variable.branchPath = [];
    }

    const key = this.getVariableKey(variable.name, variable.branchPath);

    // If variable already exists at this key, keep the one with shorter flow distance
    const existing = this.variables.get(key);
    if (!existing || variable.flowDistance < existing.flowDistance) {
      this.variables.set(key, variable);
    }

    // Also track the branch path if it's new
    if (variable.branchPath.length > 0) {
      const pathStr = JSON.stringify(variable.branchPath);
      const existingPaths = this.branchPaths.map(p => JSON.stringify(p));
      if (!existingPaths.includes(pathStr)) {
        this.branchPaths.push([...variable.branchPath]);
      }
    }
  }

  /**
   * Add a potential object type to this context
   */
  addObjectType(objectType: PotentialObjectType): void {
    // Ensure branchPath is initialized
    if (!objectType.branchPath) {
      objectType.branchPath = [];
    }

    // Solution object is stored separately and always available
    if (objectType.isSolutionObject) {
      this.solutionObject = objectType;
      return;
    }

    const existing = this.objectTypes.get(objectType.className);
    if (!existing || objectType.flowDistance < existing.flowDistance) {
      this.objectTypes.set(objectType.className, objectType);
    }
  }

  /**
   * Set the solution object (bound class of the solution)
   */
  setSolutionObject(objectType: PotentialObjectType): void {
    objectType.isSolutionObject = true;
    objectType.branchPath = [];
    this.solutionObject = objectType;
  }

  /**
   * Get all variables as an array, sorted by flow distance then name
   */
  getVariables(): PotentialVariable[] {
    return Array.from(this.variables.values())
      .sort((a, b) => {
        if (a.flowDistance !== b.flowDistance) {
          return a.flowDistance - b.flowDistance;
        }
        return a.name.localeCompare(b.name);
      });
  }

  /**
   * Get all variables grouped by their branch path
   */
  getVariablesByBranch(): Map<string, PotentialVariable[]> {
    const byBranch = new Map<string, PotentialVariable[]>();

    for (const variable of this.variables.values()) {
      const pathKey = PotentialContext.formatBranchPath(variable.branchPath);
      if (!byBranch.has(pathKey)) {
        byBranch.set(pathKey, []);
      }
      byBranch.get(pathKey)!.push(variable);
    }

    return byBranch;
  }

  /**
   * Get all object types as an array
   * Includes the solution object if present
   */
  getObjectTypes(): PotentialObjectType[] {
    const types = Array.from(this.objectTypes.values())
      .sort((a, b) => a.flowDistance - b.flowDistance);

    // Add solution object at the beginning if present
    if (this.solutionObject) {
      return [this.solutionObject, ...types];
    }

    return types;
  }

  /**
   * Get all object fields across all object types
   * Includes solution object fields
   */
  getAllObjectFields(): PotentialObjectField[] {
    const fields: PotentialObjectField[] = [];

    // Include solution object fields first
    if (this.solutionObject) {
      fields.push(...this.solutionObject.fields);
    }

    for (const objType of this.objectTypes.values()) {
      fields.push(...objType.fields);
    }
    return fields;
  }

  /**
   * Check if any variables have branched paths
   */
  hasBranchedVariables(): boolean {
    return this.branchPaths.length > 0;
  }

  /**
   * Get the number of distinct branch paths
   */
  getBranchCount(): number {
    return this.branchPaths.length;
  }

  /**
   * Check if a variable is available
   */
  hasVariable(name: string): boolean {
    return this.variables.has(name);
  }

  /**
   * Check if an object type is available
   */
  hasObjectType(className: string): boolean {
    return this.objectTypes.has(className);
  }

  /**
   * Get variable by name
   */
  getVariable(name: string): PotentialVariable | undefined {
    return this.variables.get(name);
  }

  /**
   * Get object type by class name
   */
  getObjectType(className: string): PotentialObjectType | undefined {
    return this.objectTypes.get(className);
  }

  /**
   * Merge another context into this one (for parallel branch merging)
   */
  merge(other: PotentialContext): void {
    // Merge variables
    for (const variable of other.variables.values()) {
      this.addVariable(variable);
    }

    // Merge object types
    for (const objType of other.objectTypes.values()) {
      this.addObjectType(objType);
    }

    // Merge solution object (prefer existing)
    if (!this.solutionObject && other.solutionObject) {
      this.solutionObject = other.solutionObject;
    }

    // Merge upstream states
    for (const state of other.directUpstreamStates) {
      if (!this.directUpstreamStates.includes(state)) {
        this.directUpstreamStates.push(state);
      }
    }
    for (const state of other.allUpstreamStates) {
      if (!this.allUpstreamStates.includes(state)) {
        this.allUpstreamStates.push(state);
      }
    }

    // Merge branch paths
    for (const path of other.branchPaths) {
      const pathStr = JSON.stringify(path);
      const existingPaths = this.branchPaths.map(p => JSON.stringify(p));
      if (!existingPaths.includes(pathStr)) {
        this.branchPaths.push([...path]);
      }
    }
  }

  /**
   * Create a shallow copy of this context
   */
  clone(): PotentialContext {
    const cloned = new PotentialContext(this.solutionName, this.stateName);
    cloned.distanceFromInitial = this.distanceFromInitial;
    cloned.directUpstreamStates = [...this.directUpstreamStates];
    cloned.allUpstreamStates = [...this.allUpstreamStates];
    cloned.branchPaths = this.branchPaths.map(path => [...path]);

    // Clone solution object
    if (this.solutionObject) {
      cloned.solutionObject = {
        ...this.solutionObject,
        fields: this.solutionObject.fields.map(f => ({ ...f })),
        branchPath: []
      };
    }

    for (const [key, value] of this.variables) {
      cloned.variables.set(key, {
        ...value,
        branchPath: value.branchPath ? [...value.branchPath] : []
      });
    }
    for (const [key, value] of this.objectTypes) {
      cloned.objectTypes.set(key, {
        ...value,
        fields: value.fields.map(f => ({ ...f })),
        branchPath: value.branchPath ? [...value.branchPath] : []
      });
    }

    return cloned;
  }
}

/**
 * Represents a runtime variable with its actual value
 */
export interface InstanceVariable {
  /** Name of the variable */
  name: string;

  /** Data type */
  type: string;

  /** Actual runtime value */
  value: any;

  /** Source state that produced this value */
  sourceStateName: string;
}

/**
 * Represents a runtime object instance with actual data
 */
export interface InstanceObject {
  /** The class/type name */
  className: string;

  /** Unique instance identifier */
  instanceId: string;

  /** The actual object data */
  data: Record<string, any>;

  /** Source state that introduced this instance */
  sourceStateName: string;
}

/**
 * InstanceContext - Runtime context with actual values
 *
 * This represents the actual values flowing through the solution
 * during execution. Created from PotentialContext when solution runs.
 */
export class InstanceContext {
  /** The state this context is for */
  stateName: string;

  /** Name of the solution */
  solutionName: string;

  /** Execution ID for tracking */
  executionId: string;

  /** Runtime variables with actual values */
  variables: Map<string, InstanceVariable> = new Map();

  /** Runtime object instances */
  objects: Map<string, InstanceObject> = new Map();

  /** Timestamp when this context was created */
  createdAt: Date = new Date();

  constructor(solutionName: string, stateName: string, executionId: string) {
    this.solutionName = solutionName;
    this.stateName = stateName;
    this.executionId = executionId;
  }

  /**
   * Set a variable value
   */
  setVariable(name: string, value: any, type: string, sourceStateName: string): void {
    this.variables.set(name, {
      name,
      type,
      value,
      sourceStateName
    });
  }

  /**
   * Get a variable value
   */
  getVariable(name: string): any {
    return this.variables.get(name)?.value;
  }

  /**
   * Check if variable exists
   */
  hasVariable(name: string): boolean {
    return this.variables.has(name);
  }

  /**
   * Set an object instance
   */
  setObject(instanceId: string, className: string, data: Record<string, any>, sourceStateName: string): void {
    this.objects.set(instanceId, {
      className,
      instanceId,
      data,
      sourceStateName
    });
  }

  /**
   * Get an object instance
   */
  getObject(instanceId: string): InstanceObject | undefined {
    return this.objects.get(instanceId);
  }

  /**
   * Get object by class name (returns first match)
   */
  getObjectByClass(className: string): InstanceObject | undefined {
    for (const obj of this.objects.values()) {
      if (obj.className === className) {
        return obj;
      }
    }
    return undefined;
  }

  /**
   * Resolve a value from a source configuration
   * This is the runtime resolution method
   */
  resolveValue(sourceType: string, config: {
    variableName?: string;
    objectPath?: string;
    directValue?: any;
    inputSlotIndex?: number;
  }): any {
    switch (sourceType) {
      case 'from_input':
        if (config.variableName) {
          return this.getVariable(config.variableName);
        }
        // Fall back to slot-based lookup
        const slotKey = `__input_${config.inputSlotIndex}`;
        return this.getVariable(slotKey);

      case 'from_source_object':
        if (config.objectPath) {
          return this.resolveObjectPath(config.objectPath);
        }
        return undefined;

      case 'direct_assignment':
        return config.directValue;

      default:
        return undefined;
    }
  }

  /**
   * Resolve a dot-notation object path (e.g., 'self.order.total')
   */
  private resolveObjectPath(path: string): any {
    const parts = path.split('.');
    if (parts.length === 0) return undefined;

    // 'self' refers to the primary object in context
    let current: any;
    if (parts[0] === 'self') {
      // Get the first object (or a specific one if we track 'self')
      const selfObj = this.objects.values().next().value;
      current = selfObj?.data;
      parts.shift();
    } else {
      // Try to find object by name
      const obj = this.getObjectByClass(parts[0]);
      current = obj?.data;
      parts.shift();
    }

    // Navigate the path
    for (const part of parts) {
      if (current === undefined || current === null) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }

  /**
   * Create from a PotentialContext (initializes with undefined values)
   */
  static fromPotentialContext(
    potential: PotentialContext,
    executionId: string
  ): InstanceContext {
    const instance = new InstanceContext(
      potential.solutionName,
      potential.stateName,
      executionId
    );

    // Initialize variables with undefined values
    for (const pVar of potential.variables.values()) {
      instance.variables.set(pVar.name, {
        name: pVar.name,
        type: pVar.type,
        value: undefined,
        sourceStateName: pVar.sourceStateName
      });
    }

    return instance;
  }

  /**
   * Convert to a plain object for use in expressions/evaluations
   */
  toDataObject(): Record<string, any> {
    const data: Record<string, any> = {};

    // Add all variables
    for (const [name, variable] of this.variables) {
      data[name] = variable.value;
    }

    // Add objects with their class names as keys
    for (const obj of this.objects.values()) {
      data[obj.className] = obj.data;
      // Also add as 'self' if it's the primary object
      if (!data['self']) {
        data['self'] = obj.data;
      }
    }

    return data;
  }
}
