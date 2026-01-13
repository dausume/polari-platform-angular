// Author: Dustin Etts
// polari-platform-angular/src/app/models/noCode/d3-extensions/CircleStateLayer.ts
import { D3ModelLayer } from './D3ModelLayer';
import CircleStateDataPoint from './DataPointTypes/CircleStateDataPoint';
import CircleSlotDataPoint from './DataPointTypes/CircleSlotDataPoint';
import { mockCircleStateDataPoints } from './mockDataPoints/mockCircleStateDataPoints';
import { NoCodeStateRendererManager } from '@services/no-code-services/no-code-state-renderer-manager';
import { BehaviorSubject, Subscription } from 'rxjs';
import {Slot} from '../Slot';
import * as d3 from 'd3';
import { NoCodeState } from '../NoCodeState';
import { NoCodeSolution } from '../NoCodeSolution';
import { InteractionStateService } from '@services/no-code-services/interaction-state-service';

// Defines how to render solid circles that can be dragged around the screen.
// This is used to represent the state components in the No-Code Interface.
export class CircleStateLayer extends D3ModelLayer {

  connectorMode: boolean;
  currentDragElement: HTMLElement | null = null;
  currentGroupElement: SVGGElement | null = null;
  currentDragTargetDataPoint: CircleStateDataPoint | CircleSlotDataPoint | null = null;
  currentGroupCenter: {x,y} | null = null;
  currentGroupCoordinateTransformMatrix: DOMMatrix | null = null;

  constructor(
    private rendererManager: NoCodeStateRendererManager, // Inject rendererManager (injecting in both parent and child seems to cause error?)
    private interactionStateService: InteractionStateService,
    shapeType: string,
    noCodeSolution: NoCodeSolution,
    stateDataPoints: CircleStateDataPoint[], 
    iconSvgString?: string,
    slotDataPoints?: CircleSlotDataPoint[],
    slotBorderLayer?: d3.Selection<SVGGElement, unknown, null, undefined>, 
    slotLayer?:d3.Selection<SVGGElement, unknown, null, undefined>, 
    connectorLayer?:d3.Selection<SVGGElement, unknown, null, undefined>,
    componentLayer?: d3.Selection<SVGGElement, unknown, null, undefined>, 
  ) 
  {
    console.log("CircleStateLayer constructor called");
    super(
      // Required parameters for the D3ModelLayer constructor
      shapeType, noCodeSolution, stateDataPoints, 
      // Optional parameters for the D3ModelLayer constructor
      iconSvgString, // Optional parameter used when loading an icon for the state
      slotDataPoints, // Optional parameter used when loading a no-code-solution that has been saved to the backend and configured.
      // Used when loading a no-code-solution from rendered layers that have been cached since render layers are not saved to the backend, 
      // only the minimal data required to render the layers.
      slotBorderLayer, slotLayer, connectorLayer, componentLayer
    );
     // Subscribe to the BehaviorSubject for the d3SvgBaseLayer in the renderer manager
     console.log("rendererManager in CircleStateLayer:", rendererManager);
     console.log("this.rendererManager:", this.rendererManager);
     console.log("this.rendererManager.subscribeToD3SvgBaseLayer:", this.rendererManager.subscribeToD3SvgBaseLayer);
     console.log("NoCodeSolution in CircleStateLayer:", this.noCodeSolution);
    // Explicitly typecast the BehaviorSubject to a Subscription to avoid type errors
    this.baseLayerSubscription = this.rendererManager.subscribeToD3SvgBaseLayer((baseLayer:d3.Selection<SVGSVGElement, unknown, null, undefined> | undefined) => {
      if (baseLayer) {
          console.log("Subscription triggered to update D3 Svg Base Layer in CircleStateLayer");
          this.setD3SvgBaseLayer(baseLayer);
      }
    });
    this.stateDataPoints = this.getCircleStateDataPointsFromSolution(noCodeSolution);
    this.slotDataPoints =  this.getCircleSlotDataPointsFromSolution(noCodeSolution);
    this.connectorMode = false;
    
  }

  // Detect if the connector layer for the solution already exists in the svg.
  // The connector layer should be created only once for each solution.
  // The connector layer should contain all the connectors for the solution.
  retrieveConnectorLayer():  d3.Selection<SVGGElement, unknown, null, undefined>{
    let solutionLayer = this.getSolutionLayer();
    return solutionLayer
      .selectAll(`g.connector-layer`);
  }

  // Detect if the connector layer for the solution already exists in the svg base layer.
  // This is used to determine if we should append the slot layer to the svg.
  getSolutionLayer():  d3.Selection<SVGGElement, unknown, null, undefined>{
    return this.d3SvgBaseLayer
      .selectAll(`g.solution-layer-${this.noCodeSolution?.solutionName}`);
  }

