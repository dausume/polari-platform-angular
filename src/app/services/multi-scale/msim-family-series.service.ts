import { Injectable } from '@angular/core';

import { NamedGraphConfig } from '@models/graphs/NamedGraphConfig';
import { SeriesPage } from './msim-graph-data.service';

/** One family member's fetched series, labeled for the legend. */
export interface FamilyMemberSeries {
  /** Legend-facing name, e.g. 'Paraffin wax'. */
  label: string;
  page: SeriesPage;
}

/**
 * Merges several family members' per-run series into ONE chart's rows —
 * the "many-material graph": the same physical fields, one series per
 * material, aligned on time. Coherence rule: members are merged only
 * because they share the graph's source class and fields, so the y-space
 * (units) is the same by construction.
 *
 * Row shape: { time, '<field> — <label>': value, ... } — one column per
 * (field, member) pair; Observable Plot omits missing values, so members
 * whose runs have different lengths still plot correctly.
 */
@Injectable({ providedIn: 'root' })
export class MsimFamilySeriesService {

  combineRows(members: FamilyMemberSeries[], fields: string[]): any[] {
    const byTime = new Map<number, any>();
    for (const member of members) {
      const times = member.page.times ?? [];
      for (let i = 0; i < times.length; i++) {
        const t = times[i];
        if (t === null || t === undefined) continue;
        let row = byTime.get(t);
        if (!row) {
          row = { time: t };
          byTime.set(t, row);
        }
        for (const field of fields) {
          const values = member.page.fields?.[field];
          const v = values?.[i];
          if (v !== null && v !== undefined) {
            row[this.columnName(field, member.label)] = v;
          }
        }
      }
    }
    return [...byTime.values()].sort((a, b) => a.time - b.time);
  }

  /** The combined chart's config: same style/axes as the base graph,
   *  yDimensions swapped for the per-member columns. */
  combinedConfig(base: NamedGraphConfig, members: FamilyMemberSeries[],
                 fields: string[]): NamedGraphConfig {
    const cfg = new NamedGraphConfig(
      `${base.id}-family`, `${base.name} — all materials`,
      base.description, base.source_class);
    cfg.graphConfig = {
      ...base.graphConfig,
      xDimension: 'time',
      yDimensions: members.flatMap(m =>
        fields.map(f => this.columnName(f, m.label))),
      seriesColors: [],
      options: { ...base.graphConfig.options },
      aggregation: { ...base.graphConfig.aggregation },
    };
    return cfg;
  }

  private columnName(field: string, label: string): string {
    return `${field} — ${label}`;
  }
}
