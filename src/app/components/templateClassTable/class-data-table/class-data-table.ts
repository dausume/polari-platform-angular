// class-data-table.component.ts
import { Component, Input, Output, EventEmitter, OnInit, ViewChild, OnChanges, SimpleChanges } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { MatDialog } from '@angular/material/dialog';
import { HttpClient } from '@angular/common/http';
import { TableConfig } from '@models/tableConfiguration';
import { NamedTableConfig } from '@models/tables/NamedTableConfig';
import { InstanceActionButton, DatasetActionButton } from '@models/tables/TableActionButton';
import { getSvgIcon } from '@models/shared/SvgIconLibrary';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { classPolyTyping } from '@models/polyTyping/classPolyTyping';
import { variablePolyTyping } from '@models/polyTyping/variablePolyTyping';
import { RuntimeConfigService } from '@services/runtime-config.service';
import { getFieldTypeIcon } from '@models/shared/PolariFieldType';
import { ClassTypingService } from '@services/class-typing-service';
import { SolutionExecutionService } from '@services/no-code-services/solution-execution.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CrudDialogComponent } from '@components/shared/crud-dialog/crud-dialog';
import { CrudDialogData, CrudDialogResult, VariableDefinition } from '@components/shared/models/crud-config.models';

@Component({
  standalone: false,
  selector: 'class-data-table',
  templateUrl: 'class-data-table.html',
  styleUrls: ['./class-data-table.css']
})
export class ClassDataTableComponent implements OnInit, OnChanges {
  @Input() className?: string;
  @Input() classTypeData: any = {};
  @Input() instanceData: any[] = [];
  @Input() tableConfig?: TableConfig;
  @Input() namedTableConfig?: NamedTableConfig;
  @Output() instanceCreated = new EventEmitter<any>();
  @Output() instanceUpdated = new EventEmitter<any>();
  @Output() instanceDeleted = new EventEmitter<string>();

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  dataSource: MatTableDataSource<any>;
  displayedColumns: string[] = [];
  dataColumns: string[] = [];  // Columns excluding _actions
  columnTypes: { [key: string]: string } = {};
  availableColumns: string[] = [];  // Cached list of all available columns (for template)

  // Permission flags based on class configuration
  // These control whether CRUD actions are shown in the UI
  canCreate: boolean = false;
  canEdit: boolean = false;
  canDelete: boolean = false;

  // Wrapped row mode
  wrappedMode: boolean = false;
  wrappedColumnGroups: string[][] = [];
  separatorClass: string = 'separator-thick';

  // Action buttons from named config
  instanceActions: InstanceActionButton[] = [];
  datasetActions: DatasetActionButton[] = [];
  executingActions: Set<string> = new Set();

  // Table options menu state
  showOptionsMenu: boolean = false;

  constructor(
    private dialog: MatDialog,
    private http: HttpClient,
    private runtimeConfig: RuntimeConfigService,
    private classTypingService: ClassTypingService,
    private executionService: SolutionExecutionService,
    private snackBar: MatSnackBar,
    private sanitizer: DomSanitizer
  ) {
    this.dataSource = new MatTableDataSource<any>([]);
  }

  ngOnInit() {
    this.initializeTable();
  }

  ngOnChanges(changes: SimpleChanges) {
    // Handle className changes - completely reinitialize
    if (changes.className && !changes.className.firstChange) {
      // Clear old state
      this.columnTypes = {};
      this.displayedColumns = [];
      this.availableColumns = [];
      this.dataSource.data = [];
    }

    // Reinitialize table when any input changes
    if (changes.classTypeData || changes.instanceData || changes.tableConfig || changes.className || changes.namedTableConfig) {
      this.initializeTable();
    }
  }

