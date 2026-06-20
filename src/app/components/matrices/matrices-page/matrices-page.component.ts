import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule, MatTabChangeEvent } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { MatrixDefinitionService } from '@services/matrix/matrix-definition.service';
import { MatrixElementModifierComponent } from '@components/matrices/matrix-element-modifier/matrix-element-modifier.component';
import { MatrixD3ViewComponent, MatrixLaunchRequest } from '@components/matrices/matrix-d3-view/matrix-d3-view.component';
import { MatrixViewerDialogComponent } from '@components/matrices/matrix-d3-view/matrix-viewer-dialog.component';
import { MatrixEquationsPageComponent } from '@components/matrices/matrix-equations-page/matrix-equations-page.component';
import {
    MatrixComputationKind,
    MatrixDefinitionRecord,
    MatrixDefinitionSummary,
    MatrixElement,
    MatrixEvaluateResponse,
    MatrixValidateResponse,
    elementCountForShape,
    makeEmptyMatrixDefinition,
    makeMatrixElement,
    toMatrixElements,
} from '@models/matrices/MatrixDefinition';

/**
 * Matrices page — author + test matrices, including equation-typed elements
 * and matrix-of-matrices composition.
 *
 * One standalone surface: a list rail on the left, and a tabbed editor
 * (Structure / Values / Computation / Test) on the right. The Test tab calls
 * the live /api/matrices/evaluate endpoint so the math is verifiable in-page.
 */
@Component({
    standalone: true,
    selector: 'matrices-page',
    imports: [
        CommonModule, FormsModule, MatIconModule, MatButtonModule,
        MatTabsModule, MatProgressSpinnerModule, MatTooltipModule, MatDialogModule,
        MatrixElementModifierComponent, MatrixD3ViewComponent,
        MatrixEquationsPageComponent,
    ],
    templateUrl: './matrices-page.component.html',
    styleUrls: ['./matrices-page.component.css'],
})
export class MatricesPageComponent implements OnInit {

    list: MatrixDefinitionSummary[] = [];
    loading = false;

    /** The matrix currently being authored. Null until New/selected. */
    draft: MatrixDefinitionRecord | null = null;
    /** Fresh snapshot fed to the D3 Matrix View (new reference so its
     *  OnChanges fires even though the draft is mutated in place). */
    matrixViewRecord: MatrixDefinitionRecord | null = null;
    /** Comma-separated shape mirror for the Structure tab input. */
    shapeText = '';
    isNew = false;

    /** Test tab. */
    bindingsText = '{}';
    evalResult: MatrixEvaluateResponse | null = null;
    validation: MatrixValidateResponse | null = null;
    busy = false;
    statusMessage = '';
    statusIsError = false;

    constructor(
        private svc: MatrixDefinitionService,
        private cdr: ChangeDetectorRef,
        private dialog: MatDialog,
    ) {}

    /** Open a recursive viewer for a matrix-typed cell launched from the
     *  Matrix View tab. */
    onLaunchMatrix(req: MatrixLaunchRequest): void {
        if (req.ancestry.includes(req.ref)) return;
        this.dialog.open(MatrixViewerDialogComponent, {
            width: 'auto', maxWidth: '95vw', maxHeight: '90vh',
            data: { name: req.ref, ancestry: req.ancestry },
        });
    }

    ngOnInit(): void {
        this.svc.loading$.subscribe(v => { this.loading = v; this.cdr.markForCheck(); });
        this.svc.list$.subscribe(items => { this.list = items; this.cdr.markForCheck(); });
        this.svc.refreshList();
    }

    // ───────────────────────────── selection ────────────────────────────

    newMatrix(): void {
        this.draft = makeEmptyMatrixDefinition();
        this.isNew = true;
        this.shapeText = this.draft.shape.join(', ');
        this.resetTestState();
    }

    select(summary: MatrixDefinitionSummary): void {
        this.busy = true;
        this.svc.getByName(summary.name).subscribe({
            next: rec => {
                this.normalizeLiteralCells(rec);
                this.draft = rec;
                this.isNew = false;
                this.shapeText = rec.shape.join(', ');
                this.resetTestState();
                this.busy = false;
                this.cdr.markForCheck();
            },
            error: err => { this.setStatus(`Load failed: ${err?.message || err}`, true); this.busy = false; }
        });
    }

    closeEditor(): void {
        this.draft = null;
        this.matrixViewRecord = null;
        this.resetTestState();
    }

    /** Snapshot the draft (new object ref) so the D3 Matrix View re-renders
     *  the latest cells when its tab is opened. */
    onTabChange(e: MatTabChangeEvent): void {
        if (e?.tab?.textLabel === 'Matrix View') this.snapshotForView();
    }

