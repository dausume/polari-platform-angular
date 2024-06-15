import { Injectable, EventEmitter, ErrorHandler } from "@angular/core";
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { polariNode } from "@models/polariNode";
import { BehaviorSubject, timer, Subject, throwError, of } from "rxjs";
import { catchError, delayWhen, retryWhen, switchMap, tap, retry } from 'rxjs/operators';
import { navComponent } from "@models/navComponent";
import { classPolyTyping } from "@models/classPolyTyping";
import { dataSetCollection } from "@models/dataSetCollection";
import { CRUDEclassService } from "./crude-class-service";
import { environment } from "src/environments/environment";


@Injectable({
    providedIn: 'root'
})
export class PolariService {
    //Subjects allow for the Parent Component and any number of child components to subscribe to the variables
    //as Observers to read and modify them.
    backendHeadersDict = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Access-Control-Allow-Headers': 'Content-Type',
        //Implement functionality to narrow this down to only the backend url.
        'Access-Control-Allow-Origin' : '*'
    }
      
    backendRequestOptions = {                                                                                                                                                                                 
        headers: new HttpHeaders(this.backendHeadersDict), 
    };

    polariAccessNodeSubject = new BehaviorSubject<polariNode>(
        {
            "ip":environment.backendUrl,
            "port":environment.backendPort,
            "crudeAPIs":[],
            "polariAPIs":[]
        }
    );
    connectionPendingSubject = new BehaviorSubject<boolean>(false);
    connectionSuccessSubject = new BehaviorSubject<boolean>(false);
    connectionFailureSubject = new BehaviorSubject<boolean>(false);
    //User Input values for changing the connection to a new IP/Port combination.
    userEntry_ipv4NumSubject = new BehaviorSubject<string>(environment.backendUrl);
    userEntry_portNumSubject = new BehaviorSubject<string>(environment.backendPort);
    //
    navComponents = new BehaviorSubject<navComponent[]>([
        new navComponent("Home","","HomeComponent", {}, []),
        new navComponent("Polari Configuration","polari-config","PolariConfigComponent", {}, []),
        new navComponent("Template Class Test","template-class-test","templateClassTestComponent", {}, []),
        new navComponent("Create Class","create-class","CreateNewClassComponent", {}, [])
    ]);
    //Actual Recieved Data From base of Polari Server
    connectionDataSubject = new BehaviorSubject<any>({});
    //Object instance of the Polari Server issuing this data itself.
    serverData = new BehaviorSubject<any>({});
    //Endpoints of any custom APIs on the server which give out grouped data which may contain dataSets of various class instances.
    serverAPIendpoints = new BehaviorSubject<any>([]);
    //Endpoints of the CRUDE (Create/Read/Update/Delete/Events) access for generalized access to a specific given class.
    serverCRUDEendpoints = new BehaviorSubject<any>([]);
    //The PolyTypingData which gives the different typing information for each of the classes used on the Server.
    polyTypedObjectsData = new BehaviorSubject<any>([]);
    //The PolyTypingData which gives the different typing information for each of the classes used on the Server.
    polyTypedVarsData = new BehaviorSubject<any>([]);
    //DICTIONARIES USED FOR MANAGING SPECIFIC SERVICES, MANAGED USING DICTIONARIES
    //A dictionary of non-standard CRUDE Services that are currently active, so that they can be re-used if a new component requiring them is created.
    crudeClassServices = new BehaviorSubject<any>({});
    //A list of non-CRUDE API Services that are currently active, such that they are re-usable.
    apiClassServices = new BehaviorSubject<any>({});
    //A switchboard indicating whether a particular class, has had it's api pinged at least once
    // This switchboard is required to ensure that all required classes have their data pulled before activating
    // Functionality dependent on their data.
    classDataRetrievedSwitchboard = new BehaviorSubject<any>({});
    //
    valueHolder : any;
    env: any;
    // List of all class-specific services dynamically generated.
    private classServices: { [className: string]: any } = {};

    constructor(private http: HttpClient)
    {
        console.log("Starting PolariService")
        this.http = http;
        if(environment.backendUrl && environment.backendPort)
        {
            this.polariAccessNodeSubject.next({
                "ip":environment.backendUrl,
                "port":environment.backendPort,
                "crudeAPIs":[],
                "polariAPIs":[]
            });
            this.userEntry_ipv4NumSubject.next(environment.backendUrl);
            this.userEntry_portNumSubject.next(environment.backendPort);
        }
      //Triggers the attempt to connect to the Polari Node with the set polariService values.
      this.establishPolariConnection()
    }
    
    //Sets the baseline connection with the Polari Server and retrieves all necessary APIs and Typing data for creating
    //or enabling any components that require data from the server.
    establishPolariConnection(){
        console.log("Starting Polari Connection in Polari Service with url: " + 'http://' + this.userEntry_ipv4NumSubject.value + ':' + this.userEntry_portNumSubject.value)
        this.connectionPendingSubject.next(true);
        this.connectionSuccessSubject.next(false);
        this.connectionFailureSubject.next(false);
        this.getObjectTyping();
        this.getServerAPIendpoints();
        this.getServerCRUDEendpoints();
        this.getServerData();
        this.connectionPendingSubject.next(false);
    }

    checkConnectionEstablished()
    {
        let classSwitchboard = this.classDataRetrievedSwitchboard.value
        let requiredClassData = ["polariCRUDE","polariAPI","polariServer","polyTypedObject","polyTypedVariable"]
        if(("polariCRUDE" in classSwitchboard) && ("polariAPI" in classSwitchboard) && ("polariServer" in classSwitchboard) && ("polyTypedObject" in classSwitchboard) && ("polyTypedVariable" in classSwitchboard))
        {
            let someClass : string
            let allRequiredClassesAccounted = true;
            for(someClass in Object.keys(classSwitchboard))
            {
                if(someClass in requiredClassData)
                {
                    if(classSwitchboard[someClass] = false)
                        {
                            allRequiredClassesAccounted = false;
                            this.connectionPendingSubject.next(false);
                            //Detect failure to make connection.
                            this.connectionFailureSubject.next(true);
                            this.classDataRetrievedSwitchboard.unsubscribe();
                            this.polyTypedVarsData.unsubscribe();
                            this.polyTypedObjectsData.unsubscribe();
                            this.serverAPIendpoints.unsubscribe();
                            this.serverCRUDEendpoints.unsubscribe();
                            this.serverData.unsubscribe();
                            setTimeout(() => {
                            this.connectionFailureSubject.next(false);
                            }, 6000);
                        }
                    }
                }
                if(allRequiredClassesAccounted == true)
                {
                    this.connectionPendingSubject.next(false);
                    this.connectionSuccessSubject.next(true);
                }
            }        
    }

    // Gets all objects defined on the Polari Server, then calls the Variable Typing API after completion
    // since converting them into a usable format requires both and variables are dependent on the objects.
    getObjectTyping()
    {
        this.http
        .get<any>('http://' + this.userEntry_ipv4NumSubject.value + ':' + this.userEntry_portNumSubject.value + '/polyTypedObject', this.backendRequestOptions)
        .pipe(
            retryWhen(errors => errors.pipe(
                tap(err => {
                    console.log("--Threw Error--");
                    console.log(err);
                    //let tempSwitchBoard = this.classDataRetrievedSwitchboard.value;
                    //tempSwitchBoard["polyTypedObject"] = false;
                    //this.classDataRetrievedSwitchboard.next(tempSwitchBoard);
                }),
                delayWhen(() => timer(3000)),  // Delay for 3 seconds before retrying
                tap(() => console.log("Retrying getObjectTyping..."))
            )),
            catchError(error => {
                console.error("Retries exhausted:", error);
                return of(null);  // or return throwError(error) if you want to propagate the error
            })
        )
        .subscribe({
            next: response =>{
                let interpretedData = new dataSetCollection(response);
                let instanceSet = interpretedData.getClassInstanceList("polyTypedObject");
                try {
                    this.polyTypedObjectsData.next(instanceSet);
                    let tempSwitchBoard = this.classDataRetrievedSwitchboard.value;
                    tempSwitchBoard["polyTypedObject"] = true;
                    this.classDataRetrievedSwitchboard.next(tempSwitchBoard);
                    this.getTypingVars();
                }
                catch (error)
                {
                    console.log("--Caught Error--");
                    console.log(error);
                    let tempSwitchBoard = this.classDataRetrievedSwitchboard.value;
                    tempSwitchBoard["polyTypedObject"] = false;
                    this.classDataRetrievedSwitchboard.next(tempSwitchBoard);   
                }
            },
            error: err =>{
                console.log("--Threw Error--");
                console.log(err);
                let tempSwitchBoard = this.classDataRetrievedSwitchboard.value;
                tempSwitchBoard["polyTypedObject"] = false;
                this.classDataRetrievedSwitchboard.next(tempSwitchBoard);                  
            },
            complete: () => {
                this.checkConnectionEstablished();
            }
        })
    }

    // Gets all Variable types and connects them to their object types, these are required in order to automate
    // the building of the frontend interfaces.
    getTypingVars()
    {
        this.http
        .get<any>('http://' + this.userEntry_ipv4NumSubject.value + ':' + this.userEntry_portNumSubject.value + '/polyTypedVariable', this.backendRequestOptions)
        .pipe(
            retryWhen(errors => errors.pipe(
                tap(err => {
                    console.log("--Threw Error--");
                    console.log(err);
                }),
                delayWhen(() => timer(3000)),  // Delay for 3 seconds before retrying
                tap(() => console.log("Retrying getTypingVars..."))
            )),
            catchError(error => {
                console.error("Retries exhausted:", error);
                return of(null);  // or return throwError(error) if you want to propagate the error
            })
        )
        .subscribe({
            next: response =>{
                console.log("vars response: ", response);
                let interpretedData = new dataSetCollection(response);
                let instanceSet = interpretedData.getClassInstanceList("polyTypedVariable");
                console.log("instance set: ", response);
                try {
                    this.polyTypedVarsData.next(instanceSet);
                    let tempSwitchBoard = this.classDataRetrievedSwitchboard.value;
                    tempSwitchBoard["polyTypedVariable"] = true;
                    this.classDataRetrievedSwitchboard.next(tempSwitchBoard);
                }
                catch (error)
                {
                    console.log("--Caught Error--");
                    console.log(error);
                    let tempSwitchBoard = this.classDataRetrievedSwitchboard.value;
                    tempSwitchBoard["polyTypedVariable"] = false;
                    this.classDataRetrievedSwitchboard.next(tempSwitchBoard);   
                }
            },
            error: err =>{
                console.log("--Threw Error--");
                console.log(err);
                let tempSwitchBoard = this.classDataRetrievedSwitchboard.value;
                tempSwitchBoard["polyTypedVariable"] = false;
                this.classDataRetrievedSwitchboard.next(tempSwitchBoard);                
            },
            complete: () => {
                this.checkConnectionEstablished();
            }
        })
    }

    // Gets the general data on the server so we know if we need to connect to multiple backends for the app use-case.
    getServerData()
    {
        this.http
        .get<any>('http://' + this.userEntry_ipv4NumSubject.value + ':' + this.userEntry_portNumSubject.value + '/polariServer', this.backendRequestOptions)
        .pipe(
            retryWhen(errors => errors.pipe(
                tap(err => {
                    console.log("--Threw Error--");
                    console.log(err);
                }),
                delayWhen(() => timer(3000)),  // Delay for 3 seconds before retrying
                tap(() => console.log("Retrying getServerData..."))
            )),
            catchError(error => {
                console.error("Retries exhausted:", error);
                return of(null);  // or return throwError(error) if you want to propagate the error
            })
        )
        .subscribe({
            next: response =>{
                let interpretedData = new dataSetCollection(response);
                let instanceSet = interpretedData.getClassInstanceList("polariServer");
                try {
                    this.serverData.next(instanceSet);
                    let tempSwitchBoard = this.classDataRetrievedSwitchboard.value;
                    tempSwitchBoard["polariServer"] = true;
                    this.classDataRetrievedSwitchboard.next(tempSwitchBoard);
                }
                catch (error)
                {
                    console.log("--Caught Error--");
                    console.log(error);
                }
            },
            error: err =>{
                console.log("--Threw Error--");
                console.log(err);
                let tempSwitchBoard = this.classDataRetrievedSwitchboard.value;
                tempSwitchBoard["polariServer"] = false;
                this.classDataRetrievedSwitchboard.next(tempSwitchBoard);                       
            },
            complete: () => {
                this.checkConnectionEstablished();
            }
        })
    }

    // Gets all existing api endpoints on the polari api endpoint. (Custom APIs - Not class-based)
    getServerAPIendpoints()
    {
        this.http
        .get<any>('http://' + this.userEntry_ipv4NumSubject.value + ':' + this.userEntry_portNumSubject.value + '/polariAPI', this.backendRequestOptions)
        .pipe(
            retryWhen(errors => errors.pipe(
                tap(err => {
                    console.log("--Threw Error--");
                    console.log(err);
                }),
                delayWhen(() => timer(3000)),  // Delay for 3 seconds before retrying
                tap(() => console.log("Retrying getServerData..."))
            )),
            catchError(error => {
                console.error("Retries exhausted:", error);
                return of(null);  // or return throwError(error) if you want to propagate the error
            })
        )
        .subscribe({
            next: response =>{
                let interpretedData = new dataSetCollection(response);
                let instanceSet = interpretedData.getClassInstanceList("polariAPI");
                try {
                    this.serverAPIendpoints.next(instanceSet);
                    let tempSwitchBoard = this.classDataRetrievedSwitchboard.value;
                    tempSwitchBoard["polariAPI"] = true;
                    this.classDataRetrievedSwitchboard.next(tempSwitchBoard);
                }
                catch (error)
                {
                    console.log("--Caught Error--");
                    console.log(error);
                }
            },
            error: err =>{
                console.log("--Threw Error--");
                console.log(err);
                let tempSwitchBoard = this.classDataRetrievedSwitchboard.value;
                tempSwitchBoard["polariAPI"] = false;
                this.classDataRetrievedSwitchboard.next(tempSwitchBoard);              
            },
            complete: () => {
                this.checkConnectionEstablished();
            }
        })
    }

    // Gets all existing CRUDE (Create, Read, Update, Delete, Event endpoints)
    getServerCRUDEendpoints()
    {
        this.http
        .get<any>('http://' + this.userEntry_ipv4NumSubject.value + ':' + this.userEntry_portNumSubject.value + '/polariCRUDE', this.backendRequestOptions)
        .pipe(
            retryWhen(errors => errors.pipe(
                tap(err => {
                    console.log("--Threw Error--");
                    console.log(err);
                }),
                delayWhen(() => timer(3000)),  // Delay for 3 seconds before retrying
                tap(() => console.log("Retrying polariCRUDE..."))
            )),
            catchError(error => {
                console.error("Retries exhausted:", error);
                return of(null);  // or return throwError(error) if you want to propagate the error
            })
        )
        .subscribe({
            next: response =>{
                let interpretedData = new dataSetCollection(response);
                let instanceSet = interpretedData.getClassInstanceList("polariCRUDE");
                try {
                    this.serverCRUDEendpoints.next(instanceSet);
                    let tempSwitchBoard = this.classDataRetrievedSwitchboard.value;
                    tempSwitchBoard["polariCRUDE"] = true;
                    this.classDataRetrievedSwitchboard.next(tempSwitchBoard);
                }
                catch (error)
                {
                    console.log("--Caught Error--");
                    console.log(error);
                }
            },
            error: err =>{
                console.log("--Threw Error--");
                console.log(err);
                let tempSwitchBoard = this.classDataRetrievedSwitchboard.value;
                tempSwitchBoard["polariCRUDE"] = false;
                this.classDataRetrievedSwitchboard.next(tempSwitchBoard);
            },
            complete: () => {
                this.checkConnectionEstablished();
            }
        })
    }

    // Creates a singular service for a specific CRUDE Class.
    createServiceForClass(className: string) {
        // Check if the service already exists
        if (!this.classServices[className]) {
          // If not, create a new service for the class using CrudeClassService
          this.classServices[className] = new CRUDEclassService(this.http, this);
          this.classServices[className].initialize(className);
        }
        return this.classServices[className];
    }

    // Removes a CRUDE Class so that we can free up space and processing power.
    removeServiceForClass(className: string) {
        if (this.classServices[className]) {
          // Clean up resources or perform any necessary shutdown operations
          delete this.classServices[className];
        }
    }
}