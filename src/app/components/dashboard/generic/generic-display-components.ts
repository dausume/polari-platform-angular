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
import { FreedomProofPanelComponent } from './freedom-proof-panel.component';
import { MicrochipLadderComponent } from './microchip-ladder.component';
import { NamedGraphPanelComponent } from './named-graph-panel.component';

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
        + '(inputs: className, optional columns csv, optional maxRows)',
      defaultInputs: { className: '', columns: '', maxRows: 0 },
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
}
