import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { KatexDisplayComponent } from '@components/shared/katex-display/katex-display.component';
import { MatrixGridCellComponent } from '@components/shared/matrix-grid-cell/matrix-grid-cell.component';
import { MatrixD3ViewComponent } from '@components/matrices/matrix-d3-view/matrix-d3-view.component';
import { MatrixOpPaletteComponent } from '@components/matrices/matrix-op-palette/matrix-op-palette.component';
import { MatrixEditDialogComponent } from '@components/matrices/matrix-edit-dialog/matrix-edit-dialog.component';
import {
    LatexEditDialogComponent, LatexEditDialogResult,
} from '@components/shared/latex-edit-dialog/latex-edit-dialog';

import { MatrixEquationService } from '@services/matrix/matrix-equation.service';
import { MatrixDefinitionService } from '@services/matrix/matrix-definition.service';
import { EquationDefinitionService } from '@services/equation/equation-definition.service';
import { MatrixDefinitionRecord, MatrixEvaluateResponse } from '@models/matrices/MatrixDefinition';
import { MatrixOpPaletteEntry } from '@models/matrices/MatrixOpPalette';
import {
    MATRIX_EQUATION_KINDS, MATRIX_NOTATIONS, MATRIX_NOTATION_LABELS, OP_META, OpSlot,
    MatrixEquationOperand, MatrixEquationOperandKind, MatrixEquationOperationKind,
    MatrixEquationRecord, MatrixEquationSummary, MatrixEquationValidateResponse,
    MatrixNotation, Styler,
    defaultOperandsFor, defaultOperationFor, exprToLatex, makeEmptyMatrixEquation, styledSymbol,
} from '@models/matrices/MatrixEquationDefinition';

/**
 * Matrix Equations surface — author + evaluate operations over matrices,
 * matrix-equations, and scalar equations. Renders the equation with KaTeX,
 * embeds matrix previews for matrix-typed operands, and evaluates live.
 */
@Component({
    standalone: true,
    selector: 'matrix-equations-page',
    imports: [
        CommonModule, FormsModule, MatIconModule, MatButtonModule,
        MatProgressSpinnerModule, MatTooltipModule, MatDialogModule,
        KatexDisplayComponent, MatrixGridCellComponent, MatrixD3ViewComponent,
        MatrixOpPaletteComponent,
    ],
    templateUrl: './matrix-equations-page.component.html',
    styleUrls: ['./matrix-equations-page.component.css'],
})
export class MatrixEquationsPageComponent implements OnInit {

    readonly kinds = MATRIX_EQUATION_KINDS;
    readonly opMeta = OP_META;
    readonly notations = MATRIX_NOTATIONS;
    readonly notationLabels = MATRIX_NOTATION_LABELS;
    /** Structured single-operation kinds (everything except the Expression). */
    readonly operationKinds = MATRIX_EQUATION_KINDS.filter(k => OP_META[k].operation);

    @ViewChild('exprArea') exprArea?: ElementRef<HTMLTextAreaElement>;

    list: MatrixEquationSummary[] = [];
    loading = false;

    draft: MatrixEquationRecord | null = null;
    isNew = false;

    matrixNames: string[] = [];
    equationNames: string[] = [];
    matrixEquationNames: string[] = [];

    /** Cache of loaded matrix records by name (key present = fetched/in-flight). */
    private matrixCache: { [name: string]: MatrixDefinitionRecord } = {};
    /** Resolved preview record per operand symbol (read by the template; never
     *  fetches — populated by refreshPreviews so change detection is pure). */
    previews: { [symbol: string]: MatrixDefinitionRecord } = {};

    evalResult: MatrixEvaluateResponse | null = null;
    validation: MatrixEquationValidateResponse | null = null;
    busy = false;
    statusMessage = '';
    statusIsError = false;

    constructor(
        private svc: MatrixEquationService,
        private matrixSvc: MatrixDefinitionService,
        private equationSvc: EquationDefinitionService,
        private dialog: MatDialog,
        private cdr: ChangeDetectorRef,
    ) {}

