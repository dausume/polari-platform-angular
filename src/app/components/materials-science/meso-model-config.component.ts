import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  EngineCapability, EngineModelRow, EngineModelService, EngineTemplate,
} from '@services/materials-science/engine-model.service';
import { ModelRunBarComponent } from './model-run-bar.component';

/** mu0 / (4 pi) and k_B for the lambda helper (SI). */
const MU0_OVER_4PI = 1e-7;
const K_BOLTZMANN = 1.380649e-23;

/**
 * The MESOSCALE simulation configuration surface: System/Structure →
 * Sampling (rod percolation MC) or Integration (dipolar Brownian
 * dynamics) → Results/Verdicts. The rod results carry THE KNOB of the
 * msci-26 closing move: an explicit "use as percolationThreshold in a
 * chosen L1 model" suggestion button that writes an objectRef binding
 * — shown with its evidence, never auto-applied.
 */
@Component({
  standalone: true,
  selector: 'meso-model-config',
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule,
            MatTooltipModule, ModelRunBarComponent],
  templateUrl: './meso-model-config.component.html',
  styleUrls: ['./model-config.shared.scss', './md-meso-config.scss'],
})
export class MesoModelConfigComponent implements OnInit {
  @Input() defaultModelRef = '';

  models: EngineModelRow[] = [];
  templates: EngineTemplate[] = [];
  femModels: EngineModelRow[] = [];
  selected: EngineModelRow | null = null;
  capability: EngineCapability | null = null;
  system: any = {};
  sampling: any = {};
  integration: any = {};
  lastResult: any = null;
  findings: any[] = [];
  busy = false;
  outcome = '';
  outcomeBad = false;
  loading = true;

  // The use-as-threshold knob's state.
  thresholdTargetName = '';
  bindOutcome = '';
  bindOutcomeBad = false;

  // Lambda helper inputs (SI) — magnetite defaults with provenance in
  // the template notes.
  helperOpen = false;
  helperDiameterNm = 20;
  helperMsAPerM = 4.8e5;
  helperTemperatureK = 300;

  constructor(private service: EngineModelService) {}

  async ngOnInit(): Promise<void> {
    try {
      const [models, templates, caps, femModels] = await Promise.all([
        this.service.models('MesoModelDefinition'),
        this.service.templates(),
        this.service.capability(),
        this.service.models('FEMModelDefinition'),
      ]);
      this.models = models;
      this.templates = templates.filter(t => t.engineKind === 'meso');
      this.capability = caps['meso'] ?? null;
      // Only percolation-physics L1 models can consume the derived
      // threshold — the suggestion targets stay honest.
      this.femModels = femModels.filter(
        m => m.physics_ref === 'percolation-conductivity');
      this.thresholdTargetName = this.femModels.find(
        m => m.name === 'cnt-wax-percolation-derived-vfc')?.name
        ?? this.femModels[0]?.name ?? '';
      this.select(this.models.find(m => m.name === this.defaultModelRef)
        ?? this.models[0] ?? null);
    } finally {
      this.loading = false;
    }
  }

  select(model: EngineModelRow | null): void {
    this.selected = model;
    this.findings = [];
    this.outcome = '';
    this.bindOutcome = '';
    if (!model) return;
    this.system = this.parse(model.system_json, {});
    this.sampling = this.parse(model.sampling_json, {});
    this.integration = this.parse(model.integration_json, {});
    this.lastResult = this.parse(model.last_result_json, null);
  }

  selectByName(name: string): void {
    this.select(this.models.find(m => m.name === name) ?? null);
  }

  get template(): EngineTemplate | null {
    return this.templates.find(
      t => t.name === this.selected?.physics_ref) ?? null;
  }

  setPhysics(name: string): void {
    if (this.selected) this.selected.physics_ref = name;
  }

  /** Rod percolation samples (MC); dipolar chaining integrates (BD). */
  get isRodModel(): boolean {
    return (this.template?.parameterSchema ?? [])
      .some(e => e.key === 'aspectRatio');
  }

  /** The named DPD/hydrodynamics gap — visible with the reason. */
  get dpdGapNote(): string {
    const gaps = (this.capability as any)?.gaps;
    return gaps?.dpd ?? '';
  }

  /** Evidence-bearing warning, auto-shown in the validated-kinetics
   *  regime boundary (names the smoke result, per the engine notes). */
  get kineticsWarning(): string {
    if (this.isRodModel) return '';
    const vf = Number(this.system?.volumeFraction);
    if (!Number.isFinite(vf) || vf >= 0.1) return '';
    return `volumeFraction ${vf} is below ~0.1 — chaining is `
      + 'aggregation-kinetics-limited there (smoke evidence: vf 0.05 '
      + 'reached chainedFraction 0.19 after 8000 steps while '
      + 'fieldAlignment sat at 0.99). Raise steps, or read '
      + 'fieldAlignment (structure) separately from chainedFraction '
      + '(kinetics).';
  }

  get costLine(): string {
    if (this.isRodModel) {
      const rods = Number(this.system?.nRods);
      const trials = Number(this.sampling?.trials);
      const iters = Number(this.sampling?.iterations);
      if (![rods, trials, iters].every(Number.isFinite)) return '';
      return `estimated cost: trials × iterations × nRods² = `
        + `${trials} × ${iters} × ${rods}² pair checks (bisection — `
        + 'each iteration halves the vf interval)';
    }
    const n = Number(this.system?.nParticles);
    const steps = Number(this.integration?.steps);
    if (![n, steps].every(Number.isFinite)) return '';
    const seconds = n * n * steps / 3e6;
    const shown = seconds < 1 ? '<1 s'
      : seconds < 90 ? `~${Math.round(seconds)} s`
      : `~${(seconds / 60).toFixed(1)} min`;
    return `estimated cost: N² × steps = ${n}² × ${steps} → ${shown} `
      + 'at the smoke-validated rate (N=100, 6000 steps ≈ 20 s)';
  }

