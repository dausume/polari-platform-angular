import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { NamedMultiScaleSimConfig } from '@models/multi-scale/NamedMultiScaleSimConfig';
import {
  CompositionFinding,
  MsimAuthoringService,
} from '@services/multi-scale/msim-authoring.service';
import { MsimSpacesEditorComponent } from './msim-spaces-editor.component';
import { MsimStagesEditorComponent } from './msim-stages-editor.component';
import { MsimCouplingEditorComponent } from './msim-coupling-editor.component';
import { MsimIcEditorComponent } from './msim-ic-editor.component';
import { MsimPanelsEditorComponent } from './msim-panels-editor.component';

type RailPart = 'spaces' | 'stages' | 'couplings' | 'ics'
  | 'scenes' | 'graphs' | 'panels' | 'runs';

/**
 * Configure mode — the part rail + the multi-scale editors. The rail
 * covers every part of a multi-scale simulation; the genuinely multi-
 * scale parts (spaces roster, stages, couplings, overall ICs, panels)
 * edit HERE, while per-simulation parts navigate out to their existing
 * pages (reuse-first). A validation banner keeps the composition honest
 * in plain language — it informs, never blocks.
 */
@Component({
  standalone: true,
  selector: 'msim-configure',
  imports: [
    CommonModule, FormsModule,
    MatButtonModule, MatIconModule, MatTooltipModule,
    MsimSpacesEditorComponent, MsimStagesEditorComponent,
    MsimCouplingEditorComponent, MsimIcEditorComponent,
    MsimPanelsEditorComponent,
  ],
  template: `
    <div class="configure-shell">
      <nav class="part-rail">
        <button *ngFor="let part of parts" class="rail-item"
                [class.active]="activePart === part.key"
                (click)="select(part.key)">
          <mat-icon>{{ part.icon }}</mat-icon>
          <span>{{ part.label }}</span>
          <mat-icon class="ext" *ngIf="part.external">open_in_new</mat-icon>
        </button>
      </nav>

      <div class="configure-body">
        <div class="validate-banner" *ngIf="findings.length">
          <div class="finding" *ngFor="let f of findings" [class.error]="f.level === 'error'">
            <mat-icon>{{ f.level === 'error' ? 'error_outline' : 'warning_amber' }}</mat-icon>
            {{ f.message }}
          </div>
        </div>
        <div class="validate-banner ok" *ngIf="!findings.length && validated">
          <mat-icon>check_circle</mat-icon> This composition is coherent.
        </div>

        <ng-container [ngSwitch]="activePart">
          <msim-spaces-editor *ngSwitchCase="'spaces'"
              [members]="config.members" [primary]="config.primarySimulationRef"
              (membersChange)="markDirty()"
              (primaryChange)="config.primarySimulationRef = $event; markDirty()">
          </msim-spaces-editor>

          <msim-stages-editor *ngSwitchCase="'stages'"
              [stages]="config.stages" [members]="config.members"
              (stagesChange)="markDirty()">
          </msim-stages-editor>

          <msim-coupling-editor *ngSwitchCase="'couplings'"
              [refs]="config.couplings" (refsChange)="markDirty()">
          </msim-coupling-editor>

          <msim-ic-editor *ngSwitchCase="'ics'" [initialName]="firstIcRef">
          </msim-ic-editor>

          <msim-panels-editor *ngSwitchCase="'panels'"
              [panels]="config.panels" (panelsChange)="markDirty()">
          </msim-panels-editor>

          <div *ngSwitchCase="'runs'" class="editor-intro">
            Runs are managed from Run mode — the run picker, Play/Step,
            material picker, and solution search all live there. Switch
            back with the toggle above.
          </div>
        </ng-container>

        <div class="editor-actions save-bar" *ngIf="dirty">
          <button mat-flat-button color="primary" [disabled]="saving" (click)="save()">
            <mat-icon>save</mat-icon> Save changes
          </button>
          <span class="hint">unsaved changes</span>
          <span class="hint" *ngIf="saveError">{{ saveError }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .configure-shell { display: flex; gap: 16px; align-items: flex-start; }
    .part-rail {
      display: flex; flex-direction: column; gap: 2px;
      min-width: 168px; position: sticky; top: 12px;
      border: 1px solid var(--border-light, #e0e0e0);
      border-radius: 10px; padding: 6px;
      background: var(--surface-primary, #fff);
    }
    .rail-item {
      display: flex; align-items: center; gap: 8px;
      border: none; background: none; cursor: pointer;
      padding: 8px 10px; border-radius: 8px; font-size: 13px;
      color: var(--text-primary, #333); text-align: left;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
      .ext { margin-left: auto; font-size: 14px; width: 14px; height: 14px;
             color: var(--text-secondary, #999); }
      &.active { background: rgba(0, 121, 107, 0.12); font-weight: 600; }
      &:hover { background: rgba(0, 0, 0, 0.05); }
    }
    .configure-body { flex: 1; min-width: 0; }
    .validate-banner {
      border-radius: 8px; padding: 8px 12px; margin-bottom: 12px;
      background: #fff8e1; border: 1px solid #ffe082;
      display: flex; flex-direction: column; gap: 4px;
      .finding { display: flex; align-items: center; gap: 6px; font-size: 13px;
        color: #8d6e00;
        mat-icon { font-size: 18px; width: 18px; height: 18px; }
        &.error { color: #b71c1c; }
      }
      &.ok { background: #e8f5e9; border-color: #a5d6a7; color: #1b5e20;
        flex-direction: row; align-items: center; gap: 6px; font-size: 13px;
        mat-icon { font-size: 18px; width: 18px; height: 18px; }
      }
    }
    .save-bar { position: sticky; bottom: 8px; background: var(--surface-primary, #fff);
      border: 1px solid var(--border-light, #e0e0e0); border-radius: 10px;
      padding: 8px 12px; }
    .editor-intro { color: var(--text-secondary, #666); font-size: 13px; }
    .editor-actions { display: flex; align-items: center; gap: 10px; margin-top: 14px; }
    .hint { font-size: 12px; color: var(--text-secondary, #888); font-style: italic; }
  `],
})
export class MsimConfigureComponent implements OnInit {
  @Input({ required: true }) config!: NamedMultiScaleSimConfig;
  @Output() saved = new EventEmitter<void>();

