import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { MsimStage } from '@models/multi-scale/NamedMultiScaleSimConfig';
import {
  IntentsCatalog,
  MsimAuthoringService,
} from '@services/multi-scale/msim-authoring.service';

interface DeriveRow { target: string; source: string; }
interface GridParamRow { name: string; from: number; to: number; steps: number; }

/**
 * Stages editor — the ordered no-code multi-scale progression. Each
 * stage: what runs, in what role (intent), gated by which valid-solution
 * condition, deriving what into later stages, optionally searching
 * multiple candidates. Emits the whole stages array on every change;
 * the parent (Configure shell or wizard) owns persistence.
 */
@Component({
  standalone: true,
  selector: 'msim-stages-editor',
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    <div class="editor-intro">
      The multi-scale steps, in order. A stage either <strong>runs to
      completion</strong> first (proving something before later stages
      unlock) or <strong>steps live</strong> with its couplings.
    </div>

    <div class="stage-card" *ngFor="let stage of stages; let i = index">
      <div class="stage-card-head">
        <span class="stage-num">{{ i + 1 }}</span>
        <input class="text-input grow" placeholder="label shown to users"
               [(ngModel)]="stage.label" (ngModelChange)="emit()" />
        <button mat-icon-button matTooltip="Move up" [disabled]="i === 0"
                (click)="move(i, -1)"><mat-icon>arrow_upward</mat-icon></button>
        <button mat-icon-button matTooltip="Move down" [disabled]="i === stages.length - 1"
                (click)="move(i, 1)"><mat-icon>arrow_downward</mat-icon></button>
        <button mat-icon-button matTooltip="Remove stage" (click)="remove(i)">
          <mat-icon>delete_outline</mat-icon></button>
      </div>

      <div class="field-row">
        <label>key</label>
        <input class="text-input" [(ngModel)]="stage.key" (ngModelChange)="emit()" />
        <label>how it runs</label>
        <select class="select-input" [(ngModel)]="stage.kind" (ngModelChange)="emit()">
          <option value="coStep">steps live (coupled)</option>
          <option value="runToCompletion">runs to completion, then unlocks</option>
        </select>
      </div>

      <div class="field-row">
        <label>role (intent)</label>
        <select class="select-input" [(ngModel)]="stage.intent" (ngModelChange)="emit()">
          <option *ngFor="let key of intentKeys" [value]="key">
            {{ intents?.intents?.[key]?.label || key }}
          </option>
        </select>
        <span class="hint" *ngIf="stage.intent && intents?.intents?.[stage.intent!]">
          {{ intents!.intents[stage.intent!].question }}
        </span>
      </div>

      <div class="field-row">
        <label>simulation</label>
        <select class="select-input" [ngModel]="stageSim(stage)"
                (ngModelChange)="setStageSim(stage, $event)">
          <option value="">(pick a member space)</option>
          <option *ngFor="let m of members" [value]="m">{{ m }}</option>
        </select>
        <ng-container *ngIf="stage.kind === 'coStep'">
          <label>couplings</label>
          <span class="chips">
            <label class="chk" *ngFor="let c of couplingNames">
              <input type="checkbox" [checked]="hasCoupling(stage, c)"
                     (change)="toggleCoupling(stage, c)" /> {{ c }}
            </label>
            <span class="hint" *ngIf="!couplingNames.length">no couplings defined yet</span>
          </span>
        </ng-container>
      </div>

      <ng-container *ngIf="stage.kind === 'runToCompletion'">
        <div class="field-row">
          <label>valid-solution condition (gate)</label>
          <select class="select-input" [ngModel]="stage.gate?.solutionRef || ''"
                  (ngModelChange)="setGate(stage, $event)">
            <option value="">(none yet — required if later stages derive from this)</option>
            <option *ngFor="let s of solutionNames" [value]="s">{{ s }}</option>
          </select>
          <button mat-stroked-button matTooltip="Author the gate in the no-code editor"
                  (click)="openNoCodeEditor()">
            <mat-icon>edit</mat-icon> author gate
          </button>
        </div>

        <div class="subsection">
          <div class="subsection-head">
            What this stage proves flows into later stages
            <button mat-icon-button matTooltip="Add a derived value"
                    (click)="addDerive(stage)"><mat-icon>add</mat-icon></button>
          </div>
          <div class="field-row" *ngFor="let row of deriveRows(stage); let ri = index">
            <label>set</label>
            <input class="text-input" placeholder="simulation.parameter (e.g. newtonian-pendulum-3d.mass)"
                   [(ngModel)]="row.target" (ngModelChange)="writeDerive(stage)" />
            <label>from gate output</label>
            <input class="text-input" placeholder="e.g. ball_mass"
                   [(ngModel)]="row.source" (ngModelChange)="writeDerive(stage)" />
            <button mat-icon-button (click)="removeDerive(stage, ri)">
              <mat-icon>close</mat-icon></button>
          </div>
        </div>

        <div class="subsection">
          <div class="subsection-head">
            Solution search — try multiple candidates to reach one valid solution
            <button mat-stroked-button *ngIf="!stage.search" (click)="enableSearch(stage)">
              <mat-icon>manage_search</mat-icon> enable
            </button>
            <button mat-icon-button *ngIf="stage.search" matTooltip="Remove the search"
                    (click)="disableSearch(stage)"><mat-icon>close</mat-icon></button>
          </div>
          <ng-container *ngIf="stage.search">
            <div class="field-row" *ngFor="let p of gridRows(stage); let pi = index">
              <label>parameter</label>
              <input class="text-input" placeholder="e.g. temperature"
                     [(ngModel)]="p.name" (ngModelChange)="writeGrid(stage)" />
              <label>from</label>
              <input class="num-input" type="number" [(ngModel)]="p.from" (ngModelChange)="writeGrid(stage)" />
              <label>to</label>
              <input class="num-input" type="number" [(ngModel)]="p.to" (ngModelChange)="writeGrid(stage)" />
              <label>points</label>
              <input class="num-input" type="number" min="1" [(ngModel)]="p.steps" (ngModelChange)="writeGrid(stage)" />
              <button mat-icon-button (click)="removeGridRow(stage, pi)">
                <mat-icon>close</mat-icon></button>
            </div>
            <div class="field-row">
              <button mat-stroked-button (click)="addGridRow(stage)">
                <mat-icon>add</mat-icon> add parameter to try
              </button>
              <label>steps per attempt</label>
              <input class="num-input" type="number" min="1"
                     [(ngModel)]="stage.search!.stepsPerAttempt" (ngModelChange)="emit()" />
              <label>attempts per batch</label>
              <input class="num-input" type="number" min="1"
                     [(ngModel)]="stage.search!.batchSize" (ngModelChange)="emit()" />
            </div>
          </ng-container>
        </div>
      </ng-container>
    </div>

    <button mat-stroked-button class="add-stage-btn" (click)="addStage()">
      <mat-icon>add</mat-icon> Add a stage
    </button>
  `,
  styleUrls: ['./msim-editors.scss'],
})
export class MsimStagesEditorComponent implements OnInit {
  @Input() stages: MsimStage[] = [];
  @Input() members: string[] = [];
  @Output() stagesChange = new EventEmitter<MsimStage[]>();

  intents: IntentsCatalog | null = null;
  intentKeys: string[] = [];
  solutionNames: string[] = [];
  couplingNames: string[] = [];

  private deriveCache = new Map<MsimStage, DeriveRow[]>();
  private gridCache = new Map<MsimStage, GridParamRow[]>();

  constructor(private authoring: MsimAuthoringService, private router: Router) {}

  async ngOnInit(): Promise<void> {
    this.intents = await this.authoring.intents();
    this.intentKeys = Object.keys(this.intents?.intents ?? {});
    this.solutionNames = await this.authoring.listNames('SolutionDefinition');
    this.couplingNames = (await this.authoring.listCouplings()).map(c => c.name);
  }

  emit(): void { this.stagesChange.emit(this.stages); }

  addStage(): void {
    this.stages.push({
      key: `stage-${this.stages.length + 1}`,
      label: '', kind: 'runToCompletion', intent: 'search',
      simulationRef: this.members[0] ?? '',
    });
    this.emit();
  }

  remove(i: number): void { this.stages.splice(i, 1); this.emit(); }

  move(i: number, delta: number): void {
    const j = i + delta;
    if (j < 0 || j >= this.stages.length) return;
    [this.stages[i], this.stages[j]] = [this.stages[j], this.stages[i]];
    this.emit();
  }

  stageSim(stage: MsimStage): string {
    return stage.kind === 'coStep'
      ? (stage.primarySimulationRef || stage.simulationRef || '')
      : (stage.simulationRef || '');
  }

  setStageSim(stage: MsimStage, sim: string): void {
    if (stage.kind === 'coStep') stage.primarySimulationRef = sim;
    else stage.simulationRef = sim;
    this.emit();
  }

  hasCoupling(stage: MsimStage, name: string): boolean {
    return (stage.couplingRefs ?? []).includes(name);
  }

  toggleCoupling(stage: MsimStage, name: string): void {
    const refs = stage.couplingRefs ?? [];
    stage.couplingRefs = this.hasCoupling(stage, name)
      ? refs.filter(r => r !== name) : [...refs, name];
    this.emit();
  }

  setGate(stage: MsimStage, solutionRef: string): void {
    stage.gate = solutionRef ? { solutionRef } : undefined;
    this.emit();
  }

  openNoCodeEditor(): void { this.router.navigate(['/custom-no-code']); }

  // --- derive rows ---------------------------------------------------
  deriveRows(stage: MsimStage): DeriveRow[] {
    let rows = this.deriveCache.get(stage);
    if (!rows) {
      rows = Object.entries(stage.derive?.params ?? {})
        .map(([target, source]) => ({ target, source }));
      this.deriveCache.set(stage, rows);
    }
    return rows;
  }

  addDerive(stage: MsimStage): void {
    this.deriveRows(stage).push({ target: '', source: '' });
    this.writeDerive(stage);
  }

  removeDerive(stage: MsimStage, i: number): void {
    this.deriveRows(stage).splice(i, 1);
    this.writeDerive(stage);
  }

  writeDerive(stage: MsimStage): void {
    const params: Record<string, string> = {};
    for (const r of this.deriveRows(stage)) {
      if (r.target && r.source) params[r.target] = r.source;
    }
    stage.derive = Object.keys(params).length ? { params } : undefined;
    this.emit();
  }

  // --- search grid rows ----------------------------------------------
  enableSearch(stage: MsimStage): void {
    stage.search = {
      candidates: { kind: 'grid', parameters: {} },
      stepsPerAttempt: 50, batchSize: 4,
    };
    this.gridCache.delete(stage);
    this.emit();
  }

  disableSearch(stage: MsimStage): void {
    stage.search = undefined;
    this.gridCache.delete(stage);
    this.emit();
  }

  gridRows(stage: MsimStage): GridParamRow[] {
    let rows = this.gridCache.get(stage);
    if (!rows) {
      rows = Object.entries(stage.search?.candidates?.parameters ?? {})
        .map(([name, spec]) => ({
          name, from: spec.from ?? 0, to: spec.to ?? 0, steps: spec.steps ?? 1,
        }));
      this.gridCache.set(stage, rows);
    }
    return rows;
  }

  addGridRow(stage: MsimStage): void {
    this.gridRows(stage).push({ name: '', from: 0, to: 1, steps: 3 });
    this.writeGrid(stage);
  }

  removeGridRow(stage: MsimStage, i: number): void {
    this.gridRows(stage).splice(i, 1);
    this.writeGrid(stage);
  }

  writeGrid(stage: MsimStage): void {
    if (!stage.search) return;
    const parameters: Record<string, { from: number; to: number; steps: number }> = {};
    for (const r of this.gridRows(stage)) {
      if (r.name) parameters[r.name] = { from: r.from, to: r.to, steps: r.steps };
    }
    stage.search.candidates = { kind: 'grid', parameters };
    this.emit();
  }
}
