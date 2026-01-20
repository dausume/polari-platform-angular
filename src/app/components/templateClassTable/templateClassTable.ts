import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, Type, SimpleChanges } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { polariNode } from '@models/polariNode';
import { PolariService } from '@services/polari-service';
import { CRUDEservicesManager } from '@services/crude-services-manager';
import { CRUDEclassService } from '@services/crude-class-service';
import { MatGridList, MatGridTile } from '@angular/material/grid-list';
import { BehaviorSubject, interval, Observable, Observer, Subscription } from 'rxjs';
import { MatTableModule } from '@angular/material/table';
import { DefaultCellComponent } from './type-cells/default-cell/default-cell'
//Models
//import { templateClass } from '@models/templateClass';
import { dataSetCollection } from '@models/objectData/dataSetCollection';
import { dataSet } from '@models/objectData/dataSet';
import { classPolyTyping } from '@models/polyTyping/classPolyTyping';
import { objectIdentifiersSpec } from '@models/objectIdentifiersSpec';
import { variablePolyTyping } from '@models/polyTyping/variablePolyTyping';
import { TableConfig } from '@models/tableConfiguration';

@Component({
  selector: 'template-class-table',
  templateUrl: 'templateClassTable.html',
  styleUrls: ['./templateClassTable.css']
})
export class templateClassTableComponent implements OnInit, OnDestroy {

  @Input() className?: string;
  @Input() classTypeData: any = {};
  @Input() filter?: object = {};
  @Input() shownVars: string[] = [];

  formattedClassName?: string;
  instanceList: any[] = [];
  polyVarRefs: any[] = [];
  tableConfig: TableConfig;
  crudeService?: CRUDEclassService;
  private componentId: string = 'templateClassTableComponent';

  constructor(private polari: PolariService, private crudeManager: CRUDEservicesManager) {
    // Initialize with default configuration
    this.tableConfig = new TableConfig({
      sortOrder: 'alphabetical',
      sortDirection: 'asc',
      defaultExpanded: false,
      expandedSections: ['data']
    });
  }

  ngOnInit()
  {
    //Get a list of object references to polyTypedVars that sould be retrieved.
    //let varsData = this.classTypeData.completeVariableTypingData;
    //let varsList = Object.keys(varsData);
    this.formattedClassName = this.className;

    // Load saved configuration if available
    if (this.className) {
      this.tableConfig = TableConfig.load(this.className);
    }

    console.log("-- PolyTypedVar References --");
    console.log(this.polyVarRefs);
    console.log("Reached end of class table ngOnInit");
    this.getTypingData();
    this.loadInstanceData();
  }

  
  ngOnChanges(changes: SimpleChanges)
  {
    console.log("Logging a change in an input value.");
    console.log(changes);

    // Handle className changes - clear old data and reload for new class
    if(changes.className && !changes.className.firstChange)
    {
      console.log("ClassName changed from", changes.className.previousValue, "to", changes.className.currentValue);

      // Clear old instance data
      this.instanceList = [];

      // Clean up old service utilization
      if (this.crudeService && changes.className.previousValue) {
        this.crudeService.removeUtilizer(this.componentId);
        this.crudeManager.decrementUtilizerCounter(changes.className.previousValue);
        this.crudeManager.cleanupUnusedService(changes.className.previousValue);
      }

      // Load new configuration for the new class
      if (this.className) {
        this.formattedClassName = this.className;
        this.tableConfig = TableConfig.load(this.className);
      }

      // Reload typing data and instance data for new class
      this.getTypingData();
      this.loadInstanceData();
    }

    if(changes.classTypeData && !changes.classTypeData.firstChange)
    {
      console.log("Previous classTypeData : ", changes.classTypeData.previousValue);
      console.log("New classTypeData : ", changes.classTypeData.currentValue);
      this.getTypingData();
    }
  }

