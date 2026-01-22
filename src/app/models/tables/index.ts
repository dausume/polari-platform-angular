/**
 * Table Configuration Models
 *
 * This module provides comprehensive table configuration for dynamic class tables.
 *
 * ARCHITECTURE:
 * =============
 *
 * Configuration (Template/Defaults):
 * ----------------------------------
 * - TableConfiguration: Main configuration class (composes all sub-configs)
 * - ColumnConfiguration: Per-column display and behavior settings
 *   - `available`: Admin controls if column exists in UI (X button)
 *   - `visible`: Default visibility for the column
 *   - `userCanHide`, `userCanReorder`: What users are allowed to change
 *
 * View State (Runtime State):
 * ---------------------------
 * - TableViewState: Current runtime state of the table
 * - ColumnViewState: Current state for a specific column
 *   - Stores current values for: visible, order, width, pinned
 *   - Applied on top of ColumnConfiguration defaults
 *
 * Sub-Configurations:
 * -------------------
 * - PaginationConfig: Page size and navigation settings
 * - FilterConfig: Search and filter settings
 * - SectionState: UI section expansion states
 *
 * USAGE EXAMPLE:
 * ==============
 * ```typescript
 * import {
 *   TableConfiguration,
 *   TableViewState,
 *   ColumnConfiguration
 * } from '@models/tables';
 *
 * // Load or create configuration (template/defaults)
 * const config = TableConfiguration.load('MyClassName');
 * config.initializeFromClassTypeData(classTypeData);
 *
 * // Load current view state
 * const viewState = TableViewState.load('MyClassName');
 *
 * // Get effective visible columns (config defaults + current state)
 * const visibleColumns = config.getVisibleColumns().filter(col => {
 *   return viewState.getEffectiveVisibility(col.name, col.visible);
 * });
 *
 * // User toggles a column
 * viewState.setColumnVisible('someColumn', false);
 * viewState.save();
 * ```
 *
 * AVAILABILITY vs VISIBILITY:
 * ===========================
 * - `available` (ColumnConfiguration): Admin-controlled. If false, column is
 *   completely removed from UI - cannot be toggled by users. Set via X button.
 *
 * - `visible` (ColumnConfiguration): Default visibility state. Can be overridden
 *   by view state if `userCanHide` is true.
 *
 * - `visible` (ColumnViewState): Current runtime visibility. Overrides config default.
 *
 * CSS Classes for visibility styling:
 * - `column-unavailable`: Column removed via X button (available=false)
 * - `column-hidden`: Column available but hidden (visible=false)
 * - `column-visible`: Column visible in table
 */

// Main configuration
export {
    TableConfiguration,
    ITableConfiguration,
    SortOrder,
    SortDirection,
    TableDensity,
    SelectionMode
} from './TableConfiguration';

// Column configuration (admin/template level)
export {
    ColumnConfiguration,
    IColumnConfiguration,
    ColumnFormat,
    ColumnAlignment
} from './ColumnConfiguration';

// Column view state (runtime/session state)
export {
    ColumnViewState,
    IColumnViewState,
    TableViewState,
    ITableViewState
} from './ColumnViewState';

// Column personalization (persistent user preferences)
export {
    ColumnPersonalization,
    IColumnPersonalization,
    TablePersonalization,
    ITablePersonalization
} from './ColumnPersonalization';

// Sub-configurations
export { PaginationConfig, IPaginationConfig, DEFAULT_PAGINATION } from './PaginationConfig';
export { FilterConfig, IFilterConfig, DEFAULT_FILTER } from './FilterConfig';
export { SectionState, ISectionState, DEFAULT_SECTIONS } from './SectionState';

// Visibility styling utilities
export {
    VISIBILITY_CLASSES,
    VISIBILITY_CSS,
    VisibilityStyles,
    VisibilityClassBinding
} from './column-visibility.styles';
