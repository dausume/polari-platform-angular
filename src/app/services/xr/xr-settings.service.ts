/**
 * @module services/xr/xr-settings.service
 *
 * The cascade client (xr-1): asks the backend resolver what XR
 * presentation a space gets (mode/framing + provenance + raw rungs),
 * and writes the individual-level knobs (a SimSpaceDefinition's
 * xr_mode / xr_framing) through the generated CRUDE endpoint.
 * Three-free; resolution logic stays server-side (single source of
 * truth — this service never re-implements the ladder).
 */

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject, firstValueFrom } from 'rxjs';

import { RuntimeConfigService } from '@services/runtime-config.service';
import { CRUDEservicesManager } from '@services/crude-services-manager';
import {
  XrFramingValue, XrModeValue, XrResolution,
} from '@models/xr/xr-types';

@Injectable({ providedIn: 'root' })
export class XrSettingsService {
  /** Emits the space name after any XR knob write — consumers holding
   *  a resolution for that space re-resolve (keeps the sidebar knob
   *  and the Enter-XR button honest together). */
  readonly changed$ = new Subject<string>();

  constructor(
    private http: HttpClient,
    private runtimeConfig: RuntimeConfigService,
    private crudeManager: CRUDEservicesManager,
  ) {}

  /** Resolve one space's XR presentation, optionally through a
   *  multiscale context (the msim page's definition name). */
  async resolve(spaceName: string, multiscaleName?: string):
      Promise<XrResolution> {
    const params = new URLSearchParams({ space: spaceName });
    if (multiscaleName) params.set('multiscale', multiscaleName);
    const url = `${this.runtimeConfig.getBackendBaseUrl()}`
      + `/api/xr/resolve?${params.toString()}`;
    const resp = await firstValueFrom(this.http.get<{
      ok: boolean; resolution: XrResolution; error?: string;
    }>(url));
    if (!resp?.ok) {
      throw new Error(resp?.error || 'XR resolve failed');
    }
    return resp.resolution;
  }

  /** Set the INDIVIDUAL rung on one SimSpaceDefinition (the sidebar
   *  knob). 'unset' hands control back up the ladder. Callers
   *  re-resolve() afterward — the server stays the source of truth. */
  async setSpaceXr(definitionId: string, patch: {
    xr_mode?: XrModeValue; xr_framing?: XrFramingValue;
  }): Promise<void> {
    const service =
      this.crudeManager.getCRUDEclassService('SimSpaceDefinition');
    await firstValueFrom(service.update(definitionId, patch));
  }

  /** Announce a completed knob write so open resolutions refresh. */
  announceChanged(spaceName: string): void {
    this.changed$.next(spaceName);
  }
}
