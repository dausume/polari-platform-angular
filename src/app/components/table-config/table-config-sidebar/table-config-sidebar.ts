import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { NamedTableConfig, RowWrappingConfig, CrudPermissionConfig, MetricCardConfig } from '@models/tables/NamedTableConfig';
import { InstanceActionButton, DatasetActionButton, ParamMapping } from '@models/tables/TableActionButton';
import { ColumnConfiguration } from '@models/tables/ColumnConfiguration';
import { SortOrder, SortDirection, TableDensity } from '@models/tables/TableConfiguration';
import { SolutionManagerService, SolutionSummary } from '@services/no-code-services/solution-manager.service';
import { getAllSvgIcons, SvgIconDef } from '@models/shared/SvgIconLibrary';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { getFieldTypeIcon } from '@models/shared/PolariFieldType';

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
  availableSolutions: SolutionSummary[] = [];
  svgIcons: SvgIconDef[] = getAllSvgIcons();

  /** Common Material icons for metric cards */
  metricIcons: { value: string; label: string }[] = [
    { value: 'analytics', label: 'Analytics' },
    { value: 'info', label: 'Info' },
    { value: 'tag', label: 'Tag' },
    { value: 'text_fields', label: 'Text' },
    { value: 'numbers', label: 'Numbers' },
    { value: 'attach_money', label: 'Money' },
    { value: 'percent', label: 'Percent' },
    { value: 'calendar_today', label: 'Date' },
    { value: 'person', label: 'Person' },
    { value: 'location_on', label: 'Location' },
    { value: 'inventory', label: 'Inventory' },
    { value: 'category', label: 'Category' },
    { value: 'check_circle', label: 'Status' },
    { value: 'speed', label: 'Speed' },
    { value: 'thermostat', label: 'Measure' },
    { value: 'science', label: 'Science' },
    { value: 'bar_chart', label: 'Chart' },
    { value: 'link', label: 'Reference' },
    { value: 'description', label: 'Description' },
    { value: 'fingerprint', label: 'ID' }
  ];

  constructor(private solutionManager: SolutionManagerService, private sanitizer: DomSanitizer) {
    this.solutionManager.solutionList$.subscribe(solutions => {
      this.availableSolutions = solutions;
    });
    this.solutionManager.fetchSolutionList();
  }

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
    return getFieldTypeIcon(type);
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

  onDefaultToggle(flag: 'is_default_table' | 'is_default_instance_display' | 'is_default_dataset_display', value: boolean): void {
    this.config[flag] = value;
    this.emitChange();
  }

  emitChange(): void {
    this.configChange.emit(this.config);
  }

  get availableFields(): FieldInfo[] {
    return this.fields.filter(f => f.available);
  }

  get fieldNames(): string[] {
    return this.fields.map(f => f.name);
  }

  // ===== Instance Action Buttons =====

  addInstanceAction(): void {
    const action = new InstanceActionButton();
    this.config.instanceActions.push(action);
    this.emitChange();
  }

  removeInstanceAction(index: number): void {
    this.config.instanceActions.splice(index, 1);
    this.emitChange();
  }

  onInstanceActionChange(): void {
    this.emitChange();
  }

  addParamMapping(action: InstanceActionButton): void {
    action.paramMappings.push({ instanceField: '', solutionParam: '' });
    this.emitChange();
  }

  removeParamMapping(action: InstanceActionButton, index: number): void {
    action.paramMappings.splice(index, 1);
    this.emitChange();
  }

  // ===== Dataset Action Buttons =====

  addDatasetAction(): void {
    const action = new DatasetActionButton();
    this.config.datasetActions.push(action);
    this.emitChange();
  }

  removeDatasetAction(index: number): void {
    this.config.datasetActions.splice(index, 1);
    this.emitChange();
  }

  onDatasetActionChange(): void {
    this.emitChange();
  }

  // ===== Detail Display Metric Cards =====

  addCard(): void {
    const id = 'card_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    const card: MetricCardConfig = {
      id,
      fieldName: this.fields.length > 0 ? this.fields[0].name : '',
      label: '',
      icon: 'analytics',
      format: 'text'
    };
    this.config.detailDisplay.cards.push(card);
    this.emitChange();
  }

  removeCard(index: number): void {
    this.config.detailDisplay.cards.splice(index, 1);
    this.emitChange();
  }

  moveCardUp(index: number): void {
    if (index <= 0) return;
    const cards = this.config.detailDisplay.cards;
    [cards[index - 1], cards[index]] = [cards[index], cards[index - 1]];
    this.emitChange();
  }

  moveCardDown(index: number): void {
    const cards = this.config.detailDisplay.cards;
    if (index >= cards.length - 1) return;
    [cards[index], cards[index + 1]] = [cards[index + 1], cards[index]];
    this.emitChange();
  }

  onCardChange(): void {
    this.emitChange();
  }

  getFieldDisplayName(fieldName: string): string {
    if (!fieldName) return '';
    const varData = this.classTypeData?.[fieldName];
    if (varData?.displayName) return varData.displayName;
    return fieldName.replace(/([A-Z])/g, ' $1').replace(/^./, (s: string) => s.toUpperCase());
  }

  getFieldTypeIcon(fieldName: string): string {
    const field = this.fields.find(f => f.name === fieldName);
    return field?.typeIcon || '';
  }

  /** Get sanitized SVG HTML for template rendering */
  getSafeSvg(svgString: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(svgString);
  }

  /** Get sanitized SVG for an icon by name */
  getIconSvgByName(name: string): SafeHtml {
    const icon = this.svgIcons.find(i => i.name === name);
    return this.sanitizer.bypassSecurityTrustHtml(icon?.svgString || '');
  }
}
