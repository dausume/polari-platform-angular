import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  FormulationSearchDef,
  FormulationSearchService,
} from '@services/materials-science/formulation-search.service';

/**
 * Every FormulationSearchDefinition knob as an explicit control
 * ([[knobs-and-suggestions]]): target profile, base material +
 * manually-entered base properties, mode, loading/caps/batch knobs,
 * thermal process gate, sourcing policy (with the fossil-benchmark
 * opt-in explained), staged-fidelity ladder JSON, and the
 * results-kept-top-N realism knob. Saves through standard CRUDE.
 */
@Component({
  standalone: true,
  selector: 'formulation-knobs-form',
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule,
            MatTooltipModule],
  templateUrl: './formulation-knobs-form.component.html',
  styleUrls: ['./formulation-knobs-form.component.scss'],
})
export class FormulationKnobsFormComponent implements OnChanges {
  @Input({ required: true }) definition!: FormulationSearchDef;
  @Output() saved = new EventEmitter<void>();

  /** Editable working copy (the row itself stays untouched until Save). */
  draft!: FormulationSearchDef;
  basePropertiesText = '';
  knobsText = '';
  fidelityText = '';
  jsonError = '';
  saving = false;
  saveResult = '';

  constructor(private searchService: FormulationSearchService) {}

  ngOnChanges(): void {
    this.draft = { ...this.definition };
    this.basePropertiesText = this.pretty(this.draft.base_properties_json);
    this.knobsText = this.pretty(this.draft.knobs_json);
    this.fidelityText = this.pretty(this.draft.fidelity_stages_json);
    this.jsonError = '';
    this.saveResult = '';
  }

  private pretty(blob: string): string {
    try { return JSON.stringify(JSON.parse(blob || '{}'), null, 2); }
    catch { return blob || '{}'; }
  }

  async save(): Promise<void> {
    this.jsonError = '';
    try {
      this.draft.base_properties_json =
        JSON.stringify(JSON.parse(this.basePropertiesText || '{}'));
      this.draft.knobs_json =
        JSON.stringify(JSON.parse(this.knobsText || '{}'));
      this.draft.fidelity_stages_json =
        JSON.stringify(JSON.parse(this.fidelityText || '{}'));
    } catch (err: any) {
      this.jsonError = `JSON error: ${err?.message || err}`;
      return;
    }
    this.saving = true;
    const ok = await this.searchService.saveDefinition(this.draft);
    this.saving = false;
    this.saveResult = ok ? 'Saved.' : 'Save failed — see console/network.';
    if (ok) {
      Object.assign(this.definition, this.draft);
      this.saved.emit();
    }
  }
}
