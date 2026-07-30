import { Component, ElementRef, OnDestroy, OnInit, ViewChild }
  from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MotorsService } from '@services/motors.service';
import { SimSpaceService } from '@services/sim-space/sim-space.service';
import { SimSpaceRendererFactory }
  from '@services/sim-space/sim-space-renderer-factory.service';
import { MotorMaterialsPanelComponent }
  from './motor-materials-panel.component';

/**
 * mag-7: /magnetics/motor — the motor IN ACTION plus complete
 * material accountability (Dustin 2026-07-29).
 *
 * The animation is DRIVEN BY THE SOLVER, not by a canned tween:
 * the M0 clock-sim history (rotor angle per pulse from the Lavet
 * co-energy model) is replayed at the drive rate; the red arrow IS
 * the rotor orientation vector; the readout compares steps against
 * time progression — the same clock metric the physical build will
 * be graded by. Missed steps freeze the arrow, exactly as reality
 * would.
 */
@Component({
  standalone: true,
  selector: 'motor-view',
  imports: [CommonModule, FormsModule, RouterModule,
            MotorMaterialsPanelComponent],
  template: `
  <div class="motor-page">
    <h2>Motor ladder — see it run, follow its materials</h2>
    <p class="hint">M0 first: the Lavet clock stepper is the control
      case — the clock itself is the instrument. The animation
      replays the SOLVER's step history (quasi-static co-energy
      model; validity rides the payload), never a canned spin.</p>

    <div class="err" *ngIf="designs && !designs.ok">
      {{ designs.refusal }}</div>

    <div class="ladder" *ngIf="designs?.ok">
      <button *ngFor="let d of designs.designs"
              [class.active]="selected === d.name"
              (click)="select(d.name)">
        <b>{{ d.ladderRung }}</b> {{ d.displayName }}
        <span class="chip">{{ d.toleranceTier }}</span>
      </button>
    </div>

    <div class="cols" *ngIf="selected">
      <div class="col">
        <h3>In action</h3>
        <div class="card" *ngIf="isM0; else torqueCard">
          <svg viewBox="-120 -120 240 240" class="motor-svg">
            <!-- stator: two pole shoes + coil bobbin -->
            <g class="stator">
              <path d="M -95 -34 A 101 101 0 0 1 -95 34 L -62 22
                       A 66 66 0 0 0 -62 -22 Z" class="pole"/>
              <path d="M 95 -34 A 101 101 0 0 0 95 34 L 62 22
                       A 66 66 0 0 1 62 -22 Z" class="pole"/>
              <rect x="-30" y="88" width="60" height="22" rx="4"
                    class="coil"
                    [class.pulse-pos]="polarity === 1"
                    [class.pulse-neg]="polarity === -1"/>
              <text x="0" y="103" class="coil-label">coil
                {{ polarity === 0 ? 'off'
                   : (polarity === 1 ? '+pulse' : '−pulse') }}
              </text>
            </g>
            <!-- rotor disc + ORIENTATION VECTOR -->
            <g [attr.transform]="'rotate(' + displayAngle + ')'">
              <circle r="52" class="rotor"/>
              <path d="M 0 -52 A 52 52 0 0 1 0 52 Z"
                    class="rotor-north"/>
              <line x1="0" y1="40" x2="0" y2="-40"
                    class="vector"/>
              <path d="M 0 -52 L -9 -32 L 9 -32 Z"
                    class="vector-head"/>
              <text x="14" y="-30" class="pole-label">N</text>
            </g>
            <circle r="5" class="shaft"/>
          </svg>
          <div class="readout" *ngIf="sim?.ok">
            <span>pulse <b>{{ pulseIndex }}</b> /
              {{ sim.pulses }}</span>
            <span>θ = <b>{{ thetaMod | number:'1.0-0' }}°</b>
            </span>
            <span class="hint">({{ turnsSoFar }} half-turns
              total)</span>
            <span>steps <b>{{ stepsSoFar }}</b>
              · missed <b [class.warn-text]="missedSoFar > 0">
              {{ missedSoFar }}</b></span>
            <span>clock error
              <b [class.warn-text]="clockErrorSoFar > 0">
                {{ clockErrorSoFar }} s</b>
              over {{ elapsedS }} s</span>
          </div>
          <div class="controls">
            <button (click)="playPause()">
              {{ playing ? 'pause' : 'play' }}</button>
            <button (click)="restart()">restart</button>
            <label>pulses
              <input type="number" [(ngModel)]="pulseCount"
                     min="4" max="600" (change)="loadSim()"/>
            </label>
            <label class="hint">
              <input type="checkbox" [(ngModel)]="alternating"
                     (change)="loadSim()"/> alternating polarity
              (uncheck = watch it honestly fail)</label>
          </div>
          <p class="hint" *ngIf="sim?.ok">{{ sim.validity }}</p>
          <div class="err" *ngIf="sim && !sim.ok">
            {{ sim.refusal }}</div>
        </div>
        <ng-template #torqueCard>
          <div class="card">
            <div class="err" *ngIf="torque && !torque.ok">
              {{ torque.refusal }}</div>
            <ng-container *ngIf="torque?.ok">
              <svg viewBox="0 0 320 150" class="torque-svg">
                <line x1="30" y1="120" x2="310" y2="120"
                      class="axis"/>
                <line x1="30" y1="15" x2="30" y2="120"
                      class="axis"/>
                <polyline [attr.points]="torquePoints"
                          class="torque-line"/>
                <text x="160" y="140" class="axis-label">
                  rotor angle (one electrical period)</text>
                <text x="10" y="12" class="axis-label">torque</text>
              </svg>
              <div class="readout">
                <span>mean <b>{{ sci(torque.meanTorqueNm) }} Nm</b>
                </span>
                <span>ripple <b>{{ torque.ripplePct }}%</b></span>
                <span class="chip" *ngIf="torque.dualGap">dual
                  gap</span>
              </div>
              <p class="hint">{{ torque.validity }}</p>
            </ng-container>
          </div>
        </ng-template>
        <div class="card" *ngIf="isM0">
          <h4>3D — the parts as math shapes, the AC flip visible</h4>
          <p class="hint">Every part below is a MathShapeDefinition
            row (the same geometry the wax-mold seam prints/casts).
            The arrow through the coil bore is its field — watch it FLIP with
            each alternating pulse; the flip is what walks the
            rotor. Drag to orbit.</p>
          <div #host3d class="host3d"></div>
          <p class="hint" *ngIf="sceneSource">{{ sceneSource }}</p>
          <div class="err" *ngIf="shapes3dError">
            {{ shapes3dError }}</div>
        </div>
        <div class="card">
          <h4>Drive it</h4>
          <ng-container *ngIf="drive?.ok">
            <div class="readout">
              <span>board <b>{{ drive.board }}</b></span>
              <span>profile <b>{{ drive.profile }}</b></span>
              <span>pole pairs <b>{{ drive.polePairs }}</b></span>
            </div>
            <table class="bindings" *ngIf="drive.phaseBindings?.length">
              <tr><th>phase</th><th>shield terminal</th>
                <th>FPGA PWM</th></tr>
              <tr *ngFor="let b of drive.phaseBindings">
                <td>{{ b.phase }}</td>
                <td>{{ b.shieldTerminal }}</td>
                <td class="hint">{{ b.fpgaPwmChannel }}</td></tr>
            </table>
            <pre class="snippet">{{ drive.configSnippet }}</pre>
            <p class="hint">{{ drive.honesty }}</p>
          </ng-container>
          <ng-container *ngIf="drive && !drive.ok">
            <p class="hint">{{ drive.refusal }}</p>
          </ng-container>
        </div>
        <div class="card" *ngIf="buildReq">
          <h4>Build this sample</h4>
          <div class="hint">~{{ buildReq.rough_hours }} h ·
            skills: {{ buildReq.skills?.join(', ') }}</div>
          <ul>
            <li *ngFor="let t of buildReq.tools">{{ t }}</li>
            <li *ngFor="let mt of buildReq.materials">
              <code>{{ mt.ref }}</code> — {{ mt.note }}</li>
          </ul>
        </div>
        <div class="card">
          <h4>Verification runs — earned, never declared</h4>
          <ng-container *ngIf="verify?.ok">
            <div class="readout">
              <span>sim <b>{{ verify.simCount }}</b></span>
              <span>measured <b>{{ verify.measuredCount }}</b></span>
              <span class="chip"
                    [class.earned]="verify.madeAndMeasured">
                {{ verify.madeAndMeasured ? 'made-and-measured'
                   : 'not yet made-and-measured' }}</span>
            </div>
            <p class="hint">{{ verify.honesty }}</p>
            <table class="bindings" *ngIf="verify.runs?.length">
              <tr><th>run</th><th>kind</th><th>steps</th>
                <th>clock error</th></tr>
              <tr *ngFor="let r of verify.runs">
                <td>{{ r.name }}</td><td>{{ r.kind }}</td>
                <td>{{ r.stepsTaken }}/{{ r.stepsCommanded }}</td>
                <td [class.warn-text]="r.clockErrorS > 0">
                  {{ r.clockErrorS }} s</td></tr>
            </table>
            <div class="controls" *ngIf="isM0 && sim?.ok">
              <button (click)="recordSimRun()">record this sim
                replay ({{ sim.pulses }} pulses)</button>
            </div>
            <details class="measured-form">
              <summary class="hint">record a MEASURED bench run</summary>
              <div class="controls">
                <label>commanded <input type="number"
                  [(ngModel)]="mCommanded" min="1"/></label>
                <label>taken <input type="number"
                  [(ngModel)]="mTaken" min="0"/></label>
                <label>duration s <input type="number"
                  [(ngModel)]="mDuration" min="0"/></label>
              </div>
              <div class="controls">
                <label>notes <input type="text"
                  [(ngModel)]="mNotes" size="30"/></label>
                <button (click)="recordMeasuredRun()">record
                  measured</button>
              </div>
            </details>
            <div class="err" *ngIf="verifyMsg">{{ verifyMsg }}</div>
          </ng-container>
          <div class="err" *ngIf="verify && !verify.ok">
            {{ verify.refusal }}</div>
        </div>
      </div>

      <div class="col wide">
        <h3>Material accountability — follow every derivation</h3>
        <motor-materials-panel [trail]="materials">
        </motor-materials-panel>
      </div>
    </div>
    <div class="foot">
      <a routerLink="/magnetics/fields">field views</a> ·
      <a routerLink="/business/start">start a business</a> ·
      <a routerLink="/business/odoo">odoo backbone</a>
    </div>
  </div>
  `,
  styles: [`
    .motor-page { padding: 14px 18px;
      color: var(--text-on-bg, inherit); }
    .hint { color: var(--text-on-bg-muted,
      var(--text-on-card-muted)); font-size: 0.9em; }
    .err { color: #d33; }
    .warn-text { color: #c80; }
    .ladder { display: flex; gap: 8px; flex-wrap: wrap;
      margin: 10px 0; }
    .ladder button { padding: 6px 12px; border-radius: 8px;
      border: 1px solid var(--surface-outline, #8884);
      background: var(--surface-primary);
      color: var(--text-on-card); cursor: pointer; }
    .ladder button.active { border-color: #46f; }
    .chip { border: 1px solid var(--surface-outline, #8884);
      border-radius: 10px; padding: 0 8px; font-size: 0.78em; }
    .cols { display: flex; gap: 16px; flex-wrap: wrap; }
    .col { flex: 1 1 340px; min-width: 320px; }
    .col.wide { flex: 2 1 480px; }
    .card { border: 1px solid var(--surface-outline, #8884);
      border-radius: 8px; padding: 12px;
      background: var(--surface-primary);
      color: var(--text-on-card); margin-bottom: 12px; }
    .motor-svg { width: 100%; max-width: 340px; display: block;
      margin: 0 auto; }
    .host3d { width: 100%; height: 320px; border-radius: 6px;
      overflow: hidden; background:
      var(--surface-app-background, #14161a); }
    .pole { fill: var(--text-on-card-muted, #999);
      opacity: 0.55; }
    .coil { fill: none; stroke: var(--text-on-card-muted, #999);
      stroke-width: 2; }
    .coil.pulse-pos { stroke: #2a2; fill: #2a22; }
    .coil.pulse-neg { stroke: #c80; fill: #c802; }
    .coil-label { font-size: 9px; text-anchor: middle;
      fill: var(--text-on-card); }
    .rotor { fill: var(--surface-app-background, #ddd);
      stroke: var(--text-on-card-muted, #999); }
    .rotor-north { fill: #d3333f; opacity: 0.25; }
    .vector { stroke: #d33; stroke-width: 4; }
    .vector-head { fill: #d33; }
    .pole-label { font-size: 12px; fill: #d33; }
    .shaft { fill: var(--text-on-card, #333); }
    .readout { display: flex; gap: 14px; flex-wrap: wrap;
      font-variant-numeric: tabular-nums; margin: 8px 0; }
    .controls { display: flex; gap: 10px; align-items: center;
      flex-wrap: wrap; }
    .controls input[type=number] { width: 64px; }
    .torque-svg { width: 100%; max-width: 420px; }
    .snippet { font-size: 0.78em; overflow-x: auto; padding: 8px;
      border-radius: 6px; border: 1px solid
      var(--surface-outline, #8884);
      background: var(--surface-app-background, #14161a);
      color: var(--text-on-bg, inherit); }
    .bindings { border-collapse: collapse; font-size: 0.85em;
      margin: 6px 0; }
    .bindings th, .bindings td { border: 1px solid
      var(--surface-outline, #8884); padding: 2px 8px;
      text-align: left; }
    .chip.earned { border-color: #2a2; color: #2a2; }
    .measured-form { margin-top: 6px; }
    .measured-form input { max-width: 90px; }
    .measured-form input[type=text] { max-width: none; }
    .axis { stroke: var(--text-on-card-muted, #999); }
    .axis-label { font-size: 9px;
      fill: var(--text-on-card-muted, #999); }
    .torque-line { fill: none; stroke: #46f; stroke-width: 2; }
    .foot { margin-top: 14px; font-size: 0.9em; }
    .foot a { color: inherit; }
  `],
})
export class MotorViewComponent implements OnInit, OnDestroy {
  designs: any; sim: any; torque: any; materials: any;
  drive: any; verify: any; verifyMsg = '';
  mCommanded = 3600; mTaken = 3600;
  mDuration: number | null = null; mNotes = '';
  selected = ''; pulseCount = 30; alternating = true;
  playing = false; pulseIndex = 0; displayAngle = 0;
  polarity = 0; stepsSoFar = 0; missedSoFar = 0;
  shapes3dError = ''; sceneSource = '';
  @ViewChild('host3d') host3dRef?: ElementRef<HTMLElement>;
  private renderer3d: any = null; private coilStyle = '';
  private sceneObjects: any[] | null = null;
  private timer: any = null; private animFrom = 0;
  private animTo = 0; private animStart = 0;

