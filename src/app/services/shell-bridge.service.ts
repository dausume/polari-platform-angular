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
}
