import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  IntentsCatalog,
  MsimAuthoringService,
  SimDefLite,
} from '@services/multi-scale/msim-authoring.service';

/**
 * Spaces editor — which simulations are members of this composition,
 * which one the user drives (primary), and each space's declared intent.
 * Per-space configuration (states, steps, parameters) NAVIGATES OUT to
 * the simulation's own pages — reuse-first.
 */
@Component({
  standalone: true,
  selector: 'msim-spaces-editor',
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    <div class="editor-intro">
      The simulation spaces woven together here. The <strong>primary</strong>
      space is the one the Play button drives; coupled sources advance
      themselves. Each space declares <strong>what it is for</strong> (its
      intent) — that drives its own checklist and where it can plug in.
    </div>

    <div class="item-card" *ngFor="let m of members">
      <div class="item-card-head">
        <mat-icon class="primary-star" *ngIf="m === primary"
                  matTooltip="Primary — the Play button drives this space">star</mat-icon>
        <strong>{{ m }}</strong>
        <span class="intent-chip" *ngIf="simFor(m) as sim">
          {{ intentLabel(sim.intent) }}
        </span>
        <span class="hint" *ngIf="simFor(m) as sim">dt = {{ sim.timeStepSeconds }}s</span>
        <span class="grow"></span>
        <button mat-stroked-button *ngIf="m !== primary"
                matTooltip="Make this the space the Play button drives"
                (click)="setPrimary(m)">make primary</button>
        <button mat-icon-button matTooltip="Configure this simulation (its own pages)"
                (click)="openSimConfig(m)"><mat-icon>settings</mat-icon></button>
        <button mat-icon-button matTooltip="Remove from this composition"
                (click)="removeMember(m)"><mat-icon>close</mat-icon></button>
      </div>
      <div class="field-row" *ngIf="simFor(m) as sim">
        <label>what is this simulation for?</label>
        <select class="select-input" [ngModel]="sim.intent"
                (ngModelChange)="saveIntent(sim, $event)">
          <option *ngFor="let key of intentKeys" [value]="key">
            {{ intentLabel(key) }}
          </option>
        </select>
        <span class="hint" *ngIf="intents?.intents?.[sim.intent]">
          {{ intents!.intents[sim.intent].question }}
        </span>
      </div>
      <div class="field-row" *ngIf="simFor(m) as sim">
        <label>states</label>
        <span class="hint">{{ sim.participatingClasses.join(', ') || '(none yet)' }}</span>
        <button mat-stroked-button matTooltip="Create a new state class (no-code scaffolding)"
                (click)="openCreateClass()"><mat-icon>add_box</mat-icon> new state class</button>
        <button mat-stroked-button matTooltip="Author step solutions in the no-code editor"
                (click)="openNoCode()"><mat-icon>account_tree</mat-icon> step solutions</button>
      </div>
    </div>

    <div class="field-row">
      <label>add a member space</label>
      <select class="select-input" [(ngModel)]="pendingAdd">
        <option value="">(pick a simulation)</option>
        <option *ngFor="let s of addableSims" [value]="s.name">
          {{ s.name }} — {{ intentLabel(s.intent) }}
        </option>
      </select>
      <button mat-stroked-button [disabled]="!pendingAdd" (click)="addMember()">
        <mat-icon>add</mat-icon> add
      </button>
      <button mat-stroked-button matTooltip="Create a brand-new simulation definition"
              (click)="openSimConfig('')">
        <mat-icon>open_in_new</mat-icon> new simulation
      </button>
    </div>
  `,
  styleUrls: ['./msim-editors.scss'],
})
export class MsimSpacesEditorComponent implements OnInit {
  @Input() members: string[] = [];
  @Input() primary = '';
  @Output() membersChange = new EventEmitter<string[]>();
  @Output() primaryChange = new EventEmitter<string>();

  allSims: SimDefLite[] = [];
  intents: IntentsCatalog | null = null;
  intentKeys: string[] = [];
  pendingAdd = '';

  constructor(private authoring: MsimAuthoringService, private router: Router) {}

  async ngOnInit(): Promise<void> {
    this.intents = await this.authoring.intents();
    this.intentKeys = Object.keys(this.intents?.intents ?? {});
    this.allSims = await this.authoring.listSimDefs();
  }

  get addableSims(): SimDefLite[] {
    return this.allSims.filter(s => !this.members.includes(s.name));
  }

  simFor(name: string): SimDefLite | null {
    return this.allSims.find(s => s.name === name) ?? null;
  }

  intentLabel(key: string): string {
    return this.intents?.intents?.[key]?.label ?? key;
  }

  addMember(): void {
    if (!this.pendingAdd || this.members.includes(this.pendingAdd)) return;
    this.members.push(this.pendingAdd);
    if (!this.primary) this.primaryChange.emit(this.pendingAdd);
    this.pendingAdd = '';
    this.membersChange.emit(this.members);
  }

  removeMember(name: string): void {
    const idx = this.members.indexOf(name);
    if (idx >= 0) this.members.splice(idx, 1);
    if (this.primary === name) this.primaryChange.emit(this.members[0] ?? '');
    this.membersChange.emit(this.members);
  }

  setPrimary(name: string): void { this.primaryChange.emit(name); }

  async saveIntent(sim: SimDefLite, intent: string): Promise<void> {
    sim.intent = intent;
    try { await this.authoring.saveSimIntent(sim, intent); } catch { /* surfaced by validate */ }
  }

  openSimConfig(simName: string): void {
    this.router.navigate(['/class-main-page', 'SimulationDefinition'],
      simName ? { queryParams: { highlight: simName } } : {});
  }

  openCreateClass(): void { this.router.navigate(['/create-class']); }
  openNoCode(): void { this.router.navigate(['/custom-no-code']); }
}
