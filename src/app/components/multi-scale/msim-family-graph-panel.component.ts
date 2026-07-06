import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { Subscription, firstValueFrom } from 'rxjs';

import { GraphRendererComponent } from '@components/graph-config/graph-renderer/graph-renderer';
import { NamedGraphConfig } from '@models/graphs/NamedGraphConfig';
import { MsimPanel } from '@models/multi-scale/NamedMultiScaleSimConfig';
import { MsimGraphPanelComponent } from './msim-graph-panel.component';
import { MsimGraphDataService } from '@services/multi-scale/msim-graph-data.service';
import { MsimStageRunService } from '@services/multi-scale/msim-stage-run.service';
import {
  MsimFamilySeriesService, FamilyMemberSeries,
} from '@services/multi-scale/msim-family-series.service';
import {
  InitialConditionInterfaceService,
} from '@services/multi-scale/initial-condition-interface.service';

/** One material of the family: an IC choice + its proof-run state. */
interface FamilyMember {
  key: string;
  label: string;
  run: string | null;
}

/**
 * A FAMILY graph panel: the same simulation graph pivoted across a
 * family of materials (the IC picker's choices) tied to one stage —
 * per-material tabs plus an "All materials" comparison chart merging
 * every proven material into one plot (coherent by construction: same
 * source class, same fields, same units).
 *
 * A material with no proof this session gets an inviting hint instead
 * of an empty chart; charts appear as proofs land (live via
 * stageRunChanged$).
 */
@Component({
  standalone: true,
  selector: 'msim-family-graph-panel',
  imports: [
    CommonModule, MatIconModule, MatTabsModule,
    GraphRendererComponent, MsimGraphPanelComponent,
  ],
  template: `
    <div class="panel-title">
      <mat-icon>show_chart</mat-icon>
      {{ graphConfig?.name || graphRef }}
      <span class="panel-run">material family</span>
    </div>
    <p class="family-error" *ngIf="loadError">{{ loadError }}</p>
    <mat-tab-group *ngIf="graphConfig" animationDuration="0ms">
      <mat-tab label="All materials">
        <ng-container *ngIf="combinedRows.length; else noneProven">
          <graph-renderer [config]="combinedConfig!"
                          [instanceData]="combinedRows"
                          [classTypeData]="{}">
          </graph-renderer>
          <p class="family-note">
            One series per material · {{ provenCount }} of
            {{ members.length }} materials proven so far.
          </p>
        </ng-container>
        <ng-template #noneProven>
          <p class="family-hint">
            <mat-icon>science</mat-icon>
            No materials proven yet — pick materials in the picker and run
            their proofs; each proven material joins this comparison.
            Meanwhile, the stage's latest attempt:
          </p>
          <msim-graph-panel [panel]="latestStagePanel"
                            [msimName]="msimName"
                            [running]="running">
          </msim-graph-panel>
        </ng-template>
      </mat-tab>
      <mat-tab *ngFor="let m of members" [label]="m.label">
        <ng-container *ngIf="m.run; else notProven">
          <msim-graph-panel [panel]="memberPanel(m)"
                            [msimName]="msimName"
                            [running]="running">
          </msim-graph-panel>
        </ng-container>
        <ng-template #notProven>
          <p class="family-hint">
            <mat-icon>science</mat-icon>
            {{ m.label }} has no proven run yet — select it in the material
            picker and run its proof to chart it here.
          </p>
        </ng-template>
      </mat-tab>
    </mat-tab-group>
  `,
  styles: [`
    .panel-title {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 12px; font-weight: 600; font-size: 14px;
      border-bottom: 1px solid var(--border-light, #eee);
    }
    .panel-title mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .panel-title .panel-run {
      font-weight: 400; font-size: 12px; color: var(--brand-teal, #159588);
    }
    .family-hint {
      display: flex; align-items: center; gap: 8px; padding: 12px;
      font-size: 0.85rem; color: var(--text-secondary, #777);
    }
    .family-hint mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .family-note {
      font-size: 0.75rem; color: var(--text-secondary, #777);
      padding: 0 12px 8px; margin: 4px 0 0;
    }
    .family-error { color: #c62828; font-size: 0.85rem; padding: 4px 12px; }
    graph-renderer { display: block; overflow-x: auto; padding: 8px 12px 0; }
  `],
})
export class MsimFamilyGraphPanelComponent implements OnInit, OnDestroy {
  @Input({ required: true }) graphRef!: string;
  @Input() sourceClass = '';
  @Input({ required: true }) msimName!: string;
  @Input({ required: true }) stageKey!: string;
  /** The IC interface whose choices ARE the family. */
  @Input({ required: true }) icInterfaceRef!: string;
  /** Which fields join the combined chart (default: the graph's own
   *  yDimensions — same units per field across materials). */
  @Input() combineFields: string[] = [];
  @Input() running = false;

