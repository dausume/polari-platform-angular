import { CommonModule } from '@angular/common';
import { Component, ElementRef, Input, OnChanges, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { PolariService } from '@services/polari-service';
import { friendlyError } from './friendly-error';

/**
 * firmware-solution-panel — fs-1 (DEMONSTRABLES_PLAN.md §9) + fs-2b (his renames/rulings 2026-10-06).
 *
 * fs-2b: "the pins are the TARGETS; the things mapped onto them are tasks" — Unregistered Tasks (need a pin) /
 * Registered Tasks (of a pin). FOUR collapsible sections (his: "the views are too small even on a full computer
 * screen"): Unregistered Tasks, Schedule, Pin map, Target details (new) — a toolbar lets a viewer show All four,
 * maximise One, or pick a Two side-by-side pair; the open set persists per-viewer in localStorage under ONE key
 * (`polari-firmware-panel-layout`).
 *
 * Clicking an Unregistered Task calls `GET .../tasks/{task}/valid-targets` (board.custom.target_compat +
 * cmod.custom.firmware.valid_targets_for_task, fs-2a) and colours every pin on the map: green = valid, grey =
 * invalid (one-line reason on hover), amber = undetermined; a pin already registered to ANOTHER task is marked
 * cooperating (allowed) or conflict (refused) straight from the door's own `registered_to`/`cooperating` fields
 * — never re-derived here. Dropping on an invalid pin never POSTs; a 422 the backend still returns shows its
 * reason inline (his ruling: "a clear indicator of when we click on a target what ones are valid targets").
 *
 * Clicking a pin (a target) calls `GET /api/board/{board}/pins/{pin}` and the Target details section shows its
 * register detail (SoC pin, port+bit → DDR/PORT/PIN names, alternate functions, electrical limits — each cited),
 * its own Registered Tasks, and the globally-cited TargetCompatibilityRule rows (`GET /api/board/target-compat`,
 * fetched once and cached) that apply to this pin's own alternate-function facts.
 */

interface SolutionRow { name: string; title: string; }
interface SolutionDetail {
  name: string; title: string; graph: string; board_resolved: string; board_exists: boolean;
  runtime: string; status: string; validation: string; validation_why: string; task_count: number; purpose: string;
}
interface ScheduleSlot {
  name: string; solution: string; task: string; lane: string; order: number; trigger: string;
  period_ms: number; measured_cycles: number; isr_vector: string; provenance: string; notes: string;
}
interface RegisterAssignment {
  name: string; solution: string; task: string; port: string; target_kind: string; controls: string;
  lives_on: string; status: string; provenance: string; notes: string;
}
interface TaskRow { task: string; lane: string; order: number; kind: string; ports: string; resources: string; cost: string; }
interface LaneChip { task: string; order: number; measured: string; children: LaneChip[]; }
interface RegisteredTaskRow { task: string; port: string; status: string; cooperating: boolean; }
interface PinRegisteredTask { task: string; port: string; solution: string; lane: string; status: string; cooperating: boolean; }

type Verdict = 'valid' | 'invalid' | 'undetermined';
interface ValidTargetPin { pin: string; verdict: Verdict; reason: string; registered_to: string[]; cooperating: boolean; }
interface ValidTargetsResponse { ok: boolean; solution: string; task: string; kind: string; pins: ValidTargetPin[]; refused?: string; }

interface AltFunction { function: string; peripheral: string; signal: string; kind: string; fact: string; }
interface PinDetail {
  ok: boolean; board: string; pin: string; roles: string[]; soc_pin: string;
  register: { port: string; bit: number | null; package_pin: string; default_function: string; fact: string };
  alternate_functions: AltFunction[];
  current_assignment: { function: string; peripheral: string; signal: string; firmware_symbol: string };
  electrical: Record<string, any>;
  net: string; connector: string; connector_number: number | null; facts: any[];
  registered_tasks: PinRegisteredTask[]; unregistered: boolean;
}
interface TargetCompatRow { name: string; kind: string; title: string; roles: string; description: string; matches: string; source_label: string; source_url: string; notes: string; }

type SectionKey = 'tasks' | 'schedule' | 'pins' | 'detail';
const SECTION_ORDER: SectionKey[] = ['tasks', 'schedule', 'pins', 'detail'];
const SECTION_LABELS: Record<SectionKey, string> = {
  tasks: 'Unregistered Tasks', schedule: 'Schedule', pins: 'Pin map', detail: 'Target details',
};
const LAYOUT_KEY = 'polari-firmware-panel-layout';
const PAIR_PRESETS: [SectionKey, SectionKey][] = [
  ['tasks', 'pins'], ['pins', 'detail'], ['tasks', 'detail'], ['schedule', 'pins'],
];

const LANES = ['init', 'isr', 'tick', 'loop'];
const LANE_COLORS: Record<string, string> = { init: '#2e7d32', isr: '#c62828', tick: '#6a1b9a', loop: '#1565c0', called: '#8d6e63' };
const VERDICT_COLORS: Record<Verdict, string> = { valid: '#2e7d32', invalid: '#9e9e9e', undetermined: '#f9a825' };

@Component({
  standalone: true,
  selector: 'firmware-solution-panel',
  imports: [CommonModule, FormsModule, RouterModule, MatProgressSpinnerModule],
  template: `
    <div class="fsp">
      <div class="fsp-bar">
        <label class="fsp-pick">
          <span>Firmware Solution</span>
          <select [ngModel]="selected" (ngModelChange)="select($event)">
            <option *ngFor="let s of solutions" [value]="s.name">{{ s.title || s.name }}</option>
          </select>
        </label>
        <span class="fsp-validation" *ngIf="validation" [class.fsp-ok]="validation.ok" [class.fsp-bad]="!validation.ok">
          {{ validation.ok ? 'validated' : 'refused' }} — {{ validation.why }}
        </span>
        <a class="fsp-link" [routerLink]="'/display/c-canvas'">&larr; C canvas</a>
        <a class="fsp-link" [routerLink]="'/display/hardware-solutions'">&larr; Hardware solutions</a>
      </div>

      <div class="fsp-presets">
        <span class="fsp-presets-label">Layout:</span>
        <button type="button" (click)="showAll()">All four</button>
        <label class="fsp-preset-pick">One
          <select #oneSel (change)="showOne(oneSel.value); oneSel.value = ''">
            <option value="">choose…</option>
            <option *ngFor="let k of sectionKeys" [value]="k">{{ sectionLabel(k) }}</option>
          </select>
        </label>
        <label class="fsp-preset-pick">Two
          <select #twoSel (change)="showTwoAt(twoSel.value); twoSel.value = ''">
            <option value="">choose…</option>
            <option *ngFor="let p of pairPresets; let i = index" [value]="i">{{ sectionLabel(p[0]) }} + {{ sectionLabel(p[1]) }}</option>
          </select>
        </label>
        <span class="fsp-legend">
          <span class="fsp-legend-item"><i class="fsp-dot" style="background:#2e7d32"></i>valid</span>
          <span class="fsp-legend-item"><i class="fsp-dot" style="background:#9e9e9e"></i>invalid</span>
          <span class="fsp-legend-item"><i class="fsp-dot" style="background:#f9a825"></i>undetermined</span>
          <span class="fsp-legend-item"><i class="fsp-dot fsp-dot-ring"></i>selected</span>
        </span>
      </div>

      <div *ngIf="loading" class="fsp-state"><mat-spinner diameter="28"></mat-spinner></div>
      <div *ngIf="error" class="fsp-state fsp-error">{{ error }}</div>

      <div class="fsp-shell" *ngIf="!loading && !error && solution">
        <div class="fsp-collapsed-bar" *ngIf="collapsedKeys.length">
          <button type="button" class="fsp-collapsed-chip" *ngFor="let k of collapsedKeys"
                  (click)="toggleSection(k)" [attr.aria-label]="'expand ' + sectionLabel(k)">
            &#9656; {{ sectionLabel(k) }}
          </button>
        </div>

        <div class="fsp-sections">
          <div class="fsp-section" *ngFor="let k of openKeys" [style.flexBasis.%]="100 / openKeys.length">
            <div class="fsp-section-header">
              <h4>{{ sectionHeading(k) }}</h4>
              <button type="button" class="fsp-collapse-btn" (click)="toggleSection(k)" aria-label="collapse section">&#9662;</button>
            </div>
            <div class="fsp-section-body">

              <ng-container *ngIf="k === 'tasks'">
                <div class="fsp-chipline" *ngIf="unregisteredTasks.length">
                  <span class="fsp-chip fsp-unbound-chip" *ngFor="let a of unregisteredTasks"
                        tabindex="0" role="button"
                        [class.fsp-chip-selected]="selectedTask === a"
                        [attr.aria-label]="'Unregistered task ' + a.task"
                        draggable="true" (dragstart)="onDragStart($event, a)"
                        (click)="selectTask(a)" (keydown.enter)="selectTask(a)" (keydown.escape)="clearSelection()">
                    {{ a.task }}{{ a.port ? '.' + a.port : '' }}
                  </span>
                </div>
                <div class="fsp-state" *ngIf="!unregisteredTasks.length">Every target is registered to a pin.</div>
                <table class="fsp-task-table">
                  <thead><tr><th>Task</th><th>Lane</th><th>Kind</th><th>Ports</th><th>Resources</th><th>Cost</th></tr></thead>
                  <tbody>
                    <tr *ngFor="let t of taskRows" [class.fsp-selected-row]="selectedTask?.task === t.task">
                      <td>{{ t.task }}</td>
                      <td><span class="fsp-badge" [style.background]="laneColor(t.lane)">{{ t.lane }}</span></td>
                      <td>{{ t.kind }}</td>
                      <td>{{ t.ports }}</td>
                      <td class="fsp-resources" [title]="t.resources">{{ t.resources }}</td>
                      <td>{{ t.cost }}</td>
                    </tr>
                  </tbody>
                </table>
              </ng-container>

              <ng-container *ngIf="k === 'schedule'">
                <div class="fsp-lane" *ngFor="let l of lanes">
                  <div class="fsp-lane-label" [style.borderColor]="laneColor(l.lane)">{{ l.lane }}</div>
                  <div class="fsp-lane-chips">
                    <span class="fsp-chip" *ngFor="let c of l.chips" [style.borderColor]="laneColor(l.lane)">
                      {{ c.task }} <small>({{ c.measured }})</small>
                      <span class="fsp-called" *ngFor="let cc of c.children">
                        &#8627; {{ cc.task }} <small>({{ cc.measured }}, called — not scheduled directly)</small>
                      </span>
                    </span>
                  </div>
                </div>
              </ng-container>

              <ng-container *ngIf="k === 'pins'">
                <div class="fsp-svg-stage" #svgHost tabindex="-1"
                     (drop)="onDrop($event)" (dragover)="onDragOver($event)"
                     (click)="onPinClick($event)" (keydown)="onPinKeydown($event)">
                  <div class="fsp-svg-host" [innerHTML]="svgHtml"></div>
                </div>
                <div class="fsp-chipline fsp-chipline-compact" *ngIf="unregisteredTasks.length">
                  <span class="fsp-unbound-label">Unregistered Tasks:</span>
                  <span class="fsp-chip fsp-unbound-chip" *ngFor="let a of unregisteredTasks"
                        tabindex="0" role="button" [class.fsp-chip-selected]="selectedTask === a"
                        draggable="true" (dragstart)="onDragStart($event, a)"
                        (click)="selectTask(a)" (keydown.enter)="selectTask(a)" (keydown.escape)="clearSelection()">
                    {{ a.task }}{{ a.port ? '.' + a.port : '' }}
                  </span>
                </div>
                <div class="fsp-conflicts" *ngIf="conflicts.length">
                  <span class="fsp-conflicts-label">Conflicts:</span>
                  <div class="fsp-conflict" *ngFor="let c of conflicts">{{ c.notes || (c.task + (c.port ? '.' + c.port : '') + ' conflicts on ' + c.lives_on) }}</div>
                </div>
                <div class="fsp-error" *ngIf="assignError">{{ assignError }}</div>
                <div class="fsp-warning" *ngIf="assignWarning">{{ assignWarning }}</div>
              </ng-container>

              <ng-container *ngIf="k === 'detail'">
                <div class="fsp-state" *ngIf="detailMode === 'none'">
                  Click an Unregistered Task to see its valid targets, or click a pin on the map to see its register detail.
                </div>

                <div class="fsp-detail" *ngIf="detailMode === 'task' && selectedTask">
                  <h5>{{ selectedTask.task }}{{ selectedTask.port ? '.' + selectedTask.port : '' }}</h5>
                  <div *ngIf="taskValidity">
                    <p>Requirement kind: <strong>{{ taskValidity.kind }}</strong></p>
                    <p *ngIf="taskValidity.refused" class="fsp-error">{{ taskValidity.refused }}</p>
                    <table class="fsp-detail-table" *ngIf="!taskValidity.refused">
                      <thead><tr><th>Pin</th><th>Verdict</th><th>Reason</th><th>Registered to</th></tr></thead>
                      <tbody>
                        <tr *ngFor="let p of taskValidity.pins" [attr.data-verdict]="p.verdict">
                          <td>{{ p.pin }}</td>
                          <td><i class="fsp-dot" [style.background]="verdictColor(p.verdict)"></i>{{ p.verdict }}</td>
                          <td [title]="p.reason">{{ p.reason }}</td>
                          <td *ngIf="p.registered_to.length">{{ p.registered_to.join(', ') }} ({{ p.cooperating ? 'cooperating' : 'conflict' }})</td>
                          <td *ngIf="!p.registered_to.length">—</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div *ngIf="!taskValidity && taskValidityError" class="fsp-error">{{ taskValidityError }}</div>
                </div>

                <div class="fsp-detail" *ngIf="detailMode === 'pin' && selectedPin">
                  <h5>{{ selectedPin }} <small>({{ solution?.board_resolved }})</small></h5>
                  <div *ngIf="pinDetail">
                    <table class="fsp-kv">
                      <tr><th>SoC pin</th><td>{{ pinDetail.soc_pin || 'undetermined' }}</td></tr>
                      <tr><th>Register</th><td>{{ registerNames(pinDetail) }} — bit {{ pinDetail.register.bit ?? 'undetermined' }} <small>({{ pinDetail.register.fact }})</small></td></tr>
                      <tr><th>Package pin</th><td>{{ pinDetail.register.package_pin }}</td></tr>
                      <tr><th>Current assignment</th><td>{{ pinDetail.current_assignment.function || '—' }} <small *ngIf="pinDetail.current_assignment.firmware_symbol">({{ pinDetail.current_assignment.firmware_symbol }})</small></td></tr>
                      <tr><th>Net / connector</th><td>{{ pinDetail.net || '—' }} / {{ pinDetail.connector || '—' }}{{ pinDetail.connector_number != null ? ' #' + pinDetail.connector_number : '' }}</td></tr>
                    </table>

                    <h6>Alternate functions</h6>
                    <table class="fsp-detail-table" *ngIf="pinDetail.alternate_functions.length">
                      <thead><tr><th>Function</th><th>Peripheral</th><th>Kind</th><th>Citation</th></tr></thead>
                      <tbody>
                        <tr *ngFor="let f of pinDetail.alternate_functions">
                          <td>{{ f.function }}</td><td>{{ f.peripheral }}</td><td>{{ f.kind }}</td><td>{{ f.fact }}</td>
                        </tr>
                      </tbody>
                    </table>
                    <div class="fsp-state" *ngIf="!pinDetail.alternate_functions.length">No alternate-function facts cited for this pin.</div>

                    <h6>Electrical limits</h6>
                    <table class="fsp-kv" *ngIf="electricalLimits(pinDetail).length">
                      <tr *ngFor="let kv of electricalLimits(pinDetail)"><th>{{ kv.key }}</th><td>{{ kv.value }} <small *ngIf="electricalFact(pinDetail)">({{ electricalFact(pinDetail) }})</small></td></tr>
                    </table>

                    <h6>Registered Tasks</h6>
                    <table class="fsp-detail-table" *ngIf="pinDetail.registered_tasks.length">
                      <thead><tr><th>Task</th><th>Port</th><th>Solution</th><th>Lane</th><th>Cooperating</th></tr></thead>
                      <tbody>
                        <tr *ngFor="let r of pinDetail.registered_tasks">
                          <td>{{ r.task }}</td><td>{{ r.port || '—' }}</td><td>{{ r.solution }}</td><td>{{ r.lane || '—' }}</td>
                          <td>{{ r.cooperating ? 'yes' : 'conflict' }}</td>
                        </tr>
                      </tbody>
                    </table>
                    <div class="fsp-state" *ngIf="!pinDetail.registered_tasks.length">No Registered Tasks on this pin.</div>

                    <h6>Compatible task kinds</h6>
                    <table class="fsp-detail-table" *ngIf="compatRowsForSelectedPin.length">
                      <thead><tr><th>Kind</th><th>Title</th><th>Matches</th></tr></thead>
                      <tbody>
                        <tr *ngFor="let c of compatRowsForSelectedPin">
                          <td>{{ c.kind }}</td><td>{{ c.title }}</td><td [title]="c.source_label">{{ c.matches }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div *ngIf="!pinDetail && pinDetailError" class="fsp-error">{{ pinDetailError }}</div>
                </div>
              </ng-container>

            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .fsp { display: block; color: var(--text-on-card); min-height: 720px; }
    .fsp-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 6px 2px; }
    .fsp-pick { display: flex; align-items: center; gap: 6px; font-size: 0.85em; }
    .fsp-validation { font-size: 0.82em; }
    .fsp-validation.fsp-ok { color: var(--success-text, #2e7d32); }
    .fsp-validation.fsp-bad { color: var(--error-text, #b00020); }
    .fsp-link { margin-left: auto; font-size: 0.85em; text-decoration: none; color: var(--link-text, #1565c0); }
    .fsp-link:hover { text-decoration: underline; }
    .fsp-state { padding: 12px 0; color: var(--text-on-card-muted); }
    .fsp-error { color: var(--color-error-text, #b00020); }
    .fsp-warning { color: var(--warning-text, #e65100); }
    .fsp-presets { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 4px 2px 10px; font-size: 0.82em; border-bottom: 1px solid rgba(128,128,128,0.2); margin-bottom: 8px; }
    .fsp-presets-label { font-weight: 600; }
    .fsp-preset-pick { display: flex; align-items: center; gap: 4px; }
    .fsp-legend { margin-left: auto; display: flex; gap: 10px; }
    .fsp-legend-item { display: inline-flex; align-items: center; gap: 4px; }
    .fsp-dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; }
    .fsp-dot-ring { border: 2px solid #1565c0; background: transparent; }
    .fsp-collapsed-bar { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
    .fsp-collapsed-chip { font-size: 0.8em; border: 1px solid rgba(128,128,128,0.4); border-radius: 10px; padding: 3px 9px; background: transparent; cursor: pointer; color: inherit; }
    .fsp-sections { display: flex; flex-wrap: wrap; gap: 14px; align-items: stretch; min-height: 680px; }
    .fsp-section { display: flex; flex-direction: column; min-width: 260px; border: 1px solid rgba(128,128,128,0.25); border-radius: 6px; padding: 8px; }
    .fsp-section-header { display: flex; align-items: center; justify-content: space-between; }
    .fsp-section-header h4 { margin: 2px 0 8px; font-size: 0.9em; opacity: 0.85; }
    .fsp-collapse-btn { background: transparent; border: none; cursor: pointer; font-size: 1em; color: inherit; }
    .fsp-section-body { flex: 1 1 auto; overflow: auto; max-height: 680px; }
    .fsp-chipline { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
    .fsp-chipline-compact { margin-top: 8px; font-size: 0.82em; }
    .fsp-unbound-label { font-weight: 600; margin-right: 6px; }
    .fsp-task-table, .fsp-detail-table, .fsp-kv { width: 100%; border-collapse: collapse; font-size: 0.8em; }
    .fsp-task-table th, .fsp-task-table td, .fsp-detail-table th, .fsp-detail-table td,
    .fsp-kv th, .fsp-kv td { text-align: left; padding: 3px 6px; border-bottom: 1px solid rgba(128,128,128,0.25); }
    .fsp-kv th { white-space: nowrap; opacity: 0.8; width: 1%; }
    .fsp-resources { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .fsp-selected-row { outline: 2px solid #1565c0; }
    .fsp-badge { color: #fff; border-radius: 8px; padding: 1px 7px; font-size: 0.85em; }
    .fsp-lane { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px; }
    .fsp-lane-label { min-width: 48px; font-weight: 600; font-size: 0.82em; border-left: 4px solid; padding-left: 6px; text-transform: uppercase; }
    .fsp-lane-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .fsp-chip { border: 1.5px solid #888; border-radius: 10px; padding: 2px 8px; font-size: 0.8em; display: inline-flex; flex-direction: column; cursor: pointer; }
    .fsp-chip small { opacity: 0.7; }
    .fsp-called { margin-left: 10px; font-size: 0.92em; opacity: 0.85; }
    .fsp-svg-stage { border: 1px dashed rgba(128,128,128,0.4); min-height: 220px; outline: none; }
    .fsp-svg-host ::ng-deep svg { max-width: 100%; height: auto; display: block; }
    .fsp-unbound-chip { cursor: grab; }
    .fsp-chip-selected { outline: 2px solid #1565c0; }
    .fsp-conflicts { margin-top: 8px; font-size: 0.82em; }
    .fsp-conflicts-label { font-weight: 600; margin-right: 6px; }
    .fsp-conflict { color: var(--error-text, #b00020); }
    .fsp-detail h5 { margin: 2px 0 8px; }
    .fsp-detail h6 { margin: 12px 0 4px; font-size: 0.85em; opacity: 0.8; }
  `],
})
export class FirmwareSolutionPanelComponent implements OnInit, OnChanges {
  @Input() solutionsPath = '/api/firmware/solutions';
  @Input() initial = '';

