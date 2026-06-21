// Author: Dustin Etts
// run-matrix-equation-overlay.component.ts
//
// State overlay for the MatrixEquationOperation no-code state. Loads the
// picked MatrixEquationDefinition, reads its declared operand symbols
// (Object.keys(record.operands)), and renders one
// <matrix-operand-source-editor> per symbol. Each editor binds an operand to a
// concrete RUNTIME source available in the hosting state-space — a sim field,
// an upstream variable, a literal, an ASSEMBLED VECTOR (the `array` source
// kind), or a LaTeX expression.
//
// Mirrors RunEquationOverlayComponent (CalculusOperation) in structure and the
// three size tiers, but:
//   • uses MatrixEquationService instead of EquationDefinitionService,
//   • derives operands from the equation's `operands` dict,
//   • adds live resolved-value display sourced from the stepped-execution trace
//     (SolutionExecutionService.executionTrace$), degrading gracefully to "—"
//     when no run is loaded.
//
// Distinct visual identity from Calculus: green accent (#81C784), `view_module`
// icon.

import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { Subscription } from 'rxjs';

import { StateOverlayBase } from '../../_shared/state-overlay/state-overlay-base';
import {
    AvailableInput,
    SourceObjectField,
} from '../../../shared/value-source-selector/value-source-selector.component';
import { getSourceLabel } from '@models/stateSpace';

import { MatrixEquationService } from '@services/matrix/matrix-equation.service';
import {
    MatrixEquationRecord,
    MatrixEquationSummary,
} from '@models/matrices/MatrixEquationDefinition';
import {
    ExecutionStepSnapshot,
    ExecutionTrace,
} from '@models/noCode/ExecutionTrace';
import { SolutionExecutionService } from '@services/no-code-services/solution-execution.service';

import {
    RunMatrixEquationConfig,
    RunMatrixEquationOperandBinding,
    MatrixValueSourceConfig,
    makeEmptyRunMatrixEquationConfig,
} from '../run-matrix-equation/run-matrix-equation.model';

@Component({
    standalone: false,
    selector: 'run-matrix-equation-overlay',
    templateUrl: './run-matrix-equation-overlay.component.html',
    styleUrls: ['./run-matrix-equation-overlay.component.css'],
})
export class RunMatrixEquationOverlayComponent extends StateOverlayBase implements OnInit, OnDestroy {

    @Input() boundClassName: string = 'MatrixEquationOperation';
    @Input() boundObjectFieldValues: { [key: string]: any } | null = null;
    @Input() availableInputs: AvailableInput[] = [];
    @Input() sourceObjectFields: SourceObjectField[] = [];

    @Output() fieldValuesChanged = new EventEmitter<{ [key: string]: any }>();

    /** Inline expand button is always shown — opens the canonical full-page
     *  popup edit surface (createMatrixEquationOperationOverlay wires it). */
    override hasPopupView: boolean = true;

    config: RunMatrixEquationConfig = makeEmptyRunMatrixEquationConfig();

    /** All matrix equations — drives the picker dropdown. */
    equations: MatrixEquationSummary[] = [];

    /** Loaded matrix-equation definition — used to discover declared operand
     *  symbols so we render the right number of operand source editors. */
    equation: MatrixEquationRecord | null = null;
    loadingEquation: boolean = false;
    loadError: string | null = null;

    /** Latest execution snapshot for THIS state (live resolved values). */
    private latestSnapshot: ExecutionStepSnapshot | null = null;

    private subs: Subscription[] = [];

    constructor(
        private matrixEquationService: MatrixEquationService,
        private executionService: SolutionExecutionService,
    ) {
        super();
    }

    override ngOnInit(): void {
        super.ngOnInit();
        this.initializeFromInputs();

        // Populate the picker.
        this.subs.push(
            this.matrixEquationService.list$.subscribe(list => {
                this.equations = list || [];
            }),
        );
        this.matrixEquationService.refreshList();

        // Subscribe to the live execution trace so operand/result rows can show
        // their resolved values. Isolated + defensive: any failure here must
        // not break the editor.
        this.subs.push(
            this.executionService.executionTrace$.subscribe(trace => {
                this.refreshLatestSnapshot(trace);
            }),
        );

        if (this.config.matrixEquationName) {
            this.loadEquationByName(this.config.matrixEquationName);
        }
    }

    ngOnDestroy(): void {
        this.subs.forEach(s => s.unsubscribe());
    }

