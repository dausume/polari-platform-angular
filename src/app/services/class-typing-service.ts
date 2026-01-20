// class-typing-service.ts
import { Injectable, EventEmitter } from "@angular/core";
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { PolariService } from "./polari-service"
import { dataSetCollection } from "@models/objectData/dataSetCollection";
import { classPolyTyping } from "@models/polyTyping/classPolyTyping";
import { variablePolyTyping } from "@models/polyTyping/variablePolyTyping";
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

    // Static navigation items (always shown)
    staticNavComponents : navComponent[] = [
        new navComponent("Home","","HomeComponent", {}, []),
        new navComponent("Polari Configuration","polari-config","PolariConfigComponent", {}, []),
        new navComponent("Create Class","create-class","CreateNewClassComponent", {}, []),
        new navComponent("Custom No-Code","custom-no-code","CustomNoCodeComponent", {}, [])
    ]

    // Dynamic navigation items for object class pages WITH instances (shown in main dropdown)
    dynamicClassNavComponents : navComponent[] = [];

    // Dynamic navigation items for object class pages WITHOUT instances (shown in "Unused Objects" dropdown)
    unusedClassNavComponents : navComponent[] = [];

    // Classes with instances (from backend)
    classesWithInstances: string[] = [];
    // Classes without instances (from backend)
    classesWithoutInstances: string[] = [];

    // Combined nav components (for backwards compatibility)
    navComponents : navComponent[] = [...this.staticNavComponents];

    // BehaviorSubject for static nav items
    navComponentsBehaviorSubject = new BehaviorSubject<navComponent[]>(this.staticNavComponents);

    // BehaviorSubject for dynamic class pages WITH instances (for dropdown)
    dynamicClassNavSubject = new BehaviorSubject<navComponent[]>(this.dynamicClassNavComponents);

    // BehaviorSubject for unused class pages WITHOUT instances (for nested dropdown)
    unusedClassNavSubject = new BehaviorSubject<navComponent[]>(this.unusedClassNavComponents);

    //Behaviorsubject that can be used by components to subscribe to and effectively use any typign data easily.
    polyTypingBehaviorSubject = new BehaviorSubject<any>(this.polyTyping);

    constructor(private http: HttpClient, private polariService: PolariService)
    {
        this.http = http;
        this.polariService = polariService;
        this.polyTyping = {};

        // Fetch class instance counts to determine used vs unused classes
        this.fetchClassInstanceCounts();

        //Subscribe to the data on polariService related to object typing.
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
                    
                    
                    // Convert camelCase class name to readable display name
                    // e.g., "dataStream" -> "Data Stream", "managedFile" -> "Managed File"
                    let className = "";
                    let nameLen = typeObj.className.length;

                    for (let i = 0; i < nameLen; i++)
                    {
                        const currentChar = typeObj.className[i];
                        const isUpperCase = currentChar === currentChar.toUpperCase() && currentChar !== currentChar.toLowerCase();

                        // Add space before uppercase letters (except at the start)
                        if (i > 0 && isUpperCase)
                        {
                            className += " ";
                        }

                        // Capitalize the first character, keep others as-is
                        if (i === 0)
                        {
                            className += currentChar.toUpperCase();
                        }
                        else
                        {
                            className += currentChar;
                        }
                    }
                    //The typing object is not recorded yet so we simply set it to exist after having retrieved known variables.
                    //this.polyTyping[typeObj.className] = typeObj;
                    if(!(className in Object.keys(this.polyVarTyping)))
                    {
                        this.polyVarTyping[typeObj.className] = {}
                    }
                    this.polyTyping[typeObj.className] = new classPolyTyping(typeObj.className, this.polyVarTyping[typeObj.className], className) ;
                    this.polyTypingBehaviorSubject.next(this.polyVarTyping);

                    // Setup the navComponent for the new type
                    let navComp : navComponent = new navComponent(className, "class-main-page/"+typeObj.className, "ClassMainPageComponent");

                    // Check if this class nav already exists in either list
                    const existingInUsed = this.dynamicClassNavComponents.findIndex(nc => nc.path === navComp.path);
                    const existingInUnused = this.unusedClassNavComponents.findIndex(nc => nc.path === navComp.path);

                    if (existingInUsed === -1 && existingInUnused === -1) {
                        // Categorize based on whether this class has instances
                        if (this.classHasInstances(typeObj.className)) {
                            this.dynamicClassNavComponents.push(navComp);
                            this.dynamicClassNavComponents.sort((a, b) => a.title.localeCompare(b.title));
                            this.dynamicClassNavSubject.next([...this.dynamicClassNavComponents]);
                            console.log('[ClassTypingService] Added to USED nav for:', className);
                        } else {
                            this.unusedClassNavComponents.push(navComp);
                            this.unusedClassNavComponents.sort((a, b) => a.title.localeCompare(b.title));
                            this.unusedClassNavSubject.next([...this.unusedClassNavComponents]);
                            console.log('[ClassTypingService] Added to UNUSED nav for:', className);
                        }
                    }

                    // Also add to combined navComponents for backwards compatibility
                    this.navComponents.push(navComp);
                }
            })
        });

        //Subscribe to the data on polariService related to variables typing on objects.
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
            this.polyTypingBehaviorSubject.next(this.polyVarTyping);
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

    /**
     * Fetch class instance counts from the backend to determine which classes have instances.
     * This is used to separate "Object Pages" (with instances) from "Unused Objects" (without instances).
     */
    fetchClassInstanceCounts() {
        // Wait for polariService to establish connection before fetching
        this.polariService.connectionSuccessSubject.subscribe(isConnected => {
            if (isConnected) {
                const url = this.polariService.getBackendBaseUrl() + '/classInstanceCounts';
                console.log('[ClassTypingService] Fetching class instance counts from:', url);

                this.http.get<any>(url, this.polariService.backendRequestOptions)
                    .subscribe({
                        next: (response: any) => {
                            console.log('[ClassTypingService] Class instance counts response:', response);

                            // Parse response - format: [{"classInstanceCounts": {...}}]
                            let data: any = null;
                            if (Array.isArray(response) && response.length > 0 && response[0].classInstanceCounts) {
                                data = response[0].classInstanceCounts;
                            } else if (response.classInstanceCounts) {
                                data = response.classInstanceCounts;
                            }

                            if (data) {
                                this.classesWithInstances = data.classesWithInstances || [];
                                this.classesWithoutInstances = data.classesWithoutInstances || [];

                                console.log('[ClassTypingService] Classes WITH instances:', this.classesWithInstances);
                                console.log('[ClassTypingService] Classes WITHOUT instances:', this.classesWithoutInstances);

                                // Re-categorize existing nav components based on new data
                                this.recategorizeNavComponents();
                            }
                        },
                        error: (err: any) => {
                            console.error('[ClassTypingService] Error fetching class instance counts:', err);
                        }
                    });
            }
        });
    }

    /**
     * Re-categorize nav components into "used" and "unused" based on instance counts.
     */
    recategorizeNavComponents() {
        // Get all dynamic nav components
        const allNavs = [...this.dynamicClassNavComponents, ...this.unusedClassNavComponents];

        // Reset arrays
        this.dynamicClassNavComponents = [];
        this.unusedClassNavComponents = [];

        allNavs.forEach(nav => {
            // Extract class name from path (format: "class-main-page/className")
            const pathParts = nav.path.split('/');
            const className = pathParts.length > 1 ? pathParts[1] : '';

            if (this.classesWithInstances.includes(className)) {
                this.dynamicClassNavComponents.push(nav);
            } else {
                this.unusedClassNavComponents.push(nav);
            }
        });

        // Sort both lists
        this.dynamicClassNavComponents.sort((a, b) => a.title.localeCompare(b.title));
        this.unusedClassNavComponents.sort((a, b) => a.title.localeCompare(b.title));

        // Emit updates
        this.dynamicClassNavSubject.next([...this.dynamicClassNavComponents]);
        this.unusedClassNavSubject.next([...this.unusedClassNavComponents]);

        console.log('[ClassTypingService] Recategorized - Used:', this.dynamicClassNavComponents.length,
                    'Unused:', this.unusedClassNavComponents.length);
    }

    /**
     * Check if a class has instances (is "used").
     */
    classHasInstances(className: string): boolean {
        return this.classesWithInstances.includes(className);
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