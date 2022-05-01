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
    referenceInstance: [string,any[]];
    //identifiers - a dicitionary holding the key-value pairs of the id variables, the bare minimum data to know what instance is being
    //referenced.
    identifiers: object;

    constructor(referenceInstance: [string,any[]])
    {
        if(referenceInstance.length != 2)
        {
            console.log("invalid reference json passed into objectReference constructor, should be an array with the first element "
            +"indicating class referenced and the second being json with Id data for the specific object referenced.");
        }
        this.referenceInstance = referenceInstance;
        this.identifiers = {};
        this.className=this.getClassName();
        //console.log(referenceInstance[1][0].tuple);
        let identifiersList = referenceInstance[1][0].tuple
        for(let someIdIndex in identifiersList)
        {
          if(Array.isArray(identifiersList[someIdIndex][0].tuple[1]))
          {
            //This is should be a sub-reference
            this.identifiers[identifiersList[someIdIndex][0].tuple[0]] = new objectReference(identifiersList[someIdIndex][0].tuple[1]);
          }
          else
          {
              //This is a non-object or standard typed identifier value.
            this.identifiers[identifiersList[someIdIndex][0].tuple[0]] = identifiersList[someIdIndex][0].tuple[1];
          }
        }
    }

    getClassName()
    {
        //console.log("In getClassName")
        let stringRef = this.referenceInstance[0];
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