import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Observable, Subscription } from 'rxjs';
import { Slot } from '@models/noCode/Slot';

@Component({
  selector: 'no-code-menu',
  templateUrl: 'no-code-menu.html',
  styleUrls: ['./no-code-menu.css']
})
export class NoCodeMenuComponent {

  stateInputSlots: number = 0;
  stateOutputSlots: number = 1;

  connectorInputSlots: number = 1;
  connectorOutputSlots: number = 1;

  isConnectorMode = false;

  //Indicates the name of the input state selected for the connection.
  @Input()
  stateConnectionReciever;

  inputState : Slot | null = null;
  outputState : Slot | null = null;

  @Output() newStateInstance = new EventEmitter();
  @Output() newConnectorInstance = new EventEmitter();
  @Output() stateMode = new EventEmitter();
  @Output() connectorMode = new EventEmitter();

  constructor() {

  }

  ngOnInit()
  {

  }

  createNewStateInstance()
  {
    this.newStateInstance.emit();
  }

  createNewConnectorInstance() {
    this.newConnectorInstance.emit();
  }

  swapToStateMode() {
    this.isConnectorMode = false;
    this.connectorMode.emit();
  }

  swapToConnectorMode() {
    this.isConnectorMode = true;
    this.stateMode.emit();
  }

  resetConnector(){
    this.outputState = null;
    this.inputState = null;
  }

  makeConnection()
  {

  }

}
