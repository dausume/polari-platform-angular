import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ScaleDefinitionRow } from '@models/materials-science/materials-basis-types';

/**
 * One cell of the materials-basis grid: a material's definition at one
 * scale level — a status chip with the lineage as its tooltip, or an
 * honest em-dash when the level is undefined (absence is data).
 */
@Component({
  standalone: true,
  selector: 'scale-level-cell',
  imports: [CommonModule, MatTooltipModule],
  template: `
    <span *ngIf="row; else emptyCell"
          class="chip"
          [class.defined]="row!.status === 'defined'"
          [class.partial]="row!.status === 'partial'"
          [class.planned]="row!.status === 'planned'"
          [matTooltip]="lineageTooltip">
      {{ row!.status }}
    </span>
    <ng-template #emptyCell>
      <span class="chip empty"
            matTooltip="No definition at this level yet — piecemeal
            definitions are first-class; absence is data, not an error.">
        —
      </span>
    </ng-template>
  `,
  styles: [`
    .chip {
      display: inline-block; padding: 1px 8px; border-radius: 10px;
      font-size: 11px; font-weight: 600; cursor: default;
      background: var(--surface-secondary); color: var(--text-tertiary);
    }
    .chip.defined { background: var(--color-success-bg); color: var(--color-success-text); }
    .chip.partial { background: var(--color-warn-bg); color: var(--color-warn-text); }
    .chip.planned { background: var(--color-info-bg); color: var(--color-info-text); }
    .chip.empty { background: transparent; color: var(--text-disabled); }
  `],
})
export class ScaleLevelCellComponent {
  @Input() row: ScaleDefinitionRow | null = null;

  get lineageTooltip(): string {
    if (!this.row) return '';
    const parts = [`${this.row.name} (${this.row.definition_class})`];
    if (this.row.derived_from_name) {
      parts.push(`derived from ${this.row.derived_from_name}`
        + (this.row.derivation_method
          ? ` via ${this.row.derivation_method}` : ''));
    }
    if (this.row.notes) parts.push(this.row.notes);
    return parts.join(' — ');
  }
}
