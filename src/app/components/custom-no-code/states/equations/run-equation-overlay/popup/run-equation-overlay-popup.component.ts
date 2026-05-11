// Author: Dustin Etts
// Full-page popup for the CalculusOperation state. Opened via MatDialog
// from the canvas when the user clicks the expand button on the inline
// overlay. Hosts the same controls as the inline overlay but in a scrollable
// dialog that can never get clipped by the canvas / SVG sizing.
//
// Data flow: the dispatcher passes the current `boundObjectFieldValues` in
// via MAT_DIALOG_DATA. As the user edits, this component emits
// `fieldValuesChanged` with the merged config. The dispatcher subscribes
// and persists each delta back into the state instance + service cache.

import { Component, EventEmitter, Inject, OnDestroy, OnInit, Output } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { ValueSourceConfig, createDefaultValueSourceConfig } from '@models/stateSpace';
import {
    AvailableInput,
    SourceObjectField,
} from '../../../../shared/value-source-selector/value-source-selector.component';
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
} from '../../run-equation/run-equation.model';

export interface RunEquationOverlayPopupData {
    stateName: string;
    boundObjectFieldValues: { [key: string]: any };
    availableInputs: AvailableInput[];
    sourceObjectFields: SourceObjectField[];
}

@Component({
    standalone: false,
    selector: 'run-equation-overlay-popup',
    templateUrl: './run-equation-overlay-popup.component.html',
    styleUrls: ['./run-equation-overlay-popup.component.css'],
})
export class RunEquationOverlayPopupComponent implements OnInit, OnDestroy {

    @Output() fieldValuesChanged = new EventEmitter<{ [key: string]: any }>();

    config: RunEquationConfig = makeEmptyRunEquationConfig();
    equation: EquationDefinitionRecord | null = null;
    loadingEquation: boolean = false;
    loadError: string | null = null;

    availableInputs: AvailableInput[] = [];
    sourceObjectFields: SourceObjectField[] = [];

    private subs: Subscription[] = [];

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: RunEquationOverlayPopupData,
        private dialogRef: MatDialogRef<RunEquationOverlayPopupComponent>,
        private dialog: MatDialog,
        private equationService: EquationDefinitionService,
    ) {
        this.availableInputs = data.availableInputs || [];
        this.sourceObjectFields = data.sourceObjectFields || [];
    }

    ngOnInit(): void {
        this.initializeFromData();
        // Name is the canonical cross-reference; ID is transient.
        if (this.config.equationName) {
            this.loadEquationByName(this.config.equationName);
        } else if (this.config.equationId) {
            this.loadEquation(this.config.equationId);
        }
    }

    private loadEquationByName(name: string): void {
        this.loadingEquation = true;
        this.loadError = null;
        // console.log('[RunEquationOverlayPopup] loadEquationByName', name);
        this.subs.push(
            this.equationService.getByName(name).subscribe({
                next: rec => {
                    // console.log('[RunEquationOverlayPopup] loaded by name:', rec?.id, rec?.name);
                    this.equation = rec;
                    this.config.equationId = rec.id;
                    this.config.equationName = rec.name;
                    this.loadingEquation = false;
                    this.reconcileBindings();
                },
                error: err => {
                    // console.warn('[RunEquationOverlayPopup] failed to load by name:', name, err);
                    this.equation = null;
                    this.loadingEquation = false;
                    this.loadError = err?.message || String(err);
                },
            }),
        );
    }

    ngOnDestroy(): void {
        this.subs.forEach(s => s.unsubscribe());
    }

    private initializeFromData(): void {
        const bofv = this.data.boundObjectFieldValues || {};
        if (bofv['equationId']) this.config.equationId = bofv['equationId'];
        if (bofv['equationName']) this.config.equationName = bofv['equationName'];
        if (Array.isArray(bofv['bindings'])) this.config.bindings = bofv['bindings'];
        if (bofv['resultTarget']) this.config.resultTarget = bofv['resultTarget'];
        if (bofv['resultVariableName']) this.config.resultVariableName = bofv['resultVariableName'];
        if (bofv['resultFieldPath']) this.config.resultFieldPath = bofv['resultFieldPath'];
    }

    // ── Equation loading ──────────────────────────────────────────────────

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
            // Ride above the parent state popup (z-index 2000) — see
            // styles.css `.state-overlay-picker-popup-panel`.
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

    // ── Completion checks ────────────────────────────────────────────────

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
    get totalDeclared(): number { return this.declaredSymbols.length; }
    get hasUnfilledPotentials(): boolean {
        return this.totalDeclared > 0 && this.filledCount < this.totalDeclared;
    }
    get declaredSymbols(): string[] {
        return (this.equation?.definition.variableBindings || [])
            .map(b => b.symbol)
            .filter(s => !!s);
    }

    /** Step-1 preview from the Equations page — the equation's LaTeX wrapped
     *  by its operation symbol. Gives the user the visual context for what
     *  the equation actually computes before they wire bindings. */
    get equationStep1Preview(): string {
        const def = this.equation?.definition;
        if (!def) return '';
        return buildPreviewLatex(def.latexExpression, def.operationType, def.bounds);
    }

    /** Short summary of the source bound to a symbol (e.g. "self.input_expression"
     *  or "[int] 42"). Mirrors the existing `getSourceLabel` formatting used
     *  across the rest of the no-code editor. */
    sourceSummary(symbol: string): string {
        const src = this.getBindingSource(symbol);
        return getSourceLabel(src);
    }

    /** Locked class for a per-binding selector (see equivalent on the inline
     *  overlay component for the rationale). */
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

    lockedFieldForSymbol(symbol: string): string {
        const declared = this.equation?.definition.variableBindings.find(b => b.symbol === symbol);
        const ds = declared && (declared as any).defaultSource;
        if (ds?.sourceType !== 'from_source_object') return '';
        const path: string = ds.sourceObjectPath || '';
        if (path.startsWith('self.')) return path.slice(5);
        const dot = path.lastIndexOf('.');
        return dot > 0 ? path.slice(dot + 1) : '';
    }

    // ── Emit ──────────────────────────────────────────────────────────────

    close(): void {
        this.dialogRef.close();
    }

    private emitChange(): void {
        this.fieldValuesChanged.emit({
            displayName: this.config.equationName || 'Calculus Operation',
            equationId: this.config.equationId,
            equationName: this.config.equationName,
            bindings: this.config.bindings,
            resultTarget: this.config.resultTarget,
            resultVariableName: this.config.resultVariableName,
            resultFieldPath: this.config.resultFieldPath,
        });
    }
}