  @ViewChild('svgHost') svgHostRef?: ElementRef<HTMLElement>;

  solutions: SolutionRow[] = [];
  selected = '';
  solution: SolutionDetail | null = null;
  schedule: ScheduleSlot[] = [];
  assignments: RegisterAssignment[] = [];
  unregisteredTasks: RegisterAssignment[] = [];
  registeredTasks: Record<string, RegisteredTaskRow[]> = {};
  validation: { ok: boolean; why: string } | null = null;

  taskRows: TaskRow[] = [];
  lanes: { lane: string; chips: LaneChip[] }[] = [];
  svgHtml: SafeHtml | null = null;

  // fs-2b: section layout (persisted per-viewer under ONE localStorage key)
  sections: Record<SectionKey, boolean> = { tasks: true, schedule: true, pins: true, detail: true };
  readonly sectionKeys = SECTION_ORDER;
  readonly pairPresets = PAIR_PRESETS;

  // fs-2b: selection + the two doors it drives
  selectedTask: RegisterAssignment | null = null;
  taskValidity: ValidTargetsResponse | null = null;
  taskValidityError = '';
  selectedPin = '';
  pinDetail: PinDetail | null = null;
  pinDetailError = '';
  detailMode: 'none' | 'task' | 'pin' = 'none';
  compatRows: TargetCompatRow[] = [];
  private compatLoaded = false;

