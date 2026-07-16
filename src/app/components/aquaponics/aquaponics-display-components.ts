import { registerDisplayComponent } from '@models/dashboards/ComponentRegistry';
import { PotGeometryEditorComponent } from './pot-geometry-editor.component';
import { SimSpaceViewerComponent } from '@components/sim-space/sim-space-viewer/sim-space-viewer.component';

let registered = false;

/**
 * Registers the aquaponics page components with the Display component
 * registry (same lazy pattern as registerMsciDisplayComponents —
 * called from the display-page surface so these stay out of the main
 * bundle).
 */
export function registerAquaponicsDisplayComponents(): void {
  if (registered) return;
  registered = true;

  registerDisplayComponent(
    'pot-geometry-editor', PotGeometryEditorComponent, {
      displayName: 'Pot Geometry Editor',
      description: 'Edit an aqp-1 self-watering pot\'s wall/base '
        + 'thickness, overall size, and per-hole diameter/elevation/'
        + 'azimuth/bore-angle — CRUDE PUT on the durable PotDefinition/'
        + 'PotHole rows, validated before and after, then re-derives '
        + 'the math-shape render (input: potName)',
      defaultInputs: { potName: '' },
    });

  // Generic bare 3D-scene panel — NOT aquaponics-specific, but this is
  // the first Display page that needs a raw sim-space-viewer embedded
  // without msim's run-pinning wrapper (msim-scene-panel resolves
  // 'primary'/'compare' against a page-level run context that only
  // exists on the multi-scale page). Registered here since nothing
  // else claims this generic name yet; safe to re-register elsewhere
  // (registry is a last-write-wins Map).
  registerDisplayComponent(
    'sim-space-viewer', SimSpaceViewerComponent, {
      displayName: '3D Scene (bare)',
      description: 'Renders a SimSpaceDefinition\'s live scene with no '
        + 'run-pinning wrapper — for pages showing a freestanding scene '
        + '(e.g. a math-shape derivation) rather than a simulation run '
        + '(input: simSpaceName)',
      defaultInputs: { simSpaceName: '', hideRunPanel: true, clickNavigates: false },
    });
}
