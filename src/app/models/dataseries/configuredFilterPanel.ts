import { ConfiguredFilter } from "./configuredFilter";
import {ConfiguredFeatureCollection} from "./configuredFeatureCollection";

export class ConfiguredFilterPanel {
    panelName: string;
    dataSeriesName: string;
    configuration: Array<ConfiguredFilter | ConfiguredFeatureCollection>;

    constructor(panelName: string, dataSeriesName:string, configuredFilters: Array<ConfiguredFilter>, configuredFeatureCollections: Array<ConfiguredFeatureCollection>) {
        this.panelName = panelName;
        this.dataSeriesName = dataSeriesName;
        this.configuration = [...configuredFilters, ...configuredFeatureCollections];
    }
}