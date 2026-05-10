// Author: Dustin Etts
// from-object-branch.component.ts
//
// Renders the "pick an object instance + field path" UI in three flavours:
//
//   1. **Locked source-mode** (`[lockedClass]` set, optionally `[lockedField]`)
//      The hosting binding (e.g. an equation's pre-wired potential) has
//      already nailed down the class — and usually the field — so the user
//      only needs to pick WHICH instance to read from. Header reads
//      "From {ClassName} Instance"; field is read-only when locked; instance
//      picker dropdown lists `self` (when present in `sourceObjectFields`)
//      plus all loaded instances of the class via `RuntimeInstanceService`.
//
//   2. **Source-mode** (no lock, `sourceObjectFields` populated)
//      Classic two-step Object → Field flow over the host context's
//      available fields (e.g. `self.field1`, `self.field2`).
//
//   3. **Source-mode standalone** (no lock, no fields, `[allowAnyInstancePick]=true`)
//      Used by the equations page when editing a binding outside any state.
//      Shows a "Browse all instances" pill that opens InstancePickerDialog
//      across all classes.
//
//   4. **Potential-mode** (`mode === 'potential'`)
//      Class-selector dialog pill — declares the class shape, no instance.
//
// Type-aware warning: when locked-class has zero loaded instances, surface
// a yellow advisory so the user knows nothing will resolve at runtime.

import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { SourceObjectField } from '../../value-source-selector/value-source-selector.component';
import { SelectorMode } from '../branch-types';
import {
    ClassSelectorDialogComponent,
    ClassSelectorDialogResult,
} from '@components/shared/class-selector-dialog/class-selector-dialog';
import { InstancePickerDialogComponent } from '@components/shared/instance-picker-dialog/instance-picker-dialog';
import {
    RuntimeInstanceService,
    RuntimeInstanceSummary,
} from '@services/runtime-instance/runtime-instance.service';
import {
    encodeInstancePath,
    decodeInstancePath,
    InstancePathParts,
} from '@models/shared/instance-path';

export interface FromObjectValue {
    /** Dotted instance path (source mode) or class identifier (potential mode). */
    objectPath: string;
}

@Component({
    standalone: false,
    selector: 'app-from-object-branch',
    templateUrl: './from-object-branch.component.html',
    styleUrls: ['./from-object-branch.component.css'],
})
export class FromObjectBranchComponent implements OnInit, OnChanges, OnDestroy {

    @Input() mode: SelectorMode = 'source';
    /** Read-only — never mutated locally. */
    @Input() objectPath: string = '';
    @Input() sourceObjectFields: SourceObjectField[] = [];
    @Input() disabled: boolean = false;
    /** When set, lock the selector to this class (host-state's pre-wired class
     *  or an equation's `source_class`). Header changes to "From X Instance"
     *  and only the instance picker is interactive. */
    @Input() lockedClass: string = '';
    /** Optional field name to fix when locked. */
    @Input() lockedField: string = '';
    /** Allow opening InstancePickerDialog for cross-class browse when no
     *  pre-wired sourceObjectFields are available. Equations page = true,
     *  in-state = false. */
    @Input() allowAnyInstancePick: boolean = false;

    @Output() selectionChange = new EventEmitter<FromObjectValue>();

    /** Object name (top-level prefix). Held independently of `selectedFieldPath`. */
    selectedObjectName: string = '';
    selectedFieldPath: string = '';

    objectNames: string[] = [];
    fieldOptions: SourceObjectField[] = [];

    /** Live list of loaded instances of the locked class (when applicable). */
    runtimeInstances: RuntimeInstanceSummary[] = [];
    /** Currently picked runtime instance — held as the encoded path so the
     *  dropdown's [ngModel] is a stable string. */
    selectedRuntimeKey: string = '';

    private instancesSub: Subscription | null = null;

    constructor(
        private dialog: MatDialog,
        private runtimeInstances$$: RuntimeInstanceService,
    ) {}

    ngOnInit(): void {
        this.syncFromInputs();
        this.recomputeOptions();
        this.maybeStartPolling();
    }

    ngOnChanges(changes: SimpleChanges): void {
        let needsSync = false;
        let needsRecompute = false;
        if ('objectPath' in changes || 'mode' in changes) needsSync = true;
        if ('sourceObjectFields' in changes) needsRecompute = true;
        if ('lockedClass' in changes) {
            this.maybeStartPolling();
            needsSync = true;
        }
        if ('lockedField' in changes) needsSync = true;
        if (needsSync) this.syncFromInputs();
        if (needsSync || needsRecompute) this.recomputeOptions();
    }

    ngOnDestroy(): void {
        this.stopPolling();
    }

    private syncFromInputs(): void {
        const path = this.objectPath || '';
        this.selectedFieldPath = path;
        this.selectedRuntimeKey = '';
        if (!path) {
            this.selectedObjectName = '';
            return;
        }
        // self.<field> short-form
        if (path === 'self' || path.startsWith('self.')) {
            this.selectedObjectName = 'self';
            this.selectedRuntimeKey = path;
            return;
        }
        // Class:idField:idVal.field encoded form
        const decoded = decodeInstancePath(path);
        if (decoded) {
            this.selectedObjectName = decoded.className;
            this.selectedRuntimeKey = path;
            return;
        }
        // Legacy plain dotted path
        const dot = path.indexOf('.');
        this.selectedObjectName = dot > 0 ? path.substring(0, dot) : path;
    }

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

    // ── Live instance polling for locked-class mode ───────────────────────

    private maybeStartPolling(): void {
        this.stopPolling();
        if (this.mode !== 'source') return;
        if (!this.lockedClass) return;
        this.instancesSub = this.runtimeInstances$$.instances$(this.lockedClass).subscribe(list => {
            this.runtimeInstances = list || [];
        });
    }

