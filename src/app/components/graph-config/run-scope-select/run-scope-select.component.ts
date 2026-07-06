import {
  Component, EventEmitter, Input, OnChanges, Output, SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

/**
 * Run scoping for object-level graph previews: rows of a simulation
 * state class carry `simulation_run_ref`, so pooling every run into one
 * chart folds unrelated timelines together. This control lists the runs
 * present in the data and emits the scoped subset ('all' preserves the
 * pooled behavior). Renders nothing for non-simulation classes (no
 * simulation_run_ref in the rows) — it always emits, so the parent can
 * bind its chart to the scoped rows unconditionally.
 */
@Component({
  standalone: true,
  selector: 'run-scope-select',
  imports: [CommonModule, FormsModule],
  template: `
    <label class="run-scope" *ngIf="runs.length">
      <span class="run-scope-label">Simulation run</span>
      <select [ngModel]="selected" (ngModelChange)="onSelect($event)">
        <option value="all">All runs (pooled)</option>
        <option *ngFor="let run of runs" [value]="run">{{ run }}</option>
      </select>
    </label>
  `,
  styles: [`
    .run-scope {
      display: inline-flex; align-items: center; gap: 8px;
      font-size: 12.5px; color: var(--text-secondary, #666);
      padding: 4px 0;
    }
    .run-scope select {
      padding: 3px 6px; border-radius: 6px;
      border: 1px solid var(--border-light, #ccc);
      background: var(--surface, #fff); color: inherit;
      max-width: 340px;
    }
  `],
})
export class RunScopeSelectComponent implements OnChanges {
  @Input() rows: any[] = [];
  @Output() scopedRows = new EventEmitter<any[]>();

  runs: string[] = [];
  selected = 'all';

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['rows']) return;
    this.runs = [...new Set(
      (this.rows ?? [])
        .map(r => r?.simulation_run_ref)
        .filter((r): r is string => typeof r === 'string' && !!r),
    )].sort();
    if (this.selected !== 'all' && !this.runs.includes(this.selected)) {
      this.selected = 'all';
    }
    this.emitScoped();
  }

  onSelect(run: string): void {
    this.selected = run;
    this.emitScoped();
  }

  private emitScoped(): void {
    this.scopedRows.emit(
      this.selected === 'all'
        ? this.rows
        : this.rows.filter(r => r?.simulation_run_ref === this.selected));
  }
}
