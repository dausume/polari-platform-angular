/**
 * @cross-cutting
 * @tags @xc:render-shared, @xc:overlay
 * @consumers
 *   - SimSpaceViewer (rendered as an overlay in the upper-left)
 * @impact-on-edit
 *   Purely presentational. Reads dimensionality + coordinate system from
 *   the loaded SimSpaceDefinition, plus the resolved bindings from the
 *   snapshot. Stays in sync automatically when the viewer reloads.
 *
 *   Same overlay pattern the no-code editor uses — an Angular component
 *   anchored to a renderer-relative position rather than drawn into the
 *   render surface.
 * @see /OVERLAP_MAP.md
 *
 * Axis legend overlay. Always present (even when nothing is bound) so
 * users can immediately see what dimensions the space has and where
 * each one comes from when a class binding is active.
 */

import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  SimSpaceCoordinateSystem,
  SimSpaceDimensionality,
  SimSpaceResolvedBinding,
} from '@models/sim-space/sim-space-types';

interface AxisRow {
  letter: 'X' | 'Y' | 'Z';
  /** Field bindings per class — empty when nothing's plotted onto this axis. */
  bindings: Array<{ className: string; field: string }>;
}

@Component({
  standalone: true,
  selector: 'sim-space-axis-legend',
  imports: [CommonModule, MatIconModule, MatTooltipModule],
  template: `
    <div class="axis-legend-panel">
      <div class="legend-header">
        <mat-icon>polyline</mat-icon>
        <span class="legend-title">Axes</span>
        <span class="legend-meta" [matTooltip]="metaTooltip">
          {{ dimensionality | uppercase }} · {{ coordinateSystem }}
        </span>
      </div>

      <div class="axis-row" *ngFor="let row of axes">
        <span class="axis-letter axis-{{ row.letter | lowercase }}">{{ row.letter }}</span>
        <div class="axis-body">
          <ng-container *ngIf="row.bindings.length; else noBinding">
            <div class="axis-binding-row" *ngFor="let b of row.bindings">
              <code>{{ b.field }}</code>
              <span class="axis-from">from</span>
              <span class="mono small">{{ b.className }}</span>
            </div>
          </ng-container>
          <ng-template #noBinding>
            <span class="muted-line">(no field bound)</span>
          </ng-template>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .axis-legend-panel {
      position: absolute;
      left: 12px;
      top: 12px;
      background: rgba(255, 255, 255, 0.96);
      border: 1px solid #d0d0d0;
      border-radius: 6px;
      padding: 10px 12px;
      font-size: 0.8rem;
      min-width: 220px;
      max-width: 320px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
      z-index: 1;
    }
    .legend-header {
      display: flex;
      align-items: center;
      gap: 6px;
      padding-bottom: 6px;
      border-bottom: 1px solid #eee;
      margin-bottom: 6px;
    }
    .legend-header mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #555;
    }
    .legend-title {
      font-weight: 600;
      flex: 1;
      color: var(--mat-sys-on-surface, #1a1a1a);
    }
    .legend-meta {
      color: #757575;
      font-size: 0.7rem;
      text-transform: lowercase;
      letter-spacing: 0.3px;
      font-variant: small-caps;
      cursor: help;
    }
    .axis-row {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      padding: 4px 0;
    }
    .axis-row + .axis-row {
      border-top: 1px dashed #eee;
      margin-top: 2px;
      padding-top: 6px;
    }
    .axis-letter {
      font-weight: 700;
      font-family: monospace;
      font-size: 0.95rem;
      width: 18px;
      text-align: center;
      flex-shrink: 0;
      line-height: 1.2;
    }
    /* Match three.js AxesHelper color convention — X=red, Y=green, Z=blue. */
    .axis-x { color: #d32f2f; }
    .axis-y { color: #388e3c; }
    .axis-z { color: #1976d2; }
    .axis-body {
      flex: 1;
      color: var(--mat-sys-on-surface, #1a1a1a);
    }
    .axis-binding-row {
      display: flex;
      gap: 4px;
      align-items: baseline;
      flex-wrap: wrap;
    }
    .axis-binding-row + .axis-binding-row {
      margin-top: 2px;
    }
    .axis-from {
      color: #888;
      font-size: 0.7rem;
    }
    .muted-line {
      font-style: italic;
      color: #999;
      font-size: 0.75rem;
    }
    .small { font-size: 0.78rem; }
    .mono { font-family: monospace; }
    code {
      background: #f0f0f0;
      padding: 1px 5px;
      border-radius: 2px;
      font-size: 0.85em;
      color: #1a1a1a;
    }
  `]
})
export class SimSpaceAxisLegendComponent {
  @Input() dimensionality: SimSpaceDimensionality = '2d';
  @Input() coordinateSystem: SimSpaceCoordinateSystem = 'math';
  @Input() resolvedBindings: SimSpaceResolvedBinding[] = [];

  /** Compose axis rows — letters depend on dimensionality, bindings aggregate
   * field names from every class that contributes to this axis. */
  get axes(): AxisRow[] {
    const letters: Array<'X' | 'Y' | 'Z'> =
      this.dimensionality === '3d' ? ['X', 'Y', 'Z'] : ['X', 'Y'];
    return letters.map(letter => ({
      letter,
      bindings: this.bindingsForAxis(letter),
    }));
  }

  /** Human-readable explanation of the coord system, shown as a tooltip. */
  get metaTooltip(): string {
    if (this.coordinateSystem === 'math') {
      return 'Math-style coordinates: origin centered, Y up. Real-valued — matches scientific intuition.';
    }
    return 'Screen-style coordinates: origin top-left, Y down. Pixel-based.';
  }

  private bindingsForAxis(letter: 'X' | 'Y' | 'Z'): Array<{ className: string; field: string }> {
    const out: Array<{ className: string; field: string }> = [];
    for (const b of this.resolvedBindings) {
      // Field-style bindings — read the per-axis field name.
      if (b.positionFields) {
        const key = letter.toLowerCase() as 'x' | 'y' | 'z';
        const field = b.positionFields[key];
        if (field) {
          out.push({ className: b.className, field });
        }
      } else if (b.vec3Field) {
        // Vec3 bindings — every axis reads from the same field but at a
        // different index. We surface the field name on every row with a
        // [letter] suffix so the mapping is unambiguous.
        out.push({
          className: b.className,
          field: `${b.vec3Field}[${letter.toLowerCase()}]`,
        });
      }
    }
    return out;
  }
}
