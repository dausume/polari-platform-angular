/**
 * @module services/xr/xr-variant.service
 *
 * XrInterfaceVariant persistence (xr-2). Three-free CRUDE client for
 * the per-mode interface-configuration rows: entry scale, navigation
 * knobs, and viewpoint bookmarks all live inside config_json, keyed by
 * (subject_kind, subject_name, mode) under the backend's canonical
 * variant name. Speaks the REAL CRUDE protocol (2026-07-11 audit):
 * every route is /{ClassName}; POST = multipart initParamSets,
 * PUT = multipart polariId + updateData. Rows are DATA — settings
 * flips never touch them; this service only ever merges keys.
 */

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { RuntimeConfigService } from '@services/runtime-config.service';
import { XrInterfaceVariantRow, XrVariantConfig } from '@models/xr/xr-types';

const CLASS_NAME = 'XrInterfaceVariant';

/** Canonical row identity — mirrors backend xr_settings.variant_name. */
export function variantName(
  kind: string, subject: string, mode: string): string {
  return `xr-variant:${kind}:${subject}:${mode}`;
}

@Injectable({ providedIn: 'root' })
export class XrVariantService {
  constructor(
    private http: HttpClient,
    private runtimeConfig: RuntimeConfigService,
  ) {}

  private classUrl(): string {
    return `${this.runtimeConfig.getBackendBaseUrl()}/${CLASS_NAME}`;
  }

  /** Fetch the variant row for one subject+mode, or null if none
   *  exists yet. (No per-id GET route exists — fetch the table and
   *  resolve client-side, the CRUDEclassService idiom.) */
  async get(
    kind: XrInterfaceVariantRow['subject_kind'],
    subject: string,
    mode: XrInterfaceVariantRow['mode'],
  ): Promise<XrInterfaceVariantRow | null> {
    const envelope: any =
      await firstValueFrom(this.http.get(this.classUrl()));
    const rows: any[] = envelope?.[0]?.[CLASS_NAME]?.[0]?.data ?? [];
    const wanted = variantName(kind, subject, mode);
    return rows.find((r: any) => r?.name === wanted) ?? null;
  }

  /** Parsed config for one subject+mode ({} when no row exists). */
  async getConfig(
    kind: XrInterfaceVariantRow['subject_kind'],
    subject: string,
    mode: XrInterfaceVariantRow['mode'],
  ): Promise<XrVariantConfig> {
    const row = await this.get(kind, subject, mode);
    if (!row?.config_json) return {};
    try {
      return JSON.parse(row.config_json) ?? {};
    } catch {
      return {};
    }
  }

  /** MERGE keys into the variant's config_json, creating the row on
   *  first write. Unknown keys (other phases' configuration) are
   *  preserved verbatim — this service never replaces the blob
   *  wholesale. Returns the merged config. */
  async mergeConfig(
    kind: XrInterfaceVariantRow['subject_kind'],
    subject: string,
    mode: XrInterfaceVariantRow['mode'],
    patch: Partial<XrVariantConfig>,
  ): Promise<XrVariantConfig> {
    const row = await this.get(kind, subject, mode);
    let existing: XrVariantConfig = {};
    if (row?.config_json) {
      try { existing = JSON.parse(row.config_json) ?? {}; } catch { /* keep {} */ }
    }
    const merged: XrVariantConfig = { ...existing, ...patch };
    const configJson = JSON.stringify(merged);

    if (row?.id) {
      const formData = new FormData();
      formData.append('polariId', row.id);
      formData.append('updateData',
        JSON.stringify({ config_json: configJson }));
      await firstValueFrom(this.http.put(this.classUrl(), formData));
    } else {
      const formData = new FormData();
      formData.append('initParamSets', JSON.stringify([{
        name: variantName(kind, subject, mode),
        subject_kind: kind,
        subject_name: subject,
        mode,
        config_json: configJson,
        notes: '',
      }]));
      await firstValueFrom(this.http.post(this.classUrl(), formData));
    }
    return merged;
  }
}
