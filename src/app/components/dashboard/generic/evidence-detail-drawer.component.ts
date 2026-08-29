import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { PolariService } from '@services/polari-service';
import { EvidenceDetailPayload, EvidenceItem, errorText, kindLetter } from './evidence-types';

/** Field order + labels for the item block (every contract field). */
const ITEM_FIELDS: Array<[keyof EvidenceItem, string]> = [
  ['name', 'name'], ['kind', 'kind'], ['title', 'title'], ['parties', 'parties'],
  ['ref', 'reference'], ['date', 'date'], ['proves', 'proves'],
  ['proves_detail', 'proves (detail)'], ['expiry', 'expiry'],
  ['jurisdiction', 'jurisdiction'], ['verified', 'verified'],
  ['verified_via', 'verified via'], ['verified_at', 'verified at'],
  ['licence_bucket', 'licence bucket'], ['notes', 'notes'],
];

/**
 * Inline detail drawer for ONE evidence item (GET {detailPath}) —
 * shared by freedom-proof-panel and evidence-browser. Shows every
 * item field, what the item supports (records/devices/cells as
 * chips), who cites it, an external link, and a close button.
 */
@Component({
  standalone: true,
  selector: 'evidence-detail-drawer',
  imports: [CommonModule, MatProgressSpinnerModule],
  templateUrl: './evidence-detail-drawer.component.html',
  styleUrls: ['./evidence-detail-drawer.component.scss'],
})
export class EvidenceDetailDrawerComponent implements OnChanges {
  /** Backend path of the evidence item, e.g. '/api/cntfet/evidence/{name}'. */
  @Input() detailPath = '';
  @Output() closed = new EventEmitter<void>();

  loading = false;
  error: string | null = null;
  detail: EvidenceDetailPayload | null = null;
  fields: Array<{ label: string; value: string }> = [];
  supportChips: Array<{ group: string; label: string }> = [];

  kindLetter = kindLetter;

  constructor(private http: HttpClient,
              private polariService: PolariService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['detailPath']) { this.load(); }
  }

  close(): void { this.closed.emit(); }

  get item(): EvidenceItem | null { return this.detail?.item || null; }

  private load(): void {
    this.detail = null;
    this.fields = [];
    this.supportChips = [];
    this.error = null;
    if (!this.detailPath) {
      this.error = 'evidence-detail-drawer: no detailPath.';
      return;
    }
    const path = this.detailPath;
    this.loading = true;
    const url = this.polariService.getBackendBaseUrl() + path;
    this.http.get<any>(url, this.polariService.backendRequestOptions).subscribe({
      next: (payload: any) => {
        if (path !== this.detailPath) { return; }
        this.loading = false;
        if (!payload || payload.ok === false || !payload.item) {
          this.error = payload?.error || `GET ${path}: not ok`;
          return;
        }
        this.detail = payload as EvidenceDetailPayload;
        this.fields = this.buildFields(this.detail.item);
        this.supportChips = this.buildSupports(this.detail.supports);
      },
      error: (err: any) => {
        if (path !== this.detailPath) { return; }
        this.loading = false;
        this.error = errorText(err, path);
      },
    });
  }

  private buildFields(item: EvidenceItem): Array<{ label: string; value: string }> {
    const out: Array<{ label: string; value: string }> = [];
    for (const [key, label] of ITEM_FIELDS) {
      const v = (item as any)[key];
      if (v === undefined || v === null || v === '') { continue; }
      out.push({ label, value: typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v) });
    }
    return out;
  }

  private buildSupports(s: EvidenceDetailPayload['supports'] | undefined) {
    const out: Array<{ group: string; label: string }> = [];
    if (!s) { return out; }
    for (const r of s.records || []) { out.push({ group: 'record', label: r }); }
    for (const d of s.devices || []) { out.push({ group: 'device', label: d }); }
    for (const c of s.cells || []) { out.push({ group: 'cell', label: c }); }
    return out;
  }
}
