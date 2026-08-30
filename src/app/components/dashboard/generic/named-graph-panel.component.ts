import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterModule } from '@angular/router';

import {
  GraphRendererComponent,
} from '@components/graph-config/graph-renderer/graph-renderer';
import { NamedGraphConfig } from '@models/graphs/NamedGraphConfig';
import {
  GraphDefinitionService,
} from '@services/graph/graph-definition.service';
import { PolariService } from '@services/polari-service';

/**
 * Generic no-code panel for ONE named GraphDefinition — the
 * ORIGINAL graphs design (GraphDefinition rows + graph-renderer)
 * made display-page-embeddable, module-agnostic and static (the
 * msim graph panel is the live-polling sibling). The graph stays
 * CONFIGURABLE: the settings link opens it in the Graphs editor,
 * and edits to the row change this panel with zero code.
 *
 * Data source: `dataPath` GETs {ok, rows: [...]} (long-form or
 * flat — whatever the definition's dimensions name); a payload
 * carrying `refusal` renders verbatim. Without dataPath, the
 * definition's source_class rows are fetched via CRUDE.
 */
@Component({
  standalone: true,
  selector: 'named-graph-panel',
  imports: [CommonModule, RouterModule, MatIconModule,
            MatProgressSpinnerModule, GraphRendererComponent],
  template: `
    <div class="named-graph-panel">
      <div *ngIf="loading" class="state"><mat-spinner diameter="28"></mat-spinner></div>
      <div *ngIf="error" class="state error">{{ error }}</div>
      <div *ngIf="refusal" class="refusal">
        <strong [title]="config?.name || graphName">{{ friendlyName() }}</strong>
        <p>{{ refusal }}</p>
      </div>
      <ng-container *ngIf="!loading && !error && !refusal && config">
        <div class="panel-title">
          <mat-icon>show_chart</mat-icon>
          <span>{{ config.name }}</span>
          <a mat-icon-button [routerLink]="['/graphs']"
             title="Configure this graph (Graphs page)">
            <mat-icon>settings</mat-icon>
          </a>
        </div>
        <p class="desc" *ngIf="config.description">{{ config.description }}</p>
        <graph-renderer [config]="config" [instanceData]="rows"
                        [classTypeData]="{}"></graph-renderer>
      </ng-container>
    </div>
  `,
  styles: [`
    .state { padding: 16px; color: var(--text-secondary, #666); }
    .state.error { color: var(--error-text, #b3261e); }
    .refusal { border-left: 3px solid var(--warning-text, #eb6834);
               padding: 8px 12px; }
    .refusal p, .desc { color: var(--text-secondary, #666);
                        font-size: 0.85em; margin: 4px 0; }
    .panel-title { display: flex; align-items: center; gap: 6px;
                   font-weight: 600; }
  `],
})
export class NamedGraphPanelComponent implements OnInit {
  /** GraphDefinition row NAME (seeded graphs address by name). */
  @Input() graphName = '';
  /** Optional data endpoint returning {ok, rows} or {refusal};
   *  omitted -> CRUDE rows of the definition's source_class. */
  @Input() dataPath = '';

  config: NamedGraphConfig | null = null;
  rows: any[] = [];
  loading = true;
  error: string | null = null;
  refusal: string | null = null;

  constructor(private graphDefService: GraphDefinitionService,
              private http: HttpClient,
              private polariService: PolariService) {}

  ngOnInit(): void {
    if (!this.graphName) {
      this.loading = false;
      this.error = 'named-graph-panel: no graphName input.';
      return;
    }
    this.graphDefService.loadConfigByName(this.graphName).subscribe({
      next: (config: NamedGraphConfig) => {
        this.config = config;
        this.loadRows(config);
      },
      error: (err: any) => {
        this.loading = false;
        this.error = err?.message
          || `GraphDefinition "${this.graphName}" failed to load`;
      },
    });
  }

  private loadRows(config: NamedGraphConfig): void {
    const base = this.polariService.getBackendBaseUrl();
    const url = this.dataPath
      ? base + this.dataPath
      : `${base}/${config.source_class}`;
    this.http.get<any>(url, this.polariService.backendRequestOptions)
      .subscribe({
        next: (payload: any) => {
          this.loading = false;
          if (payload && payload.refusal) {
            this.refusal = payload.refusal;
            return;
          }
          this.rows = this.dataPath
            ? (payload?.rows || [])
            : this.crudeRows(payload);
        },
        error: (err: any) => {
          this.loading = false;
          const body = err?.error;
          // a backend REFUSAL (ok:false with error/refusal text, 422)
          // is information, not a fetch failure — show its words
          if (body && (body.refusal || (body.ok === false && body.error))) {
            this.refusal = String(body.refusal || body.error);
          } else {
            this.error = `data fetch failed: `
              + (err?.message || 'request failed');
          }
        },
      });
  }

  /** CRUDE read-all responses vary; accept the common shapes. */
  private crudeRows(payload: any): any[] {
    if (Array.isArray(payload)) { return payload; }
    if (Array.isArray(payload?.data)) { return payload.data; }
    if (Array.isArray(payload?.objects)) { return payload.objects; }
    return [];
  }

  /** Graph rows are named as identifiers (cnt-device-score-terms,
   *  cntfet-figure-vs1-fig7a); readers see a label. The identifier
   *  stays in the tooltip and the gear link. */
  friendlyName(): string {
    const n = String(this.config?.name || this.graphName || '');
    return n
      .replace(/^cnt-device-/, '')
      .replace(/^cntfet-figure-/, 'figure: ')
      .replace(/^si-refinement-/, 'refinement: ')
      .replace(/^cnt-library-/, 'library: ')
      .replace(/-/g, ' ');
  }
}
