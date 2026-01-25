// Author: Dustin Etts
// polari-platform-angular/src/app/models/stateSpace/conditionTypeOptions.ts

/**
 * Condition Type Options for ConditionalChain
 *
 * Modeled after filterTypeOptions.ts with extended SQL support.
 * Organized by data type for UI presentation.
 */

/**
 * All available condition operators
 */
export type ConditionOperator =
  // Equality
  | 'equals'
  | 'notEquals'
  // Numeric comparisons
  | 'greaterThan'
  | 'lessThan'
  | 'greaterThanOrEqual'
  | 'lessThanOrEqual'
  | 'between'
  | 'notBetween'
  // String operations
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'regexMatch'
  | 'like'           // SQL LIKE pattern
  // Null checks
  | 'isNull'
  | 'isNotNull'
  // Boolean
  | 'isTrue'
  | 'isFalse'
  // Collection operations
  | 'in'
  | 'notIn'
  // No operation
  | 'noop';

// Alias for cleaner imports
export type ConditionType = ConditionOperator;

/**
 * Condition type metadata for UI display
 */
export interface ConditionTypeOption {
  value: ConditionType;
  displayName: string;
  description: string;
  sqlOperator: string;
  requiresValue: boolean;
  requiresSecondValue: boolean; // For BETWEEN operations
  applicableTypes: ('string' | 'number' | 'boolean' | 'date' | 'array' | 'any')[];
}

/**
 * All condition type options with metadata
 */
export const CONDITION_TYPE_OPTIONS: ConditionTypeOption[] = [
  // === Equality ===
  {
    value: 'equals',
    displayName: 'Equals',
    description: 'Value exactly matches',
    sqlOperator: '=',
    requiresValue: true,
    requiresSecondValue: false,
    applicableTypes: ['string', 'number', 'boolean', 'date', 'any']
  },
  {
    value: 'notEquals',
    displayName: 'Not Equals',
    description: 'Value does not match',
    sqlOperator: '!=',
    requiresValue: true,
    requiresSecondValue: false,
    applicableTypes: ['string', 'number', 'boolean', 'date', 'any']
  },

  // === Numeric Comparisons ===
  {
    value: 'greaterThan',
    displayName: 'Greater Than',
    description: 'Value is greater than',
    sqlOperator: '>',
    requiresValue: true,
    requiresSecondValue: false,
    applicableTypes: ['number', 'date']
  },
  {
    value: 'lessThan',
    displayName: 'Less Than',
    description: 'Value is less than',
    sqlOperator: '<',
    requiresValue: true,
    requiresSecondValue: false,
    applicableTypes: ['number', 'date']
  },
  {
    value: 'greaterThanOrEqual',
    displayName: 'Greater Than or Equal',
    description: 'Value is greater than or equal to',
    sqlOperator: '>=',
    requiresValue: true,
    requiresSecondValue: false,
    applicableTypes: ['number', 'date']
  },
  {
    value: 'lessThanOrEqual',
    displayName: 'Less Than or Equal',
    description: 'Value is less than or equal to',
    sqlOperator: '<=',
    requiresValue: true,
    requiresSecondValue: false,
    applicableTypes: ['number', 'date']
  },
  {
    value: 'between',
    displayName: 'Between',
    description: 'Value is between two values (inclusive)',
    sqlOperator: 'BETWEEN',
    requiresValue: true,
    requiresSecondValue: true,
    applicableTypes: ['number', 'date']
  },
  {
    value: 'notBetween',
    displayName: 'Not Between',
    description: 'Value is outside the range',
    sqlOperator: 'NOT BETWEEN',
    requiresValue: true,
    requiresSecondValue: true,
    applicableTypes: ['number', 'date']
  },

  // === String Operations ===
  {
    value: 'contains',
    displayName: 'Contains',
    description: 'String contains substring',
    sqlOperator: 'LIKE %...%',
    requiresValue: true,
    requiresSecondValue: false,
    applicableTypes: ['string']
  },
  {
    value: 'notContains',
    displayName: 'Does Not Contain',
    description: 'String does not contain substring',
    sqlOperator: 'NOT LIKE %...%',
    requiresValue: true,
    requiresSecondValue: false,
    applicableTypes: ['string']
  },
  {
    value: 'startsWith',
    displayName: 'Starts With',
    description: 'String starts with prefix',
    sqlOperator: 'LIKE ...%',
    requiresValue: true,
    requiresSecondValue: false,
    applicableTypes: ['string']
  },
  {
    value: 'endsWith',
    displayName: 'Ends With',
    description: 'String ends with suffix',
    sqlOperator: 'LIKE %...',
    requiresValue: true,
    requiresSecondValue: false,
    applicableTypes: ['string']
  },
  {
    value: 'regexMatch',
    displayName: 'Regex Match',
    description: 'String matches regular expression',
    sqlOperator: 'REGEXP',
    requiresValue: true,
    requiresSecondValue: false,
    applicableTypes: ['string']
  },
  {
    value: 'like',
    displayName: 'SQL LIKE',
    description: 'SQL LIKE pattern (% = any, _ = single char)',
    sqlOperator: 'LIKE',
    requiresValue: true,
    requiresSecondValue: false,
    applicableTypes: ['string']
  },

  // === Null Checks ===
  {
    value: 'isNull',
    displayName: 'Is Null',
    description: 'Value is null or undefined',
    sqlOperator: 'IS NULL',
    requiresValue: false,
    requiresSecondValue: false,
    applicableTypes: ['any']
  },
  {
    value: 'isNotNull',
    displayName: 'Is Not Null',
    description: 'Value is not null',
    sqlOperator: 'IS NOT NULL',
    requiresValue: false,
    requiresSecondValue: false,
    applicableTypes: ['any']
  },

  // === Boolean ===
  {
    value: 'isTrue',
    displayName: 'Is True',
    description: 'Boolean value is true',
    sqlOperator: '= 1',
    requiresValue: false,
    requiresSecondValue: false,
    applicableTypes: ['boolean']
  },
  {
    value: 'isFalse',
    displayName: 'Is False',
    description: 'Boolean value is false',
    sqlOperator: '= 0',
    requiresValue: false,
    requiresSecondValue: false,
    applicableTypes: ['boolean']
  },

  // === Collection Operations ===
  {
    value: 'in',
    displayName: 'In List',
    description: 'Value is in the provided list',
    sqlOperator: 'IN',
    requiresValue: true,
    requiresSecondValue: false,
    applicableTypes: ['string', 'number', 'any']
  },
  {
    value: 'notIn',
    displayName: 'Not In List',
    description: 'Value is not in the provided list',
    sqlOperator: 'NOT IN',
    requiresValue: true,
    requiresSecondValue: false,
    applicableTypes: ['string', 'number', 'any']
  },

  // === No Operation ===
  {
    value: 'noop',
    displayName: 'No Operation',
    description: 'Always passes (used for grouping)',
    sqlOperator: '1=1',
    requiresValue: false,
    requiresSecondValue: false,
    applicableTypes: ['any']
  }
];

