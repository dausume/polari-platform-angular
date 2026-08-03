import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CRUDEservicesManager } from '@services/crude-services-manager';

/**
 * Generic no-code class table: renders the live CRUDE rows of ANY
 * backend class, so a module's data gets a page by seeding a
 * DisplayDefinition — no per-module component work. Columns default
 * to the first row's simple fields (long text and *_json blobs are
 * skipped); pin them explicitly with the `columns` input when a page
 * wants a curated view.
 *
 * MULTI-REFERENCE USE. Set `filterField` + `filterValue` to make this
 * "the rows of X that reference THIS object" rather than "every row
 * of X" — the reference the page already knows, pushed down to the
 * server as a query param. That is the collection half of the
 * single-vs-multi reference pair; the single half is
 * `instance-detail-panel`.
 */
@Component({
  standalone: true,
  selector: 'class-rows-table',
  imports: [CommonModule, MatProgressSpinnerModule],
  template: `
    <div class="class-rows-table">
      <div *ngIf="loading" class="state"><mat-spinner diameter="28"></mat-spinner></div>
      <div *ngIf="error" class="state error">{{ error }}</div>
      <table *ngIf="!loading && !error && rows.length > 0">
        <thead>
          <tr><th *ngFor="let column of activeColumns">{{ column }}</th></tr>
        </thead>
        <tbody>
          <tr *ngFor="let row of rows">
            <td *ngFor="let column of activeColumns">{{ cell(row, column) }}</td>
          </tr>
        </tbody>
      </table>
      <div *ngIf="!loading && !error && rows.length === 0" class="state">
        No {{ className }} rows.
      </div>
    </div>
  `,
  styles: [`
    .class-rows-table { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9em; }
    th, td {
      text-align: left; padding: 6px 10px;
      border-bottom: 1px solid var(--border-medium, #ddd);
      white-space: nowrap; max-width: 280px;
      overflow: hidden; text-overflow: ellipsis;
    }
    th { color: var(--text-secondary, #666); font-weight: 600; }
    .state { padding: 16px; color: var(--text-secondary, #666); }
    .state.error { color: var(--error-text, #b3261e); }
  `],
})
export class ClassRowsTableComponent implements OnInit {
  /** Backend class name, e.g. 'FoodItem', 'CompostLoopDefinition'. */
  @Input() className = '';
  /** Optional comma-separated column pin, e.g. 'name,status,notes'. */
  @Input() columns = '';
  /** Cap rendered rows (0 = all). */
  @Input() maxRows = 0;

  /** Field on this class holding the reference to filter by
   *  (e.g. 'design_ref'). Empty = unfiltered. */
  @Input() filterField = '';

  /** The reference value the page is scoped to
   *  (e.g. 'clock-lavet-m0'). */
  @Input() filterValue = '';

  /** Show `*_json` config blobs as columns. Off by default because
   *  they are unreadable inline — but a curated page that has no
   *  better renderer yet can opt in rather than falling back to a
   *  whole-payload JSON dump. */
  @Input() includeJsonFields = false;

  rows: any[] = [];
  activeColumns: string[] = [];
  loading = true;
  error: string | null = null;

  constructor(private crudeManager: CRUDEservicesManager) {}

  ngOnInit(): void {
    if (!this.className) {
      this.loading = false;
      this.error = 'class-rows-table: no className input.';
      return;
    }
    const filter = this.filterField && this.filterValue
      ? { [this.filterField]: this.filterValue }
      : undefined;
    this.crudeManager.getCRUDEclassService(this.className).readAll(filter).subscribe({
      next: (envelope: any) => {
        const rows = envelope?.[0]?.[this.className]?.[0]?.data ?? [];
        this.rows = this.maxRows > 0 ? rows.slice(0, this.maxRows) : rows;
        this.activeColumns = this.columns
          ? this.columns.split(',').map((column) => column.trim()).filter(Boolean)
          : this.deriveColumns(this.rows[0]);
        this.loading = false;
      },
      error: (err: any) => {
        this.loading = false;
        this.error = `Could not read ${this.className}: ${err?.message || 'request failed'}`;
      },
    });
  }

  private deriveColumns(first: any): string[] {
    if (!first || typeof first !== 'object') {
      return [];
    }
    return Object.keys(first)
      .filter((key) => this.includeJsonFields || !key.endsWith('_json'))
      .filter((key) => !key.startsWith('_'))
      .filter((key) => {
        const value = first[key];
        return value === null
          || ['string', 'number', 'boolean'].includes(typeof value);
      })
      .filter((key) => String(first[key] ?? '').length <= 120)
      .slice(0, 8);
  }

  cell(row: any, column: string): string {
    const value = row?.[column];
    if (value === null || value === undefined) {
      return '';
    }
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  }
}