    ngOnInit(): void {
        this.svc.loading$.subscribe(v => { this.loading = v; this.cdr.markForCheck(); });
        this.svc.list$.subscribe(items => {
            this.list = items;
            this.matrixEquationNames = items.map(i => i.name);
            this.cdr.markForCheck();
        });
        this.matrixSvc.list$.subscribe(items => { this.matrixNames = items.map(i => i.name); this.cdr.markForCheck(); });
        this.equationSvc.allConfigList$.subscribe(items => { this.equationNames = items.map(i => i.name); this.cdr.markForCheck(); });
        this.svc.refreshList();
        this.matrixSvc.refreshList();
        this.equationSvc.fetchAllConfigs();
    }

    // ─────────────────────────── selection ───────────────────────────

    newEquation(): void {
        this.draft = makeEmptyMatrixEquation();
        this.isNew = true;
        this.resetEval();
        this.refreshPreviews();
    }

    select(s: MatrixEquationSummary): void {
        this.busy = true;
        this.svc.getByName(s.name).subscribe({
            next: rec => { this.draft = rec; this.isNew = false; this.resetEval(); this.refreshPreviews(); this.busy = false; this.cdr.markForCheck(); },
            error: err => { this.setStatus(`Load failed: ${err?.message || err}`, true); this.busy = false; }
        });
    }

    closeEditor(): void { this.draft = null; this.resetEval(); }

    // ─────────────────────────── operation ───────────────────────────

    get currentMeta() { return this.draft ? this.opMeta[this.draft.operation.kind] : null; }

    onKindChange(kind: MatrixEquationOperationKind): void {
        if (!this.draft) return;
        this.draft.operation = defaultOperationFor(kind);
        this.draft.operands = defaultOperandsFor(kind);
        this.regenLatex();
        this.refreshPreviews();
    }

    /** Operand symbols to render rows for. For structured operations these are
     *  the operation's CURRENT slot symbols (so renames are reflected). */
    get operandSymbols(): string[] {
        if (!this.draft) return [];
        const meta = this.currentMeta!;
        if (meta.expr) return Object.keys(this.draft.operands);
        const op: any = this.draft.operation;
        return meta.slots.map(s => op[s.key]).filter((v: any) => !!v);
    }

    /** The slot a current symbol fills (matched via the operation's refs). */
    slotFor(symbol: string): OpSlot | null {
        const meta = this.currentMeta;
        if (!meta || !this.draft) return null;
        const op: any = this.draft.operation;
        return meta.slots.find(s => op[s.key] === symbol) || null;
    }

    operand(symbol: string): MatrixEquationOperand {
        if (!this.draft) return { kind: 'matrix', ref: '' };
        if (!this.draft.operands[symbol]) this.draft.operands[symbol] = { kind: 'matrix', ref: '', notation: 'bold' };
        return this.draft.operands[symbol];
    }

    setOperandKind(symbol: string, kind: MatrixEquationOperandKind): void {
        const o = this.operand(symbol);
        o.kind = kind;
        if (kind === 'scalar') { o.ref = undefined; if (o.value === undefined) o.value = 1; }
        else { o.value = undefined; if (o.ref === undefined) o.ref = ''; if (!o.notation) o.notation = 'bold'; }
        this.regenLatex();
        this.refreshPreviews();
    }

    setOperandRef(symbol: string, ref: string): void { this.operand(symbol).ref = ref; this.regenLatex(); this.refreshPreviews(); }
    setOperandScalar(symbol: string, value: any): void { this.operand(symbol).value = Number(value); }
    setOperandNotation(symbol: string, n: MatrixNotation): void { this.operand(symbol).notation = n; this.regenLatex(); }

    /** Rename an operand's symbol — re-keys the operands map, updates the
     *  operation's slot refs, and (in expr mode) the expression text. Bound to
     *  the input's (change) event so it fires on blur, not per keystroke. */
    setOperandSymbol(oldSym: string, raw: string): void {
        if (!this.draft) return;
        const newSym = (raw || '').trim();
        if (!newSym || newSym === oldSym || this.draft.operands[newSym]) return;
        this.draft.operands[newSym] = this.draft.operands[oldSym];
        delete this.draft.operands[oldSym];
        const op: any = this.draft.operation;
        for (const k of ['a', 'b', 'scalar', 'n']) if (op[k] === oldSym) op[k] = newSym;
        if (op.kind === 'expr' && op.expr) {
            op.expr = op.expr.replace(new RegExp('\\b' + this.escapeRe(oldSym) + '\\b', 'g'), newSym);
        }
        this.regenLatex();
        this.refreshPreviews();
    }

