/**
 * Filter type options organized by data type.
 *
 * This module re-exports from the unified PolariFieldType system
 * for backward compatibility. New code should import directly from
 * '@models/shared/PolariFieldType'.
 */

import {
    STRING_FILTER_OPTIONS,
    NUMBER_FILTER_OPTIONS,
    BOOLEAN_FILTER_OPTIONS,
    DATE_FILTER_OPTIONS,
    LIST_FILTER_OPTIONS,
    REFERENCE_FILTER_OPTIONS,
    IDENTITY_FILTER_OPTIONS,
    getFilterOptionsForFieldType,
    getFilterTypeMeta
} from '@models/shared/PolariFieldType';

// Re-export the option arrays for backward compatibility
export const stringFilterOptions = STRING_FILTER_OPTIONS;
export const numberFilterOptions = NUMBER_FILTER_OPTIONS;
export const booleanFilterOptions = BOOLEAN_FILTER_OPTIONS;
export const dateFilterOptions = DATE_FILTER_OPTIONS;
export const listFilterOptions = LIST_FILTER_OPTIONS;
export const referenceFilterOptions = REFERENCE_FILTER_OPTIONS;
export const identityFilterOptions = IDENTITY_FILTER_OPTIONS;

export const filterTypeOptions = {
    string: stringFilterOptions,
    number: numberFilterOptions,
    boolean: booleanFilterOptions,
    date: dateFilterOptions,
    list: listFilterOptions,
    reference: referenceFilterOptions,
    uuid: identityFilterOptions
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
 * Gets the available filter options for a given data type.
 * Delegates to the unified PolariFieldType system.
 */
export function getFilterOptionsForType(dataType: string): readonly string[] {
    return getFilterOptionsForFieldType(dataType);
}

/**
 * Checks if a filter method is valid for a given data type
 */
export function isValidFilterForType(filterMethod: string, dataType: string): boolean {
    const options = getFilterOptionsForFieldType(dataType);
    return options.includes(filterMethod as any);
}

// Re-export the metadata function
export { getFilterTypeMeta };
