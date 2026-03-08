// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/slot-configuration-popup/slot-configuration-popup.component.ts
import { Component, Input, Output, EventEmitter, OnInit, AfterViewInit, OnDestroy, ElementRef, ViewChild, OnChanges, SimpleChanges } from '@angular/core';
import {
  PotentialContext,
  PotentialVariable,
  PotentialObjectType,
  PotentialObjectField,
  CONTROL_FLOW_STATE_TYPES
} from '@models/stateSpace/solutionContext';

/**
 * Slot mapping mode for inputs
 */
export type InputMappingMode = 'object_state' | 'function_input';

/**
 * Slot mapping mode for outputs
 *
 * - proceed_only: Just proceed to next state without passing data
 * - instance_state: Outputs from source instance property
 * - function_return: Return value from function call with selected context values
 * - variable_passthrough: Named variable from input, potentially modified, passed to next state
 * - produced_variable: Output a variable created by this state (e.g., VariableAssignment, MathOperation)
 */
export type OutputMappingMode = 'proceed_only' | 'instance_state' | 'function_return' | 'variable_passthrough' | 'produced_variable';

/**
 * Represents a variable produced by a state (not from upstream context)
 */
export interface ProducedVariable {
  name: string;
  type: string;
}

/**
 * Source instance for state-based outputs
 * - solution_instance: The solution's bound object (e.g., Order)
 * - helper_instance: A helper class instance the state uses
 */
export type OutputSourceInstance = 'solution_instance' | 'helper_instance';

/**
 * Represents a selectable context value for function return
 */
export interface SelectableContextValue {
  name: string;
  type: string;
  source: 'variable' | 'solution_object_field' | 'state_object_field';
  path: string; // Full path for resolution (e.g., 'self.order_id' or variable name)
  displayName: string;
  selected: boolean;
}

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
 * Represents a connection on a slot (either outgoing from output or incoming to input)
 */
export interface SlotConnectionInfo {
  connectorId: number;
  /** The state that owns the output slot (source of the connector) */
  sourceStateName: string;
  sourceSlotIndex: number;
  /** The state that owns the input slot (target of the connector) */
  targetStateName: string;
  targetSlotIndex: number;
}

/**
 * Configuration for a single slot
 */
export interface SlotConfiguration {
  index: number;
  stateName: string;
  isInput: boolean;
  color: string;
  mappingMode: InputMappingMode | OutputMappingMode;
  /** Full name of the slot (unlimited length) */
  name?: string;
  /** Short abbreviation displayed on the visual marker (max 3 characters) */
  label?: string;
  parameterName?: string;
  parameterType?: string;
  returnType?: string;
  description?: string;

  // Output-specific configuration
  /** For state-based outputs: which instance the output is sourced from */
  sourceInstance?: OutputSourceInstance;
  /** For state-based outputs: the specific property/field path to output */
  propertyPath?: string;
  /** For variable_passthrough: which input variable to forward */
  passthroughVariableName?: string;
  /** For function_return: which context values to pass (array of paths) */
  selectedReturnValues?: string[];

  // Conditional output configuration (for ConditionalChain, etc.)
  /** Whether this output is conditional (only fires when its condition is met) */
  isConditional?: boolean;
  /** The condition expression that triggers this output (e.g., "true", "false", "x > 5") */
  conditionExpression?: string;
  /** Human-readable label for the condition (e.g., "If True", "If False", "Default") */
  conditionLabel?: string;
  /** Group ID for exclusive conditional outputs (only one in a group fires) */
  conditionalGroup?: string;
}

/**
 * SlotConfigurationPopupComponent provides UI for configuring a single slot's
 * color, mapping mode, and other properties.
 *
 * Context-Aware Features:
 * - Shows/hides options based on the state's available context
 * - For InitialState: Only Solution Object fields, no flow variables
 * - For functional outputs: Can select which context values to pass
 */
@Component({
  standalone: false,
  selector: 'slot-configuration-popup',
  templateUrl: './slot-configuration-popup.component.html',
  styleUrls: ['./slot-configuration-popup.component.css']
})
export class SlotConfigurationPopupComponent implements OnInit, AfterViewInit, OnDestroy, OnChanges {

