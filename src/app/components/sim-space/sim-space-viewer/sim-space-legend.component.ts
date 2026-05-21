/**
 * @cross-cutting
 * @tags @xc:render-shared
 * @consumers
 *   - SimSpaceViewer
 * @impact-on-edit
 *   Pure presentation — reads the snapshot's resolvedBindings + counts
 *   freestanding objects. Stays in sync automatically when the viewer
 *   reloads a snapshot.
 * @see /OVERLAP_MAP.md
 *
 * Bottom-right legend panel for SimSpaceViewer. Shows:
 *   - What classes contribute instances (with the field → axis mapping)
 *   - The count of freestanding shapes baked into the scene
 *   - Total object count
 */

import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';

import {
  SimSpaceResolvedBinding,
  SimSpaceObject,
} from '@models/sim-space/sim-space-types';

@Component({
  standalone: true,
  selector: 'sim-space-legend',
  imports: [CommonModule, MatIconModule, MatChipsModule],
  template: `
    <div class="legend-panel" *ngIf="totalCount > 0">
      <div class="legend-header">
        <mat-icon>list_alt</mat-icon>
        <span class="legend-title">Scene contents</span>
        <span class="legend-total">{{ totalCount }}
          {{ totalCount === 1 ? 'object' : 'objects' }}
        </span>
      </div>

      <ng-container *ngFor="let b of resolvedBindings">
        <div class="legend-row">
          <div class="legend-class-line">
            <mat-icon class="row-icon">data_object</mat-icon>
            <span class="legend-class mono">{{ b.className }}</span>
            <span class="legend-count">×{{ b.instanceCount }}</span>
          </div>
          <div class="legend-fields-line" *ngIf="b.positionFields">
            <span class="legend-axis">x:</span>
            <code>{{ b.positionFields.x }}</code>
            <span class="legend-axis">y:</span>
            <code>{{ b.positionFields.y }}</code>
            <ng-container *ngIf="b.positionFields.z">
              <span class="legend-axis">z:</span>
              <code>{{ b.positionFields.z }}</code>
            </ng-container>
          </div>
          <div class="legend-fields-line" *ngIf="b.vec3Field && !b.positionFields">
            <span class="legend-axis">vec3:</span>
            <code>{{ b.vec3Field }}</code>
          </div>
          <div class="legend-fields-line" *ngIf="b.kind === 'connection' && b.endpoints">
            <code>{{ b.endpoints.source }}</code>
            <span class="legend-axis">→</span>
            <code>{{ b.endpoints.target }}</code>
          </div>
          <div class="legend-visual-line">
            <ng-container *ngIf="b.kind !== 'connection'">
              shape: <code>{{ b.shapeRef }}</code> · style: <code>{{ b.styleRef }}</code>
            </ng-container>
            <ng-container *ngIf="b.kind === 'connection'">
              connection · style: <code>{{ b.styleRef }}</code>
            </ng-container>
          </div>
        </div>
      </ng-container>

      <div class="legend-row" *ngIf="freestandingCount > 0">
        <div class="legend-class-line">
          <mat-icon class="row-icon">brush</mat-icon>
          <span class="legend-class">Freestanding shapes</span>
          <span class="legend-count">×{{ freestandingCount }}</span>
        </div>
        <div class="legend-fields-line muted-line">
          Baked into the SimSpace definition (not from a class binding).
        </div>
      </div>
    </div>
  `,
  styles: [`
    .legend-panel {
      position: absolute;
      right: 12px;
      bottom: 12px;
      background: rgba(255, 255, 255, 0.96);
      border: 1px solid #d0d0d0;
      border-radius: 6px;
      padding: 10px 12px;
      font-size: 0.8rem;
      min-width: 220px;
      max-width: 340px;
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
    .legend-total {
      color: #757575;
      font-size: 0.75rem;
    }
    .legend-row {
      padding: 4px 0;
    }
    .legend-row + .legend-row {
      border-top: 1px dashed #eee;
      margin-top: 4px;
      padding-top: 6px;
    }
    .legend-class-line {
      display: flex;
      align-items: center;
      gap: 4px;
      color: var(--mat-sys-on-surface, #1a1a1a);
    }
    .row-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #1976d2;
    }
    .legend-class {
      font-weight: 500;
      flex: 1;
    }
    .legend-count {
      color: #555;
      font-size: 0.75rem;
    }
    .legend-fields-line, .legend-visual-line {
      margin-top: 2px;
      margin-left: 22px;
      color: #555;
      font-size: 0.75rem;
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      align-items: center;
    }
    .muted-line {
      font-style: italic;
      color: #888;
    }
    .legend-axis {
      color: #757575;
    }
    code {
      background: #f0f0f0;
      padding: 1px 4px;
      border-radius: 2px;
      font-size: 0.85em;
      color: #1a1a1a;
    }
    .mono { font-family: monospace; }
  `]
})
export class SimSpaceLegendComponent {
  @Input() resolvedBindings: SimSpaceResolvedBinding[] = [];
  @Input() objects: SimSpaceObject[] = [];

  /** Objects without a classRef are freestanding (baked into the definition). */
  get freestandingCount(): number {
    return this.objects.filter(o => !o.classRef).length;
  }

  get totalCount(): number {
    return this.objects.length;
  }
}
