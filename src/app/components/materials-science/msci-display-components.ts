import { registerDisplayComponent } from '@models/dashboards/ComponentRegistry';
import { MaterialsBasisBrowserComponent } from './materials-basis-browser.component';
import { FormulationSearchWorkbenchComponent } from './formulation-search-workbench.component';
import { FemModelConfigComponent } from './fem-model-config.component';
import { DftModelConfigComponent } from './dft-model-config.component';
import { MaterialsHomeComponent } from './materials-home.component';
import { MaterialLevelPageComponent } from './material-level-page.component';

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

  registerDisplayComponent(
    'fem-model-config', FemModelConfigComponent, {
      displayName: 'FEM Model Configuration',
      description: 'The FEM-specific simulation interface: physics, '
        + 'domain/geometry, per-region materials (bindable to live '
        + 'rows), boundary conditions, mesh, solver, results '
        + '(input: defaultModelRef)',
      defaultInputs: { defaultModelRef: '' },
    });

  registerDisplayComponent(
    'materials-home', MaterialsHomeComponent, {
      displayName: 'Materials Home',
      description: 'The materials accountability overview: level cards '
        + 'with defined/partial/missing counts, the full materials × '
        + 'levels matrix, and links to every materials tool '
        + '(no inputs — reads the scale-presence endpoint)',
      defaultInputs: {},
    });

  registerDisplayComponent(
    'material-level-page', MaterialLevelPageComponent, {
      displayName: 'Material Scale-Level Page',
      description: 'One scale level: what it means, what earning a '
        + 'definition takes, and every material sorted into defined / '
        + 'partial / missing — each absence with the evidence-bearing '
        + 'suggestion (input: level 0-4)',
      defaultInputs: { level: 0 },
    });

  registerDisplayComponent(
    'dft-model-config', DftModelConfigComponent, {
      displayName: 'DFT Model Configuration',
      description: 'The DFT-specific simulation interface: calculation '
        + 'type, structure (molecule/bulk), method (basis/XC/charge/'
        + 'spin), accuracy (cutoff/k-points), results '
        + '(input: defaultModelRef)',
      defaultInputs: { defaultModelRef: '' },
    });
}
