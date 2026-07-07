import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import {
  FormulationRun,
  FormulationSearchService,
} from '@services/materials-science/formulation-search.service';
import {
  FormulationRunControlsComponent,
} from '@components/materials-science/formulation-run-controls.component';
import {
  FormulationTrajectoryGraphComponent,
} from '@components/materials-science/formulation-trajectory-graph.component';
import {
  FormulationWinnersTableComponent,
} from '@components/materials-science/formulation-winners-table.component';

/**
 * The msim page's `formulationSearch` panel — a thin host embedding the
 * SAME run-controls / trajectory / winners components the standalone
 * formulation-search page uses (one object, every surface). The stage
 * chip's Search-for-a-solution UI drives the same runs; this panel is
 * the full-detail view beneath it.
 */
@Component({
  standalone: true,
  selector: 'msim-formulation-search-panel',
  imports: [CommonModule, FormulationRunControlsComponent,
            FormulationTrajectoryGraphComponent,
            FormulationWinnersTableComponent],
  template: `
    <div class="formulation-panel">
      <formulation-run-controls [searchRef]="searchRef"
                                (runCompleted)="refresh()">
      </formulation-run-controls>
      <ng-container *ngIf="latestRun as run">
        <formulation-trajectory-graph [trajectory]="run.trajectory">
        </formulation-trajectory-graph>
        <formulation-winners-table [run]="run">
        </formulation-winners-table>
      </ng-container>
      <p class="no-runs" *ngIf="!latestRun">
        No runs yet — run the search (here or from the stage chip
        above); every run persists with its trajectory, gaps, and
        fidelity trail.
      </p>
    </div>
  `,
  styles: [`
    .formulation-panel { display: flex; flex-direction: column; gap: 10px;
                         padding: 10px 12px; }
    .no-runs { font-size: 12px; color: var(--text-secondary, #777); }
  `],
})
export class MsimFormulationSearchPanelComponent implements OnInit {
  @Input({ required: true }) searchRef!: string;

  runs: FormulationRun[] = [];

  constructor(private searchService: FormulationSearchService) {}

  ngOnInit(): void {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    try {
      const runs = await this.searchService.runs(this.searchRef);
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
