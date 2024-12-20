// Author: Dustin Etts
// polari-platform-angular/src/app/models/noCode/noCodeSolution.ts
import { NoCodeState } from "./NoCodeState";
import { D3ModelLayer } from "./d3-extensions/D3ModelLayer";

// If we can it would be ideal to be able to get view dimensions relevant to the component and always use them
// to calculate the position of the overlay component. This would allow us to avoid having to pass in the
// borderPixels value, which is used to adjust the position of the overlay component to be inside the bounds
// of the component it is overlaying.
export class NoCodeSolution {
    //
    solutionName?: string;
    //
    id?: number;
    // A list of No-Code State objects which are used to define the state of the No-Code Solution.
    stateInstances: NoCodeState[];
    // A map of D3ModelLayer objects used to render the No-Code State objects for this No-Code Solution.
    renderLayers: Map<string, D3ModelLayer> = new Map<string, D3ModelLayer>();
    
    xBounds: number = 300;
    yBounds: number = 800;

    

    //Defines a configuration object used for configuring variable information for a new class, or modifying/duplicating an existing class.
    constructor(xBounds = 300, yBounds = 800, solutionName?: string, stateInstances: NoCodeState[]=[], id?: number)
    {
        this.xBounds = xBounds;
        this.yBounds = yBounds;
        this.solutionName = solutionName;
        this.stateInstances = stateInstances;
        this.id = id;
    }
}