    private initializeFromInputs(): void {
        const bofv = this.boundObjectFieldValues || {};
        if (bofv['matrixEquationName']) this.config.matrixEquationName = bofv['matrixEquationName'];
        if (Array.isArray(bofv['operandBindings'])) this.config.operandBindings = bofv['operandBindings'];
        if (bofv['resultTarget']) this.config.resultTarget = bofv['resultTarget'];
        if (bofv['resultVariableName']) this.config.resultVariableName = bofv['resultVariableName'];
        if (bofv['resultFieldPath']) this.config.resultFieldPath = bofv['resultFieldPath'];
        if (bofv['displayName']) this.config.displayName = bofv['displayName'];
    }

    // ── Equation loading ──────────────────────────────────────────────────

    /** Load by name — the canonical cross-reference (stable across re-seeds). */
    private loadEquationByName(name: string): void {
        if (!name) return;
        this.loadingEquation = true;
        this.loadError = null;
        this.subs.push(
            this.matrixEquationService.getByName(name).subscribe({
                next: rec => {
                    this.equation = rec;
                    this.config.matrixEquationName = rec.name;
                    this.loadingEquation = false;
                    this.reconcileBindings();
                },
                error: err => {
                    this.equation = null;
                    this.loadingEquation = false;
                    this.loadError = err?.message || String(err);
                },
            }),
        );
    }

    /** Drop any operand bindings for symbols the chosen equation no longer
     *  declares. We never pre-seed entries — a binding row stays empty until
     *  the user edits it, mirroring run-equation-overlay. */
    private reconcileBindings(): void {
        if (!this.equation) return;
        const declared = new Set(this.declaredSymbols);
        const before = this.config.operandBindings.length;
        this.config.operandBindings = this.config.operandBindings.filter(b => declared.has(b.symbol));
        if (this.config.operandBindings.length !== before) this.emitChange();
    }

    // ── Picker ────────────────────────────────────────────────────────────

    onPickEquation(name: string): void {
        if (!name) return;
        this.config.matrixEquationName = name;
        this.config.operandBindings = [];
        this.equation = null;
        this.loadEquationByName(name);
        this.emitChange();
    }

    clearEquation(): void {
        this.config.matrixEquationName = '';
        this.config.operandBindings = [];
        this.equation = null;
        this.emitChange();
    }

    /** Whether the configured equation is present in the (async-loaded) picker
     *  list. Used to add a fallback <option> so the select shows the
     *  pre-selected equation even before/without the list containing it
     *  (otherwise the native select falls back to the placeholder). */
    isEquationInList(name: string): boolean {
        return !!name && this.equations.some(e => e.name === name);
    }

    // ── Operand bindings ───────────────────────────────────────────────────

    onOperandSourceChange(symbol: string, source: MatrixValueSourceConfig): void {
        const entry = this.config.operandBindings.find(b => b.symbol === symbol);
        if (entry) {
            entry.source = source;
        } else {
            this.config.operandBindings.push({ symbol, source });
        }
        this.emitChange();
    }

    /** Effective source for a symbol — the host override if present, else a
     *  default sim-field source so the editor has a sensible starting branch. */
    getOperandSource(symbol: string): MatrixValueSourceConfig {
        const e = this.config.operandBindings.find(b => b.symbol === symbol);
        if (e?.source) return e.source;
        return { sourceType: 'from_source_object', sourceObjectPath: '' };
    }

    get declaredSymbols(): string[] {
        if (!this.equation) return [];
        return Object.keys(this.equation.operands || {});
    }

    /** Per-operand hint: what shape the equation declares it as. */
    getOperandKindLabel(symbol: string): string {
        const op = this.equation?.operands?.[symbol];
        if (!op) return '';
        switch (op.kind) {
            case 'matrix':         return 'matrix / vector';
            case 'matrixEquation': return 'matrix-equation';
            case 'equation':       return 'equation';
            case 'scalar':         return 'scalar';
            default:               return '';
        }
    }

    // ── Completion checks (loose — warn-only) ──────────────────────────────

    isBindingComplete(symbol: string): boolean {
        const src = this.getOperandSource(symbol);
        if (!src) return false;
        switch (src.sourceType) {
            case 'direct_assignment':
                return src.directValue !== undefined && src.directValue !== null && src.directValue !== '';
            case 'from_input':
                return !!src.inputVariableName;
            case 'from_source_object':
                return !!src.sourceObjectPath;
            case 'from_dataset':
                return !!src.datasetId;
            case 'from_latex':
                return !!src.latexExpression;
            case 'array':
                return Array.isArray(src.elements) && src.elements.length > 0
                    && src.elements.every(e => this.isElementComplete(e));
            case 'element':
                return src.source !== undefined;
            default:
                return false;
        }
    }

    private isElementComplete(src: MatrixValueSourceConfig): boolean {
        if (!src) return false;
        switch (src.sourceType) {
            case 'direct_assignment': return src.directValue !== undefined && src.directValue !== null && src.directValue !== '';
            case 'from_input':        return !!src.inputVariableName;
            case 'from_source_object':return !!src.sourceObjectPath;
            case 'from_latex':        return !!src.latexExpression;
            default:                  return false;
        }
    }

