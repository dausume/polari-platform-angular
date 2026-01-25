// Author: Dustin Etts
// polari-platform-angular/src/app/models/noCode/noCodeState.ts
import { FormControl } from "@angular/forms";
import { Slot } from "./Slot";

// The No-Code State class is used to define a state object which can be used in the No-Code Solution.
// This class is primarily used as a transfer object between the frontend and backend, and is used to define
// the state of the No-Code Solution.  During run-time, the no code state objects are converted into
// a data-point oriented format which is more data-efficient for the No-Code Solution to run.
// 
// When either a No-Code-State template is saved, or a No-Code-Solution is saved, the No-Code-State objects
// are converted from the State Management Service from data-point format into No-Code-State format, so that
// they can be saved to the database on the backend.
export class NoCodeState {
    // Custom name for the state, used for display purposes.
    stateName?: string;
    // Used to ensure that in respect to the entire No-Code Solution, each state has a unique identifier.
    id?: string;
    // The index of the state in the No-Code Solution, used to determine the order of the states being loaded
    // for the solution due to connections between states being dependent on the order of the states.
    index?: number;
    // Indicates the kind of svg being used for this state, which is used to determine how to render the state.
    shapeType?: string;
    // Indicates the Name of the No-Code Solution this state belongs to.
    solutionName?: string;
    // Indicates the name of the class being used as the base for this state.
    stateClass?: string;
    // Indicates the modified x-dimension size of the svg element for this state.
    stateSvgSizeX?: number | null;
    // Indicates the modified y-dimension size of the svg element for this state.
    stateSvgSizeY?: number | null;
    // Indicates the modified radius of the svg element for this state.
    stateSvgRadius?: number | null;
    // The string name that maps the NoCodeState svg being used for display in the state's backeground svg.
    stateSvgName?: string;
    // Indicates the x-coordinate location of the svg element for this state.
    stateLocationX?: number;
    // Indicates the y-coordinate location of the svg element for this state.
    stateLocationY?: number;
    //A list of connector Nodes which are created/allocated onto this state, which act as output nodes.
    slots?: Slot[];
    // Standardizes the radius of the slot circles for this state, by default it is 4 px.
    slotRadius?: number;
    // Used so that we can cache the d3 model layer object for this state.
    layerName?: string;
    //
    backgroundColor?: string;
    // Corner radius for rounded rectangle shapes
    cornerRadius?: number;
    // Width for rectangle shapes (alias for stateSvgSizeX for clarity)
    stateSvgWidth?: number;
    // Height for rectangle shapes (alias for stateSvgSizeY for clarity)
    stateSvgHeight?: number;

    // === State-Space Object System Fields ===
    // Links this state to a StateDefinition template
    stateDefinitionId?: string;
    // Links to an actual object instance when this state represents a bound object
    objectInstanceId?: string;
    // The class name of the bound object (populated from StateDefinition.sourceClassName)
    boundObjectClass?: string;
    // Field values for the bound object instance
    boundObjectFieldValues?: { [fieldName: string]: any };

    //Defines a configuration object used for configuring variable information for a new class, or modifying/duplicating an existing class.
    constructor(
        stateName?: string,
        shapeType?: string,
        stateClass?: string,
        index?:number,
        stateSvgSizeX?: number | null,
        stateSvgSizeY?: number | null,
        stateSvgRadius?: number | null,
        solutionName?:string,
        layerName?: string,
        stateLocationX: number = 0,
        stateLocationY: number = 0,
        id?:string,
        stateSvgName?: string, // The name of the svg, if it is the same as the shapeType or empty it uses default svg.
        slots: Slot[]=[],
        slotRadius: number = 4,
        backgroundColor="blue",
        // State-Space Object System fields
        stateDefinitionId?: string,
        objectInstanceId?: string,
        boundObjectClass?: string,
        boundObjectFieldValues?: { [fieldName: string]: any }
    )
    {
        this.id = id;
        this.index = index;
        this.stateName = stateName;
        this.shapeType = shapeType;
        this.solutionName = solutionName;
        this.stateClass = stateClass;
        this.stateSvgSizeX = stateSvgSizeX;
        this.stateSvgSizeY = stateSvgSizeY;
        this.stateSvgRadius = stateSvgRadius;
        this.stateLocationX = stateLocationX;
        this.stateLocationY = stateLocationY;
        this.slots = slots;
        this.layerName = layerName;
        this.backgroundColor = backgroundColor;
        this.stateSvgName = stateSvgName;
        this.slotRadius = slotRadius;
        // State-Space Object System fields
        this.stateDefinitionId = stateDefinitionId;
        this.objectInstanceId = objectInstanceId;
        this.boundObjectClass = boundObjectClass;
        this.boundObjectFieldValues = boundObjectFieldValues;
        this.validate();
    }

    private validate(): void {
        
    }

    updateLocation(x: number, y: number): void {
        this.stateLocationX = x;
        this.stateLocationY = y;
    }
    
    resize(x: number, y: number): void {
        this.stateSvgSizeX = x;
        this.stateSvgSizeY = y;
    }

    // === State-Space Object System Methods ===

    /**
     * Bind this state to a StateDefinition template
     */
    bindToStateDefinition(stateDefinitionId: string, sourceClassName: string): void {
        this.stateDefinitionId = stateDefinitionId;
        this.boundObjectClass = sourceClassName;
    }

    /**
     * Bind this state to a specific object instance
     */
    bindToObjectInstance(objectInstanceId: string, fieldValues?: { [fieldName: string]: any }): void {
        this.objectInstanceId = objectInstanceId;
        if (fieldValues) {
            this.boundObjectFieldValues = fieldValues;
        }
    }

    /**
     * Update a field value for the bound object
     */
    updateFieldValue(fieldName: string, value: any): void {
        if (!this.boundObjectFieldValues) {
            this.boundObjectFieldValues = {};
        }
        this.boundObjectFieldValues[fieldName] = value;
    }

    /**
     * Get a field value from the bound object
     */
    getFieldValue(fieldName: string): any {
        return this.boundObjectFieldValues?.[fieldName];
    }

    /**
     * Check if this state is bound to a state-space object
     */
    isBoundToStateSpace(): boolean {
        return !!this.stateDefinitionId || !!this.boundObjectClass;
    }

    /**
     * Check if this state has a bound object instance
     */
    hasBoundInstance(): boolean {
        return !!this.objectInstanceId;
    }

    /**
     * Clear all state-space bindings
     */
    clearStateSpaceBindings(): void {
        this.stateDefinitionId = undefined;
        this.objectInstanceId = undefined;
        this.boundObjectClass = undefined;
        this.boundObjectFieldValues = undefined;
    }
}