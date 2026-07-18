/**
 * @xr
 * @module components/xr-lobby/xr-zone-capture-runtime
 *
 * Three.js side of the AR zone-capture page (arz-5) — reached ONLY
 * via dynamic import from XrZoneCapturePageComponent, so no three/XR
 * machinery loads until the user actually enters.
 *
 * Deliberately self-contained rather than reusing XrSessionRuntime:
 * that runtime is sim-space-bound (scene registry, variants, grip
 * NAVIGATION) and locomotion must be OFF here — in AR, physical
 * walking IS the locomotion; moving the virtual origin against the
 * real world would misalign every placed point (plan arz-5). The
 * session/controller wiring follows the same conventions
 * (renderer-never-joins-DOM, local webxr-profile assets, session-'end'
 * as the single cleanup path, dispose-on-exit).
 *
 * Session: immersive-ar first, immersive-vr fallback; reference space
 * 'unbounded' → 'local-floor' → 'local'. The winning combination is
 * reported up via onSessionInfo and lands on the committed zone row
 * as capture accuracy evidence.
 *
 * Interactions (kept primitive, per plan):
 *  - trigger (selectstart)   → place a point at the controller tip
 *  - grip (short squeeze)    → undo the last point
 *  - pad/thumbstick CLICK    → cycle point kind (xr-standard
 *    buttons[2]/[3], polled per frame — the exact mapping
 *    xr-input-rig already uses, so it works on Vive pads and Quest
 *    sticks alike; chosen over a select-hold gesture because the
 *    gamepad handle is already on the 'connected' event)
 *  - BOTH grips held 2 s     → commit (host page POSTs capture+pack,
 *    then the returned lattice renders as instanced cubes in place)
 *  - planar mode ONLY: 20 s after the last dot (place or undo) with
 *    ≥3 dots down, the capture AUTO-COMMITS through the same path;
 *    both-grips remains the immediate override. Direct 3D (hull)
 *    never auto-commits — finalize is always the both-grips hold.
 *
 * Wrist ring + board panel (2026-07-17): the sim-space XrWristUi /
 * XrInputRig / XrPanelSystem are reused wholesale — the input rig is
 * instantiated purely for their needs (its squeeze/pad tracking is
 * state-only, so the capture listeners above keep their own timing
 * on the same shared ray objects; nothing double-fires). Ring 1:
 * SWAP MODES ('Real Constraints Mode' ↔ 'Simulation Mode' — the
 * latter pauses ALL capture inputs and runs the zone's
 * /to-simulation act via the host page) and BOARD (the zones-board
 * HTMLMesh quad). While a UI surface is engaged (uiBusy()), capture
 * inputs stand down — one interaction at a time.
 */

import * as THREE from 'three';
import { ConvexGeometry } from
  'three/examples/jsm/geometries/ConvexGeometry.js';

import { XrInputRig } from
  '@services/sim-space-3d/xr/xr-input-rig';
import type { XrControllerHandle } from
  '@services/sim-space-3d/xr/xr-input-rig';
import { XrWristUi, XrWristRing1Item } from
  '@services/sim-space-3d/xr/xr-wrist-ui';
import { XrPanelSystem } from
  '@services/sim-space-3d/xr/xr-panel-system';
import type { XrNavHud } from
  '@services/sim-space-3d/xr/xr-navigation';
import type { XrSurfaceProvider } from '@models/xr/xr-surface-model';

/** Hold BOTH grips this long to commit the capture. */
const COMMIT_HOLD_MS = 2000;
/** A squeeze released within this window is an UNDO; longer holds
 *  are (aborted) commit attempts, never destructive. */
const UNDO_MAX_HOLD_MS = 800;
/** Analog Vive grips flutter squeeze events (see xr-input-rig's
 *  debounce) — at most one undo per interval so flutter can't
 *  machine-gun the point list. */
const UNDO_MIN_INTERVAL_MS = 250;
/** Planar mode: no new dot for this long → auto-commit. */
const AUTO_FINALIZE_MS = 20_000;
/** Show the auto-finalize countdown once it drops below this. */
const AUTO_FINALIZE_HUD_MS = 15_000;
/** Planar auto-commit needs at least a triangle's worth of dots. */
const AUTO_FINALIZE_MIN_POINTS = 3;

/** The rooms/zones board quad (BOARD ring item → XrPanelSystem). */
const BOARD_CONTENT_REF = 'panel:zones-board';
/** The AR-passthrough-unavailable notice quad (auto-opened on a
 *  no-passthrough session; AR INFO ring item reopens it). */
const AR_NOTICE_CONTENT_REF = 'panel:ar-notice';

/** XrWristUi.update() wants the sim-navigation HUD snapshot; this
 *  page has no navigation (physical walking IS the locomotion), so a
 *  static all-zero HUD feeds it and the plane itself is hidden via
 *  setHudVisible(false). */
const NAV_HUD_STATIC: XrNavHud = {
  state: 'idle', xR: 0, yR: 0, zR: 0, distanceR: 0, zoom: 1,
  simRadius: 1, moveRadiiPerSec: 0, yawDeg: 0, rescueCount: 0,
  lastRescueHomeDist: 0, lastRescueMaxDist: 0,
};

/** How long the HELP flash owns the HUD status line. */
const HELP_FLASH_MS = 6000;

export type ZonePointKind = 'ground' | 'height' | 'free' | 'reference';
/** 'planar' = trace the outline at the top height (backend averages
 *  dot heights into a plane and extrudes to the floor); 'hull' =
 *  direct 3D free points; 'prism' kept for backend parity (no UI). */
export type ZoneCaptureMode = 'planar' | 'prism' | 'hull';

export interface ZoneCapturePoint {
  kind: ZonePointKind;
  /** METERS, WebXR reference-space coordinates, y up. */
  x: number;
  y: number;
  z: number;
  confidence: 'tracked';
}

export interface ZoneCaptureSessionInfo {
  sessionMode: 'immersive-ar' | 'immersive-vr';
  referenceSpace: 'unbounded' | 'local-floor' | 'local';
  /** session.environmentBlendMode as GRANTED — 'alpha-blend' /
   *  'additive' (passthrough composites) / 'opaque' / 'unknown'.
   *  Read after the session exists; surfaced on HUD + 2D page. */
  blendMode: string;
  /** True when the scene composites over the real world: granted
   *  immersive-ar, or a blend mode of alpha-blend/additive. Drives
   *  the transparent-clear path (and suppresses the VR floor grid —
   *  any opaque backdrop would paint over passthrough). */
  passthrough: boolean;
  /** Set when immersive-ar was wanted but NOT granted (either
   *  isSessionSupported said no, or the request threw) — the page
   *  must be LOUD about this: silent VR fallback is exactly what
   *  made AR "act like VR" on-device. */
  arFallbackReason?: string;
}

