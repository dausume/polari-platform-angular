import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  EngineModelRow, EngineModelService, EngineTemplate,
} from '@services/materials-science/engine-model.service';
import {
  BindingValue, ModelBindingEditorComponent,
} from './model-binding-editor.component';
import { ModelRunBarComponent } from './model-run-bar.component';

/**
 * The FEM-SPECIFIC simulation configuration surface, sectioned the way
 * FEM tools structure a problem (COMSOL / FreeCAD-FEM / SfePy):
 * Physics → Domain & Geometry → Materials (per region, BINDABLE) →
 * Boundary Conditions → Source terms → Mesh → Solver → Results.
 * Unsupported choices stay visible but marked — honesty over polish.
 */
@Component({
  standalone: true,
  selector: 'fem-model-config',
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule,
            MatTooltipModule, ModelBindingEditorComponent,
            ModelRunBarComponent],
  templateUrl: './fem-model-config.component.html',
  styleUrls: ['./model-config.shared.scss'],
})
export class FemModelConfigComponent implements OnInit {
  @Input() defaultModelRef = '';

  models: EngineModelRow[] = [];
  templates: EngineTemplate[] = [];
  selected: EngineModelRow | null = null;
  // Section working copies (parsed from the row's JSON blobs).
  domain: any = {};
  materials: Record<string, Record<string, BindingValue>> = {};
  boundaryConditions: any[] = [];
  sourceTerms: Record<string, BindingValue> = {};
  mesh: any = {};
  solver: any = {};
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
        this.service.models('FEMModelDefinition'),
        this.service.templates(),
      ]);
      this.models = models;
      this.templates = templates.filter(t => t.engineKind === 'fem');
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
    this.domain = this.parse(model.domain_json, {});
    this.materials = this.parse(model.materials_json, {});
    this.boundaryConditions = this.parse(
      model.boundary_conditions_json, []);
    this.sourceTerms = this.parse(model.source_terms_json, {});
    this.mesh = this.parse(model.mesh_json, {});
    this.solver = this.parse(model.solver_json, {});
    this.lastResult = this.parse(model.last_result_json, null);
  }

  selectByName(name: string): void {
    this.select(this.models.find(m => m.name === name) ?? null);
  }

  get template(): EngineTemplate | null {
    return this.templates.find(
      t => t.name === this.selected?.physics_ref) ?? null;
  }

  get regionNames(): string[] {
    return Object.keys(this.materials);
  }

  regionProps(region: string): string[] {
    return Object.keys(this.materials[region] ?? {});
  }

  get sourceTermKeys(): string[] {
    return Object.keys(this.sourceTerms);
  }

  /** Outputs the template declares — the honest Results legend. */
  get declaredOutputs(): { key: string; unit?: string;
                           description?: string }[] {
    return this.template?.outputs ?? [];
  }

  setPhysics(name: string): void {
    if (this.selected) this.selected.physics_ref = name;
  }

  async save(): Promise<boolean> {
    if (!this.selected) return false;
    this.selected.domain_json = JSON.stringify(this.domain);
    this.selected.materials_json = JSON.stringify(this.materials);
    this.selected.boundary_conditions_json =
      JSON.stringify(this.boundaryConditions);
    this.selected.source_terms_json = JSON.stringify(this.sourceTerms);
    this.selected.mesh_json = JSON.stringify(this.mesh);
    this.selected.solver_json = JSON.stringify(this.solver);
    const ok = await this.service.saveModel(
      'FEMModelDefinition', this.selected);
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
        this.outcome = `solved via ${report.engine}`;
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
