/**
 * @cross-cutting
 * @tags @xc:render-shared, @xc:overlay
 * @consumers
 *   - SimSpaceViewer (renders the ONE selected overlay alongside its
 *     selector; multi-readout stacking happens via the selector, not by
 *     instantiating more of these components).
 * @impact-on-edit
 *   This component is purely presentation. Three views (math / vars /
 *   subst) plus a result line, all KaTeX-rendered via the shared
 *   katex-display component.
 * @see /OVERLAP_MAP.md
 *
 * Renders one live-evaluated equation readout. Three named views:
 *   - "math":  the equation as authored (math symbols).
 *   - "vars":  the same equation with each symbol replaced by the
 *              software variable name it's bound to, each wrapped in
 *              parens so the eye can tell adjacent names apart
 *              (\\frac{1}{2}\\cdot(mass)\\cdot(L)^{2}\\cdot(omega)^{2}).
 *   - "subst": the equation with each symbol replaced by its current
 *              numeric value, again paren-wrapped.
 *
 * Symbol substitution uses a two-pass sentinel rewrite. A naive
 * `String.split(symbol).join(replacement)` cascades through replaced
 * text — replacing `m` after replacing `\\omega` to `\\mathrm{omega}`
 * destroys the previous step. The sentinel approach inserts opaque
 * placeholders during pass 1 and resolves them in pass 2 so later
 * symbols never collide with earlier replacements.
 *
 * Single-letter symbols like `m`, `L`, `g` use a boundary-aware regex
 * so they don't match letters inside LaTeX commands (`\\mathrm`, `\\frac`)
 * or multi-letter identifiers.
 */

import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import { KatexDisplayComponent } from '@components/shared/katex-display/katex-display.component';
import {
  SimSpaceEvaluationBinding,
  SimSpaceEvaluationSnapshot,
  SimSpaceEvaluationStep,
} from '@models/sim-space/sim-space-types';

