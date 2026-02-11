// Author: Dustin Etts
// View Context Overlay Component - Debug view for inspecting PotentialContext at a state
import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnInit,
  OnDestroy,
  ElementRef,
  HostListener
} from '@angular/core';
import {
  PotentialContext,
  PotentialVariable,
  PotentialObjectType,
  PotentialObjectField,
  BranchPoint
} from '@models/stateSpace/solutionContext';

/**
 * Groups variables by their input slot for display
 */
export interface VariablesBySlot {
  slotIndex: number;
  slotLabel: string;
  variables: PotentialVariable[];
}

/**
 * Groups variables by their branch path for display
 */
export interface VariablesByBranch {
  branchPath: BranchPoint[];
  branchLabel: string;
  variables: PotentialVariable[];
}

/**
 * Display overlay for debugging/inspecting what context is available at a state
 */
@Component({
  standalone: false,
  selector: 'view-context-overlay',
  templateUrl: './view-context-overlay.component.html',
  styleUrls: ['./view-context-overlay.component.css']
})
export class ViewContextOverlayComponent implements OnInit, OnDestroy {
  @Input() context: PotentialContext | null = null;
  @Input() stateName: string = '';
  @Input() solutionName: string = '';
  @Input() position: { x: number; y: number } = { x: 100, y: 100 };

  @Output() closed = new EventEmitter<void>();

  // Accordion state
  solutionObjectExpanded = true;
  variablesExpanded = true;
  objectTypesExpanded = true;
  branchInfoExpanded = false;
  flowInfoExpanded = false;

  // Reference to host element for body attachment
  private hostElement: HTMLElement;

  constructor(private elementRef: ElementRef) {
    this.hostElement = this.elementRef.nativeElement;
  }

  ngOnInit(): void {
    // Move to document.body to escape any parent stacking contexts
    document.body.appendChild(this.hostElement);
  }

