import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

import { MultiScaleSimDefinitionService } from '@services/multi-scale/multi-scale-sim-definition.service';
import { MultiScaleSimSummary } from '@models/multi-scale/NamedMultiScaleSimConfig';

interface MsimGroup {
  primarySim: string;
  configs: MultiScaleSimSummary[];
}

/**
 * /multi-scale-sims — list page for MultiScaleSimulationDefinitions.
 * Same accordion-of-cards skeleton as the Graphs/Datasets pages
 * (styles from _config-page-common.scss), grouped by the primary
 * (user-driven) simulation.
 */
@Component({
  standalone: true,
  selector: 'multi-scale-sims',
  imports: [
    CommonModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatTooltipModule,
  ],
  templateUrl: './multi-scale-sims.component.html',
  styleUrls: ['./multi-scale-sims.component.scss'],
})
export class MultiScaleSimsComponent implements OnInit, OnDestroy {
  allConfigs: MultiScaleSimSummary[] = [];
  loading = false;
  expandedGroups: Set<string> = new Set();

  private subscriptions: Subscription[] = [];

  constructor(
    private msimService: MultiScaleSimDefinitionService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.subscriptions.push(
      this.msimService.allConfigList$.subscribe(configs => {
        this.allConfigs = configs;
        // Single group → start expanded (the common case today).
        if (configs.length && this.expandedGroups.size === 0) {
          this.expandedGroups.add(configs[0].primary_simulation_ref || 'Unassigned');
        }
      }),
      this.msimService.loading$.subscribe(loading => { this.loading = loading; }),
    );
    this.msimService.fetchAllConfigs();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  get configsByPrimarySim(): MsimGroup[] {
    const map = new Map<string, MultiScaleSimSummary[]>();
    for (const c of this.allConfigs) {
      const key = c.primary_simulation_ref || 'Unassigned';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([primarySim, configs]) => ({ primarySim, configs }));
  }

  toggleExpand(key: string): void {
    if (this.expandedGroups.has(key)) this.expandedGroups.delete(key);
    else this.expandedGroups.add(key);
  }

  isExpanded(key: string): boolean {
    return this.expandedGroups.has(key);
  }

  openPage(config: MultiScaleSimSummary, event: Event): void {
    event.stopPropagation();
    this.router.navigate(['/multi-scale-sim', config.name]);
  }

  refresh(): void {
    this.msimService.fetchAllConfigs();
  }
}
