import { D3ModelLayer } from './D3ModelLayer';
import CircleStateDataPoint from './DataPointTypes/CircleStateDataPoint';
import { mockCircleStateDataPoints } from './mockDataPoints/mockCircleStateDataPoints';
import {Slot} from '../Slot';
import * as d3 from 'd3';


// Defines how to render solid circles that can be dragged around the screen.
// This is used to represent the state components in the No-Code Interface.
export class CircleStateLayer extends D3ModelLayer {

  constructor(d3SvgLayer: any, componentLayer: any, slotBorderLayer: any, slotLayer:any, connectorLayer:any, stateDataPoints: CircleStateDataPoint[], slotDataPoints: any[]) {
    super(d3SvgLayer, componentLayer, slotBorderLayer, slotLayer, connectorLayer, stateDataPoints, slotDataPoints);
  }

  // Create, Read, Update, Delete (CRUD) operations for the data points

  // --- Data Manipulation Functions ---

  // CRUD operations for the data points, which represent the No-Code State objects using circle-like svg's in the No-Code Interface.

  // Add a new data point to the dataPoints array
  addDataPoint(datapoint: CircleStateDataPoint): void {
    this.stateDataPoints.push(datapoint);
  }

  // Remove a data point from the dataPoints array
  removeDataPoint(datapoint: CircleStateDataPoint): void {
    const index = this.stateDataPoints.indexOf(datapoint);
    if (index > -1) {
      this.stateDataPoints.splice(index, 1);
    }
  }

  // Update a data point in the dataPoints array
  updateDataPoint(oldDatapoint: CircleStateDataPoint, newDatapoint: CircleStateDataPoint): void {
    const index = this.stateDataPoints.indexOf(oldDatapoint);
    if (index > -1) {
      this.stateDataPoints[index] = newDatapoint;
    }
  }

  // Get a data point from the dataPoints array
  getDataPoint(index: number): CircleStateDataPoint {
    return this.stateDataPoints[index];
  }

  // -- CRUD operations for the slots, which act as the basis for interconnecting States and managing input and output flow --

  // Add a new slot to the slots array
  addSlot(slot: Slot): void {
    this.slotDataPoints.push(slot);
  }

  // Remove a slot from the slots array
  removeSlot(slot: Slot): void {
    const index = this.slotDataPoints.indexOf(slot);
    if (index > -1) {
      this.slotDataPoints.splice(index, 1);
    }
  }

  // Update a slot in the slots array
  updateSlot(oldSlot: Slot, newSlot: Slot): void {
    const index = this.slotDataPoints.indexOf(oldSlot);
    if (index > -1) {
      this.slotDataPoints[index] = newSlot;
    }
  }

  // Get a slot from the slots array
  getSlot(index: number): Slot {
    return this.slotDataPoints[index];
  }

  // --- Rendering Functions ---

  // Renders the CircleStateLayer by creating a circle for each data point in the dataPoints array.
  render(): void {
    // We select all circles in the layer, so that we re-render all circles on each render call.
    // We should not only use cx and cy but also assign an index to act as a unique identifier for each circle.
    // This way we can guarantee that each circle is uniquely identified and can be updated correctly
    // and logic conflicts can be avoided.
    const circles = this.d3SvgLayer.selectAll('circle.circle-state') // The layer will use the second parameter of .data as the key identifier for each circle
      .data([mockCircleStateDataPoints], datapoint => datapoint.cx + '-' + datapoint.cy) // Use the cx and cy as the key identifier for each circle
    
    // ENTER: Create new rectangles for components that did not already exist in the layer.
    circles.enter()
      .append('circle') // create a circle for each data point
      .classed('circle-state', true) // Add a class to identify they a circle-state inner components
      .attr('cx', datapoint => datapoint.x) // x coordinate of the center of the circle
      .attr('cy', datapoint => datapoint.y) // y coordinate of the center of the circle
      .attr('r', datapoint => datapoint.radius) // radius of the circle
      .attr('fill', (datapoint, i) => datapoint.color) // color of the circle : to randomize use : d3.schemeCategory10[i % 10]
      .call(this.createDragStateBehavior()); // All event behaviors must be aggregated into a single function to use in the call.

    // UPDATE: Update existing circles
    circles
      .attr('cx', datapoint => datapoint.cx)
      .attr('cy', datapoint => datapoint.cy)
      .attr('r', datapoint => datapoint.radius)
      .attr('fill', (datapoint, i) => datapoint.color);

    // EXIT: Remove circles that are no longer in the data
    circles.exit().remove();
  }

