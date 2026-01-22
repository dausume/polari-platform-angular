/**
 * TableConfigurationService
 *
 * Reactive service for managing table configurations.
 * Provides RxJS observables that components can subscribe to for automatic updates.
 *
 * REACTIVE FLOW:
 * ==============
 *
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │                  Table Configuration Component                  │
 *   │  (User clicks X to remove column, reorders, toggles visibility) │
 *   └─────────────────────────┬───────────────────────────────────────┘
 *                             │
 *                             ▼ updateConfiguration()
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │                 TableConfigurationService                        │
 *   │  ┌─────────────────────────────────────────────────────────┐    │
 *   │  │  configSubjects: Map<className, BehaviorSubject<config>>│    │
 *   │  └─────────────────────────┬───────────────────────────────┘    │
 *   └─────────────────────────────┼───────────────────────────────────┘
 *                                 │
 *                                 ▼ config$.next(newConfig)
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │                     Data Table Component                         │
 *   │  ngOnInit() {                                                    │
 *   │    this.configService.getConfiguration$(className)               │
 *   │      .subscribe(config => this.reinitializeTable(config));       │
 *   │  }                                                               │
 *   └─────────────────────────────────────────────────────────────────┘
 *
 * USAGE:
 * ======
 *
 * In Table Configuration Component (producer):
 * ```typescript
 * // When user makes a change
 * onColumnRemoved(columnName: string) {
 *   this.config.removeColumn(columnName);
 *   this.configService.updateConfiguration(this.className, this.config);
 * }
 * ```
 *
 * In Data Table Component (consumer):
 * ```typescript
 * ngOnInit() {
 *   this.configService.getConfiguration$(this.className)
 *     .pipe(takeUntil(this.destroy$))
 *     .subscribe(config => {
 *       this.tableConfig = config;
 *       this.reinitializeTable();
 *     });
 * }
 * ```
 */

import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { distinctUntilChanged, map, shareReplay } from 'rxjs/operators';
import { TableConfiguration } from '@models/tables/TableConfiguration';
import { TableViewState } from '@models/tables/ColumnViewState';
import { TablePersonalization } from '@models/tables/ColumnPersonalization';

/**
 * Event emitted when configuration changes
 */
export interface ConfigurationChangeEvent {
    /** Class name the configuration applies to */
    className: string;

    /** The updated configuration */
    configuration: TableConfiguration;

    /** Type of change that occurred */
    changeType: ConfigurationChangeType;

    /** Timestamp of the change */
    timestamp: number;

    /** Optional: specific column that changed */
    affectedColumn?: string;
}

/**
 * Types of configuration changes
 */
export type ConfigurationChangeType =
    | 'column-removed'      // Column marked unavailable (X button)
    | 'column-restored'     // Column restored to available (+ button)
    | 'column-reordered'    // Column order changed (up/down buttons)
    | 'visibility-changed'  // Column visibility toggled
    | 'sort-changed'        // Sort order/direction changed
    | 'full-reset'          // Complete configuration reset
    | 'loaded'              // Configuration loaded from storage
    | 'initialized';        // Configuration initialized from class data

/**
 * Internal state for a single table's configuration
 */
interface TableConfigState {
    /** Configuration (template/defaults) */
    config$: BehaviorSubject<TableConfiguration>;
    /** View state (runtime/session state) */
    viewState$: BehaviorSubject<TableViewState>;
    /** Personalization (persistent user preferences) */
    personalization$: BehaviorSubject<TablePersonalization>;
    /** Last change type */
    lastChangeType: ConfigurationChangeType;
}

@Injectable({
    providedIn: 'root'
})
export class TableConfigurationService implements OnDestroy {

    /**
     * Map of class names to their configuration state
     * Each entry contains BehaviorSubjects for reactive updates
     */
    private configStates = new Map<string, TableConfigState>();

    /**
     * Global change event stream
     * Components can subscribe to this for all configuration changes
     */
    private changeEvents$ = new Subject<ConfigurationChangeEvent>();

    /**
     * Cleanup subject
     */
    private destroy$ = new Subject<void>();

    constructor() {
        console.log('[TableConfigurationService] Initialized');
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();

        // Complete all subjects
        this.configStates.forEach(state => {
            state.config$.complete();
            state.viewState$.complete();
            state.personalization$.complete();
        });
        this.changeEvents$.complete();
    }

    // ==================== Configuration Access ====================