export interface ZoneLatticeFrame {
  origin: number[];
  u: number[];
  v: number[];
  normal: number[];
}

export interface ZoneLattice {
  frame: ZoneLatticeFrame;
  /** planar/prism — 2D offset of cell (0,0) in the u/v plane. */
  cellOrigin2d?: number[];
  cellSizeM: number;
  /** planar/prism: [i,j] footprint cells; hull: [i,j,k] voxels. */
  cells: number[][];
  cellsListed: number;
}

export interface ZonePackRender {
  mode: ZoneCaptureMode;
  lattice: ZoneLattice;
  /** planar/prism — identical stacked layers. */
  layers?: number;
  /** planar/prism — cubes per layer (the HUD pack-outcome line). */
  cubesPerLayer?: number | null;
  totalCubes: number;
}

export type ZoneCommitResult =
  | { ok: true; zoneName: string;
      /** The estimate's heightM — the committed shell's extrusion
       *  height (planar: planeHeightM; prism: measured height). */
      heightM: number | null;
      /** null = the CAPTURE succeeded but the PACK failed; packError
       *  says why. The zone shell still renders — silent pack
       *  failures must be impossible. */
      render: ZonePackRender | null;
      packError?: string }
  | { ok: false; error: string };

/** SWAP MODES outcome: ok=true flips the runtime into Simulation
 *  Mode; either way `message` lands on the HUD. */
export interface ZoneSwapResult {
  ok: boolean;
  message: string;
}

export interface ZoneCaptureCallbacks {
  /** Which session mode + reference space actually engaged. */
  onSessionInfo(info: ZoneCaptureSessionInfo): void;
  /** Mirror of the in-world HUD status for the 2D page. */
  onStatus(message: string): void;
  /** Both-grips commit: the host page POSTs capture + pack and hands
   *  back the lattice to render (or the refusal to display). */
  onCommit(points: ZoneCapturePoint[]): Promise<ZoneCommitResult>;
  /** SWAP MODES (Real Constraints → Simulation): the page POSTs the
   *  committed zone's /to-simulation and reports the result — or the
   *  "commit a zone first" refusal when nothing committed yet. */
  onSwapModes(): Promise<ZoneSwapResult>;
  /** Mode flips (either direction) — keeps the 2D page's mode label
   *  honest. true = Simulation Mode. */
  onModeChange(simulationMode: boolean): void;
  /** Fired exactly once when the session is gone (any path); the
   *  runtime has already cleaned up + disposed. */
  onEnded(): void;
}

/** Kind cycle per mode: planar keeps ground↔reference (reference =
 *  calibration), direct-3D hull free↔reference; prism keeps its full
 *  legacy order for backend parity. */
const KIND_CYCLE: Record<ZoneCaptureMode, ZonePointKind[]> = {
  planar: ['ground', 'reference'],
  hull: ['free', 'reference'],
  prism: ['ground', 'height', 'free', 'reference'],
};

const KIND_COLORS: Record<ZonePointKind, number> = {
  ground: 0x2ecc71,     // green
  height: 0x3498db,     // blue
  free: 0xe67e22,       // orange
  reference: 0x9b59b6,  // purple
};

interface PlacedPoint {
  kind: ZonePointKind;
  position: THREE.Vector3;
  /** sphere (+ line + distance label when a same-kind predecessor
   *  exists) — undo removes exactly these. */
  objects: THREE.Object3D[];
}

interface ControllerState {
  /** The shared input-rig handle (models, pointer ray, live gamepad).
   *  renderer.xr.getController returns one Group per slot, so the
   *  rig's objects and this runtime's listeners share instances. */
  handle: XrControllerHandle;
  /** CAPTURE-side grip tracking — deliberately separate from the
   *  handle's debounced gripPressed: undo timing (≤800 ms squeeze)
   *  needs the raw event edges, not nav-debounced state. */
  gripPressed: boolean;
  gripSince: number;
  /** Set while this grip takes part in a both-grips commit hold —
   *  its release must never read as an undo. */
  suppressUndo: boolean;
  padWasDown: boolean;
}

export class XrZoneCaptureRuntime {
  private renderer: THREE.WebGLRenderer | null = null;
  private session: XRSession | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private controllers: ControllerState[] = [];
  private records: PlacedPoint[] = [];
  private currentKind: ZonePointKind;
  private committing = false;
  /** After a commit fires, both grips must fully release before the
   *  hold can arm again — no repeat-fire while still squeezing. */
  private commitLatched = false;
  private lastUndoAt = 0;
  /** Planar auto-finalize debounce: timestamp of the last dot
   *  activity (place OR undo). 0 = timer disarmed. */
  private lastDotAt = 0;
  private status = '';
  /** "immersive-ar · alpha-blend" (or "… — no passthrough") — set at
   *  session start, shown as the HUD's top line. */
  private sessionLabel = '';
  private latticeMesh: THREE.InstancedMesh | null = null;
  /** The committed zone's translucent shell (walls/top/edges or the
   *  convex hull) — built from the LOCAL points at commit time, so
   *  something is always visible even when the pack yields nothing.
   *  Disposed on session end and when a NEW capture starts. */
  private zoneShell: THREE.Object3D[] = [];
  private grid: THREE.GridHelper | null = null;

  // Wrist ring + board panel (xr-3-min machinery, reused wholesale).
  // The rig group sits at IDENTITY forever — it exists only because
  // XrInputRig/XrPanelSystem want a rig to parent/scale against;
  // locomotion stays OFF (moving it would misalign every point).
  private rigGroup: THREE.Group | null = null;
  private inputRig: XrInputRig | null = null;
  private wristUi: XrWristUi | null = null;
  private panelSystem: XrPanelSystem | null = null;
  /** Simulation Mode: capture interactions disabled — trigger/grip
   *  only work the ring + panels; lattice + spheres stay visible. */
  private simulationMode = false;
  private swapInFlight = false;
  /** True for this whole session when it composites over the real
   *  room — gates the AR INFO ring item (pointless in genuine AR). */
  private passthroughActive = true;
  /** ONE-SHOT auto-open of the AR-unavailable notice: armed in
   *  start() iff the session has no passthrough, consumed on the
   *  first rendered frame (the camera holds a real XR pose only
   *  after a render, and spawn placement reads the head pose).
   *  Never re-armed — dismissing it stays dismissed; reopening is
   *  the AR INFO ring item. */
  private arNoticePending = false;
  private helpFlashTimer: ReturnType<typeof setTimeout> | null = null;

