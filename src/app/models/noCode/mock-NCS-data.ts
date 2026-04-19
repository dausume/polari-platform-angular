// Author: Dustin Etts
// polari-platform-angular/src/app/models/noCode/mock-NCS-data.ts
// Type definitions for No-Code Solution data structures

/**
 * Target runtime for a no-code solution
 */
export type TargetRuntime = 'python_backend' | 'typescript_frontend';

/**
 * Raw data interface for NoCodeState - matches what would come from an API
 */
export interface NoCodeStateRawData {
  stateName: string;
  id: string;
  index: number;
  shapeType: string;
  solutionName: string;
  stateClass: string;
  stateSvgSizeX: number | null;
  stateSvgSizeY: number | null;
  stateSvgRadius: number | null;
  // Rectangle-specific dimensions
  stateSvgWidth?: number;
  stateSvgHeight?: number;
  cornerRadius?: number;
  layerName: string;
  stateLocationX: number;
  stateLocationY: number;
  stateSvgName: string;
  slots: SlotRawData[];
  slotRadius: number;
  backgroundColor: string;
  // State-space bindings
  boundObjectClass?: string;
  boundObjectFieldValues?: { [key: string]: any };
}

/**
 * Bound class definition for a solution
 */
export interface BoundClassRawData {
  className: string;
  displayName: string;
  description: string;
  fields: {
    name: string;
    displayName: string;
    type: string;
    defaultValue?: any;
    description?: string;
  }[];
  methods: {
    name: string;
    displayName: string;
    parameters: { name: string; type: string; default?: any }[];
    returnType: string;
    description?: string;
  }[];
  pythonImports?: string[];
  typescriptImports?: string[];
}

/**
 * Raw data interface for Slot - matches what would come from an API
 */
export interface SlotRawData {
  index: number;
  stateName: string;
  slotAngularPosition: number;
  connectors: ConnectorRawData[];
  isInput: boolean;
  allowOneToMany: boolean;
  allowManyToOne: boolean;
  // Slot configuration properties
  color?: string;
  /** Full name of the slot (unlimited length) */
  name?: string;
  /** Short abbreviation displayed on the visual marker (max 3 characters) */
  label?: string;
  mappingMode?: string;
  description?: string;
  parameterName?: string;
  parameterType?: string;
  returnType?: string;
  // Output-specific configuration
  sourceInstance?: 'solution_instance' | 'helper_instance';
  propertyPath?: string;
  passthroughVariableName?: string;
  // Conditional output configuration
  isConditional?: boolean;
  conditionExpression?: string;
  conditionLabel?: string;
  conditionalGroup?: string;
}

/**
 * Raw data interface for Connector - matches what would come from an API
 */
export interface ConnectorRawData {
  id: number;
  sourceSlot: number;
  sinkSlot: number;
  targetStateName?: string; // The state name that contains the sink slot
}

/**
 * Raw data interface for NoCodeSolution - matches what would come from an API
 */
export interface NoCodeSolutionRawData {
  id: number;
  solutionName: string;
  xBounds: number;
  yBounds: number;
  stateInstances: NoCodeStateRawData[];
  // Bound class for this solution
  boundClass?: BoundClassRawData;
  // Function name for code generation
  functionName?: string;
  // Target runtime for this solution (defaults to 'python_backend' if undefined)
  targetRuntime?: TargetRuntime;
}
