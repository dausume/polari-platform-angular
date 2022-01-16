import { Injectable, EventEmitter } from "@angular/core";
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { PolariService } from "./polari-service"
import { dataSetCollection } from "@models/dataSetCollection";
import { classPolyTyping } from "@models/classPolyTyping";
import { variablePolyTyping } from "@models/variablePolyTyping";

//A service that provides the overall typing for the different objects, as well as serves functions related to typing data.
@Injectable()
export class ClassTypingService {

    //Listens to the polyTyping and polyTypedVars on polariService
    polyTypingListener
    //Listens to the polyTyping and polyTypedVars on polariService
    polyTypedVarsListener
    //Holds the complete form of the polyTyping objects where polyTypedVars have been combined into the polyTypedObjects.
    polyTyping : classPolyTyping[]

    constructor(private http: HttpClient, private polariService: PolariService, polyTyping?:classPolyTyping[])
    {
        this.http = http;
        this.polariService = polariService;
        if(polyTyping == null)
        {
            this.polyTyping = [];
        }
        else
        {
            this.polyTyping = polyTyping;
        }
    }

    newClass(typingObject:classPolyTyping, typedVars:variablePolyTyping)
    {
        //Adds the typedVars into the typingObject.
        typingObject["polyTypedVars"] = typedVars;
        let polyTypingClass = typingObject;
        //Check if the typing exists already
        let typingExists = false;
        this.polyTyping.forEach((typeObj:classPolyTyping)=>{
            if(typeObj.objectName == typingObject.objectName)
            {
                //found existing typing info
                typingExists = true;
                
            }
        });
        if(typingExists)
        {
            console.log("Typing already existed for type '", typingObject.objectName, "' but newClass function was called to create it.")
        }
        else
        {
            //create the typing and add it to typing list.
        }
    }

    
}