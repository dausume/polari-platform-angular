import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { EngineModelService } from '@services/materials-science/engine-model.service';
import {
  EngineCapability, EngineModelRow, EngineTemplate,
} from '@models/materials-science/engine-model-types';
import {
  ModelBindingEditorComponent,
} from './model-binding-editor.component';
import { ModelRunBarComponent } from './model-run-bar.component';

/** Smoke-validated throughput: N=125, 3000 steps ran ~2 s on the
 *  staging backend (O(N^2) forces, no neighbor lists). */
const COST_UNITS_PER_SECOND = 2.4e7;

/**
 * The MD-SPECIFIC simulation configuration surface, sectioned the way
 * MD tools structure their decks (LAMMPS input / GROMACS .mdp / HOOMD
 * scripts): System → Interactions → Ensemble/Thermostat → Integration
 * → Outputs/Results. Reduced LJ units throughout — mapping to a real
 * material means choosing epsilon/sigma WITH provenance, so those
 * fields are optional and bindable, never silently assumed.
 * Force-field MD stays visible but disabled with the named gap.
 */
@Component({
  standalone: true,
  selector: 'md-model-config',
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule,
            MatTooltipModule, ModelBindingEditorComponent,
            ModelRunBarComponent],
  templateUrl: './md-model-config.component.html',
  styleUrls: ['./model-config.shared.scss', './md-meso-config.scss'],
})
export class MdModelConfigComponent implements OnInit {
  @Input() defaultModelRef = '';

  models: EngineModelRow[] = [];
  templates: EngineTemplate[] = [];
  selected: EngineModelRow | null = null;
  capability: EngineCapability | null = null;
  // Section working copies (parsed from the row's JSON blobs).
  system: any = {};
  thermodynamicState: any = {};
  integration: any = {};
  lastResult: any = null;
  findings: any[] = [];
  busy = false;
  outcome = '';
  outcomeBad = false;
  loading = true;

  constructor(private service: EngineModelService) {}

  async ngOnInit(): Promise<void> {
    try {
      const [models, templates, caps] = await Promise.all([
        this.service.models('MDModelDefinition'),
        this.service.templates(),
        this.service.capability(),
      ]);
      this.models = models;
      this.templates = templates.filter(t => t.engineKind === 'md');
      this.capability = caps['md'] ?? null;
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
    if (!model) return;
    this.system = this.parse(model.system_json, {});
    // Optional real-material mapping (recorded with the model, not
    // consumed by the reduced-units engine — provenance carrier).
    this.system.unitMapping = this.system.unitMapping ?? {};
    this.thermodynamicState = this.parse(
      model.thermodynamic_state_json, {});
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

  /** Bead-spring templates carry chainLength; LJ carries nParticles. */
  get isChainModel(): boolean {
    return (this.template?.parameterSchema ?? [])
      .some(e => e.key === 'chainLength');
  }

  get isNve(): boolean {
    return (this.integration?.thermostat ?? 'langevin') === 'none';
  }

  /** The named force-field gap — visible, disabled, with the reason. */
  get forceFieldGapNote(): string {
    const gap = (this.capability as any)?.forceFieldMD;
    return gap && !gap.available ? (gap.note ?? '') : '';
  }

  get densityAnnotation(): string {
    const rho = Number(this.thermodynamicState?.density);
    if (!Number.isFinite(rho)) return '';
    if (rho < 0.2) return 'gas-like';
    if (rho < 0.6) return 'expanded fluid';
    if (rho <= 1.0) return 'liquid / melt';
    return 'dense — near freezing';
  }

  /** Total interacting particles for the cost estimate. */
  get particleCount(): number {
    const n = this.isChainModel
      ? Number(this.system?.chainLength) * Number(this.system?.nChains)
      : Number(this.system?.nParticles);
    return Number.isFinite(n) ? n : 0;
  }

  /** O(N^2 x steps) — shown BEFORE run (resource-aware principle). */
  get costLine(): string {
    const n = this.particleCount;
    const steps = Number(this.integration?.steps);
    if (!n || !Number.isFinite(steps) || steps <= 0) return '';
    const units = n * n * steps;
    const seconds = units / COST_UNITS_PER_SECOND;
    const shown = seconds < 1 ? '<1 s'
      : seconds < 90 ? `~${Math.round(seconds)} s`
      : `~${(seconds / 60).toFixed(1)} min`;
    return `estimated cost: N² × steps = ${n}² × ${steps} → ${shown} `
      + 'at the smoke-validated rate (O(N²) forces, no neighbor lists)';
  }

  // --- Results honesty: measured vs target / literature references ---

  get targetTemperature(): number | null {
    const t = Number(this.thermodynamicState?.temperature);
    return Number.isFinite(t) ? t : null;
  }

  get measuredT(): number | null {
    const t = Number(this.lastResult?.measuredTemperature);
    return Number.isFinite(t) ? t : null;
  }

  /** Thermostat check: measured kinetic T* within 5% of target. */
  get thermostatVerdict(): { ok: boolean; text: string } | null {
    const target = this.targetTemperature, measured = this.measuredT;
    if (target === null || measured === null || this.isNve) return null;
    const dev = Math.abs(measured - target) / target;
    return {
      ok: dev <= 0.05,
      text: `measured T* ${measured.toFixed(3)} vs target `
        + `${target.toFixed(3)} (${(dev * 100).toFixed(1)}% off — `
        + `thermostat ${dev <= 0.05 ? 'holds' : 'DRIFTING'})`,
    };
  }

  get pressureLine(): string {
    const p = Number(this.lastResult?.pressure);
    const ideal = Number(this.lastResult?.idealGasPressure);
    if (!Number.isFinite(p)) return '';
    let line = `virial P* ${p.toFixed(4)}`;
    if (Number.isFinite(ideal) && ideal > 0) {
      line += ` vs ideal-gas ρ*T* ${ideal.toFixed(4)}`
        + ` (${p < ideal ? 'below — attractive regime'
                         : 'above — repulsion-dominated'})`;
    }
    return line;
  }

  /** KG literature bond length ~0.97σ — the reference line. */
  get bondVerdict(): { ok: boolean; text: string } | null {
    const bond = Number(this.lastResult?.meanBondLength);
    if (!Number.isFinite(bond)) return null;
    return {
      ok: bond >= 0.92 && bond <= 1.02,
      text: `mean FENE bond ${bond.toFixed(3)}σ vs Kremer-Grest `
        + 'literature ~0.97σ [prov: Kremer & Grest 1990]',
    };
  }

  get declaredOutputs(): { key: string; unit?: string;
                           description?: string }[] {
    return this.template?.outputs ?? [];
  }

  async save(): Promise<boolean> {
    if (!this.selected) return false;
    this.selected.system_json = JSON.stringify(this.system);
    this.selected.thermodynamic_state_json =
      JSON.stringify(this.thermodynamicState);
    this.selected.integration_json = JSON.stringify(this.integration);
    const ok = await this.service.saveModel(
      'MDModelDefinition', this.selected);
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
