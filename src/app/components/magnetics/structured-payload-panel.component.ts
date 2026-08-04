import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

interface PayloadTable {
  key: string;
  label: string;
  columns: string[];
  rows: any[];
}

/**
 * The GENERIC structured reading of an engine payload.
 *
 * Forty-odd view sections had no bespoke renderer and fell through to
 * `<pre>{{ payload | json }}</pre>`. Writing forty panels would be the
 * wrong shape of work: the payloads are strikingly uniform — a handful
 * of flat scalars (design, part, material, a few numbers), one or two
 * arrays of flat records (cases, curve, checks, samples, history,
 * measurements), and some prose. So this renders that shape properly,
 * once, for every section that has nothing more specific.
 *
 * It is the same bet `class-rows-table` makes: a generic renderer over
 * a predictable shape beats N specific ones, and a section that later
 * earns a real panel just declares its own renderer and overrides this.
 *
 * What it deliberately does NOT do: invent meaning. Keys are
 * de-camel-cased for reading and nothing is reordered or hidden except
 * the context the page already shows (`ok`, `design`). Anything it
 * cannot classify stays visible as JSON under a named expander, so a
 * shape it did not anticipate is still readable rather than dropped.
 */
@Component({
  standalone: true,
  selector: 'structured-payload-panel',
  imports: [CommonModule],
  template: `
    <div class="sp" *ngIf="payload">
      <!-- Scalars: the answer's headline numbers and identifiers. -->
      <div class="readout" *ngIf="scalars.length">
        <span *ngFor="let s of scalars">
          <em>{{ s.label }}</em>
          <b>{{ s.value }}</b>
        </span>
      </div>

      <!-- Prose: findings, consequences, honesty notes. These carry
           the actual reasoning and deserve to be readable, not a
           truncated cell. -->
      <p class="prose" *ngFor="let p of prose">
        <em>{{ p.label }}</em> {{ p.value }}
      </p>

      <!-- Record arrays: the real content of most sections. -->
      <div class="tbl-wrap" *ngFor="let t of tables">
        <div class="tbl-label">{{ t.label }}
          <span class="count">{{ t.rows.length }}</span></div>
        <div class="scroll-x">
          <table class="data-table-dashed">
            <tr><th *ngFor="let c of t.columns">{{ labelOf(c) }}</th></tr>
            <tr *ngFor="let r of t.rows">
              <td *ngFor="let c of t.columns">{{ cell(r[c]) }}</td>
            </tr>
          </table>
        </div>
      </div>

      <!-- Nested objects rendered as key/value rather than hidden. -->
      <div class="tbl-wrap" *ngFor="let n of nested">
        <div class="tbl-label">{{ n.label }}</div>
        <table class="data-table-dashed">
          <tr *ngFor="let kv of n.pairs">
            <td class="k">{{ labelOf(kv[0]) }}</td>
            <td>{{ cell(kv[1]) }}</td>
          </tr>
        </table>
      </div>

      <!-- Anything unclassified stays reachable and is NAMED as such,
           rather than silently dropped. -->
      <details *ngIf="leftover">
        <summary class="label">unrendered fields</summary>
        <pre class="raw">{{ leftover }}</pre>
      </details>
    </div>
  `,
  styles: [`
    .sp { display: block; color: var(--text-on-card); min-width: 0; }
    .readout {
      display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px;
    }
    .readout span {
      border: 1px solid var(--surface-outline);
      border-radius: 10px; padding: 1px 9px; font-size: 12px;
      display: inline-flex; gap: 6px; align-items: baseline;
      max-width: 100%;
    }
    .readout em {
      font-style: normal; color: var(--text-on-card-muted);
      font-size: 11px;
    }
    .readout b { font-variant-numeric: tabular-nums; }
    .prose {
      font-size: 12.5px; margin: 4px 0;
      color: var(--text-on-card);
    }
    .prose em {
      font-style: normal; font-weight: 600;
      color: var(--text-on-card-muted);
      text-transform: uppercase; font-size: 10px;
      letter-spacing: 0.04em; margin-right: 6px;
    }
    .tbl-wrap { margin-top: 10px; min-width: 0; }
    .tbl-label {
      font-size: 10px; text-transform: uppercase;
      letter-spacing: 0.04em; color: var(--text-on-card-muted);
      margin-bottom: 3px;
    }
    .count {
      border: 1px solid var(--surface-outline);
      border-radius: 8px; padding: 0 5px; margin-left: 5px;
    }
    .k { color: var(--text-on-card-muted); white-space: nowrap; }
    .label {
      font-size: 11px; color: var(--text-on-card-muted); cursor: pointer;
    }
    .raw {
      background: var(--surface-secondary); border-radius: 6px;
      padding: 8px; font-size: 11px; max-height: 260px;
      overflow: auto; max-width: 100%;
    }
  `],
})
export class StructuredPayloadPanelComponent implements OnChanges {
  @Input() payload: any = null;

