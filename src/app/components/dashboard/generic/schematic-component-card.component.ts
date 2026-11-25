import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges } from '@angular/core';
import { SchematicCheckRow, SchematicComponentRow, SchematicDrawing, SchematicPartRow, SchematicPortRow, layoutSchematic } from './schematic-drawing';

/**
 * cb-1: ONE schematic component as a card - its small drawing (schematic-drawing.ts lays it out; red where unsolved), its state in
 * words, and its parts and ports. Presentational only: the rows come in as inputs (from `schematic-component-cards` or a cell of
 * `feature-cards-table`), nothing is fetched here. `compact` drops the part and port lists (the drawing and the state stay).
 */
@Component({
  standalone: true,
  selector: 'schematic-component-card',
  imports: [CommonModule],
  template: `
    <article class="sc-card" [class.red]="drawing?.red" [attr.aria-label]="(component?.title || component?.name) + ', ' + drawing?.words">
      <header>
        <div class="title">{{ component?.title || component?.name }}</div>
        <span class="chip state" [class.bad]="drawing?.red">{{ component?.solve_state || 'unsolved' }}</span>
      </header>
      <div class="subtitle muted" *ngIf="component?.hardware_solution || component?.board">
        {{ component?.hardware_solution || 'no hardware solution' }}<span *ngIf="component?.board"> · {{ component?.board }}</span>
      </div>
      <div class="subtitle muted" *ngIf="component?.intent || component?.core_part">
        {{ component?.intent }}<span *ngIf="component?.core_part"> · {{ component?.core_part }}</span>
        <span *ngIf="component?.protocol"> · {{ component?.protocol }}</span>
      </div>
      <svg *ngIf="drawing" class="drawing" [attr.viewBox]="'0 0 ' + drawing.width + ' ' + drawing.height" role="img"
           [attr.aria-label]="'schematic of ' + (component?.title || component?.name)">
        <line *ngFor="let w of drawing.wires" [attr.x1]="w.x1" [attr.y1]="w.y1" [attr.x2]="w.x2" [attr.y2]="w.y2" class="wire"></line>
        <circle *ngFor="let j of drawing.junctions" [attr.cx]="j.x" [attr.cy]="j.y" r="3" class="junction"></circle>
        <g *ngFor="let s of drawing.symbols" [attr.transform]="'translate(' + s.x + ',' + s.y + ')' + (s.vertical ? ' rotate(90)' : '')"
           class="symbol" [ngSwitch]="s.kind">
          <g *ngSwitchCase="'capacitor'"><line x1="-14" y1="0" x2="-4" y2="0"></line><line x1="-4" y1="-9" x2="-4" y2="9"></line>
            <line x1="4" y1="-9" x2="4" y2="9"></line><line x1="4" y1="0" x2="14" y2="0"></line></g>
          <g *ngSwitchCase="'diode'"><line x1="-14" y1="0" x2="-6" y2="0"></line><polygon points="-6,-7 -6,7 6,0" class="fill"></polygon>
            <line x1="6" y1="-7" x2="6" y2="7"></line><line x1="6" y1="0" x2="14" y2="0"></line></g>
          <g *ngSwitchCase="'resistor'"><polyline points="-14,0 -9,0 -7,-6 -3,6 1,-6 5,6 7,0 14,0" class="open"></polyline></g>
          <g *ngSwitchCase="'led'"><line x1="-14" y1="0" x2="-6" y2="0"></line><polygon points="-6,-7 -6,7 6,0" class="fill"></polygon>
            <line x1="6" y1="-7" x2="6" y2="7"></line><line x1="6" y1="0" x2="14" y2="0"></line>
            <line x1="-1" y1="-9" x2="4" y2="-15"></line><line x1="4" y1="-9" x2="9" y2="-15"></line></g>
          <g *ngSwitchCase="'pushbutton'"><line x1="-14" y1="0" x2="-8" y2="0"></line><rect x="-8" y="-8" width="16" height="16" class="open"></rect>
            <circle cx="0" cy="0" r="4" class="open"></circle><line x1="8" y1="0" x2="14" y2="0"></line></g>
          <g *ngSwitchCase="'battery'"><line x1="-14" y1="0" x2="-3" y2="0"></line><line x1="-3" y1="-10" x2="-3" y2="10"></line>
            <line x1="3" y1="-5" x2="3" y2="5"></line></g>
          <g *ngSwitchCase="'ground'"><line x1="-14" y1="0" x2="0" y2="0"></line><line x1="0" y1="-9" x2="0" y2="9"></line>
            <line x1="4" y1="-5" x2="4" y2="5"></line><line x1="8" y1="-2" x2="8" y2="2"></line></g>
          <g *ngSwitchDefault><rect x="-10" y="-7" width="20" height="14" class="open"></rect></g>
        </g>
        <circle *ngFor="let p of drawing.pins" [attr.cx]="p.x" [attr.cy]="p.y" r="3.5" class="pin" [class.hollow]="p.source !== 'chosen'"></circle>
        <text *ngFor="let l of drawing.labels" [attr.x]="l.x" [attr.y]="l.y" [attr.text-anchor]="l.anchor" class="label" [class.muted-text]="l.muted">{{ l.text }}</text>
      </svg>
      <p class="words" [class.bad]="drawing?.red">{{ drawing?.words }}</p>
      <ng-container *ngIf="!compact">
        <table class="mini" *ngIf="parts.length">
          <caption>Parts</caption>
          <tr><th scope="col">ref</th><th scope="col">role</th><th scope="col">part</th><th scope="col">value</th><th scope="col">on</th></tr>
          <tr *ngFor="let p of parts"><td>{{ p.ref }}</td><td>{{ p.role }}</td><td>{{ p.part_kind }}</td>
            <td [class.dim]="!p.value">{{ p.value || 'unverified' }}</td><td>{{ p.port || 'core' }}</td></tr>
        </table>
        <details class="checks" *ngIf="checks.length" [open]="drawing?.red">
          <summary>What the solver decided ({{ checks.length }}: {{ checkCounts() }})</summary>
          <ul>
            <li *ngFor="let k of checks" [class.bad]="isBlocking(k)" [class.dim]="k.status === 'undetermined'">
              <span class="rule">{{ k.rule }}</span> · <span class="status">{{ k.status }}</span>
              <span *ngIf="k.subject" class="muted"> · {{ k.subject }}</span>
              <div class="why">{{ k.detail }}</div>
            </li>
          </ul>
        </details>
        <table class="mini" *ngIf="ports.length">
          <caption>Ports</caption>
          <tr><th scope="col">port</th><th scope="col">kind</th><th scope="col">chip</th><th scope="col">pin</th><th scope="col">pin from</th></tr>
          <tr *ngFor="let p of ports"><td>{{ p.port }}</td><td>{{ p.kind }}</td><td>{{ p.chip || '-' }}</td>
            <td [class.dim]="isSignal(p) && !p.pin">{{ isSignal(p) ? (p.pin || 'open') : '-' }}</td>
            <td>{{ isSignal(p) ? (p.pin_source || (p.pin ? '' : 'open')) : '-' }}</td></tr>
        </table>
      </ng-container>
    </article>
  `,
  styles: [`
    :host { display: block; }
    .sc-card { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border-radius: 8px; background: var(--surface-primary);
      color: var(--text-on-card); border: 1px solid var(--border-light); box-shadow: var(--card-shadow); }
    .sc-card.red { border-color: var(--color-error-text); }
    header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 4px 8px; }
    .title { font-weight: 600; overflow-wrap: anywhere; }
    .subtitle { font-size: 0.85em; }
    .chip { font-size: 0.8em; padding: 1px 8px; border-radius: var(--radius-pill); border: 1px solid var(--border-medium);
      background: var(--surface-secondary); }
    .chip.bad { color: var(--color-error-text); border-color: var(--color-error-text); }
    .drawing { width: 100%; max-width: 22rem; height: auto; align-self: center; }
    .wire, .symbol line, .symbol polyline, .symbol rect, .symbol circle, .symbol polygon { stroke: var(--text-on-card); stroke-width: 1.6; fill: none; }
    .symbol .fill { fill: var(--text-on-card); }
    .junction { fill: var(--text-on-card); stroke: none; }
    .pin { fill: var(--text-on-card); stroke: var(--text-on-card); stroke-width: 1.4; }
    .pin.hollow { fill: var(--surface-primary); }
    .red .wire, .red .symbol line, .red .symbol polyline, .red .symbol rect, .red .symbol circle, .red .symbol polygon { stroke: var(--color-error-text); }
    .red .junction, .red .symbol .fill { fill: var(--color-error-text); }
    .label { font-size: 11px; fill: var(--text-on-card); }
    .label.muted-text { fill: var(--text-on-card-muted); }
    .words { margin: 0; font-size: 0.85em; color: var(--text-on-card-muted); }
    .words.bad { color: var(--color-error-text); }
    .mini { width: 100%; border-collapse: collapse; font-size: 0.82em; }
    .mini caption { text-align: left; font-weight: 600; color: var(--text-on-card-muted); padding-top: 4px; }
    .mini th, .mini td { text-align: left; padding: 1px 6px 1px 0; border-bottom: 1px solid var(--border-light); }
    .mini th { color: var(--text-on-card-muted); font-weight: 500; }
    .dim { opacity: 0.6; font-style: italic; }
    .checks { font-size: 0.82em; }
    .checks summary { cursor: pointer; font-weight: 600; color: var(--text-on-card-muted); padding-top: 4px; }
    .checks ul { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
    .checks li { border-bottom: 1px solid var(--border-light); padding-bottom: 3px; }
    .checks .rule { font-weight: 600; }
    .checks .why { overflow-wrap: anywhere; }
    .checks li.bad, .checks li.bad .muted { color: var(--color-error-text); }
    .muted { color: var(--text-on-card-muted); }
  `],
})
export class SchematicComponentCardComponent implements OnChanges {
  @Input() component: SchematicComponentRow | null = null;
  @Input() allPorts: SchematicPortRow[] = [];
  @Input() allParts: SchematicPartRow[] = [];
  @Input() compact = false;
  /** cb-3: the solver's decisions (SchematicComponentCheck rows); those of this component are listed under its parts. */
  @Input() allChecks: SchematicCheckRow[] = [];

