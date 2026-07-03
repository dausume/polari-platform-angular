import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { Display } from '@models/dashboards/Display';
import { DisplayRow } from '@models/dashboards/DisplayRow';
import { DisplayItem } from '@models/dashboards/DisplayItem';
import { DisplayManagerService } from '@services/dashboard/display-manager.service';
import { MsimAuthoringService } from './msim-authoring.service';
import {
  NamedMultiScaleSimConfig,
  MsimPanel,
} from '@models/multi-scale/NamedMultiScaleSimConfig';

/**
 * Custom layouts for the Multi-Scale Simulation page, built on the
 * EXISTING Display grid system (nestable rows/columns, dashboard-
 * renderer edit mode) instead of the flat panels_json ordering.
 *
 * "Convert to custom layout" generates a real Display from the current
 * panels (IC pickers on top per the always-visible-inputs rule, scenes
 * side by side, graphs below), saves it as `msim-layout-<name>`, and
 * points the composition's display_ref at it. From then on the page
 * renders the Display — and edits happen live, in place, while the
 * components are running.
 */
@Injectable({ providedIn: 'root' })
export class MsimLayoutService {

  constructor(
    private displays: DisplayManagerService,
    private authoring: MsimAuthoringService,
  ) {}

  layoutName(config: NamedMultiScaleSimConfig): string {
    return `msim-layout-${config.name}`;
  }

  /** Generate the Display rows equivalent to the default panel grid. */
  buildRows(config: NamedMultiScaleSimConfig, hasComparison: boolean): DisplayRow[] {
    const rows: DisplayRow[] = [];
    const panels = config.panels ?? [];
    let rowIndex = 0;

    // Row 1 — IC/material pickers, full width, on top (inputs stay
    // reachable; the run bar above is sticky and page-owned).
    const icPanels = panels.filter(p => p.kind === 'ic' && p.icInterfaceRef);
    if (icPanels.length) {
      const row = new DisplayRow(rowIndex++, 12, 140);
      row.autoHeight = true;
      const span = Math.max(4, Math.floor(12 / icPanels.length));
      icPanels.forEach(p => row.addItem(
        DisplayItem.createComponentItem('msim-ic-panel',
          { icInterfaceRef: p.icInterfaceRef }, span)
          .setTitle(p.icInterfaceRef || 'Initial conditions')));
      rows.push(row);
    }

    // Row 2 — 3D scenes side by side (+ the scenario-comparison viewer
    // when the composition declares comparison runs).
    const scenePanels = panels.filter(p => p.kind === 'scene' && p.simSpaceRef);
    if (scenePanels.length) {
      const row = new DisplayRow(rowIndex++, 12, 460);
      const sceneCount = scenePanels.length + (hasComparison ? 1 : 0);
      const span = sceneCount > 1 ? 6 : 12;
      scenePanels.forEach(p => row.addItem(
        DisplayItem.createComponentItem('msim-scene-panel',
          { simSpaceRef: p.simSpaceRef, run: p.run || 'primary' }, span)
          .setTitle(p.simSpaceRef || '3D scene')));
      if (hasComparison && scenePanels[0]) {
        row.addItem(DisplayItem.createComponentItem('msim-scene-panel',
          { simSpaceRef: scenePanels[0].simSpaceRef, run: 'compare',
            title: `${scenePanels[0].simSpaceRef} (scenario comparison)` }, span));
      }
      rows.push(row);
    }

    // Row 3 — live graphs.
    const graphPanels = panels.filter(p => p.kind === 'graph' && p.graphRef);
    if (graphPanels.length) {
      const row = new DisplayRow(rowIndex++, 12, 340);
      const span = graphPanels.length > 1 ? 6 : 12;
      graphPanels.forEach(p => row.addItem(
        DisplayItem.createComponentItem('msim-graph-panel',
          { graphRef: p.graphRef, sourceClass: p.sourceClass || '',
            runs: p.runs || ['primary'] }, span)
          .setTitle(p.graphRef || 'Graph')));
      rows.push(row);
    }

    return rows;
  }

  /**
   * Create (or reuse) the composition's layout Display from its current
   * panels, point display_ref at it, and return the Display id.
   */
  async convertToCustomLayout(
    config: NamedMultiScaleSimConfig,
    hasComparison: boolean,
  ): Promise<string> {
    const name = this.layoutName(config);
    const created = await firstValueFrom(this.displays.createDisplay(
      name,
      `Custom layout for the "${config.name}" multi-scale simulation — `
      + 'edit it live on the simulation page.',
      'MultiScaleSimulationDefinition',
    ));
    const id = String(created?.id ?? '');
    if (!id) throw new Error('Display creation returned no id');

    const display = new Display(id, name,
      `Custom layout for "${config.name}"`);
    this.buildRows(config, hasComparison).forEach(r => display.addRow(r));
    await firstValueFrom(this.displays.saveDisplay(display));

    config.displayRef = id;
    await this.authoring.saveMsim(config);
    return id;
  }

  /** Load the composition's custom layout Display. */
  loadLayout(displayId: string) {
    return this.displays.loadDisplay(displayId);
  }

  /** Persist edits made to the layout Display. */
  saveLayout(display: Display) {
    return this.displays.saveDisplay(display);
  }

  /** Back to the default panel grid (the Display row is kept around —
   *  converting again reuses a fresh one; nothing is destroyed). */
  async revertToDefault(config: NamedMultiScaleSimConfig): Promise<void> {
    config.displayRef = '';
    await this.authoring.saveMsim(config);
  }

  /** Build a component item pinned to a grid position — same semantics
   *  as the class-main-page Display editor's cell placement. */
  buildItem(
    startSegment: number,
    spanSegments: number,
    componentName: string,
    inputs: Record<string, any>,
    title?: string,
  ): DisplayItem {
    const item = DisplayItem.createComponentItem(componentName, inputs, spanSegments);
    if (title) item.setTitle(title);
    item.gridColumnStart = startSegment;
    return item;
  }

  /** Insert a panel item into a selected row cell. */
  placeItem(
    row: DisplayRow,
    startSegment: number,
    spanSegments: number,
    componentName: string,
    inputs: Record<string, any>,
    title?: string,
  ): DisplayItem {
    const item = this.buildItem(startSegment, spanSegments, componentName, inputs, title);
    row.addItem(item);
    return item;
  }
}
