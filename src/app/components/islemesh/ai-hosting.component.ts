/**
 * /ai-hosting — ai-7: remote-hosting suggestions with DATED prices
 * (Dustin: "a page for suggesting remote hosting services with
 * prices (dates on the prices for last update should be listed)").
 *
 * Reads /api/appstore/ai-tools/hosting-options: rentable options
 * whose fit against the localai hosting profiles is DERIVED from
 * declared specs (unverified where marketplace listings vary), and
 * whose every price wears its as-of date — stale dates (>90 days)
 * are flagged, not trusted. Connecting a rented box back to polari
 * is the store's "Connect a remotely-hosted instance" flow.
 */
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { PolariService } from '@services/polari-service';

interface HostingFit {
  profile: string;
  verdict: string;
  detail: string[];
}

interface HostingOption {
  name: string;
  provider: string;
  title: string;
  kind: string;
  cores: number;
  ram_mb: number;
  disk_mb: number;
  gpu_model: string;
  price_amount: number;
  price_unit: string;
  price_as_of: string;
  price_source: string;
  price_note: string;
  sovereignty: string;
  notes: string;
  fit: HostingFit[];
}

@Component({
  standalone: true,
  selector: 'app-ai-hosting',
  imports: [CommonModule, MatButtonModule, MatIconModule,
            RouterModule],
  template: `
    <div class="hosting-page">
      <div class="head">
        <div>
          <h1>Remote hosting for self-hosted AI</h1>
          <p class="sub">
            When the isle can't realistically host a model, rent a
            machine, run the same LocalAI container there, and
            connect it back with the store's
            <a routerLink="/isle-store">"Connect a remotely-hosted
            instance"</a> flow. Every price below shows when it was
            last checked — <strong>re-check the source before
            deciding</strong>.
          </p>
          <p class="sub">
            Note: the LocalAI project itself sells NO hosted
            instances — it is MIT self-hosted software (checked
            2026-08-16). Renting a machine below and running the
            container IS the remote path; managed endpoints
            (OpenRouter-style) are intermediaries, priced
            per-token, not monthly.
          </p>
          <p class="sub honesty" *ngIf="honesty">{{ honesty }}</p>
        </div>
        <button mat-stroked-button (click)="load()"
                [disabled]="loading">
          <mat-icon>refresh</mat-icon> Refresh
        </button>
      </div>

      <div class="load-error" *ngIf="loadError">{{ loadError }}</div>
      <div class="loading" *ngIf="loading">Loading options…</div>

      <section *ngFor="let kind of kindsPresent()">
        <h2>{{ kindLabel[kind] || kind }}</h2>
        <div class="option" *ngFor="let o of ofKind(kind)">
          <div class="option-head">
            <strong>{{ o.provider }}</strong> — {{ o.title }}
            <span class="badge"
                  [class.badge-warn]="o.sovereignty === 'intermediary'">
              {{ o.sovereignty }}</span>
            <span class="badge badge-gpu" *ngIf="o.gpu_model">
              {{ o.gpu_model }}</span>
          </div>
          <div class="price-row">
            <span class="price">{{ o.price_amount }}
              {{ o.price_unit }}</span>
            <span class="badge"
                  [class.badge-warn]="isStale(o.price_as_of)"
                  [title]="isStale(o.price_as_of)
                    ? 'over 90 days old — re-check before trusting'
                    : 'when this price was last checked'">
              price as of {{ o.price_as_of }}
              {{ isStale(o.price_as_of) ? '⚠ stale' : '' }}</span>
            <a class="src" [href]="o.price_source" target="_blank"
               rel="noopener">source ↗</a>
          </div>
          <div class="fit-row">
            <span *ngFor="let f of o.fit" class="badge fit-{{ f.verdict }}"
                  [title]="f.detail.join('; ') || 'fits this profile'">
              {{ f.profile }}: {{ f.verdict }}</span>
          </div>
          <p class="note" *ngIf="o.price_note">{{ o.price_note }}</p>
          <p class="note dim" *ngIf="o.notes">{{ o.notes }}</p>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .hosting-page { padding: 16px 20px; max-width: 900px;
      color: var(--text-on-card); }
    .head { display: flex; align-items: flex-start; gap: 12px;
      justify-content: space-between; }
    h1 { margin: 0 0 6px; font-size: 1.3rem; }
    h2 { margin: 18px 0 8px; font-size: 1.05rem; }
    .sub { margin: 0 0 6px; color: var(--text-on-card-muted);
      max-width: 60em; }
    .honesty { font-size: .8rem; font-style: italic; }
    .load-error { color: var(--color-error-text); }
    .loading { color: var(--text-on-card-muted); padding: 16px 0; }
    .option { border: 1px solid var(--border-light);
      border-radius: 8px; padding: 10px 12px; margin: 8px 0;
      background: var(--surface-primary); }
    .option-head { display: flex; align-items: center; gap: 8px;
      flex-wrap: wrap; }
    .price-row { display: flex; align-items: center; gap: 10px;
      margin: 6px 0; flex-wrap: wrap; }
    .price { font-size: 1.05rem; font-weight: 700; }
    .src { font-size: .8rem; }
    .fit-row { display: flex; gap: 6px; flex-wrap: wrap;
      margin: 4px 0; }
    .badge { font-size: .7rem; font-weight: 600; border-radius: 4px;
      padding: 2px 6px; background: var(--surface-secondary);
      border: 1px solid var(--border-light); }
    .badge-warn { background: #b26a00; color: #fff; border: none; }
    .badge-gpu { background: #2e7d32; color: #fff; border: none; }
    .fit-fits { background: #2e7d32; color: #fff; border: none; }
    .fit-no { opacity: .6; }
    .fit-unverified { background: #b26a00; color: #fff;
      border: none; }
    .note { margin: 4px 0 0; font-size: .82rem; }
    .dim { color: var(--text-on-card-muted); }
  `],
})
export class AiHostingComponent implements OnInit {
  options: HostingOption[] = [];
  honesty = '';
  loading = true;
  loadError = '';

  readonly kindLabel: Record<string, string> = {
    'cpu-vps': 'CPU servers — the minimal profile '
      + '(small quantized models)',
    'gpu-vps': 'GPU cloud — the comfortable profile '
      + '(larger/faster models, audio & vision backends)',
    'gpu-dedicated': 'Dedicated GPU servers',
    'managed-endpoint': 'Managed endpoints (intermediaries)',
  };

  constructor(private http: HttpClient,
              private polariService: PolariService) {}

  ngOnInit(): void { this.load(); }

  async load(): Promise<void> {
    this.loading = true;
    this.loadError = '';
    const data: any = await firstValueFrom(this.http.get(
      `${this.polariService.getBackendBaseUrl()}`
      + '/api/appstore/ai-tools/hosting-options',
      this.polariService.backendRequestOptions))
      .catch(() => null);
    this.loading = false;
    if (!data?.ok) {
      this.loadError = 'GET /api/appstore/ai-tools/hosting-options '
        + 'did not answer — is the appstore module deployed?';
      return;
    }
    this.options = data.options;
    this.honesty = data.honesty ?? '';
  }

  kindsPresent(): string[] {
    return [...new Set(this.options.map((o) => o.kind))];
  }

  ofKind(kind: string): HostingOption[] {
    return this.options.filter((o) => o.kind === kind);
  }

  /** Over ~90 days old = stale; flagged, never silently trusted. */
  isStale(asOf: string): boolean {
    if (!asOf) { return true; }
    const age = Date.now() - new Date(asOf).getTime();
    return age > 90 * 24 * 3600 * 1000;
  }
}