  // Retrieves the circle state objects from the no-code solution and converts them into data-points.
  /**
   * Retrieves all circle state objects from the NoCodeSolution and converts them into CircleStateDataPoint format.
   * This allows them to be rendered correctly in the CircleStateLayer.
   * Also appends inner component boxes and outer bounding boxes to the data points.
   * 
   * @param noCodeSolution - The NoCodeSolution containing NoCodeState objects.
   * @returns An array of CircleStateDataPoint objects for rendering.
   */
  private getCircleStateDataPointsFromSolution(noCodeSolution: NoCodeSolution): CircleStateDataPoint[] {
    if (!noCodeSolution) {
        console.error("NoCodeSolution is undefined. Cannot retrieve circle state data points.");
        return [];
    }

    console.log("Retrieving circle state data points from NoCodeSolution:", noCodeSolution.solutionName);

    let solutionStates = noCodeSolution.stateInstances
        .filter(state => state.shapeType === "circle") // Filter only circle states
        .map(state => (
          new CircleStateDataPoint(
            state.stateLocationX ?? 0, // cx
            state.stateLocationY ?? 0, // cy 
            state.stateSvgRadius ?? 10, // radius: Default to 10 if undefined
            state.slotRadius ?? 4, // slotRadius: Default to 4 if undefined
            state.stateName ?? "unknown", // stateName : Default to "unknown" if undefined
        )
      ));
        console.log("Solution States:", solutionStates);

        //solutionStates = this.appendInnerComponentBoxesToCircleDatapoints(solutionStates);
        //solutionStates = this.appendOuterBoundingBoxesToCircleDatapoints(solutionStates);
       
    return solutionStates;
  }

  //
  private getCircleSlotDataPointsFromSolution(noCodeSolution: NoCodeSolution) : CircleSlotDataPoint[]
  {
    if (!noCodeSolution) {
      console.error("NoCodeSolution is undefined. Cannot retrieve slot data points.");
      return [];
    }

    console.log("Retrieving circle state slot data points from NoCodeSolution:", noCodeSolution.solutionName);

    let slotDataPoints = noCodeSolution.stateInstances
      .filter(state => state.shapeType === "circle") // Filter only circle states
      .flatMap((state: NoCodeState) => 
          state.slots?.map((slot:Slot) => new CircleSlotDataPoint(
              state.stateLocationX ?? 0,
              state.stateLocationY ?? 0,
              state.stateSvgRadius ?? 10,
              slot.slotAngularPosition ?? 0,
              slot.index,
              slot.isInput,
              slot.isOutput,
              state.stateName ?? "unknown"
          )) || [] // Ensure it does not return undefined
      );
    return slotDataPoints;
  }

  // --- Rendering Functions ---

  // Renders the CircleStateLayer by creating a circle for each data point in the dataPoints array.
  render(): void {
    console.log("Step 11 : Rendering CircleStateLayer");
    console.log("CircleStateLayer render called");
    this.initializeLayerGroup();
    this.initializeStateGroups();
    this.initializeSlotLayer();
  }

  // Create, Read, Update, Delete (CRUD) operations for the data points

  // --- Data Manipulation Functions ---

  // CRUD operations for the data points, which represent the No-Code State objects using circle-like svg's in the No-Code Interface.

  addNoCodeState(newState: NoCodeState): void {
    // Confirm the shape type is circle
    if (newState.shapeType === "circle") {
      // Validate the necessary properties
      const cx = newState.stateLocationX ?? 0; // Default to 0 if undefined
      const cy = newState.stateLocationY ?? 0; // Default to 0 if undefined
      const radius = newState.stateSvgRadius ?? 10; // Default radius if undefined
      const color = newState.backgroundColor ?? "blue"
  
      // Create the CircleStateDataPoint
      const newStateDataPoint: CircleStateDataPoint = new CircleStateDataPoint(cx, cy, radius);
  
      // Add the new state data point to the layer (implementation-dependent)
      console.log("Added new CircleStateDataPoint:", newStateDataPoint);
    } else {
      console.warn(
        "Invalid No-Code State: Ensure shapeType is 'circle' for states added to the CircleStateLayer."
      );
    }
  }
  

  getStateDataPoints(): any[] {
    return this.stateDataPoints || [];
  }
  
  setStateDataPoints(dataPoints: any[]): void {
    this.stateDataPoints = dataPoints;
  }

  
  
  updateDataPoints(newDataPoints: any[]): void {
    this.stateDataPoints = newDataPoints;
    this.render();
  }  

