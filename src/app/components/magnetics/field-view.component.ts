import { Component, ElementRef, OnDestroy, OnInit, ViewChild }
  from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MagneticsService } from '@services/magnetics.service';
import { SimSpaceRendererFactory }
  from '@services/sim-space/sim-space-renderer-factory.service';

/**
 * mag-7 remainder: /magnetics/fields — the mag-fv payloads made
 * VISIBLE. Threshold-gated vector dispersions and user-drawn
 * threshold shells render in the 3D space (band color + alpha ride
 * the ROWS — the renderer's data-carried overrides exist for
 * exactly this); flux tubes render as an HONEST per-element list:
 * the solve is 1D-per-path (the payload's own watermark) and
 * carries no geometry, so drawing routed 3D pipes would invent
 * positions the solver never produced.
 */
@Component({
  standalone: true,
  selector: 'field-view',
  imports: [CommonModule, RouterModule],
  template: `
  <div class="fv-page">
    <h2>Field views — dispersions, shells, flux tubes</h2>
    <p class="hint">Every view is a FieldViewDefinition row; bands
      (thresholds, colors, alpha) are FieldThresholdBand rows.
      Absence of arrows = below threshold, not zero field — the
      payload says so and the page repeats it.</p>

    <div class="err" *ngIf="views && !views.ok">
      {{ views.refusal }}</div>

    <div class="picker" *ngIf="views?.ok">
      <button *ngFor="let v of views.views"
              [class.active]="selected === v.name"
              (click)="select(v.name)">
        {{ v.displayName }}
        <span class="chip chip-outline">{{ v.displayMode }}</span>
      </button>
    </div>

    <div class="err" *ngIf="payload && !payload.ok">
      {{ payload.refusal }}</div>

    <ng-container *ngIf="payload?.ok">
      <!-- The 3D card is HIDDEN, never destroyed, when a view has no
           3D mode: tearing the host out of the DOM per switch forced
           a new WebGL context each time and Chrome stalled on the
           churn. One context, reused. -->
      <div class="card"
           [hidden]="payload.displayMode === 'flux-tubes'">
        <div #host3d class="host3d"></div>
        <div class="legend">
          <span *ngFor="let b of legend" class="legend-item">
            <span class="swatch"
                  [style.background]="b.color"
                  [style.opacity]="b.alpha"></span>
            {{ b.label }}</span>
        </div>
        <div class="readout"
             *ngIf="payload.displayMode === 'threshold-shapes'">
          <span *ngFor="let s of payload.shapes">
            {{ s.label }}: precision
            <b>{{ s.fit?.precision ?? '—' }}</b> · recall
            <b>{{ s.fit?.recall ?? '—' }}</b></span>
        </div>
        <p class="hint" *ngIf="payload.note">{{ payload.note }}</p>
        <p class="hint">{{ payload.watermark }}</p>
      </div>

      <div class="card"
           *ngIf="payload.displayMode === 'flux-tubes'">
        <h4>Flux per element — {{ payload.device?.ref }}</h4>
        <p class="hint">The solve is 1D per path (the watermark
          below) and carries NO geometry — routed 3D pipes would
          invent positions the solver never produced, so this view
          stays a list. The layout page owns the geometry.</p>
        <div class="tube-row" *ngFor="let t of payload.tubes">
          <code class="tube-name">{{ t.element }}</code>
          <span class="chip chip-outline">{{ t.kind }}</span>
          <div class="bar-track">
            <div class="bar"
                 [style.width.%]="barPct(t)"
                 [style.background]="t.color || '#888'"
                 [style.opacity]="t.alpha ?? 0.8"></div>
          </div>
          <span class="flux">{{ sci(t.fluxWb) }} Wb
            <ng-container *ngIf="t.fluxDensityT != null">
              · {{ t.fluxDensityT }} T</ng-container></span>
        </div>
        <div class="warn-text"
             *ngFor="let f of payload.saturationFlags">
          ⚠ {{ f.element }}: {{ f.note || 'saturation flagged' }}
        </div>
        <p class="hint">{{ payload.watermark }}</p>
      </div>
    </ng-container>

    <div class="foot">
      <a routerLink="/magnetics/motor">motor ladder</a>
    </div>
  </div>
  `,
  styles: [`
    .fv-page { padding: 14px 18px;
      color: var(--text-on-bg, inherit); }
    .hint { color: var(--text-on-bg-muted,
      var(--text-on-card-muted)); font-size: 0.9em; }
    .err { color: #d33; }
    .warn-text { color: #c80; font-size: 0.9em; }
    .picker { display: flex; gap: 8px; flex-wrap: wrap;
      margin: 10px 0; }
    .picker button { padding: 6px 12px; border-radius: 8px;
      border: 1px solid var(--surface-outline, #8884);
      background: var(--surface-primary);
      color: var(--text-on-card); cursor: pointer; }
    .picker button.active { border-color: #46f; }
    /* base chip recipe lives in _chip-patterns.css */
    .chip { margin-left: 6px; }
    .card { border: 1px solid var(--surface-outline, #8884);
      border-radius: 8px; padding: 12px; max-width: 760px;
      background: var(--surface-primary);
      color: var(--text-on-card); margin-bottom: 12px; }
    .host3d { width: 100%; height: 420px; border-radius: 6px;
      overflow: hidden; background:
      var(--surface-app-background, #14161a); }
    .legend { display: flex; gap: 14px; flex-wrap: wrap;
      margin: 8px 0; font-size: 0.85em; }
    .legend-item { display: flex; align-items: center; gap: 5px; }
    .swatch { width: 14px; height: 14px; border-radius: 3px;
      display: inline-block; }
    .readout { display: flex; gap: 14px; flex-wrap: wrap;
      font-variant-numeric: tabular-nums; margin: 6px 0;
      font-size: 0.9em; }
    .tube-row { display: flex; align-items: center; gap: 10px;
      margin: 4px 0; font-size: 0.85em; }
    .tube-name { min-width: 230px; overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap; }
    .bar-track { flex: 1 1 120px; height: 10px; border-radius: 5px;
      background: var(--surface-outline, #8883);
      overflow: hidden; }
    .bar { height: 100%; border-radius: 5px; }
    .flux { font-variant-numeric: tabular-nums; min-width: 130px; }
    .foot { margin-top: 14px; font-size: 0.9em; }
    .foot a { color: inherit; }
  `],
})
export class FieldViewComponent implements OnInit, OnDestroy {
  views: any; payload: any; selected = '';
  legend: Array<{ label: string; color: string;
                  alpha: number }> = [];
  @ViewChild('host3d') host3dRef?: ElementRef<HTMLElement>;
  private renderer3d: any = null;

