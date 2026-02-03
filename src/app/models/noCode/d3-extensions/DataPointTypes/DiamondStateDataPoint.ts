// Author: Dustin Etts
// Defines the data which should exist in the data-point being used with d3 to render diamond states.
// Used for conditional states (if/else branching) in the no-code interface.
// A diamond is a square rotated 45 degrees, with vertices at top, right, bottom, left.
export default class DiamondStateDataPoint {

    // Used for rendering the diamond
    cx: number; // x coordinate of the center of the diamond
    cy: number; // y coordinate of the center of the diamond
    size: number; // distance from center to vertex (like radius for circumscribed circle)
    slotRadius?: number; // radius of the slot circles for this state, by default it is 4 px.
    stateName?: string; // name of the state this data point.
    // Used for determining the color of the diamond
    styleName?: string; // name of the style class to be applied to the diamond
    // State class name (e.g., 'ConditionalChain')
    stateClass?: string;
    // Background color for the diamond
    backgroundColor?: string;

    // The following should be calculated dynamically so they are allowed to be undefined in some conditions.

    // Used for determining when overlap events occur
    outerBoundingBoxX?: number; // x coordinate of the bounding box
    outerBoundingBoxY?: number; // y coordinate of the bounding box
    outerBoundingBoxWidth?: number; // width of the bounding box
    outerBoundingBoxHeight?: number; // height of the bounding box

    // Used for determining where and how to render the overlay component
    // that is displayed within this diamond so it can be used as a part of the no-code UI.
    innerComponentBoxX?: number; // x coordinate of the top left corner of the inner rectangle
    innerComponentBoxY?: number; // y coordinate of the top left corner of the inner rectangle
    innerComponentBoxWidth?: number; // width of the inner rectangle
    innerComponentBoxHeight?: number; // height of the inner rectangle

    _dragOffsetX?: number; // x offset of the drag event when dragging the state
    _dragOffsetY?: number; // y offset of the drag event when dragging the state

    constructor(
        cx: number,
        cy: number,
        size: number,
        slotRadius: number = 4,
        stateName?: string,
        stateClass?: string,
        backgroundColor?: string
    ) {
        this.cx = cx;
        this.cy = cy;
        this.size = size;
        this.slotRadius = slotRadius;
        this.stateName = stateName;
        this.stateClass = stateClass;
        this.backgroundColor = backgroundColor;

        // Bounding Box Calculation (diamond fits in a square of side = 2 * size)
        this.outerBoundingBoxX = cx - size;
        this.outerBoundingBoxY = cy - size;
        this.outerBoundingBoxWidth = size * 2;
        this.outerBoundingBoxHeight = size * 2;

        // Inner Component Box Calculation (70% of the diamond size, centered)
        // The inner box is a rectangle inscribed within the diamond
        const innerScale = 0.5; // For diamond, inner box is smaller due to shape
        this.innerComponentBoxX = cx - (size * innerScale);
        this.innerComponentBoxY = cy - (size * innerScale);
        this.innerComponentBoxWidth = size * 2 * innerScale;
        this.innerComponentBoxHeight = size * 2 * innerScale;
    }

}
