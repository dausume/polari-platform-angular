import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild, ViewEncapsulation, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription, catchError, combineLatest, of } from 'rxjs';

import { friendlyError } from '../friendly-error';
import { PinViewCanvas } from './pin-view-draw';
import {
  DRIVE_GLYPHS, DRIVE_WORDS_SHORT, FILL_WORDS, GLYPHS, RAIL_WORDS, ROLE_WORDS, SIGNAL_SYMBOL_WORDS, PvDriveSymbol, PvModeFilters, PvRole, driveToken, driveFilterOn,
} from './pin-view-encode';
import { Scene, buildScene } from './pin-view-layout';
import { ConnPanel, Panel, PinPanel, PvIndex, SurfacePanel, buildPanel } from './pin-view-panel';
import { PinViewService } from './pin-view.service';
import { LANE_WORDS, StructLane, StructRow, UPDATER_WORDS, buildStructLane, fieldPins, socPinName, structRows } from './pin-view-struct';
import {
  PvBenchBridge, PvBlank, PvBridgeHop, PvCandidate, PvConfigEvent, PvFamily, PvMode, PvPayload, PvPhase, PvSelection, PvSolveRun, PvStage, PvStructBinding,
} from './pin-view.types';

/**
 * hardware-pin-view — the pin view (PIN_VIEW_PLAN.md, pv-1): THE ONE sanctioned new custom component for pins
 * (his explicit exception to "every panel is a configured Table/Graph definition", 2026-10-17). A dedicated d3
 * picture of a board, its chips and its parts as nested, math-defined shapes with their pins on the edges.
 *
 * Interaction (the click ladder, plan 2.7): click any surface -> its pin-to-pin connections are drawn (nothing is
 * wired by default) and the side panel lists its pins grouped by connection kind; click a pin -> its connections
 * are drawn; click a connection -> three SEPARATE sections: Drive (electricity: abstracted, no numbers),
 * Signal (outputs / inputs + protocol) and Use (tasks, Purposes, stage). A second click on anything deselects;
 * Escape clears.
 *
 * Boundaries: it sends names only in GETs, never writes to the backend, never touches the user's global
 * selection, never navigates (the register-profile link is an ordinary link the person follows).
 * The side panels are plain lists and tables of named fields — no JSON is ever shown.
 */
const STAGES: { id: PvStage; label: string }[] = [
  { id: 'base', label: 'Base composition (before any init)' },
  { id: 'after-init', label: 'After init' },
  { id: 'tasks-assigned', label: 'Tasks assigned' },
  { id: 'firmware-committed', label: 'Firmware committed' },
  { id: 'candidate', label: 'Candidate (from a solution search)' },
];
/** The protocol chips (multi-select): the eight the person asked for; the ids are the door's family names. */
const PROTOCOL_CHIPS: { id: string; label: string }[] = [
  { id: 'i2c', label: 'I²C' }, { id: 'spi', label: 'SPI' }, { id: 'uart', label: 'UART' }, { id: 'usb', label: 'USB' },
  { id: 'interrupt', label: 'Interrupt' }, { id: 'pwm-timer', label: 'PWM / timer' }, { id: 'analog', label: 'Analog' }, { id: 'gpio', label: 'GPIO' },
];
const MODES: { id: PvMode; label: string; hint: string }[] = [
  { id: 'all', label: 'All', hint: 'Every pin, coloured by the signal family' },
  { id: 'drive', label: 'Drive', hint: 'Electricity: only the pins that supply, return, source, sink or pull current' },
  { id: 'signal', label: 'Signal', hint: 'Only the pins that carry a signal, and which function is activated on each' },
];
/** The phases of a board's life, in order (the lifecycle rows' phases); runtime is the stage selector's own picture. */
const PHASES: { id: PvPhase; label: string; hint: string }[] = [
  { id: 'power-up', label: 'Power-up', hint: 'Power just arrived: every I/O pin is blank (tri-stated, pull-up off)' },
  { id: 'reset', label: 'Reset', hint: 'A reset is active: every I/O pin is blank until init runs' },
  { id: 'bootloader', label: 'Bootloader', hint: 'The bootloader runs: its serial link and the reset line are served; everything else is still blank' },
  { id: 'init', label: 'Init', hint: 'The Initialization Purpose\'s claims applied' },
  { id: 'runtime', label: 'Runtime', hint: 'The chosen stage\'s claims' },
];
const BLANKS: { id: PvBlank; label: string; hint: string }[] = [
  { id: 'chip', label: 'Chip blank', hint: 'The silicon after reset with no program: no bootloader' },
  { id: 'board', label: 'Board as delivered', hint: 'Before any of our firmware: the bootloader is present' },
];
const FILLS = ['hollow', 'proposed', 'committed', 'hatched'] as const;

