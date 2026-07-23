import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { SimSpaceViewerComponent } from '@components/sim-space/sim-space-viewer/sim-space-viewer.component';
import { SciXyChartComponent, SciSeries, SciTick } from '@components/charts/sci-xy-chart.component';
import {
  CrystalDetail, CrystalStructureService, CrystalSummary,
  ElasticResult, PhononResult,
} from '@services/materials-science/crystal-structure.service';

/**
 * Crystal structure browser + 3D lattice view (ssp-2) + lattice
 * dynamics (ssp-4): pick a CrystalStructureDefinition, see its facts
 * and its seeded SimSpace lattice scene (atoms/bonds/cell edges, XR
 * for free), regenerate the scene with explicit supercell knobs, and
 * run the L3 phonon-dispersion / elastic-constants engines with the
 * potential knobs surfaced — results carry their honesty lines
 * (acoustic sum rule, stability, Cauchy relation) verbatim.
 */
@Component({
  standalone: true,
  selector: 'crystal-structure-view',
  imports: [CommonModule, FormsModule, RouterModule, MatIconModule,
            MatTooltipModule, SimSpaceViewerComponent,
            SciXyChartComponent],
  templateUrl: './crystal-structure-view.component.html',
  styleUrls: ['./crystal-structure-view.component.scss'],
})
export class CrystalStructureViewComponent implements OnInit {
  @Input() structureName = '';

  structures: CrystalSummary[] = [];
  selected = '';
  detail: CrystalDetail | null = null;
  loading = true;
  loadError = '';

  // Scene regenerate knobs (explicit — never auto-applied).
  supercell: [number, number, number] = [1, 1, 1];
  regenerating = false;
  regenerateNote = '';

  // Lattice-dynamics knobs.
  potentialKind: 'lennard-jones' | 'spring' = 'lennard-jones';
  epsilonEv = 0.39;
  sigmaA: number | null = null;
  fitSigma = true;
  stiffnessEvA2 = 2.0;
  npoints = 120;
  usePrimitive = true;

  phononRunning = false;
  phonon: PhononResult | null = null;
  phononSeries: SciSeries[] = [];
  phononTicks: SciTick[] = [];
  dosSeries: SciSeries[] = [];

  elasticRunning = false;
  elastic: ElasticResult | null = null;

  // ssp-3 worker analyses (symmetry + simulated XRD).
  analysisRunning = false;
  analysis: any = null;
  xrdRunning = false;
  xrdResult: any = null;
  xrdSeries: SciSeries[] = [];

  @ViewChild(SimSpaceViewerComponent) viewer?: SimSpaceViewerComponent;

  constructor(private crystals: CrystalStructureService) {}

  async ngOnInit(): Promise<void> {
    this.structures = await this.crystals.list();
    this.loading = false;
    const first = this.structureName
      || this.structures[0]?.name || '';
    if (first) { await this.select(first); }
  }

  async select(name: string): Promise<void> {
    this.selected = name;
    this.detail = null;
    this.loadError = '';
    this.phonon = null;
    this.elastic = null;
    this.analysis = null;
    this.xrdResult = null;
    this.regenerateNote = '';
    const detail = await this.crystals.detail(name);
    if (!detail || !detail.ok) {
      this.loadError = detail?.error
        ?? `structure endpoint did not answer for '${name}'`;
      return;
    }
    this.detail = detail;
  }

  get sceneName(): string {
    return this.detail?.sceneName ?? '';
  }

  cellparLabel(): string {
    const p = this.detail?.facts?.cellpar;
    if (!p) { return ''; }
    return `a=${p[0]} b=${p[1]} c=${p[2]} Å  `
      + `α=${p[3]}° β=${p[4]}° γ=${p[5]}°`;
  }

  async regenerateScene(): Promise<void> {
    if (!this.detail) { return; }
    this.regenerating = true;
    this.regenerateNote = '';
    const verdict = await this.crystals.refreshScene(
      this.detail.name, { supercell: this.supercell });
    this.regenerating = false;
    if (!verdict?.ok) {
      this.regenerateNote = verdict?.error ?? 'scene refresh failed';
      return;
    }
    this.regenerateNote = `${verdict.action}: `
      + `${verdict.counts.atoms} atoms, ${verdict.counts.bonds} `
      + `bonds (${this.supercell.join('x')} cells)`;
    // The scene row was rewritten — refetch and re-render it.
    this.viewer?.refresh();
  }

