/**
 * @cross-cutting
 * @tags @xc:render-shared
 * @consumers
 *   - SimSpaceViewer (push-pattern flex sibling on the right of the
 *     canvas — same layout strategy the no-code editor uses for its
 *     state-tool-sidebar; resizes the canvas, no overlay).
 * @impact-on-edit
 *   v1 sections: Simulation solutions (the load-bearing piece — links
 *   to the no-code editor for each step solution), Axis labels editor,
 *   Scene info. Add new sections by extending the accordion below.
 *
 * Right-side configuration sidebar. Collapsed to a 48px icon rail at
 * rest; expanded to 320px on toggle. Internal layout is a vertical
 * accordion so the sections are skimmable + don't fight for vertical
 * space.
 *
 * The "Simulation solutions" section is the immediate user need: each
 * row maps a `*SimState` class to the no-code SolutionExecutionSolution
 * that advances it. Click "Edit" on any row → routes to
 * `/custom-no-code` so the analyst can change the math live.
 */

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostBinding,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';

import {
  SimulationRunService,
  SimulationExecutionSolutionEntry,
  SimulationSolutionsResponse,
} from '@services/sim-space/simulation-run.service';
import {
  SimSpaceDefinitionPayload,
} from '@models/sim-space/sim-space-types';

/** The on-canvas overlays managed from the sidebar's View toggles. */
export type OverlayKey = 'axes' | 'legend' | 'evaluations';
export interface OverlayVisibility {
  axes: boolean;
  legend: boolean;
  evaluations: boolean;
}

