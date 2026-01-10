/**
 * NgRx Actions for Dynamic Object Management
 * Handles CRUDE operations for any object type dynamically
 */

import { createActionGroup, emptyProps, props } from '@ngrx/store';

export const DynamicObjectsActions = createActionGroup({
  source: 'Dynamic Objects',
  events: {
    // Load All Instances
    'Load Class Instances': props<{ className: string }>(),
    'Load Class Instances Success': props<{ className: string; instances: any[] }>(),
    'Load Class Instances Failure': props<{ className: string; error: any }>(),

    // Load Single Instance
    'Load Instance': props<{ className: string; instanceId: string }>(),
    'Load Instance Success': props<{ className: string; instanceId: string; instance: any }>(),
    'Load Instance Failure': props<{ className: string; instanceId: string; error: any }>(),

    // Create Instance
    'Create Instance': props<{ className: string; instanceData: any }>(),
    'Create Instance Success': props<{ className: string; instance: any }>(),
    'Create Instance Failure': props<{ className: string; error: any }>(),

    // Update Instance
    'Update Instance': props<{ className: string; instanceId: string; updates: any }>(),
    'Update Instance Success': props<{ className: string; instanceId: string; instance: any }>(),
    'Update Instance Failure': props<{ className: string; instanceId: string; error: any }>(),

    // Delete Instance
    'Delete Instance': props<{ className: string; instanceId: string }>(),
    'Delete Instance Success': props<{ className: string; instanceId: string }>(),
    'Delete Instance Failure': props<{ className: string; instanceId: string; error: any }>(),

    // Clear Operations
    'Clear Class Instances': props<{ className: string }>(),
    'Clear All Dynamic Objects': emptyProps(),
  }
});
