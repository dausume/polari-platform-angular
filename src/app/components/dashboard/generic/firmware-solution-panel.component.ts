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
 * firmware-solution-panel — fs-1 (DEMONSTRABLES_PLAN.md §9; his "go with your picks" ruling 2026-10-05, D-fs-1/D-fs-2).
 * THE ONE NEW COMPONENT this slice adds (same justification class as c-graph-canvas-panel / firmware-installer-panel):
 * a configured table cannot host a solution picker, the three-part canvas, or the pin-map drag.
 *
 * THREE PARTS, all from ONE GET (`{solutionsPath}/{name}`, fs-0's shape — solution/schedule/assignments/validation):
 *  - LEFT: the task list — one row per ScheduleSlot (name, kind/ports/resources from its RegisterAssignment rows,
 *    cost parsed from the slot's own notes, lane badge).
 *  - MIDDLE: the schedule lanes — init / isr / tick / loop (D-fs-1: DERIVED, never authored — this only GROUPS the
 *    already-derived ScheduleSlot rows by their own `lane`). `called` tasks (dispatched, not scheduled directly) are
 *    nested under their caller: the nearest PRECEDING non-called task by the glue's own emission `order` (the same
 *    field the lanes are built from — no second ordering scheme, no new data).
 *  - RIGHT: the register map — the solution's board's own pinmap.svg (reusing api-svg-panel's inline-and-sanitize
 *    approach), bound pins outlined by their task's lane colour, unbound targets as chips beside it, conflicts named
 *    in red. D-fs-2: dragging an unbound chip onto a pin (or selecting a chip then clicking a pin — the keyboard
 *    fallback) calls `POST {solutionsPath}/{name}/assign` with `{task, port, lives_on}`; a drop that would conflict
 *    with another task's pin (checked CLIENT-SIDE against the current assignments — the assign door itself always
 *    overwrites) is refused, named, never posted.
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

