// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/state-page-popup/state-page-popup.component.ts
import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ElementRef, HostListener } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import {
  getStateSpaceRegistry,
  StateSpaceClassRegistry,
  StateSpaceClassMetadata
} from '../../../models/stateSpace';
import { ClassOption, DisplayField } from '../state-overlay/state-overlay.component';
import { NoCodeState } from '../../../models/noCode/NoCodeState';
import { TargetRuntime } from '../../../models/noCode/mock-NCS-data';

/**
 * Connection info for a single slot connection (input or output)
 */
export interface StateConnectionInfo {
  slotIndex: number;
  slotName: string;
  dataType: string;
  connectedStateName: string;
  connectedSlotIndex: number;
  isRequired?: boolean;
}

/**
 * StatePagePopupComponent displays a near-full-screen page-like view of a state,
 * showing inputs, state detail, and outputs in a three-column layout.
 */
@Component({
  standalone: false,
  selector: 'state-page-popup',
  templateUrl: './state-page-popup.component.html',
  styleUrls: ['./state-page-popup.component.css']
})
export class StatePagePopupComponent implements OnInit, OnDestroy {

  // State data
  @Input() stateInstance!: NoCodeState;
  @Input() targetRuntime: TargetRuntime = 'python_backend';
  @Input() boundClassMetadata: StateSpaceClassMetadata | null = null;
  @Input() inputConnections: StateConnectionInfo[] = [];
  @Input() outputConnections: StateConnectionInfo[] = [];
  @Input() displayFields: DisplayField[] = [];
  @Input() availableClasses: ClassOption[] = [];

  // Events
  @Output() closed = new EventEmitter<void>();
  @Output() classSelected = new EventEmitter<{ className: string; metadata: StateSpaceClassMetadata | undefined }>();
  @Output() fieldChanged = new EventEmitter<{ fieldName: string; value: any }>();

  // Form controls
  classSearchControl = new FormControl('');
  filteredClasses: ClassOption[] = [];

  // UI state
  isEditing = false;

  // Registry reference
  private registry: StateSpaceClassRegistry;
  private hostElement: HTMLElement;

  constructor(private elementRef: ElementRef) {
    this.registry = getStateSpaceRegistry();
    this.hostElement = this.elementRef.nativeElement;
  }

  ngOnInit(): void {
    // Move to document.body to escape any parent stacking contexts
    document.body.appendChild(this.hostElement);

    this.filteredClasses = this.availableClasses;

    this.classSearchControl.valueChanges.subscribe(searchTerm => {
      this.filterClasses(searchTerm || '');
    });
  }

  ngOnDestroy(): void {
    if (this.hostElement && this.hostElement.parentElement === document.body) {
      document.body.removeChild(this.hostElement);
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.close();
  }

  // ==================== Display Methods ====================

  getStateTitle(): string {
    if (this.boundClassMetadata) {
      return this.boundClassMetadata.displayName || this.boundClassMetadata.className;
    }
    return this.stateInstance?.boundObjectClass || this.stateInstance?.stateClass || 'State';
  }

  getStateSubtitle(): string {
    return this.boundClassMetadata?.category || '';
  }

  getStateIcon(): string {
    return this.boundClassMetadata?.icon || 'widgets';
  }

  getStateDescription(): string {
    return this.boundClassMetadata?.description || '';
  }

  getStateName(): string {
    return this.stateInstance?.stateName || '';
  }

  getShapeType(): string {
    return this.stateInstance?.shapeType || 'circle';
  }

  getSolutionName(): string {
    return this.stateInstance?.solutionName || '';
  }

  getInputSlotCount(): number {
    if (!this.stateInstance?.slots) return 0;
    return this.stateInstance.slots.filter(s => s.isInput).length;
  }

  getOutputSlotCount(): number {
    if (!this.stateInstance?.slots) return 0;
    return this.stateInstance.slots.filter(s => !s.isInput).length;
  }

  hasFields(): boolean {
    return this.displayFields && this.displayFields.length > 0;
  }

  hasInputConnections(): boolean {
    return this.inputConnections && this.inputConnections.length > 0;
  }

  hasOutputConnections(): boolean {
    return this.outputConnections && this.outputConnections.length > 0;
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

  trackBySlotIndex(index: number, item: StateConnectionInfo): number {
    return item.slotIndex;
  }

  // ==================== Event Handlers ====================

  onClassSelected(event: MatAutocompleteSelectedEvent): void {
    const className = event.option.value;
    const metadata = this.registry.getClass(className);

    this.classSelected.emit({ className, metadata });
    this.isEditing = false;
  }

  onFieldChange(fieldName: string, event: Event): void {
    const target = event.target as HTMLInputElement;
    this.fieldChanged.emit({ fieldName, value: target.value });
  }

  toggleEditMode(): void {
    this.isEditing = !this.isEditing;
    if (this.isEditing) {
      this.classSearchControl.setValue('');
    }
  }

  close(): void {
    this.closed.emit();
  }

  onBackdropClick(): void {
    this.close();
  }

  onContainerClick(event: MouseEvent): void {
    event.stopPropagation();
  }

  // ==================== Runtime Methods ====================

  getRuntimeLabel(): string {
    return this.targetRuntime === 'typescript_frontend' ? 'Frontend (TS)' : 'Backend (Python)';
  }

  getRuntimeIcon(): string {
    return this.targetRuntime === 'typescript_frontend' ? 'web' : 'dns';
  }

  isCrossRuntimeBlock(): boolean {
    const className = this.stateInstance?.boundObjectClass || this.stateInstance?.stateClass || '';
    return className === 'AwaitBackendCall' || className === 'EmitFrontendEvent';
  }

  getCrossRuntimeDirection(): string {
    const className = this.stateInstance?.boundObjectClass || this.stateInstance?.stateClass || '';
    if (className === 'AwaitBackendCall') {
      return 'Frontend → Backend';
    }
    if (className === 'EmitFrontendEvent') {
      return 'Backend → Frontend';
    }
    return '';
  }

  getCrossRuntimeTargetSolution(): string {
    return this.stateInstance?.boundObjectFieldValues?.['targetSolutionName'] || '(not set)';
  }

  // ==================== Private Methods ====================

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
}
