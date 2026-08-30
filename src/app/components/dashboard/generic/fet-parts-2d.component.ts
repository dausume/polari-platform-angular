import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { PolariService } from '@services/polari-service';

interface Region2D {
  id: string; kind: string; label: string;
  x: number; y: number; w: number; h: number;
  material: string; sketch: boolean;
  part: any | null;
}

interface ScaledRect extends Region2D {
  px: number; py: number; pw: number; ph: number;
}

const FIELD_CHOICES = ['potential', 'electron-density', 'n-doping',
                       'p-doping', 'material'];

/**
 * fg-3 (fv-7 BUILD) — the generic 2-D parts view. GET
 * /api/fet/device/{device}/parts2d and draw the region rectangles in
 * device coordinates (nm): hover/click a region for its part card
 * (material, doping, purpose, the ROW it comes from), overlay the
 * 1-D field profile at the device's own Vdd (Vg/Vd sliders re-query
 * the backend), sketch dimensions dash-stroked and labelled. A
 * refusal (e.g. Si field overlays until the sifet basis exists)
 * renders verbatim — never an empty picture. Not a chart: a labelled
 * diagram, so it draws its own SVG instead of riding the graphs
 * machinery.
 */
@Component({
  standalone: true,
  selector: 'fet-parts-2d',
  imports: [CommonModule, FormsModule, MatProgressSpinnerModule],
  template: `
  <div class="parts2d">
    <div *ngIf="loading" class="state"><mat-spinner diameter="24"></mat-spinner></div>
    <div *ngIf="error && !loading" class="state error">{{ error }}</div>

    <ng-container *ngIf="report && !loading">
      <div class="controls" *ngIf="!compact">
        <label>field
          <select [(ngModel)]="field" (ngModelChange)="refetch()">
            <option *ngFor="let f of fieldChoices" [value]="f">{{ f }}</option>
          </select>
        </label>
        <label>Vg {{ vg }} V
          <input type="range" [min]="0" [max]="vMax" step="0.05"
                 [(ngModel)]="vg" (change)="refetch()">
        </label>
        <label>Vd {{ vd }} V
          <input type="range" [min]="0" [max]="vMax" step="0.05"
                 [(ngModel)]="vd" (change)="refetch()">
        </label>
        <span class="muted">{{ report.template }} · Vdd {{ report.vdd_v }} V</span>
      </div>

      <div class="legend">
        <span class="key" *ngFor="let k of kinds">
          <span class="swatch" [attr.data-kind]="k"></span>{{ k }}</span>
        <span class="key"><span class="swatch sketch-swatch"></span>sketch dimension</span>
      </div>

      <svg [attr.viewBox]="'0 0 1000 ' + svgH" preserveAspectRatio="xMidYMid meet"
           role="img" [attr.aria-label]="report.device + ' 2-D parts view'">
        <rect *ngFor="let r of rects" [attr.x]="r.px" [attr.y]="r.py"
              [attr.width]="r.pw" [attr.height]="r.ph"
              [attr.data-kind]="r.kind" class="region"
              [class.sketch]="r.sketch"
              [class.selected]="selected?.id === r.id"
              (mouseenter)="selected = r" (click)="selected = r">
          <title>{{ r.label }}</title>
        </rect>
        <ng-container *ngIf="overlaySegments.length">
          <polyline *ngFor="let seg of overlaySegments" [attr.points]="seg"
                    class="overlay-line"></polyline>
        </ng-container>
      </svg>
      <div class="axis muted">{{ report.view.axis }}</div>

      <div class="overlay-info" *ngIf="fieldOk">
        <b>{{ report.field.field }}</b> at Vg {{ report.field.vg }} V,
        Vd {{ report.field.vd }} V — {{ overlayMin }} … {{ overlayMax }}
        {{ report.field.unit }} <span class="muted">{{ report.field.fidelity }}</span>
      </div>
      <div class="state error" *ngIf="report.field?.ok === false">
        {{ report.field.refusal }}
      </div>

      <div class="part-card" *ngIf="selected">
        <div class="card-head">{{ selected.label }}
          <span class="chip" [attr.data-kind]="selected.kind">{{ selected.kind }}</span>
          <span class="chip sketch-chip" *ngIf="selected.sketch">sketch dimension</span>
        </div>
        <ng-container *ngIf="selected.part as p">
          <p class="purpose">{{ p.purpose }}</p>
          <div class="chips">
            <span class="chip">{{ p.material }}</span>
            <span class="chip">{{ p.doping?.statement }}</span>
            <span class="chip" *ngIf="p.process">{{ p.process }}</span>
          </div>
          <div class="chips dims">
            <span class="chip" *ngFor="let d of dims(p)">{{ d }}</span>
          </div>
          <div class="muted small" *ngIf="p.row">
            row: {{ p.row.className }} / {{ p.row.name }}</div>
          <div class="muted small" *ngIf="p.notes">{{ p.notes }}</div>
        </ng-container>
        <div class="muted" *ngIf="!selected.part">no part entry maps to
          this region (kind {{ selected.kind }})</div>
      </div>

      <div class="muted small note" *ngIf="!compact">{{ report.note }}</div>
      <div class="muted small" *ngFor="let n of report.notes">{{ n }}</div>
    </ng-container>
  </div>
  `,
  styles: [`
    .parts2d { container-type: inline-size; width: 100%; }
    .state { display: flex; align-items: center; gap: 8px; padding: 12px; }
    .state.error { color: var(--warn-text, #b71c1c); white-space: pre-wrap; }
    .controls { display: flex; flex-wrap: wrap; gap: 16px; align-items: center;
      margin-bottom: 8px; }
    .controls label { display: flex; align-items: center; gap: 6px;
      font-size: 0.85em; }
    .legend { display: flex; flex-wrap: wrap; gap: 12px; font-size: 0.8em;
      margin-bottom: 4px; }
    .key { display: inline-flex; align-items: center; gap: 4px; }
    .swatch { width: 14px; height: 10px; display: inline-block;
      border-radius: 2px; opacity: 0.8; }
    svg { width: 100%; height: auto; display: block;
      background: var(--surface-alt, rgba(127,127,127,0.06));
      border-radius: 6px; }
    .region { opacity: 0.78; stroke: rgba(0,0,0,0.35); stroke-width: 0.5;
      cursor: pointer; }
    .region.sketch { stroke-dasharray: 4 3; }
    .region.selected { opacity: 1; stroke: var(--text-primary, #000);
      stroke-width: 1.5; }
    .region[data-kind='contact'], .swatch[data-kind='contact'] { fill: #90a4ae; background: #90a4ae; }
    .region[data-kind='extension'], .swatch[data-kind='extension'] { fill: #66bb6a; background: #66bb6a; }
    .region[data-kind='channel'], .swatch[data-kind='channel'] { fill: #42a5f5; background: #42a5f5; }
    .region[data-kind='oxide'], .swatch[data-kind='oxide'] { fill: #ffb74d; background: #ffb74d; }
    .region[data-kind='gate'], .swatch[data-kind='gate'] { fill: #ef5350; background: #ef5350; }
    .sketch-swatch { background: transparent; border: 1.5px dashed #888; }
    .overlay-line { fill: none; stroke: var(--text-primary, #111);
      stroke-width: 2; }
    .axis { font-size: 0.75em; margin-top: 2px; }
    .overlay-info { font-size: 0.85em; margin-top: 6px; }
    .part-card { margin-top: 8px; padding: 10px; border-radius: 6px;
      background: var(--surface-alt, rgba(127,127,127,0.08)); }
    .card-head { font-weight: 600; display: flex; flex-wrap: wrap;
      gap: 8px; align-items: center; }
    .purpose { margin: 6px 0; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0; }
    .chip { padding: 1px 8px; border-radius: 10px; font-size: 0.78em;
      background: rgba(127,127,127,0.18); }
    .chip[data-kind] { color: #fff; }
    .chip[data-kind='contact'] { background: #78909c; }
    .chip[data-kind='extension'] { background: #4caf50; }
    .chip[data-kind='channel'] { background: #1e88e5; }
    .chip[data-kind='oxide'] { background: #fb8c00; }
    .chip[data-kind='gate'] { background: #e53935; }
    .sketch-chip { border: 1px dashed #888; background: transparent; }
    .muted { color: var(--text-secondary, #777); }
    .small { font-size: 0.78em; }
    .note { margin-top: 6px; }
  `],
})
export class FetParts2dComponent implements OnInit, OnChanges {
  /** Device key ('cnt-aligned-s1', 'si-nmos-planar-90'). Required. */
  @Input() device = '';
  /** Compact: no controls, shorter drawing (score-page row). */
  @Input() compact = false;

