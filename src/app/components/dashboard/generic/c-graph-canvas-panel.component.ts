import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { filter, take, takeUntil } from 'rxjs/operators';

import { PolariService } from '@services/polari-service';
import { NoCodeSolutionStateService } from '@services/no-code-services/no-code-solution-state.service';
import { CustomNoCodeComponent } from '../../custom-no-code/custom-no-code';

/**
 * c-graph-canvas-panel — demo-4 / demo-4b (DEMONSTRABLES_PLAN.md §3 demo-4; his ruling 2026-10-04: "the no-code solution
 * seems to just be a single state, C (Hardware), along with Java/JavaFx (Native Bridge Backend and Frontend), these
 * should be their own runtimes" — he opened /display/c-canvas and saw ONE state instead of the atoms).
 *
 * THE ADAPTER, demo-4b shape. The canvas only knows SolutionDefinition rows of NoCodeState/Slot. Two modes, one panel:
 *  - no `solution` input (the default — /display/c-atoms, /display/c-canvas): ensures (creating once, never
 *    duplicating) a SolutionDefinition named `cmod.c-canvas.<graph>` built from the CGraph's OWN rows — one `c-atom`
 *    node PER CGraphNode (the glue's generated main/ISR kinds — class/parser/frame/tick/rule — as read-only c-atom
 *    nodes), wired by CGraphEdge, every node in the c-device lane. NEVER a single collapsed HardwareSubgraph wrapper.
 *  - a `solution` input (/display/hardware-solutions): opens the REAL, already-seeded HardwareSolution drawing by name
 *    (its SolutionDefinition already holds the mixed board/bridge/backend nodes — `HardwareSubgraph` stays, here, as
 *    hwnocode's own COLLAPSED representation of the same CGraph; expanding it in place is the c-atom overlay's job,
 *    unchanged) — never re-synthesized, so demo-4's "both ways" links and the real wiring are exactly what a person
 *    drew.
 * Either way, `applyLanes()` groups the open solution's states into one lane per RUNTIME present (hwnocode.custom.
 * runtimes.runtime_for_kind, mirrored client-side): a coloured legend above the canvas, states repositioned into lane
 * columns (a lane band — no new editor layer, `updateStatePositions`/`updateStateInstance` are the service's own), and
 * edges crossing lanes listed as "crossing interfaces" (the split points: HardwareInterfaceBinding / TargetDefinition
 * where known).
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
interface CGraphNodeRow {
  instance: string; kind: string; atom: string; stage: string; order: number; bindings: string; params: string;
}
interface CGraphEdgeRow { kind: string; from_node: string; from_port: string; to_node: string; to_port: string; order: number; }
interface LaneInfo { runtime: string; count: number; color: string; }
interface CrossingInfo { from: string; to: string; fromRuntime: string; toRuntime: string; }

/** mirrors hwnocode.custom.runtimes.runtime_for_kind — the ONE mapping, client-side (demo-4b) */
const DEVICE_CLASSES = new Set(['HardwareSubgraph', 'CAtom', 'c-atom', 'hardware-subgraph', 'class', 'parser', 'frame', 'tick', 'rule']);
const BRIDGE_CLASSES = new Set(['HardwareInterface', 'hw-interface']);
const BROWSER_CLASSES = new Set(['EmitFrontendEvent', 'FormSubscription', 'ReactiveTransform', 'display']);
const RUNTIME_COLORS: Record<string, string> = {
  'c-device': '#5D4037', 'c-twin': '#8D6E63', 'java-bridge': '#6D4C41',
  'python-backend': '#1565c0', 'typescript-browser': '#2e7d32', 'javafx-native': '#6A1B9A',
};
const LANE_ORDER = ['c-device', 'c-twin', 'java-bridge', 'python-backend', 'typescript-browser', 'javafx-native'];

