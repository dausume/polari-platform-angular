export interface FieldProfileDefinitionSummary {
    id: string;
    name: string;
    description: string;
    source_class: string;
}

/**
 * An own-field entry: controls whether a direct field on the class is included in API responses.
 */
export interface OwnFieldEntry {
    name: string;
    dataType: string;
    included: boolean;
}

/**
 * A single field within a referenced object's field profile entry.
 */
export interface ReferencedFieldEntry {
    name: string;
    dataType: string;
    included: boolean;
}

/**
 * A referenced object entry in the field profile.
 * Maps to a variable on the class that references another class (parent or other ref).
 */
export interface ReferencedObjectEntry {
    /** The variable name on the source class that holds the reference */
    varName: string;
    /** The class name being referenced */
    targetClass: string;
    /** How this reference was discovered: 'parent' (inheritsFrom) or 'reference' (refClass) */
    source: 'parent' | 'reference';
    /** Whether to resolve any fields from this reference at all */
    enabled: boolean;
    /** Individual field controls. If empty but enabled, resolves '*' (all). */
    fields: ReferencedFieldEntry[];
    /** Fields to exclude when resolving all */
    excludeFields: string[];
}

export class NamedFieldProfileConfig {
    id: string;
    name: string;
    description: string;
    source_class: string;

    /** Own fields on the immediate class — toggleable for API inclusion */
    ownFields: OwnFieldEntry[];

    /** Referenced objects and which of their fields to resolve */
    referencedObjects: ReferencedObjectEntry[];

    constructor(id: string, name: string, description: string, sourceClass: string) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.source_class = sourceClass;
        this.ownFields = [];
        this.referencedObjects = [];
    }

    toDefinitionJSON(): string {
        return JSON.stringify({
            ownFields: this.ownFields,
            referencedObjects: this.referencedObjects
        });
    }

    static fromBackend(backendObj: any): NamedFieldProfileConfig {
        const config = new NamedFieldProfileConfig(
            backendObj.id || '',
            backendObj.name || '',
            backendObj.description || '',
            backendObj.source_class || ''
        );

        if (backendObj.definition && backendObj.definition !== '{}') {
            try {
                const parsed = typeof backendObj.definition === 'string'
                    ? JSON.parse(backendObj.definition)
                    : backendObj.definition;

                config.ownFields = parsed.ownFields || [];
                config.referencedObjects = parsed.referencedObjects || [];
            } catch (e) {
                console.warn('[NamedFieldProfileConfig] Failed to parse definition:', e);
            }
        }

        return config;
    }

    /**
     * Initialize own fields from the class's variable typing data.
     * classTypeData = polyVarTyping[className], a dict of { varName: variablePolyTyping }
     */
    initializeOwnFields(classTypeData: any): void {
        if (!classTypeData || typeof classTypeData !== 'object') return;
        // Only re-initialize fields that aren't already present
        const existing = new Set(this.ownFields.map(f => f.name));
        for (const [varName, varInfo] of Object.entries(classTypeData)) {
            if (existing.has(varName)) continue;
            const info = varInfo as any;
            this.ownFields.push({
                name: varName,
                dataType: info?.variablePythonType || info?.variableFrontendType || 'string',
                included: true
            });
        }
    }

    /**
     * Discover referenced objects from classPolyTyping (inheritsFrom + reference-type vars).
     * classTypeData = polyVarTyping[className]
     * classPolyTypingObj = the classPolyTyping instance
     */
    initializeReferencedObjects(classTypeData: any, inheritsFrom?: Record<string, string>): void {
        const existing = new Set(this.referencedObjects.map(r => r.varName));

        // 1. Parent references from inheritsFrom
        if (inheritsFrom) {
            for (const [varName, parentClassName] of Object.entries(inheritsFrom)) {
                if (existing.has(varName)) continue;
                this.referencedObjects.push({
                    varName,
                    targetClass: parentClassName,
                    source: 'parent',
                    enabled: true,
                    fields: [],
                    excludeFields: []
                });
                existing.add(varName);
            }
        }

        // 2. Reference-type variables (CLASS-* types)
        if (classTypeData && typeof classTypeData === 'object') {
            for (const [varName, varInfo] of Object.entries(classTypeData)) {
                if (existing.has(varName)) continue;
                const info = varInfo as any;
                const pythonType: string = info?.variablePythonType || '';
                const refClass: string = info?.refClass || '';
                if (refClass || pythonType.startsWith('CLASS-')) {
                    const targetClass = refClass || extractClassFromPythonType(pythonType);
                    if (targetClass) {
                        this.referencedObjects.push({
                            varName,
                            targetClass,
                            source: 'reference',
                            enabled: false,
                            fields: [],
                            excludeFields: []
                        });
                        existing.add(varName);
                    }
                }
            }
        }
    }

    /**
     * Populate the fields array for a referenced object entry using the target class's typing data.
     * targetClassTypeData = polyVarTyping[targetClassName]
     */
    populateReferencedObjectFields(varName: string, targetClassTypeData: any): void {
        const refObj = this.referencedObjects.find(r => r.varName === varName);
        if (!refObj || !targetClassTypeData || typeof targetClassTypeData !== 'object') return;
        const existing = new Set(refObj.fields.map(f => f.name));
        for (const [fieldName, fieldInfo] of Object.entries(targetClassTypeData)) {
            if (existing.has(fieldName)) continue;
            const info = fieldInfo as any;
            refObj.fields.push({
                name: fieldName,
                dataType: info?.variablePythonType || info?.variableFrontendType || 'string',
                included: true
            });
        }
    }

    /**
     * Returns the set of all included field names in this profile.
     * Own fields as plain names, referenced fields as "varName.fieldName" dot-notation.
     */
    getIncludedFieldNames(): Set<string> {
        const fields = new Set<string>();
        for (const f of this.ownFields) {
            if (f.included) fields.add(f.name);
        }
        for (const ref of this.referencedObjects) {
            if (!ref.enabled) continue;
            for (const f of ref.fields) {
                if (f.included) fields.add(`${ref.varName}.${f.name}`);
            }
        }
        return fields;
    }

    /**
     * Check if this profile includes all the given field names.
     * Used for compatibility checking with filter chains.
     */
    includesAllFields(fieldNames: Set<string>): boolean {
        const included = this.getIncludedFieldNames();
        // Also add own-field names that are ref vars (they're usable as raw ID fields)
        for (const ref of this.referencedObjects) {
            const ownField = this.ownFields.find(f => f.name === ref.varName);
            if (ownField?.included) included.add(ref.varName);
        }
        for (const name of fieldNames) {
            if (!included.has(name)) return false;
        }
        return true;
    }
}

function extractClassFromPythonType(pythonType: string): string {
    // Format: "CLASS-ClassName-REFERENCE" or "CLASS-ClassName-IDs"
    if (!pythonType.startsWith('CLASS-')) return '';
    if (pythonType.endsWith('-REFERENCE')) {
        return pythonType.substring(6, pythonType.length - 10);
    }
    if (pythonType.endsWith('-IDs')) {
        return pythonType.substring(6, pythonType.length - 4);
    }
    return pythonType.substring(6);
}
