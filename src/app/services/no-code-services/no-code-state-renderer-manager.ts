// Author: Dustin Etts
// ./src/services/no-code-services/no-code-state-renderer-manager.ts
import { Injectable, ApplicationRef, Injector, ViewContainerRef, Type } from '@angular/core';
import { BehaviorSubject, Subscription } from 'rxjs';
// Import all default D3ModelLayer objects that are used to render the No-Code State objects.
import { D3ModelLayer } from '@models/noCode/d3-extensions/D3ModelLayer';
import { CircleStateLayer } from '@models/noCode/d3-extensions/CircleStateLayer';
// Import the NoCodeState object which is used to define the state of the No-Code Solution.
import { NoCodeState } from '@models/noCode/NoCodeState';
import { NoCodeSolution } from '@models/noCode/NoCodeSolution';
import { NoCodeSolutionStateService } from './no-code-solution-state.service';
//
import * as d3 from 'd3';

// A Service used to manage multiple D3ModelLayer objects in respect to a single d3 Graph, which are used to render the 
// No-Code State objects
//
// This service centralizes the management of multiple other services which are used to render the No-Code State objects
// in the No-Code Solution Editor or the No-Code State Editor.
//
// It uses the NoCodeStateSvgService to ensure that all SVG elements are rendered correctly in accordance to the correct
// instance of the No-Code State object.  While also using it as a provider for the selection options for the No-Code State
// svg elements.  It should seperate out the different key types of D3ModelLayer objects that are used to render the No-Code
// and each svg element should have a corresponding D3ModelLayer object which is used to render the svg element, to ensure
// that the svg uses the correct logic to use it as a base for a No-Code State UI with interconnections that look correct.
//
// The OverlayComponentService is used to overlay components on top of the No-Code State objects, which are used to display
// the UI for the No-Code State objects.
//
@Injectable({
  providedIn: 'root',
}) // App level service for managing the rendering of No-Code State Objects.
export class NoCodeStateRendererManager {
  constructor(
    private appRef: ApplicationRef,
    private injector: Injector,
    private solutionStateService: NoCodeSolutionStateService
  )
  {
    //this.defineDefaultLayers();
  }

  /**
   * Get the solution state service for persisting changes
   */
  getSolutionStateService(): NoCodeSolutionStateService {
    return this.solutionStateService;
  }

  // Observable is used to store all service-level state information for the No-Code State Renderer Manager
  // so that it can be used across the entire application.
  //
  // Define a dictionary that maps shape type names to the corresponding D3ModelLayer object name that is used to render it.
  // We use this pattern to ensure that we can generate an appropriate D3ModelLayer object for each child No-Code-Solution.
  stateShapeTypeToD3ModelLayerTypeMap: Map<string, Type<D3ModelLayer>> = new Map();

  // Defines all of the d3 graphs we are rendering State objects on.
  // This is so we can manage the rendering of the No-Code State objects across multiple d3 graphs.
  // This should map and trace instances of d3 graphs, each d3 graph should have a single corresponding
  // No-Code Solution object.
  // In the case where we are implementing a No-Code State Editor, we should simply restrict the number of
  // allowed state objects to being only one.
  //
  // This should be a map of types of d3 graph managing services to instances of those services.
  // Note : No-Code State Editors are also considered NoCodeSolution objects!
  // Map<'noCodeSolutionName', NoCodeSolutionInstance>
  private NoCodeSolutionsMap: Map<string, NoCodeSolution> = new Map<string, NoCodeSolution>();
  // When a NoCodeSolution is set on the NoCodeSolutionsMap, we should access that noCodeSolution and set our 
  // currently set d3svgBaseLayer to the d3svgBaseLayer of the NoCodeSolution

  // The No Code Solution we are doing active processing for rendering currently, we assume rendring only one layer at a time for now.
  private renderingNoCodeSolution: BehaviorSubject<NoCodeSolution|undefined> = new BehaviorSubject<NoCodeSolution|undefined>(undefined);

  // The active D3 SVG Layer that is being used to render the No-Code State objects.
  private d3svgBaseLayerBehaviorSubject: BehaviorSubject<d3.Selection<SVGSVGElement, unknown, null, undefined>|undefined> = new BehaviorSubject<d3.Selection<SVGSVGElement, unknown, null, undefined> | undefined>(undefined);

  setD3SvgBaseLayer(d3SvgLayer: any) {
    console.log("Step 2 - Set the d3 svg base layer in the renderer manager : ", d3SvgLayer);
    console.log("Setting D3 SVG Layer : ", d3SvgLayer);
    // Define layer types BEFORE notifying subscribers, so they can look up types
    this.defineDefaultLayerTypes();
    // Now notify subscribers - they can now access the layer type map
    this.d3svgBaseLayerBehaviorSubject.next(d3SvgLayer);
    console.log("Setting D3 SVG Layer complete");
  }

