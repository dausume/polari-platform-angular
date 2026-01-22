import { DataSeries } from "./dataSeries";

export class DataSeriesPoint {
    // Index signature for dynamic properties
    [key: string]: any;

    // Optional Constructor to initialize properties
    constructor(initialData?: { [key: string]: any }) {
        if (initialData) {
            for (const key in initialData) {
                if (initialData.hasOwnProperty(key)) {
                    this[key] = initialData[key];
                }
            }
        }
    }
}