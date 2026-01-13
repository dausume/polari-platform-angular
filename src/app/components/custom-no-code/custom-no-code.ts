// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/custom-no-code.ts
import { Component, Renderer2, HostListener, ElementRef, ChangeDetectorRef, ViewChild, ViewContainerRef, AfterViewInit, OnDestroy, OnInit } from '@angular/core';
import { NoCodeState } from '@models/noCode/NoCodeState';
import { NoCodeSolution } from '@models/noCode/NoCodeSolution';
import { CdkDragStart, CdkDragEnd } from '@angular/cdk/drag-drop';
import { BehaviorSubject, Subject } from "rxjs";
import { debounceTime, takeUntil } from 'rxjs/operators';
import { OverlayComponentService } from '../../services/no-code-services/overlay-component-service';
import * as d3 from 'd3';
import { NoCodeStateInstanceComponent } from './no-code-state-instance/no-code-state-instance';
import { NoCodeStateRendererManager } from '@services/no-code-services/no-code-state-renderer-manager';
import { InteractionStateService } from '@services/no-code-services/interaction-state-service';
import { NoCodeSolutionStateService } from '@services/no-code-services/no-code-solution-state.service';

// An Editor which creates a new No-Code Solution by default.
@Component({
  selector: 'custom-no-code',
  templateUrl: 'custom-no-code.html',
  styleUrls: ['./custom-no-code.css']
})
export class CustomNoCodeComponent implements OnInit, AfterViewInit, OnDestroy
{
  @ViewChild('graphContainer', { read: ViewContainerRef, static: false }) graphContainerRef!: ViewContainerRef;

  boxes: any[] = [
    { x: 100, y: 100, width: 100, height: 100, id: 1 },
    { x: 300, y: 200, width: 100, height: 100, id: 2 }
  ];

  //@ts-ignore
  @ViewChild('d3Graph', { static: true }) d3Graph: ElementRef;

  polariAccessNodeSubject = new BehaviorSubject<NoCodeState>(new NoCodeState());

  contextMenu: boolean = false;
  stateInstances: NoCodeState[] = [];

  noCodeSolution: NoCodeSolution | undefined;

  // Solution selector state
  availableSolutions: { id: number; name: string }[] = [];
  selectedSolutionName: string | null = null;

  // Used for binding the overlay which displays State Object UIs and their container elements to the d3 Objects.
  overlayStateSegments: { [key: number]: HTMLElement | null } = {};

  makeConnectionsMode: boolean = false;
  sourceNode: any = null;
  d3GraphRenderingSVG: any;

  // For cleanup
  private destroy$ = new Subject<void>();
  private resizeSubject = new Subject<void>();

  // Default viewBox dimensions (logical coordinate space)
  private viewBoxWidth = 1200;
  private viewBoxHeight = 800;

  // Zoom/pan related
  private zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null;
  private zoomContainer: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
  private currentZoom = 1;
  zoomPercent = 100; // For template binding
  private readonly minZoom = 0.1;
  private readonly maxZoom = 4;

  constructor(
      private elementRef: ElementRef,
      private changeDetectorRef: ChangeDetectorRef,
      private renderer: Renderer2,
      private overlayComponentService: OverlayComponentService,
      private noCodeStateRendererManager: NoCodeStateRendererManager,
      private hostViewContainerRef: ViewContainerRef,
      private interactionStateManager: InteractionStateService,
      private solutionStateService: NoCodeSolutionStateService
  )
  {
    // Debounce resize events to avoid excessive updates
    this.resizeSubject.pipe(
      debounceTime(100),
      takeUntil(this.destroy$)
    ).subscribe(() => this.onResize());
  }

  // To do our initial rendering we should use the NoCodeStateRendererManager and ensure all
  // NoCodeState objects in our current NoCodeSolution
  ngOnInit(): void {
    // IMPORTANT: Create SVG FIRST before subscribing to solutions
    // because BehaviorSubject will emit immediately and loadSelectedSolution needs the zoomContainer
    this.createSvg();

    // Pass the zoom container as the base layer so all content gets zoom/pan transforms
    this.noCodeStateRendererManager.setD3SvgBaseLayer(this.zoomContainer as any);

    // Subscribe to available solutions for the selector
    this.solutionStateService.availableSolutions$
      .pipe(takeUntil(this.destroy$))
      .subscribe(solutions => {
        this.availableSolutions = solutions;
        this.changeDetectorRef.markForCheck();
      });

    // Subscribe to selected solution changes
    // This will fire immediately with the current selected solution
    this.solutionStateService.selectedSolutionName$
      .pipe(takeUntil(this.destroy$))
      .subscribe(solutionName => {
        console.log('[DEBUG] selectedSolutionName$ subscription fired with:', solutionName);
        console.log('[DEBUG] Current selectedSolutionName:', this.selectedSolutionName);
        if (solutionName && solutionName !== this.selectedSolutionName) {
          this.selectedSolutionName = solutionName;
          // Trigger change detection immediately so dropdown updates
          this.changeDetectorRef.detectChanges();
          this.loadSelectedSolution();
        }
      });
  }

