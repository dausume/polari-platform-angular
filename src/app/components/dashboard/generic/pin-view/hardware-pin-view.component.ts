import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild, ViewEncapsulation, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { friendlyError } from '../friendly-error';
import { PinViewCanvas } from './pin-view-draw';
import { FILL_WORDS, GLYPHS, ROLE_WORDS, PvRole } from './pin-view-encode';
import { buildScene } from './pin-view-layout';
import { ConnPanel, Panel, PinPanel, PvIndex, SurfacePanel, buildPanel } from './pin-view-panel';
import { PinViewService } from './pin-view.service';
import { PvFamily, PvPayload, PvSelection, PvStage } from './pin-view.types';

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
const DEFAULT_PROTOCOLS = ['spi', 'i2c', 'uart', 'usb'];
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
    this.sub = this.svc.load(this.board, { system: this.system, binding: this.effectiveBinding(), stage: this.stage, protocol: this.protocol }).subscribe({
      next: p => {
        this.loading = false;
        if (!p || p.ok === false) { this.error = (p && p.error) || 'The pin view came back empty.'; return; }
        this.payload = p;
        this.ix = new PvIndex(p);
        if (this.selection && !this.exists(this.selection)) { this.selection = null; }
        if (this.anchor && !this.exists(this.anchor)) { this.anchor = null; }
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
  setProtocol(name: string): void { this.protocol = name; this.redraw(); this.reload(); }
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
    this.panel = this.ix ? buildPanel(this.ix, this.selection) : null;
    this.canvas?.setState({ selection: this.selection, anchor: this.anchor, protocol: this.protocol, showUnassigned: this.showUnassigned });
  }

  // ---- template helpers
  get families(): PvFamily[] { return this.payload?.vocabulary.families || []; }
  get protocolOptions(): { id: string; label: string }[] {
    const v = this.payload?.vocabulary;
    const sets = v ? Object.keys(v.sets) : DEFAULT_PROTOCOLS;
    const rest = v ? v.families.map(f => f.family).filter(f => !sets.includes(f)) : [];
    return [...sets.map(s => ({ id: s, label: `${s.toUpperCase()} (${(v?.sets[s] || []).join(' · ')})` })), ...rest.map(f => ({ id: f, label: f }))];
  }
  get protocolChildren(): string[] { return this.payload?.vocabulary.sets[this.protocol] || []; }
  get litCount(): number { return this.payload ? this.payload.pins.filter(p => !!p.lit).length : 0; }
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
