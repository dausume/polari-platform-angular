import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { PolariService } from '@services/polari-service';
import { friendlyError } from './friendly-error';

interface SvgItem { label: string; url: string; }
interface SvgMarker { x: number; y: number; label?: string; severity?: string; }

/**
 * demo1b (his 2026-10-04 verdict: "many rows of data with no demonstratables"): the ONE generic drawing panel —
 * GETs `dataPath`, which is either a JSON selector `{ok, items:[{label, url}]}` (several SVGs: per-layer board
 * exports, several boards' schematics), a JSON single `{ok, url}`, or the raw `<svg …>` document itself (a
 * GENERATED drawing like the pin map — no JSON wrapper needed). Whichever SVG is selected is fetched as TEXT and
 * inlined (sanitized) so its own geometry/CSS render faithfully; an optional `markersPath` GETs
 * `{ok, items:[{x, y, label, severity}]}` (DRC/ERC findings' positions) and draws them as circles over the
 * drawing when its viewBox can be read from the fetched text — a failed/absent markersPath never blocks the
 * drawing itself. Reused, unmodified, on /display/board-layout, /display/board-schematic and /display/boards.
 */
@Component({
  standalone: true,
  selector: 'api-svg-panel',
  imports: [CommonModule, FormsModule, MatProgressSpinnerModule],
  template: `
    <div class="api-svg-panel">
      <div *ngIf="loading" class="state"><mat-spinner diameter="28"></mat-spinner></div>
      <div *ngIf="error" class="state error">{{ error }}</div>
      <ng-container *ngIf="!loading && !error">
        <div class="svg-toolbar" *ngIf="items.length > 1">
          <label>
            Drawing:
            <select [(ngModel)]="selected" (ngModelChange)="onSelect($event)">
              <option *ngFor="let it of items" [value]="it.url">{{ it.label }}</option>
            </select>
          </label>
        </div>
        <div class="svg-stage" *ngIf="svgHtml; else noSvg">
          <div class="svg-host" [innerHTML]="svgHtml"></div>
          <svg class="svg-overlay" *ngIf="markers.length && viewBox" [attr.viewBox]="viewBox" preserveAspectRatio="xMidYMid meet">
            <circle *ngFor="let m of markers" [attr.cx]="m.x" [attr.cy]="m.y" r="2.4"
                    [attr.fill]="severityColor(m.severity)" stroke="#000" stroke-width="0.3" fill-opacity="0.85">
              <title>{{ m.label }}</title>
            </circle>
          </svg>
        </div>
        <ng-template #noSvg><div class="state">{{ emptyText }}</div></ng-template>
        <ul class="svg-markers-list" *ngIf="markers.length && !viewBox">
          <li *ngFor="let m of markers">{{ m.label }} (x={{ m.x }}, y={{ m.y }})</li>
        </ul>
      </ng-container>
    </div>
  `,
  styles: [`
    .api-svg-panel { display: block; min-width: 0; color: var(--text-on-card); }
    .state { padding: 12px 0; color: var(--text-on-card-muted); }
    .state.error { color: var(--color-error-text); }
    .svg-toolbar { margin-bottom: 8px; }
    .svg-toolbar select { font: inherit; }
    .svg-stage { position: relative; max-width: 100%; }
    .svg-host { max-width: 100%; overflow: auto; }
    .svg-host ::ng-deep svg { max-width: 100%; height: auto; display: block; }
    .svg-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
    .svg-markers-list { margin: 8px 0 0; padding-left: 18px; color: var(--text-on-card-muted); font-size: .9em; }
  `],
})
export class ApiSvgPanelComponent implements OnInit, OnChanges {
  /** GET returning `{items:[{label,url}]}`, `{url}`, or a raw SVG document. Required. */
  @Input() dataPath = '';
  /** Optional GET returning `{items:[{x,y,label,severity}]}` — drawn over the SVG when its viewBox is known. */
  @Input() markersPath = '';

  items: SvgItem[] = [];
  selected = '';
  svgHtml: SafeHtml | null = null;
  viewBox = '';
  markers: SvgMarker[] = [];
  loading = true;
  error: string | null = null;
  emptyText = 'No drawing yet.';

  constructor(private http: HttpClient, private sanitizer: DomSanitizer, private polariService: PolariService) {}

  ngOnInit(): void { this.load(); }

  ngOnChanges(changes: SimpleChanges): void {
    const reload = ['dataPath', 'markersPath'].some(k => changes[k] && !changes[k].firstChange);
    if (reload) { this.load(); }
  }

  private base(): string { return this.polariService.getBackendBaseUrl(); }

  private load(): void {
    this.error = null; this.svgHtml = null; this.items = []; this.markers = []; this.viewBox = '';
    if (!this.dataPath) { this.loading = false; this.error = 'api-svg-panel: no dataPath input.'; return; }
    this.loading = true;
    const path = this.dataPath;
    const headers = this.polariService.backendRequestOptions.headers;
    this.http.get(this.base() + path, { headers, responseType: 'text' }).subscribe({
      next: (raw: string) => {
        if (path !== this.dataPath) { return; }
        this.loading = false;
        const text = String(raw ?? '');
        if (text.trim().startsWith('<')) {
          // the dataPath itself IS the SVG document (e.g. a generated pin map) — no JSON wrapper needed
          this.items = [{ label: 'drawing', url: path }];
          this.selected = path;
          this.applySvg(text);
          this.loadMarkers();
          return;
        }
        let body: any;
        try { body = JSON.parse(text); } catch {
          this.error = `GET ${path}: not JSON and not an SVG document`;
          return;
        }
        if (!body || body.ok === false) { this.error = (body && (body.error || body.refusal)) || `GET ${path}: not ok`; return; }
        if (Array.isArray(body.items) && body.items.length) {
          this.items = body.items;
          this.selected = this.items[0].url;
          this.fetchSvg(this.items[0].url);
        } else if (body.url) {
          this.items = [{ label: 'drawing', url: body.url }];
          this.selected = body.url;
          this.fetchSvg(body.url);
        } else {
          this.emptyText = (body && body.note) || this.emptyText;
        }
      },
      error: (err: any) => {
        if (path !== this.dataPath) { return; }
        this.loading = false;
        const f = friendlyError(err, `GET ${path}`);
        this.error = f.text;
      },
    });
  }

  onSelect(url: string): void { this.fetchSvg(url); }

  private fetchSvg(url: string): void {
    const full = /^https?:\/\//.test(url) ? url : this.base() + url;
    this.http.get(full, { responseType: 'text' }).subscribe({
      next: (text: string) => { this.applySvg(text); this.loadMarkers(); },
      error: (err: any) => { const f = friendlyError(err, `GET ${url}`); this.error = f.text; },
    });
  }

  private applySvg(text: string): void {
    const m = text.match(/viewBox="([^"]+)"/);
    this.viewBox = m ? m[1] : '';
    this.svgHtml = this.sanitizer.bypassSecurityTrustHtml(text);
  }

  private loadMarkers(): void {
    this.markers = [];
    if (!this.markersPath) { return; }
    this.http.get<any>(this.base() + this.markersPath, this.polariService.backendRequestOptions).subscribe({
      next: (body: any) => {
        if (body && body.ok !== false && Array.isArray(body.items)) { this.markers = body.items; }
      },
      error: () => { /* markers are decorative — a failure never blocks the drawing itself */ },
    });
  }

  severityColor(sev?: string): string {
    const byKind: Record<string, string> = { error: '#c62828', warning: '#f57c00', info: '#1565c0', none: '#2e7d32' };
    return byKind[sev || ''] || '#6a1b9a';
  }
}