function runtimeForClass(cls: string): string {
  if (BRIDGE_CLASSES.has(cls)) return 'java-bridge';
  if (DEVICE_CLASSES.has(cls)) return 'c-device';
  if (BROWSER_CLASSES.has(cls)) return 'typescript-browser';
  return 'python-backend';
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
        <!-- fs-1 item 4: a link FROM the canvas (this panel is embedded on both /display/c-canvas and
             /display/hardware-solutions) TO the firmware three-part canvas (fs-1's own panel links back). -->
        <a class="cgcp-fw-link" [routerLink]="'/display/firmware-solutions'">Firmware →</a>
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

      <div class="cgcp-lanes" *ngIf="lanes.length">
        <span class="cgcp-lanes-label">Runtimes (lanes):</span>
        <span class="cgcp-lane-chip" *ngFor="let l of lanes" [style.borderColor]="l.color">
          <span class="cgcp-lane-dot" [style.background]="l.color"></span>{{ l.runtime }} ({{ l.count }})
        </span>
      </div>
      <div class="cgcp-crossings" *ngIf="crossings.length">
        Crossing interfaces:
        <span class="cgcp-crossing" *ngFor="let c of crossings">{{ c.from }} ({{ c.fromRuntime }}) ⇢ {{ c.to }} ({{ c.toRuntime }})</span>
      </div>

      <!-- syncUrl=false (selfix 2026-10-05): this embedded canvas previews whatever
           openSolutionFor() selects through the SAME shared service — it must never rewrite the
           HOST page's URL (a /display page is not the no-code editor route). -->
      <custom-no-code [syncUrl]="false"></custom-no-code>
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
    .cgcp-fw-link { margin-left: auto; font-size: 0.85em; text-decoration: none; color: var(--link-text, #1565c0); }
    .cgcp-fw-link:hover { text-decoration: underline; }
    .cgcp-lanes { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 4px 2px; font-size: 0.82em; }
    .cgcp-lanes-label { font-weight: 600; opacity: 0.8; }
    .cgcp-lane-chip { display: inline-flex; align-items: center; gap: 4px; border: 1.5px solid #888; border-radius: 10px; padding: 1px 8px; }
    .cgcp-lane-dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
    .cgcp-crossings { font-size: 0.8em; padding: 2px 2px; display: flex; gap: 10px; flex-wrap: wrap; color: var(--text-secondary, #555); }
    .cgcp-crossing { border-left: 2px dashed #888; padding-left: 6px; }
    /* selfix round 3 (2026-10-05): his evidence — uno-temp-split's 8 states (y 180-380, +90 tall)
       sat at the bottom edge of the embedded canvas and Recenter (resetZoom(), an identity-
       transform reset — never a "fit to content") couldn't bring them into view because the
       embedded host simply wasn't tall enough above them (toolbar + lane legend eat into the
       560px). Taller default so a resetZoom() to identity actually shows the whole pipeline. */
    custom-no-code { display: block; min-height: 720px; }
  `],
})
export class CGraphCanvasPanelComponent implements OnInit, OnChanges, OnDestroy {
  @Input() graph: string = 'uno-sim-rig-graph';
  /** demo-4b: when set, opens the REAL HardwareSolution drawing by name instead of a synthetic atoms-only solution
   * (its SolutionDefinition already carries the mixed board/bridge/backend nodes — see the class doc above). */
  @Input() solution: string = '';
  /** fs-2d (his ask, verbatim: "our tasks to be linked to their no-code solutions that compose them"): the node
   * (CGraphNode instance) to focus once the solution is open — a Firmware Solutions Tasks row's own "Composed by"
   * link sets this via ?node= on THIS panel's own URL (/display/c-canvas?graph=<g>&node=<n>, read directly off
   * ActivatedRoute in ngOnInit — never the generic {object}/{scope:} page-input substitution display-page.ts
   * drives, which has no per-query-param mechanism and is not touched by this). Best-effort: scrolls to and
   * outlines the node's own SVG group (the same `data-state-name` attribute custom-no-code.ts's own overlay
   * already stamps, getStateGroupElement) — no new editor selection API, no risk to the shared no-code canvas. */
  @Input() node: string = '';

  /** selfix round 3 (2026-10-05): the embedded canvas, so we can reset its view after opening a
   *  solution — Recenter (resetZoom()) is an identity-transform reset, never a "fit to content",
   *  so this is belt-and-suspenders alongside the taller default host height below; it still
   *  helps if a prior interaction left the view panned/zoomed. */
  @ViewChild(CustomNoCodeComponent) private canvas?: CustomNoCodeComponent;

  graphs: GraphRow[] = [];
  error = '';
  busy = '';
  renderResult: any = null;
  buildResult: any = null;
  proveResult: any = null;
  lastBuild: GlueBuildRow | null = null;
  /** demo-4b: one lane per runtime present in the currently-open solution, + the edges that cross lanes */
  lanes: LaneInfo[] = [];
  crossings: CrossingInfo[] = [];

  private destroy$ = new Subject<void>();

  constructor(
    private http: HttpClient,
    private polariService: PolariService,
    private solutionState: NoCodeSolutionStateService,
    private route: ActivatedRoute,
  ) {}

  private get base(): string { return this.polariService.getBackendBaseUrl(); }
  private get headers(): any { return (this.polariService.backendRequestOptions as any)?.headers; }

  ngOnInit(): void {
    // fs-2d: ?graph=&node= on this panel's OWN url (a direct /display/c-canvas link, or embedded on a page that
    // forwards its own query string) win over the @Input defaults — read once, synchronously, off the snapshot
    // (no subscription: a later in-page query-param change comes through as a normal @Input via ngOnChanges).
    const qp = this.route.snapshot.queryParamMap;
    const g = qp.get('graph');
    const n = qp.get('node');
    if (g) { this.graph = g; }
    if (n) { this.node = n; }
    this.loadGraphs();
    // selfix round 3 (2026-10-05): WE call initializeFromBackend() now — the embedded
    // <custom-no-code syncUrl="false"> no longer does (see its ngOnInit). On a true fresh page
    // load nothing had called it yet, so loading$'s initial value was already `false`
    // (its own default) — our OLD take(1) below fired on THAT stale "already false" immediately,
    // before any real backend data existed, so openSolutionFor() warned-and-no-opped. The embedded
    // <custom-no-code>'s OWN initializeFromBackend() call (its ngOnInit runs AFTER ours per
    // Angular's parent-before-child lifecycle order) then "won" with its own default-first-solution
    // pick once the real fetch completed. Calling it HERE, first, makes loadingSubject.next(true)
    // happen before we subscribe, so take(1) reliably waits for the REAL completion.
    this.solutionState.initializeFromBackend();
    // Even so, initializeFromBackend()'s OWN re-select-on-load runs synchronously, NESTED inside
    // the same loadingSubject.next(false) call that fires our subscriber below (BehaviorSubject
    // notifies synchronously) — so our openSolutionFor() would run BEFORE the rest of that
    // function's default-reselect logic and still get clobbered by it. Deferring to a microtask
    // guarantees we run strictly after every synchronous reaction to this loading$ transition,
    // so OUR selection (a `solution` input, or the synthesized c-canvas one) is the one left
    // standing — never a second, persistent subscription per call (pick()/ngOnChanges open
    // directly; loading is already settled by then).
    this.solutionState.loading$.pipe(filter((loading: boolean) => !loading), take(1), takeUntil(this.destroy$))
      .subscribe(() => { Promise.resolve().then(() => { this.openSolutionFor(this.graph); if (this.node) { this.focusNode(this.node); } }); });
  }

  ngOnChanges(changes: SimpleChanges): void {
    const graphChanged = changes['graph'] && !changes['graph'].firstChange;
    const solutionChanged = changes['solution'] && !changes['solution'].firstChange;
    const nodeChanged = changes['node'] && !changes['node'].firstChange;
    if (graphChanged || solutionChanged) {
      this.openSolutionFor(this.graph);
      if (this.node) { this.focusNode(this.node); }
    } else if (nodeChanged && this.node) {
      this.focusNode(this.node);
    }
  }

  /** fs-2d: best-effort DOM focus for ?node= — scroll it into view and outline it briefly. Reads the SAME
   * `data-state-name` attribute custom-no-code.ts's own node overlay already stamps on every rendered state group
   * (its private getStateGroupElement) — a plain DOM query, no new editor API. A 600ms delay gives the canvas time
   * to finish (re)rendering after openSolutionFor's backend round trip; if the node never appears (wrong name, or
   * the canvas is still loading), this silently no-ops rather than erroring. */
  private focusNode(name: string): void {
    setTimeout(() => {
      const svg = document.getElementById('d3-graph');
      const group = svg?.querySelector(`g[data-state-name="${(window as any).CSS?.escape ? CSS.escape(name) : name}"]`) as SVGGElement | null;
      if (!group) { return; }
      group.scrollIntoView?.({ behavior: 'smooth', block: 'center', inline: 'center' });
      const prevOutline = group.style.outline;
      group.style.outline = '3px solid #1565c0';
      group.style.outlineOffset = '2px';
      setTimeout(() => { group.style.outline = prevOutline; }, 2500);
    }, 600);
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

  /**
   * demo-4b's ADAPTER: with a `solution` input, open that REAL, already-seeded HardwareSolution drawing by name
   * (never re-synthesized). Otherwise ensure (once) and select the atoms-only SolutionDefinition built from the
   * CGraph's own rows — one c-atom node PER CGraphNode, never a single collapsed HardwareSubgraph wrapper.
   */
  private openSolutionFor(graph: string): void {
    // persist=false on every selectSolution() call in this method (selfix 2026-10-05,
    // prf-urgent): this panel shares the GLOBAL NoCodeSolutionStateService singleton with
    // /custom-no-code. Selecting through it with the default persist=true was writing this
    // panel's choice into localStorage as the user's cross-page "last selected solution" —
    // visiting /display/hardware-solutions (which opens `uno-temp-split`) then reloading
    // /custom-no-code restored `uno-temp-split` instead of whatever the URL/dropdown asked for,
    // with an empty canvas because that solution has nothing to do with the requested object.
    if (this.solution) {
      this.solutionState.selectSolution(this.solution, false);
      this.applyLanes(this.solution);
      return;
    }
    const name = this.solutionName(graph);
    if (this.solutionState.getSolutionData(name)) {
      this.solutionState.selectSolution(name, false);
      this.applyLanes(name);
      return;
    }
    this.http.get<any>(`${this.base}/api/cmod/graphs/${encodeURIComponent(graph)}`, { headers: this.headers }).subscribe({
      next: (r: any) => {
        this.buildAtomsSolution(name, r?.nodes || [], r?.edges || []);
        this.solutionState.selectSolution(name, false);
        this.applyLanes(name);
      },
      error: () => {
        // degrades: the graph detail could not be fetched — an empty solution still gives the canvas something to open
        if (!this.solutionState.getSolutionData(name)) {
          this.solutionState.createNewSolution(name, { targetRuntime: 'typescript_frontend' as any });
        }
        this.solutionState.selectSolution(name, false);
      },
    });
  }

  /** ONE c-atom canvas node per CGraphNode (the glue's class/parser/frame/tick/rule kinds come through read-only),
   * wired by CGraphEdge — the real atoms, all in the c-device lane; created once (`ensure`), never duplicated. */
  private buildAtomsSolution(name: string, nodes: CGraphNodeRow[], edges: CGraphEdgeRow[]): void {
    this.solutionState.createNewSolution(name, { targetRuntime: 'typescript_frontend' as any });
    const perRow = 4;
    nodes.forEach((n, i) => {
      const stateName = n.instance;
      this.solutionState.addStateToSolution(name, {
        stateName, id: stateName, index: i, shapeType: 'rectangle', solutionName: name,
        stateClass: 'CAtom', boundObjectClass: 'CAtom',
        boundObjectFieldValues: {
          displayName: n.instance,
          atom: n.kind === 'c-atom' ? n.atom : n.kind, stage: n.stage || '',
          bindings: n.kind === 'c-atom' ? (n.bindings || '') : (n.params || ''),
        },
        // selfix round 3 2026-10-05: stateSvgWidth/stateSvgHeight (NOT stateSvgSizeX/Y —
        // RectangleStateLayer.ts never reads that field, falling back to a bare 20×20 stub) +
        // cornerRadius, matching the AdditionTester seed's own rectangle-state convention.
        stateSvgWidth: 160, stateSvgHeight: 90, cornerRadius: 8, stateSvgRadius: null, layerName: 'rectangle-layer',
        stateLocationX: 80 + (i % perRow) * 220, stateLocationY: 80 + Math.floor(i / perRow) * 150, stateSvgName: 'rectangle',
        slots: [
          { index: 0, stateName, slotAngularPosition: 180, connectors: [], isInput: true, allowOneToMany: false, allowManyToOne: true, label: 'in' },
          { index: 1, stateName, slotAngularPosition: 0, connectors: [], isInput: false, allowOneToMany: true, allowManyToOne: false, label: 'out' },
        ] as any,
        slotRadius: 5, backgroundColor: RUNTIME_COLORS['c-device'],
        notes: n.kind === 'c-atom' ? '' : 'glue-generated (read-only) — cmod-glue owns this node\'s C',
      } as any);
    });
    const known = new Set(nodes.map(n => n.instance));
    edges.forEach(e => {
      if (known.has(e.from_node) && known.has(e.to_node)) {
        this.solutionState.addConnector(name, e.from_node, 1, e.to_node, 0);
      }
    });
  }

  /** demo-4b: group the currently-open solution's states into one lane per runtime present (a coloured legend + a
   * lane-column layout — no new editor layer, just the service's own position/colour updates), and list the edges
   * that cross lanes as "crossing interfaces". */
  private applyLanes(name: string): void {
    const states = this.solutionState.getSolutionStateInstances(name) || [];
    if (!states.length) { this.lanes = []; this.crossings = []; return; }
    const runtimeOf: Record<string, string> = {};
    const byRuntime: Record<string, any[]> = {};
    states.forEach((s: any) => {
      // selfix 2026-10-05: a state tagged with its own Runtime (set from custom-no-code's "New
      // state runtime" picker when created) wins outright — only fall back to the class-based
      // inference for states that predate the picker / weren't created through it.
      const rt = (s.runtime && RUNTIME_COLORS[s.runtime]) ? s.runtime : runtimeForClass(s.stateClass || s.boundObjectClass || '');
      runtimeOf[s.stateName] = rt;
      (byRuntime[rt] = byRuntime[rt] || []).push(s);
    });
    const present = LANE_ORDER.filter(rt => byRuntime[rt]?.length);
    this.lanes = present.map(rt => ({ runtime: rt, count: byRuntime[rt].length, color: RUNTIME_COLORS[rt] }));
    const positions: { stateName: string; x: number; y: number }[] = [];
    present.forEach((rt, laneIdx) => {
      byRuntime[rt].forEach((s: any, i: number) => {
        positions.push({ stateName: s.stateName, x: 80 + laneIdx * 260, y: 60 + i * 150 });
        this.solutionState.updateStateInstance(name, s.stateName, { backgroundColor: RUNTIME_COLORS[rt] } as any);
      });
    });
    if (positions.length) this.solutionState.updateStatePositions(name, positions);
    const crossings: CrossingInfo[] = [];
    states.forEach((s: any) => {
      (s.slots || []).forEach((slot: any) => {
        (slot.connectors || []).forEach((c: any) => {
          const a = runtimeOf[s.stateName], b = runtimeOf[c.targetStateName];
          if (a && b && a !== b) crossings.push({ from: s.stateName, to: c.targetStateName, fromRuntime: a, toRuntime: b });
        });
      });
    });
    this.crossings = crossings;
    // selfix round 3 (2026-10-05): reset the embedded canvas's view after (re)opening a
    // solution — belt-and-suspenders alongside the taller default host height (above); the view
    // itself may already be live by the time this first runs, so this is a microtask-deferred,
    // best-effort nudge, never a hard dependency.
    Promise.resolve().then(() => this.canvas?.resetZoom());
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
