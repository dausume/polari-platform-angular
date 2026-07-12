import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';

import { SimSpaceViewerComponent } from '../sim-space/sim-space-viewer/sim-space-viewer.component';
import { XrEntryBannerComponent } from './xr-entry-banner.component';
import { SimSpaceService } from '@services/sim-space/sim-space.service';

/**
 * /xr/view/:name — the slim headset-first viewer (Dustin directive
 * 2026-07-12): the 3D space, a giant BACK button, and the Enter-XR
 * bar sitting ABOVE the whole view (device capability decides the
 * bar exists — see XrEntryBannerComponent). 2D spaces get no XR
 * chatter at all (dimensionality-aware). ?msim=<name> carries the
 * multiscale cascade context from a lobby msim card.
 */
@Component({
  standalone: true,
  selector: 'xr-view-page',
  imports: [CommonModule, RouterModule, SimSpaceViewerComponent,
            XrEntryBannerComponent],
  template: `
    <div class="bar">
      <a routerLink="/xr" class="back">&#8592; Back</a>
      <h1>{{ name }}</h1>
      <span class="dim" *ngIf="dimensionality === 2">
        2D space — viewable flat, nothing to enter in XR</span>
    </div>
    <xr-entry-banner *ngIf="name"
      [spaceName]="name"
      [multiscaleName]="msim"
      [entryId]="entryId"
      [dimensionality]="dimensionality">
    </xr-entry-banner>
    <div class="stage" *ngIf="name">
      <sim-space-viewer
        [simSpaceName]="name"
        [xrMultiscaleName]="msim"
        [hideRunPanel]="true"
        [clickNavigates]="false"
        (xrEntryReady)="entryId = $event">
      </sim-space-viewer>
    </div>
  `,
  styles: [`
    /* Theme tokens — light/dark swap stays readable by pairing
       surface-* backgrounds with text-primary. */
    :host { display: flex; flex-direction: column; height: 100vh;
      background: var(--surface-app-background);
      color: var(--text-primary); }
    .bar { display: flex; align-items: center; gap: 22px;
      padding: 14px 20px; flex-wrap: wrap; }
    .back { font-size: 1.4rem; padding: 16px 30px;
      border-radius: 14px; background: var(--surface-secondary);
      color: var(--brand-blue); text-decoration: none;
      border: 2px solid var(--surface-hover); }
    h1 { font-size: 1.6rem; margin: 0; overflow-wrap: anywhere; }
    .dim { font-size: 1.05rem; color: var(--text-secondary); }
    xr-entry-banner { display: block; margin: 0 20px; }
    .stage { position: relative; flex: 1; min-height: 0;
      margin: 10px 20px 16px; }
    sim-space-viewer { display: block; height: 100%; }
  `],
})
export class XrViewPageComponent implements OnInit {

  name = '';
  msim?: string;
  entryId: string | null = null;
  /** null until the space list answers — the banner treats only an
   *  explicit 3 as 3D, so no flash of XR UI on 2D spaces. */
  dimensionality: number | null = null;

  constructor(private route: ActivatedRoute,
              private simSpace: SimSpaceService) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.name = params.get('name') ?? '';
      this.entryId = null;
      this.dimensionality = null;
      this.simSpace.list().then(rows => {
        const row = rows.find(space => space.name === this.name);
        // Backend speaks '2d' | '3d'; the banner wants 3-or-not.
        this.dimensionality =
          row ? (row.dimensionality === '3d' ? 3 : 2) : 3;
      }).catch(() => { this.dimensionality = 3; });
    });
    this.route.queryParamMap.subscribe(params => {
      this.msim = params.get('msim') ?? undefined;
    });
  }
}
