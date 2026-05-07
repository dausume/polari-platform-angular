import { Component, Input } from '@angular/core';
import { EquationExecutionResult } from '@models/equations/EquationDefinition';

/**
 * Reusable component that visualises the response of an equation
 * execution: latex result via KaTeX, numeric result, warnings, or error.
 *
 * Reused across the equation-config edit page, the inline calculus
 * state overlay, and any future "run-and-show-result" UI.
 *
 * Boolean handling:
 *  When the backend's operation is conditional (predicate / identity /
 *  piecewise on bool branch), `result_numeric` is a real boolean, NOT 1/0.
 *  This component renders bool results as "True" / "False" with a coloured
 *  pill so the user can see the result at a glance.
 */
@Component({
    standalone: false,
    selector: 'equation-result-display',
    templateUrl: './equation-result-display.component.html',
    styleUrls: ['./equation-result-display.component.scss']
})
export class EquationResultDisplayComponent {
    @Input() result: EquationExecutionResult | null = null;
    @Input() loading: boolean = false;

    /** Tracks the "Copied!" tooltip flash on the raw-LaTeX copy button. */
    copied: boolean = false;

    copyResultLatex(): void {
        const latex = this.result?.result_latex;
        if (!latex) return;
        try {
            navigator.clipboard?.writeText(latex);
            this.copied = true;
            setTimeout(() => { this.copied = false; }, 1500);
        } catch (_) {
            this.copied = false;
        }
    }

    get hasResult(): boolean {
        return !!this.result;
    }

    get isBooleanResult(): boolean {
        return !!this.result && typeof this.result.result_numeric === 'boolean';
    }

    get booleanValue(): boolean {
        return !!(this.result && this.result.result_numeric);
    }

    get numericString(): string {
        if (!this.result || this.result.result_numeric === null || this.result.result_numeric === undefined) {
            return '';
        }
        const v = this.result.result_numeric;
        // Booleans handled separately in the template — skip here.
        if (typeof v === 'boolean') {
            return '';
        }
        if (Array.isArray(v)) {
            const max = 12;
            if (v.length <= max) return `[${v.map(n => formatNum(n)).join(', ')}]`;
            const head = v.slice(0, max).map(n => formatNum(n)).join(', ');
            return `[${head}, ... (${v.length} values)]`;
        }
        return formatNum(v);
    }
}

function formatNum(n: number): string {
    if (typeof n !== 'number' || Number.isNaN(n)) return String(n);
    if (Number.isInteger(n)) return n.toString();
    // Trim long floats
    if (Math.abs(n) > 1e6 || (Math.abs(n) > 0 && Math.abs(n) < 1e-4)) {
        return n.toExponential(6);
    }
    return n.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
}
