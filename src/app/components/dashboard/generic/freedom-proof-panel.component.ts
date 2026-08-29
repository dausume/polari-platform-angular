import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { PolariService } from '@services/polari-service';
import { EvidenceDetailDrawerComponent } from './evidence-detail-drawer.component';
import {
  EvidenceRef, ProofPayload, ProofRecord,
  errorText, kindLetter, statusClass, verdictClass,
} from './evidence-types';

/**
 * Generic freedom-to-use proof panel (no-code). GETs a proof endpoint
 * (/api/cntfet/device/{name}/proof or /api/cntfet/cell/{cell}/proof)
 * and renders: subject + STATUS badge + the rule applied; the
 * evidence CHAIN as expandable record cards whose evidence chips open
 * an inline detail drawer; GAPS as a "what would make this
 * proven-free" checklist; the self-manufacture answer; and the
 * backend's disclaimer verbatim. Nothing here knows what the subject
 * is — status, verdicts and wording all come from the backend.
 */
@Component({
  standalone: true,
  selector: 'freedom-proof-panel',
  imports: [CommonModule, MatProgressSpinnerModule, EvidenceDetailDrawerComponent],
  templateUrl: './freedom-proof-panel.component.html',
  styleUrls: ['./freedom-proof-panel.component.scss'],
})
export class FreedomProofPanelComponent implements OnInit, OnChanges {
  /** Proof endpoint path starting with '/'. Required. */
  @Input() path = '';
  /** Optional heading override (else "{subject_kind} {subject}"). */
  @Input() title = '';

  loading = true;
  error: string | null = null;
  proof: ProofPayload | null = null;

  /** Record cards whose fto_reasoning is expanded. */
  expanded = new Set<string>();
  /** Evidence chip currently open in the drawer (name + path). */
  openEvidence: { name: string; record: string; detailPath: string } | null = null;

  statusClass = statusClass;
  verdictClass = verdictClass;
  kindLetter = kindLetter;

  constructor(private http: HttpClient,
              private polariService: PolariService) {}

  ngOnInit(): void { this.load(); }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['path'] && !changes['path'].firstChange) { this.load(); }
  }

  get heading(): string {
    if (this.title) { return this.title; }
    if (!this.proof) { return ''; }
    return `${this.proof.subject_kind} ${this.proof.subject}`;
  }

  get statusLabel(): string {
    return (this.proof?.status || 'unknown').replace(/-/g, ' ');
  }

  toggle(rec: ProofRecord): void {
    if (this.expanded.has(rec.record)) { this.expanded.delete(rec.record); }
    else { this.expanded.add(rec.record); }
  }

  isExpanded(rec: ProofRecord): boolean { return this.expanded.has(rec.record); }

  openDetail(rec: ProofRecord, ev: EvidenceRef): void {
    const detailPath = ev.detailPath || `/api/cntfet/evidence/${ev.name}`;
    if (this.openEvidence?.name === ev.name
        && this.openEvidence.record === rec.record) {
      this.openEvidence = null;
      return;
    }
    this.openEvidence = { name: ev.name, record: rec.record, detailPath };
  }

  closeDetail(): void { this.openEvidence = null; }

  drawerFor(rec: ProofRecord): string | null {
    return this.openEvidence?.record === rec.record
      ? this.openEvidence.detailPath : null;
  }

  isOpen(rec: ProofRecord, ev: EvidenceRef): boolean {
    return !!this.openEvidence && this.openEvidence.record === rec.record
      && this.openEvidence.name === ev.name;
  }

  evidenceTitle(ev: EvidenceRef): string {
    const parts = [ev.title, ev.proves].filter(Boolean);
    return parts.join(' — ') || ev.name;
  }

  trackRecord(_i: number, r: ProofRecord): string { return r.record; }
  trackEvidence(_i: number, e: EvidenceRef): string { return e.name; }

  private load(): void {
    this.proof = null;
    this.error = null;
    this.expanded.clear();
    this.openEvidence = null;
    if (!this.path) {
      this.loading = false;
      this.error = 'freedom-proof-panel: no path input.';
      return;
    }
    const path = this.path;
    this.loading = true;
    const url = this.polariService.getBackendBaseUrl() + path;
    this.http.get<any>(url, this.polariService.backendRequestOptions).subscribe({
      next: (payload: any) => {
        if (path !== this.path) { return; }
        this.loading = false;
        if (!payload || payload.ok === false) {
          this.error = payload?.error || `GET ${path}: not ok`;
          return;
        }
        this.proof = {
          ...payload,
          chain: payload.chain || [],
          gaps: payload.gaps || [],
        } as ProofPayload;
      },
      error: (err: any) => {
        if (path !== this.path) { return; }
        this.loading = false;
        this.error = errorText(err, path);
      },
    });
  }
}
