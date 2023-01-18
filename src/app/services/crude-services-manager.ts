import { Injectable, EventEmitter } from "@angular/core";
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { PolariService } from "./polari-service"

//Generates and Manages the CRUDE class services for all class types.
@Injectable()
export class CRUDEservicesManager {
    
    constructor(private http: HttpClient, private polariService: PolariService)
    {
        let startServiceMsg = "Starting General Class Access Services";
        console.log(startServiceMsg);
        this.http = http;
        this.polariService = polariService;
        this.polariService.serverCRUDEendpoints.subscribe(
            value => {
                console.log("Successfully recieved CRUDE endpoints");
              console.log(value);
            },
            error => {
              console.error(error);
            },
            () => {
              console.log('completed apis');
            }
        );
    }
}