  /**
   * Load and render the currently selected solution from the state service
   */
  private loadSelectedSolution(): void {
    // Get state instances from the state service
    this.stateInstances = this.solutionStateService.getSelectedSolutionStateInstances();
    const solutionData = this.solutionStateService.getSelectedSolutionData();

    console.log('[DEBUG] loadSelectedSolution called');
    console.log('[DEBUG] solutionData:', solutionData);
    console.log('[DEBUG] stateInstances count:', this.stateInstances.length);
    console.log('[DEBUG] stateInstances:', this.stateInstances.map(s => s.stateName));

    if (!solutionData) {
      console.warn('No solution data available');
      return;
    }

    // Clear the existing SVG content (except the zoom container itself)
    if (this.zoomContainer) {
      console.log('[DEBUG] Clearing zoom container');
      this.zoomContainer.selectAll('*').remove();
    }

    // Clear the renderer manager's solution cache
    console.log('[DEBUG] Clearing solutions from renderer manager');
    this.noCodeStateRendererManager.clearSolutions();

    console.log('[DEBUG] Creating new NoCodeSolution with', this.stateInstances.length, 'states');
    // Create new NoCodeSolution with state instances from the service
    this.noCodeSolution = new NoCodeSolution(
      this.noCodeStateRendererManager,
      this.interactionStateManager,
      solutionData.xBounds || this.viewBoxWidth,
      solutionData.yBounds || this.viewBoxHeight,
      solutionData.solutionName,
      this.stateInstances
    );

    console.log('[DEBUG] NoCodeSolution created, stateInstances:', this.noCodeSolution.stateInstances.length);

    // Register the solution with the renderer manager
    this.noCodeStateRendererManager.addNoCodeSolution(this.noCodeSolution);

    // Reset zoom to default view
    this.resetZoom();
    this.changeDetectorRef.markForCheck();
  }

  /**
   * Handle solution selection change from the dropdown
   */
  onSolutionChange(solutionName: string): void {
    console.log('[DEBUG] onSolutionChange called with:', solutionName);
    if (solutionName !== this.selectedSolutionName) {
      this.solutionStateService.selectSolution(solutionName);
    }
  }

  /**
   * Reset to default mock solutions (clears localStorage cache)
   */
  resetToDefaults(): void {
    console.log('[DEBUG] resetToDefaults called');
    // Clear the current selection so it will reload even if same name
    this.selectedSolutionName = null;
    this.solutionStateService.resetToDefaults();
  }

  ngAfterViewInit(): void {
    // Initial size calculation after view is ready
    setTimeout(() => this.updateSvgSize(), 0);

    // Log state instance positions (only if noCodeSolution is initialized)
    if (this.noCodeSolution && this.noCodeSolution.stateInstances.length > 0) {
      this.noCodeSolution.stateInstances[0].stateLocationX = 0;
      this.noCodeSolution.stateInstances[0].stateLocationY = 0;
    }

    this.polariAccessNodeSubject.subscribe(stateInstance => {
      // Handle new state instance
    });

    this.changeDetectorRef.markForCheck();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.resizeSubject.next();
  }

  private onResize(): void {
    this.updateSvgSize();
  }

  private updateSvgSize(): void {
    const container = this.elementRef.nativeElement.querySelector('#d3-graph');
    if (container && this.d3GraphRenderingSVG) {
      const rect = container.getBoundingClientRect();
      // Maintain aspect ratio while fitting container
      const containerAspect = rect.width / rect.height;
      const viewBoxAspect = this.viewBoxWidth / this.viewBoxHeight;

      // Optionally adjust viewBox to match container aspect ratio
      // This keeps the logical coordinate space consistent
      // while the SVG scales to fill the container
    }
  }

