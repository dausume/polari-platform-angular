// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/state-overlay/state-overlay.component.ts
import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import {
  getStateSpaceRegistry,
  StateSpaceClassMetadata,
  StateSpaceClassRegistry,
  getStateSpaceClassesByCategory,
  StateSpaceCategory
} from '../../../models/stateSpace';

/**
 * Display field with enhanced metadata from state-space registry
 */
export interface DisplayField {
  name: string;
  displayName: string;
  value: any;
  type: string;
  isEditable: boolean;
}

/**
 * Class option for autocomplete with category grouping
 */
export interface ClassOption {
  className: string;
  displayName: string;
  category: StateSpaceCategory;
  icon?: string;
  color?: string;
}

/**
 * Bound object information passed to the overlay
 */
export interface BoundObjectInfo {
  className?: string;
  memberType?: 'field' | 'method' | 'state' | 'subsolution';
  memberName?: string;
  fieldName?: string;
  fieldType?: string;
  methodName?: string;
  returnType?: string;
  parameters?: { name: string; type: string }[];
  displayName?: string;
  description?: string;
  subSolutionName?: string;
}

/**
 * StateOverlayComponent is rendered inside the inner rect of a D3 state group.
 * It provides a visual display of the state's bound class and member info.
 *
 * The component automatically scales its fonts and layout based on the
 * available width/height to ensure content fits any state size.
 */
@Component({
  selector: 'state-overlay',
  templateUrl: './state-overlay.component.html',
  styleUrls: ['./state-overlay.component.css']
})
export class StateOverlayComponent implements OnInit, OnDestroy, OnChanges {

  // Position and size (set by StateOverlayManager)
  @Input() x: number = 0;
  @Input() y: number = 0;
  @Input() width: number = 100;
  @Input() height: number = 100;

  // State identification
  @Input() stateName: string = '';

  // Bound class configuration
  @Input() boundClassName: string = '';
  @Input() availableClasses: string[] = [];

  // Bound object information (from NoCodeState.boundObjectFieldValues)
  @Input() boundObjectInfo: BoundObjectInfo | null = null;

  // Slot counts
  @Input() inputSlotCount: number = 0;
  @Input() outputSlotCount: number = 0;

  // Whether this state can be edited (class changed)
  @Input() isEditable: boolean = true;

  // Field display configuration
  @Input() displayFields: DisplayField[] = [];
  @Input() fieldLayout: 'single' | 'double' = 'single';

  // Events
  @Output() classSelected = new EventEmitter<{ className: string; metadata: StateSpaceClassMetadata | undefined }>();
  @Output() fieldChanged = new EventEmitter<{ fieldName: string; value: any }>();
  @Output() overlayClicked = new EventEmitter<void>();
  @Output() fullViewRequested = new EventEmitter<{ x: number; y: number; stateName: string }>();

  // Form controls
  classSearchControl = new FormControl('');
  filteredClasses: ClassOption[] = [];
  allClassOptions: ClassOption[] = [];

  // Current class metadata
  selectedClassMetadata: StateSpaceClassMetadata | undefined;

  // Registry reference
  private registry: StateSpaceClassRegistry;

  // UI state
  isEditing: boolean = false;

  // Size mode flags (set by updateSizeMode based on dimensions)
  isMicro: boolean = false;
  isTiny: boolean = false;
  isCompact: boolean = false;
  isSmall: boolean = false;

  constructor() {
    this.registry = getStateSpaceRegistry();
  }

  ngOnInit(): void {
    this.loadClassOptionsFromRegistry();

    this.classSearchControl.valueChanges.subscribe(searchTerm => {
      this.filterClasses(searchTerm || '');
    });

    if (this.boundClassName) {
      this.classSearchControl.setValue(this.boundClassName);
      this.loadClassMetadata(this.boundClassName);
    }

    this.updateSizeMode();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['boundClassName'] && !changes['boundClassName'].firstChange) {
      const newClassName = changes['boundClassName'].currentValue;
      if (newClassName) {
        this.loadClassMetadata(newClassName);
      }
    }