  loading = true;
  error: string | null = null;
  report: any = null;

  field = 'potential';
  vg: number | null = null;
  vd: number | null = null;
  fieldChoices = FIELD_CHOICES;

  rects: ScaledRect[] = [];
  overlaySegments: string[] = [];
  overlayMin = '';
  overlayMax = '';
  selected: ScaledRect | null = null;
  svgH = 420;
  kinds: string[] = [];

  constructor(private http: HttpClient,
              private polariService: PolariService) {}

  ngOnInit(): void { this.fetch(); }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['device'] && !changes['device'].firstChange) {
      this.vg = this.vd = null;
      this.fetch();
    }
  }

  get vMax(): number {
    const vdd = Number(this.report?.vdd_v) || 1.0;
    return Math.round(vdd * 1.2 * 20) / 20;
  }

  get fieldOk(): boolean { return this.report?.field?.ok === true; }

  refetch(): void { this.fetch(); }

  dims(p: any): string[] {
    return Object.entries(p?.dimensions || {})
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => `${k}: ${v}`);
  }

  private fetch(): void {
    if (!this.device) {
      this.loading = false;
      this.error = 'fet-parts-2d: no device input.';
      return;
    }
    this.loading = true;
    this.error = null;
    const device = this.device;
    let path = `/api/fet/device/${device}/parts2d?field=${this.field}`;
    if (this.vg !== null) { path += `&vg=${this.vg}`; }
    if (this.vd !== null) { path += `&vd=${this.vd}`; }
    const url = this.polariService.getBackendBaseUrl() + path;
    this.http.get<any>(url, this.polariService.backendRequestOptions).subscribe({
      next: (body: any) => {
        if (device !== this.device) { return; }
        this.loading = false;
        if (!body || body.ok === false) {
          this.error = body?.error || body?.refusal || `GET ${path}: not ok`;
          return;
        }
        this.report = body;
        if (this.vg === null && body.field?.ok) {
          this.vg = Number(body.field.vg);
          this.vd = Number(body.field.vd);
        }
        this.layout();
      },
      error: (err: any) => {
        if (device !== this.device) { return; }
        this.loading = false;
        this.error = err?.error?.error
          || `GET ${path} failed: ${err?.message || 'request failed'}`;
      },
    });
  }

  /** nm → SVG px (1000 wide; y flipped, SVG y grows down). */
  private layout(): void {
    const v = this.report.view;
    const spanX = (v.x1 - v.x0) || 1;
    const spanY = (v.y1 - v.y0) || 1;
    this.svgH = Math.round(Math.min(
      this.compact ? 240 : 420, Math.max(160, 1000 * spanY / spanX)));
    const sx = 1000 / spanX;
    const sy = this.svgH / spanY;
    const px = (x: number) => (x - v.x0) * sx;
    const py = (y: number) => (v.y1 - y) * sy;   // flip
    this.rects = (this.report.regions || []).map((r: Region2D) => ({
      ...r,
      px: px(r.x), py: py(r.y + r.h),
      pw: Math.max(r.w * sx, 1), ph: Math.max(r.h * sy, 1),
    }));
    this.kinds = Array.from(new Set(this.rects.map(r => r.kind)));
    const stillThere = this.rects.find(r => r.id === this.selected?.id);
    this.selected = stillThere
      || this.rects.find(r => r.kind === 'channel') || null;
    this.overlaySegments = [];
    this.overlayMin = this.overlayMax = '';
    const f = this.report.field;
    if (!f?.ok || !Array.isArray(f.x_nm)) { return; }
    const vals = (f.value || []).map((x: any) =>
      (x === null || x === undefined) ? null : Number(x));
    const finite = vals.filter((x: number | null) =>
      x !== null && Number.isFinite(x)) as number[];
    if (!finite.length) { return; }
    const lo = Math.min(...finite), hi = Math.max(...finite);
    this.overlayMin = lo.toPrecision(3);
    this.overlayMax = hi.toPrecision(3);
    const span = (hi - lo) || 1;
    // the profile is drawn across the middle band of the picture
    const band0 = this.svgH * 0.82, band1 = this.svgH * 0.18;
    let seg: string[] = [];
    const flush = () => {
      if (seg.length > 1) { this.overlaySegments.push(seg.join(' ')); }
      seg = [];
    };
    f.x_nm.forEach((x: number, i: number) => {
      const val = vals[i];
      if (val === null || !Number.isFinite(val)) { flush(); return; }
      const yy = band0 + (band1 - band0) * ((val - lo) / span);
      seg.push(`${px(x).toFixed(1)},${yy.toFixed(1)}`);
    });
    flush();
  }
}
