import { Injectable } from '@angular/core';
import { Subject, firstValueFrom } from 'rxjs';

import { MsimProofService } from './msim-proof.service';
import { MultiScaleSimDefinitionService } from './multi-scale-sim-definition.service';
import { SimulationRunService } from '@services/sim-space/simulation-run.service';

/** A stage's best-known run changed (a proof landed or was cleared). */
export interface StageRunChange {
  msim: string;
  stageKey: string;
  /** The proof winner's run, or null when the proof was cleared. */
  run: string | null;
}

/**
 * Resolves the `stage:<stageKey>` panel run token — "the run that
 * currently speaks for this stage" — so graph/scene panels can pin to a
 * runToCompletion stage (e.g. the material precondition) instead of the
 * page's primary run.
 *
 * Resolution order:
 *  1. The stage's cached PROOF winner (the search attempt that proved
 *     the currently selected substance) — tracked live via
 *     MsimProofService.proofChanged$.
 *  2. Fallback: the newest run of the stage's own simulationRef (the
 *     same convention the page's gate check uses).
 *
 * `stageRunChanged$` lets panels re-resolve when a new proof lands.
 */
@Injectable({ providedIn: 'root' })
export class MsimStageRunService {

  readonly stageRunChanged$ = new Subject<StageRunChange>();

  /** msim|stageKey → the latest proof winner's run name. */
  private winners = new Map<string, string>();
  /** msim|stageKey → the substance the latest proof was FOR — lets
   *  panels say "proving: Paraffin wax" instead of a machine name. */
  private substances = new Map<string, string>();
  /** msim|stageKey|substanceKey → that SUBSTANCE's winner run — the
   *  per-material axis family views (tabs / combined charts) pivot on. */
  private substanceWinners = new Map<string, string>();
  /** run name → human label (from SimulationRun.label, harvested from
   *  every run list this service fetches). */
  private labels = new Map<string, string>();

  constructor(
    private proofService: MsimProofService,
    private msimService: MultiScaleSimDefinitionService,
    private runService: SimulationRunService,
  ) {
    this.proofService.proofChanged$.subscribe(ev => {
      const key = `${ev.msim}|${ev.stageKey}`;
      const run = ev.report?.winner?.run ?? null;
      if (run) {
        this.winners.set(key, run);
        this.substances.set(key, ev.substanceLabel);
        this.substanceWinners.set(`${key}|${ev.substanceKey}`, run);
      } else {
        this.winners.delete(key);
        this.substances.delete(key);
        this.substanceWinners.delete(`${key}|${ev.substanceKey}`);
      }
      this.stageRunChanged$.next({ msim: ev.msim, stageKey: ev.stageKey, run });
    });
  }

  /** A specific substance's winner run for a stage (null = not proven
   *  this session — its family tab invites running the proof). */
  runForSubstance(msimName: string, stageKey: string,
                  substanceKey: string): string | null {
    return this.substanceWinners
      .get(`${msimName}|${stageKey}|${substanceKey}`) ?? null;
  }

  /** The human label of a run this service has seen, if any. */
  labelFor(run: string): string | null {
    return this.labels.get(run) ?? null;
  }

  /** The substance the stage's current proof speaks for, if any. */
  substanceFor(msimName: string, stageKey: string): string | null {
    return this.substances.get(`${msimName}|${stageKey}`) ?? null;
  }

  isStageToken(token: string | undefined | null): boolean {
    return !!token?.startsWith('stage:');
  }

  stageKeyOf(token: string): string {
    return token.slice('stage:'.length);
  }

  /** Map any panel run token to a concrete run name ('primary'/'compare'
   *  are the caller's business — they resolve against page state). */
  async resolveToken(token: string, msimName: string): Promise<string | null> {
    if (!this.isStageToken(token)) return token;
    return this.resolve(msimName, this.stageKeyOf(token));
  }

  async resolve(msimName: string, stageKey: string): Promise<string | null> {
    const winner = this.winners.get(`${msimName}|${stageKey}`) ?? null;
    if (winner && this.labels.has(winner)) return winner;
    try {
      const cfg = await firstValueFrom(this.msimService.loadByName(msimName));
      const stage = cfg.stages.find(s => s.key === stageKey);
      if (!stage?.simulationRef) return winner;
      const runs = await this.runService.list(stage.simulationRef);
      for (const r of runs) {
        if (r.label) this.labels.set(r.name, r.label);
      }
      return winner ?? runs[0]?.name ?? null;
    } catch {
      return winner;
    }
  }
}
