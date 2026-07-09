import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';

import {
  AssignResult, DriftReport, ModuleAssignment, TopologyGraph,
  TopologyInstance, TopologyService, TopologySummary, ValidateReport,
} from '@services/topology/topology.service';
import {
  TopologyGraphViewComponent,
} from './topology-graph-view.component';

/** The banner shown after a drag-drop assignment lands as rows. */
interface AssignNotice {
  moduleName: string;
  toInstance: string;
  fromInstance: string;
  disabled: string[];
  edgesChanged: number;
  suggestedCommand: string;
}

/**
 * The Topology tab (/topology, top-5/6): the deployment topology as
 * the data it is — instances, machines, module assignments,
 * dependency edges, interconnect connections — read straight from
 * /api/topology. Drag a module chip between instance cards to
 * reassign it: the page writes ROWS only (POST /assign) and shows the
 * suggested pol command as text; deploying stays the human's move.
 * Validate and drift are diagnosis-only: every finding carries its
 * evidence, its knob, and its suggested action — nothing auto-applies.
 */
@Component({
  standalone: true,
  selector: 'topology-home',
  imports: [CommonModule, RouterModule, MatTooltipModule,
            DragDropModule, TopologyGraphViewComponent],
  templateUrl: './topology-home.component.html',
  styleUrls: ['./topology-home.component.scss'],
})
export class TopologyHomeComponent implements OnInit {
  summary: TopologySummary | null = null;
  graph: TopologyGraph | null = null;
  drift: DriftReport | null = null;
  validation: ValidateReport | null = null;

  activeTopology = '';
  loading = true;
  loadError = '';
  validating = false;
  assigning = false;
  showDrift = true;
  assignNotice: AssignNotice | null = null;
  assignError = '';
  expandedConnections = new Set<string>();

  /** Module chips per instance, precomputed so the CDK drop lists see
   *  stable arrays (a template method would rebuild them every CD). */
  modulesByInstance = new Map<string, ModuleAssignment[]>();
  edgeCounts = { resolved: 0, unresolved: 0, degraded: 0 };

  constructor(private topologyService: TopologyService) {}

  async ngOnInit(): Promise<void> {
    this.summary = await this.topologyService.summary();
    if (!this.summary?.ok) {
      this.loading = false;
      this.loadError = 'No topology answered — is the backend up? '
        + '(GET /api/topology/summary)';
      return;
    }
    await this.select(this.summary.activeTopology
      || this.summary.topologies[0]?.name || '');
  }

  async select(name: string): Promise<void> {
    this.activeTopology = name;
    this.loading = true;
    this.validation = null;
    this.assignNotice = null;
    this.assignError = '';
    [this.graph, this.drift] = await Promise.all([
      this.topologyService.graph(name),
      this.topologyService.drift(name),
    ]);
    this.rebuildModuleChips();
    this.loading = false;
    if (!this.graph?.ok) {
      this.loadError = this.graph?.error
        || `Topology '${name}' did not answer (GET /api/topology/graph)`;
    }
  }

  private rebuildModuleChips(): void {
    this.modulesByInstance = new Map();
    this.edgeCounts = { resolved: 0, unresolved: 0, degraded: 0 };
    if (!this.graph?.ok) { return; }
    for (const instance of this.graph.instances) {
      this.modulesByInstance.set(instance.name,
        this.graph.assignments.filter(
          a => a.instanceName === instance.name));
    }
    for (const edge of this.graph.edges) {
      if (edge.status in this.edgeCounts) {
        this.edgeCounts[edge.status] += 1;
      }
    }
  }

  modulesFor(instance: TopologyInstance): ModuleAssignment[] {
    return this.modulesByInstance.get(instance.name) ?? [];
  }

  async validate(): Promise<void> {
    this.validating = true;
    this.validation = await this.topologyService.validate(
      this.activeTopology || undefined);
    this.validating = false;
    // validatedAt just moved — refresh the header row.
    const fresh = await this.topologyService.graph(
      this.activeTopology || undefined);
    if (fresh?.ok) {
      this.graph = fresh;
      this.rebuildModuleChips();
    }
  }

  // ------------------------------------------------------------------
  // top-6: drag a module chip between instance cards → rows via API.
  // ------------------------------------------------------------------

  async onModuleDrop(event: CdkDragDrop<TopologyInstance>):
      Promise<void> {
    if (event.previousContainer === event.container) { return; }
    const assignment = event.item.data as ModuleAssignment;
    const from = event.previousContainer.data.name;
    const to = event.container.data.name;
    this.assigning = true;
    this.assignError = '';
    this.assignNotice = null;
    const result: AssignResult | null = await this.topologyService
      .assign(assignment.moduleName, to, from);
    if (result?.ok) {
      this.assignNotice = {
        moduleName: assignment.moduleName,
        toInstance: to,
        fromInstance: from,
        disabled: result.disabled ?? [],
        edgesChanged: result.resolve?.changed?.length ?? 0,
        suggestedCommand: result.suggestedCommand,
      };
    } else {
      this.assignError = result?.error
        || `Assign of ${assignment.moduleName} to ${to} did not land`
          + ' — rows unchanged.';
    }
    // Refetch either way: the rows are the truth, not the drag.
    const fresh = await this.topologyService.graph(
      this.activeTopology || undefined);
    if (fresh?.ok) {
      this.graph = fresh;
      this.rebuildModuleChips();
    }
    this.assigning = false;
  }

  toggleConnection(name: string): void {
    if (this.expandedConnections.has(name)) {
      this.expandedConnections.delete(name);
    } else {
      this.expandedConnections.add(name);
    }
  }

  machineTip(machineName: string): string {
    const machine = this.graph?.machines
      ?.find(m => m.name === machineName);
    if (!machine) { return ''; }
    const roles = Array.isArray(machine.roles)
      ? machine.roles.join(', ') : String(machine.roles ?? '');
    return `${machine.sshAlias} · ${machine.arch}`
      + ` · ${machine.memGb} GB`
      + (machine.swarmRole ? ` · swarm ${machine.swarmRole}` : '')
      + (roles ? ` · roles: ${roles}` : '');
  }
}
