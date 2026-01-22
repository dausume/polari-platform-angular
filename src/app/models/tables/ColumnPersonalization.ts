/**
 * ColumnPersonalization.ts
 *
 * PERSISTENT USER PREFERENCES for table columns.
 * These are saved preferences that persist across sessions.
 *
 * PERSONALIZATION vs VIEW STATE:
 * ==============================
 *
 * ColumnPersonalization (This file):
 * - Persistent user preferences
 * - Stored long-term (localStorage with user ID)
 * - Things like: preferred column visibility defaults, preferred widths,
 *   custom display names, favorite columns, etc.
 * - Survives page refresh/session end
 *
 * ColumnViewState:
 * - Current runtime state
 * - Session-based or short-lived
 * - Things like: current visibility, current sort, current page
 * - May or may not persist across sessions
 *
 * FLOW:
 * =====
 * 1. ColumnConfiguration sets TEMPLATE defaults (admin-controlled)
 * 2. ColumnPersonalization overrides with USER PREFERENCES (persistent)
 * 3. ColumnViewState tracks CURRENT STATE (runtime/session)
 *
 * Example:
 * - Config: visible=true (admin default)
 * - Personalization: preferHidden=true (user always wants this hidden)
 * - ViewState: visible=true (user temporarily showing it this session)
 */

/**
 * User preferences for a single column
 */
export interface IColumnPersonalization {
    /** Column name this applies to */
    name: string;

    /**
     * User's preferred default visibility
     * - true: User prefers this column visible by default
     * - false: User prefers this column hidden by default
     * - undefined: Use ColumnConfiguration default
     */
    preferVisible?: boolean;

    /**
     * User's preferred width
     * Remembered across sessions
     */
    preferredWidth?: number;

    /**
     * User's preferred order position
     * Remembered across sessions
     */
    preferredOrder?: number;

    /**
     * User's preferred pinned state
     */
    preferredPinned?: 'left' | 'right' | false;

    /**
     * User's custom display name override
     */
    customDisplayName?: string;

    /**
     * Mark this column as a "favorite" for quick access
     */
    isFavorite?: boolean;

    /**
     * User notes about this column
     */
    notes?: string;
}

/**
 * Storage key prefix for personalization
 */
const PERSONALIZATION_PREFIX = 'table_prefs_';

/**
 * Column personalization class
 */
export class ColumnPersonalization implements IColumnPersonalization {
    name: string;
    preferVisible?: boolean;
    preferredWidth?: number;
    preferredOrder?: number;
    preferredPinned?: 'left' | 'right' | false;
    customDisplayName?: string;
    isFavorite?: boolean;
    notes?: string;

    constructor(name: string, prefs?: Partial<IColumnPersonalization>) {
        this.name = name;
        if (prefs) {
            Object.assign(this, prefs);
        }
    }

    /**
     * Check if any preferences have been set
     */
    hasPreferences(): boolean {
        return (
            this.preferVisible !== undefined ||
            this.preferredWidth !== undefined ||
            this.preferredOrder !== undefined ||
            this.preferredPinned !== undefined ||
            this.customDisplayName !== undefined ||
            this.isFavorite !== undefined ||
            this.notes !== undefined
        );
    }

    /**
     * Reset all preferences to undefined (use defaults)
     */
    reset(): void {
        this.preferVisible = undefined;
        this.preferredWidth = undefined;
        this.preferredOrder = undefined;
        this.preferredPinned = undefined;
        this.customDisplayName = undefined;
        this.isFavorite = undefined;
        this.notes = undefined;
    }

    /**
     * Serialize to plain object for storage
     */
    toJSON(): IColumnPersonalization {
        const json: IColumnPersonalization = { name: this.name };

        if (this.preferVisible !== undefined) json.preferVisible = this.preferVisible;
        if (this.preferredWidth !== undefined) json.preferredWidth = this.preferredWidth;
        if (this.preferredOrder !== undefined) json.preferredOrder = this.preferredOrder;
        if (this.preferredPinned !== undefined) json.preferredPinned = this.preferredPinned;
        if (this.customDisplayName !== undefined) json.customDisplayName = this.customDisplayName;
        if (this.isFavorite !== undefined) json.isFavorite = this.isFavorite;
        if (this.notes !== undefined) json.notes = this.notes;

        return json;
    }
}

/**
 * Complete table personalization interface
 */
export interface ITablePersonalization {
    /** Class name this applies to */
    className: string;

    /** User identifier */
    userId?: string;

    /** Column preferences by column name */
    columns: Record<string, IColumnPersonalization>;

    /** User's preferred page size */
    preferredPageSize?: number;

    /** User's preferred density */
    preferredDensity?: 'compact' | 'standard' | 'comfortable';

    /** Whether to remember filter values */
    rememberFilters?: boolean;

    /** Whether to remember sort settings */
    rememberSort?: boolean;

    /** User's theme preference for this table */
    theme?: 'light' | 'dark' | 'system';

    /** Last modified timestamp */
    lastModified: number;
}

/**
 * Table personalization class - manages all user preferences for a table
 */
