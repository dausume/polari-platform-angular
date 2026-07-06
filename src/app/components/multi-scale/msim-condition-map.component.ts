import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Subscription } from 'rxjs';

import { GraphRendererComponent } from '@components/graph-config/graph-renderer/graph-renderer';
import { NamedGraphConfig } from '@models/graphs/NamedGraphConfig';
import { MsimProofService, ProofEvent } from '@services/multi-scale/msim-proof.service';
import {
  MsimAttemptsToRowsService, MeltLineParams,
} from '@services/multi-scale/msim-attempts-to-rows.service';

/**
 * The CONDITION MAP: every temperature/pressure candidate a stage's
 * solution search tried, colored by verdict (green = solid ball proven,
 * red = failed), against the substance's analytic melting line — so
 * "why was this material impossible?" is visible as geometry: failed
 * candidates sit on the wrong side of the line.
 *
 * Data arrives via MsimProofService.proofChanged$ (the search results
 * the IC picker already produces); this component adds no new backend
 * traffic. Renders the moment a proof lands for its stage; shows an
 * inviting hint until then.
 */
@Component({
  standalone: true,
  selector: 'msim-condition-map',
  imports: [CommonModule, MatIconModule, GraphRendererComponent],
  template: `
    <div class="condition-map" *ngIf="rows.length; else noProofYet">
      <div class="map-title">
        Conditions tried for <strong>{{ substanceLabel }}</strong>
        <span class="map-legend">
          <span class="dot proven"></span> solid ball proven
          <span class="dot failed"></span> failed
          <span class="dot line" *ngIf="showMeltLine"></span> melting line
        </span>
      </div>
      <graph-renderer [config]="graphConfig" [instanceData]="rows"
                      [classTypeData]="{}">
      </graph-renderer>
      <p class="map-caption">
        Temperature (K) vs pressure (kPa). A candidate proves the ball
        only when it lands BELOW the melting line — solid territory.
      </p>
    </div>
    <ng-template #noProofYet>
      <p class="map-hint">
        <mat-icon>scatter_plot</mat-icon>
        Pick a material above and run its proof — every tried
        temperature/pressure condition will appear here, pass or fail.
      </p>
    </ng-template>
  `,
  styles: [`
    .condition-map { padding: 4px 0; }
    .map-title {
      display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
      font-size: 0.85rem; color: var(--text-secondary, #555);
      padding: 4px 0;
    }
    .map-legend { display: inline-flex; align-items: center; gap: 6px;
                  font-size: 0.75rem; }
    .dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
    .dot.proven { background: #2e7d32; }
    .dot.failed { background: #c62828; }
    .dot.line { background: #1976d2; }
    .map-caption { font-size: 0.75rem; color: var(--text-secondary, #777);
                   margin: 4px 0 0; }
    .map-hint {
      display: flex; align-items: center; gap: 8px;
      font-size: 0.85rem; color: var(--text-secondary, #777);
      padding: 8px 4px;
    }
    .map-hint mat-icon { font-size: 20px; width: 20px; height: 20px; }
    graph-renderer { display: block; overflow-x: auto; }
  `],
})
export class MsimConditionMapComponent implements OnInit, OnDestroy {
  /** The composition + stage whose search this map draws. */
  @Input() msimName = '';
  @Input() stageKey = '';
  /** Knob: overlay the substance's analytic melting line. */
  @Input() showMeltLine = true;

  rows: any[] = [];
  substanceLabel = '';
  graphConfig!: NamedGraphConfig;

  private proofSub: Subscription | null = null;

  constructor(
    private proofService: MsimProofService,
    private attemptsToRows: MsimAttemptsToRowsService,
  ) {}

  ngOnInit(): void {
    this.graphConfig = this.attemptsToRows.buildGraphConfig();
    this.proofSub = this.proofService.proofChanged$.subscribe(
      ev => this.onProofChanged(ev));
  }

  ngOnDestroy(): void {
    this.proofSub?.unsubscribe();
  }

  private onProofChanged(ev: ProofEvent): void {
    if (ev.msim !== this.msimName || ev.stageKey !== this.stageKey) return;
    if (!ev.report) {
      // Proof cleared ("Try again") — back to the hint.
      this.rows = [];
      this.substanceLabel = '';
      return;
    }
    this.substanceLabel = ev.substanceLabel;
    const meltLine = this.showMeltLine
      ? this.meltLineOf(ev.substanceParams) : null;
    // REASSIGNED (never mutated) so the renderer's ngOnChanges redraws.
    this.rows = this.attemptsToRows.toRows(ev.report, meltLine);
  }

  private meltLineOf(
    params?: Record<string, number>): MeltLineParams | null {
    if (typeof params?.['melt_temp_ref'] !== 'number'
        || typeof params?.['melt_slope_k_per_pa'] !== 'number') return null;
    return {
      melt_temp_ref: params['melt_temp_ref'],
      melt_slope_k_per_pa: params['melt_slope_k_per_pa'],
    };
  }
}
