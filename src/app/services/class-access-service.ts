import { Injectable, EventEmitter } from "@angular/core";
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { PolariService } from "./polari-service"

//Create a service that utilizes any available Class on the Server's polari Node, using it's CRUDE API.
@Injectable()
export class ClassAccessService {
    //Tracks the components or other services utilizing this class Service at a given moment.
    //After construction of the service, if this list becomes empty the service shuts down.
    serviceUtilizers: string[];
    permissionsDictionaries: any[];
    accessDictionaries: any[];
    hasAnyAccess: boolean;
    hasAnyPermissions: boolean;
    hasFullAccess: boolean;
    hasFullPermissions: boolean;

    constructor(private http: HttpClient, private polariService: PolariService, public className: string, public firstUtilizer: string)
    {
        let startServiceMsg = "Starting CRUDE Class Service for " + className;
        console.log(startServiceMsg);
        this.http = http;
        this.polariService = polariService;
        this.className = className;
        this.serviceUtilizers = [firstUtilizer];
        //All permissions dictionaries for this user for this class
        this.permissionsDictionaries = [];
        //All access dictionaries for this user for this class.
        this.accessDictionaries = [];
        //If either is false, cannot access this API at all.  If a component is dependent on this API, this is the indicator that
        //the purpose of this API cannot be fulfilled due to insufficient Access & Permissions.
        this.hasAnyAccess = false;
        this.hasAnyPermissions = false;
        //If true, the user has been previously analyzed to have full access to this API from their permission/access Queries.
        //On the polari side this means that a check is made to see if the user has de-facto full access on the API's registrar,
        //which allows for the validation process to potentially occur much faster for that user.
        //Note: De-facto full access is revoked from all APIs using a given class whenever that user has a Permissions or Access
        //dictionary that changes.
        this.hasFullAccess = false;
        this.hasFullPermissions = false;
    }

    //If the user is logged in, then get the Permission and Access Dictionaries of the user relevant to this class.
    validatePermissions()
    {

    }
}