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

  @Input()
  classTypeData?: any;

  formattedClassName?: string;

  //Filter to be applied on the data being requested.
  //@Input()
  filter?: object = {};

  //List of variable names to be shown.
  //@Input()
  shownVars?: string[] = [];

  polyVarRefs: objectReference[] = [];

  constructor()
  {
    //private polService : PolariService
    this.instanceList = [];
  }

  ngOnInit()
  {
    //Get a list of object references to polyTypedVars that sould be retrieved.
    let varsList = this.classTypeData.polyTypedVars[0].polariList;
    for(let someVarIndex in varsList)
    {
        let typeString : String = varsList[someVarIndex][0];
        //START From here down is the start of the data extraction process for Class Instance References.
        let refClassName : String|null = null;
        let refVar : objectReference|null = null;
        if(typeString.startsWith("CLASS-"))
        {
          refVar = new objectReference(varsList[someVarIndex]);
          this.polyVarRefs.push(refVar)
        }
    }
    this.formattedClassName = this.className;
    console.log("-- PolyTypedVar References --");
    console.log(this.polyVarRefs);
    console.log("Reached end of class table ngOnInit");
  }

  getType(typeToGet:string)
  {
    
  }
}