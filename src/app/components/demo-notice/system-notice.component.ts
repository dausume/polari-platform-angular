import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { PolariService } from '@services/polari-service';

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
  `,
  styles: [`
    .sysbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 6px 14px; font-size: 13px; border-bottom: 1px solid rgba(0,0,0,.15); }
    .sysbar.error { background: #f8e6e6; color: #5a1a1a; } .sysbar.warning { background: #fbf1df; color: #4a3305; } .sysbar.info { background: #e9edf1; color: #2a323b; }
    .sysbar code { background: rgba(0,0,0,.08); padding: 1px 6px; border-radius: 3px; font-size: 12px; }
    .sysbar .dismiss { margin-left: auto; background: transparent; border: 1px solid currentColor; border-radius: 3px; padding: 1px 8px; font-size: 12px; cursor: pointer; color: inherit; }
  `],
})
export class SystemNoticeComponent implements OnInit, OnDestroy {
  notices: Notice[] = [];
  private hidden = new Set<string>();
  private timer: any = null;

  constructor(private http: HttpClient, private polariService: PolariService) {}

  ngOnInit(): void { void this.load(); this.timer = setInterval(() => { void this.load(); }, 10 * 60 * 1000); }
  ngOnDestroy(): void { if (this.timer) { clearInterval(this.timer); } }

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
