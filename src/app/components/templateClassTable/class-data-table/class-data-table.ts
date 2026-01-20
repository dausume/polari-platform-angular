// class-data-table.component.ts
import { Component, Input, OnInit, ViewChild, OnChanges, SimpleChanges } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { TableConfig } from '@models/tableConfiguration';
import { classPolyTyping } from '@models/polyTyping/classPolyTyping';
import { variablePolyTyping } from '@models/polyTyping/variablePolyTyping';

@Component({
  selector: 'class-data-table',
  templateUrl: 'class-data-table.html',
  styleUrls: ['./class-data-table.css']
})
export class ClassDataTableComponent implements OnInit, OnChanges {
  @Input() className?: string;
  @Input() classTypeData: any = {};
  @Input() instanceData: any[] = [];
  @Input() tableConfig?: TableConfig;

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  dataSource: MatTableDataSource<any>;
  displayedColumns: string[] = [];
  columnTypes: { [key: string]: string } = {};

  constructor() {
    this.dataSource = new MatTableDataSource<any>([]);
  }

  ngOnInit() {
    this.initializeTable();
  }

  ngOnChanges(changes: SimpleChanges) {
    console.log('[ClassDataTable] ngOnChanges triggered');
    console.log('[ClassDataTable] Changes:', Object.keys(changes));

    // Handle className changes - completely reinitialize
    if (changes.className && !changes.className.firstChange) {
      console.log('[ClassDataTable] ClassName changed from', changes.className.previousValue, 'to', changes.className.currentValue);

      // Clear old state
      this.columnTypes = {};
      this.displayedColumns = [];
      this.dataSource.data = [];
    }

    // Log instanceData changes specifically
    if (changes.instanceData) {
      console.log('[ClassDataTable] instanceData changed:');
      console.log('[ClassDataTable]   - previousValue:', changes.instanceData.previousValue);
      console.log('[ClassDataTable]   - currentValue:', changes.instanceData.currentValue);
      console.log('[ClassDataTable]   - currentValue type:', typeof changes.instanceData.currentValue);
      console.log('[ClassDataTable]   - currentValue isArray:', Array.isArray(changes.instanceData.currentValue));
      console.log('[ClassDataTable]   - currentValue length:', changes.instanceData.currentValue?.length);
    }

    // Reinitialize table when any input changes
    if (changes.classTypeData || changes.instanceData || changes.tableConfig || changes.className) {
      this.initializeTable();
    }
  }

  initializeTable() {
    console.log('[ClassDataTable] initializeTable() called');
    console.log('[ClassDataTable] className:', this.className);
    console.log('[ClassDataTable] classTypeData:', this.classTypeData);
    console.log('[ClassDataTable] instanceData:', this.instanceData);
    console.log('[ClassDataTable] instanceData type:', typeof this.instanceData);
    console.log('[ClassDataTable] instanceData isArray:', Array.isArray(this.instanceData));

    // Load or create table configuration
    if (!this.tableConfig && this.className) {
      this.tableConfig = TableConfig.load(this.className);
    }

    // Extract columns from classTypeData
    if (this.classTypeData) {
      const keys = Object.keys(this.classTypeData);
      console.log('[ClassDataTable] classTypeData keys:', keys);

      // Store column types for rendering
      keys.forEach(key => {
        if (this.classTypeData[key]?.variablePythonType) {
          this.columnTypes[key] = this.classTypeData[key].variablePythonType;
          console.log(`[ClassDataTable] Column "${key}" type: ${this.columnTypes[key]}`);
        } else {
          console.warn(`[ClassDataTable] Column "${key}" has no variablePythonType:`, this.classTypeData[key]);
        }
      });

      // Filter out removed columns
      const removedColumns = this.tableConfig?.removedColumns || [];
      const availableKeys = keys.filter(key => !removedColumns.includes(key));
      console.log('[ClassDataTable] Available columns after filtering:', availableKeys);

      // Set displayed columns based on config or default to all available
      if (this.tableConfig?.visibleColumns && this.tableConfig.visibleColumns.length > 0) {
        // Use only visible columns that exist and aren't removed
        this.displayedColumns = this.tableConfig.visibleColumns.filter(col =>
          availableKeys.includes(col)
        );
      } else {
        // Default to all available columns
        this.displayedColumns = [...availableKeys];
      }

      console.log('[ClassDataTable] Final displayedColumns:', this.displayedColumns);

      // Apply sorting if configured
      if (this.tableConfig?.sortOrder === 'alphabetical') {
        this.displayedColumns.sort((a, b) => {
          const comparison = a.localeCompare(b);
          return this.tableConfig!.sortDirection === 'asc' ? comparison : -comparison;
        });
      }
    } else {
      console.warn('[ClassDataTable] No classTypeData provided - cannot determine columns');
    }

    // Set data source
    if (this.instanceData && this.instanceData.length > 0) {
      console.log('[ClassDataTable] Setting dataSource with', this.instanceData.length, 'rows');
      // Debug: log first row to see data structure
      if (this.instanceData[0]) {
        console.log('[ClassDataTable] First row sample:', this.instanceData[0]);
        console.log('[ClassDataTable] First row keys:', Object.keys(this.instanceData[0]));
      }
      this.dataSource.data = this.instanceData;
    } else {
      console.log('[ClassDataTable] No instance data to display');
      this.dataSource.data = [];
    }

    console.log('[ClassDataTable] Final dataSource.data length:', this.dataSource.data.length);

    // Apply sort and paginator after view init
    setTimeout(() => {
      if (this.sort) {
        this.dataSource.sort = this.sort;
      }
      if (this.paginator) {
        this.dataSource.paginator = this.paginator;
      }
    });
  }

