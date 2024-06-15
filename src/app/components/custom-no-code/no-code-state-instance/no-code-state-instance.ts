import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { noCodeState } from '@models/noCodeState';

//Defines a no code state
@Component({
  selector: 'no-code-state-instance',
  templateUrl: 'no-code-state-instance.html',
  styleUrls: ['./no-code-state-instance.css']
})
export class NoCodeStateInstanceComponent {
  //Control Field for ensuring the user is setting the State Component to match to a Class that exists and is accessible.
  classEntryControl = new FormControl();
  //State Instance
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
      //The default is 200 width, 150 height, padding is always 16px.
      this.stateInstance = new noCodeState(0,0,"circle", undefined,0,"Test State", "Object Name", 200, 150, 0,0,[])
    }
  }

  search() {
    this.filteredOptions = this.options.filter(option => option.toLowerCase().includes(this.classEntryControl.value.toLowerCase()));
  }

  onClassSelected(event: MatAutocompleteSelectedEvent) {
    // Do something with the selected option
  }

}
