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

    //Takes in a json formatted polyTyping object from the backend and retrieves the object's name from it's reference to it.
    static getClassName(passedVariableTyping:any)
    {
        //console.log("In getClassName for variablePolyTyping instance");
        let stringRef : string = passedVariableTyping.polyTypedObj[0];
        //console.log(stringRef);
        let className="";
        if(stringRef.startsWith("CLASS-"))
        {
            let stringSize = stringRef.length;
            if(stringRef.endsWith("-IDs"))
            {
                className = stringRef.substring(6,stringSize-4);
            }
            else if(stringRef.endsWith("-REFERENCE") )
            {
                className = stringRef.substring(6,stringSize - 10);
            }
            else
            {
                className = "undefined";
            }
        }
        else{
            className = "undefined";
        }
        return className;
    }
}