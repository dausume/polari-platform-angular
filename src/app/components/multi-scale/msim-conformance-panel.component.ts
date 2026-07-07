import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  ConformanceReport,
  MsimProfileService,
} from '@services/multi-scale/msim-profile.service';

/**
 * Family-conformance findings for one msim: slot-by-slot ok/gap/note
 * with the evidence behind each (hover), plus the checker's
 * suggestions — displayed, never auto-applied
 * ([[knobs-and-suggestions]]). Collapsed behind a disclosure so the
 * run page stays quiet when everything conforms.
 */
@Component({
  standalone: true,
  selector: 'msim-conformance-panel',
  imports: [CommonModule, MatIconModule, MatTooltipModule],
  template: `
    <details class="conformance" *ngIf="report">
      <summary>
        <mat-icon [class.ok]="report!.conforms === true"
                  [class.bad]="report!.conforms === false">
          {{ report!.conforms === true ? 'verified' :
             report!.conforms === false ? 'report_problem' : 'help_outline' }}
        </mat-icon>
        Family conformance:
        {{ report!.conforms === true ? 'conforms to "' + report!.profile + '"'
           : report!.conforms === false ? 'gaps against "' + report!.profile + '"'
           : 'no family declared' }}
        <span class="counts" *ngIf="report!.findings.length">
          ({{ count('ok') }} ok · {{ count('gap') }} gaps ·
           {{ count('note') }} notes)
        </span>
      </summary>
      <div class="finding" *ngFor="let f of report!.findings"
           [class.gap]="f.level === 'gap'" [class.note]="f.level === 'note'">
        <mat-icon>{{ f.level === 'ok' ? 'check_circle'
          : f.level === 'gap' ? 'cancel' : 'info_outline' }}</mat-icon>
        <span class="slot">{{ f.slot }}</span>
        <span class="message" [matTooltip]="evidenceText(f.evidence)">
          {{ f.message }}
        </span>
      </div>
      <div class="suggestions" *ngIf="report!.suggestions.length">
        <strong>Suggestions (never auto-applied)</strong>
        <div class="suggestion" *ngFor="let s of report!.suggestions">
          <mat-icon>lightbulb_outline</mat-icon>
          <span>{{ s.action }} — <em>{{ s.reason }}</em></span>
        </div>
      </div>
    </details>
  `,
  styles: [`
    .conformance {
      border: 1px solid var(--border-light, #e0e0e0); border-radius: 10px;
      padding: 8px 12px; font-size: 12.5px; margin: 8px 0;
      summary {
        cursor: pointer; font-weight: 600; display: flex;
        align-items: center; gap: 6px;
        mat-icon { font-size: 18px; width: 18px; height: 18px;
                   color: #90a4ae;
                   &.ok { color: #1b5e20; } &.bad { color: #8d2f23; } }
        .counts { font-weight: 400; font-size: 11.5px;
                  color: var(--text-secondary, #777); }
      }
      &[open] summary { margin-bottom: 6px; }
    }
    .finding {
      display: flex; align-items: baseline; gap: 6px; padding: 2px 0;
      mat-icon { font-size: 15px; width: 15px; height: 15px;
                 color: #1b5e20; align-self: center; }
      &.gap mat-icon { color: #8d2f23; }
      &.note mat-icon { color: #1565c0; }
      .slot { font-family: monospace; font-size: 11px;
              color: var(--text-secondary, #777); white-space: nowrap; }
      .message { cursor: help; }
    }
    .suggestions {
      margin-top: 8px; padding-top: 6px;
      border-top: 1px dashed var(--border-light, #ddd);
      strong { font-size: 11px; text-transform: uppercase;
               letter-spacing: 0.4px; color: var(--text-secondary, #777); }
      .suggestion {
        display: flex; align-items: baseline; gap: 6px; padding: 2px 0;
        mat-icon { font-size: 15px; width: 15px; height: 15px;
                   color: #b8860b; align-self: center; }
        em { color: var(--text-secondary, #777); }
      }
    }
  `],
})
export class MsimConformancePanelComponent implements OnInit {
  @Input({ required: true }) msimName!: string;

  report: ConformanceReport | null = null;

  constructor(private profileService: MsimProfileService) {}

  async ngOnInit(): Promise<void> {
    this.report = await this.profileService.conformance(this.msimName);
  }

  count(level: string): number {
    return (this.report?.findings ?? [])
      .filter(f => f.level === level).length;
  }

  evidenceText(evidence: unknown): string {
    try { return JSON.stringify(evidence, null, 1); }
    catch { return String(evidence); }
  }
}
