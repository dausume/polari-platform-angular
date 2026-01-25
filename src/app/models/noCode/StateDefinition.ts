// Author: Dustin Etts
// polari-platform-angular/src/app/models/noCode/StateDefinition.ts

/**
 * Defines an input or output slot for a state in the no-code interface.
 * Slots are connection points that allow data flow between states.
 */
export interface SlotDefinition {
  name: string;
  displayName: string;
  slotType: 'input' | 'output';
  dataType: string;
  isRequired: boolean;
  defaultValue?: any;
  description?: string;
}

/**
 * Defines how a field is displayed in the state UI.
 */
export interface FieldDisplay {
  fieldName: string;
  displayName: string;
  visible: boolean;
  row: number;
  editable: boolean;
  fieldType: 'text' | 'number' | 'boolean' | 'select' | 'date';
}

/**
 * State-space configuration for a class.
 * Retrieved from GET /stateSpaceConfig/{className}
 */
export interface StateSpaceConfig {
  className: string;
  isStateSpaceObject: boolean;
  eventMethods: StateSpaceEventMethod[];
  displayFields: string[];
  fieldLayout: { [fieldName: string]: { row: number; visible: boolean } };
  fieldsPerRow: number;
  variables: string[];
}

/**
 * Metadata for a @stateSpaceEvent decorated method.
 */
export interface StateSpaceEventMethod {
  methodName: string;
  displayName: string;
  description: string;
  category: string;
  inputParams: EventInputParam[];
  output: {
    type: string;
    displayName: string;
  };
}

/**
 * Input parameter for a state-space event method.
 */
export interface EventInputParam {
  name: string;
  displayName: string;
  type: string;
  hasDefault: boolean;
  defaultValue?: any;
  isRequired: boolean;
}

/**
 * A StateDefinition defines how a class can be used as a state in the no-code interface.
 *
 * A single class may have multiple StateDefinitions, each representing a different
 * way the class can be used as a state (e.g., different events, different field displays).
 */
export interface StateDefinition {
  id?: string;
  name: string;
  displayName: string;
  sourceClassName: string;
  eventMethodName?: string;
  inputSlots: SlotDefinition[];
  outputSlots: SlotDefinition[];
  displayFields: FieldDisplay[];
  fieldsPerRow: 1 | 2;
  description?: string;
  category?: string;
  icon?: string;
  color?: string;
}

/**
 * Factory functions for creating StateDefinition objects
 */
export class StateDefinitionFactory {

  /**
   * Create an empty StateDefinition with defaults
   */
  static create(sourceClassName: string, name?: string): StateDefinition {
    return {
      name: name || `${sourceClassName} State`,
      displayName: name || `${sourceClassName} State`,
      sourceClassName,
      inputSlots: [],
      outputSlots: [],
      displayFields: [],
      fieldsPerRow: 1,
      category: 'General',
      color: '#3f51b5'
    };
  }

  /**
   * Create a StateDefinition from an event method
   */
  static fromEvent(
    sourceClassName: string,
    eventMethod: StateSpaceEventMethod
  ): StateDefinition {
    const inputSlots: SlotDefinition[] = eventMethod.inputParams.map(param => ({
      name: param.name,
      displayName: param.displayName,
      slotType: 'input',
      dataType: param.type,
      isRequired: param.isRequired,
      defaultValue: param.defaultValue
    }));

    const outputSlots: SlotDefinition[] = [{
      name: 'output',
      displayName: eventMethod.output.displayName,
      slotType: 'output',
      dataType: eventMethod.output.type,
      isRequired: false
    }];

    return {
      name: eventMethod.displayName,
      displayName: eventMethod.displayName,
      sourceClassName,
      eventMethodName: eventMethod.methodName,
      inputSlots,
      outputSlots,
      displayFields: [],
      fieldsPerRow: 1,
      description: eventMethod.description,
      category: eventMethod.category,
      color: '#3f51b5'
    };
  }

  /**
   * Validate a StateDefinition
   */
  static validate(definition: StateDefinition): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!definition.name) {
      errors.push('State definition name is required');
    }

    if (!definition.sourceClassName) {
      errors.push('Source class name is required');
    }

    // Validate slot names are unique
    const inputNames = definition.inputSlots.map(s => s.name);
    const outputNames = definition.outputSlots.map(s => s.name);

    if (new Set(inputNames).size !== inputNames.length) {
      errors.push('Input slot names must be unique');
    }

    if (new Set(outputNames).size !== outputNames.length) {
      errors.push('Output slot names must be unique');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * Response types for state-space API endpoints
 */
export interface StateSpaceClassesResponse {
  success: boolean;
  stateSpaceClasses: StateSpaceConfig[];
  count: number;
}

export interface StateSpaceConfigResponse {
  success: boolean;
  config: StateSpaceConfig;
}

export interface StateDefinitionsResponse {
  success: boolean;
  stateDefinitions: StateDefinition[];
  count: number;
}

export interface StateDefinitionResponse {
  success: boolean;
  stateDefinition: StateDefinition;
}
