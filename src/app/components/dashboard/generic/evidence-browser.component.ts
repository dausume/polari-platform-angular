import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { PolariService } from '@services/polari-service';
import { EvidenceDetailDrawerComponent } from './evidence-detail-drawer.component';
import { FreedomProofPanelComponent } from './freedom-proof-panel.component';
import {
  EvidenceItem, EvidenceListPayload, LibraryProofPayload, LibrarySubject,
  PROOF_STATUSES, ProofStatus, errorText, gapCount, kindLetter, statusClass,
} from './evidence-types';

type Tab = 'evidence' | 'proof';

/**
 * Generic evidence browser (no-code). Two tabs over the CNT-FET
 * evidence library:
 *   Evidence      — GET {path}: filter by kind, verified-only toggle,
 *                   free-text search; a row opens the shared
 *                   evidence-detail-drawer.
 *   Proof status  — GET {libraryProofPath}: one row per subject with
 *                   its status badge; a row loads that subject's
 *                   proof endpoint into an embedded
 *                   freedom-proof-panel.
 * A status count summary sits above both tabs.
 */
@Component({
  standalone: true,
  selector: 'evidence-browser',
  imports: [CommonModule, FormsModule, MatProgressSpinnerModule,
            EvidenceDetailDrawerComponent, FreedomProofPanelComponent],
  templateUrl: './evidence-browser.component.html',
  styleUrls: ['./evidence-browser.component.scss'],
})
export class EvidenceBrowserComponent implements OnInit {
  /** Evidence list endpoint. */
  @Input() path = '/api/cntfet/evidence';
  /** Library-wide proof status endpoint. */
  @Input() libraryProofPath = '/api/cntfet/proof';

  tab: Tab = 'evidence';
  readonly statuses: ProofStatus[] = PROOF_STATUSES;
  statusClass = statusClass;
  kindLetter = kindLetter;
  gapCount = gapCount;

  // --- Evidence tab ---
  evLoading = true;
  evError: string | null = null;
  evidence: EvidenceListPayload | null = null;
  kinds: string[] = [];
  kindFilter = '';
  verifiedOnly = false;
  search = '';
  openDetailPath: string | null = null;
  openName = '';

  // --- Proof status tab ---
  libLoading = true;
  libError: string | null = null;
  library: LibraryProofPayload | null = null;
  selectedSubject: LibrarySubject | null = null;

  constructor(private http: HttpClient,
              private polariService: PolariService) {}

  ngOnInit(): void {
    this.loadEvidence();
    this.loadLibrary();
  }

  setTab(tab: Tab): void { this.tab = tab; }

  /** Status → count from the library payload (0 when absent). */
  countFor(status: string): number {
    return this.library?.counts?.[status] ?? 0;
  }

  get filteredItems(): EvidenceItem[] {
    const items = this.evidence?.items || [];
    const q = this.search.trim().toLowerCase();
    return items.filter(it =>
      (!this.kindFilter || it.kind === this.kindFilter)
      && (!this.verifiedOnly || !!it.verified)
      && (!q || this.haystack(it).includes(q)));
  }

  openItem(it: EvidenceItem): void {
    const dp = it.detailPath || `${this.path.split('?')[0]}/${it.name}`;
    if (this.openName === it.name) { this.closeItem(); return; }
    this.openName = it.name;
    this.openDetailPath = dp;
  }

  closeItem(): void {
    this.openName = '';
    this.openDetailPath = null;
  }

  selectSubject(s: LibrarySubject): void {
    this.selectedSubject = this.selectedSubject?.detailPath === s.detailPath ? null : s;
  }

  trackItem(_i: number, it: EvidenceItem): string { return it.name; }
  trackSubject(_i: number, s: LibrarySubject): string { return s.detailPath; }

  private haystack(it: EvidenceItem): string {
    return [it.name, it.title, it.ref, it.parties, it.proves, it.proves_detail,
            it.jurisdiction, it.licence_bucket, it.notes]
      .filter(Boolean).join(' ').toLowerCase();
  }

  private loadEvidence(): void {
    const path = this.path;
    this.get(path).subscribe({
      next: (payload: any) => {
        this.evLoading = false;
        if (!payload || payload.ok === false) {
          this.evError = payload?.error || `GET ${path}: not ok`;
          return;
        }
        this.evidence = { ...payload, items: payload.items || [] } as EvidenceListPayload;
        const byKind = Object.keys(payload.counts?.byKind || {});
        const seen = new Set<string>(byKind);
        for (const it of this.evidence.items) { if (it.kind) { seen.add(it.kind); } }
        this.kinds = [...seen].sort();
      },
      error: (err: any) => {
        this.evLoading = false;
        this.evError = errorText(err, path);
      },
    });
  }

  private loadLibrary(): void {
    const path = this.libraryProofPath;
    this.get(path).subscribe({
      next: (payload: any) => {
        this.libLoading = false;
        if (!payload || payload.ok === false) {
          this.libError = payload?.error || `GET ${path}: not ok`;
          return;
        }
        this.library = {
          ...payload,
          subjects: payload.subjects || [],
          counts: payload.counts || {},
        } as LibraryProofPayload;
      },
      error: (err: any) => {
        this.libLoading = false;
        this.libError = errorText(err, path);
      },
    });
  }

  private get(path: string) {
    const url = this.polariService.getBackendBaseUrl() + path;
    return this.http.get<any>(url, this.polariService.backendRequestOptions);
  }
}
