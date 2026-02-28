// Author: Dustin Etts
// polari-platform-angular/src/app/utils/stepping.ts
//
// TypeScript stepping functions for no-code execution.
// Standardized checkpoint functions inserted between states in generated code.

export interface StepConfig {
  mode: 'run' | 'step' | 'performance';
  recordTiming?: boolean;
  recordContext?: boolean;
  customTags?: Record<string, any>;
}

export interface StepRecord {
  stepIndex: number;
  stateName: string;
  stateClass: string;
  timestamp: number;
  timing?: { wallTime: number };
  contextSnapshot?: Record<string, any>;
  customTags?: Record<string, any>;
}

/**
 * Standardized checkpoint inserted between states in generated code.
 *
 * In 'run' mode: minimal overhead (just timestamp).
 * In 'step' mode: captures full context snapshot.
 * In 'performance' mode: captures timing + optional memory.
 */
export function stepCheckpoint(
  stepIndex: number,
  stateName: string,
  stateClass: string,
  context: Record<string, any>,
  config?: StepConfig,
  traceCollector?: StepRecord[]
): StepRecord {
  const record: StepRecord = {
    stepIndex,
    stateName,
    stateClass,
    timestamp: Date.now(),
  };

  if (config?.recordTiming) {
    record.timing = { wallTime: performance.now() };
  }

  if (!config || config.recordContext !== false) {
    // Deep clone context to capture snapshot
    try {
      record.contextSnapshot = JSON.parse(JSON.stringify(context));
    } catch {
      record.contextSnapshot = { ...context };
    }
  }

  if (config?.customTags) {
    record.customTags = config.customTags;
  }

  if (traceCollector) {
    traceCollector.push(record);
  }

  return record;
}
