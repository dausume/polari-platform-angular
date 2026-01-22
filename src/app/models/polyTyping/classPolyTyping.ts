import { objectIdentifiersSpec } from "../objectIdentifiersSpec";
import { variablePolyTyping } from "./variablePolyTyping";

/**
 * Configuration flags that control how a class behaves in the Polari framework.
 * These flags determine UI behavior like whether edit/create buttons should be shown.
 */
export interface ClassConfig {
    /** Whether the class definition can be edited via API (add/remove variables, rename) */
    allowClassEdit: boolean;
    /** Whether this class is available in No-Code State-Space environments */
    isStateSpaceObject: boolean;
    /** Whether this class is excluded from CRUDE API (True = no CRUDE endpoints) */
    excludeFromCRUDE: boolean;
    /** Whether this is a dynamically created class (vs core framework class) */
    isDynamicClass: boolean;
}

/**
 * Default configuration when config is EXPLICITLY provided but incomplete.
 * These are protective defaults for core/baseline objects.
 */
export const DEFAULT_CLASS_CONFIG: ClassConfig = {
    allowClassEdit: false,
    isStateSpaceObject: false,
    excludeFromCRUDE: true,
    isDynamicClass: false
};

/**
 * Permissive configuration for backwards compatibility.
 * Used when NO config is provided at all (legacy classes without explicit config).
 * This ensures existing functionality continues to work until backend provides config.
 */
export const PERMISSIVE_CLASS_CONFIG: ClassConfig = {
    allowClassEdit: false,
    isStateSpaceObject: false,
    excludeFromCRUDE: false,  // Allow CRUD operations by default for backwards compat
    isDynamicClass: false
};

export class classPolyTyping {
    //The original class name as it is in the python-polari backend.
    className: string;
    //The displayable version of the class name.
    displayClassName?: string;
    //A list of just the names of the variables.
    variableNames?: string[];
    //A list of the objectIdentifiersSpec for the polyTypedVariable instances belonging to this class.
    polyTypedVars?: objectIdentifiersSpec[];
    //A list of variablePolyTyping instances belonging to this class.
    completeVariableTypingData: object = {};
    //A dictionary for quickly accessing the type that should be used to display the variable's data as on the frontend.
    //format: {"varName":"typeToBeDisplayedAs"}
    variableTypes?: {};
    /** Configuration flags controlling UI behavior and API access for this class */
    config: ClassConfig;

    constructor(
        className: string,
        completeVariableTypingData: object = {},
        displayClassName?: string,
        variableNames?: string[],
        polyTypedVars?: objectIdentifiersSpec[],
        variableTypes?: object,
        config?: Partial<ClassConfig>
    ) {
        this.className = className;
        this.displayClassName = displayClassName;
        //this.polyTypedVars = polyTypedVars;
        this.variableTypes = variableTypes;
        //Contains a list of all polyTypedVar objects
        this.completeVariableTypingData = completeVariableTypingData;
        if(variableNames == undefined)
        {
            this.variableNames = Object.keys(this.completeVariableTypingData);
        }
        else
        {
            this.variableNames = variableNames;
        }
        // Config handling:
        // - If config is explicitly provided (even partially), use protective defaults for missing fields
        // - If NO config provided at all, use permissive defaults for backwards compatibility
        // This ensures existing classes without explicit config continue to work as before
        if (config !== undefined && config !== null) {
            // Config was explicitly provided - use protective defaults for any missing fields
            this.config = { ...DEFAULT_CLASS_CONFIG, ...config };
        } else {
            // No config provided - use permissive defaults for backwards compatibility
            this.config = { ...PERMISSIVE_CLASS_CONFIG };
        }
    }

    /**
     * Check if instances of this class can be created through the UI.
     * For backwards compatibility: if excludeFromCRUDE is false, allow creation.
     * When config is explicitly set from backend, additional restrictions may apply.
     */
    canCreateInstances(): boolean {
        // If excluded from CRUDE, can't create
        if (this.config.excludeFromCRUDE) {
            return false;
        }
        // If explicitly marked as dynamic or state-space, definitely can create
        if (this.config.isDynamicClass || this.config.isStateSpaceObject) {
            return true;
        }
        // For backwards compatibility: if not excluded from CRUDE, allow creation
        // (This handles legacy classes without explicit config)
        return true;
    }

    /** Check if instances of this class can be edited through the UI */
    canEditInstances(): boolean {
        // Can edit if has CRUDE endpoints (PUT/UPDATE)
        return !this.config.excludeFromCRUDE;
    }

    /** Check if instances of this class can be deleted through the UI */
    canDeleteInstances(): boolean {
        // Can delete if has CRUDE endpoints (DELETE)
        return !this.config.excludeFromCRUDE;
    }

    /** Check if the class definition itself can be edited (add/remove variables) */
    canEditClassDefinition(): boolean {
        return this.config.allowClassEdit;
    }

    /** Check if this class should appear in No-Code/State-Space environments */
    isAvailableInStateSpace(): boolean {
        return this.config.isStateSpaceObject;
    }
}