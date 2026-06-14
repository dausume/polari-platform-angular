// Author: Dustin Etts
// Custom overlay component for InitialState types
// Displays the Solution Object information and provides trigger type selector

import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { InitialStateTriggerType, getAvailableInitialStateTypes, StateSpaceClassRegistry } from '@models/stateSpace';
import { TargetRuntime } from '@models/noCode/mock-NCS-data';
import { StateOverlayBase } from '../../_shared/state-overlay/state-overlay-base';
import { SimulationRunService } from '@services/sim-space/simulation-run.service';
import { ClassTypingService } from '@services/class-typing-service';

/** One entry of incoming-context info shown in the
 *  SimulationStateStep overlay — what's in the engine's context
 *  when this solution starts running. */
export interface SimStepIncomingField {
  name: string;
  type: string;
  origin: 'prev-row' | 'param' | 'step';
  originHint: string;
}

/** One simulation that uses this step solution. */
export interface LinkedSimulationEntry {
  solutionRowName: string;
  simulationRef: string;
  simStateClassName: string;
}

/**
 * Solution Object field definition
 */
export interface SolutionField {
  name: string;
  displayName: string;
  type: string;
  defaultValue?: any;
  description?: string;
}

/**
 * Trigger type option for dropdown display
 */
export interface TriggerTypeOption {
  type: InitialStateTriggerType;
  label: string;
  icon: string;
  color: string;
}

/**
 * InitialStateOverlayComponent displays the Solution Object context
 * and provides a trigger type selector for changing initial state type.
 */
@Component({
  standalone: false,
  selector: 'initial-state-overlay',
  templateUrl: './initial-state-overlay.component.html',
  styleUrls: ['./initial-state-overlay.component.css']
})
export class InitialStateOverlayComponent extends StateOverlayBase implements OnInit, OnDestroy, OnChanges {

  // State-specific inputs (standard inputs come from StateOverlayBase)
  @Input() boundClassName: string = 'DirectInvocation';

  // Solution information
  @Input() solutionName: string = '';
  @Input() solutionClassName: string = '';
  @Input() solutionDescription: string = '';

  // Solution Object fields
  @Input() solutionFields: SolutionField[] = [];

  // Input parameters defined for this initial state
  @Input() inputParams: { name: string; type: string; description?: string }[] = [];

  // Trigger type management
  @Input() currentTriggerType: InitialStateTriggerType = 'direct_invocation';
  @Input() targetRuntime: TargetRuntime = 'python_backend';
  @Output() triggerTypeChanged = new EventEmitter<InitialStateTriggerType>();

  // Bound field values for type-specific fields
  @Input() boundObjectFieldValues: { [key: string]: any } = {};
  @Output() fieldValueChanged = new EventEmitter<{ fieldName: string; value: any }>();

  // Linked parent solutions (auto-detected for logic_flow_entry)
  @Input() linkedParentSolutions: { name: string; stateName: string; linkType: string }[] = [];

  // (fullViewRequested / popupRequested / statePageRequested come from base)

  // Available trigger type options (computed from runtime)
  triggerTypeOptions: TriggerTypeOption[] = [];

  // Whether the trigger type dropdown is open
  showTypeSelector: boolean = false;

  // Size mode flags
  isCompact: boolean = false;
  isSmall: boolean = false;

  // Scroll state for field list
  showAllFields: boolean = false;
  maxVisibleFields: number = 4;

  private registry = StateSpaceClassRegistry.getInstance();

  /** Computed display lists for the SimulationStateStep branch. */
  simStepIncomingContext: SimStepIncomingField[] = [];
  linkedSimulations: LinkedSimulationEntry[] = [];

  constructor(
    private simRunService: SimulationRunService,
    private typingService: ClassTypingService,
  ) {
    super();
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.updateSizeMode();
    this.updateTriggerTypeOptions();
    this.refreshSimulationStepLists();
  }

  ngOnDestroy(): void {}

  /** Handle Coding Comment edits from the shared shell footer.
   *  Persists into boundObjectFieldValues so the comment round-trips
   *  through saves like every other field. */
  onCodingCommentChange(value: string): void {
    if (!this.boundObjectFieldValues) {
      this.boundObjectFieldValues = {};
    }
    this.boundObjectFieldValues['codingComment'] = value;
    this.fieldValueChanged.emit({ fieldName: 'codingComment', value });
  }

