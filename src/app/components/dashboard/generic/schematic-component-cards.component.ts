import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CRUDEservicesManager } from '@services/crude-services-manager';
import { crudeRows } from './feature-cards';
import { SchematicComponentCardComponent } from './schematic-component-card.component';

/**
 * cb-1 `schematic-component-cards` (componentName 'schematic-component-cards'): every SchematicComponent as a card with its small drawing,
 * red where unsolved. Inputs are CLASS NAMES, read through the generated CRUDE API (no door of its own):
 *   { "componentClass": "SchematicComponent", "portClass": "SchematicComponentPort", "partClass": "SchematicComponentPart",
 *     "checkClass": "SchematicComponentCheck" }   (checkClass optional: '' reads no checks)
 * Unsolved, blocked and stale components come first, so what still needs working out is seen first.
 */
@Component({
  standalone: true,
  selector: 'schematic-component-cards',
  imports: [CommonModule, MatProgressSpinnerModule, SchematicComponentCardComponent],
  template: `
    <div class="sc-cards">
      <div *ngIf="loading" class="state"><mat-spinner diameter="28"></mat-spinner></div>
      <div *ngIf="error" class="state error" role="alert">{{ error }}</div>
      <p *ngIf="!loading && !error && !components.length" class="muted">No schematic components yet.</p>
      <p *ngIf="!loading && components.length" class="muted summary">{{ summary }}</p>
      <div class="grid">
        <schematic-component-card *ngFor="let c of components" [component]="c" [allPorts]="ports" [allParts]="parts"
                                  [allChecks]="checks"></schematic-component-card>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; container-type: inline-size; }
    .grid { display: grid; gap: 10px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 19rem), 1fr)); }
    .muted { color: var(--text-on-card-muted); }
    .summary { margin: 0 0 8px; font-size: 0.9em; }
    .state.error { color: var(--color-error-text); }
  `],
})
export class SchematicComponentCardsComponent implements OnInit {
  @Input() componentClass = 'SchematicComponent';
  @Input() portClass = 'SchematicComponentPort';
  @Input() partClass = 'SchematicComponentPart';
  @Input() checkClass = 'SchematicComponentCheck';

  components: any[] = [];
  checks: any[] = [];
  ports: any[] = [];
  parts: any[] = [];
  loading = true;
  error: string | null = null;

  constructor(private crude: CRUDEservicesManager) {}

  get summary(): string {
    const unsolved = this.components.filter((c) => (c.solve_state || 'unsolved') !== 'solved').length;
    return `${this.components.length} component${this.components.length === 1 ? '' : 's'}; `
      + (unsolved ? `${unsolved} not solved (drawn red)` : 'all solved');
  }

  ngOnInit(): void {
    const read = (cls: string) => this.crude.getCRUDEclassService(cls).readAll();
    forkJoin([read(this.componentClass), read(this.portClass), read(this.partClass), this.checkClass ? read(this.checkClass) : of(null)]).subscribe({
      next: ([c, po, pa, ch]) => {
        this.loading = false;
        const rank = (r: any) => ((r.solve_state || 'unsolved') === 'solved' ? 1 : 0);
        this.components = crudeRows(c, this.componentClass).slice()
          .sort((a: any, b: any) => rank(a) - rank(b) || String(a.title || a.name).localeCompare(String(b.title || b.name)));
        this.ports = crudeRows(po, this.portClass);
        this.parts = crudeRows(pa, this.partClass);
        this.checks = this.checkClass ? crudeRows(ch, this.checkClass) : [];
      },
      error: (err: any) => {
        this.loading = false;
        this.error = `Could not read the schematic components: ${err?.message || 'request failed'}`;
      },
    });
  }
}
