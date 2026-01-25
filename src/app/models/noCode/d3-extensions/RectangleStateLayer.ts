// Author: Dustin Etts
// polari-platform-angular/src/app/models/noCode/d3-extensions/RectangleStateLayer.ts
import { D3ModelLayer } from './D3ModelLayer';
import RectangleStateDataPoint from './DataPointTypes/RectangleStateDataPoint';
import RectangleSlotDataPoint from './DataPointTypes/RectangleSlotDataPoint';
import { NoCodeStateRendererManager } from '@services/no-code-services/no-code-state-renderer-manager';
import { BehaviorSubject, Subscription } from 'rxjs';
import { Slot } from '../Slot';
import * as d3 from 'd3';
import { NoCodeState } from '../NoCodeState';
import { NoCodeSolution } from '../NoCodeSolution';
import { InteractionStateService } from '@services/no-code-services/interaction-state-service';

// Defines how to render rectangles that can be dragged around the screen.
// This is used to represent end states and other block-like components in the No-Code Interface.
// Shares the same slot path logic as CircleStateLayer but uses a rectangular perimeter path.
export class RectangleStateLayer extends D3ModelLayer {

  connectorMode: boolean;
  currentDragElement: HTMLElement | null = null;
  currentGroupElement: SVGGElement | null = null;
  currentDragTargetDataPoint: RectangleStateDataPoint | RectangleSlotDataPoint | null = null;
  currentGroupCenter: {x: number, y: number} | null = null;
  currentGroupCoordinateTransformMatrix: DOMMatrix | null = null;
  connectorSourcePosition: {x: number, y: number} | null = null;
  connectorSourceSlotInfo: {stateName: string, slotIndex: number} | null = null;
  originalSlotPosition: {x: number, y: number} | null = null;
  originalSlotAngularPosition: number = 0;
  currentDragStateWidth: number = 0;
  currentDragStateHeight: number = 0;
  originalStatePosition: {x: number, y: number} | null = null;
  currentDragSlotInfo: {stateName: string, slotIndex: number} | null = null;

  private onStateOverlayClick: ((stateName: string, stateGroup: SVGGElement) => void) | null = null;
  private onStateDragStart: ((stateName: string) => void) | null = null;
  private onStateDragEnd: ((stateName: string, stateGroup: SVGGElement) => void) | null = null;
  private onStateContextMenu: ((event: MouseEvent, stateName: string, stateGroup: SVGGElement) => void) | null = null;

  constructor(
    private rendererManager: NoCodeStateRendererManager,
    private interactionStateService: InteractionStateService,
    shapeType: string,
    noCodeSolution: NoCodeSolution,
    stateDataPoints: RectangleStateDataPoint[],
    iconSvgString?: string,
    slotDataPoints?: RectangleSlotDataPoint[],
    slotBorderLayer?: d3.Selection<SVGGElement, unknown, null, undefined>,
    slotLayer?: d3.Selection<SVGGElement, unknown, null, undefined>,
    connectorLayer?: d3.Selection<SVGGElement, unknown, null, undefined>,
    componentLayer?: d3.Selection<SVGGElement, unknown, null, undefined>,
  ) {
    super(
      shapeType, noCodeSolution, stateDataPoints,
      iconSvgString,
      slotDataPoints,
      slotBorderLayer, slotLayer, connectorLayer, componentLayer
    );
    this.baseLayerSubscription = this.rendererManager.subscribeToD3SvgBaseLayer((baseLayer: d3.Selection<SVGSVGElement, unknown, null, undefined> | undefined) => {
      if (baseLayer) {
        this.setD3SvgBaseLayer(baseLayer);
      }
    });
    this.stateDataPoints = this.getRectangleStateDataPointsFromSolution(noCodeSolution);
    this.slotDataPoints = this.getRectangleSlotDataPointsFromSolution(noCodeSolution);
    this.connectorMode = false;
  }

  // --- Overlay Callback Setters ---

  setOnStateOverlayClick(callback: (stateName: string, stateGroup: SVGGElement) => void): void {
    this.onStateOverlayClick = callback;
  }

  setOnStateDragStart(callback: (stateName: string) => void): void {
    this.onStateDragStart = callback;
  }

  setOnStateDragEnd(callback: (stateName: string, stateGroup: SVGGElement) => void): void {
    this.onStateDragEnd = callback;
  }

  setOnStateContextMenu(callback: (event: MouseEvent, stateName: string, stateGroup: SVGGElement) => void): void {
    this.onStateContextMenu = callback;
  }

  getStateGroupByName(stateName: string): SVGGElement | null {
    const selection = this.getLayerGroup()
      .select(`g.state-group[state-name="${stateName}"]`);
    return selection.empty() ? null : selection.node() as SVGGElement;
  }

