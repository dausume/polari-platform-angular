// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/state-slot-manager-popup/state-slot-manager-popup.component.ts
import { Component, Input, Output, EventEmitter, OnInit, AfterViewInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { SlotConfiguration, InputMappingMode, OutputMappingMode, SLOT_COLORS } from '../slot-configuration-popup/slot-configuration-popup.component';

/**
 * Default slot configuration for the solution
 */
export interface SolutionSlotDefaults {
  inputColor: string;
  outputColor: string;
  inputMappingMode: InputMappingMode;
  outputMappingMode: OutputMappingMode;
}

/**
 * State slot manager configuration
 */
export interface StateSlotManagerConfig {
  stateName: string;
  inputSlots: SlotConfiguration[];
  outputSlots: SlotConfiguration[];
  useDefaults: boolean;
}

/**
 * StateSlotManagerPopupComponent provides UI for managing all slots on a state,
 * with separate sections for input and output slots.
 */
@Component({
  selector: 'state-slot-manager-popup',
  templateUrl: './state-slot-manager-popup.component.html',
  styleUrls: ['./state-slot-manager-popup.component.css']
})
export class StateSlotManagerPopupComponent implements OnInit, AfterViewInit, OnDestroy {

  @Input() stateName: string = '';
  @Input() inputSlots: SlotConfiguration[] = [];
  @Input() outputSlots: SlotConfiguration[] = [];
  @Input() solutionDefaults: SolutionSlotDefaults = {
    inputColor: '#2196f3',
    outputColor: '#4caf50',
    inputMappingMode: 'object_state',
    outputMappingMode: 'function_return'
  };
  @Input() position: { x: number; y: number } = { x: 0, y: 0 };

  @Output() slotsChanged = new EventEmitter<StateSlotManagerConfig>();
  @Output() slotConfigRequested = new EventEmitter<SlotConfiguration>();
  @Output() closed = new EventEmitter<void>();

  @ViewChild('popupContainer') popupContainer!: ElementRef<HTMLDivElement>;

  // Adjusted position after viewport correction
  adjustedPosition: { x: number; y: number } = { x: 0, y: 0 };

  // Color options
  slotColors = SLOT_COLORS;

  // Editing state
  editedInputSlots: SlotConfiguration[] = [];
  editedOutputSlots: SlotConfiguration[] = [];
  useDefaults: boolean = true;

  // Expanded sections
  inputSectionExpanded = true;
  outputSectionExpanded = true;

  // Reference to host element for body attachment
  private hostElement: HTMLElement;

  constructor(private elementRef: ElementRef) {
    this.hostElement = this.elementRef.nativeElement;
  }

  ngOnInit(): void {
    // Move to document.body to escape any parent stacking contexts
    document.body.appendChild(this.hostElement);
    // Clone slots for editing
    this.editedInputSlots = this.inputSlots.map(s => ({ ...s }));
    this.editedOutputSlots = this.outputSlots.map(s => ({ ...s }));
    this.adjustedPosition = { ...this.position };
  }

  ngOnDestroy(): void {
    // Remove from document.body when component is destroyed
    if (this.hostElement && this.hostElement.parentElement === document.body) {
      document.body.removeChild(this.hostElement);
    }
  }

  ngAfterViewInit(): void {
    // Adjust position after the popup is rendered to ensure it's fully visible
    setTimeout(() => this.adjustPositionToViewport(), 0);
  }

  /**
   * Adjust the popup position to ensure it's fully visible within the viewport
   */
  private adjustPositionToViewport(): void {
    if (!this.popupContainer) return;

    const popup = this.popupContainer.nativeElement;
    const rect = popup.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 16; // Minimum padding from viewport edges

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

  /**
   * Add a new input slot
   */
  addInputSlot(): void {
    const newSlot: SlotConfiguration = {
      index: this.editedInputSlots.length,
      stateName: this.stateName,
      isInput: true,
      color: this.useDefaults ? this.solutionDefaults.inputColor : '#2196f3',
      mappingMode: this.useDefaults ? this.solutionDefaults.inputMappingMode : 'object_state'
    };
    this.editedInputSlots.push(newSlot);
  }

  /**
   * Add a new output slot
   */
  addOutputSlot(): void {
    const newSlot: SlotConfiguration = {
      index: this.editedOutputSlots.length,
      stateName: this.stateName,
      isInput: false,
      color: this.useDefaults ? this.solutionDefaults.outputColor : '#4caf50',
      mappingMode: this.useDefaults ? this.solutionDefaults.outputMappingMode : 'function_return'
    };
    this.editedOutputSlots.push(newSlot);
  }

  /**
   * Remove an input slot
   */
  removeInputSlot(index: number): void {
    this.editedInputSlots.splice(index, 1);
    // Re-index remaining slots
    this.editedInputSlots.forEach((slot, i) => slot.index = i);
  }

  /**
   * Remove an output slot
   */
  removeOutputSlot(index: number): void {
    this.editedOutputSlots.splice(index, 1);
    // Re-index remaining slots
    this.editedOutputSlots.forEach((slot, i) => slot.index = i);
  }

  /**
   * Open detailed configuration for a slot
   */
  configureSlot(slot: SlotConfiguration): void {
    this.slotConfigRequested.emit(slot);
  }

  /**
   * Update slot color directly from the manager
   */
  setSlotColor(slot: SlotConfiguration, color: string): void {
    slot.color = color;
  }

  /**
   * Toggle use defaults
   */
  onUseDefaultsChange(): void {
    if (this.useDefaults) {
      // Apply defaults to all slots
      this.editedInputSlots.forEach(slot => {
        slot.color = this.solutionDefaults.inputColor;
        slot.mappingMode = this.solutionDefaults.inputMappingMode;
      });
      this.editedOutputSlots.forEach(slot => {
        slot.color = this.solutionDefaults.outputColor;
        slot.mappingMode = this.solutionDefaults.outputMappingMode;
      });
    }
  }

  /**
   * Get mapping mode display name
   */
  getMappingModeLabel(mode: string, isInput: boolean): string {
    if (isInput) {
      switch (mode) {
        case 'object_state': return 'Object State';
        case 'function_input': return 'Function Input';
        default: return mode;
      }
    } else {
      switch (mode) {
        case 'state_change': return 'State Change';
        case 'function_return': return 'Function Return';
        default: return mode;
      }
    }
  }

  /**
   * Save changes and close
   */
  onSave(): void {
    this.slotsChanged.emit({
      stateName: this.stateName,
      inputSlots: this.editedInputSlots,
      outputSlots: this.editedOutputSlots,
      useDefaults: this.useDefaults
    });
    this.closed.emit();
  }

  /**
   * Cancel and close
   */
  onCancel(): void {
    this.closed.emit();
  }

  /**
   * Stop propagation to prevent closing when clicking inside
   */
  onPopupClick(event: MouseEvent): void {
    event.stopPropagation();
  }

  /**
   * Toggle section expansion
   */
  toggleInputSection(): void {
    this.inputSectionExpanded = !this.inputSectionExpanded;
  }

  toggleOutputSection(): void {
    this.outputSectionExpanded = !this.outputSectionExpanded;
  }
}
