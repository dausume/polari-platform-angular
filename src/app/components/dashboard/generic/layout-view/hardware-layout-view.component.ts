import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, HostListener, Input, NgZone, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild, ViewEncapsulation, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { DisplayEventsService } from '@services/no-code-services/display-events.service';
import { friendlyError } from '../friendly-error';
import { LayoutCanvas, LvDrawState } from './layout-draw';
import { BoardFrame, headerIndex, headerPins, layoutBoards } from './layout-geometry';
import { Gesture, HoleInfo, PinState, holeInfo, injectBody, outputLook, partRow, pinLabelFromParam, stepFromParam, stepView } from './layout-interact';
import { SpriteState } from './layout-sprites';
import { LayoutViewService, LvStream } from './layout-view.service';
import { LvInteraction, LvMode, LvPayload, LvPlacement, LvSelection, LvSession, LvStep, LvTwinEvent, LvWire } from './layout-view.types';

/**
 * hardware-layout-view - THE N-board layout renderer (PROTOTYPING_VIEWS_PLAN section 3, slice lay-2; D-ptv-1: the second sanctioned d3 component after the pin view, and the only one a
 * layout needs). One component, two modes:
 *   build   the build laid out on its boards, with step mode (previous / next, the step's text, the new element highlighted, the rest dimmed, "Whole build"; the step lives in ?step=)
 *   bench   (slice sim-3) the same picture bound to a TwinSession: overlays for the parts a person would touch (derived on the SERVER from each KitPart's interface kind - this file has no
 *           per-part code), outputs that follow the watched pins, and every action recorded by the server as a BenchInteraction row
 *
 * Inputs (set by the page item, `_layout_view` in polariApiServer.module_pages_seed):
 *   dataPath   the layout door; `{config}` is filled from the page's ?config= (else `config`)       stepsPath  the steps door (build mode)
 *   mode       build | bench          board / scheme   the bench board and wire-colour scheme (page scope)           session  the TwinSession name (page scope; ?session= also works)
 *   component / net   a part / net another view selected (page scope): this view selects it too
 * Page scope it SETS: config, board, scheme (what it shows, so the tables beside it follow), component and net (its selection; cleared with it), rev (a counter bumped after an action and
 * after a watched pin changes, so the tables that carry rev=r{scope:rev} fetch again). Boundaries: it reads names and posts only to the session's inject door; it never navigates away.
 */
@Component({
  standalone: true,
  selector: 'hardware-layout-view',
  imports: [CommonModule],
  templateUrl: './hardware-layout-view.component.html',
  styleUrls: ['./hardware-layout-view.component.css'],
  encapsulation: ViewEncapsulation.None,
})
export class HardwareLayoutViewComponent implements OnInit, OnChanges, OnDestroy {
  @Input() dataPath = '/api/layout/{config}';
  @Input() stepsPath = '/api/layout/steps';
  @Input() mode: LvMode = 'build';
  @Input() config = 'uno-light';
  @Input() board = '';
  @Input() scheme = '';
  @Input() session = '';
  @Input() component = '';
  @Input() net = '';

  payload: LvPayload | null = null;
  steps: LvStep[] = [];
  stepIndex: number | null = null;                 // null = the whole build
  loading = false;
  error = '';
  errorDetail = '';
  selection: LvSelection = null;
  hole: HoleInfo | null = null;
  // ---- bench
  sessionRow: LvSession | null = null;
  ready = false;                                   // the event stream said hello: only now may anything be injected
  benchNote = '';
  pins = new Map<string, PinState>();
  pressed = new Set<string>();
  sliderValue: Record<string, number> = {};
  toggled: Record<string, boolean> = {};
  actions: string[] = [];
  fireWatch: string[] = [];

