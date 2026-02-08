import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ApiConfigObject, CRUDEPermissions } from '@models/apiConfig';

export interface ApiConfigDetailDialogData {
  object: ApiConfigObject;
  typeLabel: string;
  typeClass: string;
  crudeSummary: string;
  groupsWithAccess: { name: string; userCount: number }[];
  usersWithAccess: { username: string }[];
}

@Component({
  selector: 'api-config-detail-dialog',
  template: `
    <h2 mat-dialog-title>
      {{ data.object.className }}
      <span class="type-chip" [ngClass]="data.typeClass">{{ data.typeLabel }}</span>
    </h2>

    <mat-dialog-content>
      <!-- General Access -->
      <div class="access-section">
        <h3>
          <mat-icon>public</mat-icon>
          General Access (Base Permissions)
        </h3>
        <div class="permission-summary">
          <span>CRUDE: <strong>{{ data.crudeSummary }}</strong></span>
        </div>
      </div>

      <!-- Server Access -->
      <div class="access-section">
        <h3>
          <mat-icon>dns</mat-icon>
          Server Access Only
        </h3>
        <div class="permission-summary">
          <span *ngIf="data.object.serverAccessOnly">
            <mat-icon class="status-icon enabled">check_circle</mat-icon>
            This object is only accessible by the server internally
          </span>
          <span *ngIf="!data.object.serverAccessOnly">
            <mat-icon class="status-icon disabled">cancel</mat-icon>
            External API access is allowed
          </span>
        </div>
      </div>

      <!-- Role Access -->
      <div class="access-section">
        <h3>
          <mat-icon>group</mat-icon>
          Role Access (User Groups)
        </h3>
        <div class="groups-list" *ngIf="data.groupsWithAccess.length > 0">
          <div *ngFor="let group of data.groupsWithAccess" class="group-item">
            <mat-icon>people</mat-icon>
            <span class="group-name">{{ group.name }}</span>
            <span class="user-count">({{ group.userCount }} users)</span>
          </div>
        </div>
        <p *ngIf="data.groupsWithAccess.length === 0" class="no-access">
          No user groups have specific permissions for this object
        </p>
      </div>

      <!-- Direct User Access -->
      <div class="access-section">
        <h3>
          <mat-icon>person</mat-icon>
          Direct User Access
        </h3>
        <div class="users-list" *ngIf="data.usersWithAccess.length > 0">
          <div *ngFor="let user of data.usersWithAccess" class="user-item">
            <mat-icon>person</mat-icon>
            <span class="username">{{ user.username }}</span>
          </div>
        </div>
        <p *ngIf="data.usersWithAccess.length === 0" class="no-access">
          No users have direct permissions for this object
        </p>
      </div>

      <!-- Variable-Level CRUD Permissions -->
      <div class="access-section" *ngIf="data.object.variables && data.object.variables.length > 0">
        <h3>
          <mat-icon>code</mat-icon>
          Variable-Level Permissions ({{ data.object.variables.length }})
        </h3>
        <div class="compact-table">
          <div class="compact-header">
            <span class="col-name">Variable</span>
            <span class="col-type">Type</span>
            <span class="col-crud">C</span>
            <span class="col-crud">R</span>
            <span class="col-crud">U</span>
          </div>
          <div *ngFor="let variable of data.object.variables" class="compact-row">
            <span class="col-name">
              {{ variable.name }}
              <mat-icon *ngIf="variable.isIdentifier" class="mini-icon id" matTooltip="Identifier (read-only)">key</mat-icon>
              <mat-icon *ngIf="variable.isRequired" class="mini-icon required" matTooltip="Required">star</mat-icon>
            </span>
            <span class="col-type">{{ variable.type }}</span>
            <span class="col-crud">
              <mat-icon [class]="variable.crud?.create ? 'perm-yes' : 'perm-no'">
                {{ variable.crud?.create ? 'check' : 'close' }}
              </mat-icon>
            </span>
            <span class="col-crud">
              <mat-icon [class]="variable.crud?.read ? 'perm-yes' : 'perm-no'">
                {{ variable.crud?.read ? 'check' : 'close' }}
              </mat-icon>
            </span>
            <span class="col-crud">
              <mat-icon [class]="variable.crud?.update ? 'perm-yes' : 'perm-no'">
                {{ variable.crud?.update ? 'check' : 'close' }}
              </mat-icon>
            </span>
          </div>
        </div>
      </div>

      <!-- Event-Level Permissions -->
      <div class="access-section" *ngIf="data.object.events && data.object.events.length > 0">
        <h3>
          <mat-icon>bolt</mat-icon>
          Event-Level Permissions ({{ data.object.events.length }})
        </h3>
        <div class="compact-table">
          <div class="compact-header">
            <span class="col-name">Event/Method</span>
            <span class="col-access">Accessible</span>
            <span class="col-auth">Auth Required</span>
          </div>
          <div *ngFor="let event of data.object.events" class="compact-row">
            <span class="col-name">{{ event.name }}</span>
            <span class="col-access">
              <mat-icon [class]="event.accessible ? 'perm-yes' : 'perm-no'">
                {{ event.accessible ? 'check' : 'close' }}
              </mat-icon>
            </span>
            <span class="col-auth">
              <mat-icon [class]="event.requiresAuth ? 'perm-auth' : 'perm-no-auth'">
                {{ event.requiresAuth ? 'lock' : 'lock_open' }}
              </mat-icon>
            </span>
          </div>
        </div>
      </div>

      <!-- Read-Only Notice -->
      <div class="readonly-notice" *ngIf="data.object.isBaseObject">
        <mat-icon>lock</mat-icon>
        <span>This is a framework object. Permissions cannot be modified.</span>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2[mat-dialog-title] {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 0;
      padding: 16px 24px;
    }

    mat-dialog-content {
      max-height: 70vh;
      padding: 0 24px;
    }

    .type-chip {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 500;
    }

    .type-framework { background: #e3f2fd; color: #1565c0; }
    .type-server { background: #fff3e0; color: #e65100; }
    .type-user { background: #e8f5e9; color: #2e7d32; }

    .access-section {
      margin: 16px 0;
      padding: 15px;
      background: #fafafa;
      border-radius: 8px;
    }

    .access-section h3 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 12px;
      font-size: 1rem;
      color: #333;
    }

    .access-section h3 mat-icon { color: #666; }

    .permission-summary { font-size: 0.95rem; color: #555; }

    .status-icon { vertical-align: middle; margin-right: 5px; }
    .status-icon.enabled { color: #4caf50; }
    .status-icon.disabled { color: #f44336; }

    .groups-list, .users-list {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .group-item, .user-item {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 6px 12px;
      background: white;
      border-radius: 20px;
      border: 1px solid #e0e0e0;
      font-size: 0.9rem;
    }

    .group-item mat-icon, .user-item mat-icon { font-size: 18px; color: #666; }
    .user-count { color: #888; font-size: 0.8rem; }
    .no-access { color: #888; font-style: italic; margin: 0; }

    .compact-table {
      width: 100%;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      overflow: hidden;
    }

    .compact-header {
      display: flex;
      align-items: center;
      background: #f5f5f5;
      padding: 8px 12px;
      font-weight: 600;
      font-size: 0.8rem;
      color: #333;
      border-bottom: 1px solid #e0e0e0;
    }

    .compact-row {
      display: flex;
      align-items: center;
      padding: 6px 12px;
      border-bottom: 1px solid #f0f0f0;
      font-size: 0.85rem;
    }

    .compact-row:last-child { border-bottom: none; }
    .compact-row:hover { background: #fafafa; }

    .col-name {
      flex: 2;
      display: flex;
      align-items: center;
      gap: 4px;
      font-weight: 500;
    }

    .col-type {
      flex: 1;
      color: #666;
      font-family: monospace;
      font-size: 0.8rem;
    }

    .col-crud { width: 40px; text-align: center; }
    .col-access, .col-auth { width: 80px; text-align: center; }

    .perm-yes { color: #4caf50; font-size: 18px; }
    .perm-no { color: #f44336; font-size: 18px; }
    .perm-auth { color: #ff9800; font-size: 18px; }
    .perm-no-auth { color: #9e9e9e; font-size: 18px; }

    .mini-icon { font-size: 14px !important; width: 14px !important; height: 14px !important; }
    .mini-icon.id { color: #ff9800; }
    .mini-icon.required { color: #f44336; }

    .readonly-notice {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 15px;
      background: #fff3e0;
      border-radius: 4px;
      color: #e65100;
      margin-top: 16px;
    }

    .readonly-notice mat-icon { color: #ff9800; }
  `]
})
export class ApiConfigDetailDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ApiConfigDetailDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ApiConfigDetailDialogData
  ) {}
}