    /** Operand kinds allowed for a slot, based on its role (expr = all). */
    allowedKinds(symbol: string): MatrixEquationOperandKind[] {
        const slot = this.slotFor(symbol);
        if (!slot) return ['matrix', 'matrixEquation', 'equation', 'scalar'];
        if (slot.role === 'matrix') return ['matrix', 'matrixEquation'];
        return ['scalar', 'equation'];
    }

    /** Whether this operand shows a notation dropdown (matrix-valued only). */
    hasNotation(symbol: string): boolean {
        const k = this.operand(symbol).kind;
        return k === 'matrix' || k === 'matrixEquation';
    }

    namesFor(kind: MatrixEquationOperandKind): string[] {
        if (kind === 'matrix') return this.matrixNames;
        if (kind === 'matrixEquation') return this.matrixEquationNames.filter(n => n !== this.draft?.name);
        if (kind === 'equation') return this.equationNames;
        return [];
    }

    // expr operand add/remove
    addExprOperand(): void {
        if (!this.draft) return;
        const letters = 'ABCDEFGHIJ'.split('');
        const sym = letters.find(l => !(l in this.draft!.operands)) || ('v' + Object.keys(this.draft.operands).length);
        this.draft.operands[sym] = { kind: 'matrix', ref: '', notation: 'bold' };
    }
    removeExprOperand(symbol: string): void { if (this.draft) { delete this.draft.operands[symbol]; this.refreshPreviews(); } }

    // ─────────────────────────── expression palette ───────────────────────────

    onExprChange(value: string): void {
        if (!this.draft) return;
        this.draft.operation.expr = value;
        this.regenLatex();
    }

    /** Insert a palette snippet at the caret of the expression textarea. */
    insertOp(entry: MatrixOpPaletteEntry): void {
        if (!this.draft) return;
        const ta = this.exprArea?.nativeElement;
        if (!ta) {
            this.draft.operation.expr = (this.draft.operation.expr || '') + entry.snippet;
            this.regenLatex();
            return;
        }
        const start = ta.selectionStart ?? ta.value.length;
        const end = ta.selectionEnd ?? start;
        const next = ta.value.slice(0, start) + entry.snippet + ta.value.slice(end);
        const caret = start + entry.snippet.length - (entry.cursorOffset || 0);
        this.draft.operation.expr = next;
        this.regenLatex();
        this.cdr.markForCheck();
        setTimeout(() => { ta.focus(); ta.setSelectionRange(caret, caret); });
    }

