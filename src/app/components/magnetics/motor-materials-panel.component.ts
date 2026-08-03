import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * mag-7: the MATERIAL ACCOUNTABILITY panel — every material slot of
 * a motor followed to how its properties were derived: catalog
 * option -> per-value provenance -> msci FEM reference -> powder
 * row -> dated citations / recipes / cascaded make-vs-buy. Absent
 * links render as their honest notes, never vanish.
 */
@Component({
  standalone: true,
  selector: 'motor-materials-panel',
  imports: [CommonModule],
  template: `
  <div *ngIf="trail && !trail.ok" class="err">
    {{ trail.refusal }}</div>
  <div *ngIf="trail?.ok">
    <p class="hint">{{ trail.trailNote }}</p>
    <div class="slot" *ngFor="let s of trail.slots">
      <div class="slot-head">
        <b>{{ slotLabel(s.slot) }}</b> — {{ s.displayName }}
        <span class="chip chip-outline">{{ s.family }}</span>
        <span class="chip chip-outline" [class.warn]="s.realizationLevel
              === 'theoretical'">{{ s.realizationLevel }}</span>
        <span class="chip chip-outline" [class.on]="s.role?.verdict === 'viable'"
              [class.warn]="s.role?.verdict !== 'viable'"
              *ngIf="s.role?.name">
          {{ s.role.name }}: {{ s.role.verdict }}</span>
        <span class="chip chip-outline" [class.on]="s.businessAllowed"
              [class.warn]="!s.businessAllowed">
          business {{ s.businessAllowed ? 'OPEN'
                    : 'gated (not made-and-measured)' }}</span>
      </div>
      <div class="err" *ngIf="s.refusal">{{ s.refusal }}</div>
      <div class="hint" *ngIf="s.role?.honestyNote">
        {{ s.role.honestyNote }}</div>

      <table class="props" *ngIf="s.properties?.length">
        <tr><th>property</th><th>value</th><th>unit</th>
            <th>provenance</th><th>note</th></tr>
        <tr *ngFor="let p of s.properties">
          <td>{{ p.property }}</td>
          <td class="num">{{ p.value }}</td>
          <td>{{ p.unit }}</td>
          <td><span class="chip chip-outline"
                [class.warn]="p.provenance === 'theoretical'"
                [class.on]="p.provenance === 'measured'">
              {{ p.provenance }}</span></td>
          <td class="muted">{{ p.note }}</td>
        </tr>
      </table>

      <div class="trail" *ngIf="s.msci">
        <b>μ derivation:</b>
        <span *ngIf="s.msci.femModels?.length; else noFem">
          msci row <code>{{ s.msci.msciMaterialRef }}</code> —
          <span *ngFor="let m of s.msci.femModels">
            <code>{{ m.name }}</code> ({{ m.physicsRef }})
          </span>
          <span class="muted">{{ s.msci.note }}</span>
        </span>
        <ng-template #noFem>
          <span class="muted">{{ s.msci.note }}</span>
        </ng-template>
      </div>

      <div class="trail" *ngIf="s.powder">
        <b>powder:</b> <code>{{ s.powder.powderRef }}</code>
        <span class="chip chip-outline warn" *ngIf="s.powder.isTheoretical">
          THEORETICAL</span>
        <span class="muted">{{ s.powder.notes }}</span>
      </div>

      <ng-container *ngTemplateOutlet="supplyTpl;
        context: { st: s.supply, label: 'supply' }"></ng-container>
      <ng-container *ngIf="s.fillerSupply">
        <div class="hint">{{ s.fillerSupply.note }}</div>
        <ng-container *ngTemplateOutlet="supplyTpl;
          context: { st: s.fillerSupply, label: 'filler supply' }">
        </ng-container>
      </ng-container>
      <div class="muted" *ngIf="s.optionNotes">{{ s.optionNotes }}
      </div>
    </div>

    <ng-template #supplyTpl let-st="st" let-label="label">
      <div class="trail" *ngIf="st">
        <b>{{ label }}:</b>
        <span class="muted" *ngIf="!st.itemRef">{{ st.note }}</span>
        <ng-container *ngIf="st.itemRef">
          <code>{{ st.itemRef }}</code>
          <span *ngIf="st.effectivePrice" class="chip chip-outline on">
            {{ st.effectivePrice.usdPerKg }} $/kg via
            {{ st.effectivePrice.via }}</span>
          <div *ngIf="st.citations?.length" class="cites">
            <div *ngFor="let c of st.citations">
              · <a [href]="c.url" target="_blank"
                   rel="noopener">{{ c.source }}</a>:
              {{ c.price }} {{ c.currency }} /
              {{ c.amount }} {{ c.unit }}
              <span class="muted">({{ c.observedAt }})</span>
              <span class="chip chip-outline warn" *ngIf="c.isEstimate">est~
              </span>
            </div>
          </div>
          <div class="muted" *ngIf="st.citationNote">
            {{ st.citationNote }}</div>
          <div *ngIf="st.recipes?.length" class="cites">
            <div *ngFor="let r of st.recipes">
              · recipe <code>{{ r.name }}</code>:
              <span *ngFor="let comp of r.components">
                {{ comp.item_ref }} ({{ comp.fraction }})
              </span>
              <span class="muted"
                *ngIf="r.yieldFraction !== 1">yield
                {{ r.yieldFraction }}</span>
            </div>
          </div>
          <div class="muted" *ngIf="st.recipeNote">
            {{ st.recipeNote }}</div>
          <div *ngIf="st.cascade" class="cites">
            cascaded: <b>{{ st.cascade.usdPerKg }} $/kg</b>
            <span *ngIf="st.cascade.madeIntermediates?.length">
              — self-made: {{ madeNames(st.cascade
                .madeIntermediates) }}</span>
            <span class="muted"> · {{ st.cascade.note }}</span>
          </div>
        </ng-container>
      </div>
    </ng-template>
  </div>
  `,
  styles: [`
    .hint { color: var(--text-on-card-muted); font-size: 0.9em; }
    .muted { color: var(--text-on-card-muted); font-size: 0.85em; }
    .err { color: #d33; }
    .slot { border: 1px solid var(--surface-outline, #8884);
      border-radius: 8px; padding: 10px 12px; margin: 10px 0;
      background: var(--surface-primary);
      color: var(--text-on-card); }
    .slot-head { display: flex; gap: 8px; flex-wrap: wrap;
      align-items: center; }
    /* base chip recipe + semantic states live in
       _chip-patterns.css */
    table.props { border-collapse: collapse; margin: 8px 0;
      font-size: 0.85em; width: 100%; }
    table.props th, table.props td { border-bottom: 1px solid
      var(--surface-outline, #8883); padding: 3px 8px;
      text-align: left; }
    td.num { font-variant-numeric: tabular-nums; }
    .trail { margin: 6px 0; font-size: 0.9em; }
    .cites { margin-left: 14px; font-size: 0.9em; }
    code { font-size: 0.9em; }
    a { color: inherit; }
  `],
})
export class MotorMaterialsPanelComponent {
  @Input() trail: any;

  slotLabel(slot: string): string {
    return { rotor_material: 'ROTOR', stator_material: 'STATOR',
             winding_material: 'WINDING' }[slot] ?? slot;
  }

  madeNames(items: any[]): string {
    return (items || [])
      .map((m) => (typeof m === 'string' ? m : m.item ?? ''))
      .join(', ');
  }
}
