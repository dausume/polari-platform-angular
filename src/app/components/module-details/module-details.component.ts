import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatListModule } from '@angular/material/list';
import { MatExpansionModule } from '@angular/material/expansion';
import { PolariService } from '@services/polari-service';

interface ClassField {
  name: string;
  type: string;
  defaultValue: string;
}

interface ClassDetail {
  className: string;
  fields: ClassField[];
  referencedBy: string[];
  inheritsFrom: string[];
  detailsAvailable: boolean;
  /** tt-10: live row count — the 'data it defines' quick-nav. */
  instanceCount?: number;
  /** tt-14: which database this class's rows live on (on this
   *  backend) — mariadb:db@host or sqlite:<name>. */
  database?: string;
}

/** tt-10 drill-in map entries (GET /modules/{id}). */
interface ModulePage {
  name: string;
  sourceClass: string;
  route: string;
}

interface ModuleSelftests {
  suites: string[];
  command: string;
}

/** tt-14: where this backend's object rows live. */
interface ModuleStorage {
  kind: string;
  name: string;
  shared: boolean;
  note: string;
}

interface PolariDependency {
  moduleId: string;
  moduleName: string;
  reasons: string[];
}

interface ModuleDetail {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  available: boolean;
  userCreated: boolean;
  classCount: number;
  seedInstanceCount: number;
  classes: ClassDetail[];
  pythonDependencies: string[];
  polariDependencies: PolariDependency[];
  pages?: ModulePage[];
  apiRoutes?: string[];
  selftests?: ModuleSelftests;
  storage?: ModuleStorage;
}