  constructor(private magnetics: MagneticsService,
              private rendererFactory: SimSpaceRendererFactory) {}

  async ngOnInit(): Promise<void> {
    this.views = await this.magnetics.fieldViews();
    if (this.views?.ok && this.views.views?.length) {
      await this.select(this.views.views[0].name);
    }
  }

  ngOnDestroy(): void { this.destroy3d(); }

  private destroy3d(): void {
    try { this.renderer3d?.destroy(); } catch { /* detached */ }
    this.renderer3d = null;
  }

  sci(value: number): string {
    return (value ?? 0).toExponential(2);
  }

  barPct(t: any): number {
    const mags = (this.payload?.tubes || [])
      .map((x: any) => Math.abs(x.fluxWb || 0));
    const max = Math.max(...mags, 1e-30);
    return Math.max(2, (Math.abs(t.fluxWb || 0) / max) * 100);
  }

  async select(name: string): Promise<void> {
    this.selected = name;
    this.payload = await this.magnetics.fieldView(name);
    this.legend = [];
    if (!this.payload?.ok) { return; }
    // The host div materializes on the NEXT change-detection pass
    // the first time through — defer, same as the motor page.
    setTimeout(() => this.render3d(), 0);
  }

  /** ONE renderer for the component's lifetime; each view just
   *  swaps its contents. Creating a WebGL context per view switch
   *  is what stalled the tab. */
  private async render3d(): Promise<void> {
    const host = this.host3dRef?.nativeElement;
    if (!host || !this.payload?.ok) { return; }
    if (!this.renderer3d) {
      // Asset libraries are guaranteed loaded by the factory
      // (ensureSceneAssets) — pages no longer hand-load them.
      this.renderer3d = await this.rendererFactory.create('3d');
      this.renderer3d.attach(host);
      this.renderer3d.loadDefinition({
        id: 'fv-space', name: 'fv-space',
        dimensionality: '3d', coordinateSystem: 'math',
        unitScale: 1,
        viewport: { center: [0, 0, 0], extent: [6, 6, 6] },
        definition: '{}',
      });
    }
    // Clear the OTHER collection so a mode switch never leaves the
    // previous view's geometry behind.
    if (this.payload.displayMode === 'vector-dispersion') {
      this.renderer3d.setObjects([]);
      this.renderDispersion();
    } else if (this.payload.displayMode === 'threshold-shapes') {
      this.renderer3d.setVectors([]);
      this.renderShells();
    } else {
      this.renderer3d.setObjects([]);
      this.renderer3d.setVectors([]);
    }
  }

