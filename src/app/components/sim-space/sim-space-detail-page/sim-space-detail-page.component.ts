import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { MeetingDockComponent } from '@components/collab/meeting-dock.component';
import { SimSpaceViewerComponent } from '../sim-space-viewer/sim-space-viewer.component';
import { registerMsimDisplayComponents } from '@components/multi-scale/msim-display-components';
import { registerMsciDisplayComponents } from '@components/materials-science/msci-display-components';
import { registerAquaponicsDisplayComponents } from '@components/aquaponics/aquaponics-display-components';
import { registerVideoDisplayComponents } from '@components/video/video-display-components';

/**
 * /sim-spaces/:name — full-page viewer for one SimSpaceDefinition.
 *
 * 2026-07-14: a scene's configured initial-conditions interface (see
 * SimSpaceInitialConditionsPanelComponent) names a Display-registry
 * componentName, but registration is otherwise only wired from
 * display-page.ts (the /display/:route surface) — this page never
 * went through there, so e.g. the aquaponics pot editor resolved as
 * "not registered" here even though it works fine at /display/pot-
 * geometry. Same eager-register-the-known-set approach display-page.ts
 * already uses (small, lazy-chunked, standalone call — doesn't pull
 * these into sim-space-viewer's own shared bundle).
 */
@Component({
  standalone: true,
  selector: 'sim-space-detail-page',
  imports: [
    CommonModule, MatCardModule, MatButtonModule, MatIconModule,
    SimSpaceViewerComponent, MeetingDockComponent,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <button mat-stroked-button (click)="back()">
          <mat-icon>arrow_back</mat-icon> Back to Sim Spaces
        </button>
        <h1 *ngIf="name" class="mono">{{ name }}</h1>
      </div>

      <!-- mtg-6: voice alongside the model. Renders NOTHING unless a
           CollaborationSession row binds to this space — the binding
           is data, so this page hardcodes no meeting. -->
      <meeting-dock [ref]="'SimSpaceDefinition/' + name"></meeting-dock>

      <mat-card appearance="outlined" class="viewer-card">
        <sim-space-viewer [simSpaceName]="name"></sim-space-viewer>
      </mat-card>
    </div>
  `,
  styles: [`
    .page { padding: 16px; height: calc(100vh - 80px); display: flex; flex-direction: column; }
    .page-header {
      display: flex; align-items: center; gap: 16px; margin-bottom: 12px;
    }
    h1 { margin: 0; color: var(--mat-sys-on-surface, #1a1a1a); }
    .mono { font-family: monospace; }
    .viewer-card { flex: 1; padding: 0; overflow: hidden; }
    sim-space-viewer { display: block; width: 100%; height: 100%; min-height: 500px; }
  `]
})
export class SimSpaceDetailPageComponent implements OnInit {
  name?: string;

  constructor(private route: ActivatedRoute, private router: Router) {}

  ngOnInit(): void {
    registerMsimDisplayComponents();
    registerMsciDisplayComponents();
    registerAquaponicsDisplayComponents();
    registerVideoDisplayComponents();
    this.route.paramMap.subscribe(pm => {
      this.name = pm.get('name') ?? undefined;
    });
  }

  back(): void {
    this.router.navigateByUrl('/sim-spaces');
  }
}
