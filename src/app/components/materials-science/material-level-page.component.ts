import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  LevelAccountability, LevelEntry, MaterialsBasisService,
} from '@services/materials-science/materials-basis.service';

/**
 * One scale level's page (/display/materials-level-{0..4}): what this
 * level MEANS (range, methods, what earning a definition takes, which
 * engines serve it), then the accountability three-way — materials
 * DEFINED here (with their rows and lineage), PARTIAL (declared and
 * executable, result not yet stored), and MISSING, where every absence
 * carries the evidence-bearing suggestion: the exact row to create and
 * where the definition would come from. Suggestions are shown, never
 * auto-applied.
 */
@Component({
  standalone: true,
  selector: 'material-level-page',
  imports: [CommonModule, RouterModule, MatTooltipModule],
  templateUrl: './material-level-page.component.html',
  styleUrls: ['./material-level-page.component.scss'],
})
export class MaterialLevelPageComponent implements OnInit {
  @Input() level = 0;

  report: LevelAccountability | null = null;
  loading = true;
  loadError = '';

  constructor(private basis: MaterialsBasisService) {}

  async ngOnInit(): Promise<void> {
    this.report = await this.basis.levelAccountability(
      Number(this.level));
    this.loading = false;
    if (!this.report) {
      this.loadError = 'The level endpoint did not answer — is the '
        + `backend up? (GET /api/msci/scale-presence/level/${this.level})`;
    } else if (!this.report.ok) {
      this.loadError = this.report.error ?? 'unknown level';
    }
  }

  get otherLevels(): number[] {
    return [0, 1, 2, 3, 4].filter(l => l !== Number(this.level));
  }

  /** The config page serving an engine key ('meso.rod-percolation'
   *  → /display/meso-models) — the accountability page is the
   *  on-ramp to configuring a model that closes the gap. */
  configRouteFor(engine: string): string | null {
    const route = ({ fem: 'fem-models', dft: 'dft-models',
                     md: 'md-models', meso: 'meso-models' } as
                   Record<string, string>)[engine.split('.')[0] ?? ''];
    return route ? `/display/${route}` : null;
  }

  /** Unique config pages for this level's engines (missing-section
   *  on-ramp: "configure a model for this level"). */
  get configPages(): { label: string; route: string }[] {
    const engines = this.report?.detail?.engines ?? [];
    const seen = new Map<string, string>();
    for (const engine of engines) {
      const route = this.configRouteFor(engine);
      if (route && !seen.has(route)) {
        seen.set(route, engine.split('.')[0].toUpperCase());
      }
    }
    return [...seen.entries()].map(([route, label]) =>
      ({ label, route }));
  }

  rowLineage(entry: LevelEntry): string {
    return entry.rows
      .map(r => r.derivedFrom
        ? `${r.name} ← ${r.derivedFrom}`
          + (r.derivationMethod ? ` (${r.derivationMethod})` : '')
        : r.name)
      .join('; ');
  }
}
