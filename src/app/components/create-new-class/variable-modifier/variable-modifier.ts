import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { FormControl } from '@angular/forms';
import { variableConfigDef } from '@models/classEditor/variableDef';
import { ChangeDetectorRef } from '@angular/core';
import { ClassTypingService } from '@services/class-typing-service';
import { ObjectCategory } from '@models/navComponent';
import { Subscription } from 'rxjs';
import { GeoJsonDefinitionService } from '@services/geojson/geojson-definition.service';

export interface ClassOption {
  className: string;
  displayName: string;
  category: ObjectCategory;
}

export interface ClassCategoryGroup {
  label: string;
  category: ObjectCategory;
  classes: ClassOption[];
}

@Component({
  standalone: false,
  selector: 'variable-modifier',
  templateUrl: 'variable-modifier.html',
  styleUrls: ['./variable-modifier.css']
})
export class VariableModifierComponent implements OnInit, OnDestroy {

  @Input() editMode: boolean = false;
  @Input() currentClassName: string = '';

  variableConfigDefs: variableConfigDef[] = [];
  /** Per-variable inheritance validation errors */
  inheritanceErrors: Map<number, string> = new Map();
  typesAllowed = ["String", "Integer", "Decimal", "Boolean", "Date", "Date & Time", "Date Duration", "Date & Time Duration", "Time", "Time Duration", "Precision Time", "Schedule", "List", "Dictionary", "Reference", "Reference List", "Parent Reference", "Map Coordinate", "Map Line Segment", "Map Polygon", "Unique Identifier - Alphanumeric", "Numeric Index"];
  selectedType = "Select Type";
  varName = "";
  typeControl = new FormControl();

  /** All available classes grouped by category for reference selector */
  classGroups: ClassCategoryGroup[] = [];

  /** Flat list for search filtering */
  allClasses: ClassOption[] = [];

  /** Per-variable search filter controls */
  refClassSearchControls: Map<number, FormControl> = new Map();

  /** Per-variable filtered class groups */
  filteredClassGroups: Map<number, ClassCategoryGroup[]> = new Map();

  /** Classes that have GeoJSON coordinate config (are "mappable") */
  mappableClassNames = new Set<string>();

  /** Per-variable cached mappable class groups */
  mappableClassGroups: Map<number, ClassCategoryGroup[]> = new Map();

  private subscriptions: Subscription[] = [];

  constructor(
    private changeDetectorRef: ChangeDetectorRef,
    private typingService: ClassTypingService,
    private geoJsonDefService: GeoJsonDefinitionService
  ) {
    setInterval(() => {
      this.changeDetectorRef.detectChanges();
    }, 2000);
  }

  ngOnInit() {
    if (!this.editMode) {
      this.variableConfigDefs.push({
        varIndex: 1, varName: 'id', varDisplayName: 'Identifier',
        varType: 'Unique Identifier - Alphanumeric',
        soleIdentifier: true, jointIdentifier: false, isUnique: true,
        varNameControl: new FormControl(), varDisplayNameControl: new FormControl()
      });
    }

    this.buildClassList();
    this.loadMappableClasses();

    // Re-build when typing data updates
    const sub = this.typingService.polyTypingBehaviorSubject.subscribe(() => {
      this.buildClassList();
    });
    this.subscriptions.push(sub);
  }

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  private buildClassList(): void {
    const customClasses: ClassOption[] = [];
    const moduleClasses: ClassOption[] = [];
    const frameworkClasses: ClassOption[] = [];

    // Combine both lists (classes with and without instances)
    const allNavs = [
      ...this.typingService.dynamicClassNavComponents,
      ...this.typingService.unusedClassNavComponents
    ];

    // Deduplicate by className
    const seen = new Set<string>();
    for (const nav of allNavs) {
      if (!nav.className || seen.has(nav.className)) continue;
      seen.add(nav.className);

      const category = nav.objectCategory || 'custom';
      const classTyping = this.typingService.getClassPolyTyping(nav.className);
      const displayName = classTyping?.displayClassName || nav.title || nav.className;

      const option: ClassOption = {
        className: nav.className,
        displayName: displayName,
        category: category
      };

      switch (category) {
        case 'custom':
          customClasses.push(option);
          break;
        case 'materials_science':
          moduleClasses.push(option);
          break;
        case 'framework':
          frameworkClasses.push(option);
          break;
      }
    }

    // Sort each group alphabetically
    const sorter = (a: ClassOption, b: ClassOption) => a.displayName.localeCompare(b.displayName);
    customClasses.sort(sorter);
    moduleClasses.sort(sorter);
    frameworkClasses.sort(sorter);

    this.classGroups = [];
    if (customClasses.length > 0) {
      this.classGroups.push({ label: 'Custom Objects', category: 'custom', classes: customClasses });
    }
    if (moduleClasses.length > 0) {
      this.classGroups.push({ label: 'Module Objects', category: 'materials_science', classes: moduleClasses });
    }
    if (frameworkClasses.length > 0) {
      this.classGroups.push({ label: 'Framework Objects', category: 'framework', classes: frameworkClasses });
    }

    this.allClasses = [...customClasses, ...moduleClasses, ...frameworkClasses];

    // Update filtered groups for any existing reference variables
    for (const [varIndex] of this.refClassSearchControls) {
      this.updateFilteredGroups(varIndex, '');
    }

    // Rebuild mappable class groups if we have mappable data
    if (this.mappableClassNames.size > 0) {
      this.rebuildMappableClassGroups();
    }
  }

