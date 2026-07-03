import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * Event bus between the Multi-Scale Simulation page and its panels when
 * the panels are rendered INSIDE a custom Display layout (dashboard-
 * renderer instantiates them dynamically, so the page can't reach them
 * via @ViewChildren the way the default grid does).
 *
 * refresh$    — the page just committed steps / switched runs; panels
 *               re-fetch their data (viewers reload, graphs re-pull).
 * runCreated$ — an IC interface panel started a new run; the page
 *               selects and follows it.
 */
@Injectable({ providedIn: 'root' })
export class MsimPanelBusService {
  readonly refresh$ = new Subject<void>();
  readonly runCreated$ = new Subject<string>();
}
