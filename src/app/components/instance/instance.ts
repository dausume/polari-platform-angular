import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { polariNode } from '@models/polariNode';
import { PolariService } from '@services/polari-service';
import { BehaviorSubject, interval, Observable, Observer, Subscription } from 'rxjs';

@Component({
  selector: 'instance',
  templateUrl: 'instance.html',
  styleUrls: ['./instance.css']
})
export class InstanceComponent {
  className: string;
  id: string;
  instanceData: any;
  classTypingData: any;
  retrievalError = false
  retrievalPending = true

  constructor(private ActivatedRoute : ActivatedRoute, public polariService: PolariService) {
    this.className = "";
    this.id = "";
    this.ActivatedRoute.queryParamMap
      .subscribe(params => {
        let paramsString = params.get("queryParams")
        if(paramsString != null)
        {
          let paramsJSON = JSON.parse(paramsString)
          this.className = paramsJSON["className"]
          this.id = paramsJSON["id"];
        }
        //console.log("Params passed into polari-config component.")
        //console.log(paramsString)
      },
      err => {
        console.log(err);
      }
      )
      .unsubscribe()
    //Now that we have the id and className, we ping the PolariService to get the instance's data.
    if(this.id != "" && this.className != '')
    {
      
    }
    else
    {
      this.instanceData = {};
    }
    
  }
}