import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { SimSpaceViewerComponent } from '@components/sim-space/sim-space-viewer/sim-space-viewer.component';
import { PolariService } from '@services/polari-service';
import { ApiJsonPanelComponent } from './api-json-panel.component';
import { NamedGraphPanelComponent } from './named-graph-panel.component';

/** One row of the characteristics list (GET {listPath}). */
export interface FetCharacteristicSummary {
  key: string;
  display_name: string;
  group: string;
  order?: number;
  performance_meaning?: string;
  viewCount?: number;
}

/** One resolved view of a characteristic (detail payload `views[]`). */
export interface FetCharacteristicView {
  kind: 'graph' | 'api' | 'simspace';
  graphName?: string;
  componentName?: string;
  simSpaceName?: string;
  /** sim-space row filter (?run=) selecting this field's samples */
  run?: string;
  dataPath: string;
  field?: string;
  title: string;
  why?: string;
  status: 'ready' | 'unbuilt';
  owner?: string;
}

export interface FetCharacteristicDetail {
  ok: boolean;
  device: string;
  key: string;
  display_name: string;
  group: string;
  description?: string;
  performance_meaning?: string;
  equation?: string;
  fidelity?: string;
  related?: { states?: string[]; regimes?: string[]; terms?: string[] };
  citations?: any[];
  views: FetCharacteristicView[];
  unbuiltViews?: string[];
  error?: string;
}

interface CharacteristicGroup {
  name: string;
  items: FetCharacteristicSummary[];
}

/**
 * fv-5 — the FET characteristic explorer (generic, no-code).
 *
 * Lists a device's characteristics (grouped, from the backend's
 * `cnt_characteristics` catalogue) and, on select, renders the
 * characteristic's resolved views through the EXISTING building
 * blocks — named-graph-panel / api-json-panel / sim-space-viewer —
 * plus its description, performance meaning, equation, related
 * state/regime/term chips and citations. Nothing here knows what a
 * FET is: which views exist and where their data lives is decided
 * by the backend; a view the node has not built renders as an honest
 * placeholder naming its owner.
 */
@Component({
  standalone: true,
  selector: 'fet-characteristic-explorer',
  imports: [CommonModule, MatProgressSpinnerModule,
            NamedGraphPanelComponent, ApiJsonPanelComponent,
            SimSpaceViewerComponent],
  templateUrl: './fet-characteristic-explorer.component.html',
  styleUrls: ['./fet-characteristic-explorer.component.scss'],
})
export class FetCharacteristicExplorerComponent implements OnInit {
  /** Device key, e.g. 'cnt-aligned-s1'. Required. */
  @Input() device = '';
  /** Override for the list endpoint; defaults from `device`. */
  @Input() listPath = '';
  /** Characteristic to open first; else the first listed. */
  @Input() initialKey = '';
  /** Drop views the node has not built instead of showing placeholders. */
  @Input() hideUnbuilt = false;

  groups: CharacteristicGroup[] = [];
  listLoading = true;
  listError: string | null = null;
  detailPathTemplate = '';

  selectedKey = '';
  detail: FetCharacteristicDetail | null = null;
  detailLoading = false;
  detailError: string | null = null;

  constructor(private http: HttpClient,
              private polariService: PolariService) {}

  ngOnInit(): void {
    if (!this.device && !this.listPath) {
      this.listLoading = false;
      this.listError = 'fet-characteristic-explorer: no device input.';
      return;
    }
    const path = this.listPath
      || `/api/cntfet/device/${this.device}/characteristics`;
    this.get(path).subscribe({
      next: (payload: any) => {
        this.listLoading = false;
        if (!payload || payload.ok === false) {
          this.listError = payload?.error || `GET ${path}: not ok`;
          return;
        }
        if (!this.device && payload.device) { this.device = payload.device; }
        this.detailPathTemplate = payload.detailPath
          || `/api/cntfet/device/${this.device}/characteristic/{key}`;
        this.groups = this.groupItems(payload.groups || [],
                                      payload.characteristics || []);
        const first = this.groups[0]?.items[0]?.key;
        const wanted = this.initialKey
          && this.groups.some(g => g.items.some(i => i.key === this.initialKey))
          ? this.initialKey : first;
        if (wanted) { this.select(wanted); }
      },
      error: (err: any) => {
        this.listLoading = false;
        this.listError = this.errorText(err, path);
      },
    });
  }

  select(key: string): void {
    if (!key || key === this.selectedKey) { return; }
    this.selectedKey = key;
    this.detail = null;
    this.detailError = null;
    this.detailLoading = true;
    const path = this.detailPathTemplate.replace('{key}', key);
    this.get(path).subscribe({
      next: (payload: any) => {
        if (key !== this.selectedKey) { return; }
        this.detailLoading = false;
        if (!payload || payload.ok === false) {
          this.detailError = payload?.error || `GET ${path}: not ok`;
          return;
        }
        this.detail = payload as FetCharacteristicDetail;
      },
      error: (err: any) => {
        if (key !== this.selectedKey) { return; }
        this.detailLoading = false;
        this.detailError = this.errorText(err, path);
      },
    });
  }

  /** Views to show, honouring hideUnbuilt. */
  get visibleViews(): FetCharacteristicView[] {
    const views = this.detail?.views || [];
    return this.hideUnbuilt ? views.filter(v => v.status !== 'unbuilt') : views;
  }

  relatedChips(): Array<{ kind: string; label: string }> {
    const r = this.detail?.related || {};
    const out: Array<{ kind: string; label: string }> = [];
    for (const s of r.states || []) { out.push({ kind: 'state', label: s }); }
    for (const s of r.regimes || []) { out.push({ kind: 'regime', label: s }); }
    for (const s of r.terms || []) { out.push({ kind: 'term', label: s }); }
    return out;
  }

  citationText(c: any): string {
    if (typeof c === 'string') { return c; }
    if (!c) { return ''; }
    return c.title || c.label || c.ref || c.id || JSON.stringify(c);
  }

  citationHref(c: any): string {
    return (c && typeof c === 'object' && (c.url || c.href)) || '';
  }

  trackKey(_i: number, item: FetCharacteristicSummary): string { return item.key; }
  trackGroup(_i: number, g: CharacteristicGroup): string { return g.name; }

  private groupItems(order: string[],
                     items: FetCharacteristicSummary[]): CharacteristicGroup[] {
    const names = [...order];
    for (const it of items) {
      if (!names.includes(it.group)) { names.push(it.group); }
    }
    return names
      .map(name => ({
        name,
        items: items
          .filter(i => i.group === name)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
      }))
      .filter(g => g.items.length > 0);
  }

  private get(path: string) {
    const url = this.polariService.getBackendBaseUrl() + path;
    return this.http.get<any>(url, this.polariService.backendRequestOptions);
  }

  /** The backend's own `error` string verbatim when it sent one. */
  private errorText(err: any, path: string): string {
    const body = err?.error;
    if (body && typeof body.error === 'string') { return body.error; }
    return `GET ${path} failed: ${err?.message || 'request failed'}`;
  }
}