  // Add a new data point to the dataPoints array
  addStateDataPoint(datapoint: CircleStateDataPoint): void {
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

  // -- Layer Level Functions --

  initializeLayerGroup(): void {
    // Ensure a specific <g> wrapper exists for this Layer, specific to the svg, shape type, and No-Code Solution.
    let layerGroup = this.d3SvgBaseLayer
    .selectAll(`g.${this.layerName}`)
    .data([null]); // Bind one element to ensure a single group exists

    layerGroup = layerGroup.enter()
      .append('g')
      .classed(`${this.layerName}`, true)
      .merge(layerGroup);

    console.log("Group selection after enter():", layerGroup);
  }

  // Gets the baseline group for this layer.
  getLayerGroup(): d3.Selection<SVGGElement, unknown, null, undefined> {
    return this.d3SvgBaseLayer
      .selectAll(`g.${this.layerName}`)
  }

  // Clears the layer group of all elements
  protected clearLayerGroup(): void {
    let layerGroup = this.getLayerGroup();
    layerGroup.selectAll('*').remove();
  }

  // -- State-Group Functions --

  initializeStateGroups(): void {
    if(this.d3SvgBaseLayer)
      {
        // Select states *only* inside the correct group
        let layerGroup = this.getLayerGroup()
        
        console.log("LayerGroup before state group creation:", layerGroup);
        console.log("this.stateDataPoints before state group creation:", this.stateDataPoints);
        
        let stateGroups = layerGroup
          .selectAll('g.state-group')
          .data(this.stateDataPoints, (datapoint: any) => datapoint.stateName || "unknown"); // Bind data
    
        console.log("stateGroups selection before enter():", stateGroups);
    
        // ENTER: Append new circles **inside the group**
        const newStateGroups = stateGroups.enter()
          .append('g')
          .classed('state-group', true)
          .attr('state-name', (datapoint) => {
            console.log("State-group name:", datapoint.stateName);
            return datapoint.stateName || "unknown";
          })
          .attr('x', (datapoint) => {
            console.log(`Creating state-group in '${this.noCodeSolution?.solutionName}' at X:`, datapoint.cx);
            return datapoint.cx - datapoint.radius;
          })
          .attr('y', (datapoint) => {
            console.log(`Creating state-group in '${this.noCodeSolution?.solutionName}' at Y:`, datapoint.cy);
            return datapoint.cy - datapoint.radius;
          })
          .each((datapoint, index, elements) => {  
            let group = d3.select(elements[index]); // Correct way to select element in Angular

            console.log(`Appending new state-group: ${datapoint.stateName}`);

            // Append the inner component rectangle
            group.append('rect')
                .classed('bounding-box', true)
                .attr('x', - datapoint.radius)
                .attr('y', - datapoint.radius)
                .attr('width', 2*datapoint.radius)
                .attr('height', 2*datapoint.radius)
                .attr('fill', "white")
                .attr('stroke', "black");

            // Append the background circle (visual representation of state)
            group.append('circle')
                .classed('draggable-shape', true)
                .attr('r', datapoint.radius)
                .attr('fill', "blue")
                .attr('stroke', "black");
                

            console.log("appending circle to state-group:", group);

            // Append the inner component rectangle
            group.append('rect')
                .classed('overlay-component', true)
                .attr('x', - ((1.4 * datapoint.radius)/2)) // This is the offset from the center of the circle, since it is in a group
                .attr('y', - ((1.4 * datapoint.radius)/2)) // Position in relation to the group.
                .attr('width', 1.4*datapoint.radius)
                .attr('height', 1.4*datapoint.radius)
                .attr('fill', "white")
                .attr('stroke', "black");

            // Generate the bezier path for the circle
            let bezierPath = this.generateCircularBezierPath(datapoint.radius);// Retrieve the Bezier path for the circle's boundary.
            group.append('path') // The slot path will need to be used for slot placement.
                .attr('d', bezierPath) // Set the path's data attribute to the Bezier path - positioning handled by d.
                .classed('slot-path', true)
                .attr('fill', 'none')  // Make the path transparent (no fill)
                .attr('stroke', 'red') // Set the stroke color for the path
                .attr('stroke-width', 8) // Set the stroke width for better visibility
                .node() as SVGPathElement; // Return the DOM node for the path

            console.log("appending inner component to state-group:", group);
          })
          .call(this.createDragStateBehavior()) // Apply drag behavior
          .merge(stateGroups); // Merge enter and update selections
    
        console.log("New states added:", newStateGroups.size());
    
        console.log("Updated states:", newStateGroups);
    
        // EXIT: Remove circles that no longer exist in data
        stateGroups.exit().remove();
        console.log("State group render complete.");
    
      }
  }

  getStateGroups(): d3.Selection<SVGGElement, unknown, null, undefined> {
    return this.getLayerGroup()
      .selectAll('g.state-group');
  }

  // -- Background Circles of States Layer Functions --

  // We select all circles in the layer, so that we re-render all circles on each render call.
    // We should not only use cx and cy but also assign an index to act as a unique identifier for each circle.
    // This way we can guarantee that each circle is uniquely identified and can be updated correctly
    // and logic conflicts can be avoided.
    /*
      initializeCircleStateLayer(): void {
    if(this.d3SvgBaseLayer)
      {
        // Select circles should simply use the attributes of their immediate parent
        // group.  This is so that we can easily manipulate the circles by manipulating the group.
        // as well as the other elements in the group.
        //
        // By binding the data to the group, we can ensure we only have to update the group
        // element in order to update the circle, inner component, and bounding box.
        let circles = this.getStateGroups()
          .data(d => [d]) // Bind one datum per group (for each state group bind one circle)
          .join(
            enter => enter.append('circle')
                .classed('circle-state', true)
                .attr('r', d => d.radius || 10)
                .attr('fill', 'blue'),
            update => update // No additional updates for now
        );
    
        console.log("Circle selection before enter():", circles);
    
        // ENTER: Append new circles **inside the group**
        
        const newCircles = circles.enter()
        .append('g')
        .classed('state-group', true)
        .attr('cx', (datapoint) => {
          console.log(`Creating state-group in '${this.noCodeSolution?.solutionName}' at X:`, datapoint.cx);
          return datapoint.cx;
        })
        .attr('cy', (datapoint) => {
          console.log(`Creating state-group in '${this.noCodeSolution?.solutionName}' at Y:`, datapoint.cy);
          return datapoint.cy;
        })
        .attr('r', (datapoint) => {
          console.log("State-group radius:", datapoint.radius);
          return datapoint.radius || 10;
        })
        .attr('state-name', (datapoint) => {
          console.log("State-group color:", datapoint.stateName);
          return datapoint.color || "blue";
        })
        .call(this.createDragStateBehavior()) // Apply drag behavior
        .merge(circles); // Merge enter and update selections
        
    
        console.log("New circles added:", newCircles.size());
    
        // UPDATE: Modify existing circles in the correct group
        newCircles
        .attr('cx', (datapoint) => datapoint.cx)
        .attr('cy', (datapoint) => datapoint.cy)
        .attr('r', (datapoint) => datapoint.radius)
        .attr('fill', (datapoint) => datapoint.color);
        
        console.log("created circles:", circles);
    
        // EXIT: Remove circles that no longer exist in data
        circles.exit().remove();
        console.log("CircleStateLayer render complete.");
    
      }
  }*/

  // Gets the circle states in the layer
  getCircleElements(): d3.Selection<SVGGElement, CircleStateDataPoint, any, unknown> {
    return this.getStateGroups()
      .selectAll('circle.state-circle');
  }

  // -- Overlay Component Functions --

  // --- Slot Placement Functions ---

    /**
   * 
   * @param r 
   * @returns 
   * 
    * Generates a Bezier path for the circular no-code state, given its center and radius.
    */
  generateCircularBezierPath(r: number): string {
    // made adjustments since we shifted to having the bezier path be a part of the state-group
    return `
    M -${r}, 0
    Q -${r}, -${r} 0, -${r}
    Q ${r}, -${r} ${r}, 0
    Q ${r}, ${r} 0, ${r}
    Q -${r}, ${r} -${r}, 0
    Z
    `;
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
  initializeSlotLayer()
  {
    console.log("initializeSlotLayer called");
    // Get this entire layer group
    let layer = this.getLayerGroup();
    let stateGroups = this.getStateGroups();
    console.log("Initializing slot layer for state groups:", stateGroups.size());
    // Go through each state group and append the slots to the group
    // We should draw the slots onto the state-group, so that they are always positioned relative to the state
    stateGroups.each((datapoint: CircleStateDataPoint, index: number, elements: any) => {
      let currentStateGroup = d3.select(elements[index]); // Select current state-group
      // Get the slots for the current state-group
      let currentStateSlots = this.slotDataPoints.filter((slot: CircleSlotDataPoint) => slot.stateName === datapoint.stateName);
      // Ensure the slots are ordered by their index
      let indexSortedSlots = currentStateSlots.sort((a: CircleSlotDataPoint, b: CircleSlotDataPoint) => a.index - b.index);
      console.log("Current State Slots Sorted by index:", indexSortedSlots);
      //console.log("Current Element in initializeSlotLayer with datapoint ", datapoint ,":", currentStateGroup);
      const path = currentStateGroup.select('path.slot-path').node() as SVGPathElement; // Get the slot path for the circle
      console.log("Path in initializeSlotLayer:", path);
      // We make an assumption that 4/5ths of the length of the bezier curve should be open and available
      // for use in manipulating the State itself, while the remaining 1/5th should be used for slot placement.
      // This is a temporary assumption, and in the future we should allow for the user to specify the slot placement
      // themselves.  We should also allow for the user to specify the number of slots they want to place on the bezier curve.
      // the size of the slots should be determined by the length of the bezier curve and the number of slots.
      const bezierLength = path.getTotalLength(); // Size in pixels
      console.log("bezierLength:", bezierLength);
      // The bezier curve length used for a single slot placement to occupy.
      const slotLength = bezierLength / currentStateSlots.length || 0; // We modify slot size to ensure it is not too small or too big
      // The radius of the slot is by default 1/5th of the state's bezier curve length, but should not be less than 10 pixels.
      // It will still occupy more than 1/5th of the bezier curve length if the number of slots is too high, but
      // will still throw an error if the slots are too numerous to fit on the bezier curve.
      const slotRadius = Math.min(slotLength / currentStateSlots.length, 10);
      // If the slots take up more space than the entire curve,
      // we should not render them, and we should handle this by requesting the user to reduce the number of slots
      // or to increase the size of the bezier curve by making the circle/state larger.
      const tooManySlots = (slotRadius * currentStateSlots.length > slotLength);
      if (tooManySlots) {
        console.log("Too many slots to fit on the bezier curve. Please reduce the number of slots or increase the size of the bezier curve.");
      }
      else{
        console.log("Rendering slots on bezier curve for state:", datapoint.stateName);
        // Calculate the angles for slot placement (evenly distributed around 360 degrees)
        const defaultAngleIncrements = Array.from({ length: currentStateSlots.length }, (_, i) => (360 / currentStateSlots.length) * i);
        console.log("defaultAngleIncrements:", defaultAngleIncrements);
        // Iterate over each angle and calculate its position on the path
        let slotIndex = 0;
        defaultAngleIncrements.forEach(angle => {
          const { x, y } = this.getSlotPositionOnBezier(path, angle); // Get the point on the path for the given angle

          // Append a small circle at the calculated position to represent a slot
          currentStateGroup.append('circle')
            .classed('slot-marker', true) // Add the slot marker class
            .attr('slot-index', slotIndex) // Add the slot index as an attribute
            .attr('cx', x)      // Set the x-coordinate of the slot
            .attr('cy', y)      // Set the y-coordinate of the slot
            .attr('r', slotRadius)       // Set the radius of the slot marker
            .attr('fill', 'blue'); // Set the fill color of the slot marker

            slotIndex++;
        });
      }
    });

    
    
  }

  // --- Generator Functions for supporting overlay functions ---

  // Goes through all data points and calculates the inner component box variables for each circle.
  // Generally will only be called once, when the No-Code Solution Component is first created.
  private appendInnerComponentBoxesToCircleDatapoints(datapoints: CircleStateDataPoint[]): CircleStateDataPoint[] {
    for (const datapoint of datapoints) {
      // Calculate the inner component box based on the circle's position and size
      datapoint.innerComponentBoxX = datapoint.cx - datapoint.radius / 2;
      datapoint.innerComponentBoxY = datapoint.cy - datapoint.radius / 2;
      datapoint.innerComponentBoxWidth = datapoint.radius;
      datapoint.innerComponentBoxHeight = datapoint.radius;
    }
    return datapoints;
  }

  // Goes through all data points and calculates the outer bounding box variables for each circle.
  // Generally will only be called once, when the No-Code Solution Component is first created.
  private appendOuterBoundingBoxesToCircleDatapoints(datapoints: CircleStateDataPoint[]): CircleStateDataPoint[] {
    for (const datapoint of datapoints) {
      // Calculate the outer bounding box based on the circle's position and size
      datapoint.outerBoundingBoxX = datapoint.cx - datapoint.radius / 2;
      datapoint.outerBoundingBoxY = datapoint.cy - datapoint.radius / 2;
      datapoint.outerBoundingBoxWidth = datapoint.radius;
      datapoint.outerBoundingBoxHeight = datapoint.radius;
    }
    return datapoints;
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

  // Gets the closest point on a path to a given mouse position
  // used so we can ensure the drag event for slots causes the slot to be repositioned but strictly
  // along the bezier path of the circle (the border of the state group, in this case a circle).
  //
  // We should calculate the vector from the center of the state to the mouse position.
  //
  // As well as the vector from the current position of the slot to the mouse position.
  //
  // The state center should be the location of the svg in respect to the screen, in addition to the center
  // location of the draggable-object.
  private getClosestPointOnPath(stateCenter:{x,y}, path: SVGPathElement, mouseX: number, mouseY: number): { x: number; y: number } {
    const pathLength = path.getTotalLength();
    const degreeIncrement = pathLength / 360; // Increment for each degree of the path
    let closestPointOnPathToMouse = { x: 0, y: 0 };
    let debugObject;
    let minDistance = Infinity;
    //console.log("State Center:", stateCenter);
    //console.log("Path Length:", pathLength);
    //console.log("Degree Increment:", degreeIncrement);
    // Transform mouse point to path's local coordinate system
    // Get the dx, dy of the mouse in respect to the state center
    //console.log("cx, cy of circle from state-group:", stateCenter.x, stateCenter.y);
    console.log("Mouse Position:", mouseX, mouseY);
    // We transform the mouse location to be comparable to the group transformed locations
    const transformedMouseX = mouseX - stateCenter.x;
    const transformedMouseY = mouseY - stateCenter.y;
    // Search in intervals along the path to find closest point
    for (let i = 0; i <= pathLength; i += degreeIncrement) {
      const pointOnPath = path.getPointAtLength(i);
      const dx = pointOnPath.x - transformedMouseX;
      const dy = pointOnPath.y - transformedMouseY;
      const distanceUnsquared = dx * dx + dy * dy; // The non-squared version of the distance, faster to calculate and still gives comparative magnitude.
  
      if (distanceUnsquared < minDistance) {
        minDistance = distanceUnsquared;
        debugObject = { x: pointOnPath.x, y: pointOnPath.y, dx: dx, dy: dy, distance:Math.sqrt(distanceUnsquared) };
        closestPointOnPathToMouse = { x: pointOnPath.x, y: pointOnPath.y};
      }
    }
    console.log("Debug object : ", debugObject);
    const magnitudeToMouse = debugObject.distance;
    const magnitudeOfRadius = 100; // Should get actual radius of circle.
    // Angle diagnostics (for optional future filtering, or visualization logic)
    // Vector from the center of the state group to the mouse
    // This should convert be a magnitude and a unit vector.
    const unitVectorToMouse = { // Should be a unit vector with a magnitude
      magnitude:magnitudeToMouse, // Distance to the mouse click
      x:(transformedMouseX / magnitudeToMouse),
      y:(transformedMouseY / magnitudeToMouse),
    };
    console.log("Unit Vector to Mouse:", unitVectorToMouse);
    // This should convert be a magnitude and a unit vector.
    const unitVectorToPathPoint = { // Should be a unit vector with a magnitude since path is a circle.
      magnitude:magnitudeOfRadius, // Magnitude should
      x:(closestPointOnPathToMouse.x / magnitudeOfRadius),
      y:(closestPointOnPathToMouse.y / magnitudeOfRadius),
    };
    console.log("Unit Vector to Path Point:", unitVectorToPathPoint);
    
    const angleToMouse = Math.atan2(unitVectorToMouse.y, unitVectorToMouse.x);
    const angleToPathPoint = Math.atan2(unitVectorToPathPoint.y, unitVectorToPathPoint.x);

    console.log("Angle to Mouse:", angleToMouse * (180 / Math.PI), "degrees");
    console.log("Angle to Path Point:", angleToPathPoint * (180 / Math.PI), "degrees");

    // Return local coordinates (relative to the group), NOT screen coordinates
    // The slot marker cx/cy attributes are relative to the state-group
    return {
      x: closestPointOnPathToMouse.x,
      y: closestPointOnPathToMouse.y
    };

  }
  

  /**
   * Simplified function to find the closest point on a path to a mouse position.
   * Both input and output are in the same coordinate system (group-local).
   * @param path - The SVGPathElement representing the Bezier curve.
   * @param localMouseX - Mouse X in group-local coordinates.
   * @param localMouseY - Mouse Y in group-local coordinates.
   * @returns The closest point on the path in group-local coordinates.
   */
  private getClosestPointOnPathLocal(path: SVGPathElement, localMouseX: number, localMouseY: number): { x: number; y: number } {
    const pathLength = path.getTotalLength();
    const numSamples = 360; // Sample every degree
    const increment = pathLength / numSamples;

    let closestPoint = { x: 0, y: 0 };
    let minDistanceSquared = Infinity;

    // Search along the path to find the closest point
    for (let i = 0; i <= pathLength; i += increment) {
      const pointOnPath = path.getPointAtLength(i);
      const dx = pointOnPath.x - localMouseX;
      const dy = pointOnPath.y - localMouseY;
      const distanceSquared = dx * dx + dy * dy;

      if (distanceSquared < minDistanceSquared) {
        minDistanceSquared = distanceSquared;
        closestPoint = { x: pointOnPath.x, y: pointOnPath.y };
      }
    }

    return closestPoint;
  }

  // -- Drag behavior for the state circles --

  // Drag behavior with modularized event handlers
  private createDragStateBehavior(): d3.DragBehavior<SVGCircleElement, CircleStateDataPoint, CircleStateDataPoint> {
    return d3.drag<SVGCircleElement, CircleStateDataPoint>()
      .container(() => this.d3SvgBaseLayer.node() as SVGSVGElement) // Set the event to listen across the whole d3 screen so it does not lose the event
      .subject((event, d) => d) // Set the subject to the current data point
      .on('start', (event, d) => this.onDragStateStart(event, d))
      .on('drag', (event, d) => this.onDragState(event, d))
      .on('end', (event, d) => this.onDragStateEnd(event, d));
  }

  // Event handlers for drag behavior for when the circle starts being dragged.
  private onDragStateStart(
    event: d3.D3DragEvent<SVGCircleElement, CircleStateDataPoint | CircleSlotDataPoint, CircleStateDataPoint | CircleSlotDataPoint>, 
    datapoint: CircleStateDataPoint | CircleSlotDataPoint
  ): void {
    console.log("Drag Start event triggered");
    // We should make the overlay component corresponding to this circle invisible while dragging.
    // This is because dragging the overlay component along with the circle may be too expensive
    // to update in real-time.
    let target : EventTarget | null = event.sourceEvent.target;
    const targetElement: HTMLElement | null = target as HTMLElement;
    
    console.log("Target Element:", targetElement);
    //if(!targetElement){return;}
    // Find the closest state-group <g> element
    const groupElement: SVGGElement | null = targetElement.closest('g.state-group');
    // Convert the groupElement to a D3 selection
    const group: d3.Selection<SVGGElement, unknown, null, undefined> = d3.select(groupElement);
    // We also need to get the draggable-shape element to use as our center-point.
    this.currentDragElement = targetElement;
    this.currentGroupElement = groupElement;
    this.currentDragTargetDataPoint = datapoint;
    const groupNode = group.node(); // group is your d3.Selection<SVGGElement, ...>
    const groupCTM = groupNode?.getScreenCTM();
    this.currentGroupCoordinateTransformMatrix;
    const groupBounds = groupElement?.getBoundingClientRect();
    // Using left,right,top,bottom to get the center of the group
    const groupCenterX = (groupBounds?.left || 0) + (groupBounds?.width || 0) / 2;
    const groupCenterY = (groupBounds?.top || 0) + (groupBounds?.height || 0) / 2;
    this.currentGroupCenter = { x: groupCenterX, y: groupCenterY };
    console.log("Group bounds relative to screen:", groupBounds);
    // Ensure drag only starts if the clicked element is a circle
    if (targetElement?.tagName === 'circle' && targetElement?.classList.contains('draggable-shape')) {
      event.sourceEvent.stopPropagation(); // Prevent the drag event from being triggered on the state group
      console.log(`Dragging started for ${datapoint.stateName}`);
      //console.log("Initial Offset:", { x: datapoint._dragOffsetX, y: datapoint._dragOffsetY });
      this.interactionStateService.setInteractionState('state-drag');
      group.raise().attr('stroke', 'black'); // Highlight active group
    }
    else if (targetElement?.tagName === 'circle' && targetElement?.classList.contains('slot-marker')) {
      console.log(`Dragging started for slot on ${datapoint.stateName}`);
      
      event.sourceEvent.stopPropagation(); // Prevent the drag event from being triggered on the state group
      if(this.connectorMode) // In connector mode a drag event should create a connector between two slot markers
      {
        // Create a new connector between the center of the slot marker and the current mouse position
        // we create an arrow svg element to act as our connector.
        const connector = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        // Set the connector's attributes
        connector.setAttribute('d', `M ${datapoint.cx} ${datapoint.cy} L ${event.x} ${event.y}`);
        connector.setAttribute('class', 'tentative-connector');
        connector.setAttribute('fill', 'none');
        connector.setAttribute('stroke', 'black');
        connector.setAttribute('stroke-width', '2');
        connector.setAttribute('marker-end', 'url(#arrowhead)');
        // Append the connector to the connector layer
        this.connectorLayer?.node()?.appendChild(connector);
        this.interactionStateService.setInteractionState('connector-drag');
      }
      else
      {
        // Triggered slot-moving event.
        this.interactionStateService.setInteractionState('slot-drag');
      }
      group.raise().attr('stroke', 'black'); // Highlight active group
    }
    console.log("Drag Start event complete");
  }

  // Event handlers for drag behavior for while the circle is being dragged.
  private onDragState(event: d3.D3DragEvent<SVGCircleElement, CircleStateDataPoint, CircleStateDataPoint>, datapoint: CircleStateDataPoint): void {
    console.log("Drag event triggered");
    // By changing the cx and cy attributes of the circle, we are effectively moving the circle on the screen.
    //d3.select(event.sourceEvent.target)
    //  .attr('cx', datapoint.cx)
    //  .attr('cy', datapoint.cy); // Update SVG attributes
    //let group = d3.select(event.sourceEvent.target.closest('g.state-group'));
    //if(!target){return;}
    const targetElement: HTMLElement | null = this.currentDragElement;
    // Find the closest state-group <g> element
    const groupElement: SVGGElement | null = this.currentGroupElement;
    //if(!groupElement){return;}
    // Convert the groupElement to a D3 selection
    const group: d3.Selection<SVGGElement, unknown, null, undefined> = d3.select(groupElement);
    //if (event.sourceEvent.target.tagName === 'circle') 
    let interactionState = this.interactionStateService.getCurrentState();
    console.log("Current Interaction State:", interactionState);
      if (interactionState === 'slot-drag') // Case for dragging of slot markers or making connectors.
      {
          event.sourceEvent.stopPropagation(); // Prevent the drag event from being triggered on the state group

          // Get the center location of the slot marker that was clicked on.
          const slotMarker = d3.select(targetElement);
          const path = group.select('path.slot-path').node() as SVGPathElement;

          // Get the group's current transform to convert SVG coords to group-local coords
          const currentGroupTransform = group.attr("transform") || "translate(0,0)";
          const matchGroup = currentGroupTransform.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);
          const groupTranslateX = matchGroup ? parseFloat(matchGroup[1]) : 0;
          const groupTranslateY = matchGroup ? parseFloat(matchGroup[2]) : 0;

          // event.x/y are in SVG coordinates, convert to group-local coordinates
          const localMouseX = event.x - groupTranslateX;
          const localMouseY = event.y - groupTranslateY;

          // Find closest point on the bezier path to the mouse (in local coords)
          const closestPoint = this.getClosestPointOnPathLocal(path, localMouseX, localMouseY);
          console.log("Closest point on path:", closestPoint);

          // Set the slot marker's position to the closest point on the path
          slotMarker.attr('cx', closestPoint.x);
          slotMarker.attr('cy', closestPoint.y);
      }
      else if(interactionState === 'state-drag') // Case for dragging of the entire state group
      {
        event.sourceEvent.stopPropagation(); // Prevent the drag event from being triggered on the state group
         // We should update the group's transform attribute to move the entire group
        const currentGroupTransform = group.attr("transform") || "translate(0,0)";
        const matchGroup = currentGroupTransform.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);
        let currentGroupX = matchGroup ? parseFloat(matchGroup[1]) : 0;
        let currentGroupY = matchGroup ? parseFloat(matchGroup[2]) : 0;
        //console.log("Current Group Transform:", { currentGroupX, currentGroupY });
        //console.log("Event dx, dy:", event.dx, event.dy);
        // Apply incremental movement
        const translateX = currentGroupX + event.dx;
        const translateY = currentGroupY + event.dy;

        // Update the group transformation
        group.attr('transform', `translate(${translateX}, ${translateY})`);
      }
      else if(interactionState === 'connector-drag') // Case for dragging of the connector
      {
        // Get the current mouse position
        const mousePosition = d3.pointer(event.sourceEvent, this.d3SvgBaseLayer.node());
        // Update the connector's path to follow the mouse position
        const connector = this.connectorLayer?.select('path.tentative-connector');
        const path = group.select('path.slot-path').node() as SVGPathElement;
        const pathLength = path.getTotalLength();
        //const closestPoint = this.getClosestPointOnBezierPath(path, event.x, event.y);
        if (connector) {
          connector.attr('d', `M ${datapoint.cx} ${datapoint.cy} L ${mousePosition[0]} ${mousePosition[1]}`);
        }
        // When dragging a slot marker, we should update the slot marker's position
            // the slot marker should be constrained to the bezier path of the circle
            // and should have it's position defined parametrically by the angle of the slot
            // and the location of the bezier path progression at the fraction of the angle.
            console.log("Dragging slot marker event triggered");
            // Get the closest location on the bezier path to the current mouse position
            
            
      }
      else
      {
        // For unhandled dragged circle events
        console.log("Unhandled dragged circle event triggered");
      }
    // console.log("Drag event step complete");
  }

  // Event handlers for drag behavior for when the circle stops being dragged.
  private onDragStateEnd(event: d3.D3DragEvent<SVGCircleElement, CircleStateDataPoint, CircleStateDataPoint>, datapoint: CircleStateDataPoint): void {
    console.log("Drag End event triggered");
    // We should make the overlay component corresponding to this circle visible again after updating the
    // overlay component's position based on the new position of the circle.
    let target : EventTarget | null = event.sourceEvent.target;
    //if(!target){return;}
    const targetElement: HTMLElement | null = target as HTMLElement;
    // Find the closest state-group <g> element
    const groupElement: SVGGElement | null = targetElement.closest('g.state-group');
    //if(!groupElement){return;}
    // Convert the groupElement to a D3 selection
    const group: d3.Selection<SVGGElement, unknown, null, undefined> = d3.select(groupElement);
    //let group = d3.select(event.sourceEvent.target.closest('g.state-group'));

    if (targetElement?.tagName === 'circle') {
      group.attr('stroke', null);
    }
    console.log("Drag End event complete");
  }


  // Ensure cleanup of the subscription
  public destroy(): void {
    this.baseLayerSubscription?.unsubscribe();
  }

}