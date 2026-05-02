// Author: Dustin Etts
// Full tier (>= 140px) — operation buttons + operand row + result + preview expression.

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
  selector: 'math-operation-overlay-full',
  templateUrl: './math-operation-overlay-full.component.html',
  styleUrls: ['./math-operation-overlay-full.component.css']
})
export class MathOperationOverlayFullComponent {
  @Input() config!: MathOperationConfig;
  @Input() operations: MathOperationOption[] = [];
  @Input() leftDisplay: string = '';
  @Input() rightDisplay: string = '';
  @Input() resultDisplay: string = '';
  @Input() operationSymbol: string = '+';
  @Input() previewExpression: string = '';
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

  onExpand(): void {
    this.expandClicked.emit();
  }
}
