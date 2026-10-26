import { registerDisplayComponent } from '@models/dashboards/ComponentRegistry';
import { ZonesBoardComponent } from '@components/zones/zones-board.component';
import { ApiJsonPanelComponent } from './api-json-panel.component';
import { ApiStructuredPanelComponent } from './api-structured-panel.component';
import { ApiSvgPanelComponent } from './api-svg-panel.component';
import { BlockDetailPanelComponent } from './block-detail-panel.component';
import { CellDetailPanelComponent } from './cell-detail-panel.component';
import { CellLogicDiagramComponent } from './cell-logic-diagram.component';
import { CellSchematicComponent } from './cell-schematic.component';
import { CardsComponent } from './cards.component';
import { ClassRowsTableComponent } from './class-rows-table.component';
import { PickerButtonComponent } from './picker-button.component';
import { StepsComponent } from './steps.component';
import { DoorFormComponent } from './door-form.component';
import { EvidenceBrowserComponent } from './evidence-browser.component';
import { FetCharacteristicExplorerComponent } from './fet-characteristic-explorer.component';
import { FetOverviewComponent } from './fet-overview.component';
import { FetParts2dComponent } from './fet-parts-2d.component';
import { FirmwareInstallerPanelComponent } from './firmware-installer-panel.component';
import { FirmwareSolutionPanelComponent } from './firmware-solution-panel.component';
import { HardwarePinViewComponent } from './pin-view/hardware-pin-view.component';
import { HardwareLayoutViewComponent } from './layout-view/hardware-layout-view.component';
import { CustomNoCodeComponent } from '../../custom-no-code/custom-no-code';
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
        + 'class, e.g. board readiness, same columns/format/filter rules; '
        + 'fsc-3 row interaction, all optional: selectField+selectScope make a row '
        + 'click set a page-scope key (click again or Escape clears; selectedValue '
        + 'is `{scope:key}`), rowLinkTabField opens the page tab named by that row '
        + 'field, emptyText is shown instead of a fetch while a dataPath param is '
        + 'still blank)',
      defaultInputs: { className: '', columns: '', maxRows: 0, columnFormats: '', filterField: '', filterValue: '', dataPath: '',
                       selectField: '', selectScope: '', selectedValue: '', rowLinkTabField: '', emptyText: '' },
    });

  // wb-1 (D-wb-1): three generic display kinds - JSON shapes in class-rows-cards.ts
  registerDisplayComponent(
    'cards', CardsComponent, {
      displayName: 'Cards (rows as a card grid)',
      description: 'A door\'s rows as responsive cards: title/subtitle/badge chips/label-value rows, optional group_by headings, '
        + 'facet chips that re-query the door (?query_param=value, click again clears), one action button per card '
        + '(a RowActionConfig); -1 / unverified render as the word "unverified" (inputs: dataPath, title_field, subtitle_field, '
        + 'badge_fields, fields, group_by, facets, action, empty_text)',
      defaultInputs: { dataPath: '', title_field: '', subtitle_field: '', badge_fields: [], fields: {}, group_by: '', facets: [], action: null, empty_text: '' },
    });

  registerDisplayComponent(
    'picker-button', PickerButtonComponent, {
      displayName: 'Picker button (opens a cards modal)',
      description: 'A button opening a modal with a nested `cards` config; card actions run inside it, bump page scope rev, and the '
        + 'modal stays open (inputs: label, title, popup = a cards config)',
      defaultInputs: { label: '', title: '', popup: null },
    });

  registerDisplayComponent(
    'steps', StepsComponent, {
      displayName: 'Steps (step strip from page scope)',
      description: 'Ordered steps shown done / current / todo, derived from page scope (done_when scope_key written as {scope:key}, '
        + 'op set|gte); a step\'s optional target opens that page tab (input: steps)',
      defaultInputs: { steps: [] },
    });

  // wb-3: a configured form that posts to ONE door (the `form` item runs a no-code solution - a different contract)
  registerDisplayComponent(
    'door-form', DoorFormComponent, {
      displayName: 'Door form (typed inputs → one POST/PUT)',
      description: 'Typed inputs submitted as one RowActionConfig through the shared action runner: then_scope + rev on success, '
        + 'refusal words shown and inputs kept on failure, required fields block submit (inputs: fields, action, submit_label, success_text)',
      defaultInputs: { fields: [], action: null, submit_label: '', success_text: 'Done.' },
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

  // demo1b (his 2026-10-04 verdict: "many rows of data with no demonstratables"): the ONE generic drawing panel,
  // reused three times (/display/board-layout, /display/board-schematic, /display/boards) — never a per-page
  // image component. See api-svg-panel.component.ts's own doc comment for the dataPath/markersPath contract.
  registerDisplayComponent(
    'api-svg-panel', ApiSvgPanelComponent, {
      displayName: 'API SVG panel (drawings)',
      description: 'GET dataPath — a JSON selector {items:[{label,url}]}, a single {url}, or the raw <svg> '
        + 'document itself — and render the chosen SVG inline (sanitized), with an optional selector when '
        + 'there is more than one; optional markersPath GETs {items:[{x,y,label,severity}]} (e.g. DRC/ERC '
        + 'positions) drawn as circles over the drawing when its own viewBox can be read (inputs: dataPath, '
        + 'optional markersPath)',
      defaultInputs: { dataPath: '', markersPath: '' },
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

  // ucd-hdr (his ruling 2026-10-10): the canvas's own header (custom-no-code) now carries a
  // runtime-scoped command group instead of a wrapping panel — demo-4's c-graph-canvas-panel is
  // DELETED (its CGraph picker / Render-Build-Prove doors / lanes legend moved into custom-no-code
  // itself, shown when its `graph` input derives the Runtime select to c-device). /display/c-canvas
  // (cmod_page.py's `_canvas()`) places THIS component directly (input: graph).
  registerDisplayComponent(
    'custom-no-code', CustomNoCodeComponent, {
      displayName: 'No-code canvas (Object/Solution header, runtime-scoped commands)',
      description: 'The ONE no-code canvas, with its header\'s Runtime select DERIVED from the loaded Object/'
        + 'Solution (a `graph` input is a cmod CGraph — C on the device by construction, RULE 2 — so the '
        + 'Runtime select derives to c-device and the header\'s c-device command group shows: a CGraph picker, '
        + 'Render/Build/Prove over cmod\'s own doors, the render/build/prove verdict and the runtime lanes '
        + 'legend; any other loaded solution keeps only the controls common to every runtime). (inputs: graph, '
        + 'default uno-sim-rig-graph; optional node to focus a CGraphNode)',
      defaultInputs: { graph: 'uno-sim-rig-graph' },
    });

  // fs-1 (DEMONSTRABLES_PLAN.md §9) + fs-2b (his renames/rulings 2026-10-06) — the firmware canvas, first item on
  // /display/firmware-solutions. THE ONE NEW COMPONENT this slice adds: a configured table cannot host a solution
  // picker, the collapsible section layout, the valid-targets overlay, or the pin-map drag (D-fs-2). GET
  // {solutionsPath}/{name} (fs-0's shape, now carrying unregistered_tasks/registered_tasks, fs-2a) drives FOUR
  // collapsible sections — Unregistered Tasks, Schedule (the four DERIVED lanes, D-fs-1), Pin map, and Target
  // details — shown All four / maximised to One / paired as Two (a toolbar preset, persisted per-viewer under
  // ONE localStorage key). Clicking an Unregistered Task calls the valid-targets door (fs-2a) and colours every
  // pin green/grey/amber (valid/invalid/undetermined), cooperating vs conflicting registrations named from the
  // door's own fields; a drop on an invalid pin never POSTs. Clicking a pin calls its register-detail door and
  // shows SoC pin/port/alternate-functions/limits/Registered Tasks/applicable compatibility rows, all cited.
  registerDisplayComponent(
    'firmware-solution-panel', FirmwareSolutionPanelComponent, {
      displayName: 'Firmware solution canvas (Unregistered Tasks · Schedule · Pin map · Target details)',
      description: 'Pick a FirmwareSolution (GET solutionsPath): four collapsible sections — Unregistered Tasks '
        + '(name, kind, ports, resources, cost, lane; draggable chips), Schedule (four DERIVED lanes, D-fs-1 — '
        + 'never authored, called tasks nested under their caller), Pin map (the board\'s own pinmap.svg, bound '
        + 'pins outlined by lane colour), and Target details (fs-2a: a selected task\'s valid-targets verdicts, '
        + 'or a selected pin\'s register detail + Registered Tasks + applicable compatibility rows) — a toolbar '
        + 'preset shows All four / maximises One / pairs Two, persisted per-viewer. Dragging a chip onto a pin '
        + '(or select + click, keyboard fallback) checks the valid-targets door FIRST — an invalid drop is '
        + 'refused and named, never posted; a 422 the backend still returns shows its own reason '
        + '(inputs: solutionsPath, optional initial)',
      defaultInputs: { solutionsPath: '/api/firmware/solutions', initial: 'uno-sim-rig' },
    });

  // pv-1 (PIN_VIEW_PLAN.md, his explicit exception to "no new custom components", 2026-10-17) — the pin view:
  // a dedicated d3 picture of a board, its chips (die in package on the board) and its parts, pins on every
  // edge. Colour = signal family (theme tokens --pin-<family>), symbol = what the pin does, fill = how far it is
  // assigned. Click a surface -> its pin-to-pin connections; click a pin -> its connections; click a connection
  // -> Drive / Signal / Use as three separate sections. Reads GET /api/board/{board}/pin-view (names only);
  // never writes, never navigates, never touches the global selection. Its side panels are lists and tables.
  registerDisplayComponent(
    'hardware-pin-view', HardwarePinViewComponent, {
      displayName: 'Pin view (boards, chips and parts with their pins)',
      description: 'A d3 picture of a board with each chip\'s package and die nested inside it and the parts beside it, '
        + 'pins on every edge: colour = signal family, symbol = what the pin does, fill = assigned or not. Click a '
        + 'board, package, die or part to see its pin-to-pin connections; click a pin, then a connection, to read '
        + 'Drive (electricity), Signal (outputs, inputs, protocol) and Use (tasks, Purposes) separately. Filters: '
        + 'composition stage, firmware binding, protocol or protocol set, show unassigned '
        + '(inputs: board, system, binding, stage)',
      defaultInputs: { board: 'arduino-uno-r3', system: 'uno-light-system', binding: '', stage: 'base' },
    });

  // lay-2 / sim-3 (PROTOTYPING_VIEWS_PLAN section 3, D-ptv-1) — the layout view: ONE generic N-board renderer (d3/SVG like the pin view), the second and last sanctioned custom component
  // for layouts. Draws every board from its model's geometry (breadboard half/full, the UNO's headers), parts as 2-D sprites derived from geometry (resistor colour bands from its value,
  // LED with its flat side and long leg, pushbutton, potentiometer, TMP36, transistor, a generic one for the rest) and wires as curves in their EFFECTIVE colour. Click a hole / part / wire
  // to see its net and row; click again or Escape clears. mode=build adds step mode (?step=); mode=bench binds the picture to a twin session (overlays derived on the server from each
  // KitPart's interface kind; outputs follow the watched pins). Reads GET /api/layout/{config}; posts only to a session's inject door.
  registerDisplayComponent(
    'hardware-layout-view', HardwareLayoutViewComponent, {
      displayName: 'Layout view (N boards, parts as sprites, wires as curves; build steps or a live simulated bench)',
      description: 'A d3 picture of the boards a build is laid out on, drawn from their geometry, with the parts as small pictures and the wires in their scheme colours. Click a hole, part or wire '
        + 'to see its net and row (click again or press Escape to clear). Build mode steps through the build (previous / next / whole build, kept in ?step=). Bench mode binds the picture to a '
        + 'simulated board session: press the pushbutton, turn the knob, set the temperature, and the LED follows the board '
        + '(inputs: dataPath, stepsPath, mode build|bench, config, board, scheme, session)',
      defaultInputs: { dataPath: '/api/layout/{config}', stepsPath: '/api/layout/steps', mode: 'build', config: 'uno-light', board: '', scheme: '', session: '' },
    });
}
