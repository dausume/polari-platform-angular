/**
 * NgRx Reducer for Dynamic Object Management
 * Manages state for any object type dynamically
 */

import { createReducer, on } from '@ngrx/store';
import { DynamicObjectsActions } from '../actions/dynamic-objects.actions';

/**
 * State structure for a single class type
 */
export interface ClassInstancesState {
  instances: { [instanceId: string]: any };  // Map of instance ID to instance data
  loading: boolean;
  error: any | null;
  lastLoaded: number | null;  // Timestamp of last successful load
}

/**
 * Overall dynamic objects state
 * Maps className to its instances state
 */
export interface DynamicObjectsState {
  [className: string]: ClassInstancesState;
}

/**
 * Initial state for a class (used when creating new class entry)
 */
const initialClassState: ClassInstancesState = {
  instances: {},
  loading: false,
  error: null,
  lastLoaded: null
};

/**
 * Initial state for the dynamic objects feature
 */
export const initialState: DynamicObjectsState = {};

/**
 * Reducer for dynamic objects state
 */
export const dynamicObjectsReducer = createReducer(
  initialState,

  // Load All Instances
  on(DynamicObjectsActions.loadClassInstances, (state, { className }) => ({
    ...state,
    [className]: {
      ...(state[className] || initialClassState),
      loading: true,
      error: null
    }
  })),

  on(DynamicObjectsActions.loadClassInstancesSuccess, (state, { className, instances }) => {
    // Convert array of instances to object keyed by instanceId
    const instancesObj: { [key: string]: any } = {};
    instances.forEach(instance => {
      // Use _instanceId if available, otherwise generate from object
      const id = instance._instanceId || instance.id || JSON.stringify(instance);
      instancesObj[id] = instance;
    });

    return {
      ...state,
      [className]: {
        instances: instancesObj,
        loading: false,
        error: null,
        lastLoaded: Date.now()
      }
    };
  }),

  on(DynamicObjectsActions.loadClassInstancesFailure, (state, { className, error }) => ({
    ...state,
    [className]: {
      ...(state[className] || initialClassState),
      loading: false,
      error
    }
  })),

  // Load Single Instance
  on(DynamicObjectsActions.loadInstance, (state, { className }) => ({
    ...state,
    [className]: {
      ...(state[className] || initialClassState),
      loading: true
    }
  })),

  on(DynamicObjectsActions.loadInstanceSuccess, (state, { className, instanceId, instance }) => ({
    ...state,
    [className]: {
      ...(state[className] || initialClassState),
      instances: {
        ...(state[className]?.instances || {}),
        [instanceId]: instance
      },
      loading: false,
      error: null
    }
  })),

  on(DynamicObjectsActions.loadInstanceFailure, (state, { className, error }) => ({
    ...state,
    [className]: {
      ...(state[className] || initialClassState),
      loading: false,
      error
    }
  })),

  // Create Instance
  on(DynamicObjectsActions.createInstance, (state, { className }) => ({
    ...state,
    [className]: {
      ...(state[className] || initialClassState),
      loading: true
    }
  })),

  on(DynamicObjectsActions.createInstanceSuccess, (state, { className, instance }) => {
    const instanceId = instance._instanceId || instance.id || Date.now().toString();
    return {
      ...state,
      [className]: {
        ...(state[className] || initialClassState),
        instances: {
          ...(state[className]?.instances || {}),
          [instanceId]: instance
        },
        loading: false,
        error: null
      }
    };
  }),

  on(DynamicObjectsActions.createInstanceFailure, (state, { className, error }) => ({
    ...state,
    [className]: {
      ...(state[className] || initialClassState),
      loading: false,
      error
    }
  })),

  // Update Instance
  on(DynamicObjectsActions.updateInstance, (state, { className }) => ({
    ...state,
    [className]: {
      ...(state[className] || initialClassState),
      loading: true
    }
  })),

  on(DynamicObjectsActions.updateInstanceSuccess, (state, { className, instanceId, instance }) => ({
    ...state,
    [className]: {
      ...(state[className] || initialClassState),
      instances: {
        ...(state[className]?.instances || {}),
        [instanceId]: {
          ...(state[className]?.instances?.[instanceId] || {}),
          ...instance
        }
      },
      loading: false,
      error: null
    }
  })),

  on(DynamicObjectsActions.updateInstanceFailure, (state, { className, error }) => ({
    ...state,
    [className]: {
      ...(state[className] || initialClassState),
      loading: false,
      error
    }
  })),

  // Delete Instance
  on(DynamicObjectsActions.deleteInstance, (state, { className }) => ({
    ...state,
    [className]: {
      ...(state[className] || initialClassState),
      loading: true
    }
  })),

  on(DynamicObjectsActions.deleteInstanceSuccess, (state, { className, instanceId }) => {
    const { [instanceId]: removed, ...remainingInstances } = state[className]?.instances || {};
    return {
      ...state,
      [className]: {
        ...(state[className] || initialClassState),
        instances: remainingInstances,
        loading: false,
        error: null
      }
    };
  }),

  on(DynamicObjectsActions.deleteInstanceFailure, (state, { className, error }) => ({
    ...state,
    [className]: {
      ...(state[className] || initialClassState),
      loading: false,
      error
    }
  })),

  // Clear Class Instances
  on(DynamicObjectsActions.clearClassInstances, (state, { className }) => {
    const { [className]: removed, ...remainingState } = state;
    return remainingState;
  }),

  // Clear All
  on(DynamicObjectsActions.clearAllDynamicObjects, () => initialState)
);

/**
 * Selectors for dynamic objects state
 */

// Get all instances for a class as an array
export const selectClassInstances = (state: DynamicObjectsState, className: string): any[] => {
  const classState = state[className];
  if (!classState || !classState.instances) {
    return [];
  }
  return Object.values(classState.instances);
};

// Get a specific instance
export const selectInstance = (state: DynamicObjectsState, className: string, instanceId: string): any | null => {
  return state[className]?.instances?.[instanceId] || null;
};

// Get loading state for a class
export const selectClassLoading = (state: DynamicObjectsState, className: string): boolean => {
  return state[className]?.loading || false;
};

// Get error state for a class
export const selectClassError = (state: DynamicObjectsState, className: string): any | null => {
  return state[className]?.error || null;
};

// Check if class data has been loaded
export const selectClassIsLoaded = (state: DynamicObjectsState, className: string): boolean => {
  return state[className]?.lastLoaded !== null && state[className]?.lastLoaded !== undefined;
};
