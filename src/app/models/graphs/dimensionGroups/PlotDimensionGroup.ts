export class PlotDimensionGroup {

    dimensions: PlotBoundDimension[];

    subGroups: PlotDimensionGroup[];

    name: string;

    id: string;

    fillColor: string;

    strokeColor: string;

    constructor(
        dimensions: PlotBoundDimension[] = [],
        subGroups: PlotDimensionGroup[] = [],
        name: string = '',
        id: string = '',
        fillColor: string = '',
        strokeColor: string = ''
    )
    {
        this.dimensions = dimensions;
        this.subGroups = subGroups;
        this.name = name;
        this.id = id;
        this.fillColor = fillColor;
        this.strokeColor = strokeColor;
    }
}