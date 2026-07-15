import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ThermalProfileRow } from '@models/materials-science/materials-basis-types';

/**
 * A material's thermal processing facts in one strip: melt range,
 * smoking point, and the honest gap when no profile exists (materials
 * without smoking data refuse thermal-gated searches — that refusal
 * starts here).
 */
@Component({
  standalone: true,
  selector: 'thermal-window-strip',
  imports: [CommonModule, MatTooltipModule],
  template: `
    <span *ngIf="profile; else noProfile" class="strip"
          [matTooltip]="'Provenance: ' + (profile!.provenance || 'unrecorded')">
      melt {{ profile!.melt_low_c }}–{{ profile!.melt_high_c }}°C ·
      smoke {{ profile!.smoke_low_c }}<ng-container
        *ngIf="profile!.smoke_high_c !== profile!.smoke_low_c"
        >–{{ profile!.smoke_high_c }}</ng-container>°C
    </span>
    <ng-template #noProfile>
      <span class="strip missing"
            matTooltip="No ThermalProcessingProfile row — thermal-gated
            searches refuse combinations containing this material until
            melt + smoking data is entered.">
        no thermal profile
      </span>
    </ng-template>
  `,
  styles: [`
    .strip { font-size: 11.5px; color: #555; white-space: nowrap; }
    .strip.missing { color: #b26a00; font-style: italic; }
  `],
})
export class ThermalWindowStripComponent {
  @Input() profile: ThermalProfileRow | null = null;
}
