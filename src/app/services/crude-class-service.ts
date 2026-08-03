// crude-class-service.ts
import { Injectable, EventEmitter } from "@angular/core";
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { Observable, throwError } from "rxjs";
import { map } from "rxjs/operators";
import { PolariService } from "./polari-service"
import { StompService, StompChangeNotification } from "./stomp.service";

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
        // console.log(startServiceMsg);
        this.http = http;
        this.polariService = polariService;
        this.serviceUtilizers = {};
    }

    // The backend's CRUDE protocol (polariCRUDE): all routes live at
    // /{ClassName} (per-id paths DO NOT exist and 404), and every write
    // is multipart form-data — POST expects initParamSets, PUT expects
    // polariId + updateData, DELETE expects targetInstance. The
    // previous REST-style per-id JSON variants here never worked
    // against the real server (2026-07-11 API audit); the backend's
    // tests/test_api_sweep.py pins the protocol server-side.

    private classUrl(): string {
        return `${this.polariService.getBackendBaseUrlForClass(this.className)}/${this.className}`;
    }

    create(data: any): Observable<any> {
        const formData = new FormData();
        formData.append('initParamSets', JSON.stringify([data]));
        return this.http.post(this.classUrl(), formData);
      }

      /** There is no per-id GET route — fetch the class table and
       *  resolve the instance client-side (same data, one request). */
      read(id: string): Observable<any> {
        return this.readAll().pipe(
          map((envelope: any) => {
            const rows =
              envelope?.[0]?.[this.className]?.[0]?.data ?? [];
            return rows.find((row: any) => row?.id === id) ?? null;
          })
        );
      }

      /** Read every instance the user may see.
       *
       *  `filter` narrows the read server-side by field value
       *  (`{design_ref: 'clock-lavet-m0'}` -> `?design_ref=...`). The
       *  backend applies it AFTER its access check, so a filter can
       *  only ever narrow what is already readable. Unknown field
       *  names are ignored by the backend rather than matching
       *  nothing, so a typo degrades to "unfiltered". */
      readAll(filter?: Record<string, string>): Observable<any> {
        const options = this.polariService.backendRequestOptions;
        const entries = Object.entries(filter || {})
          .filter(([key, value]) => key && value !== null
            && value !== undefined && String(value).length > 0);
        if (!entries.length) {
          return this.http.get(this.classUrl(), options);
        }
        const query = entries
          .map(([key, value]) =>
            `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
          .join('&');
        return this.http.get(`${this.classUrl()}?${query}`, options);
      }

      update(id: string, data: any): Observable<any> {
        const formData = new FormData();
        formData.append('polariId', id);
        formData.append('updateData', JSON.stringify(data));
        return this.http.put(this.classUrl(), formData);
      }

      delete(id: string): Observable<any> {
        const formData = new FormData();
        formData.append('targetInstance', JSON.stringify({ id }));
        return this.http.request('DELETE', this.classUrl(), { body: formData });
      }

      /**
       * Subscribe to real-time change notifications via STOMP WebSocket.
       * Replaces the previous SSE-based subscribeToEvents() stub.
       *
       * @param stompService - The singleton StompService instance
       * @param formatType - Optional format type for format-specific topics
       * @returns Observable of parsed change notifications
       */
      subscribeToChanges(stompService: StompService, formatType?: string): Observable<StompChangeNotification> {
        // console.log(`[CRUDEclassService] SUBSCRIBE_CHANGES ${this.className}${formatType ? '/' + formatType : ''}`);
        return stompService.watchChanges(this.className, formatType);
      }
      

    // hacky way to get around not being able to just pass the class name into the service.
    initialize(className : string)
    {
        this.className = className;
    }

    checkUtilizers(): void {
        if (Object.keys(this.serviceUtilizers).length === 0) {
          // console.log(`Shutting down service for ${this.className}`);
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