  potentialBody(): any {
    const potential: any = this.potentialKind === 'spring'
      ? { kind: 'spring', stiffnessEvA2: this.stiffnessEvA2 }
      : { kind: 'lennard-jones', epsilonEv: this.epsilonEv,
          ...(this.sigmaA && !this.fitSigma
            ? { sigmaA: this.sigmaA } : {}) };
    return potential;
  }

  async runPhonons(): Promise<void> {
    if (!this.detail) { return; }
    this.phononRunning = true;
    this.phonon = null;
    const result = await this.crystals.phonons(this.detail.name, {
      potential: this.potentialBody(),
      fitSigmaToStructure: this.potentialKind === 'lennard-jones'
        && this.fitSigma,
      npoints: this.npoints,
      usePrimitive: this.usePrimitive,
    });
    this.phononRunning = false;
    this.phonon = result;
    if (result.ok) { this.buildPhononCharts(result); }
  }

  private buildPhononCharts(r: PhononResult): void {
    const kd = r.kDistances ?? [];
    const freqs = r.frequenciesThz ?? [];
    const branches = r.branches ?? 0;
    const series: SciSeries[] = [];
    for (let b = 0; b < branches; b++) {
      series.push({
        label: `branch ${b + 1}`, kind: 'line', color: '#00695c',
        points: kd.map((x, ik) => ({ x, y: freqs[ik]?.[b] ?? 0 })),
      });
    }
    this.phononSeries = series;
    this.phononTicks = (r.pathLabelIndices ?? []).map((idx, n) => ({
      value: kd[idx] ?? 0,
      label: (r.pathLabels?.[n] ?? '') === 'G' ? 'Γ'
        : (r.pathLabels?.[n] ?? ''),
    }));
    const bins = r.dos?.binsThz ?? [];
    const counts = r.dos?.counts ?? [];
    this.dosSeries = [{
      label: 'DOS', kind: 'line', color: '#5e35b1',
      points: counts.map((c, i) => ({
        x: (bins[i] + bins[i + 1]) / 2, y: c })),
    }];
  }

  async runElastic(): Promise<void> {
    if (!this.detail) { return; }
    this.elasticRunning = true;
    this.elastic = null;
    this.elastic = await this.crystals.elastic(this.detail.name, {
      potential: { kind: 'lennard-jones', epsilonEv: this.epsilonEv,
        ...(this.sigmaA && !this.fitSigma
          ? { sigmaA: this.sigmaA } : {}) },
      fitSigmaToStructure: this.fitSigma,
    });
    this.elasticRunning = false;
  }

  async runAnalysis(): Promise<void> {
    if (!this.detail) { return; }
    this.analysisRunning = true;
    this.analysis = await this.crystals.analyze(this.detail.name);
    this.analysisRunning = false;
  }

  async runXrd(): Promise<void> {
    if (!this.detail) { return; }
    this.xrdRunning = true;
    this.xrdResult = await this.crystals.xrd(this.detail.name);
    this.xrdRunning = false;
    if (this.xrdResult?.ok) {
      this.xrdSeries = [{
        label: 'intensity', kind: 'stick', color: '#c62828',
        points: (this.xrdResult.peaks ?? []).map((p: any) => ({
          x: p.twoTheta, y: p.intensity })),
      }];
    }
  }

  strongestPeaksLabel(): string {
    const peaks: any[] = [...(this.xrdResult?.peaks ?? [])]
      .sort((a, b) => b.intensity - a.intensity).slice(0, 4);
    if (!peaks.length) { return ''; }
    return 'strongest: ' + peaks.map(p => {
      const hkl = (p.hkl ?? [])
        .map((h: number[]) => h.join('')).join(',');
      return `(${hkl}) ${p.twoTheta}°`;
    }).join('  ');
  }

  isCubic(): boolean {
    const p = this.detail?.facts?.cellpar;
    if (!p) { return false; }
    return Math.abs(p[0] - p[1]) < 1e-6 && Math.abs(p[1] - p[2]) < 1e-6
      && Math.abs(p[3] - 90) < 1e-6 && Math.abs(p[4] - 90) < 1e-6
      && Math.abs(p[5] - 90) < 1e-6;
  }
}
