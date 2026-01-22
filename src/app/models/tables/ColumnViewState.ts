/**
 * ColumnViewState.ts
 *
 * Current VIEW STATE for table columns.
 * This represents the runtime state of how the table is currently being displayed.
 *
 * RELATIONSHIP TO ColumnConfiguration:
 * ------------------------------------
 * ColumnConfiguration = Template (defines structure, defaults, constraints)
 * ColumnViewState = Current State (runtime values that may differ from defaults)
 *
 * The view state is applied ON TOP OF the configuration:
 * - Configuration sets defaults (what the table SHOULD look like)
 * - ViewState stores current values (what the table DOES look like right now)
 *
 * Example flow:
 * 1. Config defines column with visible=true (default)
 * 2. User toggles visibility off
 * 3. ColumnViewState stores visible=false
 * 4. Table renders using viewState.visible (false), not config.visible (true)
 *
 * STORAGE:
 * --------
 * View state is stored separately from configuration:
 * - Config key: `table_config_v2_${className}`
 * - ViewState key: `table_state_${className}` (or per-user/session)
 */

/**
 * View state interface for a single column
 * Only includes properties that represent current runtime state
 */
export interface IColumnViewState {
    /** Column name this state applies to */
    name: string;

    /**
     * Current visibility state
     * - true: Column is currently shown
     * - false: Column is currently hidden
     * - undefined: Use default from ColumnConfiguration
     */
    visible?: boolean;

    /**
     * Current order position
     * - number: Current position in display order
     * - undefined: Use default from ColumnConfiguration
     */
    order?: number;

    /**
     * Current width (after user resize)
     * - number: Current width in pixels
     * - undefined: Use default from ColumnConfiguration
     */
    width?: number;

    /**
     * Current pinned state
     * - 'left' | 'right': Currently pinned
     * - false: Currently not pinned
     * - undefined: Use default from ColumnConfiguration
     */
    pinned?: 'left' | 'right' | false;

    /**
     * Current sort state for this column
     * - 'asc' | 'desc': Current sort direction when sorted by this column
     * - undefined: Not currently sorted / use default
     */
    currentSortDirection?: 'asc' | 'desc';
}

/**
 * Storage key prefix for view state
 */
const VIEW_STATE_PREFIX = 'table_state_';

/**
 * Column view state class
 */
export class ColumnViewState implements IColumnViewState {
    name: string;
    visible?: boolean;
    order?: number;
    width?: number;
    pinned?: 'left' | 'right' | false;
    currentSortDirection?: 'asc' | 'desc';

    constructor(name: string, state?: Partial<IColumnViewState>) {
        this.name = name;
        if (state) {
            Object.assign(this, state);
        }
    }

    /**
     * Check if any state differs from defaults
     */
    hasState(): boolean {
        return (
            this.visible !== undefined ||
            this.order !== undefined ||
            this.width !== undefined ||
            this.pinned !== undefined ||
            this.currentSortDirection !== undefined
        );
    }

    /**
     * Reset all state to undefined (use defaults)
     */
    reset(): void {
        this.visible = undefined;
        this.order = undefined;
        this.width = undefined;
        this.pinned = undefined;
        this.currentSortDirection = undefined;
    }

    /**
     * Set visibility state
     */
    setVisible(visible: boolean): void {
        this.visible = visible;
    }

    /**
     * Set order state
     */
    setOrder(order: number): void {
        this.order = order;
    }

    /**
     * Set width state
     */
    setWidth(width: number): void {
        this.width = width;
    }

    /**
     * Set pinned state
     */
    setPinned(pinned: 'left' | 'right' | false): void {
        this.pinned = pinned;
    }

    /**
     * Serialize to plain object for storage
     */
    toJSON(): IColumnViewState {
        const json: IColumnViewState = { name: this.name };

        if (this.visible !== undefined) json.visible = this.visible;
        if (this.order !== undefined) json.order = this.order;
        if (this.width !== undefined) json.width = this.width;
        if (this.pinned !== undefined) json.pinned = this.pinned;
        if (this.currentSortDirection !== undefined) json.currentSortDirection = this.currentSortDirection;

        return json;
    }
}

/**
 * Complete table view state interface
 */
export interface ITableViewState {
    /** Class name this state applies to */
    className: string;

    /** Optional user/session identifier */
    sessionId?: string;

    /** Column states by column name */
    columns: Record<string, IColumnViewState>;

    /** Current global filter value */
    globalFilter?: string;

    /** Current page size */
    pageSize?: number;

    /** Current page index */
    pageIndex?: number;

    /** Current density setting */
    density?: 'compact' | 'standard' | 'comfortable';

    /** Currently sorted column */
    sortedColumn?: string;

    /** Current sort direction */
    sortDirection?: 'asc' | 'desc';

    /** Last modified timestamp */
    lastModified: number;
}

/**
 * Table view state class - manages all column states for a table
 */
export class TableViewState implements ITableViewState {
    className: string;
    sessionId?: string;
    columns: Record<string, ColumnViewState> = {};
    globalFilter?: string;
    pageSize?: number;
    pageIndex?: number;
    density?: 'compact' | 'standard' | 'comfortable';
    sortedColumn?: string;
    sortDirection?: 'asc' | 'desc';
    lastModified: number = Date.now();

