/**
 * @module components/sim-space/sim-space-viewer/sim-space-xr-section
 *
 * The sidebar's XR section (xr-1): the provenance display + the
 * individual-level knobs. Shows the RESOLVED mode/framing with the
 * deciding cascade level named ("why is there no VR button" answers
 * itself here), the raw ladder as evidence, and two dropdowns writing
 * THIS space's xr_mode / xr_framing ('unset' hands control back up
 * the ladder). Knobs-and-suggestions: the seeds set type defaults;
 * this is where the per-space exception is made, deliberately.
 */

import {
  Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { XrSettingsService } from '@services/xr/xr-settings.service';
import { XrCapabilityService } from '@services/xr/xr-capability.service';
import {
  XrCapability, XrFramingValue, XrModeValue, XrResolution,
} from '@models/xr/xr-types';

const LEVEL_LABELS: Record<string, string> = {
  individual: 'this space',
  multiscale: 'the multi-scale simulation',
  type: 'the space category',
  global: 'the global XR settings',
  builtin: 'the built-in default (whole ladder unset)',
};

@Component({
  standalone: true,
  selector: 'sim-space-xr-section',
  imports: [CommonModule, FormsModule],
  template: `
    <ng-container *ngIf="resolution; else loading">
      <dl class="kv">
        <dt>Mode</dt>
        <dd>
          <span class="mono">{{ resolution!.mode }}</span>
          <span class="muted small">
            — set by {{ levelLabel(resolution!.modeResolvedFrom) }}</span>
        </dd>
        <dt>Framing</dt>
        <dd>
          <span class="mono">{{ resolution!.framing }}</span>
          <span class="muted small">
            — set by {{ levelLabel(resolution!.framingResolvedFrom) }}</span>
        </dd>
        <dt>Category</dt>
        <dd>
          <span class="mono">{{ resolution!.category || '—' }}</span>
          <span class="muted small" *ngIf="resolution!.categorySource !== 'none'">
            ({{ resolution!.categorySource === 'module'
                ? 'derived from module' : 'explicit' }})</span>
        </dd>
        <dt>Device</dt>
        <dd class="small">
          <ng-container *ngIf="capability; else probing">
            VR {{ capability!.vr ? 'available' : 'unavailable' }},
            AR {{ capability!.ar ? 'available' : 'unavailable' }}
            <span class="muted" *ngIf="capability!.reason">
              — {{ capability!.reason }}</span>
          </ng-container>
          <ng-template #probing>probing…</ng-template>
        </dd>
      </dl>

      <p class="muted small">
        Override for this space only — 'unset' inherits from
        {{ upstreamLabel }}.
      </p>
      <div class="knob-row">
        <label>Mode</label>
        <select [(ngModel)]="editMode" [disabled]="saving"
                (ngModelChange)="save()">
          <option *ngFor="let v of modeValues" [value]="v">{{ v }}</option>
        </select>
      </div>
      <div class="knob-row">
        <label>Framing</label>
        <select [(ngModel)]="editFraming" [disabled]="saving"
                (ngModelChange)="save()">
          <option *ngFor="let v of framingValues" [value]="v">{{ v }}</option>
        </select>
      </div>
      <div class="muted small" *ngIf="saveError">{{ saveError }}</div>
    </ng-container>
    <ng-template #loading>
      <p class="muted small">{{ resolveError || 'Resolving XR settings…' }}</p>
    </ng-template>
  `,
  styles: [`
    .kv {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 2px 10px;
      margin: 4px 0 10px;
      font-size: 0.78rem;
    }
    .kv dt { color: #666; font-weight: 600; }
    .kv dd { margin: 0; color: #1a1a1a; }
    .mono { font-family: monospace; }
    .muted { color: #888; }
    .small { font-size: 0.72rem; }
    .knob-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 6px 0;
      font-size: 0.78rem;
    }
    .knob-row label { width: 60px; color: #666; font-weight: 600; }
    .knob-row select { flex: 1; padding: 2px 4px; font-size: 0.78rem; }
  `],
})
export class SimSpaceXrSectionComponent
    implements OnInit, OnChanges, OnDestroy {
  /** SimSpaceDefinition id + name (from the snapshot payload). */
  @Input() definitionId?: string;
  @Input() spaceName?: string;
  /** Optional msim context — same rung the Enter button resolves with. */
  @Input() multiscaleName?: string;

  resolution: XrResolution | null = null;
  capability: XrCapability | null = null;
  resolveError: string | null = null;

  modeValues: XrModeValue[] = ['unset', 'none', 'vr', 'ar', 'both'];
  framingValues: XrFramingValue[] = ['unset', 'inside', 'exhibit'];
  editMode: XrModeValue = 'unset';
  editFraming: XrFramingValue = 'unset';
  saving = false;
  saveError: string | null = null;

  private changedSub?: Subscription;

  constructor(
    private settings: XrSettingsService,
    private capabilities: XrCapabilityService,
  ) {}

  ngOnInit(): void {
    this.capabilities.capability().then(cap => (this.capability = cap));
    this.changedSub = this.settings.changed$.subscribe(name => {
      if (name === this.spaceName) void this.refresh();
    });
    void this.refresh();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['spaceName'] || changes['multiscaleName']) {
      void this.refresh();
    }
  }

  ngOnDestroy(): void {
    this.changedSub?.unsubscribe();
  }

  levelLabel(level: string): string {
    return LEVEL_LABELS[level] ?? level;
  }

  get upstreamLabel(): string {
    return this.multiscaleName
      ? 'the multi-scale simulation, category, or global settings'
      : 'the category or global settings';
  }

  private async refresh(): Promise<void> {
    if (!this.spaceName) return;
    this.resolveError = null;
    try {
      this.resolution =
        await this.settings.resolve(this.spaceName, this.multiscaleName);
      const individual = this.resolution.rungs.individual;
      this.editMode = individual?.mode ?? 'unset';
      this.editFraming = individual?.framing ?? 'unset';
    } catch (e: any) {
      this.resolution = null;
      this.resolveError =
        `XR resolve unavailable — ${e?.message || String(e)}`;
    }
  }

  async save(): Promise<void> {
    if (!this.definitionId || !this.spaceName || this.saving) return;
    this.saving = true;
    this.saveError = null;
    try {
      await this.settings.setSpaceXr(this.definitionId, {
        xr_mode: this.editMode,
        xr_framing: this.editFraming,
      });
      this.settings.announceChanged(this.spaceName);
    } catch (e: any) {
      this.saveError = `Save failed — ${e?.message || String(e)}`;
    } finally {
      this.saving = false;
    }
  }
}
