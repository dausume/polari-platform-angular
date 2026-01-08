// Author: Dustin Etts
// polari-platform-angular/src/app/models/noCode/noCodeSolution.ts
import { NoCodeState } from "./NoCodeState";
import { D3ModelLayer } from "./d3-extensions/D3ModelLayer";
import { Type } from '@angular/core';
import { Slot } from "./Slot";
import { NoCodeStateRendererManager } from '@services/no-code-services/no-code-state-renderer-manager';
import * as d3 from 'd3';
import { Subscription } from "rxjs";
import { InteractionStateService } from "@services/no-code-services/interaction-state-service";

// If we can it would be ideal to be able to get view dimensions relevant to the component and always use them
// to calculate the position of the overlay component. This would allow us to avoid having to pass in the
// borderPixels value, which is used to adjust the position of the overlay component to be inside the bounds
// of the component it is overlaying.
export class NoCodeSolution {
    //
    solutionName: string;
    //
    id?: number;
    // A list of No-Code State objects which are used to define the state of the No-Code Solution.
    stateInstances: NoCodeState[];
    // A map of D3ModelLayer objects used to render the No-Code State objects for this No-Code Solution.
    renderLayers: Map<string, D3ModelLayer> = new Map<string, D3ModelLayer>();
    
    xBounds: number = 300;
    yBounds: number = 800;

    baseLayerSubscription: Subscription | undefined;
    d3SvgBaseLayer!: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    solutionLayer!: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    solutionConnectorLayer!: d3.Selection<SVGSVGElement, unknown, null, undefined>;

    initialStateInstance?: NoCodeState; // Always index 0
    endStateInstance?: NoCodeState; // Always the final index in the NoCodeSolution.

    //Defines a configuration object used for configuring variable information for a new class, or modifying/duplicating an existing class.
    constructor(
        private rendererManager: NoCodeStateRendererManager, // Inject rendererManager
        private interactionService: InteractionStateService, // Inject interaction service
        xBounds = 300, yBounds = 800, 
        solutionName: string, stateInstances: NoCodeState[]=[], 
        id?: number)
    {
        this.xBounds = xBounds;
        this.yBounds = yBounds;
        this.solutionName = solutionName;
        this.stateInstances = stateInstances;
        this.id = id;
        // Subscribe to the BehaviorSubject for the d3SvgBaseLayer in the renderer manager
        // this should be done before state instances are loaded so they can be tied to the base layer.
        this.subscribeToBaseLayer();
        // If no states are provided, generate initial states
        this.stateInstances = stateInstances.length ? stateInstances : this.generateInitialStates();
        // Load the State Insttances into appropriate No-Code State Layers
        this.loadAllNoCodeStates();
        this.createSolutionLayer();

    }

    private getSolutionLayer(): d3.Selection<SVGGElement, unknown, null, undefined> {
        if(!this.d3SvgBaseLayer)
        {
            return this.d3SvgBaseLayer.select(`g.solution-layer-${this.solutionName}`);
        }
    }

    // Create the `g.solution-layer-${this.noCodeSolution?.solutionName}` svg layer
    // and add it to the base layer.
    private createSolutionLayer(): void {
        // Create the solution layer
        if(this.d3SvgBaseLayer)
        {
            this.d3SvgBaseLayer.append('g')
                .attr('class', `g.solution-layer-${this.solutionName}`)
        }
    }

