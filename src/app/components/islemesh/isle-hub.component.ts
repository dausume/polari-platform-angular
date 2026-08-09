/**
 * /isle — the unified isle hub (handoff §32). The ISLE app store is
 * the GENUINE store (Dustin); the polari app store is PROJECTED in
 * from polari when a polari instance is available (polari-app
 * catalog entries). One app, tabs: App store (catalog/install) +
 * Topology (the live isle graph). The native shell opens this; the
 * same page works in a plain browser.
 */
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';

import { IsleStoreComponent } from './isle-store.component';
import { IsleMeshGraphComponent } from
  './isle-mesh-graph.component';

@Component({
  selector: 'app-isle-hub',
  standalone: true,
  imports: [
    CommonModule, MatTabsModule, MatIconModule,
    IsleStoreComponent, IsleMeshGraphComponent,
  ],
  template: `
    <div class="isle-hub">
      <mat-tab-group animationDuration="0ms"
                     [selectedIndex]="tab"
                     (selectedIndexChange)="tab = $event">
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon>storefront</mat-icon>&nbsp;App store
          </ng-template>
          <app-isle-store *ngIf="tab === 0"></app-isle-store>
        </mat-tab>
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon>hub</mat-icon>&nbsp;Topology
          </ng-template>
          <app-isle-mesh-graph *ngIf="tab === 1">
          </app-isle-mesh-graph>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [`
    .isle-hub { height: 100%; }
    ::ng-deep .isle-hub .mat-mdc-tab-body-wrapper { height: 100%; }
    mat-icon { vertical-align: middle; }
  `],
})
export class IsleHubComponent {
  tab = 0;
}