    private stopPolling(): void {
        if (this.instancesSub) {
            this.instancesSub.unsubscribe();
            this.instancesSub = null;
        }
        this.runtimeInstances = [];
    }

    // ── Source-mode events (unlocked, two-step) ───────────────────────────

    onObjectNameChange(name: string): void {
        this.selectedObjectName = name;
        this.recomputeOptions();
        if (this.mode === 'potential') {
            this.selectedFieldPath = name;
            this.emit();
        }
    }

    onFieldPathChange(path: string): void {
        this.selectedFieldPath = path;
        this.emit();
    }

    // ── Source-mode events (locked) ──────────────────────────────────────

    /** Build candidate options for the locked-class instance dropdown:
     *   - `self.<field>` if the host-state's bound class matches our lockedClass
     *     (heuristic: any sourceObjectField with prefix `self.` is treated as
     *     self-bound; we trust the parent to only pass these when applicable)
     *   - Each loaded RuntimeInstance under the locked class. */
    get lockedInstanceOptions(): { key: string; label: string; isSelf: boolean }[] {
        const out: { key: string; label: string; isSelf: boolean }[] = [];
        const field = this.lockedField || this.derivedFieldFromPath();
        // self option, when the host context says `self.*` is in scope.
        if (this.sourceObjectFields.some(f => f.path.startsWith('self.'))) {
            out.push({
                key: encodeInstancePath({
                    className: 'self', idFieldNames: [], idValues: [], fieldName: field,
                }),
                label: `self  (this state's bound ${this.lockedClass})`,
                isSelf: true,
            });
        }
        for (const inst of this.runtimeInstances) {
            out.push({
                key: encodeInstancePath({
                    className: this.lockedClass,
                    idFieldNames: [inst.idFieldName],
                    idValues: [inst.id],
                    fieldName: field,
                }),
                label: `${inst.label || inst.id}  (${inst.idFieldName}=${inst.id})`,
                isSelf: false,
            });
        }
        return out;
    }

    onLockedInstanceChange(key: string): void {
        this.selectedRuntimeKey = key;
        this.selectedFieldPath = key;
        this.emit();
    }

    /** Pull the field name from the existing path or fall back to lockedField. */
    private derivedFieldFromPath(): string {
        if (this.lockedField) return this.lockedField;
        const decoded = decodeInstancePath(this.objectPath);
        if (decoded?.fieldName) return decoded.fieldName;
        const dot = (this.objectPath || '').lastIndexOf('.');
        return dot > 0 ? this.objectPath.substring(dot + 1) : '';
    }

    /** Resolved field name shown in the read-only field display. */
    get displayedField(): string {
        return this.derivedFieldFromPath();
    }

    /** True when locked but no loaded instance + no `self` option is available. */
    get hasNoCompatibleInstance(): boolean {
        if (!this.lockedClass) return false;
        return this.lockedInstanceOptions.length === 0;
    }

    // ── Cross-class instance picker (allowAnyInstancePick fallback) ──────

    openCrossClassInstancePicker(): void {
        if (this.disabled) return;
        // First-step: pick a class, then fall through to the InstancePicker.
        const classRef = this.dialog.open(ClassSelectorDialogComponent, {
            width: '480px',
            panelClass: 'state-overlay-picker-popup-panel',
            data: {
                title: 'Pick a class',
                subtitle: 'Choose the class to browse instances of.',
            },
        });
        classRef.afterClosed().subscribe((cr: ClassSelectorDialogResult | undefined) => {
            if (cr?.action !== 'select' || !cr.className) return;
            this.openInstancePickerFor(cr.className);
        });
    }

    /** Open InstancePickerDialog for a specific class; on pick, encode the
     *  result into our path convention and emit. */
    private openInstancePickerFor(className: string): void {
        const ref = this.dialog.open(InstancePickerDialogComponent, {
            width: '800px',
            maxHeight: '80vh',
            panelClass: 'state-overlay-picker-popup-panel',
            data: { className, multiple: false },
        });
        ref.afterClosed().subscribe((r: any) => {
            if (r?.action !== 'select' || !r.selectedIds?.length) return;
            const id = r.selectedIds[0];
            const idFieldName = (r.selected && r.selected._idFieldName) || 'id';
            const field = this.lockedField || this.derivedFieldFromPath() || '';
            const path = encodeInstancePath({
                className,
                idFieldNames: [idFieldName],
                idValues: [String(id)],
                fieldName: field,
            });
            this.selectedFieldPath = path;
            this.selectedObjectName = className;
            this.selectedRuntimeKey = path;
            this.emit();
        });
    }

    /** Browse just the locked class's instances when the inline dropdown isn't enough. */
    openLockedInstancePicker(): void {
        if (!this.lockedClass) return;
        this.openInstancePickerFor(this.lockedClass);
    }

    // ── Potential-mode (class-selector dialog) ────────────────────────────

    openClassSelector(): void {
        if (this.disabled) return;
        const ref = this.dialog.open(ClassSelectorDialogComponent, {
            width: '480px',
            panelClass: 'state-overlay-picker-popup-panel',
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
        this.selectedRuntimeKey = '';
        this.recomputeOptions();
        this.emit();
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private emit(): void {
        this.selectionChange.emit({ objectPath: this.selectedFieldPath });
    }

    trackByPath(_: number, f: SourceObjectField): string { return f.path; }
    trackByName(_: number, n: string): string { return n; }
    trackByOptionKey(_: number, o: { key: string }): string { return o.key; }

    getFieldDisplayName(field: SourceObjectField): string {
        return field.displayName || field.path.split('.').slice(1).join('.');
    }
}
