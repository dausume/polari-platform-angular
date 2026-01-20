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
        const url = `${this.polariService.getBackendBaseUrl()}/${this.className}`;
        console.log(`[CRUDEclassService] CREATE ${this.className} url: ${url}`);
        return this.http.post(url, data, this.polariService.backendRequestOptions);
      }

      read(id: string): Observable<any> {
        const url = `${this.polariService.getBackendBaseUrl()}/${this.className}/${id}`;
        console.log(`[CRUDEclassService] READ ${this.className}/${id} url: ${url}`);
        return this.http.get(url, this.polariService.backendRequestOptions);
      }

      readAll(): Observable<any> {
        const url = `${this.polariService.getBackendBaseUrl()}/${this.className}`;
        console.log(`[CRUDEclassService] READ_ALL ${this.className} url: ${url}`);
        return this.http.get(url, this.polariService.backendRequestOptions);
      }

      update(id: string, data: any): Observable<any> {
        const url = `${this.polariService.getBackendBaseUrl()}/${this.className}/${id}`;
        console.log(`[CRUDEclassService] UPDATE ${this.className}/${id} url: ${url}`);
        return this.http.put(url, data, this.polariService.backendRequestOptions);
      }

      delete(id: string): Observable<any> {
        const url = `${this.polariService.getBackendBaseUrl()}/${this.className}/${id}`;
        console.log(`[CRUDEclassService] DELETE ${this.className}/${id} url: ${url}`);
        return this.http.delete(url, this.polariService.backendRequestOptions);
      }

      subscribeToEvents(): Observable<any> {
        return new Observable((observer) => {
          const url = `${this.polariService.getBackendBaseUrl()}/${this.className}/events`;
          console.log(`[CRUDEclassService] SUBSCRIBE_EVENTS ${this.className} url: ${url}`);
          const eventSource = new EventSource(url);
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