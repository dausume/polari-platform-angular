import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { RuntimeConfigService } from './runtime-config.service';

/** One document as /api/terms/active serves it. */
export interface TermsDoc {
  name: string;
  title: string;
  kind: string;
  scope: string;
  app_name: string;
  version: string;
  requires_acceptance: boolean;
  show_bar: boolean;
  bar_text: string;
  summary: string;
  body_md: string;
  body_sha256: string;
  effective_at: string;
  contact: string;
  page: string;
  accepted: boolean;
}

export interface TermsActive {
  ok: boolean;
  app: string;
  subject_kind: 'user' | 'anonymous';
  documents: TermsDoc[];
  pending: string[];
  show_bar: boolean;
  bar_text: string;
}

/**
 * The terms gate's client (terms module, 2026-09-09). Asks the instance
 * which terms apply (global + the app in view), tells it when the person
 * clicks accept, and keeps the anonymous terms session id that stands in
 * for a subject when nobody is logged in. The SERVER holds the record
 * (TermsAcceptance rows); localStorage only caches "already accepted
 * name@version" so a returning anonymous visitor is not re-asked before
 * the request completes.
 */
@Injectable({ providedIn: 'root' })
export class TermsService {
  private static SESSION_KEY = 'polari-terms-session';

  constructor(private http: HttpClient, private runtimeConfig: RuntimeConfigService) {}

  /** A stable anonymous id for this browser's terms acceptances. */
  sessionId(): string {
    try {
      let id = localStorage.getItem(TermsService.SESSION_KEY);
      if (!id) {
        id = (crypto && 'randomUUID' in crypto) ? crypto.randomUUID() : `s-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        localStorage.setItem(TermsService.SESSION_KEY, id);
      }
      return id;
    } catch {
      return `s-${Date.now()}`;
    }
  }

  private base(): string { return this.runtimeConfig.getBackendBaseUrl(); }

  /** The documents that apply now; null when the instance has no terms module. */
  async active(app: string): Promise<TermsActive | null> {
    const params = new URLSearchParams({ app: app || '', session: this.sessionId() });
    try {
      const res = await firstValueFrom(this.http.get<TermsActive>(`${this.base()}/api/terms/active?${params}`));
      return res && res.ok ? res : null;
    } catch {
      return null;
    }
  }

  /** Record the click. Resolves true when the server recorded it. */
  async accept(doc: TermsDoc, app: string): Promise<boolean> {
    try {
      const res = await firstValueFrom(this.http.post<{ ok: boolean }>(`${this.base()}/api/terms/accept`, {
        terms_name: doc.name, terms_version: doc.version, body_sha256: doc.body_sha256,
        session: this.sessionId(), app: app || ''
      }));
      if (res && res.ok) { this.cacheAccepted(doc); return true; }
      return false;
    } catch {
      return false;
    }
  }

  /** The absolute URL of a document's plain page on this instance. */
  pageUrl(doc: TermsDoc): string { return `${this.base()}${doc.page}`; }

  private cacheKey(doc: TermsDoc): string { return `polari-terms-ack:${doc.name}@${doc.version}`; }

  cachedAccepted(doc: TermsDoc): boolean {
    try { return localStorage.getItem(this.cacheKey(doc)) === 'yes'; } catch { return false; }
  }

  cacheAccepted(doc: TermsDoc): void {
    try { localStorage.setItem(this.cacheKey(doc), 'yes'); } catch { /* storage unavailable */ }
  }
}
