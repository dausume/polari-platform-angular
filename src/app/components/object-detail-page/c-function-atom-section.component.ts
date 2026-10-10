/**
 * c-function-atom-section — the "Code interface" block on a CFunctionAtom's /object/CFunctionAtom/:name page
 * (ucd-iso-1, his ruling 2026-10-10: "a code-interface that shows it as though it is actual c-code, with the
 * variables that come from board and pin specifications and other data-sheets laid out in the code clearly with
 * comment that should autogenerate saying which data-sheet they should come from … the c-atom details page should
 * also contain all C-isotopes based on it").
 *
 * Doors (GET, both optional — a backend without cmod's iso-0 slice just never calls back and the section hides
 * itself; the generic record above it still renders):
 *   /api/cmod/atoms/{atom}/code[?binding=<solution>@<board>] → {ok, atom, source, lines[{n,text,comment}],
 *     identifiers[{name,kind,datasheet_kind,datasheet,fact,value,why}], bindings{soc,board,programming}, rendered}
 *   /api/cmod/atoms/{atom}/isotopes → {ok, rows:[CIsotope rows]}
 *   /api/firmware/bindings → {ok, rows:[HardwareBinding-ish rows]} — only shown as a picker when it has rows
 *     ("when the atom is used by a solution"); this door's absence/emptiness just hides the picker, not the rest.
 */
import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';

import { PolariService } from '@services/polari-service';
import { CodeBlockComponent, CodeBlockLine } from '@components/shared/code-block/code-block.component';
import { ClassRowsTableComponent } from '@components/dashboard/generic/class-rows-table.component';

interface CodeIdentifier {
  name: string;
  kind: 'register' | 'pin-macro' | 'knob' | 'global' | 'library' | string;
  datasheet_kind: 'soc' | 'board' | 'programming' | '';
  datasheet: string;
  fact: string;
  value?: any;
  why?: string;
}
interface CodeDoorResponse {
  ok: boolean;
  atom: string;
  source: string;
  lines: CodeBlockLine[];
  identifiers: CodeIdentifier[];
  bindings: { soc?: string; board?: string; programming?: string };
  rendered: string;
}
interface BindingRow { name: string; [k: string]: any; }

@Component({
  standalone: true,
  selector: 'c-function-atom-section',
  imports: [CommonModule, RouterModule, CodeBlockComponent, ClassRowsTableComponent],
  template: `
    <section class="code-interface" *ngIf="loaded">
      <h3>Code interface</h3>

      <div class="legend" *ngIf="datasheetLinks.length">
        <span class="lbl">Draws on</span>
        <a *ngFor="let d of datasheetLinks" class="ref chip" [routerLink]="['/object', 'Datasheet', d.slug]">{{ d.kind }}: {{ d.slug }}</a>
      </div>

      <div class="binding-picker" *ngIf="bindings.length">
        <label>Binding
          <select #sel (change)="pickBinding(sel.value)">
            <option value="" [selected]="!bindingPick">(unbound)</option>
            <option *ngFor="let b of bindings" [value]="b.name" [selected]="b.name === bindingPick">{{ b.name }}</option>
          </select>
        </label>
      </div>

      <code-block [lines]="code?.lines || []" [text]="code?.rendered || code?.source || ''"></code-block>

      <table class="idents" *ngIf="identifiers.length">
        <thead>
          <tr><th>name</th><th>kind</th><th>datasheet kind</th><th>datasheet</th><th>fact</th><th>value</th></tr>
        </thead>
        <tbody>
          <tr *ngFor="let id of identifiers">
            <td>{{ id.name }}</td>
            <td>{{ id.kind }}</td>
            <td>{{ id.datasheet_kind || '—' }}</td>
            <td>
              <a *ngIf="id.datasheet" class="ref" [routerLink]="['/object', 'Datasheet', id.datasheet]">{{ id.datasheet }}</a>
              <span *ngIf="!id.datasheet" class="muted">—</span>
            </td>
            <td>
              <a *ngIf="id.fact" class="ref" [routerLink]="['/object', factClass(id.fact), id.fact]" [title]="factClassNote">{{ id.fact }}</a>
              <span *ngIf="!id.fact" class="muted">—</span>
            </td>
            <td>{{ hasValue(id.value) ? id.value : '—' }}</td>
          </tr>
        </tbody>
      </table>

      <h4 class="isotopes-head" *ngIf="isotopesPath">C-isotopes based on this atom</h4>
      <class-rows-table *ngIf="isotopesPath"
        [dataPath]="isotopesPath"
        columns="name,bindings_json,minimum_level,foundational,sha256,source"
        columnFormats="name:ref:CIsotope,sha256:sha,source:code"
        [maxRows]="50">
      </class-rows-table>
    </section>
  `,
  styles: [`
    .code-interface { margin: 18px 0; }
    .code-interface h3 { margin: 0 0 8px; font-size: 1.05em; }
    .isotopes-head { margin: 16px 0 6px; font-size: .95em; color: var(--text-secondary, #666); }
    .legend { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 10px; font-size: .9em; }
    .legend .lbl { color: var(--text-secondary, #666); }
    .ref.chip { display: inline-block; padding: 2px 8px; border-radius: 10px; background: var(--surface-variant, #eef); color: inherit; text-decoration: none; }
    .ref { color: var(--link-text, var(--brand-primary, #3f51b5)); text-decoration: none; border-bottom: 1px dotted currentColor; }
    .binding-picker { margin-bottom: 10px; font-size: .9em; }
    .binding-picker select { margin-left: 6px; font: inherit; }
    table.idents { width: 100%; border-collapse: collapse; font-size: .88em; margin-top: 12px; }
    table.idents th, table.idents td { text-align: left; padding: 5px 8px; border-bottom: 1px solid var(--border-medium, #ddd); }
    table.idents th { color: var(--text-secondary, #666); font-weight: 600; }
    .muted { color: var(--text-secondary, #666); }
  `],
})
export class CFunctionAtomSectionComponent implements OnChanges {
  @Input() atomName = '';
  /** The page URL's `?binding=` when present (object-detail-page's own queryParamMap read) — the section's
   *  STARTING binding only; its own picker (above) may move away from it without rewriting the page URL. */
  @Input() bindingParam = '';

