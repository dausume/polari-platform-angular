// Author: Dustin Etts
// from-object-branch.component.ts
//
// Renders the "pick an object instance + field path" UI.
//
//   - SOURCE mode: two-step Object → Field dropdowns when sourceObjectFields
//     is supplied. Identical UX to the pre-refactor selector.
//   - POTENTIAL mode: a "Pick class…" pill that opens the shared
//     ClassSelectorDialog so the user picks from real registered classes,
//     not a free-text class name.
//
// Two non-obvious correctness rules are enforced here:
//
// 1. **The @Input `objectPath` is read-only** — local mirrors
//    (`selectedObjectName`, `selectedFieldPath`) are the only thing the
//    templates and event handlers touch. Mutating @Inputs from inside the
//    child raced Angular's change-detection tracker.
//
// 2. **The Field dropdown's option list is *cached* (`fieldOptions`)** rather
//    than computed via a method call inside `*ngFor`. A method call returns
//    a fresh array every CD cycle, which destroys & recreates the `<option>`
//    DOM nodes faster than `<select>`'s NgSelectOption can match the new
//    `[ngModel]` — the selection snapped to "Choose…" mid-sync.
//
// 3. **The output is named `selectionChange`, NOT `change`** — `change` is
//    the native DOM event `<select>` fires, and the bubbled native Event
//    was reaching the parent's `(change)` listener and overwriting the
//    legitimate emission with `undefined`.

import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { SourceObjectField } from '../../value-source-selector/value-source-selector.component';
import { SelectorMode } from '../branch-types';
import {
    ClassSelectorDialogComponent,
    ClassSelectorDialogResult,
} from '@components/shared/class-selector-dialog/class-selector-dialog';

export interface FromObjectValue {
    /** Dotted path to a live field (source mode) or class identifier (potential mode). */
    objectPath: string;
}

@Component({
    standalone: false,
    selector: 'app-from-object-branch',
    templateUrl: './from-object-branch.component.html',
    styleUrls: ['./from-object-branch.component.css'],
})
export class FromObjectBranchComponent implements OnInit, OnChanges {

    @Input() mode: SelectorMode = 'source';
    /** Read-only — never mutated locally. Parent supplies the canonical path. */
    @Input() objectPath: string = '';
    @Input() sourceObjectFields: SourceObjectField[] = [];
    @Input() disabled: boolean = false;

    /** Renamed from `change` to avoid collision with the native DOM `change`
     *  event that `<select>` fires (see class-level note 3). */
    @Output() selectionChange = new EventEmitter<FromObjectValue>();

    /** Object name (top-level prefix). Held independently of `selectedFieldPath`. */
    selectedObjectName: string = '';

    /** Mirror of the @Input objectPath. Templates bind to this; we never
     *  mutate the @Input from local handlers. */
    selectedFieldPath: string = '';

    /** Stable, cached option lists. Updated by `recomputeOptions()` only on
     *  meaningful input/state transitions — NOT on every CD cycle. */
    objectNames: string[] = [];
    fieldOptions: SourceObjectField[] = [];

    constructor(private dialog: MatDialog) {}

    ngOnInit(): void {
        this.syncFromInputs();
        this.recomputeOptions();
    }

    ngOnChanges(changes: SimpleChanges): void {
        let needsSync = false;
        let needsRecompute = false;
        if ('objectPath' in changes || 'mode' in changes) needsSync = true;
        if ('sourceObjectFields' in changes) needsRecompute = true;

        if (needsSync) this.syncFromInputs();
        if (needsSync || needsRecompute) this.recomputeOptions();
    }

    /** Re-derive local state from the @Input objectPath. */
    private syncFromInputs(): void {
        const path = this.objectPath || '';
        this.selectedFieldPath = path;
        if (!path) {
            this.selectedObjectName = '';
            return;
        }
        const dot = path.indexOf('.');
        this.selectedObjectName = dot > 0 ? path.substring(0, dot) : path;
    }

    /** Recompute the cached dropdown option lists. */
    private recomputeOptions(): void {
        const names = new Set<string>();
        for (const f of this.sourceObjectFields) {
            const dot = f.path.indexOf('.');
            if (dot > 0) names.add(f.path.substring(0, dot));
        }
        this.objectNames = Array.from(names);

        if (!this.selectedObjectName) {
            this.fieldOptions = [];
            return;
        }
        const prefix = this.selectedObjectName + '.';
        this.fieldOptions = this.sourceObjectFields.filter(f => f.path.startsWith(prefix));
    }

    // ── Source-mode (inline dropdowns) ────────────────────────────────────

    onObjectNameChange(name: string): void {
        this.selectedObjectName = name;
        this.recomputeOptions();
        if (this.mode === 'potential') {
            this.selectedFieldPath = name;
            this.emit();
        }
        // Source mode: defer emission until the user also picks a field.
    }

    onFieldPathChange(path: string): void {
        this.selectedFieldPath = path;
        this.emit();
    }

    // ── Potential-mode (class-selector dialog) ────────────────────────────

    openClassSelector(): void {
        if (this.disabled) return;
        const ref = this.dialog.open(ClassSelectorDialogComponent, {
            width: '480px',
            data: {
                title: 'Pick Object Class',
                subtitle: 'Declare the class of object this binding will receive at runtime.',
            },
        });
        ref.afterClosed().subscribe((result: ClassSelectorDialogResult | undefined) => {
            if (result?.action === 'select' && result.className) {
                this.selectedObjectName = result.className;
                this.selectedFieldPath = result.className;
                this.recomputeOptions();
                this.emit();
            }
        });
    }

    clearClass(): void {
        this.selectedObjectName = '';
        this.selectedFieldPath = '';
        this.recomputeOptions();
        this.emit();
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private emit(): void {
        this.selectionChange.emit({ objectPath: this.selectedFieldPath });
    }

    trackByPath(_: number, f: SourceObjectField): string { return f.path; }
    trackByName(_: number, n: string): string { return n; }

    getFieldDisplayName(field: SourceObjectField): string {
        return field.displayName || field.path.split('.').slice(1).join('.');
    }
}
