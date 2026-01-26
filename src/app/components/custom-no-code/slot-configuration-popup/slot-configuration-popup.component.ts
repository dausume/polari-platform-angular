// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/slot-configuration-popup/slot-configuration-popup.component.ts
import { Component, Input, Output, EventEmitter, OnInit, AfterViewInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';

/**
 * Slot mapping mode for inputs
 */
export type InputMappingMode = 'object_state' | 'function_input';

/**
 * Output trigger type - when the output fires
 * - reactive: Fires when state changes at any point during execution
 * - functional: Fires when the state's operations complete
 */
export type OutputTriggerType = 'reactive' | 'functional';

/**
 * Slot mapping mode for outputs
 *
 * - instance_state: Outputs from source instance property (reactive or functional based on triggerType)
 * - function_return: Return value from function call (functional only)
 * - variable_passthrough: Named variable from input, potentially modified, passed to next state (functional only)
 */
export type OutputMappingMode = 'instance_state' | 'function_return' | 'variable_passthrough';

/**
 * Source instance for state-based outputs
 * - solution_instance: The solution's bound object (e.g., Order)
 * - helper_instance: A helper class instance the state uses
 */
export type OutputSourceInstance = 'solution_instance' | 'helper_instance';

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

  // Output-specific configuration
  /** For outputs: reactive (on change) vs functional (on completion) */
  triggerType?: OutputTriggerType;
  /** For state-based outputs: which instance the output is sourced from */
  sourceInstance?: OutputSourceInstance;
  /** For state-based outputs: the specific property/field path to output */
  propertyPath?: string;
  /** For variable_passthrough: which input variable to forward */
  passthroughVariableName?: string;
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

  // Functional-only output modes (only available when triggerType is 'functional')
  functionalOnlyOutputModes = [
    { value: 'function_return', label: 'Function Return', description: 'Return value from function call' },
    { value: 'variable_passthrough', label: 'Variable Passthrough', description: 'Named variable from input, passed to next state' }
  ];

  // Source instance options for state-based outputs
  sourceInstanceOptions = [
    { value: 'solution_instance', label: 'Solution Instance', description: 'The solution\'s bound object (e.g., Order)' },
    { value: 'helper_instance', label: 'Helper Instance', description: 'A helper class instance this state uses' }
  ];

  // Click outside handler bound reference
  private boundClickOutsideHandler: (event: MouseEvent) => void;

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
    this.boundClickOutsideHandler = this.onClickOutside.bind(this);
  }

  ngOnInit(): void {
    // Move to document.body to escape any parent stacking contexts
    document.body.appendChild(this.hostElement);
    // Create a copy for editing
    this.editedConfig = { ...this.configuration };
    this.adjustedPosition = { ...this.position };

    // Set default trigger type for outputs if not already set
    if (!this.editedConfig.isInput && !this.editedConfig.triggerType) {
      this.editedConfig.triggerType = 'functional';
    }

    // Set default source instance for outputs if not set
    if (!this.editedConfig.isInput && !this.editedConfig.sourceInstance) {
      this.editedConfig.sourceInstance = 'solution_instance';
    }

    // Set default mapping mode for outputs if using old mode values
    if (!this.editedConfig.isInput) {
      const mode = this.editedConfig.mappingMode as string;
      if (mode === 'object_state_signal' || mode === 'object_state_output' || mode === 'function_return') {
        // Migrate old modes to new instance_state mode
        if (mode === 'object_state_signal' || mode === 'object_state_output') {
          this.editedConfig.mappingMode = 'instance_state';
        }
      }
    }

    // Add click outside listener after a small delay to avoid immediate trigger
    setTimeout(() => {
      document.addEventListener('click', this.boundClickOutsideHandler);
    }, 100);
  }

  ngOnDestroy(): void {
    // Remove click outside listener
    document.removeEventListener('click', this.boundClickOutsideHandler);

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
      // Check functional-only modes
      const found = this.functionalOnlyOutputModes.find(m => m.value === mode);
      if (found) return found.label;
      // Check for instance_state
      if (mode === 'instance_state') return 'Instance State';
      return mode;
    }
  }

  /**
   * Get current mapping modes based on slot type
   */
  getCurrentMappingModes() {
    if (this.editedConfig.isInput) {
      return this.inputMappingModes;
    }
    // For outputs, return combined list
    return [
      { value: 'instance_state', label: 'Instance State', description: 'Output from bound object state' },
      ...this.functionalOnlyOutputModes
    ];
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
   * Handle trigger type selection (reactive vs functional)
   */
  onTriggerTypeSelect(triggerType: OutputTriggerType): void {
    this.editedConfig.triggerType = triggerType;
    // When switching to reactive, instance_state is the only option
    if (triggerType === 'reactive') {
      this.editedConfig.mappingMode = 'instance_state';
    }
  }

  /**
   * Handle source instance selection
   */
  onSourceInstanceSelect(source: string): void {
    this.editedConfig.sourceInstance = source as OutputSourceInstance;
  }

  /**
   * Check if the current output mode requires source instance selection
   */
  requiresSourceInstance(): boolean {
    return this.editedConfig.mappingMode === 'instance_state';
  }

  /**
   * Handle click outside popup to close
   */
  private onClickOutside(event: MouseEvent): void {
    if (this.popupContainer && !this.popupContainer.nativeElement.contains(event.target as Node)) {
      this.closed.emit();
    }
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
