import { registerDisplayComponent } from '@models/dashboards/ComponentRegistry';
import { ZonesBoardComponent } from '@components/zones/zones-board.component';
import { ApiJsonPanelComponent } from './api-json-panel.component';
import { ApiStructuredPanelComponent } from './api-structured-panel.component';
import { BlockDetailPanelComponent } from './block-detail-panel.component';
import { CellDetailPanelComponent } from './cell-detail-panel.component';
import { CellLogicDiagramComponent } from './cell-logic-diagram.component';
import { CellSchematicComponent } from './cell-schematic.component';
import { ClassRowsTableComponent } from './class-rows-table.component';
import { EvidenceBrowserComponent } from './evidence-browser.component';
import { FetCharacteristicExplorerComponent } from './fet-characteristic-explorer.component';
import { FetOverviewComponent } from './fet-overview.component';
import { FetParts2dComponent } from './fet-parts-2d.component';
import { FirmwareInstallerPanelComponent } from './firmware-installer-panel.component';
import { CGraphCanvasPanelComponent } from './c-graph-canvas-panel.component';
import { FreedomProofPanelComponent } from './freedom-proof-panel.component';
import { MicrochipLadderComponent } from './microchip-ladder.component';
import { NamedGraphPanelComponent } from './named-graph-panel.component';
import { PipelineSetupPanelComponent } from './pipeline-setup-panel.component';
import { SecurityThreatSimComponent } from './security-threat-sim.component';
import { TensorTreePanelComponent } from './tensor-tree-panel.component';

let registered = false;

/**
 * Registers the two GENERIC no-code page building blocks (same lazy
 * pattern as registerMsciDisplayComponents). Together they make any
 * backend module surfaceable by seeding a DisplayDefinition alone:
 * class-rows-table renders any class's live CRUDE rows, api-json-panel
 * renders any GET endpoint's verdict/report. See
 * polariApiServer/module_pages_seed.py for the pages built from them.
 */