  constructor(private motors: MotorsService,
              private simSpaces: SimSpaceService,
              private rendererFactory: SimSpaceRendererFactory) {}

  async ngOnInit(): Promise<void> {
    this.designs = await this.motors.designs();
    if (this.designs?.ok && this.designs.designs.length) {
      await this.select(this.designs.designs[0].name);
    }
  }

  ngOnDestroy(): void { this.stopTimer(); this.destroy3d(); }

  private destroy3d(): void {
    try { this.renderer3d?.destroy(); } catch { /* detached */ }
    this.renderer3d = null;
  }

  private objects3d(thetaRad: number): any[] {
    // Layout comes from the motor-m0-viz SimSpaceDefinition row's
    // snapshot; MOTION (rotor rotation, coil polarity material) is
    // applied here from the solver replay — scene = data, animation
    // = runtime transform, never baked into the row.
    if (this.sceneObjects) {
      return this.sceneObjects.map((o: any) => ({
        ...o, trackKey: o.id,
        styleRef: o.id === 'coil' ? this.coilStyle : o.styleRef,
        rotation: (o.id === 'rotor-disc'
                   || o.id === 'rotor-pointer')
          ? [0, 0, thetaRad] : o.rotation,
      }));
    }
    // Fallback when the scene row is absent (older backend): the
    // same six parts hard-coded, coil as the solid outer.
    const stat = (id: string, shape: string, style: string) => ({
      id, trackKey: id, position: [0, 0, 0] as any,
      shapeRef: `mathshape:${shape}`, styleRef: style,
    });
    return [
      stat('pole-left', 'motor-m0-pole-left', 'motor-part-gray'),
      stat('pole-right', 'motor-m0-pole-right', 'motor-part-gray'),
      stat('coil', 'motor-m0-coil-outer', this.coilStyle),
      stat('shaft', 'motor-m0-shaft', 'motor-shaft-steel'),
      { ...stat('rotor-disc', 'motor-m0-rotor-disc',
                'motor-rotor-dark'),
        rotation: [0, 0, thetaRad] },
      { ...stat('rotor-pointer', 'motor-m0-rotor-pointer',
                'motor-pointer-red'),
        rotation: [0, 0, thetaRad] },
    ];
  }

