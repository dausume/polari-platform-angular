import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { NoCodeState } from '@models/noCode/NoCodeState';

//Defines a component that overlays on top of a d3-object so that it can be used as a dynamic part of a no-code
//user interface that allows for connectors and dynamic configuration, instantiation, and utilization of functionality
//defined on classes while using their defined state.
@Component({
  standalone: false,
  selector: 'no-code-state-instance',
  templateUrl: 'no-code-state-instance.html',
  styleUrls: ['./no-code-state-instance.css']
})
export class NoCodeStateInstanceComponent {
  //Control Field for ensuring the user is setting the State Component to match to a Class that exists and is accessible.
  classEntryControl = new FormControl();
  //Passes in a State Instance object, the id of the state instance object is used to bind this component
  //to it's corresponding d3-object which should have a similarly coded class with the id in it.
  //for example, if our id was 1234 : 'NCSI-1234' would be a class on this component's top-level tag.
  //and then 'NCSI-container-1234' would be a style class on the d3-object.
  @Input()
  stateInstance;
  //A list of all Class
  options: string[] = ['Class 1', 'Class 2', 'Class 3'];
  //A list of Classes after searching through all classes based on criteria.
  filteredOptions: string[] = this.options;
  //  
  nodeType = "plus";
  //A search string entered by a user.
  searchTerm: string = "";

  constructor() {
    this.classEntryControl.valueChanges.subscribe(searchTerm => {
      this.filteredOptions = this.options.filter(option =>
        option.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }

  ngOnInit()
  {    
    if(this.stateInstance === undefined)
    {
      
    }
  }

  search() {
    this.filteredOptions = this.options.filter(option => option.toLowerCase().includes(this.classEntryControl.value.toLowerCase()));
  }

  onClassSelected(event: MatAutocompleteSelectedEvent) {
    // Do something with the selected option
  }

}
