// Author: Dustin Etts
// Defines the data which should exist in the data-point being used with d3 to render slots on rectangle states.

export default class RectangleSlotDataPoint {

    // These are from the parent state object
    // Used for reference so we can calculate where our slots should be located on the border of the rectangle.
    cx: number; // x coordinate of the center of the rectangle
    cy: number; // y coordinate of the center of the rectangle
    width: number; // width of the rectangle
    height: number; // height of the rectangle
    solutionName?: string; // name of the solution this state belongs to.
    stateName?: string; // name of the state this slot is associated with.

    // These are specific to the slot object
    // We use the angular position to determine where the slot should be placed on the border of the rectangle.
    // For rectangles, the path follows the perimeter, so angular position maps to path length percentage.
    angularPosition: number; // position on the rectangle perimeter (0-360, mapped to path length)

    // Used for determining the event rules that occur when a slot is clicked and dragged
    // to connect to another slot, for interconnecting no-code states.
    isInput: boolean; // is this slot an input slot?
    isOutput: boolean; // is this slot an output slot?

    index: number; // index of the slot in the parent state object

    // Slot appearance
    color?: string; // custom color for the slot (hex format)
    label?: string; // display label (e.g., "I0", "O1")

    constructor(
        cx: number,
        cy: number,
        width: number,
        height: number,
        index: number,
        angularPosition: number,
        isInput: boolean,
        isOutput: boolean,
        stateName?: string,
        solutionName?: string,
        color?: string,
        label?: string
    ) {
        this.cx = cx;
        this.cy = cy;
        this.width = width;
        this.height = height;
        this.angularPosition = angularPosition;
        this.isInput = isInput;
        this.isOutput = isOutput;
        this.stateName = stateName;
        this.solutionName = solutionName;
        this.index = index;
        this.color = color;
        this.label = label;
    }
}