    private snapshotForView(): void {
        this.matrixViewRecord = this.draft
            ? { ...this.draft, values: (this.draft.values || []).map(v =>
                (v && typeof v === 'object') ? { ...(v as object) } as any : v) }
            : null;
    }

    // ───────────────────────────── structure ────────────────────────────

    onShapeTextChange(text: string): void {
        if (!this.draft) return;
        this.shapeText = text;
        const dims = text.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0);
        this.draft.shape = dims;
        this.reconcileValuesToShape();
    }

    onComputationKindChange(kind: MatrixComputationKind): void {
        if (!this.draft) return;
        if (kind === 'literal') {
            this.draft.computation = { kind: 'literal' };
            this.reconcileValuesToShape();
        } else if (kind === 'elementwise') {
            this.draft.computation = { kind: 'elementwise', latex: 'x^2', bindings: { x: '' } };
        } else {
            this.draft.computation = { kind: 'matrix_op', expr: 'A @ B', operands: { A: '', B: '' } };
        }
    }

    get computationKind(): MatrixComputationKind {
        return this.draft?.computation?.kind || 'literal';
    }

    /** Normalise a loaded literal matrix's cells (of any stored element type)
     *  into self-describing MatrixElements and flip it to per-cell ('mixed')
     *  so the Matrix View modifier can edit them. Computed matrices are left
     *  alone (they have no per-cell values). */
    private normalizeLiteralCells(rec: MatrixDefinitionRecord): void {
        if (rec.computation?.kind !== 'literal') return;
        const count = elementCountForShape(rec.shape);
        rec.values = toMatrixElements(rec.values, rec.elementType, count);
        rec.elementType = 'mixed';
    }

    /** Pad/truncate the per-cell values to match the shape's element count. */
    private reconcileValuesToShape(): void {
        if (!this.draft || this.draft.computation.kind !== 'literal') return;
        this.draft.elementType = 'mixed';
        const count = elementCountForShape(this.draft.shape);
        const next: MatrixElement[] = [];
        for (let i = 0; i < count; i++) {
            const cur = this.draft.values[i] as MatrixElement;
            next.push(cur && cur.kind ? cur : makeMatrixElement('number'));
        }
        this.draft.values = next;
    }

    // ─────────────────────── matrix view tab helpers ────────────────────

    /** The element at flat index `i` (always a MatrixElement in literal mode). */
    cellAt(i: number): MatrixElement {
        return (this.draft!.values[i] as MatrixElement) || makeMatrixElement('number');
    }

    /** Replace the element at flat index `i` (from the modifier's output). */
    setCell(i: number, element: MatrixElement): void {
        if (!this.draft) return;
        this.draft.values[i] = element;
    }

    /** Row indices for a 2-D grid layout (shape [r, c]); empty otherwise. */
    get gridRows(): number[] {
        if (this.draft && this.draft.shape.length === 2) {
            return Array.from({ length: this.draft.shape[0] }, (_, i) => i);
        }
        return [];
    }
    get gridCols(): number[] {
        if (this.draft && this.draft.shape.length === 2) {
            return Array.from({ length: this.draft.shape[1] }, (_, i) => i);
        }
        return [];
    }
    get isGrid(): boolean { return !!this.draft && this.draft.shape.length === 2; }

    /** Flat index for (row, col) in a 2-D layout. */
    flatIndex(r: number, c: number): number {
        return r * (this.draft!.shape[1] || 1) + c;
    }

    get flatIndices(): number[] {
        return this.draft ? this.draft.values.map((_, i) => i) : [];
    }

    /** Names available to reference as sub-matrices / operands (excludes self). */
    get referenceableNames(): string[] {
        const self = this.draft?.name;
        return this.list.map(m => m.name).filter(n => n && n !== self);
    }

    // ───────────────────── computation tab helpers ──────────────────────

    get ewLatex(): string {
        const c = this.draft?.computation;
        return c && c.kind === 'elementwise' ? (c.latex || '') : '';
    }
    set ewLatex(v: string) {
        const c = this.draft?.computation;
        if (c && c.kind === 'elementwise') c.latex = v;
    }
    get ewEquationRef(): string {
        const c = this.draft?.computation;
        return c && c.kind === 'elementwise' ? (c.equationRef || '') : '';
    }
    set ewEquationRef(v: string) {
        const c = this.draft?.computation;
        if (c && c.kind === 'elementwise') c.equationRef = v || undefined;
    }
    get opExpr(): string {
        const c = this.draft?.computation;
        return c && c.kind === 'matrix_op' ? (c.expr || '') : '';
    }
    set opExpr(v: string) {
        const c = this.draft?.computation;
        if (c && c.kind === 'matrix_op') c.expr = v;
    }

    elementwiseBindingsText(): string {
        const c = this.draft?.computation;
        if (c && c.kind === 'elementwise') { try { return JSON.stringify(c.bindings || {}); } catch { return '{}'; } }
        return '{}';
    }
    setElementwiseBindings(text: string): void {
        const c = this.draft?.computation;
        if (c && c.kind === 'elementwise') { try { c.bindings = JSON.parse(text || '{}'); } catch { /* keep */ } }
    }
    operandsText(): string {
        const c = this.draft?.computation;
        if (c && c.kind === 'matrix_op') { try { return JSON.stringify(c.operands || {}); } catch { return '{}'; } }
        return '{}';
    }
    setOperands(text: string): void {
        const c = this.draft?.computation;
        if (c && c.kind === 'matrix_op') { try { c.operands = JSON.parse(text || '{}'); } catch { /* keep */ } }
    }

    // ──────────────────────────── persistence ───────────────────────────

    saveDraft(): void {
        if (!this.draft) return;
        if (!this.draft.name.trim()) { this.setStatus('Name is required.', true); return; }
        this.busy = true;
        const op = this.isNew ? this.svc.create(this.draft) : this.svc.save(this.draft);
        op.subscribe({
            next: () => {
                this.isNew = false;
                this.setStatus('Saved.', false);
                this.busy = false;
                this.cdr.markForCheck();
            },
            error: err => { this.setStatus(`Save failed: ${err?.message || err}`, true); this.busy = false; }
        });
    }

    deleteDraft(): void {
        if (!this.draft || this.isNew) return;
        this.busy = true;
        this.svc.delete(this.draft.id).subscribe({
            next: () => { this.setStatus('Deleted.', false); this.draft = null; this.busy = false; this.cdr.markForCheck(); },
            error: err => { this.setStatus(`Delete failed: ${err?.message || err}`, true); this.busy = false; }
        });
    }

    // ──────────────────────────── test tab ──────────────────────────────

    async runEvaluate(): Promise<void> {
        if (!this.draft) return;
        let bindings: any = {};
        try { bindings = JSON.parse(this.bindingsText || '{}'); }
        catch { this.setStatus('Bindings must be valid JSON.', true); return; }
        this.busy = true;
        this.evalResult = null;
        try {
            this.evalResult = await this.svc.evaluateInline(this.draft, bindings);
            if (!this.evalResult.success) this.setStatus(this.evalResult.error || 'Evaluation failed.', true);
            else this.setStatus(`Evaluated → shape [${this.evalResult.shape.join(' × ')}]`, false);
        } catch (err: any) {
            const msg = err?.error?.error || err?.message || String(err);
            this.setStatus(`Evaluation failed: ${msg}`, true);
        } finally {
            this.busy = false;
            this.cdr.markForCheck();
        }
    }

    async runValidate(): Promise<void> {
        if (!this.draft) return;
        this.busy = true;
        this.validation = null;
        try {
            this.validation = await this.svc.validateInline(this.draft);
            this.setStatus(this.validation.valid ? 'Valid.' : 'Invalid — see messages below.', !this.validation.valid);
        } catch (err: any) {
            this.setStatus(`Validate failed: ${err?.message || err}`, true);
        } finally {
            this.busy = false;
            this.cdr.markForCheck();
        }
    }

    /** Normalise the API's nested-array result to a 2-D grid for display. */
    get resultRows(): any[][] {
        const data = this.evalResult?.data;
        if (data === null || data === undefined) return [];
        if (!Array.isArray(data)) return [[data]];                 // scalar
        if (data.length && !Array.isArray(data[0])) return [data]; // 1-D → one row
        return data as any[][];                                    // 2-D
    }
    get resultIsHigherRank(): boolean {
        const data = this.evalResult?.data;
        return Array.isArray(data) && data.length > 0 && Array.isArray(data[0]) && Array.isArray(data[0][0]);
    }

    // ───────────────────────────── helpers ──────────────────────────────

    private resetTestState(): void {
        this.bindingsText = '{}';
        this.evalResult = null;
        this.validation = null;
        this.statusMessage = '';
    }

    private setStatus(msg: string, isError: boolean): void {
        this.statusMessage = msg;
        this.statusIsError = isError;
        this.cdr.markForCheck();
    }

    trackByIndex(i: number): number { return i; }
}
