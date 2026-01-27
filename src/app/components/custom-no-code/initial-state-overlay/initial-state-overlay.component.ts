// Author: Claude
// Custom overlay component for InitialState
// Displays the Solution Object information and its fields

import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';

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
 * InitialStateOverlayComponent displays the Solution Object context
 * that is available at the start of the solution flow.
 */
@Component({
  selector: 'initial-state-overlay',
  templateUrl: './initial-state-overlay.component.html',
  styleUrls: ['./initial-state-overlay.component.css']
})
export class InitialStateOverlayComponent implements OnInit, OnDestroy {

  // Position and size (from StateOverlayManager)
  @Input() x: number = 0;
  @Input() y: number = 0;
  @Input() width: number = 100;
  @Input() height: number = 100;

  // State identification
  @Input() stateName: string = '';
  @Input() boundClassName: string = 'InitialState';

  // Solution information
  @Input() solutionName: string = '';
  @Input() solutionClassName: string = '';
  @Input() solutionDescription: string = '';

  // Solution Object fields
  @Input() solutionFields: SolutionField[] = [];

  // Input parameters defined for this initial state
  @Input() inputParams: { name: string; type: string; description?: string }[] = [];

  // Size mode flags
  isCompact: boolean = false;
  isSmall: boolean = false;

  // Scroll state for field list
  showAllFields: boolean = false;
  maxVisibleFields: number = 4;

  ngOnInit(): void {
    this.updateSizeMode();
  }

  ngOnDestroy(): void {}

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
   * Stop event propagation for overlay interaction
   */
  onOverlayClick(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
  }

  onMouseDown(event: MouseEvent): void {
    event.stopPropagation();
  }

  /**
   * Toggle edit mode (for compatibility)
   */
  toggleEditMode(): void {
    // InitialState overlay is read-only display
  }

  /**
   * Force update size mode (called externally)
   */
  forceUpdateSizeMode(): void {
    this.updateSizeMode();
  }
}