  initializeTable() {
    // Load or create table configuration
    if (!this.tableConfig && this.className) {
      this.tableConfig = TableConfig.load(this.className);
    }

    // Check permissions from ClassTypingService based on class configuration
    // This determines whether Create/Edit/Delete buttons are shown
    if (this.className) {
      this.canCreate = this.classTypingService.canCreateInstances(this.className);
      this.canEdit = this.classTypingService.canEditInstances(this.className);
      this.canDelete = this.classTypingService.canDeleteInstances(this.className);

      // console.log(`[ClassDataTable] Permissions for ${this.className}: create=${this.canCreate}, edit=${this.canEdit}, delete=${this.canDelete}`);
    }

    // Named table config takes precedence over legacy tableConfig
    if (this.namedTableConfig) {
      this.initializeFromNamedConfig();

      // Apply CRUD permission overrides from the named config
      const perms = this.namedTableConfig.crudPermissions;
      if (perms) {
        this.canCreate = this.canCreate && perms.allowCreate;
        this.canEdit = this.canEdit && perms.allowEdit;
        this.canDelete = this.canDelete && perms.allowDelete;
      }

      // Load action buttons
      this.instanceActions = this.namedTableConfig.instanceActions || [];
      this.datasetActions = this.namedTableConfig.datasetActions || [];
    } else {
      this.initializeFromLegacyConfig();
      this.instanceActions = [];
      this.datasetActions = [];
    }

    // Add actions column at the end only if there are any actions available
    const hasAnyActions = this.canEdit || this.canDelete || this.instanceActions.length > 0;
    if (hasAnyActions && !this.displayedColumns.includes('_actions')) {
      this.displayedColumns.push('_actions');
    } else if (!hasAnyActions && this.displayedColumns.includes('_actions')) {
      const actionsIndex = this.displayedColumns.indexOf('_actions');
      if (actionsIndex >= 0) {
        this.displayedColumns.splice(actionsIndex, 1);
      }
    }

    // Set dataColumns (excluding _actions) for template binding
    this.dataColumns = this.displayedColumns.filter(col => col !== '_actions');

    // Update cached availableColumns for template (avoids method call on every change detection)
    this.availableColumns = this.getAllColumns();

    // Set data source
    if (this.instanceData && this.instanceData.length > 0) {
      this.dataSource.data = this.instanceData;
    } else {
      this.dataSource.data = [];
    }

    // Apply sort and paginator after view init
    setTimeout(() => {
      if (this.sort) {
        this.dataSource.sort = this.sort;
      }
      if (this.paginator) {
        this.dataSource.paginator = this.paginator;
        if (this.namedTableConfig) {
          this.paginator.pageSize = this.namedTableConfig.tableConfiguration.pagination.pageSize;
        }
      }
    });
  }

  private initializeFromNamedConfig(): void {
    const tc = this.namedTableConfig!.tableConfiguration;

    // Build column types from classTypeData or existing columns
    if (this.classTypeData && Object.keys(this.classTypeData).length > 0) {
      Object.keys(this.classTypeData).forEach(key => {
        if (this.classTypeData[key]?.variablePythonType) {
          this.columnTypes[key] = this.classTypeData[key].variablePythonType;
        }
      });
    }

    // Get visible column names from the TableConfiguration
    const visibleNames = tc.getVisibleColumnNames();
    if (visibleNames.length > 0) {
      this.displayedColumns = [...visibleNames];
    } else {
      // Fallback to all non-removed columns
      const allKeys = Object.keys(this.columnTypes);
      this.displayedColumns = allKeys.filter(k => !tc.removedColumns.includes(k));
    }

    // Wrapped mode
    const rw = this.namedTableConfig!.rowWrapping;
    this.wrappedMode = rw.enabled;
    if (this.wrappedMode) {
      this.buildWrappedColumnGroups(rw.fieldsPerRow);
      this.separatorClass = 'separator-' + rw.separatorStyle;
    } else {
      this.wrappedColumnGroups = [];
    }
  }

