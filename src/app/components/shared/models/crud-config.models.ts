// crud-config.models.ts
// Models and interfaces for the CRUD component system
// Integrates with existing TableConfiguration and ColumnConfiguration from @models/tables

import { ColumnConfiguration, IColumnConfiguration, ColumnFormat, ColumnAlignment } from '@models/tables';

/**
 * Re-export table configuration types for convenience
 */
export { ColumnConfiguration, IColumnConfiguration, ColumnFormat, ColumnAlignment };

/**
 * Configuration for editable cells
 * Extends ColumnConfiguration to inherit display settings
 */
export interface EditableCellConfig {
  mode: 'read' | 'create' | 'edit';
  value: any;
  fieldName: string;
  displayName: string;
  dataType?: string;
  required?: boolean;
  options?: SelectOption[];
  // From ColumnConfiguration
  alignment?: ColumnAlignment;
  format?: ColumnFormat;
  formatOptions?: Record<string, any>;
}

/**
 * Options for select/dropdown cells
 */
export interface SelectOption {
  value: any;
  label: string;
  disabled?: boolean;
}

/**
 * Configuration for row action buttons
 */
export interface RowActionsConfig {
  enableEdit: boolean;
  enableDelete: boolean;
  enableInlineEdit: boolean;
  editMode: 'inline' | 'popup' | 'both';
  confirmDelete?: boolean;
  customActions?: CustomAction[];
}

/**
 * Custom action button configuration
 */
export interface CustomAction {
  name: string;
  icon: string;
  label: string;
  color?: 'primary' | 'accent' | 'warn';
  disabled?: boolean;
  hidden?: boolean;
}

/**
 * Default row actions configuration
 */
export const DEFAULT_ROW_ACTIONS_CONFIG: RowActionsConfig = {
  enableEdit: true,
  enableDelete: true,
  enableInlineEdit: true,
  editMode: 'both',
  confirmDelete: true
};

/**
 * Variable definition for dynamic class schemas
 * Compatible with polyTyping variable data and classEditor variableDef
 */
export interface VariableDefinition {
  varName: string;
  varDisplayName: string;
  varType: string;
  isIdentifier?: boolean;
  isUnique?: boolean;
  required?: boolean;
  refClass?: string;
  options?: SelectOption[];
  // Additional metadata from polyTyping
  isPrimary?: boolean;
  defaultValue?: any;
  // ColumnConfiguration integration
  columnConfig?: Partial<IColumnConfiguration>;
}

/**
 * Convert VariableDefinition to ColumnConfiguration
 */
export function variableDefToColumnConfig(
  varDef: VariableDefinition,
  order: number = 0
): ColumnConfiguration {
  return new ColumnConfiguration(varDef.varName, {
    displayName: varDef.varDisplayName,
    dataType: varDef.varType,
    order: order,
    available: true,
    visible: true,
    sortable: !['list', 'dict', 'reference'].includes(varDef.varType),
    filterable: !['list', 'dict', 'reference'].includes(varDef.varType),
    alignment: ColumnConfiguration.getDefaultAlignment(varDef.varType),
    format: ColumnConfiguration.getDefaultFormat(varDef.varType),
    ...varDef.columnConfig
  });
}

/**
 * Convert ColumnConfiguration back to VariableDefinition
 */
export function columnConfigToVariableDef(colConfig: IColumnConfiguration): VariableDefinition {
  return {
    varName: colConfig.name,
    varDisplayName: colConfig.displayName || colConfig.name,
    varType: colConfig.dataType || 'str',
    columnConfig: colConfig
  };
}

/**
 * Data passed to the CRUD dialog
 */
export interface CrudDialogData {
  mode: 'create' | 'edit';
  className: string;
  classDisplayName: string;
  schema: VariableDefinition[];
  instance?: any;
  // Additional configuration
  readOnlyFields?: string[];
  hiddenFields?: string[];
}

/**
 * Result returned from the CRUD dialog
 */
export interface CrudDialogResult {
  action: 'save' | 'cancel' | 'delete';
  data?: any;
  changes?: { [field: string]: { oldValue: any; newValue: any } };
}

