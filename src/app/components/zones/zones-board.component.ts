import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PolariService } from '@services/polari-service';

interface SelectionEntry {
  zone: string;
  captureMode: string;
  ok: boolean;
  volumeM3: number;
  totalCubes: number;
  error?: string;
}

interface RoomEntry {
  room: string;
  roomLabel: string;
  roomVolumeM3: number;
  roomEstimateOk: boolean;
  selections: SelectionEntry[];
  selectedVolumeM3: number;
  selectedCubes: number;
}

interface SiteSummary {
  ok: boolean;
  site: string;
  cubeSizeM: number;
  rooms: RoomEntry[];
  freeSelections: SelectionEntry[];
  totalRoomVolumeM3: number;
  totalSelectedVolumeM3: number;
  totalSelectedCubes: number;
}

/**
 * The rooms/zones board (Dustin 2026-07-17): a HORIZONTAL bar of
 * rooms, each with the zones defined inside it, so the data on rooms
 * and zones is visible in one sweep — room volume vs selected volume
 * vs packed cubes per room, with per-zone estimate drill-in. Reads
 * the live site summary; the cube size is a knob.
 *
 * DUAL-SURFACE by design: routed web view AND an XR HTMLMesh panel.
 * HTMLMesh rasterizes the component's own DOM subtree, so this
 * template deliberately uses NO Material overlay components (a
 * mat-select's cdk overlay renders at document.body and never makes
 * it into the mesh — the xr-3 run-picker lesson): plain <select> and
 * <button> only, self-contained layout, fixed max width.
 */
@Component({
  standalone: true,
  selector: 'zones-board',
  imports: [CommonModule, FormsModule, MatButtonModule, MatProgressSpinnerModule],
  templateUrl: './zones-board.component.html',
  styleUrls: ['./zones-board.component.scss'],
})
export class ZonesBoardComponent implements OnInit {
  sites: string[] = [];
  selectedSite = '';
  cubeSize = 0.25;

  summary: SiteSummary | null = null;
  loading = false;
  error: string | null = null;

  detailZone = '';
  detail: Record<string, unknown> | null = null;
  detailLoading = false;

  constructor(private http: HttpClient, private polariService: PolariService) {}

  private base(): string {
    return this.polariService.getBackendBaseUrl();
  }

  ngOnInit(): void {
    this.http.get<any>(`${this.base()}/SiteDefinition`,
      this.polariService.backendRequestOptions).subscribe({
      next: (envelope) => {
        const table = envelope?.[0]?.['SiteDefinition'];
        const rows = (Array.isArray(table) ? table?.[0]?.data : table?.data) || [];
        this.sites = rows.map((row: any) => row?.name).filter(Boolean).sort();
        if (this.sites.length > 0) {
          this.selectedSite = this.sites[0];
          this.reload();
        }
      },
      error: () => (this.error = 'Could not read sites.'),
    });
  }

  reload(): void {
    if (!this.selectedSite) {
      return;
    }
    this.loading = true;
    this.error = null;
    this.detailZone = '';
    this.detail = null;
    this.http.get<SiteSummary>(
      `${this.base()}/api/sites/${encodeURIComponent(this.selectedSite)}/summary`,
      { params: { cube_size_m: String(this.cubeSize) } }).subscribe({
      next: (summary) => {
        this.summary = summary;
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.error || 'Site summary unavailable.';
        this.loading = false;
      },
    });
  }

  openDetail(zoneName: string): void {
    if (this.detailZone === zoneName) {
      this.detailZone = '';
      this.detail = null;
      return;
    }
    this.detailZone = zoneName;
    this.detail = null;
    this.detailLoading = true;
    this.http.get<Record<string, unknown>>(
      `${this.base()}/api/zones/${encodeURIComponent(zoneName)}/estimate`).subscribe({
      next: (estimate) => {
        this.detail = estimate;
        this.detailLoading = false;
      },
      error: (err) => {
        this.detail = err?.error || { ok: false, error: 'Estimate unavailable.' };
        this.detailLoading = false;
      },
    });
  }

  detailEntries(): Array<[string, string]> {
    if (!this.detail) {
      return [];
    }
    return Object.entries(this.detail)
      .filter(([key, value]) => key !== 'ok'
        && (value === null || ['string', 'number', 'boolean'].includes(typeof value)))
      .map(([key, value]) => [key, String(value ?? '')]);
  }

  detailWarnings(): string[] {
    const warnings = (this.detail as any)?.warnings;
    return Array.isArray(warnings) ? warnings : [];
  }

  modeIcon(mode: string): string {
    return mode === 'hull' ? '◇' : mode === 'prism' ? '△' : '▭';
  }
}
