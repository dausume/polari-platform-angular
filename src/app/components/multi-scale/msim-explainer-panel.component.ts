import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';

import {
  MsimStage, NamedMultiScaleSimConfig,
} from '@models/multi-scale/NamedMultiScaleSimConfig';
import {
  MultiScaleSimDefinitionService,
} from '@services/multi-scale/multi-scale-sim-definition.service';
import { MsimConditionMapComponent } from './msim-condition-map.component';

/** One "T from–to in N steps" line of the search-space fact list. */
interface SearchAxisFact {
  parameter: string;
  from: number;
  to: number;
  steps: number;
}

/** One "source → simulation.parameter" line of the derive fact list. */
interface DeriveFact {
  source: string;
  target: string;
}

/**
 * A `kind:'explainer'` panel: a stage's plain-language narrative (seeded,
 * editable config) augmented with LIVE FACTS read from the composition's
 * own stage config — the search grid it will sweep, the gate it must
 * pass, and the derive map that flows proven values downstream — so the
 * explanation cannot drift from what the machinery actually does.
 * Optionally embeds the tried-conditions map (msim-condition-map).
 *
 * Works from either host: the msim page passes the loaded config; a
 * Display layout passes only msimName (+ context) and the panel loads
 * the config itself.
 */
@Component({
  standalone: true,
  selector: 'msim-explainer-panel',
  imports: [CommonModule, MatIconModule, MsimConditionMapComponent],
  template: `
    <div class="panel-title">
      <mat-icon>psychology</mat-icon>
      {{ title || 'How this stage works' }}
      <span class="panel-run" *ngIf="stage">stage: {{ stage.label || stage.key }}</span>
    </div>
    <div class="explainer-body">
      <p class="narrative" *ngIf="body">{{ body }}</p>

      <div class="facts" *ngIf="stage">
        <div class="fact" *ngIf="showSearchSpace && searchAxes.length">
          <mat-icon>grid_on</mat-icon>
          <div>
            <strong>Search space</strong> — every combination of:
            <ul>
              <li *ngFor="let axis of searchAxes">
                {{ axis.parameter }}: {{ axis.from }} to {{ axis.to }}
                in {{ axis.steps }} step{{ axis.steps === 1 ? '' : 's' }}
              </li>
            </ul>
          </div>
        </div>
        <div class="fact" *ngIf="showGate && stage.gate?.solutionRef">
          <mat-icon>verified</mat-icon>
          <div>
            <strong>Gate</strong> — the no-code solution
            <code>{{ stage.gate?.solutionRef }}</code> must pass.
            <span *ngIf="stage.gate?.failReason">
              When it fails: “{{ stage.gate?.failReason }}”
            </span>
          </div>
        </div>
        <div class="fact" *ngIf="showDerive && deriveFacts.length">
          <mat-icon>trending_flat</mat-icon>
          <div>
            <strong>Proven values flow onward</strong>
            <ul>
              <li *ngFor="let d of deriveFacts">
                <code>{{ d.source }}</code> → <code>{{ d.target }}</code>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <p class="facts-missing" *ngIf="loadError">{{ loadError }}</p>

      <msim-condition-map *ngIf="showConditionMap && stageKey"
          [msimName]="msimName" [stageKey]="stageKey"
          [showMeltLine]="showMeltLine">
      </msim-condition-map>
    </div>
  `,
  styles: [`
    .panel-title {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 12px; font-weight: 600; font-size: 14px;
      border-bottom: 1px solid var(--border-light, #eee);
    }
    .panel-title mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .panel-title .panel-run {
      font-weight: 400; font-size: 12px; color: var(--text-secondary, #777);
    }
    .explainer-body { padding: 8px 12px; }
    .narrative {
      font-size: 0.9rem; line-height: 1.45;
      color: var(--text-primary, #333); margin: 4px 0 10px;
    }
    .facts { display: flex; flex-direction: column; gap: 8px; }
    .fact {
      display: flex; gap: 8px; font-size: 0.85rem;
      color: var(--text-secondary, #555);
    }
    .fact mat-icon {
      font-size: 18px; width: 18px; height: 18px; margin-top: 1px;
      color: var(--brand-teal, #159588);
    }
    .fact ul { margin: 2px 0 0; padding-left: 18px; }
    .fact code {
      background: var(--surface-alt, #f4f4f4); padding: 0 4px;
      border-radius: 3px; font-size: 0.8rem;
    }
    .facts-missing { font-size: 0.8rem; color: #c62828; }
    msim-condition-map { display: block; margin-top: 10px; }
  `],
})
export class MsimExplainerPanelComponent implements OnInit, OnChanges {
  @Input() msimName = '';
  @Input() stageKey = '';
  @Input() title = '';
  @Input() body = '';
  // Knobs — every fact block is independently toggleable config.
  @Input() showSearchSpace = true;
  @Input() showGate = true;
  @Input() showDerive = true;
  @Input() showConditionMap = true;
  @Input() showMeltLine = true;
  /** The already-loaded config (msim page). When absent (Display
   *  layouts), the panel loads it from msimName. */
  @Input() config: NamedMultiScaleSimConfig | null = null;

  stage: MsimStage | null = null;
  searchAxes: SearchAxisFact[] = [];
  deriveFacts: DeriveFact[] = [];
  loadError: string | null = null;

  constructor(private msimService: MultiScaleSimDefinitionService) {}

  ngOnInit(): void {
    void this.resolveStage();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config'] || changes['msimName'] || changes['stageKey']) {
      void this.resolveStage();
    }
  }

  private async resolveStage(): Promise<void> {
    this.loadError = null;
    let cfg = this.config;
    if (!cfg && this.msimName) {
      try {
        cfg = await firstValueFrom(this.msimService.loadByName(this.msimName));
      } catch (err: any) {
        this.loadError = `Could not load the composition's stage facts: `
          + `${err?.message || err}`;
        return;
      }
    }
    this.stage = cfg?.stages.find(s => s.key === this.stageKey) ?? null;
    if (!this.stage && this.stageKey) {
      this.loadError = `Stage "${this.stageKey}" is not configured on this `
        + 'composition (the explainer panel\'s stageKey knob points nowhere).';
    }
    this.searchAxes = this.buildSearchAxes(this.stage);
    this.deriveFacts = this.buildDeriveFacts(this.stage);
  }

  private buildSearchAxes(stage: MsimStage | null): SearchAxisFact[] {
    const params = stage?.search?.candidates?.parameters ?? {};
    return Object.entries(params).map(([parameter, span]) => ({
      parameter,
      from: span.from,
      to: span.to,
      steps: span.steps,
    }));
  }

  private buildDeriveFacts(stage: MsimStage | null): DeriveFact[] {
    const params = stage?.derive?.params ?? {};
    return Object.entries(params).map(([target, source]) => ({
      source, target,
    }));
  }
}
