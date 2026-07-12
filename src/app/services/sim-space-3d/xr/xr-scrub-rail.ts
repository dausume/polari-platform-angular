/**
 * @xr
 * @module services/sim-space-3d/xr/xr-scrub-rail
 *
 * The world-anchored scrub rail (xr-3-min, Q-B resolved: world-
 * anchored + grabbable). The scrubber is update-heavy — already on
 * the plan's day-one canvas-fallback list — so it draws from the SAME
 * temporal seams the flat scrubber uses (via XrSurfaceProvider's
 * getScrubState) instead of rasterizing the Angular component.
 *
 * Ray + trigger drags the puck (trigger press jumps the puck to the
 * pointed time, held trigger keeps driving it); the surrounding panel
 * system owns hover/grab dispatch — this class only draws and maps
 * rail-plane UV → temporal value. "Play" = the RUN panel's batch run
 * (no continuous clock — the plan's mapping table).
 */

import * as THREE from 'three';

import type { XrScrubState, XrSurfaceProvider }
  from '@models/xr/xr-surface-model';

const CANVAS_W = 1024;
const CANVAS_H = 160;
/** World size at scale 1 (user-space meters once scaled by the rig
 *  scale): a wide, comfortably readable rail. */
const RAIL_W = 0.9;
const RAIL_H = RAIL_W * (CANVAS_H / CANVAS_W);
/** Horizontal track inset (px) — the puck needs room at the ends. */
const TRACK_PAD = 56;

export class XrScrubRail {
  readonly mesh: THREE.Mesh;
  private canvas: HTMLCanvasElement;
  private texture: THREE.CanvasTexture;
  private lastKey = '';
  private disposables: (THREE.BufferGeometry | THREE.Material
    | THREE.Texture)[] = [];

  constructor(private surfaces: XrSurfaceProvider) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = CANVAS_W;
    this.canvas.height = CANVAS_H;
    this.texture = new THREE.CanvasTexture(this.canvas);
    const geometry = new THREE.PlaneGeometry(RAIL_W, RAIL_H);
    // A world object like the page-panels — the sim may honestly
    // occlude it (no overlay depth tricks; grab it clear instead).
    const material = new THREE.MeshBasicMaterial({
      map: this.texture, transparent: true,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = 'xr-scrub-rail';
    this.disposables.push(geometry, material, this.texture);
    this.redrawIfChanged();
  }

  /** Per-frame: redraw only when a displayed value changes. */
  update(): void {
    this.redrawIfChanged();
  }

  /** A trigger press/hold at rail UV (u,v ∈ [0,1], u left→right):
   *  map the track fraction to the temporal range and drive the
   *  viewer. Returns false when there is nothing to scrub. */
  scrubAtUv(u: number): boolean {
    const state = this.surfaces.getScrubState();
    if (!state || state.max <= state.min) return false;
    const trackLo = TRACK_PAD / CANVAS_W;
    const trackHi = 1 - trackLo;
    const fraction = Math.min(Math.max(
      (u - trackLo) / (trackHi - trackLo), 0), 1);
    let value = state.min + fraction * (state.max - state.min);
    if (state.kind === 'step') value = Math.round(value);
    this.surfaces.setScrubCurrent(value);
    return true;
  }

  dispose(): void {
    this.mesh.parent?.remove(this.mesh);
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
  }

  // ------------------------------------------------------------------

  private redrawIfChanged(): void {
    const state = this.surfaces.getScrubState();
    const key = state
      ? [state.min, state.max, state.current, state.formatted,
         state.sampleCount].join('|')
      : 'empty';
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.draw(state);
  }

  private draw(state: XrScrubState | null): void {
    const ctx = this.canvas.getContext('2d')!;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = 'rgba(24,32,42,0.88)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.strokeStyle = '#5b8bb5';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, CANVAS_W - 3, CANVAS_H - 3);

    ctx.textBaseline = 'middle';
    if (!state) {
      ctx.fillStyle = '#b0bec5';
      ctx.font = '30px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No recorded timeline yet — run at least 2 steps'
        + ' from the RUN panel.', CANVAS_W / 2, CANVAS_H / 2);
      this.texture.needsUpdate = true;
      return;
    }

    // Track + progress fill + puck.
    const trackY = 62;
    const trackW = CANVAS_W - 2 * TRACK_PAD;
    const fraction = state.max > state.min
      ? (state.current - state.min) / (state.max - state.min) : 0;
    ctx.fillStyle = '#37474f';
    ctx.fillRect(TRACK_PAD, trackY - 6, trackW, 12);
    ctx.fillStyle = '#159588';
    ctx.fillRect(TRACK_PAD, trackY - 6, trackW * fraction, 12);
    ctx.fillStyle = '#8fd3ce';
    ctx.beginPath();
    ctx.arc(TRACK_PAD + trackW * fraction, trackY, 22, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#e0f2f1';
    ctx.font = '32px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(state.formatted, CANVAS_W / 2, 122);
    ctx.font = '22px sans-serif';
    ctx.fillStyle = '#78909c';
    ctx.textAlign = 'left';
    ctx.fillText('TIMELINE', 14, 24);
    ctx.textAlign = 'right';
    ctx.fillText(`${state.sampleCount} recorded`
      + ` ${state.kind === 'step' ? 'steps' : 'points'}`,
      CANVAS_W - 14, 24);
    this.texture.needsUpdate = true;
  }
}