@Component({
  standalone: true,
  selector: 'hardware-pin-view',
  imports: [CommonModule, RouterLink],
  templateUrl: './hardware-pin-view.component.html',
  styleUrls: ['./hardware-pin-view.component.css'],
  encapsulation: ViewEncapsulation.None,
})
export class HardwarePinViewComponent implements OnInit, OnChanges, OnDestroy {
  @Input() board = 'arduino-uno-r3';
  @Input() system = 'uno-light-system';
  /** A firmware binding; empty means "the light demo's binding" once a stage past base needs one. */
  @Input() binding = '';
  @Input() stage: PvStage = 'base';
  @Input() protocol = '';
  @Input() phase: PvPhase = 'runtime';
  @Input() blank: PvBlank = 'board';
  /** pv-5: the stored solution search (SolveRun name) and the candidate (rank or id) the candidate stage draws; empty = the latest run's chosen candidate. */
  @Input() run = '';
  @Input() candidate = '';
  /** The Mission whose stored runs the run picker lists (the page's query ?mission= overrides). */
  @Input() mission = 'uno-light-mission';
  /** hsp-3b: the bench whose bridge the struct lane's chain is read from (the page's query ?bench= overrides). */
  @Input() bench = 'home-bench';

  readonly phases = PHASES;
  readonly blanks = BLANKS;
  readonly stages = STAGES;
  readonly defaultBinding = 'uno-light@arduino-uno-r3';
  readonly fills = FILLS;
  readonly fillWords = FILL_WORDS;
  readonly roleKeys = Object.keys(GLYPHS) as Exclude<PvRole, 'none'>[];
  readonly roleWords = ROLE_WORDS;
  glyph = GLYPHS;
  readonly modes = MODES;
  readonly protocolChips = PROTOCOL_CHIPS;
  readonly driveGlyph = DRIVE_GLYPHS;
  readonly driveWords = DRIVE_WORDS_SHORT;
  readonly railWords = RAIL_WORDS;
  readonly signalSymbolWords = SIGNAL_SYMBOL_WORDS;
  readonly signalSymbols = ['output', 'input', 'inout', 'clock', 'analog'] as const;
  driveToken = driveToken;
  mode: PvMode = 'all';
  activatedOnly = false;
  fRails = new Set<string>();
  fStatuses = new Set<string>();
  fLimits = new Set<string>();

  payload: PvPayload | null = null;
  ix: PvIndex | null = null;
  panel: Panel | null = null;
  selection: PvSelection = null;
  anchor: PvSelection = null;
  showUnassigned = false;
  bindings: string[] = [];
  /** pv-4: the configuration-event timeline (derived from install records and canvas wirings, plus recorded events) and the event whose pins are highlighted. */
  events: PvConfigEvent[] = [];
  eventsNote = '';
  eventSel: PvConfigEvent | null = null;
  private eventsSub?: Subscription;
  /** pv-5: the stored runs for the picker (newest first) and why none are listed. */
  runs: PvSolveRun[] = [];
  runsNote = '';
  private runsSub?: Subscription;
  /** hsp-3b: the struct lane - shown on request (?struct=1 or the toggle); the bindings, the bridge chain, the placed lane and the chosen field. */
  showStruct = false;
  structRows: PvStructBinding[] = [];
  chain: { bridge: PvBenchBridge | null; hops: PvBridgeHop[]; note: string } | null = null;
  lane: StructLane | null = null;
  fieldSel = '';
  structLoadNote = '';
  readonly laneKeys = Object.keys(LANE_WORDS);
  readonly laneWords = LANE_WORDS;
  readonly updaterKeys = Object.keys(UPDATER_WORDS);
  readonly updaterWords = UPDATER_WORDS;
  private structSub?: Subscription;
  private scene: Scene | null = null;
  /** An event the page's query asked for (?event=): selected by the first timeline that holds it. */
  private pendingEvent = '';
  loading = false;
  workingNote = '';
  error = '';
  errorDetail = '';

