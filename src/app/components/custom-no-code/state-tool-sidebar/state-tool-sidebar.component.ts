// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/state-tool-sidebar/state-tool-sidebar.component.ts
// Side toolbar for selecting state definitions and creating state instances

import { Component, OnInit, OnDestroy, Output, EventEmitter, Input } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { StateDefinition } from '@models/noCode/StateDefinition';
import {
  StateSpaceClassRegistry,
  StateSpaceClassMetadata,
  StateSpaceCategory
} from '@models/stateSpace/stateSpaceClassRegistry';
import { StateDefinitionService } from '@services/no-code-services/state-definition.service';

export interface StateToolItem {
  id: string;
  name: string;
  displayName: string;
  icon?: string;
  color?: string;
  category: string;
  type: 'definition' | 'builtin' | 'helper' | 'subsolution';
  sourceClassName: string;
  svgShape?: string;
  // Code generation template for Python
  pythonTemplate?: string;
}

// Represents a helper class that can be used in the solution
export interface HelperClassDefinition {
  className: string;
  displayName: string;
  description: string;
  fields: ClassFieldDefinition[];
  methods: ClassMethodDefinition[];
  pythonImports?: string[];
  isEnabled: boolean; // Whether this class is enabled for use in the solution
}

// Represents a sub-solution that can be used as a state
export interface SubSolutionDefinition {
  solutionName: string;
  displayName: string;
  description: string;
  inputParams: { name: string; type: string }[];
  outputType: string;
  icon?: string;
  color?: string;
}

// Represents a class field/property
export interface ClassFieldDefinition {
  name: string;
  displayName: string;
  type: string;
  defaultValue?: any;
  description?: string;
}

// Represents a class method
export interface ClassMethodDefinition {
  name: string;
  displayName: string;
  parameters: { name: string; type: string; default?: any }[];
  returnType: string;
  description?: string;
}

// Represents a bound class definition for the solution
export interface BoundClassDefinition {
  className: string;
  displayName: string;
  description: string;
  fields: ClassFieldDefinition[];
  methods: ClassMethodDefinition[];
  pythonImports?: string[];
}

// Request to create a state from a class member (field or method)
export interface ClassMemberStateRequest {
  type: 'field' | 'method';
  className: string;
  memberName: string;
  // For fields: represents accessing/setting the field value
  field?: ClassFieldDefinition;
  // For methods: represents calling the method
  method?: ClassMethodDefinition;
  // Number of input slots (for methods: params.length, for fields: 0 for get, 1 for set)
  inputSlotCount: number;
  // Number of output slots (typically 1 for return value)
  outputSlotCount: number;
}

// Available SVG shapes for states
export const AVAILABLE_SVG_SHAPES = [
  { id: 'circle', name: 'Circle', icon: 'radio_button_unchecked' },
  { id: 'rectangle', name: 'Rectangle', icon: 'crop_square' },
  { id: 'rounded-rect', name: 'Rounded Rectangle', icon: 'rounded_corner' },
  { id: 'diamond', name: 'Diamond', icon: 'change_history' },
  { id: 'hexagon', name: 'Hexagon', icon: 'hexagon' },
  { id: 'parallelogram', name: 'Parallelogram', icon: 'category' }
];

@Component({
  selector: 'app-state-tool-sidebar',
  templateUrl: './state-tool-sidebar.component.html',
  styleUrls: ['./state-tool-sidebar.component.css']
})
export class StateToolSidebarComponent implements OnInit, OnDestroy {
  @Input() isExpanded = true;

  // The class this solution is bound to (Solution Class)
  @Input() boundClass: BoundClassDefinition | null = null;

  // Available helper classes that can be added to the solution
  @Input() availableHelperClasses: HelperClassDefinition[] = [];

  // Helper classes currently enabled for this solution
  @Input() enabledHelperClasses: HelperClassDefinition[] = [];

  // Available sub-solutions that can be used as states
  @Input() availableSubSolutions: SubSolutionDefinition[] = [];

  // Generated Python code from the solution
  @Input() generatedPythonCode: string = '';

  // Current solution name
  @Input() solutionName: string = '';

  @Output() createStateFromDefinition = new EventEmitter<StateToolItem>();
  @Output() openDefinitionCreator = new EventEmitter<void>();
  @Output() toggleExpanded = new EventEmitter<boolean>();

  // Event for creating states from class fields or methods
  @Output() createStateFromClassMember = new EventEmitter<ClassMemberStateRequest>();

  // Event for toggling a helper class on/off
  @Output() toggleHelperClass = new EventEmitter<HelperClassDefinition>();

