/**
 * @module services/xr/xr-scene-registry.service
 *
 * The scene registry (xr-1): every mounted 3D viewer registers its
 * LIVE scene+camera here on attach and unregisters on destroy. The
 * XR engine binds a registered scene into the one immersive session;
 * the flat per-viewer renderers stay exactly as they are.
 *
 * Three-free by design (handles are opaque `unknown`) — this service
 * rides the main bundle; only the dynamically-imported XR session
 * runtime (sim-space-3d/xr/) ever casts the handles back to THREE
 * types. The firewall holds.
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/** Opaque live-scene handle a 3D renderer exposes for XR binding. */
export interface XrSceneHandle {
  /** THREE.Scene, opaque outside sim-space-3d/. */
  scene: unknown;
  /** THREE.Camera the flat viewer currently uses (pose seed only —
   *  the XR session gets its own camera; this one is never mutated). */
  camera: unknown;
  /**
   * 2D spaces (2026-07-12): the LIVE flat host element — the same DOM
   * node the D3 renderer already draws into — mounted as ONE big
   * always-open HTMLMesh quad instead of fabricating 3D geometry.
   * Absent for 3D spaces, which already have real scene content.
   */
  mainSurfaceElement?: unknown;
  /**
   * Overrides the settings-cascade framing when the scene's SHAPE
   * dictates it, not the space's category — a flat quad has no
   * "interior" to stand inside, so 2D always forces 'exhibit'
   * regardless of what the space's xr_framing setting resolves to.
   * Absent = use the resolved cascade value untouched.
   */
  forcedFraming?: 'inside' | 'exhibit';
  /**
   * 2D spaces: a fixed "sim radius" in world units, measured from the
   * flat host element's real size (HTMLMesh's own 1000px = 1 unit
   * convention — see xr-2d-scene-builder.ts). Used INSTEAD OF
   * sceneBoundingSphere() for both the entry-scale derivation and the
   * ongoing navigation R re-measurement: there is no real 3D geometry
   * to measure, and the visible content is a panel positioned
   * relative to the CAMERA, not a stable world object — measuring the
   * scene graph would make R drift as panels get dragged around.
   * Absent for 3D spaces.
   */
  fixedRadius?: number;
}

export interface XrSceneEntry {
  /** Unique per mounted viewer instance. */
  id: string;
  /** Human label for pickers ("which interface am I entering"). */
  label: string;
  /** SimSpaceDefinition name (resolution + variants key off it). */
  spaceName: string;
  /** The live handle — resolved lazily so a registry entry never
   *  pins renderer internals; null while the renderer is (re)mounting. */
  getHandle: () => XrSceneHandle | null;
}

@Injectable({ providedIn: 'root' })
export class XrSceneRegistryService {
  private entriesById = new Map<string, XrSceneEntry>();
  private seq = 0;

  /** Emits the current entry list on every register/unregister. */
  readonly entries$ = new BehaviorSubject<XrSceneEntry[]>([]);

  /** Register a mounted viewer's live scene. Returns the entry id
   *  (keep it; unregister with it on destroy). */
  register(entry: Omit<XrSceneEntry, 'id'>): string {
    const id = `xr-scene-${++this.seq}`;
    this.entriesById.set(id, { ...entry, id });
    this.emit();
    return id;
  }

  unregister(id: string): void {
    if (this.entriesById.delete(id)) this.emit();
  }

  get(id: string): XrSceneEntry | null {
    return this.entriesById.get(id) ?? null;
  }

  list(): XrSceneEntry[] {
    return Array.from(this.entriesById.values());
  }

  private emit(): void {
    this.entries$.next(this.list());
  }
}
