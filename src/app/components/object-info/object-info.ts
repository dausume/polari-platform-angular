import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { polariNode } from '@models/polariNode';
import { PolariService } from '@services/polari-service';
import { BehaviorSubject, interval, Observable, Observer, Subscription } from 'rxjs';

@Component({
  standalone: false,
  selector: 'object-info',
  templateUrl: 'object-info.html',
  styleUrls: ['./object-info.css']
})
export class ObjectInfoComponent {
  className: string;
  classTypingData: any;

  constructor(private ActivatedRoute : ActivatedRoute, public polariService: PolariService) {
    this.className = "";
    this.ActivatedRoute.queryParamMap
      .subscribe(params => {
        let paramsString = params.get("queryParams")
        if(paramsString != null)
        {
          let paramsJSON = JSON.parse(paramsString)
          this.className = paramsJSON["className"]
        }
        //console.log("Params passed into polari-config component.")
        //console.log(paramsString)
      },
      err => {
        console.log(err);
      }
      )
      .unsubscribe()
    
  }
}