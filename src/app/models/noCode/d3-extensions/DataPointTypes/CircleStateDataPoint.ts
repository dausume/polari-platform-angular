// Defines the data which should exist in the data-point being used with d3 to render these kinds of circles.
export default interface CircleStateDataPoint {
    // Used for determining when overlap events occur
    outerBoundingBoxX: number; // x coordinate evaluating the circle as though it were surrounded by a rectangle
    outerBoundingBoxY: number; // y coordinate evaluating the circle as though it were surrounded by a rectangle
  
    // Used for rendering the solid circle
    cx: number; // x coordinate of the center of the circle
    cy: number; // y coordinate of the center of the circle
    radius: number; // radius of the circle
  
    // Used for determining where and how to render the overlap component
    // that is displayed within this circle so it can be used as a part of the no-code UI.
    innerComponentBoxX: number; // x coordinate of the top left corner of the inner rectangle
    innerComponentBoxY: number; // y coordinate of the top left corner of the inner rectangle
    innerComponentBoxWidth: number; // width of the inner rectangle
    innerComponentBoxHeight: number; // height of the inner rectangle
  
    // Used for determining the color of the circle
    color: string; // color of the circle
}