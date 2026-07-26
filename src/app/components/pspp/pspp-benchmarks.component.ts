import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PsppService } from '@services/pspp/pspp.service';

/**
 * Benchmark overlays (pspp-V3): the book's near-complete experiments
 * laid beside what the engines predict from the same inputs. Verdict
 * semantics are the honesty model rendered: match/mismatch only where
 * an engine genuinely predicts; refusal is a first-class result that
 * names the missing dataset; recorded = as-printed, no engine yet.
 */
@Component({
  selector: 'pspp-benchmarks',
  standalone: true,
  imports: [CommonModule],
  template: `
  <div class="wrap">
    <h2>Benchmark cases — measured vs predicted</h2>
    <p class="hint">Each case is a cited BenchmarkCase row. A refusal
      beside measured data is the point: it names exactly which
      dataset or calibration would turn that section into a
      prediction.</p>
    <div class="tabs" *ngIf="catalog?.ok">
      <button *ngFor="let b of catalog.benchmarks"
              [class.active]="b.name === selectedName"
              (click)="select(b.name)">{{ b.name }}</button>
    </div>
    <div *ngIf="overlay?.ok" class="case">
      <div class="cite">{{ overlay.source }}</div>
      <p class="use">{{ overlay.use }}</p>
      <details class="inputs">
        <summary>As-printed inputs</summary>
        <pre>{{ overlay.inputs | json }}</pre>
      </details>
      <div *ngFor="let s of overlay.sections" class="section">
        <div class="head">
          <b>{{ s.aspect }}</b>
          <span class="verdict v-{{ s.verdict }}">{{ s.verdict }}</span>
        </div>
        <div class="cols">
          <div class="col">
            <div class="lbl">measured (book)</div>
            <pre>{{ s.measured | json }}</pre>
          </div>
          <div class="col" *ngIf="s.predicted !== null">
            <div class="lbl">predicted (engines)</div>
            <div *ngIf="s.aspect === 'windows' && s.predicted.ok">
              <table>
                <tr><th>descriptor</th><th>value</th><th>grade</th>
                  <th>via</th></tr>
                <tr *ngFor="let g of s.predicted.graded">
                  <td>{{ g.descriptor }}</td>
                  <td>{{ g.value | number:'1.0-3' }}</td>
                  <td class="grade-{{ g.grade }}">{{ g.grade }}</td>
                  <td>{{ g.windowKind }}</td></tr>
              </table>
              <div class="note" *ngFor="let g of s.predicted.graded">
                <b>{{ g.descriptor }}:</b> {{ g.behaviorNote }}</div>
            </div>
            <div *ngIf="s.aspect === 'frameworks' && s.predicted.ok">
              <div class="fw"
                   *ngFor="let f of s.predicted.reachableFrameworks">
                <b [class.observed]="isObserved(s, f.framework)">
                  {{ f.framework }}</b>
                <span class="chain">{{ f.pathway.join(' → ') }}</span>
                <span class="floor">{{ f.hypothesisFloor }}</span>
              </div>
              <details>
                <summary>{{ s.predicted.blockedRules.length }}
                  blocked rules (why routes stay closed)</summary>
                <div class="blocked"
                     *ngFor="let b of s.predicted.blockedRules">
                  {{ b.rule }} — {{ b.reason }}</div>
              </details>
              <div class="note">{{ s.note }}</div>
            </div>
            <div *ngIf="s.aspect === 'cure'">
              <div *ngIf="!s.predicted.ok" class="refusal">
                <b>refused:</b> {{ s.predicted.refusal }}
                <div class="sugg">{{ s.predicted.suggestion }}</div>
              </div>
              <pre *ngIf="s.predicted.ok">{{ s.predicted | json }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div *ngIf="overlay && !overlay.ok" class="refusal">
      <b>refused:</b> {{ overlay.refusal }}
      <div class="sugg">{{ overlay.suggestion }}</div>
    </div>
  </div>`,
  styles: [`
    :host { display: block; color: var(--text-on-bg); }
    .card, .panel, .section, .form, .pspp-chart-card, .home a.card { color: var(--text-on-card); }
    .wrap { max-width: 860px; margin: 0 auto; padding: 12px;
      font-size: 12px; }
    .hint, .cite, .use { color: var(--text-on-card-muted); font-size: 11px; }
    .tabs { display: flex; gap: 6px; margin: 8px 0; flex-wrap: wrap; }
    .tabs button { font-size: 11px; padding: 4px 8px; cursor: pointer;
      border: 1px solid var(--border-light); background: var(--surface-primary);
      border-radius: 6px; }
    .tabs button.active { background: var(--brand-indigo); color: var(--text-on-primary); }
    .section { border: 1px solid var(--border-light); border-radius: 8px;
      margin: 8px 0; padding: 8px; background: var(--surface-primary); }
    .head { display: flex; justify-content: space-between; }
    .verdict { font-size: 10px; padding: 1px 8px; border-radius: 8px; }
    .v-match { background: var(--color-success-bg); }
    .v-mismatch { background: var(--color-error-bg); }
    .v-refusal { background: var(--color-warn-bg); }
    .v-recorded { background: var(--surface-secondary); }
    .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .lbl { font-size: 10px; color: var(--text-secondary); margin: 4px 0; }
    pre { font-size: 10px; white-space: pre-wrap; margin: 0;
      max-height: 220px; overflow: auto; }
    table { font-size: 11px; border-collapse: collapse; }
    td, th { padding: 2px 6px; border-bottom: 1px solid var(--border-light);
      text-align: left; }
    .grade-ideal { color: var(--color-success-text); font-weight: 600; }
    .grade-acceptable { color: var(--color-success-text); }
    .grade-marginal { color: var(--color-warn-text); }
    .grade-failure { color: var(--color-error-text); font-weight: 600; }
    .fw { margin: 3px 0; }
    .fw .observed { background: var(--color-success-bg); padding: 0 4px;
      border-radius: 4px; }
    .chain { color: var(--text-secondary); font-size: 10px; margin-left: 6px; }
    .floor { font-size: 9px; border: 1px solid var(--border-light);
      border-radius: 6px; padding: 0 4px; margin-left: 4px; }
    .blocked { font-size: 10px; color: var(--text-secondary); margin: 2px 0; }
    .note { font-size: 10px; color: var(--text-secondary); margin-top: 4px; }
    .refusal { border: 1px dashed var(--color-warn-border); border-radius: 8px;
      padding: 8px; background: var(--color-warn-bg); margin: 8px 0; }
    .sugg { color: var(--text-secondary); font-size: 11px; }
  `],
})
export class PsppBenchmarksComponent implements OnInit {
  catalog: any = null;
  overlay: any = null;
  selectedName = '';

  constructor(private pspp: PsppService) {}

  async ngOnInit(): Promise<void> {
    this.catalog = await this.pspp.benchmarks();
    const first = this.catalog?.benchmarks?.[0]?.name;
    if (first) { await this.select(first); }
  }

  async select(name: string): Promise<void> {
    this.selectedName = name;
    this.overlay = await this.pspp.benchmarkOverlay(name);
  }

  isObserved(section: any, framework: string): boolean {
    return Array.isArray(section.measured)
      && section.measured.includes(framework);
  }
}
