import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  CouplingConfig,
  MsimAuthoringService,
  SimDefLite,
} from '@services/multi-scale/msim-authoring.service';

interface InjectRow { key: string; kind: string; index: number; value: string; }
interface DefaultRow { key: string; value: number; }

/**
 * Couplings editor — THE WEAVING. Declares how one space's field flows
 * into another space's step: where the data comes from, how it is
 * sampled (a no-code matrix equation), and where it goes. Plain-language
 * labels throughout; emits the coupling name list the composition
 * references, and saves coupling rows directly (they are shared objects).
 */
@Component({
  standalone: true,
  selector: 'msim-coupling-editor',
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    <div class="editor-intro">
      Couplings are the weaving: “when the target space steps, sample the
      source space's field and hand the values in.” The sampling math is a
      no-code matrix equation you can author yourself.
    </div>

    <div class="item-card" *ngFor="let c of couplings">
      <div class="item-card-head">
        <mat-icon>link</mat-icon>
        <strong>{{ c.name }}</strong>
        <label class="chk"><input type="checkbox" [checked]="isReferenced(c.name)"
               (change)="toggleRef(c.name)" /> used by this composition</label>
        <span class="grow"></span>
        <button mat-icon-button matTooltip="Edit" (click)="edit(c)">
          <mat-icon>edit</mat-icon></button>
      </div>
      <div class="hint">
        {{ c.sourceSimulationRef }} / {{ c.sourceClassName }}
        <mat-icon style="font-size:14px;height:14px;width:14px;vertical-align:middle;">arrow_forward</mat-icon>
        {{ c.targetSimulationRef }} / {{ c.targetClassName }}
        · sampler: {{ c.samplerEquationRef || '(none)' }}
      </div>
    </div>

    <button mat-stroked-button (click)="startNew()" *ngIf="!draft">
      <mat-icon>add_link</mat-icon> New coupling
    </button>

    <div class="item-card" *ngIf="draft">
      <div class="item-card-head">
        <mat-icon>add_link</mat-icon>
        <strong>{{ draft.id ? 'Edit coupling' : 'New coupling' }}</strong>
      </div>
      <div class="field-row">
        <label>name</label>
        <input class="text-input grow" [(ngModel)]="draft.name" [disabled]="!!draft.id" />
      </div>
      <div class="field-row">
        <label>Where does the data come from?</label>
        <select class="select-input" [(ngModel)]="draft.sourceSimulationRef"
                (ngModelChange)="draft.sourceClassName = ''">
          <option *ngFor="let s of sims" [value]="s.name">{{ s.name }}</option>
        </select>
        <select class="select-input" [(ngModel)]="draft.sourceClassName">
          <option value="">(state class)</option>
          <option *ngFor="let c of classesOf(draft.sourceSimulationRef)" [value]="c">{{ c }}</option>
        </select>
        <label>field holding the data (matrix)</label>
        <input class="text-input" placeholder="e.g. cells_json"
               [(ngModel)]="sourceField" />
      </div>
      <div class="field-row">
        <label>Where does it go?</label>
        <select class="select-input" [(ngModel)]="draft.targetSimulationRef"
                (ngModelChange)="draft.targetClassName = ''">
          <option *ngFor="let s of sims" [value]="s.name">{{ s.name }}</option>
        </select>
        <select class="select-input" [(ngModel)]="draft.targetClassName">
          <option value="">(state class)</option>
          <option *ngFor="let c of classesOf(draft.targetSimulationRef)" [value]="c">{{ c }}</option>
        </select>
        <label>sampled AT the target's position fields</label>
        <input class="text-input" placeholder="e.g. px,py,pz" [(ngModel)]="positionFields" />
      </div>
      <div class="field-row">
        <label>How is it sampled?</label>
        <select class="select-input" [(ngModel)]="draft.samplerEquationRef">
          <option value="">(pick a matrix equation)</option>
          <option *ngFor="let eq of samplerNames" [value]="eq">{{ eq }}</option>
        </select>
        <button mat-stroked-button matTooltip="Author a sampler in the matrix-equation editor"
                (click)="openMatrices()"><mat-icon>functions</mat-icon> author sampler</button>
      </div>

      <div class="subsection">
        <div class="subsection-head">
          What the target receives (context keys)
          <button mat-icon-button (click)="injectRows.push({key:'', kind:'sample_element', index:0, value:''})">
            <mat-icon>add</mat-icon></button>
        </div>
        <div class="field-row" *ngFor="let row of injectRows; let ri = index">
          <input class="text-input" placeholder="key (e.g. wind_vx)" [(ngModel)]="row.key" />
          <select class="select-input" [(ngModel)]="row.kind">
            <option value="sample_element">one component of the sample</option>
            <option value="sample">the whole sample</option>
            <option value="constant">a constant</option>
          </select>
          <input class="num-input" *ngIf="row.kind === 'sample_element'" type="number"
                 min="0" [(ngModel)]="row.index" matTooltip="which component (0-based)" />
          <input class="num-input" *ngIf="row.kind === 'constant'" type="number"
                 [(ngModel)]="row.value" matTooltip="the constant value" />
          <button mat-icon-button (click)="injectRows.splice(ri, 1)">
            <mat-icon>close</mat-icon></button>
        </div>
      </div>

      <div class="subsection">
        <div class="subsection-head">
          Defaults when no source run is coupled (safe fallback)
          <button mat-icon-button (click)="defaultRows.push({key:'', value:0})">
            <mat-icon>add</mat-icon></button>
        </div>
        <div class="field-row" *ngFor="let row of defaultRows; let ri = index">
          <input class="text-input" placeholder="key" [(ngModel)]="row.key" />
          <input class="num-input" type="number" [(ngModel)]="row.value" />
          <button mat-icon-button (click)="defaultRows.splice(ri, 1)">
            <mat-icon>close</mat-icon></button>
        </div>
      </div>

      <div class="editor-actions">
        <button mat-flat-button color="primary" [disabled]="saving || !draft.name"
                (click)="save()">
          <mat-icon>save</mat-icon> Save coupling
        </button>
        <button mat-stroked-button (click)="draft = null" [disabled]="saving">Cancel</button>
        <span class="hint" *ngIf="saveError">{{ saveError }}</span>
      </div>
    </div>
  `,
  styleUrls: ['./msim-editors.scss'],
})
export class MsimCouplingEditorComponent implements OnInit {
  /** The composition's referenced coupling names (edited in place). */
  @Input() refs: string[] = [];
  @Output() refsChange = new EventEmitter<string[]>();

  couplings: CouplingConfig[] = [];
  sims: SimDefLite[] = [];
  samplerNames: string[] = [];
  draft: CouplingConfig | null = null;
  injectRows: InjectRow[] = [];
  defaultRows: DefaultRow[] = [];
  sourceField = 'cells_json';
  positionFields = 'px,py,pz';
  saving = false;
  saveError: string | null = null;

  constructor(private authoring: MsimAuthoringService, private router: Router) {}

  async ngOnInit(): Promise<void> {
    this.sims = await this.authoring.listSimDefs();
    this.couplings = await this.authoring.listCouplings();
    this.samplerNames = await this.authoring.listNames('MatrixEquationDefinition');
  }

  classesOf(simName: string): string[] {
    return this.sims.find(s => s.name === simName)?.participatingClasses ?? [];
  }

  isReferenced(name: string): boolean { return this.refs.includes(name); }

  toggleRef(name: string): void {
    const idx = this.refs.indexOf(name);
    if (idx >= 0) this.refs.splice(idx, 1); else this.refs.push(name);
    this.refsChange.emit(this.refs);
  }

  startNew(): void {
    this.draft = {
      id: '', name: '', description: '',
      sourceSimulationRef: this.sims[0]?.name ?? '', sourceClassName: '',
      targetSimulationRef: this.sims[0]?.name ?? '', targetClassName: '',
      samplerEquationRef: '', config: {}, enabled: true,
    };
    this.injectRows = [{ key: '', kind: 'sample_element', index: 0, value: '' }];
    this.defaultRows = [{ key: '', value: 0 }];
    this.sourceField = 'cells_json';
    this.positionFields = 'px,py,pz';
  }

  edit(c: CouplingConfig): void {
    this.draft = { ...c, config: JSON.parse(JSON.stringify(c.config ?? {})) };
    const operands = this.draft.config?.['sampler']?.['operands'] ?? {};
    this.sourceField = operands['cells']?.['field'] ?? 'cells_json';
    this.positionFields = (operands['pos']?.['fields'] ?? ['px', 'py', 'pz']).join(',');
    this.injectRows = Object.entries(this.draft.config?.['inject'] ?? {})
      .map(([key, spec]: [string, any]) => ({
        key, kind: spec?.kind ?? 'sample_element',
        index: spec?.index ?? 0, value: String(spec?.value ?? ''),
      }));
    this.defaultRows = Object.entries(this.draft.config?.['defaults'] ?? {})
      .map(([key, value]: [string, any]) => ({ key, value: Number(value) || 0 }));
  }

  async save(): Promise<void> {
    if (!this.draft) return;
    this.saving = true;
    this.saveError = null;
    const inject: Record<string, any> = {};
    for (const r of this.injectRows) {
      if (!r.key) continue;
      inject[r.key] = r.kind === 'constant'
        ? { kind: 'constant', value: Number(r.value) || 0 }
        : r.kind === 'sample'
          ? { kind: 'sample' }
          : { kind: 'sample_element', index: Number(r.index) || 0 };
    }
    const defaults: Record<string, number> = {};
    for (const r of this.defaultRows) {
      if (r.key) defaults[r.key] = Number(r.value) || 0;
    }
    this.draft.config = {
      sampler: {
        operands: {
          cells: { kind: 'source_field_json', field: this.sourceField },
          pos: {
            kind: 'target_fields',
            fields: this.positionFields.split(',').map(f => f.trim()).filter(Boolean),
          },
        },
      },
      inject, defaults,
    };
    try {
      await this.authoring.saveCoupling(this.draft);
      if (!this.refs.includes(this.draft.name)) {
        this.refs.push(this.draft.name);
        this.refsChange.emit(this.refs);
      }
      this.couplings = await this.authoring.listCouplings();
      this.draft = null;
    } catch (err: any) {
      this.saveError = err?.message || String(err);
    } finally {
      this.saving = false;
    }
  }

  openMatrices(): void { this.router.navigate(['/matrices']); }
}
