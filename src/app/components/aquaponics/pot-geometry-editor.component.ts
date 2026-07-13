/**
 * @cross-cutting
 * @tags @xc:bindings
 * @consumers
 *   - Display registry (aquaponics-display-components.ts)
 * @see /AQUAPONICS_POT_SHAPE_PLAN.md (phase 2)
 *
 * aquaponics-pot-shape phase 2 — the editing Display for a self-
 * watering pot's geometry. Edits go through standard CRUDE PUT on the
 * durable `PotDefinition`/`PotHole` rows (the source of truth) —
 * matches this codebase's documented edit contract: CRUDE PUT, THEN
 * re-POST `/api/shapes/from-pot/{name}` to re-derive the rendered
 * geometry. `modify_pot_hole`/`modify_parameter` (the mathshapes
 * preview-only path) are deliberately NOT used here.
 *
 * Every edit calls `/validate` before AND after saving so the
 * gravity-self-watering consequence is always visible
 * (knobs-and-suggestions: never silently apply beyond the requested
 * change).
 */

import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

import { CRUDEservicesManager } from '@services/crude-services-manager';
import { RuntimeConfigService } from '@services/runtime-config.service';
import { MathShapeGeometryLibraryService } from '@services/sim-space-3d/math-shape-geometry-library.service';

interface PotFinding {
  kind: string;
  hole: string | null;
  evidence: string;
  suggestion: { knob: string; action: string };
}

interface ValidateResponse {
  ok: boolean;
  valid?: boolean;
  findings?: PotFinding[];
  maintainedWaterLevelMm?: number | null;
  sideSeparationDeg?: number | null;
  error?: string;
}

const POT_FIELDS: Array<{ key: string; label: string; unit: string }> = [
  { key: 'outer_top_diameter_mm', label: 'Outer top diameter', unit: 'mm' },
  { key: 'outer_base_diameter_mm', label: 'Outer base diameter', unit: 'mm' },
  { key: 'height_mm', label: 'Height', unit: 'mm' },
  { key: 'wall_thickness_mm', label: 'Wall thickness', unit: 'mm' },
  { key: 'base_thickness_mm', label: 'Base thickness', unit: 'mm' },
  { key: 'soil_fill_height_mm', label: 'Soil fill height', unit: 'mm' },
];

// Phase 5 — per-layer transparency toggles (booleans, not part of the
// numeric field grid above).
const POT_BOOL_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'wall_transparent', label: 'Wall + base see-through' },
  { key: 'soil_transparent', label: 'Soil see-through' },
];

const HOLE_FIELDS: Array<{ key: string; label: string; unit: string }> = [
  { key: 'diameter_mm', label: 'Diameter', unit: 'mm' },
  { key: 'height_mm', label: 'Elevation', unit: 'mm' },
  { key: 'azimuth_deg', label: 'Azimuth', unit: '°' },
  { key: 'angle_deg', label: 'Bore angle', unit: '°' },
];

