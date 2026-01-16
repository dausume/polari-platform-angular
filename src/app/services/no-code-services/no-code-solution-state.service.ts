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

/**
 * Cache structure stored in localStorage
 */
interface SolutionCache {
  solutions: { [solutionName: string]: NoCodeSolutionRawData };
  selectedSolutionName: string | null;
  lastUpdated: number;
}

const CACHE_KEY = 'polari-no-code-solutions-cache';
const CACHE_VERSION = 1;

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

    // Check if cache has all expected mock solutions
    const expectedSolutionCount = MOCK_SOLUTIONS.length;
    const cachedSolutionCount = cached ? Object.keys(cached.solutions).length : 0;

    if (cached && cachedSolutionCount >= expectedSolutionCount) {
      console.log('[StateService] Restoring from cache');
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
      console.log('[StateService] Cache missing or incomplete (expected', expectedSolutionCount, 'solutions, found', cachedSolutionCount, '), loading mock solutions');
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
        lastUpdated: Date.now()
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

    return new Slot(
      raw.index,
      raw.stateName,
      raw.slotAngularPosition,
      connectors,
      raw.isInput,
      raw.allowOneToMany,
      raw.allowManyToOne
    );
  }

  /**
   * Convert raw state data to NoCodeState instance
   */
  private convertRawStateToNoCodeState(raw: NoCodeStateRawData): NoCodeState {
    const slots = raw.slots?.map(s => this.convertRawSlotToSlot(s)) || [];
    return new NoCodeState(
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
}
