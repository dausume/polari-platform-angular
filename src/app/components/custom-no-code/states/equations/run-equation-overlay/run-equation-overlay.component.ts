// Author: Dustin Etts
// run-equation-overlay.component.ts
//
// State overlay for the RunEquation no-code state. Loads the picked
// EquationDefinition, reads its declared `variableBindings.potential`
// list, and renders one `<app-value-source-selector>` per declared symbol.
// Each selector fills a potential with a concrete source available in the
// hosting state-space (upstream variable, source-object field, dataset, or
// literal).
//
// Loose typecheck only — selectors don't enforce kind compatibility (e.g. a
// `from_object` potential could in principle be filled by a `direct_assignment`
// source). The user can wire what they want; backend validation will
// surface mismatches at execute time.

import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Subscription } from 'rxjs';

import { StateOverlayBase } from '../../_shared/state-overlay/state-overlay-base';
import {
    AvailableInput,
    SourceObjectField,
} from '../../../shared/value-source-selector/value-source-selector.component';
import { ValueSourceConfig, createDefaultValueSourceConfig } from '@models/stateSpace';

import {
    EquationSelectorDialogComponent,
    EquationSelectorDialogResult,
} from '@components/shared/equation-selector-dialog/equation-selector-dialog';
import { EquationDefinitionService } from '@services/equation/equation-definition.service';
import {
    EquationDefinitionRecord,
    EquationVariableBinding,
} from '@models/equations/EquationDefinition';
import { buildPreviewLatex } from '@models/equations/preview-builder';
import { getSourceLabel } from '@models/stateSpace';

import {
    RunEquationConfig,
    RunEquationBindingEntry,
    makeEmptyRunEquationConfig,
} from '../run-equation/run-equation.model';

@Component({
    standalone: false,
    selector: 'run-equation-overlay',
    templateUrl: './run-equation-overlay.component.html',
    styleUrls: ['./run-equation-overlay.component.css'],
})
export class RunEquationOverlayComponent extends StateOverlayBase implements OnInit, OnDestroy {

    @Input() boundClassName: string = 'CalculusOperation';
    @Input() boundObjectFieldValues: { [key: string]: any } | null = null;
    @Input() availableInputs: AvailableInput[] = [];
    @Input() sourceObjectFields: SourceObjectField[] = [];

    @Output() fieldValuesChanged = new EventEmitter<{ [key: string]: any }>();

    /** Always show the expand button — the popup view (run-equation-overlay-popup)
     *  is the canonical edit surface; the inline overlay is just a summary
     *  that's tolerant of being clipped by the canvas-shape sizing. */
    override hasPopupView: boolean = true;

    config: RunEquationConfig = makeEmptyRunEquationConfig();

    /** Loaded equation definition — used to discover declared potentials so
     *  we can render the right number of value-source-selectors. */
    equation: EquationDefinitionRecord | null = null;
    loadingEquation: boolean = false;
    loadError: string | null = null;

    private subs: Subscription[] = [];

    constructor(
        private dialog: MatDialog,
        private equationService: EquationDefinitionService,
    ) {
        super();
    }

    override ngOnInit(): void {
        super.ngOnInit();
        this.initializeFromInputs();
        // Equation NAME is the canonical cross-reference (stable across
        // re-seeds / DB resets). The equationId is transient — resolved at
        // runtime and never persisted. Prefer name-based lookup whenever
        // a name is set, falling back to id only when name is missing.
        if (this.config.equationName) {
            this.loadEquationByName(this.config.equationName);
        } else if (this.config.equationId) {
            this.loadEquation(this.config.equationId);
        }
    }

    ngOnDestroy(): void {
        this.subs.forEach(s => s.unsubscribe());
    }

    private initializeFromInputs(): void {
        const bofv = this.boundObjectFieldValues || {};
        if (bofv['equationId']) this.config.equationId = bofv['equationId'];
        if (bofv['equationName']) this.config.equationName = bofv['equationName'];
        if (Array.isArray(bofv['bindings'])) this.config.bindings = bofv['bindings'];
        if (bofv['resultTarget']) this.config.resultTarget = bofv['resultTarget'];
        if (bofv['resultVariableName']) this.config.resultVariableName = bofv['resultVariableName'];
        if (bofv['resultFieldPath']) this.config.resultFieldPath = bofv['resultFieldPath'];
    }

