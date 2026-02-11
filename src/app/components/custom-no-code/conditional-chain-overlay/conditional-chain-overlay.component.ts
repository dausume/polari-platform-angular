// Author: Dustin Etts
// Custom overlay component for ConditionalChain state with two modes:
// 1. Syntax-based - text input for condition expressions
// 2. Step-by-step - dropdown-based visual chain builder with ValueSourceSelector

import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ElementRef, HostListener } from '@angular/core';
import { FormControl } from '@angular/forms';
import {
  ConditionalChainLink,
  LogicalOperator,
  ValueSourceConfig,
  ValueSourceType,
  createDefaultValueSourceConfig,
  getSourceLabel
} from '../../../models/stateSpace/conditionalChain';
import { ConditionType, CONDITION_TYPE_OPTIONS } from '../../../models/stateSpace/conditionTypeOptions';
import { AvailableInput, SourceObjectField } from '../value-source-selector/value-source-selector.component';

/**
 * Mode for building conditional chains
 */
export type ConditionalEditorMode = 'syntax' | 'visual';

/**
 * Which side of a condition is being edited in the popup
 */
export type EditingSide = 'left' | 'right' | 'rightEnd' | null;

/**
 * A visual representation of a condition link for the step-by-step builder
 * Now includes ValueSourceConfig for left and right sides
 */
export interface VisualConditionLink {
  id: string;
  conditionType: ConditionType;
  logicalOperator: LogicalOperator;

  // NEW: Source configurations for left and right sides
  leftSource: ValueSourceConfig;
  rightSource: ValueSourceConfig;
  rightSourceEnd?: ValueSourceConfig;

  // Legacy fields (for backwards compatibility and display)
  fieldName: string;
  conditionValue: string;
  conditionValueEnd?: string;
}

/**
 * ConditionalChainOverlayComponent provides a two-mode interface for building
 * conditional logic chains in the no-code visual programming system.
 */
@Component({
  standalone: false,
  selector: 'conditional-chain-overlay',
  templateUrl: './conditional-chain-overlay.component.html',
  styleUrls: ['./conditional-chain-overlay.component.css']
})
export class ConditionalChainOverlayComponent implements OnInit, OnDestroy {

  // Position and size (from StateOverlayManager)
  @Input() x: number = 0;
  @Input() y: number = 0;
  @Input() width: number = 100;
  @Input() height: number = 100;

  // State identification
  @Input() stateName: string = '';
  @Input() boundClassName: string = 'ConditionalChain';

  // Available input fields from connected states (for dropdown) - legacy format
  @Input() availableInputFields: { name: string; type: string; source: string }[] = [];

  // NEW: Available inputs in structured format for ValueSourceSelector
  @Input() availableInputs: AvailableInput[] = [];

  // NEW: Available source object fields for ValueSourceSelector
  @Input() sourceObjectFields: SourceObjectField[] = [];

  // Current chain data
  @Input() chainLinks: ConditionalChainLink[] = [];
  @Input() defaultLogicalOperator: LogicalOperator = 'AND';

  // Slot configuration
  @Input() inputSlotCount: number = 1;
  @Input() allowDynamicInputs: boolean = true;
  @Input() maxInputSlots: number = 0; // 0 = unlimited

  // Events
  @Output() chainChanged = new EventEmitter<{ links: ConditionalChainLink[]; defaultOperator: LogicalOperator }>();
  @Output() syntaxChanged = new EventEmitter<string>();
  @Output() addInputSlot = new EventEmitter<void>();

  // Current editor mode
  editorMode: ConditionalEditorMode = 'visual';

  // Visual chain builder data
  visualLinks: VisualConditionLink[] = [];

  // Syntax editor
  syntaxControl = new FormControl('');
  syntaxError: string = '';
  syntaxValid: boolean = true;

  // Available options for dropdowns
  conditionTypes = CONDITION_TYPE_OPTIONS;
  logicalOperators: { value: LogicalOperator; label: string }[] = [
    { value: 'AND', label: 'AND' },
    { value: 'OR', label: 'OR' },
    { value: 'NOT', label: 'NOT' },
    { value: 'XOR', label: 'XOR' }
  ];

