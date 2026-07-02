import {
  Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit,
  Output, SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';

import { GraphRendererComponent } from '@components/graph-config/graph-renderer/graph-renderer';
import { NamedGraphConfig } from '@models/graphs/NamedGraphConfig';
import { MsimPanel } from '@models/multi-scale/NamedMultiScaleSimConfig';
import { MsimGraphDataService } from '@services/multi-scale/msim-graph-data.service';

/** Per-run live series state feeding one graph-renderer. */
interface RunSeries {
  run: string;
  /** REASSIGNED (never mutated) on every update so the renderer's
   *  ngOnChanges fires and redraws the growing chart. */
  rows: any[];
  lastStep: number | null;
  error: string | null;
}

/**
 * A `kind:'graph'` panel of the Multi-Scale Simulation Page: one
 * GraphDefinition (by name) rendered ONCE PER CONFIGURED RUN
 * ('primary' → the page's selected run, 'compare' → the comparison
 * run), fed from GET /runs/{run}/series. While the page is running it
 * polls incrementally (`sinceStep`) so the charts grow live; when the
 * run stops it takes one final full refresh and goes quiet.
 */
@Component({
  standalone: true,
  selector: 'msim-graph-panel',
  imports: [
    CommonModule, RouterModule,
    MatIconModule, MatProgressSpinnerModule, MatTooltipModule,
    GraphRendererComponent,
  ],
  template: `
    <div class="panel-title">
      <mat-icon>show_chart</mat-icon>
      {{ graphConfig?.name || panel.graphRef }}
      <span class="panel-run" *ngIf="graphConfig?.source_class">{{ graphConfig?.source_class }}</span>
      <a mat-icon-button routerLink="/graphs" matTooltip="Configure graphs (Graphs page)">
        <mat-icon>settings</mat-icon>
      </a>
    </div>
    <p class="graph-error" *ngIf="loadError">{{ loadError }}</p>
    <div class="graph-runs" *ngIf="graphConfig">
      <div class="graph-run" *ngFor="let series of runSeries; trackBy: trackRun">
        <div class="graph-run-title">
          <span class="run-dot" [class.comparison]="series.run !== primaryRun"></span>
          {{ series.run }}
          <span class="graph-run-meta" *ngIf="series.lastStep !== null">step {{ series.lastStep }}</span>
          <span class="graph-run-meta error" *ngIf="series.error">{{ series.error }}</span>
        </div>
        <graph-renderer
          [config]="graphConfig!"
          [instanceData]="series.rows"
          [classTypeData]="{}">
        </graph-renderer>
      </div>
    </div>
  `,
  styles: [`
    /* .panel-title mirrors the page's panel-card header — the page's
       scoped styles can't reach into this child component. */
    .panel-title {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 12px; font-weight: 600; font-size: 14px;
      border-bottom: 1px solid var(--border-light, #eee);
    }
    .panel-title mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .panel-title .panel-run {
      font-weight: 400; font-size: 12px; color: var(--text-secondary, #777);
    }
    .panel-title a { margin-left: auto; }
    .graph-runs { display: flex; flex-direction: column; gap: 12px; padding: 8px 12px; }
    .graph-run-title {
      display: flex; align-items: center; gap: 8px;
      font-size: 0.85rem; color: var(--text-secondary, #666);
      padding: 2px 4px;
    }
    .run-dot {
      width: 9px; height: 9px; border-radius: 50%;
      background: var(--brand-teal, #159588);
    }
    .run-dot.comparison { background: #9e9e9e; }
    .graph-run-meta { font-size: 0.75rem; opacity: 0.8; }
    .graph-run-meta.error { color: #c62828; }
    .graph-error { color: #c62828; font-size: 0.85rem; padding: 4px; }
    graph-renderer { display: block; overflow-x: auto; }
  `],
})
export class MsimGraphPanelComponent implements OnInit, OnChanges, OnDestroy {
  @Input() panel!: MsimPanel;
  /** The page's currently selected (primary) run. */
  @Input() primaryRun: string | null = null;
  /** The page's comparison run (compare_run_policy). */
  @Input() compareRun: string | null = null;
  /** True while the page is committing steps — turns on live polling. */
  @Input() running = false;
  @Output() seriesError = new EventEmitter<string>();

  graphConfig: NamedGraphConfig | null = null;
  loadError: string | null = null;
  runSeries: RunSeries[] = [];

  private pollTimer: any = null;
  private readonly POLL_MS = 1500;
  private destroyed = false;

  constructor(private graphData: MsimGraphDataService) {}

  async ngOnInit(): Promise<void> {
    await this.loadGraph();
    this.rebuildRunList();
    await this.refresh();
  }

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    if ((changes['primaryRun'] && !changes['primaryRun'].firstChange)
        || (changes['compareRun'] && !changes['compareRun'].firstChange)) {
      this.rebuildRunList();
      await this.refresh();
    }
    if (changes['running']) {
      if (this.running) this.startPolling();
      else await this.stopPolling();
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  trackRun(_i: number, s: RunSeries): string { return s.run; }

  /** Full refetch for every run (also the page's after-steps hook). */
  async refresh(): Promise<void> {
    if (!this.graphConfig) return;
    await Promise.all(this.runSeries.map(s => this.fetchInto(s, undefined)));
  }

  // ----------------------------------------------------------------

  private async loadGraph(): Promise<void> {
    const ref = this.panel?.graphRef;
    if (!ref) { this.loadError = 'Panel has no graphRef.'; return; }
    try {
      this.graphConfig = await this.graphData.loadGraphByName(ref);
      if (!this.graphConfig.graphConfig.xDimension) {
        this.loadError = `GraphDefinition "${ref}" has no xDimension configured.`;
      }
    } catch (err: any) {
      this.loadError = err?.message || String(err);
    }
  }

  /** Map the panel's configured runs ('primary'/'compare'/literal) to
   *  concrete run names, keeping any already-fetched series. */
  private rebuildRunList(): void {
    const wanted: string[] = [];
    for (const token of (this.panel?.runs?.length ? this.panel.runs : ['primary'])) {
      const run = token === 'primary' ? this.primaryRun
        : token === 'compare' ? this.compareRun
        : token;
      if (run && !wanted.includes(run)) wanted.push(run);
    }
    const prior = new Map(this.runSeries.map(s => [s.run, s]));
    this.runSeries = wanted.map(run =>
      prior.get(run) ?? { run, rows: [], lastStep: null, error: null });
  }

  private async fetchInto(series: RunSeries, sinceStep?: number): Promise<void> {
    const cls = this.panel.sourceClass || this.graphConfig?.source_class;
    if (!cls || !this.graphConfig) return;
    try {
      const page = await this.graphData.fetchSeries(
        series.run, cls, this.graphConfig.graphConfig.yDimensions, sinceStep,
      );
      const newRows = this.graphData.seriesToRows(page);
      series.error = null;
      if (sinceStep === undefined) {
        series.rows = newRows;                       // full replace
        series.lastStep = page.lastStep;
      } else if (newRows.length) {
        series.rows = [...series.rows, ...newRows];  // incremental append
        series.lastStep = page.lastStep ?? series.lastStep;
      }
    } catch (err: any) {
      series.error = err?.message || String(err);
      this.seriesError.emit(series.error ?? '');
    }
  }

  private startPolling(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(async () => {
      if (this.destroyed) return;
      await Promise.all(this.runSeries.map(s =>
        this.fetchInto(s, s.lastStep ?? undefined)));
    }, this.POLL_MS);
  }

  private async stopPolling(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    // One final full refresh so the chart lands on the exact end state.
    await this.refresh();
  }
}