const LANES = ['init', 'isr', 'tick', 'loop'];
const LANE_COLORS: Record<string, string> = { init: '#2e7d32', isr: '#c62828', tick: '#6a1b9a', loop: '#1565c0', called: '#8d6e63' };

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

      <div *ngIf="loading" class="fsp-state"><mat-spinner diameter="28"></mat-spinner></div>
      <div *ngIf="error" class="fsp-state fsp-error">{{ error }}</div>

      <div class="fsp-body" *ngIf="!loading && !error && solution">
        <!-- LEFT: task list -->
        <div class="fsp-col fsp-tasks">
          <h4>Tasks</h4>
          <table>
            <thead><tr><th>Task</th><th>Lane</th><th>Kind</th><th>Ports</th><th>Resources</th><th>Cost</th></tr></thead>
            <tbody>
              <tr *ngFor="let t of taskRows" [class.fsp-selected-row]="selectedChip?.task === t.task">
                <td>{{ t.task }}</td>
                <td><span class="fsp-badge" [style.background]="laneColor(t.lane)">{{ t.lane }}</span></td>
                <td>{{ t.kind }}</td>
                <td>{{ t.ports }}</td>
                <td class="fsp-resources" [title]="t.resources">{{ t.resources }}</td>
                <td>{{ t.cost }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- MIDDLE: schedule lanes -->
        <div class="fsp-col fsp-lanes">
          <h4>Schedule (derived — D-fs-1)</h4>
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
        </div>

        <!-- RIGHT: register map -->
        <div class="fsp-col fsp-regmap">
          <h4>Register map (D-fs-2 — drag a chip onto a pin, or select then click)</h4>
          <div class="fsp-svg-stage" #svgHost (drop)="onDrop($event)" (dragover)="onDragOver($event)" (click)="onPinClick($event)">
            <div class="fsp-svg-host" [innerHTML]="svgHtml"></div>
          </div>
          <div class="fsp-unbound" *ngIf="unboundTargets.length">
            <span class="fsp-unbound-label">Unbound targets:</span>
            <span class="fsp-chip fsp-unbound-chip" *ngFor="let a of unboundTargets"
                  [class.fsp-chip-selected]="selectedChip === a"
                  draggable="true" (dragstart)="onDragStart($event, a)" (click)="selectChip(a, $event)">
              {{ a.task }}{{ a.port ? '.' + a.port : '' }}
            </span>
          </div>
          <div class="fsp-conflicts" *ngIf="conflicts.length">
            <span class="fsp-conflicts-label">Conflicts:</span>
            <div class="fsp-conflict" *ngFor="let c of conflicts">{{ c.notes || (c.task + (c.port ? '.' + c.port : '') + ' conflicts on ' + c.lives_on) }}</div>
          </div>
          <div class="fsp-conflict fsp-drop-conflict" *ngIf="conflictMessage">{{ conflictMessage }}</div>
          <div class="fsp-error" *ngIf="assignError">{{ assignError }}</div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .fsp { display: block; color: var(--text-on-card); }
    .fsp-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 6px 2px; }
    .fsp-pick { display: flex; align-items: center; gap: 6px; font-size: 0.85em; }
    .fsp-validation { font-size: 0.82em; }
    .fsp-validation.fsp-ok { color: var(--success-text, #2e7d32); }
    .fsp-validation.fsp-bad { color: var(--error-text, #b00020); }
    .fsp-link { margin-left: auto; font-size: 0.85em; text-decoration: none; color: var(--link-text, #1565c0); }
    .fsp-link:hover { text-decoration: underline; }
    .fsp-state { padding: 12px 0; color: var(--text-on-card-muted); }
    .fsp-error { color: var(--color-error-text, #b00020); }
    .fsp-body { display: grid; grid-template-columns: 1.4fr 1fr 1.1fr; gap: 14px; align-items: start; }
    .fsp-col h4 { margin: 2px 0 8px; font-size: 0.9em; opacity: 0.85; }
    .fsp-tasks table { width: 100%; border-collapse: collapse; font-size: 0.8em; }
    .fsp-tasks th, .fsp-tasks td { text-align: left; padding: 3px 6px; border-bottom: 1px solid rgba(128,128,128,0.25); }
    .fsp-resources { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .fsp-selected-row { outline: 2px solid #1565c0; }
    .fsp-badge { color: #fff; border-radius: 8px; padding: 1px 7px; font-size: 0.85em; }
    .fsp-lane { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px; }
    .fsp-lane-label { min-width: 48px; font-weight: 600; font-size: 0.82em; border-left: 4px solid; padding-left: 6px; text-transform: uppercase; }
    .fsp-lane-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .fsp-chip { border: 1.5px solid #888; border-radius: 10px; padding: 2px 8px; font-size: 0.8em; display: inline-flex; flex-direction: column; }
    .fsp-chip small { opacity: 0.7; }
    .fsp-called { margin-left: 10px; font-size: 0.92em; opacity: 0.85; }
    .fsp-svg-stage { border: 1px dashed rgba(128,128,128,0.4); min-height: 160px; }
    .fsp-svg-host ::ng-deep svg { max-width: 100%; height: auto; display: block; }
    .fsp-unbound, .fsp-conflicts { margin-top: 8px; font-size: 0.82em; }
    .fsp-unbound-label, .fsp-conflicts-label { font-weight: 600; margin-right: 6px; }
    .fsp-unbound-chip { cursor: grab; }
    .fsp-chip-selected { outline: 2px solid #1565c0; }
    .fsp-conflict { color: var(--error-text, #b00020); }
    .fsp-drop-conflict { margin-top: 6px; font-weight: 600; }
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
  validation: { ok: boolean; why: string } | null = null;

  taskRows: TaskRow[] = [];
  lanes: { lane: string; chips: LaneChip[] }[] = [];
  svgHtml: SafeHtml | null = null;

  selectedChip: RegisterAssignment | null = null;
  private dragging: RegisterAssignment | null = null;
  conflictMessage = '';
  assignError = '';

  loading = false;
  error: string | null = null;

  constructor(private http: HttpClient, private sanitizer: DomSanitizer, private polariService: PolariService) {}

  private get base(): string { return this.polariService.getBackendBaseUrl(); }
  private get headers(): any { return (this.polariService.backendRequestOptions as any)?.headers; }

  ngOnInit(): void { this.loadSolutions(); }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['solutionsPath'] && !changes['solutionsPath'].firstChange) { this.loadSolutions(); }
  }

  laneColor(lane: string): string { return LANE_COLORS[lane] || '#607d8b'; }

  get unboundTargets(): RegisterAssignment[] { return this.assignments.filter(a => a.status === 'unbound'); }
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
    this.selectedChip = null; this.dragging = null; this.conflictMessage = ''; this.assignError = '';
    this.loading = true; this.error = null;
    this.http.get<any>(`${this.base}${this.solutionsPath}/${encodeURIComponent(name)}`, { headers: this.headers }).subscribe({
      next: (r: any) => {
        this.loading = false;
        if (!r || r.ok === false) { this.error = (r && r.error) || `could not load ${name}`; return; }
        this.solution = r.solution; this.schedule = r.schedule || []; this.assignments = r.assignments || [];
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
        setTimeout(() => this.highlight(), 0);
      },
      error: () => { /* the register map degrades to the unbound-chips/conflicts lists only — never blocks the panel */ },
    });
  }

  private laneOf(task: string): string {
    const s = this.schedule.find(x => x.task === task);
    return s ? s.lane : '';
  }

  private highlight(): void {
    const host = this.svgHostRef?.nativeElement;
    if (!host) { return; }
    host.querySelectorAll('[data-pin]').forEach(el => { (el as HTMLElement).style.outline = ''; });
    for (const a of this.assignments) {
      if (a.status !== 'bound') { continue; }
      const pin = a.lives_on.split(':').pop() || '';
      const color = this.laneColor(this.laneOf(a.task));
      const sel = `[data-pin="${pin.replace(/"/g, '')}"]`;
      host.querySelectorAll(sel).forEach(el => { (el as HTMLElement).style.outline = `3px solid ${color}`; });
    }
  }

  selectChip(a: RegisterAssignment, ev?: Event): void {
    ev?.stopPropagation();
    this.conflictMessage = ''; this.assignError = '';
    this.selectedChip = this.selectedChip === a ? null : a;
  }

  onDragStart(ev: DragEvent, a: RegisterAssignment): void {
    this.dragging = a;
    ev.dataTransfer?.setData('text/plain', a.name);
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

  /** Keyboard fallback (D-fs-2): select a chip, then click a pin. */
  onPinClick(ev: MouseEvent): void {
    if (!this.selectedChip) { return; }
    const pinEl = (ev.target as Element)?.closest?.('[data-pin]');
    if (!pinEl) { return; }
    const pin = pinEl.getAttribute('data-pin') || '';
    this.tryAssign(this.selectedChip, pin);
  }

  private tryAssign(a: RegisterAssignment, pin: string): void {
    this.conflictMessage = ''; this.assignError = '';
    const board = this.solution?.board_resolved || '';
    const livesOn = `${board}:${pin}`;
    // the assign door itself always overwrites (fs-0) — a drop that would conflict with ANOTHER task's pin is
    // checked HERE, client-side, against the current assignments, and refused before any POST.
    const conflict = this.assignments.find(x => x.status === 'bound' && x.lives_on === livesOn && x.task !== a.task);
    if (conflict) {
      this.conflictMessage = `${a.task}${a.port ? '.' + a.port : ''} and ${conflict.task}${conflict.port ? '.' + conflict.port : ''} `
        + `would both claim ${pin} — not assigned.`;
      return;
    }
    this.http.post<any>(`${this.base}${this.solutionsPath}/${encodeURIComponent(this.selected)}/assign`,
      { task: a.task, port: a.port, lives_on: livesOn }, { headers: this.headers }).subscribe({
      next: (r: any) => {
        if (!r || r.ok === false) { this.assignError = (r && r.error) || 'assign refused'; return; }
        this.selectedChip = null;
        this.select(this.selected);
      },
      error: (err: any) => { const f = friendlyError(err, 'POST assign'); this.assignError = f.text; },
    });
  }
}
