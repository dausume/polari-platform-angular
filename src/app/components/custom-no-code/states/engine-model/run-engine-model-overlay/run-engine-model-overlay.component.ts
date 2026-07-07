// Author: Dustin Etts
// run-engine-model-overlay.component.ts
//
// State overlay for the EngineModelOperation no-code state. Hosts a FEM/DFT
// model definition reference (a FEMModelDefinition or DFTModelDefinition row,
// by name) and binds the model's stageDerived input symbols
// ('<stage>.<key>') to concrete RUNTIME sources available in the hosting
// state-space — reusing the generic <matrix-operand-source-editor> per row
// (sim fields, upstream variables, literals, assembled vectors, LaTeX).
//
// Runs a configured FEM/DFT model definition (a real engine solve via
// materialsScience) and writes its outputs into the solution context as
// model.<key> plus any mapped variables. Backend-only runtime.
//
// Mirrors RunMatrixEquationOverlayComponent in structure and the three size
// tiers, but:
//   • the model reference is a plain text input (the model definitions are
//     backend rows without a frontend list service), so there is no picker
//     service, no async definition load, and no declared-symbol discovery —
//     binding rows are user-managed (add/remove, editable symbol),
//   • adds a resultKeyMap editor (engine result key → friendly context var),
//   • keeps live resolved-value display from the stepped-execution trace
//     (SolutionExecutionService.executionTrace$), degrading to "—".
//
// Distinct visual identity from Matrix (green) and Calculus (amber): indigo
// accent (#7986CB), `science` icon.

import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { Subscription } from 'rxjs';

import { StateOverlayBase } from '../../_shared/state-overlay/state-overlay-base';
import {
    AvailableInput,
    SourceObjectField,
} from '../../../shared/value-source-selector/value-source-selector.component';
import { getSourceLabel } from '@models/stateSpace';

import {
    ExecutionStepSnapshot,
    ExecutionTrace,
} from '@models/noCode/ExecutionTrace';
import { SolutionExecutionService } from '@services/no-code-services/solution-execution.service';

import { MatrixValueSourceConfig } from '../../matrices/run-matrix-equation/run-matrix-equation.model';
import {
    RunEngineModelConfig,
    RunEngineModelInputBinding,
    RunEngineModelResultKeyMapEntry,
    makeEmptyRunEngineModelConfig,
} from '../run-engine-model/run-engine-model.model';

@Component({
    standalone: false,
    selector: 'run-engine-model-overlay',
    templateUrl: './run-engine-model-overlay.component.html',
    styleUrls: ['./run-engine-model-overlay.component.css'],
})
export class RunEngineModelOverlayComponent extends StateOverlayBase implements OnInit, OnDestroy {

    @Input() boundClassName: string = 'EngineModelOperation';
    @Input() boundObjectFieldValues: { [key: string]: any } | null = null;
    @Input() availableInputs: AvailableInput[] = [];
    @Input() sourceObjectFields: SourceObjectField[] = [];

    @Output() fieldValuesChanged = new EventEmitter<{ [key: string]: any }>();

    /** Inline expand button is always shown — opens the canonical full-page
     *  popup edit surface (createEngineModelOperationOverlay wires it). */
    override hasPopupView: boolean = true;

    config: RunEngineModelConfig = makeEmptyRunEngineModelConfig();

    /** Latest execution snapshot for THIS state (live resolved values). */
    private latestSnapshot: ExecutionStepSnapshot | null = null;

    private subs: Subscription[] = [];

    constructor(
        private executionService: SolutionExecutionService,
    ) {
        super();
    }

    override ngOnInit(): void {
        super.ngOnInit();
        this.initializeFromInputs();

        // Subscribe to the live execution trace so binding/result rows can
        // show their resolved values. Isolated + defensive: any failure here
        // must not break the editor.
        this.subs.push(
            this.executionService.executionTrace$.subscribe(trace => {
                this.refreshLatestSnapshot(trace);
            }),
        );
    }

    ngOnDestroy(): void {
        this.subs.forEach(s => s.unsubscribe());
    }

