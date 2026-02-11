// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/state-definition-creator/state-definition-creator.component.ts
// Component for creating and editing StateDefinitions from state-space enabled classes

import { Component, OnInit, OnDestroy, Output, EventEmitter, Input } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { Observable, Subject } from 'rxjs';
import { takeUntil, startWith, map } from 'rxjs/operators';
import {
  StateDefinition,
  StateDefinitionFactory,
  SlotDefinition,
  FieldDisplay,
  StateSpaceConfig
} from '@models/noCode/StateDefinition';
import {
  StateSpaceClassRegistry,
  StateSpaceClassMetadata,
  StateSpaceEventMethod,
  StateSpaceCategory
} from '@models/stateSpace/stateSpaceClassRegistry';
import { StateDefinitionService } from '@services/no-code-services/state-definition.service';

@Component({
  standalone: false,
  selector: 'app-state-definition-creator',
  templateUrl: './state-definition-creator.component.html',
  styleUrls: ['./state-definition-creator.component.css']
})
export class StateDefinitionCreatorComponent implements OnInit, OnDestroy {
  // Input: existing definition for editing mode
  @Input() existingDefinition?: StateDefinition;

  // Input: available solutions for nesting
  @Input() set availableSolutionsInput(solutions: { id?: number; name: string }[]) {
    if (solutions) {
      this.loadAvailableSolutions(solutions);
    }
  }

  // Output: emit when definition is saved
  @Output() definitionSaved = new EventEmitter<StateDefinition>();
  @Output() cancelled = new EventEmitter<void>();

  // Form group for the definition
  definitionForm!: FormGroup;

  // Available state-space classes (user-defined only, not built-in)
  availableClasses: StateSpaceClassMetadata[] = [];
  filteredClasses$!: Observable<StateSpaceClassMetadata[]>;

  // Available solutions that can be used as nested definitions
  availableSolutions: { name: string; displayName: string }[] = [];

  // Source type: 'class' for user-defined classes, 'solution' for nested solutions
  sourceType: 'class' | 'solution' = 'class';

  // Selected class and its metadata
  selectedClass: StateSpaceClassMetadata | null = null;
  selectedEventMethod: StateSpaceEventMethod | null = null;

  // Preview data
  previewInputSlots: SlotDefinition[] = [];
  previewOutputSlots: SlotDefinition[] = [];

  // Categories for grouping
  categories: StateSpaceCategory[] = [];

  // Registry reference
  private registry = StateSpaceClassRegistry.getInstance();
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private stateDefinitionService: StateDefinitionService
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.loadAvailableClasses();
    this.setupFormSubscriptions();

