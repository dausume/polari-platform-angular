import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, Type, SimpleChanges } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { polariNode } from '@models/polariNode';
import { PolariService } from '@services/polari-service';
import { BehaviorSubject, interval, Observable, Observer, Subscription } from 'rxjs';
import { MatTableModule } from '@angular/material/table';
//Models
//import { templateClass } from '@models/templateClass';
import { dataSetCollection } from '@models/dataSetCollection';
import { dataSet } from '@models/dataSet';
import { classPolyTyping } from '@models/classPolyTyping';
import { objectReference } from '@models/objectReference';

@Component({
  selector: 'template-class-table',
  templateUrl: 'templateClassTable.html',
  styleUrls: ['./templateClassTable.css']
})
export class templateClassTableComponent {

  @Input() className?: string;
  @Input() classTypeData?: any;
  @Input() filter?: object = {};
  @Input() shownVars?: string[] = [];

  formattedClassName?: string;
  instanceList: any[] = [];
  polyVarRefs: any[] = [];

  constructor(private polari: PolariService) {}

  ngOnInit()
  {
    //Get a list of object references to polyTypedVars that sould be retrieved.
    let varsData = this.classTypeData.completeVariableTypingData;
    let varsList = Object.keys(varsData);
    this.formattedClassName = this.className;
    console.log("-- PolyTypedVar References --");
    console.log(this.polyVarRefs);
    console.log("Reached end of class table ngOnInit");
  }

  ngOnChanges(changes: SimpleChanges)
  {
    console.log("Logging a change in an input value.");
    console.log(changes);
    console.log(this.className);
    console.log(this.classTypeData);
    //Get all of the keys (Variable Names) and use them to establish the headers.
    let keys = Object.keys(this.classTypeData["completeVariableTypingData"]);
    this.shownVars = [];
    for (let key of keys) {
      this.shownVars.push(key);
    }
    console.log(this.shownVars);
    console.log(this.classTypeData["completeVariableTypingData"])
    this.classTypeData["completeVariableTypingData"]
  }

  getType(typeToGet:string)
  {
    
  }
}