  @HostListener('click', ['$event'])
  onClick(event: MouseEvent) {
    // Handle the click event here
    //console.log('Clicked on custom-no-code page');
    // Get the clicked element
    const clickedElement = event.target as HTMLElement;

    // Log the clicked element and its ancestors
    //console.log('Clicked Element:', clickedElement);
    //console.log("Classes of Element: ", clickedElement.classList);
    const ancestors: HTMLElement[] = [];

    let currentElement = clickedElement.parentElement;
    while (currentElement) {
      ancestors.push(currentElement);
      //console.log(currentElement.classList);
      currentElement = currentElement.parentElement;
    }
    //console.log('Ancestors:', ancestors);
  }

  private hasAncestorWithClass(element: HTMLElement, className: string): boolean {
    let currentElement = element.parentElement;
    while (currentElement) {
      if (currentElement.classList.contains(className)) {
        return true;
      }
      currentElement = currentElement.parentElement;
    }
    return false;
  }  

  private createSvg(): void {
    this.d3GraphRenderingSVG = d3.select('#d3-graph')
      .append('svg')
      .attr('viewBox', `0 0 ${this.viewBoxWidth} ${this.viewBoxHeight}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('stroke-width', 2)
      .style('width', '100%')
      .style('height', '100%');

    // Create a zoom container group - all content will be added to this
    this.zoomContainer = this.d3GraphRenderingSVG.append('g')
      .classed('zoom-container', true);

    // Set up zoom behavior
    this.zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([this.minZoom, this.maxZoom])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        this.onZoom(event);
      });

    // Apply zoom behavior to SVG
    this.d3GraphRenderingSVG.call(this.zoomBehavior);

    // Prevent double-click from zooming (can interfere with editing)
    this.d3GraphRenderingSVG.on('dblclick.zoom', null);
  }

  private onZoom(event: d3.D3ZoomEvent<SVGSVGElement, unknown>): void {
    if (this.zoomContainer) {
      this.zoomContainer.attr('transform', event.transform.toString());
      this.currentZoom = event.transform.k;
      this.zoomPercent = Math.round(this.currentZoom * 100);
      this.changeDetectorRef.detectChanges();
    }
  }

  zoomIn(): void {
    if (this.zoomBehavior && this.d3GraphRenderingSVG) {
      this.d3GraphRenderingSVG.transition()
        .duration(300)
        .call(this.zoomBehavior.scaleBy, 1.3);
    }
  }

  zoomOut(): void {
    if (this.zoomBehavior && this.d3GraphRenderingSVG) {
      this.d3GraphRenderingSVG.transition()
        .duration(300)
        .call(this.zoomBehavior.scaleBy, 0.7);
    }
  }

  resetZoom(): void {
    if (this.zoomBehavior && this.d3GraphRenderingSVG) {
      this.d3GraphRenderingSVG.transition()
        .duration(300)
        .call(this.zoomBehavior.transform, d3.zoomIdentity);
    }
  }

  private createRectangles()
  {
    const rectangles = d3.range(1).map(() => ({
      x: 20,
      y: 20,
      width: 400,
      height: 400,
      borderPixels: 15
    }));

    const rectSelection = this.d3GraphRenderingSVG.selectAll('rect')
    .data(rectangles)
    .enter()
    .append('rect')
    .attr('x', d => d.x)
    .attr('y', d => d.y)
    .attr('width', d => d.width)
    .attr('height', d => d.height)
    .attr('fill', (d, i) => d3.schemeCategory10[i % 10])
    .call(this.dragRectangle());
    //.each(d => this.overlayComponentService.addDynamicComponent(NoCodeStateInstanceComponent, d, d.borderPixels, this.hostViewContainerRef));
    
    //rectSelection
    
    
  }

  runSetup(selection)
  {
    selection.each((d, i, nodes) => {
      this.overlayComponentService.addDynamicComponent(NoCodeStateInstanceComponent, d, d.borderPixels, this.hostViewContainerRef);
    })

    this.dragRectangle()
  }

/*
  createGraph(): void {

    const d3GraphRenderingSVG = d3.select("#d3-graph")
      .append("svg")
      .attr("width", this.noCodeSolution.xBounds)
      .attr("height", this.noCodeSolution.yBounds);
      
    d3GraphRenderingSVG.append("use")
        .attr("href", "#pointer")
        .attr("x", 50)
        .attr("y", 50)
        .attr("fill", "#039BE5")
        .attr("stroke", "#039BE5")
        .attr("stroke-width", "1px");

    var dragHandler = d3.drag()
      .on("start", function(d, i, n){
        console.log("logging start conditions for drag");
        console.log("d3ElementNodes : ", n);
        console.log("draggedElementIndex : ", i);
        console.log("d3ElementNodes[draggedElementIndex] : ", n[i]);
      })
      .on("drag", (event) => {
          d3.select(event.sourceEvent.target)
              .attr("x", event.x)
              .attr("y", event.y);
      })
      .on("end", function(d, i, n) {
        console.log("logging end conditions for drag");
        console.log("d3ElementNodes : ", n);
        console.log("draggedElementIndex : ", i);
        console.log("d3ElementNodes[draggedElementIndex] : ", n[i]);
    });
    
    dragHandler(d3GraphRenderingSVG.selectAll("use"));

    let boxElement = null;
    let x = null;
    let y = null;
    let overlay = null;

    this.stateInstances.forEach((stateInstance: noCodeState) => {
      boxElement = d3GraphRenderingSVG.append("rect")
      .attr("x", stateInstance.stateLocationX)
      .attr("y", stateInstance.stateLocationY)
      .attr("width", stateInstance.stateComponentSizeX)
      .attr("height", stateInstance.stateComponentSizeY)
      .attr("fill", "lightblue")
      // Creates an onEvent functions that occurs for every pixel dragged after click and drag begins occurring.
      .call(d3.drag()
        .on("start", (event) => {
          console.log("Handling drag Start, start location : (", event.x, ", ", event.y, ")", " and stateInstance location : ", stateInstance.stateLocationX, ", ", stateInstance.stateComponentSizeY, ")");
          this.handleSingleStateObjectDragStart(stateInstance.id);
        })
        .on("drag", (event) => { // Takes the new x and y values sent by event after drag event occurs and assigns them.
          //console.log("Dragging event start, target : ", event.sourceEvent.target, " at location : (", event.x, ", ", event.y, ")");
          //let x = event.x;
          //let y = event.y;
          //Causes actual change of location of object when performing drag.
          //[x, y] = d3.pointer(event);
          // target variable is equivalent of normal d3 'this'.
          //const target = d3.event.sourceEvent.target;
          d3.select(d3.event.sourceEvent.target)
            .attr("x", event.x)
            .attr("y", event.y);
            
          //console.log("event.sourceEvent.target attributes changed, (", event.sourceEvent.target.x, ", ", event.sourceEvent.target.y, ")");
          // This is a single 'layer' of the overlay, where each 'state' object has a layer that binds a component to a box.
          /*
          let overlayStateSegment = document.getElementById(`overlay-${stateInstance.id}`);
          console.log("overlayStateSegment : ", overlayStateSegment);
          if (overlayStateSegment) {
            console.log("overlay style before change: (", overlayStateSegment.style.left, " , ", overlayStateSegment.style.right, ")");
            overlayStateSegment.style.left = `${x}px`;
            overlayStateSegment.style.top = `${y}px`;
          }
            
        })
        .on("end", (event) => { // Triggers whenever you stop dragging something.
          this.handleSingleStateObjectDragEnd(stateInstance, event);
        })
      );
    });
  }
*/



private createCircles(): void {
  const width = 600;
const height = 600;
const radius = 32;
  const circles = d3.range(20).map(() => ({
    // (height - radius * 2) + 32
    x: Math.random() * (600 - 32 * 2) + 32,
    y: Math.random() * (600 - 32 * 2) + 32,
  }));

  this.d3GraphRenderingSVG.selectAll('circle')
    .data(circles)
    .enter()
    .append('circle')
    .attr('cx', d => d.x)
    .attr('cy', d => d.y)
    .attr('r', 32)
    .attr('fill', (d, i) => d3.schemeCategory10[i % 10])
    .call(this.dragCircle());
}

private dragCircle(): any {
  const dragstarted = (event, d) => {
    d3.select(event.sourceEvent.target).raise().attr('stroke', 'black');
  };

  const dragged = (event, d) => {
    d3.select(event.sourceEvent.target).attr('cx', d.x = event.x).attr('cy', d.y = event.y);
  };

  const dragended = (event, d) => {
    d3.select(event.sourceEvent.target).attr('stroke', null);
  };

  return d3.drag()
    .on('start', dragstarted)
    .on('drag', dragged)
    .on('end', dragended);
}

private dragRectangle(): any {
  const dragstarted = (event, d) => {
    d3.select(event.sourceEvent.target).raise().attr('stroke', 'black');
  };

  const dragged = (event, d) => {
    d3.select(event.sourceEvent.target).attr('x', d.x = event.x).attr('y', d.y = event.y);
  };

  const dragended = (event, d) => {
    d3.select(event.sourceEvent.target).attr('stroke', null);
  };

  return d3.drag()
    .on('start', dragstarted)
    .on('drag', dragged)
    .on('end', dragended);
}

  // Handles hiding the overlay/UI when the drag starts, since the UI portion is not optimized to get dragged.
  // TODO? Find a way to transform the UI into an image quickly to imprint on the d3 object so it looks like
  // the UI is still there the whole time instead of being replaced by another object.
  handleSingleStateObjectDragStart(id: number){
    console.log("drag start");
    this.overlayStateSegments[id] = document.getElementById(`overlay-${id}`);
    if (this.overlayStateSegments[id]) { //For some reason typescript cannot detect that we are detecting if it is null or not, so have to use ts-ignore here.
      //@ts-ignore
      this.overlayStateSegments[id].style.display = 'none';
    }
    else{
      console.log("Failed to manipulate overlay in handleSingleStateObjectDragStart");
      //console.log("Somehow dragging a state object which does not have a corresponding element with element id 'overlay-${id}', the state Object id is : ", id);
    }
    console.log("completed drag start handler");
  }

  // Handles showing the overlay/UI when the drag ends, since the UI portion is not optimized to get dragged.
  // Also handles updating the StateObject with the new location it is at.
  handleSingleStateObjectDragEnd(stateInstance: NoCodeState, event){
    const overlayStateSegment = document.getElementById(`overlay-${stateInstance.id}`);
    if (overlayStateSegment) {
      overlayStateSegment.style.display = 'none';
    }
    else{
      console.log("Failed to manipulate overlay in handleSingleStateObjectDragEnd");
      //console.log("Somehow dragged a state object which does not have a corresponding element with element id 'overlay-${id}', the state Object id is : ", id);
    }
    console.log("completed drag end handler");
  }

  // Used to perform height, width, and location transforms on state objects UI overlays, based on d3 transforms of their
  // corresponding d3 object which the UI is overlayed on.
  updateSingleStateOverlayTransforms(id: number, x: number, y: number, width: number, height: number)
  {
    const overlayStateSegment = document.getElementById(`overlay-${id}`);
    if (overlayStateSegment) {
      this.renderer.setStyle(overlayStateSegment, 'left', `${x}px`);
      this.renderer.setStyle(overlayStateSegment, 'top', `${y}px`);
      this.renderer.setStyle(overlayStateSegment, 'width', `${width}px`);
      this.renderer.setStyle(overlayStateSegment, 'height', `${height}px`);
    }
  }

  // Ensures State Objects remain in the same location when re-sizing of the d3-graph/no-code-solution container is re-sized.
  /*
  setOverlaysFromMemory(): void {
    this.stateInstances.forEach((state) => {
      const stateOverlay = d3.select(`rect[x="${state.stateLocationX}"][y="${state.stateLocationY}"]`);
      const x = parseFloat(stateOverlay.attr('x'));
      const y = parseFloat(stateOverlay.attr('y'));
      const width = parseFloat(stateOverlay.attr('width'));
      const height = parseFloat(stateOverlay.attr('height'));
      //this.updateSingleStateOverlayTransforms(state.id, x, y, width, height);
    });
  }
    */

/*
  drawGraph() {
    // Prepare data for ngx-graph
    // Load all states and map them to nodes.
    let nodes = this.stateInstances.map(state => {
      console.log("Iterating state: ", state);
      return {
        //id: state.id.toString(), // Assuming you have a unique identifier for each state instance
        label: state.stateName, // Assuming you have a 'name' property in noCodeState to display as node label
        data: state, // Optionally, you can store the entire noCodeState instance in the 'data' property
        backgroundColor: '#DC143C'
      };

      }); 
      console.log("after nodes");
      let edges: { source: string; target: string; label: string; data: { linkText: string } }[] = [];
      
      this.stateInstances.forEach(state=>{
        state.slots?.forEach(slot=>{
          slot.connectors?.forEach(connector=>{
            edges.push({
              source: state.id.toString(),
              target: connector.sinkSlot.toString(),
              label: 'label',
              data: {
                linkText: 'link text'
              }
            });
          });
        });
      });
      
      console.log("after stateInstances");
      // Set ngx-graph options
      const graphOptions = {
        nodeWidth: 150, // Customize node width
        nodeHeight: 100, // Customize node height
        // Add any other options you want to configure for the graph visualization
      };

      // Here, you can define any logic to determine how the edges should be represented.
      // For example, you can have a 'connections' array in noCodeState to represent the connected states.
      //let edges = [];
      // Create the ngx-graph model
      let graphData = { nodes, edges };
      console.log("before draw");
      // Draw the graph using ngx-graph
      this.draw(graphData, graphOptions);
      console.log("after draw")
  }

  draw(data: any, options: any) {
    // Clear the container in case it already has content
    console.log("before clear")
    //this.graphContainerRef.clear();
    console.log("before factory")
    // Create the ngx-graph component and attach it to the container
    //const graphComponentFactory = this.componentFactoryResolver.resolveComponentFactory(GraphComponent);
    console.log("before ref")
    //const graphComponentRef = this.graphContainerRef.createComponent(graphComponentFactory);
    // Set the data input properties of the ngx-graph component
    //graphComponentRef.instance.nodes = data.nodes;
    //graphComponentRef.instance.links = data.edges;
    // You can access the nativeElement of graphContainerRef to get the DOM container for the graph
    const graphContainer = this.graphContainerRef.nativeElement;

    // Clear the container in case it already has content
    while (graphContainer.firstChild) {
      graphContainer.removeChild(graphContainer.firstChild);
    }

    // Create the ngx-graph component and attach it to the container
    const graphComponent = new GraphComponent();
    graphComponent.init(graphContainer, data, options);
    
  }
    */

  toggleMakeConnectionsMode() {
    this.makeConnectionsMode = !this.makeConnectionsMode;
  }

  handleNodeClick(node: any) {
    if (this.makeConnectionsMode) {
      if (!this.sourceNode) {
        // Store the source node for the connection
        this.sourceNode = node;
      } else {
        // Create a new connector (edge) between source and target nodes
        const newEdge = {
          source: this.sourceNode.id.toString(),
          target: node.id.toString(),
          label: 'label',
          data: {
            linkText: 'link text',
          },
        };
        //this.graphEdges.push(newEdge); // Update your data model
        //this.drawGraph(); // Update the graph visualization
        this.sourceNode = null; // Reset source node
      }
    }
  }


  // Updates the state object instance
  onStateInstanceDrop(event: any) {
    if (!this.noCodeSolution) return;

    // Get the position and dimensions of the dropped no-code-state-instance element
    const stateInstanceMovement = event.distance;

    //Get the state index.
    let stateIndex : number = event.source.data.index;
    let stateInstanceRef = this.noCodeSolution.stateInstances[stateIndex];
    let currentX = stateInstanceRef.stateLocationX;
    let currentY = stateInstanceRef.stateLocationY;

    // Calculate the new position of the state instance in respect to the mat-card element
    let newX = currentX + stateInstanceMovement.x;
    let newY = currentY + stateInstanceMovement.y;
    //Assign the new values so they propagate to child component
    this.noCodeSolution.stateInstances[stateIndex].stateLocationX = newX;
    this.noCodeSolution.stateInstances[stateIndex].stateLocationY = newY;
    // Do something when a state instance is moved, e.g. update its position in the stateInstances array
    // moveItemInArray(this.stateInstances, event.previousIndex, event.currentIndex);
}

  
  showContextMenu(event) {
        event.preventDefault();
        this.contextMenu = true;
        // position of the context menu is based on the event's x and y
  }

  hideContextMenu() {
    this.contextMenu = false;
  }

  onNewStateInstance() {
    if (!this.noCodeSolution) return;

    let newIndex: number = this.noCodeSolution.stateInstances.length;
    this.noCodeSolution.stateInstances.push(new NoCodeState());
    //this.drawGraph(); // Update the graph visualization
  }

  onNewConnectorInstance() {
    // Implement logic to create a new connector instance and update the graph
  }

  onDragStarted(event: CdkDragStart, stateInstance){
    console.log("Drag started");
    console.log(event);
    console.log(stateInstance);
  }

  onDragEnded(event: CdkDragEnd, stateInstance){
    console.log("Drag ended");
  }

}