  private vectors3d(thetaRad: number): any[] {
    return [
      { kind: 'vector', key: 'orientation',
        origin: [0, 0, 1.2],
        vec: [-Math.sin(thetaRad), Math.cos(thetaRad), 0],
        scale: 4.2, headScale: 0.25,
        styleRef: 'motor-pointer-red' },
      { kind: 'vector', key: 'ac-field',
        origin: [0, -6.8, 0],
        vec: [0, this.polarity, 0],
        scale: this.polarity === 0 ? 0.001 : 3.2,
        headScale: 0.3,
        styleRef: this.polarity >= 0 ? 'motor-coil-pos'
                                     : 'motor-coil-neg' },
    ];
  }

  private async init3d(): Promise<void> {
    this.destroy3d();
    const host = this.host3dRef?.nativeElement;
    if (!host || !this.isM0) { return; }
    try {
      // Asset libraries are guaranteed loaded by the factory
      // (ensureSceneAssets) — the hand-load that used to live here
      // was the mag-7b fix, generalized 2026-07-30.
      this.renderer3d = await this.rendererFactory.create('3d');
      this.renderer3d.attach(host);
      // The assembled motor is a real SimSpaceDefinition row —
      // layout + viewport from its snapshot; fall back to the
      // hard-coded equivalent when the row is absent.
      this.sceneObjects = null; this.sceneSource = '';
      let definition: any = {
        id: 'motor-m0-3d', name: 'motor-m0-3d',
        dimensionality: '3d', coordinateSystem: 'math',
        unitScale: 1,
        viewport: { center: [0, -1.5, 0], extent: [7, 8, 5] },
        definition: '{}',
      };
      try {
        const snap = await this.simSpaces.snapshot('motor-m0-viz');
        if (snap?.definition && snap.objects?.length) {
          definition = snap.definition;
          this.sceneObjects = snap.objects;
          this.sceneSource = 'scene: SimSpaceDefinition row '
            + '"motor-m0-viz" (motion overlaid from the solver '
            + 'replay)';
        }
      } catch {
        this.sceneSource = 'scene row "motor-m0-viz" not found — '
          + 'using the built-in fallback layout';
      }
      this.renderer3d.loadDefinition(definition);
      this.coilStyle = 'motor-coil-idle';
      const theta = (this.displayAngle * Math.PI) / 180;
      this.renderer3d.setObjects(this.objects3d(theta));
      this.renderer3d.setVectors(this.vectors3d(theta));
    } catch (err: any) {
      this.shapes3dError = `3D init failed: ${err?.message ?? err}
        — is the mathshapes module enabled (POLARI_MODULES)?`;
    }
  }

