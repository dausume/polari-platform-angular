// Author: Dustin Etts
// polari-platform-angular/src/app/services/no-code-services/no-code-solution-state.service.ts
// State management service for No-Code Solutions with localStorage caching

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { NoCodeState } from '@models/noCode/NoCodeState';
import { Slot } from '@models/noCode/Slot';
import { Connector } from '@models/noCode/Connector';
import {
  NoCodeSolutionRawData,
  NoCodeStateRawData,
  SlotRawData,
  ConnectorRawData,
  MOCK_SOLUTIONS,
  getAvailableSolutionNames
} from '@models/noCode/mock-NCS-data';
import { StateDefinition } from '@models/noCode/StateDefinition';
import {
  PotentialContext,
  PotentialVariable,
  PotentialObjectType,
  PotentialObjectField,
  BranchPoint,
  CONTROL_FLOW_STATE_TYPES
} from '@models/stateSpace/solutionContext';

/**
 * Cache structure stored in localStorage
 */
interface SolutionCache {
  solutions: { [solutionName: string]: NoCodeSolutionRawData };
  selectedSolutionName: string | null;
  lastUpdated: number;
  version?: number; // Cache version for invalidation when mock data changes
}

const CACHE_KEY = 'polari-no-code-solutions-cache';
const CACHE_VERSION = 3; // Bump version when mock data changes to force cache invalidation

@Injectable({
  providedIn: 'root'
})
export class NoCodeSolutionStateService {
  // Cached solutions in memory (raw data format for easy serialization)
  private solutionsCache: Map<string, NoCodeSolutionRawData> = new Map();

  // Currently selected solution name
  private selectedSolutionNameSubject = new BehaviorSubject<string | null>(null);
  public selectedSolutionName$ = this.selectedSolutionNameSubject.asObservable();

  // Currently selected solution data (raw)
  private selectedSolutionDataSubject = new BehaviorSubject<NoCodeSolutionRawData | null>(null);
  public selectedSolutionData$ = this.selectedSolutionDataSubject.asObservable();

  // Available solution names for the selector
  private availableSolutionsSubject = new BehaviorSubject<{ id: number; name: string }[]>([]);
  public availableSolutions$ = this.availableSolutionsSubject.asObservable();

  // Loading state
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  constructor() {
    this.initializeFromCache();
  }

  /**
   * Initialize the service from localStorage cache or mock data
   */
  private initializeFromCache(): void {
    const cached = this.loadFromLocalStorage();
    console.log('[StateService] initializeFromCache - cached:', cached);

    // Check cache validity: version must match AND solution names must match exactly
    const expectedSolutionNames = MOCK_SOLUTIONS.map(s => s.solutionName).sort();
    const cachedSolutionNames = cached ? Object.keys(cached.solutions).sort() : [];
    const versionMatch = cached?.version === CACHE_VERSION;
    const namesMatch = expectedSolutionNames.length === cachedSolutionNames.length &&
      expectedSolutionNames.every((name, i) => name === cachedSolutionNames[i]);

    if (cached && versionMatch && namesMatch) {
      console.log('[StateService] Restoring from cache (version', cached.version, ')');
      // Restore from cache
      Object.entries(cached.solutions).forEach(([name, data]) => {
        console.log('[StateService] Restoring solution:', name, 'with', data.stateInstances?.length, 'states');
        this.solutionsCache.set(name, data);
      });

      // Update available solutions
      this.updateAvailableSolutions();

      // Restore selected solution
      if (cached.selectedSolutionName && this.solutionsCache.has(cached.selectedSolutionName)) {
        console.log('[StateService] Restoring selected solution:', cached.selectedSolutionName);
        this.selectSolution(cached.selectedSolutionName);
      }
    } else {
      console.log('[StateService] Cache invalid - version match:', versionMatch,
        ', names match:', namesMatch,
        ', expected:', expectedSolutionNames,
        ', cached:', cachedSolutionNames);
      // Initialize with mock data (cache is stale or missing)
      this.loadMockSolutions();
    }
  }

  /**
   * Load mock solutions into the cache
   */
  private loadMockSolutions(): void {
    MOCK_SOLUTIONS.forEach(solution => {
      this.solutionsCache.set(solution.solutionName, solution);
    });

    this.updateAvailableSolutions();
    this.saveToLocalStorage();

    // Select the first solution by default
    if (MOCK_SOLUTIONS.length > 0) {
      this.selectSolution(MOCK_SOLUTIONS[0].solutionName);
    }
  }

  /**
   * Update the available solutions list
   */
  private updateAvailableSolutions(): void {
    const available: { id: number; name: string }[] = [];
    let id = 1;
    this.solutionsCache.forEach((solution, name) => {
      available.push({ id: solution.id || id++, name });
    });
    this.availableSolutionsSubject.next(available);
  }

