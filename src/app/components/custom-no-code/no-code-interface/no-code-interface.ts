import { Component, OnInit, OnChanges, ViewChild, ElementRef, Input, ViewEncapsulation, Output, EventEmitter } from '@angular/core';
import { noCodeSolution } from '@models/noCodeSolution';
import { FormControl } from '@angular/forms';
import { Observable, Subscription } from 'rxjs';
import { Slot } from '@models/slot';
import * as d3 from 'd3';
import { noCodeState } from '@models/noCodeState';

@Component({
  selector: 'no-code-interface',
  templateUrl: 'no-code-interface.html',
  styleUrls: ['./no-code-interface.css']
})
export class NoCodeinterfaceComponenI {

  @Input() solutionId : number|undefined;
  solution: noCodeSolution|undefined;

  constructor() { }

  ngOnInit() {
    if (this.solutionId === undefined) {
      // Create mode: Initialize with a new noCodeSolution
      let firstState = new noCodeState(0,0,"",0,"",undefined,100,100,0,0,[])
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
  

  ngOnChanges() {
  }

  

}