  @ViewChild('svg', { static: true }) svgRef!: ElementRef<SVGSVGElement>;
  /** A selection asked for by the page's query (?pin= ?surface= ?connection=), applied by the first payload that contains it. */
  private pendingSelection: PvSelection = null;
  private canvas?: PinViewCanvas;
  private sub?: Subscription;
  private route = inject(ActivatedRoute, { optional: true });

  constructor(private svc: PinViewService) {}

  ngOnInit(): void {
    const q = this.route?.snapshot?.queryParamMap;
    if (q) {
      this.board = q.get('board') || this.board;
      this.system = q.get('system') || this.system;
      this.binding = q.get('binding') || this.binding;
      this.stage = (q.get('stage') as PvStage) || this.stage;
      this.phase = (PHASES.some(x => x.id === q.get('phase')) ? q.get('phase') : this.phase) as PvPhase;
      this.blank = (q.get('blank') === 'chip' || q.get('blank') === 'board' ? q.get('blank') : this.blank) as PvBlank;
      this.protocol = q.get('protocol') || this.protocol;
      this.run = q.get('run') || this.run;
      this.candidate = q.get('candidate') || this.candidate;
      this.mission = q.get('mission') || this.mission;
      this.pendingEvent = q.get('event') || '';
      // table -> view: ?pin= / ?surface= / ?connection= select (and zoom to) that item once the payload is in; a second click clears it like any selection
      const want = q.get('pin') ? { kind: 'pin', id: q.get('pin')! } : q.get('surface') ? { kind: 'surface', id: q.get('surface')! } : q.get('connection') ? { kind: 'connection', id: q.get('connection')! } : null;
      this.pendingSelection = want as PvSelection;
      this.mode = (['all', 'drive', 'signal'].includes(q.get('mode') || '') ? q.get('mode') : this.mode) as PvMode;
      this.bench = q.get('bench') || this.bench;
      this.showStruct = q.get('struct') === '1';
    }
    this.canvas = new PinViewCanvas(this.svgRef.nativeElement, {
      surface: id => this.toggle({ kind: 'surface', id }),
      pin: id => this.toggle({ kind: 'pin', id }),
      field: key => this.pickField(key),
      connection: id => this.toggleConnection(id),
      background: () => this.clear(),
    });
    this.svc.bindings(this.board).subscribe(b => (this.bindings = b));
    this.reload();
    this.loadEvents();
    if (this.stage === 'candidate') { this.loadRuns(); }
    if (this.showStruct) { this.loadStruct(); }
  }

