import { Component, OnInit, OnChanges, ViewChild, ElementRef, Input, ViewEncapsulation, Output, EventEmitter, SimpleChanges } from '@angular/core';
import { NoCodeSolution } from '@models/noCode/NoCodeSolution';
import { FormControl } from '@angular/forms';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { Slot } from '@models/noCode/Slot';
import * as d3 from 'd3';
import { NoCodeState } from '@models/noCode/NoCodeState';

@Component({
  selector: 'no-code-interface',
  templateUrl: 'no-code-interface.html',
  styleUrls: ['./no-code-interface.css']
})
export class NoCodeInterfaceComponent {

  private _solution: NoCodeSolution | undefined;

  protected solutionSubject = new BehaviorSubject<NoCodeSolution|undefined>(undefined);

  @Input() solutionId : number|undefined;
  @Input() //solution: noCodeSolution|undefined;
  set solution(value: NoCodeSolution | undefined) {
    // Log the changes before updating the solution
    console.log("Solution is being updated:", value);

    // Update the solution
    this._solution = value;
  }

  get solution(): NoCodeSolution | undefined {
    return this._solution;
  }

  constructor() { }

  ngOnInit() {
    if (this.solutionId === undefined) {
      // Create mode: Initialize with a new noCodeSolution
      let firstState = new NoCodeState("Test State 2", "circle", "Test Class");
      this.solution = new NoCodeSolution(500,500,"",[firstState],0,0,0,0,0,1);
    } else {
      // Edit mode: Fetch the existing noCodeSolution using this.noCodeSolutionId
      console.log("Edit mode has not yet been implemented.")
      /*
      this.noCodeSolutionService.getSolutionById(this.solutionId).subscribe((solution) => {
        this.noCodeSolution = solution;
      });
      */
    }
  }

  ngOnChanges(changes:SimpleChanges) {
    if (changes['solution'] && changes['solution'].currentValue) {
      console.log('Solution object has changed:', changes['solution'].currentValue);
    }
  }

  onSaveChanges(updatedSolution: NoCodeSolution) {
    // Log the updated solution to the console
    console.log('Updated Solution:', updatedSolution);

    // If you want to update the solution object in your component, uncomment the following line
    this.solution = updatedSolution;
  }
}