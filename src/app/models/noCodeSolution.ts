import { noCodeState } from "./noCodeState";

export class noCodeSolution {
    //
    solutionName?: string;
    //
    id?: number;
    //
    leftMostLocationX?: number;
    //
    rightMostLocationX?: number;
    //
    topMostLocationY?: number;
    //
    bottomMostLocationY?: number;
    //
    totalStates?: number;
    //
    stateInstances: noCodeState[];
    
    xBounds: number = 300;
    yBounds: number = 800;

    

    //Defines a configuration object used for configuring variable information for a new class, or modifying/duplicating an existing class.
    constructor(xBounds = 300, yBounds = 800, solutionName?: string, stateInstances: noCodeState[]=[], id?: number, leftMostLocationX?: number, rightMostLocationX?: number, topMostLocationY?: number, bottomMostLocationY?: number, totalStates?: number)
    {
        this.xBounds = xBounds;
        this.yBounds = yBounds;
        this.solutionName = solutionName;
        this.stateInstances = stateInstances;
        this.id = id;
        this.leftMostLocationX = leftMostLocationX;
        this.rightMostLocationX = rightMostLocationX;
        this.topMostLocationY = topMostLocationY;
        this.bottomMostLocationY = bottomMostLocationY;
        this.totalStates = totalStates;
    }
}