import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { MsimProfileService } from '@services/multi-scale/msim-profile.service';
import { MsimProfile } from '@models/multi-scale/msim-types';

/**
 * The msim page header's FAMILY chip: which
 * MultiScaleSimulationProfile this msim instantiates, with a click-open
 * shape popover (scale levels, fidelity ladder, panel roster). No
 * declared family → an honest quiet chip saying so.
 */
@Component({
  standalone: true,
  selector: 'msim-profile-chip',
  imports: [CommonModule, MatIconModule, MatTooltipModule],
  template: `
    <span class="profile-chip" *ngIf="profileRef; else noFamily"
          (click)="open = !open"
          [matTooltip]="profile?.description || ''">
      <mat-icon class="chip-icon">category</mat-icon>
      family: {{ profile?.display_name || profileRef }}
      <mat-icon class="chip-icon">{{ open ? 'expand_less' : 'expand_more' }}</mat-icon>
    </span>
    <ng-template #noFamily>
      <span class="profile-chip none"
            matTooltip="This msim declares no family (profile_ref is
              empty) — set one to get conformance checking.">
        <mat-icon class="chip-icon">category</mat-icon> no family declared
      </span>
    </ng-template>

    <div class="shape-popover" *ngIf="open && profile">
      <div class="shape-section" *ngIf="profile!.scaleLevels.length">
        <strong>Scale levels</strong>
        <span class="shape-item" *ngFor="let l of profile!.scaleLevels">
          {{ l.order }}. {{ l.label }}<em *ngIf="l.units"> ({{ l.units }})</em>
        </span>
      </div>
      <div class="shape-section" *ngIf="profile!.fidelityLadder.length">
        <strong>Fidelity ladder</strong>
        <span class="shape-item" *ngFor="let r of profile!.fidelityLadder">
          {{ r.rung }}. {{ r.engines.join(', ') }}
          <em>({{ r.costClass }}, {{ r.purpose }})</em>
        </span>
      </div>
      <div class="shape-section" *ngIf="profile!.panelRoster.length">
        <strong>Recurring panels</strong>
        <span class="shape-item" *ngFor="let p of profile!.panelRoster">
          {{ p.kind }}<em *ngIf="!p.required"> (optional)</em>
        </span>
      </div>
    </div>
  `,
  styles: [`
    .profile-chip {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 12px; font-weight: 600; cursor: pointer;
      padding: 2px 10px; border-radius: 12px;
      background: #ede7f6; color: #4527a0;
      .chip-icon { font-size: 15px; width: 15px; height: 15px; }
      &.none { background: #eceff1; color: #90a4ae; cursor: default;
               font-weight: 400; }
    }
    .shape-popover {
      margin-top: 6px; padding: 10px 12px; border-radius: 10px;
      border: 1px solid var(--border-light, #ddd);
      background: var(--surface-primary, #fff); font-size: 12px;
      display: flex; flex-wrap: wrap; gap: 16px;
      .shape-section {
        display: flex; flex-direction: column; gap: 2px;
        strong { font-size: 11px; text-transform: uppercase;
                 letter-spacing: 0.4px; color: var(--text-secondary, #777); }
        .shape-item em { color: var(--text-secondary, #999); }
      }
    }
  `],
})
export class MsimProfileChipComponent implements OnInit {
  @Input({ required: true }) profileRef!: string;

  profile: MsimProfile | null = null;
  open = false;

  constructor(private profileService: MsimProfileService) {}

  async ngOnInit(): Promise<void> {
    if (this.profileRef) {
      this.profile = await this.profileService.profile(this.profileRef);
    }
  }
}