  /**
   * Get all available columns (excluding removed ones)
   */
  getAllColumns(): string[] {
    const allColumns = Object.keys(this.columnTypes);
    const removedColumns = this.tableConfig?.removedColumns || [];
    return allColumns.filter(col => !removedColumns.includes(col));
  }

  /**
   * Get the display name for a column (formatted from camelCase)
   */
  getColumnDisplayName(columnName: string): string {
    // Convert camelCase to readable format
    return columnName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  /**
   * Get the type for a column
   */
  getColumnType(columnName: string): string {
    return this.columnTypes[columnName] || 'unknown';
  }

  /**
   * Get type icon for display
   */
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

  /**
   * Apply filter to table
   */
  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  /**
   * Toggle column visibility
   */
  toggleColumn(columnName: string) {
    const index = this.displayedColumns.indexOf(columnName);
    if (index >= 0) {
      this.displayedColumns.splice(index, 1);
    } else {
      this.displayedColumns.push(columnName);
      // Re-sort if alphabetical order is enabled
      if (this.tableConfig?.sortOrder === 'alphabetical') {
        this.displayedColumns.sort((a, b) => {
          const comparison = a.localeCompare(b);
          return this.tableConfig!.sortDirection === 'asc' ? comparison : -comparison;
        });
      }
    }

    // Create a new array reference to trigger change detection
    this.displayedColumns = [...this.displayedColumns];

    // Save configuration
    if (this.tableConfig) {
      this.tableConfig.visibleColumns = [...this.displayedColumns];
      this.saveConfiguration();
    }
  }

  /**
   * Check if column is visible
   */
  isColumnVisible(columnName: string): boolean {
    return this.displayedColumns.includes(columnName);
  }

  /**
   * Save configuration
   */
  saveConfiguration() {
    if (this.tableConfig && this.className) {
      this.tableConfig.save(this.className);
    }
  }

  /**
   * Format cell value for display
   */
  formatCellValue(value: any, type: string): string {
    if (value === null || value === undefined) {
      return '-';
    }

    // Handle different types
    switch (type?.toLowerCase()) {
      case 'bool':
      case 'boolean':
        return value ? 'Yes' : 'No';
      case 'date':
      case 'datetime':
        return new Date(value).toLocaleString();
      case 'list':
      case 'polarilist':
        return Array.isArray(value) ? `[${value.length} items]` : String(value);
      case 'dict':
      case 'object':
      case 'polaridict':
        return typeof value === 'object' ? `{${Object.keys(value).length} keys}` : String(value);
      default:
        return String(value);
    }
  }
}
