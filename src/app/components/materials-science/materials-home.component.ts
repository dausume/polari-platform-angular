import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { MaterialsBasisService } from '@services/materials-science/materials-basis.service';
import { PresenceMatrix } from '@models/materials-science/materials-basis-types';

/**
 * The Materials home page (/display/materials): the accountability
 * overview — one card per scale level (what the level means + how many
 * materials are defined / partial / missing there, linking to the
 * level page) above the full materials x levels matrix, each cell
 * click-through to its level page. Tools (basis browser, formulation
 * search, FEM/DFT models, periodic table) link from the footer.
 *
 * Absence is data: a missing cell renders as loudly as a defined one.
 */
@Component({
  standalone: true,
  selector: 'materials-home',
  imports: [CommonModule, RouterModule, MatIconModule, MatTooltipModule],
  templateUrl: './materials-home.component.html',
  styleUrls: ['./materials-home.component.scss'],
})
export class MaterialsHomeComponent implements OnInit {
  matrix: PresenceMatrix | null = null;
  loading = true;
  loadError = '';
  filterText = '';

  readonly tools = [
    { label: 'Materials Basis Browser', route: '/display/materials-basis',
      hint: 'per-row detail: lineage, results, thermal windows' },
    { label: 'Formulation Search', route: '/display/formulation-search',
      hint: 'derive new formulations against targets' },
    { label: 'FEM Models', route: '/display/fem-models',
      hint: 'configure and solve continuum models' },
    { label: 'DFT Models', route: '/display/dft-models',
      hint: 'configure and compute quantum models' },
    { label: 'MD Models', route: '/display/md-models',
      hint: 'configure and run atomistic (L3) melts' },
    { label: 'Meso Models', route: '/display/meso-models',
      hint: 'configure and run mesoscale (L2) studies' },
    { label: 'Periodic Table', route: '/display/periodic-table',
      hint: 'element reference data' },
  ];

  constructor(private basis: MaterialsBasisService) {}

  async ngOnInit(): Promise<void> {
    this.matrix = await this.basis.presenceMatrix();
    this.loading = false;
    if (!this.matrix) {
      this.loadError = 'The scale-presence endpoint did not answer — '
        + 'is the backend up? (GET /api/msci/scale-presence)';
    }
  }

  get visibleMaterials() {
    if (!this.matrix) return [];
    const needle = this.filterText.trim().toLowerCase();
    if (!needle) return this.matrix.materials;
    return this.matrix.materials.filter(m =>
      m.name.includes(needle)
      || m.displayName.toLowerCase().includes(needle)
      || m.category.includes(needle)
      || m.tags.some(t => t.includes(needle)));
  }

  onFilter(event: Event): void {
    this.filterText = (event.target as HTMLInputElement).value;
  }

  cellStatus(material: PresenceMatrix['materials'][number],
             level: number): string {
    return material.presence[String(level)]?.status ?? 'missing';
  }

  cellTooltip(material: PresenceMatrix['materials'][number],
              level: number): string {
    const cell = material.presence[String(level)];
    if (!cell || cell.status === 'missing') {
      const planned = (cell?.rows ?? [])
        .filter(r => r.status === 'planned');
      return planned.length
        ? `Planned, not yet earned: ${planned[0].notes}`
        : `${material.displayName} has no level-${level} definition — `
          + 'the level page says what earning it takes.';
    }
    return cell.rows.map(r => `${r.name} (${r.status}`
      + (r.hasResult ? ', has result)' : ')')).join('; ');
  }
}
