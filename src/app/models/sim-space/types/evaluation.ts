/**
 * @cross-cutting
 * @tags @xc:render-shared, @xc:bindings
 * @see /OVERLAP_MAP.md
 *
 * SimSpace evaluation-equation snapshot types — the response shape for
 * pre-computed live readouts on a scene. Backend evaluates each
 * SimSpaceEvaluationEquation at every recorded step during snapshot
 * compile; the viewer just looks up the current step's value.
 *
 * Three views are derived in the frontend from this data:
 *   - Math form: render `mathLatex` directly via KaTeX.
 *   - Software form: rewrite mathLatex by replacing each binding's
 *     `symbol` with its `softwareName`, then KaTeX-render.
 *   - Substituted form: rewrite mathLatex by replacing each binding's
 *     `symbol` with the current step's numeric value, then KaTeX-render.
 */
import { SimSpacePosition } from './core';

export type SimSpaceEvaluationAnchorKind = 'screen' | 'world';

export type SimSpaceEvaluationScreenCorner =
  | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface SimSpaceEvaluationAnchorScreen {
  corner: SimSpaceEvaluationScreenCorner;
}

export interface SimSpaceEvaluationAnchorWorld {
  position: SimSpacePosition;
}

export type SimSpaceEvaluationBindingSource =
  | { kind: 'const';    value: number }
  | { kind: 'param';    name: string }
  | { kind: 'simState'; class: string; field: string };

export interface SimSpaceEvaluationBinding {
  /** Math symbol as written in the LaTeX expression (e.g. "\\omega"). */
  symbol: string;
  /** Software variable name the symbol is bound to (e.g. "omega"). */
  softwareName: string;
  source: SimSpaceEvaluationBindingSource;
}

export interface SimSpaceEvaluationStep {
  step: number;
  time: number;
  /** Resolved symbol → value map for this step. Drives the substituted view. */
  values: Record<string, number | string>;
  /** Numeric result, or null when evaluation failed. */
  result: number | null;
  /** Backend's already-rendered LaTeX of the result, when available. */
  resultLatex?: string;
  /** Error message when result === null. */
  error?: string;
}

export interface SimSpaceEvaluationSnapshot {
  /** Stable id for keyed rendering. */
  id: string;
  /** SimSpaceEvaluationEquation.name. */
  name: string;
  description: string;
  /** As-authored LaTeX with math symbols. */
  mathLatex: string;
  /** Executor operation type (almost always "evaluate" for live readouts). */
  operationType: string;
  bindings: SimSpaceEvaluationBinding[];
  /** Display unit + precision sourced from the referenced SimVariable. */
  unit: string;
  precision: number;
  resultVariableRef: string;
  anchorKind: SimSpaceEvaluationAnchorKind;
  anchorData: SimSpaceEvaluationAnchorScreen | SimSpaceEvaluationAnchorWorld | Record<string, unknown>;
  sortOrder: number;
  /**
   * Pre-computed values, one entry per recorded step. The viewer matches
   * the scrubber's current time/step to find which entry to display.
   */
  perStep: SimSpaceEvaluationStep[];
}
