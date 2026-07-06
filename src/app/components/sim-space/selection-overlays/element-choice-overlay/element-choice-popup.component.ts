import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA, MatDialogModule, MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface ElementChoicePopupData {
  key: string;
  label: string;
  description: string;
  /** Common ions — each is a selectable VARIANT of the element. */
  variants: string[];
}

/** The selector's popup result: select the element, or one of its ions. */
export interface ElementChoiceResult {
  select: true;
  variant?: string;
}

/**
 * Element details + ION selection (same popup wiring as every state
 * overlay): "Select element" picks the neutral atom; each ion button
 * picks that charge state — the selector publishes {key, variant}.
 */
@Component({
  standalone: true,
  selector: 'element-choice-popup',
  imports: [CommonModule, MatButtonModule, MatDialogModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>science</mat-icon> {{ data.label }}
    </h2>
    <mat-dialog-content>
      <p class="description">{{ data.description }}</p>
      <ng-container *ngIf="data.variants.length; else noIons">
        <p class="ions-label">Common ions — select a charge state:</p>
        <div class="ions">
          <button mat-stroked-button *ngFor="let ion of data.variants"
                  (click)="pick(ion)">
            {{ ion }}
          </button>
        </div>
      </ng-container>
      <ng-template #noIons>
        <p class="ions-label muted">
          No common ionic forms — select the neutral atom.
        </p>
      </ng-template>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button mat-dialog-close>Close</button>
      <button mat-flat-button color="primary" (click)="pick(undefined)">
        <mat-icon>check</mat-icon> Select element
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2 { display: flex; align-items: center; gap: 8px; font-size: 1.1rem; }
    h2 mat-icon { color: var(--brand-teal, #159588); }
    .description { font-size: 0.9rem; color: #444; }
    .ions-label { font-size: 0.85rem; color: #555; margin: 10px 0 6px; }
    .ions-label.muted { font-style: italic; opacity: 0.8; }
    .ions { display: flex; flex-wrap: wrap; gap: 8px; }
  `],
})
export class ElementChoicePopupComponent {
  constructor(
    public dialogRef: MatDialogRef<ElementChoicePopupComponent,
                                   ElementChoiceResult>,
    @Inject(MAT_DIALOG_DATA) public data: ElementChoicePopupData,
  ) {}

  pick(variant: string | undefined): void {
    this.dialogRef.close({ select: true, variant });
  }
}
