import { Component, Input, Output, EventEmitter, ElementRef, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { noCodeState } from '@models/noCodeState';
import * as d3 from 'd3';

//Defines a no code state
@Component({
  selector: 'no-code-state-instance-d3',
  templateUrl: 'no-code-state-instance-d3.html',
  styleUrls: ['./no-code-state-instance-d3.css']
})
export class NoCodeStateInstanceComponentD3 {
  //Control Field for ensuring the user is setting the State Component to match to a Class that exists and is accessible.
  classEntryControl = new FormControl();
  //Required that the #noCodeStateContainer element is rendered before this is used.
  @ViewChild('noCodeStateContainer') private noCodeStateContainer!: ElementRef;
  //State Instance - Required Input
  @Input() stateInstance! : noCodeState;
  //A list of all Class
  options: string[] = ['Class 1', 'Class 2', 'Class 3'];
  //A list of Classes after searching through all classes based on criteria.
  filteredOptions: string[] = this.options;
  //
  nodeType = "plus";
  //A search string entered by a user.
  searchTerm: string = "";

  constructor() {
    // Initialize noCodeStateContainer here
    //this.noCodeStateContainer = new ElementRef(/* initialize with the appropriate value */);
    this.classEntryControl.valueChanges.subscribe(searchTerm => {
      this.filteredOptions = this.options.filter(option =>
        option.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }

  ngOnInit()
  {    
    this.renderBoxGraph();
  }

  private renderBoxGraph() {
    // Use D3.js to render the box graph based on this.stateInstance
    const container = this.noCodeStateContainer.nativeElement;
    const width = this.stateInstance.stateComponentSizeX;
    const height = this.stateInstance.stateComponentSizeY;

    // Clear previous contents if any
    d3.select(container).selectAll('*').remove();
  }

  search() {
    this.filteredOptions = this.options.filter(option => option.toLowerCase().includes(this.classEntryControl.value.toLowerCase()));
  }

  onClassSelected(event: MatAutocompleteSelectedEvent) {
    // Do something with the selected option
  }

}