@Component({
  standalone: true,
  selector: 'pot-geometry-editor',
  imports: [
    CommonModule, FormsModule, MatIconModule, MatButtonModule,
    MatProgressSpinnerModule, MatTooltipModule,
  ],
  template: `
    <div class="editor">
      <div class="header">
        <mat-icon>water_drop</mat-icon>
        <h3>{{ potName || '(no pot selected)' }}</h3>
        <button mat-icon-button matTooltip="Reload" (click)="reload()"
                [disabled]="loading">
          <mat-icon>refresh</mat-icon>
        </button>
      </div>

      <div class="loading" *ngIf="loading">
        <mat-progress-spinner diameter="16" mode="indeterminate"></mat-progress-spinner>
        <span class="muted small">Loading pot geometry…</span>
      </div>

      <div class="error-banner" *ngIf="error">
        <mat-icon>error_outline</mat-icon>
        <span>{{ error }}</span>
      </div>

      <ng-container *ngIf="!loading && pot">
        <section class="validation-banner"
                 [class.valid]="validation?.valid"
                 [class.invalid]="validation && !validation.valid">
          <mat-icon>{{ validation?.valid ? 'check_circle' : 'warning' }}</mat-icon>
          <div class="validation-body">
            <strong>{{ validation?.valid ? 'Gravity self-watering: valid'
                        : 'Gravity self-watering: ' + (validation?.findings?.length || 0)
                          + ' issue(s)' }}</strong>
            <div class="validation-meta muted small" *ngIf="validation?.valid">
              maintained water level: {{ validation?.maintainedWaterLevelMm }}mm,
              side separation: {{ validation?.sideSeparationDeg }}°
            </div>
            <ul class="findings" *ngIf="validation?.findings?.length">
              <li *ngFor="let f of validation?.findings">
                <code>{{ f.kind }}</code>{{ f.hole ? ' (' + f.hole + ')' : '' }}
                — {{ f.evidence }}
                <span class="suggestion muted small" *ngIf="f.suggestion">
                  → {{ f.suggestion.knob }}: {{ f.suggestion.action }}
                </span>
              </li>
            </ul>
          </div>
        </section>

        <section class="pot-fields">
          <h4>Pot geometry</h4>
          <div class="field-grid">
            <label class="field-row" *ngFor="let f of potFieldDefs">
              <span class="field-label">{{ f.label }}</span>
              <input class="field-input" type="text" inputmode="decimal"
                     [value]="potFieldValue(f.key)"
                     [class.changed]="potFieldChanged(f.key)"
                     (input)="onPotFieldEdit(f.key, $any($event.target).value)" />
              <span class="unit muted small">{{ f.unit }}</span>
            </label>
          </div>
          <div class="bool-grid">
            <label class="bool-row" *ngFor="let f of potBoolFieldDefs">
              <input type="checkbox"
                     [checked]="boolFieldValue(f.key)"
                     (change)="onBoolFieldToggle(f.key, $any($event.target).checked)" />
              <span>{{ f.label }}</span>
            </label>
          </div>
          <button mat-flat-button color="primary"
                  [disabled]="!hasPotEdits() || saving"
                  (click)="savePot()">
            <mat-progress-spinner *ngIf="saving" diameter="14" mode="indeterminate"></mat-progress-spinner>
            <span *ngIf="!saving">Save pot geometry</span>
          </button>
        </section>

        <section class="holes-section">
          <h4>Drainage holes ({{ holes.length }})</h4>
          <div class="hole-card" *ngFor="let hole of holes">
            <div class="hole-header">
              <span class="hole-kind" [class.input-kind]="hole.kind === 'input'"
                    [class.output-kind]="hole.kind === 'output'">
                {{ hole.kind }}
              </span>
              <code class="hole-name mono small">{{ hole.name }}</code>
            </div>
            <div class="field-grid">
              <label class="field-row" *ngFor="let f of holeFieldDefs">
                <span class="field-label">{{ f.label }}</span>
                <input class="field-input" type="text" inputmode="decimal"
                       [value]="holeFieldValue(hole, f.key)"
                       [class.changed]="holeFieldChanged(hole, f.key)"
                       (input)="onHoleFieldEdit(hole, f.key, $any($event.target).value)" />
                <span class="unit muted small">{{ f.unit }}</span>
              </label>
            </div>
            <button mat-stroked-button
                    [disabled]="!hasHoleEdits(hole) || saving"
                    (click)="saveHole(hole)">
              Save this hole
            </button>
          </div>
          <p class="muted small" *ngIf="!holes.length">No holes on this pot yet.</p>
        </section>

        <section class="rederive-status" *ngIf="lastRederive">
          <mat-icon>{{ lastRederive.ok ? 'check_circle' : 'error_outline' }}</mat-icon>
          <span *ngIf="lastRederive.ok">
            Geometry re-derived — scene <code>{{ lastRederive.simSpace }}</code> refreshed.
          </span>
          <span *ngIf="!lastRederive.ok">
            Re-derive failed: {{ lastRederive.error }}
          </span>
        </section>
        <button mat-button [disabled]="rederiving" (click)="rederive()">
          <mat-progress-spinner *ngIf="rederiving" diameter="14" mode="indeterminate"></mat-progress-spinner>
          <span *ngIf="!rederiving">Re-render now</span>
        </button>
      </ng-container>
    </div>
  `,
  styles: [`
    .editor { display: flex; flex-direction: column; gap: 14px; max-width: 560px; }
    .header { display: flex; align-items: center; gap: 8px; }
    .header h3 { margin: 0; flex: 1 1 auto; font-size: 15px; }
    .loading { display: flex; align-items: center; gap: 8px; }
    .error-banner, .rederive-status {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 10px; border-radius: 6px; font-size: 12px;
    }
    .error-banner { background: #fdecea; color: #b71c1c; border: 1px solid #f4b4b0; }
    .rederive-status { background: #eef5ff; color: #0d47a1; border: 1px solid #b9d6f6; }
    .validation-banner {
      display: flex; gap: 8px; padding: 10px; border-radius: 6px;
      border: 1px solid transparent; font-size: 12px;
    }
    .validation-banner.valid { background: #e6f4ea; color: #1e7e34; border-color: #b6e0c0; }
    .validation-banner.invalid { background: #fff8e1; color: #8d6e00; border-color: #ffe082; }
    .validation-body { display: flex; flex-direction: column; gap: 4px; flex: 1 1 auto; }
    .validation-meta { margin: 0; }
    .findings { margin: 4px 0 0; padding-left: 18px; }
    .findings li { margin-bottom: 4px; }
    .suggestion { display: block; }
    h4 { margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: #555; }
    .field-grid { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
    .bool-grid { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
    .bool-row { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #333; }
    .field-row { display: grid; grid-template-columns: 1fr minmax(90px, 120px) auto; align-items: center; gap: 8px; }
    .field-label { font-size: 12px; color: #333; }
    .field-input {
      padding: 4px 6px; border: 1px solid var(--border-light, #e0e3e9);
      border-radius: 3px; background: white; font-size: 12px; font-family: monospace;
      box-sizing: border-box;
    }
    .field-input.changed { border-color: #1976d2; background: #f0f7ff; }
    .field-input:focus { outline: none; border-color: #1976d2; }
    .unit { text-align: left; }
    .hole-card {
      border: 1px solid var(--border-light, #e0e3e9); border-radius: 6px;
      padding: 10px; margin-bottom: 10px; background: var(--surface-secondary, #fafbfc);
    }
    .hole-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .hole-kind {
      font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600;
      padding: 2px 8px; border-radius: 999px; background: #eee; color: #555;
    }
    .hole-kind.input-kind { background: #e3f2fd; color: #0d47a1; }
    .hole-kind.output-kind { background: #fdecea; color: #b71c1c; }
    .hole-name { color: #666; }
    .muted { color: var(--text-secondary, #888); }
    .small { font-size: 10px; }
    .mono { font-family: monospace; }
    code { background: rgba(0,0,0,0.04); padding: 0 3px; border-radius: 2px; }
  `],
})
export class PotGeometryEditorComponent implements OnChanges {
  @Input() potName: string = '';

