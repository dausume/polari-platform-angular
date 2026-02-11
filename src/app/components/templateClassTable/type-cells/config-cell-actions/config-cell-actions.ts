// config-cell-actions.component.ts
import { Component, Input, EventEmitter, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  standalone: true,
  selector: 'config-cell-actions',
  templateUrl: `config-cell-actions.html`,
  styleUrls: ['./config-cell-actions.css'],
  imports: [MatButtonModule, MatIconModule]
})
export class ConfigCellActions {
  @Input() varInfo: any;
  @Output() moveUp = new EventEmitter<any>();
  @Output() moveDown = new EventEmitter<any>();
  @Output() remove = new EventEmitter<any>();

  constructor() {}
  
  emitMoveUp() {
    this.moveUp.emit(this.varInfo);
  }

  emitMoveDown() {
    this.moveDown.emit(this.varInfo);
  }

  emitRemove() {
    this.remove.emit(this.varInfo);
  }
}