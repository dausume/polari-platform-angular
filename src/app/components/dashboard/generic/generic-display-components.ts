import { registerDisplayComponent } from '@models/dashboards/ComponentRegistry';
import { ZonesBoardComponent } from '@components/zones/zones-board.component';
import { ApiJsonPanelComponent } from './api-json-panel.component';
import { CellLogicDiagramComponent } from './cell-logic-diagram.component';
import { CellSchematicComponent } from './cell-schematic.component';
import { ClassRowsTableComponent } from './class-rows-table.component';
import { FetCharacteristicExplorerComponent } from './fet-characteristic-explorer.component';
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
}
