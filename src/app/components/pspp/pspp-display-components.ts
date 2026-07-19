import {
  registerDisplayComponent,
} from '../../models/dashboards/ComponentRegistry';
import { PsppHomeComponent } from './pspp-home.component';
import { PsppProofingComponent } from './pspp-proofing.component';
import { PsppNetworkComponent } from './pspp-network.component';
import { PsppGraderComponent } from './pspp-grader.component';
import { PsppProgressComponent } from './pspp-progress.component';
import {
  PsppDatasetChartComponent,
} from './pspp-dataset-chart.component';

let registered = false;

/** Register PSPP components for no-code display pages — a seeded or
 *  user-built DisplayDefinition can place any of these by name
 *  (pspp-dataset-chart takes a `name` input, so one component serves
 *  every dataset row). */
export function registerPsppDisplayComponents(): void {
  if (registered) { return; }
  registered = true;
  registerDisplayComponent('pspp-home', PsppHomeComponent, {
    displayName: 'PSPP Home',
    description: 'Reactive-material engine entry: catalog + links.',
  });
  registerDisplayComponent('pspp-proofing', PsppProofingComponent, {
    displayName: 'PSPP Book Proofing Charts',
    description: 'One chart per DigitizedDataset row, with evidence.',
  });
  registerDisplayComponent('pspp-network', PsppNetworkComponent, {
    displayName: 'PSPP Reaction Network',
    description: 'Species + rules as data, staged, cited.',
  });
  registerDisplayComponent('pspp-grader', PsppGraderComponent, {
    displayName: 'PSPP Composition Grader',
    description: 'Derived oxide ratios vs patent reaction windows.',
  });
  registerDisplayComponent('pspp-progress', PsppProgressComponent, {
    displayName: 'PSPP Cure Progress',
    description: 'Measured-curve cure estimates with refusals.',
  });
  registerDisplayComponent(
    'pspp-dataset-chart', PsppDatasetChartComponent, {
      displayName: 'PSPP Dataset Chart',
      description: 'One digitized dataset as a proofable chart.',
      defaultInputs: { name: 'na-glass-q-distribution-vs-mr' },
    });
}
