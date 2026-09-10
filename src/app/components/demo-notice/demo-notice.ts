import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Subscription } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { DemoNotice } from '@models/runtimeConfig';
import { RuntimeConfigService } from '../../services/runtime-config.service';

/**
 * Demo notice (his ask 2026-09-09): when the instance's runtime-config
 * carries a `demo` stanza with `enabled: true`, the app shows
 *   1. a first-visit dialog the person must acknowledge ("I understand") —
 *      remembered per terms VERSION in localStorage, so a changed terms
 *      text re-prompts everyone; and
 *   2. a slim persistent bar on every page — "Demonstration instance:
 *      do not enter personal information" — with the demo terms link.
 * Nothing here is legal advice; the text is the operator's, from the
 * runtime config (staging/prod setup scripts write it), and the terms
 * page is the hub's /docs/demo-terms.html.
 * Instances without the stanza (an isle, a developer's node) show nothing.
 */
@Component({
  standalone: true,
  selector: 'app-demo-notice',
  templateUrl: './demo-notice.html',
  styleUrls: ['./demo-notice.css'],
  imports: [CommonModule, MatButtonModule, MatIconModule]
})
export class DemoNoticeComponent implements OnInit, OnDestroy {
  notice: DemoNotice | null = null;
  showDialog = false;
  private sub?: Subscription;

  constructor(private runtimeConfig: RuntimeConfigService) {}

  ngOnInit(): void {
    this.sub = this.runtimeConfig.isConfigLoaded$
      .pipe(filter(Boolean), take(1))
      .subscribe(() => {
        const notice = this.runtimeConfig.getDemoNotice();
        if (!notice || !notice.enabled) { return; }
        this.notice = notice;
        this.showDialog = !this.acknowledged(notice);
      });
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  get ackKey(): string { return `polari-demo-ack:${this.notice?.version || 'v1'}`; }

  private acknowledged(notice: DemoNotice): boolean {
    try { return localStorage.getItem(`polari-demo-ack:${notice.version || 'v1'}`) === 'yes'; }
    catch { return false; }
  }

  acknowledge(): void {
    try { localStorage.setItem(this.ackKey, 'yes'); } catch { /* storage unavailable — prompt again next load */ }
    this.showDialog = false;
  }
}
