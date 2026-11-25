import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CRUDEservicesManager } from '@services/crude-services-manager';
import { crudeRows } from './feature-cards';
import { SchematicSymbolComponent } from './schematic-symbol.component';
import { SolutionSchematic, layoutSolution, solutionsOf } from './solution-schematic';

/**
 * cb-6 `solution-schematic` (componentName 'solution-schematic'): ONE drawing per hardware solution - every schematic component of it
 * around its chip (solution-schematic.ts lays it out), red where a component is not solved. Inputs are CLASS NAMES, read through the
 * generated CRUDE API (no door of its own), plus an optional solution name ('' = every solution the rows name):
 *   { "componentClass": "SchematicComponent", "portClass": "SchematicComponentPort", "partClass": "SchematicComponentPart", "solution": "" }
 * The same solution as one KiCad sheet, checked by KiCad: `pol hwnocode features <solution> --kicad` (hwnocode.custom.schematic_kicad).
 */
@Component({
  standalone: true,
  selector: 'solution-schematic',
  imports: [CommonModule, MatProgressSpinnerModule, SchematicSymbolComponent],
  template: `
    <div class="sol">
      <div *ngIf="loading" class="state"><mat-spinner diameter="28"></mat-spinner></div>
      <div *ngIf="error" class="state error" role="alert">{{ error }}</div>
      <p *ngIf="!loading && !error && !views.length" class="muted">No hardware solution has solved schematic components yet.</p>
      <section *ngFor="let v of views" class="one" [attr.aria-label]="'whole schematic of ' + v.solution">
        <header><span class="name">{{ v.solution }}</span><span class="muted"> · {{ v.board }} · {{ v.words }}</span></header>
        <svg class="drawing" [attr.viewBox]="'0 0 ' + v.width + ' ' + v.height" [style.max-width.px]="v.width * 1.6" role="img"
             [attr.aria-label]="v.words">
          <g *ngFor="let b of v.blocks" [attr.transform]="'translate(0,' + b.offsetY + ')'" class="block" [class.red]="b.red">
            <text x="4" y="-4" class="title">{{ b.title }}</text>
            <line *ngFor="let w of b.drawing.wires" [attr.x1]="w.x1" [attr.y1]="w.y1" [attr.x2]="w.x2" [attr.y2]="w.y2" class="wire"></line>
            <circle *ngFor="let j of b.drawing.junctions" [attr.cx]="j.x" [attr.cy]="j.y" r="3" class="junction"></circle>
            <g *ngFor="let s of b.drawing.symbols" schematicSymbol [kind]="s.kind" class="symbol"
               [attr.transform]="'translate(' + s.x + ',' + s.y + ')' + (s.vertical ? ' rotate(90)' : '')"></g>
            <text *ngFor="let l of b.drawing.labels" [attr.x]="l.x" [attr.y]="l.y" [attr.text-anchor]="l.anchor" class="label"
                  [class.muted-text]="l.muted">{{ l.text }}</text>
          </g>
          <line *ngFor="let w of v.stubs" [attr.x1]="w.x1" [attr.y1]="w.y1" [attr.x2]="w.x2" [attr.y2]="w.y2" class="wire" [class.red-line]="w.red"></line>
          <rect [attr.x]="v.chipBox.x" [attr.y]="v.chipBox.y" [attr.width]="v.chipBox.w" [attr.height]="v.chipBox.h" class="chip"></rect>
          <text [attr.x]="v.chipBox.x + v.chipBox.w / 2" [attr.y]="v.chipBox.y + 13" text-anchor="middle" class="chip-name">{{ v.chip }}</text>
          <ng-container *ngFor="let p of v.chipPins">
            <circle [attr.cx]="p.x" [attr.cy]="p.y" r="3" class="pin" [class.red-pin]="p.red"></circle>
            <text [attr.x]="p.x + 8" [attr.y]="p.y + 4" class="label">{{ p.pin }}</text>
          </ng-container>
        </svg>
      </section>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .one { padding: 10px 12px; border-radius: 8px; background: var(--surface-primary); color: var(--text-on-card); border: 1px solid var(--border-light);
      box-shadow: var(--card-shadow); margin-bottom: 10px; }
    header { margin-bottom: 4px; overflow-wrap: anywhere; }
    .name { font-weight: 600; }
    .muted { color: var(--text-on-card-muted); }
    .drawing { width: 100%; height: auto; display: block; }
    .wire { stroke: var(--text-on-card); stroke-width: 1.6; fill: none; }
    .symbol { color: var(--text-on-card); }
    .junction, .pin { fill: var(--text-on-card); }
    .red .wire, .wire.red-line { stroke: var(--color-error-text); }
    .red .symbol { color: var(--color-error-text); }
    .red .junction, .pin.red-pin { fill: var(--color-error-text); }
    .chip { fill: var(--surface-secondary); stroke: var(--text-on-card); stroke-width: 1.4; }
    .chip-name { font-size: 11px; font-weight: 600; fill: var(--text-on-card); }
    .title { font-size: 11px; font-weight: 600; fill: var(--text-on-card); }
    .red .title { fill: var(--color-error-text); }
    .label { font-size: 11px; fill: var(--text-on-card); }
    .label.muted-text { fill: var(--text-on-card-muted); }
    .state.error { color: var(--color-error-text); }
  `],
})
export class SolutionSchematicComponent implements OnInit {
  @Input() componentClass = 'SchematicComponent';
  @Input() portClass = 'SchematicComponentPort';
  @Input() partClass = 'SchematicComponentPart';
  @Input() solution = '';

  views: SolutionSchematic[] = [];
  loading = true;
  error: string | null = null;

  constructor(private crude: CRUDEservicesManager) {}

  ngOnInit(): void {
    const read = (cls: string) => this.crude.getCRUDEclassService(cls).readAll();
    forkJoin([read(this.componentClass), read(this.portClass), read(this.partClass)]).subscribe({
      next: ([c, po, pa]) => {
        this.loading = false;
        const comps = crudeRows(c, this.componentClass);
        const ports = crudeRows(po, this.portClass);
        const parts = crudeRows(pa, this.partClass);
        const names = this.solution ? [this.solution] : solutionsOf(comps);
        this.views = names.map((s) => layoutSolution(s, comps, ports, parts)).filter((v) => v.blocks.length > 0);
      },
      error: (err: any) => {
        this.loading = false;
        this.error = `Could not read the schematic components: ${err?.message || 'request failed'}`;
      },
    });
  }
}
