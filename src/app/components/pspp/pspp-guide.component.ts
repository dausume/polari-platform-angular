import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PsppService } from '@services/pspp/pspp.service';

/**
 * Experiment guide (pspp-8/V3): enter what you know about a mix —
 * every provided input earns a section (graded windows, open
 * pathways, cure schedule); every absent one becomes a GAP naming
 * the exact measurement or dataset that would close it. The gap
 * list IS the experiment plan.
 */
@Component({
  selector: 'pspp-guide',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
  <div class="wrap">
    <h2>Experiment guide</h2>
    <p class="hint">Provide what you know; sections are independent.
      Refusals render as refusals — each names its data ask.</p>
    <div class="form">
      <fieldset>
        <legend>Composition ({{ basis }})</legend>
        <div class="oxides">
          <label *ngFor="let o of oxideKeys">{{ o }}
            <input type="number" [(ngModel)]="oxides[o]" step="0.1">
          </label>
        </div>
        <label>basis
          <select [(ngModel)]="basis">
            <option value="mass">mass</option>
            <option value="moles">moles</option>
          </select></label>
        <label>family
          <select [(ngModel)]="family">
            <option value="">(none)</option>
            <option value="na-k-pss">na-k-pss (Table A)</option>
            <option value="k-ps-kaliophilite">k-ps-kaliophilite
              (Table C + p.193 bands)</option>
          </select></label>
      </fieldset>
      <fieldset>
        <legend>Activator / cure</legend>
        <label>cation
          <select [(ngModel)]="cation">
            <option value="">(none)</option>
            <option value="Na">Na</option>
            <option value="K">K</option>
          </select></label>
        <label>MR <input type="number" [(ngModel)]="mr"
                         step="0.01"></label>
        <label>cure T (C) <input type="number" [(ngModel)]="t"
                                 step="1"></label>
      </fieldset>
      <button (click)="run()">guide me</button>
    </div>

    <div *ngIf="result?.ok" class="result">
      <div class="section"
           *ngIf="result.sections.composition as comp">
        <h3>Composition verdicts</h3>
        <div *ngIf="comp.grading?.ok">
          <div class="overall grade-{{ comp.grading.overall }}">
            overall: {{ comp.grading.overall }}</div>
          <table>
            <tr><th>descriptor</th><th>value</th><th>grade</th>
              <th>what happens here</th></tr>
            <tr *ngFor="let g of comp.grading.graded">
              <td>{{ g.descriptor }}</td>
              <td>{{ g.value | number:'1.0-3' }}</td>
              <td class="grade-{{ g.grade }}">{{ g.grade }}</td>
              <td class="note">{{ g.behaviorNote }}</td></tr>
          </table>
          <div class="note" *ngIf="comp.grading.unjudged?.length">
            unjudged (no window row — honest absence):
            {{ comp.grading.unjudged.join(', ') }}</div>
        </div>
        <div *ngIf="comp.grading && !comp.grading.ok" class="refusal">
          <b>refused:</b> {{ comp.grading.refusal }}
          <div class="sugg">{{ comp.grading.suggestion }}</div>
        </div>
      </div>

      <div class="section" *ngIf="result.sections.pathways as p">
        <h3>Open reaction pathways</h3>
        <div *ngIf="p.reachableFrameworks">
          <div class="fw" *ngFor="let f of p.reachableFrameworks">
            <b>{{ f.framework }}</b>
            <span class="chain">{{ f.pathway.join(' → ') }}</span>
            <span class="floor">{{ f.hypothesisFloor }}</span>
          </div>
          <details>
            <summary>{{ p.blockedRules.length }} blocked rules</summary>
            <div class="blocked" *ngFor="let b of p.blockedRules">
              {{ b.rule }} — {{ b.reason }}</div>
          </details>
        </div>
        <div *ngIf="p.refusal" class="refusal">
          <b>refused:</b> {{ p.refusal }}
          <div class="sugg">{{ p.suggestion }}</div>
        </div>
      </div>

      <div class="section" *ngIf="result.sections.cure as c">
        <h3>Cure schedule</h3>
        <div *ngIf="c.ok">
          completion ~{{ c.completionHours | number:'1.0-1' }} h at
          {{ c.cureTemperatureC }} C (setting class
          {{ c.settingClass }})
          <div class="note" *ngFor="let a of c.assumptions">
            {{ a }}</div>
        </div>
        <div *ngIf="!c.ok" class="refusal">
          <b>refused:</b> {{ c.refusal }}
          <div class="sugg">{{ c.suggestion }}</div>
        </div>
      </div>

      <div class="section gaps" *ngIf="result.gaps?.length">
        <h3>What to measure or enter next</h3>
        <p class="hint">{{ result.note }}</p>
        <div class="gap" *ngFor="let g of result.gaps">
          <b>{{ g.section }}:</b> {{ g.refusal }}
          <div class="sugg">→ {{ g.nextData }}</div>
        </div>
      </div>
    </div>
  </div>`,
  styles: [`
    .wrap { max-width: 780px; margin: 0 auto; padding: 12px;
      font-size: 12px; }
    .hint { color: #6b6455; font-size: 11px; }
    .form { display: flex; flex-direction: column; gap: 8px; }
    fieldset { border: 1px solid #d7d2c4; border-radius: 8px;
      display: flex; gap: 10px; flex-wrap: wrap; font-size: 11px; }
    .oxides { display: flex; gap: 8px; flex-wrap: wrap; }
    label { display: flex; flex-direction: column; gap: 2px; }
    input, select { width: 90px; font-size: 11px; }
    button { align-self: flex-start; padding: 5px 14px;
      cursor: pointer; }
    .section { border: 1px solid #d7d2c4; border-radius: 8px;
      margin: 10px 0; padding: 8px; background: #fffdf7; }
    table { font-size: 11px; border-collapse: collapse; }
    td, th { padding: 2px 6px; border-bottom: 1px solid #e6e0d1;
      text-align: left; }
    .overall { display: inline-block; padding: 2px 10px;
      border-radius: 8px; margin-bottom: 6px; font-weight: 600; }
    .grade-ideal { color: #2c6b2f; }
    .grade-acceptable { color: #6b8f2c; }
    .grade-marginal { color: #a3741d; }
    .grade-failure { color: #a33a2c; }
    .note { font-size: 10px; color: #6b6455; }
    .fw { margin: 3px 0; }
    .chain { color: #6b6455; font-size: 10px; margin-left: 6px; }
    .floor { font-size: 9px; border: 1px solid #d7d2c4;
      border-radius: 6px; padding: 0 4px; margin-left: 4px; }
    .blocked { font-size: 10px; color: #6b6455; margin: 2px 0; }
    .refusal { border: 1px dashed #b0742c; border-radius: 8px;
      padding: 6px; background: #fdf6e3; margin: 4px 0; }
    .sugg { color: #6b6455; font-size: 11px; }
    .gaps { background: #fdf6e3; }
    .gap { margin: 4px 0; }
  `],
})
export class PsppGuideComponent {
  oxideKeys = ['SiO2', 'Al2O3', 'Na2O', 'K2O', 'H2O'];
  oxides: Record<string, number | null> = {
    SiO2: 31.4, Al2O3: 13.0, Na2O: null, K2O: 16.8, H2O: 40.2 };
  basis = 'mass';
  family = 'k-ps-kaliophilite';
  cation = 'Na';
  mr: number | null = 1.0;
  t = 80;
  result: any = null;

  constructor(private pspp: PsppService) {}

  async run(): Promise<void> {
    const composition: Record<string, number> = {};
    for (const [k, v] of Object.entries(this.oxides)) {
      if (v !== null && v !== undefined && !isNaN(v as number)
          && (v as number) > 0) { composition[k] = v as number; }
    }
    this.result = await this.pspp.guide({
      composition: Object.keys(composition).length
        ? composition : undefined,
      basis: this.basis,
      family: this.family,
      cation: this.cation || undefined,
      mr: this.mr ?? undefined,
      t: this.t,
    });
  }
}
