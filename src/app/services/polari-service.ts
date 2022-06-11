import { Injectable, EventEmitter, ErrorHandler } from "@angular/core";
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { polariNode } from "@models/polariNode";
import { BehaviorSubject, Subject, throwError } from "rxjs";
import { retry, catchError } from 'rxjs/operators';
import { navComponent } from "@models/navComponent";
import { classPolyTyping } from "@models/classPolyTyping";
import { dataSetCollection } from "@models/dataSetCollection";


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
            "ip":"",
            "port":"",
            "crudeAPIs":[],
            "polariAPIs":[]
        }
    );
    connectionPendingSubject = new BehaviorSubject<boolean>(false);
    connectionSuccessSubject = new BehaviorSubject<boolean>(false);
    connectionFailureSubject = new BehaviorSubject<boolean>(false);
    //User Input values for changing the connection to a new IP/Port combination.
    userEntry_ipv4NumSubject = new BehaviorSubject<string>("");
    userEntry_portNumSubject = new BehaviorSubject<string>("");
    //
    navComponents = new BehaviorSubject<navComponent[]>([
        new navComponent("Home","","HomeComponent", {}, []),
        new navComponent("Polari Configuration","polari-config","PolariConfigComponent", {}, []),
        new navComponent("Template Class Test","template-class-test","templateClassTestComponent", {}, [])
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
    classDataRetrievedSwitchboard = new BehaviorSubject<any>({});
    //
    valueHolder : any;

    constructor(private http: HttpClient)
    {
        console.log("Starting PolariService")
        this.http = http
    }
    
    //Sets the baseline connection with the Polari Server and retrieves all necessary APIs and Typing data for creating
    //or enabling any components that require data from the server.
    establishPolariConnection(){
        console.log("Starting Polari Connection in Polari Service with url: " + 'http://' + this.userEntry_ipv4NumSubject.value + ':' + this.userEntry_portNumSubject.value)
        this.connectionPendingSubject.next(true);
        this.connectionSuccessSubject.next(false);
        this.connectionFailureSubject.next(false);
        this.getObjectTyping();
        this.getTypingVars();
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

    getObjectTyping()
    {
        this.http
        .get<any>('http://' + this.userEntry_ipv4NumSubject.value + ':' + this.userEntry_portNumSubject.value + '/polyTypedObject', this.backendRequestOptions)
        .subscribe({
            next: response =>{
                let interpretedData = new dataSetCollection(response);
                let instanceSet = interpretedData.getClassInstanceList("polyTypedObject");
                try {
                    this.polyTypedObjectsData.next(instanceSet);
                    let tempSwitchBoard = this.classDataRetrievedSwitchboard.value;
                    tempSwitchBoard["polyTypedObject"] = true;
                    this.classDataRetrievedSwitchboard.next(tempSwitchBoard);
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

    getTypingVars()
    {
        this.http
        .get<any>('http://' + this.userEntry_ipv4NumSubject.value + ':' + this.userEntry_portNumSubject.value + '/polyTypedVariable', this.backendRequestOptions)
        .subscribe({
            next: response =>{
                let interpretedData = new dataSetCollection(response);
                let instanceSet = interpretedData.getClassInstanceList("polyTypedVariable");
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

    getServerData()
    {
        this.http
        .get<any>('http://' + this.userEntry_ipv4NumSubject.value + ':' + this.userEntry_portNumSubject.value + '/polariServer', this.backendRequestOptions)
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

    getServerAPIendpoints()
    {
        this.http
        .get<any>('http://' + this.userEntry_ipv4NumSubject.value + ':' + this.userEntry_portNumSubject.value + '/polariAPI', this.backendRequestOptions)
        .subscribe({
            next: response =>{
                let interpretedData = new dataSetCollection(response);
                let instanceSet = interpretedData.getClassInstanceList("polariAPI");
                try {
                    this.serverData.next(instanceSet);
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

    getServerCRUDEendpoints()
    {
        this.http
        .get<any>('http://' + this.userEntry_ipv4NumSubject.value + ':' + this.userEntry_portNumSubject.value + '/polariCRUDE', this.backendRequestOptions)
        .subscribe({
            next: response =>{
                let interpretedData = new dataSetCollection(response);
                let instanceSet = interpretedData.getClassInstanceList("polariCRUDE");
                try {
                    this.serverData.next(instanceSet);
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

    /*
    //CREATE
    createOnPolariEndpoint(urlEndpoint){

    }

    //READ
    readFromPolariEndpoint(urlEndpoint){

    }

    //UPDATE
    updateOnPolariEndpoint(urlEndpoint){

    }

    //DELETE
    deleteOnPolariEndpoint(urlEndpoint){

    }

    //EVENT
    triggerEventOnPolariEndpoint(urlEndpoint){

    }
    */
}