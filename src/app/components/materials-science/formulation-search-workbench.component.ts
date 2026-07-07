import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import {
  FormulationRun,
  FormulationSearchDef,
  FormulationSearchService,
} from '@services/materials-science/formulation-search.service';
import { FormulationKnobsFormComponent } from './formulation-knobs-form.component';
import { FormulationRunControlsComponent } from './formulation-run-controls.component';
import { FormulationTrajectoryGraphComponent } from './formulation-trajectory-graph.component';
import { FormulationWinnersTableComponent } from './formulation-winners-table.component';

/**
 * The formulation-search workbench page host: pick a
 * FormulationSearchDefinition, edit its knobs, run/continue, watch the
 * refinement trajectory, inspect winners with fidelity badges, and
 * promote explicitly. A thin layout — the four child components carry
 * the behavior and are the SAME components the msim page's
 * formulationSearch panel embeds (one object, every surface).
 */
@Component({
  standalone: true,
  selector: 'formulation-search-workbench',
  imports: [CommonModule, FormsModule, MatIconModule,
            FormulationKnobsFormComponent,
            FormulationRunControlsComponent,
            FormulationTrajectoryGraphComponent,
            FormulationWinnersTableComponent],
  templateUrl: './formulation-search-workbench.component.html',
  styleUrls: ['./formulation-search-workbench.component.scss'],
})
export class FormulationSearchWorkbenchComponent implements OnInit {
  /** The definition selected on load (Display seed input). */
  @Input() defaultSearchRef = '';

  definitions: FormulationSearchDef[] = [];
  selected: FormulationSearchDef | null = null;
  runs: FormulationRun[] = [];
  loading = true;
  errorMessage = '';
  knobsOpen = false;

  constructor(private searchService: FormulationSearchService) {}

  async ngOnInit(): Promise<void> {
    try {
      this.definitions = await this.searchService.definitions();
      this.selected = this.definitions.find(
        d => d.name === this.defaultSearchRef)
        ?? this.definitions[0] ?? null;
      if (this.selected) await this.refreshRuns();
    } catch (err: any) {
      this.errorMessage = err?.message || String(err);
    } finally {
      this.loading = false;
    }
  }

  async select(name: string): Promise<void> {
    this.selected = this.definitions.find(d => d.name === name) ?? null;
    this.runs = [];
    if (this.selected) await this.refreshRuns();
  }

  async refreshRuns(): Promise<void> {
    if (!this.selected) return;
    try {
      const runs = await this.searchService.runs(this.selected.name);
      // Newest first (run names carry an increasing counter).
      this.runs = runs.sort((a, b) => b.name.localeCompare(
        a.name, undefined, { numeric: true }));
    } catch {
      this.runs = [];
    }
  }

  get latestRun(): FormulationRun | null {
    return this.runs[0] ?? null;
  }
}
