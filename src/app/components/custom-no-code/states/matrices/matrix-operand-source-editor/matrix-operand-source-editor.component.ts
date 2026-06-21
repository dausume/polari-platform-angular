// Author: Dustin Etts
// matrix-operand-source-editor.component.ts
//
// Per-operand source editor for the MatrixEquationOperation no-code state.
//
// The standard `app-value-source-selector` covers the SCALAR runtime source
// kinds (sim field / upstream variable / literal / dataset / LaTeX) — but a
// matrix-equation operand is frequently a VECTOR. The engine resolves vectors
// via the `array` source kind (assemble N element sources) and extracts
// components via the `element` kind (see
// SolutionExecutionEngine._resolve_value_source_config). Neither is exposed by
// the scalar selector.
//
// This wrapper adds a "kind" switch on top of the scalar selector:
//   • Scalar  → delegates straight to <app-value-source-selector>, emitting the
//               selector's own ValueSourceConfig unchanged (from_source_object,
//               from_input, direct_assignment, from_latex, from_dataset).
//   • Vector  → renders N scalar <app-value-source-selector> leaves and emits
//               { sourceType: 'array', elements: [<leaf>, ...] }, letting the
//               user author e.g. f ← [self.f_app_x, self.f_app_y, self.f_app_z].
//
// It emits a MatrixValueSourceConfig via (sourceChange). The host overlay
// persists it into the operand binding's `source`.

import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import {
    AvailableInput,
    SourceObjectField,
} from '../../../shared/value-source-selector/value-source-selector.component';
import { ValueSourceConfig, createDefaultValueSourceConfig } from '@models/stateSpace';
import { MatrixValueSourceConfig } from '../run-matrix-equation/run-matrix-equation.model';

type EditorKind = 'scalar' | 'vector';

@Component({
    standalone: false,
    selector: 'matrix-operand-source-editor',
    templateUrl: './matrix-operand-source-editor.component.html',
    styleUrls: ['./matrix-operand-source-editor.component.css'],
})
export class MatrixOperandSourceEditorComponent implements OnInit, OnChanges {

    /** The current source config for this operand (may be scalar or `array`). */
    @Input() config: MatrixValueSourceConfig = createDefaultValueSourceConfig('from_source_object');

    @Input() availableInputs: AvailableInput[] = [];
    @Input() sourceObjectFields: SourceObjectField[] = [];

    @Output() sourceChange = new EventEmitter<MatrixValueSourceConfig>();

    kind: EditorKind = 'scalar';

    /** Scalar branch value (when kind === 'scalar'). */
    scalarConfig: ValueSourceConfig = createDefaultValueSourceConfig('from_source_object');

    /** Vector element sources (when kind === 'vector'). */
    elements: ValueSourceConfig[] = [];

    ngOnInit(): void {
        this.syncFromConfig();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['config'] && !changes['config'].firstChange) {
            this.syncFromConfig();
        }
    }

    private syncFromConfig(): void {
        const c = this.config;
        if (c && c.sourceType === 'array') {
            this.kind = 'vector';
            const els = Array.isArray(c.elements) ? c.elements : [];
            // Vector leaves are always scalar sources — coerce defensively.
            this.elements = els.map(e => this.asScalar(e));
            if (this.elements.length === 0) {
                this.elements = [createDefaultValueSourceConfig('from_source_object')];
            }
        } else {
            this.kind = 'scalar';
            this.scalarConfig = this.asScalar(c) || createDefaultValueSourceConfig('from_source_object');
        }
    }

    /** Strip the collection-only fields so a value is a plain scalar
     *  ValueSourceConfig the standard selector can render. */
    private asScalar(c: MatrixValueSourceConfig | undefined): ValueSourceConfig {
        if (!c || !c.sourceType || c.sourceType === 'array' || c.sourceType === 'element') {
            return createDefaultValueSourceConfig('from_source_object');
        }
        const { elements, source, index, ...rest } = c as any;
        return rest as ValueSourceConfig;
    }

    // ── Kind switch ──────────────────────────────────────────────────────────

    setKind(kind: EditorKind): void {
        if (this.kind === kind) return;
        this.kind = kind;
        if (kind === 'vector' && this.elements.length === 0) {
            this.elements = [createDefaultValueSourceConfig('from_source_object')];
        }
        this.emit();
    }

    // ── Scalar branch ────────────────────────────────────────────────────────

    onScalarChange(cfg: ValueSourceConfig): void {
        this.scalarConfig = cfg;
        this.emit();
    }

    // ── Vector branch ────────────────────────────────────────────────────────

    addElement(): void {
        this.elements = [...this.elements, createDefaultValueSourceConfig('from_source_object')];
        this.emit();
    }

    removeElement(i: number): void {
        this.elements = this.elements.filter((_, idx) => idx !== i);
        if (this.elements.length === 0) {
            this.elements = [createDefaultValueSourceConfig('from_source_object')];
        }
        this.emit();
    }

    onElementChange(i: number, cfg: ValueSourceConfig): void {
        this.elements = this.elements.map((e, idx) => (idx === i ? cfg : e));
        this.emit();
    }

    trackByIndex(i: number): number {
        return i;
    }

    // ── Emit ─────────────────────────────────────────────────────────────────

    private emit(): void {
        if (this.kind === 'vector') {
            this.sourceChange.emit({
                sourceType: 'array',
                elements: this.elements.map(e => ({ ...e })),
            } as MatrixValueSourceConfig);
        } else {
            this.sourceChange.emit({ ...this.scalarConfig } as MatrixValueSourceConfig);
        }
    }
}
