import { Injectable, EventEmitter } from "@angular/core";
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { PolariService } from "./polari-service"

//Create a service that utilizes any available Class on the Server's polari Node, using it's CRUDE API.
@Injectable()
export class ClassService {
    permissionsDictionaries: any;
    accessDictionaries: any;

    constructor(private http: HttpClient, private polariService: PolariService, public className: string, public firstUtilizer: string)
    {
        let startServiceMsg = "Starting CRUDE Class Service for " + className;
        console.log(startServiceMsg);
        this.http = http;
        this.polariService = polariService;
        //All permissions dictionaries for this user for this class
        this.permissionsDictionaries = [];
        //All access dictionaries for this user for this class.
        this.accessDictionaries = [];
    }

    
}