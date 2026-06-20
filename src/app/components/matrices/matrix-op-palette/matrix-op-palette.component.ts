import { ChangeDetectionStrategy, Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
    MATRIX_OP_PALETTE, MatrixOpPaletteCategory, MatrixOpPaletteEntry,
} from '@models/matrices/MatrixOpPalette';

/**
 * Operation palette toolbar for the Expression editor — the matrix analogue of
 * the LaTeX symbol palette. Renders categorized operation buttons and emits
 * `(insert)` with the chosen entry; the host inserts `entry.snippet` at the
 * caret (using `entry.cursorOffset` for templates like `inv(│)`).
 */
@Component({
    standalone: true,
    selector: 'matrix-op-palette',
    imports: [CommonModule, MatIconModule, MatTooltipModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="palette">
            <div class="cat" *ngFor="let c of categories; trackBy: trackByCat">
                <span class="cat-name"><mat-icon *ngIf="c.icon">{{ c.icon }}</mat-icon>{{ c.name }}</span>
                <div class="btns">
                    <button type="button" class="op-btn mono"
                            *ngFor="let e of c.entries; trackBy: trackByEntry"
                            [matTooltip]="e.description"
                            (click)="insert.emit(e)">
                        {{ e.label }}
                    </button>
                </div>
            </div>
        </div>
    `,
    styles: [`
        .palette { display: flex; flex-wrap: wrap; gap: 10px; }
        .cat { display: flex; flex-direction: column; gap: 3px; }
        .cat-name {
            display: flex; align-items: center; gap: 3px;
            font-size: 10px; font-weight: 700; text-transform: uppercase;
            letter-spacing: 0.04em; color: #8a94a6;
        }
        .cat-name mat-icon { font-size: 13px; width: 13px; height: 13px; }
        .btns { display: flex; flex-wrap: wrap; gap: 4px; }
        .op-btn {
            border: 1px solid #cfe0f5; background: #f3f8ff; color: #0d47a1;
            border-radius: 5px; padding: 3px 8px; font-size: 11px; cursor: pointer;
        }
        .op-btn:hover { background: #e3eefc; }
        .mono { font-family: monospace; }
    `]
})
export class MatrixOpPaletteComponent {
    @Output() insert = new EventEmitter<MatrixOpPaletteEntry>();
    categories: MatrixOpPaletteCategory[] = MATRIX_OP_PALETTE;

    trackByCat(_: number, c: MatrixOpPaletteCategory): string { return c.name; }
    trackByEntry(_: number, e: MatrixOpPaletteEntry): string { return e.label; }
}
