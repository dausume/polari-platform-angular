import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription, firstValueFrom } from 'rxjs';

import { PolariService } from '@services/polari-service';
import {
  AdvisoryEntry, AdvisorySummary, SecurityAdvisoryService
} from '@services/security-advisory.service';

/**
 * system-notice — the instance's own warnings to whoever is looking at it
 * (his ask 2026-09-13): an expired or expiring certificate on this app,
 * auto-renew not installed, a host that did not answer. GET
 * /api/security/notices (the security module probes the instance's public
 * hosts over TLS and reads the latest audit run); polled every 10 minutes.
 * One bar per notice, red for expired, amber for expiring, grey for
 * information; each carries the action a person runs (pol cert renew,
 * pol cert auto-renew install). Dismissible per notice for the session only,
 * so it comes back on the next visit until it is fixed. Instances without
 * the security module show nothing.
 *
 * ct-6 / op-0 (2026-09-19): the same bar also carries the SECURITY ADVISORY
 * line. In dev posture the backend answers normally and states, in response
 * headers (and in a STOMP notice frame), what an ENFORCING instance would
 * have refused. SecurityAdvisoryService counts them; this is where a person
 * sees them — one summarised line that expands to the counted list. It only
 * appears when there is something to say, which on a production instance
 * (advisories off) is never.
 */
interface Notice { level: 'error' | 'warning' | 'info'; code: string; host: string; days_left: number | null; title: string; text: string; action: string; }

@Component({
  standalone: true,
  selector: 'app-system-notice',
  imports: [CommonModule],
  template: `
    <div *ngFor="let n of visible()" class="sysbar" [class.error]="n.level === 'error'" [class.warning]="n.level === 'warning'" [class.info]="n.level === 'info'" role="status">
      <strong>{{ n.title }}.</strong> <span>{{ n.text }}</span>
      <code *ngIf="n.action">{{ n.action }}</code>
      <button type="button" class="dismiss" (click)="dismiss(n)" aria-label="Hide this notice for now">Hide for now</button>
    </div>

    <!-- ct-6 / op-0: what an ENFORCING instance would have refused. -->
    <div *ngIf="advisorySummary as s" class="advbar" [class.warn]="s.level === 'warning'" role="status">
      <button type="button" class="advtoggle" (click)="expanded = !expanded"
              [attr.aria-expanded]="expanded">
        <strong>Security advisory (dev):</strong>
        <span>{{ advisoryLine(s) }}</span>
        <span class="caret" aria-hidden="true">{{ expanded ? '▾' : '▸' }}</span>
      </button>
      <button type="button" class="dismiss" (click)="clearAdvisories()"
              aria-label="Clear the security advisories collected so far">Clear</button>

      <div *ngIf="expanded" class="advlist">
        <p class="advnote">
          Nothing was blocked. This instance runs its security gates in advisory
          mode; each line is what an enforcing instance would have done instead.
        </p>
        <div *ngFor="let e of advisories" class="advrow">
          <span class="advcount" title="times seen">×{{ e.count }}</span>
          <span class="advoutcome">{{ e.outcome }}</span>
          <span class="advsubject">{{ e.subject || '—' }}</span>
          <span class="advwhere">{{ e.header }} · {{ e.path }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .sysbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 6px 14px; font-size: 13px; border-bottom: 1px solid rgba(0,0,0,.15); }
    .sysbar.error { background: #f8e6e6; color: #5a1a1a; } .sysbar.warning { background: #fbf1df; color: #4a3305; } .sysbar.info { background: #e9edf1; color: #2a323b; }
    .sysbar code { background: rgba(0,0,0,.08); padding: 1px 6px; border-radius: 3px; font-size: 12px; }
    .sysbar .dismiss { margin-left: auto; background: transparent; border: 1px solid currentColor; border-radius: 3px; padding: 1px 8px; font-size: 12px; cursor: pointer; color: inherit; }

    /* Theme tokens only — this bar flips with the rest of the app. */
    .advbar { container-type: inline-size; padding: 6px 14px; font-size: 13px; background: var(--color-info-bg); color: var(--color-info-text); border-bottom: 1px solid var(--color-info-border); }
    .advbar.warn { background: var(--color-warn-bg); color: var(--color-warn-text); border-bottom-color: var(--color-warn-border); }
    .advbar > .advtoggle, .advbar > .dismiss { vertical-align: middle; }
    .advtoggle { background: transparent; border: 0; padding: 0; margin: 0; font: inherit; color: inherit; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; text-align: left; }
    .advtoggle .caret { opacity: .7; }
    .advbar .dismiss { float: right; background: transparent; border: 1px solid currentColor; border-radius: 3px; padding: 1px 8px; font-size: 12px; cursor: pointer; color: inherit; }
    .advnote { margin: 8px 0 6px; font-size: 12px; opacity: .85; max-width: 70ch; }
    .advlist { margin-top: 4px; max-height: 40vh; overflow-y: auto; }
    /* The rule colour is DERIVED from the bar's own token-set text colour,
       so it flips with the theme without naming a second colour. */
    .advrow { display: grid; grid-template-columns: 3.5rem 8rem minmax(0, 1fr) minmax(0, 1fr); gap: 8px; align-items: baseline; padding: 2px 0; font-size: 12px; border-top: 1px solid color-mix(in srgb, currentColor 20%, transparent); }
    .advcount { font-variant-numeric: tabular-nums; opacity: .8; }
    .advoutcome { font-weight: 600; }
    .advsubject { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; overflow-wrap: anywhere; }
    .advwhere { opacity: .75; overflow-wrap: anywhere; }
    @container (max-width: 640px) {
      .advrow { grid-template-columns: 3.5rem minmax(0, 1fr); }
      .advwhere { grid-column: 1 / -1; }
    }
  `],
})
export class SystemNoticeComponent implements OnInit, OnDestroy {
  notices: Notice[] = [];
  /** null = nothing to say; the bar is absent rather than empty. */
  advisorySummary: AdvisorySummary | null = null;
  advisories: AdvisoryEntry[] = [];
  expanded = false;
  private hidden = new Set<string>();
  private timer: any = null;
  private advisorySub: Subscription | null = null;

