import { registerDisplayComponent } from '@models/dashboards/ComponentRegistry';
import { ZonesBoardComponent } from '@components/zones/zones-board.component';
import { ApiJsonPanelComponent } from './api-json-panel.component';
import { ClassRowsTableComponent } from './class-rows-table.component';

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
}
