// Author: Dustin Etts
// polari-platform-angular/src/app/services/no-code-services/state-definition.service.ts
// Service for managing StateDefinitions - CRUD operations, caching, and API communication

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import {
  StateDefinition,
  StateDefinitionFactory,
  StateSpaceConfig,
  StateSpaceEventMethod as StateDefEventMethod,
  EventInputParam,
  StateSpaceClassesResponse,
  StateSpaceConfigResponse,
  StateDefinitionsResponse,
  StateDefinitionResponse
} from '@models/noCode/StateDefinition';
import {
  StateSpaceClassRegistry,
  StateSpaceClassMetadata,
  StateSpaceCategory,
  StateSpaceEventMethod as RegistryEventMethod
} from '@models/stateSpace/stateSpaceClassRegistry';

const LOCAL_STORAGE_KEY = 'polari-state-definitions-cache';

/**
 * Cache structure for state definitions stored in localStorage
 */
interface StateDefinitionCache {
  definitions: StateDefinition[];
  stateSpaceConfigs: { [className: string]: StateSpaceConfig };
  lastUpdated: number;
}

@Injectable({
  providedIn: 'root'
})
export class StateDefinitionService {
  // API base URL (will be configured based on environment)
  private apiBaseUrl = '/api';

  // In-memory cache of state definitions
  private definitionsCache: Map<string, StateDefinition> = new Map();

  // In-memory cache of state-space configurations by class name
  private stateSpaceConfigsCache: Map<string, StateSpaceConfig> = new Map();

  // Observable streams for reactive updates
  private stateDefinitionsSubject = new BehaviorSubject<StateDefinition[]>([]);
  public stateDefinitions$ = this.stateDefinitionsSubject.asObservable();

  private stateSpaceClassesSubject = new BehaviorSubject<StateSpaceConfig[]>([]);
  public stateSpaceClasses$ = this.stateSpaceClassesSubject.asObservable();

  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  // Reference to the built-in state-space class registry
  private registry = StateSpaceClassRegistry.getInstance();

  constructor(private http: HttpClient) {
    this.initializeFromCache();
  }

  /**
   * Initialize service from localStorage cache
   */
  private initializeFromCache(): void {
    const cached = this.loadFromLocalStorage();
    if (cached) {
      // Restore state definitions
      cached.definitions.forEach(def => {
        if (def.id) {
          this.definitionsCache.set(def.id, def);
        }
      });
      this.stateDefinitionsSubject.next(cached.definitions);

      // Restore state-space configs
      Object.entries(cached.stateSpaceConfigs).forEach(([className, config]) => {
        this.stateSpaceConfigsCache.set(className, config);
      });
      this.stateSpaceClassesSubject.next(Object.values(cached.stateSpaceConfigs));
    }

    // Also populate with built-in registry classes
    this.populateFromRegistry();
  }

  /**
   * Populate state-space configs from the built-in registry
   */
  private populateFromRegistry(): void {
    const allClasses = this.registry.getAllClasses();
    allClasses.forEach(metadata => {
      const config = this.convertRegistryMetadataToConfig(metadata);
      this.stateSpaceConfigsCache.set(metadata.className, config);
    });

    // Update the observable
    const configs = Array.from(this.stateSpaceConfigsCache.values());
    this.stateSpaceClassesSubject.next(configs);
  }

  /**
   * Convert StateSpaceClassMetadata to StateSpaceConfig
   */
  private convertRegistryMetadataToConfig(metadata: StateSpaceClassMetadata): StateSpaceConfig {
    return {
      className: metadata.className,
      isStateSpaceObject: true,
      eventMethods: metadata.eventMethods.map(em => this.convertRegistryEventMethod(em, metadata.category)),
      displayFields: metadata.stateSpaceDisplayFields,
      fieldLayout: metadata.variables.reduce((acc, v) => {
        acc[v.name] = { row: 0, visible: true };
        return acc;
      }, {} as { [fieldName: string]: { row: number; visible: boolean } }),
      fieldsPerRow: metadata.stateSpaceFieldsPerRow,
      variables: metadata.variables.map(v => v.name)
    };
  }

  /**
   * Convert registry event method to StateDefinition event method format
   */
  private convertRegistryEventMethod(em: RegistryEventMethod, category: StateSpaceCategory): StateDefEventMethod {
    return {
      methodName: em.methodName,
      displayName: em.displayName,
      description: em.description,
      category: em.category,
      inputParams: em.inputParams.map(p => ({
        name: p.name,
        displayName: p.displayName,
        type: p.type,
        hasDefault: p.defaultValue !== undefined,
        defaultValue: p.defaultValue,
        isRequired: p.isRequired
      })),
      output: em.output
    };
  }

