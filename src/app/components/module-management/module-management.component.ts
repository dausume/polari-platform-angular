import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { PolariService } from '@services/polari-service';
import { ClassTypingService } from '@services/class-typing-service';
import { ModuleDisableConfirmDialogComponent, ModuleDisableConfirmData } from './module-disable-confirm-dialog';

interface ModuleInfo {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  available: boolean;
  classCount: number;
  seedInstanceCount: number;
}

@Component({
  standalone: true,
  selector: 'module-management',
  template: `
    <div class="module-management-container">
      <h2>Module Management</h2>
      <p class="subtitle">Enable or disable optional modules for the Polari Research Framework.</p>

      <mat-spinner *ngIf="loading" diameter="40"></mat-spinner>

      <div *ngIf="error" class="error-message">
        <mat-icon>error</mat-icon>
        <span>{{ error }}</span>
        <button mat-button (click)="loadModules()">Retry</button>
      </div>

      <div *ngIf="!loading && !error" class="modules-grid">
        <mat-card *ngFor="let mod of modules" class="module-card" [class.enabled]="mod.enabled" [class.unavailable]="!mod.available">
          <mat-card-header>
            <mat-icon mat-card-avatar class="module-icon">{{ mod.enabled ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
            <mat-card-title>{{ mod.name }}</mat-card-title>
            <mat-card-subtitle>{{ mod.description }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="module-stats">
              <mat-chip-set>
                <mat-chip>
                  <mat-icon matChipAvatar>class</mat-icon>
                  {{ mod.classCount }} classes
                </mat-chip>
                <mat-chip *ngIf="mod.enabled">
                  <mat-icon matChipAvatar>storage</mat-icon>
                  {{ mod.seedInstanceCount }} instances
                </mat-chip>
                <mat-chip [highlighted]="mod.available" [color]="mod.available ? 'primary' : 'warn'">
                  {{ mod.available ? 'Package installed' : 'Package not installed' }}
                </mat-chip>
              </mat-chip-set>
            </div>
          </mat-card-content>
          <mat-card-actions>
            <mat-slide-toggle
              [checked]="mod.enabled"
              [disabled]="!mod.available || toggling || seeding"
              (change)="toggleModule(mod, $event.checked)">
              {{ mod.enabled ? 'Enabled' : 'Disabled' }}
            </mat-slide-toggle>
            <button mat-stroked-button
              *ngIf="mod.enabled && mod.available"
              [disabled]="seeding || toggling"
              (click)="loadSeedData(mod)"
              class="seed-button">
              <mat-icon>download</mat-icon>
              <span *ngIf="!seeding">Load Seed Data</span>
              <span *ngIf="seeding">Loading...</span>
            </button>
          </mat-card-actions>
        </mat-card>
      </div>

      <div *ngIf="toggleMessage" class="toggle-message" [class.success]="!toggleError" [class.error]="toggleError">
        <mat-icon>{{ toggleError ? 'warning' : 'info' }}</mat-icon>
        <span>{{ toggleMessage }}</span>
      </div>
    </div>
  `,
  styles: [`
    .module-management-container {
      max-width: 900px;
      margin: 0 auto;
      padding: 24px;
    }
    h2 { margin-bottom: 4px; }
    .subtitle { color: #666; margin-bottom: 24px; }
    .modules-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
      gap: 16px;
    }
    .module-card {
      border-left: 4px solid #ccc;
      transition: border-color 0.3s;
    }
    .module-card.enabled { border-left-color: #4caf50; }
    .module-card.unavailable { opacity: 0.6; }
    .module-icon { font-size: 28px; width: 28px; height: 28px; }
    .module-card.enabled .module-icon { color: #4caf50; }
    .module-stats { margin: 12px 0; }
    mat-card-actions {
      padding: 8px 16px;
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .seed-button {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .error-message, .toggle-message {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      border-radius: 4px;
      margin-top: 16px;
    }
    .error-message { background: #fdecea; color: #b71c1c; }
    .toggle-message.success { background: #e8f5e9; color: #1b5e20; }
    .toggle-message.error { background: #fdecea; color: #b71c1c; }
  `],
  imports: [
    CommonModule, MatCardModule, MatIconModule, MatButtonModule,
    MatSlideToggleModule, MatProgressSpinnerModule, MatChipsModule, MatDialogModule
  ]
})
export class ModuleManagementComponent implements OnInit, OnDestroy {
  modules: ModuleInfo[] = [];
  loading = true;
  error: string | null = null;
  toggling = false;
  seeding = false;
  toggleMessage: string | null = null;
  toggleError = false;
  private subscriptions: Subscription[] = [];

