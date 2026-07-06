import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

import {
  StateOverlayBase,
} from '@components/custom-no-code/states/_shared/state-overlay/state-overlay-base';

/** The proof verdict badge the overlay wears (from the proof cache). */
export type MaterialProofState = 'proven' | 'impossible' | 'unproven';

/**
 * The material-choice overlay — the tiered component that sits on a
 * selectable material's projected shell rect in the 3D selection space,
 * following the SAME per-state overlay convention the 2D no-code canvas
 * uses (StateOverlayBase: size tiers from width, popupRequested →
 * MatDialog wired by the host):
 *
 *   tiny    → label chip
 *   compact → label + proof badge
 *   full    → + substance summary + expand button
 *
 * Inputs beyond the base are plain data (label/description/proof) — the
 * host selector wires them from ITS config, so which overlay shows what
 * stays configuration.
 */
@Component({
  standalone: true,
  selector: 'material-choice-overlay',
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="choice-overlay" [class.selected]="selected"
         [attr.data-tier]="sizeTier">
      <div class="chip">
        <span class="label">{{ label || stateName }}</span>
        <span class="badge" *ngIf="sizeTier !== 'tiny'"
              [class.proven]="proofState === 'proven'"
              [class.impossible]="proofState === 'impossible'">
          {{ badgeText }}
        </span>
        <button class="expand" *ngIf="hasPopupView && sizeTier === 'full'"
                (click)="popupRequested.emit(); $event.stopPropagation()"
                title="Details + tried conditions">
          <mat-icon>open_in_full</mat-icon>
        </button>
      </div>
      <div class="summary" *ngIf="sizeTier === 'full' && description">
        {{ description }}
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100%; }
    .choice-overlay {
      display: flex; flex-direction: column; align-items: center;
      justify-content: flex-end; height: 100%;
      pointer-events: none; /* clicks fall through to the 3D canvas */
    }
    .chip {
      display: inline-flex; align-items: center; gap: 6px;
      background: rgba(255, 255, 255, 0.92);
      border: 1px solid rgba(0, 0, 0, 0.12);
      border-radius: 12px; padding: 2px 9px;
      font-size: 12px; font-weight: 600; color: #333;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
      white-space: nowrap;
    }
    .selected .chip {
      border-color: var(--brand-teal, #159588);
      box-shadow: 0 0 0 2px rgba(21, 149, 136, 0.35);
    }
    .badge {
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.4px; padding: 0 6px; border-radius: 8px;
      background: #eceff1; color: #607d8b;
    }
    .badge.proven { background: #e8f5e9; color: #1b5e20; }
    .badge.impossible { background: #fbe9e7; color: #8d2f23; }
    .expand {
      pointer-events: auto; border: none; background: none; cursor: pointer;
      width: 18px; height: 18px; padding: 0; display: inline-flex;
      align-items: center; color: #607d8b;
    }
    .expand mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .summary {
      margin-top: 3px; font-size: 10.5px; color: #555;
      background: rgba(255, 255, 255, 0.85); border-radius: 6px;
      padding: 1px 7px; max-width: 100%; overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap;
    }
  `],
})
export class MaterialChoiceOverlayComponent extends StateOverlayBase {
  @Input() label = '';
  @Input() description = '';
  @Input() proofState: MaterialProofState = 'unproven';
  @Input() selected = false;

  override hasPopupView = true;

  get badgeText(): string {
    switch (this.proofState) {
      case 'proven': return 'proven';
      case 'impossible': return 'impossible';
      default: return 'unproven';
    }
  }
}
