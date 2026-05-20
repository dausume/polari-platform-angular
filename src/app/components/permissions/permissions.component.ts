import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

import { AuthTestTabComponent } from './auth-test-tab/auth-test-tab.component';
import { RolesTabComponent } from './roles-tab/roles-tab.component';
import { ObjectPermissionsTabComponent } from './object-permissions-tab/object-permissions-tab.component';
import { AdminTabComponent } from './admin-tab/admin-tab.component';

/**
 * Permissions hub.
 *
 * Top-level tabs (mirrors class-main-page's mat-tab-group pattern):
 *   - Authentication Test (Phase 1)
 *   - Roles (Phase 2) — table + click-through to /permissions/roles/:name
 *   - Object Permissions (Phase 2) — caller's effective CRUDE matrix
 *
 * Phase 3 will add inline grant editing in both tabs.
 */
@Component({
  standalone: true,
  selector: 'permissions-page',
  imports: [
    CommonModule, MatTabsModule, MatCardModule, MatIconModule,
    AuthTestTabComponent, RolesTabComponent, ObjectPermissionsTabComponent,
    AdminTabComponent,
  ],
  template: `
    <mat-tab-group [selectedIndex]="selectedTabIndex"
                   (selectedIndexChange)="onTabChange($event)">

      <mat-tab label="Authentication Test">
        <auth-test-tab></auth-test-tab>
      </mat-tab>

      <mat-tab label="Roles">
        <roles-tab></roles-tab>
      </mat-tab>

      <mat-tab label="Object Permissions">
        <object-permissions-tab></object-permissions-tab>
      </mat-tab>

      <mat-tab label="Admin">
        <admin-tab></admin-tab>
      </mat-tab>

    </mat-tab-group>
  `,
  styles: [`
    :host { display: block; padding: 16px; }
  `]
})
export class PermissionsComponent {
  selectedTabIndex = 0;

  onTabChange(idx: number): void {
    this.selectedTabIndex = idx;
  }
}
