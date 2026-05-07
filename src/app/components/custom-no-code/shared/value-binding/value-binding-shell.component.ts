// Author: Dustin Etts
// value-binding-shell.component.ts
//
// Parent shell shared by `value-source-selector` and `value-potential-selector`.
// Owns the chrome (optional header label, branch-kind dropdown, layout) and
// projects the active branch sub-component into its `<ng-content>` slot.
//
// The shell is intentionally dumb: it does not know what data each branch
// carries. Leaf selectors hold the config and pick which branch to render
// inside the projected content. The shell only emits when the user changes
// which branch kind is active.

import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
    BRANCH_OPTIONS,
    BranchKind,
    BranchOption,
    SelectorMode,
    modeHeaderLabel,
    modeHeaderTooltip,
} from './branch-types';

@Component({
    standalone: false,
    selector: 'app-value-binding-shell',
    templateUrl: './value-binding-shell.component.html',
    styleUrls: ['./value-binding-shell.component.css'],
})
export class ValueBindingShellComponent {

    /** Source vs Potential — drives header text and tooltip. */
    @Input() mode: SelectorMode = 'source';

    /** Show the "Data Source / Potential Selection" header pill. Default off
     *  so existing inline call sites stay visually unchanged. Popup contexts
     *  flip this on to disambiguate the two flavors. */
    @Input() showHeader: boolean = false;

    /** Free-form label shown on the branch-kind dropdown ("Source", "Left Side", etc). */
    @Input() label: string = 'Source';

    /** Which branch kinds the leaf selector wants to expose. The shell renders
     *  the dropdown by intersecting this with BRANCH_OPTIONS. */
    @Input() allowedBranches: BranchKind[] = [];

    /** Which branch is currently active — shell uses this to drive the dropdown
     *  selection state, but the leaf owns the source of truth. */
    @Input() selectedBranch: BranchKind | '' = '';

    @Input() disabled: boolean = false;
    @Input() compact: boolean = false;

    /** Fired when the user picks a different branch kind in the dropdown.
     *  Leaf selectors react by swapping which branch sub-component they render. */
    @Output() branchChange = new EventEmitter<BranchKind>();

    /** Click/mousedown swallowed so the selector inside a draggable overlay
     *  doesn't accidentally start a drag. */
    onInteractionStart(event: Event): void {
        event.stopPropagation();
    }

    onBranchKindChange(kind: BranchKind | ''): void {
        if (!kind) return;
        this.selectedBranch = kind;
        this.branchChange.emit(kind);
    }

    /** Filtered options for the dropdown. */
    get visibleOptions(): BranchOption[] {
        if (!this.allowedBranches?.length) return BRANCH_OPTIONS;
        return BRANCH_OPTIONS.filter(o => this.allowedBranches.includes(o.kind));
    }

    get headerLabel(): string { return modeHeaderLabel(this.mode); }
    get headerTooltip(): string { return modeHeaderTooltip(this.mode); }
}
