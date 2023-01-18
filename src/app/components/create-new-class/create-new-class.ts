import { Component } from '@angular/core';
import { FormControl } from '@angular/forms';

@Component({
  selector: 'create-new-class',
  templateUrl: 'create-new-class.html',
  styleUrls: ['./create-new-class.css']
})
export class CreateNewClassComponent {

  className = ""
  classNameControl = new FormControl();

  classDisplayName = ""
  classDisplayNameControl = new FormControl();

  constructor() {

  }

  ngOnInit()
  {
    console.log("In create new class ngOnInit");
  }

  saveClass()
  {
    console.log("Class being saved placeholder");
  }

  addVar()
  {
    console.log("adding variable");
  }

}
