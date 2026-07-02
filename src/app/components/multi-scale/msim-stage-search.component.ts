import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { MsimStage } from '@models/multi-scale/NamedMultiScaleSimConfig';
import {
  MultiScaleSimDefinitionService,
  StageSearchReport,
} from '@services/multi-scale/multi-scale-sim-definition.service';

/**
 * Stage solution search (Run mode) — "attempt multiple candidate
 * solutions to reach one valid solution". Each click of the loop calls
 * the stateless search endpoint once per batch until achieved, exhausted
 * or the user stops. An exhausted search shows every attempt's candidate
 * + plain-language reason — the same "disabled with reason and data"
 * surface downstream choices carry.
 */
@Component({
  standalone: true,
  selector: 'msim-stage-search',
  imports: [CommonModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="search-box">
      <div class="search-controls">
        <button mat-stroked-button color="primary" *ngIf="!searching"
                [disabled]="report?.achieved ?? false"
                (click)="start()">
          <mat-icon>manage_search</mat-icon>
          {{ report ? 'Continue the search' : 'Search for a solution' }}
        </button>
        <button mat-stroked-button *ngIf="searching" (click)="stopRequested = true">
          <mat-icon>stop</mat-icon> Stop
        </button>
        <mat-spinner *ngIf="searching" diameter="18"></mat-spinner>
        <span class="search-progress" *ngIf="report">
          attempted {{ report.attempted }} of {{ report.totalCandidates }} candidates
        </span>
      </div>

      <div class="search-result ok" *ngIf="report?.achieved && report?.winner as w">
        <mat-icon>check_circle</mat-icon>
        <div>
          <strong>Solution found</strong> — {{ candidateText(w.candidate) }}
          <div class="derived" *ngIf="w.derivedValues && (w.derivedValues | json) !== '{}'">
            proves: {{ derivedText(w.derivedValues) }}
          </div>
        </div>
      </div>

      <div class="search-result bad" *ngIf="report?.exhausted && !report?.achieved">
        <mat-icon>block</mat-icon>
        <div>
          <strong>No valid solution in the searched candidates.</strong>
          This record travels with any choice this stage would have enabled.
          <table class="attempts-table">
            <tr *ngFor="let a of report!.attempts">
              <td>{{ candidateText(a.candidate) }}</td>
              <td>{{ a.reason || a.error || '—' }}</td>
            </tr>
          </table>
        </div>
      </div>

      <div class="search-result bad" *ngIf="errorMessage">
        <mat-icon>error_outline</mat-icon> {{ errorMessage }}
      </div>
    </div>
  `,
  styles: [`
    .search-box { margin-top: 6px; }
    .search-controls { display: flex; align-items: center; gap: 8px; }
    .search-progress { font-size: 12px; color: var(--text-secondary, #777); }
    .search-result {
      display: flex; gap: 8px; margin-top: 8px; font-size: 12.5px;
      border-radius: 8px; padding: 8px 10px; align-items: flex-start;
      mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }
      &.ok { background: #e8f5e9; color: #1b5e20; }
      &.bad { background: #fbe9e7; color: #8d2f23; }
      .derived { font-style: italic; margin-top: 2px; }
    }
    .attempts-table {
      margin-top: 6px; border-collapse: collapse; font-size: 12px;
      td { border-top: 1px solid rgba(0,0,0,0.1); padding: 3px 10px 3px 0; }
    }
  `],
})
export class MsimStageSearchComponent {
  @Input({ required: true }) msimName!: string;
  @Input({ required: true }) stage!: MsimStage;
  /** Emitted when the search achieves a solution (stage state changed). */
  @Output() achieved = new EventEmitter<void>();

  report: StageSearchReport | null = null;
  searching = false;
  stopRequested = false;
  errorMessage: string | null = null;

  constructor(private msimService: MultiScaleSimDefinitionService) {}

  async start(): Promise<void> {
    if (this.searching) return; // double-click guard
    this.searching = true;
    this.stopRequested = false;
    this.errorMessage = null;
    try {
      // One call per batch; the endpoint is stateless/resumable, so we
      // just keep calling until done or the user stops.
      for (let i = 0; i < 500; i++) {
        const report = await this.msimService.runStageSearch(
          this.msimName, this.stage.key, this.stage.search?.batchSize);
        this.report = report;
        if (report.error) { this.errorMessage = report.error; break; }
        if (report.achieved) { this.achieved.emit(); break; }
        if (report.exhausted || this.stopRequested) break;
      }
    } catch (err: any) {
      this.errorMessage = err?.message || String(err);
    } finally {
      this.searching = false;
    }
  }

  candidateText(candidate: Record<string, number> | null | undefined): string {
    if (!candidate) return '';
    return Object.entries(candidate).map(([k, v]) => `${k} = ${v}`).join(', ');
  }

  derivedText(derived: Record<string, unknown>): string {
    return Object.entries(derived)
      .filter(([, v]) => typeof v === 'number' || typeof v === 'string')
      .slice(0, 6)
      .map(([k, v]) => `${k} = ${v}`).join(', ');
  }
}
