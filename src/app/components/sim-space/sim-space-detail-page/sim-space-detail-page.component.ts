import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { SimSpaceViewerComponent } from '../sim-space-viewer/sim-space-viewer.component';

/**
 * /sim-spaces/:name — full-page viewer for one SimSpaceDefinition.
 */
@Component({
  standalone: true,
  selector: 'sim-space-detail-page',
  imports: [
    CommonModule, MatCardModule, MatButtonModule, MatIconModule,
    SimSpaceViewerComponent,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <button mat-stroked-button (click)="back()">
          <mat-icon>arrow_back</mat-icon> Back to Sim Spaces
        </button>
        <h1 *ngIf="name" class="mono">{{ name }}</h1>
      </div>

      <mat-card appearance="outlined" class="viewer-card">
        <sim-space-viewer [simSpaceName]="name"></sim-space-viewer>
      </mat-card>
    </div>
  `,
  styles: [`
    .page { padding: 16px; height: calc(100vh - 80px); display: flex; flex-direction: column; }
    .page-header {
      display: flex; align-items: center; gap: 16px; margin-bottom: 12px;
    }
    h1 { margin: 0; color: var(--mat-sys-on-surface, #1a1a1a); }
    .mono { font-family: monospace; }
    .viewer-card { flex: 1; padding: 0; overflow: hidden; }
    sim-space-viewer { display: block; width: 100%; height: 100%; min-height: 500px; }
  `]
})
export class SimSpaceDetailPageComponent implements OnInit {
  name?: string;

  constructor(private route: ActivatedRoute, private router: Router) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(pm => {
      this.name = pm.get('name') ?? undefined;
    });
  }

  back(): void {
    this.router.navigateByUrl('/sim-spaces');
  }
}