  getTypingData()
  {
    console.log("[TemplateClassTable] getTypingData() for:", this.className);
    console.log("[TemplateClassTable] classTypeData:", this.classTypeData);

    // Guard against undefined/null classTypeData
    if (!this.classTypeData) {
      console.warn("[TemplateClassTable] classTypeData is undefined/null - skipping");
      this.shownVars = [];
      return;
    }

    //Get all of the keys (Variable Names) and use them to establish the headers.
    let keys = Object.keys(this.classTypeData);
    console.log("[TemplateClassTable] classTypeData keys:", keys);
    this.shownVars = [];

    // Clean up removed columns - remove any that no longer exist in classTypeData
    if (this.tableConfig.removedColumns) {
      this.tableConfig.removedColumns = this.tableConfig.removedColumns.filter(col => keys.includes(col));
    }

    const removedColumns = this.tableConfig.removedColumns || [];

    if(keys !== undefined)
    {
      for (let key of keys) {
        // Only add if not in removed columns
        if (!removedColumns.includes(key)) {
          this.shownVars.push(key);
        }
      }
      console.log("keys were defined.")
    }

    // Apply sorting based on configuration
    this.sortShownVars();

    console.log("shownVars")
    console.log(this.shownVars);
    console.log("this.classTypeData : ", this.classTypeData)
    this.polyVarRefs = this.classTypeData;
    console.log("this.polyVarRefs : ", this.polyVarRefs["completeVariableTypingData"])
  }

  /**
   * Sort shownVars array based on table configuration
   */
  sortShownVars()
  {
    if (this.tableConfig.sortOrder === 'alphabetical') {
      this.shownVars.sort((a, b) => {
        const comparison = a.localeCompare(b);
        return this.tableConfig.sortDirection === 'asc' ? comparison : -comparison;
      });
    }
    // Additional sort options can be added here (by type, custom order, etc.)
  }

  /**
   * Change sort order and update configuration
   */
  setSortOrder(sortOrder: 'alphabetical' | 'custom' | 'type' | 'none')
  {
    this.tableConfig.sortOrder = sortOrder;
    this.sortShownVars();
    this.saveConfiguration();
  }

  /**
   * Toggle sort direction
   */
  toggleSortDirection()
  {
    this.tableConfig.sortDirection = this.tableConfig.sortDirection === 'asc' ? 'desc' : 'asc';
    this.sortShownVars();
    this.saveConfiguration();
  }

  /**
   * Toggle section expansion state
   */
  toggleSection(sectionName: string)
  {
    this.tableConfig.toggleSection(sectionName);
    this.saveConfiguration();
  }

  /**
   * Check if a section is expanded
   */
  isSectionExpanded(sectionName: string): boolean
  {
    return this.tableConfig.isSectionExpanded(sectionName);
  }

  /**
   * Save current configuration to localStorage
   */
  saveConfiguration()
  {
    if (this.className) {
      this.tableConfig.save(this.className);
    }
  }

  moveUp(variable: variablePolyTyping) {
    // Locate the index of the variable in shownVars array
    const index = this.shownVars.findIndex(varName => varName === variable.variableName);

    // Check if variable exists in shownVars
    if (index !== -1) {
      // Check if the variable is not already at the top
      if (index > 0) {
        // Swap the current variable with the one before it
        const temp = this.shownVars[index];
        this.shownVars[index] = this.shownVars[index - 1];
        this.shownVars[index - 1] = temp;

        // Manual reordering switches to custom sort mode
        this.tableConfig.sortOrder = 'custom';
        this.saveConfiguration();

        console.log(`Moved ${variable.variableName} up.`);
      } else {
        console.log(`${variable.variableName} is already at the top.`);
      }
    } else {
      console.error(`${variable.variableName} not found in shownVars.`);
    }
  }

