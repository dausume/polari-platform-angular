import { DataSeriesFilterChainMethod } from "./filterChainMethod";

export const validOptions = filterTypeOptions.number.concat(
    filterTypeOptions.number, 
    filterTypeOptions.string, 
    filterTypeOptions.boolean, 
    filterTypeOptions.date
);

type DataSeriesFilterChainTypeOptions = typeof validOptions[number];

export { DataSeriesFilterChainTypeOptions };