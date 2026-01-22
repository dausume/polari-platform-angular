/**
 * SectionState.ts
 * Configuration for collapsible section states in table UI
 */

/**
 * Section state interface
 */
export interface ISectionState {
    /** Whether the configuration/settings section is expanded */
    configExpanded: boolean;

    /** Whether the data table section is expanded */
    dataExpanded: boolean;

    /** Custom section expansion states by section name */
    customSections: Record<string, boolean>;
}

/**
 * Default section state values
 */
export const DEFAULT_SECTIONS: ISectionState = {
    configExpanded: false,
    dataExpanded: true,
    customSections: {}
};

/**
 * Section state class with utility methods
 */
export class SectionState implements ISectionState {
    configExpanded: boolean = false;
    dataExpanded: boolean = true;
    customSections: Record<string, boolean> = {};

    constructor(state?: Partial<ISectionState>) {
        if (state) {
            Object.assign(this, state);
            // Ensure customSections is a new object
            this.customSections = { ...(state.customSections || {}) };
        }
    }

    /**
     * Toggle a section's expansion state
     * @param sectionName - 'config', 'data', or custom section name
     */
    toggle(sectionName: string): void {
        switch (sectionName) {
            case 'config':
            case 'main': // Alias for backward compatibility
                this.configExpanded = !this.configExpanded;
                break;
            case 'data':
                this.dataExpanded = !this.dataExpanded;
                break;
            default:
                this.customSections[sectionName] = !this.isExpanded(sectionName);
        }
    }

    /**
     * Check if a section is expanded
     * @param sectionName - 'config', 'data', or custom section name
     */
    isExpanded(sectionName: string): boolean {
        switch (sectionName) {
            case 'config':
            case 'main': // Alias for backward compatibility
                return this.configExpanded;
            case 'data':
                return this.dataExpanded;
            default:
                return this.customSections[sectionName] ?? false;
        }
    }

    /**
     * Set a section's expansion state explicitly
     */
    setExpanded(sectionName: string, expanded: boolean): void {
        switch (sectionName) {
            case 'config':
            case 'main':
                this.configExpanded = expanded;
                break;
            case 'data':
                this.dataExpanded = expanded;
                break;
            default:
                this.customSections[sectionName] = expanded;
        }
    }

    /**
     * Expand all sections
     */
    expandAll(): void {
        this.configExpanded = true;
        this.dataExpanded = true;
        Object.keys(this.customSections).forEach(key => {
            this.customSections[key] = true;
        });
    }

    /**
     * Collapse all sections
     */
    collapseAll(): void {
        this.configExpanded = false;
        this.dataExpanded = false;
        Object.keys(this.customSections).forEach(key => {
            this.customSections[key] = false;
        });
    }

    /**
     * Register a custom section
     */
    registerSection(sectionName: string, defaultExpanded: boolean = false): void {
        if (!(sectionName in this.customSections)) {
            this.customSections[sectionName] = defaultExpanded;
        }
    }

    /**
     * Convert to legacy expandedSections array format
     * Used for backward compatibility with old TableConfig
     */
    toLegacyFormat(): string[] {
        const sections: string[] = [];
        if (this.configExpanded) sections.push('main');
        if (this.dataExpanded) sections.push('data');
        Object.entries(this.customSections).forEach(([name, expanded]) => {
            if (expanded) sections.push(name);
        });
        return sections;
    }

    /**
     * Create from legacy expandedSections array format
     */
    static fromLegacyFormat(expandedSections: string[]): SectionState {
        return new SectionState({
            configExpanded: expandedSections.includes('main'),
            dataExpanded: expandedSections.includes('data'),
            customSections: {}
        });
    }

    /**
     * Create from defaults
     */
    static createDefault(): SectionState {
        return new SectionState(DEFAULT_SECTIONS);
    }

    /**
     * Serialize to plain object
     */
    toJSON(): ISectionState {
        return {
            configExpanded: this.configExpanded,
            dataExpanded: this.dataExpanded,
            customSections: { ...this.customSections }
        };
    }
}
