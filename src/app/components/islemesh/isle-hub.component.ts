/** /isle — Isle management, app catalog and network topology. */
import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';

import { IsleDevicesComponent } from './isle-devices.component';
import { IsleStoreComponent } from './isle-store.component';
import { IsleMeshGraphComponent } from
  './isle-mesh-graph.component';
import { IsleCoherenceComponent } from
  './isle-coherence.component';

@Component({
  selector: 'app-isle-hub',
  standalone: true,
  imports: [
    CommonModule, MatTabsModule, MatIconModule,
    IsleStoreComponent, IsleMeshGraphComponent,
    IsleCoherenceComponent, IsleDevicesComponent,
  ],
  template: `
    <div class="isle-hub">
      <h1 class="app-title">Isle App</h1>
      <mat-tab-group animationDuration="0ms"
                     [selectedIndex]="tab"
                     (selectedIndexChange)="tab = $event">
        <mat-tab>
          <ng-template mat-tab-label><mat-icon>devices</mat-icon>&nbsp;Devices</ng-template>
          <app-isle-devices *ngIf="tab === 0"></app-isle-devices>
        </mat-tab>
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon>storefront</mat-icon>&nbsp;App Store
          </ng-template>
          <app-isle-store *ngIf="tab === 1"></app-isle-store>
        </mat-tab>
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon>hub</mat-icon>&nbsp;Topology
          </ng-template>
          <app-isle-mesh-graph *ngIf="tab === 2">
          </app-isle-mesh-graph>
        </mat-tab>
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon>fact_check</mat-icon>&nbsp;Coherence
          </ng-template>
          <app-isle-coherence *ngIf="tab === 3">
          </app-isle-coherence>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [`
    .isle-hub { height: 100%; }
    .app-title { padding: 1rem 1rem 0; margin: 0; }
    ::ng-deep .isle-hub .mat-mdc-tab-body-wrapper { height: 100%; }
    mat-icon { vertical-align: middle; }
  `],
})
export class IsleHubComponent {
  tab = 0;
  constructor(route: ActivatedRoute) {
    if (route.snapshot.queryParamMap.has("appType")) this.tab = 1;
  }
}
