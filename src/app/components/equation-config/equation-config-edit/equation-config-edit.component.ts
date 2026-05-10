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
    BranchKind,
    DataPotentialDefinition,
    createDefaultPotential,
} from '@components/custom-no-code/shared/value-binding/branch-types';
import { ValueSourceConfig, createDefaultValueSourceConfig } from '@models/stateSpace';

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

    // (Test values now live on each binding's `defaultSource`.)

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
     * `{symbol, potential, defaultSource}` shape. Literal source values flow
     * into the new `defaultSource` (a ValueSourceConfig) so the user keeps
     * concrete data for the Run-direct workflow.
     */
    private migrateLegacyBindings(): void {
        if (!this.record) return;
        const bindings = this.record.definition.variableBindings || [];
        for (const b of bindings) {
            if (b.potential && b.defaultSource) continue;
            const s = b.source;
            if (!b.potential) {
                if (!s) {
                    b.potential = createDefaultPotential();
                } else {
                    switch (s.type) {
                        case 'literal':
                            b.potential = { kind: 'literal', valueType: this.inferValueType((s as any).value) };
                            break;
                        case 'parameter':
                            b.potential = { kind: 'parameter', parameterName: (s as any).parameterName || b.symbol, valueType: 'float' };
                            break;
                        case 'dataset_field':
                            b.potential = { kind: 'from_dataset', datasetId: (s as any).datasetId || '' };
                            break;
                        case 'object_variable':
                            b.potential = { kind: 'from_object', className: (s as any).objectClass || '' };
                            break;
                        default:
                            b.potential = createDefaultPotential();
                    }
                }
            }
            if (!b.defaultSource) {
                b.defaultSource = this.makeDefaultSourceForPotential(b.potential!, s);
            }
            // Drop the legacy field on the in-memory copy so saves emit
            // potential + defaultSource only.
            delete (b as any).source;
        }
    }

    /** Build a kind-compatible `ValueSourceConfig` for a potential, optionally
     *  carrying over a value from a legacy `EquationVariableSource`. */
    private makeDefaultSourceForPotential(
        p: DataPotentialDefinition,
        legacy?: any,
    ): ValueSourceConfig {
        switch (p.kind) {
            case 'literal':
            case 'parameter':
                return {
                    sourceType: 'direct_assignment',
                    directValue: legacy?.type === 'literal' ? legacy.value : '',
                    directValueType: (p.valueType as any) || 'str',
                };
            case 'from_object':
                return {
                    sourceType: 'from_source_object',
                    sourceObjectPath: legacy?.type === 'object_variable'
                        ? (legacy.fieldPath || legacy.objectClass || '')
                        : (p.className || ''),
                };
            case 'from_dataset':
                return {
                    sourceType: 'from_dataset',
                    datasetId: legacy?.type === 'dataset_field' ? legacy.datasetId : (p.datasetId || ''),
                    datasetFieldPath: legacy?.type === 'dataset_field' ? (legacy.fieldPath || '') : '',
                };
            default:
                return createDefaultValueSourceConfig('direct_assignment');
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
            this.buildTestValuesFromBindings(),
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
            this.buildTestValuesFromBindings(),
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
    // Variable bindings (potential + defaultSource per row)
    // --------------------------------------------------------------

    addBinding(): void {
        if (!this.record) return;
        const potential = createDefaultPotential();
        this.record.definition.variableBindings.push({
            symbol: '',
            potential,
            defaultSource: this.makeDefaultSourceForPotential(potential),
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

    onBindingPotentialChange(binding: EquationVariableBinding, potential: DataPotentialDefinition): void {
        const previousKind = binding.potential?.kind;
        binding.potential = potential;
        // If the new kind isn't compatible with the existing default source,
        // reset the source so the under-potential selector re-renders for
        // the new kind.
        if (previousKind !== potential.kind || !this.isSourceCompatibleWithKind(binding.defaultSource, potential.kind)) {
            binding.defaultSource = this.makeDefaultSourceForPotential(potential);
        }
        this.markDirty();
    }

    onBindingSourceChange(binding: EquationVariableBinding, source: ValueSourceConfig): void {
        binding.defaultSource = source;
        this.markDirty();
    }

    /** Allowed `BranchKind`s for the per-row source selector, scoped to the
     *  potential's declared kind. Each potential maps to exactly one source
     *  branch — the user can edit the value, not the branch type. */
    allowedBranchesFor(binding: EquationVariableBinding): BranchKind[] {
        const k = binding.potential?.kind;
        switch (k) {
            case 'literal':      return ['literal'];
            case 'parameter':    return ['literal'];
            case 'from_object':  return ['from_object'];
            case 'from_dataset': return ['from_dataset'];
            default:             return ['literal'];
        }
    }

    /** Class to lock the from-object selector to. Pulls from the potential's
     *  declared class first; falls back to the equation's `source_class`. */
    lockedClassFor(binding: EquationVariableBinding): string {
        const k = binding.potential?.kind;
        if (k !== 'from_object') {
            // For literal/parameter potentials whose default source happens
            // to be a `from_source_object` path (e.g. CalcTester equations
            // pre-wired to `self.input_expression`), still surface the
            // equation's source_class so the instance picker is properly
            // scoped.
            const src = binding.defaultSource;
            if (src?.sourceType !== 'from_source_object') return '';
            return this.record?.source_class || '';
        }
        return binding.potential?.className || this.record?.source_class || '';
    }

    /** Field to lock when the source's path is a `self.<field>` shortform —
     *  the equation has already named the field, so the user just picks
     *  which instance to read from. Returns '' to leave the field free. */
    lockedFieldFor(binding: EquationVariableBinding): string {
        const src = binding.defaultSource;
        if (src?.sourceType !== 'from_source_object') return '';
        const path = src.sourceObjectPath || '';
        if (path.startsWith('self.')) return path.slice(5);
        const dot = path.lastIndexOf('.');
        return dot > 0 ? path.slice(dot + 1) : '';
    }

    private isSourceCompatibleWithKind(src: ValueSourceConfig | undefined, kind: string | undefined): boolean {
        if (!src) return false;
        switch (kind) {
            case 'literal':
            case 'parameter':    return src.sourceType === 'direct_assignment';
            case 'from_object':  return src.sourceType === 'from_source_object';
            case 'from_dataset': return src.sourceType === 'from_dataset';
            default:             return false;
        }
    }

    /** Snapshot the literal values of every binding's defaultSource into the
     *  legacy `PreviewTestValues` shape the preview-builder consumes. */
    private buildTestValuesFromBindings(): PreviewTestValues {
        const out: PreviewTestValues = {};
        if (!this.record) return out;
        for (const b of this.record.definition.variableBindings) {
            if (!b.symbol) continue;
            const src = b.defaultSource;
            if (src?.sourceType === 'direct_assignment'
                && src.directValue !== undefined && src.directValue !== null && src.directValue !== '') {
                out[b.symbol] = src.directValue;
            }
        }
        return out;
    }

    /** Runtime variable-bindings dict for Run-direct / Run-stored. */
    private buildRuntimeBindings(): { [symbol: string]: any } {
        return this.buildTestValuesFromBindings();
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
            variableBindings: this.buildRuntimeBindings(),
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
            variableBindings: this.buildRuntimeBindings(),
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

}
