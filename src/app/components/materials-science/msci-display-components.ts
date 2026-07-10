import { registerDisplayComponent } from '@models/dashboards/ComponentRegistry';
import { MaterialsBasisBrowserComponent } from './materials-basis-browser.component';
import { FormulationSearchWorkbenchComponent } from './formulation-search-workbench.component';
import { FemModelConfigComponent } from './fem-model-config.component';
import { DftModelConfigComponent } from './dft-model-config.component';
import { MdModelConfigComponent } from './md-model-config.component';
import { MesoModelConfigComponent } from './meso-model-config.component';
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
    'md-model-config', MdModelConfigComponent, {
      displayName: 'MD Model Configuration',
      description: 'The MD-specific simulation interface: system '
        + '(LJ fluid / bead-spring chains, reduced units with optional '
        + 'bindable real-material mapping), interactions (force-field '
        + 'MD shown as the named gap), ensemble/thermostat, integration '
        + 'with the O(N²) cost line, results with measured-vs-target '
        + 'honesty badges (input: defaultModelRef)',
      defaultInputs: { defaultModelRef: '' },
    });

  registerDisplayComponent(
    'meso-model-config', MesoModelConfigComponent, {
      displayName: 'Mesoscale Model Configuration',
      description: 'The mesoscale simulation interface: rod-network '
        + 'percolation (MC bisection sampling) and dipolar chaining '
        + '(Brownian dynamics with the λ-from-physics helper and the '
        + 'kinetics-limited warning); verdicts with the derived-vf_c '
        + 'vs Balberg-limit bars and the explicit use-as-threshold '
        + 'binding knob (input: defaultModelRef)',
      defaultInputs: { defaultModelRef: '' },
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
