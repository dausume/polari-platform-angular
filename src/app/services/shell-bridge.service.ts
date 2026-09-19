/**
 * ShellBridgeService — talks to the native JavaFX/JCEF shell when
 * the page is running inside it (handoff §31). The shell injects
 * `window.cefQuery`; when present, the isle store can trigger a
 * privileged local install (pkexec prompts for the password) instead
 * of only showing a copyable command. Outside the shell (a plain
 * browser), `available` is false and callers fall back to the copy
 * command.
 */
import { Injectable } from '@angular/core';

interface CefQuery {
  request: string;
  onSuccess: (response: string) => void;
  onFailure: (code: number, message: string) => void;
  persistent?: boolean;
}

declare global {
  interface Window {
    cefQuery?: (q: CefQuery) => void;
  }
}

export interface InstallResult {
  ok: boolean;
  exitCode?: number;
  output?: string;
  error?: string;
}

/** ci-11a — what the shell answers for a `pipeline.*` message. `json` is
 *  present when the verb's own output was a document (every `pol jenkins
 *  … --json` verb), so the caller never parses `output` by hand. */
export interface PipelineResult {
  ok: boolean;
  exitCode?: number;
  output?: string;
  json?: any;
  error?: string;
}

/** ci-11a — the answer to `pipeline.available`. `verbsProtocol` is the
 *  `protocol` field of the shell's copy of `polari-jenkins/shell-verbs.json`:
 *  a page that reads a protocol it does not know must degrade rather than
 *  guess, which is why it is asked for up front. */
export interface PipelineAvailability {
  available: boolean;
  mechanism?: string;
  verbsProtocol?: string;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class ShellBridgeService {
  /** True when running inside the native shell (bridge present). */
  get available(): boolean {
    return typeof window !== 'undefined'
      && typeof window.cefQuery === 'function';
  }

  private call(type: string, payload: object): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.available) {
        reject(new Error('no native shell bridge'));
        return;
      }
      let id = 'q';
      try { id = Math.random().toString(36).slice(2); } catch {}
      window.cefQuery!({
        request: JSON.stringify({ v: 1, id, type, payload }),
        onSuccess: (response) => {
          try {
            const parsed = JSON.parse(response);
            resolve(parsed.payload ?? parsed);
          } catch {
            resolve({ ok: false, error: 'bad bridge response' });
          }
        },
        onFailure: (code, message) =>
          reject(new Error(`bridge ${code}: ${message}`)),
      });
    });
  }

  /** Install a named catalog app on THIS device via pkexec. */
  install(name: string): Promise<InstallResult> {
    return this.call('store.install', { name });
  }

  /** Read-only: is this app's native launcher installed on THIS
   *  device, and at what version (dpkg, unprivileged)? unin-4:
   *  `deployed` = its mesh-app compose project runs here. */
  status(name: string):
      Promise<{ ok: boolean; installed?: boolean;
                version?: string; deployed?: boolean;
                error?: string }> {
    return this.call('store.status', { name });
  }

  /** unin-4: uninstall THIS device's copy via pkexec — one thin
   *  invocation of `isle store uninstall <name> [--purge]`; the
   *  engine verb owns the data policy (purge = backup then erase). */
  uninstall(name: string, purge: boolean): Promise<InstallResult> {
    return this.call('store.uninstall', { name, purge });
  }

  /** unin-4: "remove isle-mesh from this device" — the shell opens
   *  a terminal running `pkexec isle uninstall --everything` (the
   *  verb is interactive: its confirmations happen there). */
  removeIsle():
      Promise<{ ok: boolean; terminal?: string; error?: string }> {
    return this.call('store.removeIsle', {});
  }

  // ------------------------------------------------- ci-11a: the pipeline
  // His ask 2026-09-19: run the build pipeline as a desktop application,
  // "guiding people through use like a normal app", with no terminal.
  //
  // THE LAYER BOUNDARY (his rule, same day — "keep different pieces
  // logically separate, like CLI vs JavaFX"). Nothing here composes a
  // command. A caller names a VERB id from the tracked allowlist
  // `polari-jenkins/shell-verbs.json` and its parameters; the shell owns
  // the argv and the elevation. That is why there is no `run(command)`
  // and never will be.

  /** Can this page drive the pipeline on THIS machine? False in a plain
   *  browser, and then every caller shows the command instead of a button. */
  pipelineAvailable(): Promise<PipelineAvailability> {
    return this.call('pipeline.available', {});
  }

  /** Run one UNPRIVILEGED verb (doctor, preflight, setup-step, setup-run,
   *  setup-answer, up). No elevation prompt: these read, or write files the
   *  logged-in user already owns. */
  pipelineRun(verb: string, params: Record<string, string> = {}):
      Promise<PipelineResult> {
    return this.call('pipeline.run', { verb, params });
  }

  /** Run one PRIVILEGED verb through the system's own elevation prompt.
   *  When the allowlist marks the verb `stdin: "secret"` the SHELL collects
   *  the value in its own native password field and writes it to the
   *  command's standard input — it is never a parameter here, never in a
   *  URL, and never in the page. */
  pipelinePrivileged(verb: string, params: Record<string, string> = {}):
      Promise<PipelineResult> {
    return this.call('pipeline.privileged', { verb, params });
  }
}
