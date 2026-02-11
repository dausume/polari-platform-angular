import { Component, Renderer2, EventEmitter, HostListener, ElementRef, ChangeDetectorRef, ViewChild, ComponentFactoryResolver, ViewContainerRef  } from '@angular/core';
import { FormControl } from '@angular/forms';
import { NoCodeState } from '@models/noCode/NoCodeState';
import { NoCodeSolution } from '@models/noCode/NoCodeSolution';
import { CdkDragDrop, moveItemInArray, CdkDragStart, CdkDragEnd } from '@angular/cdk/drag-drop';
import { BehaviorSubject, Observable, Subscription } from "rxjs";
import { OverlayComponentService } from '@services/no-code-services/overlay-component-service';
import { OnInit, AfterViewInit } from '@angular/core';
import { Slot } from '@models/noCode/Slot';
import { Connector } from '@models/noCode/Connector';
import * as d3 from 'd3';


// The State Manager Component is used to edit a single state object, it may be used to create a 
// template State Object that can be used across different no-code solutions.  Or it may be used to
// edit a specific instance of a state object that is used in a specific no-code solution.
@Component({
  standalone: false,
  selector: 'state-manager.',
  templateUrl: 'state-manager.html',
  styleUrls: ['./state-manager.css']
})
export class StateManagerComponent implements OnInit, AfterViewInit 
{

  @ViewChild('graphContainer', { read: ViewContainerRef, static: false }) graphContainerRef!: ViewContainerRef;

  //@ts-ignore
  @ViewChild('d3Graph', { static: true }) d3Graph: ElementRef;

  // We make a default NoCodeState object to be displayed in the state object editor.
  displayedStateObject = new BehaviorSubject<NoCodeState>(
    new NoCodeState(
      "Test State 2",
      "circle",
      "Test Class"
    )
  ); // The state object that is currently being displayed/edited in the state object editor.

  // The base svg being used to render the d3 graph used for displaying the no-code state being edited
  // in this state object editor.
  svgPlot: any;
  // Used for binding the overlay which displays State Object UIs and their container elements to the d3 Objects.
  overlayStateComponent: HTMLElement | null = null;
  // The shape type of the state object being edited in the state object editor.
  shapeType: string = "circle";
  // The class of the state object being edited in the state object editor.
  class: string = "Test Class";
  // The name of the state object being edited in the state object editor.
  name: string = "Test State 2";
  // The width in pixels of the state object being edited in the state object editor, null if the shape is a circle.
  width: number | null = 100;
  // The height in pixels of the state object being edited in the state object editor, null if the shape is a circle.
  height: number | null = 100;
  // The radius in pixels of the state object being edited in the state object editor.
  radius: number | null = 5;
  // Defines the slot objects to be rendered on the state object being edited in the state object editor.
  slots: Slot[] = [];
  // Defines the connections originating from the state object being edited in the state object editor.
  // In the state editor we define test input and output slots to use for testing what the connections
  // will look like in the final product.
  connections: Connector[] = [];

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
    console.log("Clicked on state-manager page");
  }

  ngOnInit()
  {
    // Creates the 'svg' which is an svg that has other svg's allocated to it to act as the d3 graph.
    // Initialization of the d3-graph tag.
    this.createSvgPlot();
  }

  private createSvgPlot(): void {
    console.log("Inside createSvg")
    this.svgPlot = d3.select('#d3-graph')
      .append('svg')
      .attr('viewBox', `0 0 1000 1000`)
      .attr('stroke-width', 2);
  }

  // Use the service for managing rendering state objects via D3ModelLayer objects.
  private renderStateObject(): void {

  }

  ngAfterViewInit() {
    console.log("before drawgraph ngAfterViewInit")
    //this.drawGraph();
    //Old code below
    console.log("After view init")
    this.changeDetectorRef.markForCheck();
    console.log("After view init end");
  }

}