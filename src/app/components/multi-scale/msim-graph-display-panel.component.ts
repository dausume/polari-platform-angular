import { Component, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

import { MsimGraphPanelComponent } from './msim-graph-panel.component';
import { MsimPanel } from '@models/multi-scale/NamedMultiScaleSimConfig';
import { MsimPanelBusService } from '@services/multi-scale/msim-panel-bus.service';

/**
 * Display-embeddable wrapper for the live graph panel (`msim-graph-panel`
 * expects an MsimPanel object; Display item inputs must be plain JSON —
 * this wrapper builds the panel object from flat refs).
 * Registered as `msim-graph-panel` in the DISPLAY_COMPONENT_REGISTRY.
 */
@Component({
  standalone: true,
  selector: 'msim-graph-display-panel',
  imports: [CommonModule, MsimGraphPanelComponent],
  template: `
    <msim-graph-panel *ngIf="panelObj"
      [panel]="panelObj"
      [primaryRun]="primaryRun"
      [compareRun]="comparisonRun"
      [running]="running">
    </msim-graph-panel>
  `,
})
export class MsimGraphDisplayPanelComponent implements OnInit, OnDestroy {
  /** Per-item inputs (stored in the Display definition). */
  @Input() graphRef = '';
  @Input() sourceClass = '';
  /** Which runs to chart: entries are 'primary' | 'compare'. */
  @Input() runs: string[] | string = ['primary'];

  /** Context inputs (merged in by the dashboard renderer). */
  @Input() msimName = '';
  @Input() primaryRun: string | null = null;
  @Input() comparisonRun: string | null = null;
  @Input() running = false;

  @ViewChild(MsimGraphPanelComponent) inner?: MsimGraphPanelComponent;

  private sub?: Subscription;

  constructor(private bus: MsimPanelBusService) {}

  ngOnInit(): void {
    this.sub = this.bus.refresh$.subscribe(() => this.inner?.refresh());
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  get panelObj(): MsimPanel | null {
    if (!this.graphRef) return null;
    const runs = Array.isArray(this.runs)
      ? this.runs
      : String(this.runs || 'primary').split(',').map(s => s.trim()).filter(Boolean);
    return {
      kind: 'graph',
      graphRef: this.graphRef,
      sourceClass: this.sourceClass,
      runs: runs.length ? runs : ['primary'],
    } as MsimPanel;
  }
}