  loaded = false;
  code: CodeDoorResponse | null = null;
  identifiers: CodeIdentifier[] = [];
  datasheetLinks: { kind: string; slug: string }[] = [];
  bindings: BindingRow[] = [];
  bindingPick = '';
  isotopesPath = '';

  /** GUESS (noted per his instruction to say so): the code door's `fact` is a bare row name, not a class —
   *  a RegisterField name's last ':'-segment carries a register.bit-style dot (e.g. 'atmega328p:PORTB.PB5');
   *  a DatasheetFact name's does not (e.g. 'atmega328p:baud:9600'). No other signal is carried to tell them apart. */
  readonly factClassNote = "guessed class: '.' in the last segment → RegisterField, else DatasheetFact";

  constructor(private http: HttpClient, private polari: PolariService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['atomName']) {
      this.bindingPick = this.bindingParam || '';
      this.isotopesPath = this.atomName ? `/api/cmod/atoms/${encodeURIComponent(this.atomName)}/isotopes` : '';
      this.loadBindings();
      this.loadCode();
    }
  }

  private get base(): string { return this.polari.getBackendBaseUrl(); }
  private get headers(): any { return (this.polari.backendRequestOptions as any)?.headers; }

  pickBinding(name: string): void {
    this.bindingPick = name || '';
    this.loadCode();
  }

  factClass(fact: string): string {
    const seg = (fact || '').split(':').pop() || '';
    return seg.includes('.') ? 'RegisterField' : 'DatasheetFact';
  }

  hasValue(v: any): boolean {
    return v !== undefined && v !== null && v !== '';
  }

  private loadBindings(): void {
    this.bindings = [];
    this.http.get<any>(`${this.base}/api/firmware/bindings`, { headers: this.headers }).subscribe({
      next: (r: any) => { this.bindings = (r?.ok !== false && Array.isArray(r?.rows)) ? r.rows : []; },
      error: () => { this.bindings = []; /* no solution uses this atom (yet) — the picker just stays hidden */ },
    });
  }

  private loadCode(): void {
    if (!this.atomName) { this.loaded = false; return; }
    const qs = this.bindingPick ? `?binding=${encodeURIComponent(this.bindingPick)}` : '';
    const url = `${this.base}/api/cmod/atoms/${encodeURIComponent(this.atomName)}/code${qs}`;
    this.http.get<any>(url, { headers: this.headers }).subscribe({
      next: (r: CodeDoorResponse) => {
        if (!r || r.ok === false) { this.loaded = false; return; }
        this.code = r;
        this.identifiers = r.identifiers || [];
        const b = r.bindings || {};
        this.datasheetLinks = (['soc', 'board', 'programming'] as const)
          .filter((k) => !!b[k])
          .map((k) => ({ kind: k, slug: String(b[k]) }));
        this.loaded = true;
      },
      // Degrade (the backend contract's own words): "without the doors (404), show nothing but the generic
      // record" — any failure (404 most likely; also covers a sign-in/permission refusal) just hides this
      // whole section, never a raw error under the generic structured-payload-panel above it.
      error: () => { this.loaded = false; },
    });
  }
}