  // Size mode flags
  isCompact: boolean = false;
  isSmall: boolean = false;

  // Popup state for value source editing
  popupVisible: boolean = false;
  popupLinkIndex: number = -1;
  popupEditingSide: EditingSide = null;
  popupPosition: { top: number; left: number } = { top: 0, left: 0 };

  constructor(private elementRef: ElementRef) {}

  ngOnInit(): void {
    this.updateSizeMode();
    this.initializeFromChainLinks();
    this.generateSyntaxFromVisual();
  }

  ngOnDestroy(): void {}

  /**
   * Update size mode based on dimensions
   */
  private updateSizeMode(): void {
    const minDimension = Math.min(this.width, this.height);
    this.isCompact = minDimension < 100;
    this.isSmall = minDimension < 150;
  }

  /**
   * Initialize visual links from input chain links
   */
  private initializeFromChainLinks(): void {
    this.visualLinks = this.chainLinks.map(link => ({
      id: link.id,
      conditionType: link.conditionType,
      logicalOperator: link.logicalOperator,
      // NEW: Use ValueSourceConfig if available, otherwise create from legacy fields
      leftSource: link.leftSource || this.createSourceFromLegacy(link.fieldName, 'from_input'),
      rightSource: link.rightSource || this.createSourceFromLegacy(link.conditionValue, 'direct_assignment'),
      rightSourceEnd: link.rightSourceEnd || (link.conditionValueEnd
        ? this.createSourceFromLegacy(link.conditionValueEnd, 'direct_assignment')
        : undefined),
      // Legacy fields for backwards compatibility
      fieldName: link.fieldName || getSourceLabel(link.leftSource || createDefaultValueSourceConfig()),
      conditionValue: String(link.conditionValue ?? ''),
      conditionValueEnd: link.conditionValueEnd ? String(link.conditionValueEnd) : undefined
    }));
  }

  /**
   * Create a ValueSourceConfig from a legacy field value
   */
  private createSourceFromLegacy(value: any, defaultType: ValueSourceType): ValueSourceConfig {
    if (value === undefined || value === null || value === '') {
      return createDefaultValueSourceConfig(defaultType);
    }

    // If value looks like a variable name (no spaces, alphanumeric + underscore)
    const strValue = String(value);
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(strValue)) {
      // Check if it matches an available input
      const matchingInput = this.getAvailableInputsForSelector().find(
        input => input.variableName === strValue
      );
      if (matchingInput) {
        return {
          sourceType: 'from_input',
          inputSlotIndex: matchingInput.slotIndex,
          inputVariableName: strValue
        };
      }
      // Could be a source object reference
      if (strValue.startsWith('self.') || this.sourceObjectFields.find(f => f.path === strValue)) {
        return {
          sourceType: 'from_source_object',
          sourceObjectPath: strValue
        };
      }
    }