    get filledCount(): number {
        return this.declaredSymbols.filter(s => this.isBindingComplete(s)).length;
    }

    get totalDeclared(): number {
        return this.declaredSymbols.length;
    }

    get hasUnfilledOperands(): boolean {
        return this.totalDeclared > 0 && this.filledCount < this.totalDeclared;
    }

    /** Short summary of the source bound to a symbol — drives the mapping list
     *  ("f → [self.f_app_x, self.f_app_y, self.f_app_z]"). */
    sourceSummary(symbol: string): string {
        return this.summariseSource(this.getOperandSource(symbol));
    }

    private summariseSource(src: MatrixValueSourceConfig): string {
        if (!src) return '(unset)';
        if (src.sourceType === 'array') {
            const parts = (src.elements || []).map(e => this.summariseSource(e));
            return `[${parts.join(', ')}]`;
        }
        if (src.sourceType === 'element') {
            return `${this.summariseSource(src.source as MatrixValueSourceConfig)}[${src.index ?? 0}]`;
        }
        // Scalar kinds map cleanly onto the shared label helper.
        return getSourceLabel(src as any);
    }

    /** Matrix-equation LaTeX preview — the stored display LaTeX. */
    get equationPreviewLatex(): string {
        return this.equation?.latex || '';
    }

    // ── Result target ─────────────────────────────────────────────────────

    onResultTargetChange(target: 'result_variable' | 'solution_field'): void {
        this.config.resultTarget = target;
        this.emitChange();
    }

    onResultVariableNameChange(value: string): void {
        this.config.resultVariableName = value;
        this.emitChange();
    }

    onResultFieldPathChange(value: string): void {
        this.config.resultFieldPath = value;
        this.emitChange();
    }

    // ── Live resolved values (from the stepped-execution trace) ────────────

    private refreshLatestSnapshot(trace: ExecutionTrace | null): void {
        try {
            this.latestSnapshot = trace && this.stateName
                ? (trace.getLatestSnapshotForState(this.stateName) || null)
                : null;
        } catch {
            this.latestSnapshot = null;
        }
    }

    /** Whether any live trace is available for this state. */
    get hasLiveValues(): boolean {
        return !!this.latestSnapshot;
    }

    /** Live resolved value for an operand symbol, read from the trace's
     *  contextAfter. Operand values are threaded as context variables keyed by
     *  the operand symbol when the engine logs them; if absent we return null
     *  and the template shows "—". */
    liveOperandValue(symbol: string): string {
        const snap = this.latestSnapshot;
        if (!snap) return '—';
        const v = snap.contextAfter?.variables?.[symbol]?.value;
        if (v === undefined || v === null) return '—';
        return this.formatValue(v);
    }

    /** Live resolved value for the result destination, read from the result
     *  variable name in contextAfter (or the step's executionResult). */
    get liveResultValue(): string {
        const snap = this.latestSnapshot;
        if (!snap) return '—';
        const name = this.config.resultVariableName;
        const v = name ? snap.contextAfter?.variables?.[name]?.value : undefined;
        if (v !== undefined && v !== null) return this.formatValue(v);
        if (snap.executionResult !== undefined && snap.executionResult !== null) {
            return this.formatValue(snap.executionResult);
        }
        return '—';
    }

    private formatValue(v: any): string {
        try {
            if (Array.isArray(v)) {
                return `[${v.map(x => this.formatScalar(x)).join(', ')}]`;
            }
            return this.formatScalar(v);
        } catch {
            return String(v);
        }
    }

    private formatScalar(x: any): string {
        if (typeof x === 'number') {
            return Number.isInteger(x) ? String(x) : x.toFixed(3).replace(/\.?0+$/, '');
        }
        return String(x);
    }

    // ── Emit ──────────────────────────────────────────────────────────────

    private emitChange(): void {
        this.fieldValuesChanged.emit({
            displayName: this.config.matrixEquationName || 'Matrix Equation Operation',
            matrixEquationName: this.config.matrixEquationName,
            operandBindings: this.config.operandBindings,
            resultTarget: this.config.resultTarget,
            resultVariableName: this.config.resultVariableName,
            resultFieldPath: this.config.resultFieldPath,
            // Preserve any in-memory codingComment so save → reload round-trips
            // don't strip per-state notes.
            codingComment: (this.boundObjectFieldValues || {})['codingComment'] || '',
        });
    }

    onCodingCommentChange(value: string): void {
        const bofv = this.boundObjectFieldValues || {};
        bofv['codingComment'] = value;
        this.boundObjectFieldValues = bofv;
        this.emitChange();
    }
}