  private update3d(): void {
    if (!this.renderer3d) { return; }
    const theta = (this.displayAngle * Math.PI) / 180;
    const wanted = this.polarity === 0 ? 'motor-coil-idle'
      : (this.polarity === 1 ? 'motor-coil-pos'
                             : 'motor-coil-neg');
    if (wanted !== this.coilStyle) {
      this.coilStyle = wanted;
      this.renderer3d.setObjects(this.objects3d(theta));
    } else {
      this.renderer3d.updateObjectTransform(
        'rotor-disc', { rotation: [0, 0, theta] });
      this.renderer3d.updateObjectTransform(
        'rotor-pointer', { rotation: [0, 0, theta] });
    }
    this.renderer3d.setVectors(this.vectors3d(theta));
  }

  get isM0(): boolean {
    return this.selectedDesign?.topology === 'lavet-clock-stepper';
  }

  get selectedDesign(): any {
    return this.designs?.designs?.find(
      (d: any) => d.name === this.selected);
  }

  get buildReq(): any {
    const raw = this.selectedDesign?.buildRequirements;
    try { return raw ? JSON.parse(raw) : null; }
    catch { return null; }
  }

  get clockErrorSoFar(): number {
    const rate = this.sim?.rateHz || 1;
    return this.missedSoFar / rate;
  }

