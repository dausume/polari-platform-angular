import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PolariService } from '@services/polari-service';

/**
 * Generic no-code API panel: GETs a backend path and renders the
 * result — flat key/value pairs as a definition list, everything else
 * pretty-printed. Turns any analytical endpoint (drain verdicts,
 * nutrition coverage, sustainability reports…) into a Display page
 * item with zero per-endpoint component work.
 */
@Component({
  standalone: true,
  selector: 'api-json-panel',
  imports: [CommonModule, MatProgressSpinnerModule],
  template: `
    <div class="api-json-panel">
      <div *ngIf="loading" class="state"><mat-spinner diameter="28"></mat-spinner></div>
      <div *ngIf="error" class="state error">{{ error }}</div>
      <ng-container *ngIf="!loading && !error">
        <dl *ngIf="flatEntries.length > 0" class="kv">
          <ng-container *ngFor="let entry of flatEntries">
            <dt>{{ entry[0] }}</dt>
            <dd>{{ entry[1] }}</dd>
          </ng-container>
        </dl>
        <pre *ngIf="restJson">{{ restJson }}</pre>
      </ng-container>
    </div>
  `,
  styles: [`
    .api-json-panel { overflow-x: auto; }
    .state { padding: 16px; color: var(--text-secondary, #666); }
    .state.error { color: var(--error-text, #b3261e); }
    dl.kv {
      display: grid; grid-template-columns: minmax(120px, auto) 1fr;
      gap: 4px 16px; margin: 0 0 8px 0;
    }
    dt { color: var(--text-secondary, #666); font-weight: 600; }
    dd { margin: 0; font-family: monospace; }
    pre {
      background: var(--surface-secondary, #f5f5f5);
      padding: 10px; border-radius: 6px; font-size: 0.85em;
      max-height: 420px; overflow: auto;
    }
  `],
})
export class ApiJsonPanelComponent implements OnInit {
  /** Backend path starting with '/', e.g. '/api/nutrition/households/demo-household/needs'. */
  @Input() path = '';

  flatEntries: Array<[string, string]> = [];
  restJson = '';
  loading = true;
  error: string | null = null;

  constructor(private http: HttpClient, private polariService: PolariService) {}

  ngOnInit(): void {
    if (!this.path) {
      this.loading = false;
      this.error = 'api-json-panel: no path input.';
      return;
    }
    const url = this.polariService.getBackendBaseUrl() + this.path;
    this.http.get<any>(url, this.polariService.backendRequestOptions).subscribe({
      next: (payload: any) => {
        this.split(payload);
        this.loading = false;
      },
      error: (err: any) => {
        this.loading = false;
        this.error = `GET ${this.path} failed: ${err?.message || 'request failed'}`;
      },
    });
  }

  /** Flat scalars become the kv grid; nested structure stays JSON. */
  private split(payload: any): void {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      this.restJson = JSON.stringify(payload, null, 2);
      return;
    }
    const rest: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
        this.flatEntries.push([key, String(value ?? '')]);
      } else {
        rest[key] = value;
      }
    }
    this.restJson = Object.keys(rest).length > 0 ? JSON.stringify(rest, null, 2) : '';
  }
}