    /**
     * Get or create the configuration state for a class
     */
    private getOrCreateState(className: string): TableConfigState {
        if (!this.configStates.has(className)) {
            // Load from storage or create new
            const config = TableConfiguration.load(className);
            const viewState = TableViewState.load(className);
            const personalization = TablePersonalization.load(className);

            const state: TableConfigState = {
                config$: new BehaviorSubject<TableConfiguration>(config),
                viewState$: new BehaviorSubject<TableViewState>(viewState),
                personalization$: new BehaviorSubject<TablePersonalization>(personalization),
                lastChangeType: 'loaded'
            };

            this.configStates.set(className, state);

            console.log(`[TableConfigurationService] Created state for "${className}"`);
        }

        return this.configStates.get(className)!;
    }

    /**
     * GET CONFIGURATION OBSERVABLE
     *
     * Subscribe to this to receive configuration updates.
     * Emits immediately with current value, then on every change.
     *
     * @param className - The class name to get configuration for
     * @returns Observable that emits TableConfiguration on changes
     *
     * @example
     * ```typescript
     * this.configService.getConfiguration$('polariAPI')
     *   .pipe(takeUntil(this.destroy$))
     *   .subscribe(config => {
     *     this.displayedColumns = config.getVisibleColumnNames();
     *     this.dataSource.data = [...this.dataSource.data]; // Trigger refresh
     *   });
     * ```
     */
    getConfiguration$(className: string): Observable<TableConfiguration> {
        const state = this.getOrCreateState(className);
        return state.config$.asObservable().pipe(
            distinctUntilChanged((prev, curr) => prev.lastModified === curr.lastModified),
            shareReplay(1)
        );
    }

    /**
     * Get current configuration value (non-reactive)
     */
    getConfiguration(className: string): TableConfiguration {
        return this.getOrCreateState(className).config$.getValue();
    }

    /**
     * GET VIEW STATE OBSERVABLE
     *
     * Subscribe to this to receive view state updates (runtime state).
     * Emits immediately with current value, then on every change.
     */
    getViewState$(className: string): Observable<TableViewState> {
        const state = this.getOrCreateState(className);
        return state.viewState$.asObservable().pipe(
            distinctUntilChanged((prev, curr) => prev.lastModified === curr.lastModified),
            shareReplay(1)
        );
    }

    /**
     * Get current view state value (non-reactive)
     */
    getViewState(className: string): TableViewState {
        return this.getOrCreateState(className).viewState$.getValue();
    }

    /**
     * Get personalization observable (persistent user preferences)
     */
    getPersonalization$(className: string): Observable<TablePersonalization> {
        const state = this.getOrCreateState(className);
        return state.personalization$.asObservable().pipe(
            shareReplay(1)
        );
    }

    /**
     * Get current personalization value (non-reactive)
     */
    getPersonalization(className: string): TablePersonalization {
        return this.getOrCreateState(className).personalization$.getValue();
    }

    /**
     * Get global change events stream
     * Use this to react to any configuration change across all tables
     */
    getChangeEvents$(): Observable<ConfigurationChangeEvent> {
        return this.changeEvents$.asObservable();
    }

    /**
     * Get change events for a specific class
     */
    getChangeEventsFor$(className: string): Observable<ConfigurationChangeEvent> {
        return this.changeEvents$.pipe(
            map(event => event.className === className ? event : null),
            distinctUntilChanged()
        ) as Observable<ConfigurationChangeEvent>;
    }

    // ==================== Configuration Updates ====================

    /**
     * UPDATE CONFIGURATION
     *
     * Call this when the Table Configuration Component makes changes.
     * This will:
     * 1. Update the internal BehaviorSubject
     * 2. Save to localStorage
     * 3. Emit change event to all subscribers
     * 4. Trigger re-initialization in subscribed Data Table components
     *
     * @param className - The class name
     * @param config - The updated configuration
     * @param changeType - Type of change (for logging/analytics)
     * @param affectedColumn - Optional: specific column that changed
     */
    updateConfiguration(
        className: string,
        config: TableConfiguration,
        changeType: ConfigurationChangeType,
        affectedColumn?: string
    ): void {
        const state = this.getOrCreateState(className);

        // Save to storage
        config.save();

        // Update state
        state.lastChangeType = changeType;
        state.config$.next(config);

        // Emit change event
        const event: ConfigurationChangeEvent = {
            className,
            configuration: config,
            changeType,
            timestamp: Date.now(),
            affectedColumn
        };
        this.changeEvents$.next(event);

        console.log(`[TableConfigurationService] Configuration updated: ${className} (${changeType})`);
    }