    private escapeRe(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

    // ─────────────────────────── latex ───────────────────────────

    /** Styler closure: maps an operand symbol to its notation-styled LaTeX. */
    private styler(): Styler {
        const ops = this.draft?.operands || {};
        return (sym?: string) => styledSymbol(sym || 'A', ops[sym || '']?.notation || 'bold');
    }

    regenLatex(): void {
        if (!this.draft) return;
        const sty = this.styler();
        const op = this.draft.operation;
        this.draft.latex = op.kind === 'expr'
            ? exprToLatex(op.expr || '', sty, Object.keys(this.draft.operands))
            : this.opMeta[op.kind].latex(op, sty);
    }

    editLatex(): void {
        if (!this.draft) return;
        const ref = this.dialog.open(LatexEditDialogComponent, {
            width: '880px', maxWidth: '95vw', maxHeight: '90vh', autoFocus: true,
            data: { latex: this.draft.latex || '', title: 'Edit equation LaTeX', subtitle: 'Display only — the operation drives evaluation.' },
        });
        ref.afterClosed().subscribe((r: LatexEditDialogResult | undefined) => {
            if (r?.action === 'save' && this.draft) { this.draft.latex = r.latex || ''; this.cdr.markForCheck(); }
        });
    }

    // ─────────────────────── matrix operand preview ───────────────────────

    /** Rebuild the per-symbol preview map. Fetches each referenced matrix at
     *  most once (key-presence guard, NOT truthiness — the in-flight marker is
     *  null). Called on selection/operation/operand changes — never from the
     *  template, so change detection stays side-effect-free. */
    private refreshPreviews(): void {
        if (!this.draft) { this.previews = {}; return; }
        const next: { [s: string]: MatrixDefinitionRecord } = {};
        for (const sym of this.operandSymbols) {
            const o = this.draft.operands[sym];
            if (!o || o.kind !== 'matrix' || !o.ref) continue;
            const ref = o.ref;
            if (this.matrixCache[ref]) {
                next[sym] = this.matrixCache[ref];
            } else if (!(ref in this.matrixCache)) {
                this.matrixCache[ref] = null as any;   // in-flight marker (key present → no refetch)
                this.matrixSvc.getByName(ref).subscribe({
                    next: rec => { this.matrixCache[ref] = rec; this.refreshPreviews(); this.cdr.markForCheck(); },
                    error: () => { delete this.matrixCache[ref]; },
                });
            }
        }
        this.previews = next;
    }

    /** Open the quick-edit popup (same per-cell grid as the Matrices tab) for a
     *  matrix-typed operand; refresh its preview on save. */
    openMatrixEdit(symbol: string): void {
        const o = this.draft?.operands[symbol];
        if (!o || o.kind !== 'matrix' || !o.ref) return;
        const ref = o.ref;
        this.dialog.open(MatrixEditDialogComponent, {
            width: 'auto', maxWidth: '95vw', maxHeight: '90vh', data: { name: ref },
        }).afterClosed().subscribe(saved => {
            if (saved) { delete this.matrixCache[ref]; this.refreshPreviews(); this.cdr.markForCheck(); }
        });
    }

    // ─────────────────────────── persistence ───────────────────────────

    save(): void {
        if (!this.draft) return;
        if (!this.draft.name.trim()) { this.setStatus('Name is required.', true); return; }
        this.busy = true;
        const op = this.isNew ? this.svc.create(this.draft) : this.svc.save(this.draft);
        op.subscribe({
            next: () => { this.isNew = false; this.setStatus('Saved.', false); this.busy = false; this.cdr.markForCheck(); },
            error: err => { this.setStatus(`Save failed: ${err?.message || err}`, true); this.busy = false; }
        });
    }

    deleteEq(): void {
        if (!this.draft || this.isNew) return;
        this.busy = true;
        this.svc.delete(this.draft.id).subscribe({
            next: () => { this.setStatus('Deleted.', false); this.draft = null; this.busy = false; this.cdr.markForCheck(); },
            error: err => { this.setStatus(`Delete failed: ${err?.message || err}`, true); this.busy = false; }
        });
    }

    // ─────────────────────────── evaluate ───────────────────────────

    async evaluate(): Promise<void> {
        if (!this.draft) return;
        this.busy = true; this.evalResult = null;
        try {
            this.evalResult = await this.svc.evaluateInline(this.draft);
            if (!this.evalResult.success) this.setStatus(this.evalResult.error || 'Evaluation failed.', true);
            else this.setStatus(`Evaluated → shape [${this.evalResult.shape.join(' × ')}]`, false);
        } catch (err: any) {
            this.setStatus(`Evaluation failed: ${err?.error?.error || err?.message || err}`, true);
        } finally { this.busy = false; this.cdr.markForCheck(); }
    }

    async validate(): Promise<void> {
        if (!this.draft) return;
        this.busy = true; this.validation = null;
        try {
            this.validation = await this.svc.validateInline(this.draft);
            this.setStatus(this.validation.valid ? 'Valid.' : 'Invalid — see below.', !this.validation.valid);
        } catch (err: any) { this.setStatus(`Validate failed: ${err?.message || err}`, true); }
        finally { this.busy = false; this.cdr.markForCheck(); }
    }

    get resultRows(): any[][] {
        const data = this.evalResult?.data;
        if (data === null || data === undefined) return [];
        if (!Array.isArray(data)) return [[data]];
        if (data.length && !Array.isArray(data[0])) return [data];
        return data as any[][];
    }
    get resultIsHigherRank(): boolean {
        const d = this.evalResult?.data;
        return Array.isArray(d) && d.length > 0 && Array.isArray(d[0]) && Array.isArray(d[0][0]);
    }

    // ─────────────────────────── helpers ───────────────────────────

    private resetEval(): void { this.evalResult = null; this.validation = null; this.statusMessage = ''; }
    private setStatus(m: string, e: boolean): void { this.statusMessage = m; this.statusIsError = e; this.cdr.markForCheck(); }
    trackByIndex(i: number): number { return i; }
    trackBySym(_: number, s: string): string { return s; }
}
