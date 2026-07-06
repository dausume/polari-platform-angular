import { Injectable } from '@angular/core';

import { NamedGraphConfig } from '@models/graphs/NamedGraphConfig';
import { StageSearchReport } from './multi-scale-sim-definition.service';

/** Substance identity needed to draw the analytic melting line. */
export interface MeltLineParams {
  melt_temp_ref: number;
  melt_slope_k_per_pa: number;
}

const REFERENCE_PRESSURE_PA = 101325.0;
const MELT_LINE_SAMPLES = 24;

/**
 * Transforms a stage search's tried conditions into graph-renderer rows
 * for the CONDITION MAP — the temperature/pressure scatter that shows
 * WHERE the search looked and WHY each candidate passed or failed.
 *
 * Row shape (one per attempt, plus melt-line samples):
 *   { pressure_kPa, proven_K | failed_K, melt_line_K }
 * Split pass/fail columns give the 'dot' renderer one colored series
 * each (Observable Plot omits null channel values); the melting line is
 * sampled across the tried pressure span so the verdicts visibly sit
 * above/below it.
 */
@Injectable({ providedIn: 'root' })
export class MsimAttemptsToRowsService {

  toRows(report: StageSearchReport | null,
         meltLine: MeltLineParams | null): any[] {
    const rows: any[] = [];
    // The report lists EVERY candidate; ones the (short-circuited or
    // batched) search never ran have stepped=0 — they are not verdicts
    // and must not appear as failures on the map.
    const attempts = (report?.attempts ?? []).filter(a => a.stepped > 0);
    const pressures: number[] = [];
    for (const attempt of attempts) {
      const p = attempt.candidate?.['pressure_pa'];
      const t = attempt.candidate?.['target_temp'];
      if (typeof p !== 'number' || typeof t !== 'number') continue;
      pressures.push(p);
      rows.push({
        pressure_kPa: p / 1000.0,
        proven_K: attempt.complete ? t : null,
        failed_K: attempt.complete ? null : t,
        melt_line_K: null,
      });
    }
    if (meltLine && pressures.length) {
      rows.push(...this.meltLineRows(meltLine, pressures));
    }
    return rows;
  }

  /** The graph-renderer config the condition map renders with. */
  buildGraphConfig(): NamedGraphConfig {
    const cfg = new NamedGraphConfig(
      'msim-condition-map', 'Tried conditions',
      'Search candidates on the temperature/pressure plane vs the '
      + 'melting line', '');
    cfg.graphConfig = {
      ...cfg.graphConfig,
      renderStyle: 'dot',
      xDimension: 'pressure_kPa',
      yDimensions: ['failed_K', 'proven_K', 'melt_line_K'],
      seriesColors: ['#c62828', '#2e7d32', '#1976d2'],
      options: {
        ...cfg.graphConfig.options, height: 260, showLegend: true,
        xLabel: 'pressure (kPa)', yLabel: 'temperature (K)',
      },
    };
    return cfg;
  }

  private meltLineRows(meltLine: MeltLineParams, pressures: number[]): any[] {
    const min = Math.min(...pressures);
    const max = Math.max(...pressures);
    // A degenerate single-pressure search still gets a visible line.
    const span = max > min ? max - min : Math.max(min * 0.2, 1000);
    const from = max > min ? min : min - span / 2;
    const rows: any[] = [];
    for (let i = 0; i <= MELT_LINE_SAMPLES; i++) {
      const p = from + (span * i) / MELT_LINE_SAMPLES;
      rows.push({
        pressure_kPa: p / 1000.0,
        proven_K: null,
        failed_K: null,
        melt_line_K: meltLine.melt_temp_ref
          + meltLine.melt_slope_k_per_pa * (p - REFERENCE_PRESSURE_PA),
      });
    }
    return rows;
  }
}
