import { Component, EventEmitter, HostListener, ElementRef, ChangeDetectorRef, ViewChild, ComponentFactoryResolver, ViewContainerRef  } from '@angular/core';
import { FormControl } from '@angular/forms';
import { noCodeState } from '@models/noCodeState';
import { noCodeSolution } from '@models/noCodeSolution';
import { CdkDragDrop, moveItemInArray, CdkDragStart, CdkDragEnd } from '@angular/cdk/drag-drop';
import { BehaviorSubject, Observable, Subscription } from "rxjs";
import * as d3 from 'd3';
import { GraphComponent } from '@swimlane/ngx-graph'; // Import the ngx-graph component

@Component({
  selector: 'custom-no-code',
  templateUrl: 'custom-no-code.html',
  styleUrls: ['./custom-no-code.css']
})
export class CustomNoCodeComponent {

  @ViewChild('graphContainer', { read: ViewContainerRef, static: false }) graphContainerRef!: ViewContainerRef;

  polariAccessNodeSubject = new BehaviorSubject<noCodeState>({id:0}) ;

  contextMenu: boolean = false;
  stateInstances = [new noCodeState(0,0,"circle",0,"Test State","Test Class",100,100,5,5,[])]
  noCodeSolution = new noCodeSolution(800, 800, "testSolution",this.stateInstances, 0, 0, 0);
  // Access xBounds and yBounds from noCodeSolution
  xBoundary: number = this.noCodeSolution.xBounds;
  yBoundary: number = this.noCodeSolution.yBounds;
  graphNodes: any[] = [];
  graphEdges: any[] = [];
  //toggles connections mode.
  makeConnectionsMode: boolean = false;
  //used when connecting two nodes in connections mode.
  sourceNode: any = null;

  constructor(private elementRef: ElementRef, private changeDetectorRef: ChangeDetectorRef, private componentFactoryResolver: ComponentFactoryResolver) {
    
  }

  @HostListener('click', ['$event'])
  onClick(event: MouseEvent) {
    // Handle the click event here
    console.log('Clicked on custom-no-code page');
    // Get the clicked element
    const clickedElement = event.target as HTMLElement;

    // Log the clicked element and its ancestors
    console.log('Clicked Element:', clickedElement);
    console.log("Classes of Element: ", clickedElement.classList);
    const ancestors: HTMLElement[] = [];

    let currentElement = clickedElement.parentElement;
    while (currentElement) {
      ancestors.push(currentElement);
      console.log(currentElement.classList);
      currentElement = currentElement.parentElement;
    }
    console.log('Ancestors:', ancestors);
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
    console.log("In custom no code ngOnInit");
  }

  drawGraph() {
    // Prepare data for ngx-graph
    // Load all states and map them to nodes.
    let nodes = this.stateInstances.map(state => {
      console.log("Iterating state: ", state);
      return {
        id: state.id.toString(), // Assuming you have a unique identifier for each state instance
        label: state.stateName, // Assuming you have a 'name' property in noCodeState to display as node label
        data: state, // Optionally, you can store the entire noCodeState instance in the 'data' property
        backgroundColor: '#DC143C'
      };

      }); 
      console.log("after nodes");
      let edges: { source: string; target: string; label: string; data: { linkText: string } }[] = [];
      this.stateInstances.forEach(state=>{
        state.outputSlots?.forEach(slot=>{
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
          /*
          
          */
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
    this.graphContainerRef.clear();
    console.log("before factory")
    // Create the ngx-graph component and attach it to the container
    const graphComponentFactory = this.componentFactoryResolver.resolveComponentFactory(GraphComponent);
    console.log("before ref")
    const graphComponentRef = this.graphContainerRef.createComponent(graphComponentFactory);
    // Set the data input properties of the ngx-graph component
    graphComponentRef.instance.nodes = data.nodes;
    graphComponentRef.instance.links = data.edges;
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
    this.drawGraph();
    //Old code below
    console.log("After view init")
    // Log a message when a new state instance is created
    this.polariAccessNodeSubject.subscribe(stateInstance => {
      console.log("Creating new state instance:", stateInstance);
    });
    let siContainerElement = this.elementRef.nativeElement.querySelector('.state-instances-container');
    let siRect = siContainerElement.getBoundingClientRect();
    console.log("siRect",siRect);
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
    this.noCodeSolution.stateInstances.push(new noCodeState(newIndex,this.noCodeSolution.id));
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
