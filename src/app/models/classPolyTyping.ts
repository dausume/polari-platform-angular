import { objectReference } from "./objectReference";
import { variablePolyTyping } from "./variablePolyTyping";

export class classPolyTyping {
    //The original class name as it is in the python-polari backend.
    className: string;
    //The displayable version of the class name.
    displayClassName?: string;
    //A list of just the names of the variables.
    variableNames?: string[];
    //A list of the objectReferences for the polyTypedVariable instances belonging to this class.
    polyTypedVars?: objectReference[];
    //A list of variablePolyTyping instances belonging to this class.
    completeVariableTypingData: object = {};
    //A dictionary for quickly accessing the type that should be used to display the variable's data as on the frontend.
    //format: {"varName":"typeToBeDisplayedAs"}
    variableTypes?: {};

    constructor(className: string,  completeVariableTypingData:object={}, displayClassName?:string, variableNames?: string[], polyTypedVars?: objectReference[], variableTypes?:object)
    {
        this.className = className;
        this.displayClassName = displayClassName;
        this.variableNames = variableNames;
        this.polyTypedVars = polyTypedVars;
        this.variableTypes = variableTypes;
        this.completeVariableTypingData = completeVariableTypingData;
    }
}