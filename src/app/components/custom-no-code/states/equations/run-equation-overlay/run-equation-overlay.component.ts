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

    @Input() boundClassName: string = 'RunEquation';
    @Input() boundObjectFieldValues: { [key: string]: any } | null = null;
    @Input() availableInputs: AvailableInput[] = [];
    @Input() sourceObjectFields: SourceObjectField[] = [];

    @Output() fieldValuesChanged = new EventEmitter<{ [key: string]: any }>();

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
        if (this.config.equationId) {
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
}
