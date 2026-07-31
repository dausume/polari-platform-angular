import {
  Component, ElementRef, Input, OnChanges, OnDestroy, OnInit,
  SimpleChanges, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { PolariService } from '@services/polari-service';
import { MotorsService } from '@services/motors.service';
import { SimSpaceRendererFactory }
  from '@services/sim-space/sim-space-renderer-factory.service';
import { SimSpaceService } from '@services/sim-space/sim-space.service';

/**
 * viz-2: ONE 3D canvas for the clock views — visualization LAYERS
 * (rows from /api/motors/clock-scene/{view}) that switch with the
 * discipline tab and STACK in any combination:
 *
 *   part-coloring  -> colorOverride per body (later layer wins)
 *   vector-field   -> arrow overlays (mag-fv payloads)
 *   replay         -> solver-history animation (geometry config is
 *                     DATA on the layer, not code here)
 *   markers        -> builtin-sphere joints (interface failure map)
 *
 * A refused layer renders as a disabled chip carrying its reason —
 * the canvas never silently loses a visualization. One renderer,
 * one WebGL context, scene contents swapped in place.
 */
@Component({
  standalone: true,
  selector: 'clock-scene',
  imports: [CommonModule, MatIconModule, MatTooltipModule],
  template: `
  <div class="cs-wrap">
    <div class="cs-bar" *ngIf="scene?.ok">
      <span class="cs-title">3D — {{ scene.baseScene }}</span>
      <button class="cs-chip" *ngFor="let l of scene.layers"
              [class.on]="enabled.has(l.name)"
              [class.refused]="!l.ok"
              [matTooltip]="l.ok ? l.description : ('refused: ' + l.refusal)"
              (click)="l.ok && toggle(l.name)">
        <mat-icon class="cs-chip-ic">{{ kindIcon(l.kind) }}</mat-icon>
        {{ l.displayName }}
      </button>
      <span class="cs-replay" *ngIf="replayOn()">
        θ {{ theta | number:'1.0-0' }}° ·
        {{ stepsSoFar }} steps
        <button class="cs-chip" (click)="playPause()">
          {{ playing ? 'pause' : 'play' }}</button>
      </span>
    </div>
    <div class="cs-refusal" *ngIf="scene && !scene.ok">
      {{ scene.refusal }}</div>
    <div #host class="cs-host"></div>
    <div class="cs-legends" *ngIf="scene?.ok">
      <ng-container *ngFor="let l of scene.layers">
        <div class="cs-legend" *ngIf="enabled.has(l.name) && l.legend?.length">
          <span class="cs-legend-title">{{ l.displayName }}</span>
          <span class="cs-swatch" *ngFor="let e of l.legend">
            <i [style.background]="e.color"></i>{{ e.label }}</span>
          <span class="cs-note" *ngIf="l.note">{{ l.note }}</span>
        </div>
      </ng-container>
    </div>
  </div>
  `,
  styles: [`
    .cs-wrap { border: 1px solid var(--surface-outline, #8884);
      border-radius: 8px; background: var(--surface-primary);
      color: var(--text-on-card); margin-bottom: 14px; }
    .cs-bar { display: flex; align-items: center; gap: 6px;
      flex-wrap: wrap; padding: 8px 10px; }
    .cs-title { font-weight: 600; margin-right: 6px;
      font-size: 0.9em; }
    .cs-chip { display: inline-flex; align-items: center; gap: 4px;
      border: 1px solid var(--surface-outline, #8884);
      border-radius: 13px; padding: 2px 10px; cursor: pointer;
      background: transparent; color: var(--text-on-card-muted);
      font-size: 0.83em; }
    .cs-chip.on { color: var(--text-on-card);
      border-color: var(--text-on-card);
      background: var(--surface-hover, #8882); }
    .cs-chip.refused { opacity: 0.5; cursor: help;
      text-decoration: line-through; }
    .cs-chip-ic { font-size: 14px; width: 14px; height: 14px; }
    .cs-replay { margin-left: auto; display: inline-flex;
      gap: 8px; align-items: center; font-size: 0.85em; }
    .cs-host { height: 380px; }
    .cs-refusal { padding: 10px 14px; color: #c98a00; }
    .cs-legends { padding: 4px 10px 8px; }
    .cs-legend { display: flex; align-items: baseline; gap: 10px;
      flex-wrap: wrap; font-size: 0.8em; padding: 2px 0;
      color: var(--text-on-card-muted); }
    .cs-legend-title { font-weight: 600;
      color: var(--text-on-card); }
    .cs-swatch i { display: inline-block; width: 10px;
      height: 10px; border-radius: 2px; margin-right: 4px; }
    .cs-note { font-style: italic; }
  `],
})
export class ClockSceneComponent
  implements OnInit, OnChanges, OnDestroy {
  @Input() view = '';
  @ViewChild('host', { static: true })
  hostRef!: ElementRef<HTMLElement>;

  scene: any = null;
  enabled = new Set<string>();

  private renderer: any = null;
  private loadedScene = '';
  private sceneObjects: any[] | null = null;
  private viewportDef: any = null;

  // replay state
  sim: any = null;
  playing = false; theta = 0; stepsSoFar = 0;
  private polarity = 0; private pulseIndex = 0;
  private timer: any = null;

  constructor(private http: HttpClient,
              private polariService: PolariService,
              private motors: MotorsService,
              private simSpaces: SimSpaceService,
              private rendererFactory: SimSpaceRendererFactory) {}

  ngOnInit(): void { this.reload(); }

  ngOnChanges(ch: SimpleChanges): void {
    if (ch['view'] && !ch['view'].firstChange) { this.reload(); }
  }

  ngOnDestroy(): void {
    this.stopTimer();
    this.renderer?.destroy?.();
  }

  kindIcon(kind: string): string {
    switch (kind) {
      case 'replay': return 'play_circle';
      case 'vector-field': return 'grain';
      case 'markers': return 'join_inner';
      default: return 'palette';
    }
  }

  replayOn(): boolean {
    return !!this.scene?.layers?.some(
      (l: any) => l.kind === 'replay' && l.ok
        && this.enabled.has(l.name));
  }

  private layer(name: string): any {
    return this.scene?.layers?.find((l: any) => l.name === name);
  }

  private async reload(): Promise<void> {
    if (!this.view) { return; }
    const url = `${this.polariService.getBackendBaseUrl()}` +
      `/api/motors/clock-scene/${this.view}`;
    this.scene = await firstValueFrom(this.http.get<any>(
      url, this.polariService.backendRequestOptions))
      .catch((err) => err?.error ?? {
        ok: false, refusal: 'clock-scene unreachable — is the ' +
          'motors module online?' });
    if (!this.scene?.ok) { return; }
    this.enabled = new Set(this.scene.layers
      .filter((l: any) => l.ok && l.defaultOn)
      .map((l: any) => l.name));
    await this.ensureScene(this.scene.baseScene);
    if (this.replayOn()) { await this.ensureSim(); }
    this.repaint();
    if (this.replayOn() && !this.playing) { this.playPause(); }
  }

  private async ensureScene(name: string): Promise<void> {
    if (!this.renderer) {
      this.renderer = await this.rendererFactory.create('3d');
      this.renderer.attach(this.hostRef.nativeElement);
    }
    if (this.loadedScene === name && this.sceneObjects) { return; }
    const snap: any = await this.simSpaces.snapshot(name)
      .catch(() => null);
    if (!snap) { return; }
    this.renderer.loadDefinition(snap.definition);
    this.sceneObjects = snap.objects ?? [];
    this.viewportDef = snap.definition;
    this.loadedScene = name;
  }

  private async ensureSim(): Promise<void> {
    if (this.sim?.ok) { return; }
    this.sim = await this.motors.clockSim(
      this.scene?.design || 'clock-lavet-m0', 12, true);
    this.pulseIndex = 0; this.stepsSoFar = 0;
    this.theta = 0; this.polarity = 0;
  }

  async toggle(name: string): Promise<void> {
    if (this.enabled.has(name)) { this.enabled.delete(name); }
    else {
      this.enabled.add(name);
      const l = this.layer(name);
      if (l?.kind === 'replay') { await this.ensureSim(); }
    }
    if (!this.replayOn()) { this.stopTimer(); this.playing = false; }
    this.repaint();
  }

  // ---- composition ------------------------------------------------

  private replayGeom(): any {
    const l = this.scene.layers.find(
      (x: any) => x.kind === 'replay' && x.ok
        && this.enabled.has(x.name));
    return l?.geometry ?? null;
  }

  private rotorTransform(geom: any, thetaRad: number): any {
    // world = a + R(vertex - a): geometry carries absolute coords,
    // so spinning about the rotor axis needs position = a - R a
    // (the mag-10c derivation, now driven by layer DATA).
    const ax = geom.rotorAxisX ?? 0;
    return {
      rotation: [0, 0, thetaRad],
      position: [ax * (1 - Math.cos(thetaRad)),
                 -ax * Math.sin(thetaRad), 0],
    };
  }

  private repaint(): void {
    if (!this.renderer || !this.sceneObjects) { return; }
    const colorOf: Record<string, any> = {};
    let anyColoring = false;
    for (const l of this.scene.layers) {
      if (l.kind !== 'part-coloring' || !l.ok
          || !this.enabled.has(l.name)) { continue; }
      anyColoring = true;
      for (const [body, spec] of
           Object.entries<any>(l.bodies ?? {})) {
        colorOf[body] = spec;   // later enabled layer wins
      }
    }
    const geom = this.replayGeom();
    const thetaRad = this.theta * Math.PI / 180;
    const spin = geom ? this.rotorTransform(geom, thetaRad) : null;
    const coilStyle = !geom ? '' :
      this.polarity > 0 ? geom.coilStyles?.pos :
      this.polarity < 0 ? geom.coilStyles?.neg :
      geom.coilStyles?.idle;
    const objects = this.sceneObjects.map((o: any) => {
      const isRotor = geom?.rotorBodies?.includes(o.id);
      const spec = colorOf[o.id];
      return {
        ...o, trackKey: o.id,
        styleRef: (geom && o.id === geom.coilBody && coilStyle)
          ? coilStyle : o.styleRef,
        rotation: isRotor && spin ? spin.rotation : o.rotation,
        position: isRotor && spin ? spin.position : o.position,
        colorOverride: spec?.color,
        opacityOverride: anyColoring && !spec ? 0.3 : undefined,
      };
    });
    for (const l of this.scene.layers) {
      if (l.kind !== 'markers' || !l.ok
          || !this.enabled.has(l.name)) { continue; }
      for (const m of l.markers ?? []) {
        objects.push({
          id: m.id, trackKey: m.id, shapeRef: 'sphere',
          styleRef: 'matte-blue', position: m.position,
          scale: [m.radius, m.radius, m.radius],
          colorOverride: m.color,
          opacityOverride: m.alpha ?? 0.5,
          label: `${m.interface} — modes: ` +
            `${m.failureModes?.join(', ')}`,
        });
      }
    }
    this.renderer.setObjects(objects);
    this.renderer.setVectors(this.composeVectors(geom, thetaRad));
    if (this.loadedScene && !this.viewportDef?.viewport) {
      this.renderer.zoomToFit?.();
    }
  }

  private composeVectors(geom: any, thetaRad: number): any[] {
    const vectors: any[] = [];
    if (geom) {
      vectors.push(
        { kind: 'vector', key: 'orientation',
          origin: geom.orientationOrigin,
          vec: [-Math.sin(thetaRad), Math.cos(thetaRad), 0],
          scale: geom.orientationScale, headScale: 0.25,
          styleRef: 'motor-pointer-red' },
        { kind: 'vector', key: 'ac-field',
          origin: geom.fieldOrigin,
          vec: (geom.fieldAxis ?? [1, 0, 0]).map(
            (c: number) => c * this.polarity),
          scale: this.polarity === 0 ? 0.001 : geom.fieldScale,
          headScale: 0.3,
          styleRef: this.polarity >= 0 ? 'motor-coil-pos'
                                       : 'motor-coil-neg' });
    }
    for (const l of this.scene.layers) {
      if (l.kind !== 'vector-field' || !l.ok
          || !this.enabled.has(l.name)) { continue; }
      const anchor = l.placement?.anchor ?? [0, 0, 0];
      const fit = l.placement?.fitExtent ?? 8;
      const pts = (l.vectors ?? []).map((v: any) => v.point);
      const span = Math.max(1e-12, ...[0, 1, 2].map(
        (i) => Math.max(...pts.map((p: any) => Math.abs(p[i])))));
      const s = fit / span;
      const mags = (l.vectors ?? []).map((v: any) => v.magnitude);
      const maxMag = Math.max(1e-12, ...mags);
      (l.vectors ?? []).forEach((v: any, i: number) => {
        vectors.push({
          kind: 'vector', key: `${l.name}-${i}`,
          origin: v.point.map(
            (c: number, k: number) => anchor[k] + c * s),
          vec: v.vector,
          scale: 0.25 + 0.75 * (v.magnitude / maxMag),
          headScale: 0.3, color: v.color });
      });
    }
    return vectors;
  }

  // ---- replay loop ------------------------------------------------

  playPause(): void {
    if (this.playing) { this.stopTimer(); this.playing = false;
                        return; }
    if (!this.sim?.ok) { return; }
    this.playing = true;
    const rate = this.sim.rateHz || 1;
    this.timer = setInterval(() => this.tick(),
                             Math.max(250, 1000 / rate));
  }

  private tick(): void {
    if (!this.sim?.ok || !this.replayOn()) {
      this.stopTimer(); this.playing = false; return;
    }
    if (this.pulseIndex >= this.sim.pulses) {
      this.pulseIndex = 0;   // loop the replay on the scene canvas
      this.stepsSoFar = 0;
    }
    this.pulseIndex += 1;
    const entry = this.sim.history?.[this.pulseIndex];
    if (!entry) { return; }
    this.polarity = entry.polarity;
    if (entry.stepped) { this.stepsSoFar += 1; }
    this.theta = entry.thetaDeg;
    this.repaint();
  }

  private stopTimer(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }
}
