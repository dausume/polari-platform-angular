/**
 * c-isotope-section — the extra block on a CIsotope's /object/CIsotope/:name page (ucd-iso-1, his ruling
 * 2026-10-10: "C-isotopes should only have the substitutions needed for their board and other datasheet
 * properties and inherit general structure from their parent … specify a minimum-level property").
 *
 * The CIsotope row itself (parent, bindings_json, substitutions_json, source, minimum_level, sha256, foundational,
 * provenance) already comes down through the generic page's own CRUDE read and renders via structured-payload-panel
 * above this section — this section ADDS the parts that need their own widget: the source as a code block, the
 * parent as a direct link, substitutions as a small table, and the minimum-level sentence. No extra door: the row
 * is read off the SAME `record`/`row` the generic page already fetched (passed down as `@Input row`), so there is
 * no absence to degrade — a CIsotope row that exists always has these fields (possibly empty).
 */
import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges } from '@angular/core';
import { RouterModule } from '@angular/router';

import { CodeBlockComponent } from '@components/shared/code-block/code-block.component';

interface Substitution { identifier?: string; name?: string; value?: any; datasheet_kind?: string; datasheet?: string; fact?: string; why?: string; }

@Component({
  standalone: true,
  selector: 'c-isotope-section',
  imports: [CommonModule, RouterModule, CodeBlockComponent],
  template: `
    <section class="isotope-section" *ngIf="row">
      <h3>Isotope of
        <a *ngIf="parent" class="ref" [routerLink]="['/object', 'CFunctionAtom', parent]">{{ parent }}</a>
        <span *ngIf="!parent" class="muted">(no parent named)</span>
      </h3>

      <div class="foundational" *ngIf="foundational">Foundational — this isotope has no bare-C parent body; it exists only at this runtime level.</div>

      <div class="min-level" *ngIf="minimumLevel">
        Needs at least <b>{{ minimumLevel }}</b> or better.
      </div>

      <code-block [text]="source"></code-block>

      <table class="subs" *ngIf="substitutions.length">
        <thead><tr><th>identifier</th><th>value</th><th>datasheet kind</th><th>datasheet</th><th>fact</th></tr></thead>
        <tbody>
          <tr *ngFor="let s of substitutions">
            <td>{{ s.identifier || s.name }}</td>
            <td>{{ hasValue(s.value) ? s.value : '—' }}</td>
            <td>{{ s.datasheet_kind || '—' }}</td>
            <td>
              <a *ngIf="s.datasheet" class="ref" [routerLink]="['/object', 'Datasheet', s.datasheet]">{{ s.datasheet }}</a>
              <span *ngIf="!s.datasheet" class="muted">—</span>
            </td>
            <td>{{ s.fact || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  `,
  styles: [`
    .isotope-section { margin: 18px 0; }
    .isotope-section h3 { margin: 0 0 8px; font-size: 1.05em; }
    .foundational { margin-bottom: 8px; padding: 6px 10px; border-radius: 8px; background: var(--surface-variant, #eef); font-size: .9em; }
    .min-level { margin-bottom: 10px; font-size: .9em; color: var(--text-secondary, #666); }
    .ref { color: var(--link-text, var(--brand-primary, #3f51b5)); text-decoration: none; border-bottom: 1px dotted currentColor; }
    table.subs { width: 100%; border-collapse: collapse; font-size: .88em; margin-top: 12px; }
    table.subs th, table.subs td { text-align: left; padding: 5px 8px; border-bottom: 1px solid var(--border-medium, #ddd); }
    table.subs th { color: var(--text-secondary, #666); font-weight: 600; }
    .muted { color: var(--text-secondary, #666); }
  `],
})
export class CIsotopeSectionComponent implements OnChanges {
  /** The raw CIsotope row, exactly as the generic object page's CRUDE read returned it (unshaped — this
   *  component parses its own `*_json` fields; the generic page's `shape()` is for the structured-payload-panel
   *  above, not for this section). */
  @Input() row: any = null;

  parent = '';
  source = '';
  minimumLevel = '';
  foundational = false;
  substitutions: Substitution[] = [];

  ngOnChanges(): void {
    const r = this.row || {};
    this.parent = String(r.parent || '');
    this.source = String(r.source || '');
    this.minimumLevel = String(r.minimum_level || '');
    this.foundational = !!r.foundational;
    this.substitutions = this.parseSubs(r.substitutions_json);
  }

  hasValue(v: any): boolean {
    return v !== undefined && v !== null && v !== '';
  }

  private parseSubs(v: any): Substitution[] {
    if (!v) { return []; }
    let parsed = v;
    if (typeof v === 'string') {
      try { parsed = JSON.parse(v); } catch { return []; }
    }
    if (Array.isArray(parsed)) { return parsed; }
    if (parsed && typeof parsed === 'object') {
      // {identifier: {value, datasheet_kind, datasheet, fact}} shape — spread into rows.
      return Object.keys(parsed).map((k) => ({ identifier: k, ...(parsed[k] || {}) }));
    }
    return [];
  }
}
