import { registerDisplayComponent } from '@models/dashboards/ComponentRegistry';
import { PotGeometryEditorComponent } from './pot-geometry-editor.component';

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
}
