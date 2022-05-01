import { Injectable, EventEmitter } from "@angular/core";
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { PolariService } from "./polari-service"
import { dataSetCollection } from "@models/dataSetCollection";
import { classPolyTyping } from "@models/classPolyTyping";
import { variablePolyTyping } from "@models/variablePolyTyping";
import { navComponent } from "@models/navComponent";
import { BehaviorSubject, Observable, Subscription } from "rxjs";

//A service that provides the overall typing for the different objects, as well as serves functions related to typing data.
@Injectable({
    providedIn: 'root'
})
export class ClassTypingService {

    objTypingSubscription? : Subscription;
    varTypingSubscription? : Subscription;

    //Holds the complete form of the polyTyping objects where polyTypedVars have been combined into the polyTypedObjects.
    //Form:  { "className": polyTypedObjOfClass, ... }
    polyTyping : object = {};
    //Holds the polyTypedVariables for the given class.
    polyVarTyping : object = {};
    //
    navComponents : navComponent[] = [
        new navComponent("Home","","HomeComponent", {}, []),
        new navComponent("Polari Configuration","polari-config","PolariConfigComponent", {}, [])
    ]
    //
    navComponentsBehaviorSubject = new BehaviorSubject<navComponent[]>(this.navComponents);
    //Behaviorsubject that can be used by components to subscribe to and effectively use any typign data easily.
    polyTypingBehaviorSubject = new BehaviorSubject<any>(this.polyTyping);

    constructor(private http: HttpClient, private polariService: PolariService)
    {
        //console.log("class-typing constructor")
        this.http = http;
        this.polariService = polariService;
        this.polyTyping = [];
        //Subscribe to the data on polariService related to typing in order to get it's data as necessary.
        this.objTypingSubscription = this.polariService.polyTypedObjectsData
        .subscribe((typingObjList:classPolyTyping[])=>{
            //console.log("subscribe action to object typing on type-service with value: ", typingObjList);
            typingObjList.forEach((typeObj:classPolyTyping)=>{
                //console.log("iterating typeObj: ", typeObj)
                if(typeObj.className in Object.keys(this.polyTyping))
                {
                    console.log("Skipping ", typeObj.className, " typing because it is already recorded.")
                    //The typing already exists so we check to see if there is any new data to update, and only update if there is.
                    //(For now, only variable data is being retrieved, so nothing to do here yet)
                }
                else
                {
                    //console.log("Adding ", typeObj.className, " typing.")
                    //After setting it, we should ask for the variables again to make sure relevant variable typing is added.
                    //Make momentary subscription to retrieve variable typing for the new object type recorded, then unsubscribe it.
                    console.log("Attempting to add polyTypedVars data for ",typeObj.className);
                    this.polariService.polyTypedVarsData.subscribe((varTypingList:variablePolyTyping[])=>{
                        //console.log("--varTypingList--");
                        //console.log(varTypingList);
                        let matchCount = 0;
                        varTypingList.forEach((varTyping:variablePolyTyping)=>{
                            
                            if(matchCount <= 2)
                            {
                                console.log("Found match for object: ",typeObj.className );
                                console.log(varTyping); 
                                matchCount +=1;
                            }
                            
                            if(varTyping.objectName == typeObj.className)
                            {
                                
                                if(varTyping.variableName != null && typeObj.variableNames != null)
                                {
                                    if(!(varTyping.variableName in typeObj.variableNames))
                                    {
                                        typeObj.variableNames?.push(varTyping.variableName);
                                    }
                                    typeObj.variables?.push(varTyping);
                                }
                                
                            }
                        });
                    }).unsubscribe();
                    //The typing object is not recorded yet so we simply set it to exist after having retrieved known variables.
                    this.polyTyping[typeObj.className] = typeObj;
                    this.polyTypingBehaviorSubject.next(this.polyTyping);
                    //setup the navComponent for the new type
                    
                    let className = "";
                    let nameLen = typeObj.className.length
                    let priorLetter = ""
                    for (let i = 0; i < nameLen; i++)
                    {
                        if( (typeObj.className[i]) == (typeObj.className[i]).toUpperCase() && priorLetter == priorLetter.toLowerCase() )
                        {
                            if(i != 0)
                            {
                                className = className + " ";
                            }
                            className = className + typeObj.className[i].toUpperCase();
                        }
                        else
                        {
                            className = className + typeObj.className[i];
                        }
                        priorLetter = typeObj.className[i];
                    }
                    let navComp : navComponent = new navComponent(className + " Main Page", "class-main-page/"+typeObj.className, "ClassMainPageComponent");
                    //Add the nav component for the class
                    this.navComponents.push(navComp);
                }
            })
        });
        //console.log("updated nav components to follow");
        //console.log(this.navComponents);
        //Subscribe to the data on polariService related to typing in order to get it's data as necessary.
        //Whenever an update occurs for a variableTyping we check the exisiting objects and set any variable values to their newer
        //version (regardless if there was an update to that variable or not)
        let typeObj : classPolyTyping;
        this.varTypingSubscription = this.polariService.polyTypedVarsData.subscribe((varTypingList:variablePolyTyping[])=>{
            varTypingList.forEach((varTyping:variablePolyTyping)=>{
                Object.keys(this.polyTyping).forEach((className:string)=>{
                    typeObj = this.polyTyping[className];
                    if(varTyping.objectName == typeObj.className)
                    {
                        if(varTyping.variableName != null && typeObj.variableNames != null)
                        {
                            if(!(varTyping.variableName in typeObj.variableNames))
                            {
                                typeObj.variableNames?.push(varTyping.variableName);
                            }
                            typeObj.variables?.push(varTyping);
                        }
                    }
                });
            });
        });
        //console.log("polyTyping at end of class-typing constructor")
        //console.log(this.polyTyping);
    }

    //Directly gets the typing of the desired class in a synchronous manner
    //Note: It is advised to instead use a subscription to the polyTypingBehaviorSubject set in a component's ngOnInit and
    //then to unsubscribe in that component's ngOnDestroy.
    getClassTypingSynchronous(className:string)
    {
        if(!(className in Object.keys(this.polyTyping)))
        {
            return null;
        }
        else
        {
            return this.polyTyping[className];
        }
    }

    //Since this is a service we are only worried about constructor and ngOnDestroy.
    ngOnDestroy()
    {
        //Unsubsribe from all previously defined subscriptions.
        if(this.objTypingSubscription != null)
        {
            this.objTypingSubscription.unsubscribe();
        }
        if(this.varTypingSubscription != null)
        {
            this.varTypingSubscription.unsubscribe();
        }
    }   
}