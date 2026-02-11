import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { polariNode } from '@models/polariNode';
import { PolariService } from '@services/polari-service';
import { BehaviorSubject, interval, Observable, Observer, Subscription } from 'rxjs';

@Component({
  standalone: false,
  selector: 'variable-search-criteria',
  templateUrl: 'variable-search-criteria.html',
  styleUrls: ['./variable-search-criteria.css']
})
export class VariableSearchCriteriaComponent {
  //A reference to the instance being 
  @Input()
  classTyping: any;
  //Name of the variable that is being searched.
  @Input()
  varName = "";
  //The type of the variable to be searched.
  @Input()
  varType = ""

  constructor() {
    
  }
}