import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';

import { MsimMemberInfoService } from '@services/multi-scale/msim-member-info.service';
import { MemberSimInfo } from '@models/multi-scale/msim-types';

/**
 * The ⓘ on a member-simulation chip: opens a popover with the
 * simulation's own `description` and `intent` (SimulationDefinition
 * fields that were never surfaced on the page) plus its role in THIS
 * composition — so "what is material-condensation doing here?" has an
 * answer right where the name appears.
 *
 * Info loads lazily on first open (one shared list fetch for all chips
 * via MsimMemberInfoService).
 */
@Component({
  standalone: true,
  selector: 'msim-member-info',
  imports: [
    CommonModule, MatButtonModule, MatIconModule, MatMenuModule,
    MatTooltipModule,
  ],
  template: `
    <button mat-icon-button class="info-btn" [matMenuTriggerFor]="infoMenu"
            (menuOpened)="load()"
            matTooltip="What is this simulation doing?">
      <mat-icon>info_outline</mat-icon>
    </button>
    <mat-menu #infoMenu="matMenu" class="member-info-menu">
      <div class="member-info" (click)="$event.stopPropagation()">
        <div class="info-header">
          <strong>{{ simName }}</strong>
          <span class="intent-badge" *ngIf="info?.intent">{{ info?.intent }}</span>
        </div>
        <p class="info-role" *ngIf="role">{{ role }}</p>
        <p class="info-description" *ngIf="info?.description">
          {{ info?.description }}
        </p>
        <p class="info-description muted" *ngIf="loaded && !info?.description">
          This simulation has no description yet — one can be added on its
          SimulationDefinition.
        </p>
        <p class="info-description muted" *ngIf="!loaded && !error">Loading…</p>
        <p class="info-description error" *ngIf="error">{{ error }}</p>
      </div>
    </mat-menu>
  `,
  styles: [`
    .info-btn { width: 28px; height: 28px; line-height: 28px; }
    .info-btn mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .member-info { padding: 10px 14px; max-width: 340px; }
    .info-header { display: flex; align-items: center; gap: 8px; }
    .intent-badge {
      font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.4px;
      background: var(--brand-teal, #159588); color: #fff;
      padding: 1px 7px; border-radius: 9px;
    }
    .info-role {
      font-size: 0.8rem; color: var(--brand-teal, #159588);
      margin: 6px 0 0; font-weight: 500;
    }
    .info-description {
      font-size: 0.82rem; line-height: 1.45; margin: 6px 0 0;
      color: var(--text-secondary, #555); white-space: normal;
    }
    .info-description.muted { opacity: 0.7; font-style: italic; }
    .info-description.error { color: #c62828; }
  `],
})
export class MsimMemberInfoComponent {
  /** The member simulation's name (SimulationDefinition identity). */
  @Input() simName = '';
  /** Its role in THIS composition (computed by the page). */
  @Input() role = '';

  info: MemberSimInfo | null = null;
  loaded = false;
  error: string | null = null;

  constructor(private memberInfo: MsimMemberInfoService) {}

  async load(): Promise<void> {
    if (this.loaded || !this.simName) return;
    try {
      this.info = await this.memberInfo.load(this.simName);
      this.loaded = true;
    } catch (err: any) {
      this.error = err?.message || String(err);
    }
  }
}