  private initializeFromLegacyConfig(): void {
    let keys: string[] = [];

    if (this.classTypeData && Object.keys(this.classTypeData).length > 0) {
      keys = Object.keys(this.classTypeData);
      keys.forEach(key => {
        if (this.classTypeData[key]?.variablePythonType) {
          this.columnTypes[key] = this.classTypeData[key].variablePythonType;
        }
      });
    } else if (this.instanceData && this.instanceData.length > 0) {
      const firstInstance = this.instanceData[0];
      keys = Object.keys(firstInstance);
      keys.forEach(key => {
        const value = firstInstance[key];
        let inferredType = 'str';
        if (typeof value === 'number') {
          inferredType = Number.isInteger(value) ? 'int' : 'float';
        } else if (typeof value === 'boolean') {
          inferredType = 'bool';
        } else if (Array.isArray(value)) {
          inferredType = 'list';
        } else if (value && typeof value === 'object') {
          inferredType = 'dict';
        }
        this.columnTypes[key] = inferredType;
      });
    }

    const removedColumns = this.tableConfig?.removedColumns || [];
    const availableKeys = keys.filter(key => !removedColumns.includes(key));

    if (availableKeys.length > 0) {
      if (this.tableConfig?.visibleColumns && this.tableConfig.visibleColumns.length > 0) {
        const configuredColumns = this.tableConfig.visibleColumns.filter(col =>
          availableKeys.includes(col)
        );
        if (configuredColumns.length > 0) {
          this.displayedColumns = configuredColumns;
        } else {
          this.displayedColumns = [...availableKeys];
        }
      } else {
        this.displayedColumns = [...availableKeys];
      }

      if (this.tableConfig?.sortOrder === 'alphabetical') {
        this.displayedColumns.sort((a, b) => {
          const comparison = a.localeCompare(b);
          return this.tableConfig!.sortDirection === 'asc' ? comparison : -comparison;
        });
      }
    }

    this.wrappedMode = false;
    this.wrappedColumnGroups = [];
  }

  private buildWrappedColumnGroups(fieldsPerRow: number): void {
    const cols = this.displayedColumns.filter(c => c !== '_actions');
    this.wrappedColumnGroups = [];
    for (let i = 0; i < cols.length; i += fieldsPerRow) {
      this.wrappedColumnGroups.push(cols.slice(i, i + fieldsPerRow));
    }
  }

  /**
   * Get all available columns (excluding removed ones)
   */
  getAllColumns(): string[] {
    const allColumns = Object.keys(this.columnTypes);
    const removedColumns = this.tableConfig?.removedColumns || [];
    return allColumns.filter(col => !removedColumns.includes(col));
  }

