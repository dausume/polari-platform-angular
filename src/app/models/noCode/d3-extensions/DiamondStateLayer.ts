// Author: Dustin Etts
// polari-platform-angular/src/app/models/noCode/d3-extensions/DiamondStateLayer.ts
import { D3ModelLayer } from './D3ModelLayer';
import DiamondStateDataPoint from './DataPointTypes/DiamondStateDataPoint';
import DiamondSlotDataPoint from './DataPointTypes/DiamondSlotDataPoint';
import { NoCodeStateRendererManager } from '@services/no-code-services/no-code-state-renderer-manager';
import { BehaviorSubject, Subscription } from 'rxjs';
import { Slot } from '../Slot';
import * as d3 from 'd3';
import { NoCodeState } from '../NoCodeState';
import { NoCodeSolution } from '../NoCodeSolution';
import { InteractionStateService } from '@services/no-code-services/interaction-state-service';
import {
  getContrastingTextColor,
  generateSlotLabel,
  DEFAULT_INPUT_SLOT_COLOR,
  DEFAULT_OUTPUT_SLOT_COLOR
} from '../../../utils/color-utils';

// Defines how to render diamonds that can be dragged around the screen.
// This is used to represent conditional states (if/else branching) in the No-Code Interface.
// A diamond is a square rotated 45 degrees, commonly used in flowcharts for decision points.
export class DiamondStateLayer extends D3ModelLayer {

  connectorMode: boolean;
  currentDragElement: HTMLElement | null = null;
  currentGroupElement: SVGGElement | null = null;
  currentDragTargetDataPoint: DiamondStateDataPoint | DiamondSlotDataPoint | null = null;
  currentGroupCenter: {x: number, y: number} | null = null;
  currentGroupCoordinateTransformMatrix: DOMMatrix | null = null;
  connectorSourcePosition: {x: number, y: number} | null = null;
  connectorSourceSlotInfo: {stateName: string, slotIndex: number} | null = null;
  connectorSourceIsInput: boolean | null = null;
  originalSlotPosition: {x: number, y: number} | null = null;
  originalSlotAngularPosition: number = 0;
  currentDragStateSize: number = 0;
  originalStatePosition: {x: number, y: number} | null = null;
  currentDragSlotInfo: {stateName: string, slotIndex: number} | null = null;

  private onStateOverlayClick: ((stateName: string, stateGroup: SVGGElement) => void) | null = null;
  private onStateDragStart: ((stateName: string) => void) | null = null;
  private onStateDragEnd: ((stateName: string, stateGroup: SVGGElement) => void) | null = null;
  private onStateContextMenu: ((event: MouseEvent, stateName: string, stateGroup: SVGGElement) => void) | null = null;
  private onSlotContextMenu: ((event: MouseEvent, stateName: string, slotIndex: number, isInput: boolean) => void) | null = null;