@Component({
  standalone: true,
  selector: 'sim-space-editor-sidebar',
  imports: [
    CommonModule, FormsModule, MatIconModule, MatButtonModule,
    MatTooltipModule, MatProgressSpinnerModule,
    MatFormFieldModule, MatSelectModule, MatInputModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="sidebar" [class.expanded]="expanded">
      <!-- Toggle button (always visible) -->
      <button type="button" class="toggle-btn"
              [matTooltip]="expanded ? 'Collapse configuration sidebar' : 'Expand configuration sidebar'"
              (click)="toggle()">
        <mat-icon>{{ expanded ? 'chevron_right' : 'chevron_left' }}</mat-icon>
      </button>

      <!-- COLLAPSED state — icon rail. Each icon expands the sidebar +
           focuses its section. -->
      <div class="rail" *ngIf="!expanded">
        <button mat-icon-button matTooltip="Simulation solutions"
                (click)="openSection('solutions')">
          <mat-icon>account_tree</mat-icon>
        </button>
        <button mat-icon-button matTooltip="Axis labels"
                (click)="openSection('axes')">
          <mat-icon>straighten</mat-icon>
        </button>
        <button mat-icon-button matTooltip="Scene info"
                (click)="openSection('info')">
          <mat-icon>info</mat-icon>
        </button>

        <!-- View toggles: the canvas overlays live HERE (they crowd the
             canvas at embed sizes) — each icon shows/hides its overlay
             on the main view directly, expanded or not. -->
        <div class="rail-divider"></div>
        <button mat-icon-button class="view-toggle"
                [class.active]="overlayVisible.axes"
                [matTooltip]="(overlayVisible.axes ? 'Hide' : 'Show') + ' axes'"
                (click)="toggleOverlay('axes')">
          <mat-icon>straighten</mat-icon>
        </button>
        <button mat-icon-button class="view-toggle"
                [class.active]="overlayVisible.legend"
                [matTooltip]="(overlayVisible.legend ? 'Hide' : 'Show') + ' scene contents'"
                (click)="toggleOverlay('legend')">
          <mat-icon>legend_toggle</mat-icon>
        </button>
        <button mat-icon-button class="view-toggle"
                [class.active]="overlayVisible.evaluations"
                [matTooltip]="(overlayVisible.evaluations ? 'Hide' : 'Show') + ' live evaluations'"
                (click)="toggleOverlay('evaluations')">
          <mat-icon>functions</mat-icon>
        </button>
      </div>

      <!-- EXPANDED state — accordion. -->
      <div class="body" *ngIf="expanded">
        <header class="header">
          <mat-icon>tune</mat-icon>
          <span>SimSpace configuration</span>
        </header>

        <!-- View section — the same overlay toggles as the rail, with
             labels. What's enabled here appears on the main view. -->
        <section class="section" [class.open]="openSectionName === 'view'">
          <button class="section-header" (click)="toggleSection('view')">
            <mat-icon>visibility</mat-icon>
            <span class="section-title">View</span>
            <mat-icon class="section-chevron">
              {{ openSectionName === 'view' ? 'expand_less' : 'expand_more' }}
            </mat-icon>
          </button>
          <div class="section-body" *ngIf="openSectionName === 'view'">
            <p class="muted small">
              Show or hide the on-canvas overlays. Hidden ones stay one
              click away right here.
            </p>
            <div class="view-row" (click)="toggleOverlay('axes')">
              <mat-icon [class.on]="overlayVisible.axes">straighten</mat-icon>
              <span class="view-label">Axes</span>
              <mat-icon class="view-state">{{ overlayVisible.axes ? 'toggle_on' : 'toggle_off' }}</mat-icon>
            </div>
            <div class="view-row" (click)="toggleOverlay('legend')">
              <mat-icon [class.on]="overlayVisible.legend">legend_toggle</mat-icon>
              <span class="view-label">Scene contents</span>
              <mat-icon class="view-state">{{ overlayVisible.legend ? 'toggle_on' : 'toggle_off' }}</mat-icon>
            </div>
            <div class="view-row" (click)="toggleOverlay('evaluations')">
              <mat-icon [class.on]="overlayVisible.evaluations">functions</mat-icon>
              <span class="view-label">Live evaluations</span>
              <mat-icon class="view-state">{{ overlayVisible.evaluations ? 'toggle_on' : 'toggle_off' }}</mat-icon>
            </div>
          </div>
        </section>

        <!-- Simulation solutions section -->
        <section class="section" [class.open]="openSectionName === 'solutions'">
          <button class="section-header" (click)="toggleSection('solutions')">
            <mat-icon>account_tree</mat-icon>
            <span class="section-title">Simulation solutions</span>
            <span class="section-count" *ngIf="solutions.length">
              {{ solutions.length }}
            </span>
            <mat-icon class="section-chevron">
              {{ openSectionName === 'solutions' ? 'expand_less' : 'expand_more' }}
            </mat-icon>
          </button>
          <div class="section-body" *ngIf="openSectionName === 'solutions'">
            <p class="muted small" *ngIf="!simulationDefinitionName">
              This scene isn't bound to a SimulationDefinition.
            </p>
            <ng-container *ngIf="simulationDefinitionName">
              <p class="muted small">
                Each <span class="mono">*SimState</span> class can chain multiple
                no-code solutions per timestep — useful when one solution computes
                forces and another integrates. Solutions in the same group run in
                <code>order_index</code> order; their contexts chain so each one
                feeds the next.
              </p>
              <div *ngIf="solutionsLoading" class="loading-row">
                <mat-progress-spinner diameter="16" mode="indeterminate"></mat-progress-spinner>
                <span class="muted small">Loading…</span>
              </div>
              <ng-container *ngIf="!solutionsLoading">
                <div *ngFor="let cls of allSimStateClasses" class="class-group">
                  <div class="class-group-header">
                    <span class="class-name mono">{{ cls }}</span>
                    <span class="class-binding-count muted small">
                      {{ bindingsFor(cls).length }} solution{{ bindingsFor(cls).length === 1 ? '' : 's' }}
                    </span>
                    <button mat-icon-button
                            matTooltip="Add a step solution for this class"
                            class="add-btn"
                            (click)="openAddForm(cls)">
                      <mat-icon>add</mat-icon>
                    </button>
                  </div>

                  <!-- Coordination summary — the role mix the runner
                       would see for this class. Validates that the
                       configuration is internally coherent and shows
                       the dispatch mode at a glance. -->
                  <div *ngIf="coordinationStatusFor(cls) !== 'empty'"
                       class="coordination-chip"
                       [class.coord-ok]="coordinationStatusFor(cls) === 'ok'"
                       [class.coord-warn]="coordinationStatusFor(cls) === 'warn'"
                       [class.coord-error]="coordinationStatusFor(cls) === 'error'"
                       [matTooltip]="coordinationIssuesFor(cls).length
                         ? coordinationIssuesFor(cls).join('\n\n')
                         : 'Dispatch: ' + coordinationSummaryFor(cls)">
                    <mat-icon class="coord-icon">
                      {{ coordinationStatusFor(cls) === 'error' ? 'error_outline'
                         : coordinationStatusFor(cls) === 'warn' ? 'warning_amber'
                         : 'check_circle' }}
                    </mat-icon>
                    <span class="coord-text">{{ coordinationSummaryFor(cls) }}</span>
                  </div>
                  <ul class="solution-list">
                    <li *ngFor="let entry of bindingsFor(cls)" class="solution-row"
                        [class.unwired]="!entry.solutionDefinitionRef">
                      <div class="solution-row-top">
                        <span class="order-pill"
                              [matTooltip]="'order ' + entry.orderIndex + ' — solutions run from lowest to highest within this class'">
                          {{ entry.orderIndex }}
                        </span>
                        <span *ngIf="roleLabelFor(entry)"
                              class="role-pill"
                              [ngClass]="roleClassFor(entry)"
                              [matTooltip]="roleTooltipFor(entry)">
                          {{ roleLabelFor(entry) }}
                        </span>
                        <code class="solution-name" *ngIf="entry.solutionDefinitionRef">{{ entry.solutionDefinitionRef }}</code>
                        <em class="muted small" *ngIf="!entry.solutionDefinitionRef">(no solution wired)</em>
                        <span class="status-badge"
                              [class.status-ok]="entry.solutionDefinitionRef && entry.enabled"
                              [class.status-disabled]="!entry.enabled"
                              [class.status-missing]="!entry.solutionDefinitionRef">
                          {{ statusFor(entry) }}
                        </span>
                      </div>
                      <div class="solution-row-meta" *ngIf="entry.dependsOn?.length">
                        depends on: <code class="muted small">{{ entry.dependsOn.join(', ') }}</code>
                      </div>
                      <div class="solution-row-actions">
                        <button mat-stroked-button class="edit-btn"
                                [disabled]="!entry.solutionDefinitionRef"
                                matTooltip="Open this solution in the no-code editor"
                                (click)="openInEditor(entry)">
                          <mat-icon>edit</mat-icon>
                          Edit
                        </button>
                        <button mat-stroked-button class="remove-btn"
                                matTooltip="Remove this binding (the underlying SolutionDefinition is not deleted)"
                                (click)="removeBinding(entry)">
                          <mat-icon>delete_outline</mat-icon>
                          Remove
                        </button>
                      </div>
                    </li>
                    <li *ngIf="bindingsFor(cls).length === 0" class="empty-row muted small">
                      No solutions yet. Click <mat-icon class="inline-icon">add</mat-icon> to wire one.
                    </li>
                  </ul>

                  <!-- Inline add form. Single class active at a time. -->
                  <div *ngIf="addFormClass === cls" class="add-form">
                    <mat-form-field appearance="outline" subscriptSizing="dynamic">
                      <mat-label>Solution</mat-label>
                      <mat-select [(value)]="addFormSolution">
                        <mat-option *ngFor="let s of availableSolutions" [value]="s.name">
                          {{ s.name }}
                        </mat-option>
                      </mat-select>
                    </mat-form-field>
                    <div class="add-form-actions">
                      <button mat-flat-button color="primary"
                              [disabled]="!addFormSolution || addInFlight"
                              (click)="submitAdd(cls)">
                        <mat-icon *ngIf="!addInFlight">check</mat-icon>
                        <mat-progress-spinner *ngIf="addInFlight" diameter="14" mode="indeterminate">
                        </mat-progress-spinner>
                        Add
                      </button>
                      <button mat-button (click)="cancelAdd()">Cancel</button>
                    </div>
                  </div>
                </div>
                <div *ngIf="allSimStateClasses.length === 0" class="muted small">
                  No *SimState classes participate in this simulation yet.
                </div>
              </ng-container>
            </ng-container>
          </div>
        </section>

        <!-- Axis labels — stub for v1: read-only display until full
             editor lands. -->
        <section class="section" [class.open]="openSectionName === 'axes'">
          <button class="section-header" (click)="toggleSection('axes')">
            <mat-icon>straighten</mat-icon>
            <span class="section-title">Axis labels</span>
            <mat-icon class="section-chevron">
              {{ openSectionName === 'axes' ? 'expand_less' : 'expand_more' }}
            </mat-icon>
          </button>
          <div class="section-body" *ngIf="openSectionName === 'axes'">
            <p class="muted small">
              Override the default X / Y / Z letters with text or LaTeX —
              useful when a scene is a phase space and not literal space.
              Editor coming in a follow-up; for now this section reflects
              what's stored on the SimSpaceDefinition.
            </p>
            <dl class="kv">
              <ng-container *ngFor="let axis of ['x', 'y', 'z']">
                <dt class="mono">{{ axis | uppercase }}</dt>
                <dd>{{ axisLabelDescription(axis) }}</dd>
              </ng-container>
            </dl>
          </div>
        </section>

        <!-- Scene info -->
        <section class="section" [class.open]="openSectionName === 'info'">
          <button class="section-header" (click)="toggleSection('info')">
            <mat-icon>info</mat-icon>
            <span class="section-title">Scene info</span>
            <mat-icon class="section-chevron">
              {{ openSectionName === 'info' ? 'expand_less' : 'expand_more' }}
            </mat-icon>
          </button>
          <div class="section-body" *ngIf="openSectionName === 'info'">
            <dl class="kv">
              <dt>Name</dt><dd class="mono">{{ definition?.name || '—' }}</dd>
              <dt>Dimensionality</dt><dd>{{ definition?.dimensionality | uppercase }}</dd>
              <dt>Coordinates</dt><dd>{{ definition?.coordinateSystem }}</dd>
              <dt>Bound classes</dt>
              <dd>{{ definition?.boundClasses?.length || 0 }}</dd>
              <dt>Simulation</dt>
              <dd class="mono">{{ simulationDefinitionName || '—' }}</dd>
            </dl>
          </div>
        </section>
      </div>
    </aside>
  `,
  styles: [`
    /* :host IS the flex item inside .viewer-shell. Its width grows/
       shrinks with the inner .sidebar so the canvas region reflows
       reactively (ResizeObserver in the viewer drives the renderer
       reflow when the host box changes). */
    :host {
      display: block;
      height: 100%;
      width: 48px;
      flex-shrink: 0;
      transition: width 0.25s ease;
    }
    :host.expanded { width: 320px; }
    .sidebar {
      position: relative;
      height: 100%;
      width: 100%;
      background: #f5f5f5;
      border-left: 1px solid #ddd;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .toggle-btn {
      position: absolute;
      top: 12px;
      left: -14px;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 1px solid #ccc;
      background: #fff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
      z-index: 2;
    }
    .toggle-btn mat-icon { font-size: 18px; width: 18px; height: 18px; color: #555; }

    .rail {
      display: flex; flex-direction: column;
      align-items: center;
      padding: 12px 0;
      gap: 4px;
    }
    .rail-divider {
      width: 24px; height: 1px; background: #ccc; margin: 6px 0;
    }
    /* Overlay view-toggles: dimmed when the overlay is hidden, branded
       when it's showing on the canvas. */
    .view-toggle mat-icon { color: #9aa3ad; }
    .view-toggle.active mat-icon { color: #1958a8; }

    .view-row {
      display: flex; align-items: center; gap: 8px;
      padding: 6px 4px; border-radius: 4px; cursor: pointer;
      user-select: none;
    }
    .view-row:hover { background: rgba(0, 0, 0, 0.04); }
    .view-row mat-icon { font-size: 18px; width: 18px; height: 18px; color: #9aa3ad; }
    .view-row mat-icon.on { color: #1958a8; }
    .view-label { flex: 1; font-size: 0.8rem; }
    .view-state { color: #1958a8 !important; font-size: 22px !important;
      width: 22px !important; height: 22px !important; }

    .body {
      padding: 12px 14px;
      overflow-y: auto;
      flex: 1;
    }
    .header {
      display: flex; align-items: center; gap: 6px;
      font-size: 0.85rem; font-weight: 700;
      padding-bottom: 6px;
      border-bottom: 1px solid #ddd;
      margin-bottom: 8px;
      color: #1e2a45;
    }

    .section { margin-bottom: 6px; }
    .section-header {
      display: flex; align-items: center; gap: 6px;
      width: 100%;
      background: transparent; border: none;
      padding: 6px 4px; cursor: pointer;
      font: inherit; color: inherit;
      border-radius: 4px;
    }
    .section-header:hover { background: rgba(0, 0, 0, 0.04); }
    .section.open .section-header {
      background: #e6ebf3;
      color: #1958a8;
    }
    .section-title { flex: 1; font-weight: 600; font-size: 0.82rem; text-align: left; }
    .section-count {
      font-size: 0.7rem;
      background: #d3eafe; color: #1958a8;
      padding: 1px 5px; border-radius: 3px;
      font-weight: 700;
    }
    .section-chevron { color: #888; }
    .section-body {
      padding: 4px 4px 8px 8px;
      font-size: 0.8rem;
      color: #1a1a1a;
    }

    .solution-list { list-style: none; padding: 0; margin: 8px 0 0 0; display: flex; flex-direction: column; gap: 6px; }
    .solution-row {
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      padding: 8px;
      display: flex; flex-direction: column; gap: 4px;
    }
    .solution-row.unwired { background: #fff8e6; border-color: #e0c66a; }
    .solution-row-top { display: flex; align-items: center; gap: 6px; }
    .solution-class { font-weight: 600; flex: 1; }
    .status-badge {
      font-size: 0.62rem; letter-spacing: 0.06em; text-transform: uppercase;
      padding: 1px 6px; border-radius: 3px; font-weight: 700;
    }
    .status-ok      { background: #d6eedb; color: #1f6b27; }
    .status-disabled{ background: #e3e3e3; color: #555; }
    .status-missing { background: #fce7d2; color: #944a18; }
    .solution-name {
      font-size: 0.72rem;
      background: #f4f6fa; color: #1958a8;
      padding: 1px 6px; border-radius: 3px;
      display: inline-block; word-break: break-all;
    }
    .solution-row-meta { font-size: 0.7rem; color: #666; }
    .solution-row-actions { display: flex; justify-content: flex-end; }
    .edit-btn, .remove-btn { font-size: 0.75rem; min-width: 0; padding: 0 10px; }
    .remove-btn { color: #c62828; }
    .class-group { margin-top: 8px; }
    .class-group + .class-group {
      margin-top: 14px; padding-top: 10px;
      border-top: 1px dashed #ddd;
    }
    .class-group-header {
      display: flex; align-items: center; gap: 6px;
      padding: 4px 0;
    }
    .class-name { font-weight: 700; color: #1e2a45; flex: 1; }
    .class-binding-count { white-space: nowrap; }
    .add-btn { color: #1958a8; }
    .order-pill {
      font-size: 0.68rem; font-weight: 700;
      background: #1958a8; color: #fff;
      padding: 1px 6px; border-radius: 3px;
      font-family: monospace;
    }
    /* Role pill — next to the order pill on each binding row. Colour
       matches the role's identity throughout the editor:
         Complete    → blue (single closed-form update)
         Partial     → orange (sparse contribution)
         Composition → green (combines contributions) */
    .role-pill {
      font-size: 0.62rem; font-weight: 700;
      letter-spacing: 0.04em; text-transform: uppercase;
      padding: 1px 6px; border-radius: 3px;
    }
    .role-pill.role-complete    { background: #d8e7ff; color: #1958a8; }
    .role-pill.role-partial     { background: #ffe1cc; color: #a8501c; }
    .role-pill.role-composition { background: #d4ecd5; color: #2c6b30; }
    .role-pill.role-unknown     { background: #f0e3a8; color: #6a5512; }
    /* Per-class coordination summary chip — surfaces the runner's
       dispatch view of the group, with validation errors when the
       role mix is incoherent. Tooltip carries the issue text. */
    .coordination-chip {
      display: flex; align-items: center; gap: 4px;
      font-size: 0.68rem; font-weight: 600;
      padding: 3px 8px; border-radius: 4px;
      margin: 2px 0 6px 0;
      border: 1px solid transparent;
    }
    .coordination-chip .coord-icon {
      font-size: 14px; width: 14px; height: 14px;
    }
    .coordination-chip.coord-ok    { background: #e7f4ea; color: #1f6b27; border-color: #c6e3cd; }
    .coordination-chip.coord-warn  { background: #fdf3d3; color: #8a6312; border-color: #ecd685; }
    .coordination-chip.coord-error { background: #fcdede; color: #8a1f1f; border-color: #e8a8a8; }
    .empty-row { padding: 6px 0; font-style: italic; }
    .inline-icon { font-size: 14px; width: 14px; height: 14px; vertical-align: middle; }
    .add-form {
      background: #f0f4fa; border: 1px solid #cad6e9; border-radius: 6px;
      padding: 8px; display: flex; flex-direction: column; gap: 6px;
      margin-top: 6px;
    }
    .add-form mat-form-field { width: 100%; }
    .add-form ::ng-deep .mat-mdc-form-field-subscript-wrapper { display: none; }
    .add-form-actions { display: flex; gap: 6px; align-items: center; }

    .loading-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; }
    .muted { color: #777; }
    .small { font-size: 0.78rem; }
    .mono { font-family: monospace; }

    .kv {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 4px 10px;
      margin: 4px 0;
      font-size: 0.78rem;
    }
    .kv dt { color: #666; font-weight: 600; }
    .kv dd { margin: 0; color: #1a1a1a; }
  `]
})
export class SimSpaceEditorSidebarComponent implements OnChanges {
  /** SimulationDefinition.name when this scene participates in one. */
  @Input() simulationDefinitionName: string | null = null;
  /** The current scene definition — drives the Scene info + Axis labels
   *  read-only views. */
  @Input() definition: SimSpaceDefinitionPayload | null = null;
  /** Which on-canvas overlays are showing — owned by the viewer; the
   *  sidebar is just their switchboard (the overlays crowd the canvas
   *  at embed sizes, so they live here and appear only when enabled). */
  @Input() overlayVisible: OverlayVisibility =
    { axes: true, legend: true, evaluations: true };
  @Output() overlayToggle = new EventEmitter<OverlayKey>();

  /** Lets the viewer (the parent) react to expansion if it needs to
   *  reflow other overlays. Not strictly required since the push
   *  pattern handles layout via flex. */
  @Output() expandedChange = new EventEmitter<boolean>();

  /** Reflected onto the host element so the parent flex row can react
   *  via the `:host.expanded` selector that widens the box from 48px
   *  to 320px. Driving the width from the host (not an inner div) is
   *  what triggers the ResizeObserver in the viewer to reflow the d3
   *  / three.js render area. */
  @HostBinding('class.expanded') expanded = false;
  openSectionName: 'solutions' | 'axes' | 'info' | 'view' | null = 'solutions';
  solutions: SimulationExecutionSolutionEntry[] = [];
  availableSolutions: Array<{ name: string; targetRuntime: string }> = [];
  simStateClasses: string[] = [];
  solutionsLoading = false;
  /** Inline add-binding form state — which class's "+" was clicked. */
  addFormClass: string | null = null;
  addFormSolution: string = '';
  addInFlight = false;

  constructor(
    private runService: SimulationRunService,
    private router: Router,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['simulationDefinitionName']) {
      this.reloadSolutions();
    }
  }

  toggle(): void {
    this.expanded = !this.expanded;
    this.expandedChange.emit(this.expanded);
    if (this.expanded && !this.solutions.length) {
      this.reloadSolutions();
    }
  }

  openSection(name: 'solutions' | 'axes' | 'info' | 'view'): void {
    this.openSectionName = name;
    if (!this.expanded) {
      this.expanded = true;
      this.expandedChange.emit(true);
      if (name === 'solutions') this.reloadSolutions();
    }
  }

  toggleSection(name: 'solutions' | 'axes' | 'info' | 'view'): void {
    this.openSectionName = this.openSectionName === name ? null : name;
  }

  toggleOverlay(key: OverlayKey): void {
    this.overlayToggle.emit(key);
  }

  async reloadSolutions(): Promise<void> {
    if (!this.simulationDefinitionName) {
      this.solutions = [];
      this.availableSolutions = [];
      this.simStateClasses = [];
      return;
    }
    this.solutionsLoading = true;
    try {
      const resp = await this.runService.solutionsFor(this.simulationDefinitionName);
      this.solutions = resp.solutions;
      this.availableSolutions = resp.availableSolutions;
      this.simStateClasses = resp.simStateClasses;
    } catch {
      this.solutions = [];
      this.availableSolutions = [];
      this.simStateClasses = [];
    } finally {
      this.solutionsLoading = false;
    }
  }

  /** Every *SimState class involved with this simulation — used as the
   *  grouping axis. Combines what the backend reported as
   *  "participating classes" with any classes that already have
   *  bindings (defensive: if the registry hasn't caught up to a
   *  recently-added class, its existing bindings still surface). */
  get allSimStateClasses(): string[] {
    const set = new Set<string>(this.simStateClasses);
    for (const b of this.solutions) {
      if (b.simStateClassName) set.add(b.simStateClassName);
    }
    return [...set].sort();
  }

  bindingsFor(simStateClass: string): SimulationExecutionSolutionEntry[] {
    return this.solutions
      .filter(b => b.simStateClassName === simStateClass)
      .sort((a, b) => (a.orderIndex - b.orderIndex) || a.name.localeCompare(b.name));
  }

  statusFor(entry: SimulationExecutionSolutionEntry): string {
    if (!entry.solutionDefinitionRef) return 'missing';
    if (!entry.enabled) return 'disabled';
    return 'wired';
  }

  /** Short role label rendered on each binding row (next to the order
   *  pill). Returns '' for unknown so the template can hide the chip. */
  roleLabelFor(entry: SimulationExecutionSolutionEntry): string {
    switch (entry.simStepRole) {
      case 'simStepComplete':    return 'Complete';
      case 'simStepPartial':     return 'Partial';
      case 'simStepComposition': return 'Composition';
      default: return entry.solutionDefinitionRef ? 'no role' : '';
    }
  }

  /** CSS modifier class so the role pill picks up its accent colour. */
  roleClassFor(entry: SimulationExecutionSolutionEntry): string {
    switch (entry.simStepRole) {
      case 'simStepComplete':    return 'role-complete';
      case 'simStepPartial':     return 'role-partial';
      case 'simStepComposition': return 'role-composition';
      default: return entry.solutionDefinitionRef ? 'role-unknown' : '';
    }
  }

  /** Tooltip text for the role pill — surfaces the detection error
   *  when present so the user knows WHY a role is missing. */
  roleTooltipFor(entry: SimulationExecutionSolutionEntry): string {
    if (entry.simStepRole) {
      switch (entry.simStepRole) {
        case 'simStepComplete':
          return 'Complete — single solution producing the whole next-step row (terminates at SimStepNextState).';
        case 'simStepPartial':
          return 'Partial — emits a sparse field-delta payload that the runner aggregates (terminates at SimStepContribution).';
        case 'simStepComposition':
          return 'Composition — reads all partials\' contributions + merged baseline to compose the final row (terminates at SimStepNextState).';
      }
    }
    return entry.simStepRoleError || 'Role not detected.';
  }

  // ── Per-class coordination summary ─────────────────────────────────

  /** Tally of roles within a class group: how many Completes, Partials,
   *  Compositions, and bindings whose role couldn't be resolved. */
  roleCountsFor(simStateClass: string): {
    complete: number;
    partial: number;
    composition: number;
    unknown: number;
    total: number;
  } {
    const bindings = this.bindingsFor(simStateClass);
    let complete = 0, partial = 0, composition = 0, unknown = 0;
    for (const b of bindings) {
      switch (b.simStepRole) {
        case 'simStepComplete':    complete++; break;
        case 'simStepPartial':     partial++; break;
        case 'simStepComposition': composition++; break;
        default: unknown++; break;
      }
    }
    return { complete, partial, composition, unknown, total: bindings.length };
  }

  /** Human-readable mix summary shown next to the class name — e.g.
   *  "1 Complete", "2 Partials + 1 Composition", or "incoherent mix". */
  coordinationSummaryFor(simStateClass: string): string {
    const c = this.roleCountsFor(simStateClass);
    if (c.total === 0) return '';
    const parts: string[] = [];
    if (c.complete)    parts.push(`${c.complete} Complete`);
    if (c.partial)     parts.push(`${c.partial} Partial${c.partial === 1 ? '' : 's'}`);
    if (c.composition) parts.push(`${c.composition} Composition${c.composition === 1 ? '' : 's'}`);
    if (c.unknown)     parts.push(`${c.unknown} unset`);
    return parts.join(' + ');
  }

  /** Coordination errors per class. Mirrors the runner's role-mix
   *  validation so authors see the same diagnostics in the editor
   *  that the runner would emit at dispatch time. */
  coordinationIssuesFor(simStateClass: string): string[] {
    const c = this.roleCountsFor(simStateClass);
    const issues: string[] = [];
    if (c.complete && c.partial) {
      issues.push(
        `Complete + Partial cannot coexist for the same class — pick one mode (either the Complete becomes the single solution, or convert it into a Partial).`,
      );
    }
    if (c.complete > 1) {
      issues.push(
        `Only one Complete solution is allowed per class; found ${c.complete}.`,
      );
    }
    if (c.composition > 1) {
      issues.push(
        `Only one Composition solution is allowed per class; found ${c.composition}.`,
      );
    }
    if (c.composition && !c.partial) {
      issues.push(
        `Composition without Partials has no _step_contributions to merge — wire at least one Partial or drop the Composition.`,
      );
    }
    return issues;
  }

  /** Effective dispatch mode the runner would take for this class —
   *  drives the colour of the coordination chip. */
  coordinationStatusFor(simStateClass: string): 'ok' | 'warn' | 'error' | 'empty' {
    const c = this.roleCountsFor(simStateClass);
    if (c.total === 0) return 'empty';
    if (this.coordinationIssuesFor(simStateClass).length > 0) return 'error';
    if (c.unknown > 0) return 'warn';
    return 'ok';
  }

  openAddForm(simStateClass: string): void {
    this.addFormClass = simStateClass;
    this.addFormSolution = '';
  }

  cancelAdd(): void {
    this.addFormClass = null;
    this.addFormSolution = '';
  }

  async submitAdd(simStateClass: string): Promise<void> {
    if (!this.simulationDefinitionName || !this.addFormSolution || this.addInFlight) return;
    this.addInFlight = true;
    try {
      const existing = this.bindingsFor(simStateClass);
      const nextOrder = existing.length
        ? Math.max(...existing.map(e => e.orderIndex)) + 1
        : 0;
      await this.runService.createSolutionRow(this.simulationDefinitionName, {
        simStateClassName: simStateClass,
        solutionDefinitionRef: this.addFormSolution,
        orderIndex: nextOrder,
      });
      this.cancelAdd();
      await this.reloadSolutions();
    } catch (err) {
      // Surface failure inline — a global toast would be better but
      // we don't have one wired here.
      console.warn('[SimSpaceEditorSidebar] createSolutionRow failed:', err);
    } finally {
      this.addInFlight = false;
    }
  }

  async removeBinding(entry: SimulationExecutionSolutionEntry): Promise<void> {
    if (!entry.name) return;
    try {
      await this.runService.deleteSolutionRow(entry.name);
      await this.reloadSolutions();
    } catch (err) {
      console.warn('[SimSpaceEditorSidebar] deleteSolutionRow failed:', err);
    }
  }

  axisLabelDescription(axis: string): string {
    const label = (this.definition?.axisLabels as any)?.[axis];
    if (!label || label.kind === 'default') return `default (${axis.toUpperCase()})`;
    if (label.kind === 'text') return `text: ${label.value}`;
    if (label.kind === 'latex') return `latex: ${label.value}`;
    return '—';
  }

  openInEditor(entry: SimulationExecutionSolutionEntry): void {
    if (!entry.solutionDefinitionRef) return;
    this.router.navigate(['/custom-no-code'], {
      queryParams: { focusSolution: entry.solutionDefinitionRef },
    });
  }
}