  ngOnDestroy(): void {
    // Remove from document.body when component is destroyed
    if (this.hostElement && this.hostElement.parentElement === document.body) {
      document.body.removeChild(this.hostElement);
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.close();
  }

  close(): void {
    this.closed.emit();
  }

  /**
   * Get variables grouped by their input slot index
   */
  getVariablesBySlot(): VariablesBySlot[] {
    if (!this.context) return [];

    const variables = this.context.getVariables();
    const slotMap = new Map<number, PotentialVariable[]>();

    // Group by input slot
    for (const v of variables) {
      const slotIdx = v.inputSlotIndex ?? -1;
      if (!slotMap.has(slotIdx)) {
        slotMap.set(slotIdx, []);
      }
      slotMap.get(slotIdx)!.push(v);
    }

    // Convert to array and sort by slot index
    const result: VariablesBySlot[] = [];
    const sortedKeys = Array.from(slotMap.keys()).sort((a, b) => a - b);

    for (const slotIdx of sortedKeys) {
      result.push({
        slotIndex: slotIdx,
        slotLabel: slotIdx === -1 ? 'Unknown Slot' : `Input Slot ${slotIdx}`,
        variables: slotMap.get(slotIdx)!
      });
    }

    return result;
  }

  /**
   * Get all variables as a flat list
   */
  getAllVariables(): PotentialVariable[] {
    return this.context?.getVariables() || [];
  }

  /**
   * Get all object types
   */
  getObjectTypes(): PotentialObjectType[] {
    return this.context?.getObjectTypes() || [];
  }

  /**
   * Get variable count
   */
  getVariableCount(): number {
    return this.context?.variables.size || 0;
  }

  /**
   * Get object type count
   */
  getObjectTypeCount(): number {
    return this.context?.objectTypes.size || 0;
  }

  /**
   * Format type for display (shortens long types)
   */
  formatType(type: string): string {
    if (!type) return 'any';
    // Shorten common types
    const typeMap: { [key: string]: string } = {
      'string': 'str',
      'number': 'num',
      'boolean': 'bool',
      'integer': 'int'
    };
    return typeMap[type.toLowerCase()] || type;
  }

  /**
   * Get flow distance badge class
   */
  getDistanceBadgeClass(distance: number): string {
    if (distance === 0) return 'distance-immediate';
    if (distance === 1) return 'distance-close';
    if (distance <= 3) return 'distance-medium';
    return 'distance-far';
  }

  /**
   * Toggle accordion section
   */
  toggleSection(section: 'solutionObject' | 'variables' | 'objectTypes' | 'branchInfo' | 'flowInfo'): void {
    switch (section) {
      case 'solutionObject':
        this.solutionObjectExpanded = !this.solutionObjectExpanded;
        break;
      case 'variables':
        this.variablesExpanded = !this.variablesExpanded;
        break;
      case 'objectTypes':
        this.objectTypesExpanded = !this.objectTypesExpanded;
        break;
      case 'branchInfo':
        this.branchInfoExpanded = !this.branchInfoExpanded;
        break;
      case 'flowInfo':
        this.flowInfoExpanded = !this.flowInfoExpanded;
        break;
    }
  }

  /**
   * Get the Solution Object (always available)
   */
  getSolutionObject(): PotentialObjectType | null {
    return this.context?.solutionObject || null;
  }

  /**
   * Check if context has a solution object
   */
  hasSolutionObject(): boolean {
    return !!this.context?.solutionObject;
  }

  /**
   * Get non-solution object types
   */
  getNonSolutionObjectTypes(): PotentialObjectType[] {
    return this.context?.getObjectTypes().filter(t => !t.isSolutionObject) || [];
  }

  /**
   * Get variables grouped by branch path
   */
  getVariablesByBranch(): VariablesByBranch[] {
    if (!this.context) return [];

    const byBranch = this.context.getVariablesByBranch();
    const result: VariablesByBranch[] = [];

    for (const [branchLabel, variables] of byBranch) {
      // Get the branch path from the first variable
      const branchPath = variables[0]?.branchPath || [];
      result.push({
        branchPath,
        branchLabel,
        variables: variables.sort((a, b) => a.flowDistance - b.flowDistance)
      });
    }

    // Sort: main flow first, then by branch label
    return result.sort((a, b) => {
      if (a.branchLabel === 'main flow') return -1;
      if (b.branchLabel === 'main flow') return 1;
      return a.branchLabel.localeCompare(b.branchLabel);
    });
  }

  /**
   * Check if context has branched variables
   */
  hasBranchedVariables(): boolean {
    return this.context?.hasBranchedVariables() || false;
  }

  /**
   * Get branch count
   */
  getBranchCount(): number {
    return this.context?.getBranchCount() || 0;
  }

  /**
   * Format a branch path for display
   */
  formatBranchPath(branchPath: BranchPoint[]): string {
    return PotentialContext.formatBranchPath(branchPath);
  }

  /**
   * Check if a variable has a branch path
   */
  hasBranchPath(variable: PotentialVariable): boolean {
    return variable.branchPath && variable.branchPath.length > 0;
  }

  /**
   * Get a short branch indicator for a variable
   */
  getBranchIndicator(variable: PotentialVariable): string {
    if (!variable.branchPath || variable.branchPath.length === 0) {
      return '';
    }
    const lastBranch = variable.branchPath[variable.branchPath.length - 1];
    return lastBranch.branchLabel || `branch ${lastBranch.branchIndex}`;
  }

  /**
   * Copy variable name to clipboard
   */
  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      // Could show a toast notification here
      console.log('[ViewContextOverlay] Copied to clipboard:', text);
    });
  }

  /**
   * Stop propagation for inner clicks
   */
  onOverlayClick(event: MouseEvent): void {
    event.stopPropagation();
  }

  /**
   * Close when clicking backdrop
   */
  onBackdropClick(): void {
    this.close();
  }
}
