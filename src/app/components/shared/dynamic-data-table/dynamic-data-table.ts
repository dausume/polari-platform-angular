// dynamic-data-table.ts
import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { MatDialog } from '@angular/material/dialog';
import { HttpClient } from '@angular/common/http';
import { Store } from '@ngrx/store';
import { Subject, BehaviorSubject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { RuntimeConfigService } from '@services/runtime-config.service';
import { ClassTypingService } from '@services/class-typing-service';
import { TableConfiguration, ColumnConfiguration } from '@models/tables';
import { CrudDialogComponent } from '../crud-dialog/crud-dialog';
import {
  DynamicDataTableConfig,
  DEFAULT_DATA_TABLE_CONFIG,
  RowActionsConfig,
  DEFAULT_ROW_ACTIONS_CONFIG,
  VariableDefinition,
  CrudDialogData,
  CrudDialogResult,
  RowActionEvent,
  CellValueChangeEvent,
  getCellTypeForDataType,
  createTableEditorState,
  createRowState,
  TableEditorState,
  RowState
} from '../models/crud-config.models';
import { DynamicObjectsActions } from '../../../state/actions/dynamic-objects.actions';

@Component({
  standalone: false,
  selector: 'dynamic-data-table',
  templateUrl: 'dynamic-data-table.html',
  styleUrls: ['./dynamic-data-table.css']
})
export class DynamicDataTableComponent implements OnInit, OnDestroy, OnChanges {
  @Input() className: string = '';
  @Input() classDisplayName: string = '';
  @Input() schema: VariableDefinition[] = [];
  @Input() instanceData: any[] = [];
  @Input() config: Partial<DynamicDataTableConfig> = {};
  @Input() rowActionsConfig: RowActionsConfig = DEFAULT_ROW_ACTIONS_CONFIG;

  @Output() rowCreated = new EventEmitter<any>();
  @Output() rowUpdated = new EventEmitter<{ rowId: string; data: any }>();
  @Output() rowDeleted = new EventEmitter<string>();
  @Output() cellChanged = new EventEmitter<CellValueChangeEvent>();

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  dataSource: MatTableDataSource<any>;
  displayedColumns: string[] = [];
  tableConfig: TableConfiguration | null = null;

  // Editor state management
  editorState$ = new BehaviorSubject<TableEditorState | null>(null);
  editingRowId: string | null = null;

  isLoading: boolean = false;
  error: string | null = null;

  // Permission flags based on class configuration
  // These control whether CRUD actions are shown in the UI
  canCreate: boolean = false;
  canEdit: boolean = false;
  canDelete: boolean = false;

  private destroy$ = new Subject<void>();
  mergedConfig: DynamicDataTableConfig;

  constructor(
    private http: HttpClient,
    private dialog: MatDialog,
    private runtimeConfig: RuntimeConfigService,
    private classTypingService: ClassTypingService,
    private store: Store
  ) {
    this.dataSource = new MatTableDataSource<any>([]);
    this.mergedConfig = { className: '', ...DEFAULT_DATA_TABLE_CONFIG };
  }

  ngOnInit(): void {
    this.initializeTable();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['className'] || changes['schema'] || changes['instanceData']) {
      this.initializeTable();
    }
    if (changes['config']) {
      this.mergedConfig = { ...DEFAULT_DATA_TABLE_CONFIG, className: this.className, ...this.config };
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.editorState$.complete();
  }

  /**
   * Initialize the table with schema and data
   */
  private initializeTable(): void {
    this.mergedConfig = { ...DEFAULT_DATA_TABLE_CONFIG, className: this.className, ...this.config };

    // Check permissions from ClassTypingService based on class configuration
    // This determines whether Create/Edit/Delete buttons are shown
    if (this.className) {
      this.canCreate = this.classTypingService.canCreateInstances(this.className);
      this.canEdit = this.classTypingService.canEditInstances(this.className);
      this.canDelete = this.classTypingService.canDeleteInstances(this.className);

      console.log(`[DynamicDataTable] Permissions for ${this.className}: create=${this.canCreate}, edit=${this.canEdit}, delete=${this.canDelete}`);
    }

    // Load or create table configuration
    if (this.mergedConfig.useTableConfiguration && this.className) {
      this.tableConfig = TableConfiguration.load(this.className);
    }

    // Build displayed columns from schema
    this.buildColumns();

    // Set up data source
    this.updateDataSource();

    // Initialize editor state
    this.initEditorState();

    // Connect sort and paginator
    setTimeout(() => {
      if (this.sort) {
        this.dataSource.sort = this.sort;
      }
      if (this.paginator) {
        this.dataSource.paginator = this.paginator;
      }
    });
  }

  /**
   * Build displayed columns from schema
   */
  private buildColumns(): void {
    if (this.schema.length === 0) {
      this.displayedColumns = [];
      return;
    }

    // Get visible columns from table config if available
    if (this.tableConfig) {
      this.displayedColumns = this.tableConfig.getVisibleColumnNames();
    } else {
      this.displayedColumns = this.schema.map(v => v.varName);
    }

    // Add actions column if enabled AND if class permissions allow any actions
    // Permissions from class config take precedence over rowActionsConfig
    const hasConfiguredActions = this.rowActionsConfig.enableEdit || this.rowActionsConfig.enableDelete;
    const hasPermittedActions = this.canEdit || this.canDelete;

    if (hasConfiguredActions && hasPermittedActions) {
      if (!this.displayedColumns.includes('_actions')) {
        this.displayedColumns.push('_actions');
      }
    }
  }

  /**
   * Update data source with instance data
   */
  private updateDataSource(): void {
    this.dataSource.data = this.instanceData || [];
  }

  /**
   * Initialize editor state from data
   */
  private initEditorState(): void {
    const state = createTableEditorState(this.className);

    this.instanceData.forEach(instance => {
      const rowId = instance.id || instance._instanceId || `row-${Date.now()}`;
      state.rows[rowId] = createRowState(rowId, instance, this.schema);
    });

    this.editorState$.next(state);
  }

  /**
   * Get column display name
   */
  getColumnDisplayName(columnName: string): string {
    const varDef = this.schema.find(v => v.varName === columnName);
    if (varDef) {
      return varDef.varDisplayName || varDef.varName;
    }

    const colConfig = this.tableConfig?.getColumn(columnName);
    if (colConfig) {
      return colConfig.displayName || columnName;
    }

    return columnName.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
  }

  /**
   * Get cell type for a column
   */
  getCellType(columnName: string): string {
    const varDef = this.schema.find(v => v.varName === columnName);
    return getCellTypeForDataType(varDef?.varType || 'str');
  }

  /**
   * Get variable definition for a column
   */
  getVarDef(columnName: string): VariableDefinition | undefined {
    return this.schema.find(v => v.varName === columnName);
  }

  /**
   * Get the effective row actions config, combining the input config with class permissions.
   * Class permissions take precedence - if a class doesn't allow edit/delete, those actions are disabled
   * even if the rowActionsConfig has them enabled.
   */
  get effectiveRowActionsConfig(): RowActionsConfig {
    return {
      ...this.rowActionsConfig,
      enableEdit: this.rowActionsConfig.enableEdit && this.canEdit,
      enableDelete: this.rowActionsConfig.enableDelete && this.canDelete,
      enableInlineEdit: this.rowActionsConfig.enableInlineEdit && this.canEdit
    };
  }

  /**
   * Check if row is being edited
   */
  isRowEditing(row: any): boolean {
    const rowId = row.id || row._instanceId;
    return this.editingRowId === rowId;
  }

  /**
   * Get row state
   */
  getRowState(row: any): RowState | null {
    const state = this.editorState$.value;
    const rowId = row.id || row._instanceId;
    return state?.rows[rowId] || null;
  }

  // ============================================================================
  // Actions
  // ============================================================================

  /**
   * Open create dialog
   */
  openCreateDialog(): void {
    const dialogData: CrudDialogData = {
      mode: 'create',
      className: this.className,
      classDisplayName: this.classDisplayName || this.className,
      schema: this.schema
    };

    const dialogRef = this.dialog.open(CrudDialogComponent, {
      data: dialogData,
      width: '600px',
      disableClose: true
    });

    dialogRef.afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((result: CrudDialogResult) => {
        if (result?.action === 'save' && result.data) {
          this.rowCreated.emit(result.data);
          // Dispatch to store
          this.store.dispatch(DynamicObjectsActions.createInstanceSuccess({
            className: this.className,
            instance: result.data
          }));
        }
      });
  }

  /**
   * Handle row edit action
   */
  onRowEdit(event: RowActionEvent): void {
    const rowId = event.rowId || event.rowData.id || event.rowData._instanceId;

    if (this.rowActionsConfig.editMode === 'popup') {
      this.openEditDialog(event.rowData);
    } else {
      // Inline edit mode
      this.editingRowId = rowId;
    }
  }

  /**
   * Open edit dialog
   */
  openEditDialog(rowData: any): void {
    const dialogData: CrudDialogData = {
      mode: 'edit',
      className: this.className,
      classDisplayName: this.classDisplayName || this.className,
      schema: this.schema,
      instance: rowData
    };

    const dialogRef = this.dialog.open(CrudDialogComponent, {
      data: dialogData,
      width: '600px',
      disableClose: true
    });

    dialogRef.afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((result: CrudDialogResult) => {
        const rowId = this.getInstanceId(rowData) || '';

        if (result?.action === 'save' && result.data) {
          this.rowUpdated.emit({ rowId, data: result.data });
          this.store.dispatch(DynamicObjectsActions.updateInstanceSuccess({
            className: this.className,
            instanceId: rowId,
            instance: result.data
          }));
        } else if (result?.action === 'delete') {
          this.rowDeleted.emit(rowId);
          this.store.dispatch(DynamicObjectsActions.deleteInstanceSuccess({
            className: this.className,
            instanceId: rowId
          }));
        }
      });
  }

  /**
   * Handle row save action (inline edit)
   */
  onRowSave(event: RowActionEvent): void {
    const rowId = event.rowId || this.getInstanceId(event.rowData);

    if (!rowId) {
      this.error = 'Cannot save: Unable to determine instance ID. Check console for details.';
      return;
    }

    const state = this.editorState$.value;
    const rowState = state?.rows[rowId];

    if (!rowState || !rowState.isDirty) {
      this.editingRowId = null;
      return;
    }

    // Build updated data
    const updatedData = { ...event.rowData, ...rowState.pendingChanges };

    // Call backend to save using Polari's multipart form data format
    const backendUrl = this.runtimeConfig.getBackendBaseUrl();
    const multipartData = new FormData();
    multipartData.append('polariId', rowId);
    multipartData.append('updateData', JSON.stringify(updatedData));

    this.http.put(`${backendUrl}/${this.className}`, multipartData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.editingRowId = null;
          this.rowUpdated.emit({ rowId, data: response });
          this.store.dispatch(DynamicObjectsActions.updateInstanceSuccess({
            className: this.className,
            instanceId: rowId,
            instance: response
          }));
        },
        error: (error) => {
          console.error('Failed to save row:', error);
          this.error = error.error?.error || 'Failed to save';
        }
      });
  }

  /**
   * Handle row cancel action (inline edit)
   */
  onRowCancel(event: RowActionEvent): void {
    this.editingRowId = null;
    // Reset row state
    this.initEditorState();
  }

  /**
   * Extract instance ID from row data.
   * Checks multiple common ID field names used by different backends.
   */
  private getInstanceId(row: any): string | undefined {
    if (!row) return undefined;
    const idFields = ['id', '_instanceId', '_id', 'Id', 'ID', 'instanceId'];
    for (const field of idFields) {
      if (row[field] !== undefined && row[field] !== null) {
        return String(row[field]);
      }
    }
    console.warn('[DynamicDataTable] Could not find ID in row. Available fields:', Object.keys(row));
    console.warn('[DynamicDataTable] Row data:', row);
    return undefined;
  }

  /**
   * Handle row delete action
   * Polari backend expects multipart form data with targetInstance field
   * containing a query dict to identify the instance (e.g., {"id": "someId"})
   */
  onRowDelete(event: RowActionEvent): void {
    const rowId = event.rowId || this.getInstanceId(event.rowData);

    if (!rowId) {
      this.error = 'Cannot delete: Unable to determine instance ID. Check console for details.';
      return;
    }

    const backendUrl = this.runtimeConfig.getBackendBaseUrl();
    const multipartData = new FormData();
    multipartData.append('targetInstance', JSON.stringify({ id: rowId }));

    this.http.request('DELETE', `${backendUrl}/${this.className}`, { body: multipartData })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.rowDeleted.emit(rowId);
          this.store.dispatch(DynamicObjectsActions.deleteInstanceSuccess({
            className: this.className,
            instanceId: rowId
          }));
        },
        error: (error) => {
          console.error('Failed to delete row:', error);
          this.error = error.error?.error || 'Failed to delete';
        }
      });
  }

  /**
   * Handle cell value change (inline edit)
   */
  onCellValueChange(row: any, fieldName: string, newValue: any): void {
    const rowId = this.getInstanceId(row);

    this.cellChanged.emit({
      fieldName,
      oldValue: row[fieldName],
      newValue,
      rowData: row,
      rowId
    });

    // Update row in data source
    const index = this.dataSource.data.findIndex(r =>
      this.getInstanceId(r) === rowId
    );
    if (index >= 0) {
      this.dataSource.data[index] = { ...this.dataSource.data[index], [fieldName]: newValue };
      this.dataSource.data = [...this.dataSource.data];
    }
  }

  /**
   * Apply filter to table
   */
  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  /**
   * Refresh data from backend
   */
  refreshData(): void {
    this.isLoading = true;
    this.error = null;

    const backendUrl = this.runtimeConfig.getBackendBaseUrl();
    this.http.get<any[]>(`${backendUrl}/${this.className}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.isLoading = false;
          this.instanceData = data;
          this.updateDataSource();
          this.initEditorState();
          this.store.dispatch(DynamicObjectsActions.loadClassInstancesSuccess({
            className: this.className,
            instances: data
          }));
        },
        error: (error) => {
          this.isLoading = false;
          this.error = error.error?.error || 'Failed to load data';
          console.error('Failed to refresh data:', error);
        }
      });
  }
}