  @ViewChild('svg', { static: true }) svgRef!: ElementRef<SVGSVGElement>;
  private canvas?: LayoutCanvas;
  private frames: BoardFrame[] = [];
  private sub?: Subscription;
  private sessionSub?: Subscription;
  private stream?: LvStream;
  private toneTimer?: ReturnType<typeof setInterval>;
  private revTimers: ReturnType<typeof setTimeout>[] = [];
  private redrawPending = false;
  private queryConfig = '';
  private route = inject(ActivatedRoute, { optional: true });
  private router = inject(Router, { optional: true });
  private events = inject(DisplayEventsService, { optional: true });
  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);
  private pendingPin = '';
  private pendingPart = '';

  constructor(private svc: LayoutViewService) {}

  // ---------------------------------------------------------------------------------------------------------------- lifecycle
  ngOnInit(): void {
    const q = this.route?.snapshot?.queryParamMap;
    this.queryConfig = q?.get('config') || '';
    if (q) {
      this.board = q.get('board') || this.board;
      this.scheme = q.get('scheme') || this.scheme;
      this.session = this.session || q.get('session') || '';
      this.pendingPin = pinLabelFromParam(q.get('pin'));
      this.pendingPart = q.get('component') || '';
      this.stepFromQuery = q.get('step');
    }
    this.canvas = new LayoutCanvas(this.svgRef.nativeElement, {
      hole: (b, t) => this.toggle({ kind: 'hole', id: t, board: b }),
      part: n => this.toggle({ kind: 'part', id: n }),
      wire: n => this.toggle({ kind: 'wire', id: n }),
      pin: (b, l) => this.toggle({ kind: 'pin', id: l, board: b }),
      background: () => this.clear(),
      hold: (n, down) => this.hold(n, down),
    });
    this.toneTimer = setInterval(() => { if (this.mode === 'bench' && this.hasTone()) { this.redraw(); } }, 250);
    this.load();
  }

  private stepFromQuery: string | null = null;

  ngOnChanges(ch: SimpleChanges): void {
    if (!this.canvas) { return; }
    if (['board', 'scheme'].some(k => ch[k] && !ch[k].firstChange)) { this.load(); }
    if (ch['session'] && !ch['session'].firstChange && this.mode === 'bench') { this.startBench(); }
    if (ch['component'] && !ch['component'].firstChange && this.component && this.payload && this.component !== (this.selection?.kind === 'part' ? this.selection.id : '')) {
      if (this.payload.placements.some(p => p.name === this.component)) { this.selection = { kind: 'part', id: this.component }; this.redraw(); }
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe(); this.sessionSub?.unsubscribe(); this.stream?.close();
    if (this.toneTimer) { clearInterval(this.toneTimer); }
    this.revTimers.forEach(clearTimeout);
    this.canvas?.destroy();
  }

  // ---------------------------------------------------------------------------------------------------------------- data
  get effectiveConfig(): string { return this.queryConfig || this.config || 'uno-light'; }

  load(): void {
    this.sub?.unsubscribe();
    this.loading = true; this.error = ''; this.errorDetail = '';
    const q = { board: this.board, scheme: this.scheme };
    const steps$ = this.mode === 'build' ? this.svc.steps(this.stepsPath, this.effectiveConfig, q).pipe(catchError(() => of(null))) : of(null);
    this.sub = forkJoin([this.svc.layout(this.dataPath, this.effectiveConfig, q), steps$]).subscribe({
      next: ([p, s]) => {
        this.loading = false;
        if (!p || p.ok === false) { this.error = (p && p.error) || 'The layout came back empty.'; return; }
        this.payload = p;
        this.steps = (s && s.steps) || [];
        this.stepIndex = this.stepFromQuery !== null ? stepFromParam(this.stepFromQuery, this.steps.length) : this.stepIndex;
        this.stepFromQuery = null;
        this.frames = layoutBoards(p.scene?.boards?.length ? p.scene.boards : []);
        this.canvas!.setData(p, this.frames);
        this.applyPending();
        this.announce(p);
        this.redraw();
        if (this.mode === 'bench') { this.startBench(); }
      },
      error: e => { this.loading = false; const f = friendlyError(e, 'the layout'); this.error = f.text; this.errorDetail = f.detail; },
    });
  }

  /** Tell the page what this view shows, so the tables beside it (steps, verdict) read the same config / board / scheme. */
  private announce(p: LvPayload): void {
    this.setScope('config', p.config); this.setScope('board', p.board.name); this.setScope('scheme', p.scheme);
  }

  private setScope(key: string, value: string): void {
    this.events?.dispatch({ name: 'setScope', payload: { key, value }, sourceState: '', channel: 'frontend' });
  }

  private applyPending(): void {
    if (this.pendingPin && this.hasHeaderPin(this.pendingPin)) { this.selection = { kind: 'pin', id: this.pendingPin, board: this.headerBoard() }; }
    else if (this.pendingPart && this.payload?.placements.some(p => p.name === this.pendingPart)) { this.selection = { kind: 'part', id: this.pendingPart }; }
    this.pendingPin = ''; this.pendingPart = '';
  }
  private headerBoard(): string { return this.frames.find(f => f.board.kind === 'devboard')?.board.name || ''; }
  private hasHeaderPin(label: string): boolean {
    const f = this.frames.find(x => x.board.kind === 'devboard');
    return !!f && headerIndex(headerPins(f.board)).has(label);
  }

  // ---------------------------------------------------------------------------------------------------------------- selection (click again, or Escape, clears)
  toggle(sel: NonNullable<LvSelection>): void {
    const same = this.selection && this.selection.kind === sel.kind && this.selection.id === sel.id && (this.selection.board || '') === (sel.board || '');
    this.selection = same ? null : sel;
    this.redraw(); this.announceSelection();
  }
  clear(): void {
    if (!this.selection) { return; }
    this.selection = null; this.redraw(); this.announceSelection();
  }
  @HostListener('document:keydown.escape') onEscape(): void { this.clear(); }

  private announceSelection(): void {
    const s = this.selection;
    const comp = s?.kind === 'part' ? s.id : '';
    const net = this.selNet();
    this.setScope('component', comp); this.setScope('net', net);
  }

  /** The net the selection is on ('' when none): a hole's strip net, a part's first leg's net, a wire's net, a header pin's net from the wires that start there. */
  private selNet(): string {
    const p = this.payload, s = this.selection;
    if (!p || !s) { return ''; }
    if (s.kind === 'hole') { return s.board ? holeInfo(p, s.board, s.id).net : ''; }
    if (s.kind === 'wire') { return p.wires.find(w => w.name === s.id)?.net || ''; }
    if (s.kind === 'part') { return p.placements.find(x => x.name === s.id)?.legs[0]?.net || ''; }
    if (s.kind === 'pin') { return p.wires.find(w => (w.from.tie === s.id && w.from.board === s.board) || (w.to.tie === s.id && w.to.board === s.board))?.net || ''; }
    return '';
  }

  // ---------------------------------------------------------------------------------------------------------------- steps
  get stepCount(): number { return this.steps.length; }
  get inStepMode(): boolean { return this.mode === 'build' && this.stepIndex !== null; }
  get step(): LvStep | null { return this.stepIndex !== null ? this.steps[this.stepIndex] || null : null; }
  get stepLabel(): string { return this.stepIndex === null ? `Whole build (${this.stepCount} steps)` : `Step ${this.stepIndex + 1} of ${this.stepCount}`; }
  next(): void { this.goStep(this.stepIndex === null ? 0 : Math.min(this.stepIndex + 1, this.stepCount - 1)); }
  prev(): void { this.goStep(this.stepIndex === null ? this.stepCount - 1 : Math.max(this.stepIndex - 1, 0)); }
  toggleWhole(): void { this.goStep(this.stepIndex === null ? 0 : null); }
  private goStep(k: number | null): void {
    if (!this.stepCount) { return; }
    this.stepIndex = k;
    void this.router?.navigate([], { relativeTo: this.route, queryParams: { step: k === null ? null : k + 1 }, queryParamsHandling: 'merge', replaceUrl: true });
    this.redraw();
  }

  // ---------------------------------------------------------------------------------------------------------------- bench: the session, the stream, the overlays
  private startBench(): void {
    this.stream?.close(); this.sessionSub?.unsubscribe();
    this.ready = false; this.pins = new Map(); this.sessionRow = null; this.actions = [];
    if (!this.session) { this.benchNote = 'No session is picked. Start one from the list below the picture, or click a running session to bind this picture to it.'; this.redraw(); return; }
    this.benchNote = `Connecting to session ${this.session}...`;
    this.sessionSub = this.svc.session(this.session).subscribe({
      next: row => {
        this.sessionRow = row;
        if (!row) { this.benchNote = `Session ${this.session} is not listed on this server (it may have ended and been cleared).`; this.redraw(); return; }
        if (!row.running_now) { this.benchNote = `Session ${row.name} has ended${row.end_reason ? ' (' + row.end_reason + ')' : ''}. Start a new one.`; this.redraw(); return; }
        this.openStream(row.name);
      },
      error: e => { this.benchNote = friendlyError(e, 'the session').text; this.redraw(); },
    });
  }

  /** Subscribe FIRST (the stream only fans out live events), and only when the backend says hello are the watch list set and the controls enabled. */
  private openStream(name: string): void {
    this.stream = this.svc.events(name, 100, ev => this.zone.run(() => this.onEvent(ev)), why => this.zone.run(() => this.onEnd(why)));
  }

  private onEvent(ev: LvTwinEvent): void {
    if (ev.t === 'hello') {
      this.ready = true; this.benchNote = '';
      const want = [...new Set([...(this.sessionRow?.watch || []), ...(this.payload?.scene.watch || [])])];
      this.fireWatch = want;
      this.svc.inject(this.session, { watch: want }).subscribe({ error: e => { this.benchNote = friendlyError(e, 'setting the pins to watch').text; this.cdr.markForCheck(); } });
    } else if (ev.t === 'pin' && ev.pin) {
      const st = this.pins.get(ev.pin) || { level: null, edges: [], lastWallMs: 0 };
      st.level = ev.level ?? null;
      st.edges = [...st.edges, { level: ev.level ?? 0, cycle: ev.cycle ?? 0 }].slice(-64);
      st.lastWallMs = Date.now();
      this.pins.set(ev.pin, st);
      if (this.isOutputPin(ev.pin)) { this.bumpRev(); }
    } else if (ev.t === 'closed') { this.onEnd(ev.why || 'the session closed'); return; }
    this.redraw();
  }

  private onEnd(why: string): void {
    this.ready = false; this.benchNote = `The live link to the session stopped: ${why}.`;
    this.redraw();
  }

  private isOutputPin(twinPin: string): boolean { return !!this.payload && Object.values(this.payload.scene.parts).some(p => p.output?.twin_pin === twinPin); }

  /** Tables that carry rev=r{scope:rev} fetch again; twice, because a bridge reports the new state a moment after the pin changes. */
  private bumpRev(): void {
    this.revTimers.forEach(clearTimeout);
    this.revTimers = [400, 1500].map(ms => setTimeout(() => this.setScope('rev', String(Date.now())), ms));
  }

  get touchables(): { part: string; inter: LvInteraction }[] {
    const parts = this.payload?.scene.parts || {};
    return Object.keys(parts).filter(n => parts[n].interaction).map(n => ({ part: n, inter: parts[n].interaction as LvInteraction }));
  }
  get outputs(): { part: string; kind: string; pin: string; look: ReturnType<typeof outputLook> }[] {
    const parts = this.payload?.scene.parts || {};
    return Object.keys(parts).filter(n => parts[n].output).map(n => {
      const o = parts[n].output!;
      return { part: n, kind: o.kind, pin: o.pin, look: outputLook(o.kind, this.pins.get(o.twin_pin), Date.now()) };
    });
  }
  private hasTone(): boolean { return this.outputs.some(o => o.kind === 'tone' && o.look.tone); }
  get canTouch(): boolean { return this.mode === 'bench' && this.ready; }

  hold(part: string, down: boolean): void {
    const inter = this.payload?.scene.parts[part]?.interaction;
    if (!inter || !this.canTouch || this.pressed.has(part) === down) { return; }
    down ? this.pressed.add(part) : this.pressed.delete(part);
    this.send(part, inter, down ? 'down' : 'up');
    this.redraw();
  }
  setToggle(part: string, on: boolean): void {
    const inter = this.payload?.scene.parts[part]?.interaction;
    if (!inter || !this.canTouch) { return; }
    this.toggled[part] = on;
    this.send(part, inter, on ? 'on' : 'off');
  }
  /** A slider commits on release (`change`): one acknowledged action per setting, not one per pixel of the drag. */
  commitSlider(part: string, value: number): void {
    const inter = this.payload?.scene.parts[part]?.interaction;
    if (!inter || !this.canTouch) { return; }
    this.sliderValue[part] = value;
    this.send(part, inter, { value });
    this.redraw();
  }
  showSlider(part: string, value: number): void { this.sliderValue[part] = value; this.redraw(); }
  sliderNow(part: string, inter: LvInteraction): number { return this.sliderValue[part] ?? inter.initial ?? inter.min ?? 0; }
  reset(): void { if (this.canTouch) { this.sendBody({ reset: 1, what: 'the board was reset', kind: 'reset' }, 'reset'); } }

  private send(part: string, inter: LvInteraction, g: Gesture): void {
    const body = injectBody(part, inter, g, this.payload?.scene.adc_max_mv);
    if (!body) { this.benchNote = inter.note || `${part} has no pin to drive.`; return; }
    this.sendBody(body, `${part}: ${g === 'down' ? 'pressed' : g === 'up' ? 'released' : g === 'on' ? 'on' : g === 'off' ? 'off' : (typeof g === 'object' ? 'set to ' + g.value + (inter.unit ? ' ' + inter.unit : '') : '')}`);
  }

  private sendBody(body: Record<string, unknown>, label: string): void {
    this.svc.inject(this.session, body).subscribe({
      next: r => {
        const cyc = r.reply && typeof r.reply.cycle === 'number' ? ` at twin cycle ${r.reply.cycle}` : '';
        this.actions = [r.ok ? `${label}${cyc}` : `${label} - refused: ${r.reply?.why || r.error || 'no reason given'}`, ...this.actions].slice(0, 6);
        this.bumpRev(); this.cdr.markForCheck();
      },
      error: e => { this.actions = [`${label} - not sent: ${friendlyError(e, 'the session').text}`, ...this.actions].slice(0, 6); this.cdr.markForCheck(); },
    });
  }

  // ---------------------------------------------------------------------------------------------------------------- drawing
  /** Coalesced: many events in one frame draw once. */
  redraw(): void {
    if (this.redrawPending) { return; }
    this.redrawPending = true;
    queueMicrotask(() => { this.redrawPending = false; this.drawNow(); });
  }

  /** Synchronous redraw (the specs and the first paint use it). */
  drawNow(): void {
    const p = this.payload;
    if (!p || !this.canvas) { this.cdr.markForCheck(); return; }
    const sv = stepView(p, this.steps, this.mode === 'build' ? this.stepIndex : null);
    this.hole = this.selection?.kind === 'hole' && this.selection.board ? holeInfo(p, this.selection.board, this.selection.id) : null;
    const looks = new Map<string, SpriteState>();
    const touchable = new Set<string>();
    for (const pl of p.placements as LvPlacement[]) {
      const sc = p.scene.parts[pl.name];
      const st: SpriteState = {};
      if (sc?.output && this.mode === 'bench') {
        const lk = outputLook(sc.output.kind, this.pins.get(sc.output.twin_pin), Date.now());
        st.lit = lk.lit; st.dim = lk.opacity; st.tone = lk.tone;
      }
      if (this.pressed.has(pl.name)) { st.pressed = true; }
      if (sc?.interaction?.control === 'slider') { st.turn = ((this.sliderNow(pl.name, sc.interaction) - (sc.interaction.min ?? 0)) / Math.max(1, (sc.interaction.max ?? 100) - (sc.interaction.min ?? 0))) * 100; }
      if (sc?.interaction?.control === 'press' && this.canTouch && sc.interaction.twin_pin) { touchable.add(pl.name); }
      looks.set(pl.name, st);
    }
    const state: LvDrawState = {
      selection: this.selection, shownParts: sv.shownParts, shownWires: sv.shownWires, newParts: sv.newParts, newWires: sv.newWires, whole: sv.whole, looks, touchable,
      selStrip: this.hole?.strip || '', selNet: this.selNet(),
    };
    this.canvas.apply(state);
    this.cdr.markForCheck();
  }

  fit(): void { this.canvas?.fit(); }
  zoomIn(): void { this.canvas?.zoomBy(1.4); }
  zoomOut(): void { this.canvas?.zoomBy(1 / 1.4); }
  counts(): ReturnType<LayoutCanvas['counts']> | null { return this.canvas?.counts() || null; }

  // ---------------------------------------------------------------------------------------------------------------- template helpers
  get selPart(): LvPlacement | null { return this.selection?.kind === 'part' ? this.payload?.placements.find(p => p.name === this.selection!.id) || null : null; }
  get selWire(): LvWire | null { return this.selection?.kind === 'wire' ? this.payload?.wires.find(w => w.name === this.selection!.id) || null : null; }
  get selPartRow(): ReturnType<typeof partRow> | null { return this.selPart ? partRow(this.selPart) : null; }
  get selPinWires(): LvWire[] { const s = this.selection; return s?.kind === 'pin' && this.payload ? this.payload.wires.filter(w => (w.from.tie === s.id && w.from.board === s.board) || (w.to.tie === s.id && w.to.board === s.board)) : []; }
  get selPinNet(): string { return this.selPinWires[0]?.net || ''; }
  get headerNote(): string { return this.frames.some(f => f.board.kind === 'devboard') ? 'Header pin positions are drawn in schematic proportions; the 2.54 mm pitch of every pin and hole is exact.' : ''; }
  get sessionFacts(): string {
    const s = this.sessionRow;
    return s ? `${s.name}: firmware ${s.config}, fingerprint ${s.hex_sha256.slice(0, 12)} (locked), ${Math.round(s.remaining_s)} s left` : '';
  }
  trackName = (_: number, x: { part: string }) => x.part;
}
