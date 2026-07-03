import { registerDisplayComponent } from '@models/dashboards/ComponentRegistry';
import { MsimScenePanelComponent } from './msim-scene-panel.component';
import { MsimGraphDisplayPanelComponent } from './msim-graph-display-panel.component';
import { MsimIcDisplayPanelComponent } from './msim-ic-display-panel.component';

let registered = false;

/**
 * Registers the Multi-Scale Simulation panels with the Display component
 * registry so they can live inside any Display's nestable rows/columns
 * (the page's custom layouts, and user-built Displays generally).
 *
 * Called from the surfaces that render Displays containing these panels
 * (the multi-scale page and the standalone display page) rather than
 * app.module — the panels pull in the 3D viewer stack, which stays in
 * the lazy chunks this way instead of the main bundle.
 */
export function registerMsimDisplayComponents(): void {
  if (registered) return;
  registered = true;

  registerDisplayComponent('msim-scene-panel', MsimScenePanelComponent, {
    displayName: 'Multi-Scale 3D Scene',
    description: 'A live run-pinned 3D scene from a multi-scale simulation '
      + '(inputs: simSpaceRef, run = primary | compare | a run name)',
    defaultInputs: { run: 'primary' },
  });

  registerDisplayComponent('msim-graph-panel', MsimGraphDisplayPanelComponent, {
    displayName: 'Multi-Scale Live Graph',
    description: 'A graph of simulation data that grows while the run steps '
      + '(inputs: graphRef, sourceClass, runs)',
    defaultInputs: { runs: ['primary'] },
  });

  registerDisplayComponent('msim-ic-panel', MsimIcDisplayPanelComponent, {
    displayName: 'Initial-Condition Picker',
    description: 'A configured initial-condition interface (e.g. the bob '
      + 'material picker) that validates choices and starts runs '
      + '(input: icInterfaceRef)',
    defaultInputs: {},
  });
}