  constructor(
    private rendererManager: NoCodeStateRendererManager,
    private interactionStateService: InteractionStateService,
    shapeType: string,
    noCodeSolution: NoCodeSolution,
    stateDataPoints: DiamondStateDataPoint[],
    iconSvgString?: string,
    slotDataPoints?: DiamondSlotDataPoint[],
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
    this.stateDataPoints = this.getDiamondStateDataPointsFromSolution(noCodeSolution);
    this.slotDataPoints = this.getDiamondSlotDataPointsFromSolution(noCodeSolution);
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

  setOnSlotContextMenu(callback: (event: MouseEvent, stateName: string, slotIndex: number, isInput: boolean) => void): void {
    this.onSlotContextMenu = callback;
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

  private getDiamondStateDataPointsFromSolution(noCodeSolution: NoCodeSolution): DiamondStateDataPoint[] {
    if (!noCodeSolution) {
      console.error("NoCodeSolution is undefined. Cannot retrieve diamond state data points.");
      return [];
    }

    return noCodeSolution.stateInstances
      .filter(state => state.shapeType === "diamond")
      .map(state => new DiamondStateDataPoint(
        state.stateLocationX ?? 0,
        state.stateLocationY ?? 0,
        state.stateSvgRadius ?? 50, // Use radius as diamond size
        state.slotRadius ?? 4,
        state.stateName ?? "unknown",
        state.stateClass,
        state.backgroundColor
      ));
  }

  private getDiamondSlotDataPointsFromSolution(noCodeSolution: NoCodeSolution): DiamondSlotDataPoint[] {
    if (!noCodeSolution) {
      console.error("NoCodeSolution is undefined. Cannot retrieve slot data points.");
      return [];
    }

    return noCodeSolution.stateInstances
      .filter(state => state.shapeType === "diamond")
      .flatMap((state: NoCodeState) => {
        let inputIndex = 0;
        let outputIndex = 0;

        return state.slots?.map((slot: Slot) => {
          const label = slot.isInput
            ? generateSlotLabel(true, inputIndex++)
            : generateSlotLabel(false, outputIndex++);

          const color = (slot as any).color ||
            (slot.isInput ? DEFAULT_INPUT_SLOT_COLOR : DEFAULT_OUTPUT_SLOT_COLOR);

          return new DiamondSlotDataPoint(
            state.stateLocationX ?? 0,
            state.stateLocationY ?? 0,
            state.stateSvgRadius ?? 50,
            slot.index,
            slot.slotAngularPosition ?? 0,
            slot.isInput,
            slot.isOutput,
            state.stateName ?? "unknown",
            noCodeSolution.solutionName,
            color,
            label
          );
        }) || [];
      });
  }

  // --- Rendering Functions ---

  render(): void {
    console.log('=== DiamondStateLayer.render() called ===');
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

          // Find source slot position
          const sourceGroup = this.getLayerGroup()
            .select(`g.state-group[state-name="${sourceState.stateName}"]`);
          if (sourceGroup.empty()) return;

          const sourceSlotMarker = sourceGroup.select(`circle.slot-marker[slot-index="${slot.index}"]`);
          if (sourceSlotMarker.empty()) return;

          // Find target slot position - search across ALL layers (not just this layer)
          // This enables cross-layer connectors (e.g., diamond to circle or rectangle)
          const targetGroup = this.getSolutionLayer()
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

    if (defs.select('#arrowhead-start').empty()) {
      defs.append('marker')
        .attr('id', 'arrowhead-start')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 2)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M10,-5L0,0L10,5')
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
    if (newState.shapeType === "diamond") {
      const cx = newState.stateLocationX ?? 0;
      const cy = newState.stateLocationY ?? 0;
      const size = newState.stateSvgRadius ?? 50;
      const newStateDataPoint = new DiamondStateDataPoint(cx, cy, size);
      // TODO: Add the new state data point to the layer
    } else {
      console.warn(
        "Invalid No-Code State: Ensure shapeType is 'diamond' for states added to the DiamondStateLayer."
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

  addStateDataPoint(datapoint: DiamondStateDataPoint): void {
    this.stateDataPoints.push(datapoint);
  }

  removeDataPoint(datapoint: DiamondStateDataPoint): void {
    const index = this.stateDataPoints.indexOf(datapoint);
    if (index > -1) {
      this.stateDataPoints.splice(index, 1);
    }
  }

  updateDataPoint(oldDatapoint: DiamondStateDataPoint, newDatapoint: DiamondStateDataPoint): void {
    const index = this.stateDataPoints.indexOf(oldDatapoint);
    if (index > -1) {
      this.stateDataPoints[index] = newDatapoint;
    }
  }

  getDataPoint(index: number): DiamondStateDataPoint {
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

  rerenderState(stateName: string): void {
    if (!this.noCodeSolution) return;

    const state = this.noCodeSolution.stateInstances.find(s => s.stateName === stateName);
    if (!state || state.shapeType !== 'diamond') return;

    this.slotDataPoints = this.slotDataPoints.filter(
      (slot: DiamondSlotDataPoint) => slot.stateName !== stateName
    );

    let inputIndex = 0;
    let outputIndex = 0;
    const newSlotDataPoints = state.slots?.map((slot: Slot) => {
      const label = (slot as any).label || (slot.isInput
        ? generateSlotLabel(true, inputIndex++)
        : generateSlotLabel(false, outputIndex++));

      const color = (slot as any).color ||
        (slot.isInput ? DEFAULT_INPUT_SLOT_COLOR : DEFAULT_OUTPUT_SLOT_COLOR);

      return new DiamondSlotDataPoint(
        state.stateLocationX ?? 0,
        state.stateLocationY ?? 0,
        state.stateSvgRadius ?? 50,
        slot.index,
        slot.slotAngularPosition ?? 0,
        slot.isInput,
        slot.isOutput,
        stateName,
        undefined,
        color,
        label
      );
    }) || [];

    this.slotDataPoints.push(...newSlotDataPoints);
    this.initializeSlotLayer();
  }

  // --- Layer Level Functions ---

  initializeLayerGroup(): void {
    console.log('[DiamondStateLayer.initializeLayerGroup] Starting for layer:', this.layerName);

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
    console.log('[DiamondStateLayer.initializeStateGroups] Starting...');

    if (!this.d3SvgBaseLayer) {
      console.log('[DiamondStateLayer.initializeStateGroups] ABORT - no d3SvgBaseLayer!');
      return;
    }

    let layerGroup = this.getLayerGroup();

    if (layerGroup.size() === 0) {
      console.log('[DiamondStateLayer.initializeStateGroups] WARNING: layerGroup is empty!');
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
      .each((datapoint: DiamondStateDataPoint, index, elements) => {
        let group = d3.select(elements[index]);
        const size = datapoint.size;
        const self = this;

        // Append the bounding box rectangle (hidden by default, no pointer events)
        group.append('rect')
          .classed('bounding-box', true)
          .classed('debug-element', true)
          .attr('x', -size)
          .attr('y', -size)
          .attr('width', size * 2)
          .attr('height', size * 2)
          .attr('fill', "white")
          .attr('stroke', "black")
          .style('opacity', 0)
          .style('pointer-events', 'none');

        // Append the diamond shape (polygon with 4 vertices)
        // Diamond vertices: top, right, bottom, left (rotated square)
        const diamondPath = `M 0 ${-size} L ${size} 0 L 0 ${size} L ${-size} 0 Z`;
        const fillColor = datapoint.backgroundColor || '#4CAF50';

        group.append('path')
          .classed('draggable-shape', true)
          .attr('d', diamondPath)
          .attr('fill', fillColor)
          .attr('stroke', 'black')
          .attr('stroke-width', 2)
          .on('contextmenu', function(event: MouseEvent) {
            event.preventDefault();
            event.stopPropagation();
            const groupElement = elements[index] as SVGGElement;
            const stateName = datapoint.stateName || 'unknown';
            if (self.onStateContextMenu) {
              self.onStateContextMenu(event, stateName, groupElement);
            }
          });

        // Append the inner component rectangle (positioning marker for Angular overlays)
        const innerSize = size * 0.5;
        group.append('rect')
          .classed('overlay-component', true)
          .classed('debug-element', true)
          .attr('x', -innerSize)
          .attr('y', -innerSize)
          .attr('width', innerSize * 2)
          .attr('height', innerSize * 2)
          .attr('fill', 'transparent')
          .attr('stroke', 'transparent')
          .on('contextmenu', function(event: MouseEvent) {
            event.preventDefault();
            event.stopPropagation();
            const groupElement = elements[index] as SVGGElement;
            const stateName = datapoint.stateName || 'unknown';
            if (self.onStateContextMenu) {
              self.onStateContextMenu(event, stateName, groupElement);
            }
          });

        // Generate the diamond path for slot placement
        let slotPath = this.generateDiamondPath(size);
        group.append('path')
          .attr('d', slotPath)
          .classed('slot-path', true)
          .classed('debug-element', true)
          .attr('fill', 'none')
          .attr('stroke', 'red')
          .attr('stroke-width', 8)
          .style('opacity', 0);
      });

    newGroups.on('mousedown.preventZoom', function(this: SVGGElement, event: MouseEvent) {
      event.stopPropagation();
    });

    newGroups.call(this.createDragStateBehavior());

    const allGroups = newGroups.merge(stateGroups);

    allGroups.each((d: DiamondStateDataPoint | null, i: number, nodes: ArrayLike<SVGGElement>) => {
      const element = nodes[i];
      const stateName = element.getAttribute('state-name');

      if (!d) {
        const dataPoint = validDataPoints.find((dp: DiamondStateDataPoint) => dp.stateName === stateName);
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

  getDiamondElements(): d3.Selection<SVGGElement, DiamondStateDataPoint, any, unknown> {
    return this.getStateGroups()
      .selectAll('path.draggable-shape');
  }

  // --- Path Generation for Diamond Perimeter ---

  /**
   * Generates a path that follows the perimeter of a diamond.
   * Diamond vertices: top (0, -size), right (size, 0), bottom (0, size), left (-size, 0)
   * @param size Distance from center to vertex
   * @returns SVG path string
   */
  generateDiamondPath(size: number): string {
    return `M 0 ${-size} L ${size} 0 L 0 ${size} L ${-size} 0 Z`;
  }

  // --- Slot Placement Functions ---

  initializeSlotLayer(): void {
    let stateGroups = this.getStateGroups();

    stateGroups.each((datapoint: DiamondStateDataPoint, index: number, elements: any) => {
      let currentStateGroup = d3.select(elements[index]);

      // Remove existing slot markers and labels
      currentStateGroup.selectAll('circle.slot-marker').remove();
      currentStateGroup.selectAll('text.slot-label').remove();

      let currentStateSlots = this.slotDataPoints.filter((slot: DiamondSlotDataPoint) => slot.stateName === datapoint.stateName);
      let indexSortedSlots = currentStateSlots.slice().sort((a: DiamondSlotDataPoint, b: DiamondSlotDataPoint) => a.index - b.index);

      const path = currentStateGroup.select('path.slot-path').node() as SVGPathElement;
      if (!path) return;

      const pathLength = path.getTotalLength();
      const slotLength = pathLength / currentStateSlots.length || 0;
      const slotRadius = Math.min(slotLength / currentStateSlots.length, 10);

      for (let i = 0; i < indexSortedSlots.length; i++) {
        const slotData = indexSortedSlots[i];
        const angle = slotData.angularPosition ?? (slotData.index * (360 / currentStateSlots.length));
        const { x, y } = this.getSlotPositionOnPath(path, angle);

        const slotColor = slotData.color ||
          (slotData.isInput ? DEFAULT_INPUT_SLOT_COLOR : DEFAULT_OUTPUT_SLOT_COLOR);

        const label = slotData.label || (slotData.isInput ? `I${slotData.index}` : `O${slotData.index}`);

        const self = this;
        currentStateGroup.append('circle')
          .classed('slot-marker', true)
          .attr('slot-index', String(slotData.index))
          .attr('data-state-name', datapoint.stateName)
          .attr('data-is-input', String(slotData.isInput))
          .attr('cx', x)
          .attr('cy', y)
          .attr('r', slotRadius)
          .attr('fill', slotColor)
          .on('contextmenu', function(event: MouseEvent) {
            event.preventDefault();
            event.stopPropagation();
            const stateName = datapoint.stateName || 'unknown';
            const slotIndex = slotData.index;
            const isInput = slotData.isInput;
            if (self.onSlotContextMenu) {
              self.onSlotContextMenu(event, stateName, slotIndex, isInput);
            }
          });

        const fontSize = Math.max(slotRadius * 0.7, 4);
        const textColor = getContrastingTextColor(slotColor);

        currentStateGroup.append('text')
          .classed('slot-label', true)
          .attr('slot-index', String(slotData.index))
          .attr('x', x)
          .attr('y', y)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'central')
          .attr('font-size', `${fontSize}px`)
          .attr('font-family', 'Arial, sans-serif')
          .attr('font-weight', 'bold')
          .attr('fill', textColor)
          .attr('pointer-events', 'none')
          .text(label);
      }
    });
  }

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

  private getAllStateBoundingBoxes(): { stateName: string; x: number; y: number; width: number; height: number; centerX: number; centerY: number }[] {
    const boundingBoxes: { stateName: string; x: number; y: number; width: number; height: number; centerX: number; centerY: number }[] = [];

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

  private resolveCollision(
    currentPosition: { x: number; y: number },
    boxSize: number,
    stateName: string,
    originalPosition: { x: number; y: number }
  ): { x: number; y: number } {
    const currentBox = {
      x: currentPosition.x - boxSize,
      y: currentPosition.y - boxSize,
      width: boxSize * 2,
      height: boxSize * 2,
      centerX: currentPosition.x,
      centerY: currentPosition.y
    };

    if (!this.hasCollisionWithOtherStates(currentBox, stateName)) {
      return currentPosition;
    }

    const tangent = this.getNearestTangentDirection(currentBox, stateName);
    if (!tangent) {
      return originalPosition;
    }

    const multipliers = [0.5, 1, 2];

    const getDirectionsToTry = (dx: number, dy: number): { dx: number; dy: number }[] => {
      const directions: { dx: number; dy: number }[] = [];
      directions.push({ dx, dy });

      const angle = Math.atan2(dy, dx);
      const diag1Angle = angle + Math.PI / 4;
      const diag2Angle = angle - Math.PI / 4;

      directions.push({ dx: Math.cos(diag1Angle), dy: Math.sin(diag1Angle) });
      directions.push({ dx: Math.cos(diag2Angle), dy: Math.sin(diag2Angle) });

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

    for (const multiplier of multipliers) {
      const offset = boxSize * 2 * multiplier;

      for (const direction of directionsToTry) {
        const testPosition = {
          x: currentPosition.x + direction.dx * offset,
          y: currentPosition.y + direction.dy * offset
        };

        const testBox = {
          x: testPosition.x - boxSize,
          y: testPosition.y - boxSize,
          width: boxSize * 2,
          height: boxSize * 2
        };

        if (!this.hasCollisionWithOtherStates(testBox, stateName)) {
          return testPosition;
        }
      }
    }

    return originalPosition;
  }

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

    const dx = box.centerX - nearestBox.centerX;
    const dy = box.centerY - nearestBox.centerY;
    const magnitude = Math.sqrt(dx * dx + dy * dy);

    if (magnitude === 0) {
      return { dx: 1, dy: 0 };
    }

    return { dx: dx / magnitude, dy: dy / magnitude };
  }

  // --- Connector Helpers ---

  private hideConnectorsForState(stateName: string): void {
    // Hide connectors where this state is the source (search entire document for cross-layer support)
    d3.selectAll(`path.permanent-connector[data-source-state="${stateName}"]`)
      .style('display', 'none');

    // Hide connectors where this state is the target (search entire document for cross-layer support)
    d3.selectAll(`path.permanent-connector[data-target-state="${stateName}"]`)
      .style('display', 'none');
  }

  private showAndUpdateConnectorsForState(stateName: string, groupElement: SVGGElement): void {
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

    // Show connectors where this state is the source (search entire document for cross-layer support)
    d3.selectAll(`path.permanent-connector[data-source-state="${stateName}"]`)
      .style('display', null);

    // Show connectors where this state is the target (search entire document for cross-layer support)
    d3.selectAll(`path.permanent-connector[data-target-state="${stateName}"]`)
      .style('display', null);
  }

  private updateConnectorsForSlot(stateName: string, slotIndex: number, newX: number, newY: number): void {
    const sourceSelector = `path.permanent-connector[data-source-state="${stateName}"][data-source-slot="${slotIndex}"]`;
    const targetSelector = `path.permanent-connector[data-target-state="${stateName}"][data-target-slot="${slotIndex}"]`;

    // Update connectors where this slot is the source (search entire document for cross-layer support)
    d3.selectAll(sourceSelector).each((d: any, i: number, nodes: any) => {
      const connector = d3.select(nodes[i]);
      const currentPath = connector.attr('d') || '';
      const match = currentPath.match(/M\s*([-\d.]+)\s+([-\d.]+)\s+L\s*([-\d.]+)\s+([-\d.]+)/);
      if (match) {
        const targetX = parseFloat(match[3]);
        const targetY = parseFloat(match[4]);
        connector.attr('d', `M ${newX} ${newY} L ${targetX} ${targetY}`);
      }
    });

    // Update connectors where this slot is the target (search entire document for cross-layer support)
    d3.selectAll(targetSelector).each((d: any, i: number, nodes: any) => {
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

  private createDragStateBehavior(): d3.DragBehavior<SVGGElement, DiamondStateDataPoint, DiamondStateDataPoint> {
    const self = this;
    return d3.drag<SVGGElement, DiamondStateDataPoint>()
      .container(() => this.d3SvgBaseLayer.node() as SVGSVGElement)
      .subject(function(event, d) {
        if (!d) {
          const target = event.sourceEvent?.target as Element;
          const groupElement = target?.closest('g.state-group') as SVGGElement | null;
          if (groupElement) {
            const stateName = groupElement.getAttribute('state-name');
            const dataPoint = self.stateDataPoints.find((dp: DiamondStateDataPoint) => dp.stateName === stateName);
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
    event: d3.D3DragEvent<SVGGElement, DiamondStateDataPoint | DiamondSlotDataPoint, DiamondStateDataPoint | DiamondSlotDataPoint>,
    datapoint: DiamondStateDataPoint | DiamondSlotDataPoint
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

    // Check if clicking on draggable elements (path, overlay-component, or slot-path)
    // Note: bounding-box is excluded as it's a debug element with pointer-events: none
    const isDraggableShape = targetElement?.tagName === 'path' && targetElement?.classList.contains('draggable-shape');
    const isOverlayComponent = targetElement?.tagName === 'rect' && targetElement?.classList.contains('overlay-component');
    const isSlotPath = targetElement?.tagName === 'path' && targetElement?.classList.contains('slot-path');

    if (isDraggableShape || isOverlayComponent || isSlotPath) {
      event.sourceEvent.stopPropagation();
      this.interactionStateService.setInteractionState('state-drag');
      group.raise().attr('stroke', 'black');

      const currentGroupTransform = group.attr("transform") || "translate(0,0)";
      const matchGroup = currentGroupTransform.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);
      const groupX = matchGroup ? parseFloat(matchGroup[1]) : 0;
      const groupY = matchGroup ? parseFloat(matchGroup[2]) : 0;
      this.originalStatePosition = { x: groupX, y: groupY };

      const stateName = group.attr('state-name') || (datapoint as DiamondStateDataPoint).stateName || 'unknown';
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

      const stateName = group.attr('state-name') || (datapoint as DiamondStateDataPoint).stateName || 'unknown';
      const slotIndex = parseInt(slotMarker.attr('slot-index') || '0', 10);

      this.originalSlotPosition = { x: slotSvgX, y: slotSvgY };
      this.currentDragStateSize = (datapoint as DiamondStateDataPoint).size || 50;

      const path = group.select('path.slot-path').node() as SVGPathElement;
      if (path) {
        this.originalSlotAngularPosition = this.calculateAngularPositionFromLocal(path, slotLocalX, slotLocalY);
      }

      this.currentDragSlotInfo = { stateName, slotIndex };

      if (this.connectorMode) {
        this.startConnectorDrag(slotSvgX, slotSvgY, event.x, event.y, stateName, slotIndex);
      } else {
        this.interactionStateService.setInteractionState('slot-drag');
        // Hide the slot label and connectors during drag - will be re-rendered on drop
        group.select(`text.slot-label[slot-index="${slotIndex}"]`).style('display', 'none');
        this.setConnectorsVisibilityForSlot(stateName, slotIndex, false);
      }
      group.raise().attr('stroke', 'black');
    }
  }

  private onDragState(event: d3.D3DragEvent<SVGGElement, DiamondStateDataPoint, DiamondStateDataPoint>, datapoint: DiamondStateDataPoint): void {
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
      const threshold = this.currentDragStateSize / 2;

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

  private onDragStateEnd(event: d3.D3DragEvent<SVGGElement, DiamondStateDataPoint, DiamondStateDataPoint>, datapoint: DiamondStateDataPoint): void {
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

          const finalLocalX = parseFloat(slotMarker.attr('cx') || '0');
          const finalLocalY = parseFloat(slotMarker.attr('cy') || '0');
          const slotLabel = group.select(`text.slot-label[slot-index="${slotInfo.slotIndex}"]`);
          if (!slotLabel.empty()) {
            slotLabel
              .attr('x', finalLocalX)
              .attr('y', finalLocalY)
              .style('display', null);
          }

          // Show connectors again after drag ends (they were hidden during drag)
          this.setConnectorsVisibilityForSlot(slotInfo.stateName, slotInfo.slotIndex, true);
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

        const boundingRect = group.select('rect.bounding-box');
        const boxSize = parseFloat(boundingRect.attr('width') || '0') / 2;

        const resolvedPosition = this.resolveCollision(
          { x: currentX, y: currentY },
          boxSize,
          stateName,
          this.originalStatePosition
        );

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
    this.currentDragStateSize = 0;
  }

  /**
   * Hide or show connectors associated with a specific slot during drag operations.
   * Uses d3.selectAll to search entire document for cross-layer connector support.
   */
  private setConnectorsVisibilityForSlot(stateName: string, slotIndex: number, visible: boolean): void {
    const displayValue = visible ? null : 'none';
    const sourceSelector = `path.permanent-connector[data-source-state="${stateName}"][data-source-slot="${slotIndex}"]`;
    const targetSelector = `path.permanent-connector[data-target-state="${stateName}"][data-target-slot="${slotIndex}"]`;

    d3.selectAll(sourceSelector).style('display', displayValue);
    d3.selectAll(targetSelector).style('display', displayValue);
  }

  public destroy(): void {
    this.baseLayerSubscription?.unsubscribe();
  }

}
