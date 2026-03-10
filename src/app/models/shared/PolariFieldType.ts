/**
 * PolariFieldType.ts
 *
 * Single source of truth for field/variable data types across the platform.
 * Normalizes Python backend types, provides icons, filter options, input types,
 * and display hints so every component renders consistently.
 *
 * Usage:
 *   const norm = normalizeDataType('int');        // → 'number'
 *   const icon = getFieldTypeIcon('number');      // → '#'
 *   const opts = getFilterOptionsForFieldType('number');
 *   const inp  = getInputTypeForFieldType('number'); // → 'number'
 */

// ─── Canonical Field Types ───────────────────────────────────────────────────
// These are the normalized types the frontend works with.
// Everything from the backend gets mapped to one of these.

export type CanonicalFieldType =
    | 'string'
    | 'number'
    | 'boolean'
    | 'date'
    | 'datetime'
    | 'list'
    | 'dict'
    | 'reference'
    | 'uuid'
    | 'unknown';

// ─── Type Normalization ──────────────────────────────────────────────────────
// Maps every known Python / backend / legacy type string to a canonical type.

const TYPE_NORMALIZATION_MAP: Record<string, CanonicalFieldType> = {
    // String
    'str':       'string',
    'string':    'string',
    'text':      'string',
    'varchar':   'string',
    'char':      'string',
    'email':     'string',
    'url':       'string',

    // Number
    'int':       'number',
    'integer':   'number',
    'float':     'number',
    'double':    'number',
    'number':    'number',
    'decimal':   'number',
    'numeric':   'number',
    'currency':  'number',
    'percent':   'number',

    // Boolean
    'bool':      'boolean',
    'boolean':   'boolean',

    // Date / DateTime
    'date':      'date',
    'datetime':  'datetime',
    'timestamp': 'datetime',
    'time':      'datetime',

    // Collections
    'list':       'list',
    'array':      'list',
    'polarilist': 'list',
    'polariList': 'list',

    'dict':       'dict',
    'object':     'dict',
    'polaridict': 'dict',
    'polariDict': 'dict',
    'map':        'dict',

    // Identity
    'uuid':       'uuid',

    // Reference (CLASS-ClassName-REFERENCE pattern handled separately)
    'reference':  'reference',
};

/**
 * Normalize any backend / Python type string to a canonical field type.
 *
 * Handles:
 *  - Direct map lookup (case-insensitive)
 *  - CLASS-*-REFERENCE patterns → 'reference'
 *  - Substring heuristics for compound type strings (e.g. "BigInteger")
 */
export function normalizeDataType(rawType: string | undefined | null): CanonicalFieldType {
    if (!rawType) return 'unknown';

    const lower = rawType.toLowerCase().trim();

    // Direct lookup
    if (TYPE_NORMALIZATION_MAP[lower]) {
        return TYPE_NORMALIZATION_MAP[lower];
    }

    // CLASS-ClassName-REFERENCE pattern
    if (rawType.startsWith('CLASS-')) {
        return 'reference';
    }

    // Substring heuristics for compound types
    if (lower.includes('int') || lower.includes('float') || lower.includes('number') || lower.includes('decimal') || lower.includes('numeric')) {
        return 'number';
    }
    if (lower.includes('bool')) {
        return 'boolean';
    }
    if (lower.includes('datetime') || lower.includes('timestamp')) {
        return 'datetime';
    }
    if (lower.includes('date')) {
        return 'date';
    }
    if (lower.includes('time')) {
        return 'datetime';
    }
    if (lower.includes('list') || lower.includes('array')) {
        return 'list';
    }
    if (lower.includes('dict') || lower.includes('map')) {
        return 'dict';
    }

    return 'unknown';
}

/**
 * Normalize a type from classTypeData (polyTyping dict).
 * classTypeData shape: { fieldName: { variablePythonType: 'int', ... } }
 */
export function normalizeFieldFromClassTypeData(fieldInfo: any): CanonicalFieldType {
    if (!fieldInfo || typeof fieldInfo !== 'object') return 'unknown';
    return normalizeDataType(
        fieldInfo.variablePythonType || fieldInfo.type || null
    );
}

// ─── Type Icons ──────────────────────────────────────────────────────────────

const FIELD_TYPE_ICONS: Record<CanonicalFieldType, string> = {
    'string':    'T',
    'number':    '#',
    'boolean':   '✓',
    'date':      '📅',
    'datetime':  '🕐',
    'list':      '[]',
    'dict':      '{}',
    'reference': '→',
    'uuid':      '🔑',
    'unknown':   '◆',
};

/**
 * Get the icon character for a canonical field type.
 * Also accepts raw backend types (normalizes first).
 */
