// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/states/_shared/value-source-config.ts

/**
 * Logical operators for combining conditions
 */
export type LogicalOperator = 'AND' | 'OR' | 'NOT' | 'XOR';

/**
 * Types of value sources for conditional chain comparisons
 */
export type ValueSourceType = 'from_input' | 'from_source_object' | 'direct_assignment';

/**
 * Configuration for where a value comes from in a conditional comparison.
 * Supports selecting from input slots, source object properties, or direct literals.
 */
export interface ValueSourceConfig {
  /** The type of source for this value */
  sourceType: ValueSourceType;

  /** When 'from_input' - which input slot index to read from */
  inputSlotIndex?: number;

  /** When 'from_input' - the variable name from that input slot */
  inputVariableName?: string;

  /** When 'from_source_object' - the property path (e.g., "self.total_amount") */
  sourceObjectPath?: string;

  /** When 'direct_assignment' - the literal value */
  directValue?: any;

  /** When 'direct_assignment' - the type of the literal value (int, str, bool, float) */
  directValueType?: 'int' | 'str' | 'bool' | 'float';
}

/**
 * Create a default ValueSourceConfig
 */
export function createDefaultValueSourceConfig(sourceType: ValueSourceType = 'from_input'): ValueSourceConfig {
  return {
    sourceType,
    inputSlotIndex: sourceType === 'from_input' ? 0 : undefined,
    inputVariableName: undefined,
    sourceObjectPath: undefined,
    directValue: undefined,
    directValueType: undefined
  };
}

/**
 * How conditions are grouped/evaluated
 */
export type EvaluationMode = 'sequential' | 'parallel' | 'nested';

/**
 * Get a human-readable label for a ValueSourceConfig
 */
export function getSourceLabel(source: ValueSourceConfig): string {
  switch (source.sourceType) {
    case 'from_input':
      if (source.inputVariableName) {
        return source.inputVariableName;
      }
      return `input[${source.inputSlotIndex ?? 0}]`;
    case 'from_source_object':
      return source.sourceObjectPath || 'self';
    case 'direct_assignment':
      if (source.directValue !== undefined) {
        return String(source.directValue);
      }
      return '(value)';
    default:
      return '?';
  }
}
