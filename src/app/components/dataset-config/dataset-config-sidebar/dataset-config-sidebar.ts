import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { NamedDataSetConfig, FilterChainLinkDef, FilterChainSegmentDef, SegmentOperationType } from '@models/datasets/NamedDataSetConfig';
import { NamedFieldProfileConfig } from '@models/datasets/NamedFieldProfileConfig';
import { FilterChainDefinitionSummary } from '@models/datasets/NamedFilterChainConfig';
import {
  detectFieldsFromClassTypeData, DetectedField,
  getFilterOptionsForFieldType, getFilterTypeMeta,
  getInputTypeForFieldType, normalizeDataType,
  FIELD_TYPE_ICONS, FIELD_TYPE_LABELS, FIELD_TYPE_COLORS,
  CanonicalFieldType
} from '@models/shared/PolariFieldType';

/**
 * Interface for any object that exposes a filter chain for editing.
 * Both NamedDataSetConfig and NamedFilterChainConfig satisfy this.
 */
export interface FilterChainEditable {
  filterChainLinks: FilterChainLinkDef[];
  segments: FilterChainSegmentDef[];
  disableUserConfigChanges: boolean;
}

@Component({
  standalone: false,
  selector: 'dataset-config-sidebar',
  templateUrl: './dataset-config-sidebar.html',
  styleUrls: ['./dataset-config-sidebar.css']
})
export class DataSetConfigSidebarComponent implements OnChanges {
  @Input() config!: FilterChainEditable;
  @Input() classTypeData: any = {};
  /** Optional field profile — when provided, available fields come from the profile instead of raw classTypeData */
  @Input() fieldProfile: NamedFieldProfileConfig | null = null;
  /** Available filter chains for reference segments */
  @Input() availableFilterChains: FilterChainDefinitionSummary[] = [];

  @Output() configChange = new EventEmitter<FilterChainEditable>();

  /** Detected fields with normalized type info */
  detectedFields: DetectedField[] = [];

  /** Available field names (convenience) */
  availableFields: string[] = [];

  /** Map of field name → canonical data type */
  fieldTypes: Map<string, string> = new Map();

