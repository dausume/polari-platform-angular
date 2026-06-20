import {
    AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component,
    ElementRef, EventEmitter, Input, OnChanges, Output, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as d3 from 'd3';

import { MatrixElementViewComponent } from './matrix-element-view.component';
import { EquationDefinitionService } from '@services/equation/equation-definition.service';
import {
    MatrixDefinitionRecord, MatrixElement, elementCountForShape, toMatrixElements,
} from '@models/matrices/MatrixDefinition';

interface CellPos {
    i: number;
    x: number; y: number; w: number; h: number;
    el: MatrixElement;
    resolvedLatex: string;   // for equation-ref cells
    isCycle: boolean;        // for matrix cells whose ref is an ancestor
}

/** Emitted when a matrix cell asks to open a sub-matrix viewer. `ancestry`
 *  is the chain of matrix names from the root down to (and including) the one
 *  that owns the cell, used to block recursive opens. */
export interface MatrixLaunchRequest {
    ref: string;
    ancestry: string[];
}

const CELL_W = 108;
const CELL_H = 60;
const GAP = 10;
const PAD = 14;
const BW = 10;
const BGAP = 14;
const LINE_X = 4;

/** Equation name → LaTeX, loaded once and shared across all view instances
 *  (including nested viewers) so refs render without per-cell fetches. */
let EQ_LATEX_CACHE: Map<string, string> | null = null;

/**
 * Pretty, read-only D3 rendering of a literal matrix: D3 draws the enclosing
 * brackets; each cell hosts a Matrix Element View overlay. Equations render as
 * KaTeX (saved refs resolved to their LaTeX); matrix cells launch a sub-matrix
 * viewer, with ancestry-based cycle guarding.
 */
@Component({
    standalone: true,
    selector: 'matrix-d3-view',
    imports: [CommonModule, MatrixElementViewComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="md3" *ngIf="supported; else unsupportedTpl">
            <div class="canvas" [style.width.px]="svgWidth" [style.height.px]="svgHeight">
                <svg #svg class="brackets" [attr.width]="svgWidth" [attr.height]="svgHeight"></svg>
                <div class="cell-overlay" *ngFor="let c of positions; trackBy: trackByI"
                     [style.left.px]="c.x" [style.top.px]="c.y"
                     [style.width.px]="c.w" [style.height.px]="c.h">
                    <matrix-element-view
                        [element]="c.el"
                        [equationLatex]="c.resolvedLatex"
                        [matrixIsCycle]="c.isCycle"
                        (launch)="onCellLaunch($event)">
                    </matrix-element-view>
                </div>
            </div>
            <div class="caption muted" *ngIf="record">
                {{ record.name || '(unnamed)' }} &middot; [{{ shapeLabel }}]
            </div>
        </div>
        <ng-template #unsupportedTpl>
            <p class="note muted">{{ unsupportedReason }}</p>
        </ng-template>
    `,
    styles: [`
        .md3 { padding: 16px; overflow: auto; }
        .canvas { position: relative; }
        .brackets { position: absolute; left: 0; top: 0; pointer-events: none; }
        .cell-overlay {
            position: absolute;
            border: 1px solid #e3e8f0;
            border-radius: 6px;
            background: #ffffff;
            box-shadow: 0 1px 2px rgba(16, 42, 90, 0.05);
            display: flex; align-items: center; justify-content: center;
            padding: 4px; box-sizing: border-box;
        }
        .caption { margin-top: 10px; font-family: monospace; font-size: 12px; }
        .note { padding: 16px; }
        .muted { color: #8a94a6; }
    `]
})
export class MatrixD3ViewComponent implements OnChanges, AfterViewInit {
    @Input() record: MatrixDefinitionRecord | null = null;
    /** Chain of ancestor matrix names (root → parent). Guards cycles. */
    @Input() ancestry: string[] = [];
    @Output() launchMatrix = new EventEmitter<MatrixLaunchRequest>();

    @ViewChild('svg') svgRef?: ElementRef<SVGSVGElement>;

    supported = false;
    unsupportedReason = '';
    positions: CellPos[] = [];
    svgWidth = 0;
    svgHeight = 0;
    shapeLabel = '';

    private viewReady = false;

    constructor(private cdr: ChangeDetectorRef, private equationSvc: EquationDefinitionService) {}

    ngOnChanges(): void {
        this.layout();
        this.cdr.markForCheck();
        queueMicrotask(() => this.draw());
        this.resolveEquationLatex();
    }

    ngAfterViewInit(): void {
        this.viewReady = true;
        this.draw();
    }

    trackByI(_: number, c: CellPos): number { return c.i; }

    onCellLaunch(ref: string): void {
        const here = this.record?.name || '';
        this.launchMatrix.emit({ ref, ancestry: [...this.ancestry, here] });
    }

    // ─────────────────────────── layout ───────────────────────────

    private layout(): void {
        this.positions = [];
        this.supported = false;
        const rec = this.record;
        if (!rec) { this.unsupportedReason = 'Select a matrix to view.'; return; }
        if (rec.computation?.kind && rec.computation.kind !== 'literal') {
            this.unsupportedReason =
                'This matrix is computed (elementwise / matrix op). Use the Test tab to evaluate it.';
            return;
        }
        const shape = rec.shape || [];
        let rows: number, cols: number;
        if (shape.length === 2) { rows = shape[0]; cols = shape[1]; }
        else if (shape.length === 1) { rows = shape[0]; cols = 1; }
        else { this.unsupportedReason = 'Visual view supports vectors and 2-D matrices only.'; return; }
        if (rows <= 0 || cols <= 0) { this.unsupportedReason = 'Set a shape first.'; return; }

        this.shapeLabel = shape.join(' × ');
        const count = elementCountForShape(shape);
        const cells = toMatrixElements(rec.values || [], rec.elementType, count);
        const selfName = rec.name || '';

        const cellsX0 = LINE_X + BW + BGAP;
        const gridW = cols * CELL_W + (cols - 1) * GAP;
        const gridH = rows * CELL_H + (rows - 1) * GAP;
        this.svgWidth = cellsX0 + gridW + BGAP + BW + LINE_X;
        this.svgHeight = PAD * 2 + gridH;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const i = r * cols + c;
                const el = cells[i];
                const ref = el?.kind === 'matrix' ? (el.matrixRef || '') : '';
                const isCycle = !!ref && (ref === selfName || this.ancestry.includes(ref));
                this.positions.push({
                    i,
                    x: cellsX0 + c * (CELL_W + GAP),
                    y: PAD + r * (CELL_H + GAP),
                    w: CELL_W, h: CELL_H,
                    el,
                    resolvedLatex: this.lookupLatex(el),
                    isCycle,
                });
            }
        }
        this.supported = true;
    }

    // ─────────────────────── equation latex resolution ───────────────────────

    private lookupLatex(el: MatrixElement): string {
        if (el?.kind === 'equation' && !el.latex && el.equationRef && EQ_LATEX_CACHE) {
            return EQ_LATEX_CACHE.get(el.equationRef) || '';
        }
        return '';
    }

    /** Lazily load the equation LaTeX map (once), then re-resolve refs. */
    private resolveEquationLatex(): void {
        const needsRefs = this.positions.some(
            p => p.el?.kind === 'equation' && !p.el.latex && p.el.equationRef);
        if (!needsRefs) return;
        if (EQ_LATEX_CACHE) { this.applyLatex(); return; }
        this.equationSvc.getAllRecords().subscribe({
            next: recs => {
                EQ_LATEX_CACHE = new Map(recs.map(r => [r.name, r.definition?.latexExpression || '']));
                this.applyLatex();
            },
            error: () => { /* leave refs unrendered on failure */ },
        });
    }

    private applyLatex(): void {
        for (const p of this.positions) p.resolvedLatex = this.lookupLatex(p.el);
        this.cdr.markForCheck();
    }

    // ─────────────────────────── d3 draw ───────────────────────────

    private draw(): void {
        if (!this.viewReady || !this.supported || !this.svgRef) return;
        const svg = d3.select(this.svgRef.nativeElement);
        svg.selectAll('*').remove();

        const top = 6;
        const bottom = this.svgHeight - 6;
        const rightLineX = this.svgWidth - LINE_X;
        const leftPath =
            `M ${LINE_X + BW} ${top} L ${LINE_X} ${top} L ${LINE_X} ${bottom} L ${LINE_X + BW} ${bottom}`;
        const rightPath =
            `M ${rightLineX - BW} ${top} L ${rightLineX} ${top} L ${rightLineX} ${bottom} L ${rightLineX - BW} ${bottom}`;

        for (const d of [leftPath, rightPath]) {
            svg.append('path').attr('d', d)
                .attr('fill', 'none').attr('stroke', '#14233f')
                .attr('stroke-width', 3).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round');
        }
    }
}
