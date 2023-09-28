import { FormControl } from "@angular/forms";
import { Slot } from "./slot";

export class noCodeState {
    id: number;
    index?: number;
    //
    shapeType?: string;
    //
    solutionId?: number;
    //
    stateName?: string;
    //
    className?: string;
    //
    stateComponentSizeX?: number;
    stateComponentSizeY?: number;
    //
    stateLocationX?: number;
    stateLocationY?: number;
    //A list of connector Nodes which are created/allocated onto this state, which act as input or output nodes.
    outputSlots?: Slot[];

    //Defines a configuration object used for configuring variable information for a new class, or modifying/duplicating an existing class.
    constructor(id:number, index?:number, shapeType?: string, solutionId?:number, stateName?: string, className?: string, stateComponentSizeX?: number,stateComponentSizeY?: number,stateLocationX: number = 0,stateLocationY: number = 0, outputSlots: Slot[]=[])
    {
        this.id = id;
        this.index = index;
        this.shapeType = shapeType;
        this.solutionId = solutionId;
        this.stateName = stateName;
        this.className = className;
        this.stateComponentSizeX = stateComponentSizeX;
        this.stateComponentSizeY = stateComponentSizeY;
        this.stateLocationX = stateLocationX;
        this.stateLocationY = stateLocationY;
        this.outputSlots = outputSlots;
    }
}