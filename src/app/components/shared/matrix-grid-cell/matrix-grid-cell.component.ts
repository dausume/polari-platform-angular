import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Read-only display of one resolved matrix element — a number, a complex
 * value ({re, im}), or a passthrough string. Shared by the Values preview and
 * the Test-tab result grid (and reusable wherever a matrix value is shown).
 */
@Component({
    standalone: true,
    selector: 'matrix-grid-cell',
    imports: [CommonModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<span class="cell" [title]="formatted">{{ formatted }}</span>`,
    styles: [`
        .cell {
            display: inline-block;
            min-width: 48px;
            padding: 4px 8px;
            font-family: monospace;
            font-size: 12px;
            text-align: right;
            color: #0d47a1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
    `]
})
export class MatrixGridCellComponent {
    @Input() value: any = null;
    /** Significant figures for numeric display. */
    @Input() precision = 6;

    get formatted(): string {
        return MatrixGridCellComponent.format(this.value, this.precision);
    }

    static format(value: any, precision = 6): string {
        if (value === null || value === undefined) return '·';
        if (typeof value === 'number') return MatrixGridCellComponent.num(value, precision);
        if (typeof value === 'object' && 're' in value && 'im' in value) {
            const re = MatrixGridCellComponent.num(value.re, precision);
            if (!value.im) return re;
            const im = MatrixGridCellComponent.num(Math.abs(value.im), precision);
            return `${re} ${value.im < 0 ? '−' : '+'} ${im}i`;
        }
        return String(value);
    }

    private static num(n: number, precision: number): string {
        if (!isFinite(n)) return String(n);
        if (Number.isInteger(n)) return String(n);
        // Flexible: drop to scientific only past 6 orders of magnitude.
        const abs = Math.abs(n);
        if (abs !== 0 && (abs >= 1e6 || abs < 1e-6)) return n.toExponential(precision - 1);
        return parseFloat(n.toPrecision(precision)).toString();
    }
}
