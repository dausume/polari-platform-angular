import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  SimSpaceService,
  SimSpaceSummary,
} from '@services/sim-space/sim-space.service';

/**
 * /sim-spaces — list page (parallels MapsComponent shape).
 */
@Component({
  standalone: true,
  selector: 'sim-space-list-page',
  imports: [
    CommonModule, MatCardModule, MatTableModule, MatButtonModule,
    MatIconModule, MatChipsModule, MatProgressSpinnerModule, MatTooltipModule,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Sim Spaces</h1>
          <p class="muted">
            Configurable 2D / 3D spaces where class instances can be rendered
            with their bound positions + visuals. (3D arrives in Phase 2.)
          </p>
        </div>
        <button mat-stroked-button (click)="load(true)" [disabled]="loading">
          <mat-icon>refresh</mat-icon> Refresh
        </button>
      </div>

      <div *ngIf="loading" class="loading-row">
        <mat-spinner diameter="24"></mat-spinner>
        <span>Loading sim spaces…</span>
      </div>

      <div *ngIf="errorMessage" class="err-text">{{ errorMessage }}</div>

      <mat-card *ngIf="rows.length" appearance="outlined" class="table-card">
        <table mat-table [dataSource]="rows">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Name</th>
            <td mat-cell *matCellDef="let r"><span class="mono">{{ r.name }}</span></td>
          </ng-container>
          <ng-container matColumnDef="description">
            <th mat-header-cell *matHeaderCellDef>Description</th>
            <td mat-cell *matCellDef="let r">{{ r.description || '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="dimensionality">
            <th mat-header-cell *matHeaderCellDef>Dimension</th>
            <td mat-cell *matCellDef="let r">
              <mat-chip>{{ r.dimensionality }}</mat-chip>
            </td>
          </ng-container>
          <ng-container matColumnDef="coordinateSystem">
            <th mat-header-cell *matHeaderCellDef>Coords</th>
            <td mat-cell *matCellDef="let r">{{ r.coordinateSystem }}</td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let r">
              <button mat-icon-button (click)="open(r)" matTooltip="View">
                <mat-icon>chevron_right</mat-icon>
              </button>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="cols"></tr>
          <tr mat-row *matRowDef="let r; columns: cols;" class="row" (click)="open(r)"></tr>
        </table>
      </mat-card>

      <p *ngIf="!loading && !rows.length && !errorMessage" class="muted">
        No sim spaces yet. The framework seeds a "demo-2d" space on first boot —
        try rebuilding the backend or check that the seed loader ran.
      </p>
    </div>
  `,
  styles: [`
    .page { padding: 24px; max-width: 1200px; margin: 0 auto; }
    .page-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      gap: 16px; margin-bottom: 16px;
    }
    h1 { margin: 0 0 4px 0; color: var(--mat-sys-on-surface, #1a1a1a); }
    .muted { color: var(--mat-sys-on-surface-variant, #666); margin: 0; }
    .mono { font-family: monospace; }
    .table-card { padding: 0; overflow-x: auto; }
    table { width: 100%; }
    .row { cursor: pointer; }
    .row:hover { background-color: rgba(0,0,0,0.04); }
    .loading-row { display: flex; align-items: center; gap: 12px; padding: 24px 0; color: #888; }
    .err-text {
      color: #c62828; padding: 12px 16px;
      background: rgba(198, 40, 40, 0.08); border-radius: 4px; margin-bottom: 16px;
    }
  `]
})
export class SimSpaceListPageComponent implements OnInit {
  rows: SimSpaceSummary[] = [];
  loading = false;
  errorMessage: string | null = null;
  readonly cols = ['name', 'description', 'dimensionality', 'coordinateSystem', 'actions'];

  constructor(private simSpace: SimSpaceService, private router: Router) {}

  ngOnInit(): void {
    this.load();
  }

  async load(force = false): Promise<void> {
    this.loading = true;
    this.errorMessage = null;
    try {
      this.rows = await this.simSpace.list();
    } catch (err: any) {
      this.errorMessage = err?.message || String(err);
    } finally {
      this.loading = false;
    }
  }

  open(row: SimSpaceSummary): void {
    this.router.navigate(['/sim-spaces', row.name]);
  }
}
