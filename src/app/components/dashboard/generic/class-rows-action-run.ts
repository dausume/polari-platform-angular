/**
 * The ONE place a configured RowActionConfig is executed (class-rows-table's edit boxes + row button, the `cards` item's card button, the
 * picker's modal): fill path + body from the row (class-rows-action.ts), one POST/PUT, read a refusal out of a 200, then on success set the
 * optional `then_scope` and bump page scope `rev` so every table/cards item whose door carries `rev=r{scope:rev}` fetches again.
 * Unit-tested through class-rows-action-run.spec.ts and the components that call it.
 */
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { PolariService } from '@services/polari-service';
import { DisplayEventsService } from '@services/no-code-services/display-events.service';
import { RowActionConfig, actionRefusal, failureWords, fillBody, fillPath } from './class-rows-action';

/** What happened: `ok` + the response (success) or the words for the refusal / failure. */
export interface ActionOutcome { ok: boolean; message: string; response?: any; }

export function runRowAction(
  http: HttpClient, polari: PolariService, events: DisplayEventsService,
  action: RowActionConfig, row: any, value?: number,
): Observable<ActionOutcome> {
  const url = polari.getBackendBaseUrl() + fillPath(action.path, row);
  const body = fillBody(action.body_template ?? {}, row, value);
  const req = (action.method || 'POST').toUpperCase() === 'PUT'
    ? http.put<any>(url, body, polari.backendRequestOptions)
    : http.post<any>(url, body, polari.backendRequestOptions);
  return req.pipe(
    map((res: any): ActionOutcome => {
      const refused = actionRefusal(res);
      if (refused) { return { ok: false, message: refused, response: res }; }          // a 200 that carries a failure is not "Done."
      if (action.then_scope && res && res[action.then_scope.from] !== undefined) {
        events.dispatch({ name: 'setScope', payload: { key: action.then_scope.key, value: String(res[action.then_scope.from]) }, sourceState: '', channel: 'frontend' });
      }
      events.dispatch({ name: 'setScope', payload: { key: 'rev', value: String(Date.now()) }, sourceState: '', channel: 'frontend' });
      return { ok: true, message: '', response: res };
    }),
    catchError((err: any) => of<ActionOutcome>({ ok: false, message: failureWords(err) })),
  );
}
