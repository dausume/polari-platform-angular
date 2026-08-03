// Full-size popup for the MatrixEquationOperation state. Opened via MatDialog
// from the canvas expand button. Rather than reimplement the editor (as the
// Calculus popup does), this is a THIN wrapper that hosts the SAME inline
// `run-matrix-equation-overlay` forced to a large width so it renders its
// 'full' size tier — the complete operand-binding editor — in a scrollable
// dialog that can never be clipped by the SVG canvas. All editing logic lives
// in RunMatrixEquationOverlayComponent; this just forwards data + edits.
//
// Why this fixes "popup opens the smallest view": the previous wiring routed
// the expand button to the generic `showFullViewPopup` (a bare class/field
// editor). The overlay's size tier is driven purely by its `width` input, so
// passing a large width here guarantees the full editor.

import { Component, EventEmitter, Inject, Output } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import {
    AvailableInput,
    SourceObjectField,
} from '../../../../shared/value-source-selector/value-source-selector.component';

export interface RunMatrixEquationOverlayPopupData {
    stateName: string;
    boundObjectFieldValues: { [key: string]: any };
    availableInputs: AvailableInput[];
    sourceObjectFields: SourceObjectField[];
}

// Width that resolves to the 'full' size tier (>= 140px via resolveSizeTier).
const POPUP_OVERLAY_WIDTH = 880;
const POPUP_OVERLAY_HEIGHT = 600;

@Component({
    standalone: false,
    selector: 'run-matrix-equation-overlay-popup',
    template: `
        <div class="run-matrix-equation-overlay-popup">
            <run-matrix-equation-overlay
                [stateName]="data.stateName"
                boundClassName="MatrixEquationOperation"
                [boundObjectFieldValues]="data.boundObjectFieldValues"
                [availableInputs]="data.availableInputs"
                [sourceObjectFields]="data.sourceObjectFields"
                [width]="overlayWidth"
                [height]="overlayHeight"
                (fieldValuesChanged)="fieldValuesChanged.emit($event)">
            </run-matrix-equation-overlay>
        </div>
    `,
    styles: [`
        .run-matrix-equation-overlay-popup {
            width: min(880px, calc(100vw - 2 * var(--page-pad)));
            max-width: 95vw;
            max-height: 90vh;
            overflow: auto;
        }
    `],
})
export class RunMatrixEquationOverlayPopupComponent {
    @Output() fieldValuesChanged = new EventEmitter<{ [key: string]: any }>();

    readonly overlayWidth = POPUP_OVERLAY_WIDTH;
    readonly overlayHeight = POPUP_OVERLAY_HEIGHT;

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: RunMatrixEquationOverlayPopupData,
        private dialogRef: MatDialogRef<RunMatrixEquationOverlayPopupComponent>,
    ) {}

    close(): void {
        this.dialogRef.close();
    }
}
