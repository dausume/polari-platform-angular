import { Component, Input } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Slot } from '@models/noCode/Slot';

@Component({
  standalone: false,
  selector: 'slot',
  templateUrl: 'slot.html',
  styleUrls: ['./slot.css']
})
export class SlotComponent {

  @Input()
  stateId?: number;

  //If true, is input.  If false, is output
  @Input()
  slotObject?;

  constructor() {
  }

  ngOnInit()
  {

  }

}
