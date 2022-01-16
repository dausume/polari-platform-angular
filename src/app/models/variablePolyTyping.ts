export class variablePolyTyping {
    objectName?: string;
    variableName?: string;
    variablePythonType?: string;
    variableFrontendType?: string;

    constructor(objectName?: string, variableName?: string, variablePythonType?: string, variableFrontendType?: string)
    {
        this.objectName = objectName;
        this.variableName = variableName;
        this.variablePythonType = variablePythonType;
        this.variableFrontendType = variableFrontendType;
    }
}