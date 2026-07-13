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
 * /xr/enter/:name — DIRECT XR entry (Dustin 2026-07-12): going into a
 * sim-space FROM THE XR LOBBY should mean directly entering XR, not
 * landing on a busy flat-preview page with a back button, a run
 * panel, and a scrubber that happen to also have an Enter VR button
 * somewhere on them. This page has exactly one job: get the scene
 * registered, then offer ONE big ENTER VR action. No flat mirror is
 * shown at all — the viewer mounts OFF-SCREEN (same technique
 * xr-panel-host already uses: real layout, real WebGL context, just
 * parked outside the viewport) purely to register the live scene +
 * host xr-panel-host's off-screen panels.
 *
 * WebXR technical note: entering an immersive session MUST happen
 * inside a trusted user-gesture handler — the browser rejects
 * requestSession() otherwise — so "direct" still means one tap on
 * ENTER VR, not a zero-click auto-enter. This page just makes that
 * tap the ONLY thing on screen instead of one button among many.
 *
 * /xr/view/:name (the older flat-preview page) still exists and still
 * works if reached directly; the lobby just no longer links to it.
 */
@Component({
  standalone: true,
  selector: 'xr-direct-entry-page',
  imports: [CommonModule, RouterModule, SimSpaceViewerComponent,
            XrEntryBannerComponent, XrPanelHostComponent],
  template: `
    <div class="stage">
      <a routerLink="/xr" class="back">&#8592; Back to XR home</a>
      <h1>{{ name }}</h1>
      <p class="sub" *ngIf="description">{{ description }}</p>
      <p class="sub muted" *ngIf="dimensionality !== null">
        {{ dimensionality === 3 ? '3D space' : '2D space' }}
      </p>
      <xr-entry-banner *ngIf="name"
        [spaceName]="name"
        [multiscaleName]="msim"
        [entryId]="entryId"
        [dimensionality]="dimensionality">
      </xr-entry-banner>
    </div>
    <!-- Off-screen — real layout + WebGL context (needed to register
         the scene / spawn HTMLMesh panels), never shown. -->
    <div class="offstage" *ngIf="name">
      <sim-space-viewer #viewerCmp
        [simSpaceName]="name"
        [xrMultiscaleName]="msim"
        [hideRunPanel]="true"
        [clickNavigates]="false"
        (xrEntryReady)="entryId = $event">
      </sim-space-viewer>
      <xr-panel-host *ngIf="dimensionality === 2 || dimensionality === 3"
        [viewer]="viewerCmp"
        [spaceName]="name">
      </xr-panel-host>
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column;
      align-items: center; justify-content: center; height: 100vh;
      background: var(--surface-app-background);
      color: var(--text-primary); text-align: center; }
    .stage { max-width: 640px; padding: 24px;
      display: flex; flex-direction: column; align-items: center;
      gap: 10px; }
    .back { align-self: flex-start; font-size: 1.05rem;
      padding: 10px 18px; border-radius: 12px;
      background: var(--surface-secondary); color: var(--brand-blue);
      text-decoration: none; border: 2px solid var(--surface-hover);
      margin-bottom: 14px; }
    h1 { font-size: 2rem; margin: 0; overflow-wrap: anywhere; }
    .sub { font-size: 1.15rem; color: var(--text-secondary);
      margin: 0; }
    .sub.muted { font-size: 1rem; opacity: 0.8; }
    xr-entry-banner { display: block; margin-top: 18px; width: 100%; }
    /* Real layout (offsetWidth/offsetHeight must be nonzero for the
       renderer + HTMLMesh captures) but parked off-viewport —
       display:none would yield zero-size rasters, never use it. */
    .offstage { position: fixed; left: -10000px; top: 0;
      width: 900px; height: 700px; }
    .offstage sim-space-viewer { display: block; width: 100%;
      height: 100%; }
  `],
})
export class XrDirectEntryPageComponent implements OnInit, OnDestroy {

  name = '';
  msim?: string;
  description = '';
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
      this.description = '';
      this.simSpace.list().then(rows => {
        const row = rows.find(space => space.name === this.name);
        // Backend speaks '2d' | '3d'; the banner wants 2-or-3.
        this.dimensionality =
          row ? (row.dimensionality === '3d' ? 3 : 2) : 3;
        this.description = row?.description ?? '';
      }).catch(() => { this.dimensionality = 3; });
    });
    this.route.queryParamMap.subscribe(params => {
      this.msim = params.get('msim') ?? undefined;
    });
    // Exiting XR from here returns to the XR home page, same as
    // every other XR-hosting page (Dustin 2026-07-12).
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
