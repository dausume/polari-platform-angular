// Author: Dustin Etts
// inline-expression-branch.component.ts
//
// The `inline_expression` branch — lets a value source carry a LaTeX
// expression evaluated by the backend's SymPy executor against the
// current engine context. Sibling of literal / from_upstream /
// from_object / from_dataset in the value-binding selector family.
//
// Persisted shape (ValueSourceConfig):
//   { sourceType: 'from_latex', latexExpression: '...' }
//
// The user types LaTeX; KaTeX renders the live preview underneath so
// they can see the formatted version before saving. Free symbols in
// the expression bind to context variables by name (multi-letter names
// like `alpha`, `dt` are pre-substituted; Greek `\omega`, `\theta`,
// single letters `m`, `L`, `g` resolve through SymPy's free-symbol
// matching).

import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface InlineExpressionBranchValue {
    latexExpression: string;
}

@Component({
    standalone: false,
    selector: 'app-inline-expression-branch',
    template: `
      <div class="branch">
        <label class="branch-label">LaTeX expression</label>
        <textarea class="latex-input"
                  [value]="latexExpression"
                  [disabled]="disabled"
                  (input)="onChange($any($event.target).value)"
                  rows="3"
                  placeholder="e.g., \\\\frac{1}{2} m L^2 \\\\omega^2">
        </textarea>
        <div class="hint muted small">
          Free symbols bind to context variables by name. Greek
          (<code>\\omega</code>, <code>\\theta</code>) and single
          letters (<code>m</code>, <code>L</code>, <code>g</code>) flow
          through SymPy; multi-letter names (<code>alpha</code>,
          <code>dt</code>) are pre-substituted from context numerics.
        </div>
        <div class="preview-label muted small" *ngIf="latexExpression">Preview</div>
        <katex-display *ngIf="latexExpression"
                       class="preview"
                       [latex]="latexExpression"
                       [displayMode]="false">
        </katex-display>
      </div>
    `,
    styles: [`
      .branch { display: flex; flex-direction: column; gap: 6px; }
      .branch-label { font-size: 0.75rem; color: #555; font-weight: 600; }
      .latex-input {
        width: 100%;
        font-family: monospace;
        font-size: 0.8rem;
        padding: 6px 8px;
        border: 1px solid #ccc;
        border-radius: 4px;
        resize: vertical;
        min-height: 60px;
      }
      .latex-input:focus { outline: none; border-color: #1976d2; }
      .hint { line-height: 1.4; }
      .preview-label { margin-top: 4px; text-transform: uppercase; letter-spacing: 0.05em; }
      .preview {
        background: #f7f7f9; border: 1px solid #e0e0e0; border-radius: 4px;
        padding: 8px 10px;
      }
      .muted { color: #777; }
      .small { font-size: 0.72rem; }
      code { background: #eef1f6; padding: 0 4px; border-radius: 3px; }
    `],
})
export class InlineExpressionBranchComponent {

    @Input() latexExpression: string = '';
    @Input() disabled: boolean = false;

    @Output() selectionChange = new EventEmitter<InlineExpressionBranchValue>();

    onChange(raw: string): void {
        this.latexExpression = raw;
        this.selectionChange.emit({ latexExpression: this.latexExpression });
    }
}