  scalars: { label: string; value: string }[] = [];
  prose: { label: string; value: string }[] = [];
  tables: PayloadTable[] = [];
  nested: { label: string; pairs: [string, any][] }[] = [];
  leftover = '';

  /** Keys the page already shows as context, or that carry no reading
   *  value on their own. */
  private static readonly SKIP = new Set(['ok', 'design', 'refusal',
    'suggestion', 'headline']);

  /** Above this many characters a string is prose, not a chip. */
  private static readonly PROSE_CHARS = 60;

  ngOnChanges(): void {
    this.scalars = []; this.prose = []; this.tables = [];
    this.nested = []; this.leftover = '';
    const p = this.payload;
    if (!p || typeof p !== 'object') { return; }

    const unclassified: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(p)) {
      if (StructuredPayloadPanelComponent.SKIP.has(key)) { continue; }
      if (value === null || value === undefined || value === '') { continue; }

      if (Array.isArray(value)) {
        if (!value.length) { continue; }
        if (this.isRecordArray(value)) {
          this.tables.push({
            key, label: this.labelOf(key),
            columns: this.columnsOf(value), rows: value,
          });
        } else {
          // A flat list is a value, not a table.
          this.scalars.push({
            label: this.labelOf(key),
            value: value.map((v) => this.cell(v)).join(', '),
          });
        }
        continue;
      }

      if (typeof value === 'object') {
        const pairs = Object.entries(value as object)
          .filter(([, v]) => v !== null && v !== undefined && v !== '')
          .filter(([, v]) => typeof v !== 'object');
        if (pairs.length) {
          this.nested.push({ label: this.labelOf(key), pairs });
        } else {
          unclassified[key] = value;
        }
        continue;
      }

      const text = String(value);
      if (typeof value === 'string'
          && text.length > StructuredPayloadPanelComponent.PROSE_CHARS) {
        this.prose.push({ label: this.labelOf(key), value: text });
      } else {
        this.scalars.push({ label: this.labelOf(key), value: text });
      }
    }

    if (Object.keys(unclassified).length) {
      this.leftover = JSON.stringify(unclassified, null, 1);
    }
  }

  /** An array is a TABLE only when its entries are flat records —
   *  otherwise its columns would be meaningless. */
  private isRecordArray(value: any[]): boolean {
    const first = value[0];
    if (!first || typeof first !== 'object' || Array.isArray(first)) {
      return false;
    }
    return Object.values(first).some((v) => typeof v !== 'object');
  }

  /** Union of the records' scalar keys, so a row missing a field
   *  still lines up instead of shifting the columns. */
  private columnsOf(value: any[]): string[] {
    const seen: string[] = [];
    for (const row of value.slice(0, 40)) {
      if (!row || typeof row !== 'object') { continue; }
      for (const [k, v] of Object.entries(row)) {
        if (typeof v === 'object' && v !== null) { continue; }
        if (!seen.includes(k)) { seen.push(k); }
      }
    }
    return seen;
  }

  /** camelCase / snake_case -> readable, without inventing words. */
  labelOf(key: string): string {
    const spaced = key
      .replace(/_/g, ' ')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2');
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
  }

  cell(value: any): string {
    if (value === null || value === undefined) { return ''; }
    if (typeof value === 'number') {
      // Long floats are noise; keep them readable without lying about
      // magnitude.
      return Number.isInteger(value) ? String(value)
        : String(Math.abs(value) < 1e-4 ? value.toExponential(2)
          : Number(value.toFixed(6)));
    }
    if (typeof value === 'object') { return JSON.stringify(value); }
    return String(value);
  }
}
