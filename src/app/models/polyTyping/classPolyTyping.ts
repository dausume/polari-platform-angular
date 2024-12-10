import { objectIdentifiersSpec } from "../objectIdentifiersSpec";
import { variablePolyTyping } from "./variablePolyTyping";

export class classPolyTyping {
    //The original class name as it is in the python-polari backend.
    className: string;
    //The displayable version of the class name.
    displayClassName?: string;
    //A list of just the names of the variables.
    variableNames?: string[];
    //A list of the objectIdentifiersSpec for the polyTypedVariable instances belonging to this class.
    polyTypedVars?: objectIdentifiersSpec[];
    //A list of variablePolyTyping instances belonging to this class.
    completeVariableTypingData: object = {};
    //A dictionary for quickly accessing the type that should be used to display the variable's data as on the frontend.
    //format: {"varName":"typeToBeDisplayedAs"}
    variableTypes?: {};

    constructor(className: string,  completeVariableTypingData:object={}, displayClassName?:string, variableNames?: string[], polyTypedVars?: objectIdentifiersSpec[], variableTypes?:object)
    {
        this.className = className;
        this.displayClassName = displayClassName;
        //this.polyTypedVars = polyTypedVars;
        this.variableTypes = variableTypes;
        //Contains a list of all polyTypedVar objects
        this.completeVariableTypingData = completeVariableTypingData;
        if(variableNames == undefined)
        {
            this.variableNames = Object.keys(this.completeVariableTypingData);
        }
        else
        {
            this.variableNames = variableNames;
        }
    }
}