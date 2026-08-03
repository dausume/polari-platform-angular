// Full-size popup for the EngineModelOperation state. Opened via MatDialog
// from the canvas expand button. Mirrors the MatrixEquationOperation popup:
// rather than reimplement the editor, this is a THIN wrapper that hosts the
// SAME inline `run-engine-model-overlay` forced to a large width so it
// renders its 'full' size tier — the complete model-ref / input-binding /
// result-key-map editor — in a scrollable dialog that can never be clipped
// by the SVG canvas. All editing logic lives in RunEngineModelOverlayComponent;
// this just forwards data + edits.

import { Component, EventEmitter, Inject, Output } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import {
    AvailableInput,
    SourceObjectField,
} from '../../../../shared/value-source-selector/value-source-selector.component';

export interface RunEngineModelOverlayPopupData {
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
    selector: 'run-engine-model-overlay-popup',
    template: `
        <div class="run-engine-model-overlay-popup">
            <run-engine-model-overlay
                [stateName]="data.stateName"
                boundClassName="EngineModelOperation"
                [boundObjectFieldValues]="data.boundObjectFieldValues"
                [availableInputs]="data.availableInputs"
                [sourceObjectFields]="data.sourceObjectFields"
                [width]="overlayWidth"
                [height]="overlayHeight"
                (fieldValuesChanged)="fieldValuesChanged.emit($event)">
            </run-engine-model-overlay>
        </div>
    `,
    styles: [`
        .run-engine-model-overlay-popup {
            width: min(880px, calc(100vw - 2 * var(--page-pad)));
            max-width: 95vw;
            max-height: 90vh;
            overflow: auto;
        }
    `],
})
export class RunEngineModelOverlayPopupComponent {
    @Output() fieldValuesChanged = new EventEmitter<{ [key: string]: any }>();

    readonly overlayWidth = POPUP_OVERLAY_WIDTH;
    readonly overlayHeight = POPUP_OVERLAY_HEIGHT;

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: RunEngineModelOverlayPopupData,
        private dialogRef: MatDialogRef<RunEngineModelOverlayPopupComponent>,
    ) {}

    close(): void {
        this.dialogRef.close();
    }
}