export class TablePersonalization implements ITablePersonalization {
    className: string;
    userId?: string;
    columns: Record<string, ColumnPersonalization> = {};
    preferredPageSize?: number;
    preferredDensity?: 'compact' | 'standard' | 'comfortable';
    rememberFilters?: boolean;
    rememberSort?: boolean;
    theme?: 'light' | 'dark' | 'system';
    lastModified: number = Date.now();

    constructor(className: string, prefs?: Partial<ITablePersonalization>) {
        this.className = className;

        if (prefs) {
            if (prefs.userId) this.userId = prefs.userId;
            if (prefs.preferredPageSize) this.preferredPageSize = prefs.preferredPageSize;
            if (prefs.preferredDensity) this.preferredDensity = prefs.preferredDensity;
            if (prefs.rememberFilters !== undefined) this.rememberFilters = prefs.rememberFilters;
            if (prefs.rememberSort !== undefined) this.rememberSort = prefs.rememberSort;
            if (prefs.theme) this.theme = prefs.theme;
            if (prefs.lastModified) this.lastModified = prefs.lastModified;

            if (prefs.columns) {
                Object.entries(prefs.columns).forEach(([name, colPrefs]) => {
                    this.columns[name] = new ColumnPersonalization(name, colPrefs);
                });
            }
        }
    }

    // ==================== Column Preferences ====================

    /**
     * Get preferences for a column (creates if doesn't exist)
     */
    getColumn(name: string): ColumnPersonalization {
        if (!this.columns[name]) {
            this.columns[name] = new ColumnPersonalization(name);
        }
        return this.columns[name];
    }

    /**
     * Check if column has any preferences
     */
    hasColumnPreferences(name: string): boolean {
        return this.columns[name]?.hasPreferences() ?? false;
    }

    /**
     * Set preferred visibility for a column
     */
    setPreferredVisibility(name: string, preferVisible: boolean): void {
        this.getColumn(name).preferVisible = preferVisible;
        this.markModified();
    }

    /**
     * Set preferred width for a column
     */
    setPreferredWidth(name: string, width: number): void {
        this.getColumn(name).preferredWidth = width;
        this.markModified();
    }

    /**
     * Toggle favorite status
     */
    toggleFavorite(name: string): void {
        const col = this.getColumn(name);
        col.isFavorite = !col.isFavorite;
        this.markModified();
    }

    /**
     * Get favorite columns
     */
    getFavoriteColumns(): string[] {
        return Object.entries(this.columns)
            .filter(([_, col]) => col.isFavorite)
            .map(([name, _]) => name);
    }

    /**
     * Reset preferences for a specific column
     */
    resetColumn(name: string): void {
        if (this.columns[name]) {
            this.columns[name].reset();
        }
        this.markModified();
    }

    /**
     * Reset all preferences
     */
    resetAll(): void {
        this.columns = {};
        this.preferredPageSize = undefined;
        this.preferredDensity = undefined;
        this.rememberFilters = undefined;
        this.rememberSort = undefined;
        this.theme = undefined;
        this.markModified();
    }

    // ==================== Persistence ====================

    private markModified(): void {
        this.lastModified = Date.now();
    }

    private getStorageKey(): string {
        const base = PERSONALIZATION_PREFIX + this.className;
        return this.userId ? `${base}_${this.userId}` : base;
    }

    /**
     * Save preferences to localStorage
     */
    save(): void {
        try {
            localStorage.setItem(this.getStorageKey(), JSON.stringify(this.toJSON()));
        } catch (e) {
            console.warn('[TablePersonalization] Failed to save:', e);
        }
    }

    /**
     * Load preferences from localStorage
     */
    static load(className: string, userId?: string): TablePersonalization {
        try {
            const key = PERSONALIZATION_PREFIX + className + (userId ? `_${userId}` : '');
            const saved = localStorage.getItem(key);
            if (saved) {
                return new TablePersonalization(className, JSON.parse(saved));
            }
        } catch (e) {
            console.warn('[TablePersonalization] Failed to load:', e);
        }
        return new TablePersonalization(className, { userId });
    }

    /**
     * Delete saved preferences
     */
    static delete(className: string, userId?: string): void {
        try {
            const key = PERSONALIZATION_PREFIX + className + (userId ? `_${userId}` : '');
            localStorage.removeItem(key);
        } catch (e) {
            console.warn('[TablePersonalization] Failed to delete:', e);
        }
    }

    /**
     * Serialize to plain object for storage
     */
    toJSON(): ITablePersonalization {
        const columnsJson: Record<string, IColumnPersonalization> = {};

        Object.entries(this.columns).forEach(([name, col]) => {
            if (col.hasPreferences()) {
                columnsJson[name] = col.toJSON();
            }
        });

        return {
            className: this.className,
            userId: this.userId,
            columns: columnsJson,
            preferredPageSize: this.preferredPageSize,
            preferredDensity: this.preferredDensity,
            rememberFilters: this.rememberFilters,
            rememberSort: this.rememberSort,
            theme: this.theme,
            lastModified: this.lastModified
        };
    }
}
