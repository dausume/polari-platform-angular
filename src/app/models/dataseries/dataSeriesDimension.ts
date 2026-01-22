// Defines a single dimension of data to be used in a Data Series.
export class DataSeriesDimension {
    //The name of the dimension (e.g., "Time", "Temperature", etc.)
    name: string;
    //The unit of measurement for the dimension (e.g., "seconds", "Celsius", etc.)
    unit: string;
    //The data type of the dimension (e.g., "number", "string", etc.)
    dataType: string;

    //Defines a configuration object used for configuring variable information for a new class, or modifying/duplicating an existing class.
    constructor(name: string, unit: string, dataType: string)
    {
        this.name = name;
        this.unit = unit;
        this.dataType = dataType;
    }
}