export function registerGenericDisplayComponents(): void {
  if (registered) return;
  registered = true;

  registerDisplayComponent(
    'class-rows-table', ClassRowsTableComponent, {
      displayName: 'Class Rows Table',
      description: 'Live CRUDE rows of any backend class as a table '
        + '(inputs: className, optional columns csv, optional maxRows, '
        + 'optional columnFormats csv of column:format — `person` renders a '
        + 'Keycloak subject id shortened, with the name resolved at render '
        + 'time through the gated people door; optional filterField/'
        + 'filterValue — filterValue may be a csv SET; optional dataPath — '
        + 'GET {ok, rows} of already-computed records instead of a live '
        + 'class, e.g. board readiness, same columns/format/filter rules)',
      defaultInputs: { className: '', columns: '', maxRows: 0, columnFormats: '', filterField: '', filterValue: '', dataPath: '' },
    });

  registerDisplayComponent(
    'zones-board', ZonesBoardComponent, {
      displayName: 'Rooms/Zones Board',
      description: 'Horizontal bar of a site\'s rooms with the zones '
        + 'defined in each — room vs selected volumes, cube counts, '
        + 'per-zone estimate drill-in. Overlay-free DOM, so it also '
        + 'mounts as an XR HTMLMesh panel (no inputs — site picker '
        + 'built in)',
      defaultInputs: {},
    });

  registerDisplayComponent(
    'api-json-panel', ApiJsonPanelComponent, {
      displayName: 'API JSON Panel',
      description: 'GET a backend path and render flat fields as '
        + 'key/values + nested structure as JSON (input: path)',
      defaultInputs: { path: '' },
    });

  registerDisplayComponent(
    'api-structured-panel', ApiStructuredPanelComponent, {
      displayName: 'API structured panel (chips / tables)',
      description: 'GET a backend path, optionally descend to a '
        + 'dot-path (pick, e.g. idealTable or ranking) and render it '
        + 'through structured-payload-panel: scalars as chips, prose '
        + 'as paragraphs, record arrays as tables, nested objects as '
        + 'key/value — no JSON blobs; ok:false errors verbatim '
        + '(inputs: path, optional title, pick, hideKeys)',
      defaultInputs: { path: '', title: '', pick: '', hideKeys: [] },
    });

  registerDisplayComponent(
    'fet-overview', FetOverviewComponent, {
      displayName: 'FET overview (generic, all FETs)',
      description: 'One display for every FET (CNT or Si): header '
        + 'chips (technology, polarity, shape, optimization class, '
        + 'usable / candidate / reference, proof status), key numbers '
        + 'vs ideal with normalized bars, validity proofs, operating '
        + 'regions, sub-displays chosen by the device\'s own '
        + 'optimization class (switching: transfer-states + score '
        + 'terms + power; signal: signal terms + output states + '
        + 'signal score), transport regime line, competitive ranking, '
        + 'cell coverage, freedom proof, links strip (input: device)',
      defaultInputs: { device: '' },
    });

  registerDisplayComponent(
    'security-threat-sim', SecurityThreatSimComponent, {
      displayName: 'Security Threat Simulation',
      description: 'A threat played on the security topology: a red token '
        + 'crosses each boundary (stock docker / qemu / Polari) until a policy '
        + 'blocks it, and the green counterexample beside it shows which '
        + 'actor, group or permission legitimately reaches the same target; '
        + 'mode replays it under stock, today, complain or enforce '
        + '(inputs: path, scenario, mode)',
      defaultInputs: { path: '/api/security/threats', scenario: '', mode: 'today' },
    });

  registerDisplayComponent(
    'named-graph-panel', NamedGraphPanelComponent, {
      displayName: 'Named Graph Panel',
      description: 'One GraphDefinition row (by name) rendered '
        + 'through the original graphs machinery '
        + '(graph-renderer/PlotFigure) — configurable in the '
        + 'Graphs editor; optional dataPath GETs {ok, rows} '
        + '(refusals render verbatim), else CRUDE rows of the '
        + 'definition\'s source_class (inputs: graphName, '
        + 'dataPath)',
      defaultInputs: { graphName: '', dataPath: '' },
    });

  registerDisplayComponent(
    'tensor-tree-panel', TensorTreePanelComponent, {
      displayName: 'Tensor Tree',
      description: 'A TensorTree drawn for intuition (tt-5): the rooted '
        + 'structure as a d3 tree (resolved nodes solid, unresolved spaces '
        + 'dashed with their kind), mappings as arcs that may cross branches '
        + 'coloured by evidence level, a node\'s dimensions -> visual channels, '
        + 'and the cycle select -> discover -> map (a selection is a row) '
        + '(optional input: treeName)',
      defaultInputs: { treeName: '' },
    });

  registerDisplayComponent(
    'microchip-ladder', MicrochipLadderComponent, {
      displayName: 'Microchip Design Ladder',
      description: 'Traverse the design-level ladder (device -> '
        + 'cell -> block -> core -> chip): design picker, level '
        + 'rail with live/refusing rungs, click-to-traverse nodes '
        + 'with resolved artifact + citation links (optional '
        + 'input: design)',
      defaultInputs: { design: '' },
    });

  registerDisplayComponent(
    'fet-parts-2d', FetParts2dComponent, {
      displayName: 'FET 2-D parts view (generic, all FETs)',
      description: 'GET /api/fet/device/{device}/parts2d and draw '
        + 'the region rectangles in device coordinates (nm): hover '
        + 'a region for its part card (material, doping, purpose, '
        + 'the row it comes from), field overlay at the device\'s '
        + 'own Vdd with Vg/Vd sliders, sketch dimensions dashed and '
        + 'labelled; refusals verbatim (inputs: device, optional '
        + 'compact)',
      defaultInputs: { device: '', compact: false },
    });

  registerDisplayComponent(
    'fet-characteristic-explorer', FetCharacteristicExplorerComponent, {
      displayName: 'FET characteristic explorer',
      description: 'Grouped list of a device\'s characteristics; the '
        + 'selected one renders its description, performance '
        + 'meaning, equation, related chips, citations and its '
        + 'backend-resolved views through named-graph-panel / '
        + 'api-json-panel / sim-space-viewer (inputs: device, '
        + 'optional listPath, initialKey, hideUnbuilt)',
      defaultInputs: { device: '', hideUnbuilt: false },
    });

  registerDisplayComponent(
    'block-detail-panel', BlockDetailPanelComponent, {
      displayName: 'Block detail (general + FET configurations)',
      description: 'GET /api/fet/block/{key}/summary — the general '
        + 'functional block (ports, cell composition, exhaustive '
        + 'proof) with a selector over its FET configurations '
        + '(/api/fet/blockcfg/…): OpenSTA timing over that device\'s '
        + 'Liberty, power + provenance roll-ups, and the composition '
        + 'table linking down to each CellFETConfiguration; '
        + '?device= preselects (input: block)',
      defaultInputs: { block: '' },
    });

  registerDisplayComponent(
    'cell-detail-panel', CellDetailPanelComponent, {
      displayName: 'Cell detail (general + FET configurations)',
      description: 'GET /api/fet/cell/{cell}/summary and render the '
        + 'GENERAL cell (identity, proof, configuration index) with '
        + 'a selector over its FET-specific configurations '
        + '(/api/fet/cellcfg/…): score vs that FET\'s intrinsic '
        + 'limits, leakage per input state, characterize acts; '
        + 'proven-free + characterized pairings flagged OPEN-SOURCE '
        + 'SAMPLE; ?device= preselects (input: cell)',
      defaultInputs: { cell: '' },
    });

  registerDisplayComponent(
    'cell-logic-diagram', CellLogicDiagramComponent, {
      displayName: 'Cell logic diagram (boolean proof)',
      description: 'Gate-level d3 diagram of a CELL_LIBRARY cell from '
        + '/api/cntfet/cell/{cell}/logic: click inputs to toggle '
        + '(client-side DAG evaluation, wires coloured by value, '
        + 'truth-table row highlighted) or Step/Play through the '
        + 'switch-level state space comparing boolean vs switch '
        + 'output per vector; sequential cells render their state '
        + 'graph (inputs: cell, drive, optional path)',
      defaultInputs: { cell: 'cinv', drive: 1 },
    });

  registerDisplayComponent(
    'cell-schematic', CellSchematicComponent, {
      displayName: 'Cell schematic (transistor level)',
      description: 'Transistor-level d3 schematic from the cell\'s '
        + 'netlist — VDD/GND rails, p devices above the output, n '
        + 'below, nets as buses; toggle inputs (or pass '
        + 'highlightVector) to colour conducting devices and the '
        + 'Y→VDD/GND path (inputs: cell, drive, optional path, '
        + 'highlightVector)',
      defaultInputs: { cell: 'cinv', drive: 1 },
    });

  registerDisplayComponent(
    'freedom-proof-panel', FreedomProofPanelComponent, {
      displayName: 'Freedom-to-use proof (evidence chain)',
      description: 'GET a proof endpoint (/api/cntfet/device/{name}/proof '
        + 'or /api/cntfet/cell/{cell}/proof) and render subject + '
        + 'status badge + rule applied, the evidence chain as '
        + 'expandable record cards (verdict chips, fto reasoning, '
        + 'clickable evidence chips opening an inline detail drawer), '
        + 'gaps checklist, self-manufacture answer and disclaimer '
        + '(inputs: path, optional title)',
      defaultInputs: { path: '' },
    });

  registerDisplayComponent(
    'evidence-browser', EvidenceBrowserComponent, {
      displayName: 'Evidence browser (patents, papers, licences)',
      description: 'Two tabs over the evidence library: Evidence '
        + '(filter by kind / verified / search; rows open the shared '
        + 'evidence detail drawer) and Proof status (per-subject '
        + 'status table; rows load an embedded freedom-proof-panel), '
        + 'with status counts on top (inputs: optional path, '
        + 'libraryProofPath)',
      defaultInputs: {},
    });

  // ci-11a — the pipeline's setup walkthrough as a screen. The ONE component
  // his "make it a desktop app" ask needed: a configured table cannot carry a
  // button that runs a command on the machine the browser is sitting on. With
  // the desktop shell it drives `pol jenkins setup` step by step through the
  // tracked verb allowlist; in a plain browser it degrades to the mirrored
  // state from /api/cicd/setup plus the exact command per step.
  registerDisplayComponent(
    'pipeline-setup-panel', PipelineSetupPanelComponent, {
      displayName: 'Pipeline setup walkthrough',
      description: 'The build pipeline\'s setup, step by step: what each '
        + 'step is in plain words, what is true on the device now '
        + '(checks with verdicts and fixes), what it needs (questions, '
        + 'bound to the device), where to get each credential, and the '
        + 'buttons that do it — unprivileged verbs directly, privileged '
        + 'ones through the system\'s own elevation prompt, and a secret '
        + 'only ever through the application\'s native prompt. Without the '
        + 'desktop shell it shows the last pushed state read-only with the '
        + 'exact command per step (inputs: path, step, device)',
      defaultInputs: { path: '/api/cicd/setup', step: '', device: '' },
    });

  // brd-fi — the Firmware Installer App's flow (BOARD_PROGRAMMING_PLAN §7a). The ONE component
  // /display/firmware-installer needed, justified like pipeline-setup-panel: a configured table
  // cannot carry pick → build → DRY-RUN (the plan's argv verbatim) → confirm → install → the row
  // arriving → try another variant. It sends NAMES to the local server's installer doors; the
  // server runs the argv it fixed in the plan row, on the host holding the port.
  registerDisplayComponent(
    'firmware-installer-panel', FirmwareInstallerPanelComponent, {
      displayName: 'Firmware installer (variants on one board)',
      description: 'Install DIFFERENT firmware variants on one UNO (or its simavr twin) and see each '
        + 'one\'s effect: where it goes (the detected board or the twin), what to try (the '
        + 'variants with what each tests and what to watch), the builds that fit with their '
        + 'sizes vs the board\'s limits and whether they match this server\'s contracts, the '
        + 'exact command (DRY-RUN), a confirm that stays disabled until a plan exists, the '
        + 'result with the row\'s fields live and frames/s, and "try another variant" '
        + '(inputs: path, board)',
      defaultInputs: { path: '/api/board/installer', board: 'arduino-uno-r3' },
    });

  // demo-4 (DEMONSTRABLES_PLAN.md §3) — a cmod CGraph opened IN the existing no-code canvas: a configured table
  // cannot host the canvas itself, a graph picker that swaps which SolutionDefinition is open, or render/build/prove
  // buttons wired to cmod's own doors. /display/c-canvas (own page) and /display/hardware-solutions (embedded) both
  // use it (input: graph).
  registerDisplayComponent(
    'c-graph-canvas-panel', CGraphCanvasPanelComponent, {
      displayName: 'C graph canvas (open a CGraph in the no-code canvas)',
      description: 'The EXISTING no-code canvas opened on a cmod CGraph via a one-node SolutionDefinition '
        + '(a HardwareSubgraph node referencing the graph — hn-0\'s own node kind; no second editor). A '
        + 'graph picker (GET /api/cmod/graphs) swaps which CGraph is open; Render/Build/Prove call cmod\'s '
        + 'render/build/prove doors and show the verdict (graph/files sha, .hex sha + sizes, twin-equivalence) '
        + 'as badges, not JSON. Expand the subgraph node to see its atoms, ports, wires and derived target '
        + 'badges (inputs: graph, default uno-sim-rig-graph)',
      defaultInputs: { graph: 'uno-sim-rig-graph' },
    });
}
