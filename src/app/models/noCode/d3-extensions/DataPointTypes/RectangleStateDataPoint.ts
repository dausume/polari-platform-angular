// Author: Dustin Etts
// Defines the data which should exist in the data-point being used with d3 to render rectangle states.
// Used for end states and other block-like state objects.
export default class RectangleStateDataPoint {

    // Used for rendering the rectangle
    cx: number; // x coordinate of the center of the rectangle
    cy: number; // y coordinate of the center of the rectangle
    width: number; // width of the rectangle
    height: number; // height of the rectangle
    slotRadius?: number; // radius of the slot circles for this state, by default it is 4 px.
    stateName?: string; // name of the state this data point.
    // Used for determining the color of the rectangle
    styleName?: string; // name of the style class to be applied to the rectangle

    // Corner radius for rounded rectangles (0 for sharp corners)
    cornerRadius?: number;

    // The following should be calculated dynamically so they are allowed to be undefined in some conditions.

    // Used for determining when overlap events occur
    outerBoundingBoxX?: number; // x coordinate of the bounding box
    outerBoundingBoxY?: number; // y coordinate of the bounding box
    outerBoundingBoxWidth?: number; // width of the bounding box
    outerBoundingBoxHeight?: number; // height of the bounding box

    // Used for determining where and how to render the overlay component
    // that is displayed within this rectangle so it can be used as a part of the no-code UI.
    innerComponentBoxX?: number; // x coordinate of the top left corner of the inner rectangle
    innerComponentBoxY?: number; // y coordinate of the top left corner of the inner rectangle
    innerComponentBoxWidth?: number; // width of the inner rectangle
    innerComponentBoxHeight?: number; // height of the inner rectangle

    _dragOffsetX?: number; // x offset of the drag event when dragging the state
    _dragOffsetY?: number; // y offset of the drag event when dragging the state

    constructor(
        cx: number,
        cy: number,
        width: number,
        height?: number,
        slotRadius: number = 4,
        stateName?: string,
        cornerRadius: number = 0
    ) {
        this.cx = cx;
        this.cy = cy;
        this.width = width;
        this.height = height ?? width; // Default to square if height not provided
        this.slotRadius = slotRadius;
        this.stateName = stateName;
        this.cornerRadius = cornerRadius;

        // Bounding Box Calculation (same as rectangle dimensions with padding)
        const halfWidth = this.width / 2;
        const halfHeight = this.height / 2;
        this.outerBoundingBoxX = cx - halfWidth;
        this.outerBoundingBoxY = cy - halfHeight;
        this.outerBoundingBoxWidth = this.width;
        this.outerBoundingBoxHeight = this.height;

        // Inner Component Box Calculation (70% of the rectangle size, centered)
        const innerScale = 0.7;
        this.innerComponentBoxX = cx - (halfWidth * innerScale);
        this.innerComponentBoxY = cy - (halfHeight * innerScale);
        this.innerComponentBoxWidth = this.width * innerScale;
        this.innerComponentBoxHeight = this.height * innerScale;
    }

}
