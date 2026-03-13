// instance-picker-dialog.ts
// Reusable dialog for selecting instance(s) of a referenced class.
// Single-select returns a single instance; multi-select returns an array.

import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { RuntimeConfigService } from '@services/runtime-config.service';
import { ClassTypingService } from '@services/class-typing-service';

export interface InstancePickerDialogData {
  /** The class to pick instances from */
  className: string;
  /** Human-readable class name for the header */
  classDisplayName?: string;
  /** Allow selecting multiple instances */
  multiple?: boolean;
  /** Pre-selected instance ID(s) */
  selectedIds?: string[];
}

export interface InstancePickerDialogResult {
  /** 'select' or 'cancel' */
  action: 'select' | 'cancel';
  /** Selected instance (single) or instances (multi) */
  selected?: any;
  /** The selected instance ID(s) */
  selectedIds?: string[];
}

@Component({
  standalone: false,
  selector: 'instance-picker-dialog',
  templateUrl: 'instance-picker-dialog.html',
  styleUrls: ['./instance-picker-dialog.css']
})
export class InstancePickerDialogComponent implements OnInit, OnDestroy {
  isLoading = true;
  loadError: string | null = null;

  classTypeData: any = {};
  instanceData: any[] = [];

  /** For single-select */
  selectedInstance: any = null;
  /** For multi-select */
  selectedInstances: any[] = [];
  selectedIdSet = new Set<string>();