    // ── Equation loading ──────────────────────────────────────────────────

    /** Load by name — the canonical cross-reference. The transient
     *  equationId is updated for downstream consumers but never persisted. */
    private loadEquationByName(name: string): void {
        this.loadingEquation = true;
        this.loadError = null;
        // console.log('[RunEquationOverlay] loadEquationByName', name);
        this.subs.push(
            this.equationService.getByName(name).subscribe({
                next: rec => {
                    // console.log('[RunEquationOverlay] loaded by name:', rec?.id, rec?.name);
                    this.equation = rec;
                    this.config.equationId = rec.id;
                    this.config.equationName = rec.name;
                    this.loadingEquation = false;
                    this.reconcileBindings();
                },
                error: err => {
                    // console.warn('[RunEquationOverlay] failed to load by name:', name, err);
                    this.equation = null;
                    this.loadingEquation = false;
                    this.loadError = err?.message || String(err);
                },
            }),
        );
    }

    private loadEquation(id: string): void {
        this.loadingEquation = true;
        this.loadError = null;
        this.subs.push(
            this.equationService.getById(id).subscribe({
                next: rec => {
                    this.equation = rec;
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

    /** Sync `config.bindings` to match the equation's declared potentials.
     *  - For each declared symbol: keep the existing source if present, else
     *    seed with a literal placeholder.
     *  - Drop bindings for symbols no longer declared (equation was edited). */
    private reconcileBindings(): void {
        if (!this.equation) return;
        const declared = this.equation.definition.variableBindings || [];
        const next: RunEquationBindingEntry[] = [];
        for (const b of declared as EquationVariableBinding[]) {
            if (!b.symbol) continue;
            const existing = this.config.bindings.find(x => x.symbol === b.symbol);
            next.push(existing || {
                symbol: b.symbol,
                source: createDefaultValueSourceConfig('direct_assignment'),
            });
        }
        this.config.bindings = next;
        this.emitChange();
    }

    // ── Picker ────────────────────────────────────────────────────────────

    openEquationPicker(): void {
        const ref = this.dialog.open(EquationSelectorDialogComponent, {
            width: '520px',
            panelClass: 'state-overlay-picker-popup-panel',
            data: {
                title: 'Pick Equation to Run',
                subtitle: 'Choose which equation this state will execute.',
            },
        });
        ref.afterClosed().subscribe((r: EquationSelectorDialogResult | undefined) => {
            if (r?.action === 'select' && r.equationId) {
                this.config.equationId = r.equationId;
                this.config.equationName = r.equationName || r.equationId;
                this.config.bindings = [];
                this.equation = null;
                this.loadEquation(r.equationId);
                this.emitChange();
            }
        });
    }

    clearEquation(): void {
        this.config.equationId = '';
        this.config.equationName = '';
        this.config.bindings = [];
        this.equation = null;
        this.emitChange();
    }

    // ── Bindings ──────────────────────────────────────────────────────────

    onBindingSourceChange(symbol: string, source: ValueSourceConfig): void {
        const entry = this.config.bindings.find(b => b.symbol === symbol);
        if (entry) {
            entry.source = source;
        } else {
            this.config.bindings.push({ symbol, source });
        }
        this.emitChange();
    }

    /** Look up the declared potential's KIND for a given symbol — surfaced as
     *  a hint label next to the selector so the user knows what shape the
     *  equation expects. */
    getDeclaredPotentialLabel(symbol: string): string {
        const declared = this.equation?.definition.variableBindings.find(b => b.symbol === symbol);
        const p = declared?.potential;
        if (!p) return '';
        switch (p.kind) {
            case 'literal':      return `expects literal ${p.valueType || 'value'}`;
            case 'parameter':    return `expects parameter ${p.parameterName || ''} (${p.valueType || 'any'})`;
            case 'from_object':  return `expects instance of ${p.className || '?'}`;
            case 'from_dataset': return `expects DataSet ${p.datasetId || '?'}`;
            default:             return '';
        }
    }

    getBindingSource(symbol: string): ValueSourceConfig {
        const e = this.config.bindings.find(b => b.symbol === symbol);
        return e?.source || createDefaultValueSourceConfig('direct_assignment');
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

    // ── Emit ──────────────────────────────────────────────────────────────

    private emitChange(): void {
        this.fieldValuesChanged.emit({
            displayName: this.config.equationName || 'Run Equation',
            equationId: this.config.equationId,
            equationName: this.config.equationName,
            bindings: this.config.bindings,
            resultTarget: this.config.resultTarget,
            resultVariableName: this.config.resultVariableName,
            resultFieldPath: this.config.resultFieldPath,
        });
    }

    // ── Template helper ──────────────────────────────────────────────────

    get declaredSymbols(): string[] {
        return (this.equation?.definition.variableBindings || [])
            .map(b => b.symbol)
            .filter(s => !!s);
    }

    // ── Completion checks (loose — warn-only) ────────────────────────────

    /**
     * Whether a binding has enough information to resolve to a concrete
     * value at runtime. Loose check — we don't enforce kind compatibility,
     * just that the active branch is filled in enough to produce a value.
     */
    isBindingComplete(symbol: string): boolean {
        const entry = this.config.bindings.find(b => b.symbol === symbol);
        const src = entry?.source;
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
            default:
                return false;
        }
    }

    /** Per-row warning text shown when the binding's source is incomplete. */
    incompleteBindingHint(symbol: string): string {
        const entry = this.config.bindings.find(b => b.symbol === symbol);
        const src = entry?.source;
        if (!src) return 'Pick a source for this potential.';
        switch (src.sourceType) {
            case 'direct_assignment':  return 'Enter a literal value.';
            case 'from_input':         return 'Pick an upstream variable.';
            case 'from_source_object': return 'Pick an object field.';
            case 'from_dataset':       return 'Pick a dataset.';
            default:                   return 'Source incomplete.';
        }
    }

    get filledCount(): number {
        return this.declaredSymbols.filter(s => this.isBindingComplete(s)).length;
    }

    get totalDeclared(): number {
        return this.declaredSymbols.length;
    }

    /** True when at least one declared potential isn't fully filled. Used
     *  to drive the aggregate warning header. */
    get hasUnfilledPotentials(): boolean {
        return this.totalDeclared > 0 && this.filledCount < this.totalDeclared;
    }

    /** Step-1 preview (operation-wrapped LaTeX) — same view as the Equations
     *  page so the user sees the formula's shape before wiring bindings. */
    get equationStep1Preview(): string {
        const def = this.equation?.definition;
        if (!def) return '';
        return buildPreviewLatex(def.latexExpression, def.operationType, def.bounds);
    }

    /** Short summary of the source bound to a symbol — drives the variable
     *  mapping list ("f → self.input_expression"). */
    sourceSummary(symbol: string): string {
        return getSourceLabel(this.getBindingSource(symbol));
    }

    /** Locked class for a per-binding selector — pulled from the equation's
     *  declared default for that symbol (or from the equation's source_class)
     *  so the in-state selector enters streamlined "From {ClassName} Instance"
     *  mode automatically. */
    lockedClassForSymbol(symbol: string): string {
        const declared = this.equation?.definition.variableBindings.find(b => b.symbol === symbol);
        if (!declared) return '';
        const p = declared.potential;
        if (p?.kind === 'from_object' && p.className) return p.className;
        const ds = (declared as any).defaultSource;
        if (ds?.sourceType === 'from_source_object') {
            return this.equation?.source_class || '';
        }
        return '';
    }

    /** Locked field for a per-binding selector — pulled from the equation's
     *  default `self.<field>` path so the user only needs to pick the instance. */
    lockedFieldForSymbol(symbol: string): string {
        const declared = this.equation?.definition.variableBindings.find(b => b.symbol === symbol);
        const ds = declared && (declared as any).defaultSource;
        if (ds?.sourceType !== 'from_source_object') return '';
        const path: string = ds.sourceObjectPath || '';
        if (path.startsWith('self.')) return path.slice(5);
        const dot = path.lastIndexOf('.');
        return dot > 0 ? path.slice(dot + 1) : '';
    }
}