    // If editing, populate the form
    if (this.existingDefinition) {
      this.populateFormForEditing();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Initialize the form with validators
   */
  private initializeForm(): void {
    this.definitionForm = this.fb.group({
      name: ['', Validators.required],
      displayName: ['', Validators.required],
      sourceClassName: ['', Validators.required],
      eventMethodName: [''],
      description: [''],
      category: ['General'],
      icon: [''],
      color: ['#3f51b5'],
      fieldsPerRow: [1],
      displayFields: this.fb.array([])
    });
  }

  /**
   * Load available state-space classes from registry and service
   * Only loads user-defined classes (not built-in system classes)
   */
  private loadAvailableClasses(): void {
    // Get only user-defined classes (not built-in system classes like ForLoop, ConditionalChain, etc.)
    // Built-in classes are already available in the sidebar and don't need custom definitions
    this.availableClasses = this.registry.getUserDefinedClasses();

    // Also include solution-based definitions
    const solutionDefs = this.registry.getSolutionDefinitions();
    this.availableClasses = [...this.availableClasses, ...solutionDefs];

    // Get categories from available classes only
    const categorySet = new Set(this.availableClasses.map(c => c.category));
    this.categories = Array.from(categorySet) as StateSpaceCategory[];

    // If no user-defined classes exist yet, show a helpful message
    // The user can still create definitions from solutions

    // Setup autocomplete filtering
    this.filteredClasses$ = this.definitionForm.get('sourceClassName')!.valueChanges.pipe(
      startWith(''),
      map(value => this.filterClasses(value || ''))
    );
  }

  /**
   * Load available solutions that can be used as nested definitions
   */
  loadAvailableSolutions(solutions: { name: string; displayName?: string }[]): void {
    this.availableSolutions = solutions.map(s => ({
      name: s.name,
      displayName: s.displayName || s.name
    }));
  }

  /**
   * Set source type (class or solution)
   */
  setSourceType(type: 'class' | 'solution'): void {
    this.sourceType = type;
    this.definitionForm.patchValue({ sourceClassName: '' });
    this.selectedClass = null;
    this.selectedEventMethod = null;
    this.clearDisplayFields();
  }

  /**
   * Handle solution selection for nested solution definition
   */
  onSolutionSelected(solutionName: string): void {
    // Check if the solution is already registered in the registry
    if (this.registry.isSolutionRegistered(solutionName)) {
      // Use existing registration
      const className = `Solution_${solutionName.replace(/[^a-zA-Z0-9]/g, '_')}`;
      this.definitionForm.patchValue({ sourceClassName: className });
      this.onClassSelected(className);
    } else {
      // Create a temporary metadata for the solution
      const solution = this.availableSolutions.find(s => s.name === solutionName);
      if (solution) {
        this.definitionForm.patchValue({
          name: `${solutionName}_definition`,
          displayName: solution.displayName,
          sourceClassName: `Solution_${solutionName}`,
          category: 'Custom',
          icon: 'account_tree',
          color: '#673AB7'
        });
      }
    }
  }

  /**
   * Filter classes for autocomplete
   */
  private filterClasses(filterValue: string): StateSpaceClassMetadata[] {
    const filter = filterValue.toLowerCase();
    return this.availableClasses.filter(cls =>
      cls.className.toLowerCase().includes(filter) ||
      cls.displayName.toLowerCase().includes(filter) ||
      cls.category.toLowerCase().includes(filter)
    );
  }

  /**
   * Setup form value change subscriptions
   */
  private setupFormSubscriptions(): void {
    // When source class changes, update event methods and preview
    this.definitionForm.get('sourceClassName')!.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(className => {
        this.onClassSelected(className);
      });

    // When event method changes, update slots preview
    this.definitionForm.get('eventMethodName')!.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(methodName => {
        this.onEventMethodSelected(methodName);
      });
  }

  /**
   * Handle class selection
   */
  onClassSelected(className: string): void {
    this.selectedClass = this.registry.getClass(className) || null;

    if (this.selectedClass) {
      // Update display name suggestion
      if (!this.definitionForm.get('displayName')!.value) {
        this.definitionForm.patchValue({
          displayName: this.selectedClass.displayName
        });
      }

      // Update category
      this.definitionForm.patchValue({
        category: this.selectedClass.category,
        icon: this.selectedClass.icon,
        color: this.selectedClass.color
      });

      // Set default event method if only one exists
      if (this.selectedClass.eventMethods.length === 1) {
        this.definitionForm.patchValue({
          eventMethodName: this.selectedClass.eventMethods[0].methodName
        });
      }

      // Populate display fields from class variables
      this.populateDisplayFields();
    } else {
      this.selectedEventMethod = null;
      this.clearDisplayFields();
    }
  }

  /**
   * Handle event method selection
   */
  onEventMethodSelected(methodName: string): void {
    if (!this.selectedClass) return;

    this.selectedEventMethod = this.selectedClass.eventMethods
      .find(em => em.methodName === methodName) || null;

    this.updateSlotsPreview();
  }

  /**
   * Update the slots preview based on selected event method
   */
  private updateSlotsPreview(): void {
    if (!this.selectedEventMethod) {
      this.previewInputSlots = [];
      this.previewOutputSlots = [];
      return;
    }

    // Generate input slots from event params
    this.previewInputSlots = this.selectedEventMethod.inputParams.map(param => ({
      name: param.name,
      displayName: param.displayName,
      slotType: 'input' as const,
      dataType: param.type,
      isRequired: param.isRequired,
      defaultValue: param.defaultValue,
      description: ''
    }));

    // Generate output slot
    this.previewOutputSlots = [{
      name: 'output',
      displayName: this.selectedEventMethod.output.displayName,
      slotType: 'output' as const,
      dataType: this.selectedEventMethod.output.type,
      isRequired: false
    }];
  }

  /**
   * Populate display fields from class variables
   */
  private populateDisplayFields(): void {
    const displayFieldsArray = this.definitionForm.get('displayFields') as FormArray;
    displayFieldsArray.clear();

    if (!this.selectedClass) return;

    this.selectedClass.variables.forEach((variable, index) => {
      displayFieldsArray.push(this.fb.group({
        fieldName: [variable.name],
        displayName: [variable.displayName],
        visible: [true],
        row: [Math.floor(index / 2)],
        editable: [true],
        fieldType: [this.mapTypeToFieldType(variable.type)]
      }));
    });
  }

  /**
   * Map a type string to a field type
   */
  private mapTypeToFieldType(type: string): string {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('bool')) return 'boolean';
    if (lowerType.includes('int') || lowerType.includes('float') || lowerType.includes('number')) return 'number';
    if (lowerType.includes('date')) return 'date';
    if (lowerType.includes('select') || lowerType.includes('enum')) return 'select';
    return 'text';
  }

