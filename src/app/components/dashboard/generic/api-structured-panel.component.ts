import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { PolariService } from '@services/polari-service';
import {
  StructuredPayloadPanelComponent,
} from '@components/magnetics/structured-payload-panel.component';

/**
 * Generic no-code API panel, STRUCTURED reading: GETs a backend path,
 * optionally descends to a dot-path inside the payload (`pick`, e.g.
 * 'idealTable' or 'ranking' or 'complementary.check'), and renders it
 * through structured-payload-panel — scalars as chips, prose as
 * paragraphs, record arrays as tables, nested objects as key/value.
 * The drop-in replacement for api-json-panel wherever the payload is
 * tabular: nothing is shown as a JSON blob. A backend `ok:false`
 * payload shows its `error` / `refusal` text verbatim.
 */
@Component({
  standalone: true,
  selector: 'api-structured-panel',
  imports: [CommonModule, MatProgressSpinnerModule, StructuredPayloadPanelComponent],
  template: `
    <div class="api-structured-panel">
      <div class="panel-title" *ngIf="title">{{ title }}</div>
      <div *ngIf="loading" class="state"><mat-spinner diameter="28"></mat-spinner></div>
      <div *ngIf="error" class="state error">{{ error }}</div>
      <ng-container *ngIf="!loading && !error">
        <structured-payload-panel *ngIf="payload !== null; else empty"
                                  [payload]="payload"></structured-payload-panel>
        <ng-template #empty>
          <div class="state">{{ emptyText }}</div>
        </ng-template>
      </ng-container>
    </div>
  `,
  styles: [`
    .api-structured-panel { display: block; min-width: 0; color: var(--text-on-card); }
    .panel-title { font-weight: 600; margin-bottom: 6px; }
    .state { padding: 12px 0; color: var(--text-on-card-muted); }
    .state.error { color: var(--color-error-text); }
  `],
})
export class ApiStructuredPanelComponent implements OnInit, OnChanges {
  /** Backend path starting with '/'. Required. */
  @Input() path = '';
  /** Optional heading. */
  @Input() title = '';
  /** Dot-path into the payload to render instead of the whole
   *  payload, e.g. 'idealTable', 'ranking', 'complementary.check'. */
  @Input() pick = '';
  /** Keys to drop before rendering (top level of the picked value).
   *  Accepts an array or a comma-separated string (seed-friendly). */
  @Input() hideKeys: string[] | string = [];

  payload: any = null;
  loading = true;
  error: string | null = null;
  emptyText = 'Nothing to show.';

  constructor(private http: HttpClient,
              private polariService: PolariService) {}

  ngOnInit(): void { this.load(); }

  ngOnChanges(changes: SimpleChanges): void {
    const reload = ['path', 'pick', 'hideKeys']
      .some(k => changes[k] && !changes[k].firstChange);
    if (reload) { this.load(); }
  }

  private load(): void {
    this.payload = null;
    this.error = null;
    if (!this.path) {
      this.loading = false;
      this.error = 'api-structured-panel: no path input.';
      return;
    }
    const path = this.path;
    this.loading = true;
    const url = this.polariService.getBackendBaseUrl() + path;
    this.http.get<any>(url, this.polariService.backendRequestOptions).subscribe({
      next: (body: any) => {
        if (path !== this.path) { return; }
        this.loading = false;
        if (!body || typeof body !== 'object') {
          this.error = `GET ${path}: empty response`;
          return;
        }
        if (body.ok === false) {
          this.error = body.error || body.refusal || `GET ${path}: not ok`;
          return;
        }
        this.payload = this.shape(body);
      },
      error: (err: any) => {
        if (path !== this.path) { return; }
        this.loading = false;
        this.error = errorText(err, path);
      },
    });
  }

  /** Descend to `pick`, drop `hideKeys`, and wrap a bare array so the
   *  structured panel sees a record-array table named after the pick. */
  private shape(body: any): any {
    let value: any = body;
    if (this.pick) {
      for (const seg of this.pick.split('.').filter(Boolean)) {
        value = value != null && typeof value === 'object' ? value[seg] : undefined;
      }
      if (value === undefined) {
        this.emptyText = `'${this.pick}' is not in this payload.`;
        return null;
      }
    }
    if (Array.isArray(value)) {
      if (!value.length) {
        this.emptyText = `'${this.pick || 'rows'}' is empty.`;
        return null;
      }
      const name = this.pick ? this.pick.split('.').pop()! : 'rows';
      return { [name]: value.map(v => this.dropKeys(v)) };
    }
    if (value === null || typeof value !== 'object') {
      return { [this.pick || 'value']: value };
    }
    return this.dropKeys(value);
  }

  private dropKeys(value: any): any {
    if (!value || typeof value !== 'object' || Array.isArray(value)) { return value; }
    const hide = new Set(this.hideList());
    if (!hide.size) { return value; }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (!hide.has(k)) { out[k] = v; }
    }
    return out;
  }

  private hideList(): string[] {
    if (Array.isArray(this.hideKeys)) { return this.hideKeys; }
    return String(this.hideKeys || '').split(',').map(s => s.trim()).filter(Boolean);
  }
}

/** The backend's own error text verbatim when it sent one. */
export function errorText(err: any, path: string): string {
  const body = err?.error;
  if (body && typeof body === 'object') {
    if (typeof body.error === 'string') { return body.error; }
    if (typeof body.refusal === 'string') { return body.refusal; }
    if (typeof body.title === 'string') {
      return `GET ${path} failed: ${body.title}`;
    }
  }
  return `GET ${path} failed: ${err?.message || 'request failed'}`;
}
