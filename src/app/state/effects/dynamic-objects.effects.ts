/**
 * NgRx Effects for Dynamic Object Management
 * Handles side effects (API calls) for CRUDE operations
 *
 * CURRENTLY DISABLED: Persistent "actions$ is undefined" error
 * Error: TypeError: can't access property "pipe", this.actions$ is undefined
 * Root cause: Actions dependency injection failing with NgRx 17.2.0 + RxJS 7.8.2
 * Class property initialization executes before constructor DI completes
 * Using observable/service-based approach instead (CRUDEservicesManager)
 */

import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of, EMPTY, Observable } from 'rxjs';
import { map, mergeMap, catchError } from 'rxjs/operators';
import { CRUDEservicesManager } from '@services/crude-services-manager';
import { DynamicObjectsActions } from '../actions/dynamic-objects.actions';

@Injectable()
export class DynamicObjectsEffects {
  private warnedMissingActions = false;
  private loggedRecovery = false;

  constructor(
    private readonly actions$: Actions,
    private readonly crudeManager: CRUDEservicesManager
  ) {}

  /**
   * Returns Actions if present; otherwise EMPTY.
   * - Warns once when Actions is missing.
   * - If it was missing before and is now present, logs a recovery message once.
   */
  private actionsOrEmpty(effectName: string): Observable<any> {
    const hasActions = !!this.actions$;

    if (!hasActions) {
      if (!this.warnedMissingActions) {
        this.warnedMissingActions = true;
        this.loggedRecovery = false; // allow a recovery log if it ever comes back
        console.warn(
          `[DynamicObjectsEffects] Actions stream is undefined. ` +
          `Effect "${effectName}" will be disabled (EMPTY).`
        );
      }
      return EMPTY;
    }

    // Actions is present
    if (this.warnedMissingActions && !this.loggedRecovery) {
      this.loggedRecovery = true;
      console.info(
        `[DynamicObjectsEffects] Actions stream is now available again. ` +
        `Effects recovered (first seen by "${effectName}").`
      );
    }

    return this.actions$;
  }

  readonly loadClassInstances$ = createEffect(() =>
    this.actionsOrEmpty('loadClassInstances$').pipe(
      ofType(DynamicObjectsActions.loadClassInstances),
      mergeMap(({ className }) => {
        const service = this.crudeManager.getCRUDEclassService(className);
        return service.readAll().pipe(
          map((response: any) => {
            let instances: any[] = [];
            const instancesObj = response?.[className];

            if (instancesObj && typeof instancesObj === 'object' && !Array.isArray(instancesObj)) {
              instances = Object.keys(instancesObj).map((instanceId) => ({
                _instanceId: instanceId,
                ...instancesObj[instanceId],
              }));
            } else if (Array.isArray(instancesObj)) {
              instances = instancesObj;
            } else if (Array.isArray(response)) {
              instances = response;
            }

            return DynamicObjectsActions.loadClassInstancesSuccess({ className, instances });
          }),
          catchError((error) =>
            of(DynamicObjectsActions.loadClassInstancesFailure({ className, error }))
          )
        );
      })
    )
  );

  readonly loadInstance$ = createEffect(() =>
    this.actionsOrEmpty('loadInstance$').pipe(
      ofType(DynamicObjectsActions.loadInstance),
      mergeMap(({ className, instanceId }) => {
        const service = this.crudeManager.getCRUDEclassService(className);
        return service.read(instanceId).pipe(
          map((response: any) => {
            const instance = response?.[className]?.[instanceId] ?? response;
            return DynamicObjectsActions.loadInstanceSuccess({ className, instanceId, instance });
          }),
          catchError((error) =>
            of(DynamicObjectsActions.loadInstanceFailure({ className, instanceId, error }))
          )
        );
      })
    )
  );

  readonly createInstance$ = createEffect(() =>
    this.actionsOrEmpty('createInstance$').pipe(
      ofType(DynamicObjectsActions.createInstance),
      mergeMap(({ className, instanceData }) => {
        const service = this.crudeManager.getCRUDEclassService(className);
        return service.create(instanceData).pipe(
          map((response: any) => {
            const instance = response?.[className] ?? response;
            return DynamicObjectsActions.createInstanceSuccess({ className, instance });
          }),
          catchError((error) =>
            of(DynamicObjectsActions.createInstanceFailure({ className, error }))
          )
        );
      })
    )
  );

  readonly updateInstance$ = createEffect(() =>
    this.actionsOrEmpty('updateInstance$').pipe(
      ofType(DynamicObjectsActions.updateInstance),
      mergeMap(({ className, instanceId, updates }) => {
        const service = this.crudeManager.getCRUDEclassService(className);
        return service.update(instanceId, updates).pipe(
          map((response: any) => {
            const instance = response?.[className]?.[instanceId] ?? response;
            return DynamicObjectsActions.updateInstanceSuccess({ className, instanceId, instance });
          }),
          catchError((error) =>
            of(DynamicObjectsActions.updateInstanceFailure({ className, instanceId, error }))
          )
        );
      })
    )
  );

  readonly deleteInstance$ = createEffect(() =>
    this.actionsOrEmpty('deleteInstance$').pipe(
      ofType(DynamicObjectsActions.deleteInstance),
      mergeMap(({ className, instanceId }) => {
        const service = this.crudeManager.getCRUDEclassService(className);
        return service.delete(instanceId).pipe(
          map(() => DynamicObjectsActions.deleteInstanceSuccess({ className, instanceId })),
          catchError((error) =>
            of(DynamicObjectsActions.deleteInstanceFailure({ className, instanceId, error }))
          )
        );
      })
    )
  );
}
