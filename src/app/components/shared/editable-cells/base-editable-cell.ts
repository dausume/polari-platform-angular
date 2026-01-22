// base-editable-cell.ts
// Abstract base class for all editable cell components

import { Directive, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { FormControl, Validators, ValidatorFn } from '@angular/forms';
import { BehaviorSubject, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { SelectOption } from '../models/crud-config.models';

@Directive()
export abstract class BaseEditableCell implements OnInit, OnDestroy, OnChanges {
  @Input() mode: 'read' | 'create' | 'edit' = 'read';
  @Input() value: any;
  @Input() fieldName: string = '';
  @Input() displayName: string = '';
  @Input() required: boolean = false;
  @Input() disabled: boolean = false;
  @Input() placeholder: string = '';
  @Input() options: SelectOption[] = [];

  @Output() valueChange = new EventEmitter<any>();
  @Output() editStarted = new EventEmitter<void>();
  @Output() editCancelled = new EventEmitter<void>();
  @Output() editCompleted = new EventEmitter<any>();

  control: FormControl;
  isEditing$ = new BehaviorSubject<boolean>(false);
  originalValue: any;

  protected destroy$ = new Subject<void>();

  constructor() {
    this.control = new FormControl('');
  }

  ngOnInit(): void {
    this.initializeControl();
    this.setupValueSubscription();

    // Auto-enter edit mode if mode is 'create' or 'edit'
    if (this.mode === 'create' || this.mode === 'edit') {
      this.isEditing$.next(true);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value'] && !changes['value'].firstChange) {
      this.control.setValue(this.value, { emitEvent: false });
      this.originalValue = this.value;
    }

    if (changes['mode']) {
      const newMode = changes['mode'].currentValue;
      this.isEditing$.next(newMode === 'create' || newMode === 'edit');
    }

    if (changes['required']) {
      this.updateValidators();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.isEditing$.complete();
  }

  /**
   * Initialize the form control with the current value and validators
   */
  protected initializeControl(): void {
    this.control.setValue(this.value);
    this.originalValue = this.value;
    this.updateValidators();

    if (this.disabled) {
      this.control.disable();
    }
  }

  /**
   * Setup subscription to control value changes
   */
  protected setupValueSubscription(): void {
    this.control.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(value => {
        // Only emit change event in edit modes and when value actually changed
        if (this.isEditing$.value && value !== this.value) {
          this.valueChange.emit(value);
        }
      });
  }

  /**
   * Update validators based on required flag and custom validators
   */
  protected updateValidators(): void {
    const validators: ValidatorFn[] = this.getValidators();
    if (this.required) {
      validators.push(Validators.required);
    }
    this.control.setValidators(validators);
    this.control.updateValueAndValidity();
  }

  /**
   * Get custom validators for the specific cell type
   * Override in child classes to add type-specific validation
   */
  protected getValidators(): ValidatorFn[] {
    return [];
  }

  /**
   * Get the display value for read mode
   * Override in child classes for custom display formatting
   */
  abstract getDisplayValue(): string;

  /**
   * Enter edit mode
   */
  enterEditMode(): void {
    if (this.disabled || this.mode === 'read') {
      return;
    }
    this.originalValue = this.control.value;
    this.isEditing$.next(true);
    this.editStarted.emit();
  }

  /**
   * Exit edit mode
   * @param save Whether to save the changes or revert
   */
  exitEditMode(save: boolean): void {
    if (save && this.control.valid) {
      const newValue = this.control.value;
      this.valueChange.emit(newValue);
      this.editCompleted.emit(newValue);
    } else {
      // Revert to original value
      this.control.setValue(this.originalValue, { emitEvent: false });
      this.editCancelled.emit();
    }

    // Only exit edit mode if in 'read' mode context
    if (this.mode === 'read') {
      this.isEditing$.next(false);
    }
  }

  /**
   * Handle keyboard events for save/cancel
   */
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.exitEditMode(true);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.exitEditMode(false);
    }
  }

  /**
   * Handle blur event
   */
  onBlur(): void {
    // Auto-save on blur for inline editing
    if (this.mode === 'read' && this.isEditing$.value) {
      this.exitEditMode(true);
    }
  }

  /**
   * Check if the control has an error
   */
  hasError(errorType?: string): boolean {
    if (errorType) {
      return this.control.hasError(errorType);
    }
    return this.control.invalid && (this.control.dirty || this.control.touched);
  }

  /**
   * Get the error message for the current error state
   */
  getErrorMessage(): string {
    if (this.control.hasError('required')) {
      return `${this.displayName || this.fieldName} is required`;
    }
    return this.getCustomErrorMessage();
  }

  /**
   * Get custom error message for type-specific validation
   * Override in child classes
   */
  protected getCustomErrorMessage(): string {
    return 'Invalid value';
  }
}
