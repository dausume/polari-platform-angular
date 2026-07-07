import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  EngineCapability,
  MaterialsBasisService,
  ScaleDefinitionRow,
  ThermalProfileRow,
} from '@services/materials-science/materials-basis.service';
import { ScaleLevelCellComponent } from './scale-level-cell.component';
import { ThermalWindowStripComponent } from './thermal-window-strip.component';

const SCALE_LEVELS: { level: number; label: string }[] = [
  { level: 0, label: 'Experimental' },
  { level: 1, label: 'Continuum' },
  { level: 2, label: 'Mesoscale' },
  { level: 3, label: 'Atomistic' },
  { level: 4, label: 'Quantum' },
];

/**
 * The materials-basis browser page: every material × scale level 0–4
 * as a grid of status chips (lineage tooltips), a thermal-window strip
 * per material, an expander showing the level rows' stored results,
 * and an engine-capability banner that is HONEST about what can
 * actually execute right now (local libs / msci-engines worker /
 * refusals).
 */
@Component({
  standalone: true,
  selector: 'materials-basis-browser',
  imports: [CommonModule, MatIconModule, MatTooltipModule,
            ScaleLevelCellComponent, ThermalWindowStripComponent],
  templateUrl: './materials-basis-browser.component.html',
  styleUrls: ['./materials-basis-browser.component.scss'],
})
export class MaterialsBasisBrowserComponent implements OnInit {

  readonly levels = SCALE_LEVELS;

  loading = true;
  errorMessage = '';
  capability: EngineCapability | null = null;
  materials: string[] = [];
  private rowsByMaterial = new Map<string, Map<number, ScaleDefinitionRow>>();
  private thermalByMaterial = new Map<string, ThermalProfileRow>();
  expanded = new Set<string>();

  constructor(private basisService: MaterialsBasisService) {}

  async ngOnInit(): Promise<void> {
    try {
      const [defs, profiles, capability] = await Promise.all([
        this.basisService.scaleDefinitions(),
        this.basisService.thermalProfiles(),
        this.basisService.engineCapability(),
      ]);
      this.capability = capability;
      for (const row of defs) {
        const mat = row.material_name || '?';
        if (!this.rowsByMaterial.has(mat)) {
          this.rowsByMaterial.set(mat, new Map());
        }
        this.rowsByMaterial.get(mat)!.set(Number(row.scale_level), row);
      }
      for (const p of profiles) {
        this.thermalByMaterial.set(p.material_name, p);
      }
      this.materials = Array.from(this.rowsByMaterial.keys()).sort();
    } catch (err: any) {
      this.errorMessage = err?.message || String(err);
    } finally {
      this.loading = false;
    }
  }

  cell(material: string, level: number): ScaleDefinitionRow | null {
    return this.rowsByMaterial.get(material)?.get(level) ?? null;
  }

  thermal(material: string): ThermalProfileRow | null {
    return this.thermalByMaterial.get(material) ?? null;
  }

  toggle(material: string): void {
    if (this.expanded.has(material)) this.expanded.delete(material);
    else this.expanded.add(material);
  }

  definedRows(material: string): ScaleDefinitionRow[] {
    const byLevel = this.rowsByMaterial.get(material);
    return byLevel ? Array.from(byLevel.values())
      .sort((a, b) => a.scale_level - b.scale_level) : [];
  }

  resultText(row: ScaleDefinitionRow): string {
    try {
      const params = JSON.parse(row.parameters_json || '{}');
      if (params.result !== undefined) {
        return JSON.stringify(params.result);
      }
      return row.status === 'partial'
        ? 'not executed yet (partial until run)' : '';
    } catch {
      return '';
    }
  }

  get capabilitySummary(): { ok: boolean; text: string } {
    if (!this.capability) {
      return { ok: false,
               text: 'Engine capability unavailable — the backend did '
                     + 'not answer /api/msci/engines/capability.' };
    }
    const fem = this.capability.fem as any;
    const dft = this.capability.dft as any;
    const bits: string[] = [];
    bits.push(`FEM: ${fem?.available ?? fem?.local ?? 'see detail'}`);
    bits.push(`DFT: ${dft?.available ?? dft?.local ?? 'see detail'}`);
    if (dft?.worker?.reachable === false || fem?.worker?.reachable === false) {
      bits.push('msci-engines worker unreachable — heavier engines '
        + 'refuse honestly until it is up');
    }
    return { ok: true, text: bits.join(' · ') };
  }
}
