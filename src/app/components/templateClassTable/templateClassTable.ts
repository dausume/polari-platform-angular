import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, Type, SimpleChanges } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { polariNode } from '@models/polariNode';
import { PolariService } from '@services/polari-service';
import { MatGridList, MatGridTile } from '@angular/material/grid-list';
import { BehaviorSubject, interval, Observable, Observer, Subscription } from 'rxjs';
import { MatTableModule } from '@angular/material/table';
import { DefaultCellComponent } from './type-cells/default-cell/default-cell'
//Models
//import { templateClass } from '@models/templateClass';
import { dataSetCollection } from '@models/dataSetCollection';
import { dataSet } from '@models/dataSet';
import { classPolyTyping } from '@models/classPolyTyping';
import { objectReference } from '@models/objectReference';
import { variablePolyTyping } from '@models/variablePolyTyping';

@Component({
  selector: 'template-class-table',
  templateUrl: 'templateClassTable.html',
  styleUrls: ['./templateClassTable.css']
})
export class templateClassTableComponent {

  @Input() className?: string;
  @Input() classTypeData: any = {};
  @Input() filter?: object = {};
  @Input() shownVars: string[] = [];

  formattedClassName?: string;
  instanceList: any[] = [];
  polyVarRefs: any[] = [];

  constructor(private polari: PolariService) {}

  ngOnInit()
  {
    //Get a list of object references to polyTypedVars that sould be retrieved.
    //let varsData = this.classTypeData.completeVariableTypingData;
    //let varsList = Object.keys(varsData);
    this.formattedClassName = this.className;
    console.log("-- PolyTypedVar References --");
    console.log(this.polyVarRefs);
    console.log("Reached end of class table ngOnInit");
    this.getTypingData();
  }

  
  ngOnChanges(changes: SimpleChanges)
  {
    console.log("Logging a change in an input value.");
    console.log(changes);
    if(changes.classTypeData)
    {
      console.log("Previous classTypeData : ", this.classTypeData);
      console.log("New changes.classTypeData : ", changes.classTypeData);
      this.getTypingData();
    }
    if(changes.className)
    {
      console.log("Previous classTypeData : ", this.classTypeData);
      console.log("New changes.classTypeData : ", changes.classTypeData);
    }
  }

  getTypingData()
  {
    console.log(this.className);
    console.log(this.classTypeData);
    //Get all of the keys (Variable Names) and use them to establish the headers.
    let keys = Object.keys(this.classTypeData);
    console.log("classTypeData keys : ", keys)
    this.shownVars = [];
    if(keys !== undefined)
    {
      for (let key of keys) {
        this.shownVars.push(key);
      }
      console.log("keys were defined.")
    }
    console.log("shownVars")
    console.log(this.shownVars);
    console.log("this.classTypeData : ", this.classTypeData)
    this.polyVarRefs = this.classTypeData;
    console.log("this.polyVarRefs : ", this.polyVarRefs["completeVariableTypingData"])
  }

  moveUp(variable: variablePolyTyping) {
    // Locate the index of the variable in shownVars array
    const index = this.shownVars.findIndex(varName => varName === variable.variableName);
  
    // Check if variable exists in shownVars
    if (index !== -1) {
      // Check if the variable is not already at the top
      if (index > 0) {
        // Swap the current variable with the one before it
        const temp = this.shownVars[index];
        this.shownVars[index] = this.shownVars[index - 1];
        this.shownVars[index - 1] = temp;
  
        // Optionally, you can update any relevant data or trigger events here
        console.log(`Moved ${variable.variableName} up.`);
      } else {
        console.log(`${variable.variableName} is already at the top.`);
      }
    } else {
      console.error(`${variable.variableName} not found in shownVars.`);
    }
  }

  // In the ShownVars array, finds the matching object in the array and moves it up by 1.
  moveDown(variable: variablePolyTyping) {
    // Locate the index of the variable in shownVars array
    const index = this.shownVars.findIndex(varName => varName === variable.variableName);
  
    // Check if variable exists in shownVars
    if (index !== -1) {
      // Check if the variable is not already at the bottom
      if (index < this.shownVars.length - 1) {
        // Swap the current variable with the one after it
        const temp = this.shownVars[index];
        this.shownVars[index] = this.shownVars[index + 1];
        this.shownVars[index + 1] = temp;
  
        // Optionally, you can update any relevant data or trigger events here
        console.log(`Moved ${variable.variableName} down.`);
      } else {
        console.log(`${variable.variableName} is already at the bottom.`);
      }
    } else {
      console.error(`${variable.variableName} not found in shownVars.`);
    }
  }
  

  // Finds the matching object in the array and removes it.
  remove(variable: variablePolyTyping) {
    // Find the index of the variable in shownVars array
    const index = this.shownVars.findIndex(varName => varName === variable.variableName);
  
    // Check if variable exists in shownVars
    if (index !== -1) {
      // Remove the variable from shownVars
      this.shownVars.splice(index, 1);
  
      // Optionally, you can update any relevant data or trigger events here
      console.log(`Removed ${variable.variableName} from shownVars.`);
    } else {
      console.error(`${variable.variableName} not found in shownVars.`);
    }
  }
  
}