  retrieveConnectorLayer(): d3.Selection<SVGGElement, unknown, null, undefined> {
    let solutionLayer = this.getSolutionLayer();
    return solutionLayer.selectAll(`g.connector-layer`);
  }

  private getSanitizedSolutionName(): string {
    return this.noCodeSolution?.solutionName?.replace(/[^a-zA-Z0-9-_]/g, '-') || 'unknown';
  }

  getSolutionLayer(): d3.Selection<SVGGElement, unknown, null, undefined> {
    return this.d3SvgBaseLayer
      .selectAll(`g.solution-layer-${this.getSanitizedSolutionName()}`);
  }

  private getRectangleStateDataPointsFromSolution(noCodeSolution: NoCodeSolution): RectangleStateDataPoint[] {
    if (!noCodeSolution) {
      console.error("NoCodeSolution is undefined. Cannot retrieve rectangle state data points.");
      return [];
    }

    return noCodeSolution.stateInstances
      .filter(state => state.shapeType === "rectangle")
      .map(state => new RectangleStateDataPoint(
        state.stateLocationX ?? 0,
        state.stateLocationY ?? 0,
        state.stateSvgWidth ?? state.stateSvgRadius ?? 20,
        state.stateSvgHeight ?? state.stateSvgWidth ?? state.stateSvgRadius ?? 20,
        state.slotRadius ?? 4,
        state.stateName ?? "unknown",
        state.cornerRadius ?? 0
      ));
  }

  private getRectangleSlotDataPointsFromSolution(noCodeSolution: NoCodeSolution): RectangleSlotDataPoint[] {
    if (!noCodeSolution) {
      console.error("NoCodeSolution is undefined. Cannot retrieve slot data points.");
      return [];
    }

    return noCodeSolution.stateInstances
      .filter(state => state.shapeType === "rectangle")
      .flatMap((state: NoCodeState) =>
        state.slots?.map((slot: Slot) => new RectangleSlotDataPoint(
          state.stateLocationX ?? 0,
          state.stateLocationY ?? 0,
          state.stateSvgWidth ?? state.stateSvgRadius ?? 20,
          state.stateSvgHeight ?? state.stateSvgWidth ?? state.stateSvgRadius ?? 20,
          slot.index,
          slot.slotAngularPosition ?? 0,
          slot.isInput,
          slot.isOutput,
          state.stateName ?? "unknown"
        )) || []
      );
  }

  // --- Rendering Functions ---

  render(): void {
    console.log('=== RectangleStateLayer.render() called ===');
    this.initializeLayerGroup();
    this.initializeArrowheadMarker();
    this.initializeConnectorLayer();
    this.initializeStateGroups();
    this.initializeSlotLayer();
    this.renderCachedConnectors();
  }

