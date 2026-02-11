import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { ApiConfigService } from '@services/api-config.service';
import {
  ApiConfigResponse,
  ApiConfigObject,
  UserGroupInfo,
  UserInfo,
  PermissionSetInfo,
  CRUDEPermissions,
  AccessLevel,
  PermissionUpdateRequest,
  ApiFormatType,
  FormatUpdateRequest
} from '@models/apiConfig';
import { ApiConfigDetailDialogComponent, ApiConfigDetailDialogData } from './api-config-detail-dialog';

/**
 * API Configuration Component
 *
 * Displays all registered tree objects with their CRUDE permissions
 * in a permission matrix layout with four access levels:
 * - General Access
 * - Server Access Only
 * - Role Access (User Groups)
 * - Direct User Access
 *
 * Base/framework objects are read-only. User-created objects can be edited.
 */
@Component({
  standalone: false,
  selector: 'api-config',
  templateUrl: './api-config.html',
  styleUrls: ['./api-config.css']
})
export class ApiConfigComponent implements OnInit, OnDestroy {

  // Data from API
  objects: ApiConfigObject[] = [];
  userGroups: UserGroupInfo[] = [];
  users: UserInfo[] = [];
  permissionSets: PermissionSetInfo[] = [];

  // UI State
  loading: boolean = true;
  error: string | null = null;
  filterText: string = '';
  showBaseObjects: boolean = true;
  showUserCreatedObjects: boolean = true;

  // Edit mode
  editingObject: string | null = null;
  pendingChanges: Map<string, any> = new Map();
  saving: boolean = false;

  // Table columns
  displayedColumns: string[] = ['className', 'type', 'C', 'R', 'U', 'D', 'E', 'actions'];

  // API Formats tab state
  activeTab: number = 0;
  formatColumns: string[] = ['className', 'type', 'polariTree', 'flatJson', 'd3Column'];
  savingFormat: boolean = false;
  formatError: string | null = null;
  editingPrefix: { className: string; format: ApiFormatType } | null = null;
  editingPrefixValue: string = '';

  private subscriptions: Subscription[] = [];

