import { Injectable, EventEmitter } from "@angular/core";
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { PolariService } from "./polari-service"

//Create a service that utilizes any available Class on the Server's polari Node, using it's CRUDE API.
@Injectable()
export class CRUDEclassService {
    //Tracks the components or other services utilizing this class Service at a given moment.
    //After construction of the service, if this list becomes empty the service shuts down.
    serviceUtilizers: any;
    permissionsDictionaries: any;
    accessDictionaries: any;
    hasAnyAccess: any;
    hasAnyPermissions: any;
    hasFullAccess: any;
    hasFullPermissions: any;
    className: string | null = null;

    constructor(private http: HttpClient, private polariService: PolariService)
    {
        let startServiceMsg = "Starting Class Access Services";
        console.log(startServiceMsg);
        this.http = http;
        this.polariService = polariService;
        this.serviceUtilizers = {};
        //All permissions dictionaries for this user for this class
        this.permissionsDictionaries = {};
        //All access dictionaries for this user for this class.
        this.accessDictionaries = {};
        //If either is false, cannot access this API at all.  If a component is dependent on this API, this is the indicator that
        //the purpose of this API cannot be fulfilled due to insufficient Access & Permissions.
        //Dictionaries with format: {"className0":true, "className1":false}
        this.hasAnyAccess = {};
        this.hasAnyPermissions = {};
        //If true, the user has been previously analyzed to have full access to this API from their permission/access Queries.
        //On the polari side this means that a check is made to see if the user has de-facto full access on the API's registrar,
        //which allows for the validation process to potentially occur much faster for that user.
        //Note: De-facto full access is revoked from all APIs using a given class whenever that user has a Permissions or Access
        //dictionary that changes.
        //Dictionaries with format: {"className0":true, "className1":false}
        this.hasFullAccess = {};
        this.hasFullPermissions = {};
    }

    // hacky way to get around not being able to just pass the class name into the service.
    initialize(className : string)
    {
        this.className = className;
    }

    
}