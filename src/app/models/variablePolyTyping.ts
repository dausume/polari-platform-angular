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
        if(this.variableFrontendType == undefined)
        {
            this.deriveFrontendTypeFromPythonType()
        }
        else
        {
            this.variableFrontendType = variableFrontendType
        }
    }

    deriveFrontendTypeFromPythonType()
    {
        if(this.variablePythonType != undefined && this.variableFrontendType == undefined)
        {
            switch (this.variablePythonType) {
                case "str":
                    this.variableFrontendType = "string";
                    break;

                default:
                    if(this.variablePythonType.startsWith("CLASS-"))
                    {
                        this.variableFrontendType = "reference";
                    }
                    break;
            }
        }
    }

    //Takes in a json formatted polyTyping object from the backend and retrieves the object's name from it's reference to it.
    static getClassName(passedVariableTyping:any)
    {
        return passedVariableTyping.polyTypedObj[1][0].tuple[0][0].tuple[1];
    }

    //Takes in a json formatted polyTyping object from the backend and retrieves the object's name from it's reference to it.
    static getReferenceName(passedVariableTyping:any)
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