// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/states/events/analysis-call/analysis-call.model.ts

import { ValueSourceConfig } from '../../_shared/value-source-config';

/**
 * AnalysisCall (cal-4) — Run one registered backend analysis (an
 * AnalysisDefinition row, or module:function) with resolved params; its
 * dict result lands in the context for the steps that follow.
 * Python backend only.
 */
export class AnalysisCall {
  type = 'AnalysisCall';
  displayName: string;
  /** AnalysisDefinition row name, or `module:function`. */
  analysis: string;
  /** name → literal or ValueSourceConfig. */
  params: { [name: string]: any | ValueSourceConfig };
  /** Optional key to pick out of the analysis result dict. */
  pick: string;
  resultVariable: string;
  description: string;

  constructor(
    displayName: string = 'Analysis Call',
    analysis: string = '',
    params: { [name: string]: any | ValueSourceConfig } = {},
    pick: string = '',
    resultVariable: string = 'analysis',
    description: string = 'Run one registered backend analysis'
  ) {
    this.displayName = displayName;
    this.analysis = analysis;
    this.params = params;
    this.pick = pick;
    this.resultVariable = resultVariable;
    this.description = description;
  }
}
