import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { OperationReferencePopupComponent } from '../operation-reference-popup/operation-reference-popup.component';

import { EquationDefinitionService } from '@services/equation/equation-definition.service';
import { EquationExecutionService } from '@services/equation/equation-execution.service';
import {
    EquationDefinitionRecord,
    EquationVariableBinding,
    EquationOperationType,
    EquationExecutionResult,
    EQUATION_OPERATION_TYPES,
    EQUATION_OPERATION_LABELS,
    getOperationCapabilities,
    OperationCapabilities,
    makeEmptyEquationDefinitionConfig
} from '@models/equations/EquationDefinition';
import {
    DataPotentialDefinition,
    createDefaultPotential,
} from '@components/custom-no-code/shared/value-binding/branch-types';

import { SymbolPaletteEntry } from '@models/equations/SymbolPalette';
import { buildPreviewLatex, buildSubstitutedLatex, PreviewTestValues } from '@models/equations/preview-builder';

@Component({
    selector: 'app-equation-config-edit',
    standalone: false,
    templateUrl: './equation-config-edit.component.html',
    styleUrls: ['./equation-config-edit.component.scss']
})
export class EquationConfigEditComponent implements OnInit, OnDestroy {

    record: EquationDefinitionRecord | null = null;
    loading: boolean = false;
    saving: boolean = false;
    running: boolean = false;
    runningDirect: boolean = false;
    dirty: boolean = false;

    /**
     * Per-symbol concrete test values used by the substituted preview and the
     * Run-direct workflow. Lives only in component state — never persisted.
     * The persisted `variableBindings` describe shape (potentials), not values.
     */
    testValues: PreviewTestValues = {};

    storedRunResult: EquationExecutionResult | null = null;
    directRunResult: EquationExecutionResult | null = null;

    operationTypes = EQUATION_OPERATION_TYPES;
    operationLabels = EQUATION_OPERATION_LABELS;

