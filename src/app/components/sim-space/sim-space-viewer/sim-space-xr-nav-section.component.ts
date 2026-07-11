/**
 * @module components/sim-space/sim-space-viewer/sim-space-xr-nav-section
 *
 * The sidebar's XR NAVIGATION block (xr-2): this space's
 * XrInterfaceVariant 'vr' knobs — entry scale (auto-derived on first
 * entry, editable here; knobs over magic), the navigation tuning
 * knobs (Q8 — every default stays a knob), and the viewpoint
 * bookmarks (per-mode data; a settings flip never touches them).
 * Reset/Back act on the LIVE session when this space is bound —
 * the flat-side twin of the wrist ring-0 items.
 */

import {
  Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { XrEngineService } from '@services/xr/xr-engine.service';
import { XrVariantService } from '@services/xr/xr-variant.service';
import {
  XR_NAV_DEFAULTS, XrNavKnobs, XrVariantConfig, XrViewpointBookmark,
} from '@models/xr/xr-types';

@Component({
  standalone: true,
  selector: 'sim-space-xr-nav-section',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="xr-nav">
      <div class="knob-row">
        <label>Entry scale</label>
        <input type="number" step="any" min="0"
               [(ngModel)]="entryScale" [disabled]="saving"
               placeholder="auto on first entry"
               (change)="saveEntryScale()">
      </div>
      <div class="knob-row">
        <label>Vignette</label>
        <input type="checkbox" [(ngModel)]="knobs.vignetteOnShift"
               [disabled]="saving" (ngModelChange)="saveKnobs()">
        <span class="muted small">comfort tunnel during shifts</span>
      </div>
      <div class="knob-row">
        <label>Snap turn</label>
        <input type="checkbox" [(ngModel)]="knobs.snapTurn"
               [disabled]="saving" (ngModelChange)="saveKnobs()">
        <input type="number" class="short" min="5" max="90"
               [(ngModel)]="knobs.snapTurnDegrees" [disabled]="saving"
               (change)="saveKnobs()">
        <span class="muted small">deg</span>
      </div>
      <div class="knob-row">
        <label>Shift curve</label>
        <select [(ngModel)]="knobs.responseCurve" [disabled]="saving"
                (ngModelChange)="saveKnobs()">
          <option value="linear">linear</option>
          <option value="expo">expo</option>
        </select>
      </div>
      <div class="knob-row">
        <label>Wrist menu</label>
        <select [(ngModel)]="knobs.wristHandedness" [disabled]="saving"
                (ngModelChange)="saveKnobs()">
          <option value="left">left wrist</option>
          <option value="right">right wrist</option>
        </select>
      </div>

      <div class="live-row" *ngIf="isBoundHere">
        <button (click)="engine.resetView()">Reset view</button>
        <button (click)="engine.backView()">Back</button>
      </div>

      <div class="bookmarks">
        <div class="bookmark-head">
          <span>Viewpoint bookmarks</span>
          <span class="muted small" *ngIf="bookmarks.length === 0">
            none saved</span>
        </div>
        <div class="bookmark-row" *ngFor="let b of bookmarks">
          <span class="mono">{{ b.name }}</span>
          <button [disabled]="!isBoundHere" title="Jump the live session"
                  (click)="engine.gotoBookmark(b.name)">go</button>
          <button [disabled]="saving" (click)="removeBookmark(b.name)">
            ✕</button>
        </div>
        <div class="bookmark-add" *ngIf="isBoundHere">
          <input type="text" [(ngModel)]="newBookmarkName"
                 placeholder="bookmark current view…" [disabled]="saving">
          <button [disabled]="saving || !newBookmarkName.trim()"
                  (click)="addBookmark()">Save</button>
        </div>
      </div>
      <div class="muted small" *ngIf="error">{{ error }}</div>
    </div>
  `,
  styles: [`
    .xr-nav { margin-top: 8px; font-size: 0.78rem; }
    .knob-row {
      display: flex; align-items: center; gap: 8px; margin: 6px 0;
    }
    .knob-row label { width: 76px; color: #666; font-weight: 600; }
    .knob-row input[type="number"], .knob-row select {
      flex: 1; min-width: 0; padding: 2px 4px; font-size: 0.78rem;
    }
    .knob-row input.short { flex: 0 0 52px; }
    .mono { font-family: monospace; }
    .muted { color: #888; }
    .small { font-size: 0.72rem; }
    .live-row { display: flex; gap: 6px; margin: 8px 0; }
    .live-row button, .bookmark-add button, .bookmark-row button {
      padding: 2px 8px; font-size: 0.72rem; cursor: pointer;
    }
    .bookmarks { margin-top: 8px; }
    .bookmark-head {
      display: flex; gap: 6px; align-items: baseline;
      color: #666; font-weight: 600;
    }
    .bookmark-row {
      display: flex; align-items: center; gap: 6px; margin: 3px 0;
    }
    .bookmark-row .mono { flex: 1; }
    .bookmark-add { display: flex; gap: 6px; margin-top: 4px; }
    .bookmark-add input { flex: 1; padding: 2px 4px; font-size: 0.74rem; }
  `],
})
export class SimSpaceXrNavSectionComponent
    implements OnInit, OnChanges, OnDestroy {
  @Input() spaceName?: string;
  /** This viewer's registry entry id — live actions only when the
   *  session is bound HERE. */
  @Input() entryId?: string;

  entryScale: number | null = null;
  knobs: XrNavKnobs = { ...XR_NAV_DEFAULTS };
  bookmarks: XrViewpointBookmark[] = [];
  newBookmarkName = '';
  saving = false;
  error: string | null = null;
  private boundEntryId: string | null = null;
  private engineSub?: Subscription;
  private config: XrVariantConfig = {};

  constructor(
    public engine: XrEngineService,
    private variants: XrVariantService,
  ) {}

  ngOnInit(): void {
    this.engineSub = this.engine.state$.subscribe(s => {
      const wasBound = this.boundEntryId;
      this.boundEntryId = s.boundEntryId;
      // Entering writes the derived entry scale — refresh on flips.
      if (wasBound !== s.boundEntryId) void this.load();
    });
    void this.load();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['spaceName']) void this.load();
  }

  ngOnDestroy(): void {
    this.engineSub?.unsubscribe();
  }

  get isBoundHere(): boolean {
    return !!this.entryId && this.boundEntryId === this.entryId;
  }

  private async load(): Promise<void> {
    if (!this.spaceName) return;
    try {
      this.config = await this.variants.getConfig(
        'sim-space', this.spaceName, 'vr');
      this.entryScale = typeof this.config.entry_scale === 'number'
        ? this.config.entry_scale : null;
      this.knobs = { ...XR_NAV_DEFAULTS, ...(this.config.nav ?? {}) };
      this.bookmarks = this.config.bookmarks ?? [];
      this.error = null;
    } catch (e: any) {
      this.error =
        `XR variant unavailable — ${e?.message || String(e)}`;
    }
  }

  async saveEntryScale(): Promise<void> {
    const value = this.entryScale;
    await this.persist({
      entry_scale: value && value > 0 ? value : undefined,
    });
  }

  async saveKnobs(): Promise<void> {
    await this.persist({ nav: this.knobs });
  }

  async addBookmark(): Promise<void> {
    const name = this.newBookmarkName.trim();
    if (!name) return;
    this.saving = true;
    try {
      const ok = await this.engine.saveBookmark(name);
      if (ok) this.newBookmarkName = '';
      await this.load();
    } catch (e: any) {
      this.error = `Save failed — ${e?.message || String(e)}`;
    } finally {
      this.saving = false;
    }
  }

  async removeBookmark(name: string): Promise<void> {
    this.saving = true;
    try {
      if (this.isBoundHere) {
        await this.engine.deleteBookmark(name);
      } else {
        const bookmarks =
          (this.config.bookmarks ?? []).filter(b => b.name !== name);
        await this.variants.mergeConfig(
          'sim-space', this.spaceName!, 'vr', { bookmarks });
      }
      await this.load();
    } catch (e: any) {
      this.error = `Delete failed — ${e?.message || String(e)}`;
    } finally {
      this.saving = false;
    }
  }

  private async persist(patch: Partial<XrVariantConfig>):
      Promise<void> {
    if (!this.spaceName) return;
    this.saving = true;
    try {
      this.config = await this.variants.mergeConfig(
        'sim-space', this.spaceName, 'vr', patch);
      this.error = null;
    } catch (e: any) {
      this.error = `Save failed — ${e?.message || String(e)}`;
    } finally {
      this.saving = false;
    }
  }
}
