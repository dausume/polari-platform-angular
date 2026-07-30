import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MotorsService } from '@services/motors.service';
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
            <span>θ = <b>{{ displayAngle | number:'1.0-0' }}°</b>
            </span>
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
      </div>

      <div class="col wide">
        <h3>Material accountability — follow every derivation</h3>
        <motor-materials-panel [trail]="materials">
        </motor-materials-panel>
      </div>
    </div>
    <div class="foot">
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
  selected = ''; pulseCount = 30; alternating = true;
  playing = false; pulseIndex = 0; displayAngle = 0;
  polarity = 0; stepsSoFar = 0; missedSoFar = 0;
  private timer: any = null; private animFrom = 0;
  private animTo = 0; private animStart = 0;

  constructor(private motors: MotorsService) {}

  async ngOnInit(): Promise<void> {
    this.designs = await this.motors.designs();
    if (this.designs?.ok && this.designs.designs.length) {
      await this.select(this.designs.designs[0].name);
    }
  }

  ngOnDestroy(): void { this.stopTimer(); }

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
    this.materials = await this.motors.materials(name);
    if (this.isM0) { await this.loadSim(); }
    else { this.torque = await this.motors.torque(name); }
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