/**
 * Get condition options for a specific data type
 */
export function getConditionOptionsForType(
  dataType: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'any'
): ConditionTypeOption[] {
  return CONDITION_TYPE_OPTIONS.filter(
    opt => opt.applicableTypes.includes(dataType) || opt.applicableTypes.includes('any')
  );
}

/**
 * Get condition option by value
 */
export function getConditionOption(value: ConditionType): ConditionTypeOption | undefined {
  return CONDITION_TYPE_OPTIONS.find(opt => opt.value === value);
}

/**
 * Grouped condition options for UI dropdowns
 */
export const CONDITION_OPTIONS_BY_CATEGORY = {
  equality: CONDITION_TYPE_OPTIONS.filter(o => ['equals', 'notEquals'].includes(o.value)),
  comparison: CONDITION_TYPE_OPTIONS.filter(o =>
    ['greaterThan', 'lessThan', 'greaterThanOrEqual', 'lessThanOrEqual', 'between', 'notBetween'].includes(o.value)
  ),
  string: CONDITION_TYPE_OPTIONS.filter(o =>
    ['contains', 'notContains', 'startsWith', 'endsWith', 'regexMatch', 'like'].includes(o.value)
  ),
  nullCheck: CONDITION_TYPE_OPTIONS.filter(o => ['isNull', 'isNotNull'].includes(o.value)),
  boolean: CONDITION_TYPE_OPTIONS.filter(o => ['isTrue', 'isFalse'].includes(o.value)),
  collection: CONDITION_TYPE_OPTIONS.filter(o => ['in', 'notIn'].includes(o.value)),
  other: CONDITION_TYPE_OPTIONS.filter(o => o.value === 'noop')
};

/**
 * Logical operators for combining conditions
 */
export const LOGICAL_OPERATORS = [
  { value: 'AND', displayName: 'AND', description: 'Both conditions must be true', sqlOperator: 'AND' },
  { value: 'OR', displayName: 'OR', description: 'Either condition can be true', sqlOperator: 'OR' },
  { value: 'NOT', displayName: 'NOT', description: 'Negate the following condition', sqlOperator: 'NOT' },
  { value: 'XOR', displayName: 'XOR', description: 'Exactly one condition must be true', sqlOperator: 'XOR' }
] as const;