  private renderCachedConnectors(): void {
    if (!this.noCodeSolution || !this.connectorLayer) {
      return;
    }

    this.noCodeSolution.stateInstances.forEach(sourceState => {
      sourceState.slots?.forEach(slot => {
        slot.connectors?.forEach(connector => {
          if (!connector.targetStateName) return;

          const sourceGroup = this.getLayerGroup()
            .select(`g.state-group[state-name="${sourceState.stateName}"]`);
          if (sourceGroup.empty()) return;

          const sourceSlotMarker = sourceGroup.select(`circle.slot-marker[slot-index="${slot.index}"]`);
          if (sourceSlotMarker.empty()) return;

          const targetGroup = this.getLayerGroup()
            .select(`g.state-group[state-name="${connector.targetStateName}"]`);
          if (targetGroup.empty()) return;

          const targetSlotMarker = targetGroup.select(`circle.slot-marker[slot-index="${connector.sinkSlot}"]`);
          if (targetSlotMarker.empty()) return;

          const sourceLocalX = parseFloat(sourceSlotMarker.attr('cx') || '0');
          const sourceLocalY = parseFloat(sourceSlotMarker.attr('cy') || '0');
          const sourceTransform = sourceGroup.attr('transform') || 'translate(0,0)';
          const sourceMatch = sourceTransform.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);
          const sourceTranslateX = sourceMatch ? parseFloat(sourceMatch[1]) : 0;
          const sourceTranslateY = sourceMatch ? parseFloat(sourceMatch[2]) : 0;
          const sourceSvgX = sourceLocalX + sourceTranslateX;
          const sourceSvgY = sourceLocalY + sourceTranslateY;

          const targetLocalX = parseFloat(targetSlotMarker.attr('cx') || '0');
          const targetLocalY = parseFloat(targetSlotMarker.attr('cy') || '0');
          const targetTransform = targetGroup.attr('transform') || 'translate(0,0)';
          const targetMatch = targetTransform.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);
          const targetTranslateX = targetMatch ? parseFloat(targetMatch[1]) : 0;
          const targetTranslateY = targetMatch ? parseFloat(targetMatch[2]) : 0;
          const targetSvgX = targetLocalX + targetTranslateX;
          const targetSvgY = targetLocalY + targetTranslateY;

          const existingConnector = this.connectorLayer?.select(
            `path.permanent-connector[data-source-state="${sourceState.stateName}"][data-source-slot="${slot.index}"][data-target-state="${connector.targetStateName}"][data-target-slot="${connector.sinkSlot}"]`
          );
          if (existingConnector && !existingConnector.empty()) return;

          this.connectorLayer?.append('path')
            .classed('permanent-connector', true)
            .attr('d', `M ${sourceSvgX} ${sourceSvgY} L ${targetSvgX} ${targetSvgY}`)
            .attr('fill', 'none')
            .attr('stroke', '#333')
            .attr('stroke-width', '2')
            .attr('marker-end', 'url(#arrowhead)')
            .attr('pointer-events', 'none')
            .attr('data-source-state', sourceState.stateName || '')
            .attr('data-source-slot', slot.index.toString())
            .attr('data-target-state', connector.targetStateName)
            .attr('data-target-slot', connector.sinkSlot.toString())
            .attr('data-connector-id', connector.id.toString());
        });
      });
    });
  }

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

  private initializeConnectorLayer(): void {
    let layerGroup = this.getLayerGroup();
    let existingConnectorLayer = layerGroup.select('g.connector-layer');
    if (existingConnectorLayer.empty()) {
      this.connectorLayer = layerGroup.append('g')
        .classed('connector-layer', true)
        .attr('pointer-events', 'none');
    } else {
      this.connectorLayer = existingConnectorLayer as d3.Selection<SVGGElement, unknown, null, undefined>;
      this.connectorLayer.attr('pointer-events', 'none');
    }
  }

  // --- Data Manipulation Functions ---

  addNoCodeState(newState: NoCodeState): void {
    if (newState.shapeType === "rectangle") {
      const cx = newState.stateLocationX ?? 0;
      const cy = newState.stateLocationY ?? 0;
      const width = newState.stateSvgWidth ?? newState.stateSvgRadius ?? 20;
      const height = newState.stateSvgHeight ?? width;
      const newStateDataPoint = new RectangleStateDataPoint(cx, cy, width, height);
      // TODO: Add the new state data point to the layer
    } else {
      console.warn(
        "Invalid No-Code State: Ensure shapeType is 'rectangle' for states added to the RectangleStateLayer."
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

  addStateDataPoint(datapoint: RectangleStateDataPoint): void {
    this.stateDataPoints.push(datapoint);
  }

  removeDataPoint(datapoint: RectangleStateDataPoint): void {
    const index = this.stateDataPoints.indexOf(datapoint);
    if (index > -1) {
      this.stateDataPoints.splice(index, 1);
    }
  }

  updateDataPoint(oldDatapoint: RectangleStateDataPoint, newDatapoint: RectangleStateDataPoint): void {
    const index = this.stateDataPoints.indexOf(oldDatapoint);
    if (index > -1) {
      this.stateDataPoints[index] = newDatapoint;
    }
  }

  getDataPoint(index: number): RectangleStateDataPoint {
    return this.stateDataPoints[index];
  }

  addSlot(slot: Slot): void {
    this.slotDataPoints.push(slot);
  }

  removeSlot(slot: Slot): void {
    const index = this.slotDataPoints.indexOf(slot);
    if (index > -1) {
      this.slotDataPoints.splice(index, 1);
    }
  }

  updateSlot(oldSlot: Slot, newSlot: Slot): void {
    const index = this.slotDataPoints.indexOf(oldSlot);
    if (index > -1) {
      this.slotDataPoints[index] = newSlot;
    }
  }

  getSlot(index: number): Slot {
    return this.slotDataPoints[index];
  }

  // --- Layer Level Functions ---

  initializeLayerGroup(): void {
    console.log('[RectangleStateLayer.initializeLayerGroup] Starting for layer:', this.layerName);

    let layerGroup = this.d3SvgBaseLayer
      .selectAll(`g.${this.layerName}`)
      .data([null]);

    const entered = layerGroup.enter()
      .append('g')
      .classed(`${this.layerName}`, true);

    entered.merge(layerGroup);
  }

  getLayerGroup(): d3.Selection<SVGGElement, unknown, null, undefined> {
    return this.d3SvgBaseLayer
      .selectAll(`g.${this.layerName}`);
  }

  protected clearLayerGroup(): void {
    let layerGroup = this.getLayerGroup();
    layerGroup.selectAll('*').remove();
  }

  // --- State-Group Functions ---

  initializeStateGroups(): void {
    console.log('[RectangleStateLayer.initializeStateGroups] Starting...');

    if (!this.d3SvgBaseLayer) {
      console.log('[RectangleStateLayer.initializeStateGroups] ABORT - no d3SvgBaseLayer!');
      return;
    }

    let layerGroup = this.getLayerGroup();

    if (layerGroup.size() === 0) {
      console.log('[RectangleStateLayer.initializeStateGroups] WARNING: layerGroup is empty!');
      return;
    }

    const validDataPoints = this.stateDataPoints.filter((d: any) => d != null);

    let stateGroups = layerGroup
      .selectAll('g.state-group')
      .data(validDataPoints, (datapoint: any) => datapoint?.stateName || "unknown");

    const enterSelection = stateGroups.enter();

    const newGroups = enterSelection
      .append('g')
      .classed('state-group', true)
      .attr('state-name', (datapoint) => datapoint.stateName || "unknown")
      .attr('transform', (datapoint) => `translate(${datapoint.cx}, ${datapoint.cy})`)
      .each((datapoint: RectangleStateDataPoint, index, elements) => {
        let group = d3.select(elements[index]);
        const halfWidth = datapoint.width / 2;
        const halfHeight = datapoint.height / 2;
        const cornerRadius = datapoint.cornerRadius || 0;

        // Sizing hierarchy: bounding box > background shape > inner component
        // Minimum 10px difference between each layer
        const boundingPadding = 10; // Bounding box is 10px larger than background
        const innerPadding = 10; // Inner component is 10px smaller than background

        // Append the bounding box rectangle (largest, 10px padding around background)
        group.append('rect')
          .classed('bounding-box', true)
          .attr('x', -(halfWidth + boundingPadding))
          .attr('y', -(halfHeight + boundingPadding))
          .attr('width', datapoint.width + boundingPadding * 2)
          .attr('height', datapoint.height + boundingPadding * 2)
          .attr('rx', cornerRadius + boundingPadding / 2)
          .attr('ry', cornerRadius + boundingPadding / 2)
          .attr('fill', "white")
          .attr('stroke', "black");

        // Append the main rectangle (visual representation of state - the actual shape)
        group.append('rect')
          .classed('draggable-shape', true)
          .attr('x', -halfWidth)
          .attr('y', -halfHeight)
          .attr('width', datapoint.width)
          .attr('height', datapoint.height)
          .attr('rx', cornerRadius)
          .attr('ry', cornerRadius)
          .attr('fill', "#F44336") // Red for end states
          .attr('stroke', "black");

        // Append the inner component rectangle (where Angular overlays will be positioned)
        // 10px smaller than the background shape on each side
        const innerHalfWidth = halfWidth - innerPadding;
        const innerHalfHeight = halfHeight - innerPadding;
        const innerCornerRadius = Math.max(0, cornerRadius - innerPadding / 2);
        const self = this;
        group.append('rect')
          .classed('overlay-component', true)
          .attr('x', -innerHalfWidth)
          .attr('y', -innerHalfHeight)
          .attr('width', innerHalfWidth * 2)
          .attr('height', innerHalfHeight * 2)
          .attr('rx', innerCornerRadius)
          .attr('ry', innerCornerRadius)
          .attr('fill', "white")
          .attr('stroke', "black")
          .style('cursor', 'pointer')
          .on('click', function(event: MouseEvent) {
            event.stopPropagation();
            const groupElement = elements[index] as SVGGElement;
            const stateName = datapoint.stateName || 'unknown';
            if (self.onStateOverlayClick) {
              self.onStateOverlayClick(stateName, groupElement);
            }
          })
          .on('contextmenu', function(event: MouseEvent) {
            event.preventDefault();
            event.stopPropagation();
            const groupElement = elements[index] as SVGGElement;
            const stateName = datapoint.stateName || 'unknown';
            console.log('[RectangleStateLayer contextmenu] State:', stateName);
            if (self.onStateContextMenu) {
              self.onStateContextMenu(event, stateName, groupElement);
            }
          });

        // Generate the rectangular path for slot placement (follows background shape)
        let rectPath = this.generateRectangularPath(halfWidth, halfHeight, cornerRadius);
        group.append('path')
          .attr('d', rectPath)
          .classed('slot-path', true)
          .attr('fill', 'none')
          .attr('stroke', 'red')
          .attr('stroke-width', 8);
      });

    newGroups.on('mousedown.preventZoom', function(this: SVGGElement, event: MouseEvent) {
      event.stopPropagation();
    });

    newGroups.call(this.createDragStateBehavior());

    const allGroups = newGroups.merge(stateGroups);

    allGroups.each((d: RectangleStateDataPoint | null, i: number, nodes: ArrayLike<SVGGElement>) => {
      const element = nodes[i];
      const stateName = element.getAttribute('state-name');

      if (!d) {
        const dataPoint = validDataPoints.find((dp: RectangleStateDataPoint) => dp.stateName === stateName);
        if (dataPoint) {
          d3.select(element).datum(dataPoint);
        }
      }
    });

    allGroups.call(this.createDragStateBehavior());

    const exitSelection = stateGroups.exit();
    exitSelection.remove();
  }

  getStateGroups(): d3.Selection<SVGGElement, unknown, null, undefined> {
    return this.getLayerGroup()
      .selectAll('g.state-group');
  }

  getRectangleElements(): d3.Selection<SVGGElement, RectangleStateDataPoint, any, unknown> {
    return this.getStateGroups()
      .selectAll('rect.draggable-shape');
  }

  // --- Path Generation for Rectangle Perimeter ---

  /**
   * Generates a path that follows the perimeter of a rectangle.
   * This path is used for placing slots along the rectangle's border.
   * @param halfWidth Half the width of the rectangle
   * @param halfHeight Half the height of the rectangle
   * @param cornerRadius Corner radius for rounded corners
   * @returns SVG path string
   */
  generateRectangularPath(halfWidth: number, halfHeight: number, cornerRadius: number = 0): string {
    // For simplicity, we create a path that goes around the rectangle perimeter
    // Starting from top-left and going clockwise
    const w = halfWidth;
    const h = halfHeight;
    const r = Math.min(cornerRadius, halfWidth, halfHeight);

    if (r > 0) {
      // Rounded rectangle path
      return `
        M ${-w + r}, ${-h}
        L ${w - r}, ${-h}
        Q ${w}, ${-h} ${w}, ${-h + r}
        L ${w}, ${h - r}
        Q ${w}, ${h} ${w - r}, ${h}
        L ${-w + r}, ${h}
        Q ${-w}, ${h} ${-w}, ${h - r}
        L ${-w}, ${-h + r}
        Q ${-w}, ${-h} ${-w + r}, ${-h}
        Z
      `;
    } else {
      // Sharp corner rectangle path
      return `
        M ${-w}, ${-h}
        L ${w}, ${-h}
        L ${w}, ${h}
        L ${-w}, ${h}
        Z
      `;
    }
  }

  // --- Slot Placement Functions ---

  initializeSlotLayer(): void {
    let stateGroups = this.getStateGroups();

    stateGroups.each((datapoint: RectangleStateDataPoint, index: number, elements: any) => {
      let currentStateGroup = d3.select(elements[index]);

      currentStateGroup.selectAll('circle.slot-marker').remove();

      let currentStateSlots = this.slotDataPoints.filter((slot: RectangleSlotDataPoint) => slot.stateName === datapoint.stateName);
      let indexSortedSlots = currentStateSlots.slice().sort((a: RectangleSlotDataPoint, b: RectangleSlotDataPoint) => a.index - b.index);

      const path = currentStateGroup.select('path.slot-path').node() as SVGPathElement;
      if (!path) return;

      const bezierLength = path.getTotalLength();
      const slotLength = bezierLength / currentStateSlots.length || 0;
      const slotRadius = Math.min(slotLength / currentStateSlots.length, 10);

      for (let i = 0; i < indexSortedSlots.length; i++) {
        const slotData = indexSortedSlots[i];
        const angle = slotData.angularPosition ?? (slotData.index * (360 / currentStateSlots.length));
        const { x, y } = this.getSlotPositionOnPath(path, angle);

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

  /**
   * Gets a point on the path at a given angle (0-360)
   */
  getSlotPositionOnPath(path: SVGPathElement, angle: number): { x: number; y: number } {
    const totalLength = path.getTotalLength();
    const theta = angle % 360;
    const fraction = theta / 360;
    const point = path.getPointAtLength(fraction * totalLength);
    return { x: point.x, y: point.y };
  }

  private getClosestPointOnPathLocal(path: SVGPathElement, localMouseX: number, localMouseY: number): { x: number; y: number } {
    const pathLength = path.getTotalLength();
    const numSamples = 360;
    const increment = pathLength / numSamples;

    let closestPoint = { x: 0, y: 0 };
    let minDistanceSquared = Infinity;

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

  private calculateAngularPositionFromLocal(path: SVGPathElement, localX: number, localY: number): number {
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
        closestAngle = (i / pathLength) * 360;
      }
    }

    return closestAngle;
  }

  // --- Collision Detection ---

  /**
   * Gets the bounding boxes of ALL state groups in the solution (across all layers)
   * This allows cross-shape collision detection (rectangle vs circle)
   */
  private getAllStateBoundingBoxes(): { stateName: string; x: number; y: number; width: number; height: number; centerX: number; centerY: number }[] {
    const boundingBoxes: { stateName: string; x: number; y: number; width: number; height: number; centerX: number; centerY: number }[] = [];

    // Query ALL state groups in the solution layer (not just this layer's groups)
    // This enables cross-shape collision detection between rectangles and circles
    const solutionLayer = this.getSolutionLayer();
    solutionLayer.selectAll('g.state-group').each(function(this: Element, d: any) {
      const group = d3.select(this as SVGGElement);
      const stateName = group.attr('state-name') || 'unknown';
      const boundingRect = group.select('rect.bounding-box');

      if (boundingRect.empty()) return;

      const transform = group.attr('transform') || 'translate(0,0)';
      const match = transform.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);
      const translateX = match ? parseFloat(match[1]) : 0;
      const translateY = match ? parseFloat(match[2]) : 0;

      const localX = parseFloat(boundingRect.attr('x') || '0');
      const localY = parseFloat(boundingRect.attr('y') || '0');
      const width = parseFloat(boundingRect.attr('width') || '0');
      const height = parseFloat(boundingRect.attr('height') || '0');

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

  private boundingBoxesIntersect(
    box1: { x: number; y: number; width: number; height: number },
    box2: { x: number; y: number; width: number; height: number }
  ): boolean {
    return !(
      box1.x + box1.width <= box2.x ||
      box2.x + box2.width <= box1.x ||
      box1.y + box1.height <= box2.y ||
      box2.y + box2.height <= box1.y
    );
  }

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
   * Resolve collision for a rectangle state after dragging
   * Returns a valid non-overlapping position
   */
  private resolveCollision(
    currentPosition: { x: number; y: number },
    boxWidth: number,
    boxHeight: number,
    stateName: string,
    originalPosition: { x: number; y: number }
  ): { x: number; y: number } {
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

    // Get the nearest tangent direction away from collision
    const tangent = this.getNearestTangentDirection(currentBox, stateName);
    if (!tangent) {
      return originalPosition; // Fallback
    }

    // Define multipliers to try: 0.5x, 1x, 2x bounding box size
    const multipliers = [0.5, 1, 2];
    const boxSize = Math.max(boxWidth, boxHeight);

    // Define direction variations to try
    const getDirectionsToTry = (dx: number, dy: number): { dx: number; dy: number }[] => {
      const directions: { dx: number; dy: number }[] = [];

      // Primary tangent direction
      directions.push({ dx, dy });

      // Diagonal variations
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
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (absDx >= absDy) {
        directions.push({ dx: dx > 0 ? 1 : -1, dy: 0 });
        directions.push({ dx: 0, dy: dy > 0 ? 1 : -1 });
      } else {
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

  /**
   * Get the tangent direction pointing away from the nearest colliding state
   */
  private getNearestTangentDirection(
    box: { x: number; y: number; width: number; height: number; centerX: number; centerY: number },
    excludeStateName: string
  ): { dx: number; dy: number } | null {
    const allBoxes = this.getAllStateBoundingBoxes();

    let nearestBox: typeof allBoxes[0] | null = null;
    let minDistance = Infinity;

    for (const otherBox of allBoxes) {
      if (otherBox.stateName === excludeStateName) continue;

      if (this.boundingBoxesIntersect(box, otherBox)) {
        const dx = box.centerX - otherBox.centerX;
        const dy = box.centerY - otherBox.centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < minDistance) {
          minDistance = distance;
          nearestBox = otherBox;
        }
      }
    }

    if (!nearestBox) return null;

    // Direction from colliding box center to dragged box center
    const dx = box.centerX - nearestBox.centerX;
    const dy = box.centerY - nearestBox.centerY;
    const magnitude = Math.sqrt(dx * dx + dy * dy);

    if (magnitude === 0) {
      // If centers are the same, push in a default direction
      return { dx: 1, dy: 0 };
    }

    return { dx: dx / magnitude, dy: dy / magnitude };
  }

  // --- Connector Helpers ---

  private hideConnectorsForState(stateName: string): void {
    if (!this.connectorLayer) return;

    this.connectorLayer.selectAll(`path.permanent-connector[data-source-state="${stateName}"]`)
      .style('display', 'none');

    this.connectorLayer.selectAll(`path.permanent-connector[data-target-state="${stateName}"]`)
      .style('display', 'none');
  }

  private showAndUpdateConnectorsForState(stateName: string, groupElement: SVGGElement): void {
    if (!this.connectorLayer) return;

    const group = d3.select(groupElement);
    const transform = group.attr("transform") || "translate(0,0)";
    const match = transform.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);
    const translateX = match ? parseFloat(match[1]) : 0;
    const translateY = match ? parseFloat(match[2]) : 0;

    group.selectAll('circle.slot-marker').each((d, i, nodes) => {
      const slotMarker = d3.select(nodes[i]);
      const slotIndex = parseInt(slotMarker.attr('slot-index') || '0', 10);
      const localX = parseFloat(slotMarker.attr('cx') || '0');
      const localY = parseFloat(slotMarker.attr('cy') || '0');
      const svgX = localX + translateX;
      const svgY = localY + translateY;

      this.updateConnectorsForSlot(stateName, slotIndex, svgX, svgY);
    });

    this.connectorLayer.selectAll(`path.permanent-connector[data-source-state="${stateName}"]`)
      .style('display', null);

    this.connectorLayer.selectAll(`path.permanent-connector[data-target-state="${stateName}"]`)
      .style('display', null);
  }

  private updateConnectorsForSlot(stateName: string, slotIndex: number, newX: number, newY: number): void {
    if (!this.connectorLayer) return;

    const sourceSelector = `path.permanent-connector[data-source-state="${stateName}"][data-source-slot="${slotIndex}"]`;
    const targetSelector = `path.permanent-connector[data-target-state="${stateName}"][data-target-slot="${slotIndex}"]`;

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

  private startConnectorDrag(
    sourceX: number, sourceY: number,
    mouseX: number, mouseY: number,
    sourceStateName?: string, sourceSlotIndex?: number
  ): void {
    this.connectorSourcePosition = { x: sourceX, y: sourceY };
    if (sourceStateName !== undefined && sourceSlotIndex !== undefined) {
      this.connectorSourceSlotInfo = { stateName: sourceStateName, slotIndex: sourceSlotIndex };
    }

    const connector = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    connector.setAttribute('d', `M ${sourceX} ${sourceY} L ${mouseX} ${mouseY}`);
    connector.setAttribute('class', 'tentative-connector');
    connector.setAttribute('fill', 'none');
    connector.setAttribute('stroke', '#333');
    connector.setAttribute('stroke-width', '2');
    connector.setAttribute('stroke-dasharray', '5,5');
    connector.setAttribute('marker-end', 'url(#arrowhead)');
    connector.setAttribute('pointer-events', 'none');

    if (sourceStateName !== undefined) {
      connector.setAttribute('data-source-state', sourceStateName);
    }
    if (sourceSlotIndex !== undefined) {
      connector.setAttribute('data-source-slot', sourceSlotIndex.toString());
    }

    this.connectorLayer?.node()?.appendChild(connector);
    this.interactionStateService.setInteractionState('connector-drag');
  }

  // --- Drag Behavior ---

  private createDragStateBehavior(): d3.DragBehavior<SVGGElement, RectangleStateDataPoint, RectangleStateDataPoint> {
    const self = this;
    return d3.drag<SVGGElement, RectangleStateDataPoint>()
      .container(() => this.d3SvgBaseLayer.node() as SVGSVGElement)
      .subject(function(event, d) {
        if (!d) {
          const target = event.sourceEvent?.target as Element;
          const groupElement = target?.closest('g.state-group') as SVGGElement | null;
          if (groupElement) {
            const stateName = groupElement.getAttribute('state-name');
            const dataPoint = self.stateDataPoints.find((dp: RectangleStateDataPoint) => dp.stateName === stateName);
            if (dataPoint) {
              d3.select(groupElement).datum(dataPoint);
              return dataPoint;
            }
          }
        }
        return d;
      })
      .on('start', (event, d) => this.onDragStateStart(event, d))
      .on('drag', (event, d) => this.onDragState(event, d))
      .on('end', (event, d) => this.onDragStateEnd(event, d));
  }

  private onDragStateStart(
    event: d3.D3DragEvent<SVGGElement, RectangleStateDataPoint | RectangleSlotDataPoint, RectangleStateDataPoint | RectangleSlotDataPoint>,
    datapoint: RectangleStateDataPoint | RectangleSlotDataPoint
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

    const isDraggableShape = targetElement?.tagName === 'rect' && targetElement?.classList.contains('draggable-shape');
    const isOverlayComponent = targetElement?.tagName === 'rect' && targetElement?.classList.contains('overlay-component');
    const isBoundingBox = targetElement?.tagName === 'rect' && targetElement?.classList.contains('bounding-box');
    const isSlotPath = targetElement?.tagName === 'path' && targetElement?.classList.contains('slot-path');

    if (isDraggableShape || isOverlayComponent || isBoundingBox || isSlotPath) {
      event.sourceEvent.stopPropagation();
      this.interactionStateService.setInteractionState('state-drag');
      group.raise().attr('stroke', 'black');

      const currentGroupTransform = group.attr("transform") || "translate(0,0)";
      const matchGroup = currentGroupTransform.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);
      const groupX = matchGroup ? parseFloat(matchGroup[1]) : 0;
      const groupY = matchGroup ? parseFloat(matchGroup[2]) : 0;
      this.originalStatePosition = { x: groupX, y: groupY };

      const stateName = group.attr('state-name') || (datapoint as RectangleStateDataPoint).stateName || 'unknown';
      this.hideConnectorsForState(stateName);

      if (this.onStateDragStart) {
        this.onStateDragStart(stateName);
      }
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

      const stateName = group.attr('state-name') || (datapoint as RectangleStateDataPoint).stateName || 'unknown';
      const slotIndex = parseInt(slotMarker.attr('slot-index') || '0', 10);

      this.originalSlotPosition = { x: slotSvgX, y: slotSvgY };
      this.currentDragStateWidth = (datapoint as RectangleStateDataPoint).width || 100;
      this.currentDragStateHeight = (datapoint as RectangleStateDataPoint).height || 100;

      const path = group.select('path.slot-path').node() as SVGPathElement;
      if (path) {
        this.originalSlotAngularPosition = this.calculateAngularPositionFromLocal(path, slotLocalX, slotLocalY);
      }

      this.currentDragSlotInfo = { stateName, slotIndex };

      if (this.connectorMode) {
        this.startConnectorDrag(slotSvgX, slotSvgY, event.x, event.y, stateName, slotIndex);
      } else {
        this.interactionStateService.setInteractionState('slot-drag');
      }
      group.raise().attr('stroke', 'black');
    }
  }

  private onDragState(event: d3.D3DragEvent<SVGGElement, RectangleStateDataPoint, RectangleStateDataPoint>, datapoint: RectangleStateDataPoint): void {
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

      const tangentialDx = localMouseX - closestPoint.x;
      const tangentialDy = localMouseY - closestPoint.y;
      const tangentialDistance = Math.sqrt(tangentialDx * tangentialDx + tangentialDy * tangentialDy);
      const threshold = Math.min(this.currentDragStateWidth, this.currentDragStateHeight) / 2;

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

  private onDragStateEnd(event: d3.D3DragEvent<SVGGElement, RectangleStateDataPoint, RectangleStateDataPoint>, datapoint: RectangleStateDataPoint): void {
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
      const draggedGroupElement = this.currentGroupElement;
      const slotInfo = this.currentDragSlotInfo;

      if (draggedGroupElement && slotInfo) {
        const group = d3.select(draggedGroupElement);
        const slotMarker = d3.select(this.currentDragElement);
        const path = group.select('path.slot-path').node() as SVGPathElement;

        if (path && slotMarker && !slotMarker.empty()) {
          const slotLocalX = parseFloat(slotMarker.attr('cx') || '0');
          const slotLocalY = parseFloat(slotMarker.attr('cy') || '0');

          const currentAngle = this.calculateAngularPositionFromLocal(path, slotLocalX, slotLocalY);

          if (solutionName) {
            solutionStateService.updateSlotAngularPosition(
              solutionName,
              slotInfo.stateName,
              slotInfo.slotIndex,
              currentAngle
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

        const currentTransform = group.attr("transform") || "translate(0,0)";
        const matchCurrent = currentTransform.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);
        const currentX = matchCurrent ? parseFloat(matchCurrent[1]) : 0;
        const currentY = matchCurrent ? parseFloat(matchCurrent[2]) : 0;

        // Get bounding box dimensions for collision resolution
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

        if (solutionName) {
          solutionStateService.updateStatePosition(
            solutionName,
            stateName,
            resolvedPosition.x,
            resolvedPosition.y
          );
        }

        this.showAndUpdateConnectorsForState(stateName, draggedGroupElement);

        if (this.onStateDragEnd) {
          this.onStateDragEnd(stateName, draggedGroupElement);
        }
      }
    }

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
    this.currentDragStateWidth = 0;
    this.currentDragStateHeight = 0;
  }

  public destroy(): void {
    this.baseLayerSubscription?.unsubscribe();
  }

}
