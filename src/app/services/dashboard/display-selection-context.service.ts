import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * The runtime selection → display-context channel: selector components
 * PUBLISH values under a context key ('selectedMaterialKey', …); sibling
 * components consume them either reactively (select$) or via the
 * dashboard renderer's `contextSubscriptions` input merge — the piece
 * the config-driven Display system was missing (components used to get
 * only the static context captured at render time).
 *
 * Keys are a flat global namespace by design: a Display and the
 * components inside it agree on key names in CONFIG (an explicit knob),
 * not via injection scopes.
 */
@Injectable({ providedIn: 'root' })
export class DisplaySelectionContextService {

  private channels = new Map<string, BehaviorSubject<unknown>>();

  publish(contextKey: string, value: unknown): void {
    this.channel(contextKey).next(value);
  }

  select$(contextKey: string): Observable<unknown> {
    return this.channel(contextKey).asObservable();
  }

  current(contextKey: string): unknown {
    return this.channel(contextKey).value;
  }

  private channel(contextKey: string): BehaviorSubject<unknown> {
    let subject = this.channels.get(contextKey);
    if (!subject) {
      subject = new BehaviorSubject<unknown>(null);
      this.channels.set(contextKey, subject);
    }
    return subject;
  }
}