@Component({
  standalone: true,
  selector: 'module-details',
  template: `
    <div class="module-details-container">
      <div class="header-row">
        <button mat-icon-button (click)="goBack()" class="back-btn">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h2 *ngIf="moduleData">{{ moduleData.name }}</h2>
        <h2 *ngIf="!moduleData && !loading">Module Details</h2>
      </div>

      <mat-spinner *ngIf="loading" diameter="40"></mat-spinner>

      <div *ngIf="error" class="error-message">
        <mat-icon>error</mat-icon>
        <span>{{ error }}</span>
        <button mat-button (click)="loadModule()">Retry</button>
      </div>

      <div *ngIf="moduleData && !loading">
        <mat-tab-group [selectedIndex]="selectedTabIndex" (selectedIndexChange)="selectedTabIndex = $event">

          <!-- Tab 1: Overview -->
          <mat-tab label="Overview">
            <div class="tab-content">
              <mat-card>
                <mat-card-header>
                  <mat-icon mat-card-avatar class="overview-icon">{{ moduleData.enabled ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
                  <mat-card-title>{{ moduleData.name }}</mat-card-title>
                  <mat-card-subtitle>{{ moduleData.description || 'No description' }}</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <div class="stats-row">
                    <mat-chip-set>
                      <mat-chip [highlighted]="moduleData.enabled" [color]="moduleData.enabled ? 'primary' : 'warn'">
                        {{ moduleData.enabled ? 'Enabled' : 'Disabled' }}
                      </mat-chip>
                      <mat-chip *ngIf="moduleData.userCreated" color="accent" highlighted>
                        User Created
                      </mat-chip>
                      <mat-chip>
                        <mat-icon matChipAvatar>class</mat-icon>
                        {{ moduleData.classCount }} classes
                      </mat-chip>
                      <mat-chip *ngIf="moduleData.enabled">
                        <mat-icon matChipAvatar>storage</mat-icon>
                        {{ moduleData.seedInstanceCount }} instances
                      </mat-chip>
                      <mat-chip>
                        <mat-icon matChipAvatar>inventory_2</mat-icon>
                        {{ moduleData.pythonDependencies.length }} Python deps
                      </mat-chip>
                      <mat-chip>
                        <mat-icon matChipAvatar>link</mat-icon>
                        {{ moduleData.polariDependencies.length }} module deps
                      </mat-chip>
                    </mat-chip-set>
                  </div>
                </mat-card-content>
              </mat-card>
            </div>
          </mat-tab>

          <!-- Tab 2 (tt-10): where to work — pages, functionality,
               data, tests this module defines, each one click away. -->
          <mat-tab label="Navigate">
            <div class="tab-content">
              <mat-card class="nav-card">
                <mat-card-header>
                  <mat-icon mat-card-avatar>web</mat-icon>
                  <mat-card-title>Pages</mat-card-title>
                  <mat-card-subtitle>display pages this module defines</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <p *ngIf="!moduleData.pages?.length" class="empty-message">No display pages attributed to this module.</p>
                  <mat-chip-set>
                    <mat-chip *ngFor="let page of moduleData.pages"
                              (click)="openPage(page)" highlighted color="primary">
                      <mat-icon matChipAvatar>open_in_new</mat-icon>
                      {{ page.name }}
                    </mat-chip>
                  </mat-chip-set>
                </mat-card-content>
              </mat-card>

              <mat-card class="nav-card">
                <mat-card-header>
                  <mat-icon mat-card-avatar>storage</mat-icon>
                  <mat-card-title>Data</mat-card-title>
                  <mat-card-subtitle *ngIf="moduleData.storage"
                    [title]="moduleData.storage!.note">
                    lives on <code>{{ moduleData.storage!.name }}</code>
                    {{ moduleData.storage!.shared ? '(shared — visible to every sharing instance)'
                       : '(owned by this instance)' }}
                  </mat-card-subtitle>
                  <mat-card-subtitle *ngIf="!moduleData.storage">classes + live rows — click to open the class page</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <p *ngIf="!moduleData.classes.length" class="empty-message">No classes.</p>
                  <mat-chip-set>
                    <mat-chip *ngFor="let cls of moduleData.classes"
                              (click)="navigateToClass(cls.className)">
                      {{ cls.className }}
                      <span class="count-tag">{{ cls.instanceCount ?? 0 }}</span>
                    </mat-chip>
                  </mat-chip-set>
                </mat-card-content>
              </mat-card>

              <mat-card class="nav-card">
                <mat-card-header>
                  <mat-icon mat-card-avatar>api</mat-icon>
                  <mat-card-title>Functionality</mat-card-title>
                  <mat-card-subtitle>API routes registered by this module's source</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <p *ngIf="!moduleData.apiRoutes?.length" class="empty-message">No routes scanned — this module serves through the generated class CRUDE endpoints only.</p>
                  <div class="route-list">
                    <code *ngFor="let route of moduleData.apiRoutes">{{ route }}</code>
                  </div>
                </mat-card-content>
              </mat-card>

              <mat-card class="nav-card">
                <mat-card-header>
                  <mat-icon mat-card-avatar>fact_check</mat-icon>
                  <mat-card-title>Selftests</mat-card-title>
                  <mat-card-subtitle>run them in-container via the pol CLI</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <p *ngIf="!moduleData.selftests?.suites?.length" class="empty-message">No selftest suites in this module.</p>
                  <ng-container *ngIf="moduleData.selftests?.suites?.length">
                    <div class="route-list">
                      <code *ngFor="let suite of moduleData.selftests!.suites">{{ suite }}</code>
                    </div>
                    <p class="selftest-command"><code>{{ moduleData.selftests!.command }}</code></p>
                  </ng-container>
                </mat-card-content>
              </mat-card>
            </div>
          </mat-tab>

          <!-- Tab 3: Polari Classes -->
          <mat-tab>
            <ng-template mat-tab-label>
              Polari Classes
              <span class="tab-badge">{{ moduleData.classes.length }}</span>
            </ng-template>
            <div class="tab-content">
              <p *ngIf="moduleData.classes.length === 0" class="empty-message">No classes defined in this module.</p>
              <mat-accordion *ngIf="moduleData.classes.length > 0" multi>
                <mat-expansion-panel *ngFor="let cls of moduleData.classes">
                  <mat-expansion-panel-header>
                    <mat-panel-title class="class-panel-title">
                      <mat-icon class="class-icon">category</mat-icon>
                      <span class="class-name-text">{{ cls.className || '(unnamed)' }}</span>
                    </mat-panel-title>
                    <mat-panel-description>
                      {{ cls.fields.length }} fields
                      · {{ cls.instanceCount ?? 0 }} rows
                      <span class="db-tag" *ngIf="cls.database"
                            [title]="'where this class\\'s rows live on this backend'">
                        · {{ cls.database }}</span>
                      <span *ngIf="!cls.detailsAvailable" class="limited-tag">(limited info)</span>
                    </mat-panel-description>
                  </mat-expansion-panel-header>

                  <div class="class-detail">
                    <!-- Navigate to class page -->
                    <div class="class-nav-row" *ngIf="moduleData.enabled">
                      <button mat-stroked-button color="primary" (click)="navigateToClass(cls.className)">
                        <mat-icon>open_in_new</mat-icon> Open Class Page
                      </button>
                    </div>

                    <!-- Inheritance -->
                    <div *ngIf="cls.inheritsFrom && cls.inheritsFrom.length > 0" class="detail-section">
                      <span class="detail-label">Inherits from:</span>
                      <mat-chip-set>
                        <mat-chip *ngFor="let parent of cls.inheritsFrom" (click)="navigateToClass(parent)">
                          {{ parent }}
                        </mat-chip>
                      </mat-chip-set>
                    </div>

                    <!-- Referenced By -->
                    <div *ngIf="cls.referencedBy && cls.referencedBy.length > 0" class="detail-section">
                      <span class="detail-label">Referenced by:</span>
                      <mat-chip-set>
                        <mat-chip *ngFor="let ref of cls.referencedBy" (click)="navigateToClass(ref)">
                          {{ ref }}
                        </mat-chip>
                      </mat-chip-set>
                    </div>

                    <!-- Fields Table -->
                    <table class="fields-table" *ngIf="cls.fields.length > 0">
                      <thead>
                        <tr>
                          <th>Field</th>
                          <th>Type</th>
                          <th>Default</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr *ngFor="let field of cls.fields">
                          <td class="field-name">{{ field.name }}</td>
                          <td class="field-type">{{ field.type }}</td>
                          <td class="field-default">{{ formatDefault(field.defaultValue) }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </mat-expansion-panel>
              </mat-accordion>
            </div>
          </mat-tab>

          <!-- Tab 3: Python Dependencies -->
          <mat-tab>
            <ng-template mat-tab-label>
              Python Dependencies
              <span class="tab-badge">{{ moduleData.pythonDependencies.length }}</span>
            </ng-template>
            <div class="tab-content">
              <p *ngIf="moduleData.pythonDependencies.length === 0" class="empty-message">
                No external Python dependencies detected.
              </p>
              <mat-list *ngIf="moduleData.pythonDependencies.length > 0">
                <mat-list-item *ngFor="let pkg of moduleData.pythonDependencies">
                  <mat-icon matListItemIcon>inventory_2</mat-icon>
                  <span matListItemTitle>{{ pkg }}</span>
                </mat-list-item>
              </mat-list>
            </div>
          </mat-tab>

          <!-- Tab 4: Module Dependencies -->
          <mat-tab>
            <ng-template mat-tab-label>
              Module Dependencies
              <span class="tab-badge">{{ moduleData.polariDependencies.length }}</span>
            </ng-template>
            <div class="tab-content">
              <p *ngIf="moduleData.polariDependencies.length === 0" class="empty-message">
                This module has no cross-module dependencies.
              </p>
              <mat-list *ngIf="moduleData.polariDependencies.length > 0">
                <mat-list-item *ngFor="let dep of moduleData.polariDependencies" (click)="navigateToModule(dep.moduleId)" class="clickable-item">
                  <mat-icon matListItemIcon>link</mat-icon>
                  <span matListItemTitle>{{ dep.moduleName }}</span>
                  <span matListItemLine *ngFor="let reason of dep.reasons">{{ reason }}</span>
                </mat-list-item>
              </mat-list>
            </div>
          </mat-tab>

        </mat-tab-group>
      </div>
    </div>
  `,
  styles: [`
    .module-details-container {
      max-width: 960px;
      margin: 0 auto;
      padding: 24px;
    }
    .header-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
    }
    .header-row h2 { margin: 0; }
    .back-btn { flex-shrink: 0; }
    .tab-content { padding: 16px 0; }
    .overview-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: #4caf50;
    }
    .stats-row { margin-top: 16px; }
    .tab-badge {
      background: rgba(0,0,0,0.08);
      border-radius: 10px;
      padding: 1px 7px;
      font-size: 12px;
      margin-left: 6px;
    }
    .class-panel-title {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #333;
    }
    .class-name-text {
      font-weight: 500;
      color: #333;
    }
    .class-icon {
      font-size: 20px;
      color: #1976d2;
      flex-shrink: 0;
    }
    .db-tag {
      font-family: monospace;
      font-size: 11px;
      color: #ff8f00;
      margin-left: 4px;
    }
    .limited-tag {
      font-style: italic;
      color: #999;
      margin-left: 8px;
    }
    .class-detail { padding: 8px 0; }
    .class-nav-row { margin-bottom: 12px; }
    .nav-card { margin-bottom: 14px; }
    .count-tag {
      margin-left: 6px;
      font-size: 10px;
      font-family: monospace;
      background: rgba(0, 0, 0, 0.08);
      border-radius: 8px;
      padding: 0 6px;
    }
    .route-list {
      display: flex;
      flex-direction: column;
      gap: 3px;
      code {
        font-size: 12px;
        background: rgba(0, 0, 0, 0.05);
        border-radius: 4px;
        padding: 2px 8px;
        width: fit-content;
      }
    }
    .selftest-command {
      margin: 10px 0 0;
      code {
        background: #263238; color: #aed581;
        border-radius: 6px; padding: 4px 10px; font-size: 12px;
      }
    }
    .detail-section {
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .detail-label {
      font-weight: 500;
      color: #555;
      white-space: nowrap;
    }
    .fields-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
    }
    .fields-table th {
      text-align: left;
      padding: 6px 12px;
      border-bottom: 2px solid #e0e0e0;
      color: #666;
      font-size: 13px;
    }
    .fields-table td {
      padding: 6px 12px;
      border-bottom: 1px solid #f0f0f0;
    }
    .field-name { font-weight: 500; }
    .field-type {
      font-family: monospace;
      color: #1976d2;
    }
    .field-default {
      font-family: monospace;
      color: #888;
    }
    .empty-message {
      color: #888;
      font-style: italic;
      padding: 24px 0;
    }
    .error-message {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      border-radius: 4px;
      background: #fdecea;
      color: #b71c1c;
    }
    .clickable-item { cursor: pointer; }
    .clickable-item:hover { background: rgba(0,0,0,0.04); }
  `],
  imports: [
    CommonModule, RouterModule,
    MatTabsModule, MatCardModule, MatIconModule, MatButtonModule,
    MatChipsModule, MatProgressSpinnerModule, MatListModule, MatExpansionModule
  ]
})
export class ModuleDetailsComponent implements OnInit, OnDestroy {
  moduleId: string | null = null;
  moduleData: ModuleDetail | null = null;
  loading = true;
  error: string | null = null;
  selectedTabIndex = 0;
  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private polariService: PolariService
  ) {}

  ngOnInit(): void {
    this.subscriptions.push(
      this.route.paramMap.subscribe(params => {
        this.moduleId = params.get('moduleId');
        if (this.moduleId) {
          this.loadModule();
        }
      })
    );

    // Handle tab query param
    this.subscriptions.push(
      this.route.queryParamMap.subscribe(qp => {
        const tab = qp.get('tab');
        if (tab) {
          const tabMap: { [key: string]: number } = {
            'overview': 0, 'classes': 1, 'python': 2, 'dependencies': 3
          };
          this.selectedTabIndex = tabMap[tab.toLowerCase()] ?? 0;
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  loadModule(): void {
    if (!this.moduleId) return;
    this.loading = true;
    this.error = null;

    const url = this.polariService.getBackendBaseUrl() + '/modules/' + this.moduleId;
    this.subscriptions.push(
      this.http.get<any>(url, this.polariService.backendRequestOptions).subscribe({
        next: (res: any) => {
          this.loading = false;
          console.log("[Module Details] res from backend for module data: ", res);
          if (res.success) {
            this.moduleData = res.module;
          } else {
            this.error = res.error || 'Failed to load module details';
          }
        },
        error: (err: any) => {
          this.loading = false;
          this.error = 'Request failed: ' + (err.message || err.statusText);
        }
      })
    );
  }

  goBack(): void {
    this.router.navigate(['/module-management']);
  }

  navigateToClass(className: string): void {
    this.router.navigate(['/class-main-page', className]);
  }

  /** tt-10: open one of the module's display pages (pageRoute wins;
   *  seeded pages resolve to /display/<name>). */
  openPage(page: ModulePage): void {
    const route = page.route.startsWith('/')
      ? page.route : `/${page.route}`;
    this.router.navigateByUrl(route);
  }

  navigateToModule(moduleId: string): void {
    this.router.navigate(['/module-details', moduleId]);
  }

  formatDefault(val: any): string {
    if (val === null || val === undefined || val === '') return '-';
    const s = typeof val === 'string' ? val : JSON.stringify(val);
    // Collapse empty collections to readable labels
    if (s === '{}') return '(empty dict)';
    if (s === '[]') return '(empty list)';
    if (s === "''") return "(empty string)";
    return s;
  }
}
