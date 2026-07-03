import { Component, Input, OnChanges, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Subscription } from 'rxjs';

import { SimSpaceViewerComponent } from '@components/sim-space/sim-space-viewer/sim-space-viewer.component';
import { MsimPanelBusService } from '@services/multi-scale/msim-panel-bus.service';

/**
 * Display-embeddable 3D scene panel for the Multi-Scale Simulation page.
 *
 * Registered in the DISPLAY_COMPONENT_REGISTRY as `msim-scene-panel`, so
 * a custom Display layout can place live run-pinned viewers anywhere in
 * its nestable rows/columns. Per-item inputs carry the refs
 * (simSpaceRef + run: 'primary' | 'compare' | a literal run name); the
 * page's renderer context supplies msimName / primaryRun / comparisonRun
 * so 'primary'/'compare' resolve to whatever the page currently follows.
 */
@Component({
  standalone: true,
  selector: 'msim-scene-panel',
  imports: [CommonModule, MatIconModule, SimSpaceViewerComponent],
  template: `
    <div class="msim-scene-wrap">
      <div class="scene-title">
        <mat-icon>view_in_ar</mat-icon>
        <span>{{ title || simSpaceRef }}</span>
        <span class="scene-run" *ngIf="resolvedRun">
          {{ run === 'compare' ? 'scenario comparison: ' : 'run: ' }}{{ resolvedRun }}
        </span>
      </div>
      <div class="scene-frame">
        <sim-space-viewer *ngIf="simSpaceRef"
          [simSpaceName]="simSpaceRef"
          [run]="resolvedRun"
          [hideRunPanel]="true"
          [clickNavigates]="false">
        </sim-space-viewer>
      </div>
    </div>
  `,
  styles: [`
    .msim-scene-wrap { display: flex; flex-direction: column; height: 100%; min-height: 380px; }
    .scene-title {
      display: flex; align-items: center; gap: 8px; padding: 8px 12px;
      font-weight: 600; color: var(--text-primary, #263238);
      border-bottom: 1px solid var(--border-light, #e0e0e0);
      mat-icon { font-size: 20px; width: 20px; height: 20px; color: var(--brand-teal, #00897b); }
    }
    .scene-run {
      margin-left: auto; font-size: 12px; font-weight: 400;
      color: var(--text-secondary, #607d8b);
    }
    .scene-frame { flex: 1; min-height: 340px; position: relative; }
    sim-space-viewer { display: block; height: 100%; }
  `],
})
export class MsimScenePanelComponent implements OnInit, OnChanges, OnDestroy {
  /** Per-item inputs (stored in the Display definition). */
  @Input() simSpaceRef = '';
  @Input() run: string = 'primary';
  @Input() title = '';

  /** Context inputs (merged in by the dashboard renderer from the page). */
  @Input() msimName = '';
  @Input() primaryRun: string | null = null;
  @Input() comparisonRun: string | null = null;

  @ViewChild(SimSpaceViewerComponent) viewer?: SimSpaceViewerComponent;

  private sub?: Subscription;

  constructor(private bus: MsimPanelBusService) {}

  ngOnInit(): void {
    this.sub = this.bus.refresh$.subscribe(() => this.viewer?.refresh());
  }

  ngOnChanges(): void { /* inputs bind straight through to the viewer */ }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  get resolvedRun(): string | undefined {
    if (this.run === 'primary') return this.primaryRun ?? undefined;
    if (this.run === 'compare') return this.comparisonRun ?? undefined;
    return this.run || undefined;
  }
}