    private initializeFromInputs(): void {
        const bofv = this.boundObjectFieldValues || {};
        if (bofv['modelRef']) this.config.modelRef = bofv['modelRef'];
        if (Array.isArray(bofv['inputBindings'])) this.config.inputBindings = bofv['inputBindings'];
        if (Array.isArray(bofv['resultKeyMap'])) this.config.resultKeyMap = bofv['resultKeyMap'];
        if (bofv['resultTarget']) this.config.resultTarget = bofv['resultTarget'];
        if (bofv['resultVariableName']) this.config.resultVariableName = bofv['resultVariableName'];
        if (bofv['resultFieldPath']) this.config.resultFieldPath = bofv['resultFieldPath'];
        if (bofv['displayName']) this.config.displayName = bofv['displayName'];
    }

    // ── Model reference ───────────────────────────────────────────────────

    onModelRefChange(value: string): void {
        this.config.modelRef = value;
        this.emitChange();
    }

    clearModelRef(): void {
        this.config.modelRef = '';
        this.emitChange();
    }

    // ── Input bindings (user-managed rows) ────────────────────────────────

    addBinding(): void {
        this.config.inputBindings.push({
            symbol: '',
            source: { sourceType: 'from_source_object', sourceObjectPath: '' },
        });
        this.emitChange();
    }

    removeBinding(index: number): void {
        this.config.inputBindings.splice(index, 1);
        this.emitChange();
    }

    onBindingSymbolChange(index: number, symbol: string): void {
        const entry = this.config.inputBindings[index];
        if (!entry) return;
        entry.symbol = symbol;
        this.emitChange();
    }

    onBindingSourceChange(index: number, source: MatrixValueSourceConfig): void {
        const entry = this.config.inputBindings[index];
        if (!entry) return;
        entry.source = source;
        this.emitChange();
    }

    /** Effective source for a binding row — a default sim-field source if the
     *  row has none yet, so the editor has a sensible starting branch. */
    getBindingSource(index: number): MatrixValueSourceConfig {
        const e = this.config.inputBindings[index];
        if (e?.source) return e.source;
        return { sourceType: 'from_source_object', sourceObjectPath: '' };
    }

    // ── Completion checks (loose — warn-only) ──────────────────────────────

    isBindingComplete(binding: RunEngineModelInputBinding): boolean {
        if (!binding || !binding.symbol) return false;
        return this.isSourceComplete(binding.source);
    }

    private isSourceComplete(src: MatrixValueSourceConfig): boolean {
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
        return this.config.inputBindings.filter(b => this.isBindingComplete(b)).length;
    }

    get totalBindings(): number {
        return this.config.inputBindings.length;
    }

    get hasUnfilledBindings(): boolean {
        return this.totalBindings > 0 && this.filledCount < this.totalBindings;
    }

    /** Short summary of the source bound to a row — drives the mapping list
     *  ("thermal.k_solid → self.k_solid"). */
    sourceSummary(binding: RunEngineModelInputBinding): string {
        return this.summariseSource(binding?.source);
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

    // ── Result key map (user-managed rows) ─────────────────────────────────

    addResultKeyMapEntry(): void {
        this.config.resultKeyMap.push({ resultKey: '', contextVar: '' });
        this.emitChange();
    }

    removeResultKeyMapEntry(index: number): void {
        this.config.resultKeyMap.splice(index, 1);
        this.emitChange();
    }

    onResultKeyChange(index: number, value: string): void {
        const entry = this.config.resultKeyMap[index];
        if (!entry) return;
        entry.resultKey = value;
        this.emitChange();
    }

    onContextVarChange(index: number, value: string): void {
        const entry = this.config.resultKeyMap[index];
        if (!entry) return;
        entry.contextVar = value;
        this.emitChange();
    }

    isResultKeyMapEntryComplete(entry: RunEngineModelResultKeyMapEntry): boolean {
        return !!entry && !!entry.resultKey && !!entry.contextVar;
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

    /** Live resolved value for an input symbol, read from the trace's
     *  contextAfter. Values are threaded as context variables keyed by the
     *  symbol when the engine logs them; if absent we return "—". */
    liveBindingValue(symbol: string): string {
        const snap = this.latestSnapshot;
        if (!snap || !symbol) return '—';
        const v = snap.contextAfter?.variables?.[symbol]?.value;
        if (v === undefined || v === null) return '—';
        return this.formatValue(v);
    }

    /** Live resolved value for a mapped context variable. */
    liveMappedValue(contextVar: string): string {
        return this.liveBindingValue(contextVar);
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
            displayName: this.config.modelRef || 'Engine Model (FEM/DFT)',
            modelRef: this.config.modelRef,
            inputBindings: this.config.inputBindings,
            resultKeyMap: this.config.resultKeyMap,
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