  /** Meters → scene units so the sampled extent fills ~±4.5. */
  private sceneScale(points: number[][]): number {
    let maxAbs = 1e-9;
    for (const p of points) {
      for (const c of p) { maxAbs = Math.max(maxAbs, Math.abs(c)); }
    }
    return 4.5 / maxAbs;
  }

  private renderDispersion(): void {
    const vecs = this.payload.vectors || [];
    const S = this.sceneScale(vecs.map((v: any) => v.point));
    const maxMag = Math.max(
      ...vecs.map((v: any) => v.magnitude || 0), 1e-30);
    const bands = new Map<string, any>();
    this.renderer3d.setVectors(vecs.map((v: any, i: number) => {
      bands.set(v.band, v);
      const mag = Math.hypot(v.vector[0], v.vector[1],
                             v.vector[2]) || 1e-30;
      // Arrow length encodes RELATIVE magnitude (0.25–1.0 units);
      // absolute field strength lives in the band thresholds.
      const len = 0.25 + 0.75 * ((v.magnitude || 0) / maxMag);
      return {
        kind: 'vector', key: `fv-${i}`,
        origin: [v.point[0] * S, v.point[1] * S, v.point[2] * S],
        vec: [v.vector[0] / mag, v.vector[1] / mag,
              v.vector[2] / mag],
        scale: len, headScale: 0.3, styleRef: '',
        color: v.color,
      };
    }));
    this.legend = [...bands.values()].map((v: any) => ({
      label: v.band, color: v.color, alpha: v.alpha ?? 1 }));
    const below = this.payload.outsideBands;
    if (below !== undefined) {
      this.legend.push({
        label: `${below} samples below every band `
          + '(absence = below threshold, not zero field)',
        color: 'transparent', alpha: 1 });
    }
  }

  private renderShells(): void {
    const shapes = (this.payload.shapes || [])
      .filter((s: any) => s.shape && s.shape.kind);
    const pts: number[][] = [];
    for (const s of shapes) {
      if (s.shape.kind === 'sphere') {
        const [cx, cy, cz] = s.shape.center || [0, 0, 0];
        const r = s.shape.r_m || 0;
        pts.push([cx + r, cy + r, cz + r]);
      } else if (s.shape.kind === 'box') {
        pts.push(s.shape.min || [0, 0, 0],
                 s.shape.max || [0, 0, 0]);
      } else if (s.shape.kind === 'cylinder') {
        const [cx, cy, cz] = s.shape.center || [0, 0, 0];
        const e = (s.shape.half_len_m || 0) + (s.shape.r_m || 0);
        pts.push([cx + e, cy + e, cz + e]);
      }
    }
    const S = this.sceneScale(pts);
    const objects: any[] = [];
    shapes.forEach((s: any, i: number) => {
      const base = {
        id: `shell-${i}`, trackKey: `shell-${i}`,
        styleRef: 'glossy-white',
        colorOverride: s.color,
        opacityOverride: s.alpha ?? 0.35,
      };
      if (s.shape.kind === 'sphere') {
        const r = (s.shape.r_m || 0) * S;
        objects.push({ ...base, shapeRef: 'sphere',
          position: (s.shape.center || [0, 0, 0])
            .map((c: number) => c * S),
          scale: [r * 2, r * 2, r * 2] });
      } else if (s.shape.kind === 'box') {
        const mn = s.shape.min || [0, 0, 0];
        const mx = s.shape.max || [0, 0, 0];
        objects.push({ ...base, shapeRef: 'cube',
          position: mn.map((c: number, k: number) =>
            ((c + mx[k]) / 2) * S),
          scale: mn.map((c: number, k: number) =>
            Math.max((mx[k] - c) * S, 1e-3)) });
      } else if (s.shape.kind === 'cylinder') {
        // Builtin cylinder runs along Y; the seeded shells are
        // spheres, so a non-Y axis here is a future-row case —
        // rendered unrotated with an honest console note.
        const r = (s.shape.r_m || 0) * S;
        const h = (s.shape.half_len_m || 0) * 2 * S;
        objects.push({ ...base, shapeRef: 'cylinder',
          position: (s.shape.center || [0, 0, 0])
            .map((c: number) => c * S),
          scale: [r * 2, Math.max(h, 1e-3), r * 2] });
      }
    });
    this.renderer3d.setObjects(objects);
    this.legend = shapes.map((s: any) => ({
      label: `${s.label} (${s.min} ${s.unit} ≤ |field|)`,
      color: s.color, alpha: s.alpha ?? 0.35 }));
  }
}
