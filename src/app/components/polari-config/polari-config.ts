import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { polariNode } from '@models/polariNode';
import { PolariService } from '@services/polari-service';
import { BehaviorSubject, interval, Observable, Observer, Subscription } from 'rxjs';

@Component({
  selector: 'polari-config',
  templateUrl: 'polari-config.html',
  styleUrls: ['./polari-config.css']
})
export class PolariConfigComponent {
  //Get elements in DOM of Component by Id (made optional using ? because cannot be initialized normally)
  @ViewChild("connectionCheckbox",{ static: true})
  checkboxElemRef?: ElementRef

  connectionCheckboxFormGroup = new FormGroup({
    updates:new FormControl(this.polariService.isConnectedSubject.pipe())
  })

  polariConnection = false;
  polariConnectionPending = false;
  polariConnectionFailure = false;
  ipNum: string;
  ipNumFormControl = new FormControl('');
  portNum: string;
  portNumFormControl = new FormControl('');
  labelPosition: 'before' | 'after' = 'after';
  connectionCheckboxdisabled = true;
  connectionData: any;
  //Component inputs from Parent Component (Always App Component in this case)
  polariAccessNode: polariNode

  //Component output emitter from this component to the Parent App Component.
  @Output()
  polariConnectionEvent = new EventEmitter<void>();

  //Sets how long there is between every refresh of values from the polariService (3 seconds = 3000)
  refreshPolariConnectionVals = interval(5000)

  constructor(private ActivatedRoute : ActivatedRoute, public polariService: PolariService) {
    this.polariAccessNode = {
      "ip":"",
      "port":"",
      "crudeAPIs":[],
      "polariAPIs":[]
    }
    this.connectionData = [];
      //
      this.ipNum = ""
      this.portNum = ""
      /*
      this.polariService.isConnectedSubject.subscribe(connectionVal=>{
        console.log("isConnected Value: ");
        console.log(connectionVal);
        this.polariConnection = connectionVal;
      },
      err =>{
        console.log("encountered error in refresh for isConnected.")
        console.log(err)
      })
      .unsubscribe()
      */
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
    this.polariService.isConnectedSubject.next(false);
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
    this.polariService.userEntry_ipv4NumSubject.next(this.ipNum);
    this.polariService.userEntry_portNumSubject.next(this.portNum);
    //Triggers the attempt to connect to the Polari Node with the set polariService values.
    this.polariService.establishPolariConnection()
    //console.log("connecting to " + this.ipNum + "/" + this.portNum + " to detect if Polari Server Node exists at the endpoint.");
  }
}