  // --- Lambda helper: compute the dipolar coupling from physical
  //     particle parameters, offered as an explicit apply knob. ---

  get helperLambda(): number | null {
    const d = this.helperDiameterNm * 1e-9;
    const ms = this.helperMsAPerM;
    const t = this.helperTemperatureK;
    if (!(d > 0) || !(ms > 0) || !(t > 0)) return null;
    const moment = ms * Math.PI * Math.pow(d, 3) / 6;
    return MU0_OVER_4PI * moment * moment / (Math.pow(d, 3)
      * K_BOLTZMANN * t);
  }

  applyHelperLambda(): void {
    const lambda = this.helperLambda;
    if (lambda === null) return;
    this.system.couplingLambda = Number(lambda.toFixed(2));
  }

  // --- Results ---

  get derivedThreshold(): number | null {
    const v = Number(this.lastResult?.percolationThreshold);
    return Number.isFinite(v) ? v : null;
  }

  get slenderLimit(): number | null {
    const v = Number(this.lastResult?.slenderRodLimit);
    return Number.isFinite(v) ? v : null;
  }

  /** Bar widths for the derived-vs-limit comparison (percent). */
  barWidth(value: number | null): number {
    const vals = [this.derivedThreshold, this.slenderLimit]
      .filter((v): v is number => v !== null);
    const max = Math.max(...vals, 1e-9);
    return value === null ? 0 : Math.max(2, 100 * value / max);
  }

  get chainedFraction(): number | null {
    const v = Number(this.lastResult?.chainedFraction);
    return Number.isFinite(v) ? v : null;
  }

  get fieldAlignment(): number | null {
    const v = Number(this.lastResult?.fieldAlignment);
    return Number.isFinite(v) ? v : null;
  }

  get chainsFormed(): boolean | null {
    const v = this.lastResult?.chainsFormed;
    return typeof v === 'boolean' ? v : null;
  }

  get declaredOutputs(): { key: string; unit?: string;
                           description?: string }[] {
    return this.template?.outputs ?? [];
  }

  // --- THE KNOB: bind the derived vf_c into a chosen L1 model ---

  /** What pressing the button will do — the evidence line. */
  get thresholdSuggestion(): string {
    const vfc = this.derivedThreshold;
    if (this.isRodModel && vfc === null) {
      return 'Run this study first — the binding would refuse honestly '
        + 'on an empty result.';
    }
    return `This study derived vf_c = ${vfc} (vs the 0.005 literature `
      + 'assumption the L1 models state). Binding writes an objectRef '
      + `to THIS row's live result into the chosen model — the `
      + 'original assumed-threshold model stays untouched; the '
      + 'comparison is the evidence.';
  }

  async bindThresholdToTarget(): Promise<void> {
    const target = this.femModels.find(
      m => m.name === this.thresholdTargetName);
    if (!target || !this.selected) return;
    const domain = this.parse(target.domain_json, {});
    domain.inclusion = domain.inclusion ?? {};
    domain.inclusion.percolationThreshold = {
      kind: 'objectRef',
      className: 'MesoModelDefinition',
      name: this.selected.name,
      path: 'last_result_json.percolationThreshold',
    };
    target.domain_json = JSON.stringify(domain);
    const ok = await this.service.saveModel(
      'FEMModelDefinition', target);
    this.bindOutcomeBad = !ok;
    this.bindOutcome = ok
      ? `bound: ${target.name}.percolationThreshold now reads this `
        + `study's LIVE result at every execution`
      : 'binding save failed';
  }

  async save(): Promise<boolean> {
    if (!this.selected) return false;
    this.selected.system_json = JSON.stringify(this.system);
    this.selected.sampling_json = JSON.stringify(this.sampling);
    this.selected.integration_json = JSON.stringify(this.integration);
    const ok = await this.service.saveModel(
      'MesoModelDefinition', this.selected);
    if (!ok) { this.outcome = 'save failed'; this.outcomeBad = true; }
    return ok;
  }

  async validate(): Promise<void> {
    if (!this.selected || !(await this.save())) return;
    this.busy = true;
    try {
      const verdict = await this.service.validate(this.selected.name);
      this.findings = verdict?.findings ?? [];
      this.outcomeBad = !verdict?.ok;
      this.outcome = verdict?.ok
        ? 'configuration valid'
        : 'configuration has errors (see findings)';
    } finally { this.busy = false; }
  }

  async run(): Promise<void> {
    if (!this.selected || !(await this.save())) return;
    this.busy = true;
    this.outcome = '';
    try {
      const report = await this.service.execute(this.selected.name);
      this.outcomeBad = !report?.ok;
      if (report?.ok) {
        this.lastResult = report.result;
        this.selected.last_result_json = JSON.stringify(report.result);
        this.selected.last_executed_at = report.executedAt ?? '';
        this.outcome = `simulated via ${report.engine}`;
      } else {
        this.outcome = report?.error ?? 'refused';
        this.findings = report?.findings ?? this.findings;
      }
    } finally { this.busy = false; }
  }

  resultEntries(): [string, unknown][] {
    return this.lastResult ? Object.entries(this.lastResult) : [];
  }

  private parse(blob: string | undefined, fallback: any): any {
    try { return JSON.parse(blob || '') ?? fallback; }
    catch { return fallback; }
  }
}
