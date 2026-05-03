import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';

import { EquationDefinitionService } from '@services/equation/equation-definition.service';
import { EquationExecutionService } from '@services/equation/equation-execution.service';
import {
    EquationDefinitionRecord,
    EquationVariableBinding,
    EquationVariableSourceType,
    EquationOperationType,
    EquationExecutionResult,
    EQUATION_OPERATION_TYPES,
    EQUATION_OPERATION_LABELS,
    getOperationCapabilities,
    OperationCapabilities,
    makeEmptyEquationDefinitionConfig
} from '@models/equations/EquationDefinition';

interface SymbolPaletteEntry {
    label: string;
    insert: string;
    /** When inserted, position the cursor `cursorOffset` characters from the END of the inserted text */
    cursorOffset?: number;
    tooltip?: string;
}

const SYMBOL_PALETTE: SymbolPaletteEntry[] = [
    { label: '\\int', insert: '\\int ', tooltip: 'Integral' },
    { label: '\\int_a^b', insert: '\\int_{}^{} ', cursorOffset: 5, tooltip: 'Definite integral' },
    { label: '\\frac{}{}', insert: '\\frac{}{}', cursorOffset: 3, tooltip: 'Fraction' },
    { label: '\\sum', insert: '\\sum ', tooltip: 'Summation' },
    { label: '\\prod', insert: '\\prod ', tooltip: 'Product' },
    { label: '\\partial', insert: '\\partial ', tooltip: 'Partial derivative symbol' },
    { label: '\\sqrt{}', insert: '\\sqrt{}', cursorOffset: 1, tooltip: 'Square root' },
    { label: 'x^{}', insert: '^{}', cursorOffset: 1, tooltip: 'Superscript' },
    { label: 'x_{}', insert: '_{}', cursorOffset: 1, tooltip: 'Subscript' },
    { label: '\\pi', insert: '\\pi ' },
    { label: '\\infty', insert: '\\infty ' },
    { label: '\\to', insert: '\\to ' },
    { label: '\\cdot', insert: '\\cdot ' },
    { label: 'e^{}', insert: 'e^{}', cursorOffset: 1, tooltip: 'Exponential' },
    { label: '\\sin', insert: '\\sin ' },
    { label: '\\cos', insert: '\\cos ' },
    { label: '\\tan', insert: '\\tan ' },
    { label: '\\log', insert: '\\log ' },
    { label: '\\ln', insert: '\\ln ' },
    { label: '\\lim', insert: '\\lim_{x \\to } ', cursorOffset: 2, tooltip: 'Limit' },
    { label: '\\alpha', insert: '\\alpha ' },
    { label: '\\beta', insert: '\\beta ' },
    { label: '\\theta', insert: '\\theta ' },
    { label: '\\Delta', insert: '\\Delta ' }
];