  graphConfig: NamedGraphConfig | null = null;
  members: FamilyMember[] = [];
  combinedRows: any[] = [];
  combinedConfig: NamedGraphConfig | null = null;
  loadError: string | null = null;

  private stageRunSub: Subscription | null = null;

  constructor(
    private graphData: MsimGraphDataService,
    private stageRun: MsimStageRunService,
    private familySeries: MsimFamilySeriesService,
    private icService: InitialConditionInterfaceService,
  ) {}

  get provenCount(): number {
    return this.members.filter(m => m.run).length;
  }

  async ngOnInit(): Promise<void> {
    this.stageRunSub = this.stageRun.stageRunChanged$.subscribe(ev => {
      if (ev.msim !== this.msimName || ev.stageKey !== this.stageKey) return;
      void this.refreshFamily();
    });
    try {
      this.graphConfig = await this.graphData.loadGraphByName(this.graphRef);
      const ic = await firstValueFrom(
        this.icService.loadByName(this.icInterfaceRef));
      this.members = (ic.choices ?? []).map(c => ({
        key: c.key, label: c.label, run: null,
      }));
    } catch (err: any) {
      this.loadError = err?.message || String(err);
      return;
    }
    await this.refreshFamily();
  }

  ngOnDestroy(): void {
    this.stageRunSub?.unsubscribe();
  }

  memberPanel(m: FamilyMember): MsimPanel {
    return {
      kind: 'graph',
      graphRef: this.graphRef,
      sourceClass: this.sourceClass,
      runs: m.run ? [m.run] : [],
    };
  }

  /** Pre-proof fallback: the stage's newest run via the stage token. */
  get latestStagePanel(): MsimPanel {
    return {
      kind: 'graph',
      graphRef: this.graphRef,
      sourceClass: this.sourceClass,
      runs: [`stage:${this.stageKey}`],
    };
  }

  /** Re-resolve every member's run and rebuild the combined chart. */
  private async refreshFamily(): Promise<void> {
    if (!this.graphConfig) return;
    for (const m of this.members) {
      m.run = this.stageRun.runForSubstance(
        this.msimName, this.stageKey, m.key);
    }
    const fields = this.combineFields.length
      ? this.combineFields
      : this.graphConfig.graphConfig.yDimensions;
    const proven = this.members.filter(m => m.run);
    const cls = this.sourceClass || this.graphConfig.source_class;
    const memberSeries: FamilyMemberSeries[] = [];
    for (const m of proven) {
      try {
        const page = await this.graphData.fetchSeries(m.run!, cls, fields);
        memberSeries.push({ label: m.label, page });
      } catch { /* a member's fetch hiccup must not sink the family */ }
    }
    this.combinedConfig = this.familySeries.combinedConfig(
      this.graphConfig, memberSeries, fields);
    // REASSIGNED (never mutated) so the renderer's ngOnChanges redraws.
    this.combinedRows = this.familySeries.combineRows(memberSeries, fields);
  }
}
