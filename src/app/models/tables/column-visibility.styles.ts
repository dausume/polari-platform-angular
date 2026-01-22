/**
 * column-visibility.styles.ts
 *
 * Centralized visibility styling definitions for table columns.
 * These styles tie directly to ColumnConfiguration.available and .visible properties.
 *
 * USAGE IN COMPONENTS:
 * ====================
 *
 * In your component template:
 * ```html
 * <!-- For visibility chips/toggles -->
 * <mat-chip
 *   [class]="getVisibilityChipClass(column)"
 *   [selected]="column.visible"
 *   (click)="toggleVisibility(column)">
 *   {{ column.displayName }}
 * </mat-chip>
 *
 * <!-- For table columns -->
 * <th [class]="getColumnHeaderClass(column)">{{ column.displayName }}</th>
 * ```
 *
 * In your component class:
 * ```typescript
 * import { VisibilityStyles } from '@models/tables/column-visibility.styles';
 *
 * getVisibilityChipClass(column: ColumnConfiguration): string {
 *   return VisibilityStyles.getChipClasses(column.available, column.visible);
 * }
 * ```
 *
 * In your component CSS:
 * ```css
 * @import '@models/tables/column-visibility.css';
 * // or copy the styles from VISIBILITY_CSS below
 * ```
 */

/**
 * CSS class names for visibility states
 */
export const VISIBILITY_CLASSES = {
    // Column availability (admin-controlled via X button)
    COLUMN_AVAILABLE: 'column-available',
    COLUMN_UNAVAILABLE: 'column-unavailable',

    // Column visibility (user-controlled toggle)
    COLUMN_VISIBLE: 'column-visible',
    COLUMN_HIDDEN: 'column-hidden',

    // Chip/toggle states
    CHIP_SELECTED: 'visibility-chip-selected',
    CHIP_UNSELECTED: 'visibility-chip-unselected',
    CHIP_DISABLED: 'visibility-chip-disabled',

    // Animation classes
    VISIBILITY_TRANSITION: 'visibility-transition',
    FADE_IN: 'column-fade-in',
    FADE_OUT: 'column-fade-out'
} as const;

/**
 * CSS styles that should be included in components using visibility toggles
 * Copy these into your component's CSS or create a shared stylesheet
 */
export const VISIBILITY_CSS = `
/* ============================================
   COLUMN VISIBILITY STYLES
   Ties to ColumnConfiguration.available and .visible
   ============================================ */

/* === Visibility Transition Animation === */
.visibility-transition {
    transition: opacity 0.2s ease-in-out,
                background-color 0.2s ease-in-out,
                border-color 0.2s ease-in-out,
                transform 0.2s ease-in-out;
}

/* === Column Available States === */
.column-available {
    opacity: 1;
}

.column-unavailable {
    opacity: 0.4;
    pointer-events: none;
    filter: grayscale(50%);
}

/* === Column Visibility States === */
.column-visible {
    opacity: 1;
}

.column-hidden {
    opacity: 0.6;
    background-color: rgba(0, 0, 0, 0.05);
}

/* === Visibility Chip/Toggle Styles === */
.visibility-chip-selected {
    background-color: #1976d2 !important;
    color: white !important;
    border: 2px solid #1565c0 !important;
    font-weight: 500;
}

.visibility-chip-selected:hover {
    background-color: #1565c0 !important;
}

.visibility-chip-unselected {
    background-color: #e0e0e0 !important;
    color: #616161 !important;
    border: 2px solid transparent !important;
}

.visibility-chip-unselected:hover {
    background-color: #bdbdbd !important;
    border-color: #9e9e9e !important;
}

.visibility-chip-disabled {
    background-color: #f5f5f5 !important;
    color: #9e9e9e !important;
    cursor: not-allowed !important;
    opacity: 0.5;
}

/* === Fade Animations === */
@keyframes columnFadeIn {
    from {
        opacity: 0;
        transform: translateY(-5px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes columnFadeOut {
    from {
        opacity: 1;
        transform: translateY(0);
    }
    to {
        opacity: 0;
        transform: translateY(5px);
    }
}

.column-fade-in {
    animation: columnFadeIn 0.2s ease-out forwards;
}

.column-fade-out {
    animation: columnFadeOut 0.2s ease-in forwards;
}

/* === Table Header Visibility States === */
th.column-visible {
    background-color: inherit;
}

th.column-hidden {
    background-color: rgba(0, 0, 0, 0.08);
    color: #757575;
}

/* === Table Cell Visibility States === */
td.column-visible {
    opacity: 1;
}

td.column-hidden {
    opacity: 0.5;
    color: #9e9e9e;
}

/* === Configuration Grid Item States === */
.config-item-available {
    border: 2px solid #4caf50;
    background-color: rgba(76, 175, 80, 0.1);
}

.config-item-unavailable {
    border: 2px dashed #9e9e9e;
    background-color: rgba(158, 158, 158, 0.1);
    opacity: 0.6;
}

.config-item-visible {
    border-color: #1976d2;
}

.config-item-hidden {
    border-color: #ff9800;
    background-color: rgba(255, 152, 0, 0.1);
}
`;

/**
 * Helper class for generating visibility-related CSS classes
 */