  override ngOnChanges(changes: SimpleChanges): void {
    super.ngOnChanges(changes);
    if (changes['targetRuntime']) {
      this.updateTriggerTypeOptions();
    }
    if (changes['width'] || changes['height']) {
      this.updateSizeMode();
    }
    if (changes['currentTriggerType']
        || changes['solutionName']
        || changes['boundObjectFieldValues']) {
      this.refreshSimulationStepLists();
    }
  }

  /** Build incoming-context + linked-simulations lists when the
   *  overlay is rendering a SimulationStateStep. Quietly clears them
   *  for other trigger types so we don't show stale data when the
   *  user flips between types. */
  private async refreshSimulationStepLists(): Promise<void> {
    if (this.currentTriggerType !== 'simulation_state_step') {
      this.simStepIncomingContext = [];
      this.linkedSimulations = [];
      return;
    }
    this.simStepIncomingContext = this.buildSimStepIncomingContext();
    if (!this.solutionName) {
      this.linkedSimulations = [];
      return;
    }
    try {
      const rows = await this.simRunService.simulationsUsingSolution(this.solutionName);
      this.linkedSimulations = rows.map(r => ({
        solutionRowName: r.solutionRowName,
        simulationRef: r.simulationRef,
        simStateClassName: r.simStateClassName,
      }));
    } catch {
      this.linkedSimulations = [];
    }
  }

  /** Walk the declared `expectedFields` on the SimulationStateStep
   *  and tag each one with its likely origin. Field names that match
   *  the target *SimState class's variable typing get a `prev-row`
   *  badge with the resolved type; common simulation params (g, L,
   *  mass, …) get `param`; dt / time / step get the `step` tag. */
  private buildSimStepIncomingContext(): SimStepIncomingField[] {
    const expected = (this.boundObjectFieldValues?.['expectedFields'] as string[]) || [];
    if (!expected.length) return [];
    const targetClass = this.boundObjectFieldValues?.['simStateClassName'] as string || '';
    const classTyping = targetClass
      ? (this.typingService.polyTyping as any)[targetClass]
      : undefined;
    const fieldTyping = (classTyping?.completeVariableTypingData ?? {}) as Record<string, any>;
    const stepMetaSet = new Set(['dt', 'time', 'step']);
    return expected.map(name => {
      if (stepMetaSet.has(name)) {
        return {
          name,
          type: name === 'step' ? 'int' : 'float',
          origin: 'step' as const,
          originHint: 'Set by the SimulationRunner each tick (dt, time, step).',
        };
      }
      const fieldInfo = fieldTyping[name];
      if (fieldInfo) {
        const t = (fieldInfo.variablePythonType || fieldInfo.variableFrontendType || 'unknown').toString();
        return {
          name,
          type: t,
          origin: 'prev-row' as const,
          originHint: `Value of ${targetClass}.${name} at the previous step (or initial conditions at step 0).`,
        };
      }
      return {
        name,
        type: 'float',
        origin: 'param' as const,
        originHint: 'Simulation parameter read from SimulationDefinition.parameters_json.',
      };
    });
  }

  /**
   * Build the list of available trigger type options from the runtime
   */
  private updateTriggerTypeOptions(): void {
    const availableTypes = getAvailableInitialStateTypes(this.targetRuntime);
    this.triggerTypeOptions = availableTypes.map(type => {
      const metadata = this.getMetadataForTriggerType(type);
      return {
        type,
        label: metadata?.displayName || this.getTriggerTypeLabel(type),
        icon: metadata?.icon || 'play_circle',
        color: metadata?.color || '#4CAF50'
      };
    });
  }

  /**
   * Get registry metadata for a trigger type
   */
  private getMetadataForTriggerType(type: InitialStateTriggerType) {
    const classNameMap: { [key in InitialStateTriggerType]: string } = {
      'direct_invocation': 'DirectInvocation',
      'form_subscription': 'FormSubscription',
      'logic_flow_entry': 'LogicFlowEntry',
      'backend_state_change': 'BackendStateChange',
      'simulation_state_step': 'SimulationStateStep',
      'initial_conditions_validator': 'InitialConditionsValidatorEntry',
    };
    return this.registry.getClass(classNameMap[type]);
  }

