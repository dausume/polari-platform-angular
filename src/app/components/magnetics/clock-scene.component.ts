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
      <ng-container *ngIf="scene.scenes?.length > 1">
        <button class="cs-chip cs-scene" *ngFor="let s of scene.scenes"
                [class.on]="s.name === scene.scene"
                (click)="pickScene(s.name)">
          <mat-icon class="cs-chip-ic">{{ s.name === 'gear-train'
            ? 'settings' : 'precision_manufacturing' }}</mat-icon>
          {{ s.title }}
        </button>
        <span class="cs-sep">|</span>
      </ng-container>
      <button class="cs-chip" *ngFor="let l of scene.layers"
              [class.on]="enabled.has(l.name)"
              [class.refused]="!l.ok"
              [matTooltip]="l.ok ? l.description : ('refused: ' + l.refusal)"
              (click)="l.ok && toggle(l.name)">
        <mat-icon class="cs-chip-ic">{{ kindIcon(l.kind) }}</mat-icon>
        {{ l.displayName }}
      </button>
      <span class="cs-replay" *ngIf="replayOn() || phaseReplayOn()">
        θ {{ theta | number:'1.0-0' }}° ·
        {{ stepsSoFar }} steps
        <span *ngIf="phaseReplayOn() && currentPhase !== ''">
          · phase {{ ['A','B','C'][+currentPhase] }} lit</span>
        <button class="cs-chip" (click)="playPause()">
          {{ playing ? 'pause' : 'play' }}</button>
      </span>
    </div>
    <div class="cs-refusal" *ngIf="scene && !scene.ok">
      {{ scene.refusal }}</div>
    <div #host class="cs-host"></div>
    <div class="cs-legends" *ngIf="scene?.ok">
      <ng-container *ngFor="let l of scene.layers">
        <div class="cs-legend"
             *ngIf="enabled.has(l.name) && (l.legend?.length || l.crossCheck)">
          <span class="cs-legend-title">{{ l.displayName }}</span>
          <span class="cs-swatch" *ngFor="let e of l.legend">
            <i [style.background]="e.color"></i>{{ e.label }}</span>
          <span class="cs-note" *ngIf="l.note">{{ l.note }}</span>
          <span class="cs-note" *ngIf="l.crossCheck">
            MTL cross-check: geometry {{ l.crossCheck.geometryMTL }}
            vs electrical {{ l.crossCheck.electricalMTL }} —
            {{ l.crossCheck.note }}</span>
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
    .cs-chip.cs-scene { border-style: dashed; }
    .cs-chip.cs-scene.on { border-style: solid; font-weight: 600; }
    .cs-sep { color: var(--text-on-card-muted); margin: 0 2px; }
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
  private sceneName = '';

  // gr-4: continuous kinematic replay of the solved gear train.
  private gearTheta: Record<string, number> = {};
  private gearTimer: any = null;

  private renderer: any = null;
  private loadedScene = '';
  private sceneObjects: any[] | null = null;
  private viewportDef: any = null;

  // replay state
  sim: any = null;
  playing = false; theta = 0; stepsSoFar = 0;
  private polarity = 0; private pulseIndex = 0;
  private timer: any = null;

  // phase-replay state (m1)
  seq: any = null;
  currentPhase = '';
  private seqIndex = 0;

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
    if (this.gearTimer) { clearInterval(this.gearTimer); }
    this.renderer?.destroy?.();
  }

  kindIcon(kind: string): string {
    switch (kind) {
      case 'replay': return 'play_circle';
      case 'phase-replay': return 'bolt';
      case 'vector-field': return 'grain';
      case 'markers': return 'join_inner';
      case 'shape-swap': return 'cable';
      case 'gear-replay': return 'settings';
      default: return 'palette';
    }
  }

  replayOn(): boolean {
    return !!this.scene?.layers?.some(
      (l: any) => l.kind === 'replay' && l.ok
        && this.enabled.has(l.name));
  }

  // m1-3: the M1 sequencing replay — coils light by which PHASE
  // is excited while the rotor steps; driven from the m1-sequence
  // history exactly as the M0 replay rides clock-sim.
  phaseReplayOn(): boolean {
    return !!this.scene?.layers?.some(
      (l: any) => l.kind === 'phase-replay' && l.ok
        && this.enabled.has(l.name));
  }

  private phaseGeom(): any {
    const l = this.scene?.layers?.find(
      (x: any) => x.kind === 'phase-replay' && x.ok
        && this.enabled.has(x.name));
    return l?.geometry ?? null;
  }

  private async ensureSeq(): Promise<void> {
    if (this.seq?.ok) { return; }
    const geom = this.phaseGeom();
    const design = geom?.design || 'reluctance-6s4p-m1';
    // m2-3: the LAYER ROW names its engine (historySource), and
    // the replay asks that engine for the history. Hardcoding
    // m1-sequence here silently ran the RELUCTANCE solver on the
    // PM design — which, at saliency 1.0, has no torque at all,
    // so the coils lit and the rotor sat still. A layer that
    // declares its source must be believed.
    const source = String(geom?.historySource || 'm1-sequence');
    const route = source === 'm2-rotation'
      ? 'm2-rotation' : 'm1-sequence';
    const url = `${this.polariService.getBackendBaseUrl()}` +
      `/api/motors/${route}/${design}?steps=12`;
    this.seq = await firstValueFrom(this.http.get<any>(
      url, this.polariService.backendRequestOptions))
      .catch((err) => err?.error ?? { ok: false });
    this.seqIndex = 0; this.stepsSoFar = 0;
    this.theta = 0; this.currentPhase = '';
  }

  private layer(name: string): any {
    return this.scene?.layers?.find((l: any) => l.name === name);
  }

  pickScene(name: string): void {
    if (name === this.sceneName) { return; }
    this.sceneName = name;
    this.reload();
  }

  private async reload(): Promise<void> {
    if (!this.view) { return; }
    const qs = this.sceneName
      ? `?scene=${encodeURIComponent(this.sceneName)}` : '';
    const url = `${this.polariService.getBackendBaseUrl()}` +
      `/api/motors/clock-scene/${this.view}${qs}`;
    this.scene = await firstValueFrom(this.http.get<any>(
      url, this.polariService.backendRequestOptions))
      .catch((err) => err?.error ?? {
        ok: false, refusal: 'clock-scene unreachable — is the ' +
          'motors module online?' });
    if (!this.scene?.ok) { return; }
    this.sceneName = this.scene.scene || '';
    this.enabled = new Set(this.scene.layers
      .filter((l: any) => l.ok && l.defaultOn)
      .map((l: any) => l.name));
    await this.ensureScene(this.scene.baseScene);
    if (this.replayOn()) { await this.ensureSim(); }
    if (this.phaseReplayOn()) { await this.ensureSeq(); }
    this.repaint();
    if ((this.replayOn() || this.phaseReplayOn())
        && !this.playing) { this.playPause(); }
    this.syncGearReplay();
  }

  // ---- gr-4: gear-train kinematic replay --------------------------

  private gearLayer(): any {
    return this.scene?.layers?.find(
      (l: any) => l.kind === 'gear-replay' && l.ok
        && this.enabled.has(l.name));
  }

  private syncGearReplay(): void {
    const layer = this.gearLayer();
    if (!layer) {
      if (this.gearTimer) { clearInterval(this.gearTimer); }
      this.gearTimer = null;
      return;
    }
    if (this.gearTimer) { return; }
    let last = performance.now();
    this.gearTimer = setInterval(() => {
      const l = this.gearLayer();
      if (!l || !this.renderer) { return; }
      const now = performance.now();
      const dt = (now - last) / 1000; last = now;
      for (const b of l.bodies ?? []) {
        const theta = (this.gearTheta[b.body] ?? 0)
          + b.displayRevPerSec * 2 * Math.PI * dt;
        this.gearTheta[b.body] = theta;
        const [cx, cy] = b.center;
        // rotation about the gear's OWN axis: geometry carries
        // absolute coords, so position = a - R a (mag-10c).
        this.renderer.updateObjectTransform(b.body, {
          rotation: [0, 0, theta],
          position: [
            cx - (cx * Math.cos(theta) - cy * Math.sin(theta)),
            cy - (cx * Math.sin(theta) + cy * Math.cos(theta)),
            0],
        });
      }
      // as-2: hand ORIENTATION vectors — each hand's pointing
      // direction, rotating with its body.
      const hv = (l.handVectors ?? []).map((h: any) => {
        const theta = this.gearTheta[h.body] ?? 0;
        return {
          kind: 'vector', key: h.key, origin: h.origin,
          vec: [-Math.sin(theta), Math.cos(theta), 0],
          scale: h.length, headScale: 0.12, color: h.color,
        };
      });
      if (hv.length) { this.renderer.setVectors(hv); }
    }, 90);
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
      if (l?.kind === 'phase-replay') { await this.ensureSeq(); }
    }
    if (!this.replayOn() && !this.phaseReplayOn()) {
      this.stopTimer(); this.playing = false;
    }
    this.repaint();
    this.syncGearReplay();
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
    // ws-3: shape-swap layers replace a body's geometry (the
    // observable winding stands in for the solid coil).
    const swapOf: Record<string, string> = {};
    const hidden = new Set<string>();
    for (const l of this.scene.layers) {
      if (l.kind !== 'shape-swap' || !l.ok
          || !this.enabled.has(l.name)) { continue; }
      for (const s of (l.swaps ??
           (l.body && l.shapeRef
             ? [{ body: l.body, shapeRef: l.shapeRef }] : []))) {
        if (s.body && s.shapeRef) { swapOf[s.body] = s.shapeRef; }
      }
      for (const h of l.hide ?? []) { hidden.add(h); }
    }
    const geom = this.replayGeom();
    const thetaRad = this.theta * Math.PI / 180;
    const spin = geom ? this.rotorTransform(geom, thetaRad) : null;
    const coilStyle = !geom ? '' :
      this.polarity > 0 ? geom.coilStyles?.pos :
      this.polarity < 0 ? geom.coilStyles?.neg :
      geom.coilStyles?.idle;
    // m1-3: the phase walk — rotor bodies spin about the scene
    // origin; the excited phase's coil PAIR takes the lit style.
    const pgeom = this.phaseGeom();
    const allPhaseCoils = new Set<string>(
      Object.values<any>(pgeom?.phaseCoils ?? {}).flat());
    const litCoils = new Set<string>(
      (pgeom?.phaseCoils ?? {})[this.currentPhase] ?? []);
    const objects = this.sceneObjects.map((o: any) => {
      const isRotor = geom?.rotorBodies?.includes(o.id);
      const isPRotor = pgeom?.rotorBodies?.includes(o.id);
      const spec = colorOf[o.id];
      let styleRef = o.styleRef;
      if (geom && o.id === geom.coilBody && coilStyle) {
        styleRef = coilStyle;
      } else if (pgeom && allPhaseCoils.has(o.id)) {
        styleRef = litCoils.has(o.id)
          ? pgeom.coilStyles?.excited : pgeom.coilStyles?.idle;
      }
      return {
        ...o, trackKey: o.id,
        shapeRef: swapOf[o.id] ?? o.shapeRef,
        styleRef,
        rotation: isRotor && spin ? spin.rotation
          // arrayed pole bodies carry their own base z-rotation —
          // the step angle ADDS to it, never replaces it.
          : isPRotor ? [o.rotation?.[0] ?? 0, o.rotation?.[1] ?? 0,
                        (o.rotation?.[2] ?? 0) + thetaRad]
          : o.rotation,
        position: isRotor && spin ? spin.position : o.position,
        colorOverride: spec?.color,
        opacityOverride: hidden.has(o.id) ? 0.03
          : anyColoring && !spec ? 0.3 : undefined,
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
        // unit direction — raw tesla-scale vectors read as
        // near-zero and the renderer hides them; magnitude is
        // carried by the arrow LENGTH instead (field-view idiom).
        const mag = Math.hypot(...v.vector) || 1;
        vectors.push({
          kind: 'vector', key: `${l.name}-${i}`,
          origin: v.point.map(
            (c: number, k: number) => anchor[k] + c * s),
          vec: v.vector.map((c: number) => c / mag),
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
    if (this.phaseReplayOn() ? !this.seq?.ok : !this.sim?.ok) {
      return;
    }
    this.playing = true;
    const rate = this.phaseReplayOn()
      ? (this.seq?.speedAssumption?.rateHz || 2)
      : (this.sim?.rateHz || 1);
    this.timer = setInterval(() => this.tick(),
                             Math.max(250, 1000 / rate));
  }

  private tick(): void {
    if (this.phaseReplayOn()) { this.phaseTick(); return; }
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

  private phaseTick(): void {
    if (!this.seq?.ok) {
      this.stopTimer(); this.playing = false; return;
    }
    if (this.seqIndex >= this.seq.steps) {
      this.seqIndex = 0;     // loop the phase walk on the canvas
      this.stepsSoFar = 0;
    }
    this.seqIndex += 1;
    const entry = this.seq.history?.[this.seqIndex];
    if (!entry) { return; }
    this.currentPhase = String(entry.phase);
    if (entry.stepped) { this.stepsSoFar += 1; }
    this.theta = entry.thetaDeg;
    this.repaint();
  }

  private stopTimer(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }
}