    // Default to direct assignment
    return {
      sourceType: 'direct_assignment',
      directValue: value,
      directValueType: typeof value === 'number' ? 'int' : 'str'
    };
  }

  /**
   * Switch between editor modes
   */
  setEditorMode(mode: ConditionalEditorMode): void {
    if (mode === 'syntax' && this.editorMode === 'visual') {
      // Switching to syntax - generate syntax from visual
      this.generateSyntaxFromVisual();
    } else if (mode === 'visual' && this.editorMode === 'syntax') {
      // Switching to visual - parse syntax to visual
      this.parseVisualFromSyntax();
    }
    this.editorMode = mode;
  }

  /**
   * Add a new condition link at the bottom
   */
  addConditionLink(): void {
    // Create default sources based on available inputs
    const inputs = this.getAvailableInputsForSelector();
    const leftSource: ValueSourceConfig = inputs.length > 0
      ? { sourceType: 'from_input', inputSlotIndex: inputs[0].slotIndex, inputVariableName: inputs[0].variableName }
      : createDefaultValueSourceConfig('from_input');

    const rightSource: ValueSourceConfig = inputs.length > 1
      ? { sourceType: 'from_input', inputSlotIndex: inputs[1].slotIndex, inputVariableName: inputs[1].variableName }
      : createDefaultValueSourceConfig('direct_assignment');

    const newLink: VisualConditionLink = {
      id: 'link_' + Math.random().toString(36).substring(2, 11),
      conditionType: 'equals',
      logicalOperator: this.defaultLogicalOperator,
      leftSource,
      rightSource,
      // Legacy fields
      fieldName: inputs.length > 0 ? inputs[0].variableName : '',
      conditionValue: ''
    };
    this.visualLinks.push(newLink);
    this.emitChainChange();
  }

  /**
   * Get available inputs formatted for ValueSourceSelector
   */
  getAvailableInputsForSelector(): AvailableInput[] {
    // Prefer new availableInputs format, fall back to legacy availableInputFields
    if (this.availableInputs && this.availableInputs.length > 0) {
      return this.availableInputs;
    }

    // Convert legacy format
    return this.availableInputFields.map((field, index) => ({
      slotIndex: index,
      variableName: field.name,
      type: field.type,
      sourceStateName: field.source
    }));
  }

  /**
   * Handle left source configuration change
   */
  onLeftSourceChange(index: number, config: ValueSourceConfig): void {
    if (this.visualLinks[index]) {
      this.visualLinks[index].leftSource = config;
      // Update legacy field for backwards compatibility
      this.visualLinks[index].fieldName = getSourceLabel(config);
      this.emitChainChange();
    }
  }

  /**
   * Handle right source configuration change
   */
  onRightSourceChange(index: number, config: ValueSourceConfig): void {
    if (this.visualLinks[index]) {
      this.visualLinks[index].rightSource = config;
      // Update legacy field for backwards compatibility
      this.visualLinks[index].conditionValue = getSourceLabel(config);
      this.emitChainChange();
    }
  }

  /**
   * Handle right source end (for BETWEEN) configuration change
   */
  onRightSourceEndChange(index: number, config: ValueSourceConfig): void {
    if (this.visualLinks[index]) {
      this.visualLinks[index].rightSourceEnd = config;
      // Update legacy field for backwards compatibility
      this.visualLinks[index].conditionValueEnd = getSourceLabel(config);
      this.emitChainChange();
    }
  }

  /**
   * Remove a condition link
   */
  removeConditionLink(index: number): void {
    this.visualLinks.splice(index, 1);
    this.emitChainChange();
  }

  /**
   * Update a link's field
   */
  onFieldChange(index: number, field: keyof VisualConditionLink, value: any): void {
    if (this.visualLinks[index]) {
      (this.visualLinks[index] as any)[field] = value;
      this.emitChainChange();
    }
  }

  /**
   * Get condition types that require two values (BETWEEN)
   */
  requiresSecondValue(conditionType: ConditionType): boolean {
    return conditionType === 'between' || conditionType === 'notBetween';
  }

  /**
   * Get condition types that don't require any value (IS NULL, etc.)
   */
  requiresNoValue(conditionType: ConditionType): boolean {
    return conditionType === 'isNull' || conditionType === 'isNotNull' ||
           conditionType === 'isTrue' || conditionType === 'isFalse';
  }

  /**
   * Emit chain change event
   */
  private emitChainChange(): void {
    const links: ConditionalChainLink[] = this.visualLinks.map(vl => ({
      id: vl.id,
      displayName: `${getSourceLabel(vl.leftSource)} ${vl.conditionType} ${getSourceLabel(vl.rightSource)}`,
      conditionType: vl.conditionType,
      logicalOperator: vl.logicalOperator,
      isStateSpaceObject: true,
      // NEW: Include ValueSourceConfig
      leftSource: vl.leftSource,
      rightSource: vl.rightSource,
      rightSourceEnd: vl.rightSourceEnd,
      // Legacy fields for backwards compatibility
      fieldName: vl.fieldName || getSourceLabel(vl.leftSource),
      conditionValue: vl.conditionValue || getSourceLabel(vl.rightSource),
      conditionValueEnd: vl.conditionValueEnd
    }));

    this.chainChanged.emit({
      links,
      defaultOperator: this.defaultLogicalOperator
    });

    // Also update syntax view
    this.generateSyntaxFromVisual();
  }

  /**
   * Generate syntax string from visual links
   */
  private generateSyntaxFromVisual(): void {
    if (this.visualLinks.length === 0) {
      this.syntaxControl.setValue('');
      return;
    }

    const parts: string[] = [];
    for (let i = 0; i < this.visualLinks.length; i++) {
      const link = this.visualLinks[i];
      let condition = '';

      // Get labels from sources
      const leftLabel = getSourceLabel(link.leftSource);
      const rightLabel = getSourceLabel(link.rightSource);
      const rightEndLabel = link.rightSourceEnd ? getSourceLabel(link.rightSourceEnd) : '?';

      if (this.requiresNoValue(link.conditionType)) {
        condition = `${leftLabel} ${this.getConditionSymbol(link.conditionType)}`;
      } else if (this.requiresSecondValue(link.conditionType)) {
        condition = `${leftLabel} ${this.getConditionSymbol(link.conditionType)} ${rightLabel} AND ${rightEndLabel}`;
      } else {
        // Format the right value based on source type
        let formattedRight = rightLabel;
        if (link.rightSource.sourceType === 'direct_assignment' &&
            link.rightSource.directValueType === 'str') {
          formattedRight = `'${rightLabel}'`;
        }
        condition = `${leftLabel} ${this.getConditionSymbol(link.conditionType)} ${formattedRight}`;
      }

      if (i === 0) {
        parts.push(condition);
      } else {
        const prevLink = this.visualLinks[i - 1];
        parts.push(`${prevLink.logicalOperator} ${condition}`);
      }
    }

    this.syntaxControl.setValue(parts.join(' '));
  }

  /**
   * Get symbol for condition type
   */
  private getConditionSymbol(conditionType: ConditionType): string {
    const symbolMap: Record<string, string> = {
      'equals': '==',
      'notEquals': '!=',
      'greaterThan': '>',
      'lessThan': '<',
      'greaterThanOrEqual': '>=',
      'lessThanOrEqual': '<=',
      'between': 'BETWEEN',
      'notBetween': 'NOT BETWEEN',
      'contains': 'CONTAINS',
      'notContains': 'NOT CONTAINS',
      'startsWith': 'STARTS WITH',
      'endsWith': 'ENDS WITH',
      'isNull': 'IS NULL',
      'isNotNull': 'IS NOT NULL',
      'isTrue': 'IS TRUE',
      'isFalse': 'IS FALSE',
      'in': 'IN',
      'notIn': 'NOT IN',
      'like': 'LIKE',
      'regexMatch': 'MATCHES'
    };
    return symbolMap[conditionType] || conditionType;
  }

  /**
   * Parse syntax string to visual links
   */
  private parseVisualFromSyntax(): void {
    const syntax = this.syntaxControl.value || '';
    if (!syntax.trim()) {
      this.visualLinks = [];
      this.syntaxValid = true;
      this.syntaxError = '';
      return;
    }

    try {
      // Simple parser - split by logical operators
      const tokens = this.tokenizeSyntax(syntax);
      this.visualLinks = tokens;
      this.syntaxValid = true;
      this.syntaxError = '';
    } catch (e: any) {
      this.syntaxValid = false;
      this.syntaxError = e.message || 'Invalid syntax';
    }
  }

  /**
   * Simple tokenizer for condition syntax
   */
  private tokenizeSyntax(syntax: string): VisualConditionLink[] {
    const links: VisualConditionLink[] = [];

    // Split by AND/OR (keeping the operator)
    const parts = syntax.split(/\s+(AND|OR|XOR|NOT)\s+/i);

    let currentOperator: LogicalOperator = 'AND';
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();

      if (['AND', 'OR', 'XOR', 'NOT'].includes(part.toUpperCase())) {
        currentOperator = part.toUpperCase() as LogicalOperator;
        continue;
      }

      // Parse condition: field operator value
      const match = part.match(/^(\w+)\s*(==|!=|>=|<=|>|<|CONTAINS|LIKE|IS\s+NULL|IS\s+NOT\s+NULL)\s*(.*)$/i);
      if (match) {
        const [, fieldName, op, value] = match;
        const trimmedField = fieldName.trim();
        const trimmedValue = value.replace(/^['"]|['"]$/g, '').trim();

        // Create ValueSourceConfigs from parsed syntax
        const leftSource: ValueSourceConfig = this.createSourceFromLegacy(trimmedField, 'from_input');
        const rightSource: ValueSourceConfig = this.createSourceFromLegacy(trimmedValue, 'direct_assignment');

        links.push({
          id: 'link_' + Math.random().toString(36).substring(2, 11),
          conditionType: this.parseOperator(op.trim()),
          logicalOperator: currentOperator,
          leftSource,
          rightSource,
          // Legacy fields
          fieldName: trimmedField,
          conditionValue: trimmedValue
        });
        currentOperator = 'AND'; // Reset to default
      }
    }

    return links;
  }

  /**
   * Parse operator string to ConditionType
   */
  private parseOperator(op: string): ConditionType {
    const opMap: Record<string, ConditionType> = {
      '==': 'equals',
      '!=': 'notEquals',
      '>': 'greaterThan',
      '<': 'lessThan',
      '>=': 'greaterThanOrEqual',
      '<=': 'lessThanOrEqual',
      'CONTAINS': 'contains',
      'LIKE': 'like',
      'IS NULL': 'isNull',
      'IS NOT NULL': 'isNotNull'
    };
    return opMap[op.toUpperCase()] || 'equals';
  }

  /**
   * Handle syntax input change
   */
  onSyntaxChange(): void {
    const syntax = this.syntaxControl.value || '';
    this.syntaxChanged.emit(syntax);

    // Validate in real-time
    try {
      this.tokenizeSyntax(syntax);
      this.syntaxValid = true;
      this.syntaxError = '';
    } catch (e: any) {
      this.syntaxValid = false;
      this.syntaxError = e.message || 'Invalid syntax';
    }
  }

  /**
   * Get display label for condition type
   */
  getConditionTypeLabel(conditionType: ConditionType): string {
    const option = this.conditionTypes.find(ct => ct.value === conditionType);
    return option?.displayName || conditionType;
  }

  /**
   * Extract value from input/select event target
   */
  getEventTargetValue(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  /**
   * Force update size mode (called externally)
   */
  forceUpdateSizeMode(): void {
    this.updateSizeMode();
  }

  /**
   * Check if more input slots can be added
   */
  canAddInput(): boolean {
    if (!this.allowDynamicInputs) return false;
    if (this.maxInputSlots === 0) return true; // unlimited
    return this.inputSlotCount < this.maxInputSlots;
  }

  /**
   * Request to add a new input slot
   */
  requestAddInputSlot(): void {
    if (this.canAddInput()) {
      this.addInputSlot.emit();
    }
  }

  /**
   * Toggle edit mode (for compatibility with default overlay)
   * Custom overlays are always in edit mode, so this is a no-op
   */
  toggleEditMode(): void {
    // Custom overlays are always interactive, no toggle needed
  }

  /**
   * Stop event propagation to prevent triggering D3 drag behavior
   */
  onOverlayClick(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
  }

  /**
   * Handle mousedown to prevent drag from starting
   */
  onMouseDown(event: MouseEvent): void {
    event.stopPropagation();
  }

  // ==================== Popup Management ====================

  /**
   * Open the value source popup for a specific link and side
   */
  openValuePopup(event: MouseEvent, linkIndex: number, side: EditingSide): void {
    event.stopPropagation();
    event.preventDefault();

    // Calculate popup position in viewport coordinates (for position: fixed)
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();

    // Position popup below the clicked button, in viewport coordinates
    // Ensure it doesn't go off-screen
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const popupEstimatedWidth = 400; // Estimate for initial width
    const popupEstimatedHeight = 150;

    let top = rect.bottom + 4;
    let left = rect.left;

    // Adjust if popup would go off the right edge
    if (left + popupEstimatedWidth > viewportWidth - 10) {
      left = Math.max(10, viewportWidth - popupEstimatedWidth - 10);
    }

    // Adjust if popup would go off the bottom edge - show above instead
    if (top + popupEstimatedHeight > viewportHeight - 10) {
      top = rect.top - popupEstimatedHeight - 4;
    }

    this.popupPosition = { top, left };
    this.popupLinkIndex = linkIndex;
    this.popupEditingSide = side;
    this.popupVisible = true;
  }

  /**
   * Close the value source popup
   */
  closeValuePopup(): void {
    this.popupVisible = false;
    this.popupLinkIndex = -1;
    this.popupEditingSide = null;
  }

  /**
   * Get the current config for the popup based on which side is being edited
   */
  getPopupConfig(): ValueSourceConfig {
    if (this.popupLinkIndex < 0 || !this.popupEditingSide) {
      return createDefaultValueSourceConfig('from_input');
    }

    const link = this.visualLinks[this.popupLinkIndex];
    if (!link) {
      return createDefaultValueSourceConfig('from_input');
    }

    switch (this.popupEditingSide) {
      case 'left':
        return link.leftSource;
      case 'right':
        return link.rightSource;
      case 'rightEnd':
        return link.rightSourceEnd || createDefaultValueSourceConfig('direct_assignment');
      default:
        return createDefaultValueSourceConfig('from_input');
    }
  }

  /**
   * Handle value source change from popup
   */
  onPopupConfigChange(config: ValueSourceConfig): void {
    if (this.popupLinkIndex < 0 || !this.popupEditingSide) {
      return;
    }

    switch (this.popupEditingSide) {
      case 'left':
        this.onLeftSourceChange(this.popupLinkIndex, config);
        break;
      case 'right':
        this.onRightSourceChange(this.popupLinkIndex, config);
        break;
      case 'rightEnd':
        this.onRightSourceEndChange(this.popupLinkIndex, config);
        break;
    }
  }

  /**
   * Get compact display text for a value source config
   * Format: varName | Object.path | [type] value
   */
  getCompactDisplayText(config: ValueSourceConfig | undefined): string {
    if (!config) {
      return '(select)';
    }

    switch (config.sourceType) {
      case 'from_input':
        if (config.inputVariableName) {
          return config.inputVariableName;
        }
        return `input[${config.inputSlotIndex ?? 0}]`;

      case 'from_source_object':
        const path = config.sourceObjectPath || '';
        // Show as Object.path format
        if (path.startsWith('self.')) {
          return `Object.${path.substring(5)}`;
        }
        return path ? `Object.${path}` : 'Object.(?)';

      case 'direct_assignment':
        const typeLabel = config.directValueType || 'str';
        const value = config.directValue;
        if (value === undefined || value === null || value === '') {
          return `[${typeLabel}] (empty)`;
        }
        // Truncate long values
        const strValue = String(value);
        const displayValue = strValue.length > 10 ? strValue.substring(0, 10) + '...' : strValue;
        return `[${typeLabel}] ${displayValue}`;

      default:
        return '(?)';
    }
  }

  /**
   * Handle document click to close popup when clicking outside
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.popupVisible) {
      const target = event.target as HTMLElement;
      const popup = this.elementRef.nativeElement.querySelector('.value-popup');
      const isInsidePopup = popup && popup.contains(target);
      const isValueButton = target.closest('.value-display-btn');

      if (!isInsidePopup && !isValueButton) {
        this.closeValuePopup();
      }
    }
  }

  /**
   * Get the popup label based on which side is being edited
   */
  getPopupLabel(): string {
    switch (this.popupEditingSide) {
      case 'left':
        return 'Left Value';
      case 'right':
        return 'Right Value';
      case 'rightEnd':
        return 'End Value';
      default:
        return 'Value';
    }
  }
}
