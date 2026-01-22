import { ConfiguredFeatureCollection } from "./configuredFeatureCollection";
import { ConfiguredFilterPanel } from "./configuredFilterPanel";

export class MultiFilterPanelConfig {
    multiPanelName: string;
    configurations: ConfiguredFilterPanel[];
    disableUserConfigChanges: boolean; // If true, users cannot modify the filter panel configurations in the UI.

    constructor(multiPanelName: string, configurations: ConfiguredFilterPanel[], disableUserConfigChanges: boolean) {
        this.multiPanelName = multiPanelName;
        this.configurations = configurations;
        this.disableUserConfigChanges = disableUserConfigChanges;
    }
}