  private destroy$ = new Subject<void>();

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: InstancePickerDialogData,
    private dialogRef: MatDialogRef<InstancePickerDialogComponent>,
    private http: HttpClient,
    private runtimeConfig: RuntimeConfigService,
    private typingService: ClassTypingService
  ) {}

  ngOnInit(): void {
    this.loadClassData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get isMultiple(): boolean {
    return this.data.multiple || false;
  }

  get displayName(): string {
    return this.data.classDisplayName || this.data.className;
  }

  get hasSelection(): boolean {
    if (this.isMultiple) {
      return this.selectedInstances.length > 0;
    }
    return this.selectedInstance !== null;
  }

  get selectionCount(): number {
    if (this.isMultiple) {
      return this.selectedInstances.length;
    }
    return this.selectedInstance ? 1 : 0;
  }

  /** Columns to show in the picker table (skip internal fields, limit count) */
  getVisibleColumns(): string[] {
    if (this.instanceData.length === 0) return [];
    const allKeys = Object.keys(this.instanceData[0]);
    // Show non-internal fields, cap at 6 columns for readability
    return allKeys.filter(k => !k.startsWith('_')).slice(0, 6);
  }

  /** Format a cell value for display */
  formatCellValue(value: any): string {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') {
      if (Array.isArray(value)) return `[${value.length} items]`;
      return '{...}';
    }
    const str = String(value);
    return str.length > 60 ? str.substring(0, 57) + '...' : str;
  }

  loadClassData(): void {
    this.isLoading = true;
    this.loadError = null;

    // Get class type data from typing service
    const typing = this.typingService.getClassPolyTyping(this.data.className);
    if (typing) {
      this.classTypeData = typing.completeVariableTypingData || {};
    }

    // Load instances from backend (must include Accept header for JSON response)
    const backendUrl = this.runtimeConfig.getBackendBaseUrl();
    const options = {
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      })
    };

    this.http.get(`${backendUrl}/${this.data.className}`, options)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          this.instanceData = this.deduplicateInstances(this.extractInstances(response));
          this.isLoading = false;

          // Restore pre-selections
          if (this.data.selectedIds?.length) {
            this.restoreSelections();
          }
        },
        error: (err) => {
          this.loadError = err.error?.error || `Failed to load ${this.data.className} instances`;
          this.isLoading = false;
          console.error('[InstancePicker] Load failed:', err);
        }
      });
  }

  /**
   * Extract instances from backend response.
   * Handles all CRUDE response formats:
   *   Format 1: { class: "Name", data: [...instances] }
   *   Format 1 wrapped: [{ class: "Name", data: [...] }]
   *   Format 2: [{ "ClassName": [{ class, data }] }] (wrapped dataSets)
   *   Format 3: { "ClassName": [...] } or { "ClassName": { id: inst } }
   *   Format 4: Direct array of instances
   */
  private extractInstances(response: any): any[] {
    if (!response) return [];

    const className = this.data.className;

    // Format 1: { class: "Name", data: [...instances] }
    if (typeof response === 'object' && !Array.isArray(response)
        && response.hasOwnProperty('data') && response.hasOwnProperty('class')) {
      return Array.isArray(response.data) ? response.data : [];
    }

    // Array-based formats
    if (Array.isArray(response) && response.length > 0) {
      // Format 1 wrapped: [{ class, data }]
      if (response.length === 1 && response[0]?.hasOwnProperty('class') && response[0]?.hasOwnProperty('data')) {
        return Array.isArray(response[0].data) ? response[0].data : [];
      }

      // Format 2: [{ "ClassName": [...dataSets] }]
      if (className && response[0][className]) {
        const classData = response[0][className];
        return this.extractFromClassData(classData);
      }

      // Direct array of instances (have id fields)
      if (response[0]?.id !== undefined || response[0]?._id !== undefined) {
        return response;
      }
    }

    // Format 3: { "ClassName": [...] } or { "ClassName": { id: inst } }
    if (className && typeof response === 'object' && !Array.isArray(response) && response[className]) {
      return this.extractFromClassData(response[className]);
    }

    // Fallback: { data: [...] }
    if (response?.data && Array.isArray(response.data)) {
      return response.data;
    }

    return [];
  }

  /** Extract instances from a class-keyed data structure */
  private extractFromClassData(classData: any): any[] {
    if (!classData) return [];

    // Array of dataSets: [{ class, data: [...] }]
    if (Array.isArray(classData) && classData.length > 0) {
      if (classData[0]?.hasOwnProperty('data') && classData[0]?.hasOwnProperty('class')) {
        const instances: any[] = [];
        classData.forEach((ds: any) => {
          if (Array.isArray(ds.data)) instances.push(...ds.data);
        });
        return instances;
      }
      // Direct array of instances
      return classData;
    }

    // Dict keyed by ID
    if (typeof classData === 'object') {
      return Object.values(classData);
    }

    return [];
  }

  /** Remove duplicate instances by id */
  private deduplicateInstances(instances: any[]): any[] {
    if (instances.length === 0) return instances;
    const seen = new Set<string>();
    return instances.filter(inst => {
      const id = inst?.id ?? inst?._id;
      if (id == null) return true;
      const key = String(id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private restoreSelections(): void {
    const idSet = new Set(this.data.selectedIds);
    for (const inst of this.instanceData) {
      const id = this.getInstanceId(inst);
      if (id && idSet.has(id)) {
        if (this.isMultiple) {
          this.selectedInstances.push(inst);
          this.selectedIdSet.add(id);
        } else {
          this.selectedInstance = inst;
          break;
        }
      }
    }
  }

  /** Called when a row is clicked in the table area */
  onRowClick(instance: any): void {
    const id = this.getInstanceId(instance);

    if (this.isMultiple) {
      if (id && this.selectedIdSet.has(id)) {
        // Deselect
        this.selectedIdSet.delete(id);
        this.selectedInstances = this.selectedInstances.filter(
          i => this.getInstanceId(i) !== id
        );
      } else {
        // Select
        if (id) this.selectedIdSet.add(id);
        this.selectedInstances.push(instance);
      }
    } else {
      // Single select — toggle or replace
      const currentId = this.selectedInstance ? this.getInstanceId(this.selectedInstance) : null;
      if (currentId === id) {
        this.selectedInstance = null;
      } else {
        this.selectedInstance = instance;
      }
    }
  }

  isRowSelected(instance: any): boolean {
    const id = this.getInstanceId(instance);
    if (this.isMultiple) {
      return id ? this.selectedIdSet.has(id) : false;
    }
    const selectedId = this.selectedInstance ? this.getInstanceId(this.selectedInstance) : null;
    return id === selectedId && id !== null;
  }

  getInstanceId(instance: any): string | null {
    if (!instance) return null;
    const idFields = ['id', '_instanceId', '_id', 'Id', 'ID', 'instanceId'];
    for (const field of idFields) {
      if (instance[field] !== undefined && instance[field] !== null) {
        return String(instance[field]);
      }
    }
    return null;
  }

  /** Get a short display label for an instance */
  getInstanceLabel(instance: any): string {
    const id = this.getInstanceId(instance);
    // Try name-like fields first
    for (const field of ['name', 'title', 'displayName', 'label', 'description']) {
      if (instance[field]) return String(instance[field]);
    }
    return id || '(no id)';
  }

  onConfirm(): void {
    if (this.isMultiple) {
      const ids = this.selectedInstances.map(i => this.getInstanceId(i)).filter(Boolean) as string[];
      this.dialogRef.close({
        action: 'select',
        selected: this.selectedInstances,
        selectedIds: ids
      } as InstancePickerDialogResult);
    } else {
      const id = this.selectedInstance ? this.getInstanceId(this.selectedInstance) : null;
      this.dialogRef.close({
        action: 'select',
        selected: this.selectedInstance,
        selectedIds: id ? [id] : []
      } as InstancePickerDialogResult);
    }
  }

  onCancel(): void {
    this.dialogRef.close({ action: 'cancel' } as InstancePickerDialogResult);
  }

  clearSelection(): void {
    this.selectedInstance = null;
    this.selectedInstances = [];
    this.selectedIdSet.clear();
  }
}
