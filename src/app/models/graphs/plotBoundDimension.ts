import { DataSeries } from "@models/dataseries/dataSeries";
import { DataSeriesDimension } from "@models/dataseries/dataSeriesDimension";

export class PlotBoundDimension {
    id: string;
    index?: number;
    name: string;
    xAxis: boolean;
    yAxis: boolean;
    isColorDeterminant: boolean;
    dataMaximum?: number;
    dataMinimum?: number;
    stepIncrement?: number;
    isComposite: boolean;
    dataSeriesDimension: DataSeriesDimension;
    dimensionPlots: [] = [];

    constructor(
        name: string = '',
        id: string = '',
        dataSeriesDimension?: DataSeriesDimension,
    )
    {
        this.name = name;
        this.id = id || name;
        this.dataSeriesDimension = dataSeriesDimension || new DataSeriesDimension(name, '', 'number');
        this.xAxis = false;
        this.yAxis = false;
        this.isColorDeterminant = false;
        this.isComposite = false;
    }
}