  drawing: SchematicDrawing | null = null;
  ports: SchematicPortRow[] = [];
  parts: SchematicPartRow[] = [];
  checks: SchematicCheckRow[] = [];

  /** Only a signal port lands on a chip pin; a supply or ground port has none to leave open. */
  isSignal(p: SchematicPortRow): boolean { return (p.kind || 'signal') === 'signal'; }
  /** A decision that blocks the component: a part is needed, or an electrical rule refuses. */
  isBlocking(k: SchematicCheckRow): boolean { return k.status === 'needed' || k.status === 'refuse'; }
  /** '2 placed, 5 not-needed, 1 needed' - the decisions counted by status, in the order they first appear. */
  checkCounts(): string {
    const n = new Map<string, number>();
    this.checks.forEach((k) => n.set(k.status, (n.get(k.status) || 0) + 1));
    return Array.from(n.entries()).map(([st, c]) => `${c} ${st}`).join(', ');
  }

  ngOnChanges(): void {
    const c = this.component;
    if (!c) { this.drawing = null; this.ports = []; this.parts = []; this.checks = []; return; }
    this.checks = (this.allChecks || []).filter((k) => k.component === c.name).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    this.ports = (this.allPorts || []).filter((p) => p.component === c.name).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    this.parts = (this.allParts || []).filter((p) => p.component === c.name).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    this.drawing = layoutSchematic(c, this.allPorts, this.allParts);
  }
}