  private dragging: RegisterAssignment | null = null;
  assignError = '';
  assignWarning = '';

  loading = false;
  error: string | null = null;

  constructor(private http: HttpClient, private sanitizer: DomSanitizer, private polariService: PolariService) {}

  private get base(): string { return this.polariService.getBackendBaseUrl(); }
  private get headers(): any { return (this.polariService.backendRequestOptions as any)?.headers; }

  ngOnInit(): void { this.loadLayout(); this.loadSolutions(); }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['solutionsPath'] && !changes['solutionsPath'].firstChange) { this.loadSolutions(); }
  }

  // ------------------------------------------------------------------ fs-2b: layout (collapse/expand + presets)
  sectionLabel(k: SectionKey): string { return SECTION_LABELS[k]; }

  sectionHeading(k: SectionKey): string {
    if (k === 'tasks') { return `Unregistered Tasks (${this.unregisteredTasks.length})`; }
    return SECTION_LABELS[k];
  }

  get openKeys(): SectionKey[] { return SECTION_ORDER.filter(k => this.sections[k]); }
  get collapsedKeys(): SectionKey[] { return SECTION_ORDER.filter(k => !this.sections[k]); }

  private loadLayout(): void {
    try {
      const raw = localStorage.getItem(LAYOUT_KEY);
      if (!raw) { return; }
      const saved = JSON.parse(raw);
      for (const k of SECTION_ORDER) { if (typeof saved[k] === 'boolean') { this.sections[k] = saved[k]; } }
    } catch { /* renders fine with the default (all four open) */ }
  }

  private persistLayout(): void {
    try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(this.sections)); } catch { /* per-viewer convenience only */ }
  }

  toggleSection(k: SectionKey): void { this.sections[k] = !this.sections[k]; this.persistLayout(); }

  showAll(): void { this.sections = { tasks: true, schedule: true, pins: true, detail: true }; this.persistLayout(); }

  showOne(key: string): void {
    if (!key) { return; }
    const next: Record<SectionKey, boolean> = { tasks: false, schedule: false, pins: false, detail: false };
    next[key as SectionKey] = true;
    this.sections = next;
    this.persistLayout();
  }

  showTwoAt(idx: string): void {
    if (idx === '') { return; }
    const pair = PAIR_PRESETS[Number(idx)];
    if (!pair) { return; }
    this.showTwo(pair[0], pair[1]);
  }

  showTwo(a: SectionKey, b: SectionKey): void {
    const next: Record<SectionKey, boolean> = { tasks: false, schedule: false, pins: false, detail: false };
    next[a] = true; next[b] = true;
    this.sections = next;
    this.persistLayout();
  }

  laneColor(lane: string): string { return LANE_COLORS[lane] || '#607d8b'; }
  verdictColor(v: Verdict): string { return VERDICT_COLORS[v]; }

  get conflicts(): RegisterAssignment[] { return this.assignments.filter(a => a.status === 'conflict'); }

  private loadSolutions(): void {
    this.error = null;
    this.http.get<any>(this.base + this.solutionsPath, { headers: this.headers }).subscribe({
      next: (r: any) => {
        if (!r || r.ok === false) { this.error = (r && r.error) || 'could not list firmware solutions'; return; }
        this.solutions = r.solutions || [];
        const pick = this.initial && this.solutions.some(s => s.name === this.initial) ? this.initial : (this.solutions[0]?.name || '');
        if (pick) { this.select(pick); }
      },
      error: (err: any) => { const f = friendlyError(err, `GET ${this.solutionsPath}`); this.error = f.text; },
    });
  }

  select(name: string): void {
    if (!name) { return; }
    this.selected = name;
    this.clearSelection();
    this.loading = true; this.error = null;
    this.http.get<any>(`${this.base}${this.solutionsPath}/${encodeURIComponent(name)}`, { headers: this.headers }).subscribe({
      next: (r: any) => {
        this.loading = false;
        if (!r || r.ok === false) { this.error = (r && r.error) || `could not load ${name}`; return; }
        this.solution = r.solution; this.schedule = r.schedule || []; this.assignments = r.assignments || [];
        this.unregisteredTasks = r.unregistered_tasks || this.assignments.filter((a: RegisterAssignment) => a.status === 'unbound');
        this.registeredTasks = r.registered_tasks || {};
        this.validation = r.validation || null;
        this.buildTaskRows();
        this.buildLanes();
        this.loadPinmap();
      },
      error: (err: any) => { this.loading = false; const f = friendlyError(err, `GET solution ${name}`); this.error = f.text; },
    });
  }

  private buildTaskRows(): void {
    this.taskRows = this.schedule.map(s => {
      const own = this.assignments.filter(a => a.task === s.task);
      const kind = own[0]?.target_kind || '—';
      const ports = Array.from(new Set(own.map(a => a.port).filter(Boolean))).join(', ') || '—';
      const resources = Array.from(new Set(own.map(a => a.controls).filter(Boolean))).join('; ') || '—';
      const m = (s.notes || '').match(/text_bytes_noinline=(\S+) B, stack_bytes=(\S+)/);
      const cost = m ? `${m[1]} B text / ${m[2]} B stack` : (s.measured_cycles >= 0 ? `${s.measured_cycles} cycles` : '—');
      return { task: s.task, lane: s.lane, order: s.order, kind, ports, resources, cost };
    });
  }

  /** D-fs-1: lanes are DERIVED, never authored — this only groups the already-derived ScheduleSlot rows. `called`
   * tasks (dispatched, not scheduled directly) nest under the nearest PRECEDING non-called task by the glue's own
   * emission `order` — the same field, no new data, no second ordering scheme. */
  private buildLanes(): void {
    const byOrder = [...this.schedule].sort((a, b) => a.order - b.order);
    const callerOf: Record<string, string> = {};
    let lastNonCalled = '';
    for (const s of byOrder) {
      if (s.lane === 'called') { if (lastNonCalled) { callerOf[s.task] = lastNonCalled; } }
      else { lastNonCalled = s.task; }
    }
    const childrenOf: Record<string, LaneChip[]> = {};
    for (const s of this.schedule) {
      if (s.lane !== 'called') { continue; }
      const caller = callerOf[s.task];
      if (!caller) { continue; }
      (childrenOf[caller] = childrenOf[caller] || []).push(this.toChip(s));
    }
    this.lanes = LANES.map(lane => ({
      lane,
      chips: this.schedule.filter(s => s.lane === lane).sort((a, b) => a.order - b.order)
        .map(s => ({ ...this.toChip(s), children: childrenOf[s.task] || [] })),
    }));
  }

  private toChip(s: ScheduleSlot): LaneChip {
    return { task: s.task, order: s.order, measured: s.measured_cycles >= 0 ? `${s.measured_cycles} cycles` : 'not measured', children: [] };
  }

  private loadPinmap(): void {
    this.svgHtml = null;
    const board = this.solution?.board_resolved;
    if (!board) { return; }
    this.http.get(`${this.base}/api/board/${encodeURIComponent(board)}/pinmap.svg`, { responseType: 'text' }).subscribe({
      next: (text: string) => {
        this.svgHtml = this.sanitizer.bypassSecurityTrustHtml(text);
        setTimeout(() => this.applyHighlighting(), 0);
      },
      error: () => { /* the pin map degrades to the chips/conflicts lists only — never blocks the panel */ },
    });
  }

  private laneOf(task: string): string {
    const s = this.schedule.find(x => x.task === task);
    return s ? s.lane : '';
  }

  // ------------------------------------------------------------------ fs-2b: valid-targets overlay + pin highlighting
  private ensureBaseTitle(el: Element): string {
    const title = el.querySelector('title');
    if (!title) { return ''; }
    if (!el.hasAttribute('data-base-title')) { el.setAttribute('data-base-title', title.textContent || ''); }
    return el.getAttribute('data-base-title') || '';
  }

  private applyHighlighting(): void {
    const host = this.svgHostRef?.nativeElement;
    if (!host) { return; }
    host.querySelectorAll('[data-pin]').forEach(el => {
      (el as HTMLElement).style.outline = '';
      (el as HTMLElement).style.filter = '';
      el.removeAttribute('data-verdict');
    });
    if (this.taskValidity && !this.taskValidity.refused) {
      for (const row of this.taskValidity.pins) {
        const color = VERDICT_COLORS[row.verdict];
        const sel = `[data-pin="${row.pin.replace(/"/g, '')}"]`;
        host.querySelectorAll(sel).forEach(el => {
          const e = el as HTMLElement;
          e.style.outline = `3px solid ${color}`;
          e.setAttribute('data-verdict', row.verdict);
          const title = e.querySelector('title');
          if (title) {
            const base = this.ensureBaseTitle(e);
            const coop = row.registered_to.length
              ? ` — registered to ${row.registered_to.join(', ')} (${row.cooperating ? 'cooperating' : 'conflict'})` : '';
            title.textContent = `${base}\n${row.reason}${coop}`;
          }
        });
      }
    } else {
      for (const a of this.assignments) {
        if (a.status !== 'bound') { continue; }
        const pin = a.lives_on.split(':').pop() || '';
        const color = this.laneColor(this.laneOf(a.task));
        host.querySelectorAll(`[data-pin="${pin.replace(/"/g, '')}"]`).forEach(el => { (el as HTMLElement).style.outline = `3px solid ${color}`; });
      }
      this.applyRegisteredTooltips(host);
    }
    if (this.selectedPin) {
      host.querySelectorAll(`[data-pin="${this.selectedPin.replace(/"/g, '')}"]`).forEach(el => {
        (el as HTMLElement).style.filter = 'drop-shadow(0 0 4px #1565c0)';
      });
    }
  }

  /** fs-2b: the pin tooltip lists "Registered Tasks: …" (his naming, verbatim) — only when no valid-targets
   * overlay is active (that overlay sets its own, more specific, per-verdict reason + cooperation tooltip). */
  private applyRegisteredTooltips(host: HTMLElement): void {
    const board = this.solution?.board_resolved || '';
    host.querySelectorAll('[data-pin]').forEach(el => {
      const pin = el.getAttribute('data-pin') || '';
      const regs = this.registeredTasks[`${board}:${pin}`] || [];
      const title = el.querySelector('title');
      if (!title) { return; }
      const base = this.ensureBaseTitle(el);
      const names = regs.length ? regs.map(r => r.task).join(', ') : 'none';
      title.textContent = `${base}\nRegistered Tasks: ${names}`;
    });
  }

  // ------------------------------------------------------------------ fs-2b: selection (task / pin) + Escape/Tab/Enter
  selectTask(a: RegisterAssignment): void {
    this.assignError = ''; this.assignWarning = '';
    this.selectedTask = a; this.taskValidity = null; this.taskValidityError = ''; this.detailMode = 'task';
    const url = `${this.base}${this.solutionsPath}/${encodeURIComponent(this.selected)}/tasks/${encodeURIComponent(a.task)}/valid-targets`;
    this.http.get<ValidTargetsResponse>(url, { headers: this.headers }).subscribe({
      next: (r: any) => {
        if (!r || r.ok === false) { this.taskValidityError = (r && r.error) || 'could not check valid targets'; return; }
        this.taskValidity = r;
        this.applyHighlighting();
      },
      error: (err: any) => { const f = friendlyError(err, 'GET valid-targets'); this.taskValidityError = f.text; },
    });
  }

  selectPin(pin: string): void {
    this.assignError = ''; this.assignWarning = '';
    this.selectedPin = pin; this.pinDetail = null; this.pinDetailError = ''; this.detailMode = 'pin';
    const board = this.solution?.board_resolved || '';
    this.loadCompatRowsOnce();
    this.http.get<PinDetail>(`${this.base}/api/board/${encodeURIComponent(board)}/pins/${encodeURIComponent(pin)}`, { headers: this.headers }).subscribe({
      next: (r: any) => {
        if (!r || r.ok === false) { this.pinDetailError = (r && r.error) || `could not load pin ${pin}`; return; }
        this.pinDetail = r;
        this.applyHighlighting();
      },
      error: (err: any) => { const f = friendlyError(err, 'GET pin detail'); this.pinDetailError = f.text; },
    });
  }

  clearSelection(): void {
    this.selectedTask = null; this.taskValidity = null; this.taskValidityError = '';
    this.selectedPin = ''; this.pinDetail = null; this.pinDetailError = '';
    this.detailMode = 'none';
    this.assignError = ''; this.assignWarning = '';
    this.applyHighlighting();
  }

  private loadCompatRowsOnce(): void {
    if (this.compatLoaded) { return; }
    this.http.get<any>(`${this.base}/api/board/target-compat`, { headers: this.headers }).subscribe({
      next: (r: any) => { this.compatRows = (r && r.rows) || []; this.compatLoaded = true; },
      error: () => { /* the Target details section degrades to register detail + Registered Tasks only */ },
    });
  }

  registerNames(d: PinDetail): string {
    const p = d.register.port;
    if (!p || p === 'undetermined') { return 'undetermined'; }
    return `DDR${p} / PORT${p} / PIN${p}`;
  }

  electricalLimits(d: PinDetail): { key: string; value: any }[] {
    return Object.keys(d.electrical || {}).filter(k => k !== 'fact').map(k => ({ key: k, value: d.electrical[k] }));
  }

  electricalFact(d: PinDetail): string { return (d.electrical || {})['fact'] || ''; }

  /** fs-2b: the globally-cited TargetCompatibilityRule rows that apply to THIS pin's own alternate-function
   * facts — a display FILTER of the door's own cited rows, never a re-derivation of compatible()'s verdicts. */
  get compatRowsForSelectedPin(): TargetCompatRow[] {
    if (!this.pinDetail || !this.compatRows.length) { return []; }
    const d = this.pinDetail;
    const kinds = new Set<string>(['digital-in', 'digital-out']);
    if (d.roles.includes('power')) { kinds.add('power'); }
    if (d.roles.includes('ground')) { kinds.add('ground'); }
    const SIGNAL_KIND: Record<string, string> = {
      RXD: 'uart-rx', TXD: 'uart-tx', SDA: 'i2c-sda', SCL: 'i2c-scl',
      MOSI: 'spi-mosi', MISO: 'spi-miso', SCK: 'spi-sck', SS: 'spi-ss',
    };
    for (const f of d.alternate_functions) {
      if (f.kind === 'ADC channel') { kinds.add('analog-in'); }
      if (f.kind === 'timer channel') { kinds.add('pwm-out'); }
      if (f.kind === 'external interrupt' || f.kind === 'pin-change interrupt') { kinds.add('interrupt-in'); }
      if (SIGNAL_KIND[f.signal]) { kinds.add(SIGNAL_KIND[f.signal]); }
    }
    return this.compatRows.filter(r => kinds.has(r.kind));
  }

  // ------------------------------------------------------------------ drag / click / keyboard
  onDragStart(ev: DragEvent, a: RegisterAssignment): void {
    this.dragging = a;
    ev.dataTransfer?.setData('text/plain', a.name);
    this.selectTask(a); // fs-2b: valid-targets must be checked via the door BEFORE a drop is allowed
  }

  onDragOver(ev: DragEvent): void { ev.preventDefault(); }

  onDrop(ev: DragEvent): void {
    ev.preventDefault();
    const target = this.dragging;
    this.dragging = null;
    if (!target) { return; }
    const pinEl = (ev.target as Element)?.closest?.('[data-pin]');
    if (!pinEl) { return; }
    const pin = pinEl.getAttribute('data-pin') || '';
    this.tryAssign(target, pin);
  }

  /** Click a pin: with a task selected (chip clicked / dragged first), the keyboard/click fallback assigns it;
   * otherwise (his ruling, fs-2b item 4) it opens the pin's own Target details. */
  onPinClick(ev: MouseEvent): void {
    const pinEl = (ev.target as Element)?.closest?.('[data-pin]');
    if (!pinEl) { return; }
    const pin = pinEl.getAttribute('data-pin') || '';
    if (this.selectedTask) { this.tryAssign(this.selectedTask, pin); return; }
    this.selectPin(pin);
  }

  onPinKeydown(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') { this.clearSelection(); return; }
    if (ev.key !== 'Enter') { return; }
    const active = document.activeElement;
    const pinEl = active?.closest?.('[data-pin]');
    if (!pinEl) { return; }
    const pin = pinEl.getAttribute('data-pin') || '';
    if (this.selectedTask) { this.tryAssign(this.selectedTask, pin); return; }
    this.selectPin(pin);
  }

  /** fs-2b (his ruling 2026-10-06): the conflict guard is the backend's own cooperation rule, read from the
   * valid-targets door's verdict — never re-implemented here. 'invalid' refuses locally, named, no POST; a 422
   * the backend still returns (e.g. the door's answer went stale) shows ITS reason the same way. */
  private tryAssign(a: RegisterAssignment, pin: string): void {
    this.assignError = ''; this.assignWarning = '';
    const board = this.solution?.board_resolved || '';
    const livesOn = `${board}:${pin}`;
    const row = this.taskValidity?.task === a.task ? this.taskValidity?.pins.find(p => p.pin === pin) : undefined;
    if (row && row.verdict === 'invalid') {
      this.assignError = row.reason;
      return;
    }
    this.http.post<any>(`${this.base}${this.solutionsPath}/${encodeURIComponent(this.selected)}/assign`,
      { task: a.task, port: a.port, lives_on: livesOn }, { headers: this.headers }).subscribe({
      next: (r: any) => {
        if (!r || r.ok === false) { this.assignError = (r && (r.error || r.refused)) || 'assign refused'; return; }
        if (r.warning) { this.assignWarning = r.warning; }
        this.clearSelection();
        this.select(this.selected);
      },
      error: (err: any) => { const f = friendlyError(err, 'POST assign'); this.assignError = f.text; },
    });
  }
}
