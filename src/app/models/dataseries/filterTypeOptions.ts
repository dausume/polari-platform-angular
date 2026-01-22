/**
 * Filter type options organized by data type.
 * Each data type has a specific set of applicable filter operations.
 */

/** Filter options for string data types */
export const stringFilterOptions = [
    'equals',
    'notEquals',
    'contains',
    'notContains',
    'startsWith',
    'endsWith',
    'regexMatch',
    'isNull',
    'isNotNull'
] as const;

/** Filter options for numeric data types */
export const numberFilterOptions = [
    'equals',
    'notEquals',
    'greaterThan',
    'lessThan',
    'greaterThanOrEqual',
    'lessThanOrEqual',
    'inRange',
    'notInRange',
    'isNull',
    'isNotNull'
] as const;

/** Filter options for boolean data types */
export const booleanFilterOptions = [
    'isTrue',
    'isFalse',
    'isNull',
    'isNotNull'
] as const;

/** Filter options for date data types */
export const dateFilterOptions = [
    'equals',
    'notEquals',
    'greaterThan',
    'lessThan',
    'greaterThanOrEqual',
    'lessThanOrEqual',
    'inRange',
    'notInRange',
    'isNull',
    'isNotNull'
] as const;

/**
 * Complete filter type options organized by data type
 */
export const filterTypeOptions = {
    string: stringFilterOptions,
    number: numberFilterOptions,
    boolean: booleanFilterOptions,
    date: dateFilterOptions
} as const;

/** Type for string filter methods */
export type StringFilterMethod = typeof stringFilterOptions[number];

/** Type for number filter methods */
export type NumberFilterMethod = typeof numberFilterOptions[number];

/** Type for boolean filter methods */
export type BooleanFilterMethod = typeof booleanFilterOptions[number];

/** Type for date filter methods */
export type DateFilterMethod = typeof dateFilterOptions[number];

/** Union of all filter methods */
export type FilterMethod =
    | StringFilterMethod
    | NumberFilterMethod
    | BooleanFilterMethod
    | DateFilterMethod
    | 'noop';

/**
 * Gets the available filter options for a given data type
 */
export function getFilterOptionsForType(dataType: string): readonly string[] {
    const type = dataType.toLowerCase() as keyof typeof filterTypeOptions;
    return filterTypeOptions[type] || [];
}

/**
 * Checks if a filter method is valid for a given data type
 */
export function isValidFilterForType(filterMethod: string, dataType: string): boolean {
    const options = getFilterOptionsForType(dataType);
    return options.includes(filterMethod as any);
}
