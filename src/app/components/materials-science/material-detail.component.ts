import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';

import { MaterialsBasisService } from '@services/materials-science/materials-basis.service';
import {
  DetailLevel, DetailLevelRow, MaterialDetail,
} from '@models/materials-science/materials-basis-types';

/**
 * The per-material detail view (/materials/{name}, msci-28): the
 * material's actual properties — each value with its MEANING and how
 * it moves per scenario — plus per-level detail tabs FOR THIS material
 * (what defines it at L0/L1/L4, parameters, results, lineage
 * click-through), the thermal processing scenario, and the quantified
 * blend effects it exerts as an additive. Meanings come from editable
 * MaterialPropertyMeaning rows; gaps surface as suggestions, never
 * auto-filled.
 */
@Component({
  standalone: true,
  selector: 'material-detail',
  imports: [CommonModule, RouterModule, MatTooltipModule],
  templateUrl: './material-detail.component.html',
  styleUrls: ['./material-detail.component.scss'],
})
export class MaterialDetailComponent implements OnInit, OnDestroy {
  detail: MaterialDetail | null = null;
  loading = true;
  loadError = '';
  activeLevel = 0;

  private paramSub?: Subscription;

  constructor(private route: ActivatedRoute,
              private basis: MaterialsBasisService) {}

  ngOnInit(): void {
    // Lineage links navigate to OTHER materials on this same route —
    // subscribe so the component reloads instead of going stale.
    this.paramSub = this.route.paramMap.subscribe(params => {
      const name = params.get('name') ?? '';
      void this.load(name);
    });
  }

  ngOnDestroy(): void {
    this.paramSub?.unsubscribe();
  }

  private async load(name: string): Promise<void> {
    this.loading = true;
    this.loadError = '';
    this.detail = await this.basis.materialDetail(name);
    this.loading = false;
    if (!this.detail) {
      this.loadError = 'The detail endpoint did not answer — is the '
        + `backend up? (GET /api/msci/materials/${name}/detail)`;
      return;
    }
    if (!this.detail.ok) {
      this.loadError = this.detail.error ?? 'unknown material';
      return;
    }
    const first = this.detail.levels.find(l => l.rows.length)
      ?? this.detail.levels[0];
    this.activeLevel = first ? first.level : 0;
  }

  get level(): DetailLevel | null {
    return this.detail?.levels
      .find(l => l.level === this.activeLevel) ?? null;
  }

  /** 'beeswax@L0' → 'beeswax' — lineage rows link to their material. */
  materialOf(rowName: string): string {
    return (rowName || '').split('@')[0];
  }

  paramKeys(row: DetailLevelRow): string[] {
    return Object.keys(row.parameters ?? {});
  }

  resultEntries(row: DetailLevelRow): { key: string; value: unknown }[] {
    return Object.entries(row.result ?? {})
      .filter(([, v]) => typeof v !== 'object' || v === null)
      .map(([key, value]) => ({ key, value }));
  }

  asJson(value: unknown): string {
    try { return JSON.stringify(value, null, 2); } catch { return ''; }
  }

  intentLabel(intent: string): string {
    return intent === '+' ? 'raises' : intent === '-' ? 'lowers' : intent;
  }
}
