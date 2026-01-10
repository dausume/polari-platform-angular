/**
 * NgRx Selectors for Dynamic Objects
 * Provides efficient access to dynamic object state
 */

import { createFeatureSelector, createSelector } from '@ngrx/store';
import { DynamicObjectsState } from '../reducers/dynamic-objects.reducer';

/**
 * Feature selector for dynamic objects state
 */
export const selectDynamicObjectsState = createFeatureSelector<DynamicObjectsState>('dynamicObjects');

/**
 * Create a selector for a specific class's instances (as array)
 */
export const selectClassInstancesArray = (className: string) => createSelector(
  selectDynamicObjectsState,
  (state: DynamicObjectsState) => {
    const classState = state[className];
    if (!classState || !classState.instances) {
      return [];
    }
    return Object.values(classState.instances);
  }
);

/**
 * Create a selector for a specific class's instances (as object/map)
 */
export const selectClassInstancesMap = (className: string) => createSelector(
  selectDynamicObjectsState,
  (state: DynamicObjectsState) => {
    return state[className]?.instances || {};
  }
);

/**
 * Create a selector for a specific instance
 */
export const selectInstance = (className: string, instanceId: string) => createSelector(
  selectDynamicObjectsState,
  (state: DynamicObjectsState) => {
    return state[className]?.instances?.[instanceId] || null;
  }
);

/**
 * Create a selector for a class's loading state
 */
export const selectClassLoading = (className: string) => createSelector(
  selectDynamicObjectsState,
  (state: DynamicObjectsState) => {
    return state[className]?.loading || false;
  }
);

/**
 * Create a selector for a class's error state
 */
export const selectClassError = (className: string) => createSelector(
  selectDynamicObjectsState,
  (state: DynamicObjectsState) => {
    return state[className]?.error || null;
  }
);

/**
 * Create a selector to check if a class has been loaded
 */
export const selectClassIsLoaded = (className: string) => createSelector(
  selectDynamicObjectsState,
  (state: DynamicObjectsState) => {
    return state[className]?.lastLoaded !== null && state[className]?.lastLoaded !== undefined;
  }
);

/**
 * Create a selector for the count of instances for a class
 */
export const selectClassInstanceCount = (className: string) => createSelector(
  selectClassInstancesArray(className),
  (instances) => instances.length
);

/**
 * Create a selector for all loaded class names
 */
export const selectLoadedClassNames = createSelector(
  selectDynamicObjectsState,
  (state: DynamicObjectsState) => {
    return Object.keys(state);
  }
);

/**
 * Create a selector for total instance count across all classes
 */
export const selectTotalInstanceCount = createSelector(
  selectDynamicObjectsState,
  (state: DynamicObjectsState) => {
    return Object.values(state).reduce((total, classState) => {
      return total + Object.keys(classState.instances || {}).length;
    }, 0);
  }
);
