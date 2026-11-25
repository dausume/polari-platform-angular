import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CRUDEservicesManager } from '@services/crude-services-manager';
import { FeatureColumn, crudeRows, featureState, sourceOf } from './feature-cards';
import { SchematicComponentCardComponent } from './schematic-component-card.component';

/**
 * cb-2 `feature-cards-table` (componentName 'feature-cards-table'): one HardwareFeature per row, one CARD per element (struct field,
 * UI control, no-code piece, protocol, schematic component, chip and pins), each marked chosen / suggested / open, and a last cell
 * saying whether the feature is complete. Inputs (class names, read through the generated CRUDE API; no door of its own):
 *   { "featureClass": "HardwareFeature", "componentClass": "SchematicComponent", "portClass": "SchematicComponentPort",
 *     "partClass": "SchematicComponentPart", "columns": [FeatureColumn, ...] }   (feature-cards.ts documents FeatureColumn)
 * A `schematic` column draws the bound component with schematic-component-card (compact), red where it is unsolved.
 */
@Component({
  standalone: true,
  selector: 'feature-cards-table',
  imports: [CommonModule, MatProgressSpinnerModule, SchematicComponentCardComponent],
  template: `
    <div class="fct">
      <div *ngIf="loading" class="state"><mat-spinner diameter="28"></mat-spinner></div>
      <div *ngIf="error" class="state error" role="alert">{{ error }}</div>
      <p *ngIf="!loading && !error && !features.length" class="muted">No hardware features yet.</p>
      <div class="scroll" *ngIf="features.length">
        <table>
          <thead><tr><th scope="col">Feature</th><th scope="col" *ngFor="let c of columns">{{ c.label }}</th><th scope="col">Complete?</th></tr></thead>
          <tbody>
            <tr *ngFor="let f of features">
              <th scope="row"><div class="fname">{{ f.title || f.name }}</div><div class="muted small">{{ f.name }}</div></th>
              <td *ngFor="let c of columns" [class.schematic-cell]="c.kind === 'schematic'">
                <div class="el-card" [ngClass]="'src-' + source(f, c)">
                  <span class="src" [attr.title]="sourceWords(f, c)">{{ source(f, c) }}<span *ngIf="c.required && source(f, c) === 'open'"> · needed</span></span>
                  <ng-container *ngIf="c.kind === 'schematic'; else fieldsCard">
                    <schematic-component-card *ngIf="componentOf(f, c) as comp; else noComp" [component]="comp" [allPorts]="ports"
                                              [allParts]="parts" [compact]="true"></schematic-component-card>
                    <ng-template #noComp>
                      <p class="muted small">{{ refName(f, c) ? 'names ' + refName(f, c) + ', which does not exist' : 'none bound yet' }}</p>
                    </ng-template>
                  </ng-container>
                  <ng-template #fieldsCard>
                    <dl>
                      <ng-container *ngFor="let k of labels(c)">
                        <dt>{{ k }}</dt><dd [class.dim]="!value(f, c.fields![k])">{{ value(f, c.fields![k]) || 'open' }}</dd>
                      </ng-container>
                    </dl>
                  </ng-template>
                </div>
              </td>
              <td><div class="verdict" [class.ok]="state(f).complete" [class.bad]="!state(f).complete">{{ state(f).words }}</div></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .scroll { overflow-x: auto; }
    table { border-collapse: separate; border-spacing: 6px; min-width: 100%; }
    thead th { text-align: left; font-weight: 600; color: var(--text-on-card-muted); font-size: 0.85em; }
    tbody th { text-align: left; vertical-align: top; min-width: 7rem; }
    td { vertical-align: top; min-width: 10rem; }
    td.schematic-cell { min-width: 19rem; }
    .fname { font-weight: 600; }
    .el-card { display: flex; flex-direction: column; gap: 4px; padding: 8px 10px; border-radius: 8px; background: var(--surface-primary);
      color: var(--text-on-card); border: 1px solid var(--border-light); box-shadow: var(--card-shadow); height: 100%; box-sizing: border-box; }
    .el-card.src-open { border-style: dashed; }
    .src { align-self: flex-end; font-size: 0.75em; padding: 0 6px; border-radius: var(--radius-pill); border: 1px solid var(--border-medium);
      color: var(--text-on-card-muted); }
    .src-chosen .src { background: var(--nav-background); color: var(--nav-text); border-color: var(--nav-background); }
    dl { display: grid; grid-template-columns: auto 1fr; gap: 2px 8px; margin: 0; font-size: 0.88em; }
    dt { color: var(--text-on-card-muted); }
    dd { margin: 0; overflow-wrap: anywhere; }
    .dim { opacity: 0.6; font-style: italic; }
    .verdict { font-size: 0.88em; max-width: 14rem; }
    .verdict.bad { color: var(--color-error-text); }
    .muted { color: var(--text-on-card-muted); }
    .small { font-size: 0.8em; }
    .state.error { color: var(--color-error-text); }
  `],
})
export class FeatureCardsTableComponent implements OnInit {
  @Input() featureClass = 'HardwareFeature';
  @Input() componentClass = 'SchematicComponent';
  @Input() portClass = 'SchematicComponentPort';
  @Input() partClass = 'SchematicComponentPart';
  @Input() columns: FeatureColumn[] = [];

  features: any[] = [];
  components: any[] = [];
  ports: any[] = [];
  parts: any[] = [];
  loading = true;
  error: string | null = null;

  constructor(private crude: CRUDEservicesManager) {}

  ngOnInit(): void {
    const read = (cls: string) => this.crude.getCRUDEclassService(cls).readAll();
    forkJoin([read(this.featureClass), read(this.componentClass), read(this.portClass), read(this.partClass)]).subscribe({
      next: ([f, c, po, pa]) => {
        this.loading = false;
        this.features = crudeRows(f, this.featureClass);
        this.components = crudeRows(c, this.componentClass);
        this.ports = crudeRows(po, this.portClass);
        this.parts = crudeRows(pa, this.partClass);
      },
      error: (err: any) => {
        this.loading = false;
        this.error = `Could not read the hardware features: ${err?.message || 'request failed'}`;
      },
    });
  }

  labels(c: FeatureColumn): string[] { return Object.keys(c.fields || {}); }
  value(f: any, field: string): string { return String(f?.[field] ?? '').trim(); }
  source(f: any, c: FeatureColumn): string { return sourceOf(f, c.source_key); }
  sourceWords(f: any, c: FeatureColumn): string {
    const s = this.source(f, c);
    return s === 'chosen' ? 'a person chose this and it is held' : s === 'suggested' ? 'a solver suggested this; it may change' : 'not filled yet';
  }
  refName(f: any, c: FeatureColumn): string { return this.value(f, c.ref_field || c.source_key); }
  componentOf(f: any, c: FeatureColumn): any { return this.components.find((x) => x?.name === this.refName(f, c)) ?? null; }
  state(f: any) { return featureState(f, this.columns, this.components); }
}
