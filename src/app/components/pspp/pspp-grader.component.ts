import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PsppService } from '@services/pspp/pspp.service';

/**
 * Recipe grader: enter an oxide composition (mass or moles), pick a
 * material family, and grade the DERIVED ratios against the patent
 * reaction windows (US 4,349,386 / 4,472,199 — editable
 * ReactionWindow rows). Ratios are computed, never hand-entered;
 * descriptors without a window stay honestly unjudged.
 */
@Component({
  selector: 'pspp-grader',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="grader">
    <h2>PSPP — Composition grader</h2>
    <p class="hint">Windows are per-family and never transfer between
      families. Grades: inside a patent-claimed range = ideal ·
      outside = failure (finer bands load as data when sources give
      them).</p>
    <div class="form">
      <div class="row" *ngFor="let ox of oxides; let i = index">
        <label>{{ ox }}</label>
        <input type="number" [(ngModel)]="amounts[ox]" min="0"
               placeholder="0"/>
      </div>
      <div class="row">
        <label>basis</label>
        <select [(ngModel)]="basis">
          <option value="mass">mass (wt)</option>
          <option value="moles">moles (formula)</option>
        </select>
      </div>
      <div class="row">
        <label>family</label>
        <select [(ngModel)]="family">
          <option *ngFor="let f of families" [value]="f">{{ f }}
          </option>
        </select>
      </div>
      <button (click)="grade()">Derive ratios + grade</button>
    </div>

    <div *ngIf="result?.ok" class="result">
      <h3>Derived ratios (computed, never stored)</h3>
      <table>
        <tr *ngFor="let r of ratioRows">
          <td>{{ r.key }}</td>
          <td>{{ r.value === null ? '—' : (r.value | number:'1.0-3')
            }}</td>
        </tr>
      </table>
      <div class="absent" *ngFor="let a of result.absentDenominators">
        {{ a }}</div>

      <h3>Window verdicts — {{ family }}</h3>
      <div *ngIf="!result.grading.ok" class="refusal">
        {{ result.grading.refusal }} — {{ result.grading.suggestion }}
      </div>
      <div *ngIf="result.grading.ok">
        <div class="overall grade-{{ result.grading.overall }}">
          overall: {{ result.grading.overall }}</div>
        <div *ngFor="let g of result.grading.graded" class="win">
          <div class="win-head">
            <b>{{ g.descriptor }}</b> = {{ g.value | number:'1.0-3' }}
            <span class="grade-{{ g.grade }}"> {{ g.grade }}</span>
          </div>
          <svg viewBox="0 0 300 16" class="bar">
            <rect x="0" y="6" width="300" height="4" class="rail"/>
            <rect [attr.x]="barX(g, g.center - windowHalf(g))" y="4"
                  [attr.width]="barW(g)" height="8" class="range"/>
            <line [attr.x1]="barX(g, g.value)"
                  [attr.x2]="barX(g, g.value)" y1="0" y2="16"
                  class="marker"/>
          </svg>
          <div class="note">{{ g.behaviorNote }}</div>
        </div>
        <div class="unjudged" *ngIf="result.grading.unjudged?.length">
          Unjudged (no window in this family — honest absence):
          {{ result.grading.unjudged.join(', ') }}
        </div>
      </div>
    </div>
    <div *ngIf="result && !result.ok" class="refusal">
      {{ result.refusal }} — {{ result.suggestion }}</div>
  </div>`,
  styles: [`
    .grader { max-width: 620px; margin: 0 auto; padding: 12px; }
    .hint { font-size: 12px; color: #6b6455; }
    .form { border: 1px solid #d7d2c4; border-radius: 8px;
      padding: 10px; background: #fffdf7; }
    .row { display: flex; gap: 8px; margin: 3px 0; }
    .row label { width: 70px; font-size: 12px; padding-top: 4px; }
    .row input, .row select { width: 130px; }
    button { margin-top: 8px; }
    table td { font-size: 12px; padding: 1px 10px 1px 0; }
    .absent { font-size: 11px; color: #8a8272; }
    .refusal { background: #fdf0ee; border: 1px solid #e0b4ac;
      border-radius: 6px; padding: 8px; font-size: 12px;
      margin-top: 8px; }
    .win { margin: 8px 0; }
    .win-head { font-size: 12px; }
    .bar .rail { fill: #e4ddcc; }
    .bar .range { fill: #cfe3c8; }
    .bar .marker { stroke: #333; stroke-width: 2; }
    .overall { font-weight: 600; margin: 4px 0; }
    .grade-ideal { color: #40702f; }
    .grade-acceptable { color: #6f8f3c; }
    .grade-marginal { color: #a5762a; }
    .grade-failure { color: #a23b2a; }
    .note { font-size: 10px; color: #6b6455; }
    .unjudged { font-size: 11px; color: #6b6455; margin-top: 6px; }
  `],
})
export class PsppGraderComponent implements OnInit {
  oxides = ['SiO2', 'Al2O3', 'Na2O', 'K2O', 'CaO', 'MgO', 'Fe2O3',
    'H2O'];
  amounts: Record<string, number> = {
    SiO2: 24, Al2O3: 10.2, Na2O: 6.8, H2O: 59 };
  basis = 'mass';
  family = 'na-k-pss';
  families = ['na-k-pss', 'k-ps-kaliophilite'];
  result: any = null;
  ratioRows: { key: string; value: number | null }[] = [];

  constructor(private pspp: PsppService) {}

  ngOnInit(): void { this.grade(); }

  async grade(): Promise<void> {
    const composition: Record<string, number> = {};
    for (const ox of this.oxides) {
      const v = Number(this.amounts[ox]);
      if (v > 0) { composition[ox] = v; }
    }
    this.result = await this.pspp.grade(
      composition, this.basis, this.family);
    if (this.result?.families?.length) {
      this.families = this.result.families;
    }
    this.ratioRows = this.result?.ok
      ? Object.entries(this.result.ratios).map(([key, value]) =>
        ({ key, value: value as number | null }))
      : [];
  }

  windowHalf(g: any): number {
    const w = this.result.windows.find(
      (x: any) => x.descriptor === g.descriptor);
    return w ? w.tolerances.marginal : 1;
  }

  barX(g: any, value: number): number {
    const half = this.windowHalf(g) * 1.6;
    const lo = g.center - half;
    const hi = g.center + half;
    const clamped = Math.max(lo, Math.min(hi, value));
    return ((clamped - lo) / (hi - lo)) * 300;
  }

  barW(g: any): number {
    return this.barX(g, g.center + this.windowHalf(g))
      - this.barX(g, g.center - this.windowHalf(g));
  }
}
