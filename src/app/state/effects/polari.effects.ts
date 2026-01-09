import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { PolariActions } from '../actions/polari.actions';
import { PolariService } from '@services/polari-service';

/**
 * Effects for Polari connection and server data management.
 */
@Injectable()
export class PolariEffects {

  connect$;
  loadConnectionData$;

  constructor(
    private actions$: Actions,
    private polariService: PolariService
  ) {
    // Connect to Polari server
    this.connect$ = createEffect(() =>
      this.actions$.pipe(
        ofType(PolariActions.connect),
        switchMap(({ ip, port }) =>
          this.polariService.polariAccessNodeSubject.pipe(
            map(connectionData => PolariActions.connectSuccess({ connectionData })),
            catchError(error =>
              of(PolariActions.connectFailure({ error: error.message || 'Failed to connect' }))
            )
          )
        )
      )
    );

    // Load connection data
    this.loadConnectionData$ = createEffect(() =>
      this.actions$.pipe(
        ofType(PolariActions.loadConnectionData),
        switchMap(() =>
          this.polariService.connectionDataSubject.pipe(
            map(data => PolariActions.loadConnectionDataSuccess({ data })),
            catchError(error =>
              of(PolariActions.loadConnectionDataFailure({ error: error.message || 'Failed to load connection data' }))
            )
          )
        )
      )
    );
  }
}
