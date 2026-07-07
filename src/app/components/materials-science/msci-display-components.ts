import { registerDisplayComponent } from '@models/dashboards/ComponentRegistry';
import { MaterialsBasisBrowserComponent } from './materials-basis-browser.component';
import { FormulationSearchWorkbenchComponent } from './formulation-search-workbench.component';

let registered = false;

/**
 * Registers the materials-science page components with the Display
 * component registry (same lazy pattern as
 * registerMsimDisplayComponents — called from the display-page surface
 * so these stay out of the main bundle).
 */
export function registerMsciDisplayComponents(): void {
  if (registered) return;
  registered = true;

  registerDisplayComponent(
    'materials-basis-browser', MaterialsBasisBrowserComponent, {
      displayName: 'Materials Basis Browser',
      description: 'Every material × scale level 0-4: definition status '
        + 'with lineage, stored engine results, thermal windows, and the '
        + 'honest live engine capability (no inputs — reads live rows)',
      defaultInputs: {},
    });

  registerDisplayComponent(
    'formulation-search-workbench', FormulationSearchWorkbenchComponent, {
      displayName: 'Formulation Search Workbench',
      description: 'Configure, run, and inspect a formulation search: '
        + 'every knob editable, refinement trajectory, winners with '
        + 'fidelity badges, explicit promote-to-L1 '
        + '(input: defaultSearchRef)',
      defaultInputs: { defaultSearchRef: '' },
    });
}