  parts: Array<{ key: RailPart; label: string; icon: string; external?: boolean }> = [
    { key: 'spaces', label: 'Spaces', icon: 'blur_on' },
    { key: 'stages', label: 'Stages', icon: 'stairs' },
    { key: 'couplings', label: 'Couplings', icon: 'link' },
    { key: 'ics', label: 'Overall ICs', icon: 'tune' },
    { key: 'scenes', label: 'Scenes', icon: 'view_in_ar', external: true },
    { key: 'graphs', label: 'Graphs', icon: 'show_chart', external: true },
    { key: 'panels', label: 'Panels', icon: 'dashboard' },
    { key: 'runs', label: 'Runs', icon: 'play_circle' },
  ];
  activePart: RailPart = 'spaces';

  findings: CompositionFinding[] = [];
  validated = false;
  dirty = false;
  saving = false;
  saveError: string | null = null;

  constructor(private authoring: MsimAuthoringService, private router: Router) {}

  ngOnInit(): void { this.validate(); }

  get firstIcRef(): string {
    return this.config.panels.find(p => p.kind === 'ic')?.icInterfaceRef ?? '';
  }

  select(part: RailPart): void {
    // Reuse-first: per-simulation parts navigate out to existing pages.
    if (part === 'scenes') { this.router.navigate(['/sim-spaces']); return; }
    if (part === 'graphs') { this.router.navigate(['/graphs']); return; }
    this.activePart = part;
  }

  markDirty(): void { this.dirty = true; }

  async save(): Promise<void> {
    this.saving = true;
    this.saveError = null;
    try {
      await this.authoring.saveMsim(this.config);
      this.dirty = false;
      this.saved.emit();
      await this.validate();
    } catch (err: any) {
      this.saveError = `Save failed: ${err?.message || err}`;
    } finally {
      this.saving = false;
    }
  }

  async validate(): Promise<void> {
    try {
      const res = await this.authoring.validateComposition(this.config.name);
      this.findings = res.findings ?? [];
      this.validated = true;
    } catch {
      this.findings = [];
      this.validated = false;
    }
  }
}
