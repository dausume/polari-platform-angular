export class ConfiguredFilter {
    dataSeriesName: string;
    dimensionName?: string;
    filterOptionName?: string;
    filterConfigType?: "Checkbox" | "MultiSelect" | "RangeSlider" | "SingleSelect" | "DateRangePicker" | "Dropdown" | "ToggleSwitch" | "Pre-Set" | "Enforced";
    defaultValue?: any;
    defaultSecondValue?: any;
    defaultChecked?: boolean; // for boolean filters
    disableAllOption?: boolean; // for multi-select filters

    constructor(dataSeriesName: string, dimensionName: string, filterOptionName: string, 
        filterConfigType: string, defaultValue: any, defaultSecondValue: any, 
        defaultChecked: boolean, disableAllOption: boolean) {
        this.dataSeriesName = dataSeriesName;
        this.dimensionName = dimensionName;
        this.filterOptionName = filterOptionName;
        this.filterConfigType = filterConfigType as ConfiguredFilter['filterConfigType'];
        this.defaultValue = defaultValue;
        this.defaultSecondValue = defaultSecondValue;
        this.defaultChecked = defaultChecked;
        this.disableAllOption = disableAllOption;
    }
}