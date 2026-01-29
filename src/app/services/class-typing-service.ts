// class-typing-service.ts
import { Injectable, EventEmitter } from "@angular/core";
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { PolariService } from "./polari-service"
import { DataSetCollection } from "@models/objectData/dataSetCollection";
import { classPolyTyping, ClassConfig } from "@models/polyTyping/classPolyTyping";
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
        new navComponent("Custom No-Code","custom-no-code","CustomNoCodeComponent", {}, []),
        new navComponent("API Profiler","api-profiler","ApiProfilerComponent", {}, [])
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

    // Editable class navigation - classes that allow create/edit/delete operations
    editableUsedClassNavComponents: navComponent[] = [];
    editableUnusedClassNavComponents: navComponent[] = [];
    editableUsedClassNavSubject = new BehaviorSubject<navComponent[]>(this.editableUsedClassNavComponents);
    editableUnusedClassNavSubject = new BehaviorSubject<navComponent[]>(this.editableUnusedClassNavComponents);

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
                    // Initialize the class's variable typing from current polyTypedVarsData
                    // This is now synchronous - we use the current value of the BehaviorSubject
                    const currentVarTypingList = this.polariService.polyTypedVarsData.getValue();
                    console.log("[ClassTypingService] Processing new class:", typeObj.className);
                    console.log("[ClassTypingService] Current polyTypedVarsData has", currentVarTypingList?.length || 0, "variables");

                    // Initialize the class's variable typing dict
                    if(!(this.polyVarTyping.hasOwnProperty(typeObj.className))) {
                        this.polyVarTyping[typeObj.className] = {};
                    }

                    // Process variables for this class from current data
                    if (currentVarTypingList && currentVarTypingList.length > 0) {
                        currentVarTypingList.forEach((varTyping: any) => {
                            const varObjectName = variablePolyTyping.getClassName(varTyping);
                            if (varObjectName === typeObj.className) {
                                const formattedVar = new variablePolyTyping(varObjectName, varTyping.name, varTyping.pythonTypeDefault);
                                if (formattedVar.variableName != null) {
                                    this.polyVarTyping[typeObj.className][formattedVar.variableName] = formattedVar;
                                }
                            }
                        });
                        console.log("[ClassTypingService] Populated", Object.keys(this.polyVarTyping[typeObj.className]).length,
                                    "variables for", typeObj.className);
                    }

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
                    // polyVarTyping[typeObj.className] is already initialized and populated above
                    // Extract config from backend response (if available) for UI behavior control
                    const classConfig = typeObj.config ? {
                        allowClassEdit: typeObj.config.allowClassEdit ?? false,
                        isStateSpaceObject: typeObj.config.isStateSpaceObject ?? false,
                        excludeFromCRUDE: typeObj.config.excludeFromCRUDE ?? true,
                        isDynamicClass: typeObj.config.isDynamicClass ?? false
                    } : undefined;

                    this.polyTyping[typeObj.className] = new classPolyTyping(
                        typeObj.className,
                        this.polyVarTyping[typeObj.className],
                        className,
                        undefined, // variableNames - derived from completeVariableTypingData
                        undefined, // polyTypedVars
                        undefined, // variableTypes
                        classConfig // config from backend for UI behavior control
                    );
                    this.polyTypingBehaviorSubject.next(this.polyVarTyping);

                    // Setup the navComponent for the new type
                    // Check if this class is editable (can create/edit/delete instances)
                    const classTypingObj = this.polyTyping[typeObj.className] as classPolyTyping;
                    const isEditable = classTypingObj?.canEditInstances() ?? true;

                    let navComp : navComponent = new navComponent(
                        className,
                        "class-main-page/"+typeObj.className,
                        "ClassMainPageComponent",
                        {}, // crude
                        [], // queryParams
                        undefined, // componentModifiers
                        isEditable, // isEditable flag
                        typeObj.className // className
                    );

                    // Check if this class nav already exists in either list
                    const existingInUsed = this.dynamicClassNavComponents.findIndex(nc => nc.path === navComp.path);
                    const existingInUnused = this.unusedClassNavComponents.findIndex(nc => nc.path === navComp.path);

                    if (existingInUsed === -1 && existingInUnused === -1) {
                        // Categorize based on whether this class has instances
                        const hasInstances = this.classHasInstances(typeObj.className);

                        if (hasInstances) {
                            this.dynamicClassNavComponents.push(navComp);
                            this.dynamicClassNavComponents.sort((a, b) => a.title.localeCompare(b.title));
                            this.dynamicClassNavSubject.next([...this.dynamicClassNavComponents]);

                            // Also add to editable list if editable
                            if (isEditable) {
                                this.editableUsedClassNavComponents.push(navComp);
                                this.editableUsedClassNavComponents.sort((a, b) => a.title.localeCompare(b.title));
                                this.editableUsedClassNavSubject.next([...this.editableUsedClassNavComponents]);
                            }
                            console.log('[ClassTypingService] Added to USED nav for:', className, 'editable:', isEditable);
                        } else {
                            this.unusedClassNavComponents.push(navComp);
                            this.unusedClassNavComponents.sort((a, b) => a.title.localeCompare(b.title));
                            this.unusedClassNavSubject.next([...this.unusedClassNavComponents]);

                            // Also add to editable unused list if editable
                            if (isEditable) {
                                this.editableUnusedClassNavComponents.push(navComp);
                                this.editableUnusedClassNavComponents.sort((a, b) => a.title.localeCompare(b.title));
                                this.editableUnusedClassNavSubject.next([...this.editableUnusedClassNavComponents]);
                            }
                            console.log('[ClassTypingService] Added to UNUSED nav for:', className, 'editable:', isEditable);
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
     * Gets the classPolyTyping object for a class, which includes the config flags.
     * Use this to check permissions like canEditInstances(), canCreateInstances(), etc.
     * @param className The class name to look up
     * @returns The classPolyTyping object or null if not found
     */
    getClassPolyTyping(className: string): classPolyTyping | null {
        if (this.polyTyping.hasOwnProperty(className)) {
            return this.polyTyping[className] as classPolyTyping;
        }
        return null;
    }

    /**
     * Checks if instances of a class can be created through the UI.
     * @param className The class name to check
     * @returns true if create is allowed, false otherwise
     */
    canCreateInstances(className: string): boolean {
        const classTyping = this.getClassPolyTyping(className);
        return classTyping?.canCreateInstances() ?? false;
    }

    /**
     * Checks if instances of a class can be edited through the UI.
     * @param className The class name to check
     * @returns true if edit is allowed, false otherwise
     */
    canEditInstances(className: string): boolean {
        const classTyping = this.getClassPolyTyping(className);
        return classTyping?.canEditInstances() ?? false;
    }

    /**
     * Checks if instances of a class can be deleted through the UI.
     * @param className The class name to check
     * @returns true if delete is allowed, false otherwise
     */
    canDeleteInstances(className: string): boolean {
        const classTyping = this.getClassPolyTyping(className);
        return classTyping?.canDeleteInstances() ?? false;
    }

    /**
     * Checks if the class definition itself can be edited (add/remove variables).
     * @param className The class name to check
     * @returns true if class edit is allowed, false otherwise
     */
    canEditClassDefinition(className: string): boolean {
        const classTyping = this.getClassPolyTyping(className);
        return classTyping?.canEditClassDefinition() ?? false;
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
     * Also categorizes by editability.
     */
    recategorizeNavComponents() {
        // Get all dynamic nav components
        const allNavs = [...this.dynamicClassNavComponents, ...this.unusedClassNavComponents];

        // Reset all arrays
        this.dynamicClassNavComponents = [];
        this.unusedClassNavComponents = [];
        this.editableUsedClassNavComponents = [];
        this.editableUnusedClassNavComponents = [];

        allNavs.forEach(nav => {
            // Extract class name from path (format: "class-main-page/className") or use stored className
            const className = nav.className || (nav.path.split('/').length > 1 ? nav.path.split('/')[1] : '');

            // Update isEditable flag based on current polyTyping data
            const classTyping = this.getClassPolyTyping(className);
            nav.isEditable = classTyping?.canEditInstances() ?? true;

            const hasInstances = this.classesWithInstances.includes(className);

            if (hasInstances) {
                this.dynamicClassNavComponents.push(nav);
                if (nav.isEditable) {
                    this.editableUsedClassNavComponents.push(nav);
                }
            } else {
                this.unusedClassNavComponents.push(nav);
                if (nav.isEditable) {
                    this.editableUnusedClassNavComponents.push(nav);
                }
            }
        });

        // Sort all lists
        this.dynamicClassNavComponents.sort((a, b) => a.title.localeCompare(b.title));
        this.unusedClassNavComponents.sort((a, b) => a.title.localeCompare(b.title));
        this.editableUsedClassNavComponents.sort((a, b) => a.title.localeCompare(b.title));
        this.editableUnusedClassNavComponents.sort((a, b) => a.title.localeCompare(b.title));

        // Emit updates
        this.dynamicClassNavSubject.next([...this.dynamicClassNavComponents]);
        this.unusedClassNavSubject.next([...this.unusedClassNavComponents]);
        this.editableUsedClassNavSubject.next([...this.editableUsedClassNavComponents]);
        this.editableUnusedClassNavSubject.next([...this.editableUnusedClassNavComponents]);

        console.log('[ClassTypingService] Recategorized - Used:', this.dynamicClassNavComponents.length,
                    'Unused:', this.unusedClassNavComponents.length,
                    'Editable Used:', this.editableUsedClassNavComponents.length,
                    'Editable Unused:', this.editableUnusedClassNavComponents.length);
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