// crude-services-manager.ts
import { Injectable, EventEmitter } from "@angular/core";
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { PolariService } from "./polari-service"
import { CRUDEclassService } from "./crude-class-service"

// Generates and Manages the CRUDE class services for all class types.
// Allows for application level state management of all class services.
// This service is used to manage all crude class services for the application.
@Injectable()
export class CRUDEservicesManager {
    // Dictionary of all CRUDE class services for the application.
    crudeServices: Record<string, CRUDEclassService> = {}; //Dictionary with format: {"className0":CRUDEclassService0, "className1":CRUDEclassService1}
    // Dictionary of all CRUDE endpoints for the application, retrieved from the polari backend.
    classCrudeEndpoints: Record<string, string> = {}; //Dictionary with format: {"className0":"/api/className0", "className1":"/api/className1"}
    // Maintains accountability of all components utilizing the CRUDE services via a dictionary of component names.
    // If a given component type drops to 0, we check the services to see if they are still being utilized.
    componentUtilizerCounter: Record<string, number> = {}; //Dictionary with format: {"componentName0":2, "componentName1":4}
    
    constructor(private http: HttpClient, private polariService: PolariService)
    {
        console.log("Starting General Class Access Services");
        this.http = http;
        this.polariService = polariService;
        this.polariService.serverCRUDEendpoints.subscribe(
          value => {
            console.log("Successfully received CRUDE endpoints:", value)
            this.classCrudeEndpoints = value;
          },
          error => console.error("Error fetching CRUDE endpoints:", error),
          () => console.log('Completed CRUDE API fetch.')
        );
    }

    // Create a new CRUDE class service for a given class name.
    createCRUDEclassService(className: string)
    {
        let newService = new CRUDEclassService(this.http, this.polariService);
        newService.initialize(className);
        return newService;
    }

    // Delete a CRUDE class service for a given class name.
    deleteCRUDEclassService(className: string)
    {
        // Delete the service for the given class name.
    }

    // Get an existing CRUDE class service for a given class name.
    getCRUDEclassService(className: string): CRUDEclassService {
      if (!this.crudeServices[className]) {
        this.crudeServices[className] = this.createCRUDEclassService(className);
      }
      return this.crudeServices[className];
    }

    // Called by a component when it is initializing to get access to a CRUDE class service.
    // This increments the componentUtilizerCounter for the given component.
    // If the service for the component does not exist, it is created.
    getCRUDEclassServiceForComponent(className: string, componentName: string)
    {
        // Get the service for the given class name.
    }

    incrementUtilizerCounter(componentName: string): void {
      this.componentUtilizerCounter[componentName] = 
        (this.componentUtilizerCounter[componentName] || 0) + 1;
    }
    
    decrementUtilizerCounter(componentName: string): void {
      if (this.componentUtilizerCounter[componentName]) {
        this.componentUtilizerCounter[componentName]--;
        if (this.componentUtilizerCounter[componentName] === 0) {
          delete this.componentUtilizerCounter[componentName];
        }
      }
    }

    cleanupUnusedService(className: string): void {
      if (this.componentUtilizerCounter[className] === 0) {
        delete this.crudeServices[className];
        console.log(`Service for ${className} deleted.`);
      }
    }
}