export function getFieldTypeIcon(typeOrRaw: string): string {
    const canonical = normalizeDataType(typeOrRaw);
    return FIELD_TYPE_ICONS[canonical] || '◆';
}

// ─── Type Labels ─────────────────────────────────────────────────────────────

const FIELD_TYPE_LABELS: Record<CanonicalFieldType, string> = {
    'string':    'String',
    'number':    'Number',
    'boolean':   'Boolean',
    'date':      'Date',
    'datetime':  'Date & Time',
    'list':      'List',
    'dict':      'Dictionary',
    'reference': 'Reference',
    'uuid':      'UUID',
    'unknown':   'Unknown',
};

export function getFieldTypeLabel(typeOrRaw: string): string {
    const canonical = normalizeDataType(typeOrRaw);
    return FIELD_TYPE_LABELS[canonical] || 'Unknown';
}

// ─── Type Badge Colors ───────────────────────────────────────────────────────

const FIELD_TYPE_COLORS: Record<CanonicalFieldType, string> = {
    'string':    '#388e3c',
    'number':    '#1976d2',
    'boolean':   '#7b1fa2',
    'date':      '#e64a19',
    'datetime':  '#e64a19',
    'list':      '#00838f',
    'dict':      '#5d4037',
    'reference': '#f57c00',
    'uuid':      '#78909c',
    'unknown':   '#78909c',
};

export function getFieldTypeBadgeColor(typeOrRaw: string): string {
    const canonical = normalizeDataType(typeOrRaw);
    return FIELD_TYPE_COLORS[canonical] || '#78909c';
}

// ─── Filter Options ──────────────────────────────────────────────────────────

export const STRING_FILTER_OPTIONS = [
    'equals', 'notEquals',
    'contains', 'notContains',
    'startsWith', 'endsWith',
    'regexMatch',
    'isNull', 'isNotNull'
] as const;

export const NUMBER_FILTER_OPTIONS = [
    'equals', 'notEquals',
    'greaterThan', 'lessThan',
    'greaterThanOrEqual', 'lessThanOrEqual',
    'inRange', 'notInRange',
    'isNull', 'isNotNull'
] as const;

export const BOOLEAN_FILTER_OPTIONS = [
    'isTrue', 'isFalse',
    'isNull', 'isNotNull'
] as const;

export const DATE_FILTER_OPTIONS = [
    'equals', 'notEquals',
    'greaterThan', 'lessThan',
    'greaterThanOrEqual', 'lessThanOrEqual',
    'inRange', 'notInRange',
    'isNull', 'isNotNull'
] as const;

export const LIST_FILTER_OPTIONS = [
    'contains',
    'notContains',
    'isNull', 'isNotNull'
] as const;

export const REFERENCE_FILTER_OPTIONS = [
    'equals', 'notEquals',
    'isNull', 'isNotNull'
] as const;

export const IDENTITY_FILTER_OPTIONS = [
    'equals', 'notEquals',
    'isNull', 'isNotNull'
] as const;

const FILTER_OPTIONS_MAP: Record<CanonicalFieldType, readonly string[]> = {
    'string':    STRING_FILTER_OPTIONS,
    'number':    NUMBER_FILTER_OPTIONS,
    'boolean':   BOOLEAN_FILTER_OPTIONS,
    'date':      DATE_FILTER_OPTIONS,
    'datetime':  DATE_FILTER_OPTIONS,
    'list':      LIST_FILTER_OPTIONS,
    'dict':      LIST_FILTER_OPTIONS,
    'reference': REFERENCE_FILTER_OPTIONS,
    'uuid':      IDENTITY_FILTER_OPTIONS,
    'unknown':   STRING_FILTER_OPTIONS,    // Fall back to string filters
};

/**
 * Get the available filter operations for a field type.
 * Accepts either canonical types or raw backend types.
 */
export function getFilterOptionsForFieldType(typeOrRaw: string): readonly string[] {
    const canonical = normalizeDataType(typeOrRaw);
    return FILTER_OPTIONS_MAP[canonical] || STRING_FILTER_OPTIONS;
}

// ─── Filter Type Metadata ────────────────────────────────────────────────────

export interface FilterTypeMeta {
    label: string;
    requiresValue: boolean;
    requiresRange: boolean;
}

