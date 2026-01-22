import { PlotBoundDimension } from "../plotBoundDimension";
import { PlotDimensionGroup } from "../dimensionGroups/PlotDimensionGroup";

export class DimensionOperator
{
    // Dimensions that the operator acts upon
    dimensionInputs: PlotBoundDimension[] = [];

    // Dimension Groups that the operator acts upon
    dimensionGroupInputs: PlotDimensionGroup[] = [];

    // Dimensions that the operator produces
    dimensionOutputs: PlotBoundDimension[] = [];

    // Dimension Groups that the operator produces
    dimensionGroupOutputs: PlotDimensionGroup[] = [];

    constructor() {}
}