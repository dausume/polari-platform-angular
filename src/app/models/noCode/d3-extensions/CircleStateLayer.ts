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
  // Store original slot angular position for collision resolution rollback
  originalSlotAngularPosition: number = 0;
  // Store the state radius for threshold calculation
  currentDragStateRadius: number = 0;
  // Store original state position for collision resolution rollback
  originalStatePosition: {x: number, y: number} | null = null;
  // Store current drag slot info for persistence
  currentDragSlotInfo: {stateName: string, slotIndex: number} | null = null;

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

  // Sanitize solution name for use in CSS class selectors
  private getSanitizedSolutionName(): string {
    return this.noCodeSolution?.solutionName?.replace(/[^a-zA-Z0-9-_]/g, '-') || 'unknown';
  }

  // Detect if the connector layer for the solution already exists in the svg base layer.
  // This is used to determine if we should append the slot layer to the svg.
  getSolutionLayer():  d3.Selection<SVGGElement, unknown, null, undefined>{
    return this.d3SvgBaseLayer
      .selectAll(`g.solution-layer-${this.getSanitizedSolutionName()}`);
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
    console.log('=== CircleStateLayer.render() called ===');
    this.initializeLayerGroup();
    this.initializeArrowheadMarker();
    this.initializeConnectorLayer();
    this.initializeStateGroups();
    this.initializeSlotLayer();
    this.renderCachedConnectors();
  }

  /**
   * Renders connectors from cached data when the solution loads.
   * This restores connector lines that were previously created and saved.
   */
  private renderCachedConnectors(): void {
    console.log('[renderCachedConnectors] Starting...');
    console.log('[renderCachedConnectors] noCodeSolution:', this.noCodeSolution?.solutionName);
    console.log('[renderCachedConnectors] connectorLayer:', this.connectorLayer);

    if (!this.noCodeSolution || !this.connectorLayer) {
      console.log('[renderCachedConnectors] Early return - missing noCodeSolution or connectorLayer');
      return;
    }

    // Iterate through all states and their slots to find connectors
    this.noCodeSolution.stateInstances.forEach(sourceState => {
      console.log('[renderCachedConnectors] Checking state:', sourceState.stateName);
      console.log('[renderCachedConnectors] State slots:', sourceState.slots);

      sourceState.slots?.forEach(slot => {
        console.log('[renderCachedConnectors] Checking slot:', slot.index, 'connectors:', slot.connectors);

        slot.connectors?.forEach(connector => {
          console.log('[renderCachedConnectors] Found connector:', connector);

          if (!connector.targetStateName) {
            console.log('[renderCachedConnectors] Skipping connector - no targetStateName');
            return;
          }

          // Find source slot position
          const sourceGroup = this.getLayerGroup()
            .select(`g.state-group[state-name="${sourceState.stateName}"]`);
          if (sourceGroup.empty()) return;

          const sourceSlotMarker = sourceGroup.select(`circle.slot-marker[slot-index="${slot.index}"]`);
          if (sourceSlotMarker.empty()) return;

          // Find target slot position
          const targetGroup = this.getLayerGroup()
            .select(`g.state-group[state-name="${connector.targetStateName}"]`);
          if (targetGroup.empty()) return;

          const targetSlotMarker = targetGroup.select(`circle.slot-marker[slot-index="${connector.sinkSlot}"]`);
          if (targetSlotMarker.empty()) return;

          // Get source coordinates
          const sourceLocalX = parseFloat(sourceSlotMarker.attr('cx') || '0');
          const sourceLocalY = parseFloat(sourceSlotMarker.attr('cy') || '0');
          const sourceTransform = sourceGroup.attr('transform') || 'translate(0,0)';
          const sourceMatch = sourceTransform.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);
          const sourceTranslateX = sourceMatch ? parseFloat(sourceMatch[1]) : 0;
          const sourceTranslateY = sourceMatch ? parseFloat(sourceMatch[2]) : 0;
          const sourceSvgX = sourceLocalX + sourceTranslateX;
          const sourceSvgY = sourceLocalY + sourceTranslateY;

          // Get target coordinates
          const targetLocalX = parseFloat(targetSlotMarker.attr('cx') || '0');
          const targetLocalY = parseFloat(targetSlotMarker.attr('cy') || '0');
          const targetTransform = targetGroup.attr('transform') || 'translate(0,0)';
          const targetMatch = targetTransform.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);
          const targetTranslateX = targetMatch ? parseFloat(targetMatch[1]) : 0;
          const targetTranslateY = targetMatch ? parseFloat(targetMatch[2]) : 0;
          const targetSvgX = targetLocalX + targetTranslateX;
          const targetSvgY = targetLocalY + targetTranslateY;

          // Check if connector already exists (avoid duplicates on re-render)
          const existingConnector = this.connectorLayer?.select(
            `path.permanent-connector[data-source-state="${sourceState.stateName}"][data-source-slot="${slot.index}"][data-target-state="${connector.targetStateName}"][data-target-slot="${connector.sinkSlot}"]`
          );
          if (existingConnector && !existingConnector.empty()) return;

          // Create the connector line
          this.connectorLayer?.append('path')
            .classed('permanent-connector', true)
            .attr('d', `M ${sourceSvgX} ${sourceSvgY} L ${targetSvgX} ${targetSvgY}`)
            .attr('fill', 'none')
            .attr('stroke', '#333')
            .attr('stroke-width', '2')
            .attr('marker-end', 'url(#arrowhead)')
            .attr('pointer-events', 'none') // Ensure connector doesn't block drag on states
            .attr('data-source-state', sourceState.stateName || '')
            .attr('data-source-slot', slot.index.toString())
            .attr('data-target-state', connector.targetStateName)
            .attr('data-target-slot', connector.sinkSlot.toString())
            .attr('data-connector-id', connector.id.toString());
        });
      });
    });
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
        .classed('connector-layer', true)
        .attr('pointer-events', 'none'); // Ensure connectors don't block events on states
    } else {
      this.connectorLayer = existingConnectorLayer as d3.Selection<SVGGElement, unknown, null, undefined>;
      // Ensure pointer-events is set even for existing layer
      this.connectorLayer.attr('pointer-events', 'none');
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
    console.log('[initializeLayerGroup] Starting for layer:', this.layerName);
    console.log('[initializeLayerGroup] d3SvgBaseLayer:', this.d3SvgBaseLayer?.node());

    // Ensure a specific <g> wrapper exists for this Layer
    let layerGroup = this.d3SvgBaseLayer
      .selectAll(`g.${this.layerName}`)
      .data([null]);

    console.log('[initializeLayerGroup] Existing layer groups found:', layerGroup.size());

    const entered = layerGroup.enter()
      .append('g')
      .classed(`${this.layerName}`, true);

    console.log('[initializeLayerGroup] Entered (newly created) layer groups:', entered.size());

    entered.merge(layerGroup);

    // Verify the layer group was created
    const verifyLayerGroup = this.d3SvgBaseLayer.selectAll(`g.${this.layerName}`);
    console.log('[initializeLayerGroup] After creation, layer groups found:', verifyLayerGroup.size());
    console.log('[initializeLayerGroup] Layer group node:', verifyLayerGroup.node());
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
    console.log('[initializeStateGroups] ========== STARTING ==========');
    console.log('[initializeStateGroups] d3SvgBaseLayer exists:', !!this.d3SvgBaseLayer);

    if (!this.d3SvgBaseLayer) {
      console.log('[initializeStateGroups] ABORT - no d3SvgBaseLayer!');
      return;
    }

    let layerGroup = this.getLayerGroup();
    console.log('[initializeStateGroups] layerGroup node:', layerGroup.node());
    console.log('[initializeStateGroups] layerGroup size:', layerGroup.size());
    console.log('[initializeStateGroups] stateDataPoints count:', this.stateDataPoints.length);
    console.log('[initializeStateGroups] stateDataPoints:', this.stateDataPoints.map((d: any) => d.stateName));

    if (layerGroup.size() === 0) {
      console.log('[initializeStateGroups] WARNING: layerGroup is empty! State groups cannot be created.');
      return;
    }

    // Filter out any null/undefined data points and use defensive key function
    const validDataPoints = this.stateDataPoints.filter((d: any) => d != null);
    console.log('[initializeStateGroups] Valid data points:', validDataPoints.length);

    let stateGroups = layerGroup
      .selectAll('g.state-group')
      .data(validDataPoints, (datapoint: any) => datapoint?.stateName || "unknown");

    console.log('[initializeStateGroups] Existing stateGroups (update selection) size:', stateGroups.size());

    // ENTER: Append new state groups
    const enterSelection = stateGroups.enter();
    console.log('[initializeStateGroups] Enter selection size (new groups to create):', enterSelection.size());

    const newGroups = enterSelection
      .append('g')
      .classed('state-group', true)
      .attr('state-name', (datapoint) => datapoint.stateName || "unknown")
      // Use transform to position g elements (x/y attributes don't work for g elements)
      .attr('transform', (datapoint) => `translate(${datapoint.cx}, ${datapoint.cy})`)
      .each((datapoint, index, elements) => {
        let group = d3.select(elements[index]);
        console.log('[initializeStateGroups] Creating state group for:', datapoint.stateName);

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
      });

    console.log('[initializeStateGroups] New groups created:', newGroups.size());
    console.log('[initializeStateGroups] Attaching drag behavior to new groups...');

    // Add mousedown listener to stop propagation BEFORE zoom behavior intercepts it
    // This ensures drag events reach the drag handler instead of being blocked by zoom filter
    newGroups.on('mousedown.preventZoom', function(this: SVGGElement, event: MouseEvent) {
      const stateName = this.getAttribute('state-name');
      const target = event.target as Element;
      const datum = d3.select(this).datum();
      console.log('[preventZoom] State group:', stateName, '| Target:', target?.tagName, target?.getAttribute('class'), '| Datum:', datum);
      event.stopPropagation();
    });

    // Attach drag behavior to new groups
    newGroups.call(this.createDragStateBehavior());
    console.log('[initializeStateGroups] Drag behavior attached to new groups!');

    // Merge enter and update selections
    const allGroups = newGroups.merge(stateGroups);
    console.log('[initializeStateGroups] allGroups size:', allGroups.size());

    // CRITICAL: Ensure data is properly bound to ALL groups (fixes data loss issue on navigation)
    // The D3 data join can fail when existing elements have null data, causing key function issues
    allGroups.each((d: CircleStateDataPoint | null, i: number, nodes: ArrayLike<SVGGElement>) => {
      const element = nodes[i];
      const stateName = element.getAttribute('state-name');
      console.log('[initializeStateGroups] Rebind check:', stateName, '| d:', d, '| d type:', typeof d);

      // If datum is missing or null, rebind it from the data points array
      if (!d) {
        const dataPoint = validDataPoints.find((dp: CircleStateDataPoint) => dp.stateName === stateName);
        console.log('[initializeStateGroups] Found dataPoint for', stateName, ':', dataPoint?.stateName);
        if (dataPoint) {
          d3.select(element).datum(dataPoint);
          console.log('[initializeStateGroups] Rebound data for:', stateName);
        } else {
          console.warn('[initializeStateGroups] WARNING: No data found for:', stateName);
        }
      }
    });

    // Ensure drag behavior is attached to ALL groups (including update selection)
    allGroups.call(this.createDragStateBehavior());
    console.log('[initializeStateGroups] Drag behavior attached to all groups!');

    // EXIT: Remove state groups that no longer exist in data
    const exitSelection = stateGroups.exit();
    console.log('[initializeStateGroups] Exit selection size (groups to remove):', exitSelection.size());
    exitSelection.remove();

    // Verify final state
    const finalGroups = layerGroup.selectAll('g.state-group');
    console.log('[initializeStateGroups] Final state groups in DOM:', finalGroups.size());
    console.log('[initializeStateGroups] ========== COMPLETE ==========');
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

  // --- Bounding Box Collision Detection ---

  /**
   * Gets the bounding boxes of all state groups currently rendered
   * @returns Array of bounding box objects with position and dimensions
   */
  private getAllStateBoundingBoxes(): { stateName: string; x: number; y: number; width: number; height: number; centerX: number; centerY: number }[] {
    const boundingBoxes: { stateName: string; x: number; y: number; width: number; height: number; centerX: number; centerY: number }[] = [];

    this.getStateGroups().each(function(this: Element, d: any) {
      const group = d3.select(this as SVGGElement);
      const stateName = group.attr('state-name') || 'unknown';
      const boundingRect = group.select('rect.bounding-box');

      if (boundingRect.empty()) return;

      // Get the transform of the group
      const transform = group.attr('transform') || 'translate(0,0)';
      const match = transform.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);
      const translateX = match ? parseFloat(match[1]) : 0;
      const translateY = match ? parseFloat(match[2]) : 0;

      // Get bounding box dimensions (local to group)
      const localX = parseFloat(boundingRect.attr('x') || '0');
      const localY = parseFloat(boundingRect.attr('y') || '0');
      const width = parseFloat(boundingRect.attr('width') || '0');
      const height = parseFloat(boundingRect.attr('height') || '0');

      // Calculate world position
      const worldX = localX + translateX;
      const worldY = localY + translateY;

      boundingBoxes.push({
        stateName,
        x: worldX,
        y: worldY,
        width,
        height,
        centerX: worldX + width / 2,
        centerY: worldY + height / 2
      });
    });

    return boundingBoxes;
  }

  /**
   * Checks if two bounding boxes intersect
   */
  private boundingBoxesIntersect(
    box1: { x: number; y: number; width: number; height: number },
    box2: { x: number; y: number; width: number; height: number }
  ): boolean {
    return !(
      box1.x + box1.width <= box2.x ||   // box1 is left of box2
      box2.x + box2.width <= box1.x ||   // box2 is left of box1
      box1.y + box1.height <= box2.y ||  // box1 is above box2
      box2.y + box2.height <= box1.y     // box2 is above box1
    );
  }

  /**
   * Checks if a given bounding box intersects with any other state's bounding box
   * @param box The bounding box to check
   * @param excludeStateName The state name to exclude from collision checks (the dragged state)
   * @returns true if there's an intersection with any other state
   */
  private hasCollisionWithOtherStates(
    box: { x: number; y: number; width: number; height: number },
    excludeStateName: string
  ): boolean {
    const allBoxes = this.getAllStateBoundingBoxes();

    for (const otherBox of allBoxes) {
      if (otherBox.stateName === excludeStateName) continue;

      if (this.boundingBoxesIntersect(box, otherBox)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Gets the nearest tangent direction based on collision with another box
   * Returns the direction to push the dragged box away from collision
   */
  private getNearestTangentDirection(
    draggedBox: { x: number; y: number; width: number; height: number; centerX: number; centerY: number },
    excludeStateName: string
  ): { dx: number; dy: number } | null {
    const allBoxes = this.getAllStateBoundingBoxes();
    let nearestCollision: { box: typeof allBoxes[0]; distance: number } | null = null;

    // Find the nearest colliding box
    for (const otherBox of allBoxes) {
      if (otherBox.stateName === excludeStateName) continue;

      if (this.boundingBoxesIntersect(draggedBox, otherBox)) {
        const dx = draggedBox.centerX - otherBox.centerX;
        const dy = draggedBox.centerY - otherBox.centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (!nearestCollision || distance < nearestCollision.distance) {
          nearestCollision = { box: otherBox, distance };
        }
      }
    }

    if (!nearestCollision) return null;

    // Calculate the direction from colliding box center to dragged box center
    const dx = draggedBox.centerX - nearestCollision.box.centerX;
    const dy = draggedBox.centerY - nearestCollision.box.centerY;
    const magnitude = Math.sqrt(dx * dx + dy * dy);

    if (magnitude === 0) {
      // Boxes are perfectly overlapping, push right by default
      return { dx: 1, dy: 0 };
    }

    // Normalize the direction
    return {
      dx: dx / magnitude,
      dy: dy / magnitude
    };
  }

  /**
   * Resolves collision by finding a valid position for the dragged state.
   * Algorithm:
   * 1. Check nearest tangent direction with 0.5x bounding box offset
   * 2. If collision, try diagonal and two cardinal directions nearest to tangent
   * 3. Retry with 1x bounding box offset
   * 4. Retry with 2x bounding box offset
   * 5. If all fail, return to original position
   *
   * @param currentPosition The current position after drag
   * @param boxWidth Width of the bounding box
   * @param boxHeight Height of the bounding box
   * @param stateName Name of the state being dragged
   * @param originalPosition The position before drag started
   * @returns The resolved position { x, y } as translate coordinates
   */
  private resolveCollision(
    currentPosition: { x: number; y: number },
    boxWidth: number,
    boxHeight: number,
    stateName: string,
    originalPosition: { x: number; y: number }
  ): { x: number; y: number } {
    // Calculate the bounding box at current position
    const halfWidth = boxWidth / 2;
    const halfHeight = boxHeight / 2;

    const currentBox = {
      x: currentPosition.x - halfWidth,
      y: currentPosition.y - halfHeight,
      width: boxWidth,
      height: boxHeight,
      centerX: currentPosition.x,
      centerY: currentPosition.y
    };

    // Check if there's a collision at current position
    if (!this.hasCollisionWithOtherStates(currentBox, stateName)) {
      return currentPosition; // No collision, keep current position
    }

    // Get the tangent direction away from collision
    const tangent = this.getNearestTangentDirection(currentBox, stateName);
    if (!tangent) {
      return originalPosition; // Shouldn't happen, but fallback
    }

    // Define multipliers to try: 0.5x, 1x, 2x bounding box size
    const multipliers = [0.5, 1, 2];
    const boxSize = Math.max(boxWidth, boxHeight);

    // Define direction variations to try for each multiplier
    // Primary tangent, then diagonal variations, then cardinals nearest to tangent
    const getDirectionsToTry = (dx: number, dy: number): { dx: number; dy: number }[] => {
      const directions: { dx: number; dy: number }[] = [];

      // Primary tangent direction (normalized)
      directions.push({ dx, dy });

      // Determine dominant axis and create variations
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // Diagonal variations (45 degrees from tangent)
      const angle = Math.atan2(dy, dx);
      const diag1Angle = angle + Math.PI / 4;
      const diag2Angle = angle - Math.PI / 4;

      directions.push({
        dx: Math.cos(diag1Angle),
        dy: Math.sin(diag1Angle)
      });
      directions.push({
        dx: Math.cos(diag2Angle),
        dy: Math.sin(diag2Angle)
      });

      // Cardinal directions nearest to tangent
      if (absDx >= absDy) {
        // Horizontal dominant - try horizontal then vertical
        directions.push({ dx: dx > 0 ? 1 : -1, dy: 0 });
        directions.push({ dx: 0, dy: dy > 0 ? 1 : -1 });
      } else {
        // Vertical dominant - try vertical then horizontal
        directions.push({ dx: 0, dy: dy > 0 ? 1 : -1 });
        directions.push({ dx: dx > 0 ? 1 : -1, dy: 0 });
      }

      return directions;
    };

    const directionsToTry = getDirectionsToTry(tangent.dx, tangent.dy);

    // Try each multiplier
    for (const multiplier of multipliers) {
      const offset = boxSize * multiplier;

      // Try each direction
      for (const direction of directionsToTry) {
        const testPosition = {
          x: currentPosition.x + direction.dx * offset,
          y: currentPosition.y + direction.dy * offset
        };

        const testBox = {
          x: testPosition.x - halfWidth,
          y: testPosition.y - halfHeight,
          width: boxWidth,
          height: boxHeight
        };

        if (!this.hasCollisionWithOtherStates(testBox, stateName)) {
          return testPosition; // Found a valid position
        }
      }
    }

    // All attempts failed, return to original position
    return originalPosition;
  }

  // --- Slot Collision Detection and Resolution ---

  /**
   * Get all slot positions within a specific state group (in local coordinates)
   */
  private getAllSlotPositionsInState(stateGroup: d3.Selection<SVGGElement, unknown, null, undefined>): {
    slotIndex: number;
    cx: number;
    cy: number;
    radius: number;
  }[] {
    const slots: { slotIndex: number; cx: number; cy: number; radius: number }[] = [];

    stateGroup.selectAll('circle.slot-marker').each(function(this: Element) {
      const slot = d3.select(this as SVGCircleElement);
      slots.push({
        slotIndex: parseInt(slot.attr('slot-index') || '0', 10),
        cx: parseFloat(slot.attr('cx') || '0'),
        cy: parseFloat(slot.attr('cy') || '0'),
        radius: parseFloat(slot.attr('r') || '5')
      });
    });

    return slots;
  }

  /**
   * Check if two slots overlap based on their centers and radii
   */
  private slotsOverlap(
    slot1: { cx: number; cy: number; radius: number },
    slot2: { cx: number; cy: number; radius: number }
  ): boolean {
    const dx = slot1.cx - slot2.cx;
    const dy = slot1.cy - slot2.cy;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minDistance = slot1.radius + slot2.radius;
    return distance < minDistance;
  }

  /**
   * Check if a slot at a given position would collide with any other slots in the state
   */
  private hasSlotCollision(
    stateGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
    excludeSlotIndex: number,
    position: { cx: number; cy: number },
    slotRadius: number
  ): boolean {
    const allSlots = this.getAllSlotPositionsInState(stateGroup);

    for (const otherSlot of allSlots) {
      if (otherSlot.slotIndex === excludeSlotIndex) continue;

      if (this.slotsOverlap(
        { cx: position.cx, cy: position.cy, radius: slotRadius },
        otherSlot
      )) {
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate the angular position (0-360) from a local position on the bezier path
   */
  private calculateAngularPositionFromLocal(
    path: SVGPathElement,
    localX: number,
    localY: number
  ): number {
    const pathLength = path.getTotalLength();
    const numSamples = 360;
    const increment = pathLength / numSamples;

    let closestAngle = 0;
    let minDistanceSquared = Infinity;

    for (let i = 0; i <= pathLength; i += increment) {
      const pointOnPath = path.getPointAtLength(i);
      const dx = pointOnPath.x - localX;
      const dy = pointOnPath.y - localY;
      const distanceSquared = dx * dx + dy * dy;

      if (distanceSquared < minDistanceSquared) {
        minDistanceSquared = distanceSquared;
        // Convert path length position to angle (0-360)
        closestAngle = (i / pathLength) * 360;
      }
    }

    return closestAngle;
  }

  /**
   * Resolve slot collision by finding a valid position along the bezier path.
   * Uses the same 0.5x, 1x, 2x offset pattern as state collision resolution.
   * @returns The resolved angular position
   */
  private resolveSlotCollision(
    path: SVGPathElement,
    stateGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
    slotIndex: number,
    currentAngle: number,
    slotRadius: number,
    originalAngle: number
  ): number {
    // Check if there's a collision at current position
    const currentPosition = this.getSlotPositionOnBezier(path, currentAngle);
    if (!this.hasSlotCollision(stateGroup, slotIndex, { cx: currentPosition.x, cy: currentPosition.y }, slotRadius)) {
      return currentAngle; // No collision, keep current position
    }

    // Calculate angular offset based on slot diameter
    // The angular offset corresponds to the arc length that would cover one slot diameter
    const pathLength = path.getTotalLength();
    const slotDiameter = slotRadius * 2;
    const baseAngularOffset = (slotDiameter / pathLength) * 360;

    // Define multipliers to try: 0.5x, 1x, 2x
    const multipliers = [0.5, 1, 2];

    // Determine initial direction based on which way has more space
    // Check positions at small offsets in both directions
    const testOffset = baseAngularOffset * 0.25;
    const cwPosition = this.getSlotPositionOnBezier(path, (currentAngle + testOffset) % 360);
    const ccwPosition = this.getSlotPositionOnBezier(path, (currentAngle - testOffset + 360) % 360);

    const cwCollision = this.hasSlotCollision(stateGroup, slotIndex, { cx: cwPosition.x, cy: cwPosition.y }, slotRadius);
    const ccwCollision = this.hasSlotCollision(stateGroup, slotIndex, { cx: ccwPosition.x, cy: ccwPosition.y }, slotRadius);

    // Prefer the direction with less collision, or clockwise if equal
    const directions = (!cwCollision && ccwCollision) ? [1, -1] :
                      (cwCollision && !ccwCollision) ? [-1, 1] :
                      (Math.random() > 0.5 ? [1, -1] : [-1, 1]); // Random if both or neither collide

    // Try each multiplier
    for (const multiplier of multipliers) {
      const angularOffset = baseAngularOffset * multiplier;

      // Try each direction
      for (const direction of directions) {
        const testAngle = (currentAngle + direction * angularOffset + 360) % 360;
        const testPosition = this.getSlotPositionOnBezier(path, testAngle);

        if (!this.hasSlotCollision(stateGroup, slotIndex, { cx: testPosition.x, cy: testPosition.y }, slotRadius)) {
          return testAngle; // Found a valid position
        }
      }
    }

    // All attempts failed, return to original position
    return originalAngle;
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
    connector.setAttribute('pointer-events', 'none'); // Ensure connector doesn't block events

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
    const self = this; // Capture reference for use in subject callback
    return d3.drag<SVGCircleElement, CircleStateDataPoint>()
      .container(() => this.d3SvgBaseLayer.node() as SVGSVGElement) // Set the event to listen across the whole d3 screen so it does not lose the event
      .subject(function(event, d) {
        // If datum is missing, look it up from the state-name attribute
        // This handles cases where D3 data binding is lost after initialization
        if (!d) {
          const target = event.sourceEvent?.target as Element;
          const groupElement = target?.closest('g.state-group') as SVGGElement | null;
          if (groupElement) {
            const stateName = groupElement.getAttribute('state-name');
            const dataPoint = self.stateDataPoints.find((dp: CircleStateDataPoint) => dp.stateName === stateName);
            console.log('[drag subject] Datum missing, looked up:', stateName, '| Found:', !!dataPoint);
            if (dataPoint) {
              // Rebind the datum for future use
              d3.select(groupElement).datum(dataPoint);
              return dataPoint;
            }
          }
        }
        console.log('[drag subject] d:', d, '| stateName:', d?.stateName);
        return d;
      })
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

    console.log('[onDragStateStart] d3SvgBaseLayer:', this.d3SvgBaseLayer?.node());
    console.log('[onDragStateStart] d3SvgBaseLayer tagName:', this.d3SvgBaseLayer?.node()?.tagName);
    console.log('[onDragStateStart] targetElement:', targetElement);
    console.log('[onDragStateStart] targetElement tagName:', targetElement?.tagName);
    console.log('[onDragStateStart] targetElement class:', targetElement?.getAttribute('class'));
    console.log('[onDragStateStart] groupElement found:', groupElement);
    console.log('[onDragStateStart] groupElement class:', groupElement?.getAttribute('class'));
    console.log('[onDragStateStart] groupElement state-name:', groupElement?.getAttribute('state-name'));
    console.log('[onDragStateStart] groupElement parent:', groupElement?.parentElement);
    console.log('[onDragStateStart] groupElement parent class:', groupElement?.parentElement?.getAttribute('class'));

    // Log all state groups in the layer to verify structure
    const allStateGroups = this.getStateGroups();
    console.log('[onDragStateStart] Total state groups found:', allStateGroups.size());
    allStateGroups.each(function(this: Element, d: any, i: number) {
      const el = this as SVGGElement;
      console.log(`[onDragStateStart] State group ${i}:`, el.getAttribute('state-name'), 'class:', el.getAttribute('class'), 'transform:', el.getAttribute('transform'));
    });

    this.currentDragElement = targetElement;
    this.currentGroupElement = groupElement;
    this.currentDragTargetDataPoint = datapoint;

    const groupBounds = groupElement?.getBoundingClientRect();
    this.currentGroupCenter = {
      x: (groupBounds?.left || 0) + (groupBounds?.width || 0) / 2,
      y: (groupBounds?.top || 0) + (groupBounds?.height || 0) / 2
    };

    // Check if clicking on draggable elements (circle, overlay-component, or bounding-box)
    const isDraggableShape = targetElement?.tagName === 'circle' && targetElement?.classList.contains('draggable-shape');
    const isOverlayComponent = targetElement?.tagName === 'rect' && targetElement?.classList.contains('overlay-component');
    const isBoundingBox = targetElement?.tagName === 'rect' && targetElement?.classList.contains('bounding-box');
    const isSlotPath = targetElement?.tagName === 'path' && targetElement?.classList.contains('slot-path');

    if (isDraggableShape || isOverlayComponent || isBoundingBox || isSlotPath) {
      event.sourceEvent.stopPropagation();
      this.interactionStateService.setInteractionState('state-drag');
      group.raise().attr('stroke', 'black');

      // Store the original position for collision resolution rollback
      const currentGroupTransform = group.attr("transform") || "translate(0,0)";
      const matchGroup = currentGroupTransform.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);
      const groupX = matchGroup ? parseFloat(matchGroup[1]) : 0;
      const groupY = matchGroup ? parseFloat(matchGroup[2]) : 0;
      this.originalStatePosition = { x: groupX, y: groupY };

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

      // Store the original angular position for collision resolution rollback
      const path = group.select('path.slot-path').node() as SVGPathElement;
      if (path) {
        this.originalSlotAngularPosition = this.calculateAngularPositionFromLocal(path, slotLocalX, slotLocalY);
      }

      // Store drag slot info for persistence
      this.currentDragSlotInfo = { stateName, slotIndex };

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

    console.log('[onDragState] interactionState:', interactionState);
    console.log('[onDragState] groupElement:', groupElement);
    console.log('[onDragState] groupElement tagName:', groupElement?.tagName);
    console.log('[onDragState] groupElement className:', groupElement?.getAttribute('class'));
    console.log('[onDragState] groupElement parent:', groupElement?.parentElement);
    console.log('[onDragState] groupElement parent class:', groupElement?.parentElement?.getAttribute('class'));
    console.log('[onDragState] group.node() === groupElement:', group.node() === groupElement);
    console.log('[onDragState] group.size():', group.size());
    console.log('[onDragState] group state-name:', group.attr('state-name'));

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

      const newTransform = `translate(${currentGroupX + event.dx}, ${currentGroupY + event.dy})`;
      console.log('[onDragState:state-drag] current transform:', currentGroupTransform);
      console.log('[onDragState:state-drag] event.dx:', event.dx, 'event.dy:', event.dy);
      console.log('[onDragState:state-drag] new transform:', newTransform);
      console.log('[onDragState:state-drag] applying to element:', group.node());

      group.attr('transform', newTransform);
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
    const solutionStateService = this.rendererManager.getSolutionStateService();
    const solutionName = this.noCodeSolution?.solutionName || '';

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
          if (tentativeConnector && !tentativeConnector.empty() && this.connectorSourcePosition && this.connectorSourceSlotInfo) {
            tentativeConnector
              .attr('d', `M ${this.connectorSourcePosition.x} ${this.connectorSourcePosition.y} L ${targetSvgX} ${targetSvgY}`)
              .classed('tentative-connector', false)
              .classed('permanent-connector', true)
              .attr('stroke-dasharray', null)
              .attr('data-target-state', targetStateName)
              .attr('data-target-slot', targetSlotIndex.toString());

            // Persist the connector to state service
            if (solutionName) {
              solutionStateService.addConnector(
                solutionName,
                this.connectorSourceSlotInfo.stateName,
                this.connectorSourceSlotInfo.slotIndex,
                targetStateName,
                targetSlotIndex
              );
            }
          }
        }
      } else {
        this.connectorLayer?.select('path.tentative-connector').remove();
      }

      this.connectorSourcePosition = null;
      this.connectorSourceSlotInfo = null;
    }

    if (interactionState === 'slot-drag') {
      // Handle slot drag end - resolve collisions and persist angular position
      const draggedGroupElement = this.currentGroupElement;
      const slotInfo = this.currentDragSlotInfo;

      if (draggedGroupElement && slotInfo) {
        const group = d3.select(draggedGroupElement);
        const slotMarker = d3.select(this.currentDragElement);
        const path = group.select('path.slot-path').node() as SVGPathElement;

        if (path && slotMarker && !slotMarker.empty()) {
          const slotLocalX = parseFloat(slotMarker.attr('cx') || '0');
          const slotLocalY = parseFloat(slotMarker.attr('cy') || '0');
          const slotRadius = parseFloat(slotMarker.attr('r') || '5');

          // Calculate current angular position
          const currentAngle = this.calculateAngularPositionFromLocal(path, slotLocalX, slotLocalY);

          // Resolve any slot collisions
          const resolvedAngle = this.resolveSlotCollision(
            path,
            group as d3.Selection<SVGGElement, unknown, null, undefined>,
            slotInfo.slotIndex,
            currentAngle,
            slotRadius,
            this.originalSlotAngularPosition
          );

          // If angle changed due to collision resolution, update the slot position
          if (resolvedAngle !== currentAngle) {
            const newPosition = this.getSlotPositionOnBezier(path, resolvedAngle);
            slotMarker.attr('cx', newPosition.x);
            slotMarker.attr('cy', newPosition.y);

            // Update connectors to the new position
            const currentGroupTransform = group.attr("transform") || "translate(0,0)";
            const matchGroup = currentGroupTransform.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);
            const groupTranslateX = matchGroup ? parseFloat(matchGroup[1]) : 0;
            const groupTranslateY = matchGroup ? parseFloat(matchGroup[2]) : 0;

            this.updateConnectorsForSlot(
              slotInfo.stateName,
              slotInfo.slotIndex,
              newPosition.x + groupTranslateX,
              newPosition.y + groupTranslateY
            );
          }

          // Persist the angular position to state service
          if (solutionName) {
            solutionStateService.updateSlotAngularPosition(
              solutionName,
              slotInfo.stateName,
              slotInfo.slotIndex,
              resolvedAngle
            );
          }
        }
      }
    }

    if (interactionState === 'state-drag') {
      const draggedGroupElement = this.currentGroupElement;
      if (draggedGroupElement && this.originalStatePosition) {
        const group = d3.select(draggedGroupElement);
        const stateName = group.attr('state-name') || 'unknown';

        // Get current position after drag
        const currentTransform = group.attr("transform") || "translate(0,0)";
        const matchCurrent = currentTransform.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);
        const currentX = matchCurrent ? parseFloat(matchCurrent[1]) : 0;
        const currentY = matchCurrent ? parseFloat(matchCurrent[2]) : 0;

        // Get bounding box dimensions
        const boundingRect = group.select('rect.bounding-box');
        const boxWidth = parseFloat(boundingRect.attr('width') || '0');
        const boxHeight = parseFloat(boundingRect.attr('height') || '0');

        // Resolve any collisions
        const resolvedPosition = this.resolveCollision(
          { x: currentX, y: currentY },
          boxWidth,
          boxHeight,
          stateName,
          this.originalStatePosition
        );

        // Apply the resolved position
        group.attr('transform', `translate(${resolvedPosition.x}, ${resolvedPosition.y})`);

        // Persist the state position to state service
        if (solutionName) {
          solutionStateService.updateStatePosition(
            solutionName,
            stateName,
            resolvedPosition.x,
            resolvedPosition.y
          );
        }

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
    this.originalStatePosition = null;
    this.originalSlotAngularPosition = 0;
    this.currentDragSlotInfo = null;
    this.currentDragStateRadius = 0;
  }


  // Ensure cleanup of the subscription
  public destroy(): void {
    this.baseLayerSubscription?.unsubscribe();
  }

}