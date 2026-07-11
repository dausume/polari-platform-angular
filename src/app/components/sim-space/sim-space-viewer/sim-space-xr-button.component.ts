/**
 * @module components/sim-space/sim-space-viewer/sim-space-xr-button
 *
 * The Enter-XR affordance (xr-1). Renders the honesty matrix:
 * resolved mode (what this space IS configured to offer) × device
 * capability (what this browser/headset CAN do) — never conflated,
 * never a hidden button, never a dead click:
 *
 *   mode none          → nothing rendered (provenance lives in the
 *                        sidebar's XR section — the "why" is there);
 *   vr/both + vr-able  → live "Enter VR" (switch when another scene
 *                        holds the session; Exit when this one does);
 *   vr/both, no device → disabled + the capability reason;
 *   ar (or ar of both) → disabled "AR arrives with xr-4" (the mode
 *                        knob is honored before the capability ships).
 */

import {
  Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

import { XrCapabilityService } from '@services/xr/xr-capability.service';
import { XrEngineService } from '@services/xr/xr-engine.service';
import { XrSettingsService } from '@services/xr/xr-settings.service';
import { XrCapability, XrResolution } from '@models/xr/xr-types';

@Component({
  standalone: true,
  selector: 'sim-space-xr-button',
  imports: [CommonModule],
  template: `
    <ng-container *ngIf="resolution && resolution.mode !== 'none'">
      <button class="xr-button"
              [class.active]="isBoundHere"
              [disabled]="disabledReason !== null || entering"
              [title]="disabledReason ?? ''"
              (click)="onClick()">
        {{ label }}
      </button>
      <div class="xr-reason" *ngIf="disabledReason">{{ disabledReason }}</div>
      <div class="xr-reason error" *ngIf="lastError">{{ lastError }}</div>
    </ng-container>
  `,
  styles: [`
    :host {
      position: absolute;
      bottom: 12px;
      right: 12px;
      z-index: 2;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
      pointer-events: auto;
    }
    .xr-button {
      padding: 6px 14px;
      border: none;
      border-radius: 16px;
      background: #159588;
      color: #fff;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
    }
    .xr-button:disabled {
      background: #9e9e9e;
      cursor: not-allowed;
      opacity: 0.85;
    }
    .xr-button.active { background: #c62828; }
    .xr-reason {
      max-width: 240px;
      padding: 3px 8px;
      border-radius: 4px;
      background: rgba(33, 33, 33, 0.82);
      color: #f0f0f0;
      font-size: 0.7rem;
      text-align: right;
    }
    .xr-reason.error { background: rgba(198, 40, 40, 0.92); }
  `],
})
export class SimSpaceXrButtonComponent
    implements OnInit, OnChanges, OnDestroy {
  /** SimSpaceDefinition name — resolution keys off it. */
  @Input() spaceName?: string;
  /** Optional msim context (the multiscale cascade rung). */
  @Input() multiscaleName?: string;
  /** This viewer's scene-registry entry id (set once the 3D renderer
   *  registered; the button only renders for registered viewers). */
  @Input() entryId?: string;

  resolution: XrResolution | null = null;
  capability: XrCapability | null = null;

  private engineSub?: Subscription;
  private changedSub?: Subscription;
  boundEntryId: string | null = null;
  entering = false;
  lastError: string | null = null;

  constructor(
    private settings: XrSettingsService,
    private capabilities: XrCapabilityService,
    private engine: XrEngineService,
  ) {}

  ngOnInit(): void {
    this.capabilities.capability().then(cap => (this.capability = cap));
    this.engineSub = this.engine.state$.subscribe(s => {
      this.boundEntryId = s.boundEntryId;
      this.entering = s.entering;
      this.lastError = s.lastError;
    });
    // Sidebar knob writes announce themselves — stay in sync so the
    // button and the provenance display never disagree.
    this.changedSub = this.settings.changed$.subscribe(name => {
      if (name === this.spaceName) void this.refreshResolution();
    });
    void this.refreshResolution();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['spaceName'] || changes['multiscaleName']) {
      void this.refreshResolution();
    }
  }

  ngOnDestroy(): void {
    this.engineSub?.unsubscribe();
    this.changedSub?.unsubscribe();
  }

  /** Public so the sidebar's XR section can nudge a re-resolve after
   *  a knob write (the viewer wires them together). */
  async refreshResolution(): Promise<void> {
    if (!this.spaceName) { this.resolution = null; return; }
    try {
      this.resolution =
        await this.settings.resolve(this.spaceName, this.multiscaleName);
    } catch {
      // Resolve endpoint absent/unreachable → no honest claim to
      // make either way; render nothing rather than a guess.
      this.resolution = null;
    }
  }

  get isBoundHere(): boolean {
    return !!this.entryId && this.boundEntryId === this.entryId;
  }

  get offersVr(): boolean {
    const m = this.resolution?.mode;
    return m === 'vr' || m === 'both';
  }

  get label(): string {
    if (this.isBoundHere) return 'Exit VR';
    if (this.entering) return 'Entering…';
    if (this.offersVr) {
      return this.boundEntryId ? 'Switch VR here' : 'Enter VR';
    }
    return 'Enter AR';
  }

  /** The honest disable reason, or null when the button is live. */
  get disabledReason(): string | null {
    if (!this.resolution) return null;
    if (this.isBoundHere) return null;
    if (!this.entryId) return 'Scene is still loading';
    if (this.offersVr) {
      if (!this.capability) return 'Checking XR capability…';
      if (!this.capability.vr) {
        return this.capability.reason
          ?? 'This device does not support immersive VR';
      }
      return null;
    }
    // mode === 'ar' — configured honestly ahead of the capability.
    return 'This space is configured for AR — AR arrives with xr-4';
  }

  async onClick(): Promise<void> {
    if (!this.entryId) return;
    if (this.isBoundHere) {
      await this.engine.exit();
      return;
    }
    await this.engine.enter(this.entryId);
  }
}