@Component({
  standalone: true,
  selector: 'sim-space-evaluation-overlay',
  imports: [CommonModule, KatexDisplayComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="eval-card" *ngIf="evaluation">
      <div class="eval-header">
        <span class="eval-name">{{ evaluation.name }}</span>
        <span class="eval-description" *ngIf="evaluation.description">{{ evaluation.description }}</span>
      </div>

      <section class="eval-view eval-view-math">
        <div class="eval-section-label">Math</div>
        <katex-display class="eval-katex"
                       [latex]="evaluation.mathLatex"
                       [displayMode]="false">
        </katex-display>
      </section>

      <section class="eval-view eval-view-vars">
        <div class="eval-section-label">Software variables</div>
        <katex-display class="eval-katex"
                       [latex]="softwareLatex"
                       [displayMode]="false">
        </katex-display>
        <!-- Per-binding origin: instance value vs simulation param vs
             literal const. Lets the analyst tell at a glance which
             inputs change over time (instance) and which are fixed by
             the simulation's defined config (param/const). -->
        <ul class="binding-list">
          <li *ngFor="let b of evaluation?.bindings || []"
              class="binding-row"
              [class.binding-instance]="b.source.kind === 'simState'"
              [class.binding-param]="b.source.kind === 'param'"
              [class.binding-const]="b.source.kind === 'const'">
            <span class="binding-name mono">{{ b.softwareName || b.symbol }}</span>
            <span class="binding-kind-badge">{{ kindLabel(b.source.kind) }}</span>
            <span class="binding-source mono">{{ sourceDescription(b.source) }}</span>
          </li>
        </ul>
      </section>

      <section class="eval-view eval-view-subst">
        <div class="eval-section-label">Substituted</div>
        <katex-display class="eval-katex"
                       [latex]="substitutedLatex"
                       [displayMode]="false"
                       placeholder="(pending — pause on a time)">
        </katex-display>
      </section>

      <div class="eval-result-row">
        <span class="eval-equals">=</span>
        <span class="eval-value mono">{{ formattedResult }}</span>
        <span class="eval-unit" *ngIf="evaluation.unit">{{ evaluation.unit }}</span>
        <span *ngIf="currentError" class="eval-error" [title]="currentError">err</span>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      pointer-events: auto;
    }
    .eval-card {
      background: rgba(255, 255, 255, 0.98);
      border: 1px solid #c8c8c8;
      border-radius: 8px;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
      font-size: 0.82rem;
      min-width: 240px;
      max-width: 400px;
      overflow: hidden;
    }
    .eval-header {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 8px 10px;
      background: #1e2a45;
      color: #fff;
    }
    .eval-name {
      font-weight: 600;
      font-family: monospace;
      font-size: 0.82rem;
    }
    .eval-description {
      font-size: 0.72rem;
      opacity: 0.85;
      line-height: 1.3;
    }
    .eval-view {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 8px 10px;
      border-bottom: 1px solid #ececec;
    }
    .eval-view:last-of-type { border-bottom: none; }
    .eval-view-math  { background: #f6f8fc; }
    .eval-view-vars  { background: #fdf7ea; }
    .eval-view-subst { background: #f0f8f1; }
    .eval-section-label {
      font-size: 0.65rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #555;
      font-weight: 600;
    }
    .eval-katex {
      overflow-x: auto;
      max-width: 100%;
    }
    .eval-result-row {
      padding: 10px;
      background: #fff;
      border-top: 2px solid #1e2a45;
      display: flex;
      align-items: baseline;
      gap: 6px;
      font-size: 0.95rem;
    }
    .eval-equals { color: #888; font-size: 1.05rem; }
    .eval-value { font-weight: 700; color: #1e2a45; }
    .eval-unit { color: #555; font-size: 0.85rem; }
    .eval-error {
      color: #c62828;
      font-size: 0.72rem;
      padding: 1px 6px;
      border: 1px solid #c62828;
      border-radius: 3px;
      margin-left: auto;
    }
    .mono { font-family: monospace; }

    /* Binding origin list — shown under the "vars" view so the analyst
       can tell which symbols are per-instance values (changing with the
       scrubber) vs. simulation-defined params (fixed for the run) vs.
       literal constants in the overlay config. */
    .binding-list {
      list-style: none;
      padding: 0;
      margin: 4px 0 0 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .binding-row {
      display: grid;
      grid-template-columns: minmax(60px, max-content) max-content 1fr;
      gap: 6px;
      align-items: baseline;
      font-size: 0.7rem;
      padding: 2px 0;
    }
    .binding-name { color: #1e2a45; font-weight: 600; }
    .binding-kind-badge {
      font-size: 0.62rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 1px 5px;
      border-radius: 3px;
      font-weight: 600;
    }
    .binding-instance .binding-kind-badge {
      background: #d3eafe; color: #1958a8;
    }
    .binding-param .binding-kind-badge {
      background: #fce7d2; color: #944a18;
    }
    .binding-const .binding-kind-badge {
      background: #e3e3e3; color: #555;
    }
    .binding-source { color: #666; }
  `]
})
export class SimSpaceEvaluationOverlayComponent implements OnChanges {
  @Input() evaluation: SimSpaceEvaluationSnapshot | null = null;
  /** Value at the current scrubber stop. `null` until the parent fetches
   *  the first on-demand evaluation. */
  @Input() currentStep: SimSpaceEvaluationStep | null = null;

  softwareLatex: string = '';
  substitutedLatex: string = '';
  formattedResult: string = '—';
  currentError: string | null = null;

  ngOnChanges(_: SimpleChanges): void {
    if (!this.evaluation) {
      this.softwareLatex = '';
      this.substitutedLatex = '';
      this.formattedResult = '—';
      this.currentError = null;
      return;
    }
    this.updateResultFields(this.currentStep);
    this.softwareLatex = this.buildSoftwareLatex();
    this.substitutedLatex = this.buildSubstitutedLatex(this.currentStep);
  }

  private updateResultFields(step: SimSpaceEvaluationStep | null): void {
    if (step === null) {
      this.formattedResult = '—';
      this.currentError = null;
      return;
    }
    if (step.error || step.result === null || step.result === undefined) {
      this.formattedResult = '—';
      this.currentError = step.error ?? 'no value';
      return;
    }
    const precision = this.evaluation?.precision ?? 2;
    this.formattedResult = this.formatNumber(step.result, precision);
    this.currentError = null;
  }

  private buildSoftwareLatex(): string {
    const bindings = this.evaluation?.bindings ?? [];
    return rewriteSymbolsInLatex(
      this.evaluation?.mathLatex ?? '',
      bindings,
      // Wrap each variable name in parens via \left(...\right) so KaTeX
      // sizes the parens nicely if a name is wide.
      (b) => `\\left(\\mathrm{${escapeForLatex(b.softwareName || b.symbol)}}\\right)`,
    );
  }

  private buildSubstitutedLatex(step: SimSpaceEvaluationStep | null): string {
    const bindings = this.evaluation?.bindings ?? [];
    if (!step) return this.evaluation?.mathLatex ?? '';
    return rewriteSymbolsInLatex(
      this.evaluation?.mathLatex ?? '',
      bindings,
      (b) => {
        const v = step.values?.[b.symbol];
        const formatted = typeof v === 'number'
          ? this.formatNumber(v, 4)
          : (v === undefined ? '?' : String(v));
        return `\\left(${formatted}\\right)`;
      },
    );
  }

  private formatNumber(value: number, precision: number): string {
    if (!Number.isFinite(value)) return String(value);
    if (precision <= 0) return Math.round(value).toString();
    return value.toFixed(precision);
  }

  /** Human label for the source kind — what the badge displays. */
  kindLabel(kind: string | undefined): string {
    switch (kind) {
      case 'simState': return 'instance';
      case 'param':    return 'param';
      case 'const':    return 'const';
      default:         return '?';
    }
  }

  /** Compact text after the badge describing where this symbol's value
   *  comes from. For instance bindings, points at the (class, field)
   *  pair; for params, the parameter name; for consts, the literal. */
  sourceDescription(source: { kind?: string; class?: string; field?: string; name?: string; value?: number } | undefined): string {
    if (!source) return '';
    if (source.kind === 'simState') return `${source.class}.${source.field}`;
    if (source.kind === 'param')    return `simulation.${source.name}`;
    if (source.kind === 'const')    return `${source.value}`;
    return '';
  }
}

// ---------------------------------------------------------------------------
// Symbol-substitution helpers
// ---------------------------------------------------------------------------

/**
 * Replace every binding's symbol in the LaTeX with the result of
 * `format(binding)`. Two-pass sentinel rewrite — pass 1 inserts opaque
 * placeholders, pass 2 resolves them. Without this, replacing `m` after
 * `\\omega` has already become `\\mathrm{omega}` would mangle the
 * earlier replacement (the `m` in `\\mathrm` matches).
 *
 * Single-letter symbols use a boundary-aware regex so they don't match
 * letters embedded inside LaTeX commands or multi-letter identifiers.
 */
function rewriteSymbolsInLatex(
  source: string,
  bindings: ReadonlyArray<SimSpaceEvaluationBinding>,
  format: (b: SimSpaceEvaluationBinding) => string,
): string {
  if (!source || !bindings || bindings.length === 0) return source;

  // Longest symbols first so e.g. `\omega` is matched before any
  // single-letter overlap concerns.
  const ordered = [...bindings]
    .filter((b) => !!b.symbol)
    .sort((a, b) => b.symbol.length - a.symbol.length);

  const replacements: string[] = [];
  let out = source;

  for (let i = 0; i < ordered.length; i++) {
    const b = ordered[i];
    const sentinel = `\u0001${i}\u0002`;
    replacements[i] = format(b);

    if (b.symbol.startsWith('\\')) {
      // LaTeX command-form symbol — match the command name; refuse to
      // match where the command is just a prefix of a longer one
      // (\omega vs \omegaTilde would matter if we ever had such).
      const escaped = b.symbol.replace(/\\/g, '\\\\');
      const re = new RegExp(`${escaped}(?![A-Za-z])`, 'g');
      out = out.replace(re, sentinel);
    } else if (b.symbol.length === 1 && /[A-Za-z]/.test(b.symbol)) {
      // Single-letter symbol — must NOT match when preceded by a letter
      // (mid-word like `mass`) OR a backslash (inside a command like
      // `\mathrm`). Must NOT be followed by a letter (otherwise we'd
      // chop the first letter off a longer identifier).
      const re = new RegExp(`(?<![A-Za-z\\\\])${b.symbol}(?![A-Za-z])`, 'g');
      out = out.replace(re, sentinel);
    } else {
      // Multi-char non-command symbol (rare). Plain split-join is safe
      // because longer symbols can't be a substring of shorter pending
      // ones (we sort descending).
      out = out.split(b.symbol).join(sentinel);
    }
  }

  // Pass 2 — swap sentinels for the real replacements.
  for (let i = 0; i < replacements.length; i++) {
    if (replacements[i] !== undefined) {
      out = out.split(`\u0001${i}\u0002`).join(replacements[i]);
    }
  }
  return out;
}

/** Make a software identifier safe to nest inside `\mathrm{...}` — KaTeX
 *  honors a few special LaTeX characters even in text-mode. Underscores
 *  and ampersands are the realistic risks; bracket nesting is the other. */
function escapeForLatex(name: string): string {
  return name
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/_/g, '\\_')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/&/g, '\\&')
    .replace(/\$/g, '\\$')
    .replace(/%/g, '\\%')
    .replace(/#/g, '\\#');
}