  /**
   * Load cache from localStorage
   */
  private loadFromLocalStorage(): StateDefinitionCache | null {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) {
        return JSON.parse(cached) as StateDefinitionCache;
      }
    } catch (error) {
      console.warn('[StateDefinitionService] Failed to load from localStorage:', error);
    }
    return null;
  }

  /**
   * Save current state to localStorage
   */
  private saveToLocalStorage(): void {
    try {
      const cache: StateDefinitionCache = {
        definitions: Array.from(this.definitionsCache.values()),
        stateSpaceConfigs: {},
        lastUpdated: Date.now()
      };

      this.stateSpaceConfigsCache.forEach((config, className) => {
        cache.stateSpaceConfigs[className] = config;
      });

      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cache));
    } catch (error) {
      console.warn('[StateDefinitionService] Failed to save to localStorage:', error);
    }
  }

  // ==================== State Definition CRUD ====================

  /**
   * Get all state definitions
   */
  getAllStateDefinitions(): StateDefinition[] {
    return Array.from(this.definitionsCache.values());
  }

  /**
   * Get a state definition by ID
   */
  getStateDefinitionById(id: string): StateDefinition | undefined {
    return this.definitionsCache.get(id);
  }

  /**
   * Get state definitions for a specific class
   */
  getStateDefinitionsForClass(className: string): StateDefinition[] {
    return Array.from(this.definitionsCache.values())
      .filter(def => def.sourceClassName === className);
  }

  /**
   * Create a new state definition (local only)
   */
  createStateDefinition(definition: StateDefinition): StateDefinition {
    // Generate ID if not provided
    if (!definition.id) {
      definition.id = `sd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Validate
    const validation = StateDefinitionFactory.validate(definition);
    if (!validation.isValid) {
      throw new Error(`Invalid state definition: ${validation.errors.join(', ')}`);
    }

    // Store in cache
    this.definitionsCache.set(definition.id, definition);
    this.stateDefinitionsSubject.next(Array.from(this.definitionsCache.values()));
    this.saveToLocalStorage();

    return definition;
  }

  /**
   * Update an existing state definition
   */
  updateStateDefinition(id: string, updates: Partial<StateDefinition>): StateDefinition | null {
    const existing = this.definitionsCache.get(id);
    if (!existing) {
      console.warn(`[StateDefinitionService] State definition '${id}' not found`);
      return null;
    }

    const updated = { ...existing, ...updates, id };

    // Validate
    const validation = StateDefinitionFactory.validate(updated);
    if (!validation.isValid) {
      throw new Error(`Invalid state definition: ${validation.errors.join(', ')}`);
    }

    this.definitionsCache.set(id, updated);
    this.stateDefinitionsSubject.next(Array.from(this.definitionsCache.values()));
    this.saveToLocalStorage();

    return updated;
  }

  /**
   * Delete a state definition
   */
  deleteStateDefinition(id: string): boolean {
    if (!this.definitionsCache.has(id)) {
      return false;
    }

    this.definitionsCache.delete(id);
    this.stateDefinitionsSubject.next(Array.from(this.definitionsCache.values()));
    this.saveToLocalStorage();

    return true;
  }

  // ==================== State-Space Class Operations ====================

  /**
   * Get all state-space enabled classes
   */
  getAllStateSpaceClasses(): StateSpaceConfig[] {
    return Array.from(this.stateSpaceConfigsCache.values());
  }

  /**
   * Get state-space config for a specific class
   */
  getStateSpaceConfig(className: string): StateSpaceConfig | undefined {
    return this.stateSpaceConfigsCache.get(className);
  }

  /**
   * Get built-in class metadata from registry
   */
  getBuiltInClassMetadata(className: string): StateSpaceClassMetadata | undefined {
    return this.registry.getClass(className);
  }

  /**
   * Get all built-in classes from registry
   */
  getAllBuiltInClasses(): StateSpaceClassMetadata[] {
    return this.registry.getAllClasses();
  }

  /**
   * Get built-in classes by category
   */
  getBuiltInClassesByCategory(category: StateSpaceCategory): StateSpaceClassMetadata[] {
    return this.registry.getClassesByCategory(category);
  }

  /**
   * Get all categories from built-in registry
   */
  getBuiltInCategories(): StateSpaceCategory[] {
    return this.registry.getCategories();
  }

  // ==================== Factory Methods ====================

  /**
   * Create a StateDefinition from a built-in class
   */
  createDefinitionFromBuiltInClass(
    className: string,
    eventMethodName?: string
  ): StateDefinition | null {
    const metadata = this.registry.getClass(className);
    if (!metadata) {
      console.warn(`[StateDefinitionService] Built-in class '${className}' not found`);
      return null;
    }

    // Use specified event method or first one
    const registryEventMethod = eventMethodName
      ? metadata.eventMethods.find(em => em.methodName === eventMethodName)
      : metadata.eventMethods[0];

    if (!registryEventMethod) {
      console.warn(`[StateDefinitionService] Event method not found for '${className}'`);
      return null;
    }

    // Convert registry event method to StateDefinition event method format
    const eventMethod = this.convertRegistryEventMethod(registryEventMethod, metadata.category);

    return StateDefinitionFactory.fromEvent(className, eventMethod);
  }

  /**
   * Create an empty StateDefinition for a class
   */
  createEmptyDefinition(className: string, name?: string): StateDefinition {
    return StateDefinitionFactory.create(className, name);
  }

  // ==================== API Operations (for backend integration) ====================

  /**
   * Fetch state definitions from backend API
   */
  fetchStateDefinitionsFromApi(): Observable<StateDefinition[]> {
    this.loadingSubject.next(true);

    return this.http.get<StateDefinitionsResponse>(`${this.apiBaseUrl}/stateDefinitions`)
      .pipe(
        map(response => {
          if (response.success) {
            return response.stateDefinitions;
          }
          throw new Error('Failed to fetch state definitions');
        }),
        tap(definitions => {
          // Update cache
          this.definitionsCache.clear();
          definitions.forEach(def => {
            if (def.id) {
              this.definitionsCache.set(def.id, def);
            }
          });
          this.stateDefinitionsSubject.next(definitions);
          this.saveToLocalStorage();
          this.loadingSubject.next(false);
        }),
        catchError(error => {
          console.error('[StateDefinitionService] API fetch error:', error);
          this.loadingSubject.next(false);
          return throwError(() => error);
        })
      );
  }

  /**
   * Fetch state-space classes from backend API
   */
  fetchStateSpaceClassesFromApi(): Observable<StateSpaceConfig[]> {
    this.loadingSubject.next(true);

    return this.http.get<StateSpaceClassesResponse>(`${this.apiBaseUrl}/stateSpaceClasses`)
      .pipe(
        map(response => {
          if (response.success) {
            return response.stateSpaceClasses;
          }
          throw new Error('Failed to fetch state-space classes');
        }),
        tap(configs => {
          // Update cache (merge with built-in registry)
          configs.forEach(config => {
            this.stateSpaceConfigsCache.set(config.className, config);
          });
          this.stateSpaceClassesSubject.next(Array.from(this.stateSpaceConfigsCache.values()));
          this.saveToLocalStorage();
          this.loadingSubject.next(false);
        }),
        catchError(error => {
          console.error('[StateDefinitionService] API fetch error:', error);
          this.loadingSubject.next(false);
          return throwError(() => error);
        })
      );
  }

  /**
   * Save a state definition to backend API
   */
  saveStateDefinitionToApi(definition: StateDefinition): Observable<StateDefinition> {
    this.loadingSubject.next(true);

    const request = definition.id
      ? this.http.put<StateDefinitionResponse>(
          `${this.apiBaseUrl}/stateDefinition/${definition.id}`,
          definition
        )
      : this.http.post<StateDefinitionResponse>(
          `${this.apiBaseUrl}/stateDefinition`,
          definition
        );

    return request.pipe(
      map(response => {
        if (response.success) {
          return response.stateDefinition;
        }
        throw new Error('Failed to save state definition');
      }),
      tap(saved => {
        if (saved.id) {
          this.definitionsCache.set(saved.id, saved);
          this.stateDefinitionsSubject.next(Array.from(this.definitionsCache.values()));
          this.saveToLocalStorage();
        }
        this.loadingSubject.next(false);
      }),
      catchError(error => {
        console.error('[StateDefinitionService] API save error:', error);
        this.loadingSubject.next(false);
        return throwError(() => error);
      })
    );
  }

  /**
   * Delete a state definition from backend API
   */
  deleteStateDefinitionFromApi(id: string): Observable<boolean> {
    this.loadingSubject.next(true);

    return this.http.delete<{ success: boolean }>(`${this.apiBaseUrl}/stateDefinition/${id}`)
      .pipe(
        map(response => response.success),
        tap(success => {
          if (success) {
            this.definitionsCache.delete(id);
            this.stateDefinitionsSubject.next(Array.from(this.definitionsCache.values()));
            this.saveToLocalStorage();
          }
          this.loadingSubject.next(false);
        }),
        catchError(error => {
          console.error('[StateDefinitionService] API delete error:', error);
          this.loadingSubject.next(false);
          return throwError(() => error);
        })
      );
  }

  // ==================== Utility Methods ====================

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.definitionsCache.clear();
    this.stateSpaceConfigsCache.clear();
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    this.stateDefinitionsSubject.next([]);
    this.stateSpaceClassesSubject.next([]);

    // Re-populate from registry
    this.populateFromRegistry();
  }

  /**
   * Check if a class is state-space enabled
   */
  isStateSpaceClass(className: string): boolean {
    return this.stateSpaceConfigsCache.has(className) || this.registry.getClass(className) !== undefined;
  }
}
