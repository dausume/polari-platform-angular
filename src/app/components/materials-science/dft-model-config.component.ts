import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { EngineModelService } from '@services/materials-science/engine-model.service';
import {
  EngineModelRow, EngineTemplate,
} from '@models/materials-science/engine-model-types';
import {
  ModelBindingEditorComponent,
} from './model-binding-editor.component';
import { ModelRunBarComponent } from './model-run-bar.component';

/** Common quick-picks, the way DFT input builders offer presets. */
const BASIS_PRESETS = ['6-31g', '6-31g*', 'cc-pVDZ', 'cc-pVTZ', 'sto-3g'];
const XC_PRESETS = ['b3lyp', 'pbe', 'pbe0', 'blyp', 'm06'];

/**
 * The DFT-SPECIFIC simulation configuration surface, sectioned the way
 * DFT tools structure their inputs (Quantum ESPRESSO namelists / ASE
 * calculators / pymatgen input sets): Calculation type → Structure →
 * Method (basis, XC, charge/spin, pseudopotentials) → Accuracy
 * (cutoff, k-points) → Results. Sections a calculation type does not
 * consume say so instead of silently ignoring input.
 */
@Component({
  standalone: true,
  selector: 'dft-model-config',
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule,
            MatTooltipModule, ModelBindingEditorComponent,
            ModelRunBarComponent],
  templateUrl: './dft-model-config.component.html',
  styleUrls: ['./model-config.shared.scss'],
})
export class DftModelConfigComponent implements OnInit {
  @Input() defaultModelRef = '';

  readonly basisPresets = BASIS_PRESETS;
  readonly xcPresets = XC_PRESETS;

  models: EngineModelRow[] = [];
  templates: EngineTemplate[] = [];
  selected: EngineModelRow | null = null;
  structure: any = {};
  method: any = {};
  accuracy: any = {};
  lastResult: any = null;
  findings: any[] = [];
  busy = false;
  outcome = '';
  outcomeBad = false;
  loading = true;

  constructor(private service: EngineModelService) {}

  async ngOnInit(): Promise<void> {
    try {
      const [models, templates] = await Promise.all([
        this.service.models('DFTModelDefinition'),
        this.service.templates(),
      ]);
      this.models = models;
      this.templates = templates.filter(t => t.engineKind === 'dft');
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
    this.structure = this.parse(model.structure_json, {});
    this.method = this.parse(model.method_json, {});
    this.accuracy = this.parse(model.accuracy_json, {});
    this.lastResult = this.parse(model.last_result_json, null);
  }

  selectByName(name: string): void {
    this.select(this.models.find(m => m.name === name) ?? null);
  }

  get template(): EngineTemplate | null {
    return this.templates.find(
      t => t.name === this.selected?.calculation_ref) ?? null;
  }

  /** Which sections the chosen calculation actually consumes. */
  get usesAccuracy(): boolean {
    return this.selected?.calculation_ref === 'dft-total-energy';
  }

  get usesMolecularMethod(): boolean {
    return this.selected?.calculation_ref === 'dft-molecular-energy';
  }

  get isBulk(): boolean {
    return (this.structure?.kind ?? 'molecule') === 'bulk';
  }

  setCalculation(name: string): void {
    if (this.selected) this.selected.calculation_ref = name;
  }

  kptsText(): string {
    return (this.accuracy?.kpts ?? [3, 3, 3]).join(' × ');
  }

  setKpt(index: number, value: number): void {
    const kpts = [...(this.accuracy.kpts ?? [3, 3, 3])];
    kpts[index] = Math.max(1, Math.floor(value || 1));
    this.accuracy.kpts = kpts;
  }

  async save(): Promise<boolean> {
    if (!this.selected) return false;
    this.selected.structure_json = JSON.stringify(this.structure);
    this.selected.method_json = JSON.stringify(this.method);
    this.selected.accuracy_json = JSON.stringify(this.accuracy);
    const ok = await this.service.saveModel(
      'DFTModelDefinition', this.selected);
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
        this.outcome = `computed via ${report.engine}`
          + (report.result?.engine ? ` (${report.result.engine})` : '');
      } else {
        this.outcome = report?.error ?? 'refused';
        this.findings = report?.findings ?? this.findings;
      }
    } finally { this.busy = false; }
  }

  /** Energy shown in both communities' units. */
  get energyLine(): string {
    const ha = this.lastResult?.totalEnergyHa;
    if (typeof ha === 'number') {
      return `${ha.toFixed(6)} Ha = ${(ha * 27.211386).toFixed(4)} eV`;
    }
    const ev = this.lastResult?.totalEnergyEv;
    if (typeof ev === 'number') return `${ev.toFixed(4)} eV`;
    return '';
  }

  resultEntries(): [string, unknown][] {
    return this.lastResult ? Object.entries(this.lastResult) : [];
  }

  private parse(blob: string | undefined, fallback: any): any {
    try { return JSON.parse(blob || '') ?? fallback; }
    catch { return fallback; }
  }
}
