import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { filter, take, takeUntil } from 'rxjs/operators';

import { PolariService } from '@services/polari-service';
import { NoCodeSolutionStateService } from '@services/no-code-services/no-code-solution-state.service';

/**
 * c-graph-canvas-panel — demo-4 (DEMONSTRABLES_PLAN.md §3 demo-4): a cmod CGraph opened IN the EXISTING no-code canvas,
 * reusing hn-0's HardwareSubgraph node kind (D-demo-3 ruled: embedded in the page, not a new route) — no second editor.
 *
 * THE ADAPTER. The canvas only knows SolutionDefinition rows of NoCodeState/Slot. This panel is the thin bridge: it
 * ensures (creating once, never duplicating) a SolutionDefinition named `cmod.c-canvas.<graph>` holding exactly one
 * state — a `HardwareSubgraph` node whose `cgraph` field names the selected graph — then selects it through the SAME
 * NoCodeSolutionStateService the native selector uses, and mounts `<custom-no-code>` unmodified. Opening the node's
 * overlay (hn-0's CAtomOverlayComponent, extended by demo-4 with ports/edges/target badges) is how the graph's atoms,
 * wires and derived targets are actually seen and expanded — the canvas itself never grows a grouping layer.
 *
 * THE ONE NEW COMPONENT this slice needs (same justification class as firmware-installer-panel / pipeline-setup-panel):
 * a configured table cannot host a canvas, a graph picker that swaps WHICH SolutionDefinition is open, or render →
 * build → prove buttons that call cmod's doors and show their verdicts as badges.
 */
interface GraphRow { name: string; title: string; status: string; node_count: number; edge_count: number; atom_count: number; }
interface GlueBuildRow {
  name: string; equivalent: boolean; proof: string; hex_sha256: string; size_text: number; size_data: number; size_bss: number;
  build_ok: boolean;
}

@Component({
  standalone: false,
  selector: 'c-graph-canvas-panel',
  template: `
    <div class="cgcp">
      <div class="cgcp-bar">
        <label class="cgcp-pick">
          <span>CGraph</span>
          <select [value]="graph" (change)="pick($any($event.target).value)">
            <option *ngFor="let g of graphs" [value]="g.name">{{ g.name }} ({{ g.node_count }} nodes, {{ g.atom_count }} atoms)</option>
          </select>
        </label>
        <button type="button" (click)="doRender()" [disabled]="busy">Render</button>
        <button type="button" (click)="doBuild()" [disabled]="busy">Build</button>
        <button type="button" (click)="doProve()" [disabled]="busy">Prove</button>
        <span class="cgcp-busy" *ngIf="busy">{{ busy }}…</span>
      </div>
      <div class="cgcp-error" *ngIf="error">{{ error }}</div>

      <div class="cgcp-result" *ngIf="renderResult">
        render: graph sha {{ renderResult.graph_sha256?.slice(0,12) }} · files sha {{ renderResult.files_sha256?.slice(0,12) }}
        · {{ renderResult.unchanged ? 'unchanged vs the committed project' : 'would write ' + (renderResult.files?.length || 0) + ' file(s)' }}
        · cost before building {{ renderResult.cost_before_building?.total_bytes }} B
      </div>
      <div class="cgcp-result" *ngIf="buildResult">
        build: {{ buildResult.ok ? 'ok' : 'refused' }}
        <span *ngIf="buildResult.ok">— .hex {{ buildResult.hex_sha256?.slice(0,12) }} · .text {{ buildResult.size_text }} B · .data {{ buildResult.size_data }} B · .bss {{ buildResult.size_bss }} B</span>
        <span *ngIf="!buildResult.ok" class="cgcp-refused">{{ buildResult.refused }}</span>
      </div>
      <div class="cgcp-result" *ngIf="proveResult">
        prove:
        <span [class.cgcp-good]="proveResult.equivalent" [class.cgcp-bad]="proveResult.ok && !proveResult.equivalent">
          {{ proveResult.ok ? (proveResult.equivalent ? 'EQUIVALENT' : 'NOT equivalent (' + proveResult.n_differences + ' differences)') : proveResult.refused }}
        </span>
        <span *ngIf="proveResult.ok"> — {{ proveResult.frames_compared }} frames compared{{ proveResult.hex_identical ? '; .hex byte-identical to the hand-written build' : '' }}</span>
      </div>
      <div class="cgcp-result" *ngIf="lastBuild">
        last build on record: {{ lastBuild.proof }} · .hex {{ lastBuild.hex_sha256?.slice(0,12) }}
      </div>

      <custom-no-code></custom-no-code>
    </div>
  `,
  styles: [`
    .cgcp-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 6px 2px; }
    .cgcp-pick { display: flex; align-items: center; gap: 6px; font-size: 0.85em; }
    .cgcp-error { color: var(--error-text, #b00020); padding: 2px; }
    .cgcp-result { font-size: 0.82em; padding: 2px 2px; color: var(--text-secondary, #555); }
    .cgcp-refused { color: var(--error-text, #b00020); }
    .cgcp-good { color: var(--success-text, #2e7d32); font-weight: 600; }
    .cgcp-bad { color: var(--error-text, #b00020); font-weight: 600; }
    .cgcp-busy { font-size: 0.8em; opacity: 0.7; }
    custom-no-code { display: block; min-height: 560px; }
  `],
})
export class CGraphCanvasPanelComponent implements OnInit, OnChanges, OnDestroy {
  @Input() graph: string = 'uno-sim-rig-graph';