  // HUD — a camera-locked CanvasTexture sprite (NOT HTMLMesh; the
  // live data-binding path into HTMLMesh is where the known xr-3 bug
  // lives, and the plan keeps capture feedback primitive).
  private hudCanvas: HTMLCanvasElement | null = null;
  private hudTexture: THREE.CanvasTexture | null = null;
  private hudSprite: THREE.Sprite | null = null;
  private hudText = '';
  private hudTransient = false;

  constructor(private mode: ZoneCaptureMode,
              private callbacks: ZoneCaptureCallbacks,
              private surfaces: XrSurfaceProvider) {
    // Default kind: trace-the-outline modes start on 'ground'; direct
    // 3D (hull) is free-point sculpting.
    this.currentKind = mode === 'hull' ? 'free' : 'ground';
  }

  /** Request the immersive session (AR first, VR fallback) and start
   *  the capture loop. Must run inside a trusted user gesture. */
  async start(): Promise<void> {
    if (this.session) {
      throw new Error('Zone-capture session already active.');
    }
    const xr = (navigator as any).xr;
    if (!xr?.requestSession) {
      throw new Error('WebXR is not available in this browser');
    }
    const supported = async (mode: string): Promise<boolean> => {
      try {
        return !!(await xr.isSessionSupported?.(mode));
      } catch {
        return false;
      }
    };

    // AR first (passthrough capture); VR fallback runs the same flow
    // floating in the void — the zone doesn't care which session
    // type placed it (plan arz-5). Any path that lands on VR when AR
    // was the ask records WHY (arFallbackReason) so the page can be
    // loud about it instead of silently "acting like VR".
    let arFallbackReason: string | undefined;
    const arSupported = await supported('immersive-ar');
    let sessionMode: 'immersive-ar' | 'immersive-vr' =
      arSupported ? 'immersive-ar' : 'immersive-vr';
    if (!arSupported) {
      arFallbackReason =
        'immersive-ar not supported (isSessionSupported = false)';
    }

    // The XR renderer never joins the DOM — the session presents to
    // the headset (same convention as xr-session-runtime).
    this.renderer = new THREE.WebGLRenderer({
      antialias: true, alpha: true,
    });
    this.renderer.xr.enabled = true;

    const sessionInit: XRSessionInit = {
      // hand-tracking: Quest hands sessions (controllers asleep) are
      // a first-class capture path — pinch places points and the
      // fingertip POKE works the ring + panels.
      optionalFeatures: ['unbounded', 'local-floor', 'hand-tracking'],
    };
    let session: XRSession;
    try {
      session = await xr.requestSession(sessionMode, sessionInit);
    } catch (err) {
      // isSessionSupported said yes but the request still failed —
      // fall through to VR once before giving up.
      if (sessionMode === 'immersive-ar'
          && await supported('immersive-vr')) {
        arFallbackReason = 'immersive-ar request failed: '
          + ((err as any)?.message || String(err));
        sessionMode = 'immersive-vr';
        try {
          session = await xr.requestSession(sessionMode, sessionInit);
        } catch (err2) {
          this.disposeRenderer();
          throw err2;
        }
      } else {
        this.disposeRenderer();
        throw err;
      }
    }

    // House-scale walks want 'unbounded' (the runtime relocalizes as
    // you roam); probe honestly, fall back to local-floor, then
    // local. Whichever engages is recorded on the zone row.
    let referenceSpace: ZoneCaptureSessionInfo['referenceSpace'] =
      'local';
    for (const candidate of ['unbounded', 'local-floor'] as const) {
      try {
        await session.requestReferenceSpace(candidate);
        referenceSpace = candidate;
        break;
      } catch { /* next candidate */ }
    }
    try {
      this.renderer.xr.setReferenceSpaceType(referenceSpace);
      await this.renderer.xr.setSession(session);
    } catch (err) {
      try { await session.end(); } catch { /* already gone */ }
      this.disposeRenderer();
      throw err;
    }

    this.session = session;
    session.addEventListener('end', this.handleSessionEnd);

    // Passthrough determination — read the GRANTED session's
    // environmentBlendMode (only readable now the session exists).
    // immersive-ar, or a compositing blend mode, means the real room
    // is the backdrop: the renderer must clear transparently and no
    // grid/skybox may be added.
    const blendMode: string =
      (session as any).environmentBlendMode ?? 'unknown';
    const passthrough = sessionMode === 'immersive-ar'
      || blendMode === 'alpha-blend' || blendMode === 'additive';
    this.sessionLabel = passthrough
      ? `${sessionMode} · ${blendMode}`
      : `${sessionMode} · ${blendMode} — no passthrough`;
    this.passthroughActive = passthrough;
    // Arm the one-shot AR-unavailable notice popup (spawns on the
    // first rendered frame, in front of the user like any panel).
    this.arNoticePending = !passthrough;
    this.callbacks.onSessionInfo({
      sessionMode, referenceSpace, blendMode, passthrough,
      arFallbackReason,
    });

    this.buildScene(passthrough);
    this.buildControllers();
    this.buildWristAndPanels();
    this.setStatus('place points with the trigger');
    this.renderer.setAnimationLoop(this.frame);
  }

  /** End the session. Safe when idle; cleanup runs in the session
   *  'end' handler (single path for every way out). */
  async stop(): Promise<void> {
    if (!this.session) return;
    try {
      await this.session.end();
    } catch { /* already ended */ }
  }

  // ------------------------------------------------------------------
  // Scene + controllers
  // ------------------------------------------------------------------

