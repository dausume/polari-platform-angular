import { Component, ElementRef, OnDestroy, OnInit, ViewChild }
  from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MotorsService } from '@services/motors.service';
import { SimSpaceService } from '@services/sim-space/sim-space.service';
import { SimSpaceRendererFactory }
  from '@services/sim-space/sim-space-renderer-factory.service';

/**
 * mag-11: /magnetics/clock-motor — the Lavet-type stepping motor
 * piece by piece.
 *
 * The existing /magnetics/motor page shows the motor RUNNING. This
 * one answers the other question: what is it MADE of, and what is
 * each piece FOR? Select a part and the 3D view highlights it while
 * the panel gives its job in the clock, the material chosen, why
 * that material, the properties that result, and its measured
 * volume and mass — every number derived from the same rows the
 * viewer draws, so the picture and the bill cannot disagree.
 */
@Component({
  standalone: true,
  selector: 'clock-motor',
  imports: [CommonModule, RouterModule],
  template: `
  <div class="cm-page">
    <h2>Lavet-type stepping motor — the pieces, and what each is
      for</h2>
    <p class="hint">The quartz-clock motor (Marius Lavet, 1936).
      Geometry modelled from reference photographs; every volume
      below is measured from the SAME MathShapeDefinition row the
      3D view draws, so the bill cannot drift from the picture.</p>

    <div class="err" *ngIf="parts && !parts.ok">
      {{ parts.refusal }}</div>

    <div class="cols" *ngIf="parts?.ok">
      <div class="col">
        <div class="card">
          <div #host3d class="host3d"></div>
          <div class="scene-note hint" *ngIf="sceneNote">
            {{ sceneNote }}</div>
          <div class="err" *ngIf="sceneError">{{ sceneError }}</div>
        </div>

        <div class="card" *ngIf="winding?.ok">
          <h4>Can this coil actually be wound and driven?</h4>
          <div class="readout">
            <span>{{ winding.wire.awg }} AWG</span>
            <span>fill <b>{{ winding.fillFactor }}</b></span>
            <span>{{ winding.resistanceOhm }} Ω</span>
            <span><b>{{ winding.voltageNeededV }} V</b> of
              {{ winding.supplyVoltageV }} V</span>
            <span>{{ winding.powerDissipatedW }} W</span>
          </div>
          <div class="verdict"
               [class.good]="winding.buildable"
               [class.bad]="!winding.buildable">
            {{ winding.fitNote }}
          </div>
          <p class="hint">{{ winding.driveNote }}</p>
          <p class="hint">{{ winding.thermalNote }}</p>
          <div class="warn-text" *ngFor="let i of winding.invalidates">
            ⚠ {{ i }}</div>
        </div>
      </div>

      <div class="col wide">
        <div class="totals">
          <span><b>{{ parts.count }}</b> pieces</span>
          <span>total <b>{{ parts.totalMassG }} g</b></span>
          <span class="hint">{{ parts.massNote }}</span>
        </div>

        <div class="part" *ngFor="let p of parts.parts"
             [class.active]="selected === p.part"
             (click)="select(p.part)">
          <div class="part-head">
            <b>{{ p.displayName }}</b>
            <span class="chip fn">{{ p.function }}</span>
            <span class="chip" *ngIf="p.quantity > 1">×{{ p.quantity }}</span>
            <span class="grow"></span>
            <span class="nums" *ngIf="p.volumeCm3 != null">
              {{ p.volumeCm3 }} cm³
              <ng-container *ngIf="p.massG != null">
                · <b>{{ p.massG }} g</b></ng-container>
            </span>
          </div>

          <div class="purpose">{{ p.purpose }}</div>

          <ng-container *ngIf="selected === p.part">
            <div class="mat" *ngIf="p.material">
              <span class="label">made of</span>
              <code>{{ p.material }}</code>
              <span class="chip" *ngIf="p.realizationLevel">
                {{ p.realizationLevel }}</span>
            </div>
            <div class="why" *ngIf="p.whyThisMaterial">
              <span class="label">why this material</span>
              {{ p.whyThisMaterial }}
            </div>
            <table class="props" *ngIf="p.properties?.length">
              <tr><th>property</th><th>value</th><th>unit</th>
                <th>provenance</th></tr>
              <tr *ngFor="let pr of p.properties">
                <td><code>{{ pr.property }}</code></td>
                <td>{{ pr.value }}</td>
                <td>{{ pr.unit }}</td>
                <td><span class="chip">{{ pr.provenance }}</span></td>
              </tr>
            </table>
            <div class="hint" *ngIf="p.materialGap">
              ⚠ {{ p.materialGap }}</div>
            <div class="hint" *ngIf="p.notes">{{ p.notes }}</div>
            <div class="hint">shape row <code>{{ p.shapeRef }}</code>
              ({{ p.shapeUnits }} units)</div>
          </ng-container>
        </div>

        <div class="card" *ngIf="parts.gaps?.length">
          <h4>Honest gaps</h4>
          <div class="hint" *ngFor="let g of parts.gaps">— {{ g }}</div>
        </div>
        <p class="hint">{{ parts.honesty }}</p>
      </div>
    </div>

    <div class="foot">
      <a routerLink="/magnetics/motor">see it run</a> ·
      <a routerLink="/magnetics/fields">field views</a>
    </div>
  </div>
  `,
  styles: [`
    .cm-page { padding: 14px 18px;
      color: var(--text-on-bg, inherit); }
    .hint { color: var(--text-on-bg-muted,
      var(--text-on-card-muted)); font-size: 0.9em; }
    .err { color: #d33; }
    .warn-text { color: #c80; font-size: 0.9em; margin-top: 4px; }
    .cols { display: flex; gap: 16px; flex-wrap: wrap; }
    .col { flex: 1 1 380px; min-width: 330px; }
    .col.wide { flex: 1.4 1 460px; }
    .card { border: 1px solid var(--surface-outline, #8884);
      border-radius: 8px; padding: 12px;
      background: var(--surface-primary);
      color: var(--text-on-card); margin-bottom: 12px; }
    .host3d { width: 100%; height: 340px; border-radius: 6px;
      overflow: hidden;
      background: var(--surface-app-background, #14161a); }
    .scene-note { margin-top: 6px; }
    .totals { display: flex; gap: 14px; align-items: baseline;
      flex-wrap: wrap; margin-bottom: 8px;
      font-variant-numeric: tabular-nums; }
    .part { border: 1px solid var(--surface-outline, #8884);
      border-left-width: 4px; border-radius: 8px; padding: 10px 12px;
      background: var(--surface-primary);
      color: var(--text-on-card); margin-bottom: 8px;
      cursor: pointer; }
    .part.active { border-left-color: #46f; }
    .part-head { display: flex; gap: 8px; align-items: center;
      flex-wrap: wrap; }
    .grow { flex: 1 1 auto; }
    .nums { font-variant-numeric: tabular-nums; font-size: 0.9em; }
    .purpose { margin-top: 5px; font-size: 0.92em; }
    .chip { border: 1px solid var(--surface-outline, #8884);
      border-radius: 10px; padding: 0 8px; font-size: 0.76em; }
    .chip.fn { border-color: #46f; color: #46f; }
    .label { color: var(--text-on-card-muted); font-size: 0.8em;
      text-transform: uppercase; letter-spacing: 0.04em;
      margin-right: 6px; }
    .mat, .why { margin-top: 8px; font-size: 0.9em; }
    .props { border-collapse: collapse; font-size: 0.82em;
      margin: 8px 0; width: 100%; }
    .props th, .props td { border: 1px solid
      var(--surface-outline, #8884); padding: 2px 8px;
      text-align: left; }
    .readout { display: flex; gap: 14px; flex-wrap: wrap;
      font-variant-numeric: tabular-nums; margin-bottom: 6px; }
    .verdict { border-radius: 6px; padding: 6px 10px;
      font-size: 0.9em; border: 1px solid; }
    .verdict.good { border-color: #2a2; color: #2a2; }
    .verdict.bad { border-color: #d33; color: #d33; }
    .foot { margin-top: 14px; font-size: 0.9em; }
    .foot a { color: inherit; }
  `],
})
export class ClockMotorComponent implements OnInit, OnDestroy {
  parts: any; winding: any; selected = '';
  sceneError = ''; sceneNote = '';
  @ViewChild('host3d') host3dRef?: ElementRef<HTMLElement>;
  private renderer3d: any = null;
  private sceneObjects: any[] = [];

