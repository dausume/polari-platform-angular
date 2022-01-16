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
    isConnectedSubject = new BehaviorSubject<boolean>(false);
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
    //A list of CRUDE Services that are currently active, so that they can be re-used if a new component requiring them is created.
    crudeClassServices = []
    //A list of non-CRUDE API Services that are currently active, such that they are re-usable.
    apiServices = []
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
        console.log(this.connectionPendingSubject.value)
        this.http
        .get<any>('http://' + this.userEntry_ipv4NumSubject.value + ':' + this.userEntry_portNumSubject.value, this.backendRequestOptions)
        .subscribe({
            next: response =>{
                console.log("starting subscription process for Polari Connection");
                console.log(response);
                let coreData = new dataSetCollection(response);
                this.connectionDataSubject.next(coreData);
                this.serverData.next(coreData.getClassInstanceList("polariServer"));
                this.serverAPIendpoints.next(coreData.getClassInstanceList("polariAPI"));
                this.serverCRUDEendpoints.next(coreData.getClassInstanceList("polariCRUDE"));
                this.polyTypedObjectsData.next(coreData.getClassInstanceList("polyTypedObject"));
                this.polyTypedVarsData.next(coreData.getClassInstanceList("polyTypedVars"));
                /*
                try {
                    this.connectionDataSubject.next(response);
                    console.log("response data");
                    console.log(response);
                    //console.log("BaseElement");
                    //console.log(response.data);
                    let apisList : any[];
                    apisList = [];
                    let crudeAPIsList : any[];
                    crudeAPIsList = [];
                    let serverInstance = {};
                    let serverData : any[];
                    let objDataSetsArray : any[];
                    let keySet : any[];
                    serverData = response;
                    serverData.forEach( baseData =>{
                        keySet = Object.keys(baseData);
                        keySet.forEach( objectType => {
                            console.log("Iterating type: ", objectType)
                            objDataSetsArray = baseData[objectType]
                            objDataSetsArray.forEach(dataSet => {
                            console.log("Iterating dataSet");
                            console.log(dataSet);
                            if(dataSet["class"] == "polariAPI")
                            {
                                apisList.concat(dataSet["data"]);
                            }
                            else if(dataSet["class"] == "polariCRUDE")
                            {
                                crudeAPIsList.concat(dataSet["data"]);
                            }
                            else if(dataSet["class"] == "polariServer")
                            {
                                if(serverInstance == {})
                                {
                                    if(dataSet["data"].length == 1)
                                    {
                                        serverInstance = dataSet["data"][0];
                                    }
                                    else if(dataSet["data"].length == 0)
                                    {
                                        console.error("Recieved dataSet for PolariServer for base API, but the dataSet was empty.  Should contain data of Server being accessed.");
                                    }
                                    else
                                    {
                                        console.error("Found more than one polari server at base Polari API, should only be one - the data of the server being accessed.");
                                    }
                                }
                                else
                                {
                                    console.error("Found two server instances in polari server base data, should only be one at basis, connected servers should be retrieved through the CRUDE API.");
                                }
                            }
                            else
                            {
                                console.log("-- WARNING: Found data set that should not exist in a base API --");
                                console.log(dataSet);
                            }
                        });
                    });
                });
                    console.log("Connection DataSubject Set.")
                    console.log(this.connectionDataSubject.pipe());
                } catch (error) {
                    console.log("--Caught Error--");
                    console.log(error);
                }
                */
            },
            error: err =>{
                console.log("--Caught Error--");
                console.log(err);
                this.connectionPendingSubject.next(false);
                //Detect failure to make connection.
                this.connectionFailureSubject.next(true);
                setTimeout(() => {
                  this.connectionFailureSubject.next(false);
                }, 6000);
                  
            },
            complete: () => {

                console.log("Completed API ping on Polari Server.")
            }
        })
        //Get all PolyTypedObjects
        //this.getObjectTyping()
        //Get all polyTypedVars for the polyTypedObjects.
        //this.getTypingVars()
        this.connectionPendingSubject.next(false);
    }

    createMainObjectPages(){
        this.polyTypedObjectsData.subscribe(polyTypedObjs => {
            let navObjHolder : navComponent;
            //Create necessary navigation objects for each object type
            polyTypedObjs.array.forEach((polyTypedObj : classPolyTyping) => {
                //Create navigation object for the class.
                navObjHolder = new navComponent(
                    polyTypedObj.objectName, //title
                    "", //path
                    "", //comp
                    [], //queryParams
                    [] //authGroups
                    );
            });
        })
    }

    getObjectTyping()
    {
        this.http
        .get<any>('http://' + this.userEntry_ipv4NumSubject.value + ':' + this.userEntry_portNumSubject.value + '/polyTypedObjects', this.backendRequestOptions)
        .subscribe({
            next: response =>{
                console.log("getting typing data from server");
                console.log(response);
                let objectTypingData = new dataSetCollection(response);
                try {
                    this.polyTypedObjectsData.next(response.body["polyTypedObjects"]);
                    console.log("Loaded values onto polyTypedObjectsData")
                    console.log(response.body["polyTypedObjects"])
                }
                catch (error)
                {
                    console.log("--Caught Error--");
                    console.log(error);
                }
            },
            error: err =>{
                console.log("--Caught Error--");
                console.log(err);                  
            },
            complete: () => {
                console.log("Retrieved typing data, now retrieving polyTypingVars.");
                this.getTypingVars();
            }
        })
    }

    getTypingVars()
    {
        this.http
        .get<any>('http://' + this.userEntry_ipv4NumSubject.value + ':' + this.userEntry_portNumSubject.value + '/polyTypedVars', this.backendRequestOptions)
        .subscribe({
            next: response =>{
                console.log("getting variable typing data from server");
                console.log(response);
                try {
                    this.polyTypedVarsData.next(response.body["polyTypedVars"]);
                }
                catch (error)
                {
                    console.log("--Caught Error--");
                    console.log(error);
                }
            },
            error: err =>{
                console.log("--Caught Error--");
                console.log(err);                  
            },
            complete: () => {
                console.log("Retrieved typing data.")
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