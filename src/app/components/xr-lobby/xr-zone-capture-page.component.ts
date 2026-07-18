import {
  Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { PolariService } from '@services/polari-service';
import { XrCapabilityService } from '@services/xr/xr-capability.service';
import { ZonesBoardComponent }
  from '../zones/zones-board.component';
import { ArUnavailableNoticeComponent }
  from './ar-unavailable-notice.component';
import type {
  XrZoneCaptureRuntime, ZoneCaptureMode, ZoneCapturePoint,
  ZoneCommitResult, ZoneSwapResult,
} from './xr-zone-capture-runtime';

/** The to-simulation act's real constraints block (read back as the
 *  swap evidence). */
interface ZoneSwapConstraints {
  zone_footprint_area_m2: number;
  zone_height_m: number;
  zone_volume_m3: number;
  zone_perimeter_m: number;
  zone_scale_correction: number;
}

/** Result of the Swap-Modes act, shown on the page summary. */
interface ZoneSwapInfo {
  zoneName: string;
  simSpace: string;
  icInterface: string;
  constraints: ZoneSwapConstraints | null;
}

/** The committed zone's evidence, shown after the session. */
interface ZoneCaptureSummary {
  zoneName: string;
  pointCount: number;
  model: string;
  groundAreaM2: number | null;
  volumeM3: number | null;
  warnings: string[];
  totalCubes: number;
  cubesPerLayer: number | null;
  layers: number | null;
  /** Room roll-up (GET /room-summary) — present when the capture had
   *  a room zone (room_zone_name) or WAS the room (role 'room'). */
  roomName: string | null;
  roomVolumeM3: number | null;
  selectedVolumeM3: number | null;
  selectedCubes: number | null;
}

/**
 * /xr/zone-capture — the AR zone-capture surface (arz-5): walk a real
 * room, place points with the trigger, hold both grips 2 s to commit;
 * the backend estimates area/volume and packs the zone with 0.25 m
 * cubes that render in place (instanced, semitransparent).
 *
 * This page is the 2D wrapper: pre-session knobs (capture mode, cube
 * size, site name), the Enter AR/VR action, and the post-capture
 * evidence summary. The three.js capture runtime
 * (xr-zone-capture-runtime.ts) is dynamically imported on Enter so no
 * XR machinery loads for users who never enter — the same convention
 * XrEngineService uses. It does NOT reuse XrSessionRuntime: that
 * runtime is sim-space-bound and carries grip NAVIGATION, which must
 * stay OFF here (in AR, physical walking is the locomotion; moving
 * the virtual origin would misalign every placed point).
 */
@Component({
  standalone: true,
  selector: 'xr-zone-capture-page',
  imports: [CommonModule, FormsModule, RouterModule,
    ZonesBoardComponent, ArUnavailableNoticeComponent],
  template: `
    <div class="page">
      <a routerLink="/xr" class="back">&#8592; Back to XR home</a>
      <h1>Zone capture</h1>
      <p class="sim-banner">Requirement for simulation:
        <b>{{ sim }}</b></p>
      <p class="sub">Capture a real space as a zone: walk the room,
        place points with the trigger, hold both grips 2&nbsp;s to
        commit — the packed cubes render in place.</p>
      <p class="sub">Rooms are saved and <b>shared between
        simulations</b> (rooms are shared reality); selection zones
        you capture here <b>belong to this simulation</b>
        ({{ sim }}).</p>
      <p class="sub">Sessions start in <b>Real Constraints Mode</b>
        (capturing zones/rooms — the basis for running simulations
        and mapping them into reality); the wrist ring's SWAP MODES
        flips a committed zone into <b>Simulation Mode</b> (its real
        constraints become initial conditions; capture pauses).</p>

      <div class="panel" *ngIf="capabilityChecked && !xrAvailable">
        <p class="warn">{{ capabilityReason
          || 'No XR-capable device detected' }}</p>
        <p>Note: without a headset, zone points can be authored via
          the <a routerLink="/display/zones">/display/zones</a>
          no-code page instead — mouse capture on this page is a
          later pass.</p>
      </div>

      <div class="panel" *ngIf="xrAvailable">
        <div class="controls">
          <label>Capture mode
            <select [(ngModel)]="mode"
                    [disabled]="sessionActive || entering">
              <option value="planar">Planar (auto)</option>
              <option value="hull">Direct 3D (manual)</option>
            </select>
          </label>
          <label>Zone role
            <select [(ngModel)]="zoneRole"
                    [disabled]="sessionActive || entering">
              <option value="selection">Selection (packed)</option>
              <option value="room">Room (the containing space)</option>
            </select>
          </label>
          <label *ngIf="zoneRole === 'selection'">Room zone (optional)
            <input type="text" placeholder="living-room"
                   [(ngModel)]="roomZoneName"
                   [disabled]="sessionActive || entering">
          </label>
          <label>Cube size (m)
            <input type="number" step="0.05" min="0.05"
                   [(ngModel)]="cubeSize"
                   [disabled]="sessionActive || entering">
          </label>
          <label>Site name (optional)
            <input type="text" placeholder="my-house"
                   [(ngModel)]="siteName"
                   [disabled]="sessionActive || entering">
          </label>
        </div>
        <p class="hint" *ngIf="mode === 'planar'">Trace the outline
          at the zone's top height — dot heights are averaged into a
          plane and extruded to the floor. Auto-forms 20&nbsp;s after
          your last dot.</p>
        <button class="enter" (click)="enter()"
                [disabled]="entering || sessionActive">
          {{ entering ? 'Entering…'
            : sessionActive ? 'Session active' : 'Enter AR/VR' }}
        </button>
        <ul class="howto">
          <li>Trigger — place a point (default kind:
            {{ mode === 'hull' ? 'free' : 'ground' }})</li>
          <li>Grip (short squeeze) — undo the last point</li>
          <li>Touchpad / thumbstick click — cycle point kind
            ({{ mode === 'hull'
              ? 'free &#8596; reference'
              : 'ground &#8596; reference' }} — reference =
            calibration)</li>
          <li *ngIf="mode === 'planar'">Auto-forms 20&nbsp;s after
            your last dot (&#8805;3 dots); hold BOTH grips
            2&nbsp;s to commit immediately</li>
          <li *ngIf="mode === 'hull'">Hold BOTH grips 2&nbsp;s —
            force what you draw into a single 3D shape when you
            finalize (no auto-commit)</li>
          <li>Left-wrist ring (point the other controller's ray,
            pull the trigger) — SWAP MODES: Real Constraints Mode
            &#8596; Simulation Mode (needs a committed zone);
            BOARD: the rooms/zones panel; plus
            EXIT / RE-CENTER / HELP</li>
        </ul>
        <p class="live" *ngIf="sessionMode">
          session: {{ passthrough
            ? sessionMode + ' · ' + blendMode
            : sessionMode + ' fallback — passthrough not available'
              + ' in this browser' }} ·
          reference space: {{ referenceSpace }}</p>
        <!-- Same component as the in-headset 'panel:ar-notice'
             HTMLMesh — one source of truth for the fallback copy. -->
        <ar-unavailable-notice *ngIf="arFallbackNotice"
          [reason]="arFallbackNotice"></ar-unavailable-notice>
        <p class="live" *ngIf="sessionActive">
          mode: {{ simulationModeActive
            ? 'Simulation Mode' : 'Real Constraints Mode' }}</p>
        <p class="live" *ngIf="status">{{ status }}</p>
        <p class="warn" *ngIf="error">{{ error }}</p>
      </div>

      <div class="panel summary" *ngIf="summary">
        <h2>{{ summary.zoneName }}</h2>
        <p>model: {{ summary.model }} ·
          points: {{ summary.pointCount }}</p>
        <p *ngIf="summary.groundAreaM2 !== null">
          ground area: {{ summary.groundAreaM2 | number:'1.0-2' }}
          m&sup2;</p>
        <p *ngIf="summary.volumeM3 !== null">
          volume: {{ summary.volumeM3 | number:'1.0-2' }} m&sup3;</p>
        <p>total cubes: {{ summary.totalCubes }}<span
            *ngIf="summary.cubesPerLayer !== null"> ({{
            summary.cubesPerLayer }} / layer &times;
            {{ summary.layers }} layers)</span></p>
        <p *ngIf="summary.roomVolumeM3 !== null">
          Room volume: {{ summary.roomVolumeM3 | number:'1.0-2' }}
          m&sup3; | Selected zones:
          {{ summary.selectedVolumeM3 | number:'1.0-2' }} m&sup3;
          ({{ summary.selectedCubes }} cubes)</p>
        <ul class="warnings" *ngIf="summary.warnings.length">
          <li *ngFor="let warning of summary.warnings">
            {{ warning }}</li>
        </ul>
      </div>

      <div class="panel summary" *ngIf="swap">
        <h2>Simulation swap — {{ swap.zoneName }}</h2>
        <p>sim space: {{ swap.simSpace }}</p>
        <p>IC interface: {{ swap.icInterface }}</p>
        <p *ngIf="swap.constraints">real constraints &#8594; ICs:
          footprint {{ swap.constraints.zone_footprint_area_m2
            | number:'1.0-2' }} m&sup2; ·
          height {{ swap.constraints.zone_height_m
            | number:'1.0-2' }} m ·
          volume {{ swap.constraints.zone_volume_m3
            | number:'1.0-3' }} m&sup3; ·
          perimeter {{ swap.constraints.zone_perimeter_m
            | number:'1.0-2' }} m ·
          scale correction {{ swap.constraints.zone_scale_correction
            | number:'1.0-3' }}</p>
      </div>
    </div>

    <!-- Off-screen XR panel surface (the xr-panel-host convention):
         the LIVE zones-board mounts here — laid out and rendered
         (HTMLMesh needs real rects) but parked off-viewport; the
         in-session BOARD ring item rasterizes exactly this element.
         display:none would yield a zero-size raster — never that. -->
    <div class="xr-panel-context" *ngIf="xrAvailable">
      <div class="xr-panel-surface board" #zonesBoardSurface>
        <div class="xr-surface-title">Rooms / zones</div>
        <zones-board></zones-board>
      </div>
      <!-- The AR-unavailable notice's XR copy ('panel:ar-notice'):
           the runtime auto-opens it when the session has no
           passthrough; the AR INFO ring item reopens it. Dismissal
           is the panel system's own ✕ — (dismiss) stays unbound
           here, so the component renders no inline ✕. -->
      <div class="xr-panel-surface notice" #arNoticeSurface>
        <ar-unavailable-notice [reason]="arFallbackNotice">
        </ar-unavailable-notice>
      </div>
    </div>
  `,
  styles: [`
    /* Theme tokens — surface-* backgrounds pair with text-primary so
       light/dark switching keeps contrast (same rule as the other xr
       pages). */
    :host { display: block; min-height: 100vh;
      background: var(--surface-app-background);
      color: var(--text-primary); }
    .page { max-width: 760px; margin: 0 auto; padding: 24px;
      display: flex; flex-direction: column; gap: 14px; }
    .back { align-self: flex-start; font-size: 1.05rem;
      padding: 10px 18px; border-radius: 12px;
      background: var(--surface-secondary); color: var(--brand-blue);
      text-decoration: none; border: 2px solid var(--surface-hover); }
    h1 { font-size: 2rem; margin: 0; }
    .sim-banner { font-size: 1.3rem; margin: 0; padding: 12px 18px;
      border-radius: 12px; background: var(--surface-secondary);
      border: 2px solid var(--brand-blue);
      color: var(--text-primary); }
    .sim-banner b { color: var(--brand-blue);
      overflow-wrap: anywhere; }
    h2 { font-size: 1.4rem; margin: 0 0 6px;
      overflow-wrap: anywhere; }
    .sub { font-size: 1.15rem; color: var(--text-secondary);
      margin: 0; }
    .panel { padding: 20px; border-radius: 18px;
      background: var(--surface-primary);
      border: 2px solid var(--surface-hover);
      display: flex; flex-direction: column; gap: 12px; }
    .controls { display: flex; flex-wrap: wrap; gap: 18px; }
    label { display: flex; flex-direction: column; gap: 6px;
      font-size: 1.05rem; color: var(--text-secondary); }
    select, input { font-size: 1.1rem; padding: 10px 12px;
      border-radius: 10px; border: 2px solid var(--surface-hover);
      background: var(--surface-secondary);
      color: var(--text-primary); min-width: 180px; }
    .enter { align-self: flex-start; font-size: 1.4rem;
      padding: 16px 34px; border-radius: 14px;
      border: 2px solid var(--surface-hover);
      background: var(--surface-secondary);
      color: var(--brand-blue); cursor: pointer; }
    .enter:disabled { opacity: .45; cursor: default; }
    .howto { margin: 0; padding-left: 22px; font-size: 1.05rem;
      color: var(--text-secondary); display: flex;
      flex-direction: column; gap: 4px; }
    .live { margin: 0; font-size: 1.05rem;
      color: var(--text-secondary); }
    .hint { margin: 0; font-size: 1.05rem;
      color: var(--brand-blue); }
    .warn { margin: 0; font-size: 1.05rem; color: #e67e22; }
    .summary p { margin: 0; font-size: 1.1rem; }
    .warnings { margin: 0; padding-left: 22px; color: #e67e22; }
    a { color: var(--brand-blue); }
    /* Off-screen panel surface — same recipe as xr-panel-host. */
    .xr-panel-context { position: fixed; left: -10000px; top: 0; }
    .xr-panel-surface.board { width: 720px; background: #fdfdfe;
      border: 1px solid #c8c8c8; border-radius: 8px; padding: 10px; }
    .xr-panel-surface.notice { width: 584px; background: #fdfdfe;
      border: 1px solid #c8c8c8; border-radius: 8px; padding: 10px; }
    .xr-surface-title { font-size: 1.05rem; font-weight: 700;
      color: #0d47a1; padding: 2px 4px 10px; }
  `],
})
export class XrZoneCapturePageComponent implements OnInit, OnDestroy {

  mode: ZoneCaptureMode = 'planar';
  zoneRole: 'selection' | 'room' = 'selection';
  roomZoneName = '';
  cubeSize = 0.25;
  siteName = '';
  /** The simulation this capture serves (?sim= from the lobby's
   *  "Capture zones (requirement)" entry; defaults to the seeded
   *  sample). Selection zones get simulation_ref: sim on capture —
   *  rooms are deliberately left untied (shared reality). */
  sim = 'zone-block-filling';

  capabilityChecked = false;
  xrAvailable = false;
  capabilityReason = '';

  entering = false;
  sessionActive = false;
  /** Recorded on session start; sent with the capture as evidence
   *  (reference_space) alongside capture_kind: 'ar-headset'. */
  sessionMode = '';
  referenceSpace = '';
  /** session.environmentBlendMode as granted (passthrough evidence). */
  blendMode = '';
  /** True when the session composites over the real room. */
  passthrough = false;
  /** LOUD notice when AR was asked for but the browser fell to VR. */
  arFallbackNotice = '';

  status = '';
  error = '';
  summary: ZoneCaptureSummary | null = null;

  /** Exact naming by contract: 'Real Constraints Mode' (default,
   *  capture active) vs 'Simulation Mode' (capture paused; the
   *  committed zone's constraints became ICs). */
  simulationModeActive = false;
  /** Result of the last SWAP MODES /to-simulation act. */
  swap: ZoneSwapInfo | null = null;
  /** Last zone committed THIS session — what SWAP MODES acts on. */
  private lastCommittedZone: string | null = null;

  /** The live zones-board mount the BOARD panel rasterizes. */
  @ViewChild('zonesBoardSurface')
  zonesBoardSurface?: ElementRef<HTMLDivElement>;

  /** The AR-unavailable notice mount ('panel:ar-notice'). */
  @ViewChild('arNoticeSurface')
  arNoticeSurface?: ElementRef<HTMLDivElement>;

  private runtime: XrZoneCaptureRuntime | null = null;

  constructor(private http: HttpClient,
              private polari: PolariService,
              private capability: XrCapabilityService,
              private route: ActivatedRoute,
              private zone: NgZone) {}

  ngOnInit(): void {
    const sim = this.route.snapshot.queryParamMap.get('sim');
    if (sim && sim.trim()) this.sim = sim.trim();
    this.capability.capability().then(cap => {
      this.xrAvailable = cap.vr || cap.ar;
      this.capabilityReason = cap.reason ?? '';
      this.capabilityChecked = true;
    });
  }

  ngOnDestroy(): void {
    void this.runtime?.stop();
  }

  /** Enter AR/VR — must stay inside the click gesture (the browser
   *  rejects requestSession otherwise), so the dynamic import + the
   *  session request run directly in this handler. */
  async enter(): Promise<void> {
    if (this.entering || this.sessionActive) return;
    this.entering = true;
    this.error = '';
    this.summary = null;
    this.status = '';
    this.swap = null;
    this.simulationModeActive = false;
    this.lastCommittedZone = null;
    this.blendMode = '';
    this.passthrough = false;
    this.arFallbackNotice = '';
    try {
      const { XrZoneCaptureRuntime } =
        await import('./xr-zone-capture-runtime');
      const runtime = new XrZoneCaptureRuntime(this.mode, {
        onSessionInfo: info => this.zone.run(() => {
          this.sessionMode = info.sessionMode;
          this.referenceSpace = info.referenceSpace;
          this.blendMode = info.blendMode;
          this.passthrough = info.passthrough;
          // The notice component carries the researched copy (Gecko
          // vs Chromium Wolvic); the page only relays the runtime's
          // raw reason.
          this.arFallbackNotice = info.arFallbackReason ?? '';
        }),
        onStatus: message => this.zone.run(() => {
          this.status = message;
        }),
        onCommit: points => this.commitZone(points),
        onSwapModes: () => this.swapToSimulation(),
        onModeChange: simulationMode => this.zone.run(() => {
          this.simulationModeActive = simulationMode;
        }),
        onEnded: () => this.zone.run(() => {
          this.sessionActive = false;
          this.runtime = null;
          this.status = this.summary
            ? 'session ended — capture summary below'
            : 'session ended';
        }),
      }, {
        // Board + AR-unavailable notice; the scrub seams are stubbed
        // (no rail on this page — the provider shape demands them).
        panels: [{
          id: 'zones-board', label: 'Rooms/Zones',
          getElement: () =>
            this.zonesBoardSurface?.nativeElement ?? null,
        }, {
          id: 'ar-notice', label: 'AR unavailable',
          getElement: () =>
            this.arNoticeSurface?.nativeElement ?? null,
        }],
        getScrubState: () => null,
        setScrubCurrent: () => { /* no rail here */ },
      });
      await runtime.start();
      this.runtime = runtime;
      this.sessionActive = true;
    } catch (e: any) {
      this.error = e?.message || String(e);
    }
    this.entering = false;
  }

  /** The both-grips commit: POST /api/zones/capture with the placed
   *  points, then immediately POST /pack and hand the lattice back to
   *  the runtime for in-place cube rendering. */
  private async commitZone(points: ZoneCapturePoint[]):
      Promise<ZoneCommitResult> {
    const base = this.polari.getBackendBaseUrl();
    const zoneName = `zone-${Date.now()}`;
    const roomZone = this.zoneRole === 'selection'
      ? this.roomZoneName.trim() : '';
    const body: Record<string, unknown> = {
      name: zoneName,
      capture_mode: this.mode,
      capture_kind: 'ar-headset',
      zone_role: this.zoneRole,
      points,
    };
    if (roomZone) body['room_zone_name'] = roomZone;
    // Selection zones belong to THIS simulation; rooms stay untied —
    // rooms are shared reality between simulations (backend contract:
    // simulation_ref is stored only for zone_role 'selection').
    if (this.zoneRole === 'selection') {
      body['simulation_ref'] = this.sim;
    }
    if (this.referenceSpace) {
      body['reference_space'] = this.referenceSpace;
    }
    const site = this.siteName.trim();
    if (site) body['site_name'] = site;
    try {
      const captured: any = await firstValueFrom(this.http.post(
        `${base}/api/zones/capture`, body,
        this.polari.backendRequestOptions));
      if (!captured?.ok) {
        throw new Error(captured?.error || 'capture refused');
      }
      const cubeSize = this.cubeSize > 0 ? this.cubeSize : 0.25;
      // The PACK is separate from the capture on purpose: a pack
      // refusal (e.g. planar dots at floor height → nothing to
      // stack) must NOT read as a failed commit — the zone row
      // exists, the runtime renders its shell, and the pack error
      // travels back verbatim for the HUD.
      let packed: any = null;
      let packError: string | undefined;
      try {
        packed = await firstValueFrom(this.http.post(
          `${base}/api/zones/${encodeURIComponent(zoneName)}/pack`,
          { cube_size_m: cubeSize },
          this.polari.backendRequestOptions));
        if (!packed?.ok || !packed.lattice) {
          throw new Error(packed?.error || 'pack refused');
        }
      } catch (e: any) {
        packError = e?.error?.error || e?.message || String(e);
        packed = null;
      }
      // Room roll-up: when this capture belongs to a room (or IS the
      // room), also show room volume vs. selected-zones volume. A
      // failed roll-up never fails the commit — the cubes stand on
      // their own.
      const roomName = this.zoneRole === 'room' ? zoneName : roomZone;
      let roomSummary: any = null;
      if (roomName) {
        try {
          roomSummary = await firstValueFrom(this.http.get(
            `${base}/api/zones/${encodeURIComponent(roomName)}`
              + `/room-summary?cube_size_m=${cubeSize}`,
            this.polari.backendRequestOptions));
        } catch { /* roll-up is best-effort */ }
      }
      this.zone.run(() => {
        this.lastCommittedZone = zoneName;
        this.summary = {
          zoneName,
          pointCount: captured.pointCount ?? points.length,
          model: captured.estimate?.model ?? this.mode,
          groundAreaM2: captured.estimate?.groundAreaM2 ?? null,
          volumeM3: captured.estimate?.volumeM3 ?? null,
          warnings: captured.estimate?.warnings ?? [],
          totalCubes: packed?.totalCubes ?? 0,
          cubesPerLayer: packed?.cubesPerLayer ?? null,
          layers: packed?.layers ?? null,
          roomName: roomSummary ? roomName : null,
          roomVolumeM3: roomSummary?.roomVolumeM3 ?? null,
          selectedVolumeM3: roomSummary?.selectedVolumeM3 ?? null,
          selectedCubes: roomSummary?.selectedCubes ?? null,
        };
        this.error = packError ? `Pack failed: ${packError}` : '';
      });
      return {
        ok: true,
        zoneName,
        heightM: captured.estimate?.heightM
          ?? packed?.estimate?.heightM ?? null,
        render: packed ? {
          mode: this.mode,
          lattice: packed.lattice,
          layers: packed.layers,
          cubesPerLayer: packed.cubesPerLayer ?? null,
          totalCubes: packed.totalCubes ?? 0,
        } : null,
        packError,
      };
    } catch (e: any) {
      // 422 refusals carry {ok:false, error} in the response body.
      const message = e?.error?.error || e?.message || String(e);
      this.zone.run(() => {
        this.error = `Commit failed: ${message}`;
      });
      return { ok: false, error: message };
    }
  }

  /** The Swap-Modes act (wrist ring): POST the committed zone's
   *  /to-simulation — the backend ensures its SimSpaceDefinition +
   *  an InitialConditionInterfaceDefinition carrying the REAL
   *  constraints as setParams. ok=false (no committed zone / backend
   *  refusal) keeps the runtime in Real Constraints Mode; the
   *  message lands on the HUD either way. */
  private async swapToSimulation(): Promise<ZoneSwapResult> {
    const zoneName = this.lastCommittedZone;
    if (!zoneName) {
      return {
        ok: false,
        message:
          'commit a zone first — staying in Real Constraints Mode',
      };
    }
    const base = this.polari.getBackendBaseUrl();
    try {
      const result: any = await firstValueFrom(this.http.post(
        `${base}/api/zones/${encodeURIComponent(zoneName)}`
          + '/to-simulation',
        {}, this.polari.backendRequestOptions));
      if (!result?.ok) {
        throw new Error(result?.error || 'to-simulation refused');
      }
      const constraints: ZoneSwapConstraints | null =
        result.constraints ?? null;
      this.zone.run(() => {
        this.swap = {
          zoneName,
          simSpace: result.simSpace ?? '',
          icInterface: result.icInterface ?? '',
          constraints,
        };
        this.error = '';
      });
      const vol = constraints?.zone_volume_m3;
      const volText = typeof vol === 'number'
        ? `vol ${vol.toFixed(3)} m³ · ` : '';
      return {
        ok: true,
        message: `constraints → ICs: ${volText}`
          + `IC ${result.icInterface ?? ''}`,
      };
    } catch (e: any) {
      const message = e?.error?.error || e?.message || String(e);
      return { ok: false, message: `swap failed: ${message}` };
    }
  }
}
