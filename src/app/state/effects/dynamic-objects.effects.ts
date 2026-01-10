/**
 * NgRx Effects for Dynamic Object Management
 * Handles side effects (API calls) for CRUDE operations
 */

import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { map, mergeMap, catchError, tap } from 'rxjs/operators';
import { CRUDEservicesManager } from '@services/crude-services-manager';
import { DynamicObjectsActions } from '../actions/dynamic-objects.actions';

@Injectable()
export class DynamicObjectsEffects {

  loadClassInstances$;
  loadInstance$;
  createInstance$;
  updateInstance$;
  deleteInstance$;

  constructor(
    private actions$: Actions,
    private crudeManager: CRUDEservicesManager
  ) {
    // Load all instances of a class
    this.loadClassInstances$ = createEffect(() =>
      this.actions$.pipe(
        ofType(DynamicObjectsActions.loadClassInstances),
        tap(({ className }) => console.log(`[Effects] Loading instances for ${className}`)),
        mergeMap(({ className }) => {
          const service = this.crudeManager.getCRUDEclassService(className);

          return service.readAll().pipe(
            map((response: any) => {
              console.log(`[Effects] Received data for ${className}:`, response);

              // Parse the backend response format: { className: { instanceId: instanceData, ... } }
              let instances: any[] = [];

              if (response && typeof response === 'object') {
                if (response[className]) {
                  const instancesObj = response[className];
                  // Convert object to array
                  if (typeof instancesObj === 'object' && !Array.isArray(instancesObj)) {
                    instances = Object.keys(instancesObj).map(instanceId => ({
                      _instanceId: instanceId,
                      ...instancesObj[instanceId]
                    }));
                  } else if (Array.isArray(instancesObj)) {
                    instances = instancesObj;
                  }
                }
              } else if (Array.isArray(response)) {
                instances = response;
              }

              console.log(`[Effects] Parsed ${instances.length} instances for ${className}`);
              return DynamicObjectsActions.loadClassInstancesSuccess({ className, instances });
            }),
            catchError((error) => {
              console.error(`[Effects] Error loading ${className}:`, error);
              return of(DynamicObjectsActions.loadClassInstancesFailure({ className, error }));
            })
          );
        })
      )
    );

    // Load a single instance
    this.loadInstance$ = createEffect(() =>
      this.actions$.pipe(
        ofType(DynamicObjectsActions.loadInstance),
        tap(({ className, instanceId }) =>
          console.log(`[Effects] Loading instance ${instanceId} of ${className}`)
        ),
        mergeMap(({ className, instanceId }) => {
          const service = this.crudeManager.getCRUDEclassService(className);

          return service.read(instanceId).pipe(
            map((response: any) => {
              console.log(`[Effects] Received instance data:`, response);
              // Backend returns single instance
              const instance = response[className]?.[instanceId] || response;
              return DynamicObjectsActions.loadInstanceSuccess({ className, instanceId, instance });
            }),
            catchError((error) => {
              console.error(`[Effects] Error loading instance:`, error);
              return of(DynamicObjectsActions.loadInstanceFailure({ className, instanceId, error }));
            })
          );
        })
      )
    );

    // Create a new instance
    this.createInstance$ = createEffect(() =>
      this.actions$.pipe(
        ofType(DynamicObjectsActions.createInstance),
        tap(({ className, instanceData }) =>
          console.log(`[Effects] Creating instance of ${className}:`, instanceData)
        ),
        mergeMap(({ className, instanceData }) => {
          const service = this.crudeManager.getCRUDEclassService(className);

          return service.create(instanceData).pipe(
            map((response: any) => {
              console.log(`[Effects] Created instance:`, response);
              // Extract the created instance from response
              const instance = response[className] || response;
              return DynamicObjectsActions.createInstanceSuccess({ className, instance });
            }),
            catchError((error) => {
              console.error(`[Effects] Error creating instance:`, error);
              return of(DynamicObjectsActions.createInstanceFailure({ className, error }));
            })
          );
        })
      )
    );

    // Update an existing instance
    this.updateInstance$ = createEffect(() =>
      this.actions$.pipe(
        ofType(DynamicObjectsActions.updateInstance),
        tap(({ className, instanceId, updates }) =>
          console.log(`[Effects] Updating instance ${instanceId} of ${className}:`, updates)
        ),
        mergeMap(({ className, instanceId, updates }) => {
          const service = this.crudeManager.getCRUDEclassService(className);

          return service.update(instanceId, updates).pipe(
            map((response: any) => {
              console.log(`[Effects] Updated instance:`, response);
              const instance = response[className]?.[instanceId] || response;
              return DynamicObjectsActions.updateInstanceSuccess({ className, instanceId, instance });
            }),
            catchError((error) => {
              console.error(`[Effects] Error updating instance:`, error);
              return of(DynamicObjectsActions.updateInstanceFailure({ className, instanceId, error }));
            })
          );
        })
      )
    );

    // Delete an instance
    this.deleteInstance$ = createEffect(() =>
      this.actions$.pipe(
        ofType(DynamicObjectsActions.deleteInstance),
        tap(({ className, instanceId }) =>
          console.log(`[Effects] Deleting instance ${instanceId} of ${className}`)
        ),
        mergeMap(({ className, instanceId }) => {
          const service = this.crudeManager.getCRUDEclassService(className);

          return service.delete(instanceId).pipe(
            map(() => {
              console.log(`[Effects] Deleted instance ${instanceId}`);
              return DynamicObjectsActions.deleteInstanceSuccess({ className, instanceId });
            }),
            catchError((error) => {
              console.error(`[Effects] Error deleting instance:`, error);
              return of(DynamicObjectsActions.deleteInstanceFailure({ className, instanceId, error }));
            })
          );
        })
      )
    );
  }
}
