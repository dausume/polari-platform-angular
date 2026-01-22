import { Type } from '@angular/core';

/**
 * Registry entry for a dashboard-compatible component
 */
export interface ComponentRegistryEntry {
    /** The Angular component class */
    component: Type<any>;

    /** Default input values for the component */
    defaultInputs?: Record<string, any>;

    /** Display name for the component */
    displayName?: string;

    /** Description of what the component does */
    description?: string;
}

/**
 * Registry mapping component names to their Angular component classes.
 * This enables dynamic component loading in the dashboard renderer.
 *
 * Components are registered lazily to avoid circular dependencies.
 * Use registerComponent() to add components after module initialization.
 */
class DisplayComponentRegistry {
    private registry: Map<string, ComponentRegistryEntry> = new Map();

    /**
     * Registers a component with the dashboard system
     */
    registerComponent(name: string, entry: ComponentRegistryEntry): void {
        this.registry.set(name, entry);
    }

    /**
     * Gets a component entry by name
     */
    getComponent(name: string): ComponentRegistryEntry | undefined {
        return this.registry.get(name);
    }

    /**
     * Checks if a component is registered
     */
    hasComponent(name: string): boolean {
        return this.registry.has(name);
    }

    /**
     * Gets all registered component names
     */
    getComponentNames(): string[] {
        return Array.from(this.registry.keys());
    }

    /**
     * Gets all registered components
     */
    getAllComponents(): Map<string, ComponentRegistryEntry> {
        return new Map(this.registry);
    }
}

/**
 * Singleton instance of the component registry
 */
export const DISPLAY_COMPONENT_REGISTRY = new DisplayComponentRegistry();

/**
 * Helper function to register a component
 */
export function registerDisplayComponent(
    name: string,
    component: Type<any>,
    options?: {
        defaultInputs?: Record<string, any>;
        displayName?: string;
        description?: string;
    }
): void {
    DISPLAY_COMPONENT_REGISTRY.registerComponent(name, {
        component,
        defaultInputs: options?.defaultInputs || {},
        displayName: options?.displayName || name,
        description: options?.description
    });
}
