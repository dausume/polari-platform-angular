// shared/index.ts
// Barrel export file for all shared CRUD components

// Models
export * from './models/crud-config.models';

// Editable Cell Components
export { EditableStringCellComponent } from './editable-cells/editable-string-cell/editable-string-cell';
export { EditableNumberCellComponent } from './editable-cells/editable-number-cell/editable-number-cell';
export { EditableBooleanCellComponent } from './editable-cells/editable-boolean-cell/editable-boolean-cell';
export { EditableDateCellComponent } from './editable-cells/editable-date-cell/editable-date-cell';
export { EditableSelectCellComponent } from './editable-cells/editable-select-cell/editable-select-cell';

// Row Actions Component
export { RowActionsCellComponent } from './row-actions-cell/row-actions-cell';

// CRUD Dialog Component
export { CrudDialogComponent } from './crud-dialog/crud-dialog';

// Dynamic Data Table Component
export { DynamicDataTableComponent } from './dynamic-data-table/dynamic-data-table';

// Module
export { SharedCrudModule } from './shared-crud.module';
