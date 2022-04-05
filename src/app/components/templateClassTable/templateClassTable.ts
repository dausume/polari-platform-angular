import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, Type } from '@angular/core';
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

  objectReference = objectReference
  instanceList? : any = []

  //Name of the class the data is being retrieved for.
  @Input()
  className?: string;

  formattedClassName?: string;

  //Filter to be applied on the data being requested.
  //@Input()
  filter?: object = {};

  //List of variable names to be shown.
  //@Input()
  shownVars?: string[] = [];

  constructor()
  {
    //private polService : PolariService
    this.instanceList = [];
    //this.testBaseDataSet.getClassInstanceList(this.className);
    //console.log(this.instanceList);
    //console.log(this.shownVars);
  }

  ngOnInit()
  {
    this.formattedClassName = this.className;
    console.log("In class table ngOnInit");
  }

  getType(value)
  {
      console.log("getting type of value: ", value)
    let typeString : string = "undefined";
    if(Array.isArray(value))
    {
        console.log("is array");
        if(objectReference.isReferenceJson(value))
        {
            console.log("is objectReference");
            return "objectReference";
        }
        return "array";
    }
    else if(typeof value === 'string')
    {
        console.log("is string");
        return 'string';
    }
    else if(value == null)
    {
        return 'null';
    }
    return typeString;
  }

}