import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { DisplayManagerService } from '@services/dashboard/display-manager.service';
import { Display } from '@models/dashboards/Display';
import { DisplayRendererComponent } from '@components/dashboard/dashboard-renderer/dashboard-renderer';
import { Subscription } from 'rxjs';

@Component({
  standalone: true,
  selector: 'display-page',
  template: `
    <div class="display-page-container">
      <div *ngIf="loading" class="display-page-loading">
        <mat-spinner diameter="48"></mat-spinner>
        <p>Loading display...</p>
      </div>

      <div *ngIf="error && !loading" class="display-page-error">
        <mat-icon>error_outline</mat-icon>
        <h3>Display Not Found</h3>
        <p>{{ error }}</p>
      </div>

      <dashboard-renderer
        *ngIf="display && !loading && !error"
        [dashboard]="display">
      </dashboard-renderer>
    </div>
  `,
  styles: [`
    .display-page-container {
      padding: 16px;
      min-height: calc(100vh - 64px);
    }
    .display-page-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 80px 20px;
    }
    .display-page-loading p {
      margin-top: 16px;
      color: var(--text-secondary);
    }
    .display-page-error {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 80px 20px;
      text-align: center;
      color: var(--text-secondary);
    }
    .display-page-error mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: #ccc;
      margin-bottom: 16px;
    }
    .display-page-error h3 {
      margin: 0 0 8px 0;
      color: var(--text-primary);
    }
  `],
  imports: [CommonModule, MatProgressSpinnerModule, MatIconModule, DisplayRendererComponent]
})
export class DisplayPageComponent implements OnInit, OnDestroy {
  display: Display | null = null;
  loading = true;
  error: string | null = null;

  private sub?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private displayManager: DisplayManagerService
  ) {}

  ngOnInit(): void {
    this.sub = this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.loadDisplay(id);
      } else {
        this.loading = false;
        this.error = 'No display ID provided.';
      }
    });
  }

  private loadDisplay(id: string): void {
    this.loading = true;
    this.error = null;
    this.displayManager.loadDisplay(id).subscribe({
      next: (display: Display) => {
        this.display = display;
        this.loading = false;
      },
      error: (err: any) => {
        this.loading = false;
        this.error = `Could not load display "${id}".`;
        console.error('[DisplayPage] Load failed:', err);
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}