  get elapsedS(): number {
    const rate = this.sim?.rateHz || 1;
    return this.pulseIndex / rate;
  }

  get thetaMod(): number {
    return ((this.displayAngle % 360) + 360) % 360;
  }

  get turnsSoFar(): number {
    return this.stepsSoFar;
  }

  get torquePoints(): string {
    const curve = this.torque?.curve || [];
    if (!curve.length) { return ''; }
    const peak = Math.max(
      ...curve.map((p: any) => Math.abs(p.torqueNm)), 1e-12);
    return curve.map((p: any, i: number) => {
      const x = 30 + (280 * i) / (curve.length - 1);
      const y = 120 - ((p.torqueNm / peak) * 0.5 + 0.5) * 100;
      return `${x},${y}`;
    }).join(' ');
  }

  async select(name: string): Promise<void> {
    this.selected = name;
    this.stopTimer(); this.playing = false;
    this.sim = null; this.torque = null; this.materials = null;
    this.drive = null; this.verify = null; this.verifyMsg = '';
    this.materials = await this.motors.materials(name);
    this.drive = await this.motors.drive(name);
    this.verify = await this.motors.verifySummary(name);
    if (this.isM0) {
      await this.loadSim();
      setTimeout(() => this.init3d(), 0);
    } else {
      this.destroy3d();
      this.torque = await this.motors.torque(name);
    }
  }