  /** Scene body id -> the part row that owns it. The scene is
   *  geometry; the parts list is the bill; this is the join, and
   *  it is what makes clicking a part highlight the right solid. */
  private static readonly BODY_OF_PART:
    Record<string, string[]> = {
    'lavet-v2-stator': ['stator'],
    'lavet-v2-rotor-magnet': ['rotor-magnet'],
    'lavet-v2-coil': ['coil'],
    'lavet-v2-pinion': ['rotor-pinion'],
    'lavet-v2-bobbin-flanges': ['bobbin-flange-a', 'bobbin-flange-b'],
    'lavet-v2-leads': ['lead-a', 'lead-b'],
    'lavet-v2-index': ['rotor-index'],
  };

  constructor(private motors: MotorsService,
              private simSpaces: SimSpaceService,
              private rendererFactory: SimSpaceRendererFactory) {}

  async ngOnInit(): Promise<void> {
    this.parts = await this.motors.parts('clock-lavet-m0');
    this.winding = await this.motors.winding('clock-lavet-m0');
    if (this.parts?.ok && this.parts.parts?.length) {
      this.selected = this.parts.parts.find(
        (p: any) => p.function === 'torque-producing')?.part
        ?? this.parts.parts[0].part;
    }
    setTimeout(() => this.init3d(), 0);
  }

