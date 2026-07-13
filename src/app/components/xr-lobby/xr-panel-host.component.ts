/**
 * @module components/xr-lobby/xr-panel-host
 *
 * The off-screen XR panel host (xr-3-min): mounts the REAL Angular
 * run-panel + initial-conditions components under `.xr-panel-context`
 * (laid out, in the DOM, off-viewport) and registers their live
 * elements + the viewer's temporal seams as an XrSurfaceProvider with
 * the XR engine. In-session, the panel system rasterizes these exact
 * elements onto HTMLMesh quads and forwards pointer events back —
 * behavior parity is automatic because there is only ONE component
 * instance per surface.
 *
 * The standalone CONDITIONS editor wires into the SAME run panel
 * instance's IC state (stateChange → onIcStateChange), so "Set
 * Initial Conditions" on the RUN quad applies what the CONDITIONS
 * quad edited — one state, two pages.
 *
 * 2026-07-12 debug-pass session: EQUATIONS (the flat "Live
 * evaluations" selector + overlay, bundled into one panel — a
 * floating page has no reason to keep them as two side-by-side
 * widgets) and LEGEND (scene contents, read-only) grow onto the same
 * ring, following the identical registered-surface pattern. Both
 * mount plain flow-layout components except sim-space-legend, whose
 * own `.legend-panel` is `position: absolute` for the FLAT viewport
 * overlay case — pinned back to normal flow for XR via the global
 * `.xr-panel-context .legend-panel` override in
 * styles/_xr-panel-context.css (an absolutely-positioned box doesn't
 * contribute to its parent's flow size, so left alone it would
 * collapse the wrapper HTMLMesh captures down to just the title
 * line).
 */