  /**
   * Clear display fields
   */
  private clearDisplayFields(): void {
    const displayFieldsArray = this.definitionForm.get('displayFields') as FormArray;
    displayFieldsArray.clear();
  }

  /**
   * Populate form for editing mode
   */
  private populateFormForEditing(): void {
    if (!this.existingDefinition) return;

    this.definitionForm.patchValue({
      name: this.existingDefinition.name,
      displayName: this.existingDefinition.displayName,
      sourceClassName: this.existingDefinition.sourceClassName,
      eventMethodName: this.existingDefinition.eventMethodName,
      description: this.existingDefinition.description,
      category: this.existingDefinition.category,
      icon: this.existingDefinition.icon,
      color: this.existingDefinition.color,
      fieldsPerRow: this.existingDefinition.fieldsPerRow
    });

    // Populate display fields
    const displayFieldsArray = this.definitionForm.get('displayFields') as FormArray;
    displayFieldsArray.clear();

    this.existingDefinition.displayFields.forEach(field => {
      displayFieldsArray.push(this.fb.group({
        fieldName: [field.fieldName],
        displayName: [field.displayName],
        visible: [field.visible],
        row: [field.row],
        editable: [field.editable],
        fieldType: [field.fieldType]
      }));
    });

    // Update preview
    this.previewInputSlots = [...this.existingDefinition.inputSlots];
    this.previewOutputSlots = [...this.existingDefinition.outputSlots];
  }

  /**
   * Get display fields form array
   */
  get displayFieldsArray(): FormArray {
    return this.definitionForm.get('displayFields') as FormArray;
  }

  /**
   * Toggle field visibility
   */
  toggleFieldVisibility(index: number): void {
    const field = this.displayFieldsArray.at(index);
    field.patchValue({ visible: !field.value.visible });
  }

  /**
   * Move field up in order
   */
  moveFieldUp(index: number): void {
    if (index === 0) return;
    const fields = this.displayFieldsArray;
    const field = fields.at(index);
    fields.removeAt(index);
    fields.insert(index - 1, field);
    this.updateFieldRows();
  }

  /**
   * Move field down in order
   */
  moveFieldDown(index: number): void {
    const fields = this.displayFieldsArray;
    if (index >= fields.length - 1) return;
    const field = fields.at(index);
    fields.removeAt(index);
    fields.insert(index + 1, field);
    this.updateFieldRows();
  }

  /**
   * Update field row assignments based on fieldsPerRow
   */
  private updateFieldRows(): void {
    const fieldsPerRow = this.definitionForm.get('fieldsPerRow')!.value;
    this.displayFieldsArray.controls.forEach((control, index) => {
      control.patchValue({ row: Math.floor(index / fieldsPerRow) });
    });
  }

  /**
   * Save the state definition
   */
  saveDefinition(): void {
    if (this.definitionForm.invalid) {
      console.warn('[StateDefinitionCreator] Form is invalid');
      return;
    }

    const formValue = this.definitionForm.value;

    const definition: StateDefinition = {
      id: this.existingDefinition?.id,
      name: formValue.name,
      displayName: formValue.displayName,
      sourceClassName: formValue.sourceClassName,
      eventMethodName: formValue.eventMethodName,
      inputSlots: this.previewInputSlots,
      outputSlots: this.previewOutputSlots,
      displayFields: formValue.displayFields.map((f: any) => ({
        fieldName: f.fieldName,
        displayName: f.displayName,
        visible: f.visible,
        row: f.row,
        editable: f.editable,
        fieldType: f.fieldType
      })),
      fieldsPerRow: formValue.fieldsPerRow,
      description: formValue.description,
      category: formValue.category,
      icon: formValue.icon,
      color: formValue.color
    };

    // Validate
    const validation = StateDefinitionFactory.validate(definition);
    if (!validation.isValid) {
      console.error('[StateDefinitionCreator] Validation errors:', validation.errors);
      return;
    }

    // Save via service
    try {
      const saved = this.existingDefinition
        ? this.stateDefinitionService.updateStateDefinition(this.existingDefinition.id!, definition)
        : this.stateDefinitionService.createStateDefinition(definition);

      if (saved) {
        this.definitionSaved.emit(saved);
      }
    } catch (error) {
      console.error('[StateDefinitionCreator] Save error:', error);
    }
  }

  /**
   * Cancel and close
   */
  cancel(): void {
    this.cancelled.emit();
  }

  /**
   * Get classes grouped by category
   */
  getClassesByCategory(): { category: StateSpaceCategory; classes: StateSpaceClassMetadata[] }[] {
    return this.categories.map(category => ({
      category,
      classes: this.availableClasses.filter(cls => cls.category === category)
    }));
  }
}
