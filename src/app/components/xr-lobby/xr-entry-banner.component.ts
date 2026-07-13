import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

import { XrCapabilityService } from '@services/xr/xr-capability.service';
import { XrEngineService } from '@services/xr/xr-engine.service';
import { XrSettingsService } from '@services/xr/xr-settings.service';

/**
 * The Enter-XR bar (Dustin 2026-07-12): when the DEVICE has XR and
 * the space is enterable, a decent-sized prompt sits ABOVE the whole
 * view offering VR (and AR once xr-4 lands). Device capability
 * decides the bar EXISTS; the space's resolved xr_mode is shown as
 * a label, never used to hide the control — the old button rendered
 * NOTHING for mode 'none' (every unset space), which made XR entry
 * undiscoverable on the very page built for it.
 *
 * 2D spaces (2026-07-12, same day): now XR-enterable too — the flat
 * D3 view mounts as one big HTMLMesh quad instead of a fabricated 3D
 * scene (xr-2d-scene-builder.ts) — so this banner no longer excludes
 * dimensionality 2. Only a definitively-unenterable state (null while
 * the space list is still loading) hides it.
 */
@Component({
  standalone: true,
  selector: 'xr-entry-banner',
  imports: [CommonModule],
  template: `
    <div class="banner" *ngIf="deviceHasXr && isEnterable">
      <span class="msg" *ngIf="!entryId">
        Scene loading — Enter VR appears here when it is
        ready…</span>
      <ng-container *ngIf="entryId">
        <span class="msg">This space can be entered.</span>
        <span class="mode-note" *ngIf="modeNote">{{ modeNote }}</span>
        <button class="enter" *ngIf="!bound" [disabled]="entering"
                (click)="enter()">
          {{ entering ? 'Entering…' : 'ENTER VR' }}</button>
        <button class="enter exit" *ngIf="bound" (click)="exit()">
          EXIT VR</button>
        <button class="ar" *ngIf="arCapable" disabled
                title="AR arrives with xr-4">AR (soon)</button>
      </ng-container>
      <span class="error" *ngIf="lastError">{{ lastError }}</span>
    </div>
  `,
  styles: [`
    /* Theme tokens: brand-blue-light flips with the theme, so the
       banner reads in light AND dark mode. */
    .banner { display: flex; align-items: center; gap: 18px;
      flex-wrap: wrap; padding: 16px 22px; margin: 0 0 4px;
      border-radius: 16px; background: var(--brand-blue-light);
      color: var(--text-primary);
      border: 2px solid var(--brand-blue); }
    .msg { font-size: 1.2rem; }
    .mode-note { font-size: .95rem;
      color: var(--text-secondary); }
    .enter { font-size: 1.45rem; font-weight: 700;
      padding: 18px 42px; border-radius: 14px; border: none;
      background: var(--brand-blue); color: var(--text-on-primary);
      cursor: pointer; }
    .enter:disabled { opacity: .6; }
    .exit { background: var(--color-error); }
    .ar { font-size: 1.1rem; padding: 14px 22px;
      border-radius: 14px; border: 2px solid var(--brand-blue);
      background: transparent; color: var(--brand-blue);
      opacity: .6; }
    .error { color: var(--color-error); font-size: 1.05rem; }
  `],
})
export class XrEntryBannerComponent implements OnInit, OnDestroy {

  @Input() spaceName = '';
  @Input() multiscaleName?: string;
  @Input() entryId: string | null = null;
  /** 2 or 3 — both are enterable now; null (still loading the space
   *  list) renders no banner rather than flash-then-hide. */
  @Input() dimensionality: number | null = 3;

  deviceHasXr = false;
  arCapable = false;
  bound = false;
  entering = false;
  lastError = '';
  modeNote = '';
  private stateSub?: Subscription;

  constructor(private capability: XrCapabilityService,
              private engine: XrEngineService,
              private settings: XrSettingsService) {}

  get isEnterable(): boolean {
    return this.dimensionality === 2 || this.dimensionality === 3;
  }

  ngOnInit(): void {
    this.capability.capability().then(cap => {
      this.deviceHasXr = cap.vr || cap.ar;
      this.arCapable = cap.ar;
    }).catch(() => { /* honest default: no banner */ });
    this.stateSub = this.engine.state$.subscribe(state => {
      this.bound = !!this.entryId
        && state.boundEntryId === this.entryId;
      this.entering = state.entering;
      this.lastError = state.lastError ?? '';
    });
    if (this.spaceName) {
      this.settings.resolve(this.spaceName, this.multiscaleName)
        .then(resolution => {
          if (resolution.mode !== 'vr') {
            this.modeNote = `space XR setting: ${resolution.mode} `
              + `(${resolution.modeResolvedFrom}) — entering from `
              + 'the XR lobby anyway';
          }
        })
        .catch(() => { /* label only — entry never depends on it */ });
    }
  }

  ngOnDestroy(): void {
    this.stateSub?.unsubscribe();
  }

  enter(): void {
    if (this.entryId) {
      this.engine.enter(this.entryId,
                        { multiscaleName: this.multiscaleName });
    }
  }

  exit(): void {
    this.engine.exit();
  }
}
