import { classPolyTyping } from "./classPolyTyping";

//A class that exists only as a template, meant to be extended on when typing data is retrieved from the API using
//the functionality defined here to interpret the data on how that class should be typed & behave.
export class objectReference {
    //The Name of the class being defined
    className: string;
    //The raw form of the reference given by Polari APIs in json format, holds data about the class, and it's Id variables.
    //If a user does not have access to any of the unique Id variables they cannot do anything other than view some of it's
    //basic information even if they have other permissions.  This is because Id data is required to perform any actions on
    //a specific instance, if the user does not have anything they cannot do anything to that instance.
    referenceInstance: (string|any[])[];
    //IdRef - a dicitionary holding the key-value pairs of the id variables, the bare minimum data to know what instance is being
    //referenced.
    idRef: object;

    constructor(referenceInstance: (string|any[])[])
    {
        this.referenceInstance = referenceInstance;
        this.idRef = {};
        //Variables for temporary use in interpreting data.
        let stringRef : string = "";
        let idJson : object[][] = []
        //Get values for idList and stringRef.
        if(typeof referenceInstance[0] === 'string')
        {
            stringRef = referenceInstance[0];
        }
        else if(typeof referenceInstance[1] === 'string')
        {
            stringRef = referenceInstance[1];
        }
        if(Array.isArray(referenceInstance[1]))
        {
            idJson = referenceInstance[0]["tuple"];
        }
        else if(Array.isArray(referenceInstance[1]))
        {
            idJson = referenceInstance[1]["tuple"];
        }
        //Use idList and stringRef to get interpreted values, idRef and className.
        //Get ClassName or set to undefined if data is corrupt/wrong.
        if(stringRef.startsWith("CLASS-") && stringRef.endsWith("-IDS"))
        {
            let stringSize = stringRef.length;
            this.className = stringRef.substring(6,stringSize-4);
        }
        else{
            this.className = "undefined";
        }
        //Get idRef, the first element in the tuple should always be the id/variable name, and the second it's value.
        idJson[0].forEach((someId:object)=>{
            this.idRef[ someId["tuple"][0] ] = someId["tuple"][1]
        });
    }
    
    static isReferenceJson(referenceInstance: (string|any[])[])
    {
        if(!Array.isArray(referenceInstance))
        {
            return false;
        }
        else if(referenceInstance.length != 2)
        {
            return false;
        }
        //Variables for temporary use in interpreting data.
        let stringRef : string = "";
        let idJson : object[][] = []
        //Get values for idList and stringRef.
        if(typeof referenceInstance[0] === 'string')
        {
            stringRef = referenceInstance[0];
        }
        else if(typeof referenceInstance[1] === 'string')
        {
            stringRef = referenceInstance[1];
        }
        if(Array.isArray(referenceInstance[0]))
        {
            idJson = referenceInstance[0][0]["tuple"];
        }
        else if(Array.isArray(referenceInstance[1]))
        {
            idJson = referenceInstance[1][0]["tuple"];
        }
        //Use idList and stringRef to get interpreted values, idRef and className.
        //Get ClassName or set to undefined if data is corrupt/wrong.
        if(!(stringRef.startsWith("CLASS-") && stringRef.endsWith("-IDs")))
        {
            return false;
        }
        //Get idRef, the first element in the tuple should always be the id/variable name, and the second it's value.
        let idCount = 0;
        let invalidIds = 0;
        idJson[0].forEach((someId:object)=>{
            if(typeof someId["tuple"][0] === 'string' && someId["tuple"].length == 2)
            {
                idCount += 1;
            }
            else
            {
                invalidIds += 1;
            }
        });
        if(invalidIds > 0 || idCount == 0)
        {
            return false
        }
        return true;
    }

    static getClassName(referenceInstance: (string|any[])[])
    {
        //Variables for temporary use in interpreting data.
        let stringRef : string = "";
        if(typeof referenceInstance[0] === 'string')
        {
            stringRef = referenceInstance[0];
        }
        else if(typeof referenceInstance[1] === 'string')
        {
            stringRef = referenceInstance[1];
        }
        //Use idList and stringRef to get interpreted values, idRef and className.
        //Get ClassName or set to undefined if data is corrupt/wrong.
        if(!(stringRef.startsWith("CLASS-") && stringRef.endsWith("-IDs")))
        {
            return "not-a-reference";
        }
        else
        {
            let className = stringRef.substring(6,stringRef.length-4)
            console.log("className Referenced: ", className);
            return className;
        }

    }
}