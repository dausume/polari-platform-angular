import { variablePolyTyping } from "./variablePolyTyping";

export class classPolyTyping {
    className: string;
    displayClassName?: string;
    variableNames?: string[];
    variables?: variablePolyTyping[];

    constructor(className: string, displayClassName?:string, variableNames?: string[], variables?: variablePolyTyping[])
    {
        this.className = className;
        this.variableNames = variableNames;
        this.variables = variables;
    }
}