export class VisibilityStyles {

    /**
     * Get CSS classes for a visibility chip/toggle based on column state
     *
     * @param available - Is the column available (not removed via X)?
     * @param visible - Is the column visible in the table?
     * @param userCanHide - Can the user toggle visibility?
     * @returns Space-separated CSS class string
     */
    static getChipClasses(available: boolean, visible: boolean, userCanHide: boolean = true): string {
        const classes: string[] = [VISIBILITY_CLASSES.VISIBILITY_TRANSITION];

        if (!available) {
            classes.push(VISIBILITY_CLASSES.CHIP_DISABLED);
        } else if (!userCanHide) {
            classes.push(VISIBILITY_CLASSES.CHIP_DISABLED);
        } else if (visible) {
            classes.push(VISIBILITY_CLASSES.CHIP_SELECTED);
        } else {
            classes.push(VISIBILITY_CLASSES.CHIP_UNSELECTED);
        }

        return classes.join(' ');
    }

    /**
     * Get CSS classes for a table column header
     */
    static getColumnHeaderClasses(available: boolean, visible: boolean): string {
        const classes: string[] = [VISIBILITY_CLASSES.VISIBILITY_TRANSITION];

        if (!available) {
            classes.push(VISIBILITY_CLASSES.COLUMN_UNAVAILABLE);
        } else if (visible) {
            classes.push(VISIBILITY_CLASSES.COLUMN_AVAILABLE);
            classes.push(VISIBILITY_CLASSES.COLUMN_VISIBLE);
        } else {
            classes.push(VISIBILITY_CLASSES.COLUMN_AVAILABLE);
            classes.push(VISIBILITY_CLASSES.COLUMN_HIDDEN);
        }

        return classes.join(' ');
    }

    /**
     * Get CSS classes for a table cell
     */
    static getCellClasses(available: boolean, visible: boolean): string {
        if (!available) {
            return VISIBILITY_CLASSES.COLUMN_UNAVAILABLE;
        }
        return visible ? VISIBILITY_CLASSES.COLUMN_VISIBLE : VISIBILITY_CLASSES.COLUMN_HIDDEN;
    }

    /**
     * Get CSS classes for a configuration grid item
     */
    static getConfigItemClasses(available: boolean, visible: boolean): string {
        const classes: string[] = [VISIBILITY_CLASSES.VISIBILITY_TRANSITION];

        if (available) {
            classes.push('config-item-available');
            classes.push(visible ? 'config-item-visible' : 'config-item-hidden');
        } else {
            classes.push('config-item-unavailable');
        }

        return classes.join(' ');
    }

    /**
     * Get animation class for visibility change
     * Use this when toggling visibility to show a fade effect
     */
    static getAnimationClass(becomingVisible: boolean): string {
        return becomingVisible ? VISIBILITY_CLASSES.FADE_IN : VISIBILITY_CLASSES.FADE_OUT;
    }

    /**
     * Check if a column should be displayed based on its state
     */
    static shouldDisplay(available: boolean, visible: boolean): boolean {
        return available && visible;
    }

    /**
     * Check if a column should appear in the toggle list
     * (available columns that users can hide)
     */
    static shouldShowInToggleList(available: boolean, userCanHide: boolean): boolean {
        return available && userCanHide;
    }
}

/**
 * Angular directive-style class binding helper
 *
 * Use with [ngClass] for reactive class binding:
 * ```html
 * <mat-chip [ngClass]="visibilityBinding.getChipBinding(column)">
 * ```
 */
export class VisibilityClassBinding {

    /**
     * Get ngClass binding object for visibility chip
     */
    static getChipBinding(available: boolean, visible: boolean, userCanHide: boolean = true): Record<string, boolean> {
        return {
            [VISIBILITY_CLASSES.VISIBILITY_TRANSITION]: true,
            [VISIBILITY_CLASSES.CHIP_SELECTED]: available && userCanHide && visible,
            [VISIBILITY_CLASSES.CHIP_UNSELECTED]: available && userCanHide && !visible,
            [VISIBILITY_CLASSES.CHIP_DISABLED]: !available || !userCanHide
        };
    }

    /**
     * Get ngClass binding object for column header
     */
    static getHeaderBinding(available: boolean, visible: boolean): Record<string, boolean> {
        return {
            [VISIBILITY_CLASSES.VISIBILITY_TRANSITION]: true,
            [VISIBILITY_CLASSES.COLUMN_AVAILABLE]: available,
            [VISIBILITY_CLASSES.COLUMN_UNAVAILABLE]: !available,
            [VISIBILITY_CLASSES.COLUMN_VISIBLE]: available && visible,
            [VISIBILITY_CLASSES.COLUMN_HIDDEN]: available && !visible
        };
    }

    /**
     * Get ngClass binding object for table cell
     */
    static getCellBinding(available: boolean, visible: boolean): Record<string, boolean> {
        return {
            [VISIBILITY_CLASSES.COLUMN_VISIBLE]: available && visible,
            [VISIBILITY_CLASSES.COLUMN_HIDDEN]: available && !visible,
            [VISIBILITY_CLASSES.COLUMN_UNAVAILABLE]: !available
        };
    }
}
