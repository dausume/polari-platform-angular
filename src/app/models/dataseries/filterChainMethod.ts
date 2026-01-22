// Should correspond directly to options in polari-rf-node/polari-platform-core/src/dataseries/DataSeriesFilterChain.ts
// for the function defined as applyFilter, a case should be added here for each new filter type implemented there.
const validDataSeriesFilterChainMethods = [
    // Logical No-Op
    'noop',
    // Logical Numeric Operators
    'equals',
    'notEquals',
    'greaterThan',
    'lessThan',
    'greaterThanOrEqual',
    'lessThanOrEqual',
    'inRange',
    'notInRange',
    // Logical String Operators
    'contains',
    'notContains',
    'startsWith',
    'endsWith',
    'regexMatch',
    // Logical Boolean Operators
    'isTrue',
    'isFalse',
    // Null Checks
    'isNull',
    'isNotNull'
]

export type DataSeriesFilterChainMethod = typeof validDataSeriesFilterChainMethods[number];