  async recordSimRun(): Promise<void> {
    if (!this.sim?.ok) { return; }
    this.verifyMsg = '';
    const out = await this.motors.recordVerification(this.selected, {
      kind: 'sim-quasi-static',
      stepsCommanded: this.sim.pulses,
      stepsTaken: this.sim.stepsTaken,
      notes: this.alternating
        ? 'page replay, alternating pulses'
        : 'page replay, same-polarity (the honest failure mode)',
    });
    if (!out?.ok) {
      this.verifyMsg = out?.refusal || 'record failed';
    }
    this.verify = await this.motors.verifySummary(this.selected);
  }

  async recordMeasuredRun(): Promise<void> {
    this.verifyMsg = '';
    const out = await this.motors.recordVerification(this.selected, {
      kind: 'measured',
      stepsCommanded: this.mCommanded,
      stepsTaken: this.mTaken,
      durationS: this.mDuration ?? undefined,
      notes: this.mNotes,
    });
    if (!out?.ok) {
      this.verifyMsg = out?.refusal || 'record failed';
    }
    this.verify = await this.motors.verifySummary(this.selected);
  }

  async loadSim(): Promise<void> {
    this.stopTimer(); this.playing = false;
    const pulses = Math.max(4, Math.min(600,
      this.pulseCount || 30));
    this.sim = await this.motors.clockSim(
      this.selected, pulses, this.alternating);
    this.restart();
  }

  sci(value: number): string {
    return (value ?? 0).toExponential(2);
  }

  restart(): void {
    this.stopTimer(); this.playing = false;
    this.pulseIndex = 0; this.stepsSoFar = 0; this.missedSoFar = 0;
    this.polarity = 0;
    this.displayAngle = this.sim?.ok
      ? this.sim.history[0].thetaDeg : 0;
  }

  playPause(): void {
    if (this.playing) { this.stopTimer(); this.playing = false;
                        return; }
    if (!this.sim?.ok) { return; }
    this.playing = true;
    const rate = this.sim.rateHz || 1;
    this.timer = setInterval(() => this.tick(),
                             Math.max(200, 1000 / rate));
  }

  private tick(): void {
    if (!this.sim?.ok) { return; }
    if (this.pulseIndex >= this.sim.pulses) {
      this.stopTimer(); this.playing = false; return;
    }
    this.pulseIndex += 1;
    const entry = this.sim.history[this.pulseIndex];
    this.polarity = entry.polarity;
    if (entry.stepped) { this.stepsSoFar += 1; }
    else { this.missedSoFar += 1; }
    this.animateTo(entry.thetaDeg);
  }

  private animateTo(target: number): void {
    this.animFrom = this.displayAngle;
    let delta = (target - (this.animFrom % 360) + 540) % 360 - 180;
    if (Math.abs(delta) < 1) { delta = 0; }
    this.animTo = this.animFrom + delta;
    this.animStart = performance.now();
    const stepAnim = (now: number) => {
      const t = Math.min(1, (now - this.animStart) / 350);
      const ease = 1 - Math.pow(1 - t, 3);
      this.displayAngle =
        this.animFrom + (this.animTo - this.animFrom) * ease;
      this.update3d();
      if (t < 1 && this.playing) {
        requestAnimationFrame(stepAnim);
      }
    };
    requestAnimationFrame(stepAnim);
  }

  private stopTimer(): void {
    if (this.timer) { clearInterval(this.timer);
                      this.timer = null; }
  }
}
