/**
 * @cross-cutting
 * @tags @xc:render-shared
 * @consumers
 *   - xr-panel-host (2026-07-12: the new NO-CODE ring-1 panel — "show
 *     the user what no-code exists for the simulation, and the
 *     descriptions for them")
 * @impact-on-edit
 *   Read-only by design — no Edit/Remove/Add. Those actions either
 *   mutate state or route to /custom-no-code, which the XR plan
 *   explicitly forbids doing in-session (class-main-page must never
 *   route-nav in-session). If a future in-session edit flow is built,
 *   it belongs in a NEW component, not bolted onto this one.
 *
 * Self-contained summary of every *SimState class's wired
 * SimulationExecutionSolution rows for a simulation: which no-code
 * solution is attached, its description, and its detected role
 * (Complete / Partial / Composition). Fetches its own data (like
 * sim-space-legend) rather than depending on a sibling component's
 * template-ref, so it mounts standalone anywhere.
 */

import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SimulationRunService } from '@services/sim-space/simulation-run.service';
import {
  SimulationExecutionSolutionEntry,
  SimStepRoleHint,
} from '@models/sim-space/sim-space-types';

@Component({
  standalone: true,
  selector: 'sim-space-solutions-summary',
  imports: [CommonModule],
  template: `
    <div class="solutions-summary">
      <ng-container *ngIf="simulationDefinitionName; else noSim">
        <p class="muted small" *ngIf="loading">Loading…</p>
        <ng-container *ngIf="!loading">
          <div *ngFor="let cls of classNames" class="class-group">
            <div class="class-header">
              <span class="class-name mono">{{ cls }}</span>
              <span class="class-count muted small">
                {{ bindingsFor(cls).length }}
                solution{{ bindingsFor(cls).length === 1 ? '' : 's' }}
              </span>
            </div>
            <ul class="solution-list">
              <li *ngFor="let entry of bindingsFor(cls)" class="solution-row">
                <div class="solution-row-top">
                  <span class="order-pill"
                    [title]="'order ' + entry.orderIndex">
                    {{ entry.orderIndex }}
                  </span>
                  <code class="solution-name" *ngIf="entry.solutionDefinitionRef">
                    {{ entry.solutionDefinitionRef }}
                  </code>
                  <em class="muted small" *ngIf="!entry.solutionDefinitionRef">
                    (no solution wired)
                  </em>
                  <span class="role-pill" *ngIf="roleLabel(entry.simStepRole)"
                    [ngClass]="roleClass(entry.simStepRole)">
                    {{ roleLabel(entry.simStepRole) }}
                  </span>
                  <span class="status-badge" [class.status-disabled]="!entry.enabled">
                    {{ entry.enabled ? 'wired' : 'disabled' }}
                  </span>
                </div>
                <p class="solution-desc" *ngIf="entry.description">
                  {{ entry.description }}
                </p>
                <div class="solution-row-meta" *ngIf="entry.dependsOn?.length">
                  depends on: <code class="muted small">{{ entry.dependsOn.join(', ') }}</code>
                </div>
              </li>
              <li *ngIf="bindingsFor(cls).length === 0" class="empty-row muted small">
                No solutions wired for this class yet.
              </li>
            </ul>
          </div>
          <p class="muted small" *ngIf="classNames.length === 0">
            No *SimState classes participate in this simulation yet.
          </p>
        </ng-container>
      </ng-container>
      <ng-template #noSim>
        <p class="muted small">
          This scene isn't bound to a SimulationDefinition.
        </p>
      </ng-template>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .class-group { margin-bottom: 14px; }
    .class-header { display: flex; align-items: center; gap: 8px;
      padding: 4px 0; border-bottom: 1px solid #e0e0e0; margin-bottom: 6px; }
    .class-name { font-weight: 700; color: #1e2a45; flex: 1;
      font-size: 0.95rem; }
    .class-count { white-space: nowrap; }
    .solution-list { list-style: none; padding: 0; margin: 0;
      display: flex; flex-direction: column; gap: 8px; }
    .solution-row { background: #fff; border: 1px solid #e0e0e0;
      border-radius: 6px; padding: 8px 10px; }
    .solution-row-top { display: flex; align-items: center; gap: 6px;
      flex-wrap: wrap; }
    .order-pill { font-size: 0.68rem; font-weight: 700;
      background: #1958a8; color: #fff; padding: 1px 6px;
      border-radius: 3px; font-family: monospace; }
    .solution-name { font-size: 0.78rem; background: #f4f6fa;
      color: #1958a8; padding: 1px 6px; border-radius: 3px;
      word-break: break-all; }
    .role-pill { font-size: 0.62rem; font-weight: 700;
      letter-spacing: 0.04em; text-transform: uppercase;
      padding: 1px 6px; border-radius: 3px; }
    .role-complete    { background: #d8e7ff; color: #1958a8; }
    .role-partial     { background: #ffe1cc; color: #a8501c; }
    .role-composition { background: #d4ecd5; color: #2c6b30; }
    .status-badge { font-size: 0.62rem; letter-spacing: 0.06em;
      text-transform: uppercase; padding: 1px 6px; border-radius: 3px;
      font-weight: 700; background: #d6eedb; color: #1f6b27;
      margin-left: auto; }
    .status-badge.status-disabled { background: #e3e3e3; color: #555; }
    .solution-desc { margin: 6px 0 0; font-size: 0.82rem;
      color: #333; line-height: 1.4; }
    .solution-row-meta { margin-top: 4px; font-size: 0.72rem;
      color: #666; }
    .empty-row { padding: 6px 0; font-style: italic; }
    .muted { color: #777; }
    .small { font-size: 0.8rem; }
    .mono { font-family: monospace; }
  `],
})
export class SimSpaceSolutionsSummaryComponent implements OnChanges {
  @Input() simulationDefinitionName: string | null = null;

  solutions: SimulationExecutionSolutionEntry[] = [];
  simStateClasses: string[] = [];
  loading = false;

  constructor(private runService: SimulationRunService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['simulationDefinitionName']) this.reload();
  }

  get classNames(): string[] {
    const set = new Set<string>(this.simStateClasses);
    for (const b of this.solutions) {
      if (b.simStateClassName) set.add(b.simStateClassName);
    }
    return [...set].sort();
  }

  bindingsFor(simStateClass: string): SimulationExecutionSolutionEntry[] {
    return this.solutions
      .filter(b => b.simStateClassName === simStateClass)
      .sort((a, b) => (a.orderIndex - b.orderIndex)
        || a.name.localeCompare(b.name));
  }

  roleLabel(role: SimStepRoleHint): string {
    switch (role) {
      case 'simStepComplete':    return 'Complete';
      case 'simStepPartial':     return 'Partial';
      case 'simStepComposition': return 'Composition';
      default: return '';
    }
  }

  roleClass(role: SimStepRoleHint): string {
    switch (role) {
      case 'simStepComplete':    return 'role-complete';
      case 'simStepPartial':     return 'role-partial';
      case 'simStepComposition': return 'role-composition';
      default: return '';
    }
  }

  private async reload(): Promise<void> {
    if (!this.simulationDefinitionName) {
      this.solutions = [];
      this.simStateClasses = [];
      return;
    }
    this.loading = true;
    try {
      const resp = await this.runService.solutionsFor(
        this.simulationDefinitionName);
      this.solutions = resp.solutions;
      this.simStateClasses = resp.simStateClasses;
    } catch {
      this.solutions = [];
      this.simStateClasses = [];
    } finally {
      this.loading = false;
    }
  }
}
