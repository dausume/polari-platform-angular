import { Component, HostListener, Input, Output, EventEmitter } from '@angular/core';
import { Slot } from '@models/noCode/Slot';

@Component({
  selector: 'no-code-state-border',
  templateUrl: 'no-code-state-border.html',
  styleUrls: ['./no-code-state-border.css']
})
export class NoCodeStateBorderComponent {
  //State Instance
  @Input()
  stateInstance;

  isDragging = false;
  startX = 0;
  startY = 0;
  //Indicates the number of degrees a single slot occupies -> used to prevent slot overlap.
  slotDegreesOccupied = 8;

  //Contains all slot objects
  allSlots : Slot[] = [] ;
  //Contains slot objects in top bar, angles 0-90 degrees
  topSlots : Slot[] = [];
  //Contains slot objects in top bar, angles 90-180 degrees
  rightSlots : Slot[]  = [];
  //Contains slot objects in top bar, angles 180-270 degrees
  bottomSlots : Slot[]  = [];
  //Contains slot objects in top bar, angles 270-360 degrees
  leftSlots : Slot[]  = [];

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (this.isDragging) {
      // Perform drag logic here based on the current drag direction
      // Update the position of the border line/tag slots accordingly
    }
  }

  @HostListener('document:mouseup')
  onMouseUp(slot) {
    this.stopDragging(slot);
  }

  ngOnInit()
  {
    if(this.allSlots.length == 0)
    {
      let initialSlot = new Slot( // Slot connecting the initial state to the first state as an output slot.
        0, // Index of the slot in it's given no-code-state
        "initial-state", // No-Code-State name, is undefined until it is saved to the backend
        0,
        [], // Empty array since we have not implemented connectors.
        false,
        false
    )
      this.allSlots.push(initialSlot);
      this.topSlots.push(initialSlot);
    }
  }

  startHorizontalDragging(event: MouseEvent, slot) {
    this.isDragging = true;
    this.startX = event.clientX;
  }

  startVerticalDragging(event: MouseEvent, slot) {
    this.isDragging = true;
    this.startY = event.clientY;
  }

  horizontalDrag(event: MouseEvent, slot) {
    if (this.isDragging) {
      const deltaX = event.clientX - this.startX;
      // Perform horizontal drag logic here
    }
  }

  verticalDrag(event: MouseEvent, slot) {
    if (this.isDragging) {
      const deltaY = event.clientY - this.startY;
      // Perform vertical drag logic here
    }
  }

  stopDragging(slot) {
    this.isDragging = false;
  }

}
