// shared-crud.module.ts
// Module that declares and exports all CRUD components for use across the application

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

// Angular Material Modules
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';

// Editable Cell Components
import { EditableStringCellComponent } from './editable-cells/editable-string-cell/editable-string-cell';
import { EditableNumberCellComponent } from './editable-cells/editable-number-cell/editable-number-cell';
import { EditableBooleanCellComponent } from './editable-cells/editable-boolean-cell/editable-boolean-cell';
import { EditableDateCellComponent } from './editable-cells/editable-date-cell/editable-date-cell';
import { EditableSelectCellComponent } from './editable-cells/editable-select-cell/editable-select-cell';

// Row Actions Component
import { RowActionsCellComponent } from './row-actions-cell/row-actions-cell';

// CRUD Dialog Component
import { CrudDialogComponent } from './crud-dialog/crud-dialog';

// Dynamic Data Table Component
import { DynamicDataTableComponent } from './dynamic-data-table/dynamic-data-table';

@NgModule({
  declarations: [
    // Editable Cells
    EditableStringCellComponent,
    EditableNumberCellComponent,
    EditableBooleanCellComponent,
    EditableDateCellComponent,
    EditableSelectCellComponent,
    // Row Actions
    RowActionsCellComponent,
    // Dialog
    CrudDialogComponent,
    // Table
    DynamicDataTableComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    // Material
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatCheckboxModule,
    MatSlideToggleModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatDialogModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatChipsModule
  ],
  exports: [
    // Editable Cells
    EditableStringCellComponent,
    EditableNumberCellComponent,
    EditableBooleanCellComponent,
    EditableDateCellComponent,
    EditableSelectCellComponent,
    // Row Actions
    RowActionsCellComponent,
    // Dialog
    CrudDialogComponent,
    // Table
    DynamicDataTableComponent
  ]
})
export class SharedCrudModule { }

// Re-export components for direct import
export { DynamicDataTableComponent } from './dynamic-data-table/dynamic-data-table';
export { CrudDialogComponent } from './crud-dialog/crud-dialog';
export { EditableStringCellComponent } from './editable-cells/editable-string-cell/editable-string-cell';
export { EditableNumberCellComponent } from './editable-cells/editable-number-cell/editable-number-cell';
export { EditableBooleanCellComponent } from './editable-cells/editable-boolean-cell/editable-boolean-cell';
export { EditableDateCellComponent } from './editable-cells/editable-date-cell/editable-date-cell';
export { EditableSelectCellComponent } from './editable-cells/editable-select-cell/editable-select-cell';
export { RowActionsCellComponent } from './row-actions-cell/row-actions-cell';