  ngOnDestroy(): void {
    try { this.renderer3d?.destroy(); } catch { /* detached */ }
    this.renderer3d = null;
  }

  private async init3d(): Promise<void> {
    const host = this.host3dRef?.nativeElement;
    if (!host) { return; }
    try {
      // Asset libraries are guaranteed loaded by the factory.
      this.renderer3d = await this.rendererFactory.create('3d');
      this.renderer3d.attach(host);
      const snap = await this.simSpaces.snapshot(
        'motor-m0-lavet-v2-viz');
      if (!snap?.objects?.length) {
        this.sceneError = 'scene row "motor-m0-lavet-v2-viz" not '
          + 'found — is the motors module enabled?';
        return;
      }
      this.renderer3d.loadDefinition(snap.definition);
      this.sceneObjects = snap.objects;
      this.sceneNote = 'scene: SimSpaceDefinition row '
        + '"motor-m0-lavet-v2-viz" — select a piece to highlight it';
      this.paint();
    } catch (err: any) {
      this.sceneError = `3D init failed: ${err?.message ?? err}`;
    }
  }

  /** Selected part's bodies keep their material; everything else
   *  dims. Highlighting by OPACITY rather than colour so the
   *  material colours stay readable — the point of the view is
   *  what things are made of. */
  private paint(): void {
    if (!this.renderer3d || !this.sceneObjects.length) { return; }
    const lit = new Set(
      ClockMotorComponent.BODY_OF_PART[this.selected] ?? []);
    this.renderer3d.setObjects(this.sceneObjects.map((o: any) => ({
      ...o,
      trackKey: o.id,
      opacityOverride: lit.size === 0 || lit.has(o.id) ? 1 : 0.15,
    })));
  }

  select(part: string): void {
    this.selected = this.selected === part ? '' : part;
    this.paint();
  }
}
