import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

import { StageSearchReport } from './multi-scale-sim-definition.service';

/** A substance's proof state changed (search finished or was cleared). */
export interface ProofEvent {
  msim: string;
  stageKey: string;
  substanceKey: string;
  substanceLabel: string;
  /** The substance's physical identity (melting line etc.) — lets
   *  explainability views draw the analytic melt line the attempts
   *  were judged against. */
  substanceParams?: Record<string, number>;
  /** null = proof was cleared ("Try again"). */
  report: StageSearchReport | null;
}

/**
 * Session-scoped cache of first-principles PROOF results, keyed by
 * (composition, stage, substance). The material space's search endpoint
 * is stateless and resumable, so this cache is purely a UX accelerator:
 * re-selecting a substance shows its proven/impossible state instantly,
 * and a cache miss just re-converges quickly against the backend's
 * existing attempt runs.
 *
 * `proofChanged$` also carries proof states to the page's stage stepper
 * (the material stage's chip reflects the CURRENTLY SELECTED substance's
 * proof rather than an arbitrary newest run).
 */
@Injectable({ providedIn: 'root' })
export class MsimProofService {
  readonly proofChanged$ = new Subject<ProofEvent>();

  private cache = new Map<string, StageSearchReport>();

  private key(msim: string, stageKey: string, substanceKey: string): string {
    return `${msim}|${stageKey}|${substanceKey}`;
  }

  get(msim: string, stageKey: string, substanceKey: string): StageSearchReport | null {
    return this.cache.get(this.key(msim, stageKey, substanceKey)) ?? null;
  }

  set(msim: string, stageKey: string, substanceKey: string,
      substanceLabel: string, report: StageSearchReport,
      substanceParams?: Record<string, number>): void {
    this.cache.set(this.key(msim, stageKey, substanceKey), report);
    this.proofChanged$.next({
      msim, stageKey, substanceKey, substanceLabel, substanceParams, report,
    });
  }

  clear(msim: string, stageKey: string, substanceKey: string,
        substanceLabel: string): void {
    this.cache.delete(this.key(msim, stageKey, substanceKey));
    this.proofChanged$.next({ msim, stageKey, substanceKey, substanceLabel, report: null });
  }
}
