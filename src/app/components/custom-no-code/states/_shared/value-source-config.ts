// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/states/_shared/value-source-config.ts

/**
 * Logical operators for combining conditions
 */
export type LogicalOperator = 'AND' | 'OR' | 'NOT' | 'XOR';

/**
 * Types of value sources for conditional chain comparisons.
 *
 * Naming note: the persisted token `from_source_object` predates the
 * "From DataSet" branch. It still represents the "object instance" branch in
 * storage and code-gen — only the label was refreshed in the UI. New
 * persisted token `from_dataset` covers the dataset/dataseries case (a
 * collection-typed source distinct from a single object instance).
 */
export type ValueSourceType =
    | 'from_input'
    | 'from_source_object'
    | 'from_dataset'
    | 'direct_assignment';

/**
 * Configuration for where a value comes from in a conditional comparison.
 * Supports selecting from input slots, source object properties, datasets,
 * or direct literals.
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

  /** When 'from_dataset' - identifier of the dataset to read from */
  datasetId?: string;

  /** When 'from_dataset' - dotted path inside the dataset (e.g. "row.value", "values[0]") */
  datasetFieldPath?: string;

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
    case 'from_dataset':
      if (source.datasetId && source.datasetFieldPath) {
        return `${source.datasetId}.${source.datasetFieldPath}`;
      }
      return source.datasetId || 'dataset';
    case 'direct_assignment':
      if (source.directValue !== undefined) {
        return String(source.directValue);
      }
      return '(value)';
    default:
      return '?';
  }
}