    // Used to generate the initial states for the No-Code Solution, this is used to give a baseline
    // for a user to begin designing their No-Code Solution.  Provides a basic structure for the No-Code Solution
    // with an initial state for solution input, intermediate state (which is where the bulk of logic occurs), 
    // and final state for solution output.
    private generateInitialStates()
    {
        return [
            new NoCodeState( // The Initial State of the No-Code Solution, for overall solution inputs.
            "initial-state", // No-Code-State Name
            "circle", // Shape Type - Used to determine code used for d3 behavior of UI interconnection patterns.
            "Polari Wrapped Python Class",  // Used to determine the python backend class wrapped by Polari that this state instance of it corresponds with.
            0, // Index for what order this No Code State should be rendered in respect to the No-Code-State rendering
            null, null, // Svg size (x, y) - for rectangular shapes -> null / autocalculated for circle type shapes.
            100, // Radius of the circle svg used to render the sample No Code State -> null for rectangular shapes.
            this.solutionName, // No Code Solution Id
            'initial-state-layer', // The name of the layer this No-Code-State has been allocated to.
            0, 0, // Position (x,y) of the No-Code-State on the D3 SVG
            "state-id-0", // Id of the d3 layer object being used to render this No-Code-State
            'circle',
            [
                new Slot( // Slot connecting the initial state to the first state as an output slot.
                    0, // Index of the slot in it's given no-code-state
                    "initial-state", // No-Code-State name, is undefined until it is saved to the backend
                    0,
                    [], // Empty array since we have not implemented connectors.
                    false,
                    false
                )
            ] // Slots being used for input and output to this No-Code-State.
          ),
          new NoCodeState( // 
            "state-001", // No-Code-State Name
            "circle", // Shape
            "Polari Wrapped Python Class",  // Class Used as template for the State
            1, // Index for what order this No Code State should be rendered in respect to the No-Code-State rendering
            null, null, // Svg size (x, y) - for rectangular shapes -> null / autocalculated for circle type shapes.
            100, // Radius of the circle svg used to render the sample No Code State
            this.solutionName, // No Code Solution Id
            'circle-state-layer', // The name of the layer this No-Code-State has been allocated to.
            100, 100, // Position (x,y) of the No-Code-State on the D3 SVG
            "state-id-1", // Id of the d3 layer object being used to render this No-Code-State
            'circle',
            [
                new Slot( // Slot connecting to the initial state as an input slot
                    0, // Index of the slot in it's given no-code-state
                    'state-001', // No-Code-State Id, is undefined until it is saved to the backend
                    0, // An angular value between 0 and 360 degrees
                    [], // Empty array since we have not implemented connectors.
                    false, // Allow one to many connections
                    false // Allow many to one connections
                ),
                new Slot( // Slot connecting this intermediate state to the end-state as an output slot.
                    1, // Index of the slot in it's given no-code-state
                    'state-001', // No-Code-State Id, is undefined until it is saved to the backend
                    180, // An angular value between 0 and 360 degrees
                    [], // Empty array since we have not implemented connectors.
                    false,
                    false
                )
            ] // Slots being used for input and output to this No-Code-State.
          ),
          new NoCodeState( // The End State of the No-Code Solution, for overall solution outputs.
            "final-state", // No-Code-State Name
            "circle", // Shape
            "Polari Wrapped Python Class",  // Class Used as template for the State
            2, // Index for what order this No Code State should be rendered in respect to the No-Code-State rendering
            null, null, // Svg size (x, y) - for rectangular shapes -> null / autocalculated for circle type shapes.
            100, // Radius of the circle svg used to render the sample No Code State
            this.solutionName, // No Code Solution Id
            'final-state-layer', // The name of the layer this No-Code-State has been allocated to.
            200, 200, // Position (x,y) of the No-Code-State on the D3 SVG
            "state-id-2", // Id of the d3 layer object being used to render this No-Code-State
            'circle',
            [
                new Slot( // Slot connecting to the initial state as an input slot
                    0, // Index of the slot in it's given no-code-state
                    "final-state", // No-Code-State Id, is undefined until it is saved to the backend
                    0, // An angular value between 0 and 360 degrees where it is located on the circle path.
                    [], // Empty array since we have not implemented connectors.
                    false, // Is an input
                    false, // Allow one to many connections
                    false // Allow many to one connections
                ),
            ] // Slots being used for input and output to this No-Code-State.
          ),
        ]
    }

    private subscribeToBaseLayer(): void {
        this.baseLayerSubscription = this.rendererManager.subscribeToD3SvgBaseLayer((baseLayer:d3.Selection<SVGSVGElement, unknown, null, undefined> | undefined) => {
            if (baseLayer) {
                console.log("Subscription triggered to update D3 Svg Base Layer on NoCodeSolution");
                this.setD3SvgBaseLayer(baseLayer);
                console.log("D3 Svg Base Layer updated on NoCodeSolution:", this.d3SvgBaseLayer);
            }
        });
    }

    setD3SvgBaseLayer(d3SvgBaseLayer: d3.Selection<SVGSVGElement, unknown, null, undefined>)
    {
        console.log("Setting D3 Svg Base Layer on No-Code Solution");
        this.d3SvgBaseLayer = d3SvgBaseLayer;
        console.log("Update D3 Svg Base Layer on NoCodeSolution : ", this.d3SvgBaseLayer);
    }

    setRendererManager(rendererManager: NoCodeStateRendererManager) {
        this.d3SvgBaseLayer = rendererManager.getD3SvgBaseLayer();
        console.log("No-Code Solution Synced with Renderer Manager Base Layer: ", this.d3SvgBaseLayer);
    }

    getNoCodeStatesByShapeType(shapeType: string): Array<NoCodeState> | undefined
    {
        return this.stateInstances.filter((state: NoCodeState) => state.shapeType === shapeType);
    }

