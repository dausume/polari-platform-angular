/**
 * @cross-cutting
 * @tags @xc:render-shared, @xc:overlay
 * @consumers
 *   - SimSpaceViewer (always-on, top-right; pairs with at most one
 *     SimSpaceEvaluationOverlay rendered to its immediate left).
 * @impact-on-edit
 *   Pure UI — selection state lives on the parent viewer so this
 *   component stays stateless and easy to reuse.
 * @see /OVERLAP_MAP.md
 *
 * Compact button rail listing every SimSpaceEvaluationEquation available
 * in the scene. Three behaviors:
 *   - Click an unselected button → that overlay opens, the rail
 *     highlights it.
 *   - Click the currently selected button → the overlay closes.
 *   - Click a different button → switch overlays (old closes, new opens).
 *
 * The rail is always visible. The active overlay floats to the rail's
 * left (handled by the viewer's flex layout).
 */

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

import { SimSpaceEvaluationSnapshot } from '@models/sim-space/sim-space-types';

@Component({
  standalone: true,
  selector: 'sim-space-evaluation-selector',
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sel-card" *ngIf="evaluations?.length" [class.collapsed]="collapsed">
      <button type="button" class="sel-header"
              (click)="collapsed = !collapsed"
              [attr.aria-expanded]="!collapsed">
        <span class="sel-title">Live evaluations</span>
        <span class="sel-count" *ngIf="evaluations?.length">×{{ evaluations.length }}</span>
        <mat-icon class="collapse-chevron">{{ collapsed ? 'expand_more' : 'expand_less' }}</mat-icon>
      </button>
      <div class="sel-body" *ngIf="!collapsed">
        <button
          *ngFor="let ev of evaluations"
          class="sel-button"
          [class.active]="ev.name === activeName"
          [title]="ev.description || ev.name"
          (click)="toggle.emit(ev.name)">
          <span class="sel-name">{{ shortLabelFor(ev) }}</span>
          <span class="sel-unit" *ngIf="ev.unit">{{ ev.unit }}</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      pointer-events: auto;
    }
    .sel-card {
      background: rgba(255, 255, 255, 0.98);
      border: 1px solid #c8c8c8;
      border-radius: 8px;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
      padding: 4px 6px 8px 6px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 140px;
    }
    .sel-header {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 4px;
      background: transparent;
      border: none;
      width: 100%;
      cursor: pointer;
      color: inherit;
      font: inherit;
      text-align: left;
    }
    .sel-header:hover { background: rgba(0, 0, 0, 0.03); border-radius: 4px; }
    .sel-card:not(.collapsed) .sel-header {
      border-bottom: 1px solid #eee;
    }
    .sel-title {
      font-size: 0.65rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #555;
      font-weight: 700;
      flex: 1;
    }
    .sel-count {
      font-size: 0.7rem;
      color: #777;
    }
    .collapse-chevron {
      color: #888;
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .sel-body {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 2px 0 0 0;
    }
    .sel-button {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      font-size: 0.82rem;
      font-family: monospace;
      background: #f4f6fa;
      border: 1px solid #d2d6de;
      border-radius: 5px;
      cursor: pointer;
      transition: background 120ms, border-color 120ms, color 120ms;
      color: #1e2a45;
    }
    .sel-button:hover { background: #e6ebf3; }
    .sel-button.active {
      background: #1e2a45;
      border-color: #1e2a45;
      color: #fff;
    }
    .sel-button.active .sel-unit { color: #cfd6e3; }
    .sel-unit { font-size: 0.7rem; color: #777; }
    .sel-name { text-align: left; flex: 1; }
  `]
})
export class SimSpaceEvaluationSelectorComponent {
  @Input() evaluations: SimSpaceEvaluationSnapshot[] = [];
  /** Name of the currently active overlay, or null for "none open". */
  @Input() activeName: string | null = null;

  /** Header-button toggle — the rail collapses to just the title line
   *  so the corner stays clean when the analyst isn't using it. */
  collapsed = false;
  /** Emits the name a user clicked. The parent decides whether that
   *  toggles, switches, or closes the active overlay. */
  @Output() toggle = new EventEmitter<string>();

  /** Short label for a button — strips the leading "<sim-space>." prefix
   *  on names like "pendulum-2d-viz.kinetic-energy" so the rail stays
   *  compact. Full description still surfaces via the title tooltip. */
  shortLabelFor(ev: SimSpaceEvaluationSnapshot): string {
    const name = ev.name || '';
    const dot = name.lastIndexOf('.');
    return dot >= 0 ? name.slice(dot + 1) : name;
  }
}
