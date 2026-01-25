// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/state-full-view-popup/state-full-view-popup.component.ts
import { Component, Input, Output, EventEmitter, OnInit, AfterViewInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import {
  getStateSpaceRegistry,
  StateSpaceClassRegistry,
  StateSpaceClassMetadata
} from '../../../models/stateSpace';

export interface ClassOption {
  className: string;
  displayName: string;
  category: string;
  icon?: string;
  color?: string;
}

export interface DisplayField {
  name: string;
  displayName: string;
  type: string;
  value: any;
  isEditable: boolean;
}

/**
 * StateFullViewPopupComponent displays a full-size view of a state overlay
 * as a popup, useful when the overlay is zoomed out too small to interact with.
 */
@Component({
  selector: 'state-full-view-popup',
  templateUrl: './state-full-view-popup.component.html',
  styleUrls: ['./state-full-view-popup.component.css']
})
export class StateFullViewPopupComponent implements OnInit, AfterViewInit, OnDestroy {

  // Position
  @Input() position: { x: number; y: number } = { x: 0, y: 0 };

  // State data (same as state-overlay inputs)
  @Input() stateName: string = '';
  @Input() stateType: 'object' | 'function' | 'variable' | 'block' | 'solution' = 'object';
  @Input() boundClassName: string = '';
  @Input() functionName: string = '';
  @Input() variableName: string = '';
  @Input() solutionName: string = '';
  @Input() availableClasses: ClassOption[] = [];
  @Input() isEditable: boolean = true;
  @Input() inputSlotCount: number = 0;
  @Input() outputSlotCount: number = 0;
  @Input() displayFields: DisplayField[] = [];

  // Events
  @Output() classSelected = new EventEmitter<{ className: string; metadata: StateSpaceClassMetadata | undefined }>();
  @Output() fieldChanged = new EventEmitter<{ fieldName: string; value: any }>();
  @Output() closed = new EventEmitter<void>();

  @ViewChild('popupContainer') popupContainer!: ElementRef<HTMLDivElement>;

  // Adjusted position after viewport correction
  adjustedPosition: { x: number; y: number } = { x: 0, y: 0 };

  // Form controls
  classSearchControl = new FormControl('');
  filteredClasses: ClassOption[] = [];

  // UI state
  isEditing: boolean = false;

  // Registry reference
  private registry: StateSpaceClassRegistry;
  private selectedClassMetadata: StateSpaceClassMetadata | undefined;

  // Reference to host element for body attachment
  private hostElement: HTMLElement;

  constructor(private elementRef: ElementRef) {
    this.registry = getStateSpaceRegistry();
    this.hostElement = this.elementRef.nativeElement;
  }

  ngOnInit(): void {
    // Move this component to document.body to escape any parent stacking contexts
    // This ensures the popup appears above overlay components (which are also on body)
    document.body.appendChild(this.hostElement);
    this.loadClassOptionsFromRegistry();
    this.filteredClasses = this.availableClasses;

    this.classSearchControl.valueChanges.subscribe(searchTerm => {
      this.filterClasses(searchTerm || '');
    });

    if (this.boundClassName) {
      this.loadClassMetadata(this.boundClassName);
    }

    this.adjustedPosition = { ...this.position };
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.adjustPositionToViewport(), 0);
  }

  ngOnDestroy(): void {
    // Remove from document.body when component is destroyed
    if (this.hostElement && this.hostElement.parentElement === document.body) {
      document.body.removeChild(this.hostElement);
    }
  }

  private adjustPositionToViewport(): void {
    if (!this.popupContainer) return;

    const popup = this.popupContainer.nativeElement;
    const rect = popup.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 16;

    let newX = this.position.x;
    let newY = this.position.y;

    // Check right edge
    if (newX + rect.width > viewportWidth - padding) {
      newX = viewportWidth - rect.width - padding;
    }

    // Check bottom edge
    if (newY + rect.height > viewportHeight - padding) {
      newY = viewportHeight - rect.height - padding;
    }

    // Check left edge
    if (newX < padding) {
      newX = padding;
    }

    // Check top edge
    if (newY < padding) {
      newY = padding;
    }

    this.adjustedPosition = { x: newX, y: newY };
  }

  private loadClassOptionsFromRegistry(): void {
    const classes = this.registry.getAllClasses();
    this.availableClasses = classes.map(cls => ({
      className: cls.className,
      displayName: cls.displayName || cls.className,
      category: cls.category || 'General',
      icon: cls.icon,
      color: cls.color
    }));
    this.filteredClasses = this.availableClasses;
  }

  private filterClasses(searchTerm: string): void {
    if (!searchTerm) {
      this.filteredClasses = this.availableClasses;
      return;
    }
    const term = searchTerm.toLowerCase();
    this.filteredClasses = this.availableClasses.filter(cls =>
      cls.displayName.toLowerCase().includes(term) ||
      cls.className.toLowerCase().includes(term) ||
      cls.category.toLowerCase().includes(term)
    );
  }

  private loadClassMetadata(className: string): void {
    this.selectedClassMetadata = this.registry.getClass(className);
  }

  // ==================== Display Methods ====================

  getStateTitle(): string {
    switch (this.stateType) {
      case 'function':
        return this.functionName || 'Function';
      case 'variable':
        return this.variableName || 'Variable';
      case 'block':
        return 'Code Block';
      case 'solution':
        return this.solutionName || 'Sub-Solution';
      case 'object':
      default:
        return this.boundClassName || 'Select Class';
    }
  }

  getStateSubtitle(): string {
    switch (this.stateType) {
      case 'function':
        return this.boundClassName || '';
      case 'variable':
        return this.boundClassName || '';
      case 'object':
        return this.selectedClassMetadata?.category || '';
      default:
        return '';
    }
  }

  getStateIcon(): string {
    if (this.selectedClassMetadata?.icon) {
      return this.selectedClassMetadata.icon;
    }

    switch (this.stateType) {
      case 'function': return 'functions';
      case 'variable': return 'data_object';
      case 'block': return 'code';
      case 'solution': return 'account_tree';
      case 'object':
      default: return 'widgets';
    }
  }

  hasFields(): boolean {
    return this.displayFields && this.displayFields.length > 0;
  }

  getCategories(): string[] {
    const categories = new Set(this.filteredClasses.map(c => c.category));
    return Array.from(categories).sort();
  }

  getClassesForCategory(category: string): ClassOption[] {
    return this.filteredClasses.filter(c => c.category === category);
  }

  trackByClassName(index: number, item: ClassOption): string {
    return item.className;
  }

  // ==================== Event Handlers ====================

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

  toggleEditMode(): void {
    if (!this.isEditable) return;
    this.isEditing = !this.isEditing;
    if (this.isEditing) {
      this.classSearchControl.setValue('');
    }
  }

  onClose(): void {
    this.closed.emit();
  }

  onPopupClick(event: MouseEvent): void {
    event.stopPropagation();
  }
}