    constructor(className: string, state?: Partial<ITableViewState>) {
        this.className = className;

        if (state) {
            if (state.sessionId) this.sessionId = state.sessionId;
            if (state.globalFilter) this.globalFilter = state.globalFilter;
            if (state.pageSize) this.pageSize = state.pageSize;
            if (state.pageIndex) this.pageIndex = state.pageIndex;
            if (state.density) this.density = state.density;
            if (state.sortedColumn) this.sortedColumn = state.sortedColumn;
            if (state.sortDirection) this.sortDirection = state.sortDirection;
            if (state.lastModified) this.lastModified = state.lastModified;

            // Convert column states to ColumnViewState instances
            if (state.columns) {
                Object.entries(state.columns).forEach(([name, colState]) => {
                    this.columns[name] = new ColumnViewState(name, colState);
                });
            }
        }
    }

    // ==================== Column State Management ====================

    /**
     * Get state for a column (creates if doesn't exist)
     */
    getColumn(name: string): ColumnViewState {
        if (!this.columns[name]) {
            this.columns[name] = new ColumnViewState(name);
        }
        return this.columns[name];
    }

    /**
     * Check if column has any state set
     */
    hasColumnState(name: string): boolean {
        return this.columns[name]?.hasState() ?? false;
    }

    /**
     * Set column visibility
     */
    setColumnVisible(name: string, visible: boolean): void {
        this.getColumn(name).setVisible(visible);
        this.markModified();
    }

    /**
     * Get effective visibility for a column
     * @param name Column name
     * @param defaultVisible Default from ColumnConfiguration
     */
    getEffectiveVisibility(name: string, defaultVisible: boolean): boolean {
        const state = this.columns[name];
        return state?.visible ?? defaultVisible;
    }

    /**
     * Set column order
     */
    setColumnOrder(name: string, order: number): void {
        this.getColumn(name).setOrder(order);
        this.markModified();
    }

    /**
     * Set column width
     */
    setColumnWidth(name: string, width: number): void {
        this.getColumn(name).setWidth(width);
        this.markModified();
    }

    /**
     * Reset state for a specific column
     */
    resetColumn(name: string): void {
        if (this.columns[name]) {
            this.columns[name].reset();
        }
        this.markModified();
    }

    /**
     * Reset all state to defaults
     */
    resetAll(): void {
        this.columns = {};
        this.globalFilter = undefined;
        this.pageSize = undefined;
        this.pageIndex = undefined;
        this.density = undefined;
        this.sortedColumn = undefined;
        this.sortDirection = undefined;
        this.markModified();
    }

    // ==================== Computed State ====================

    /**
     * Get visible column names based on current state
     * @param allColumnNames All available column names
     * @param defaultVisibility Default visibility from config
     */
    getVisibleColumnNames(
        allColumnNames: string[],
        defaultVisibility: Record<string, boolean>
    ): string[] {
        return allColumnNames.filter(name => {
            const state = this.columns[name];
            if (state?.visible !== undefined) {
                return state.visible;
            }
            return defaultVisibility[name] ?? true;
        });
    }

    /**
     * Get ordered column names based on current state
     * @param allColumnNames All available column names
     * @param defaultOrder Default order from config
     */
    getOrderedColumnNames(
        allColumnNames: string[],
        defaultOrder: Record<string, number>
    ): string[] {
        return [...allColumnNames].sort((a, b) => {
            const aOrder = this.columns[a]?.order ?? defaultOrder[a] ?? 0;
            const bOrder = this.columns[b]?.order ?? defaultOrder[b] ?? 0;
            return aOrder - bOrder;
        });
    }

    // ==================== Persistence ====================

    private markModified(): void {
        this.lastModified = Date.now();
    }

    /**
     * Get storage key for this state
     */
    private getStorageKey(): string {
        const base = VIEW_STATE_PREFIX + this.className;
        return this.sessionId ? `${base}_${this.sessionId}` : base;
    }

    /**
     * Save state to localStorage
     */
    save(): void {
        try {
            localStorage.setItem(this.getStorageKey(), JSON.stringify(this.toJSON()));
        } catch (e) {
            console.warn('[TableViewState] Failed to save:', e);
        }
    }

    /**
     * Load state from localStorage
     */
    static load(className: string, sessionId?: string): TableViewState {
        try {
            const key = VIEW_STATE_PREFIX + className + (sessionId ? `_${sessionId}` : '');
            const saved = localStorage.getItem(key);
            if (saved) {
                return new TableViewState(className, JSON.parse(saved));
            }
        } catch (e) {
            console.warn('[TableViewState] Failed to load:', e);
        }
        return new TableViewState(className, { sessionId });
    }

    /**
     * Delete saved state
     */
    static delete(className: string, sessionId?: string): void {
        try {
            const key = VIEW_STATE_PREFIX + className + (sessionId ? `_${sessionId}` : '');
            localStorage.removeItem(key);
        } catch (e) {
            console.warn('[TableViewState] Failed to delete:', e);
        }
    }

    /**
     * Check if state exists in storage
     */
    static exists(className: string, sessionId?: string): boolean {
        try {
            const key = VIEW_STATE_PREFIX + className + (sessionId ? `_${sessionId}` : '');
            return localStorage.getItem(key) !== null;
        } catch {
            return false;
        }
    }

    /**
     * Serialize to plain object for storage
     */
    toJSON(): ITableViewState {
        const columnsJson: Record<string, IColumnViewState> = {};

        Object.entries(this.columns).forEach(([name, col]) => {
            if (col.hasState()) {
                columnsJson[name] = col.toJSON();
            }
        });

        return {
            className: this.className,
            sessionId: this.sessionId,
            columns: columnsJson,
            globalFilter: this.globalFilter,
            pageSize: this.pageSize,
            pageIndex: this.pageIndex,
            density: this.density,
            sortedColumn: this.sortedColumn,
            sortDirection: this.sortDirection,
            lastModified: this.lastModified
        };
    }
}