  /**
   * Fallback labels for trigger types
   */
  private getTriggerTypeLabel(type: InitialStateTriggerType): string {
    const labels: { [key in InitialStateTriggerType]: string } = {
      'direct_invocation': 'Direct Invocation',
      'form_subscription': 'Form Subscription',
      'logic_flow_entry': 'Logic Flow Entry',
      'backend_state_change': 'Backend State Change',
      'simulation_state_step': 'Simulation State Step',
      'initial_conditions_validator': 'Initial Conditions Validator',
    };
    return labels[type];
  }

  /**
   * Get the current trigger type option
   */
  getCurrentTriggerOption(): TriggerTypeOption | undefined {
    return this.triggerTypeOptions.find(opt => opt.type === this.currentTriggerType);
  }

  /**
   * Handle trigger type selection from dropdown
   */
  onTriggerTypeChange(newType: InitialStateTriggerType): void {
    if (newType !== this.currentTriggerType) {
      this.currentTriggerType = newType;
      this.triggerTypeChanged.emit(newType);
    }
    this.showTypeSelector = false;
  }

  /**
   * Toggle the trigger type selector dropdown
   */
  toggleTypeSelector(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    this.showTypeSelector = !this.showTypeSelector;
  }

  /**
   * Handle field value change for type-specific fields
   */
  onFieldValueChange(fieldName: string, value: any): void {
    this.fieldValueChanged.emit({ fieldName, value });
  }

  /**
   * Update size mode based on dimensions
   */
  private updateSizeMode(): void {
    const minDimension = Math.min(this.width, this.height);
    this.isCompact = minDimension < 100;
    this.isSmall = minDimension < 150;

    // Adjust visible fields based on size
    if (this.isCompact) {
      this.maxVisibleFields = 2;
    } else if (this.isSmall) {
      this.maxVisibleFields = 3;
    } else {
      this.maxVisibleFields = 4;
    }
  }

  /**
   * Get fields to display (limited unless expanded)
   */
  getVisibleFields(): SolutionField[] {
    if (this.showAllFields || this.solutionFields.length <= this.maxVisibleFields) {
      return this.solutionFields;
    }
    return this.solutionFields.slice(0, this.maxVisibleFields);
  }

  /**
   * Check if there are more fields than visible
   */
  hasMoreFields(): boolean {
    return this.solutionFields.length > this.maxVisibleFields && !this.showAllFields;
  }

  /**
   * Get count of hidden fields
   */
  getHiddenFieldCount(): number {
    return this.solutionFields.length - this.maxVisibleFields;
  }

  /**
   * Toggle showing all fields
   */
  toggleShowAllFields(): void {
    this.showAllFields = !this.showAllFields;
  }

  /**
   * Get type badge color based on type
   */
  getTypeBadgeClass(type: string): string {
    const lowerType = type.toLowerCase();
    if (lowerType === 'int' || lowerType === 'number' || lowerType === 'float') {
      return 'type-number';
    }
    if (lowerType === 'str' || lowerType === 'string') {
      return 'type-string';
    }
    if (lowerType === 'bool' || lowerType === 'boolean') {
      return 'type-bool';
    }
    if (lowerType.includes('array') || lowerType.includes('list')) {
      return 'type-array';
    }
    return 'type-default';
  }

  /**
   * Close the trigger type selector when clicking elsewhere on the overlay.
   * (Stop-propagation is handled by appStateOverlayRoot.)
   */
  onOverlayClick(event: MouseEvent): void {
    this.showTypeSelector = false;
  }

  /**
   * Toggle edit mode (for compatibility)
   */
  toggleEditMode(): void {
    // Handled via trigger type selector
  }

  /**
   * Handle click on the expand button — emits popup request via base class.
   */
  onExpandClick(): void {
    this.popupRequested.emit();
  }

  /**
   * Force update size mode (called externally)
   */
  override forceUpdateSizeMode(): void {
    super.forceUpdateSizeMode();
    this.updateSizeMode();
  }
}
