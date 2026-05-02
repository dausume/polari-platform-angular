// Author: Dustin Etts
// Smallest tier (< 60px) — calculate icon + current operation symbol.

import { Component, Input } from '@angular/core';

@Component({
  standalone: false,
  selector: 'math-operation-overlay-tiny',
  templateUrl: './math-operation-overlay-tiny.component.html',
  styleUrls: ['./math-operation-overlay-tiny.component.css']
})
export class MathOperationOverlayTinyComponent {
  @Input() operationSymbol: string = '+';
}
