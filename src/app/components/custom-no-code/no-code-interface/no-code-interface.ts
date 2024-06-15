import { Component, OnInit, OnChanges, ViewChild, ElementRef, Input, ViewEncapsulation, Output, EventEmitter, SimpleChanges } from '@angular/core';
import { noCodeSolution } from '@models/noCodeSolution';
import { FormControl } from '@angular/forms';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { Slot } from '@models/slot';
import * as d3 from 'd3';
import { noCodeState } from '@models/noCodeState';

@Component({
  selector: 'no-code-interface',
  templateUrl: 'no-code-interface.html',
  styleUrls: ['./no-code-interface.css']
})
export class NoCodeInterfaceComponent {

  private _solution: noCodeSolution | undefined;

  protected solutionSubject = new BehaviorSubject<noCodeSolution|undefined>(undefined);

  @Input() solutionId : number|undefined;
  @Input() //solution: noCodeSolution|undefined;
  set solution(value: noCodeSolution | undefined) {
    // Log the changes before updating the solution
    console.log("Solution is being updated:", value);

    // Update the solution
    this._solution = value;
  }

  get solution(): noCodeSolution | undefined {
    return this._solution;
  }

  constructor() { }

  ngOnInit() {
    if (this.solutionId === undefined) {
      // Create mode: Initialize with a new noCodeSolution
      let firstState = new noCodeState(0,0,"",undefined,0,"Test State",undefined,100,100,0,0,[])
      this.solution = new noCodeSolution(500,500,"",[firstState],0,0,0,0,0,1);
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

  onSaveChanges(updatedSolution: noCodeSolution) {
    // Log the updated solution to the console
    console.log('Updated Solution:', updatedSolution);

    // If you want to update the solution object in your component, uncomment the following line
    this.solution = updatedSolution;
  }
}