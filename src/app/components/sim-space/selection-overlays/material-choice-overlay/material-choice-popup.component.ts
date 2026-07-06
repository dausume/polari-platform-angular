import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA, MatDialogModule, MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

import { MsimConditionMapComponent } from '@components/multi-scale/msim-condition-map.component';
import { MaterialProofState } from './material-choice-overlay.component';

export interface MaterialChoicePopupData {
  key: string;
  label: string;
  description: string;
  proofState: MaterialProofState;
  proofSummary: string;
  /** For the embedded tried-conditions map. */
  msimName: string;
  stageKey: string;
}

/**
 * The material-choice POPUP — opened via the same MatDialog wiring
 * (panelClass 'state-overlay-popup-panel') the 2D state overlays use
 * when their popupRequested fires: substance identity, its proof
 * verdict, the tried-conditions map, and the "Select this material"
 * action (returned to the opener as the dialog result).
 */
@Component({
  standalone: true,
  selector: 'material-choice-popup',
  imports: [
    CommonModule, MatButtonModule, MatDialogModule, MatIconModule,
    MsimConditionMapComponent,
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>science</mat-icon> {{ data.label }}
      <span class="badge" [class.proven]="data.proofState === 'proven'"
            [class.impossible]="data.proofState === 'impossible'">
        {{ data.proofState }}
      </span>
    </h2>
    <mat-dialog-content>
      <p class="description" *ngIf="data.description">{{ data.description }}</p>
      <p class="proof" *ngIf="data.proofSummary">{{ data.proofSummary }}</p>
      <msim-condition-map
          [msimName]="data.msimName" [stageKey]="data.stageKey">
      </msim-condition-map>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button mat-dialog-close>Close</button>
      <button mat-flat-button color="primary"
              [mat-dialog-close]="'select'"
              [disabled]="data.proofState === 'impossible'">
        <mat-icon>check</mat-icon> Select this material
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2 { display: flex; align-items: center; gap: 8px; font-size: 1.1rem; }
    h2 mat-icon { color: var(--brand-teal, #159588); }
    .badge {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.4px; padding: 1px 8px; border-radius: 9px;
      background: #eceff1; color: #607d8b;
    }
    .badge.proven { background: #e8f5e9; color: #1b5e20; }
    .badge.impossible { background: #fbe9e7; color: #8d2f23; }
    .description { font-size: 0.9rem; line-height: 1.45; color: #444; }
    .proof { font-size: 0.85rem; font-style: italic; color: #1b5e20; }
    msim-condition-map { display: block; margin-top: 8px; min-width: 480px; }
  `],
})
export class MaterialChoicePopupComponent {
  constructor(
    public dialogRef: MatDialogRef<MaterialChoicePopupComponent>,
    @Inject(MAT_DIALOG_DATA) public data: MaterialChoicePopupData,
  ) {}
}