  getRefClassSearchControl(varIndex: number): FormControl {
    if (!this.refClassSearchControls.has(varIndex)) {
      const ctrl = new FormControl('');
      this.refClassSearchControls.set(varIndex, ctrl);
      this.filteredClassGroups.set(varIndex, this.classGroups);
    }
    return this.refClassSearchControls.get(varIndex)!;
  }

  getFilteredClassGroups(varIndex: number): ClassCategoryGroup[] {
    return this.filteredClassGroups.get(varIndex) || this.classGroups;
  }

  onRefClassSearchChange(varIndex: number): void {
    const ctrl = this.refClassSearchControls.get(varIndex);
    const query = ctrl?.value || '';
    this.updateFilteredGroups(varIndex, query);
  }

  private updateFilteredGroups(varIndex: number, query: string): void {
    if (!query.trim()) {
      this.filteredClassGroups.set(varIndex, this.classGroups);
      return;
    }

    const lower = query.toLowerCase();
    const filtered: ClassCategoryGroup[] = [];

    for (const group of this.classGroups) {
      const matchingClasses = group.classes.filter(c =>
        c.className.toLowerCase().includes(lower) ||
        c.displayName.toLowerCase().includes(lower)
      );
      if (matchingClasses.length > 0) {
        filtered.push({ ...group, classes: matchingClasses });
      }
    }

    this.filteredClassGroups.set(varIndex, filtered);
  }

  getRefClassDisplayName(className: string): string {
    const found = this.allClasses.find(c => c.className === className);
    return found ? found.displayName : className;
  }

  loadVariableDefinitions(variables: any[]): void {
    const reverseTypeMap: Record<string, string> = {
      'str': 'String', 'int': 'Integer', 'float': 'Decimal',
      'bool': 'Boolean', 'boolean': 'Boolean',
      'date': 'Date', 'datetime': 'Date & Time',
      'date_duration': 'Date Duration', 'datetime_duration': 'Date & Time Duration',
      'time': 'Time', 'time_duration': 'Time Duration', 'precision_time': 'Precision Time',
      'schedule': 'Schedule',
      'list': 'List', 'dict': 'Dictionary', 'reference': 'Reference',
      'referencelist': 'Reference List', 'reference_list': 'Reference List',
      'parent_reference': 'Parent Reference',
      'map_coordinate': 'Map Coordinate',
      'map_line_segment': 'Map Line Segment', 'map_polygon': 'Map Polygon'
    };
    this.variableConfigDefs = variables.map((v: any, i: number) => ({
      varIndex: i + 1,
      varName: v.varName || '',
      varDisplayName: v.varDisplayName || v.displayName || v.varName || '',
      varType: reverseTypeMap[v.varType] || v.varType || 'String',
      varRefClass: v.refClass || v.varRefClass,
      varCoordinateOrder: v.coordinateOrder || undefined,
      soleIdentifier: v.isIdentifier || v.soleIdentifier || false,
      jointIdentifier: v.jointIdentifier || false,
      isUnique: v.isUnique || false,
      varNameControl: new FormControl(),
      varDisplayNameControl: new FormControl()
    }));
  }

