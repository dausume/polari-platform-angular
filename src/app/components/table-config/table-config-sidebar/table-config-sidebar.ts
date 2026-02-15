import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { NamedTableConfig, RowWrappingConfig, CrudPermissionConfig } from '@models/tables/NamedTableConfig';
import { ColumnConfiguration } from '@models/tables/ColumnConfiguration';
import { SortOrder, SortDirection, TableDensity } from '@models/tables/TableConfiguration';

interface FieldInfo {
  name: string;
  type: string;
  typeIcon: string;
  available: boolean;
  visible: boolean;
}

@Component({
  standalone: false,
  selector: 'table-config-sidebar',
  templateUrl: 'table-config-sidebar.html',
  styleUrls: ['./table-config-sidebar.css']
})
export class TableConfigSidebarComponent implements OnChanges {
  @Input() config!: NamedTableConfig;
  @Input() classTypeData: any = {};
  @Output() configChange = new EventEmitter<NamedTableConfig>();

  fields: FieldInfo[] = [];
  pageSizeOptions: number[] = [5, 10, 25, 50, 100];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config'] || changes['classTypeData']) {
      this.buildFieldList();
    }
  }

  private buildFieldList(): void {
    if (!this.config || !this.classTypeData) {
      this.fields = [];
      return;
    }

    const typeData = this.classTypeData;
    const allFieldNames = Object.keys(typeData);
    const tc = this.config.tableConfiguration;

    this.fields = allFieldNames.map(name => {
      const varData = typeData[name];
      const pythonType = varData?.variablePythonType || 'str';
      const isRemoved = tc.removedColumns.includes(name);
      const col = tc.getColumn(name);
      const isVisible = col ? col.visible : true;

      return {
        name,
        type: pythonType,
        typeIcon: this.getTypeIcon(pythonType),
        available: !isRemoved,
        visible: isVisible && !isRemoved
      };
    });
  }

  private getTypeIcon(type: string): string {
    const typeMap: Record<string, string> = {
      'str': 'T', 'string': 'T',
      'int': '#', 'integer': '#',
      'float': '#', 'bool': '\u2713', 'boolean': '\u2713',
      'list': '[]', 'dict': '{}', 'object': '{}',
      'date': 'D', 'datetime': 'DT',
      'polariList': '[]', 'polariDict': '{}'
    };
    return typeMap[type?.toLowerCase()] || '\u25C6';
  }

  toggleFieldAvailability(field: FieldInfo): void {
    const tc = this.config.tableConfiguration;
    if (field.available) {
      tc.removeColumn(field.name);
      field.available = false;
      field.visible = false;
    } else {
      tc.restoreColumn(field.name);
      field.available = true;
      const col = tc.getColumn(field.name);
      field.visible = col ? col.visible : true;
    }
    this.emitChange();
  }

  toggleFieldVisibility(field: FieldInfo): void {
    if (!field.available) return;
    const tc = this.config.tableConfiguration;
    const col = tc.getColumn(field.name);
    if (col) {
      col.visible = !col.visible;
      field.visible = col.visible;
    }
    this.emitChange();
  }

  onPageSizeChange(pageSize: number): void {
    this.config.tableConfiguration.pagination.pageSize = pageSize;
    this.emitChange();
  }

  onDensityChange(density: string): void {
    this.config.tableConfiguration.density = density as TableDensity;
    this.emitChange();
  }

  onRowWrappingToggle(enabled: boolean): void {
    this.config.rowWrapping.enabled = enabled;
    this.emitChange();
  }

  onFieldsPerRowChange(value: number | string): void {
    const num = typeof value === 'string' ? parseInt(value, 10) : value;
    if (!isNaN(num) && num >= 1) {
      this.config.rowWrapping.fieldsPerRow = num;
      this.emitChange();
    }
  }

  onCrudPermissionChange(permission: keyof CrudPermissionConfig, value: boolean): void {
    this.config.crudPermissions[permission] = value;
    this.emitChange();
  }

  onSeparatorStyleChange(style: string): void {
    this.config.rowWrapping.separatorStyle = style as RowWrappingConfig['separatorStyle'];
    this.emitChange();
  }

  onDisplaySettingChange(setting: string, value: boolean): void {
    (this.config.tableConfiguration as any)[setting] = value;
    this.emitChange();
  }

  onSortOrderChange(order: string): void {
    this.config.tableConfiguration.setSortOrder(order as SortOrder);
    this.buildFieldList();
    this.emitChange();
  }

  onSortDirectionChange(direction: string): void {
    this.config.tableConfiguration.sortDirection = direction as SortDirection;
    this.config.tableConfiguration.applySorting();
    this.buildFieldList();
    this.emitChange();
  }

  emitChange(): void {
    this.configChange.emit(this.config);
  }

  get availableFields(): FieldInfo[] {
    return this.fields.filter(f => f.available);
  }
}
