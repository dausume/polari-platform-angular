// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/slot-configuration-popup/slot-configuration-popup.component.ts
import { Component, Input, Output, EventEmitter, OnInit, AfterViewInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';

/**
 * Slot mapping mode for inputs
 */
export type InputMappingMode = 'object_state' | 'function_input';

/**
 * Slot mapping mode for outputs
 */
export type OutputMappingMode = 'state_change' | 'function_return';

/**
 * Color options for slots
 */
export const SLOT_COLORS = [
  { name: 'Blue', value: '#2196f3' },
  { name: 'Green', value: '#4caf50' },
  { name: 'Red', value: '#f44336' },
  { name: 'Orange', value: '#ff9800' },
  { name: 'Purple', value: '#9c27b0' },
  { name: 'Teal', value: '#009688' },
  { name: 'Pink', value: '#e91e63' },
  { name: 'Indigo', value: '#3f51b5' },
  { name: 'Gray', value: '#757575' },
  { name: 'White', value: '#ffffff' }
];

/**
 * Configuration for a single slot
 */
export interface SlotConfiguration {
  index: number;
  stateName: string;
  isInput: boolean;
  color: string;
  mappingMode: InputMappingMode | OutputMappingMode;
  label?: string;
  parameterName?: string;
  parameterType?: string;
  returnType?: string;
  description?: string;
}

/**
 * SlotConfigurationPopupComponent provides UI for configuring a single slot's
 * color, mapping mode, and other properties.
 */
@Component({
  selector: 'slot-configuration-popup',
  templateUrl: './slot-configuration-popup.component.html',
  styleUrls: ['./slot-configuration-popup.component.css']
})
export class SlotConfigurationPopupComponent implements OnInit, AfterViewInit, OnDestroy {

  @Input() configuration!: SlotConfiguration;
  @Input() position: { x: number; y: number } = { x: 0, y: 0 };

  @Output() configurationChanged = new EventEmitter<SlotConfiguration>();
  @Output() closed = new EventEmitter<void>();

  @ViewChild('popupContainer') popupContainer!: ElementRef<HTMLDivElement>;

  // Adjusted position after viewport correction
  adjustedPosition: { x: number; y: number } = { x: 0, y: 0 };

  // Available colors
  slotColors = SLOT_COLORS;

  // Input mapping modes
  inputMappingModes = [
    { value: 'object_state', label: 'Object Instance State', description: 'Map input to an object instance property' },
    { value: 'function_input', label: 'Function Input Parameter', description: 'Map input to a function parameter' }
  ];

  // Output mapping modes
  outputMappingModes = [
    { value: 'state_change', label: 'State Change Impulse', description: 'Trigger output when object state changes' },
    { value: 'function_return', label: 'Function Return Value', description: 'Map function return value to output' }
  ];

  // Local copy for editing
  editedConfig: SlotConfiguration = {
    index: 0,
    stateName: '',
    isInput: true,
    color: '#2196f3',
    mappingMode: 'object_state'
  };

  // Reference to host element for body attachment
  private hostElement: HTMLElement;

  constructor(private elementRef: ElementRef) {
    this.hostElement = this.elementRef.nativeElement;
  }

  ngOnInit(): void {
    // Move to document.body to escape any parent stacking contexts
    document.body.appendChild(this.hostElement);
    // Create a copy for editing
    this.editedConfig = { ...this.configuration };
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
   * Get the display name for a mapping mode
   */
  getMappingModeLabel(mode: string): string {
    if (this.editedConfig.isInput) {
      const found = this.inputMappingModes.find(m => m.value === mode);
      return found?.label || mode;
    } else {
      const found = this.outputMappingModes.find(m => m.value === mode);
      return found?.label || mode;
    }
  }

  /**
   * Get current mapping modes based on slot type
   */
  getCurrentMappingModes() {
    return this.editedConfig.isInput ? this.inputMappingModes : this.outputMappingModes;
  }

  /**
   * Handle color selection
   */
  onColorSelect(color: string): void {
    this.editedConfig.color = color;
  }

  /**
   * Handle mapping mode selection
   */
  onMappingModeSelect(mode: string): void {
    this.editedConfig.mappingMode = mode as InputMappingMode | OutputMappingMode;
  }

  /**
   * Save and close
   */
  onSave(): void {
    this.configurationChanged.emit(this.editedConfig);
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
}
