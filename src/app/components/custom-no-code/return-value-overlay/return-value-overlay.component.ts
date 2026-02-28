// Author: Dustin Etts
// Custom overlay component for ReturnValue state.
// Provides a ValueSourceSelector for choosing what value to return.

import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ElementRef, HostListener } from '@angular/core';
import {
  ValueSourceConfig,
  createDefaultValueSourceConfig,
  getSourceLabel
} from '../../../models/stateSpace/conditionalChain';
import { AvailableInput, SourceObjectField } from '../value-source-selector/value-source-selector.component';

@Component({
  standalone: false,
  selector: 'return-value-overlay',
  templateUrl: './return-value-overlay.component.html',
  styleUrls: ['./return-value-overlay.component.css']
})
export class ReturnValueOverlayComponent implements OnInit, OnDestroy {

  // Position and size (from StateOverlayManager)
  @Input() x: number = 0;
  @Input() y: number = 0;
  @Input() width: number = 100;
  @Input() height: number = 100;

  // State identification
  @Input() stateName: string = '';
  @Input() boundClassName: string = 'ReturnValue';

  // Available inputs for ValueSourceSelector
  @Input() availableInputs: AvailableInput[] = [];

  // Available source object fields for ValueSourceSelector
  @Input() sourceObjectFields: SourceObjectField[] = [];

  // Current return value source configuration
  @Input() returnValueSource: ValueSourceConfig | null = null;

  // Legacy return value (plain string fallback)
  @Input() returnValue: string = '';

  // Events
  @Output() returnValueChanged = new EventEmitter<{ returnValueSource: ValueSourceConfig; returnValue: string }>();
  @Output() fullViewRequested = new EventEmitter<{ x: number; y: number; stateName: string }>();
  @Output() statePageRequested = new EventEmitter<{ stateName: string }>();

  // The active ValueSourceConfig for the selector
  currentConfig: ValueSourceConfig = createDefaultValueSourceConfig('from_source_object');

  // Size mode flags
  isCompact: boolean = false;
  isSmall: boolean = false;

  // Popup state for value source editing
  popupVisible: boolean = false;
  popupPosition: { top: number; left: number } = { top: 0, left: 0 };

  constructor(private elementRef: ElementRef) {}

  ngOnInit(): void {
    this.updateSizeMode();
    this.initializeConfig();
  }

  ngOnDestroy(): void {}

  private updateSizeMode(): void {
    const minDimension = Math.min(this.width, this.height);
    this.isCompact = minDimension < 100;
    this.isSmall = minDimension < 150;
  }

  private initializeConfig(): void {
    if (this.returnValueSource) {
      this.currentConfig = { ...this.returnValueSource };
    } else if (this.returnValue) {
      // Legacy: plain string value
      this.currentConfig = {
        sourceType: 'direct_assignment',
        directValue: this.returnValue,
        directValueType: 'str'
      };
    } else {
      this.currentConfig = createDefaultValueSourceConfig('from_source_object');
    }
  }

  /**
   * Get display text for the current config
   */
  getDisplayText(): string {
    if (!this.currentConfig) return '(select value)';

    switch (this.currentConfig.sourceType) {
      case 'from_input':
        if (this.currentConfig.inputVariableName) {
          return this.currentConfig.inputVariableName;
        }
        return `input[${this.currentConfig.inputSlotIndex ?? 0}]`;

      case 'from_source_object':
        const path = this.currentConfig.sourceObjectPath || '';
        if (path.startsWith('self.')) {
          return `self.${path.substring(5)}`;
        }
        return path || '(select field)';

      case 'direct_assignment':
        const value = this.currentConfig.directValue;
        if (value === undefined || value === null || value === '') {
          return '(enter value)';
        }
        const strValue = String(value);
        return strValue.length > 20 ? strValue.substring(0, 20) + '...' : strValue;

      default:
        return '(select value)';
    }
  }

  /**
   * Open the value source popup
   */
  openValuePopup(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();

    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const popupEstimatedWidth = 400;
    const popupEstimatedHeight = 150;

    let top = rect.bottom + 4;
    let left = rect.left;

    if (left + popupEstimatedWidth > viewportWidth - 10) {
      left = Math.max(10, viewportWidth - popupEstimatedWidth - 10);
    }
    if (top + popupEstimatedHeight > viewportHeight - 10) {
      top = rect.top - popupEstimatedHeight - 4;
    }

    this.popupPosition = { top, left };
    this.popupVisible = true;
  }

  /**
   * Close the value source popup
   */
  closeValuePopup(): void {
    this.popupVisible = false;
  }

  /**
   * Handle value source config change from the popup selector
   */
  onConfigChange(config: ValueSourceConfig): void {
    this.currentConfig = config;
    this.emitChange();
  }

  /**
   * Emit the return value change event
   */
  private emitChange(): void {
    const label = getSourceLabel(this.currentConfig);
    this.returnValueChanged.emit({
      returnValueSource: this.currentConfig,
      returnValue: label
    });
  }

  /**
   * Handle right-click to request full view popup
   */
  onContextMenu(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.fullViewRequested.emit({
      x: event.clientX,
      y: event.clientY,
      stateName: this.stateName
    });
  }

  /**
   * Handle click on "open state page" button
   */
  onOpenStatePage(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    this.statePageRequested.emit({ stateName: this.stateName });
  }

  /**
   * Stop event propagation to prevent triggering D3 drag behavior
   */
  onOverlayClick(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
  }

  onMouseDown(event: MouseEvent): void {
    event.stopPropagation();
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
   * Force update size mode (called externally)
   */
  forceUpdateSizeMode(): void {
    this.updateSizeMode();
  }

  /**
   * Toggle edit mode (for compatibility with default overlay)
   */
  toggleEditMode(): void {}
}