    if (changes['width'] || changes['height']) {
      this.updateSizeMode();
    }
  }

  ngOnDestroy(): void {}

  // ==================== Title and Subtitle Methods ====================

  /**
   * Get the main title for this state (class name, block type, etc.)
   */
  getStateTitle(): string {
    // Priority: boundObjectInfo > boundClassName > stateName
    if (this.boundObjectInfo) {
      if (this.boundObjectInfo.className) {
        return this.boundObjectInfo.className;
      }
      if (this.boundObjectInfo.subSolutionName) {
        return this.boundObjectInfo.subSolutionName;
      }
    }

    if (this.boundClassName) {
      // Get display name from registry if available
      const metadata = this.registry.getClass(this.boundClassName);
      return metadata?.displayName || this.boundClassName;
    }

    return this.stateName || 'State';
  }

  /**
   * Get the subtitle (function/variable name if applicable)
   */
  getStateSubtitle(): string {
    if (!this.boundObjectInfo) return '';

    if (this.boundObjectInfo.methodName) {
      return `${this.boundObjectInfo.methodName}()`;
    }

    if (this.boundObjectInfo.fieldName) {
      const prefix = this.boundObjectInfo.memberName?.startsWith('set_') ? 'set ' : 'get ';
      return `${prefix}${this.boundObjectInfo.fieldName}`;
    }

    if (this.boundObjectInfo.memberName) {
      return this.boundObjectInfo.memberName;
    }

    if (this.boundObjectInfo.displayName) {
      return this.boundObjectInfo.displayName;
    }

    return '';
  }

  /**
   * Get an icon for this state type
   */
  getStateIcon(): string {
    if (this.selectedClassMetadata?.icon) {
      return this.selectedClassMetadata.icon;
    }

    if (this.boundObjectInfo) {
      if (this.boundObjectInfo.memberType === 'method') return 'functions';
      if (this.boundObjectInfo.memberType === 'field') return 'label';
      if (this.boundObjectInfo.memberType === 'subsolution') return 'account_tree';
    }

    return 'widgets';
  }

  // ==================== Responsive Sizing Methods ====================

  // Size thresholds for different display modes (in screen pixels)
  // These account for zoom levels from 10% to 400%
  private readonly MICRO_THRESHOLD = 30;  // Icon only, no text
  private readonly TINY_THRESHOLD = 50;   // Small icon with minimal info
  private readonly COMPACT_THRESHOLD = 80; // Compact view with title only
  private readonly SMALL_THRESHOLD = 120;  // Small view with title and subtitle
  // Above SMALL_THRESHOLD = full view with fields

  /**
   * Update size mode based on dimensions.
   * Called when width/height change (e.g., during zoom).
   * Can be called externally via forceUpdateSizeMode().
   */
  private updateSizeMode(): void {
    const minDimension = Math.min(this.width, this.height);
    this.isMicro = minDimension < this.MICRO_THRESHOLD;
    this.isTiny = minDimension < this.TINY_THRESHOLD;
    this.isCompact = minDimension < this.COMPACT_THRESHOLD;
    this.isSmall = minDimension < this.SMALL_THRESHOLD;
  }

  /**
   * Force update size mode - called externally when dimensions change
   * without triggering ngOnChanges (e.g., from StateOverlayManager).
   */
  forceUpdateSizeMode(): void {
    this.updateSizeMode();
  }

  /**
   * Calculate title font size based on available space
   */
  getTitleFontSize(): number {
    const baseSize = Math.min(this.width, this.height);
    const fontSize = Math.max(8, Math.min(16, baseSize * 0.14));
    return fontSize;
  }

  /**
   * Calculate subtitle font size
   */
  getSubtitleFontSize(): number {
    const baseSize = Math.min(this.width, this.height);
    const fontSize = Math.max(7, Math.min(12, baseSize * 0.1));
    return fontSize;
  }

  /**
   * Calculate field font size
   */
  getFieldFontSize(): number {
    const baseSize = Math.min(this.width, this.height);
    return Math.max(8, Math.min(11, baseSize * 0.08));
  }

  /**
   * Calculate slot indicator font size
   */
  getSlotFontSize(): number {
    const baseSize = Math.min(this.width, this.height);
    return Math.max(7, Math.min(10, baseSize * 0.07));
  }

  /**
   * Calculate icon size for compact mode
   */
  getIconSize(): number {
    const baseSize = Math.min(this.width, this.height);
    return Math.max(16, Math.min(32, baseSize * 0.5));
  }

  // ==================== Class Loading Methods ====================

  private loadClassOptionsFromRegistry(): void {
    const classesByCategory = getStateSpaceClassesByCategory();
    this.allClassOptions = [];

    classesByCategory.forEach((classes, category) => {
      classes.forEach(metadata => {
        this.allClassOptions.push({
          className: metadata.className,
          displayName: metadata.displayName,
          category: category,
          icon: metadata.icon,
          color: metadata.color
        });
      });
    });

    if (this.availableClasses && this.availableClasses.length > 0) {
      this.availableClasses.forEach(className => {
        if (!this.allClassOptions.find(opt => opt.className === className)) {
          this.allClassOptions.push({
            className,
            displayName: className,
            category: 'Custom',
            icon: 'code',
            color: '#757575'
          });
        }
      });
    }

    this.filteredClasses = [...this.allClassOptions];
  }

  private filterClasses(searchTerm: string): void {
    if (!searchTerm) {
      this.filteredClasses = [...this.allClassOptions];
      return;
    }

    const lowerSearch = searchTerm.toLowerCase();
    this.filteredClasses = this.allClassOptions.filter(opt =>
      opt.className.toLowerCase().includes(lowerSearch) ||
      opt.displayName.toLowerCase().includes(lowerSearch) ||
      opt.category.toLowerCase().includes(lowerSearch)
    );
  }

  private loadClassMetadata(className: string): void {
    this.selectedClassMetadata = this.registry.getClass(className);

    if (this.selectedClassMetadata) {
      this.fieldLayout = this.selectedClassMetadata.stateSpaceFieldsPerRow === 2 ? 'double' : 'single';

      this.displayFields = this.selectedClassMetadata.variables
        .filter(v => this.selectedClassMetadata!.stateSpaceDisplayFields.includes(v.name))
        .map(v => ({
          name: v.name,
          displayName: v.displayName,
          value: v.defaultValue ?? '',
          type: v.type,
          isEditable: v.isEditable
        }));
    }
  }

  // ==================== Event Handlers ====================

  // Note: No @HostListener for click/mousedown - the host has pointer-events: none
  // so D3 events can pass through to the underlying SVG elements.
  // Interactive elements inside have pointer-events: auto and handle their own events.

  /**
   * Handle right-click on the overlay to request full view popup.
   * This is called from interactive elements within the overlay.
   */
  onContextMenu(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.fullViewRequested.emit({
      x: event.clientX,
      y: event.clientY,
      stateName: this.stateName
    });
  }

  onClassSelected(event: MatAutocompleteSelectedEvent): void {
    this.boundClassName = event.option.value;
    this.loadClassMetadata(this.boundClassName);

    this.classSelected.emit({
      className: this.boundClassName,
      metadata: this.selectedClassMetadata
    });

    this.isEditing = false;
  }

  onFieldChange(fieldName: string, event: Event): void {
    const target = event.target as HTMLInputElement;
    this.fieldChanged.emit({ fieldName, value: target.value });
  }

  /**
   * Handle wheel events on the fields area to prevent scroll from propagating
   * to the parent/document when scrolling within the overlay.
   */
  onFieldsWheel(event: WheelEvent): void {
    const target = event.currentTarget as HTMLElement;
    if (!target) return;

    const { scrollTop, scrollHeight, clientHeight } = target;
    const atTop = scrollTop === 0;
    const atBottom = scrollTop + clientHeight >= scrollHeight;

    // Prevent propagation if:
    // - Scrolling up and not at top
    // - Scrolling down and not at bottom
    // - Content is scrollable (has overflow)
    if (scrollHeight > clientHeight) {
      if ((event.deltaY < 0 && !atTop) || (event.deltaY > 0 && !atBottom)) {
        event.stopPropagation();
      } else {
        // At boundary, prevent propagation to avoid page scroll
        event.preventDefault();
        event.stopPropagation();
      }
    }
  }

  toggleEditMode(): void {
    if (!this.isEditable) return;
    this.isEditing = !this.isEditing;
    if (this.isEditing) {
      this.classSearchControl.setValue('');
    }
  }

  // ==================== Helper Methods ====================

  getDisplayLabel(): string {
    return this.boundClassName || this.stateName || 'Select Class';
  }

  hasFields(): boolean {
    return this.displayFields && this.displayFields.length > 0;
  }

  getFieldRows(): DisplayField[][] {
    if (this.fieldLayout === 'single' || !this.hasFields()) {
      return this.displayFields.map(f => [f]);
    }

    const rows: DisplayField[][] = [];
    for (let i = 0; i < this.displayFields.length; i += 2) {
      const row: DisplayField[] = [this.displayFields[i]];
      if (i + 1 < this.displayFields.length) {
        row.push(this.displayFields[i + 1]);
      }
      rows.push(row);
    }
    return rows;
  }

  getCategories(): StateSpaceCategory[] {
    const categories = new Set<StateSpaceCategory>();
    this.filteredClasses.forEach(opt => categories.add(opt.category));
    return Array.from(categories);
  }

  getClassesForCategory(category: StateSpaceCategory): ClassOption[] {
    return this.filteredClasses.filter(opt => opt.category === category);
  }

  trackByClassName(index: number, option: ClassOption): string {
    return option.className;
  }

  getClassIcon(): string {
    return this.selectedClassMetadata?.icon || 'code';
  }

  getClassColor(): string {
    return this.selectedClassMetadata?.color || '#757575';
  }

  getClassCategory(): string {
    return this.selectedClassMetadata?.category || '';
  }
}