/**
 * Configuration for the dynamic data table
 * Integrates with existing TableConfiguration
 */
export interface DynamicDataTableConfig {
  className: string;
  classDisplayName?: string;
  schema?: VariableDefinition[];
  rowActionsConfig?: RowActionsConfig;
  enableCreate?: boolean;
  enableBulkDelete?: boolean;
  enableExport?: boolean;
  pageSize?: number;
  pageSizeOptions?: number[];
  // Integration with existing table config
  useTableConfiguration?: boolean;
}

/**
 * Default dynamic data table configuration
 */
export const DEFAULT_DATA_TABLE_CONFIG: Partial<DynamicDataTableConfig> = {
  enableCreate: true,
  enableBulkDelete: false,
  enableExport: false,
  pageSize: 10,
  pageSizeOptions: [5, 10, 25, 50],
  useTableConfiguration: true
};

/**
 * Event emitted when cell value changes
 */
export interface CellValueChangeEvent {
  fieldName: string;
  oldValue: any;
  newValue: any;
  rowData: any;
  rowId?: string;
}

/**
 * Event emitted when row actions are triggered
 */
export interface RowActionEvent {
  action: 'edit' | 'delete' | 'save' | 'cancel' | string;
  rowData: any;
  rowIndex?: number;
  rowId?: string;
}

/**
 * Type mapping from backend types to display types
 */
export const TYPE_DISPLAY_MAP: Record<string, string> = {
  'str': 'String',
  'int': 'Integer',
  'float': 'Decimal',
  'list': 'List',
  'dict': 'Dictionary',
  'bool': 'Boolean',
  'boolean': 'Boolean',
  'reference': 'Reference',
  'date': 'Date',
  'datetime': 'DateTime',
  'polariList': 'List',
  'polariDict': 'Dictionary'
};

/**
 * Type mapping from backend types to cell component types
 */
export const CELL_TYPE_MAP: Record<string, string> = {
  'str': 'string',
  'string': 'string',
  'int': 'number',
  'integer': 'number',
  'float': 'number',
  'number': 'number',
  'bool': 'boolean',
  'boolean': 'boolean',
  'date': 'date',
  'datetime': 'date',
  'reference': 'select',
  'list': 'string',
  'dict': 'string',
  'polariList': 'string',
  'polariDict': 'string'
};

/**
 * Get the appropriate cell component type for a given data type
 */
export function getCellTypeForDataType(dataType: string): string {
  return CELL_TYPE_MAP[dataType?.toLowerCase()] || 'string';
}

/**
 * Get display name for a data type
 */
export function getTypeDisplayName(dataType: string): string {
  return TYPE_DISPLAY_MAP[dataType] || dataType || 'Unknown';
}

/**
 * Get type icon for a data type (matches existing patterns in ColumnConfiguration)
 */
export function getTypeIcon(dataType: string): string {
  const typeMap: Record<string, string> = {
    'str': 'T',
    'string': 'T',
    'int': '#',
    'integer': '#',
    'float': '∞',
    'number': '∞',
    'bool': '✓',
    'boolean': '✓',
    'list': '[]',
    'array': '[]',
    'dict': '{}',
    'object': '{}',
    'date': '📅',
    'datetime': '🕐',
    'polariList': '📋',
    'polariDict': '📚',
    'reference': '🔗'
  };
  return typeMap[dataType?.toLowerCase()] || '◆';
}

// ============================================================================
// CELL STATE MODELS - For NgRx State Management Integration
// ============================================================================

/**
 * State for a single cell in the table
 * Tracks editing state, validation, and pending changes
 */
export interface CellState {
  rowId: string;
  fieldName: string;
  originalValue: any;
  currentValue: any;
  isEditing: boolean;
  isDirty: boolean;
  isValid: boolean;
  isSaving: boolean;
  error: string | null;
  validationErrors: string[];
}

/**
 * State for a single row in the table
 * Aggregates cell states and tracks row-level operations
 */
