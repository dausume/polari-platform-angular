import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { TopologyService } from '@services/topology/topology.service';
import {
  ModuleGraphReport, TopologyGraph, TopologyTestingReport,
} from '@models/topology/topology-types';
import {
  TopologyGraphViewComponent,
} from '@components/topology/topology-graph-view.component';

/**
 * The Testing tab (/testing, tt-11): testing WRAPPED AROUND the
 * topology, so the graph is the progress visualization — module
 * circles and hosts go red on failing tests / green when every
 * suite passes, and links go green on successful FOUNDATIONAL
 * integration pings (connectivity only, never functionality) with
 * the protocol and its security notated. Runs and pings execute
 * only when a human clicks them; every result row keeps its honest
 * receipt (parsed check tally, output tail, ping evidence).
 */
@Component({
  standalone: true,
  selector: 'testing-home',
  templateUrl: './testing-home.component.html',
  styleUrls: ['./testing-home.component.scss'],
  imports: [CommonModule, FormsModule, MatIconModule,
            MatTooltipModule, TopologyGraphViewComponent],
})
export class TestingHomeComponent implements OnInit {
  graph: TopologyGraph | null = null;
  moduleGraph: ModuleGraphReport | null = null;
  testing: TopologyTestingReport | null = null;

  loading = true;
  loadError = '';
  runningModule = '';
  pinging = false;
  selectedModule = 'all';
  expandedModules = new Set<string>();

  constructor(private topologyService: TopologyService) {}

  async ngOnInit(): Promise<void> {
    [this.graph, this.moduleGraph, this.testing] = await Promise.all([
      this.topologyService.graph(),
      this.topologyService.moduleGraph(),
      this.topologyService.testing(),
    ]);
    this.loading = false;
    if (!this.graph?.ok) {
      this.loadError = 'No topology answered — is the backend up? '
        + '(GET /api/topology/graph)';
    }
  }

  modulesWithSuites(): string[] {
    return (this.testing?.ok ? this.testing.modules : [])
      .filter(m => m.suites.length)
      .map(m => m.module);
  }

  async runTests(module: string): Promise<void> {
    this.runningModule = module;
    const result = await this.topologyService.runTests(module);
    if (result?.ok) { this.testing = result.report; }
    this.runningModule = '';
  }

  /** tt-15: a move executed inside the embedded graph — refresh
   *  everything this page derives from the rows. */
  async onMoved(): Promise<void> {
    [this.graph, this.moduleGraph, this.testing] = await Promise.all([
      this.topologyService.graph(),
      this.topologyService.moduleGraph(),
      this.topologyService.testing(),
    ]);
  }

  async runPings(): Promise<void> {
    this.pinging = true;
    const result = await this.topologyService.runPings();
    if (result?.ok) { this.testing = result.report; }
    this.pinging = false;
  }

  toggleModule(module: string): void {
    if (this.expandedModules.has(module)) {
      this.expandedModules.delete(module);
    } else {
      this.expandedModules.add(module);
    }
  }

  stateIcon(state: string): string {
    return state === 'pass' ? '✓'
      : state === 'fail' ? '✗'
      : state === 'never-run' ? '—' : '·';
  }

  counts(): { pass: number; fail: number; neverRun: number } {
    const modules = this.testing?.ok ? this.testing.modules : [];
    return {
      pass: modules.filter(m => m.state === 'pass').length,
      fail: modules.filter(m => m.state === 'fail').length,
      neverRun: modules.filter(m => m.state === 'never-run').length,
    };
  }
}
