// crude-class-service.ts
import { Injectable, EventEmitter } from "@angular/core";
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { Observable, throwError } from "rxjs";
import { PolariService } from "./polari-service"

// Create a service that utilizes any available Class on the Server's polari Node, using it's CRUDE API.
// CRUDE APIs being Create, Read, Update, Delete, and Events on a particular python class on the Polari Node.
// One instance of this service is created for each class that is accessed by the user.
@Injectable()
export class CRUDEclassService {
    //Tracks the components utilizing this class Service instance at a given moment.
    //After construction of the service, if this list becomes empty the service shuts down.
    serviceUtilizers: any; //Dictionary with format: {"componentName0":true, "componentName1":false}
    // The name of the class that this service is accessing.
    // This should be dynamically assigned when creating a new instance of this service.
    className: string = '';

    constructor(private http: HttpClient, private polariService: PolariService)
    {
        let startServiceMsg = "Starting Class Access Services";
        console.log(startServiceMsg);
        this.http = http;
        this.polariService = polariService;
        this.serviceUtilizers = {};
    }

    create(data: any): Observable<any> {
        return this.http.post(`/api/${this.className}`, data);
      }
      
      read(id: string): Observable<any> {
        return this.http.get(`/api/${this.className}/${id}`);
      }
      
      update(id: string, data: any): Observable<any> {
        return this.http.put(`/api/${this.className}/${id}`, data);
      }
      
      delete(id: string): Observable<any> {
        return this.http.delete(`/api/${this.className}/${id}`);
      }
      
      subscribeToEvents(): Observable<any> {
        return new Observable((observer) => {
          const eventSource = new EventSource(`/api/${this.className}/events`);
          eventSource.onmessage = (event) => observer.next(event.data);
          eventSource.onerror = (error) => observer.error(error);
          return () => eventSource.close();
        });
      }
      

    // hacky way to get around not being able to just pass the class name into the service.
    initialize(className : string)
    {
        this.className = className;
    }

    checkUtilizers(): void {
        if (Object.keys(this.serviceUtilizers).length === 0) {
          console.log(`Shutting down service for ${this.className}`);
          // Perform any cleanup here
        }
      }
      
      addUtilizer(componentName: string): void {
        this.serviceUtilizers[componentName] = true;
      }
      
      removeUtilizer(componentName: string): void {
        delete this.serviceUtilizers[componentName];
        this.checkUtilizers();
      }
      
}