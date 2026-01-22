export class ConfiguredFeatureCollection {
    featureCollectionName : string;
    dataSeriesName : string;
    latitudeVariableName : string;
    longitudeVariableName : string;
    iconName : string;
    iconStyleName : string;
    filterConfigs: Array<any>;
    isConfigOnly: boolean;

    constructor(featureCollectionName: string, dataSeriesName: string, latitudeVariableName: string, longitudeVariableName: string, iconName: string, iconStyleName: string, filterConfigs: Array<any>, isConfigOnly: boolean) {
        this.featureCollectionName = featureCollectionName;
        this.dataSeriesName = dataSeriesName;
        this.latitudeVariableName = latitudeVariableName;
        this.longitudeVariableName = longitudeVariableName;
        this.iconName = iconName;
        this.iconStyleName = iconStyleName;
        this.filterConfigs = filterConfigs;
        this.isConfigOnly = isConfigOnly;
    }
}