import {
  Component, Input, NgZone, OnChanges, OnDestroy, SimpleChanges,
  ViewChild, ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import { SimSpaceViewerComponent }
  from '../sim-space/sim-space-viewer/sim-space-viewer.component';
import { SimSpaceSimulationRunPanelComponent }
  from '../sim-space/sim-space-viewer/sim-space-simulation-run-panel.component';
import { RunInitialConditionsEditorComponent }
  from '../sim-space/sim-space-viewer/run-initial-conditions-editor.component';
import { SimSpaceEvaluationSelectorComponent }
  from '../sim-space/sim-space-viewer/sim-space-evaluation-selector.component';
import { SimSpaceEvaluationOverlayComponent }
  from '../sim-space/sim-space-viewer/sim-space-evaluation-overlay.component';
import { SimSpaceLegendComponent }
  from '../sim-space/sim-space-viewer/sim-space-legend.component';
import { SimSpaceSolutionsSummaryComponent }
  from '../sim-space/sim-space-viewer/sim-space-solutions-summary.component';
import { XrEngineService } from '@services/xr/xr-engine.service';
import { XR_PANEL_CONTEXT } from '@models/xr/xr-panel-context';
import { XrScrubState } from '@models/xr/xr-surface-model';
import { formatTimeValue } from '@models/sim-space/time-units';

@Component({
  standalone: true,
  selector: 'xr-panel-host',
  imports: [
    CommonModule,
    SimSpaceSimulationRunPanelComponent,
    RunInitialConditionsEditorComponent,
    SimSpaceEvaluationSelectorComponent,
    SimSpaceEvaluationOverlayComponent,
    SimSpaceLegendComponent,
    SimSpaceSolutionsSummaryComponent,
  ],
  providers: [{ provide: XR_PANEL_CONTEXT, useValue: true }],
  template: `
    <div class="xr-panel-context" *ngIf="viewer">
      <div class="xr-panel-surface run" #runSurface>
        <sim-space-simulation-run-panel #runPanel
          [simulationDefinitionName]="viewer.simulationDefinitionName"
          [defaultDtSeconds]="viewer.simulationDefaultDtSeconds"
          [timeUnit]="viewer.temporalUnit"
          (stepCommitted)="viewer.onSimulationStepCommitted()"
          (selectedRunChange)="viewer.onSelectedRunChange($event)">
        </sim-space-simulation-run-panel>
      </div>
      <div class="xr-panel-surface conditions" #conditionsSurface>
        <div class="xr-surface-title">Initial conditions</div>
        <run-initial-conditions-editor
          [simulationDefinitionName]="viewer.simulationDefinitionName ?? ''"
          [defaultDtSeconds]="viewer.simulationDefaultDtSeconds"
          [locked]="runPanel.selectedRunInitialized"
          [runName]="runPanel.selectedRunName"
          (stateChange)="runPanel.onIcStateChange($event)">
        </run-initial-conditions-editor>
      </div>
      <!-- Live evaluation equations — the flat "Live evaluations"
           selector + overlay bundled into ONE XR panel (in flat mode
           they're two side-by-side widgets; a floating page has no
           reason to force that split). The selector picks; the
           overlay renders the pick, same as flat. -->
      <div class="xr-panel-surface equations" #equationsSurface>
        <div class="xr-surface-title">Live evaluations</div>
        <sim-space-evaluation-selector
          [evaluations]="viewer.evaluations"
          [activeName]="viewer.activeEvaluationName"
          (toggle)="viewer.onEvaluationToggle($event)">
        </sim-space-evaluation-selector>
        <sim-space-evaluation-overlay *ngIf="viewer.activeEvaluation"
          [evaluation]="viewer.activeEvaluation"
          [currentStep]="viewer.evaluationValueFor(viewer.activeEvaluation)">
        </sim-space-evaluation-overlay>
      </div>
      <!-- Scene contents legend — read-only, so it's a straight
           rasterization of the flat component with no XR-specific
           branching needed (no cdk overlay, no keyboard input). -->
      <div class="xr-panel-surface legend" #legendSurface>
        <div class="xr-surface-title">Scene contents</div>
        <sim-space-legend
          [resolvedBindings]="viewer.snapshot?.resolvedBindings || []"
          [objects]="viewer.snapshot?.objects || []">
        </sim-space-legend>
      </div>
      <!-- No-code solutions — read-only: which SolutionDefinition each
           *SimState class is wired to, and its description. No Edit/
           Remove/Add (those either mutate state or route to
           /custom-no-code, forbidden in-session). -->
      <div class="xr-panel-surface solutions" #solutionsSurface>
        <div class="xr-surface-title">No-code solutions</div>
        <sim-space-solutions-summary
          [simulationDefinitionName]="viewer.simulationDefinitionName">
        </sim-space-solutions-summary>
      </div>
    </div>
  `,
  styles: [`
    /* Laid out + rendered (HTMLMesh needs real rects and computed
       styles) but parked far off-viewport. display:none would yield
       zero-size rasters — never use it here. */
    :host {
      position: fixed;
      left: -10000px;
      top: 0;
      display: block;
    }
    .xr-panel-surface {
      width: 520px;
      background: #fdfdfe;
      border: 1px solid #c8c8c8;
      border-radius: 8px;
      padding: 10px;
      margin-bottom: 24px;
    }
    .xr-panel-surface.conditions { width: 560px; }
    .xr-panel-surface.equations { width: 460px; }
    .xr-panel-surface.legend { width: 380px; }
    .xr-panel-surface.solutions { width: 480px; }
    .xr-surface-title {
      font-size: 1.05rem;
      font-weight: 700;
      color: #0d47a1;
      padding: 2px 4px 10px;
    }
  `],
})
export class XrPanelHostComponent implements OnChanges, OnDestroy {

  /** The live slim-view viewer — run/IC inputs and the temporal seams
   *  (hasTemporal / temporalSampleCount / currentTime) come off it. */
  @Input() viewer: SimSpaceViewerComponent | null = null;
  @Input() spaceName = '';

  @ViewChild('runSurface')
  runSurface?: ElementRef<HTMLDivElement>;
  @ViewChild('conditionsSurface')
  conditionsSurface?: ElementRef<HTMLDivElement>;
  @ViewChild('equationsSurface')
  equationsSurface?: ElementRef<HTMLDivElement>;
  @ViewChild('legendSurface')
  legendSurface?: ElementRef<HTMLDivElement>;
  @ViewChild('solutionsSurface')
  solutionsSurface?: ElementRef<HTMLDivElement>;

  private unregister: (() => void) | null = null;

  constructor(private engine: XrEngineService, private zone: NgZone) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['spaceName']) this.register();
  }

  ngOnDestroy(): void {
    this.unregister?.();
    this.unregister = null;
  }

  private register(): void {
    this.unregister?.();
    this.unregister = null;
    if (!this.spaceName) return;
    this.unregister = this.engine.registerSurfaceProvider(
      this.spaceName, {
        panels: [
          {
            id: 'run', label: 'Simulation run',
            getElement: () => this.runSurface?.nativeElement ?? null,
          },
          {
            id: 'conditions', label: 'Initial conditions',
            getElement: () =>
              this.conditionsSurface?.nativeElement ?? null,
          },
          {
            id: 'equations', label: 'Live evaluations',
            getElement: () =>
              this.equationsSurface?.nativeElement ?? null,
          },
          {
            id: 'legend', label: 'Scene contents',
            getElement: () => this.legendSurface?.nativeElement ?? null,
          },
          {
            id: 'solutions', label: 'No-code solutions',
            getElement: () =>
              this.solutionsSurface?.nativeElement ?? null,
          },
        ],
        getScrubState: () => this.scrubState(),
        setScrubCurrent: value => {
          // Rail drags arrive from the XR frame loop — outside the
          // Angular zone; re-enter so the viewer re-renders.
          this.zone.run(() => this.viewer?.onScrubberChange(value));
        },
      });
  }

  private scrubState(): XrScrubState | null {
    const viewer = this.viewer;
    if (!viewer?.hasTemporal || viewer.temporalSampleCount < 2) {
      return null;
    }
    const { min, max } = viewer.temporalRange;
    const current = viewer.currentTime;
    const kind = viewer.temporalKind;
    const formatted = kind === 'step'
      ? `step ${Math.round(current)} / ${Math.round(max)}`
      : `${formatTimeValue(current, viewer.temporalUnit)} / `
        + formatTimeValue(max, viewer.temporalUnit);
    return {
      min, max, current, kind, formatted,
      sampleCount: viewer.temporalSampleCount,
    };
  }
}