  /** ID of the segment currently being renamed (null = none) */
  editingSegmentId: string | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['classTypeData'] || changes['fieldProfile']) {
      this.detectFields();
    }
    // Auto-migrate flat filterChainLinks into segment mode
    if (changes['config'] && this.config) {
      this.ensureSegmentMode();
    }
  }

  private ensureSegmentMode(): void {
    if (!this.config.segments) this.config.segments = [];
    if (this.config.segments.length === 0 && this.config.filterChainLinks.length > 0) {
      const seg: FilterChainSegmentDef = {
        id: this.generateSegId(),
        name: 'Segment 1',
        collapsed: false,
        type: 'filter',
        filterLinks: [...this.config.filterChainLinks],
        sourceSegmentIds: []
      };
      this.config.segments.push(seg);
      this.config.filterChainLinks = [];
    }
  }

  private detectFields(): void {
    if (this.fieldProfile) {
      this.detectedFields = this.detectFieldsFromProfile(this.fieldProfile);
    } else {
      this.detectedFields = detectFieldsFromClassTypeData(this.classTypeData);
    }
    this.availableFields = this.detectedFields.map(f => f.name);
    this.fieldTypes = new Map(this.detectedFields.map(f => [f.name, f.canonicalType]));
  }

  /**
   * Build DetectedField entries from a NamedFieldProfileConfig.
   * Includes included own fields + enabled referenced object fields (as dot-notation).
   */
  private detectFieldsFromProfile(profile: NamedFieldProfileConfig): DetectedField[] {
    const fields: DetectedField[] = [];
    const refVarNames = new Set(profile.referencedObjects.map(r => r.varName));

    // Own fields (skip reference-type vars that have a referencedObjects entry)
    for (const f of profile.ownFields) {
      if (!f.included) continue;
      if (refVarNames.has(f.name)) continue;
      const canonical = normalizeDataType(f.dataType);
      fields.push({
        name: f.name,
        canonicalType: canonical,
        rawType: f.dataType,
        icon: FIELD_TYPE_ICONS[canonical] || '◆',
        label: FIELD_TYPE_LABELS[canonical] || 'Unknown',
        badgeColor: FIELD_TYPE_COLORS[canonical] || '#78909c',
      });
    }

    // Referenced object fields as dot-notation
    for (const ref of profile.referencedObjects) {
      if (!ref.enabled) continue;
      for (const f of ref.fields) {
        if (!f.included) continue;
        const canonical = normalizeDataType(f.dataType);
        fields.push({
          name: `${ref.varName}.${f.name}`,
          canonicalType: canonical,
          rawType: f.dataType,
          icon: FIELD_TYPE_ICONS[canonical] || '◆',
          label: `${ref.varName}: ${FIELD_TYPE_LABELS[canonical] || 'Unknown'}`,
          badgeColor: FIELD_TYPE_COLORS[canonical] || '#78909c',
        });
      }
    }

    return fields;
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

  private nextSegId = 1;

  // ===== Segment Name Editing =====

  startEditSegmentName(seg: FilterChainSegmentDef): void {
    this.editingSegmentId = seg.id;
    // Focus the input after it renders
    setTimeout(() => {
      const input = document.querySelector('.ds-segment-name-input') as HTMLInputElement;
      if (input) {
        input.focus();
        input.select();
      }
    });
  }

  finishEditSegmentName(seg: FilterChainSegmentDef, newName: string): void {
    if (this.editingSegmentId !== seg.id) return;
    seg.name = newName;
    this.editingSegmentId = null;
    this.emitChange();
  }

  cancelEditSegmentName(): void {
    this.editingSegmentId = null;
  }

  // ===== Segment Management =====

  /** Add a new filter segment */
  addFilterSegment(): void {
    if (!this.config.segments) this.config.segments = [];
    const seg: FilterChainSegmentDef = {
      id: this.generateSegId(),
      name: `Segment ${this.config.segments.length + 1}`,
      collapsed: false,
      type: 'filter',
      filterLinks: [],
      sourceSegmentIds: []
    };
    this.config.segments.push(seg);
    this.emitChange();
  }

  removeSegment(index: number): void {
    const removed = this.config.segments[index];
    this.config.segments.splice(index, 1);
    // Clean up references to the removed segment
    for (const seg of this.config.segments) {
      seg.sourceSegmentIds = seg.sourceSegmentIds.filter(id => id !== removed.id);
    }
    this.emitChange();
  }

  moveSegment(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= this.config.segments.length) return;
    const segs = this.config.segments;
    [segs[index], segs[target]] = [segs[target], segs[index]];
    this.emitChange();
  }

  toggleSegmentCollapse(seg: FilterChainSegmentDef): void {
    seg.collapsed = !seg.collapsed;
  }

  onSegmentTypeChange(seg: FilterChainSegmentDef, type: SegmentOperationType): void {
    seg.type = type;
    if (type === 'filter') {
      seg.sourceSegmentIds = [];
      seg.referenceFilterChainId = undefined;
    } else if (type === 'reference') {
      seg.filterLinks = [];
      seg.sourceSegmentIds = [];
    } else {
      seg.filterLinks = [];
      seg.referenceFilterChainId = undefined;
    }
    this.emitChange();
  }

  onSegmentSourceToggle(seg: FilterChainSegmentDef, sourceId: string, checked: boolean): void {
    if (checked) {
      if (!seg.sourceSegmentIds.includes(sourceId)) {
        seg.sourceSegmentIds.push(sourceId);
      }
    } else {
      seg.sourceSegmentIds = seg.sourceSegmentIds.filter(id => id !== sourceId);
    }
    this.emitChange();
  }

  /** Get upstream segments available as sources for a given segment index */
  getUpstreamSegments(segIndex: number): FilterChainSegmentDef[] {
    return this.config.segments.slice(0, segIndex);
  }

  // ===== Reference Segment =====

  onReferenceFilterChainChange(seg: FilterChainSegmentDef, filterChainId: string): void {
    seg.referenceFilterChainId = filterChainId || undefined;
    this.emitChange();
  }

  // ===== Segment Filter Link Management (within a segment) =====

  addSegmentFilterLink(seg: FilterChainSegmentDef): void {
    const firstField = this.availableFields[0] || '';
    const options = this.getFilterOptionsFor(firstField);
    seg.filterLinks.push({
      variableName: firstField,
      filterType: options[0] || 'equals',
      filterValue: ''
    });
    this.emitChange();
  }

  removeSegmentFilterLink(seg: FilterChainSegmentDef, index: number): void {
    seg.filterLinks.splice(index, 1);
    this.emitChange();
  }

  moveSegmentFilterLink(seg: FilterChainSegmentDef, index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= seg.filterLinks.length) return;
    [seg.filterLinks[index], seg.filterLinks[target]] = [seg.filterLinks[target], seg.filterLinks[index]];
    this.emitChange();
  }

  onSegmentFieldChange(link: FilterChainLinkDef): void {
    this.onFieldChange(link);
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

  private generateSegId(): string {
    return `seg_${Date.now()}_${this.nextSegId++}`;
  }

  getSegmentOperationIcon(type: string): string {
    switch (type) {
      case 'filter': return 'filter_list';
      case 'union': return 'join_full';
      case 'intersection': return 'join_inner';
      case 'difference': return 'remove_circle_outline';
      case 'reference': return 'link';
      default: return 'help';
    }
  }

  getSegmentOperationLabel(type: string): string {
    switch (type) {
      case 'filter': return 'Filter';
      case 'union': return 'Union';
      case 'intersection': return 'Intersection';
      case 'difference': return 'Difference';
      case 'reference': return 'Reference';
      default: return type;
    }
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
