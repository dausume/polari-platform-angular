import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild, ViewEncapsulation, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { friendlyError } from '../friendly-error';
import { PinViewCanvas } from './pin-view-draw';
import {
  DRIVE_GLYPHS, DRIVE_WORDS_SHORT, FILL_WORDS, GLYPHS, RAIL_WORDS, ROLE_WORDS, SIGNAL_SYMBOL_WORDS, PvDriveSymbol, PvModeFilters, PvRole, driveToken, driveFilterOn,
} from './pin-view-encode';
import { buildScene } from './pin-view-layout';
import { ConnPanel, Panel, PinPanel, PvIndex, SurfacePanel, buildPanel } from './pin-view-panel';
import { PinViewService } from './pin-view.service';
import { PvFamily, PvMode, PvPayload, PvSelection, PvStage } from './pin-view.types';

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
      this.protocol = q.get('protocol') || this.protocol;
      // table -> view: ?pin= / ?surface= / ?connection= select (and zoom to) that item once the payload is in; a second click clears it like any selection
      const want = q.get('pin') ? { kind: 'pin', id: q.get('pin')! } : q.get('surface') ? { kind: 'surface', id: q.get('surface')! } : q.get('connection') ? { kind: 'connection', id: q.get('connection')! } : null;
      this.pendingSelection = want as PvSelection;
      this.mode = (['all', 'drive', 'signal'].includes(q.get('mode') || '') ? q.get('mode') : this.mode) as PvMode;
    }
    this.canvas = new PinViewCanvas(this.svgRef.nativeElement, {
      surface: id => this.toggle({ kind: 'surface', id }),
      pin: id => this.toggle({ kind: 'pin', id }),
      connection: id => this.toggleConnection(id),
      background: () => this.clear(),
    });
    this.svc.bindings(this.board).subscribe(b => (this.bindings = b));
    this.reload();
  }

  ngOnChanges(ch: SimpleChanges): void {
    if (!this.canvas) { return; }
    if (['board', 'system', 'binding', 'stage', 'protocol'].some(k => ch[k] && !ch[k].firstChange)) { this.reload(); }
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); this.canvas?.destroy(); }

  // ---- data
  /** A stage past base needs a binding; the light demo's is the default. */
  effectiveBinding(): string { return this.binding || (this.stage !== 'base' ? this.defaultBinding : ''); }

  reload(): void {
    this.sub?.unsubscribe();
    this.loading = true; this.error = ''; this.errorDetail = '';
    this.workingNote = this.stage !== 'base' || this.protocol ? 'Working out the claims… this can take several seconds.' : 'Loading the pins…';
    this.sub = this.svc.load(this.board, { system: this.system, binding: this.effectiveBinding(), stage: this.stage, protocol: this.protocol, activated_only: this.activatedOnly }).subscribe({
      next: p => {
        this.loading = false;
        if (!p || p.ok === false) { this.error = (p && p.error) || 'The pin view came back empty.'; return; }
        this.payload = p;
        this.ix = new PvIndex(p);
        if (this.selection && !this.exists(this.selection)) { this.selection = null; }
        if (this.anchor && !this.exists(this.anchor)) { this.anchor = null; }
        if (this.pendingSelection) {
          if (this.exists(this.pendingSelection)) { this.selection = this.pendingSelection; this.anchor = null; }
          this.pendingSelection = null;
        }
        this.canvas!.setData(p, this.ix, buildScene(p));
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
  setStage(id: string): void { this.stage = id as PvStage; this.reload(); }
  setBinding(name: string): void { this.binding = name; this.reload(); }
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
  fit(): void { this.canvas?.fit(); }

  // ---- selection: every selectable deselects on a second click; Escape clears
  toggle(sel: NonNullable<PvSelection>): void {
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
    if (!this.selection && !this.anchor) { return; }
    this.selection = null; this.anchor = null;
    this.redraw();
  }

  @HostListener('document:keydown.escape') onEscape(): void { this.clear(); }

  private redraw(): void {
    this.panel = this.ix ? buildPanel(this.ix, this.selection, this.mode) : null;
    this.canvas?.setState({ selection: this.selection, anchor: this.anchor, protocol: this.protocol, showUnassigned: this.showUnassigned, mode: this.mode, filters: this.modeFilters });
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
}
