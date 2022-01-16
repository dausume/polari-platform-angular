import { variablePolyTyping } from "./variablePolyTyping";

export class classPolyTyping {
    objectName: string;
    variableNames?: string[];
    variables?: variablePolyTyping[];

    constructor(objectName: string, variableNames?: string[], variables?: variablePolyTyping[])
    {
        this.objectName = objectName;
        this.variableNames = variableNames;
        this.variables = variables;
    }
}