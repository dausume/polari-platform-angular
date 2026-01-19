import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { polariNode } from '@models/polariNode';
import { PolariService } from '@services/polari-service';
import { RuntimeConfigService } from '@services/runtime-config.service';
import { BehaviorSubject, interval, Observable, Observer, Subscription } from 'rxjs';
import { environment } from 'src/environments/environment-dev';


@Component({
  selector: 'polari-config',
  templateUrl: 'polari-config.html',
  styleUrls: ['./polari-config.css']
})
export class PolariConfigComponent implements OnInit, OnDestroy {
  //Get elements in DOM of Component by Id (made optional using ? because cannot be initialized normally)
  @ViewChild("connectionCheckbox",{ static: true})
  checkboxElemRef?: ElementRef

  connectionCheckboxFormGroup : FormGroup = new FormGroup({
    connectionCheckbox: new FormControl('', [Validators.required])
  });

  // Updated pattern to allow hostnames, IPs, and localhost
  ipNumFormControl = new FormControl('', [
    Validators.required,
    Validators.pattern(/^(localhost|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|[a-zA-Z0-9][-a-zA-Z0-9]*(\.[a-zA-Z0-9][-a-zA-Z0-9]*)*)$/)
  ]);
  portNumFormControl = new FormControl('', [Validators.required, Validators.pattern(/^\d{2,5}$/)]);

  polariConnection = false;
  polariConnectionPending = false;
  polariConnectionFailure = false;
  ipNum: string = '';
  portNum: string = '';
  labelPosition: 'before' | 'after' = 'after';
  connectionCheckboxdisabled = true;
  connectionData: any;

  // Security: Check if backend changes are allowed
  backendChangeAllowed: boolean = true;
  runtimeConfigEnabled: boolean = true;

  // Protocol selection
  useHttps: boolean = false;
  httpsAvailable: boolean = true;

  //Component inputs from Parent Component (Always App Component in this case)
  polariAccessNode: polariNode

  //Component output emitter from this component to the Parent App Component.
  @Output()
  polariConnectionEvent = new EventEmitter<void>();

  //Sets how long there is between every refresh of values from the polariService (3 seconds = 3000)
  refreshPolariConnectionVals = interval(5000)

  // Subscriptions for cleanup
  private subscriptions: Subscription[] = [];

  constructor(
    private ActivatedRoute: ActivatedRoute,
    public polariService: PolariService,
    private runtimeConfig: RuntimeConfigService
  ) {
    // Initialize with current values from service (not empty!)
    this.ipNum = this.polariService.userEntry_ipv4NumSubject.value || environment.backendUrl || 'localhost';
    this.portNum = this.polariService.userEntry_portNumSubject.value || environment.backendPort || '3000';

    this.polariAccessNode = {
      "ip": this.ipNum,
      "port": this.portNum,
      "crudeAPIs":[],
      "polariAPIs":[]
    }
    this.connectionData = [];

    // Check security settings
    this.backendChangeAllowed = this.runtimeConfig.isBackendChangeAllowed();
    this.runtimeConfigEnabled = this.runtimeConfig.isRuntimeConfigEnabled();
    this.httpsAvailable = this.runtimeConfig.isHttpsEnabled();
    this.useHttps = this.runtimeConfig.useHttps$.value;
  }

  ngOnInit(): void {
    // Initialize form controls with current values from the service
    this.ipNum = this.polariService.userEntry_ipv4NumSubject.value;
    this.portNum = this.polariService.userEntry_portNumSubject.value;
    this.useHttps = this.runtimeConfig.useHttps$.value;

    this.ipNumFormControl.setValue(this.ipNum);
    this.portNumFormControl.setValue(this.portNum);

    // If backend changes are not allowed, disable the form controls
    if (!this.backendChangeAllowed) {
      this.ipNumFormControl.disable();
      this.portNumFormControl.disable();
      console.log('[PolariConfig] Backend changes are disabled by security settings');
    }

    // Subscribe to BehaviorSubjects to keep form controls updated
    this.subscriptions.push(
      this.polariService.userEntry_ipv4NumSubject.subscribe(value => {
        if (value) {
          this.ipNum = value;
          this.ipNumFormControl.setValue(this.ipNum);
        }
      })
    );

    this.subscriptions.push(
      this.polariService.userEntry_portNumSubject.subscribe(value => {
        if (value) {
          this.portNum = value;
          this.portNumFormControl.setValue(this.portNum);
        }
      })
    );

    this.subscriptions.push(
      this.runtimeConfig.useHttps$.subscribe(value => {
        this.useHttps = value;
      })
    );
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  disconnectFromPolari(){
    //Empties out and resets all values.
    this.polariService.connectionDataSubject.next({});
    this.polariService.polariAccessNodeSubject.next({
      "ip":"",
      "port":"",
      "crudeAPIs":[],
      "polariAPIs":[]
    });
    this.polariService.connectionSuccessSubject.next(false);
    this.polariService.connectionPendingSubject.next(false);
  }

  ipNumChange(newIp: string){
    this.ipNum = newIp;
  }

  portNumChange(newPort: string){
    this.portNum = newPort;
  }

  attemptPolariConnection()
  {
    // Security check: Verify backend changes are allowed before connecting to new endpoint
    if (!this.backendChangeAllowed) {
      console.warn('[PolariConfig] Backend changes are disabled - using configured backend');
      // Still allow connection attempt, but use the configured values
      this.polariService.establishPolariConnection();
      return;
    }

    // Update the backend connection through RuntimeConfigService
    const success = this.runtimeConfig.updateBackendConnection(
      this.ipNum,
      this.portNum,
      this.useHttps ? 'https' : 'http'
    );

    if (success) {
      this.polariService.userEntry_ipv4NumSubject.next(this.ipNum);
      this.polariService.userEntry_portNumSubject.next(this.portNum);
    }

    //Triggers the attempt to connect to the Polari Node with the set polariService values.
    this.polariService.establishPolariConnection();
  }

  /**
   * Toggle between HTTP and HTTPS protocols.
   */
  toggleHttps(): void {
    if (!this.httpsAvailable) {
      return;
    }
    this.useHttps = !this.useHttps;
    this.runtimeConfig.switchToHttps(this.useHttps);
  }

  /**
   * Check if the connection form should be read-only.
   */
  isReadOnly(): boolean {
    return !this.backendChangeAllowed || !this.runtimeConfigEnabled;
  }
}