export interface RowState {
  rowId: string;
  isNew: boolean;
  isEditing: boolean;
  isDeleting: boolean;
  isSaving: boolean;
  isDirty: boolean;
  isValid: boolean;
  isSelected: boolean;
  error: string | null;
  cells: { [fieldName: string]: CellState };
  originalData: any;
  pendingChanges: { [fieldName: string]: any };
}

/**
 * State for the entire table/data grid
 * Manages all row states and table-level operations
 */
export interface TableEditorState {
  className: string;
  isLoading: boolean;
  error: string | null;
  rows: { [rowId: string]: RowState };
  editingRowIds: string[];
  selectedRowIds: string[];
  pendingCreates: string[];  // Row IDs of new rows not yet saved
  pendingDeletes: string[];  // Row IDs marked for deletion
  hasUnsavedChanges: boolean;
}

/**
 * Create initial cell state
 */
export function createCellState(
  rowId: string,
  fieldName: string,
  value: any
): CellState {
  return {
    rowId,
    fieldName,
    originalValue: value,
    currentValue: value,
    isEditing: false,
    isDirty: false,
    isValid: true,
    isSaving: false,
    error: null,
    validationErrors: []
  };
}

/**
 * Create initial row state from instance data
 */
export function createRowState(
  rowId: string,
  data: any,
  schema: VariableDefinition[],
  isNew: boolean = false
): RowState {
  const cells: { [fieldName: string]: CellState } = {};

  schema.forEach(varDef => {
    const value = data[varDef.varName];
    cells[varDef.varName] = createCellState(rowId, varDef.varName, value);
  });

  return {
    rowId,
    isNew,
    isEditing: isNew,
    isDeleting: false,
    isSaving: false,
    isDirty: isNew,
    isValid: true,
    isSelected: false,
    error: null,
    cells,
    originalData: isNew ? {} : { ...data },
    pendingChanges: isNew ? { ...data } : {}
  };
}

/**
 * Create initial table editor state
 */
export function createTableEditorState(className: string): TableEditorState {
  return {
    className,
    isLoading: false,
    error: null,
    rows: {},
    editingRowIds: [],
    selectedRowIds: [],
    pendingCreates: [],
    pendingDeletes: [],
    hasUnsavedChanges: false
  };
}

/**
 * Update cell state with new value
 */
export function updateCellState(
  cell: CellState,
  newValue: any,
  validationErrors: string[] = []
): CellState {
  const isDirty = newValue !== cell.originalValue;
  const isValid = validationErrors.length === 0;

  return {
    ...cell,
    currentValue: newValue,
    isDirty,
    isValid,
    validationErrors
  };
}

/**
 * Update row state when cell changes
 */
export function updateRowStateFromCell(
  row: RowState,
  fieldName: string,
  newCellState: CellState
): RowState {
  const newCells = { ...row.cells, [fieldName]: newCellState };

  // Calculate row-level dirty/valid states
  const cellStates = Object.values(newCells);
  const isDirty = row.isNew || cellStates.some(c => c.isDirty);
  const isValid = cellStates.every(c => c.isValid);

  // Build pending changes object
  const pendingChanges: { [key: string]: any } = {};
  cellStates.forEach(cell => {
    if (cell.isDirty || row.isNew) {
      pendingChanges[cell.fieldName] = cell.currentValue;
    }
  });

  return {
    ...row,
    cells: newCells,
    isDirty,
    isValid,
    pendingChanges
  };
}

/**
 * Get all dirty rows from table state
 */
export function getDirtyRows(state: TableEditorState): RowState[] {
  return Object.values(state.rows).filter(row => row.isDirty);
}

/**
 * Get all invalid rows from table state
 */
export function getInvalidRows(state: TableEditorState): RowState[] {
  return Object.values(state.rows).filter(row => !row.isValid);
}

/**
 * Check if table has any unsaved changes
 */
export function hasUnsavedChanges(state: TableEditorState): boolean {
  return state.pendingCreates.length > 0 ||
         state.pendingDeletes.length > 0 ||
         Object.values(state.rows).some(row => row.isDirty);
}