const SOURCE_TYPES: { value: EquationVariableSourceType; label: string; supported: boolean }[] = [
    { value: 'literal',         label: 'Literal',         supported: true },
    { value: 'parameter',       label: 'Parameter',       supported: false },
    { value: 'dataset_field',   label: 'Dataset Field',   supported: false },
    { value: 'object_variable', label: 'Object Variable', supported: false }
];

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

    /** Working copy of run-time override bindings (parallel to record.definition.variableBindings) */
    overrideBindings: EquationVariableBinding[] = [];
    useOverrides: boolean = false;

    storedRunResult: EquationExecutionResult | null = null;
    directRunResult: EquationExecutionResult | null = null;

    operationTypes = EQUATION_OPERATION_TYPES;
    operationLabels = EQUATION_OPERATION_LABELS;
    sourceTypes = SOURCE_TYPES;
    palette = SYMBOL_PALETTE;

    private latexTextarea: HTMLTextAreaElement | null = null;
    private subs: Subscription[] = [];

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private equationDefService: EquationDefinitionService,
        private equationExecutionService: EquationExecutionService,
        private snackBar: MatSnackBar
    ) {}

    ngOnInit(): void {
        const id = this.route.snapshot.paramMap.get('id');
        if (!id) {
            this.snackBar.open('No equation ID supplied.', 'Dismiss', { duration: 3000 });
            this.router.navigate(['/equations']);
            return;
        }
        this.loadRecord(id);
        // Lazily start STOMP subscription so that broadcast results show up too.
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
        // Ensure bounds object exists when needed.
        const caps = this.capabilities;
        if (caps.needsBoundsVariable && !this.record.definition.bounds) {
            this.record.definition.bounds = {};
        }
        // Initialise dataseries options if missing.
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
    // Variable bindings (the configured ones)
    // --------------------------------------------------------------

    addBinding(): void {
        if (!this.record) return;
        this.record.definition.variableBindings.push({
            symbol: '',
            source: { type: 'literal', value: 0 }
        });
        this.markDirty();
    }

    removeBinding(index: number): void {
        if (!this.record) return;
        this.record.definition.variableBindings.splice(index, 1);
        this.markDirty();
    }

    onBindingSymbolChange(binding: EquationVariableBinding, value: string): void {
        binding.symbol = value;
        this.markDirty();
    }

    onBindingSourceTypeChange(binding: EquationVariableBinding, sourceType: EquationVariableSourceType): void {
        switch (sourceType) {
            case 'literal':
                binding.source = { type: 'literal', value: 0 };
                break;
            case 'parameter':
                binding.source = { type: 'parameter', parameterName: '' };
                break;
            case 'dataset_field':
                binding.source = { type: 'dataset_field', datasetId: '', fieldPath: '' };
                break;
            case 'object_variable':
                binding.source = { type: 'object_variable', objectClass: '', fieldPath: '' };
                break;
        }
        this.markDirty();
    }

    onBindingLiteralChange(binding: EquationVariableBinding, value: string): void {
        if (binding.source.type !== 'literal') return;
        // Try to coerce to number when possible — keep string otherwise.
        const trimmed = value.trim();
        if (trimmed === '') {
            binding.source.value = '';
        } else {
            const num = Number(trimmed);
            binding.source.value = Number.isNaN(num) ? value : num;
        }
        this.markDirty();
    }

    /** Whether the binding's source type is fully supported in this Phase 1 build. */
    sourceTypeSupported(t: EquationVariableSourceType): boolean {
        const meta = SOURCE_TYPES.find(s => s.value === t);
        return !!meta?.supported;
    }

    // --------------------------------------------------------------
    // LaTeX symbol palette
    // --------------------------------------------------------------

    onLatexTextareaInit(textarea: HTMLTextAreaElement): void {
        this.latexTextarea = textarea;
    }

    insertSymbol(entry: SymbolPaletteEntry): void {
        if (!this.record || !this.latexTextarea) return;
        const ta = this.latexTextarea;
        const start = ta.selectionStart ?? this.record.definition.latexExpression.length;
        const end = ta.selectionEnd ?? start;
        const current = this.record.definition.latexExpression || '';
        const before = current.slice(0, start);
        const after = current.slice(end);
        const newValue = before + entry.insert + after;
        this.record.definition.latexExpression = newValue;
        // Restore cursor — KaTeX-friendly position
        const offset = entry.cursorOffset ?? 0;
        const newCursor = before.length + entry.insert.length - offset;
        // ngModel writes value asynchronously; restore caret on next tick.
        setTimeout(() => {
            ta.focus();
            ta.setSelectionRange(newCursor, newCursor);
        }, 0);
        this.markDirty();
    }

    // --------------------------------------------------------------
    // Run panel
    // --------------------------------------------------------------

    /** Build a working list of override bindings derived from the configured ones. */
    syncOverrideBindings(): void {
        if (!this.record) return;
        const next: EquationVariableBinding[] = [];
        for (const b of this.record.definition.variableBindings) {
            const existing = this.overrideBindings.find(o => o.symbol === b.symbol);
            if (existing) {
                next.push(existing);
            } else {
                next.push({
                    symbol: b.symbol,
                    source: { type: 'literal', value: 0 }
                });
            }
        }
        this.overrideBindings = next;
    }

    toggleUseOverrides(): void {
        this.useOverrides = !this.useOverrides;
        if (this.useOverrides) {
            this.syncOverrideBindings();
        }
    }

    onOverrideLiteralChange(binding: EquationVariableBinding, value: string): void {
        if (binding.source.type !== 'literal') {
            binding.source = { type: 'literal', value: 0 };
        }
        const trimmed = value.trim();
        if (trimmed === '') {
            (binding.source as any).value = '';
        } else {
            const num = Number(trimmed);
            (binding.source as any).value = Number.isNaN(num) ? value : num;
        }
    }

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
        const overrides = this.useOverrides
            ? this.resolveLiteralBindings(this.overrideBindings)
            : undefined;
        this.equationExecutionService.executeNamed({
            name: this.record.name,
            variableBindings: overrides,
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
        // Backend expects variableBindings as a runtime dict { symbol: value }, NOT
        // the storage-format list of { symbol, source }. Resolve literal sources here.
        this.equationExecutionService.executeDirect({
            latexExpression: def.latexExpression,
            operationType: def.operationType,
            variableBindings: this.resolveLiteralBindings(def.variableBindings),
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

    /**
     * Convert the storage-format variable-bindings list into the runtime dict
     * the backend's equation_executor consumes ({ symbol: value }). Only literal
     * sources are resolvable client-side; non-literal sources (dataset_field,
     * object_variable, parameter) are skipped — caller is expected to pass them
     * through `overrideBindings` at runtime.
     */
    private resolveLiteralBindings(bindings: Array<{ symbol: string; source: any }>): { [symbol: string]: any } {
        const out: { [symbol: string]: any } = {};
        for (const b of bindings || []) {
            if (b?.source?.type === 'literal' && b.symbol) {
                out[b.symbol] = b.source.value;
            }
        }
        return out;
    }
}