  /**
   * Get the display name for a column (formatted from camelCase)
   */
  getColumnDisplayName(columnName: string): string {
    // Convert camelCase to readable format
    return columnName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  /**
   * Get the type for a column
   */
  getColumnType(columnName: string): string {
    return this.columnTypes[columnName] || 'unknown';
  }

  /**
   * Get type icon for display
   */
  getTypeIcon(type: string): string {
    return getFieldTypeIcon(type);
  }

  /**
   * Apply filter to table
   */
  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  /**
   * Toggle column visibility
   */
  toggleColumn(columnName: string) {
    const index = this.displayedColumns.indexOf(columnName);
    if (index >= 0) {
      this.displayedColumns.splice(index, 1);
    } else {
      this.displayedColumns.push(columnName);
      // Re-sort if alphabetical order is enabled
      if (this.tableConfig?.sortOrder === 'alphabetical') {
        this.displayedColumns.sort((a, b) => {
          const comparison = a.localeCompare(b);
          return this.tableConfig!.sortDirection === 'asc' ? comparison : -comparison;
        });
      }
    }

    // Create a new array reference to trigger change detection
    this.displayedColumns = [...this.displayedColumns];
    // Update dataColumns to match
    this.dataColumns = this.displayedColumns.filter(col => col !== '_actions');

    // Save configuration
    if (this.tableConfig) {
      this.tableConfig.visibleColumns = [...this.displayedColumns];
      this.saveConfiguration();
    }
  }

  /**
   * Check if column is visible
   */
  isColumnVisible(columnName: string): boolean {
    return this.displayedColumns.includes(columnName);
  }

  /**
   * Save configuration
   */
  saveConfiguration() {
    if (this.tableConfig && this.className) {
      this.tableConfig.save(this.className);
    }
  }

  /**
   * Format cell value for display
   */
  formatCellValue(value: any, type: string): string {
    if (value === null || value === undefined) {
      return '-';
    }

    // Handle different types
    switch (type?.toLowerCase()) {
      case 'bool':
      case 'boolean':
        return value ? 'Yes' : 'No';
      case 'date':
      case 'datetime':
        return new Date(value).toLocaleString();
      case 'list':
      case 'polarilist':
        return Array.isArray(value) ? `[${value.length} items]` : String(value);
      case 'dict':
      case 'object':
      case 'polaridict':
        return typeof value === 'object' ? `{${Object.keys(value).length} keys}` : String(value);
      default:
        return String(value);
    }
  }

  /**
   * Get data columns (excluding _actions)
   */
  getDataColumns(): string[] {
    return this.displayedColumns.filter(col => col !== '_actions');
  }

  /**
   * Build schema from classTypeData or columnTypes for the dialog
   * Uses classTypeData if it has proper structure, otherwise falls back to columnTypes
   */
  private getSchema(): VariableDefinition[] {
    const schema: VariableDefinition[] = [];

    // Check if classTypeData has proper structure (has variablePythonType on first key)
    const classTypeKeys = Object.keys(this.classTypeData || {});
    const hasProperStructure = classTypeKeys.length > 0 &&
      classTypeKeys.some(key => this.classTypeData[key]?.variablePythonType);

    if (hasProperStructure) {
      // Use classTypeData with variablePythonType
      classTypeKeys.forEach(key => {
        const varData = this.classTypeData[key];
        if (varData?.variablePythonType) {
          const pyType = varData.variablePythonType;
          // Get referenced class name: from explicit refClass property,
          // or extract from CLASS-ClassName-REFERENCE pattern
          let refClass: string | undefined = varData.refClass;
          if (!refClass && typeof pyType === 'string' && pyType.startsWith('CLASS-') && pyType.endsWith('-REFERENCE')) {
            const match = pyType.match(/^CLASS-(.+)-REFERENCE$/);
            if (match) refClass = match[1];
          }
          schema.push({
            varName: key,
            varDisplayName: varData?.displayName || this.getColumnDisplayName(key),
            varType: varData.variablePythonType,
            isIdentifier: key === 'id',
            required: key === 'id',
            refClass
          });
        }
      });
    } else {
      // Fallback: Use columnTypes (derived from instanceData)
      const columnKeys = Object.keys(this.columnTypes);
      columnKeys.forEach(key => {
        schema.push({
          varName: key,
          varDisplayName: this.getColumnDisplayName(key),
          varType: this.columnTypes[key] || 'str',
          isIdentifier: key === 'id',
          required: key === 'id'
        });
      });
    }

    return schema;
  }

  /**
   * Open create dialog
   */
  openCreateDialog(): void {
    const dialogData: CrudDialogData = {
      mode: 'create',
      className: this.className || 'Unknown',
      classDisplayName: this.className || 'Unknown',
      schema: this.getSchema(),
      hiddenFields: ['id'] // Hide id field for create (auto-generated)
    };

    const dialogRef = this.dialog.open(CrudDialogComponent, {
      data: dialogData,
      width: '600px',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe((result: CrudDialogResult) => {
      // console.log('[ClassDataTable] Dialog closed with result:', result);
      if (result?.action === 'save' && result.data) {
        // console.log('[ClassDataTable] Adding new instance to table:', result.data);
        // console.log('[ClassDataTable] Instance keys:', Object.keys(result.data));
        // console.log('[ClassDataTable] Current dataSource.data length:', this.dataSource.data.length);
        // Add to data source
        this.dataSource.data = [...this.dataSource.data, result.data];
        // console.log('[ClassDataTable] New dataSource.data length:', this.dataSource.data.length);
        // console.log('[ClassDataTable] New dataSource.data:', this.dataSource.data);
        this.instanceCreated.emit(result.data);
      }
    });
  }

  /**
   * Open edit dialog
   */
  openEditDialog(row: any): void {
    const dialogData: CrudDialogData = {
      mode: 'edit',
      className: this.className || 'Unknown',
      classDisplayName: this.className || 'Unknown',
      schema: this.getSchema(),
      instance: row,
      readOnlyFields: ['id'] // ID is read-only in edit mode
    };

    const dialogRef = this.dialog.open(CrudDialogComponent, {
      data: dialogData,
      width: '600px',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe((result: CrudDialogResult) => {
      const rowId = this.getInstanceId(row);

      if (result?.action === 'save' && result.data) {
        // Update in data source
        const index = this.dataSource.data.findIndex(r =>
          this.getInstanceId(r) === rowId
        );
        if (index >= 0) {
          this.dataSource.data[index] = result.data;
          this.dataSource.data = [...this.dataSource.data];
        }
        this.instanceUpdated.emit(result.data);
      } else if (result?.action === 'delete') {
        // Remove from data source
        const index = this.dataSource.data.findIndex(r =>
          this.getInstanceId(r) === rowId
        );
        if (index >= 0) {
          this.dataSource.data.splice(index, 1);
          this.dataSource.data = [...this.dataSource.data];
        }
        this.instanceDeleted.emit(rowId);
      }
    });
  }

  /**
   * Extract instance ID from row data.
   * Checks multiple common ID field names used by different backends.
   */
  private getInstanceId(row: any): string | undefined {
    // Check common ID field names in order of preference
    const idFields = ['id', '_instanceId', '_id', 'Id', 'ID', 'instanceId'];
    for (const field of idFields) {
      if (row[field] !== undefined && row[field] !== null) {
        return String(row[field]);
      }
    }
    // Log warning with row keys to help debug
    console.warn('[ClassDataTable] Could not find ID field in row. Available fields:', Object.keys(row));
    console.warn('[ClassDataTable] Row data:', row);
    return undefined;
  }

  /**
   * Execute an instance-level action button (per-row).
   * Maps instance fields to solution input params and launches the solution.
   */
  executeInstanceAction(action: InstanceActionButton, row: any): void {
    if (!action.solutionName) {
      this.snackBar.open('No solution configured for this action', 'OK', { duration: 3000 });
      return;
    }

    const actionKey = `${action.id}_${this.getInstanceId(row)}`;
    if (this.executingActions.has(actionKey)) return;

    const inputParams: Record<string, any> = {};
    if (action.paramMappings.length > 0) {
      for (const mapping of action.paramMappings) {
        inputParams[mapping.solutionParam] = row[mapping.instanceField];
      }
    } else {
      // Default: pass the entire row as 'instance'
      inputParams['instance'] = row;
    }

    this.executingActions.add(actionKey);
    this.snackBar.open(`Running "${action.label}"...`, '', { duration: 2000 });

    this.executionService.startExecution(
      action.solutionName,
      inputParams,
      action.targetRuntime || 'python_backend',
      { mode: 'step', recordContext: true }
    ).subscribe({
      next: (trace: any) => {
        this.executingActions.delete(actionKey);
        const status = trace?.trace?.status || trace?.status || 'completed';
        if (status === 'completed') {
          this.snackBar.open(`"${action.label}" completed successfully`, 'OK', { duration: 4000 });
        } else if (status === 'errored') {
          const errMsg = trace?.trace?.errorSummary || trace?.errorSummary || 'Unknown error';
          this.snackBar.open(`"${action.label}" failed: ${errMsg}`, 'OK', { duration: 6000 });
        }
      },
      error: (err: any) => {
        this.executingActions.delete(actionKey);
        console.error('[ClassDataTable] Action execution error:', err);
        this.snackBar.open(`"${action.label}" failed: ${err.message || 'Unknown error'}`, 'OK', { duration: 6000 });
      }
    });
  }

  /**
   * Execute a dataset-level action button (table-level).
   * Passes the filtered or full dataset to the solution.
   */
  executeDatasetAction(action: DatasetActionButton): void {
    if (!action.solutionName) {
      this.snackBar.open('No solution configured for this action', 'OK', { duration: 3000 });
      return;
    }

    if (this.executingActions.has(action.id)) return;

    const dataset = action.includeFilteredOnly
      ? this.dataSource.filteredData
      : this.dataSource.data;

    const inputParams: Record<string, any> = {
      dataset: dataset
    };

    this.executingActions.add(action.id);
    this.snackBar.open(`Running "${action.label}" on ${dataset.length} records...`, '', { duration: 2000 });

    this.executionService.startExecution(
      action.solutionName,
      inputParams,
      action.targetRuntime || 'python_backend',
      { mode: 'step', recordContext: true }
    ).subscribe({
      next: (trace: any) => {
        this.executingActions.delete(action.id);
        const status = trace?.trace?.status || trace?.status || 'completed';
        if (status === 'completed') {
          this.snackBar.open(`"${action.label}" completed successfully`, 'OK', { duration: 4000 });
        } else {
          const errMsg = trace?.trace?.errorSummary || trace?.errorSummary || 'Unknown error';
          this.snackBar.open(`"${action.label}" failed: ${errMsg}`, 'OK', { duration: 6000 });
        }
      },
      error: (err: any) => {
        this.executingActions.delete(action.id);
        console.error('[ClassDataTable] Dataset action error:', err);
        this.snackBar.open(`"${action.label}" failed: ${err.message || 'Unknown error'}`, 'OK', { duration: 6000 });
      }
    });
  }

  /** Get the sanitized SVG HTML for an icon name from the shared library */
  getActionIconSvg(iconName: string): SafeHtml {
    const icon = getSvgIcon(iconName);
    if (icon) {
      return this.sanitizer.bypassSecurityTrustHtml(icon.svgString);
    }
    // Fallback: default play icon
    const fallback = getSvgIcon('play');
    return this.sanitizer.bypassSecurityTrustHtml(fallback?.svgString || '');
  }

  /** Check if an action is currently executing */
  isActionExecuting(actionId: string, row?: any): boolean {
    if (row) {
      return this.executingActions.has(`${actionId}_${this.getInstanceId(row)}`);
    }
    return this.executingActions.has(actionId);
  }

  /**
   * Confirm and delete an instance
   * Polari backend expects multipart form data with targetInstance field
   * containing a query dict to identify the instance (e.g., {"id": "someId"})
   */
  confirmDelete(row: any): void {
    const instanceId = this.getInstanceId(row);

    if (!instanceId) {
      alert('Cannot delete: Unable to determine instance ID. Check console for details.');
      return;
    }

    const confirmDelete = confirm(`Are you sure you want to delete this ${this.className} instance?`);

    if (confirmDelete) {
      const backendUrl = this.runtimeConfig.getBackendBaseUrl();
      const multipartData = new FormData();
      multipartData.append('targetInstance', JSON.stringify({ id: instanceId }));

      this.http.request('DELETE', `${backendUrl}/${this.className}`, { body: multipartData })
        .subscribe({
          next: () => {
            // Remove from data source
            const index = this.dataSource.data.findIndex(r =>
              this.getInstanceId(r) === instanceId
            );
            if (index >= 0) {
              this.dataSource.data.splice(index, 1);
              this.dataSource.data = [...this.dataSource.data];
            }
            this.instanceDeleted.emit(instanceId);
          },
          error: (error) => {
            console.error('[ClassDataTable] Delete failed:', error);
            alert('Failed to delete instance: ' + (error.error?.error || error.message));
          }
        });
    }
  }
}