    addRenderLayer(shapeType: string | undefined, svgName: string | undefined): void
    {
        console.log("Adding Render Layer to No-Code Solution");
        // Confirm the No-Code State shape type is valid and supported with a corresponding D3ModelLayer object
        // that can handle the logic for rendering the No-Code State object.
        // If the shape type is not supported, then we should throw an error.
        // Validate the shape type
        const d3ModelLayerDefinition : Type<D3ModelLayer> | undefined = this.rendererManager.stateShapeTypeToD3ModelLayerTypeMap.get(shapeType || '');
        console.log("D3 Model Layer Definition being pulled from Renderer Manager to No Code Solution : ", d3ModelLayerDefinition);
        if(d3ModelLayerDefinition && shapeType)
        {       
            console.log("Creating a new d3ModelLayer instance from the d3ModelLayerDefinition"); 
            let noCodeStatesForLayer = this.getNoCodeStatesByShapeType(shapeType);
            const d3ModelLayerInstance = new d3ModelLayerDefinition(
                this.rendererManager, // Required to pass the renderer manager to any implementation of the D3ModelLayer despite it not existing on the abstract D3ModelLayer definition.
                this.interactionService, // Required to pass the interaction service to any implementation of the D3ModelLayer despite it not existing on the abstract D3ModelLayer definition.
                shapeType, // Required to verify the correct D3ModelLayer is being used for the No-Code State object.
                this, // Required to pass the No-Code Solution object to the D3ModelLayer object.
                svgName || '', // Optional SVG string to make a variant D3ModelLayer for the shapeType that uses a different svg to render.
            );
            console.log("D3 Model Layer Instance : ", d3ModelLayerInstance);
            if (!d3ModelLayerInstance) {
                throw new Error(`Shape type '${shapeType}' is not supported.`);
            }
            // Add the new layer to the Active No-Code Solution object.
            this.renderLayers.set(shapeType, d3ModelLayerInstance);
            console.log("Added new render layer instance to No-Code-Solution : ", d3ModelLayerInstance);
            console.log("Updated Render Layers : ", this.renderLayers);
        }
    }

    renderSolution(): void
    {
        console.log("Step 12 : Rendering No-Code Solution from inside the NoCodeSolution object");
        console.log('Rendering layers from no-code solution: ', this.solutionName);
        console.log('Current Render Layers: ', this.renderLayers);
        this.renderLayers.forEach((layer: D3ModelLayer, key: string) => {
            console.log('Rendering layer from no-code solution: ', key);
            console.log("layer: ", layer);
            layer.render();
        });
    }

    loadAllNoCodeStates()
    {
        console.log("Step 8 : Loading all No-Code State Layers from Renderer Manager");
        console.log("Loading all No-Code States: ", this.stateInstances);
        this.stateInstances.forEach((state: NoCodeState) => {
            console.log("Loading No-Code State : ", state);
            this.loadNewNoCodeState(state, this);
        });
    }

    // We need to figure out a way to access a app-level service from the model defintion here (rendererManager)
    loadNewNoCodeState(newState: NoCodeState, noCodeSolution: NoCodeSolution) {
        console.log("Inside Load New No-Code State");
        console.log("No-Code State : ", newState);
        
            // Check if the D3ModelLayer exists within the No-Code Solution object.
            let existingRenderLayer = noCodeSolution.renderLayers.get(newState.shapeType || '');
            console.log("Existing Render Layer : ", existingRenderLayer);
            // If the Render Layer is already being used for the given No-Code-Solution, then
            // we simply tie our noCodeState to that existing layer.
            // If the Render Layer is not being used in that No-Code-Solution, we map it to the No-Code-Solution
            // so we can ensure that when we load the NoCodeSolution later we are tracking what layers are needed.
            if(!existingRenderLayer) // Render layer does not exist on the No-Code-Solution
            {
                console.log("Render Layer does not exist on the No-Code-Solution, creating a new render layer");
                this.addRenderLayer(newState.shapeType, undefined); // Pass the shape type name and the svg name, the svg instance can be retrieved via the svg service.
            }
            else // Render Layer exists on the No-Code-Solution
            {
                console.log("Render Layer exists on the No-Code-Solution");
                console.log("Attempting to render NoCodeState using an existing d3ModelLayer instance on NoCodeStateRendererManager using shapeType : ", newState.shapeType);
                // Load the No-Code State object into the D3ModelLayer object.
                existingRenderLayer.addNoCodeState(newState);
            }

            // Render after having finished loading the new no-code-state object.
            this.renderSolution();
    }


  /**
   * Adds a new Layer to the Active No-Code Solution object.
   * @param shapeType - The name of the shape type (e.g., 'circle', 'rectangle').
   * @param newLayer - The instance of the D3ModelLayer object.
   */
  addLayerToNoCodeSolution(shapeType:string, newLayer: D3ModelLayer, noCodeSolution:NoCodeSolution): void {
    // Add the new layer to the Active No-Code Solution object.
    this.renderLayers.set(shapeType, newLayer);
  }

    /**
     * Clean up the subscription to avoid memory leaks.
     */
    public destroy(): void {
        this.baseLayerSubscription?.unsubscribe();
    }
}