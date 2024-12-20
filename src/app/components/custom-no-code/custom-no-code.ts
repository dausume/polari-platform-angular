import { Component, Renderer2, EventEmitter, HostListener, ElementRef, ChangeDetectorRef, ViewChild, ComponentFactoryResolver, ViewContainerRef  } from '@angular/core';
import { FormControl } from '@angular/forms';
import { NoCodeState } from '@models/noCode/NoCodeState';
import { NoCodeSolution } from '@models/noCode/NoCodeSolution';
import { CdkDragDrop, moveItemInArray, CdkDragStart, CdkDragEnd } from '@angular/cdk/drag-drop';
import { BehaviorSubject, Observable, Subscription } from "rxjs";
import { OverlayComponentService } from '../../services/no-code-services/overlay-component-service';
import * as d3 from 'd3';
import { NoCodeStateInstanceComponent } from './no-code-state-instance/no-code-state-instance';

@Component({
  selector: 'custom-no-code',
  templateUrl: 'custom-no-code.html',
  styleUrls: ['./custom-no-code.css']
})
export class CustomNoCodeComponent {

  @ViewChild('graphContainer', { read: ViewContainerRef, static: false }) graphContainerRef!: ViewContainerRef;

  boxes: any[] = [
    { x: 100, y: 100, width: 100, height: 100, id: 1 },
    { x: 300, y: 200, width: 100, height: 100, id: 2 }
  ];

  //@ts-ignore
  @ViewChild('d3Graph', { static: true }) d3Graph: ElementRef;

  polariAccessNodeSubject = new BehaviorSubject<NoCodeState>(new NoCodeState());

  contextMenu: boolean = false;
  stateInstances = [new NoCodeState(), new NoCodeState()];
  noCodeSolution = new NoCodeSolution(800, 800, "testSolution",this.stateInstances, 0, 0, 0);
  // Used for binding the overlay which displays State Object UIs and their container elements to the d3 Objects.
  overlayStateSegments: { [key: number]: HTMLElement | null } = {};
  // Access xBounds and yBounds from noCodeSolution
  xBoundary: number = this.noCodeSolution.xBounds;
  yBoundary: number = this.noCodeSolution.yBounds;
  graphNodes: any[] = [];
  graphEdges: any[] = [];
  //toggles connections mode.
  makeConnectionsMode: boolean = false;
  //used when connecting two nodes in connections mode.
  sourceNode: any = null;
  svg: any;

  

  constructor(
    private elementRef: ElementRef, 
    private changeDetectorRef: ChangeDetectorRef, 
    private renderer: Renderer2, 
    private overlayComponentService: OverlayComponentService,
    private hostViewContainerRef: ViewContainerRef
    ) 
    {
    
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

  ngOnInit()
  {
    //this.createGraph();
    // Creates the 'svg' which is an svg that has other svg's allocated to it to act as the d3 graph.
    // Initialization of the d3-graph tag.
    this.createSvg();
    this.createRectangles()
    //this.createCircles();
  }

  private createSvg(): void {
    this.svg = d3.select('#d3-graph')
      .append('svg')
      .attr('viewBox', `0 0 ${this.noCodeSolution.xBounds} ${this.noCodeSolution.yBounds}`)
      .attr('stroke-width', 2);
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

    const rectSelection = this.svg.selectAll('rect')
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

    const svg = d3.select("#d3-graph")
      .append("svg")
      .attr("width", this.noCodeSolution.xBounds)
      .attr("height", this.noCodeSolution.yBounds);
      
    svg.append("use")
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
    
    dragHandler(svg.selectAll("use"));

    let boxElement = null;
    let x = null;
    let y = null;
    let overlay = null;

    this.stateInstances.forEach((stateInstance: noCodeState) => {
      boxElement = svg.append("rect")
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

  this.svg.selectAll('circle')
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
      /*
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
      */
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

      // Assign the generated nodes and edges to the class properties
      this.graphNodes = nodes;
      this.graphEdges = edges;
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
    /*
    // You can access the nativeElement of graphContainerRef to get the DOM container for the graph
    const graphContainer = this.graphContainerRef.nativeElement;

    // Clear the container in case it already has content
    while (graphContainer.firstChild) {
      graphContainer.removeChild(graphContainer.firstChild);
    }

    // Create the ngx-graph component and attach it to the container
    const graphComponent = new GraphComponent();
    graphComponent.init(graphContainer, data, options);
    */
  }

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
        this.graphEdges.push(newEdge); // Update your data model
        this.drawGraph(); // Update the graph visualization
        this.sourceNode = null; // Reset source node
      }
    }
  }

  ngAfterViewInit() {
    console.log("before drawgraph ngAfterViewInit")
    //this.drawGraph();
    //Old code below
    console.log("After view init")
    // Log a message when a new state instance is created
    this.polariAccessNodeSubject.subscribe(stateInstance => {
      console.log("Creating new state instance:", stateInstance);
    });
    /*
    let siContainerElement = this.elementRef.nativeElement.querySelector('.state-instances-container');
    let siRect = siContainerElement.getBoundingClientRect();
    console.log("siRect",siRect);
    */
    this.noCodeSolution.stateInstances[0].stateLocationX = 0;
    this.noCodeSolution.stateInstances[0].stateLocationY = 0;
    console.log(this.noCodeSolution.stateInstances[0]);
    /*
    //Use this to load an existing solution
    // Get the child component that corresponds to the event
    const childComponent = event.source.data.componentRef;

    // Set the styles of the child component's HTMLElement
    const stateInstanceElement = childComponent.location.nativeElement;
    this.renderer.setStyle(stateInstanceElement, 'left', `${newPosition.x}px`);
    this.renderer.setStyle(stateInstanceElement, 'top', `${newPosition.y}px`);
    */
    this.changeDetectorRef.markForCheck();
    console.log("After view init end");
  }

  // Updates the state object instance
  onStateInstanceDrop(event: any) {
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
    let newIndex: number = this.noCodeSolution.stateInstances.length;
    this.noCodeSolution.stateInstances.push(new NoCodeState());
    this.drawGraph(); // Update the graph visualization
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