  graphs: GraphRow[] = [];
  error = '';
  busy = '';
  renderResult: any = null;
  buildResult: any = null;
  proveResult: any = null;
  lastBuild: GlueBuildRow | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private http: HttpClient,
    private polariService: PolariService,
    private solutionState: NoCodeSolutionStateService,
  ) {}

  private get base(): string { return this.polariService.getBackendBaseUrl(); }
  private get headers(): any { return (this.polariService.backendRequestOptions as any)?.headers; }

  ngOnInit(): void {
    this.loadGraphs();
    // initializeFromBackend() populates loading$ → false ONCE, early; wait for that one transition (never a second
    // persistent subscription per call — pick()/ngOnChanges open directly, loading is already settled by then).
    this.solutionState.loading$.pipe(filter((loading: boolean) => !loading), take(1), takeUntil(this.destroy$))
      .subscribe(() => this.openSolutionFor(this.graph));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['graph'] && !changes['graph'].firstChange) {
      this.openSolutionFor(this.graph);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private solutionName(graph: string): string {
    return 'cmod.c-canvas.' + graph;
  }

  pick(graph: string): void {
    this.graph = graph;
    this.renderResult = this.buildResult = this.proveResult = this.lastBuild = null;
    this.openSolutionFor(graph);
  }

  loadGraphs(): void {
    this.http.get<any>(`${this.base}/api/cmod/graphs`, { headers: this.headers }).subscribe({
      next: (r: any) => { this.graphs = r?.graphs || []; },
      error: () => { /* the picker degrades to the default graph silently — the canvas itself still loads */ },
    });
  }

  /** Create (once) and select the ONE-node SolutionDefinition that hosts this graph — the thin CGraph ⇄ canvas adapter. */
  private openSolutionFor(graph: string): void {
    const name = this.solutionName(graph);
    if (!this.solutionState.getSolutionData(name)) {
      this.solutionState.createNewSolution(name, { targetRuntime: 'typescript_frontend' as any });
      this.solutionState.addStateToSolution(name, {
        stateName: 'subgraph', id: 'subgraph', index: 0, shapeType: 'rectangle', solutionName: name,
        stateClass: 'HardwareSubgraph', boundObjectClass: 'HardwareSubgraph',
        boundObjectFieldValues: { cgraph: graph, board_definition: 'arduino-uno-r3', firmware_runtime: 'bare-c' },
        stateSvgSizeX: 240, stateSvgSizeY: 160, stateSvgRadius: null, layerName: 'rectangle-layer',
        stateLocationX: 320, stateLocationY: 220, stateSvgName: 'rectangle',
        slots: [{ index: 0, stateName: 'subgraph', slotAngularPosition: 0, connectors: [], isInput: false,
                 allowOneToMany: true, allowManyToOne: false, label: 'frames' } as any],
        slotRadius: 5, backgroundColor: '#6D4C41',
      } as any);
    }
    this.solutionState.selectSolution(name);
  }

  private refreshGlueBuild(): void {
    this.http.get<any>(`${this.base}/api/cmod/graphs/${encodeURIComponent(this.graph)}`, { headers: this.headers }).subscribe({
      next: (r: any) => { const builds = r?.glue_builds || []; this.lastBuild = builds.length ? builds[builds.length - 1] : null; },
      error: () => {},
    });
  }

  doRender(): void {
    this.error = ''; this.busy = 'rendering'; this.renderResult = null;
    this.http.get<any>(`${this.base}/api/cmod/graphs/${encodeURIComponent(this.graph)}/render`, { headers: this.headers }).subscribe({
      next: (r: any) => { this.busy = ''; this.renderResult = r; },
      error: (e: any) => { this.busy = ''; this.error = e?.error?.refused || e?.error?.error || 'render failed'; },
    });
  }

  doBuild(): void {
    this.error = ''; this.busy = 'building'; this.buildResult = null;
    this.http.post<any>(`${this.base}/api/cmod/graphs/${encodeURIComponent(this.graph)}/build`, {}, { headers: this.headers }).subscribe({
      next: (r: any) => { this.busy = ''; this.buildResult = r; this.refreshGlueBuild(); },
      error: (e: any) => { this.busy = ''; this.buildResult = { ok: false, refused: e?.error?.refused || e?.error?.error || 'build failed' }; },
    });
  }

  doProve(): void {
    this.error = ''; this.busy = 'proving'; this.proveResult = null;
    this.http.post<any>(`${this.base}/api/cmod/graphs/${encodeURIComponent(this.graph)}/prove`, {}, { headers: this.headers }).subscribe({
      next: (r: any) => { this.busy = ''; this.proveResult = Object.assign({ ok: true }, r); this.refreshGlueBuild(); },
      error: (e: any) => { this.busy = ''; this.proveResult = { ok: false, refused: e?.error?.refused || e?.error?.error || 'prove failed' }; },
    });
  }
}