  constructor(
    private http: HttpClient,
    private polariService: PolariService,
    private advisoryService: SecurityAdvisoryService
  ) {}

  ngOnInit(): void {
    void this.load();
    this.timer = setInterval(() => { void this.load(); }, 10 * 60 * 1000);
    this.advisorySub = this.advisoryService.entries$.subscribe(entries => {
      this.advisories = entries;
      this.advisorySummary = entries.length ? this.advisoryService.summary() : null;
      if (!entries.length) { this.expanded = false; }
    });
  }

  ngOnDestroy(): void {
    if (this.timer) { clearInterval(this.timer); }
    this.advisorySub?.unsubscribe();
  }

  /** "3 would-deny, 1 would-project (seen 42 times) — click for details" */
  advisoryLine(s: AdvisorySummary): string {
    const parts = Object.keys(s.byOutcome)
      .sort((a, b) => s.byOutcome[b] - s.byOutcome[a])
      .map(outcome => `${s.byOutcome[outcome]} ${outcome}`);
    const seen = s.occurrences > s.entries ? ` (seen ${s.occurrences} times)` : '';
    return `${parts.join(', ')}${seen} — click for details`;
  }

  clearAdvisories(): void { this.advisoryService.clear(); }

  visible(): Notice[] { return this.notices.filter(n => !this.hidden.has(n.code + ':' + n.host)); }
  dismiss(n: Notice): void { this.hidden.add(n.code + ':' + n.host); }

  private async load(): Promise<void> {
    try {
      const base = this.polariService.getBackendBaseUrl();
      const body = await firstValueFrom(this.http.get<any>(`${base}/api/security/notices`, this.polariService.backendRequestOptions));
      this.notices = (body && body.ok && Array.isArray(body.notices)) ? body.notices : [];
    } catch {
      this.notices = [];   // no security module here, or unreachable: say nothing
    }
  }
}