  // Event for creating a state from a sub-solution
  @Output() createStateFromSubSolution = new EventEmitter<SubSolutionDefinition>();

  // Current tab: 'blocks', 'solutionClass', 'helperClasses', 'subSolutions', or 'code'
  activeTab: 'blocks' | 'solutionClass' | 'helperClasses' | 'subSolutions' | 'code' = 'blocks';

  // Built-in items grouped by category (base blocks)
  builtinItemsByCategory: Map<string, StateToolItem[]> = new Map();
  builtinCategories: string[] = [];

  // Search query for helper classes
  helperClassSearchQuery = '';
  filteredHelperClasses: HelperClassDefinition[] = [];

  // Search query for sub-solutions
  subSolutionSearchQuery = '';
  filteredSubSolutions: SubSolutionDefinition[] = [];

  // Currently selected helper class to view details
  selectedHelperClass: HelperClassDefinition | null = null;

  // Search
  searchQuery = '';

  // Expanded categories (for built-in tab)
  expandedCategories: Set<string> = new Set();

  // Selected SVG shape for new states
  selectedSvgShape = 'circle';
  availableSvgShapes = AVAILABLE_SVG_SHAPES;

  private registry = StateSpaceClassRegistry.getInstance();
  private destroy$ = new Subject<void>();

  constructor(private stateDefinitionService: StateDefinitionService) {}