  /**
   * Load cache from localStorage
   */
  private loadFromLocalStorage(): SolutionCache | null {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as SolutionCache;
        return parsed;
      }
    } catch (error) {
      console.warn('Failed to load solutions from localStorage:', error);
    }
    return null;
  }

  /**
   * Save current state to localStorage
   */
  private saveToLocalStorage(): void {
    try {
      const cache: SolutionCache = {
        solutions: {},
        selectedSolutionName: this.selectedSolutionNameSubject.value,
        lastUpdated: Date.now(),
        version: CACHE_VERSION
      };

      this.solutionsCache.forEach((solution, name) => {
        cache.solutions[name] = solution;
      });

      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      console.warn('Failed to save solutions to localStorage:', error);
    }
  }

  /**
   * Select a solution by name
   */
  selectSolution(solutionName: string): void {
    console.log('[StateService] selectSolution called with:', solutionName);
    const solution = this.solutionsCache.get(solutionName);
    console.log('[StateService] Found solution:', solution);
    console.log('[StateService] Solution stateInstances count:', solution?.stateInstances?.length);
    if (solution) {
      // IMPORTANT: Update data BEFORE name, because the name subscription
      // triggers component to read the data immediately
      this.selectedSolutionDataSubject.next(solution);
      this.selectedSolutionNameSubject.next(solutionName);
      this.saveToLocalStorage();
    } else {
      console.warn(`Solution '${solutionName}' not found in cache`);
    }
  }

  /**
   * Get the currently selected solution name
   */
  getSelectedSolutionName(): string | null {
    return this.selectedSolutionNameSubject.value;
  }

  /**
   * Get a solution's raw data by name
   */
  getSolutionData(solutionName: string): NoCodeSolutionRawData | undefined {
    return this.solutionsCache.get(solutionName);
  }

  /**
   * Get the currently selected solution's raw data
   */
  getSelectedSolutionData(): NoCodeSolutionRawData | null {
    return this.selectedSolutionDataSubject.value;
  }

  /**
   * Convert raw slot data to Slot instance
   */
  private convertRawSlotToSlot(raw: SlotRawData): Slot {
    console.log('[StateService] convertRawSlotToSlot - raw:', raw);
    console.log('[StateService] convertRawSlotToSlot - raw.connectors:', raw.connectors);

    const connectors = raw.connectors?.map(c => {
      console.log('[StateService] Converting connector:', c);
      return new Connector(c.id, c.sourceSlot, c.sinkSlot, c.targetStateName);
    }) || [];

    console.log('[StateService] convertRawSlotToSlot - converted connectors:', connectors);

    const slot = new Slot(
      raw.index,
      raw.stateName,
      raw.slotAngularPosition,
      connectors,
      raw.isInput,
      raw.allowOneToMany,
      raw.allowManyToOne
    );

    // Copy slot configuration properties that aren't in the constructor
    if (raw.color !== undefined) {
      (slot as any).color = raw.color;
    }
    if (raw.label !== undefined) {
      (slot as any).label = raw.label;
    }
    if (raw.mappingMode !== undefined) {
      (slot as any).mappingMode = raw.mappingMode;
    }
    if (raw.description !== undefined) {
      (slot as any).description = raw.description;
    }
    if (raw.parameterName !== undefined) {
      (slot as any).parameterName = raw.parameterName;
    }
    if (raw.parameterType !== undefined) {
      (slot as any).parameterType = raw.parameterType;
    }
    if (raw.returnType !== undefined) {
      (slot as any).returnType = raw.returnType;
    }
    if (raw.triggerType !== undefined) {
      (slot as any).triggerType = raw.triggerType;
    }
    if (raw.sourceInstance !== undefined) {
      (slot as any).sourceInstance = raw.sourceInstance;
    }
    if (raw.propertyPath !== undefined) {
      (slot as any).propertyPath = raw.propertyPath;
    }
    if (raw.passthroughVariableName !== undefined) {
      (slot as any).passthroughVariableName = raw.passthroughVariableName;
    }

    return slot;
  }

  /**
   * Convert raw state data to NoCodeState instance
   */
  private convertRawStateToNoCodeState(raw: NoCodeStateRawData): NoCodeState {
    const slots = raw.slots?.map(s => this.convertRawSlotToSlot(s)) || [];
    const state = new NoCodeState(
      raw.stateName,
      raw.shapeType,
      raw.stateClass,
      raw.index,
      raw.stateSvgSizeX,
      raw.stateSvgSizeY,
      raw.stateSvgRadius,
      raw.solutionName,
      raw.layerName,
      raw.stateLocationX,
      raw.stateLocationY,
      raw.id,
      raw.stateSvgName,
      slots,
      raw.slotRadius,
      raw.backgroundColor
    );

    // Copy rectangle-specific properties that aren't in constructor
    if (raw.stateSvgWidth !== undefined) {
      state.stateSvgWidth = raw.stateSvgWidth;
    }
    if (raw.stateSvgHeight !== undefined) {
      state.stateSvgHeight = raw.stateSvgHeight;
    }
    if (raw.cornerRadius !== undefined) {
      state.cornerRadius = raw.cornerRadius;
    }

    // Copy bound object properties
    if (raw.boundObjectClass) {
      state.boundObjectClass = raw.boundObjectClass;
    }
    if (raw.boundObjectFieldValues) {
      state.boundObjectFieldValues = raw.boundObjectFieldValues;
    }

    return state;
  }

  /**
   * Get the selected solution's state instances as NoCodeState objects
   */
  getSelectedSolutionStateInstances(): NoCodeState[] {
    const selectedData = this.selectedSolutionDataSubject.value;
    console.log('[StateService] getSelectedSolutionStateInstances - selectedData:', selectedData?.solutionName);
    console.log('[StateService] Raw stateInstances count:', selectedData?.stateInstances?.length);

    // Debug: Log raw slot connectors
    selectedData?.stateInstances?.forEach(state => {
      console.log('[StateService] Raw state:', state.stateName, 'slots:', state.slots?.length);
      state.slots?.forEach(slot => {
        console.log('[StateService] Raw slot:', slot.index, 'connectors:', slot.connectors);
      });
    });

    if (!selectedData) {
      console.log('[StateService] No selected data, returning empty array');
      return [];
    }
    const converted = selectedData.stateInstances.map(raw => this.convertRawStateToNoCodeState(raw));
    console.log('[StateService] Converted stateInstances count:', converted.length);
    console.log('[StateService] Converted state names:', converted.map(s => s.stateName));

    // Debug: Log converted slot connectors
    converted.forEach(state => {
      console.log('[StateService] Converted state:', state.stateName, 'slots:', state.slots?.length);
      state.slots?.forEach(slot => {
        console.log('[StateService] Converted slot:', slot.index, 'connectors:', slot.connectors);
      });
    });

    return converted;
  }

  /**
   * Get a specific solution's state instances as NoCodeState objects
   */
  getSolutionStateInstances(solutionName: string): NoCodeState[] {
    const solution = this.solutionsCache.get(solutionName);
    if (!solution) {
      return [];
    }
    return solution.stateInstances.map(raw => this.convertRawStateToNoCodeState(raw));
  }

  /**
   * Update a solution's state instance (e.g., after drag and drop)
   * This persists the change to localStorage
   */
  updateStateInstance(solutionName: string, stateName: string, updates: Partial<NoCodeStateRawData>): void {
    const solution = this.solutionsCache.get(solutionName);
    if (!solution) {
      console.warn(`Solution '${solutionName}' not found`);
      return;
    }

    const stateIndex = solution.stateInstances.findIndex(s => s.stateName === stateName);
    if (stateIndex === -1) {
      console.warn(`State '${stateName}' not found in solution '${solutionName}'`);
      return;
    }

    // Update the state
    solution.stateInstances[stateIndex] = {
      ...solution.stateInstances[stateIndex],
      ...updates
    };

    // Save to cache and localStorage
    this.solutionsCache.set(solutionName, solution);

    // If this is the selected solution, update the observable
    if (this.selectedSolutionNameSubject.value === solutionName) {
      this.selectedSolutionDataSubject.next({ ...solution });
    }

    this.saveToLocalStorage();
  }

  /**
   * Update multiple state positions at once (batch update for performance)
   */
  updateStatePositions(solutionName: string, updates: { stateName: string; x: number; y: number }[]): void {
    const solution = this.solutionsCache.get(solutionName);
    if (!solution) return;

    updates.forEach(update => {
      const state = solution.stateInstances.find(s => s.stateName === update.stateName);
      if (state) {
        state.stateLocationX = update.x;
        state.stateLocationY = update.y;
      }
    });

    this.solutionsCache.set(solutionName, solution);

    if (this.selectedSolutionNameSubject.value === solutionName) {
      this.selectedSolutionDataSubject.next({ ...solution });
    }

    this.saveToLocalStorage();
  }

  /**
   * Update a single state's position (called after drag ends)
   */
  updateStatePosition(solutionName: string, stateName: string, x: number, y: number): void {
    const solution = this.solutionsCache.get(solutionName);
    if (!solution) return;

    const state = solution.stateInstances.find(s => s.stateName === stateName);
    if (state) {
      state.stateLocationX = x;
      state.stateLocationY = y;
      this.solutionsCache.set(solutionName, solution);
      this.saveToLocalStorage();
    }
  }

  /**
   * Update a state's size (radius for circles, width/height for rectangles)
   */
  updateStateSize(
    solutionName: string,
    stateName: string,
    radius?: number,
    width?: number,
    height?: number
  ): void {
    const solution = this.solutionsCache.get(solutionName);
    if (!solution) return;

    const state = solution.stateInstances.find(s => s.stateName === stateName);
    if (state) {
      if (radius !== undefined) {
        state.stateSvgRadius = radius;
      }
      if (width !== undefined) {
        state.stateSvgWidth = width;
        state.stateSvgSizeX = width;
      }
      if (height !== undefined) {
        state.stateSvgHeight = height;
        state.stateSvgSizeY = height;
      }
      this.solutionsCache.set(solutionName, solution);

      if (this.selectedSolutionNameSubject.value === solutionName) {
        this.selectedSolutionDataSubject.next({ ...solution });
      }

      this.saveToLocalStorage();
    }
  }

  /**
   * Update a state's shape type (circle or rectangle)
   */
  updateStateShape(solutionName: string, stateName: string, shapeType: string): void {
    const solution = this.solutionsCache.get(solutionName);
    if (!solution) return;

    const state = solution.stateInstances.find(s => s.stateName === stateName);
    if (state) {
      const oldShape = state.shapeType;
      state.shapeType = shapeType;
      state.stateSvgName = shapeType;
      state.layerName = `${shapeType}-layer`;

      // Convert size properties when changing shapes
      if (oldShape === 'circle' && shapeType === 'rectangle') {
        // Convert circle radius to rectangle dimensions
        const radius = state.stateSvgRadius || 100;
        const diameter = radius * 2;
        state.stateSvgWidth = diameter;
        state.stateSvgHeight = diameter;
        state.cornerRadius = 8;
      } else if (oldShape === 'rectangle' && shapeType === 'circle') {
        // Convert rectangle dimensions to circle radius
        const width = state.stateSvgWidth || state.stateSvgSizeX || 100;
        state.stateSvgRadius = width / 2;
      }

      this.solutionsCache.set(solutionName, solution);

      if (this.selectedSolutionNameSubject.value === solutionName) {
        this.selectedSolutionDataSubject.next({ ...solution });
      }

      this.saveToLocalStorage();
    }
  }

  /**
   * Update all slots for a state
   */
  updateStateSlots(solutionName: string, stateName: string, slots: SlotRawData[]): void {
    const solution = this.solutionsCache.get(solutionName);
    if (!solution) return;

    const state = solution.stateInstances.find(s => s.stateName === stateName);
    if (state) {
      state.slots = slots;
      this.solutionsCache.set(solutionName, solution);

      if (this.selectedSolutionNameSubject.value === solutionName) {
        this.selectedSolutionDataSubject.next({ ...solution });
      }

      this.saveToLocalStorage();
    }
  }

  /**
   * Update a slot's angular position (called after slot drag ends)
   */
  updateSlotAngularPosition(solutionName: string, stateName: string, slotIndex: number, angularPosition: number): void {
    const solution = this.solutionsCache.get(solutionName);
    if (!solution) return;

    const state = solution.stateInstances.find(s => s.stateName === stateName);
    if (state && state.slots) {
      const slot = state.slots.find(s => s.index === slotIndex);
      if (slot) {
        slot.slotAngularPosition = angularPosition;
        this.solutionsCache.set(solutionName, solution);
        this.saveToLocalStorage();
      }
    }
  }

  /**
   * Update multiple slot angular positions at once (batch update)
   */
  updateSlotAngularPositions(solutionName: string, updates: { stateName: string; slotIndex: number; angularPosition: number }[]): void {
    const solution = this.solutionsCache.get(solutionName);
    if (!solution) return;

    updates.forEach(update => {
      const state = solution.stateInstances.find(s => s.stateName === update.stateName);
      if (state && state.slots) {
        const slot = state.slots.find(s => s.index === update.slotIndex);
        if (slot) {
          slot.slotAngularPosition = update.angularPosition;
        }
      }
    });

    this.solutionsCache.set(solutionName, solution);
    this.saveToLocalStorage();
  }

  /**
   * Add a connector between two slots
   * Returns the connector ID if successful, null otherwise
   */
  addConnector(
    solutionName: string,
    sourceStateName: string,
    sourceSlotIndex: number,
    targetStateName: string,
    targetSlotIndex: number
  ): number | null {
    console.log('[StateService] addConnector called:', {
      solutionName,
      sourceStateName,
      sourceSlotIndex,
      targetStateName,
      targetSlotIndex
    });

    const solution = this.solutionsCache.get(solutionName);
    if (!solution) {
      console.log('[StateService] addConnector - solution not found');
      return null;
    }

    const sourceState = solution.stateInstances.find(s => s.stateName === sourceStateName);
    console.log('[StateService] addConnector - sourceState:', sourceState?.stateName);

    if (sourceState && sourceState.slots) {
      const sourceSlot = sourceState.slots.find(s => s.index === sourceSlotIndex);
      console.log('[StateService] addConnector - sourceSlot:', sourceSlot);

      if (sourceSlot) {
        // Generate a unique connector ID
        const connectorId = Date.now();
        sourceSlot.connectors.push({
          id: connectorId,
          sourceSlot: sourceSlotIndex,
          sinkSlot: targetSlotIndex,
          targetStateName: targetStateName
        });
        console.log('[StateService] addConnector - connector added:', sourceSlot.connectors);
        this.solutionsCache.set(solutionName, solution);
        this.saveToLocalStorage();
        console.log('[StateService] addConnector - saved to localStorage');
        return connectorId;
      }
    }
    console.log('[StateService] addConnector - failed to add connector');
    return null;
  }

  /**
   * Remove a connector from a slot
   */
  removeConnector(solutionName: string, stateName: string, slotIndex: number, connectorId: number): void {
    const solution = this.solutionsCache.get(solutionName);
    if (!solution) return;

    const state = solution.stateInstances.find(s => s.stateName === stateName);
    if (state && state.slots) {
      const slot = state.slots.find(s => s.index === slotIndex);
      if (slot) {
        slot.connectors = slot.connectors.filter(c => c.id !== connectorId);
        this.solutionsCache.set(solutionName, solution);
        this.saveToLocalStorage();
      }
    }
  }

  /**
   * Get all connectors for a solution (for recreating layout)
   */
  getSolutionConnectors(solutionName: string): {
    sourceStateName: string;
    sourceSlotIndex: number;
    targetStateName: string;
    targetSlotIndex: number;
    connectorId: number;
  }[] {
    const solution = this.solutionsCache.get(solutionName);
    if (!solution) return [];

    const connectors: {
      sourceStateName: string;
      sourceSlotIndex: number;
      targetStateName: string;
      targetSlotIndex: number;
      connectorId: number;
    }[] = [];

    solution.stateInstances.forEach(state => {
      state.slots?.forEach(slot => {
        slot.connectors.forEach(connector => {
          connectors.push({
            sourceStateName: state.stateName,
            sourceSlotIndex: slot.index,
            targetStateName: connector.targetStateName || '',
            targetSlotIndex: connector.sinkSlot,
            connectorId: connector.id
          });
        });
      });
    });

    return connectors;
  }

  /**
   * Add a new state to a solution
   */
  addStateToSolution(solutionName: string, state: NoCodeStateRawData): void {
    const solution = this.solutionsCache.get(solutionName);
    if (!solution) return;

    solution.stateInstances.push(state);
    this.solutionsCache.set(solutionName, solution);

    if (this.selectedSolutionNameSubject.value === solutionName) {
      this.selectedSolutionDataSubject.next({ ...solution });
    }

    this.saveToLocalStorage();
  }

  /**
   * Remove a state from a solution
   */
  removeStateFromSolution(solutionName: string, stateName: string): void {
    const solution = this.solutionsCache.get(solutionName);
    if (!solution) return;

    solution.stateInstances = solution.stateInstances.filter(s => s.stateName !== stateName);
    this.solutionsCache.set(solutionName, solution);

    if (this.selectedSolutionNameSubject.value === solutionName) {
      this.selectedSolutionDataSubject.next({ ...solution });
    }

    this.saveToLocalStorage();
  }

  /**
   * Create a new empty solution
   */
  createNewSolution(solutionName: string, id?: number): void {
    const newSolution: NoCodeSolutionRawData = {
      id: id || Date.now(),
      solutionName,
      xBounds: 1200,
      yBounds: 800,
      stateInstances: []
    };

    this.solutionsCache.set(solutionName, newSolution);
    this.updateAvailableSolutions();
    this.saveToLocalStorage();
  }

  /**
   * Delete a solution
   */
  deleteSolution(solutionName: string): void {
    if (!this.solutionsCache.has(solutionName)) return;

    this.solutionsCache.delete(solutionName);

    // If this was the selected solution, select another
    if (this.selectedSolutionNameSubject.value === solutionName) {
      const remaining = Array.from(this.solutionsCache.keys());
      if (remaining.length > 0) {
        this.selectSolution(remaining[0]);
      } else {
        this.selectedSolutionNameSubject.next(null);
        this.selectedSolutionDataSubject.next(null);
      }
    }

    this.updateAvailableSolutions();
    this.saveToLocalStorage();
  }

  /**
   * Reset to default mock solutions (clears cache)
   */
  resetToDefaults(): void {
    this.solutionsCache.clear();
    localStorage.removeItem(CACHE_KEY);
    this.loadMockSolutions();
  }

  /**
   * Export a solution as JSON
   */
  exportSolution(solutionName: string): string | null {
    const solution = this.solutionsCache.get(solutionName);
    if (!solution) return null;
    return JSON.stringify(solution, null, 2);
  }

  /**
   * Import a solution from JSON
   */
  importSolution(jsonString: string): boolean {
    try {
      const solution = JSON.parse(jsonString) as NoCodeSolutionRawData;
      if (!solution.solutionName) {
        console.warn('Invalid solution data: missing solutionName');
        return false;
      }
      this.solutionsCache.set(solution.solutionName, solution);
      this.updateAvailableSolutions();
      this.saveToLocalStorage();
      return true;
    } catch (error) {
      console.error('Failed to import solution:', error);
      return false;
    }
  }

  // ==================== State-Space Object Association Methods ====================

  /**
   * Bind a state to a StateDefinition template
   */
  bindStateToDefinition(
    solutionName: string,
    stateName: string,
    stateDefinitionId: string,
    sourceClassName: string
  ): void {
    const solution = this.solutionsCache.get(solutionName);
    if (!solution) return;

    const state = solution.stateInstances.find(s => s.stateName === stateName);
    if (state) {
      // Extend the raw data type to include state-space fields
      (state as any).stateDefinitionId = stateDefinitionId;
      (state as any).boundObjectClass = sourceClassName;
      this.solutionsCache.set(solutionName, solution);

      if (this.selectedSolutionNameSubject.value === solutionName) {
        this.selectedSolutionDataSubject.next({ ...solution });
      }

      this.saveToLocalStorage();
    }
  }

  /**
   * Bind a state to a specific object instance
   */
  bindStateToObjectInstance(
    solutionName: string,
    stateName: string,
    objectInstanceId: string,
    fieldValues?: { [fieldName: string]: any }
  ): void {
    const solution = this.solutionsCache.get(solutionName);
    if (!solution) return;

    const state = solution.stateInstances.find(s => s.stateName === stateName);
    if (state) {
      (state as any).objectInstanceId = objectInstanceId;
      if (fieldValues) {
        (state as any).boundObjectFieldValues = fieldValues;
      }
      this.solutionsCache.set(solutionName, solution);

      if (this.selectedSolutionNameSubject.value === solutionName) {
        this.selectedSolutionDataSubject.next({ ...solution });
      }

      this.saveToLocalStorage();
    }
  }

  /**
   * Update field values for a bound state object
   */
  updateStateFieldValues(
    solutionName: string,
    stateName: string,
    fieldValues: { [fieldName: string]: any }
  ): void {
    const solution = this.solutionsCache.get(solutionName);
    if (!solution) return;

    const state = solution.stateInstances.find(s => s.stateName === stateName);
    if (state) {
      const currentValues = (state as any).boundObjectFieldValues || {};
      (state as any).boundObjectFieldValues = { ...currentValues, ...fieldValues };
      this.solutionsCache.set(solutionName, solution);

      if (this.selectedSolutionNameSubject.value === solutionName) {
        this.selectedSolutionDataSubject.next({ ...solution });
      }

      this.saveToLocalStorage();
    }
  }

  /**
   * Get the bound object data for a state
   */
  getStateBoundObjectData(solutionName: string, stateName: string): {
    stateDefinitionId?: string;
    objectInstanceId?: string;
    boundObjectClass?: string;
    boundObjectFieldValues?: { [fieldName: string]: any };
  } | null {
    const solution = this.solutionsCache.get(solutionName);
    if (!solution) return null;

    const state = solution.stateInstances.find(s => s.stateName === stateName);
    if (!state) return null;

    return {
      stateDefinitionId: (state as any).stateDefinitionId,
      objectInstanceId: (state as any).objectInstanceId,
      boundObjectClass: (state as any).boundObjectClass,
      boundObjectFieldValues: (state as any).boundObjectFieldValues
    };
  }

  /**
   * Get all states in a solution that are bound to state-space objects
   */
  getBoundStates(solutionName: string): { stateName: string; boundObjectClass: string }[] {
    const solution = this.solutionsCache.get(solutionName);
    if (!solution) return [];

    return solution.stateInstances
      .filter(state => (state as any).boundObjectClass)
      .map(state => ({
        stateName: state.stateName,
        boundObjectClass: (state as any).boundObjectClass
      }));
  }

  /**
   * Clear state-space bindings from a state
   */
  clearStateBindings(solutionName: string, stateName: string): void {
    const solution = this.solutionsCache.get(solutionName);
    if (!solution) return;

    const state = solution.stateInstances.find(s => s.stateName === stateName);
    if (state) {
      delete (state as any).stateDefinitionId;
      delete (state as any).objectInstanceId;
      delete (state as any).boundObjectClass;
      delete (state as any).boundObjectFieldValues;
      this.solutionsCache.set(solutionName, solution);

      if (this.selectedSolutionNameSubject.value === solutionName) {
        this.selectedSolutionDataSubject.next({ ...solution });
      }

      this.saveToLocalStorage();
    }
  }

  // ==================== Input Tracing Methods ====================

  /**
   * Get all available input variables for a state by tracing back through connectors.
   * This is used by ValueSourceSelector to populate the "From Input" dropdown.
   *
   * @param solutionName - The name of the solution
   * @param stateName - The name of the state to get inputs for
   * @returns Array of available input variables with their source information
   */
  getAvailableInputsForState(solutionName: string, stateName: string): {
    slotIndex: number;
    variableName: string;
    type: string;
    sourceStateName: string;
    label?: string;
  }[] {
    const solution = this.solutionsCache.get(solutionName);
    if (!solution) return [];

    const targetState = solution.stateInstances.find(s => s.stateName === stateName);
    if (!targetState || !targetState.slots) return [];

    const availableInputs: {
      slotIndex: number;
      variableName: string;
      type: string;
      sourceStateName: string;
      label?: string;
    }[] = [];

    // Find all input slots for this state
    const inputSlots = targetState.slots.filter(slot => slot.isInput);

    for (const inputSlot of inputSlots) {
      // Find the source connector that connects TO this input slot
      const sourceInfo = this.findSourceForInputSlot(solution, stateName, inputSlot.index);

      if (sourceInfo) {
        availableInputs.push({
          slotIndex: inputSlot.index,
          variableName: sourceInfo.variableName || inputSlot.parameterName || `input_${inputSlot.index}`,
          type: sourceInfo.type || inputSlot.parameterType || 'any',
          sourceStateName: sourceInfo.sourceStateName,
          label: inputSlot.label || sourceInfo.variableName
        });
      } else {
        // No connection found, but still report the slot
        availableInputs.push({
          slotIndex: inputSlot.index,
          variableName: inputSlot.parameterName || `input_${inputSlot.index}`,
          type: inputSlot.parameterType || 'any',
          sourceStateName: '(not connected)',
          label: inputSlot.label
        });
      }
    }

    return availableInputs;
  }

  /**
   * Find the source state and variable that connects to a specific input slot
   */
  private findSourceForInputSlot(
    solution: NoCodeSolutionRawData,
    targetStateName: string,
    targetSlotIndex: number
  ): { sourceStateName: string; variableName: string; type: string } | null {
    // Search all states for connectors that target this input slot
    for (const state of solution.stateInstances) {
      if (!state.slots) continue;

      for (const slot of state.slots) {
        // Only check output slots (non-input)
        if (slot.isInput) continue;

        for (const connector of slot.connectors || []) {
          if (connector.targetStateName === targetStateName && connector.sinkSlot === targetSlotIndex) {
            // Found the source! Extract variable information
            return {
              sourceStateName: state.stateName,
              variableName: slot.passthroughVariableName || slot.label || `output_${slot.index}`,
              type: slot.returnType || slot.parameterType || 'any'
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Get source object fields for a state (properties of self/bound object)
   * Used by ValueSourceSelector for "From Source Object" option.
   */
  getSourceObjectFieldsForState(solutionName: string, stateName: string): {
    path: string;
    type: string;
    displayName?: string;
  }[] {
    const solution = this.solutionsCache.get(solutionName);
    if (!solution) return [];

    const state = solution.stateInstances.find(s => s.stateName === stateName);
    if (!state) return [];

    const fields: { path: string; type: string; displayName?: string }[] = [];

    // If there's a bound class, get its fields
    if (solution.boundClass?.fields) {
      for (const field of solution.boundClass.fields) {
        fields.push({
          path: `self.${field.name}`,
          type: field.type,
          displayName: field.displayName || field.name
        });
      }
    }

    // If the state has bound object field values, include those
    if (state.boundObjectFieldValues) {
      for (const [key, value] of Object.entries(state.boundObjectFieldValues)) {
        // Skip non-field entries
        if (typeof value === 'object' && value !== null) continue;

        // Only add if not already present from boundClass
        if (!fields.find(f => f.path === `self.${key}`)) {
          fields.push({
            path: `self.${key}`,
            type: typeof value,
            displayName: key
          });
        }
      }
    }

    return fields;
  }

  /**
   * Associate states with object instances from a StateDefinition
   * This creates the connection between visual states and actual object behavior
   */
  associateStateWithDefinition(
    solutionName: string,
    stateName: string,
    definition: StateDefinition
  ): void {
    const solution = this.solutionsCache.get(solutionName);
    if (!solution) return;

    const state = solution.stateInstances.find(s => s.stateName === stateName);
    if (state) {
      // Set the binding information
      (state as any).stateDefinitionId = definition.id;
      (state as any).boundObjectClass = definition.sourceClassName;

      // Initialize field values from definition's display fields
      const initialFieldValues: { [key: string]: any } = {};
      definition.displayFields.forEach(field => {
        initialFieldValues[field.fieldName] = null;
      });
      (state as any).boundObjectFieldValues = initialFieldValues;

      // Update the state class to match the definition's source class
      state.stateClass = definition.sourceClassName;

      this.solutionsCache.set(solutionName, solution);

      if (this.selectedSolutionNameSubject.value === solutionName) {
        this.selectedSolutionDataSubject.next({ ...solution });
      }

      this.saveToLocalStorage();
    }
  }

  // ==================== Flow-Based Context Resolution ====================

  /**
   * Check if a state type is a control flow state (doesn't produce data variables)
   */
  private isControlFlowState(stateClass: string | undefined): boolean {
    if (!stateClass) return false;
    return CONTROL_FLOW_STATE_TYPES.includes(stateClass);
  }

  /**
   * Check if a state is a branching state (has multiple output slots, like ConditionalChain)
   */
  private isBranchingState(state: NoCodeStateRawData): boolean {
    if (!state.slots) return false;
    const outputSlots = state.slots.filter(s => !s.isInput);
    // A state branches if it has more than one output slot with connections
    const connectedOutputs = outputSlots.filter(s =>
      s.connectors && s.connectors.length > 0
    );
    return connectedOutputs.length > 1;
  }

  /**
   * Build a PotentialContext for a state by tracing backwards through the flow graph.
   * This determines what variables and object types COULD be available at this state
   * based on its position in the solution graph.
   *
   * Control Flow States (InitialState, VariableAssignment, ConditionalChain):
   * - Do NOT produce data variables to pass through context
   * - InitialState: Only provides access to Solution Object
   * - VariableAssignment: Assigns values but doesn't produce flow variables
   * - ConditionalChain: Routes flow but doesn't produce variables
   *
   * Branch Tracking:
   * - When flow passes through a branching state, the branch path is recorded
   * - Variables carry their branch path for full traceability
   *
   * @param solutionName - The name of the solution
   * @param stateName - The name of the state to build context for
   * @returns PotentialContext with all available variables and object types
   */
  getPotentialContextForState(solutionName: string, stateName: string): PotentialContext {
    const solution = this.solutionsCache.get(solutionName);
    const context = new PotentialContext(solutionName, stateName);

    if (!solution) {
      return context;
    }

    const targetState = solution.stateInstances.find(s => s.stateName === stateName);
    if (!targetState) {
      return context;
    }

    // ALWAYS add Solution Object first - it's always available
    this.addSolutionObject(solution, context);

    // Build context by tracing backwards with branch tracking
    const visited = new Set<string>();
    const currentBranchPath: BranchPoint[] = [];

    this.buildContextWithBranches(
      solution,
      stateName,
      context,
      visited,
      0,  // depth
      currentBranchPath
    );

    return context;
  }

  /**
   * Recursively trace backwards through the flow graph to collect all
   * potential variables and object types, tracking branch paths.
   *
   * Key behaviors:
   * - Control flow states (InitialState, VariableAssignment, ConditionalChain)
   *   do NOT add their output variables to context
   * - When passing through a branching state, the branch index is recorded
   * - Variables maintain their full branch path for differentiation
   */
  private buildContextWithBranches(
    solution: NoCodeSolutionRawData,
    stateName: string,
    context: PotentialContext,
    visited: Set<string>,
    depth: number,
    branchPath: BranchPoint[]
  ): void {
    // Create a unique visit key that includes the branch path
    // This allows visiting the same state via different branches
    const branchKey = branchPath.map(bp => `${bp.originStateName}:${bp.branchIndex}`).join('>');
    const visitKey = `${stateName}|${branchKey}`;

    if (visited.has(visitKey)) {
      return;
    }
    visited.add(visitKey);

    const state = solution.stateInstances.find(s => s.stateName === stateName);
    if (!state || !state.slots) {
      return;
    }

    // Update distance from initial
    if (depth > context.distanceFromInitial) {
      context.distanceFromInitial = depth;
    }

    // Find all input slots and their sources
    const inputSlots = state.slots.filter(slot => slot.isInput);

    for (const inputSlot of inputSlots) {
      // Find what connects to this input slot
      const sourceInfo = this.findSourceConnectionInfoExtended(solution, stateName, inputSlot.index);

      if (sourceInfo) {
        // Record upstream states
        if (depth === 0 && !context.directUpstreamStates.includes(sourceInfo.sourceStateName)) {
          context.directUpstreamStates.push(sourceInfo.sourceStateName);
        }
        if (!context.allUpstreamStates.includes(sourceInfo.sourceStateName)) {
          context.allUpstreamStates.push(sourceInfo.sourceStateName);
        }

        // Get the source state to check if it's a control flow state
        const sourceState = solution.stateInstances.find(s => s.stateName === sourceInfo.sourceStateName);
        const isSourceControlFlow = this.isControlFlowState(sourceState?.stateClass);

        // Determine if we're coming through a branch
        let updatedBranchPath = [...branchPath];
        if (sourceState && this.isBranchingState(sourceState)) {
          // Add this branch point to the path
          const branchPoint: BranchPoint = {
            originStateName: sourceInfo.sourceStateName,
            branchIndex: sourceInfo.sourceSlotIndex,
            stepAtBranch: depth + 1,
            branchLabel: sourceInfo.branchLabel
          };
          updatedBranchPath = [branchPoint, ...updatedBranchPath];
        }

        // Only add variables from NON-control-flow states
        if (!isSourceControlFlow && sourceInfo.variableName) {
          const variable: PotentialVariable = {
            name: sourceInfo.variableName,
            type: sourceInfo.type,
            sourceStateName: sourceInfo.sourceStateName,
            sourceSlotIndex: sourceInfo.sourceSlotIndex,
            flowDistance: depth + 1,
            inputSlotIndex: inputSlot.index,
            label: inputSlot.label || sourceInfo.variableName,
            branchPath: updatedBranchPath
          };
          context.addVariable(variable);

          // Handle comma-separated variable names (passthrough)
          if (sourceInfo.variableName.includes(',')) {
            const varNames = sourceInfo.variableName.split(',').map(v => v.trim());
            for (const varName of varNames) {
              if (varName) {
                context.addVariable({
                  ...variable,
                  name: varName,
                  label: varName
                });
              }
            }
          }
        }

        // SPECIAL CASE: VariableAssignment states that have configured output variables
        // These DO produce variables that should be available downstream
        if (sourceState && sourceState.stateClass === 'VariableAssignment') {
          const bofv = sourceState.boundObjectFieldValues;
          if (bofv) {
            // Check for outputVariable (new variable creation)
            const outputVar = bofv.outputVariable;
            if (outputVar && outputVar.name && outputVar.type) {
              const variable: PotentialVariable = {
                name: outputVar.name,
                type: outputVar.type,
                sourceStateName: sourceInfo.sourceStateName,
                sourceSlotIndex: sourceInfo.sourceSlotIndex,
                flowDistance: depth + 1,
                inputSlotIndex: inputSlot.index,
                label: outputVar.name,
                branchPath: updatedBranchPath
              };
              context.addVariable(variable);
            }

            // Also check assignmentConfig for new_variable target type
            const assignmentConfig = bofv.assignmentConfig;
            if (assignmentConfig && assignmentConfig.targetType === 'new_variable' && assignmentConfig.variableName) {
              // Only add if not already added from outputVariable
              if (!context.variables.has(assignmentConfig.variableName)) {
                const variable: PotentialVariable = {
                  name: assignmentConfig.variableName,
                  type: assignmentConfig.dataType || 'any',
                  sourceStateName: sourceInfo.sourceStateName,
                  sourceSlotIndex: sourceInfo.sourceSlotIndex,
                  flowDistance: depth + 1,
                  inputSlotIndex: inputSlot.index,
                  label: assignmentConfig.variableName,
                  branchPath: updatedBranchPath
                };
                context.addVariable(variable);
              }
            }
          }
        }

        // SPECIAL CASE: MathOperation states that create new variables
        if (sourceState && sourceState.stateClass === 'MathOperation') {
          const bofv = sourceState.boundObjectFieldValues;
          if (bofv && bofv.mathConfig) {
            const mathConfig = bofv.mathConfig;
            if (mathConfig.resultTarget === 'new_variable' && mathConfig.resultVariableName) {
              const variable: PotentialVariable = {
                name: mathConfig.resultVariableName,
                type: 'number',
                sourceStateName: sourceInfo.sourceStateName,
                sourceSlotIndex: sourceInfo.sourceSlotIndex,
                flowDistance: depth + 1,
                inputSlotIndex: inputSlot.index,
                label: mathConfig.resultVariableName,
                branchPath: updatedBranchPath
              };
              context.addVariable(variable);
            }
          }
        }

        // Extract object type from non-control-flow states (but not InitialState)
        if (sourceState && !this.isControlFlowState(sourceState.stateClass)) {
          this.extractObjectTypeFromStateWithBranch(
            solution,
            sourceInfo.sourceStateName,
            context,
            depth + 1,
            updatedBranchPath
          );
        }

        // Continue tracing backwards
        this.buildContextWithBranches(
          solution,
          sourceInfo.sourceStateName,
          context,
          visited,
          depth + 1,
          updatedBranchPath
        );
      }
    }

    // For the target state itself (depth 0), extract its object type if bound
    // but only if it's not a control flow state
    if (depth === 0 && !this.isControlFlowState(state.stateClass)) {
      this.extractObjectTypeFromStateWithBranch(solution, stateName, context, 0, branchPath);
    }
  }

  /**
   * Find detailed connection info for an input slot, including branch info
   */
  private findSourceConnectionInfoExtended(
    solution: NoCodeSolutionRawData,
    targetStateName: string,
    targetSlotIndex: number
  ): {
    sourceStateName: string;
    sourceSlotIndex: number;
    variableName: string;
    type: string;
    branchLabel?: string;
  } | null {
    for (const state of solution.stateInstances) {
      if (!state.slots) continue;

      for (const slot of state.slots) {
        if (slot.isInput) continue;

        for (const connector of slot.connectors || []) {
          if (connector.targetStateName === targetStateName && connector.sinkSlot === targetSlotIndex) {
            return {
              sourceStateName: state.stateName,
              sourceSlotIndex: slot.index,
              variableName: slot.passthroughVariableName || slot.label || `output_${slot.index}`,
              type: slot.returnType || slot.parameterType || 'any',
              branchLabel: slot.label || undefined
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Legacy method for backwards compatibility
   */
  private findSourceConnectionInfo(
    solution: NoCodeSolutionRawData,
    targetStateName: string,
    targetSlotIndex: number
  ): {
    sourceStateName: string;
    sourceSlotIndex: number;
    variableName: string;
    type: string;
  } | null {
    const extended = this.findSourceConnectionInfoExtended(solution, targetStateName, targetSlotIndex);
    if (!extended) return null;
    return {
      sourceStateName: extended.sourceStateName,
      sourceSlotIndex: extended.sourceSlotIndex,
      variableName: extended.variableName,
      type: extended.type
    };
  }

  /**
   * Extract object type information from a state, including branch path
   */
  private extractObjectTypeFromStateWithBranch(
    solution: NoCodeSolutionRawData,
    stateName: string,
    context: PotentialContext,
    flowDistance: number,
    branchPath: BranchPoint[]
  ): void {
    const state = solution.stateInstances.find(s => s.stateName === stateName);
    if (!state) return;

    const boundClass = (state as any).boundObjectClass;
    if (!boundClass) return;

    // Check if we already have this object type (regardless of branch)
    if (context.hasObjectType(boundClass)) {
      return;
    }

    // Create the potential object type
    const objectType: PotentialObjectType = {
      className: boundClass,
      fields: [],
      sourceStateName: stateName,
      flowDistance,
      instanceId: (state as any).objectInstanceId,
      branchPath: [...branchPath]
    };

    // Get fields from the state's bound values
    const fieldValues = (state as any).boundObjectFieldValues;
    if (fieldValues) {
      for (const [fieldName, value] of Object.entries(fieldValues)) {
        objectType.fields.push({
          path: `self.${fieldName}`,
          displayName: fieldName,
          type: typeof value === 'object' ? 'object' : typeof value,
          writable: true
        });
      }
    }

    context.addObjectType(objectType);
  }

  /**
   * Legacy method for backwards compatibility
   */
  private extractObjectTypeFromState(
    solution: NoCodeSolutionRawData,
    stateName: string,
    context: PotentialContext,
    flowDistance: number
  ): void {
    this.extractObjectTypeFromStateWithBranch(solution, stateName, context, flowDistance, []);
  }

  /**
   * Add the Solution Object to context.
   * The Solution Object is the bound class of the solution itself and is
   * ALWAYS available at every state, regardless of flow position.
   * This is the only context available at InitialState.
   */
  private addSolutionObject(
    solution: NoCodeSolutionRawData,
    context: PotentialContext
  ): void {
    // Get solution's bound class
    const boundClass = solution.boundClass;
    if (!boundClass) return;

    const className = (boundClass as any).name ||
                      (boundClass as any).className ||
                      'SolutionObject';

    const fields: PotentialObjectField[] = [];

    // Add fields from bound class definition
    if (boundClass.fields) {
      for (const field of boundClass.fields) {
        fields.push({
          path: `self.${field.name}`,
          displayName: field.displayName || field.name,
          type: field.type,
          writable: true
        });
      }
    }

    // Create the solution object type
    const solutionObject: PotentialObjectType = {
      className,
      fields,
      sourceStateName: '__solution__',
      flowDistance: 0,
      branchPath: [],
      isSolutionObject: true
    };

    context.setSolutionObject(solutionObject);
  }

  /**
   * Legacy method - redirects to addSolutionObject
   */
  private addSolutionObjectFields(
    solution: NoCodeSolutionRawData,
    context: PotentialContext
  ): void {
    // Now handled by addSolutionObject at the start of getPotentialContextForState
    // This method is kept for any external callers
    if (!context.solutionObject) {
      this.addSolutionObject(solution, context);
    }
  }

  /**
   * Find the initial state(s) of a solution
   */
  findInitialStates(solutionName: string): string[] {
    const solution = this.solutionsCache.get(solutionName);
    if (!solution) return [];

    const initialStates: string[] = [];

    for (const state of solution.stateInstances) {
      // A state is initial if it has no input slots with connections
      const inputSlots = state.slots?.filter(s => s.isInput) || [];

      if (inputSlots.length === 0) {
        // No input slots = initial state
        initialStates.push(state.stateName);
      } else {
        // Check if any input slot has a connection
        let hasConnection = false;
        for (const inputSlot of inputSlots) {
          if (this.findSourceConnectionInfo(solution, state.stateName, inputSlot.index)) {
            hasConnection = true;
            break;
          }
        }
        if (!hasConnection) {
          initialStates.push(state.stateName);
        }
      }
    }

    return initialStates;
  }

  /**
   * Calculate the minimum distance from a state to any initial state
   */
  getDistanceFromInitial(solutionName: string, stateName: string): number {
    const context = this.getPotentialContextForState(solutionName, stateName);
    return context.distanceFromInitial;
  }

  /**
   * Get all states that feed into a given state (direct connections only)
   */
  getDirectUpstreamStates(solutionName: string, stateName: string): string[] {
    const context = this.getPotentialContextForState(solutionName, stateName);
    return context.directUpstreamStates;
  }

  /**
   * Get all states that are upstream of a given state (any distance)
   */
  getAllUpstreamStates(solutionName: string, stateName: string): string[] {
    const context = this.getPotentialContextForState(solutionName, stateName);
    return context.allUpstreamStates;
  }
}