  getD3SvgBaseLayer(): d3.Selection<SVGSVGElement, unknown, null, undefined> | undefined {
    return this.d3svgBaseLayerBehaviorSubject.value;
  }

   /**
   * Allows external components to subscribe to changes in the d3SvgBaseLayer.
   * @param callback - The function to execute when the value of d3SvgBaseLayer changes.
   * @returns A Subscription object to allow unsubscribing when necessary.
   */
   subscribeToD3SvgBaseLayer(callback: (baseLayer: d3.Selection<SVGSVGElement, unknown, null, undefined> | undefined) => void): Subscription {
    console.log("Current D3 SVG Base Layer : ", this.d3svgBaseLayerBehaviorSubject);
    return this.d3svgBaseLayerBehaviorSubject.subscribe(callback);
  }

  // Define the default D3ModelLayer objects that are used to render the No-Code State objects,
  // these are used to allow the No-Code-Solutionsto fetch different D3ModelLayer definitions to
  // match to different shape types so a No-Code-Solution can render its own Layers.
  defineDefaultLayerTypes()
  {
    console.log("Step 3 - Define Default Layer Types");
    // Define the default D3ModelLayer object for rendering circles.
    this.stateShapeTypeToD3ModelLayerTypeMap.set(
      "circle", 
      CircleStateLayer
    )
  }

  /**
   * Adds a No-Code-Solution to the State Renderer Manager.
   * @param newNoCodeSolution - The NoCodeSolution object to be rendered by the renderer.
   */
  addNoCodeSolution(newNoCodeSolution: NoCodeSolution)
  {
    this.NoCodeSolutionsMap.set(newNoCodeSolution.solutionName, newNoCodeSolution);
    console.log("Step 5 : No-Code Solution Added on Renderer Manager : ", newNoCodeSolution);
  }

  /**
   * Used to map a D3ModelLayer object to a specific shape type, so that we can render the No-Code State object
   * This should be a template for creating a extended D3ModelLayer object instance, not an actual instance of D3ModelLayer.
   * 
   * Registers a D3ModelLayer type with a specific shape type.
   * @param shapeType - The shape type (e.g., 'circle', 'rectangle').
   * @param d3ModelLayerClass - The class reference for the D3ModelLayer handling this shape type.
   */
  defineStateShapeTypeWithLayer(shapeType: string, d3ModelLayerType: Type<D3ModelLayer>) 
  {
    // Add the shape type and D3ModelLayer object to the stateShapeTypeToD3ModelLayerMap
    this.stateShapeTypeToD3ModelLayerTypeMap.set(shapeType, d3ModelLayerType);
  }

  

  /**
   * Removes a No-Code-Solution from the State Renderer Manager.
   * @param solutionName - The name of the No-Code Solution.
   */
  removeNoCodeSolution(solutionName: string): void {
    this.getNoCodeSolution(solutionName)?.d3SvgBaseLayer.remove();
    // Remove the D3 graph manager from the map.
    this.NoCodeSolutionsMap.delete(solutionName);
  }

  /**
   * Gets a No-Code-Solution from the State Renderer Manager.
   * @param solutionName - The name of the No-Code Solution.
   */
  getNoCodeSolution(solutionName: string): NoCodeSolution | undefined {
    return this.NoCodeSolutionsMap.get(solutionName);
  }

  /**
   * Set the active No-Code-Solution to be rendered by the State Renderer Manager.
   */
  setRenderingNoCodeSolution(noCodeSolution: NoCodeSolution) {
    this.renderingNoCodeSolution.next(noCodeSolution);
  }

  /**
   * Get the active No-Code-Solution to be rendered by the State Renderer Manager.
   */
  getRenderingNoCodeSolution(): NoCodeSolution | undefined {
    return this.renderingNoCodeSolution.value;
  }

  /**
   * Iterate and render all No-Code-Solutions in the State Renderer Manager.
   */
  renderAllNoCodeSolutions() {
    this.NoCodeSolutionsMap.forEach((noCodeSolution, noCodeSolutionName) => {
      console.log("Rendering No-Code Solution : ", noCodeSolution);
      noCodeSolution.renderSolution();
    });
  }

  /**
   * Clear all No-Code-Solutions from the State Renderer Manager.
   * Used when switching between solutions to ensure clean state.
   */
  clearSolutions(): void {
    // Destroy each solution to clean up subscriptions
    this.NoCodeSolutionsMap.forEach((solution) => {
      solution.destroy();
    });
    this.NoCodeSolutionsMap.clear();
    this.renderingNoCodeSolution.next(undefined);
  }

}