  constructor(private apiConfigService: ApiConfigService, private dialog: MatDialog) {}

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Load API configuration data from backend
   */
  loadData(): void {
    this.loading = true;
    this.error = null;

    const sub = this.apiConfigService.getApiConfig().subscribe({
      next: (response: ApiConfigResponse) => {
        if (response.success) {
          this.objects = response.objects;
          this.userGroups = response.userGroups;
          this.users = response.users;
          this.permissionSets = response.permissionSets;
        } else {
          this.error = response.error || 'Failed to load API configuration';
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('[ApiConfig] Error loading data:', err);
        this.error = err.message || 'Failed to load API configuration';
        this.loading = false;
      }
    });

    this.subscriptions.push(sub);
  }

  /**
   * Refresh data from backend
   */
  refresh(): void {
    this.loadData();
  }

  /**
   * Get filtered objects based on current filters
   */
  get filteredObjects(): ApiConfigObject[] {
    return this.objects.filter(obj => {
      // Filter by text
      if (this.filterText) {
        const searchLower = this.filterText.toLowerCase();
        if (!obj.className.toLowerCase().includes(searchLower)) {
          return false;
        }
      }

      // Filter by type
      if (!this.showBaseObjects && obj.isBaseObject) {
        return false;
      }
      if (!this.showUserCreatedObjects && obj.isUserCreated) {
        return false;
      }

      return true;
    });
  }

  /**
   * Open details dialog for an object
   */
  openDetails(obj: ApiConfigObject): void {
    const dialogData: ApiConfigDetailDialogData = {
      object: obj,
      typeLabel: this.getTypeLabel(obj),
      typeClass: this.getTypeClass(obj),
      crudeSummary: this.getCrudeSummary(obj),
      groupsWithAccess: this.getGroupsWithAccess(obj.className),
      usersWithAccess: this.getUsersWithAccess(obj.className)
    };

    this.dialog.open(ApiConfigDetailDialogComponent, {
      data: dialogData,
      width: '700px',
      maxHeight: '85vh'
    });
  }

  /**
   * Get object type label
   */
  getTypeLabel(obj: ApiConfigObject): string {
    if (obj.isBaseObject || obj.serverAccessOnly) {
      return 'Framework';
    }
    if (obj.isDynamicClass) {
      return 'Dynamic';
    }
    return 'User-Created';
  }

  /**
   * Get CSS class for object type chip
   */
  getTypeClass(obj: ApiConfigObject): string {
    if (obj.isBaseObject || obj.serverAccessOnly) {
      return 'type-framework';
    }
    return 'type-user';
  }

  /**
   * Check if object has a specific CRUDE permission at general level
   */
  hasPermission(obj: ApiConfigObject, operation: keyof CRUDEPermissions): boolean {
    return obj.generalAccess?.crude?.[operation] ?? false;
  }

  /**
   * Get CSS class for permission indicator
   */
  getPermissionClass(obj: ApiConfigObject, operation: keyof CRUDEPermissions): string {
    const hasIt = this.hasPermission(obj, operation);
    if (obj.isBaseObject) {
      return hasIt ? 'permission-readonly' : 'permission-none';
    }
    return hasIt ? 'permission-allowed' : 'permission-denied';
  }

  /**
   * Get permission sets that grant access to this object
   */
  getPermissionSetsForObject(className: string): PermissionSetInfo[] {
    return this.permissionSets.filter(ps => {
      // Check if this permission set grants any access to the class
      const accessQueries = ps.setAccessQueries;
      if (!accessQueries) return false;

      for (const operation of Object.keys(accessQueries)) {
        const objDict = accessQueries[operation];
        if (objDict && className in objDict) {
          return true;
        }
      }
      return false;
    });
  }

  /**
   * Get user groups with permissions for this object
   */
  getGroupsWithAccess(className: string): UserGroupInfo[] {
    const relevantPS = this.getPermissionSetsForObject(className);
    const psNames = relevantPS.map(ps => ps.name);

    return this.userGroups.filter(group =>
      group.permissionSets.some(ps => psNames.includes(ps))
    );
  }

  /**
   * Get users with direct permissions for this object
   */
  getUsersWithAccess(className: string): UserInfo[] {
    const relevantPS = this.getPermissionSetsForObject(className);
    const psNames = relevantPS.map(ps => ps.name);

    return this.users.filter(user =>
      user.assignedPermissionSets.some(ps => psNames.includes(ps))
    );
  }

  /**
   * Start editing permissions for an object
   */
  startEditing(obj: ApiConfigObject): void {
    if (obj.isBaseObject) {
      return; // Cannot edit base objects
    }
    this.editingObject = obj.className;
    // Initialize pending changes with current values
    this.pendingChanges.set(obj.className, {
      general: { ...obj.generalAccess.crude },
      serverOnly: obj.serverAccessOnly
    });
  }

  /**
   * Cancel editing
   */
  cancelEditing(): void {
    this.editingObject = null;
    this.pendingChanges.clear();
  }

  /**
   * Check if currently editing this object
   */
  isEditing(obj: ApiConfigObject): boolean {
    return this.editingObject === obj.className;
  }

  /**
   * Toggle a permission in edit mode
   */
  togglePermission(obj: ApiConfigObject, operation: keyof CRUDEPermissions): void {
    if (!this.isEditing(obj)) return;

    const changes = this.pendingChanges.get(obj.className);
    if (changes?.general) {
      changes.general[operation] = !changes.general[operation];
    }
  }

  /**
   * Get pending permission value
   */
  getPendingPermission(obj: ApiConfigObject, operation: keyof CRUDEPermissions): boolean {
    const changes = this.pendingChanges.get(obj.className);
    return changes?.general?.[operation] ?? this.hasPermission(obj, operation);
  }

  /**
   * Save pending changes
   */
  saveChanges(obj: ApiConfigObject): void {
    if (!this.isEditing(obj)) return;

    const changes = this.pendingChanges.get(obj.className);
    if (!changes) return;

    this.saving = true;

    const request: PermissionUpdateRequest = {
      className: obj.className,
      accessLevel: 'general',
      permissions: {
        create: changes.general.create,
        read: changes.general.read,
        update: changes.general.update,
        delete: changes.general.delete,
        events: changes.general.events
      }
    };

    const sub = this.apiConfigService.updatePermissions(request).subscribe({
      next: (response) => {
        if (response.success) {
          // Refresh data to get updated values
          this.loadData();
          this.editingObject = null;
          this.pendingChanges.clear();
        } else {
          this.error = response.error || 'Failed to save changes';
        }
        this.saving = false;
      },
      error: (err) => {
        console.error('[ApiConfig] Error saving changes:', err);
        this.error = err.message || 'Failed to save changes';
        this.saving = false;
      }
    });

    this.subscriptions.push(sub);
  }

  /**
   * Get summary of CRUDE permissions as string
   */
  getCrudeSummary(obj: ApiConfigObject): string {
    const crude = obj.generalAccess?.crude;
    if (!crude) return '-';

    const parts: string[] = [];
    if (crude.create) parts.push('C');
    if (crude.read) parts.push('R');
    if (crude.update) parts.push('U');
    if (crude.delete) parts.push('D');
    if (crude.events) parts.push('E');

    return parts.length > 0 ? parts.join('') : 'None';
  }

  // ===== API Formats Tab Methods =====

  onTabChange(event: any): void {
    this.activeTab = event.index;
  }

  isFormatEnabled(obj: ApiConfigObject, format: ApiFormatType): boolean {
    return obj.apiFormats?.[format]?.enabled ?? false;
  }

  getFormatEndpoint(obj: ApiConfigObject, format: ApiFormatType): string | null {
    return obj.apiFormats?.[format]?.endpoint ?? null;
  }

  getFormatPrefix(obj: ApiConfigObject, format: ApiFormatType): string | null {
    return obj.apiFormats?.[format]?.prefix ?? null;
  }

  getFormatLabel(format: ApiFormatType): string {
    switch (format) {
      case 'polariTree': return 'Polari Tree (CRUDE)';
      case 'flatJson': return 'Flat JSON (REST)';
      case 'd3Column': return 'D3 Column Series';
    }
  }

  getFormatIcon(format: ApiFormatType): string {
    switch (format) {
      case 'polariTree': return 'account_tree';
      case 'flatJson': return 'data_object';
      case 'd3Column': return 'bar_chart';
    }
  }

  toggleFormat(obj: ApiConfigObject, format: ApiFormatType): void {
    if (obj.isBaseObject || format === 'polariTree') return;

    this.savingFormat = true;
    this.formatError = null;

    const request: FormatUpdateRequest = {
      className: obj.className,
    };

    if (format === 'flatJson') {
      request.flatJson = !this.isFormatEnabled(obj, 'flatJson');
    } else if (format === 'd3Column') {
      request.d3Column = !this.isFormatEnabled(obj, 'd3Column');
    }

    const sub = this.apiConfigService.updateFormats(request).subscribe({
      next: (response) => {
        if (response.success) {
          this.loadData();
        } else {
          this.formatError = response.error || 'Failed to update format';
        }
        this.savingFormat = false;
      },
      error: (err) => {
        console.error('[ApiConfig] Error updating format:', err);
        this.formatError = err.error?.error || err.message || 'Failed to update format';
        this.savingFormat = false;
      }
    });
    this.subscriptions.push(sub);
  }

  startEditingPrefix(obj: ApiConfigObject, format: ApiFormatType): void {
    if (obj.isBaseObject || format === 'polariTree') return;
    this.editingPrefix = { className: obj.className, format };
    this.editingPrefixValue = this.getFormatPrefix(obj, format) || '';
  }

  cancelEditingPrefix(): void {
    this.editingPrefix = null;
    this.editingPrefixValue = '';
  }

  isEditingPrefix(obj: ApiConfigObject, format: ApiFormatType): boolean {
    return this.editingPrefix?.className === obj.className && this.editingPrefix?.format === format;
  }

  savePrefix(obj: ApiConfigObject, format: ApiFormatType): void {
    if (!this.editingPrefix) return;

    this.savingFormat = true;
    this.formatError = null;

    const request: FormatUpdateRequest = {
      className: obj.className,
    };

    if (format === 'flatJson') {
      request.flatJsonPrefix = this.editingPrefixValue;
      // Re-enable to re-register with new prefix
      if (this.isFormatEnabled(obj, 'flatJson')) {
        request.flatJson = true;
      }
    } else if (format === 'd3Column') {
      request.d3ColumnPrefix = this.editingPrefixValue;
      if (this.isFormatEnabled(obj, 'd3Column')) {
        request.d3Column = true;
      }
    }

    const sub = this.apiConfigService.updateFormats(request).subscribe({
      next: (response) => {
        if (response.success) {
          this.loadData();
          this.editingPrefix = null;
          this.editingPrefixValue = '';
        } else {
          this.formatError = response.error || 'Failed to update prefix';
        }
        this.savingFormat = false;
      },
      error: (err) => {
        console.error('[ApiConfig] Error updating prefix:', err);
        this.formatError = err.error?.error || err.message || 'Failed to update prefix';
        this.savingFormat = false;
      }
    });
    this.subscriptions.push(sub);
  }
}