const FILTER_TYPE_META: Record<string, FilterTypeMeta> = {
    'equals':              { label: 'Equals',                requiresValue: true,  requiresRange: false },
    'notEquals':           { label: 'Not Equals',            requiresValue: true,  requiresRange: false },
    'contains':            { label: 'Contains',              requiresValue: true,  requiresRange: false },
    'notContains':         { label: 'Does Not Contain',      requiresValue: true,  requiresRange: false },
    'startsWith':          { label: 'Starts With',           requiresValue: true,  requiresRange: false },
    'endsWith':            { label: 'Ends With',             requiresValue: true,  requiresRange: false },
    'regexMatch':          { label: 'Regex Match',           requiresValue: true,  requiresRange: false },
    'greaterThan':         { label: 'Greater Than',          requiresValue: true,  requiresRange: false },
    'lessThan':            { label: 'Less Than',             requiresValue: true,  requiresRange: false },
    'greaterThanOrEqual':  { label: 'Greater or Equal',      requiresValue: true,  requiresRange: false },
    'lessThanOrEqual':     { label: 'Less or Equal',         requiresValue: true,  requiresRange: false },
    'inRange':             { label: 'In Range',              requiresValue: false, requiresRange: true },
    'notInRange':          { label: 'Not In Range',          requiresValue: false, requiresRange: true },
    'excludeRange':        { label: 'Exclude Range',         requiresValue: false, requiresRange: true },
    'isTrue':              { label: 'Is True',               requiresValue: false, requiresRange: false },
    'isFalse':             { label: 'Is False',              requiresValue: false, requiresRange: false },
    'isNull':              { label: 'Is Null',               requiresValue: false, requiresRange: false },
    'isNotNull':           { label: 'Is Not Null',           requiresValue: false, requiresRange: false },
    'noop':                { label: 'No Operation',          requiresValue: false, requiresRange: false },
};

/**
 * Get metadata for a filter type (label, whether it needs a value or range).
 */
export function getFilterTypeMeta(filterType: string): FilterTypeMeta {
    return FILTER_TYPE_META[filterType] || { label: filterType, requiresValue: true, requiresRange: false };
}

// ─── HTML Input Types ────────────────────────────────────────────────────────

const INPUT_TYPE_MAP: Record<CanonicalFieldType, string> = {
    'string':    'text',
    'number':    'number',
    'boolean':   'text',     // Typically rendered as toggle/checkbox, not input
    'date':      'date',
    'datetime':  'datetime-local',
    'list':      'text',
    'dict':      'text',
    'reference': 'text',
    'uuid':      'text',
    'unknown':   'text',
};

/**
 * Get the HTML input type for a field type.
 */
export function getInputTypeForFieldType(typeOrRaw: string): string {
    const canonical = normalizeDataType(typeOrRaw);
    return INPUT_TYPE_MAP[canonical] || 'text';
}

// ─── Column Defaults ─────────────────────────────────────────────────────────

export type ColumnAlignment = 'left' | 'center' | 'right';

const ALIGNMENT_MAP: Record<CanonicalFieldType, ColumnAlignment> = {
    'string':    'left',
    'number':    'right',
    'boolean':   'center',
    'date':      'center',
    'datetime':  'center',
    'list':      'left',
    'dict':      'left',
    'reference': 'left',
    'uuid':      'left',
    'unknown':   'left',
};

export function getDefaultAlignment(typeOrRaw: string): ColumnAlignment {
    const canonical = normalizeDataType(typeOrRaw);
    return ALIGNMENT_MAP[canonical] || 'left';
}

/**
 * Whether a field type is sortable in a table context.
 */
export function isSortableType(typeOrRaw: string): boolean {
    const canonical = normalizeDataType(typeOrRaw);
    return !['list', 'dict', 'unknown'].includes(canonical);
}

/**
 * Whether a field type is filterable in a table/dataset context.
 */
export function isFilterableType(typeOrRaw: string): boolean {
    const canonical = normalizeDataType(typeOrRaw);
    return !['list', 'dict', 'unknown'].includes(canonical);
}

// ─── Convenience: Detect all fields from classTypeData ───────────────────────

export interface DetectedField {
    name: string;
    canonicalType: CanonicalFieldType;
    rawType: string;
    icon: string;
    label: string;
    badgeColor: string;
}

/**
 * Detect and normalize all fields from a classTypeData dict.
 * Skips fields starting with '_'.
 */
export function detectFieldsFromClassTypeData(classTypeData: any): DetectedField[] {
    if (!classTypeData || typeof classTypeData !== 'object') return [];

    const fields: DetectedField[] = [];
    for (const key of Object.keys(classTypeData)) {
        if (key.startsWith('_')) continue;

        const fieldInfo = classTypeData[key];
        const rawType = fieldInfo?.variablePythonType || fieldInfo?.type || 'unknown';
        const canonical = normalizeDataType(rawType);

        fields.push({
            name: key,
            canonicalType: canonical,
            rawType: rawType,
            icon: FIELD_TYPE_ICONS[canonical],
            label: FIELD_TYPE_LABELS[canonical],
            badgeColor: FIELD_TYPE_COLORS[canonical],
        });
    }

    return fields;
}
