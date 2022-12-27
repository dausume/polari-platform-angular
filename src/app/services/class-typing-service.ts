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
        this.http = http;
        this.polariService = polariService;
        this.polyTyping = {};
        //Subscribe to the data on polariService related to typing in order to get it's data as necessary.
        this.objTypingSubscription = this.polariService.polyTypedObjectsData
        .subscribe((typingObjList:classPolyTyping[])=>{
            typingObjList.forEach((typeObj:classPolyTyping)=>{
                let varTypingDict = {};
                if(typeObj.className in Object.keys(this.polyTyping))
                {
                    console.log("Skipping ", typeObj.className, " typing because it is already recorded.")
                    //The typing already exists so we check to see if there is any new data to update, and only update if there is.
                    //(For now, only variable data is being retrieved, so nothing to do here yet)
                }
                else
                {
                    //After setting it, we should ask for the variables again to make sure relevant variable typing is added.
                    //Make momentary subscription to retrieve variable typing for the new object type recorded, then unsubscribe it.
                    this.polariService.polyTypedVarsData.subscribe((varTypingList:variablePolyTyping[])=>{
                        console.log("getting polyVarTyping for newly added or modified polyObj");
                        //console.log("current polyTyping: ", this.polyTyping);
                        //console.log("new varTyping: ", varTypingList);
                        let varObjectName = "";
                        let formattedVar : variablePolyTyping;
                        let objectHolder : any = {};
                        let oldObjectHolder : any = {};
                        varTypingList.forEach((varTyping:any)=>{
                            varObjectName = variablePolyTyping.getClassName(varTyping);
                            if(varObjectName == typeObj.className)
                            {
                                formattedVar = new variablePolyTyping(varObjectName, varTyping.name, varTyping.pythonTypeDefault)
                                console.log("Object keys: ", Object.keys(this.polyVarTyping))
                                //console.log(varObjectName in Object.keys(this.polyVarTyping))
                                console.log(this.polyVarTyping.hasOwnProperty(varObjectName))
                                if(!(this.polyVarTyping.hasOwnProperty(varObjectName)))
                                {
                                    console.log("Initializing Object typing vars for : ", varObjectName)
                                    this.polyVarTyping[varObjectName] = {}
                                }
                                objectHolder = {}
                                console.log("varName: ", formattedVar.variableName, ", object name: ", varObjectName);
                                if(formattedVar.variableName != null)
                                {
                                    objectHolder[formattedVar.variableName] = formattedVar
                                }
                                oldObjectHolder = this.polyVarTyping[varObjectName]
                                console.log("Current Object Holder: ", oldObjectHolder)
                                console.log("portion to add: ", objectHolder)
                                this.polyVarTyping[varObjectName] = Object.assign(oldObjectHolder, objectHolder)
                                //this.polyVarTyping[className][varTyping.variableName] = formattedVar;
                                //console.log("fail 3 -1")
                                console.log("updated polyVarTyping: ",this.polyVarTyping);
                            }
                        });
                        console.log("polyVarTyping Before Unsubscribe - ", this.polyVarTyping);
                    }).unsubscribe();
                    
                    
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
                    //The typing object is not recorded yet so we simply set it to exist after having retrieved known variables.
                    //this.polyTyping[typeObj.className] = typeObj;
                    if(!(className in Object.keys(this.polyVarTyping)))
                    {
                        this.polyVarTyping[typeObj.className] = {}
                    }
                    this.polyTyping[typeObj.className] = new classPolyTyping(typeObj.className, this.polyVarTyping[typeObj.className], className) ;
                    this.polyTypingBehaviorSubject.next(this.polyTyping);
                    //setup the navComponent for the new type
                    let navComp : navComponent = new navComponent(className + " Main Page", "class-main-page/"+typeObj.className, "ClassMainPageComponent");
                    //Add the nav component for the class
                    this.navComponents.push(navComp);
                }
            })
        });
        //Subscribe to the data on polariService related to typing in order to get it's data as necessary.
        //Whenever an update occurs for a variableTyping we check the exisiting objects and set any variable values to their newer
        //version (regardless if there was an update to that variable or not)
        
        this.varTypingSubscription = this.polariService.polyTypedVarsData.subscribe((varTypingList:any[])=>{
            console.log("making changes in accordance with new polyTypedVars data");
            console.log("In varTypingSubscription")
            console.log(varTypingList);
            let varObjectName = "";
            let formattedVar : variablePolyTyping;
            let objectHolder : any = {};
            let oldObjectHolder : any = {};
            varTypingList.forEach((varTyping:any)=>{
                //console.log("new varTyping: ", varTyping)
                //console.log("current polyTyping: ", this.polyTyping)
                Object.keys(this.polyTyping).forEach((className:string)=>{
                    objectHolder = {};
                    oldObjectHolder = {};
                    varObjectName = "";
                    varObjectName = variablePolyTyping.getClassName(varTyping);
                    if(varObjectName == className)
                    {
                        formattedVar = new variablePolyTyping(varObjectName, varTyping.name, varTyping.pythonTypeDefault)
                        console.log("Existing object keys: ", Object.keys(this.polyVarTyping))
                        console.log(this.polyVarTyping.hasOwnProperty(varObjectName))
                        if(!(this.polyVarTyping.hasOwnProperty(varObjectName)))
                        {
                            console.log("Initializing Object typing vars for : ", varObjectName)
                            this.polyVarTyping[varObjectName] = {}
                        }
                        console.log("var name: ", varTyping.name, ", class name: ", varObjectName);
                        objectHolder[varTyping.name] = formattedVar;
                        //console.log("Trying new version")
                        //console.log("current var typing for object ", varObjectName,": ", this.polyVarTyping[varObjectName])
                        //console.log("portion to add: ", objectHolder)
                        oldObjectHolder = this.polyVarTyping[varObjectName];
                        this.polyVarTyping[varObjectName] = Object.assign(oldObjectHolder, objectHolder);
                        //this.polyVarTyping[className][varTyping.variableName] = formattedVar;
                        //console.log("fail 3 -1")
                        //console.log("updated polyVarTyping: ",this.polyVarTyping);
                        //console.log("updated polyVarTyping for class ",className,": ", this.polyVarTyping[className])
                    }
                });
            });
            this.polyTypingBehaviorSubject.next(this.polyTyping);
            console.log("polyVarTyping at end of: ", this.polyVarTyping);
        });
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