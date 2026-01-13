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
  // Store the source slot position in SVG coordinates when starting connector drag
  connectorSourcePosition: {x: number, y: number} | null = null;
  // Store source slot identification for connector tracking
  connectorSourceSlotInfo: {stateName: string, slotIndex: number} | null = null;
  // Store original slot position for auto-connector activation
  originalSlotPosition: {x: number, y: number} | null = null;
  // Store the state radius for threshold calculation
  currentDragStateRadius: number = 0;

  constructor(
    private rendererManager: NoCodeStateRendererManager,
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
    super(
      shapeType, noCodeSolution, stateDataPoints,
      iconSvgString,
      slotDataPoints,
      slotBorderLayer, slotLayer, connectorLayer, componentLayer
    );
    // Subscribe to the BehaviorSubject for the d3SvgBaseLayer in the renderer manager
    this.baseLayerSubscription = this.rendererManager.subscribeToD3SvgBaseLayer((baseLayer:d3.Selection<SVGSVGElement, unknown, null, undefined> | undefined) => {
      if (baseLayer) {
          this.setD3SvgBaseLayer(baseLayer);
      }
    });
    this.stateDataPoints = this.getCircleStateDataPointsFromSolution(noCodeSolution);
    this.slotDataPoints = this.getCircleSlotDataPointsFromSolution(noCodeSolution);
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

    return noCodeSolution.stateInstances
        .filter(state => state.shapeType === "circle")
        .map(state => new CircleStateDataPoint(
            state.stateLocationX ?? 0,
            state.stateLocationY ?? 0,
            state.stateSvgRadius ?? 10,
            state.slotRadius ?? 4,
            state.stateName ?? "unknown",
        ));
  }

  private getCircleSlotDataPointsFromSolution(noCodeSolution: NoCodeSolution): CircleSlotDataPoint[] {
    if (!noCodeSolution) {
      console.error("NoCodeSolution is undefined. Cannot retrieve slot data points.");
      return [];
    }

    return noCodeSolution.stateInstances
      .filter(state => state.shapeType === "circle")
      .flatMap((state: NoCodeState) =>
          state.slots?.map((slot: Slot) => new CircleSlotDataPoint(
              state.stateLocationX ?? 0,
              state.stateLocationY ?? 0,
              state.stateSvgRadius ?? 10,
              slot.index,
              slot.slotAngularPosition ?? 0,
              slot.isInput,
              slot.isOutput,
              state.stateName ?? "unknown"
          )) || []
      );
  }

  // --- Rendering Functions ---

  // Renders the CircleStateLayer by creating a circle for each data point in the dataPoints array.
  render(): void {
    this.initializeLayerGroup();
    this.initializeArrowheadMarker();
    this.initializeConnectorLayer();
    this.initializeStateGroups();
    this.initializeSlotLayer();
  }

  // Initialize the arrowhead marker definition for connectors
  private initializeArrowheadMarker(): void {
    let defs = this.d3SvgBaseLayer.select('defs');
    if (defs.empty()) {
      defs = this.d3SvgBaseLayer.append('defs');
    }

    if (defs.select('#arrowhead').empty()) {
      defs.append('marker')
        .attr('id', 'arrowhead')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 8)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', '#333');
    }
  }

  // Initialize the connector layer for drawing connections between slots
  private initializeConnectorLayer(): void {
    let layerGroup = this.getLayerGroup();
    let existingConnectorLayer = layerGroup.select('g.connector-layer');
    if (existingConnectorLayer.empty()) {
      this.connectorLayer = layerGroup.append('g')
        .classed('connector-layer', true);
    } else {
      this.connectorLayer = existingConnectorLayer as d3.Selection<SVGGElement, unknown, null, undefined>;
    }
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
      // TODO: Add the new state data point to the layer
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
    // Ensure a specific <g> wrapper exists for this Layer
    let layerGroup = this.d3SvgBaseLayer
      .selectAll(`g.${this.layerName}`)
      .data([null]);

    layerGroup.enter()
      .append('g')
      .classed(`${this.layerName}`, true)
      .merge(layerGroup);
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
    if (!this.d3SvgBaseLayer) return;

    let layerGroup = this.getLayerGroup();
    let stateGroups = layerGroup
      .selectAll('g.state-group')
      .data(this.stateDataPoints, (datapoint: any) => datapoint.stateName || "unknown");

    // ENTER: Append new state groups
    stateGroups.enter()
      .append('g')
      .classed('state-group', true)
      .attr('state-name', (datapoint) => datapoint.stateName || "unknown")
      .attr('x', (datapoint) => datapoint.cx - datapoint.radius)
      .attr('y', (datapoint) => datapoint.cy - datapoint.radius)
      .each((datapoint, index, elements) => {
        let group = d3.select(elements[index]);

        // Append the bounding box rectangle
        group.append('rect')
            .classed('bounding-box', true)
            .attr('x', -datapoint.radius)
            .attr('y', -datapoint.radius)
            .attr('width', 2 * datapoint.radius)
            .attr('height', 2 * datapoint.radius)
            .attr('fill', "white")
            .attr('stroke', "black");

        // Append the background circle (visual representation of state)
        group.append('circle')
            .classed('draggable-shape', true)
            .attr('r', datapoint.radius)
            .attr('fill', "blue")
            .attr('stroke', "black");

        // Append the inner component rectangle
        group.append('rect')
            .classed('overlay-component', true)
            .attr('x', -(1.4 * datapoint.radius) / 2)
            .attr('y', -(1.4 * datapoint.radius) / 2)
            .attr('width', 1.4 * datapoint.radius)
            .attr('height', 1.4 * datapoint.radius)
            .attr('fill', "white")
            .attr('stroke', "black");

        // Generate the bezier path for the circle boundary
        let bezierPath = this.generateCircularBezierPath(datapoint.radius);
        group.append('path')
            .attr('d', bezierPath)
            .classed('slot-path', true)
            .attr('fill', 'none')
            .attr('stroke', 'red')
            .attr('stroke-width', 8);
      })
      .call(this.createDragStateBehavior())
      .merge(stateGroups);

    // EXIT: Remove state groups that no longer exist in data
    stateGroups.exit().remove();
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
  initializeSlotLayer(): void {
    let stateGroups = this.getStateGroups();

    stateGroups.each((datapoint: CircleStateDataPoint, index: number, elements: any) => {
      let currentStateGroup = d3.select(elements[index]);

      // Clear any existing slot markers to prevent duplicates on re-render
      currentStateGroup.selectAll('circle.slot-marker').remove();

      // Get and sort slots for the current state-group
      let currentStateSlots = this.slotDataPoints.filter((slot: CircleSlotDataPoint) => slot.stateName === datapoint.stateName);
      let indexSortedSlots = currentStateSlots.slice().sort((a: CircleSlotDataPoint, b: CircleSlotDataPoint) => a.index - b.index);

      const path = currentStateGroup.select('path.slot-path').node() as SVGPathElement;
      if (!path) return;

      const bezierLength = path.getTotalLength();
      const slotLength = bezierLength / currentStateSlots.length || 0;
      const slotRadius = Math.min(slotLength / currentStateSlots.length, 10);
      const tooManySlots = (slotRadius * currentStateSlots.length > slotLength);

      if (tooManySlots) {
        console.warn("Too many slots to fit on the bezier curve.");
        return;
      }

      // Create slot markers
      for (let i = 0; i < indexSortedSlots.length; i++) {
        const slotData = indexSortedSlots[i];
        const angle = slotData.angularPosition ?? (slotData.index * (360 / currentStateSlots.length));
        const { x, y } = this.getSlotPositionOnBezier(path, angle);

        currentStateGroup.append('circle')
          .classed('slot-marker', true)
          .attr('slot-index', String(slotData.index))
          .attr('data-state-name', datapoint.stateName)
          .attr('cx', x)
          .attr('cy', y)
          .attr('r', slotRadius)
          .attr('fill', slotData.isInput ? 'green' : 'blue');
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
    const degreeIncrement = pathLength / 360;
    let closestPointOnPathToMouse = { x: 0, y: 0 };
    let minDistance = Infinity;

    const transformedMouseX = mouseX - stateCenter.x;
    const transformedMouseY = mouseY - stateCenter.y;

    for (let i = 0; i <= pathLength; i += degreeIncrement) {
      const pointOnPath = path.getPointAtLength(i);
      const dx = pointOnPath.x - transformedMouseX;
      const dy = pointOnPath.y - transformedMouseY;
      const distanceUnsquared = dx * dx + dy * dy;

      if (distanceUnsquared < minDistance) {
        minDistance = distanceUnsquared;
        closestPointOnPathToMouse = { x: pointOnPath.x, y: pointOnPath.y };
      }
    }

    return closestPointOnPathToMouse;
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

  /**
   * Hides all connectors attached to a state (used during state drag for performance)
   */
  private hideConnectorsForState(stateName: string): void {
    if (!this.connectorLayer) return;

    // Hide connectors where this state is the source
    this.connectorLayer.selectAll(`path.permanent-connector[data-source-state="${stateName}"]`)
      .style('display', 'none');

    // Hide connectors where this state is the target
    this.connectorLayer.selectAll(`path.permanent-connector[data-target-state="${stateName}"]`)
      .style('display', 'none');
  }

  /**
   * Shows and repositions all connectors attached to a state (called after state drag ends)
   */
  private showAndUpdateConnectorsForState(stateName: string, groupElement: SVGGElement): void {
    if (!this.connectorLayer) return;

    const group = d3.select(groupElement);
    const transform = group.attr("transform") || "translate(0,0)";
    const match = transform.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);
    const translateX = match ? parseFloat(match[1]) : 0;
    const translateY = match ? parseFloat(match[2]) : 0;

    // Get all slots in this state and update their connectors
    group.selectAll('circle.slot-marker').each((d, i, nodes) => {
      const slotMarker = d3.select(nodes[i]);
      const slotIndex = parseInt(slotMarker.attr('slot-index') || '0', 10);
      const localX = parseFloat(slotMarker.attr('cx') || '0');
      const localY = parseFloat(slotMarker.attr('cy') || '0');
      const svgX = localX + translateX;
      const svgY = localY + translateY;

      // Update connectors for this slot
      this.updateConnectorsForSlot(stateName, slotIndex, svgX, svgY);
    });

    // Show connectors where this state is the source
    this.connectorLayer.selectAll(`path.permanent-connector[data-source-state="${stateName}"]`)
      .style('display', null);

    // Show connectors where this state is the target
    this.connectorLayer.selectAll(`path.permanent-connector[data-target-state="${stateName}"]`)
      .style('display', null);
  }

  /**
   * Updates all connectors that are attached to a specific slot.
   * Called when a slot is being dragged to reposition it.
   */
  private updateConnectorsForSlot(stateName: string, slotIndex: number, newX: number, newY: number): void {
    if (!this.connectorLayer) return;

    const sourceSelector = `path.permanent-connector[data-source-state="${stateName}"][data-source-slot="${slotIndex}"]`;
    const targetSelector = `path.permanent-connector[data-target-state="${stateName}"][data-target-slot="${slotIndex}"]`;

    // Find connectors where this slot is the source and update their start point
    this.connectorLayer.selectAll(sourceSelector).each((d, i, nodes) => {
      const connector = d3.select(nodes[i]);
      const currentPath = connector.attr('d') || '';
      const match = currentPath.match(/M\s*([-\d.]+)\s+([-\d.]+)\s+L\s*([-\d.]+)\s+([-\d.]+)/);
      if (match) {
        const targetX = parseFloat(match[3]);
        const targetY = parseFloat(match[4]);
        connector.attr('d', `M ${newX} ${newY} L ${targetX} ${targetY}`);
      }
    });

    // Find connectors where this slot is the target and update their end point
    this.connectorLayer.selectAll(targetSelector).each((d, i, nodes) => {
      const connector = d3.select(nodes[i]);
      const currentPath = connector.attr('d') || '';
      const match = currentPath.match(/M\s*([-\d.]+)\s+([-\d.]+)\s+L\s*([-\d.]+)\s+([-\d.]+)/);
      if (match) {
        const sourceX = parseFloat(match[1]);
        const sourceY = parseFloat(match[2]);
        connector.attr('d', `M ${sourceX} ${sourceY} L ${newX} ${newY}`);
      }
    });
  }

  /**
   * Helper to start connector drag mode - creates the tentative connector line
   */
  private startConnectorDrag(
    sourceX: number, sourceY: number,
    mouseX: number, mouseY: number,
    sourceStateName?: string, sourceSlotIndex?: number
  ): void {
    // Store the source position and slot info for use during drag
    this.connectorSourcePosition = { x: sourceX, y: sourceY };
    if (sourceStateName !== undefined && sourceSlotIndex !== undefined) {
      this.connectorSourceSlotInfo = { stateName: sourceStateName, slotIndex: sourceSlotIndex };
    }

    // Create a new connector from the slot to the current mouse position
    const connector = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    connector.setAttribute('d', `M ${sourceX} ${sourceY} L ${mouseX} ${mouseY}`);
    connector.setAttribute('class', 'tentative-connector');
    connector.setAttribute('fill', 'none');
    connector.setAttribute('stroke', '#333');
    connector.setAttribute('stroke-width', '2');
    connector.setAttribute('stroke-dasharray', '5,5');
    connector.setAttribute('marker-end', 'url(#arrowhead)');

    // Add source slot identification
    if (sourceStateName !== undefined) {
      connector.setAttribute('data-source-state', sourceStateName);
    }
    if (sourceSlotIndex !== undefined) {
      connector.setAttribute('data-source-slot', sourceSlotIndex.toString());
    }

    // Append the connector to the connector layer
    this.connectorLayer?.node()?.appendChild(connector);
    this.interactionStateService.setInteractionState('connector-drag');
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
    const targetElement = event.sourceEvent.target as HTMLElement;
    const groupElement: SVGGElement | null = targetElement?.closest('g.state-group');
    const group = d3.select(groupElement);

    this.currentDragElement = targetElement;
    this.currentGroupElement = groupElement;
    this.currentDragTargetDataPoint = datapoint;

    const groupBounds = groupElement?.getBoundingClientRect();
    this.currentGroupCenter = {
      x: (groupBounds?.left || 0) + (groupBounds?.width || 0) / 2,
      y: (groupBounds?.top || 0) + (groupBounds?.height || 0) / 2
    };

    if (targetElement?.tagName === 'circle' && targetElement?.classList.contains('draggable-shape')) {
      event.sourceEvent.stopPropagation();
      this.interactionStateService.setInteractionState('state-drag');
      group.raise().attr('stroke', 'black');

      const stateName = group.attr('state-name') || datapoint.stateName || 'unknown';
      this.hideConnectorsForState(stateName);
    }
    else if (targetElement?.tagName === 'circle' && targetElement?.classList.contains('slot-marker')) {
      event.sourceEvent.stopPropagation();

      const slotMarker = d3.select(targetElement);
      const slotLocalX = parseFloat(slotMarker.attr('cx') || "0");
      const slotLocalY = parseFloat(slotMarker.attr('cy') || "0");

      const currentGroupTransform = group.attr("transform") || "translate(0,0)";
      const matchGroup = currentGroupTransform.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);
      const groupTranslateX = matchGroup ? parseFloat(matchGroup[1]) : 0;
      const groupTranslateY = matchGroup ? parseFloat(matchGroup[2]) : 0;

      const slotSvgX = slotLocalX + groupTranslateX;
      const slotSvgY = slotLocalY + groupTranslateY;

      const stateName = group.attr('state-name') || datapoint.stateName || 'unknown';
      const slotIndex = parseInt(slotMarker.attr('slot-index') || '0', 10);

      this.originalSlotPosition = { x: slotSvgX, y: slotSvgY };
      this.currentDragStateRadius = datapoint.radius || 100;

      if (this.connectorMode) {
        this.startConnectorDrag(slotSvgX, slotSvgY, event.x, event.y, stateName, slotIndex);
      } else {
        this.interactionStateService.setInteractionState('slot-drag');
      }
      group.raise().attr('stroke', 'black');
    }
  }

  // Event handlers for drag behavior for while the circle is being dragged.
  private onDragState(event: d3.D3DragEvent<SVGCircleElement, CircleStateDataPoint, CircleStateDataPoint>, datapoint: CircleStateDataPoint): void {
    const targetElement = this.currentDragElement;
    const groupElement = this.currentGroupElement;
    const group = d3.select(groupElement);
    const interactionState = this.interactionStateService.getCurrentState();

    if (interactionState === 'slot-drag') {
      event.sourceEvent.stopPropagation();

      const slotMarker = d3.select(targetElement);
      const path = group.select('path.slot-path').node() as SVGPathElement;
      const stateName = group.attr('state-name') || datapoint.stateName || 'unknown';
      const slotIndex = parseInt(slotMarker.attr('slot-index') || '0', 10);

      const currentGroupTransform = group.attr("transform") || "translate(0,0)";
      const matchGroup = currentGroupTransform.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);
      const groupTranslateX = matchGroup ? parseFloat(matchGroup[1]) : 0;
      const groupTranslateY = matchGroup ? parseFloat(matchGroup[2]) : 0;

      const localMouseX = event.x - groupTranslateX;
      const localMouseY = event.y - groupTranslateY;
      const closestPoint = this.getClosestPointOnPathLocal(path, localMouseX, localMouseY);

      // Calculate tangential distance for auto-switch to connector mode
      const tangentialDx = localMouseX - closestPoint.x;
      const tangentialDy = localMouseY - closestPoint.y;
      const tangentialDistance = Math.sqrt(tangentialDx * tangentialDx + tangentialDy * tangentialDy);
      const threshold = this.currentDragStateRadius / 2;

      if (tangentialDistance > threshold) {
        const slotSvgX = closestPoint.x + groupTranslateX;
        const slotSvgY = closestPoint.y + groupTranslateY;

        slotMarker.attr('cx', closestPoint.x);
        slotMarker.attr('cy', closestPoint.y);
        this.startConnectorDrag(slotSvgX, slotSvgY, event.x, event.y, stateName, slotIndex);
        return;
      }

      slotMarker.attr('cx', closestPoint.x);
      slotMarker.attr('cy', closestPoint.y);

      const slotSvgX = closestPoint.x + groupTranslateX;
      const slotSvgY = closestPoint.y + groupTranslateY;
      this.updateConnectorsForSlot(stateName, slotIndex, slotSvgX, slotSvgY);
    }
    else if (interactionState === 'state-drag') {
      event.sourceEvent.stopPropagation();

      const currentGroupTransform = group.attr("transform") || "translate(0,0)";
      const matchGroup = currentGroupTransform.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);
      const currentGroupX = matchGroup ? parseFloat(matchGroup[1]) : 0;
      const currentGroupY = matchGroup ? parseFloat(matchGroup[2]) : 0;

      group.attr('transform', `translate(${currentGroupX + event.dx}, ${currentGroupY + event.dy})`);
    }
    else if (interactionState === 'connector-drag') {
      event.sourceEvent.stopPropagation();

      const connector = this.connectorLayer?.select('path.tentative-connector');
      if (connector && !connector.empty() && this.connectorSourcePosition) {
        connector.attr('d', `M ${this.connectorSourcePosition.x} ${this.connectorSourcePosition.y} L ${event.x} ${event.y}`);
      }
    }
  }

  // Event handlers for drag behavior for when the circle stops being dragged.
  private onDragStateEnd(event: d3.D3DragEvent<SVGCircleElement, CircleStateDataPoint, CircleStateDataPoint>, datapoint: CircleStateDataPoint): void {
    const interactionState = this.interactionStateService.getCurrentState();

    if (interactionState === 'connector-drag') {
      const targetElement = event.sourceEvent.target as HTMLElement;
      if (targetElement?.tagName === 'circle' && targetElement?.classList.contains('slot-marker')) {
        const targetSlotMarker = d3.select(targetElement);
        const targetSlotLocalX = parseFloat(targetSlotMarker.attr('cx') || "0");
        const targetSlotLocalY = parseFloat(targetSlotMarker.attr('cy') || "0");
        const targetSlotIndex = parseInt(targetSlotMarker.attr('slot-index') || '0', 10);

        const targetGroupElement = targetElement.closest('g.state-group');
        if (targetGroupElement) {
          const targetGroup = d3.select(targetGroupElement);
          const targetStateName = targetGroup.attr('state-name') || 'unknown';
          const targetTransform = targetGroup.attr("transform") || "translate(0,0)";
          const targetMatch = targetTransform.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);
          const targetTranslateX = targetMatch ? parseFloat(targetMatch[1]) : 0;
          const targetTranslateY = targetMatch ? parseFloat(targetMatch[2]) : 0;

          const targetSvgX = targetSlotLocalX + targetTranslateX;
          const targetSvgY = targetSlotLocalY + targetTranslateY;

          const tentativeConnector = this.connectorLayer?.select('path.tentative-connector');
          if (tentativeConnector && !tentativeConnector.empty() && this.connectorSourcePosition) {
            tentativeConnector
              .attr('d', `M ${this.connectorSourcePosition.x} ${this.connectorSourcePosition.y} L ${targetSvgX} ${targetSvgY}`)
              .classed('tentative-connector', false)
              .classed('permanent-connector', true)
              .attr('stroke-dasharray', null)
              .attr('data-target-state', targetStateName)
              .attr('data-target-slot', targetSlotIndex.toString());
          }
        }
      } else {
        this.connectorLayer?.select('path.tentative-connector').remove();
      }

      this.connectorSourcePosition = null;
      this.connectorSourceSlotInfo = null;
    }

    if (interactionState === 'state-drag') {
      const draggedGroupElement = this.currentGroupElement;
      if (draggedGroupElement) {
        const group = d3.select(draggedGroupElement);
        const stateName = group.attr('state-name') || 'unknown';
        this.showAndUpdateConnectorsForState(stateName, draggedGroupElement);
      }
    }

    // Reset visual state
    const groupElement = (event.sourceEvent.target as HTMLElement)?.closest('g.state-group') as SVGGElement | null;
    if (groupElement) {
      d3.select(groupElement).attr('stroke', null);
    }

    this.interactionStateService.clearInteractionState();
    this.currentDragElement = null;
    this.currentGroupElement = null;
    this.currentDragTargetDataPoint = null;
    this.originalSlotPosition = null;
    this.currentDragStateRadius = 0;
  }


  // Ensure cleanup of the subscription
  public destroy(): void {
    this.baseLayerSubscription?.unsubscribe();
  }

}