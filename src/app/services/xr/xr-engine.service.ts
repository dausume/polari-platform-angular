/**
 * @module services/xr/xr-engine.service
 *
 * XrEngineService (xr-1 + xr-2) — THE single XR engine. Root
 * singleton, three-free: the three-side XrSessionRuntime is reached
 * only via dynamic import on first Enter-XR, so it rides the
 * sim-space-3d lazy chunk and no XR machinery loads for users who
 * never enter.
 *
 * Guarantees (WEBXR_PLAN.md §1):
 *  - at most ONE XR renderer + ONE immersive session, ever;
 *  - Enter on interface X binds X's LIVE registered scene; entering
 *    another interface SWAPS the bound scene, never a second session;
 *  - exit (any path: our button, the wrist EXIT, headset system
 *    button, device sleep) restores the flat view byte-identically
 *    and DISPOSES resources (Q5: dispose on exit).
 *
 * xr-2: enter/switch resolve the space's framing + XrInterfaceVariant
 * config and hand them to the runtime (scale-relative entry, nav
 * knobs); the auto-derived entry scale is persisted back into the
 * variant on first entry (knob over magic); viewpoint bookmarks
 * round-trip through the variant per mode.
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import { XrSceneRegistryService, XrSceneEntry } from
  './xr-scene-registry.service';
import { XrSettingsService } from './xr-settings.service';
import { XrVariantService } from './xr-variant.service';
import {
  XrEnterContext, XrRigPose, XrVariantConfig, XrViewpointBookmark,
} from '@models/xr/xr-types';

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
    enter(entry: unknown, context: XrEnterContext): Promise<void>;
    switchTo(entry: unknown, context: XrEnterContext): void;
    exit(): Promise<void>;
    currentEntryId: string | null;
    resetView(): void;
    back(): boolean;
    currentPose(): XrRigPose | null;
    jumpTo(pose: XrRigPose): void;
  } | null = null;

  /** The bound space's name + last-loaded variant config (bookmark
   *  ops merge into this — other keys are preserved). */
  private boundSpaceName: string | null = null;
  private boundConfig: XrVariantConfig = {};

  constructor(
    private registry: XrSceneRegistryService,
    private settings: XrSettingsService,
    private variants: XrVariantService,
  ) {}

  get state(): XrEngineState {
    return this.state$.value;
  }

  /** Enter (or switch to) the registered interface `entryId`.
   *  Active session → scene swap; no session → create one. */
  async enter(entryId: string,
      opts?: { multiscaleName?: string }): Promise<void> {
    const entry = this.registry.get(entryId);
    if (!entry) {
      this.patch({ lastError: `Unknown XR scene entry "${entryId}"` });
      return;
    }
    if (this.state.entering) return; // double-click guard

    if (this.runtime && this.state.active) {
      try {
        const context =
          await this.buildContext(entry, opts?.multiscaleName);
        this.runtime.switchTo(entry, context);
        this.patch({ boundEntryId: entryId, lastError: null });
      } catch (e: any) {
        this.patch({ lastError: e?.message || String(e) });
      }
      return;
    }

    this.patch({ entering: true, lastError: null });
    try {
      const context =
        await this.buildContext(entry, opts?.multiscaleName);
      // The dynamic import — the ONLY route into three-side XR code.
      const { XrSessionRuntime } = await import(
        '@services/sim-space-3d/xr/xr-session-runtime'
      );
      const runtime = new XrSessionRuntime({
        onEnded: () => {
          // Dispose-on-exit (Q5): the runtime already cleaned up;
          // drop it so re-entry rebuilds fresh.
          this.runtime = null;
          this.boundSpaceName = null;
          this.boundConfig = {};
          this.patch({ active: false, boundEntryId: null });
        },
      });
      await runtime.enter(entry, context);
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

  // ------------------------------------------------------------------
  // xr-2: navigation + bookmarks (flat-side surface; the wrist UI
  // drives the same runtime methods in-session)
  // ------------------------------------------------------------------

  resetView(): void { this.runtime?.resetView(); }
  backView(): boolean { return this.runtime?.back() ?? false; }

  /** Bookmarks of the bound space's 'vr' variant (empty when idle). */
  listBookmarks(): XrViewpointBookmark[] {
    return this.boundConfig.bookmarks ?? [];
  }

  /** Save the CURRENT viewpoint under a name (replaces same-name).
   *  Persists into XrInterfaceVariant — a settings flip never touches
   *  it. */
  async saveBookmark(name: string): Promise<boolean> {
    const pose = this.runtime?.currentPose();
    if (!pose || !this.boundSpaceName || !name.trim()) return false;
    const bookmarks = (this.boundConfig.bookmarks ?? [])
      .filter(b => b.name !== name);
    bookmarks.push({ name, pose });
    await this.persistConfig({ bookmarks });
    return true;
  }

  gotoBookmark(name: string): boolean {
    const bookmark =
      (this.boundConfig.bookmarks ?? []).find(b => b.name === name);
    if (!bookmark || !this.runtime) return false;
    this.runtime.jumpTo(bookmark.pose);
    return true;
  }

  /** Deleting a bookmark is a deliberate act on the data. */
  async deleteBookmark(name: string): Promise<void> {
    if (!this.boundSpaceName) return;
    const bookmarks = (this.boundConfig.bookmarks ?? [])
      .filter(b => b.name !== name);
    await this.persistConfig({ bookmarks });
  }

  // ------------------------------------------------------------------

  /** Resolve what the runtime needs: framing (the xr-1 cascade) +
   *  the space's 'vr' variant config. Failures degrade honestly —
   *  entry proceeds on defaults rather than blocking the session. */
  private async buildContext(entry: XrSceneEntry,
      multiscaleName?: string): Promise<XrEnterContext> {
    let framing: XrEnterContext['framing'] = 'exhibit';
    try {
      const resolution =
        await this.settings.resolve(entry.spaceName, multiscaleName);
      if (resolution.framing === 'inside'
          || resolution.framing === 'exhibit') {
        framing = resolution.framing;
      }
    } catch { /* resolver unreachable → builtin 'exhibit' */ }

    let variantConfig: XrVariantConfig = {};
    try {
      variantConfig = await this.variants.getConfig(
        'sim-space', entry.spaceName, 'vr');
    } catch { /* no variant yet → defaults */ }

    this.boundSpaceName = entry.spaceName;
    this.boundConfig = variantConfig;

    return {
      framing,
      variantConfig,
      onDerivedEntryScale: scale => {
        // First entry: make the derived scale durable + editable.
        void this.persistConfig({ entry_scale: scale })
          .catch(() => { /* persistence is best-effort here */ });
      },
    };
  }

  private async persistConfig(patch: Partial<XrVariantConfig>):
      Promise<void> {
    if (!this.boundSpaceName) return;
    this.boundConfig = await this.variants.mergeConfig(
      'sim-space', this.boundSpaceName, 'vr', patch);
  }

  private patch(partial: Partial<XrEngineState>): void {
    this.state$.next({ ...this.state, ...partial });
  }
}
