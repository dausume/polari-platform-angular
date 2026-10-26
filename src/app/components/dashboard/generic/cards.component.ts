import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PolariService } from '@services/polari-service';
import { DisplayEventsService } from '@services/no-code-services/display-events.service';
import { RowActionConfig, actionShown } from './class-rows-action';
import { runRowAction } from './class-rows-action-run';
import { hasBlankParam } from './class-rows-interaction';
import { friendlyError } from './friendly-error';
import { CardFacet, cardText, groupRows, isUnverified, toggleFacet, withFacetParams } from './class-rows-cards';

/**
 * wb-1 `cards`: any door's rows as a responsive card grid (title / subtitle / badge chips / label-value rows / one action button),
 * optionally grouped under a heading and filtered by facet chips that re-query the door. Inputs = CardsConfig; the JSON shape is
 * documented in class-rows-cards.ts. The card button runs the SAME helper as class-rows-table (class-rows-action-run.ts).
 */
@Component({
  standalone: true,
  selector: 'cards',
  imports: [CommonModule, MatProgressSpinnerModule],
  templateUrl: './cards.component.html',
  styleUrls: ['./cards.component.scss'],
})
export class CardsComponent implements OnInit, OnChanges {
  @Input() dataPath = '';
  @Input() title_field = '';
  @Input() subtitle_field = '';
  @Input() badge_fields: string[] = [];
  @Input() fields: Record<string, string> = {};
  @Input() group_by = '';
  @Input() facets: CardFacet[] = [];
  @Input() action: RowActionConfig | null = null;
  @Input() empty_text = '';

  rows: any[] = [];
  groups: { heading: string; rows: any[] }[] = [];
  selected: Record<string, string> = {};
  loading = true;
  error: string | null = null;
  message = '';
  messageBad = false;
  busy = false;

  constructor(private http: HttpClient, private polari: PolariService, private events: DisplayEventsService) {}

  // camelCase aliases for the template (inputs keep the snake_case names the seed's JSON uses)
  get titleField(): string { return this.title_field; }
  get subtitleField(): string { return this.subtitle_field; }
  get badgeFields(): string[] { return this.badge_fields || []; }
  get emptyText(): string { return this.empty_text; }
  get fieldLabels(): string[] { return Object.keys(this.fields || {}); }

  ngOnInit(): void { this.load(); }

  ngOnChanges(c: SimpleChanges): void {
    const d = c['dataPath'];
    if (d && !d.firstChange && d.currentValue !== d.previousValue) { this.load(); }
  }

  titleOf(row: any): string { return this.title_field ? this.text(row, this.title_field) : ''; }
  text(row: any, field: string): string { return cardText(row?.[field]); }
  unverified(row: any, field: string): boolean { return isUnverified(row?.[field]); }
  actionAllowed(row: any): boolean { return actionShown(row, this.action); }

  toggle(param: string, value: string): void {
    this.selected = toggleFacet(this.selected, param, value);
    this.load();
  }

  runAction(row: any): void {
    if (!this.action || this.busy) { return; }
    this.busy = true;
    runRowAction(this.http, this.polari, this.events, this.action, row).subscribe((out) => {
      this.busy = false;
      this.message = out.ok ? 'Done.' : out.message;
      this.messageBad = !out.ok;
    });
  }

  private load(): void {
    this.error = null;
    if (!this.dataPath || hasBlankParam(this.dataPath)) {      // a scope nobody has picked yet: do not ask the door
      this.loading = false; this.rows = []; this.groups = [];
      return;
    }
    this.loading = true;
    const path = withFacetParams(this.dataPath, this.selected);
    const url = /^https?:\/\//.test(path) ? path : this.polari.getBackendBaseUrl() + path;
    this.http.get<any>(url, this.polari.backendRequestOptions).subscribe({
      next: (payload: any) => {
        this.loading = false;
        if (payload && payload.ok === false) { this.error = payload.error || `GET ${this.dataPath} refused.`; this.rows = []; this.groups = []; return; }
        this.rows = Array.isArray(payload) ? payload : (payload?.rows ?? []);
        this.groups = groupRows(this.rows, this.group_by);
      },
      error: (err: any) => {
        this.loading = false; this.rows = []; this.groups = [];
        this.error = friendlyError(err, `read ${this.dataPath}`).text;
      },
    });
  }
}
