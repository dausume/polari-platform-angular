import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { polariNode } from '@models/polariNode';
import { PolariService } from '@services/polari-service';
import { BehaviorSubject, interval, Observable, Observer, Subscription } from 'rxjs';

@Component({
  selector: 'instance-var-str',
  templateUrl: 'instance-var-str.html',
  styleUrls: ['./instance-var-str.css']
})
export class InstanceVarStringComponent {
  actualValue: any;
  modifiedValue: any;
  //True when attempting to edit the variable on the instance.
  editingVar = false;
  //True when the user has permissions to edit the var on the instance.
  editableVar = false;
  //True when the modifiedValue has changed to be different from the actualValue.
  modifiedVar = false;
  //A reference to the instance being 
  @Input()
  instanceRef: any;
  //Name of the variable that is modified through this component.
  @Input()
  varName = "";
  //The type of the variable used in this component.
  @Input()
  varType = ""

  constructor(public polariService: PolariService) {
    this.actualValue = this.instanceRef[this.varName]
    this.modifiedValue = this.instanceRef[this.varName]
  }
}