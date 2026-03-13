import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { FormControl } from '@angular/forms';
import { variableConfigDef } from '@models/classEditor/variableDef';
import { ChangeDetectorRef } from '@angular/core';
import { ClassTypingService } from '@services/class-typing-service';
import { ObjectCategory } from '@models/navComponent';
import { Subscription } from 'rxjs';

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

  variableConfigDefs: variableConfigDef[] = [];
  typesAllowed = ["String", "Integer", "Decimal", "List", "Dictionary", "Reference", "Reference List", "Unique Identifier - Alphanumeric", "Numeric Index"];
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

  private subscriptions: Subscription[] = [];

  constructor(
    private changeDetectorRef: ChangeDetectorRef,
    private typingService: ClassTypingService
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
      'list': 'List', 'dict': 'Dictionary', 'reference': 'Reference',
      'referencelist': 'Reference List', 'reference_list': 'Reference List'
    };
    this.variableConfigDefs = variables.map((v: any, i: number) => ({
      varIndex: i + 1,
      varName: v.varName || '',
      varDisplayName: v.varDisplayName || v.displayName || v.varName || '',
      varType: reverseTypeMap[v.varType] || v.varType || 'String',
      varRefClass: v.refClass || v.varRefClass,
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
    }
  }
}
