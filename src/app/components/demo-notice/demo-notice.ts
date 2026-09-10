import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Subscription } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { DemoNotice } from '@models/runtimeConfig';
import { RuntimeConfigService } from '../../services/runtime-config.service';
import { TermsDoc, TermsService } from '../../services/terms.service';

/**
 * The terms gate (terms module, 2026-09-09) — and the demo notice it grew
 * from. Two sources, in order:
 *   1. the instance's terms module: GET /api/terms/active for the app in
 *      view; every pending document is shown in turn (title, summary, the
 *      full text, the link to its plain page) and the click is RECORDED
 *      server-side (POST /api/terms/accept → a TermsAcceptance row: who,
 *      which version, sha256 of the text shown, when, how). A document of
 *      kind demo also keeps a persistent bar on every page.
 *   2. when the instance has no terms module (or it is unreachable): the
 *      runtime-config `demo` stanza — the bar plus a local-only
 *      acknowledgement, as before. Nothing is recorded in that mode.
 * Instances with neither show nothing (isles, developer nodes).
 */
@Component({
  standalone: true,
  selector: 'app-demo-notice',
  templateUrl: './demo-notice.html',
  styleUrls: ['./demo-notice.css'],
  imports: [CommonModule, MatButtonModule, MatIconModule]
})
export class DemoNoticeComponent implements OnInit, OnChanges, OnDestroy {
  /** The app in view (AppNav.name) — app-scoped documents apply only there. */
  @Input() app: string | null | undefined = '';

  // shared state
  showBar = false;
  barText = '';
  termsUrl = '';
  // server-backed gate
  queue: TermsDoc[] = [];
  current: TermsDoc | null = null;
  currentHtml = '';
  recorded = true;      // false when the click could not be recorded (shown to the person)
  busy = false;
  // fallback (runtime-config stanza only)
  notice: DemoNotice | null = null;
  showFallbackDialog = false;

  private sub?: Subscription;
  private loadedFor: string | null = null;

  constructor(private runtimeConfig: RuntimeConfigService, private terms: TermsService) {}

  ngOnInit(): void {
    this.sub = this.runtimeConfig.isConfigLoaded$
      .pipe(filter(Boolean), take(1))
      .subscribe(() => { void this.load(); });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['app'] && this.loadedFor !== null && this.loadedFor !== (this.app || '')) { void this.load(); }
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  private async load(): Promise<void> {
    const app = this.app || '';
    this.loadedFor = app;
    const active = await this.terms.active(app);
    if (active) {
      this.notice = null;
      this.showBar = active.show_bar;
      this.barText = active.bar_text || 'Demonstration instance. Do not enter personal information — anything you put here may be public and can be wiped at any time.';
      const demo = active.documents.find(d => d.kind === 'demo');
      this.termsUrl = demo ? this.terms.pageUrl(demo) : (active.documents[0] ? this.terms.pageUrl(active.documents[0]) : '');
      this.queue = active.documents.filter(d => d.requires_acceptance && !d.accepted && !(active.subject_kind === 'anonymous' && this.terms.cachedAccepted(d)));
      this.next();
      return;
    }
    // fallback: the runtime-config stanza
    const notice = this.runtimeConfig.getDemoNotice();
    if (!notice || !notice.enabled) { return; }
    this.notice = notice;
    this.showBar = true;
    this.barText = 'Do not enter personal information — anything you put here may be public and can be wiped at any time.';
    this.termsUrl = notice.termsUrl || '';
    this.showFallbackDialog = !this.fallbackAcknowledged(notice);
  }

  private next(): void {
    this.current = this.queue.shift() || null;
    this.currentHtml = this.current ? mdToHtml(this.current.body_md) : '';
    this.recorded = true;
  }

  currentPage(): string { return this.current ? this.terms.pageUrl(this.current) : ''; }

  async accept(): Promise<void> {
    if (!this.current || this.busy) { return; }
    this.busy = true;
    const ok = await this.terms.accept(this.current, this.app || '');
    this.busy = false;
    if (!ok) { this.recorded = false; return; }   // stay on the dialog and say so
    this.next();
  }

  // -- fallback mode ------------------------------------------------------
  private fallbackKey(notice: DemoNotice): string { return `polari-demo-ack:${notice.version || 'v1'}`; }
  private fallbackAcknowledged(notice: DemoNotice): boolean {
    try { return localStorage.getItem(this.fallbackKey(notice)) === 'yes'; } catch { return false; }
  }
  acknowledgeFallback(): void {
    if (this.notice) { try { localStorage.setItem(this.fallbackKey(this.notice), 'yes'); } catch { /* prompt again next load */ } }
    this.showFallbackDialog = false;
  }
}

/** The small Markdown the terms documents use: ## headings, paragraphs, - lists. Escapes everything else. */
export function mdToHtml(md: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const out: string[] = [];
  let para: string[] = [];
  let inList = false;
  const flush = () => { if (para.length) { out.push(`<p>${esc(para.join(' '))}</p>`); para = []; } };
  for (const raw of (md || '').split('\n')) {
    const s = raw.trim();
    if (s.startsWith('- ')) {
      flush();
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${esc(s.slice(2))}</li>`);
      continue;
    }
    if (inList) { out.push('</ul>'); inList = false; }
    const m = /^(#{1,6})\s+(.*)$/.exec(s);
    if (m) { flush(); const level = Math.min(6, m[1].length + 1); out.push(`<h${level}>${esc(m[2])}</h${level}>`); }
    else if (!s) { flush(); }
    else { para.push(s); }
  }
  flush();
  if (inList) { out.push('</ul>'); }
  return out.join('\n');
}