  ngOnInit(): void {
    this.loadBuiltinItems();
    this.filterHelperClasses();
    this.filterSubSolutions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load built-in state-space classes from registry
   */
  private loadBuiltinItems(): void {
    this.builtinItemsByCategory.clear();

    const builtInClasses = this.registry.getAllClasses();
    builtInClasses.forEach(metadata => {
      const item: StateToolItem = {
        id: `builtin_${metadata.className}`,
        name: metadata.className,
        displayName: metadata.displayName,
        icon: metadata.icon,
        color: metadata.color,
        category: metadata.category,
        type: 'builtin',
        sourceClassName: metadata.className
      };

      const category = metadata.category || 'Other';
      if (!this.builtinItemsByCategory.has(category)) {
        this.builtinItemsByCategory.set(category, []);
      }
      this.builtinItemsByCategory.get(category)!.push(item);
    });

    this.builtinCategories = Array.from(this.builtinItemsByCategory.keys()).sort();

    // Expand first few categories by default
    if (this.expandedCategories.size === 0) {
      this.builtinCategories.slice(0, 3).forEach(cat => this.expandedCategories.add(cat));
    }
  }

  /**
   * Filter helper classes based on search
   */
  filterHelperClasses(): void {
    if (!this.helperClassSearchQuery.trim()) {
      this.filteredHelperClasses = [...this.availableHelperClasses];
      return;
    }

    const query = this.helperClassSearchQuery.toLowerCase();
    this.filteredHelperClasses = this.availableHelperClasses.filter(cls =>
      cls.displayName.toLowerCase().includes(query) ||
      cls.className.toLowerCase().includes(query) ||
      cls.description.toLowerCase().includes(query)
    );
  }

  /**
   * Filter sub-solutions based on search
   */
  filterSubSolutions(): void {
    if (!this.subSolutionSearchQuery.trim()) {
      this.filteredSubSolutions = [...this.availableSubSolutions];
      return;
    }

    const query = this.subSolutionSearchQuery.toLowerCase();
    this.filteredSubSolutions = this.availableSubSolutions.filter(sol =>
      sol.displayName.toLowerCase().includes(query) ||
      sol.solutionName.toLowerCase().includes(query) ||
      sol.description.toLowerCase().includes(query)
    );
  }

  /**
   * Check if a helper class is enabled
   */
  isHelperClassEnabled(cls: HelperClassDefinition): boolean {
    return this.enabledHelperClasses.some(c => c.className === cls.className);
  }

  /**
   * Toggle a helper class on/off
   */
  onToggleHelperClass(cls: HelperClassDefinition): void {
    this.toggleHelperClass.emit(cls);
  }

  /**
   * Select a helper class to view its details
   */
  selectHelperClass(cls: HelperClassDefinition): void {
    this.selectedHelperClass = cls;
  }

  /**
   * Clear helper class selection
   */
  clearHelperClassSelection(): void {
    this.selectedHelperClass = null;
  }

  /**
   * Create a state from a helper class field
   */
  createHelperFieldGetterState(cls: HelperClassDefinition, field: ClassFieldDefinition): void {
    const request: ClassMemberStateRequest = {
      type: 'field',
      className: cls.className,
      memberName: field.name,
      field: field,
      inputSlotCount: 0,
      outputSlotCount: 1
    };
    this.createStateFromClassMember.emit(request);
  }

  createHelperFieldSetterState(cls: HelperClassDefinition, field: ClassFieldDefinition): void {
    const request: ClassMemberStateRequest = {
      type: 'field',
      className: cls.className,
      memberName: `set_${field.name}`,
      field: field,
      inputSlotCount: 1,
      outputSlotCount: 0
    };
    this.createStateFromClassMember.emit(request);
  }

  /**
   * Create a state from a helper class method
   */
  createHelperMethodState(cls: HelperClassDefinition, method: ClassMethodDefinition): void {
    const inputCount = method.parameters?.length || 0;
    const request: ClassMemberStateRequest = {
      type: 'method',
      className: cls.className,
      memberName: method.name,
      method: method,
      inputSlotCount: inputCount,
      outputSlotCount: 1
    };
    this.createStateFromClassMember.emit(request);
  }

  /**
   * Create a state from a sub-solution
   */
  onCreateSubSolutionState(subSolution: SubSolutionDefinition): void {
    this.createStateFromSubSolution.emit(subSolution);
  }

  /**
   * Switch active tab
   */
  setActiveTab(tab: 'blocks' | 'solutionClass' | 'helperClasses' | 'subSolutions' | 'code'): void {
    this.activeTab = tab;
    this.searchQuery = '';
    this.helperClassSearchQuery = '';
    this.subSolutionSearchQuery = '';
    this.selectedHelperClass = null;
    this.filterHelperClasses();
    this.filterSubSolutions();
  }

  /**
   * Toggle category expansion
   */
  toggleCategory(category: string): void {
    if (this.expandedCategories.has(category)) {
      this.expandedCategories.delete(category);
    } else {
      this.expandedCategories.add(category);
    }
  }

  /**
   * Check if category is expanded
   */
  isCategoryExpanded(category: string): boolean {
    return this.expandedCategories.has(category);
  }

  /**
   * Handle clicking on a tool item to create a state
   */
  onItemClick(item: StateToolItem): void {
    // Add the selected SVG shape to the item
    const itemWithShape: StateToolItem = {
      ...item,
      svgShape: this.selectedSvgShape
    };
    this.createStateFromDefinition.emit(itemWithShape);
  }

  /**
   * Handle drag start for drag-and-drop state creation
   */
  onItemDragStart(event: DragEvent, item: StateToolItem): void {
    if (event.dataTransfer) {
      const itemWithShape = { ...item, svgShape: this.selectedSvgShape };
      event.dataTransfer.setData('application/json', JSON.stringify(itemWithShape));
      event.dataTransfer.effectAllowed = 'copy';
    }
  }

  /**
   * Open the state definition creator
   */
  onCreateDefinition(): void {
    this.openDefinitionCreator.emit();
  }

  /**
   * Toggle sidebar expansion
   */
  onToggleExpanded(): void {
    this.isExpanded = !this.isExpanded;
    this.toggleExpanded.emit(this.isExpanded);
  }

  /**
   * Get items for a category
   */
  getItemsForCategory(category: string): StateToolItem[] {
    return this.builtinItemsByCategory.get(category) || [];
  }

  /**
   * Clear search (general)
   */
  clearSearch(): void {
    this.searchQuery = '';
  }

  /**
   * Get icon for a category
   */
  getCategoryIcon(category: string): string {
    const iconMap: { [key: string]: string } = {
      'Control Flow': 'call_split',
      'Conditionals': 'device_hub',
      'Loops': 'loop',
      'Data': 'filter_list',
      'Debug': 'bug_report',
      'Custom': 'extension'
    };
    return iconMap[category] || 'widgets';
  }

  /**
   * Get color for a category
   */
  getCategoryColor(category: string): string {
    const colorMap: { [key: string]: string } = {
      'Control Flow': '#F44336',
      'Conditionals': '#4CAF50',
      'Loops': '#2196F3',
      'Data': '#00BCD4',
      'Debug': '#607D8B',
      'Custom': '#795548'
    };
    return colorMap[category] || '#666';
  }

  /**
   * Clear helper class search
   */
  clearHelperClassSearch(): void {
    this.helperClassSearchQuery = '';
    this.filterHelperClasses();
  }

  /**
   * Clear sub-solution search
   */
  clearSubSolutionSearch(): void {
    this.subSolutionSearchQuery = '';
    this.filterSubSolutions();
  }

  /**
   * Get sub-solution input params as string
   */
  getSubSolutionParamsString(subSolution: SubSolutionDefinition): string {
    if (!subSolution.inputParams || subSolution.inputParams.length === 0) {
      return 'No inputs';
    }
    return subSolution.inputParams.map(p => `${p.name}: ${p.type}`).join(', ');
  }

  /**
   * Select SVG shape
   */
  selectSvgShape(shapeId: string): void {
    this.selectedSvgShape = shapeId;
  }

  /**
   * Get selected shape info
   */
  getSelectedShapeInfo() {
    return this.availableSvgShapes.find(s => s.id === this.selectedSvgShape);
  }

  /**
   * Get function name from solution name (snake_case)
   */
  getFunctionName(): string {
    if (!this.solutionName) return '';
    return this.solutionName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  }

  /**
   * Get method parameters as a string for display
   */
  getMethodParamsString(method: ClassMethodDefinition): string {
    if (!method.parameters || method.parameters.length === 0) {
      return 'self';
    }
    const params = method.parameters.map(p => {
      if (p.default !== undefined) {
        return `${p.name}: ${p.type} = ${JSON.stringify(p.default)}`;
      }
      return `${p.name}: ${p.type}`;
    });
    return `self, ${params.join(', ')}`;
  }

  /**
   * Generate Python class preview from bound class definition
   */
  getPythonClassPreview(): string {
    if (!this.boundClass) {
      return '';
    }

    const lines: string[] = [];

    // Imports
    if (this.boundClass.pythonImports && this.boundClass.pythonImports.length > 0) {
      this.boundClass.pythonImports.forEach(imp => {
        lines.push(imp);
      });
      lines.push('');
    }

    // Class definition
    lines.push(`class ${this.boundClass.className}:`);
    lines.push(`    """${this.boundClass.description}"""`);
    lines.push('');

    // __init__ method
    lines.push('    def __init__(self):');
    if (this.boundClass.fields.length > 0) {
      this.boundClass.fields.forEach(field => {
        const defaultVal = field.defaultValue !== undefined
          ? JSON.stringify(field.defaultValue)
          : this.getDefaultForType(field.type);
        lines.push(`        self.${field.name} = ${defaultVal}`);
      });
    } else {
      lines.push('        pass');
    }
    lines.push('');

    // Methods
    this.boundClass.methods.forEach(method => {
      const params = this.getMethodParamsString(method);
      lines.push(`    def ${method.name}(${params}) -> ${method.returnType}:`);
      if (method.description) {
        lines.push(`        """${method.description}"""`);
      }
      lines.push('        pass  # Implementation via no-code');
      lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * Get Python default value for a type
   */
  private getDefaultForType(type: string): string {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('str')) return '""';
    if (lowerType.includes('int')) return '0';
    if (lowerType.includes('float')) return '0.0';
    if (lowerType.includes('bool')) return 'False';
    if (lowerType.includes('list')) return '[]';
    if (lowerType.includes('dict')) return '{}';
    if (lowerType.includes('optional')) return 'None';
    return 'None';
  }

  // ==================== Class Member State Creation ====================

  /**
   * Create a state for accessing a field value (getter)
   * Creates a state with 0 input slots and 1 output slot (the field value)
   */
  createFieldGetterState(field: ClassFieldDefinition): void {
    if (!this.boundClass) return;

    const request: ClassMemberStateRequest = {
      type: 'field',
      className: this.boundClass.className,
      memberName: field.name,
      field: field,
      inputSlotCount: 0, // No inputs needed for getter
      outputSlotCount: 1 // One output: the field value
    };

    this.createStateFromClassMember.emit(request);
  }

  /**
   * Create a state for setting a field value (setter)
   * Creates a state with 1 input slot (the new value) and 0 output slots
   */
  createFieldSetterState(field: ClassFieldDefinition): void {
    if (!this.boundClass) return;

    const request: ClassMemberStateRequest = {
      type: 'field',
      className: this.boundClass.className,
      memberName: `set_${field.name}`,
      field: field,
      inputSlotCount: 1, // One input: the new value
      outputSlotCount: 0 // No output for setter
    };

    this.createStateFromClassMember.emit(request);
  }

  /**
   * Create a state for calling a method
   * Creates a state with input slots for each parameter (excluding self) and 1 output slot
   */
  createMethodState(method: ClassMethodDefinition): void {
    if (!this.boundClass) return;

    // Count parameters excluding 'self' (which is the core class instance)
    const inputCount = method.parameters?.length || 0;

    const request: ClassMemberStateRequest = {
      type: 'method',
      className: this.boundClass.className,
      memberName: method.name,
      method: method,
      inputSlotCount: inputCount,
      outputSlotCount: 1 // One output: the return value
    };

    this.createStateFromClassMember.emit(request);
  }

  /**
   * Get the number of parameters for a method (excluding self)
   */
  getMethodParamCount(method: ClassMethodDefinition): number {
    return method.parameters?.length || 0;
  }
}