  loading = false;
  saving = false;
  rederiving = false;
  error: string | null = null;

  pot: any = null;
  holes: any[] = [];
  validation: ValidateResponse | null = null;
  lastRederive: { ok: boolean; simSpace?: string; error?: string } | null = null;

  private potEdits: Record<string, string> = {};
  private boolEdits: Record<string, boolean> = {};
  private holeEdits: Record<string, Record<string, string>> = {};

  readonly potFieldDefs = POT_FIELDS;
  readonly potBoolFieldDefs = POT_BOOL_FIELDS;
  readonly holeFieldDefs = HOLE_FIELDS;

  constructor(
    private crudeManager: CRUDEservicesManager,
    private runtimeConfig: RuntimeConfigService,
    private http: HttpClient,
    private mathShapeGeometryLib: MathShapeGeometryLibraryService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['potName'] && this.potName) {
      this.reload();
    }
  }

  async reload(): Promise<void> {
    if (!this.potName) return;
    this.loading = true;
    this.error = null;
    try {
      const [potRow, holeRows] = await Promise.all([
        this.fetchPot(), this.fetchHoles(),
      ]);
      if (!potRow) {
        this.error = `No PotDefinition named "${this.potName}"`;
        this.pot = null;
        this.holes = [];
        return;
      }
      this.pot = potRow;
      this.holes = holeRows;
      this.potEdits = {};
      this.boolEdits = {};
      this.holeEdits = {};
      await this.refreshValidation();
    } catch (err: any) {
      this.error = err?.message || String(err);
    } finally {
      this.loading = false;
    }
  }

  private async fetchPot(): Promise<any> {
    const svc = this.crudeManager.getCRUDEclassService('PotDefinition');
    const envelope = await firstValueFrom(svc.readAll());
    const rows = envelope?.[0]?.['PotDefinition']?.[0]?.data ?? [];
    return rows.find((r: any) => r.name === this.potName) ?? null;
  }

  private async fetchHoles(): Promise<any[]> {
    const svc = this.crudeManager.getCRUDEclassService('PotHole');
    const envelope = await firstValueFrom(svc.readAll());
    const rows = envelope?.[0]?.['PotHole']?.[0]?.data ?? [];
    return rows
      .filter((r: any) => r.pot_name === this.potName)
      .sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)));
  }

  private async refreshValidation(): Promise<void> {
    const url = `${this.runtimeConfig.getBackendBaseUrl()}`
      + `/api/aquaponics/pots/${encodeURIComponent(this.potName)}/validate`;
    try {
      this.validation = await firstValueFrom(this.http.get<ValidateResponse>(url));
    } catch (err) {
      console.warn('[PotGeometryEditor] validate failed', err);
      this.validation = null;
    }
  }

  // ─────────────────────── pot-level fields ───────────────────────

  potFieldValue(field: string): string {
    if (this.potEdits[field] !== undefined) return this.potEdits[field];
    const v = this.pot?.[field];
    return v === undefined || v === null ? '' : String(v);
  }

  onPotFieldEdit(field: string, raw: string): void {
    this.potEdits[field] = raw;
  }

  potFieldChanged(field: string): boolean {
    const v = this.potEdits[field];
    // An EMPTIED field is not a meaningful change — Number('') is 0 in
    // JS, so without this guard a user who backspaces a value and
    // clicks Save before typing a replacement would silently write 0
    // (then get clamped server-side to the 3mm/etc floor) instead of
    // nothing happening, as they'd expect.
    if (v === undefined || v === '') return false;
    return v !== String(this.pot?.[field] ?? '');
  }

  // Phase 5 — per-layer transparency toggles.
  boolFieldValue(field: string): boolean {
    if (this.boolEdits[field] !== undefined) return this.boolEdits[field];
    return !!this.pot?.[field];
  }

  onBoolFieldToggle(field: string, checked: boolean): void {
    this.boolEdits[field] = checked;
  }

  private boolFieldChanged(field: string): boolean {
    if (this.boolEdits[field] === undefined) return false;
    return this.boolEdits[field] !== !!this.pot?.[field];
  }

  hasPotEdits(): boolean {
    return this.potFieldDefs.some(f => this.potFieldChanged(f.key))
      || this.potBoolFieldDefs.some(f => this.boolFieldChanged(f.key));
  }

  async savePot(): Promise<void> {
    if (!this.pot?.id || !this.hasPotEdits()) return;
    this.saving = true;
    this.error = null;
    try {
      const data: Record<string, number | boolean> = {};
      for (const f of this.potFieldDefs) {
        if (!this.potFieldChanged(f.key)) continue;
        const n = Number(this.potEdits[f.key]);
        if (Number.isFinite(n)) data[f.key] = n;
      }
      for (const f of this.potBoolFieldDefs) {
        if (!this.boolFieldChanged(f.key)) continue;
        data[f.key] = this.boolEdits[f.key];
      }
      if (Object.keys(data).length) {
        const svc = this.crudeManager.getCRUDEclassService('PotDefinition');
        await firstValueFrom(svc.update(this.pot.id, data));
      }
      await this.reload();
      await this.rederive();
    } catch (err: any) {
      this.error = err?.message || String(err);
    } finally {
      this.saving = false;
    }
  }

  // ─────────────────────────── hole fields ───────────────────────────

  holeFieldValue(hole: any, field: string): string {
    const edits = this.holeEdits[hole.id];
    if (edits?.[field] !== undefined) return edits[field];
    const v = hole[field];
    return v === undefined || v === null ? '' : String(v);
  }

  onHoleFieldEdit(hole: any, field: string, raw: string): void {
    if (!this.holeEdits[hole.id]) this.holeEdits[hole.id] = {};
    this.holeEdits[hole.id][field] = raw;
  }

  holeFieldChanged(hole: any, field: string): boolean {
    const edits = this.holeEdits[hole.id];
    const v = edits?.[field];
    // Same guard as potFieldChanged — an emptied field isn't a
    // meaningful change (Number('') is 0, not "unset").
    if (v === undefined || v === '') return false;
    return v !== String(hole[field] ?? '');
  }

  hasHoleEdits(hole: any): boolean {
    return this.holeFieldDefs.some(f => this.holeFieldChanged(hole, f.key));
  }

  async saveHole(hole: any): Promise<void> {
    if (!hole?.id || !this.hasHoleEdits(hole)) return;
    this.saving = true;
    this.error = null;
    try {
      const edits = this.holeEdits[hole.id] || {};
      const data: Record<string, number> = {};
      for (const f of this.holeFieldDefs) {
        if (!this.holeFieldChanged(hole, f.key)) continue;
        const n = Number(edits[f.key]);
        if (Number.isFinite(n)) data[f.key] = n;
      }
      if (Object.keys(data).length) {
        const svc = this.crudeManager.getCRUDEclassService('PotHole');
        await firstValueFrom(svc.update(hole.id, data));
      }
      await this.reload();
      await this.rederive();
    } catch (err: any) {
      this.error = err?.message || String(err);
    } finally {
      this.saving = false;
    }
  }

  // ─────────────────────────── re-derive ───────────────────────────

  async rederive(): Promise<void> {
    if (!this.potName) return;
    this.rederiving = true;
    try {
      const url = `${this.runtimeConfig.getBackendBaseUrl()}`
        + `/api/shapes/from-pot/${encodeURIComponent(this.potName)}`;
      const resp = await firstValueFrom(this.http.post<any>(url, {}));
      this.lastRederive = {
        ok: !!resp?.ok, simSpace: resp?.simSpace, error: resp?.error,
      };
      // The mesh geometry cache (math-shape-geometry-library.service.ts)
      // is a process-lifetime singleton keyed by shape NAME — a
      // re-derive reuses the SAME names (e.g. "{pot}-wall-shell-mesh"),
      // so without this the 3D viewer would keep serving the PRE-edit
      // geometry indefinitely (until a hard page reload) even though
      // the backend re-derived correctly. Invalidate every shape name
      // this response touched so the next viewer visit re-fetches.
      if (resp?.ok) {
        const names = [resp.wallShape, resp.bottomShape,
          ...(resp.holeShapes || []),
          resp.soil?.ok ? resp.soil.soilShape : null].filter(Boolean);
        for (const name of names) this.mathShapeGeometryLib.invalidate(name);
      }
    } catch (err: any) {
      this.lastRederive = { ok: false, error: err?.message || String(err) };
    } finally {
      this.rederiving = false;
    }
  }
}