  constructor(private http: HttpClient, private polariService: PolariService, private typingService: ClassTypingService, private dialog: MatDialog) {}

  ngOnInit(): void {
    this.subscriptions.push(
      this.polariService.connectionSuccessSubject.subscribe(isConnected => {
        if (isConnected) { this.loadModules(); }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  loadModules(): void {
    this.loading = true;
    this.error = null;
    const url = this.polariService.getBackendBaseUrl() + '/modules';

    this.subscriptions.push(
      this.http.get<any>(url, this.polariService.backendRequestOptions).subscribe({
        next: (res: any) => {
          this.loading = false;
          if (res.success) {
            this.modules = res.modules;
          } else {
            this.error = res.error || 'Unknown error';
          }
        },
        error: (err: any) => {
          this.loading = false;
          this.error = 'Failed to load modules: ' + (err.message || err.statusText);
        }
      })
    );
  }

  toggleModule(mod: ModuleInfo, enabled: boolean): void {
    if (enabled) {
      this.executeToggle(mod, true);
    } else {
      const dialogRef = this.dialog.open(ModuleDisableConfirmDialogComponent, {
        width: '480px',
        data: {
          moduleName: mod.name,
          moduleId: mod.id,
          classCount: mod.classCount,
          instanceCount: mod.seedInstanceCount
        } as ModuleDisableConfirmData
      });

      this.subscriptions.push(
        dialogRef.afterClosed().subscribe((confirmed: boolean) => {
          if (confirmed) {
            this.executeToggle(mod, false);
          } else {
            this.loadModules();
          }
        })
      );
    }
  }

  private executeToggle(mod: ModuleInfo, enabled: boolean): void {
    this.toggling = true;
    this.toggleMessage = null;
    const url = this.polariService.getBackendBaseUrl() + '/modules';

    this.subscriptions.push(
      this.http.put<any>(url, { moduleId: mod.id, enabled }, this.polariService.backendRequestOptions).subscribe({
        next: (res: any) => {
          this.toggling = false;
          if (res.success) {
            this.toggleError = false;
            if (res.purgeSummary) {
              this.toggleMessage = `${res.message} — purged ${res.purgeSummary.instancesPurged} instances across ${res.purgeSummary.classesPurged} classes`;
            } else {
              this.toggleMessage = res.message;
            }
            if (res.modules) { this.modules = res.modules; }
            this.typingService.refreshAfterModuleChange();
          } else {
            this.toggleError = true;
            this.toggleMessage = res.error || 'Toggle failed';
          }
        },
        error: (err: any) => {
          this.toggling = false;
          this.toggleError = true;
          this.toggleMessage = 'Request failed: ' + (err.message || err.statusText);
        }
      })
    );
  }

  loadSeedData(mod: ModuleInfo): void {
    this.seeding = true;
    this.toggleMessage = null;
    const url = this.polariService.getBackendBaseUrl() + '/modules/seed';

    this.subscriptions.push(
      this.http.post<any>(url, { moduleId: mod.id }, this.polariService.backendRequestOptions).subscribe({
        next: (res: any) => {
          this.seeding = false;
          if (res.success) {
            this.toggleError = false;
            this.toggleMessage = res.message;
            if (res.modules) { this.modules = res.modules; }
            // Refresh typing so instance counts update in navigation
            this.typingService.refreshAfterModuleChange();
          } else {
            this.toggleError = true;
            this.toggleMessage = res.error || 'Seed data loading failed';
          }
        },
        error: (err: any) => {
          this.seeding = false;
          this.toggleError = true;
          this.toggleMessage = 'Seed request failed: ' + (err.message || err.statusText);
        }
      })
    );
  }
}
