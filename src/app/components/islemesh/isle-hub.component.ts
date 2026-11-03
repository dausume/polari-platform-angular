/** /isle — Isle management, app catalog and network topology. */
import { RuntimeConfigService } from '@services/runtime-config.service';
import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';

import { IslePlacementPlanComponent } from './isle-placement-plan.component';
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
    IsleCoherenceComponent, IsleDevicesComponent, IslePlacementPlanComponent,
  ],
  template: `
    <div class="isle-hub">
      <h1 class="app-title">Isle App</h1>
      <mat-tab-group [preserveContent]="true" animationDuration="0ms"
                     [selectedIndex]="tab"
                     (selectedIndexChange)="tab = $event">
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon>storefront</mat-icon>&nbsp;App Store
          </ng-template>
          <app-isle-store *ngIf="tab === 0"></app-isle-store>
        </mat-tab>
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon>hub</mat-icon>&nbsp;Topology
          </ng-template>
          <ng-container *ngIf="tab === 1">
            <app-isle-mesh-graph></app-isle-mesh-graph>
            <app-isle-devices></app-isle-devices>
          </ng-container>
        </mat-tab>
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon>fact_check</mat-icon>&nbsp;Coherence
          </ng-template>
          <app-isle-coherence *ngIf="tab === 2">
          </app-isle-coherence>
        </mat-tab>
        <mat-tab><ng-template mat-tab-label><mat-icon>dashboard_customize</mat-icon>&nbsp;Planning</ng-template>
          <ng-template matTabContent><app-isle-placement-plan></app-isle-placement-plan></ng-template>
        </mat-tab>
        <mat-tab label="Security">
          <section style="padding: 1rem">
            <h2>Keycloak sign-in</h2>
            <p>{{ security.enabled ? 'Enabled' : 'Disabled intentionally' }}. This setting applies to this Polari frontend.</p>
            <p *ngIf="!security.enabled">Sign-in and its connection warning are disabled. Features requiring authentication remain unavailable; backend access rules still apply.</p>
            <p *ngIf="security.requiredBy.length">Required by: {{ security.requiredBy.join(', ') }}. These dependencies must be removed before disabling sign-in.</p>
            <p role="alert" *ngIf="security.configurationError">{{ security.configurationError }}</p>
            <h3>Change the deployment setting</h3>
            <p>Run on the device hosting this frontend, using its runtime configuration path. Reload the app afterward. Enabling requires a configured, reachable Keycloak service.</p>
            <pre>sudo isle polari security enable --config /path/to/runtime-config.json</pre>
            <pre>sudo isle polari security disable --config /path/to/runtime-config.json</pre>
            <p>For the initial core deployment the file is in ~/polari-isle/runtime-config.json.</p>
          </section>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [`
    .isle-hub { height: auto; }
    .app-title { padding: 1rem 1rem 0; margin: 0; }
    ::ng-deep .isle-hub .mat-mdc-tab-body-wrapper { height: auto; }
    mat-icon { vertical-align: middle; }
  `],
})
export class IsleHubComponent {
  tab = 0;
  get security() { return this.runtime.getKeycloakSecurity(); }
  constructor(route: ActivatedRoute, public runtime: RuntimeConfigService) {
    route.queryParamMap.subscribe(params=>{
      if(params.get('tab')==='planning')this.tab=3;
      else if(params.has('appType'))this.tab=0;
    });
  }
}
