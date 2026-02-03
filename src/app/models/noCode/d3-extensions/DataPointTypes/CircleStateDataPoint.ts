// Defines the data which should exist in the data-point being used with d3 to render these kinds of circles.
export default class CircleStateDataPoint {

    // Used for rendering the solid circle
    cx: number; // x coordinate of the center of the circle
    cy: number; // y coordinate of the center of the circle
    radius: number; // radius of the circle
    slotRadius?: number; // radius of the slot circles for this state, by default it is 4 px.
    stateName?: string; // name of the state this data point.
    // Used for determining the color of the circle
    styleName?: string; // name of the style class to be applied to the circle
    // State class name (e.g., 'InitialState', 'ReturnStatement', 'ConditionalChain')
    stateClass?: string;
    // Background color for the circle
    backgroundColor?: string;

    // The following should be calculated dynamically so they are allowed to be undefined in some conditions.

    // Used for determining when overlap events occur
    outerBoundingBoxX?: number; // x coordinate evaluating the circle as though it were surrounded by a rectangle
    outerBoundingBoxY?: number; // y coordinate evaluating the circle as though it were surrounded by a rectangle
    outerBoundingBoxWidth?: number; // width of the rectangle surrounding the circle
    outerBoundingBoxHeight?: number; // height of the rectangle surrounding the circle
  
    // Used for determining where and how to render the overlap component
    // that is displayed within this circle so it can be used as a part of the no-code UI.
    innerComponentBoxX?: number; // x coordinate of the top left corner of the inner rectangle
    innerComponentBoxY?: number; // y coordinate of the top left corner of the inner rectangle
    innerComponentBoxWidth?: number; // width of the inner rectangle
    innerComponentBoxHeight?: number; // height of the inner rectangle

    _dragOffsetX?: number; // x offset of the drag event when dragging the state
    _dragOffsetY?: number; // y offset of the drag event when dragging the state

    constructor(
        cx: number,
        cy: number,
        radius: number,
        slotRadius: number = 4,
        stateName?: string,
        stateClass?: string,
        backgroundColor?: string
    ) {
        this.cx = cx;
        this.cy = cy;
        this.radius = radius;
        this.slotRadius = slotRadius;
        this.stateName = stateName;
        this.stateClass = stateClass;
        this.backgroundColor = backgroundColor;

        // **Auto-Derived Values Based on Sample SVG**
        
        // Bounding Box Calculation (Based on Circle's Diameter)
        this.outerBoundingBoxX = cx - radius;
        this.outerBoundingBoxY = cy - radius;
        this.outerBoundingBoxWidth = radius * 2;
        this.outerBoundingBoxHeight = radius * 2;

        // Inner Component Box Calculation (Centered within Circle)
        this.innerComponentBoxX = cx - radius * 0.7;  // Inner box is 70% of radius
        this.innerComponentBoxY = cy - radius * 0.7;
        this.innerComponentBoxWidth = radius * 1.4;   // Width is 140% of radius
        this.innerComponentBoxHeight = radius * 1.4;  // Height is 140% of radius
    }
    
}