  addVariableDef() {
    let newIndex: number = this.variableConfigDefs.length + 1;
    this.variableConfigDefs.push({
      varIndex: newIndex, varName: '', varDisplayName: '', varType: '',
      soleIdentifier: false, jointIdentifier: false, isUnique: false,
      varNameControl: new FormControl(), varDisplayNameControl: new FormControl()
    });
    // Ensure mappable groups are cached for the new variable
    this.rebuildMappableClassGroups();
  }

  removeVariable(changedIndex: number) {
    this.variableConfigDefs.splice(changedIndex - 1, 1);
    this.variableConfigDefs.forEach((curVar: variableConfigDef) => {
      if (curVar.varIndex >= changedIndex) {
        curVar.varIndex = curVar.varIndex - 1;
      }
    });
  }

  setType(changedIndex: number, newType: string) {
    let variableDefFound = this.variableConfigDefs.find(function (v) {
      return v.varIndex === changedIndex;
    });
    if (variableDefFound) {
      variableDefFound.varType = newType;
      // Clear inheritance error when type changes away from Parent Reference
      if (newType !== 'Parent Reference') {
        this.inheritanceErrors.delete(changedIndex);
      }
    }
  }

  /**
   * Called when a ref class is selected for a Parent Reference variable.
   * Validates for circular inheritance.
   */
  onParentRefClassChange(varIndex: number, targetClassName: string): void {
    if (!targetClassName) {
      this.inheritanceErrors.delete(varIndex);
      return;
    }
    if (this.checkCircularInheritance(targetClassName, this.currentClassName)) {
      this.inheritanceErrors.set(varIndex,
        `Circular inheritance detected: ${targetClassName} already inherits from ${this.currentClassName}`
      );
    } else {
      this.inheritanceErrors.delete(varIndex);
    }
  }

  /**
   * DFS through inheritsFrom chains to detect circular inheritance.
   * Returns true if targetClassName eventually inherits from currentClassName.
   */
  checkCircularInheritance(targetClassName: string, currentClassName: string): boolean {
    if (!currentClassName || !targetClassName) return false;
    const visited = new Set<string>();
    const stack = [targetClassName];

    while (stack.length > 0) {
      const cls = stack.pop()!;
      if (cls === currentClassName) return true;
      if (visited.has(cls)) continue;
      visited.add(cls);

      const typing = this.typingService.getClassPolyTyping(cls);
      if (typing?.inheritsFrom) {
        for (const parentClass of Object.values(typing.inheritsFrom)) {
          stack.push(parentClass);
        }
      }
    }
    return false;
  }

  /**
   * Load all GeoJsonDefinitions to determine which classes are "mappable"
   * (have coordinate configuration defined).
   */
  private loadMappableClasses(): void {
    this.geoJsonDefService.fetchAllGeoJsonDefs().subscribe({
      next: (defs: any[]) => {
        this.mappableClassNames.clear();
        for (const def of defs) {
          const sourceClass = def.source_class || '';
          if (sourceClass) {
            this.mappableClassNames.add(sourceClass);
          }
        }
        this.rebuildMappableClassGroups();
      },
      error: () => {
        // Silently fail — mappable filtering just won't apply
      }
    });
  }

  /**
   * Rebuild cached mappable class groups for all existing variables.
   * Called when mappableClassNames or classGroups change.
   */
  private rebuildMappableClassGroups(): void {
    // Build unfiltered mappable groups from the full class list
    const mappableGroups: ClassCategoryGroup[] = [];
    for (const group of this.classGroups) {
      const mappableClasses = group.classes.filter(c => this.mappableClassNames.has(c.className));
      if (mappableClasses.length > 0) {
        mappableGroups.push({ ...group, classes: mappableClasses });
      }
    }
    // Cache for every variable index that exists
    for (const varDef of this.variableConfigDefs) {
      this.mappableClassGroups.set(varDef.varIndex, mappableGroups);
    }
  }

  /**
   * Get cached mappable class groups for a variable (safe for template binding).
   */
  getMappableClassGroups(varIndex: number): ClassCategoryGroup[] {
    return this.mappableClassGroups.get(varIndex) || [];
  }

  /**
   * Check if a type requires a mappable class reference.
   */
  isMapGeometryType(varType: string): boolean {
    return varType === 'Map Line Segment' || varType === 'Map Polygon';
  }

  /**
   * Check if any Parent Reference variables have circular inheritance errors.
   */
  hasInheritanceErrors(): boolean {
    return this.inheritanceErrors.size > 0;
  }
}