    private latexTextarea: HTMLTextAreaElement | null = null;
    private subs: Subscription[] = [];

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private equationDefService: EquationDefinitionService,
        private equationExecutionService: EquationExecutionService,
        private snackBar: MatSnackBar,
        private dialog: MatDialog
    ) {}

    openOperationReference(): void {
        const ref = this.dialog.open(OperationReferencePopupComponent, {
            width: '880px',
            maxWidth: '95vw',
            maxHeight: '90vh',
            autoFocus: false,
            data: {
                currentOperation: this.record?.definition.operationType || null,
            },
        });
        ref.afterClosed().subscribe((picked: EquationOperationType | undefined) => {
            if (picked && this.record && picked !== this.record.definition.operationType) {
                this.onOperationChange(picked);
            }
        });
    }

    ngOnInit(): void {
        const id = this.route.snapshot.paramMap.get('id');
        if (!id) {
            this.snackBar.open('No equation ID supplied.', 'Dismiss', { duration: 3000 });
            this.router.navigate(['/equations']);
            return;
        }
        this.loadRecord(id);
        this.equationExecutionService.ensureStompSubscription();
    }

    ngOnDestroy(): void {
        this.subs.forEach(s => s.unsubscribe());
    }

    // --------------------------------------------------------------
    // Load / save
    // --------------------------------------------------------------

    private loadRecord(id: string): void {
        this.loading = true;
        this.equationDefService.getById(id).subscribe({
            next: rec => {
                this.record = rec;
                this.migrateLegacyBindings();
                this.loading = false;
                this.dirty = false;
            },
            error: err => {
                this.loading = false;
                console.error('[EquationConfigEdit] Failed to load record:', err);
                this.snackBar.open(`Failed to load equation: ${err?.message || err}`, 'Dismiss', { duration: 4000 });
            }
        });
    }

    /**
     * Convert legacy `{symbol, source: {type, ...}}` bindings into the new
     * `{symbol, potential: DataPotentialDefinition}` shape. Literal source
     * values are seeded into the local `testValues` map so the user keeps
     * concrete data for the Run-direct workflow.
     */
    private migrateLegacyBindings(): void {
        if (!this.record) return;
        const bindings = this.record.definition.variableBindings || [];
        for (const b of bindings) {
            if (b.potential) continue;
            if (!b.source) {
                b.potential = createDefaultPotential();
                continue;
            }
            const s = b.source;
            switch (s.type) {
                case 'literal': {
                    const v = (s as any).value;
                    b.potential = {
                        kind: 'literal',
                        valueType: this.inferValueType(v),
                    };
                    if (b.symbol) this.testValues[b.symbol] = v;
                    break;
                }
                case 'parameter':
                    b.potential = {
                        kind: 'parameter',
                        parameterName: (s as any).parameterName || b.symbol,
                        valueType: 'float',
                    };
                    break;
                case 'dataset_field':
                    b.potential = {
                        kind: 'from_dataset',
                        datasetId: (s as any).datasetId || '',
                    };
                    break;
                case 'object_variable':
                    b.potential = {
                        kind: 'from_object',
                        className: (s as any).objectClass || '',
                    };
                    break;
                default:
                    b.potential = createDefaultPotential();
            }
            // Drop the legacy field on the in-memory copy so saves emit
            // potential-only.
            delete (b as any).source;
        }
    }

    private inferValueType(v: any): 'int' | 'float' | 'str' | 'bool' {
        if (typeof v === 'boolean') return 'bool';
        if (typeof v === 'number') return Number.isInteger(v) ? 'int' : 'float';
        if (Array.isArray(v)) return 'float';
        return 'str';
    }

    save(): void {
        if (!this.record || this.saving) return;
        this.saving = true;
        this.equationDefService.saveConfig(this.record).subscribe({
            next: () => {
                this.saving = false;
                this.dirty = false;
                this.snackBar.open('Equation saved.', 'Dismiss', { duration: 2000 });
            },
            error: err => {
                this.saving = false;
                console.error('[EquationConfigEdit] Save failed:', err);
                this.snackBar.open(`Save failed: ${err?.message || err}`, 'Dismiss', { duration: 4000 });
            }
        });
    }

    deleteRecord(): void {
        if (!this.record) return;
        if (!confirm(`Delete equation "${this.record.name}"? This cannot be undone.`)) return;
        const id = this.record.id;
        this.equationDefService.deleteConfig(id).subscribe({
            next: () => {
                this.snackBar.open('Equation deleted.', 'Dismiss', { duration: 2000 });
                this.router.navigate(['/equations']);
            },
            error: err => {
                console.error('[EquationConfigEdit] Delete failed:', err);
                this.snackBar.open(`Delete failed: ${err?.message || err}`, 'Dismiss', { duration: 4000 });
            }
        });
    }

    backToList(): void {
        this.router.navigate(['/equations']);
    }

    markDirty(): void {
        this.dirty = true;
    }

    // --------------------------------------------------------------
    // Definition mutators
    // --------------------------------------------------------------

    onLatexChange(value: string): void {
        if (!this.record) return;
        this.record.definition.latexExpression = value;
        this.markDirty();
    }

    onOperationChange(op: EquationOperationType): void {
        if (!this.record) return;
        this.record.definition.operationType = op;
        const caps = this.capabilities;
        if (caps.needsBoundsVariable && !this.record.definition.bounds) {
            this.record.definition.bounds = {};
        }
        if (caps.isDataSeries) {
            if (!this.record.definition.options) this.record.definition.options = {};
            if (!this.record.definition.options['method']) {
                this.record.definition.options['method'] = 'trapezoidal';
            }
        }
        this.markDirty();
    }

    get capabilities(): OperationCapabilities {
        if (!this.record) {
            return getOperationCapabilities('evaluate');
        }
        return getOperationCapabilities(this.record.definition.operationType);
    }

    /** PRE-substitution preview — the formula as written, wrapped with the
     *  selected operation's symbol. Shows the structure before any test
     *  values are applied. */
    get previewLatex(): string {
        if (!this.record) return '';
        return buildPreviewLatex(
            this.record.definition.latexExpression,
            this.record.definition.operationType,
            this.record.definition.bounds
        );
    }

    /** POST-substitution preview — formula with test values inlined for any
     *  symbol the user has supplied a value for. Reflects what Run-direct
     *  will pass to the backend. */
    get previewLatexSubstituted(): string {
        if (!this.record) return '';
        const { substituted } = buildSubstitutedLatex(
            this.record.definition.latexExpression,
            this.testValues
        );
        return buildPreviewLatex(
            substituted,
            this.record.definition.operationType,
            this.record.definition.bounds
        );
    }

    /** Number of test-value substitutions actually applied. Used to show an
     *  empty-state hint when the user hasn't supplied any test values yet. */
    get substitutionCount(): number {
        if (!this.record) return 0;
        return buildSubstitutedLatex(
            this.record.definition.latexExpression,
            this.testValues
        ).substitutionsApplied;
    }

    get bounds() {
        if (!this.record) return {} as any;
        if (!this.record.definition.bounds) this.record.definition.bounds = {};
        return this.record.definition.bounds;
    }

    onBoundsField<K extends 'variable' | 'lower' | 'upper' | 'point' | 'direction' | 'order'>(
        field: K,
        value: any
    ): void {
        if (!this.record) return;
        if (!this.record.definition.bounds) this.record.definition.bounds = {};
        (this.record.definition.bounds as any)[field] = value;
        this.markDirty();
    }

    get options(): { [key: string]: any } {
        if (!this.record) return {};
        if (!this.record.definition.options) this.record.definition.options = {};
        return this.record.definition.options;
    }

    onOptionField(key: string, value: any): void {
        if (!this.record) return;
        if (!this.record.definition.options) this.record.definition.options = {};
        this.record.definition.options[key] = value;
        this.markDirty();
    }

    // --------------------------------------------------------------
    // Variable bindings (potentials only — no concrete values persist)
    // --------------------------------------------------------------

    addBinding(): void {
        if (!this.record) return;
        this.record.definition.variableBindings.push({
            symbol: '',
            potential: createDefaultPotential(),
        });
        this.markDirty();
    }

    removeBinding(index: number): void {
        if (!this.record) return;
        const removed = this.record.definition.variableBindings[index];
        if (removed?.symbol) delete this.testValues[removed.symbol];
        this.record.definition.variableBindings.splice(index, 1);
        this.markDirty();
    }

    onBindingSymbolChange(binding: EquationVariableBinding, value: string): void {
        const oldSymbol = binding.symbol;
        binding.symbol = value;
        // Carry test value forward so renaming doesn't drop it.
        if (oldSymbol && oldSymbol !== value && this.testValues[oldSymbol] !== undefined) {
            this.testValues[value] = this.testValues[oldSymbol];
            delete this.testValues[oldSymbol];
        }
        this.markDirty();
    }

    onBindingPotentialChange(binding: EquationVariableBinding, potential: DataPotentialDefinition): void {
        binding.potential = potential;
        this.markDirty();
    }

    // --------------------------------------------------------------
    // Test values (transient — drives substituted preview + Run direct)
    // --------------------------------------------------------------

    onTestValueChange(symbol: string, raw: string): void {
        if (!symbol) return;
        const trimmed = (raw ?? '').trim();
        if (trimmed === '') {
            delete this.testValues[symbol];
            return;
        }
        const num = Number(trimmed);
        this.testValues[symbol] = Number.isNaN(num) ? raw : num;
    }

    getTestValueDisplay(symbol: string): string {
        const v = this.testValues[symbol];
        if (v === undefined || v === null) return '';
        return String(v);
    }

    // --------------------------------------------------------------
    // LaTeX symbol palette
    // --------------------------------------------------------------

    private lastKnownCursor: number = 0;

    onLatexTextareaInit(textarea: HTMLTextAreaElement): void {
        this.latexTextarea = textarea;
        textarea.addEventListener('blur', () => {
            this.lastKnownCursor = textarea.selectionStart ?? this.lastKnownCursor;
        });
        textarea.addEventListener('keyup', () => {
            this.lastKnownCursor = textarea.selectionStart ?? this.lastKnownCursor;
        });
        textarea.addEventListener('mouseup', () => {
            this.lastKnownCursor = textarea.selectionStart ?? this.lastKnownCursor;
        });
    }

    insertSymbol(entry: SymbolPaletteEntry): void {
        if (!this.record || !this.latexTextarea) return;
        const ta = this.latexTextarea;
        const live = ta.selectionStart;
        const start = (document.activeElement === ta && live != null)
            ? live
            : this.lastKnownCursor;
        const end = (document.activeElement === ta && ta.selectionEnd != null)
            ? ta.selectionEnd
            : start;
        const current = this.record.definition.latexExpression || '';
        const before = current.slice(0, start);
        const after = current.slice(end);
        const newValue = before + entry.latex + after;
        this.record.definition.latexExpression = newValue;
        const offset = entry.cursorOffset ?? 0;
        const newCursor = before.length + entry.latex.length - offset;
        this.lastKnownCursor = newCursor;
        setTimeout(() => {
            ta.focus();
            ta.setSelectionRange(newCursor, newCursor);
        }, 0);
        this.markDirty();
    }

    // --------------------------------------------------------------
    // Run panel
    // --------------------------------------------------------------

    runStored(): void {
        if (!this.record || this.running) return;
        if (this.dirty) {
            this.snackBar.open('Save your changes before running stored bindings.', 'Dismiss', { duration: 3000 });
            return;
        }
        if (!this.record.name) {
            this.snackBar.open('Equation needs a name before it can be run by name.', 'Dismiss', { duration: 3000 });
            return;
        }
        this.running = true;
        this.storedRunResult = null;
        const requestId = `req_${Date.now()}`;
        this.equationExecutionService.executeNamed({
            name: this.record.name,
            variableBindings: { ...this.testValues },
            requestId
        }).subscribe({
            next: result => {
                this.storedRunResult = result;
                this.running = false;
            },
            error: err => {
                this.running = false;
                this.storedRunResult = {
                    success: false,
                    result_latex: null,
                    result_numeric: null,
                    error: err?.error?.error || err?.message || String(err),
                    warnings: []
                };
            }
        });
    }

    runDirect(): void {
        if (!this.record || this.runningDirect) return;
        this.runningDirect = true;
        this.directRunResult = null;
        const def = this.record.definition;
        const requestId = `req_direct_${Date.now()}`;
        this.equationExecutionService.executeDirect({
            latexExpression: def.latexExpression,
            operationType: def.operationType,
            variableBindings: { ...this.testValues },
            bounds: def.bounds,
            options: def.options,
            requestId
        }).subscribe({
            next: result => {
                this.directRunResult = result;
                this.runningDirect = false;
            },
            error: err => {
                this.runningDirect = false;
                this.directRunResult = {
                    success: false,
                    result_latex: null,
                    result_numeric: null,
                    error: err?.error?.error || err?.message || String(err),
                    warnings: []
                };
            }
        });
    }

    /** Symbols that benefit from a literal test value — only `literal` and
     *  `parameter` potentials. `from_object` / `from_dataset` are resolved by
     *  the host state-space at runtime and ignored here. */
    get testableSymbols(): string[] {
        if (!this.record) return [];
        const out: string[] = [];
        for (const b of this.record.definition.variableBindings) {
            if (!b.symbol) continue;
            const k = b.potential?.kind;
            if (k === 'literal' || k === 'parameter') out.push(b.symbol);
        }
        return out;
    }
}
