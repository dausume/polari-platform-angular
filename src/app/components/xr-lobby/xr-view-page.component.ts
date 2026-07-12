import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';

import { SimSpaceViewerComponent } from '../sim-space/sim-space-viewer/sim-space-viewer.component';
import { SimSpaceXrButtonComponent } from '../sim-space/sim-space-viewer/sim-space-xr-button.component';

/**
 * /xr/view/:name — the slim headset-first viewer (Dustin directive
 * 2026-07-12): the full sim-space page's chrome fights headset-pad
 * navigation, so this page is just the 3D space, a giant BACK
 * button, and an oversized Enter-VR control. Reuses the real viewer
 * (its own small XR button stays — same engine, same honesty
 * matrix; the big one is the same component scaled up, wired to the
 * viewer's xrEntryReady hook). ?msim=<name> carries the multiscale
 * cascade context from a lobby msim card.
 */
@Component({
  standalone: true,
  selector: 'xr-view-page',
  imports: [CommonModule, RouterModule, SimSpaceViewerComponent,
            SimSpaceXrButtonComponent],
  template: `
    <div class="bar">
      <a routerLink="/xr" class="back">&#8592; Back</a>
      <h1>{{ name }}</h1>
    </div>
    <div class="stage" *ngIf="name">
      <sim-space-viewer
        [simSpaceName]="name"
        [xrMultiscaleName]="msim"
        [hideRunPanel]="true"
        [clickNavigates]="false"
        (xrEntryReady)="entryId = $event">
      </sim-space-viewer>
      <div class="enter">
        <span *ngIf="!entryId" class="hint">
          preparing the 3D scene…</span>
        <sim-space-xr-button *ngIf="entryId"
          [spaceName]="name"
          [multiscaleName]="msim"
          [entryId]="entryId">
        </sim-space-xr-button>
      </div>
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100vh;
      background: var(--surface-app-background, #121212);
      color: var(--text-on-dark, #fff); }
    .bar { display: flex; align-items: center; gap: 22px;
      padding: 14px 20px; }
    .back { font-size: 1.4rem; padding: 16px 30px;
      border-radius: 14px; background: #2d2d2d; color: #9ecbff;
      text-decoration: none; border: 2px solid #3a3a3a; }
    h1 { font-size: 1.6rem; margin: 0; overflow-wrap: anywhere; }
    .stage { position: relative; flex: 1; min-height: 0; }
    sim-space-viewer { display: block; height: 100%; }
    .enter { position: absolute; left: 50%; bottom: 26px;
      transform: translateX(-50%); z-index: 10; }
    .hint { font-size: 1.2rem; opacity: .75;
      background: rgba(0,0,0,.55); padding: 12px 22px;
      border-radius: 12px; }
    /* The same honest XR button, headset-sized. */
    .enter ::ng-deep button { font-size: 1.6rem !important;
      padding: 22px 46px !important; border-radius: 18px
      !important; }
  `],
})
export class XrViewPageComponent implements OnInit {

  name = '';
  msim?: string;
  entryId: string | null = null;

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.name = params.get('name') ?? '';
      this.entryId = null;
    });
    this.route.queryParamMap.subscribe(params => {
      this.msim = params.get('msim') ?? undefined;
    });
  }
}
