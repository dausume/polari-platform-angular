import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import {
  FormulationSearchService,
} from '@services/materials-science/formulation-search.service';

/**
 * Run / find-more controls for one FormulationSearchDefinition.
 * Each click is ONE stateless backend call (the same request-per-batch
 * semantics the msim stage search uses — refine mode is ≤ maxBatches
 * internally, so a single call completes); the outcome line reports
 * honestly, including engine failures.
 */
@Component({
  standalone: true,
  selector: 'formulation-run-controls',
  imports: [CommonModule, MatButtonModule, MatIconModule,
            MatProgressSpinnerModule],
  template: `
    <div class="run-controls">
      <button mat-stroked-button color="primary" [disabled]="running"
              (click)="start(false)">
        <mat-icon>play_arrow</mat-icon> Run the search
      </button>
      <button mat-stroked-button [disabled]="running"
              (click)="start(true)">
        <mat-icon>travel_explore</mat-icon> Find more solutions
      </button>
      <mat-spinner *ngIf="running" diameter="18"></mat-spinner>
      <span class="outcome" *ngIf="lastOutcome"
            [class.bad]="lastError">{{ lastOutcome }}</span>
    </div>
  `,
  styles: [`
    .run-controls { display: flex; align-items: center; gap: 10px;
                    flex-wrap: wrap; }
    .outcome { font-size: 12.5px; color: var(--color-success-text); }
    .outcome.bad { color: var(--color-error-text); }
  `],
})
export class FormulationRunControlsComponent {
  @Input({ required: true }) searchRef!: string;
  /** Emits the raw run report after each completed call. */
  @Output() runCompleted = new EventEmitter<any>();

  running = false;
  lastOutcome = '';
  lastError = false;

  constructor(private searchService: FormulationSearchService) {}

  async start(continueAfterWinner: boolean): Promise<void> {
    this.running = true;
    this.lastOutcome = '';
    this.lastError = false;
    try {
      const report = await this.searchService.run(this.searchRef,
        { continueAfterWinner });
      if (report?.ok === false) {
        this.lastError = true;
        this.lastOutcome = report?.error || 'search refused';
      } else {
        const persisted = report?.persistedCandidates ?? 0;
        this.lastOutcome = `outcome: ${report?.outcome || 'complete'}`
          + (report?.run ? ` · run ${report.run}` : '')
          + ` · ${persisted} candidate(s) persisted`;
      }
      this.runCompleted.emit(report);
    } catch (err: any) {
      this.lastError = true;
      this.lastOutcome = err?.error?.error || err?.message || String(err);
    } finally {
      this.running = false;
    }
  }
}
