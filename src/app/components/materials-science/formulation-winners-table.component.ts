import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  FormulationCandidate,
  FormulationRun,
  FormulationSearchService,
} from '@services/materials-science/formulation-search.service';

/**
 * The persisted candidates of one formulation run: components,
 * predicted properties, score, violations, thermal verdict, fidelity
 * badges (screened / FEM-verified / FEM-refused-with-reason /
 * DFT-suggested), the honestly-displayed UNPREDICTED properties, and
 * the explicit per-candidate "Promote to L1" knob (never automatic).
 */
@Component({
  standalone: true,
  selector: 'formulation-winners-table',
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './formulation-winners-table.component.html',
  styleUrls: ['./formulation-winners-table.component.scss'],
})
export class FormulationWinnersTableComponent {
  @Input({ required: true }) run!: FormulationRun;
  @Output() promoted = new EventEmitter<void>();

  promoting = new Set<string>();
  promoteError = '';

  constructor(private searchService: FormulationSearchService) {}

  componentText(cand: FormulationCandidate): string {
    return (cand.components || [])
      .map(c => `${this.additiveLabel(c.materialId)} ${c.weightPercent}%`)
      .join(' + ') || '(pure base)';
  }

  additiveLabel(materialId: string): string {
    return (materialId || '').replace(/^additive-/, '').replace(/-/g, ' ');
  }

  predictedEntries(cand: FormulationCandidate): [string, number][] {
    return Object.entries(cand.predicted || {}) as [string, number][];
  }

  violationText(cand: FormulationCandidate): string {
    return (cand.violations || [])
      .map(v => typeof v === 'object'
        ? (v.detail || v.type || JSON.stringify(v)) : String(v))
      .join('; ');
  }

  femBadge(cand: FormulationCandidate): { text: string; cls: string;
                                          tip: string } {
    const fem = cand.fidelity?.femVerify;
    if (!fem || fem.status === 'skipped') {
      return { text: 'FEM: skipped', cls: 'skip',
               tip: 'Outside the verification shortlist.' };
    }
    if (fem.status === 'verified') {
      return { text: 'FEM verified', cls: 'ok',
               tip: 'Every component homogenized inside its '
                    + 'Voigt/Reuss bounds (wt% treated as vol%).' };
    }
    if (fem.status === 'partial') {
      return { text: 'FEM partial', cls: 'warn',
               tip: 'Some components verified; others refused — open '
                    + 'the run detail for per-component reasons.' };
    }
    return { text: 'FEM refused', cls: 'bad',
             tip: fem.reason || 'The engine refused honestly (missing '
                  + 'inputs or engine ladder down).' };
  }

  dftBadge(cand: FormulationCandidate): string {
    return cand.fidelity?.dftEvidence?.status === 'suggested'
      ? 'DFT suggested' : '';
  }

  async promote(cand: FormulationCandidate): Promise<void> {
    this.promoteError = '';
    this.promoting.add(cand.name);
    try {
      const res = await this.searchService.promote(this.run.name, cand.name);
      if (res?.ok) {
        cand.promotedScaleDef = res.scaleDefinition;
        this.promoted.emit();
      } else {
        this.promoteError = res?.error || 'promotion refused';
      }
    } catch (err: any) {
      this.promoteError = err?.error?.error || err?.message || String(err);
    } finally {
      this.promoting.delete(cand.name);
    }
  }
}