  // In the ShownVars array, finds the matching object in the array and moves it down by 1.
  moveDown(variable: variablePolyTyping) {
    // Locate the index of the variable in shownVars array
    const index = this.shownVars.findIndex(varName => varName === variable.variableName);

    // Check if variable exists in shownVars
    if (index !== -1) {
      // Check if the variable is not already at the bottom
      if (index < this.shownVars.length - 1) {
        // Swap the current variable with the one after it
        const temp = this.shownVars[index];
        this.shownVars[index] = this.shownVars[index + 1];
        this.shownVars[index + 1] = temp;

        // Manual reordering switches to custom sort mode
        this.tableConfig.sortOrder = 'custom';
        this.saveConfiguration();

        console.log(`Moved ${variable.variableName} down.`);
      } else {
        console.log(`${variable.variableName} is already at the bottom.`);
      }
    } else {
      console.error(`${variable.variableName} not found in shownVars.`);
    }
  }
  

  // Moves the variable to the removed columns list
  remove(variable: variablePolyTyping) {
    // Ensure variable name exists
    if (!variable.variableName) {
      console.error('Variable name is undefined');
      return;
    }

    // Find the index of the variable in shownVars array
    const index = this.shownVars.findIndex(varName => varName === variable.variableName);

    // Check if variable exists in shownVars
    if (index !== -1) {
      // Remove the variable from shownVars
      this.shownVars.splice(index, 1);

      // Add to removedColumns
      if (!this.tableConfig.removedColumns) {
        this.tableConfig.removedColumns = [];
      }
      if (!this.tableConfig.removedColumns.includes(variable.variableName!)) {
        this.tableConfig.removedColumns.push(variable.variableName!);
      }

      this.saveConfiguration();
      console.log(`Removed ${variable.variableName} from table configuration.`);
    } else {
      console.error(`${variable.variableName} not found in shownVars.`);
    }
  }

  // Adds a removed variable back to the configuration
  addBack(variableName: string) {
    // Remove from removedColumns
    const removedIndex = this.tableConfig.removedColumns.indexOf(variableName);
    if (removedIndex !== -1) {
      this.tableConfig.removedColumns.splice(removedIndex, 1);

      // Add back to shownVars
      if (!this.shownVars.includes(variableName)) {
        this.shownVars.push(variableName);
        this.sortShownVars();
      }

      this.saveConfiguration();
      console.log(`Added ${variableName} back to table configuration.`);
    }
  }

  // Get all configurable columns (shownVars only)
  getAllConfigurableColumns(): string[] {
    return this.shownVars;
  }

  // Get removed columns
  getRemovedColumns(): string[] {
    return this.tableConfig.removedColumns || [];
  }

  // Get column type from configuration
  getColumnTypeFromConfig(columnName: string): string {
    return this.classTypeData[columnName]?.variablePythonType || 'unknown';
  }

