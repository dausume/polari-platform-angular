// Author: Dustin Etts
// Mid tier (60-140px) — operation buttons + operand row + result selector. No preview.

import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  MathOperationConfig,
  MathOperationOption,
  MathOperationPopupRequest,
  MathOperationPopupSide,
  MathOperationType
} from '../../math-operation-overlay.types';

@Component({
  standalone: false,
  selector: 'math-operation-overlay-compact',
  templateUrl: './math-operation-overlay-compact.component.html',
  styleUrls: ['./math-operation-overlay-compact.component.css']
})
export class MathOperationOverlayCompactComponent {
  @Input() config!: MathOperationConfig;
  @Input() operations: MathOperationOption[] = [];
  @Input() leftDisplay: string = '';
  @Input() rightDisplay: string = '';
  @Input() resultDisplay: string = '';
  @Input() operationSymbol: string = '+';
  @Input() activePopup: MathOperationPopupSide | null = null;
  @Input() hasPopupView: boolean = false;

  @Output() operationChange = new EventEmitter<MathOperationType>();
  @Output() popupRequested = new EventEmitter<MathOperationPopupRequest>();
  @Output() expandClicked = new EventEmitter<void>();

  onOperation(op: MathOperationType): void {
    this.operationChange.emit(op);
  }

  onPopupClick(side: MathOperationPopupSide, event: MouseEvent): void {
    event.stopPropagation();
    this.popupRequested.emit({ side, event });
  }

  onExpand(event: MouseEvent): void {
    event.stopPropagation();
    this.expandClicked.emit();
  }

  stopPropagation(event: Event): void {
    event.stopPropagation();
  }
}