  ngOnChanges(ch: SimpleChanges): void {
    if (!this.canvas) { return; }
    if (['board', 'system', 'binding', 'stage', 'protocol', 'phase', 'blank', 'run', 'candidate'].some(k => ch[k] && !ch[k].firstChange)) { this.reload(); }
    if (['board', 'system', 'binding'].some(k => ch[k] && !ch[k].firstChange)) { this.loadEvents(); }
    if (this.showStruct && ['board', 'binding', 'bench'].some(k => ch[k] && !ch[k].firstChange)) { this.loadStruct(); }
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); this.eventsSub?.unsubscribe(); this.runsSub?.unsubscribe(); this.structSub?.unsubscribe(); this.canvas?.destroy(); }

  // ---- data
  /** A stage past base needs a binding; the light demo's is the default. */
  effectiveBinding(): string { return this.stage === 'candidate' && this.phase === 'runtime' ? '' : this.binding || (this.stage !== 'base' || this.phase === 'init' ? this.defaultBinding : ''); }

  /** The event timeline: its own read (it can take a few seconds - every event's pins are worked out from the payload difference); a failure is said in words and never blocks the picture. */
  loadEvents(): void {
    this.eventsSub?.unsubscribe();
    this.eventsNote = 'Loading the events…';
    this.eventsSub = this.svc.events(this.board, this.system, this.binding).subscribe({
      next: r => {
        this.events = (r && r.ok !== false && r.events) || [];
        this.eventsNote = this.events.length ? '' : ((r && r.error) || 'No real-world changes are recorded for this board yet: no install, no wire drawn on the canvas.');
        if (this.eventSel && !this.events.some(e => e.name === this.eventSel!.name)) { this.eventSel = null; this.redraw(); }
        if (this.pendingEvent) {   // ?event= from the Configuration events table: select that event (its pins are highlighted); one that is not in the timeline selects nothing
          const want = this.events.find(e => e.name === this.pendingEvent);
          this.pendingEvent = '';
          if (want) { this.eventSel = want; this.selection = null; this.anchor = null; this.redraw(); }
        }
      },
      error: e => { this.events = []; this.eventsNote = friendlyError(e, 'the event timeline').text; },
    });
  }

  /** pv-5: the stored runs of the Mission, newest first (a plain GET); a failure says so and never blocks the picture. */
  loadRuns(): void {
    this.runsSub?.unsubscribe();
    this.runsNote = 'Loading the stored solution searches…';
    this.runsSub = this.svc.runs(this.mission).subscribe({
      next: r => {
        this.runs = (r && r.ok !== false && r.rows) || [];
        this.runsNote = this.runs.length ? '' : ((r && r.error) || `No solution search is stored for ${this.mission} yet: run one from the "Solutions found" page or with \`pol capability solve mission ${this.mission}\`.`);
      },
      error: e => { this.runs = []; this.runsNote = friendlyError(e, 'the stored solution searches').text; },
    });
  }

  reload(): void {
    this.sub?.unsubscribe();
    this.loading = true; this.error = ''; this.errorDetail = '';
    this.workingNote = this.stage !== 'base' || this.protocol ? 'Working out the claims… this can take several seconds.' : 'Loading the pins…';
    this.sub = this.svc.load(this.board, { system: this.system, binding: this.effectiveBinding(), stage: this.stage, protocol: this.protocol, activated_only: this.activatedOnly, phase: this.phase, blank: this.blank, run: this.run, candidate: this.candidate }).subscribe({
      next: p => {
        this.loading = false;
        if (!p || p.ok === false) { this.error = (p && p.error) || 'The pin view came back empty.'; return; }
        this.payload = p;
        if (p.candidate) { this.run = p.candidate.run; this.mission = p.candidate.mission || this.mission; }
        this.ix = new PvIndex(p);
        if (this.selection && !this.exists(this.selection)) { this.selection = null; }
        if (this.anchor && !this.exists(this.anchor)) { this.anchor = null; }
        if (this.pendingSelection) {
          if (this.exists(this.pendingSelection)) { this.selection = this.pendingSelection; this.anchor = null; }
          this.pendingSelection = null;
        }
        this.scene = buildScene(p);
        this.canvas!.setData(p, this.ix, this.scene);
        this.rebuildLane();
        this.redraw();
      },
      error: e => {
        this.loading = false;
        const f = friendlyError(e, 'the pin view');
        this.error = f.text; this.errorDetail = f.detail;
      },
    });
  }

  private exists(s: NonNullable<PvSelection>): boolean {
    const ix = this.ix!;
    return s.kind === 'surface' ? ix.surfaces.has(s.id) : s.kind === 'pin' ? ix.pins.has(s.id) : ix.conns.has(s.id);
  }

  // ---- controls
  setStage(id: string): void {
    this.stage = id as PvStage;
    if (this.stage !== 'candidate') { this.candidate = ''; }
    else if (!this.runs.length) { this.loadRuns(); }
    this.reload();
  }
  /** pv-5: pick a stored run (its chosen candidate is drawn) or a candidate of the shown run (by rank or id); the empty choice means the latest run / its chosen candidate. */
  setRun(name: string): void { this.run = name; this.candidate = ''; this.reload(); }
  setCandidate(id: string): void { this.candidate = id; this.reload(); }
  get cand(): PvCandidate | null { return this.shownStage === 'candidate' ? (this.payload?.candidate || null) : null; }
  /** "18 Oct 2026, 09:01" for a run's time. */
  runWhen(r: PvSolveRun): string {
    const d = new Date(r.ran_at);
    return isNaN(d.getTime()) ? r.ran_at : d.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  cycleText(us: number): string { return us >= 1000 ? `${(us / 1000).toFixed(1)} ms` : `${us.toFixed(1)} us`; }
  runLabel(r: PvSolveRun): string { return `${this.runWhen(r)} - ${r.objective.replace('-', ' ')}, ${r.candidate_count} candidates`; }
  /** Phase and baseline are part of the question to the door, so each change is one read. A phase before init has no claims: the stage selector then follows the phase. */
  setPhase(id: string): void { this.phase = id as PvPhase; this.reload(); }
  setBlank(id: string): void { this.blank = id as PvBlank; if (this.phase !== 'runtime') { this.reload(); } }
  get phaseLocksStage(): boolean { return this.phase !== 'runtime'; }
  /** The stage the picture really shows (the phase decides it before runtime). */
  get shownStage(): PvStage { return (this.payload?.stage.stage as PvStage) || this.stage; }
  get banner(): string { const b = this.payload?.phase_info?.banner || ''; return b ? b.charAt(0).toUpperCase() + b.slice(1) + '.' : ''; }
  get phaseHint(): string { return PHASES.find(p => p.id === this.phase)?.hint || ''; }
  get bootloaderLine(): string {
    const f = this.payload?.phase_info?.blank_facts;
    if (!f) { return ''; }
    const b = f.bootloader;
    return `${f.label}. Bootloader: ${b.present}${b.why ? ' (' + b.why + ')' : ''}. Factory sketch: ${f.factory_sketch.status}${f.factory_sketch.why ? ' (' + f.factory_sketch.why + ')' : ''}.`;
  }
  setBinding(name: string): void { this.binding = name; this.reload(); if (this.showStruct) { this.loadStruct(); } }
  /** One protocol (or none): the older single-select entry point; the chips call toggleProtocol. */
  setProtocol(name: string): void { this.protocol = name; this.redraw(); this.reload(); }
  get protocols(): string[] { return this.protocol.split(',').filter(Boolean); }
  hasProtocol(id: string): boolean { return this.protocols.includes(id); }
  /** Chips are multi-select (i2c + spi at once); a second click on a chip clears it. */
  toggleProtocol(id: string): void {
    const cur = this.protocols;
    this.protocol = (cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]).join(',');
    if (!this.protocol) { this.activatedOnly = false; }
    this.redraw(); this.reload();
  }
  setActivatedOnly(on: boolean): void { this.activatedOnly = on; if (this.protocol) { this.reload(); } }
  setMode(m: PvMode): void { this.mode = m; this.redraw(); }
  private toggleIn(set: Set<string>, id: string): void { if (set.has(id)) { set.delete(id); } else { set.add(id); } this.redraw(); }
  toggleRail(id: string): void { this.toggleIn(this.fRails, id); }
  toggleStatus(id: string): void { this.toggleIn(this.fStatuses, id); }
  toggleLimit(id: string): void { this.toggleIn(this.fLimits, id); }
  get filtersOn(): boolean { return !!this.protocol || this.activatedOnly || driveFilterOn(this.modeFilters); }
  get modeFilters(): PvModeFilters { return { rails: this.fRails, statuses: this.fStatuses, limits: this.fLimits }; }
  /** Clears every filter (protocols, activated only, rail, status, limit class); reloads only if the door's answer depends on one. */
  clearFilters(): void {
    const asked = !!this.protocol;
    this.protocol = ''; this.activatedOnly = false;
    this.fRails = new Set(); this.fStatuses = new Set(); this.fLimits = new Set();
    this.redraw();
    if (asked) { this.reload(); }
  }
  /** The values present in the payload, in the door's vocabulary order: the chips offer only what exists. */
  private present(key: 'rail' | 'drive_status' | 'limit_class', order: string[] | undefined): string[] {
    const have = new Set((this.payload?.pins || []).filter(p => p.drive_relevant !== false).map(p => p[key]));
    const known = (order || []).filter(v => have.has(v));
    return [...known, ...[...have].filter(v => !known.includes(v))];
  }
  get railOptions(): string[] { return this.present('rail', this.payload?.vocabulary.drive?.rails); }
  get statusOptions(): string[] { return this.present('drive_status', this.payload?.vocabulary.drive?.drive_statuses); }
  get limitOptions(): string[] { return this.present('limit_class', this.payload?.vocabulary.drive?.limit_classes); }
  get driveSymbols(): PvDriveSymbol[] { return this.statusOptions.filter(s => s in DRIVE_GLYPHS) as PvDriveSymbol[]; }
  get showDriveFilters(): boolean { return this.mode !== 'signal'; }
  get showSignalFilters(): boolean { return this.mode !== 'drive'; }
  get modeHint(): string { return MODES.find(m => m.id === this.mode)?.hint || ''; }
  get matchCount(): number { return this.payload ? this.payload.pins.filter(p => this.matchesNow(p)).length : 0; }
  private matchesNow(p: { rail: string; drive_status: string; limit_class: string }): boolean {
    return (!this.fRails.size || this.fRails.has(p.rail)) && (!this.fStatuses.size || this.fStatuses.has(p.drive_status)) && (!this.fLimits.size || this.fLimits.has(p.limit_class));
  }
  setShowUnassigned(on: boolean): void { this.showUnassigned = on; this.redraw(); }

  // ---- hsp-3b: the struct lane (GETs only; off until asked for, so the base picture reads one door)
  /** The firmware variant whose Catom assertions the lane draws: the chosen binding's, else the light demo's on its own board. */
  get structVariant(): string { return (this.binding || (this.board === this.defaultBinding.split('@')[1] ? this.defaultBinding : '')).split('@')[0]; }
  setShowStruct(on: boolean): void {
    this.showStruct = on;
    if (!on) { this.fieldSel = ''; this.rebuildLane(); this.redraw(); this.fit(); return; }
    this.loadStruct();
  }
  loadStruct(): void {
    this.structSub?.unsubscribe();
    const variant = this.structVariant;
    this.structLoadNote = 'Loading the struct bindings and the bridge path…';
    if (!variant) {
      this.structRows = []; this.chain = null;
      this.structLoadNote = `No firmware binding is chosen for ${this.board}: pick one to see the struct its Catom assertions bind to the pins.`;
      this.rebuildLane(); this.redraw();
      return;
    }
    const rows$ = this.svc.structBindings(variant).pipe(catchError(e => of({ ok: false, error: friendlyError(e, 'the struct bindings').text, rows: [] as PvStructBinding[] })));
    const chain$ = this.svc.bridgeChain(this.bench, this.board).pipe(catchError(e => of({ bridge: null, hops: [] as PvBridgeHop[], note: friendlyError(e, 'the bridge path').text })));
    this.structSub = combineLatest([rows$, chain$]).subscribe(([r, c]) => {
      this.structRows = (r && r.ok !== false && r.rows) || [];
      this.chain = c;
      const why = r && r.ok === false ? (r as { error?: string }).error : '';
      this.structLoadNote = why || (this.structRows.length ? '' : `No Catom assertion of ${variant} binds a struct field to a pin yet.`);
      this.rebuildLane(); this.redraw(); this.fit();
    });
  }
  /** The lane is placed on the scene, so every new payload places it again. */
  private rebuildLane(): void {
    this.lane = this.showStruct && this.payload && this.scene ? buildStructLane(this.scene, this.payload, this.structRows, this.chain) : null;
    if (this.fieldSel && !this.lane?.fields.some(f => f.key === this.fieldSel)) { this.fieldSel = ''; }
    this.canvas?.setStruct(this.lane);
  }
  get structNotes(): string[] {
    const out = [this.structLoadNote, this.chain?.note || ''];
    if (this.chain?.bridge) { out.push(`Bridge ${this.chain.bridge.name} (${this.chain.bridge.mode}): ${this.chain.bridge.status_why}.`); }
    (this.lane?.unplaced || []).forEach(u => out.push(`${u.pin}: ${u.why}.`));
    return out.filter(Boolean);
  }
  /** A field click lights its pins and, if it crosses the bridge, the chain; a second click clears (the click-toggle rule). */
  pickField(key: string): void {
    this.fieldSel = this.fieldSel === key ? '' : key;
    if (this.fieldSel) { this.selection = null; this.anchor = null; this.eventSel = null; }
    this.redraw();
  }
  get fieldRows(): StructRow[] { return this.fieldSel ? structRows(this.lane, { field: this.fieldSel }) : []; }
  get fieldBridged(): boolean { return !!this.lane?.fields.find(f => f.key === this.fieldSel)?.bridged; }
  private get selPinName(): string { return this.selection?.kind === 'pin' ? socPinName(this.ix?.pins.get(this.selection.id)?.soc_pin) : ''; }
  get pinStructRows(): StructRow[] { const n = this.selPinName; return n ? structRows(this.lane, { pinName: n }) : []; }
  fit(): void { this.canvas?.fit(); }

  // ---- selection: every selectable deselects on a second click; Escape clears
  toggle(sel: NonNullable<PvSelection>): void {
    this.eventSel = null;   // picking something on the picture leaves the event highlight
    this.fieldSel = '';
    const same = this.selection && this.selection.kind === sel.kind && this.selection.id === sel.id;
    this.anchor = null;
    this.selection = same ? null : sel;
    this.redraw();
  }

  toggleConnection(id: string): void {
    const cur = this.selection;
    if (cur && cur.kind === 'connection' && cur.id === id) { this.selection = this.anchor; this.anchor = null; }
    else {
      if (!cur || cur.kind !== 'connection') { this.anchor = cur; }
      this.selection = { kind: 'connection', id };
    }
    this.redraw();
  }

  clear(): void {
    if (!this.selection && !this.anchor && !this.eventSel && !this.fieldSel) { return; }
    this.selection = null; this.anchor = null; this.eventSel = null; this.fieldSel = '';
    this.redraw();
  }

  /** Click an event: the pins it changed are highlighted and everything else dimmed; a second click on it clears. */
  pickEvent(ev: PvConfigEvent): void {
    if (this.eventSel?.name === ev.name) { this.eventSel = null; }
    else { this.eventSel = ev; this.selection = null; this.anchor = null; this.fieldSel = ''; }
    this.redraw();
  }
  isEventSel(ev: PvConfigEvent): boolean { return this.eventSel?.name === ev.name; }
  /** "2026-10-18T09:01:10" -> "18 Oct 2026, 09:01"; an event with no time recorded says so. */
  whenText(ev: PvConfigEvent): string {
    if (!ev.dated) { return 'time not recorded'; }
    const d = new Date(ev.when);
    return isNaN(d.getTime()) ? ev.when : d.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  get eventPinSet(): ReadonlySet<string> | null { return this.eventSel ? new Set(this.eventSel.pins_changed.map(p => p.pin)) : null; }

  @HostListener('document:keydown.escape') onEscape(): void { this.clear(); }

  private redraw(): void {
    this.panel = this.ix ? buildPanel(this.ix, this.selection, this.mode) : null;
    const fieldHi = this.fieldSel ? fieldPins(this.lane, this.fieldSel) : null;   // a chosen field highlights its pins the way an event does
    this.canvas?.setState({ selection: this.selection, anchor: this.anchor, protocol: this.protocol, showUnassigned: this.showUnassigned, mode: this.mode, filters: this.modeFilters, eventPins: this.eventPinSet ?? fieldHi });
    this.canvas?.paintStruct({ field: this.fieldSel, pinName: this.selPinName });
  }

  // ---- template helpers
  get families(): PvFamily[] { return this.payload?.vocabulary.families || []; }
  get protocolChildren(): string[] { return this.payload?.protocol?.children || []; }
  get litCount(): number { return this.payload ? this.payload.pins.filter(p => !!p.lit).length : 0; }
  /** The two custom properties a swatch or chip paints from, for any token name (`--pin-spi`, `--drive-5v`). */
  vars(token: string): Record<string, string> { return { '--fam': `var(${token}, #90a4ae)`, '--fam-text': `var(${token}-text, #000000)` }; }
  famVars(f: PvFamily): Record<string, string> { return { '--fam': `var(${f.token}, ${f.fallback_hex})`, '--fam-text': `var(${f.text_token}, #ffffff)` }; }
  get sp(): SurfacePanel | null { return this.panel?.type === 'surface' ? this.panel : null; }
  get pp(): PinPanel | null { return this.panel?.type === 'pin' ? this.panel : null; }
  get cp(): ConnPanel | null { return this.panel?.type === 'connection' ? this.panel : null; }
  isSelectedPin(id: string): boolean { return this.selection?.kind === 'pin' && this.selection.id === id; }
  isSelectedConn(id: string): boolean { return this.selection?.kind === 'connection' && this.selection.id === id; }
  pickPin(id: string): void { this.toggle({ kind: 'pin', id }); }
  pickConnection(id: string): void { this.toggleConnection(id); }
  trackId = (_: number, x: { id: string }) => x.id;
  trackName = (_: number, x: { name: string }) => x.name;
}
