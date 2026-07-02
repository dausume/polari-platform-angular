import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { MsimPanel, MsimStage } from '@models/multi-scale/NamedMultiScaleSimConfig';
import {
  IntentsCatalog,
  MsimAuthoringService,
} from '@services/multi-scale/msim-authoring.service';
import { MsimSpacesEditorComponent } from './configure/msim-spaces-editor.component';
import { MsimStagesEditorComponent } from './configure/msim-stages-editor.component';
import { MsimCouplingEditorComponent } from './configure/msim-coupling-editor.component';
import { MsimPanelsEditorComponent } from './configure/msim-panels-editor.component';

/**
 * The guided "New Multi-Scale Simulation" wizard — a plain-language walk
 * over the SAME editors Configure mode uses (no parallel implementation).
 * Intents first: each step says what it's for; the intents catalog
 * teaches what each kind of simulation requires before it's picked.
 */
@Component({
  standalone: true,
  selector: 'msim-wizard',
  imports: [
    CommonModule, FormsModule, RouterModule,
    MatButtonModule, MatIconModule,
    MsimSpacesEditorComponent, MsimStagesEditorComponent,
    MsimCouplingEditorComponent, MsimPanelsEditorComponent,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1>New Multi-Scale Simulation</h1>
        <p class="subtitle">
          A short guided setup. Each step explains itself — and everything
          here can be changed later in Configure mode.
        </p>
      </div>

      <div class="wizard-steps">
        <span *ngFor="let s of stepTitles; let i = index"
              class="wiz-step" [class.active]="i === step" [class.done]="i < step">
          {{ i + 1 }}. {{ s }}
        </span>
      </div>

      <!-- Step 0: identity -->
      <div class="wiz-body" *ngIf="step === 0">
        <p class="wiz-q">What should this multi-scale simulation be called?</p>
        <div class="field-row">
          <label>name</label>
          <input class="text-input grow" placeholder="e.g. pendulum-in-wind"
                 [(ngModel)]="name" />
        </div>
        <div class="field-row">
          <label>description</label>
          <input class="text-input grow"
                 placeholder="one sentence a teammate would understand"
                 [(ngModel)]="description" />
        </div>
      </div>

      <!-- Step 1: spaces (intents-first) -->
      <div class="wiz-body" *ngIf="step === 1">
        <p class="wiz-q">Which simulation spaces take part — and what is
          each one <em>for</em>?</p>
        <div class="intent-cards" *ngIf="intents">
          <div class="intent-card" *ngFor="let key of intentKeys">
            <strong>{{ intents.intents[key].label }}</strong>
            <span class="q">{{ intents.intents[key].question }}</span>
            <ul><li *ngFor="let r of intents.intents[key].requires">{{ r }}</li></ul>
          </div>
        </div>
        <msim-spaces-editor [members]="members" [primary]="primary"
            (membersChange)="members = $event"
            (primaryChange)="primary = $event">
        </msim-spaces-editor>
      </div>

      <!-- Step 2: stages -->
      <div class="wiz-body" *ngIf="step === 2">
        <p class="wiz-q">In what order do the spaces run — and what must
          each prove before the next unlocks?</p>
        <msim-stages-editor [stages]="stages" [members]="members"
            (stagesChange)="stages = $event">
        </msim-stages-editor>
      </div>

      <!-- Step 3: couplings -->
      <div class="wiz-body" *ngIf="step === 3">
        <p class="wiz-q">How do the spaces feed each other while they run?</p>
        <msim-coupling-editor [refs]="couplings"
            (refsChange)="couplings = $event">
        </msim-coupling-editor>
      </div>

      <!-- Step 4: panels -->
      <div class="wiz-body" *ngIf="step === 4">
        <p class="wiz-q">What should the page show?</p>
        <msim-panels-editor [panels]="panels"
            (panelsChange)="panels = $event">
        </msim-panels-editor>
      </div>

      <div class="wiz-nav">
        <button mat-stroked-button (click)="step = step - 1" [disabled]="step === 0">
          <mat-icon>arrow_back</mat-icon> Back
        </button>
        <button mat-flat-button color="primary" *ngIf="step < stepTitles.length - 1"
                [disabled]="!canAdvance" (click)="step = step + 1">
          Next <mat-icon>arrow_forward</mat-icon>
        </button>
        <button mat-flat-button color="primary" *ngIf="step === stepTitles.length - 1"
                [disabled]="creating || !name || !members.length" (click)="create()">
          <mat-icon>rocket_launch</mat-icon> Create
        </button>
        <a mat-button routerLink="/multi-scale-sims">Cancel</a>
        <span class="hint" *ngIf="createError">{{ createError }}</span>
      </div>
    </div>
  `,
  styleUrls: ['./msim-wizard.component.scss'],
})
export class MsimWizardComponent implements OnInit {
  stepTitles = ['Name it', 'Pick the spaces', 'Order the stages',
                'Weave them together', 'Choose the panels'];
  step = 0;

  name = '';
  description = '';
  members: string[] = [];
  primary = '';
  stages: MsimStage[] = [];
  couplings: string[] = [];
  panels: MsimPanel[] = [];

  intents: IntentsCatalog | null = null;
  intentKeys: string[] = [];
  creating = false;
  createError: string | null = null;

  constructor(private authoring: MsimAuthoringService, private router: Router) {}

  async ngOnInit(): Promise<void> {
    this.intents = await this.authoring.intents();
    this.intentKeys = Object.keys(this.intents?.intents ?? {});
  }

  get canAdvance(): boolean {
    if (this.step === 0) return !!this.name;
    if (this.step === 1) return this.members.length > 0;
    return true;
  }

  async create(): Promise<void> {
    this.creating = true;
    this.createError = null;
    try {
      await this.authoring.createMsim({
        name: this.name, description: this.description,
        members: this.members, couplings: this.couplings,
        primary: this.primary || this.members[0] || '',
        stages: this.stages, panels: this.panels,
      });
      this.router.navigate(['/multi-scale-sim', this.name],
        { queryParams: { mode: 'configure' } });
    } catch (err: any) {
      this.createError = `Create failed: ${err?.message || err}`;
    } finally {
      this.creating = false;
    }
  }
}