    /**
     * UPDATE VIEW STATE
     *
     * Call this when the runtime view state changes.
     * This will:
     * 1. Update the internal BehaviorSubject
     * 2. Save to localStorage
     * 3. Notify all subscribers
     *
     * @param className - The class name
     * @param viewState - The updated view state
     */
    updateViewState(
        className: string,
        viewState: TableViewState
    ): void {
        const state = this.getOrCreateState(className);

        // Save to storage
        viewState.save();

        // Update state
        state.viewState$.next(viewState);

        console.log(`[TableConfigurationService] View state updated: ${className}`);
    }

    /**
     * Update personalization
     */
    updatePersonalization(
        className: string,
        personalization: TablePersonalization
    ): void {
        const state = this.getOrCreateState(className);

        // Save to storage
        personalization.save();

        // Update state
        state.personalization$.next(personalization);

        console.log(`[TableConfigurationService] Personalization updated: ${className}`);
    }

    // ==================== Convenience Methods ====================

    /**
     * REMOVE COLUMN
     *
     * Convenience method for when user clicks X on a column.
     * Marks column as unavailable and notifies subscribers.
     */
    removeColumn(className: string, columnName: string): void {
        const config = this.getConfiguration(className);
        const column = config.getColumn(columnName);

        if (column) {
            column.markUnavailable();
            config.removeColumn(columnName);
            this.updateConfiguration(className, config, 'column-removed', columnName);
        }
    }

    /**
     * RESTORE COLUMN
     *
     * Convenience method for when user clicks + to restore a column.
     */
    restoreColumn(className: string, columnName: string): void {
        const config = this.getConfiguration(className);
        const column = config.getColumn(columnName);

        if (column) {
            column.markAvailable();
            config.restoreColumn(columnName);
            this.updateConfiguration(className, config, 'column-restored', columnName);
        }
    }

    /**
     * MOVE COLUMN UP
     */
    moveColumnUp(className: string, columnName: string): void {
        const config = this.getConfiguration(className);
        config.moveColumnUp(columnName);
        this.updateConfiguration(className, config, 'column-reordered', columnName);
    }

    /**
     * MOVE COLUMN DOWN
     */
    moveColumnDown(className: string, columnName: string): void {
        const config = this.getConfiguration(className);
        config.moveColumnDown(columnName);
        this.updateConfiguration(className, config, 'column-reordered', columnName);
    }

    /**
     * TOGGLE COLUMN VISIBILITY
     */
    toggleColumnVisibility(className: string, columnName: string): void {
        const config = this.getConfiguration(className);
        const column = config.getColumn(columnName);

        if (column) {
            column.toggleVisibility();
            this.updateConfiguration(className, config, 'visibility-changed', columnName);
        }
    }

    /**
     * SET SORT ORDER
     */
    setSortOrder(className: string, sortOrder: 'alphabetical' | 'custom' | 'type' | 'none'): void {
        const config = this.getConfiguration(className);
        config.setSortOrder(sortOrder);
        this.updateConfiguration(className, config, 'sort-changed');
    }

    /**
     * TOGGLE SORT DIRECTION
     */
    toggleSortDirection(className: string): void {
        const config = this.getConfiguration(className);
        config.toggleSortDirection();
        this.updateConfiguration(className, config, 'sort-changed');
    }

    /**
     * INITIALIZE FROM CLASS DATA
     *
     * Call this when class type data is loaded.
     * Syncs configuration with current class structure.
     */
    initializeFromClassData(className: string, classTypeData: Record<string, any>): void {
        const config = this.getConfiguration(className);
        config.initializeFromClassTypeData(classTypeData);
        this.updateConfiguration(className, config, 'initialized');
    }

    /**
     * RESET CONFIGURATION
     *
     * Reset configuration to defaults.
     */
    resetConfiguration(className: string): void {
        const config = this.getConfiguration(className);
        config.reset();
        this.updateConfiguration(className, config, 'full-reset');
    }

    /**
     * RELOAD FROM STORAGE
     *
     * Force reload configuration from localStorage.
     */
    reloadFromStorage(className: string): void {
        const config = TableConfiguration.load(className);
        const state = this.getOrCreateState(className);

        state.config$.next(config);
        state.lastChangeType = 'loaded';

        this.changeEvents$.next({
            className,
            configuration: config,
            changeType: 'loaded',
            timestamp: Date.now()
        });
    }

    // ==================== Cleanup ====================

    /**
     * Clear state for a class (e.g., when navigating away)
     */
    clearState(className: string): void {
        const state = this.configStates.get(className);
        if (state) {
            state.config$.complete();
            state.viewState$.complete();
            state.personalization$.complete();
            this.configStates.delete(className);
            console.log(`[TableConfigurationService] Cleared state for "${className}"`);
        }
    }
}