  // Get column display name
  getColumnDisplayName(columnName: string): string {
    return columnName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  // Get type icon
  getTypeIcon(type: string): string {
    const typeMap: { [key: string]: string } = {
      'str': 'T',
      'string': 'T',
      'int': '#',
      'integer': '#',
      'float': '∞',
      'bool': '✓',
      'boolean': '✓',
      'list': '[]',
      'dict': '{}',
      'object': '{}',
      'date': '📅',
      'datetime': '🕐',
      'polariList': '📋',
      'polariDict': '📚'
    };
    return typeMap[type?.toLowerCase()] || '◆';
  }

  // Check if column is visible by default
  isColumnVisibleByDefault(columnName: string): boolean {
    if (!this.tableConfig.visibleColumns || this.tableConfig.visibleColumns.length === 0) {
      return true; // Default to all visible
    }
    return this.tableConfig.visibleColumns.includes(columnName);
  }

  // Toggle default visibility
  toggleDefaultVisibility(columnName: string) {
    if (!this.tableConfig.visibleColumns || this.tableConfig.visibleColumns.length === 0) {
      // Initialize with all columns if not set
      this.tableConfig.visibleColumns = [...this.shownVars];
    }

    const index = this.tableConfig.visibleColumns.indexOf(columnName);
    if (index >= 0) {
      this.tableConfig.visibleColumns.splice(index, 1);
    } else {
      this.tableConfig.visibleColumns.push(columnName);
    }

    this.saveConfiguration();

    // Force change detection by creating a new TableConfig instance
    this.tableConfig = new TableConfig(this.tableConfig);
  }

  /**
   * Load instance data from backend
   */
  loadInstanceData() {
    if (!this.className) {
      console.warn('[TemplateClassTable] Cannot load instance data: className is undefined');
      return;
    }

    console.log(`[TemplateClassTable] ========== Loading instance data for: ${this.className} ==========`);
    console.log(`[TemplateClassTable] Current classTypeData:`, this.classTypeData);
    console.log(`[TemplateClassTable] classTypeData keys:`, Object.keys(this.classTypeData || {}));

    // Get the CRUDE service for this class
    this.crudeService = this.crudeManager.getCRUDEclassService(this.className);

    // Register this component as a utilizer
    this.crudeService.addUtilizer(this.componentId);
    this.crudeManager.incrementUtilizerCounter(this.className);

    console.log(`[TemplateClassTable] Service utilizers for ${this.className}:`, this.crudeService.serviceUtilizers);

    // Fetch all instances
    this.crudeService.readAll().subscribe(
      (data: any) => {
        console.log(`[TemplateClassTable] ===== Raw Response for ${this.className} =====`);
        console.log(`[TemplateClassTable] Response type:`, typeof data);
        console.log(`[TemplateClassTable] Is Array:`, Array.isArray(data));
        console.log(`[TemplateClassTable] Raw data:`, data);
        console.log(`[TemplateClassTable] JSON.stringify:`, JSON.stringify(data).substring(0, 500));

        if (data) {
          console.log(`[TemplateClassTable] data keys:`, Object.keys(data));
          console.log(`[TemplateClassTable] Has "class" property:`, data.hasOwnProperty('class'), 'value:', data.class);
          console.log(`[TemplateClassTable] Has "data" property:`, data.hasOwnProperty('data'), 'type:', typeof data.data);
          if (data.data) {
            console.log(`[TemplateClassTable] data.data isArray:`, Array.isArray(data.data), 'length:', data.data?.length);
          }
        }

        // Handle backend response format
        try {
          // Format 1: { class: "className", varsLimited: [], data: [...instances...] }
          // This is the format returned by CRUDE endpoints
          if (data && typeof data === 'object' && !Array.isArray(data) && data.hasOwnProperty('data') && data.hasOwnProperty('class')) {
            console.log(`[TemplateClassTable] *** Detected Format 1: { class, data } structure ***`);
            console.log(`[TemplateClassTable] Response class:`, data.class);
            console.log(`[TemplateClassTable] data.data type:`, typeof data.data);
            console.log(`[TemplateClassTable] data.data isArray:`, Array.isArray(data.data));
            console.log(`[TemplateClassTable] data.data length:`, data.data?.length);

            if (Array.isArray(data.data)) {
              this.instanceList = data.data;
              console.log(`[TemplateClassTable] *** SUCCESS: Extracted ${this.instanceList.length} instances from data.data ***`);
            } else {
              console.warn(`[TemplateClassTable] data.data is not an array:`, typeof data.data);
              this.instanceList = [];
            }
          }
          // Format 2: [{ className: [...] }] - Legacy format
          else if (Array.isArray(data) && data.length > 0) {
            console.log(`[TemplateClassTable] Detected Format 2: Array format`);
            console.log(`[TemplateClassTable] Data[0] keys:`, Object.keys(data[0]));
            console.log(`[TemplateClassTable] Looking for key: "${this.className}"`);
            console.log(`[TemplateClassTable] Key exists:`, this.className! in data[0]);

            // Check if this is actually Format 1 wrapped in an array
            if (data.length === 1 && data[0].hasOwnProperty('class') && data[0].hasOwnProperty('data')) {
              console.log(`[TemplateClassTable] *** Format 1 wrapped in array - unwrapping ***`);
              const unwrapped = data[0];
              if (Array.isArray(unwrapped.data)) {
                this.instanceList = unwrapped.data;
                console.log(`[TemplateClassTable] *** SUCCESS: Extracted ${this.instanceList.length} instances from wrapped data ***`);
              }
            }
            else if (data[0][this.className!]) {
              const classData = data[0][this.className!];
              console.log(`[TemplateClassTable] classData type:`, typeof classData);
              console.log(`[TemplateClassTable] classData isArray:`, Array.isArray(classData));

              // Check if it's an empty object (no data case)
              if (typeof classData === 'object' && !Array.isArray(classData) && Object.keys(classData).length === 0) {
                console.log(`[TemplateClassTable] Empty object returned for ${this.className}`);
                this.instanceList = [];
              } else if (Array.isArray(classData)) {
                // Check if this is an array of dataSets (each with class, varsLimited, data properties)
                // Format: [{class: "className", varsLimited: [], data: [...instances...]}]
                if (classData.length > 0 && classData[0].hasOwnProperty('data') && classData[0].hasOwnProperty('class')) {
                  console.log(`[TemplateClassTable] Detected array of dataSets`);
                  // Extract instances from all dataSets
                  this.instanceList = [];
                  classData.forEach((dataSet: any) => {
                    if (Array.isArray(dataSet.data)) {
                      console.log(`[TemplateClassTable] Extracting ${dataSet.data.length} instances from dataSet`);
                      this.instanceList = this.instanceList.concat(dataSet.data);
                    }
                  });
                  console.log(`[TemplateClassTable] Total extracted instances: ${this.instanceList.length}`);
                } else {
                  // Direct array of instances
                  console.log(`[TemplateClassTable] Direct array with ${classData.length} items`);
                  this.instanceList = classData;
                }
              } else {
                // Use dataSetCollection for complex case
                console.log(`[TemplateClassTable] Using dataSetCollection to parse`);
                const interpretedData = new dataSetCollection(data);
                this.instanceList = interpretedData.getClassInstanceList(this.className!);
                console.log(`[TemplateClassTable] dataSetCollection returned:`, this.instanceList);
              }
            } else {
              console.warn(`[TemplateClassTable] Key "${this.className}" not found in data[0]`);
              this.instanceList = [];
            }
          }
          // Format 3: Direct array of instances
          else if (Array.isArray(data)) {
            console.log(`[TemplateClassTable] Detected Format 3: Direct array of instances`);
            this.instanceList = data;
          }
          else {
            console.warn(`[TemplateClassTable] Unknown data format:`, data);
            this.instanceList = [];
          }
        } catch (error) {
          console.error(`[TemplateClassTable] Error parsing data:`, error);
          this.instanceList = [];
        }

        console.log(`[TemplateClassTable] ===== Final Result =====`);
        console.log(`[TemplateClassTable] instanceList length:`, this.instanceList.length);
        console.log(`[TemplateClassTable] instanceList:`, this.instanceList);
        if (this.instanceList.length > 0) {
          console.log(`[TemplateClassTable] First instance:`, this.instanceList[0]);
          console.log(`[TemplateClassTable] First instance keys:`, Object.keys(this.instanceList[0] || {}));
        }
      },
      (error: any) => {
        console.error(`[TemplateClassTable] Error loading instance data for ${this.className}:`, error);
        console.error('[TemplateClassTable] Error details:', {
          message: error.message,
          status: error.status,
          statusText: error.statusText,
          url: error.url
        });
        this.instanceList = [];
      }
    );
  }

  ngOnDestroy() {
    // Clean up service utilizer tracking
    if (this.crudeService && this.className) {
      console.log(`[TemplateClassTable] Cleaning up service for ${this.className}`);
      this.crudeService.removeUtilizer(this.componentId);
      this.crudeManager.decrementUtilizerCounter(this.className);
      this.crudeManager.cleanupUnusedService(this.className);
    }
  }

}