  // Render the inner rectangles inside circles
  // temporarily we do this by rendering rectangles, but in the future we will render components
  // we should dynamically calculate the position and size of the inner component based on the circle's position and size
  // This is primarily used for the initial rendering of the inner components, on load of the overall no-code interface.
  renderInnerComponents(): void {
    // It is not gaurenteed that all 'rect' elements will be a rectangular component container
    // so we should add some kind of identifier for circle inner rectangles to the data to ensure that we can differentiate 
    // between them.
    const rectangularComponentContainers = this.d3SvgLayer.selectAll('rect.circle-state-inner-component')
      .data(this.stateDataPoints, datapoint => 
        datapoint.innerComponentBoxX + '-' + datapoint.innerComponentBoxY);

    // ENTER: Create new component containers for components that did not already exist in the layer.
    rectangularComponentContainers.enter()
      .append('rect')
      .classed('circle-state-inner-component', true) // Add a class to identify they a circle-state inner components
      .attr('x', datapoint => datapoint.innerComponentBoxX)
      .attr('y', datapoint => datapoint.innerComponentBoxY)
      .attr('width', datapoint => datapoint.innerComponentBoxWidth)
      .attr('height', datapoint => datapoint.innerComponentBoxHeight)
      .attr('fill', 'white')
      .attr('stroke', 'black');

    // UPDATE: Update existing component containers
    rectangularComponentContainers
      .attr('x', datapoint => datapoint.innerComponentBoxX)
      .attr('y', datapoint => datapoint.innerComponentBoxY)
      .attr('width', datapoint => datapoint.innerComponentBoxWidth)
      .attr('height', datapoint => datapoint.innerComponentBoxHeight);

    // EXIT: Remove rectangles that are no longer in the data
    rectangularComponentContainers.exit().remove();
  }

  /**
   * Renders slot markers (e.g., small circles) along a Bezier curve at specified angles.
   * this should be a layer that exists on top of the circle layer, to ensure drag events on the slots are not
   * interfered with by the circle layer.
   * @param svg - The SVG selection where the slots will be rendered.
   * @param path - The SVGPathElement representing the Bezier curve.
   * @param cx - The x-coordinate of the circle's center.
   * @param cy - The y-coordinate of the circle's center.
   * @param r - The radius of the circle.
   * @param slots - The number of slots to render.
   */
  renderSlots(
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>, // This should be a layer that exists on top of the circle layer.
    path: SVGPathElement,
    slots: Slot[]
  ) 
  {
    // We make an assumption that 4/5ths of the length of the bezier curve should be open and available
    // for use in manipulating the State itself, while the remaining 1/5th should be used for slot placement.
    // This is a temporary assumption, and in the future we should allow for the user to specify the slot placement
    // themselves.  We should also allow for the user to specify the number of slots they want to place on the bezier curve.
    // the size of the slots should be determined by the length of the bezier curve and the number of slots.
    const bezierLength = path.getTotalLength();
    // 1/5th of the bezier curve length is used for slot placement
    const slotLength = bezierLength / 5; 
    // The radius of the slot is by default 1/5th of the state's bezier curve length, but should not be less than 10 pixels.
    // It will still occupy more than 1/5th of the bezier curve length if the number of slots is too high, but
    // will still throw an error if the slots are too numerous to fit on the bezier curve.
    const slotRadius = Math.min(slotLength / slots.length, 10); 
    // If the slots take up more space than the entire curve, 
    // we should not render them, and we should handle this by requesting the user to reduce the number of slots
    // or to increase the size of the bezier curve by making the circle/state larger.
    const tooManySlots = (slotRadius * slots.length > slotLength);
    if (tooManySlots) {
      console.error('Too many slots to fit on the Bezier curve.');
    }
    else{
      // Calculate the angles for slot placement (evenly distributed around 360 degrees)
      const defaultAngleIncrements = Array.from({ length: slots.length }, (_, i) => (360 / slots.length) * i);

      // Iterate over each angle and calculate its position on the path
      defaultAngleIncrements.forEach(angle => {
        const { x, y } = this.getSlotPositionOnBezier(path, angle); // Get the point on the path for the given angle

        // Append a small circle at the calculated position to represent a slot
        svg.append('circle')
          .attr('cx', x)      // Set the x-coordinate of the slot
          .attr('cy', y)      // Set the y-coordinate of the slot
          .attr('r', slotRadius)       // Set the radius of the slot marker
          .attr('fill', 'blue'); // Set the fill color of the slot marker
      });
    }
    
  }

  /**
   * Draws a single closed Bezier curve that approximates a circle.
   * @param svg - The SVG selection where the circle will be drawn.
   * @param cx - The x-coordinate of the circle's center.
   * @param cy - The y-coordinate of the circle's center.
   * @param r - The radius of the circle.
   * @returns The SVGPathElement representing the Bezier circle.
   */
  renderClosedBezierSlotPath(
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    cx: number,
    cy: number,
    r: number
  ): SVGPathElement {
    // Define the Bezier curve path for a circle
    const bezierPath = this.generateBezierPath(cx, cy, r);// Retrieve the Bezier path for the circle's boundary.
    
    // Append the path element to the SVG
    return svg.append('path')
      .attr('d', bezierPath) // Set the path's data attribute to the Bezier path
      .attr('fill', 'none')  // Make the path transparent (no fill)
      .attr('stroke', 'black') // Set the stroke color for the path
      .attr('stroke-width', 2) // Set the stroke width for better visibility
      .node() as SVGPathElement; // Return the DOM node for the path
  }

  // --- Generator Functions for supporting overlay functions ---

