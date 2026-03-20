import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import {
  NamedFieldProfileConfig,
  OwnFieldEntry,
  ReferencedObjectEntry,
  ReferencedFieldEntry
} from '@models/datasets/NamedFieldProfileConfig';
import { ClassTypingService } from '@services/class-typing-service';

@Component({
  standalone: false,
  selector: 'field-profile-sidebar',
  templateUrl: './field-profile-sidebar.html',
  styleUrls: ['./field-profile-sidebar.css']
})
export class FieldProfileSidebarComponent implements OnChanges {
  @Input() config!: NamedFieldProfileConfig;
  @Input() classTypeData: any = {};
  @Input() classPolyTypingObj: any = null;

  @Output() configChange = new EventEmitter<NamedFieldProfileConfig>();

  /** Track which referenced object panels are expanded */
  expandedRefPanels: Set<string> = new Set();

  constructor(private typingService: ClassTypingService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['classTypeData'] || changes['classPolyTypingObj']) && this.config) {
      this.ensureInitialized();
    }
  }

  private ensureInitialized(): void {
    let changed = false;
    // Initialize own fields if empty
    if (this.config.ownFields.length === 0 && this.classTypeData) {
      this.config.initializeOwnFields(this.classTypeData);
      changed = true;
    }
    // Initialize referenced objects if empty
    if (this.config.referencedObjects.length === 0) {
      const inheritsFrom = this.classPolyTypingObj?.inheritsFrom;
      this.config.initializeReferencedObjects(this.classTypeData, inheritsFrom);
      changed = true;
    }
    if (changed) {
      this.emitChange();
    }
  }

  // ===== Own Fields =====

  get includedOwnFieldCount(): number {
    return this.config.ownFields.filter(f => f.included).length;
  }

  onOwnFieldToggle(field: OwnFieldEntry, checked: boolean): void {
    field.included = checked;
    this.emitChange();
  }

  toggleAllOwnFields(included: boolean): void {
    this.config.ownFields.forEach(f => f.included = included);
    this.emitChange();
  }

  // ===== Referenced Objects =====

  get enabledRefCount(): number {
    return this.config.referencedObjects.filter(r => r.enabled).length;
  }

  onRefObjectToggle(ref: ReferencedObjectEntry, checked: boolean): void {
    ref.enabled = checked;
    this.emitChange();
  }

  toggleRefPanel(varName: string): void {
    if (this.expandedRefPanels.has(varName)) {
      this.expandedRefPanels.delete(varName);
    } else {
      this.expandedRefPanels.add(varName);
      // Populate fields if not yet loaded
      const ref = this.config.referencedObjects.find(r => r.varName === varName);
      if (ref && ref.fields.length === 0) {
        this.loadReferencedFields(ref);
      }
    }
  }

  isRefPanelExpanded(varName: string): boolean {
    return this.expandedRefPanels.has(varName);
  }

  private loadReferencedFields(ref: ReferencedObjectEntry): void {
    // Get the typing data for the target class from the typing service
    const targetTypingData = this.typingService.polyVarTyping[ref.targetClass];
    if (targetTypingData) {
      this.config.populateReferencedObjectFields(ref.varName, targetTypingData);
      this.emitChange();
    }
  }

  onRefFieldToggle(ref: ReferencedObjectEntry, field: ReferencedFieldEntry, checked: boolean): void {
    field.included = checked;
    this.emitChange();
  }

  toggleAllRefFields(ref: ReferencedObjectEntry, included: boolean): void {
    ref.fields.forEach(f => f.included = included);
    this.emitChange();
  }

  getIncludedRefFieldCount(ref: ReferencedObjectEntry): number {
    if (ref.fields.length === 0) return 0;
    return ref.fields.filter(f => f.included).length;
  }

  getSourceLabel(source: string): string {
    return source === 'parent' ? 'Parent' : 'Reference';
  }

  getSourceIcon(source: string): string {
    return source === 'parent' ? 'account_tree' : 'link';
  }

  // ===== Re-detect =====

  reinitialize(): void {
    this.config.ownFields = [];
    this.config.referencedObjects = [];
    this.expandedRefPanels.clear();
    this.ensureInitialized();
  }

  private emitChange(): void {
    this.configChange.emit(this.config);
  }
}
