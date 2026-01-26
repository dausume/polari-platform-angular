// Author: Dustin Etts
// Custom overlay component for ConditionalChain state with two modes:
// 1. Syntax-based - text input for condition expressions
// 2. Step-by-step - dropdown-based visual chain builder

import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { FormControl } from '@angular/forms';
import { ConditionalChainLink, LogicalOperator } from '../../../models/stateSpace/conditionalChain';
import { ConditionType, CONDITION_TYPE_OPTIONS } from '../../../models/stateSpace/conditionTypeOptions';

/**
 * Mode for building conditional chains
 */
export type ConditionalEditorMode = 'syntax' | 'visual';

/**
 * A visual representation of a condition link for the step-by-step builder
 */
export interface VisualConditionLink {
  id: string;
  fieldName: string;
  conditionType: ConditionType;
  conditionValue: string;
  conditionValueEnd?: string;
  logicalOperator: LogicalOperator;
}

/**
 * ConditionalChainOverlayComponent provides a two-mode interface for building
 * conditional logic chains in the no-code visual programming system.
 */
@Component({
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

  // Available input fields from connected states (for dropdown)
  @Input() availableInputFields: { name: string; type: string; source: string }[] = [];

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
      fieldName: link.fieldName,
      conditionType: link.conditionType,
      conditionValue: String(link.conditionValue ?? ''),
      conditionValueEnd: link.conditionValueEnd ? String(link.conditionValueEnd) : undefined,
      logicalOperator: link.logicalOperator
    }));
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
    const newLink: VisualConditionLink = {
      id: 'link_' + Math.random().toString(36).substring(2, 11),
      fieldName: this.availableInputFields.length > 0 ? this.availableInputFields[0].name : '',
      conditionType: 'equals',
      conditionValue: '',
      logicalOperator: this.defaultLogicalOperator
    };
    this.visualLinks.push(newLink);
    this.emitChainChange();
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
      displayName: `${vl.fieldName} ${vl.conditionType} ${vl.conditionValue}`,
      fieldName: vl.fieldName,
      conditionType: vl.conditionType,
      conditionValue: vl.conditionValue,
      conditionValueEnd: vl.conditionValueEnd,
      logicalOperator: vl.logicalOperator,
      isStateSpaceObject: true
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

      if (this.requiresNoValue(link.conditionType)) {
        condition = `${link.fieldName} ${this.getConditionSymbol(link.conditionType)}`;
      } else if (this.requiresSecondValue(link.conditionType)) {
        condition = `${link.fieldName} ${this.getConditionSymbol(link.conditionType)} ${link.conditionValue} AND ${link.conditionValueEnd || '?'}`;
      } else {
        const value = isNaN(Number(link.conditionValue)) ? `'${link.conditionValue}'` : link.conditionValue;
        condition = `${link.fieldName} ${this.getConditionSymbol(link.conditionType)} ${value}`;
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
        links.push({
          id: 'link_' + Math.random().toString(36).substring(2, 11),
          fieldName: fieldName.trim(),
          conditionType: this.parseOperator(op.trim()),
          conditionValue: value.replace(/^['"]|['"]$/g, '').trim(),
          logicalOperator: currentOperator
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
}