  // Goes through all data points and calculates the inner component box variables for each circle.
  // Generally will only be called once, when the No-Code Solution Component is first created.
  private generateInnerComponentBoxes(datapoints: CircleStateDataPoint[]): CircleStateDataPoint[] {
    for (const datapoint of datapoints) {
      // Calculate the inner component box based on the circle's position and size
      datapoint.innerComponentBoxX = datapoint.cx - datapoint.radius / 2;
      datapoint.innerComponentBoxY = datapoint.cy - datapoint.radius / 2;
      datapoint.innerComponentBoxWidth = datapoint.radius;
      datapoint.innerComponentBoxHeight = datapoint.radius;
    }
    return datapoints;
  }

  // Generates a Bezier path for the circular no-code state, given its center and radius.
  private generateBezierPath(cx: number, cy: number, r: number): string {
    return `
      M ${cx - r}, ${cy}                   // Move to the leftmost point of the circle
      Q ${cx - r}, ${cy - r} ${cx}, ${cy - r} // First quadratic Bezier curve: top-left quadrant
      Q ${cx + r}, ${cy - r} ${cx + r}, ${cy} // Second quadratic Bezier curve: top-right quadrant
      Q ${cx + r}, ${cy + r} ${cx}, ${cy + r} // Third quadratic Bezier curve: bottom-right quadrant
      Q ${cx - r}, ${cy + r} ${cx - r}, ${cy} // Fourth quadratic Bezier curve: bottom-left quadrant
      Z                                     // Close the path to form a complete circle
    `;
  }
  
  // --- Retrieval Functions for getting related objects : Slots, Connectors, Overlay Componenets ---

  /**
   * Calculates the point on a Bezier path corresponding to a given polar angle, and transforms it to Cartesian coordinates.
   * @param path - The SVGPathElement representing the Bezier curve.
   * @param angle - The angle in degrees (0-360) representing the position on the curve.
   * @param cx - The x-coordinate of the circle's center.
   * @param cy - The y-coordinate of the circle's center.
   * @returns The x and y coordinates of the point on the path.
   */
  getSlotPositionOnBezier(
    path: SVGPathElement,
    angle: number
  ): { x: number; y: number } {
    // Get the total length of the path
    const totalLength = path.getTotalLength();

    // Normalize the angle to a fraction of the total path length
    const theta = angle % 360;       // Ensure the angle is between 0 and 360
    const fraction = theta / 360;    // Convert the angle to a fraction of the circle

    // Get the point on the path at the corresponding length
    const point = path.getPointAtLength(fraction * totalLength);

    return { x: point.x, y: point.y }; // Return the calculated coordinates
  }

  // Get a connector originating from a slot on one circle to a slot on another circle

  // Get an overlay component that is displayed within a circle
  // since overlay components are not rendered by d3, we should use the overlay component service to render them
  // however, we should still have a function that returns the overlay component that is displayed within a circle
  // so that we can use it in the drag event handlers for the circles.
  // This function should return the overlay component that is displayed within the who's cx and cy are closest to the 
  // given x and y.

  // --- Event Handlers ---

  // -- Drag behavior for the state circles --

  // Drag behavior with modularized event handlers
  private createDragStateBehavior(): d3.DragBehavior<SVGCircleElement, CircleStateDataPoint, CircleStateDataPoint> {
    return d3.drag<SVGCircleElement, CircleStateDataPoint>()
      .on('start', (event, d) => this.onDragStateStart(event, d))
      .on('drag', (event, d) => this.onDragState(event, d))
      .on('end', (event, d) => this.onDragStateEnd(event, d));
  }

  // Event handlers for drag behavior for when the circle starts being dragged.
  private onDragStateStart(event: d3.D3DragEvent<SVGCircleElement, CircleStateDataPoint, CircleStateDataPoint>, datapoint: CircleStateDataPoint): void {
    // We should make the overlay component corresponding to this circle invisible while dragging.
    // This is because dragging the overlay component along with the circle may be too expensive
    // to update in real-time.
    d3.select(event.sourceEvent.target)
      .raise()
      .attr('stroke', 'black'); // Highlight the circle being dragged so it is clear which circle is being dragged.
  }

  // Event handlers for drag behavior for while the circle is being dragged.
  private onDragState(event: d3.D3DragEvent<SVGCircleElement, CircleStateDataPoint, CircleStateDataPoint>, datapoint: CircleStateDataPoint): void {
    datapoint.cx = event.x; // Update data
    datapoint.cy = event.y; // Update data
    // By changing the cx and cy attributes of the circle, we are effectively moving the circle on the screen.
    d3.select(event.sourceEvent.target)
      .attr('cx', datapoint.cx)
      .attr('cy', datapoint.cy); // Update SVG attributes
  }

  // Event handlers for drag behavior for when the circle stops being dragged.
  private onDragStateEnd(event: d3.D3DragEvent<SVGCircleElement, CircleStateDataPoint, CircleStateDataPoint>, datapoint: CircleStateDataPoint): void {
    // We should make the overlay component corresponding to this circle visible again after updating the
    // overlay component's position based on the new position of the circle.
    d3.select(event.sourceEvent.target).attr('stroke', null);
  }

}