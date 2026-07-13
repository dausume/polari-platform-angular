import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';

import { SimSpaceViewerComponent } from '../sim-space/sim-space-viewer/sim-space-viewer.component';
import { XrEntryBannerComponent } from './xr-entry-banner.component';
import { XrPanelHostComponent } from './xr-panel-host.component';
import { SimSpaceService } from '@services/sim-space/sim-space.service';
import { XrEngineService } from '@services/xr/xr-engine.service';

/**
 * /xr/view/:name — the slim headset-first viewer (Dustin directive
 * 2026-07-12): the 3D space, a giant BACK button, and the Enter-XR
 * bar sitting ABOVE the whole view (device capability decides the
 * bar exists — see XrEntryBannerComponent). ?msim=<name> carries the
 * multiscale cascade context from a lobby msim card.
 *
 * xr-3-min: the page also mounts the OFF-SCREEN panel host — the real
 * run-panel + IC components the in-session wrist ring spawns as
 * HTMLMesh page-panels (see xr-panel-host.component).
 *
 * 2026-07-12, same-day: 2D spaces are now XR-enterable too (one big
 * HTMLMesh of the flat D3 view — xr-2d-scene-builder.ts), so the
 * panel host mounts for both dimensionalities. The lobby now links
 * to the newer, minimal-chrome /xr/enter/:name for "go straight into
 * XR"; this page stays reachable directly (still the flat-preview +
 * Enter VR experience) but is no longer the lobby's own link target.
 */
@Component({
  standalone: true,
  selector: 'xr-view-page',
  imports: [CommonModule, RouterModule, SimSpaceViewerComponent,
            XrEntryBannerComponent, XrPanelHostComponent],
  template: `
    <div class="bar">
      <a routerLink="/xr" class="back">&#8592; Back</a>
      <h1>{{ name }}</h1>
    </div>
    <xr-entry-banner *ngIf="name"
      [spaceName]="name"
      [multiscaleName]="msim"
      [entryId]="entryId"
      [dimensionality]="dimensionality">
    </xr-entry-banner>
    <div class="stage" *ngIf="name">
      <sim-space-viewer #viewerCmp
        [simSpaceName]="name"
        [xrMultiscaleName]="msim"
        [hideRunPanel]="true"
        [clickNavigates]="false"
        (xrEntryReady)="entryId = $event">
      </sim-space-viewer>
      <!-- Off-screen (position:fixed off-viewport) — placement inside
           .stage is irrelevant; it shares the *ngIf view so it can
           bind the viewer's template ref. -->
      <xr-panel-host *ngIf="dimensionality === 2 || dimensionality === 3"
        [viewer]="viewerCmp"
        [spaceName]="name">
      </xr-panel-host>
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
    xr-entry-banner { display: block; margin: 0 20px; }
    .stage { position: relative; flex: 1; min-height: 0;
      margin: 10px 20px 16px; }
    sim-space-viewer { display: block; height: 100%; }
  `],
})
export class XrViewPageComponent implements OnInit, OnDestroy {

  name = '';
  msim?: string;
  entryId: string | null = null;
  /** null until the space list answers — the banner treats only an
   *  explicit 2 or 3 as enterable, so no flash of XR UI while
   *  loading. */
  dimensionality: number | null = null;

  private engineSub?: Subscription;
  private xrWasActive = false;

  constructor(private route: ActivatedRoute,
              private router: Router,
              private simSpace: SimSpaceService,
              private xrEngine: XrEngineService) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.name = params.get('name') ?? '';
      this.entryId = null;
      this.dimensionality = null;
      this.simSpace.list().then(rows => {
        const row = rows.find(space => space.name === this.name);
        // Backend speaks '2d' | '3d'; the banner wants 2-or-3.
        this.dimensionality =
          row ? (row.dimensionality === '3d' ? 3 : 2) : 3;
      }).catch(() => { this.dimensionality = 3; });
    });
    this.route.queryParamMap.subscribe(params => {
      this.msim = params.get('msim') ?? undefined;
    });
    // Exiting XR (wrist EXIT, headset system button, device sleep —
    // every path funnels through the same session-end state
    // transition) returns to the XR home page, not this per-space
    // view (Dustin 2026-07-12).
    this.engineSub = this.xrEngine.state$.subscribe(state => {
      if (this.xrWasActive && !state.active) {
        void this.router.navigate(['/xr']);
      }
      this.xrWasActive = state.active;
    });
  }

  ngOnDestroy(): void {
    this.engineSub?.unsubscribe();
  }
}
