import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { NamedDataSetConfig, FilterChainLinkDef } from '@models/datasets/NamedDataSetConfig';
import {
  detectFieldsFromClassTypeData, DetectedField,
  getFilterOptionsForFieldType, getFilterTypeMeta,
  getInputTypeForFieldType, normalizeDataType
} from '@models/shared/PolariFieldType';

@Component({
  standalone: false,
  selector: 'dataset-config-sidebar',
  templateUrl: './dataset-config-sidebar.html',
  styleUrls: ['./dataset-config-sidebar.css']
})
export class DataSetConfigSidebarComponent implements OnChanges {
  @Input() config!: NamedDataSetConfig;
  @Input() classTypeData: any = {};

  @Output() configChange = new EventEmitter<NamedDataSetConfig>();

  /** Detected fields with normalized type info */
  detectedFields: DetectedField[] = [];

  /** Available field names (convenience) */
  availableFields: string[] = [];

  /** Map of field name → canonical data type */
  fieldTypes: Map<string, string> = new Map();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['classTypeData']) {
      this.detectFields();
    }
  }

  private detectFields(): void {
    this.detectedFields = detectFieldsFromClassTypeData(this.classTypeData);
    this.availableFields = this.detectedFields.map(f => f.name);
    this.fieldTypes = new Map(this.detectedFields.map(f => [f.name, f.canonicalType]));
  }

  getFilterOptionsFor(variableName: string): readonly string[] {
    const dataType = this.fieldTypes.get(variableName) || 'string';
    return getFilterOptionsForFieldType(dataType);
  }

  getFieldType(variableName: string): string {
    return this.fieldTypes.get(variableName) || 'string';
  }

  getFieldInfo(variableName: string): DetectedField | undefined {
    return this.detectedFields.find(f => f.name === variableName);
  }

  getFilterLabel(filterType: string): string {
    return getFilterTypeMeta(filterType).label;
  }

  // ===== Filter Chain Management =====

  addFilterLink(): void {
    const firstField = this.availableFields[0] || '';
    const options = this.getFilterOptionsFor(firstField);
    this.config.filterChainLinks.push({
      variableName: firstField,
      filterType: options[0] || 'equals',
      filterValue: ''
    });
    this.emitChange();
  }

  removeFilterLink(index: number): void {
    this.config.filterChainLinks.splice(index, 1);
    this.emitChange();
  }

  moveFilterLink(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= this.config.filterChainLinks.length) return;
    const links = this.config.filterChainLinks;
    [links[index], links[target]] = [links[target], links[index]];
    this.emitChange();
  }

  onFieldChange(link: FilterChainLinkDef): void {
    const options = this.getFilterOptionsFor(link.variableName);
    if (!options.includes(link.filterType)) {
      link.filterType = (options[0] as string) || 'equals';
    }
    link.filterValue = '';
    this.emitChange();
  }

  onFilterTypeChange(_link: FilterChainLinkDef): void {
    this.emitChange();
  }

  onFilterValueChange(_link: FilterChainLinkDef): void {
    this.emitChange();
  }

  requiresNoValue(filterType: string): boolean {
    const meta = getFilterTypeMeta(filterType);
    return !meta.requiresValue && !meta.requiresRange;
  }

  requiresRange(filterType: string): boolean {
    return getFilterTypeMeta(filterType).requiresRange;
  }

  onRangeValueChange(link: FilterChainLinkDef, index: 0 | 1, value: string): void {
    if (!Array.isArray(link.filterValue)) {
      link.filterValue = ['', ''];
    }
    link.filterValue[index] = value;
    this.emitChange();
  }

  getRangeValue(link: FilterChainLinkDef, index: 0 | 1): string {
    if (Array.isArray(link.filterValue) && link.filterValue.length > index) {
      return String(link.filterValue[index] ?? '');
    }
    return '';
  }

  getInputType(variableName: string): string {
    const dataType = this.getFieldType(variableName);
    return getInputTypeForFieldType(dataType);
  }

  // ===== Settings =====

  onDisableUserChangesToggle(checked: boolean): void {
    this.config.disableUserConfigChanges = checked;
    this.emitChange();
  }

  private emitChange(): void {
    this.configChange.emit(this.config);
  }
}
