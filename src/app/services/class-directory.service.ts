// class-directory.service.ts
//
// modsplit-2: the frontend coordinates data from ALL backends, not
// just core — core only TRACKS and TELLS us which classes to get
// from where (GET /api/refs/directory on the core backend: className
// -> { module, instance, baseUrl }). An empty baseUrl means "the
// core backend that served this directory".
//
// Honest fallback: if the directory is unreachable or a class is
// unknown, everything routes to core exactly as before modsplit —
// the directory only ever REDIRECTS, it never blocks.
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import { RuntimeConfigService } from './runtime-config.service';

export interface ClassDirectoryEntry {
  module: string;
  instance: string;
  baseUrl: string;
}

@Injectable({ providedIn: 'root' })
export class ClassDirectoryService {
  // className -> entry; empty map = route everything to core.
  directory$ = new BehaviorSubject<Record<string, ClassDirectoryEntry>>({});
  // module -> { instance, baseUrl } (the coordination overview).
  modules$ = new BehaviorSubject<Record<string, { instance: string; baseUrl: string }>>({});
  loaded$ = new BehaviorSubject<boolean>(false);

  constructor(
    private http: HttpClient,
    private runtimeConfig: RuntimeConfigService
  ) {
    // Fetch once the runtime config has settled its backend URL.
    this.runtimeConfig.isConfigLoaded$.subscribe((ready: boolean) => {
      if (ready) {
        this.refresh();
      }
    });
  }

  refresh(): void {
    const core = this.runtimeConfig.getBackendBaseUrl();
    this.http.get<any>(`${core}/api/refs/directory`).subscribe({
      next: (reply) => {
        if (reply && reply.ok && reply.classes) {
          this.directory$.next(reply.classes);
          this.modules$.next(reply.modules || {});
        }
        this.loaded$.next(true);
      },
      error: () => {
        // Core-only routing stays fully functional without a
        // directory — log-worthy but never blocking.
        console.warn('[ClassDirectory] directory unavailable — all '
          + 'classes route to core');
        this.loaded$.next(true);
      },
    });
  }

  // The backend base URL serving this class; '' = core.
  baseUrlForClass(className: string): string {
    const entry = this.directory$.value[className];
    return entry && entry.baseUrl ? entry.baseUrl : '';
  }
}
