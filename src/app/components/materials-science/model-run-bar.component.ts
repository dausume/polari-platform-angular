import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

import { EngineTemplate } from '@models/materials-science/engine-model-types';

/**
 * The shared header bar of both model-config surfaces: live capability
 * verdict for the selected template, Validate / Run buttons, and the
 * last outcome line. Presentational — the host owns the calls.
 */
@Component({
  standalone: true,
  selector: 'model-run-bar',
  imports: [CommonModule, MatButtonModule, MatIconModule,
            MatProgressSpinnerModule, MatTooltipModule],
  template: `
    <div class="run-bar">
      <span class="capability" *ngIf="template"
            [class.bad]="!template!.capability.ok"
            [matTooltip]="capabilityTip">
        <mat-icon>{{ template!.capability.ok ? 'memory' : 'cloud_off' }}</mat-icon>
        {{ template!.capability.ok
           ? (template!.engineKey + ' available · ' + template!.costClass)
           : (template!.engineKey + ' UNAVAILABLE — refusals will name the knob') }}
      </span>
      <button mat-stroked-button (click)="validate.emit()"
              [disabled]="busy">
        <mat-icon>rule</mat-icon> Validate
      </button>
      <button mat-stroked-button color="primary" (click)="run.emit()"
              [disabled]="busy">
        <mat-icon>play_arrow</mat-icon> Run
      </button>
      <mat-spinner *ngIf="busy" diameter="18"></mat-spinner>
      <span class="outcome" *ngIf="outcome" [class.bad]="outcomeBad">
        {{ outcome }}
      </span>
    </div>
  `,
  styles: [`
    .run-bar { display: flex; align-items: center; gap: 10px;
               flex-wrap: wrap; margin: 8px 0; }
    .capability {
      display: inline-flex; align-items: center; gap: 5px;
      font-size: 12px; padding: 3px 10px; border-radius: 10px;
      background: var(--color-success-bg); color: var(--color-success-text); cursor: help;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &.bad { background: var(--color-warn-bg); color: var(--color-warn-text); }
    }
    .outcome { font-size: 12.5px; color: var(--color-success-text); }
    .outcome.bad { color: var(--color-error-text); }
  `],
})
export class ModelRunBarComponent {
  @Input() template: EngineTemplate | null = null;
  @Input() busy = false;
  @Input() outcome = '';
  @Input() outcomeBad = false;
  @Output() validate = new EventEmitter<void>();
  @Output() run = new EventEmitter<void>();

  get capabilityTip(): string {
    const cap = this.template?.capability;
    if (!cap) return '';
    if (cap.ok) return 'The required capability layer answers.';
    return JSON.stringify(cap.missing?.[0] ?? cap, null, 1).slice(0, 400);
  }
}
