import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

import {
  StateOverlayBase,
} from '@components/custom-no-code/states/_shared/state-overlay/state-overlay-base';

/**
 * The element-choice overlay — the periodic-table tile's label chip,
 * following the same tiered state-overlay convention:
 *   tiny    → the symbol
 *   compact → symbol + atomic number
 *   full    → + element name
 * Clicking the chip is pass-through (the 3D tile handles selection);
 * the POPUP (element details + ion choices) opens from the tile's
 * click per the selector's clickAction knob.
 */
@Component({
  standalone: true,
  selector: 'element-choice-overlay',
  imports: [CommonModule],
  template: `
    <div class="element-overlay" [class.selected]="selected"
         [attr.data-tier]="sizeTier">
      <span class="symbol">{{ label || stateName }}</span>
      <span class="z" *ngIf="sizeTier !== 'tiny' && atomicNumber">
        {{ atomicNumber }}
      </span>
      <span class="name" *ngIf="sizeTier === 'full' && elementName">
        {{ elementName }}
      </span>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100%; }
    .element-overlay {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; height: 100%;
      pointer-events: none; /* the 3D tile takes the click */
      color: #1a1a1a; text-shadow: 0 0 3px rgba(255, 255, 255, 0.9);
      line-height: 1.05;
    }
    .symbol { font-weight: 700; font-size: clamp(9px, 60%, 15px); }
    .z { font-size: 9px; opacity: 0.75; }
    .name { font-size: 9px; opacity: 0.85; white-space: nowrap; }
    .selected .symbol { color: var(--brand-teal, #0d6d63); }
  `],
})
export class ElementChoiceOverlayComponent extends StateOverlayBase {
  @Input() label = '';
  @Input() elementName = '';
  @Input() atomicNumber: number | null = null;
  @Input() selected = false;

  override hasPopupView = true;
}