  @Input() configuration!: SlotConfiguration;
  @Input() position: { x: number; y: number } = { x: 0, y: 0 };
  /** The context available at this state - determines what options are shown */
  @Input() stateContext: PotentialContext | null = null;
  /** The state class type (e.g., 'InitialState', 'ConditionalChain') */
  @Input() stateClass: string = '';
  /** Variables produced by this state (e.g., new variable from VariableAssignment) */
  @Input() producedVariables: ProducedVariable[] = [];
  /** Connections on this slot (outgoing for outputs, incoming for inputs) */
  @Input() connections: SlotConnectionInfo[] = [];

  @Output() configurationChanged = new EventEmitter<SlotConfiguration>();
  @Output() closed = new EventEmitter<void>();
  /** Emitted when the user requests to remove a connection */
  @Output() connectionRemoved = new EventEmitter<SlotConnectionInfo>();
  /** Emitted when the user requests to delete this slot entirely */
  @Output() slotDeleted = new EventEmitter<SlotConfiguration>();

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

  // Output modes
  functionalOnlyOutputModes = [
    { value: 'proceed_only', label: 'Proceed Only', description: 'Just proceed to next state without passing data' },
    { value: 'function_return', label: 'Function Return', description: 'Return selected values from context' },
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

  // Selectable context values for function return
  selectableContextValues: SelectableContextValue[] = [];

  // Reference to host element for body attachment
  private hostElement: HTMLElement;

  constructor(private elementRef: ElementRef) {
    this.hostElement = this.elementRef.nativeElement;
    this.boundClickOutsideHandler = this.onClickOutside.bind(this);
  }

  ngOnInit(): void {
    // console.log('[SlotConfigPopup] ===== INIT =====');
    // console.log('[SlotConfigPopup] configuration:', this.configuration);
    // console.log('[SlotConfigPopup] stateContext:', this.stateContext);
    // console.log('[SlotConfigPopup] stateClass:', this.stateClass);
    // console.log('[SlotConfigPopup] producedVariables:', this.producedVariables);

    // Move to document.body to escape any parent stacking contexts
    document.body.appendChild(this.hostElement);
    // Create a copy for editing
    this.editedConfig = { ...this.configuration };
    this.adjustedPosition = { ...this.position };

    // Set default source instance for outputs if not set
    if (!this.editedConfig.isInput && !this.editedConfig.sourceInstance) {
      this.editedConfig.sourceInstance = 'solution_instance';
    }

    // Auto-select correct output mode
    if (!this.editedConfig.isInput) {
      const mode = this.editedConfig.mappingMode as string;

      // Migrate legacy mode values
      if (mode === 'object_state_signal' || mode === 'object_state_output') {
        this.editedConfig.mappingMode = 'instance_state';
      }

      // For conditional states, force output mode to proceed_only since
      // conditional outputs are strictly branching (true/false routing).
      if (this.isConditionalState()) {
        this.editedConfig.mappingMode = 'proceed_only';
      } else {
        // For other output slots, if the current mode isn't a valid output mode,
        // default to proceed_only
        const validOutputModes = ['proceed_only', 'instance_state', 'function_return', 'variable_passthrough', 'produced_variable'];
        if (!validOutputModes.includes(this.editedConfig.mappingMode as string)) {
          this.editedConfig.mappingMode = 'proceed_only';
        }
      }
    }

    // Add click outside listener after a small delay to avoid immediate trigger
    setTimeout(() => {
      document.addEventListener('click', this.boundClickOutsideHandler);
    }, 100);

    // Build selectable context values
    this.buildSelectableContextValues();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['stateContext'] || changes['configuration'] || changes['producedVariables']) {
      this.buildSelectableContextValues();
    }
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

  // ==================== Context-Aware Methods ====================

  /**
   * Check if this is a control flow state (InitialState, ConditionalChain, etc.)
   */
  isControlFlowState(): boolean {
    return CONTROL_FLOW_STATE_TYPES.includes(this.stateClass);
  }

  /**
   * Check if this is an InitialState
   */
  isInitialState(): boolean {
    return this.stateClass === 'InitialState' || this.stateClass === 'DirectInvocation';
  }

  /**
   * Check if this is a conditional state (ConditionalChain)
   */
  isConditionalState(): boolean {
    return this.stateClass === 'ConditionalChain';
  }

  /**
   * Check if this is a sub-solution / nested solution state
   */
  isSolutionState(): boolean {
    return this.stateClass.startsWith('Solution_');
  }

  /**
   * Check if context has flow variables (not just solution object)
   */
  hasFlowVariables(): boolean {
    if (!this.stateContext) return false;
    return this.stateContext.variables.size > 0;
  }

  /**
   * Check if state has produced variables (variables it creates itself)
   */
  hasProducedVariables(): boolean {
    const result = this.producedVariables && this.producedVariables.length > 0;
    // console.log('[SlotConfigPopup] hasProducedVariables:', result, 'producedVariables:', this.producedVariables);
    return result;
  }

  /**
   * Check if context has solution object
   */
  hasSolutionObject(): boolean {
    return !!this.stateContext?.solutionObject;
  }

  /**
   * Get available output modes based on state type and context.
   *
   * Filtering rules:
   * - Conditional states (ConditionalChain): outputs are strictly branching (true/false),
   *   only proceed_only is available since they route flow, not data.
   * - Sub-solution / nested solution states: function_return is available (returns from the sub-solution).
   * - All other states: proceed_only, instance_state, variable_passthrough, produced_variable
   *   based on context. function_return is NOT available for regular states.
   */
  getAvailableOutputModes(): { value: string; label: string; description: string }[] {
    // console.log('[SlotConfigPopup] getAvailableOutputModes called');
    // console.log('[SlotConfigPopup] stateClass:', this.stateClass);

    const modes: { value: string; label: string; description: string }[] = [];

    // Conditional states: outputs are strictly branching (true/false).
    // Only proceed_only is meaningful — the output just routes to the next state.
    if (this.isConditionalState()) {
      modes.push({
        value: 'proceed_only',
        label: 'Proceed Only',
        description: 'Branch to the next state based on condition result'
      });
      return modes;
    }

    // Proceed only is always available
    modes.push({
      value: 'proceed_only',
      label: 'Proceed Only',
      description: 'Just proceed to next state without passing data'
    });

    // Instance state is available if we have solution object or state has bound object
    if (this.hasSolutionObject()) {
      modes.push({
        value: 'instance_state',
        label: 'Instance State',
        description: 'Output from bound object\'s state'
      });
    }

    // Function return — only available for sub-solution / nested solution states
    if (this.isSolutionState()) {
      modes.push({
        value: 'function_return',
        label: 'Function Return',
        description: 'Return selected values from the sub-solution'
      });
    }

    // Variable passthrough - only available if we have flow variables
    if (this.hasFlowVariables()) {
      modes.push({
        value: 'variable_passthrough',
        label: 'Variable Passthrough',
        description: 'Pass through a variable from input to output'
      });
    }

    // Produced variable - available if this state creates a variable (e.g., VariableAssignment)
    if (this.hasProducedVariables()) {
      modes.push({
        value: 'produced_variable',
        label: 'Output Created Variable',
        description: 'Output the variable created by this state'
      });
    }

    // console.log('[SlotConfigPopup] Available modes:', modes.map(m => m.value));
    return modes;
  }

  /**
   * Build the list of selectable context values for function return
   */
  buildSelectableContextValues(): void {
    this.selectableContextValues = [];

    if (!this.stateContext) return;

    const selectedPaths = this.editedConfig.selectedReturnValues || [];

    // Add solution object fields
    if (this.stateContext.solutionObject) {
      for (const field of this.stateContext.solutionObject.fields) {
        this.selectableContextValues.push({
          name: field.displayName,
          type: field.type,
          source: 'solution_object_field',
          path: field.path,
          displayName: `${this.stateContext.solutionObject.className}.${field.displayName}`,
          selected: selectedPaths.includes(field.path)
        });
      }
    }

    // Add flow variables (only for non-InitialState)
    if (!this.isInitialState()) {
      for (const variable of this.stateContext.getVariables()) {
        this.selectableContextValues.push({
          name: variable.name,
          type: variable.type,
          source: 'variable',
          path: variable.name,
          displayName: variable.name,
          selected: selectedPaths.includes(variable.name)
        });
      }
    }

    // Add state object fields (from non-solution object types)
    for (const objType of this.stateContext.getObjectTypes()) {
      if (objType.isSolutionObject) continue;

      for (const field of objType.fields) {
        this.selectableContextValues.push({
          name: field.displayName,
          type: field.type,
          source: 'state_object_field',
          path: field.path,
          displayName: `${objType.className}.${field.displayName}`,
          selected: selectedPaths.includes(field.path)
        });
      }
    }

    // Add produced variables (variables this state creates)
    if (this.producedVariables && this.producedVariables.length > 0) {
      for (const pv of this.producedVariables) {
        this.selectableContextValues.push({
          name: pv.name,
          type: pv.type,
          source: 'variable', // Treat as variable for display
          path: pv.name,
          displayName: `${pv.name} (created)`,
          selected: selectedPaths.includes(pv.name)
        });
      }
    }
  }

  /**
   * Toggle selection of a context value for function return
   */
  toggleContextValueSelection(value: SelectableContextValue): void {
    value.selected = !value.selected;
    this.updateSelectedReturnValues();
  }

  /**
   * Update the selectedReturnValues in the config based on selections
   */
  private updateSelectedReturnValues(): void {
    this.editedConfig.selectedReturnValues = this.selectableContextValues
      .filter(v => v.selected)
      .map(v => v.path);
  }

  /**
   * Get flow variables for passthrough selection
   */
  getFlowVariables(): PotentialVariable[] {
    if (!this.stateContext) return [];
    return this.stateContext.getVariables();
  }

  /**
   * Get solution object fields for property path selection
   */
  getSolutionObjectFields(): PotentialObjectField[] {
    if (!this.stateContext?.solutionObject) return [];
    return this.stateContext.solutionObject.fields;
  }

  /**
   * Check if we should show the variable passthrough section
   */
  shouldShowVariablePassthrough(): boolean {
    return this.editedConfig.mappingMode === 'variable_passthrough' && this.hasFlowVariables();
  }

  /**
   * Check if we should show the produced variable section
   */
  shouldShowProducedVariable(): boolean {
    return this.editedConfig.mappingMode === 'produced_variable' && this.hasProducedVariables();
  }

  /**
   * Get the produced variables for selection
   */
  getProducedVariables(): ProducedVariable[] {
    return this.producedVariables || [];
  }

  /**
   * Check if we should show the function return value selector
   */
  shouldShowFunctionReturnSelector(): boolean {
    return this.editedConfig.mappingMode === 'function_return' &&
           this.selectableContextValues.length > 0;
  }

  /**
   * Get context values grouped by source for display
   */
  getContextValuesBySource(): { source: string; label: string; values: SelectableContextValue[] }[] {
    const groups: { source: string; label: string; values: SelectableContextValue[] }[] = [];

    const solutionFields = this.selectableContextValues.filter(v => v.source === 'solution_object_field');
    if (solutionFields.length > 0) {
      groups.push({
        source: 'solution_object_field',
        label: 'Solution Object Fields',
        values: solutionFields
      });
    }

    const variables = this.selectableContextValues.filter(v => v.source === 'variable');
    if (variables.length > 0) {
      groups.push({
        source: 'variable',
        label: 'Flow Variables',
        values: variables
      });
    }

    const stateFields = this.selectableContextValues.filter(v => v.source === 'state_object_field');
    if (stateFields.length > 0) {
      groups.push({
        source: 'state_object_field',
        label: 'State Object Fields',
        values: stateFields
      });
    }

    return groups;
  }

  /**
   * Get count of selected return values
   */
  getSelectedReturnValueCount(): number {
    return this.selectableContextValues.filter(v => v.selected).length;
  }

  // ==================== Conditional Output Methods ====================

  /**
   * Check if this is a conditional output slot
   */
  isConditionalOutput(): boolean {
    return !this.editedConfig.isInput && !!this.editedConfig.isConditional;
  }

  /**
   * Get the condition label for display
   */
  getConditionLabel(): string {
    return this.editedConfig.conditionLabel || 'Conditional';
  }

  /**
   * Get the condition expression for display
   */
  getConditionExpression(): string {
    return this.editedConfig.conditionExpression || '';
  }

  // ==================== Connection Methods ====================

  /**
   * Get the display label for a connection (the "other side" state name)
   */
  getConnectionLabel(conn: SlotConnectionInfo): string {
    if (this.editedConfig.isInput) {
      return conn.sourceStateName;
    }
    return conn.targetStateName;
  }

  /**
   * Get the display detail for a connection (slot index on the other side)
   */
  getConnectionDetail(conn: SlotConnectionInfo): string {
    if (this.editedConfig.isInput) {
      return `Output slot #${conn.sourceSlotIndex}`;
    }
    return `Input slot #${conn.targetSlotIndex}`;
  }

  /**
   * Remove a connection
   */
  onRemoveConnection(conn: SlotConnectionInfo, event: MouseEvent): void {
    event.stopPropagation();
    this.connectionRemoved.emit(conn);
    // Remove from local list so the UI updates immediately
    this.connections = this.connections.filter(c => c.connectorId !== conn.connectorId);
  }

  /**
   * Delete this slot entirely
   */
  onDeleteSlot(): void {
    this.slotDeleted.emit(this.configuration);
    this.closed.emit();
  }
}