  private buildScene(passthrough: boolean): void {
    this.scene = new THREE.Scene();
    this.scene.background = null; // AR passthrough composites behind
    if (passthrough) {
      // Belt-and-braces transparent compositing: the renderer is
      // constructed with alpha:true (clear alpha defaults to 0), but
      // an explicit alpha-0 clear guarantees no opaque clear color
      // can ever paint over the camera feed. No grid, no skybox, no
      // backdrop of any kind on this path — the real room IS the
      // backdrop.
      this.renderer!.setClearColor(0x000000, 0);
    }
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.01, 1000);
    this.scene.add(this.camera);
    this.buildHud();
    if (!passthrough) {
      // VR-fallback ONLY: a faint floor grid so the void has a
      // ground reference. Gated on the passthrough determination
      // (granted mode + blend mode), never on what we requested.
      this.grid = new THREE.GridHelper(10, 20, 0x4a7a7a, 0x2a4a4a);
      (this.grid.material as THREE.Material).transparent = true;
      (this.grid.material as THREE.Material).opacity = 0.35;
      this.scene.add(this.grid);
    }
  }

  /** Controllers come from XrInputRig now (models, visible pointer
   *  rays with the per-device pitch correction, live gamepad handles
   *  — everything the wrist ring + panel system need). The capture
   *  interactions stay THIS runtime's own listeners on the same
   *  shared ray objects; the rig group stays at identity forever, so
   *  controllers still live at reference-space coordinates and
   *  physical walking remains the only locomotion. XrInputRig's
   *  squeeze/pad tracking is state-only (no actions), so nothing
   *  double-fires — action gating against the UI surfaces happens in
   *  uiBusy() checks on the capture paths. */
  private buildControllers(): void {
    this.rigGroup = new THREE.Group();
    this.rigGroup.name = 'zone-capture-rig';
    this.scene!.add(this.rigGroup);
    this.inputRig = new XrInputRig(this.renderer!, this.rigGroup);

    for (const handle of this.inputRig.controllers) {
      // The placement tip — a small dot on the TARGET-RAY space (the
      // renderer.xr controller object WebXRManager actually poses
      // every frame for controllers AND hands) so the user sees where
      // a point will land. Never the grip: hand input sources have no
      // gripSpace, so a grip-parented tip sits forever at the rig
      // origin on the floor.
      const tip = new THREE.Mesh(
        new THREE.SphereGeometry(0.008, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff }));
      tip.name = 'zone-capture-tip';
      handle.ray.add(tip);

      const state: ControllerState = {
        handle,
        gripPressed: false, gripSince: 0,
        suppressUndo: false, padWasDown: false,
      };
      handle.ray.addEventListener('disconnected', () => {
        state.gripPressed = false;
      });
      // Trigger = place (selection stays selection; no navigation
      // exists on this page by design). Presses aimed at the wrist
      // ring or a panel never place dots — placePoint checks
      // uiBusy() (and Simulation Mode disables placement outright).
      handle.ray.addEventListener('selectstart',
        () => this.placePoint(state));
      // Grip: short squeeze = undo; both-grips-hold = commit (frame
      // loop watches the hold; releases during a hold never undo).
      // A grip that grabbed/hovered a panel never undoes either —
      // the release-time uiBusy() check (panel drags outlive the
      // squeeze release by the rig's debounce window, so the gate
      // holds at this instant).
      handle.ray.addEventListener('squeezestart', () => {
        state.gripPressed = true;
        state.gripSince = performance.now();
        state.suppressUndo = false;
      });
      handle.ray.addEventListener('squeezeend', () => {
        const held = performance.now() - state.gripSince;
        state.gripPressed = false;
        if (!state.suppressUndo && !this.committing
            && !this.simulationMode && !this.uiBusy()
            && held <= UNDO_MAX_HOLD_MS) {
          this.undoLast();
        }
        state.suppressUndo = false;
      });
      this.controllers.push(state);
    }
  }

  /** The sim-space wrist ring + the rooms/zones board panel, reused
   *  wholesale (no fallback needed: XrWristUi/XrPanelSystem only
   *  want the input rig, a rig group, and the camera — none of which
   *  drag sim-space scene machinery in). */
  private buildWristAndPanels(): void {
    this.panelSystem = new XrPanelSystem(
      this.scene!, this.rigGroup!, this.camera!, this.inputRig!,
      this.surfaces, {
        placements: {},
        isWristEngaged: () => this.wristUi?.uiEngaged() ?? false,
      });
    const ring1: XrWristRing1Item[] = [
      // UNDO + COMMIT NOW exist for HANDS-ONLY sessions (Dustin's
      // Quest 2 repro: controllers asleep → hands): undo and manual
      // commit are grip gestures, and hands never fire squeeze — the
      // ring (fingertip poke or ray-select) is the only reachable
      // path. Controller grip gestures stay exactly as they were.
      {
        id: 'undo', label: 'UNDO',
        onSelect: () => {
          if (this.simulationMode || this.committing) return;
          this.undoLast();
        },
        isActive: () => false,
      },
      {
        id: 'commit-now', label: 'COMMIT',
        onSelect: () => {
          if (this.simulationMode) {
            this.setStatus('Simulation Mode — SWAP MODES to capture');
            return;
          }
          if (this.committing) return;
          if (this.records.length < AUTO_FINALIZE_MIN_POINTS) {
            this.setStatus('place at least '
              + `${AUTO_FINALIZE_MIN_POINTS} points, then COMMIT`);
            return;
          }
          void this.doCommit();
        },
        isActive: () => this.committing,
      },
      {
        id: 'swap-modes', label: 'SWAP MODES',
        onSelect: () => { void this.swapModes(); },
        isActive: () => this.simulationMode,
      },
      {
        id: 'zones-board', label: 'BOARD',
        onSelect: () => this.panelSystem?.toggle(BOARD_CONTENT_REF),
        isActive: () =>
          this.panelSystem?.isOpen(BOARD_CONTENT_REF) ?? false,
      },
    ];
    if (!this.passthroughActive) {
      // Only when this session actually fell back: reopen the
      // auto-popped AR-unavailable notice (why no passthrough + the
      // Wolvic Chromium fix).
      ring1.push({
        id: 'ar-info', label: 'AR INFO',
        onSelect: () =>
          this.panelSystem?.toggle(AR_NOTICE_CONTENT_REF),
        isActive: () =>
          this.panelSystem?.isOpen(AR_NOTICE_CONTENT_REF) ?? false,
      });
    }
    this.wristUi = new XrWristUi(
      this.inputRig!, this.camera!, 'left', {
        exit: () => { void this.stop(); },
        resetView: () => this.refreshHud(),
        help: () => this.flashHelp(),
      }, ring1);
    // The nav HUD reads R/zoom/drive — meaningless without
    // navigation; the ring is what this page wants.
    this.wristUi.setHudVisible(false);
    // Hands-only sessions: anchor the ring to the hand's wrist joint
    // (default behavior detaches the ring when the input is a hand,
    // which left hands-only users with NO ring at all). Opt-in so
    // sim-space XR keeps its controller-only contract.
    this.wristUi.setHandWristAttach(true);
  }

  /** A UI surface owns the pointer/gesture — capture actions stand
   *  down (one interaction at a time, same rule as the sim runtime). */
  private uiBusy(): boolean {
    return (this.wristUi?.uiEngaged() ?? false)
      || (this.panelSystem?.uiEngaged() ?? false);
  }

  /** SWAP MODES: Real Constraints ↔ Simulation. Entering Simulation
   *  Mode runs the page's /to-simulation act first — no committed
   *  zone means the swap does not happen (the HUD says so). Leaving
   *  is always local. */
  private async swapModes(): Promise<void> {
    if (this.swapInFlight) return;
    if (this.simulationMode) {
      this.simulationMode = false;
      this.callbacks.onModeChange(false);
      this.setStatus('Real Constraints Mode — capture active');
      return;
    }
    this.swapInFlight = true;
    this.setStatus('swapping to Simulation Mode…');
    try {
      const result = await this.callbacks.onSwapModes();
      if (result.ok) {
        this.simulationMode = true;
        this.lastDotAt = 0; // disarm the planar auto-commit
        this.callbacks.onModeChange(true);
      }
      this.setStatus(result.message.slice(0, 90));
    } catch (e: any) {
      this.setStatus(`swap failed: ${e?.message || e}`.slice(0, 90));
    }
    this.swapInFlight = false;
  }

  /** HELP ring-0 action: flash the how-to on the HUD status line,
   *  then restore whatever was there. */
  private flashHelp(): void {
    if (this.helpFlashTimer !== null) clearTimeout(this.helpFlashTimer);
    const previous = this.status;
    this.setStatus(this.simulationMode
      ? 'Simulation Mode: ring + panels only — SWAP MODES to capture'
      : 'trigger place · grip undo · pad kind · both grips 2 s commit');
    this.helpFlashTimer = setTimeout(() => {
      this.helpFlashTimer = null;
      this.setStatus(previous);
    }, HELP_FLASH_MS);
  }

  // ------------------------------------------------------------------
  // Frame loop
  // ------------------------------------------------------------------

  private frame = (): void => {
    if (!this.renderer || !this.scene || !this.camera) return;
    try {
      // UI machinery first (rig pad state feeds panel drags; hover
      // maps feed this frame's uiBusy() gates), then capture.
      this.inputRig?.pollGamepads();
      this.panelSystem?.update();
      this.wristUi?.update(NAV_HUD_STATIC);
      // Fingertip POKE (Quest hands): feed index-tip world positions
      // to both UI surfaces every frame — the surfaces' opt-in
      // pokeFrom() APIs do nothing for callers that never feed tips,
      // and an empty array clears any lingering poke state. Runs
      // BEFORE the capture polls so uiBusy() sees this frame's touch.
      const tips = this.collectFingertips();
      this.wristUi?.pokeFrom(tips);
      this.panelSystem?.pokeFrom(tips);
      this.pollPads();
      this.checkCommitHold();
      this.checkAutoFinalize();
      this.renderer.render(this.scene, this.camera);
      // After the render: the camera now carries the XR head pose,
      // so the notice spawns at reading distance in FRONT of the
      // user (before the first render it would land at the floor
      // origin). One-shot by construction — the flag is only armed
      // in start() and consumed here.
      if (this.arNoticePending) {
        this.arNoticePending = false;
        this.panelSystem?.toggle(AR_NOTICE_CONTENT_REF);
      }
    } catch (e) {
      // Never let one bad frame kill the session loop.
      console.error('[xr-zone-capture] frame error (loop continues):', e);
    }
  };

  /** World-space index-finger-tip positions of tracked HANDS this
   *  frame (three's WebXRController drives hand.joints from the XR
   *  frame's joint poses; the rig group sits at identity, so joint
   *  world coordinates ARE reference-space coordinates). Controllers
   *  contribute nothing — poke is a hands affordance. */
  private collectFingertips(): THREE.Vector3[] {
    const tips: THREE.Vector3[] = [];
    for (const c of this.controllers) {
      if (!c.handle.isHand) continue;
      const joint = (c.handle.hand as any)
        ?.joints?.['index-finger-tip'];
      if (joint && joint.visible !== false) {
        tips.push(joint.getWorldPosition(new THREE.Vector3()));
      }
    }
    return tips;
  }

  /** Pad/thumbstick CLICK cycles the point kind — xr-standard
   *  buttons[2] (touchpad press) / [3] (thumbstick press), polled
   *  because pad clicks have no squeeze-style events (identical to
   *  xr-input-rig.pollGamepads). Rising edge only. */
  private pollPads(): void {
    for (const state of this.controllers) {
      const buttons = state.handle.gamepad?.buttons;
      const down = !!(buttons?.[2]?.pressed || buttons?.[3]?.pressed);
      // Edge tracking always runs; the ACTION is gated — a pad click
      // that's grabbing a panel (XrPanelSystem's grip-or-pad drag) or
      // aimed at UI must not also cycle the kind, and Simulation Mode
      // suspends capture inputs entirely.
      if (down && !state.padWasDown
          && !this.simulationMode && !this.uiBusy()) {
        this.cycleKind();
      }
      state.padWasDown = down;
    }
  }

  private checkCommitHold(): void {
    const [a, b] = this.controllers;
    if (a?.gripPressed && b?.gripPressed) {
      a.suppressUndo = true;
      b.suppressUndo = true;
      // Simulation Mode / UI-engaged grips never commit — but the
      // suppressUndo marks above still stand, so the releases of an
      // aborted double-grip can't read as undos either.
      if (this.simulationMode || this.uiBusy()) return;
      if (this.committing || this.commitLatched) return;
      if (this.records.length === 0) {
        this.refreshHud('place at least one point before committing');
        return;
      }
      const held =
        performance.now() - Math.max(a.gripSince, b.gripSince);
      if (held >= COMMIT_HOLD_MS) {
        this.commitLatched = true;
        void this.doCommit();
      } else {
        this.refreshHud('committing in '
          + `${((COMMIT_HOLD_MS - held) / 1000).toFixed(1)} s — keep holding`);
      }
    } else if (!a?.gripPressed && !b?.gripPressed) {
      this.commitLatched = false;
    }
  }

  /** Planar-only 20 s debounce: every dot (place or undo) stamps
   *  lastDotAt; once the quiet period elapses with ≥3 dots down, the
   *  capture auto-commits through the exact both-grips path. Runs
   *  every frame AFTER checkCommitHold; when both grips are held the
   *  commit-hold countdown owns the HUD transient, so this backs off.
   *  It is also the single place the transient HUD gets cleared. */
  private checkAutoFinalize(): void {
    // Simulation Mode disarms on entry (swapModes zeroes lastDotAt);
    // this guard keeps a re-armed timer from ever firing there.
    if (this.simulationMode) return;
    const [a, b] = this.controllers;
    if (a?.gripPressed && b?.gripPressed) return;
    let transient: string | undefined;
    if (this.mode === 'planar' && !this.committing
        && this.lastDotAt > 0
        && this.records.length >= AUTO_FINALIZE_MIN_POINTS) {
      const remaining =
        AUTO_FINALIZE_MS - (performance.now() - this.lastDotAt);
      if (remaining <= 0) {
        this.lastDotAt = 0;
        void this.doCommit();
        return;
      }
      if (remaining <= AUTO_FINALIZE_HUD_MS) {
        transient = 'auto-forming plane in '
          + `${Math.ceil(remaining / 1000)}s…`;
      }
    }
    if (transient !== undefined) this.refreshHud(transient);
    else if (this.hudTransient) this.refreshHud();
  }

  // ------------------------------------------------------------------
  // Point placement / undo / kind cycling
  // ------------------------------------------------------------------

  private placePoint(state: ControllerState): void {
    if (!this.scene || this.committing) return;
    // Simulation Mode: triggers only work the ring/panels. And a
    // trigger aimed at the wrist ring or a panel is UI selection —
    // XrWristUi/XrPanelSystem handle it on their own listeners; it
    // must not also drop a capture dot.
    if (this.simulationMode || this.uiBusy()) return;
    // First dot of a FRESH capture: the previous zone's shell has
    // served its purpose — dispose it so shells never stack up.
    if (this.records.length === 0) this.clearZoneShell();
    const position = this.placementPosition(state.handle);
    const kind = this.currentKind;
    const color = KIND_COLORS[kind];
    const objects: THREE.Object3D[] = [];

    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.015, 14, 10),
      new THREE.MeshBasicMaterial({ color }));
    sphere.position.copy(position);
    this.scene.add(sphere);
    objects.push(sphere);

    // Rubber-band line + meter label back to the previous SAME-KIND
    // point (walk-the-perimeter feedback).
    const prev =
      [...this.records].reverse().find(r => r.kind === kind);
    if (prev) {
      const geometry = new THREE.BufferGeometry()
        .setFromPoints([prev.position.clone(), position.clone()]);
      const line = new THREE.Line(geometry,
        new THREE.LineBasicMaterial(
          { color, transparent: true, opacity: 0.9 }));
      this.scene.add(line);
      objects.push(line);

      const meters = prev.position.distanceTo(position);
      const label = this.makeLabel(`${meters.toFixed(2)} m`);
      label.position.copy(prev.position).add(position)
        .multiplyScalar(0.5);
      label.position.y += 0.04;
      this.scene.add(label);
      objects.push(label);
    }

    this.records.push({ kind, position, objects });
    if (this.mode === 'planar') this.lastDotAt = performance.now();
    this.pulse(state, 0.3, 30);
    this.refreshHud();
  }

  /** Where a placed dot lands, PER INPUT TYPE. CONTROLLER: the
   *  target-ray space — the renderer.xr controller pose WebXRManager
   *  updates every frame (the pre-rig source that placed correctly).
   *  HAND: the index-finger-tip joint (hands never pose a grip
   *  space — reading the grip put every dot at the rig origin on the
   *  floor, the on-device regression), falling back to the target-ray
   *  pose when the joint is untracked this frame. The rig group sits
   *  at identity, so world coordinates ARE reference-space
   *  coordinates either way. */
  private placementPosition(handle: XrControllerHandle)
      : THREE.Vector3 {
    if (handle.isHand) {
      const joint: THREE.Object3D | undefined =
        (handle.hand as any)?.joints?.['index-finger-tip'];
      if (joint && joint.visible !== false) {
        return joint.getWorldPosition(new THREE.Vector3());
      }
    }
    return handle.ray.getWorldPosition(new THREE.Vector3());
  }

  private undoLast(): void {
    const now = performance.now();
    if (now - this.lastUndoAt < UNDO_MIN_INTERVAL_MS) return;
    const record = this.records.pop();
    if (!record) return;
    this.lastUndoAt = now;
    // An undo is dot activity too — it resets the planar debounce.
    if (this.mode === 'planar') this.lastDotAt = now;
    this.removeAndDispose(record.objects);
    this.refreshHud();
  }

  private cycleKind(): void {
    const order = KIND_CYCLE[this.mode];
    const index = order.indexOf(this.currentKind);
    this.currentKind = order[(index + 1) % order.length];
    this.refreshHud();
  }

  // ------------------------------------------------------------------
  // Commit + lattice rendering
  // ------------------------------------------------------------------

  private async doCommit(): Promise<void> {
    if (this.committing || this.records.length === 0) return;
    this.committing = true;
    this.lastDotAt = 0; // disarm the planar debounce for this batch
    this.setStatus('committing zone…');
    const points: ZoneCapturePoint[] = this.records.map(r => ({
      kind: r.kind,
      x: r.position.x, y: r.position.y, z: r.position.z,
      confidence: 'tracked',
    }));
    // The shell outline is the capture's own shape dots (reference
    // dots are calibration, not shape) — grabbed BEFORE the commit
    // clears the records.
    const shellPoints = this.records
      .filter(r => r.kind !== 'reference')
      .map(r => r.position.clone());
    try {
      const result = await this.callbacks.onCommit(points);
      if (result.ok) {
        // Points are persisted rows now; the committed SHELL (and,
        // when packing succeeded, the lattice) takes their place
        // in-world. Fresh points start the NEXT zone (the
        // capture-per-room flow).
        this.clearAllPoints();
        // The shell appears IMMEDIATELY and independently of the
        // pack — a pack refusal used to leave NOTHING visible.
        this.renderZoneShell(result.heightM, shellPoints);
        let packLine: string;
        if (result.render) {
          this.renderLattice(result.render);
          const per = result.render.cubesPerLayer;
          const layers = result.render.layers;
          packLine = `packed: ${result.render.totalCubes} cubes`
            + (per != null && layers != null
              ? ` (${per}/layer × ${layers})` : '');
          if (result.render.totalCubes > 0
              && result.render.lattice.cells.length === 0) {
            // The backend's MAX_LISTED_CELLS degradation: counts
            // only, no cell list — the cubes CANNOT be drawn. Say so
            // instead of silently rendering nothing.
            packLine += ' — cell list omitted, cubes not drawn';
          }
        } else {
          // Pack failure, verbatim — never silent.
          packLine = `pack FAILED: ${result.packError ?? 'unknown'}`;
        }
        this.setStatus(
          `${result.zoneName} committed — ${packLine}`.slice(0, 110));
        for (const c of this.controllers) this.pulse(c, 0.6, 120);
      } else {
        this.setStatus(
          `commit failed: ${result.error}`.slice(0, 90));
      }
    } catch (e: any) {
      this.setStatus(
        `commit failed: ${e?.message || e}`.slice(0, 90));
    }
    this.committing = false;
  }

  /** Expand the packing lattice into instanced semitransparent cubes
   *  (lattice→world math per the /pack contract). */
  private renderLattice(render: ZonePackRender): void {
    if (!this.scene) return;
    this.clearLattice();
    const lattice = render.lattice;
    const cell = lattice.cellSizeM;
    const origin = this.vec3(lattice.frame.origin);
    const geometry =
      new THREE.BoxGeometry(cell * 0.96, cell * 0.96, cell * 0.96);
    const material = new THREE.MeshBasicMaterial({
      color: 0x4fc3f7, transparent: true, opacity: 0.32,
      depthWrite: false,
    });
    const matrix = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    let mesh: THREE.InstancedMesh;
    if (render.mode !== 'hull') {
      // planar/prism cell (i,j), layer L (planar: u=[1,0,0],
      // v=[0,0,1], normal=[0,1,0] — stacks up from the floor): origin
      //   + (cellOrigin2d[0] + (i+0.5)·cell)·u
      //   + (cellOrigin2d[1] + (j+0.5)·cell)·v
      //   + (L+0.5)·cell·normal
      const u = this.vec3(lattice.frame.u);
      const v = this.vec3(lattice.frame.v);
      const normal = this.vec3(lattice.frame.normal);
      const cellOrigin = lattice.cellOrigin2d ?? [0, 0];
      const layers = Math.max(1, render.layers ?? 1);
      mesh = new THREE.InstancedMesh(
        geometry, material, lattice.cells.length * layers);
      let index = 0;
      for (const [i, j] of lattice.cells) {
        for (let layer = 0; layer < layers; layer++) {
          pos.copy(origin)
            .addScaledVector(u, cellOrigin[0] + (i + 0.5) * cell)
            .addScaledVector(v, cellOrigin[1] + (j + 0.5) * cell)
            .addScaledVector(normal, (layer + 0.5) * cell);
          matrix.setPosition(pos);
          mesh.setMatrixAt(index++, matrix);
        }
      }
    } else {
      // hull cell (i,j,k): origin + ((i,j,k)+0.5)·cell along x/y/z.
      mesh = new THREE.InstancedMesh(
        geometry, material, lattice.cells.length);
      let index = 0;
      for (const [i, j, k] of lattice.cells) {
        pos.set(origin.x + (i + 0.5) * cell,
                origin.y + (j + 0.5) * cell,
                origin.z + (k + 0.5) * cell);
        matrix.setPosition(pos);
        mesh.setMatrixAt(index++, matrix);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    // Belt-and-braces: never let bounding-volume culling hide the
    // lattice (the cell counts are small; drawing them always is
    // cheaper than a wrongly-culled "invisible zone" on device).
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    this.latticeMesh = mesh;
  }

  // ------------------------------------------------------------------
  // Committed zone shell
  // ------------------------------------------------------------------

  /** The VISIBLE committed zone (on-device gap: the commit succeeded
   *  but nothing appeared): a translucent shaded shell built from the
   *  locally captured dots + the estimate height.
   *
   *  planar/prism — the outline polygon (dots' XZ in placement
   *  order) extruded from the floor (y=0) to the estimate height:
   *  double-sided side walls, a top face, and bright edge lines
   *  around both outlines + the vertical corners.
   *  hull — the convex hull over the captured dots, same translucent
   *  material + an edge wireframe. */
  private renderZoneShell(heightM: number | null,
      points: THREE.Vector3[]): void {
    if (!this.scene) return;
    this.clearZoneShell();
    const wallMaterial = () => new THREE.MeshBasicMaterial({
      color: 0x26c6da, transparent: true, opacity: 0.2,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const edgeMaterial = () => new THREE.LineBasicMaterial({
      color: 0x00e5ff, transparent: true, opacity: 0.95,
    });
    const add = (obj: THREE.Object3D) => {
      this.scene!.add(obj);
      this.zoneShell.push(obj);
    };

    if (this.mode !== 'hull') {
      if (points.length < 3) return;
      // Height: the backend estimate when it stands; otherwise the
      // averaged dot height (same definition), floored so a bad
      // estimate still yields a visible outline.
      let height = heightM ?? 0;
      if (height <= 0) {
        height = points.reduce((s, p) => s + p.y, 0) / points.length;
      }
      height = Math.max(height, 0.05);
      const flat = points.map(p => new THREE.Vector2(p.x, p.z));
      const n = flat.length;

      // Side walls: one quad (two triangles) per outline edge,
      // floor → plane height.
      const wall: number[] = [];
      const edge: number[] = [];
      for (let k = 0; k < n; k++) {
        const a = flat[k];
        const b = flat[(k + 1) % n];
        wall.push(
          a.x, 0, a.y, b.x, 0, b.y, b.x, height, b.y,
          a.x, 0, a.y, b.x, height, b.y, a.x, height, a.y);
        edge.push(a.x, 0, a.y, b.x, 0, b.y);           // floor ring
        edge.push(a.x, height, a.y, b.x, height, b.y); // top ring
        edge.push(a.x, 0, a.y, a.x, height, a.y);      // corner
      }
      const wallGeometry = new THREE.BufferGeometry();
      wallGeometry.setAttribute('position',
        new THREE.Float32BufferAttribute(wall, 3));
      add(new THREE.Mesh(wallGeometry, wallMaterial()));

      // Top face at the plane height — Shape is built in (x, z);
      // rotateX(+90°) maps shape (x, y, 0) → world (x, 0, y), i.e.
      // the shape's second axis onto world Z, then lift to height.
      const shape = new THREE.Shape(flat);
      const topGeometry = new THREE.ShapeGeometry(shape);
      topGeometry.rotateX(Math.PI / 2);
      topGeometry.translate(0, height, 0);
      const topMaterial = wallMaterial();
      topMaterial.opacity = 0.12;
      add(new THREE.Mesh(topGeometry, topMaterial));

      const edgeGeometry = new THREE.BufferGeometry();
      edgeGeometry.setAttribute('position',
        new THREE.Float32BufferAttribute(edge, 3));
      add(new THREE.LineSegments(edgeGeometry, edgeMaterial()));
      return;
    }

    // hull: the convex hull over the captured dots. ConvexGeometry
    // throws on degenerate input (< 4 points / all coplanar) — a
    // shell is nice-to-have, never commit-breaking.
    if (points.length < 4) return;
    let hullGeometry: THREE.BufferGeometry;
    try {
      hullGeometry = new ConvexGeometry(points);
    } catch {
      return;
    }
    add(new THREE.Mesh(hullGeometry, wallMaterial()));
    add(new THREE.LineSegments(
      new THREE.EdgesGeometry(hullGeometry), edgeMaterial()));
  }

  private clearZoneShell(): void {
    if (this.zoneShell.length === 0) return;
    this.removeAndDispose(this.zoneShell);
    this.zoneShell = [];
  }

  // ------------------------------------------------------------------
  // HUD + labels (CanvasTexture sprites — never HTMLMesh here)
  // ------------------------------------------------------------------

  private buildHud(): void {
    this.hudCanvas = document.createElement('canvas');
    this.hudCanvas.width = 640;
    this.hudCanvas.height = 300;
    this.hudTexture = new THREE.CanvasTexture(this.hudCanvas);
    const material = new THREE.SpriteMaterial({
      map: this.hudTexture, transparent: true, depthTest: false,
    });
    this.hudSprite = new THREE.Sprite(material);
    this.hudSprite.scale.set(0.44, 0.206, 1);
    this.hudSprite.position.set(0, -0.22, -0.7);
    this.hudSprite.renderOrder = 100;
    this.camera!.add(this.hudSprite);
    this.refreshHud();
  }

  private refreshHud(transient?: string): void {
    if (!this.hudCanvas || !this.hudTexture) return;
    // Exact mode names by contract: 'Real Constraints Mode' (capture
    // active) / 'Simulation Mode' (capture paused).
    const line1 = this.simulationMode
      ? 'Simulation Mode' : 'Real Constraints Mode';
    const line2 = this.simulationMode
      ? 'capture paused — ring/panels only'
      : `${this.mode}/${this.currentKind} · `
        + `points: ${this.records.length}`;
    const line3 = transient ?? this.status;
    const line0 = this.sessionLabel;
    const text = `${line0}\n${line1}\n${line2}\n${line3}`;
    this.hudTransient = transient !== undefined;
    if (text === this.hudText) return;
    this.hudText = text;
    const ctx = this.hudCanvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 640, 300);
    ctx.fillStyle = 'rgba(8, 16, 20, 0.78)';
    ctx.fillRect(0, 0, 640, 300);
    ctx.textBaseline = 'middle';
    // Session line — granted mode + blend mode, always visible.
    ctx.font = '26px system-ui, sans-serif';
    ctx.fillStyle = '#8fb8c8';
    ctx.fillText(line0, 24, 34);
    ctx.font = '36px system-ui, sans-serif';
    ctx.fillStyle = this.simulationMode ? '#4fc3f7' : '#'
      + KIND_COLORS[this.currentKind].toString(16).padStart(6, '0');
    ctx.fillText(line1, 24, 100);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(line2, 24, 172);
    ctx.fillStyle = '#9fd8ff';
    ctx.fillText(line3, 24, 244);
    this.hudTexture.needsUpdate = true;
  }

  private makeLabel(text: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'rgba(8, 16, 20, 0.75)';
      ctx.fillRect(0, 0, 256, 96);
      ctx.font = '44px system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 128, 48);
    }
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
      map: texture, transparent: true, depthTest: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(0.16, 0.06, 1);
    sprite.renderOrder = 90;
    return sprite;
  }

  // ------------------------------------------------------------------
  // Status / haptics / disposal
  // ------------------------------------------------------------------

  private setStatus(message: string): void {
    this.status = message;
    this.refreshHud();
    this.callbacks.onStatus(message);
  }

  /** Haptic tick, guarded — absent actuators are simply silent. */
  private pulse(state: ControllerState | null,
      intensity = 0.4, durationMs = 50): void {
    const actuator: any =
      (state?.handle.gamepad as any)?.hapticActuators?.[0];
    try {
      actuator?.pulse?.(intensity, durationMs);
    } catch { /* haptics are best-effort */ }
  }

  private clearAllPoints(): void {
    for (const record of this.records) {
      this.removeAndDispose(record.objects);
    }
    this.records.length = 0;
    this.refreshHud();
  }

  private clearLattice(): void {
    if (!this.latticeMesh) return;
    this.removeAndDispose([this.latticeMesh]);
    this.latticeMesh = null;
  }

  private removeAndDispose(objects: THREE.Object3D[]): void {
    for (const obj of objects) {
      obj.parent?.remove(obj);
      const anyObj = obj as any;
      anyObj.geometry?.dispose?.();
      const material = anyObj.material;
      if (material) {
        material.map?.dispose?.();
        material.dispose?.();
      }
    }
  }

  private vec3(triple: number[]): THREE.Vector3 {
    return new THREE.Vector3(
      triple[0] ?? 0, triple[1] ?? 0, triple[2] ?? 0);
  }

  private handleSessionEnd = (): void => {
    this.session?.removeEventListener('end', this.handleSessionEnd);
    this.session = null;
    this.renderer?.setAnimationLoop(null);
    if (this.helpFlashTimer !== null) {
      clearTimeout(this.helpFlashTimer);
      this.helpFlashTimer = null;
    }
    this.clearAllPoints();
    this.clearLattice();
    this.clearZoneShell();
    // Wrist ring + panels first (they hold listeners on the shared
    // controller rays), then the input rig, then the rig group.
    this.panelSystem?.dispose();
    this.panelSystem = null;
    this.wristUi?.dispose();
    this.wristUi = null;
    if (this.hudSprite) {
      this.removeAndDispose([this.hudSprite]);
      this.hudSprite = null;
      this.hudTexture = null;
      this.hudCanvas = null;
    }
    if (this.grid) {
      this.removeAndDispose([this.grid]);
      this.grid = null;
    }
    for (const c of this.controllers) {
      const tip = c.handle.ray.getObjectByName('zone-capture-tip');
      if (tip) this.removeAndDispose([tip]);
    }
    this.controllers.length = 0;
    this.inputRig?.dispose();
    this.inputRig = null;
    if (this.rigGroup) {
      this.rigGroup.parent?.remove(this.rigGroup);
      this.rigGroup = null;
    }
    this.scene = null;
    this.camera = null;
    this.disposeRenderer();
    this.callbacks.onEnded();
  };

  private disposeRenderer(): void {
    if (!this.renderer) return;
    this.renderer.setAnimationLoop(null);
    this.renderer.dispose();
    this.renderer = null;
  }
}
