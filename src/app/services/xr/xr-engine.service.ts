/**
 * @module services/xr/xr-engine.service
 *
 * XrEngineService (xr-1) — THE single XR engine. Root singleton,
 * three-free: the three-side XrSessionRuntime is reached only via
 * dynamic import on first Enter-XR, so it rides the sim-space-3d lazy
 * chunk and no XR machinery loads for users who never enter.
 *
 * Guarantees (WEBXR_PLAN.md §1):
 *  - at most ONE XR renderer + ONE immersive session, ever;
 *  - Enter on interface X binds X's LIVE registered scene; entering
 *    another interface SWAPS the bound scene, never a second session;
 *  - exit (any path: our button, headset system button, device sleep)
 *    restores the flat view byte-identically and DISPOSES resources
 *    (Q5: dispose on exit).
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import { XrSceneRegistryService } from './xr-scene-registry.service';

export interface XrEngineState {
  /** An immersive session is live. */
  active: boolean;
  /** Registry entry id currently bound into the session (null = none). */
  boundEntryId: string | null;
  /** An enter() is in flight (button spinners; double-enter guard). */
  entering: boolean;
  /** Honest last-error surface for the UI (cleared on next enter). */
  lastError: string | null;
}

const IDLE: XrEngineState = {
  active: false, boundEntryId: null, entering: false, lastError: null,
};

@Injectable({ providedIn: 'root' })
export class XrEngineService {
  readonly state$ = new BehaviorSubject<XrEngineState>(IDLE);

  /** The live runtime (lazy-chunk object). Null between sessions —
   *  dispose-on-exit means we re-import cheap + rebuild on re-entry. */
  private runtime: {
    enter(entry: unknown): Promise<void>;
    switchTo(entry: unknown): void;
    exit(): Promise<void>;
    currentEntryId: string | null;
  } | null = null;

  constructor(private registry: XrSceneRegistryService) {}

  get state(): XrEngineState {
    return this.state$.value;
  }

  /** Enter (or switch to) the registered interface `entryId`.
   *  Active session → scene swap; no session → create one. */
  async enter(entryId: string): Promise<void> {
    const entry = this.registry.get(entryId);
    if (!entry) {
      this.patch({ lastError: `Unknown XR scene entry "${entryId}"` });
      return;
    }
    if (this.state.entering) return; // double-click guard

    if (this.runtime && this.state.active) {
      try {
        this.runtime.switchTo(entry);
        this.patch({ boundEntryId: entryId, lastError: null });
      } catch (e: any) {
        this.patch({ lastError: e?.message || String(e) });
      }
      return;
    }

    this.patch({ entering: true, lastError: null });
    try {
      // The dynamic import — the ONLY route into three-side XR code.
      const { XrSessionRuntime } = await import(
        '@services/sim-space-3d/xr/xr-session-runtime'
      );
      const runtime = new XrSessionRuntime({
        onEnded: () => {
          // Dispose-on-exit (Q5): the runtime already cleaned up;
          // drop it so re-entry rebuilds fresh.
          this.runtime = null;
          this.patch({ active: false, boundEntryId: null });
        },
      });
      await runtime.enter(entry);
      this.runtime = runtime;
      this.patch({ active: true, boundEntryId: entryId, entering: false });
    } catch (e: any) {
      this.runtime = null;
      this.patch({
        active: false, boundEntryId: null, entering: false,
        lastError: e?.message || String(e),
      });
    }
  }

  /** End the session. Safe to call when idle. State flips in the
   *  runtime's onEnded (single exit path for every way out). */
  async exit(): Promise<void> {
    await this.runtime?.exit();
  }

  /** A viewer is unmounting: if its scene is the bound one, exit
   *  first — never render a torn-down scene. */
  async onEntryUnregistering(entryId: string): Promise<void> {
    if (this.state.boundEntryId === entryId) await this.exit();
  }

  private patch(partial: Partial<XrEngineState>): void {
    this.state$.next({ ...this.state, ...partial });
  }
}
