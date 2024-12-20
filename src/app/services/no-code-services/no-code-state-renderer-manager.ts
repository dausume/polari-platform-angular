// ./src/services/no-code-services/no-code-state-renderer-manager.ts
import { Injectable, ApplicationRef, Injector, ViewContainerRef, Type } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
// Import all default D3ModelLayer objects that are used to render the No-Code State objects.
import { D3ModelLayer } from '@models/noCode/d3-extensions/D3ModelLayer';
import { CircleStateLayer } from '@models/noCode/d3-extensions/CircleStateLayer';
// Import the NoCodeState object which is used to define the state of the No-Code Solution.
import { NoCodeState } from '@models/noCode/NoCodeState';
import { NoCodeSolution } from '@models/noCode/NoCodeSolution';

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
    private injector: Injector
  ) {}

  // Observable is used to store all service-level state information for the No-Code State Renderer Manager
  // so that it can be used across the entire application.
  //
  // Define a dictionary that maps shape type names to the corresponding D3ModelLayer object name that is used to render it.
  // We use this pattern to ensure that later we can add more shape types and D3ModelLayer objects to the application.
  private stateShapeTypeToD3ModelLayerMap: Map<string, Type<D3ModelLayer>> = new Map();

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
  NoCodeSolutionsMap: Map<string, NoCodeSolution> = new Map<string, NoCodeSolution>();

  activeNoCodeSolution: BehaviorSubject<NoCodeSolution> = new BehaviorSubject<NoCodeSolution>(new NoCodeSolution());

  // Define the default D3ModelLayer objects that are used to render the No-Code State objects,
  // by calling defineStateShapeTypeWithLayer for each shape type that is supported.


  /**
   * Used to map a D3ModelLayer object to a specific shape type, so that we can render the No-Code State object
   * This should be a template for creating a extended D3ModelLayer object instance, not an actual instance of D3ModelLayer.
   * 
   * Registers a D3ModelLayer type with a specific shape type.
   * @param shapeType - The shape type (e.g., 'circle', 'rectangle').
   * @param d3ModelLayerClass - The class reference for the D3ModelLayer handling this shape type.
   */
  defineStateShapeTypeWithLayer(shapeType: string, d3ModelLayer: Type<D3ModelLayer>) 
  {
    // Add the shape type and D3ModelLayer object to the stateShapeTypeToD3ModelLayerMap
    this.stateShapeTypeToD3ModelLayerMap.set(shapeType, d3ModelLayer);
  }

  // Set the current D3ModelLayer object to be used actively in running a rendering process of the No-Code State objects.
  // This is used to ensure we are carefully managing the rendering of the No-Code State objects, whether we are choosing
  // to render one layer at a time, or multiple layers in parallel.
  setCurrentlyRenderingD3ModelLayer(d3ModelLayer: any) {
    console.log("Inside Set Current D3 Model Layer");
    console.log("D3 Model Layer : ", d3ModelLayer);
  }

  // Load a new No-Code State object into the No-Code State Editor.  Detecting what kind of D3ModelLayer object
  // it should be assigned to, then creating or getting the D3ModelLayer object, and allocating the No-Code State
  // object to the D3ModelLayer object.
  loadNewNoCodeState(newState: NoCodeState, noCodeSolution: NoCodeSolution) {
    console.log("Inside Load New No-Code State");
    console.log("No-Code State : ", newState);
    // Confirm the No-Code State shape type is valid and supported with a corresponding D3ModelLayer object
    // that can handle the logic for rendering the No-Code State object.
    // If the shape type is not supported, then we should throw an error.
    // Validate the shape type
    const d3ModelLayerClass = this.stateShapeTypeToD3ModelLayerMap.get(newState.shapeType || '');
    if (!d3ModelLayerClass) {
      throw new Error(`Shape type '${newState.shapeType}' is not supported.`);
    }
    // Check if the D3ModelLayer exists within the No-Code Solution object.

    // If the D3ModelLayer does not exist, create a new instance of the D3ModelLayer object.
    const d3ModelLayerInstance = new d3ModelLayerClass(); // Create a default instance of the determined D3ModelLayer object type.
    // Add the New Layer to the No-Code Solution object.

    // Load the No-Code State object into the D3ModelLayer object.
  }

  /**
   * Adds a new Layer to the Active No-Code Solution object.
   * @param shapeType - The name of the shape type (e.g., 'circle', 'rectangle').
   * @param newLayer - The instance of the D3ModelLayer object.
   */
  addLayerToActiveNoCodeSolution(shapeType:string, newLayer: D3ModelLayer): void {
    // first retrieve the active No-Code Solution object
    const activeNoCodeSolution = this.activeNoCodeSolution.getValue();
    // Add the new layer to the Active No-Code Solution object.
    activeNoCodeSolution.renderLayers.set(shapeType, newLayer);
    // Notify subscribers.
    this.activeNoCodeSolution.next(activeNoCodeSolution); 
  }

  /**
   * Removes a D3 graph manager from the map.
   * @param solutionName - The name of the No-Code Solution.
   */
  removeNoCodeSolution(solutionName: string): void {
    // Remove the D3 graph manager from the map.
    this.NoCodeSolutionsMap.delete(solutionName);
  }
}