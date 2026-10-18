import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { DisplayManagerService } from '@services/dashboard/display-manager.service';
import { Display } from '@models/dashboards/Display';
import { DisplayRendererComponent } from '@components/dashboard/dashboard-renderer/dashboard-renderer';
import { Subscription, combineLatest } from 'rxjs';
import { DisplayTabBarComponent } from './display-tab-bar.component';
import { ResolvedTab, expandTabs, listRowsOf, pickTab, syncInputs } from '../../../utils/display-tabs';
import { PolariService } from '@services/polari-service';
import { registerMsimDisplayComponents } from '@components/multi-scale/msim-display-components';
import { registerMsciDisplayComponents } from '@components/materials-science/msci-display-components';
import { registerAquaponicsDisplayComponents } from '@components/aquaponics/aquaponics-display-components';
import { registerGenericDisplayComponents } from '@components/dashboard/generic/generic-display-components';
import { registerPsppDisplayComponents } from '@components/pspp/pspp-display-components';
import { registerVideoDisplayComponents } from '@components/video/video-display-components';
import { DisplayEventsService } from '@services/no-code-services/display-events.service';
import { hasDatePlaceholder, resolveDatePlaceholders } from '../../../utils/display-placeholders';

@Component({
  standalone: true,
  selector: 'display-page',
  template: `
    <div class="display-page-container">
      <div *ngIf="loading" class="display-page-loading">
        <mat-spinner diameter="48"></mat-spinner>
        <p>Loading display...</p>
      </div>

      <div *ngIf="error && !loading" class="display-page-error">
        <mat-icon>error_outline</mat-icon>
        <h3>Display Not Found</h3>
        <p>{{ error }}</p>
      </div>

      <div *ngIf="needsObject && !loading && !error" class="display-page-error">
        <mat-icon>info_outline</mat-icon>
        <h3>This page needs an object</h3>
        <p>It is a generic page: open it as
          /display/{{ currentDisplayId }}?object=&lt;name&gt; and every
          panel is pointed at that object's own data.</p>
      </div>

      <dashboard-renderer
        *ngIf="display && !loading && !error && !needsObject"
        [dashboard]="display"
        [context]="rendererContext">
      </dashboard-renderer>

      <!-- fsc-3: a tabbed page - the strip, the open tab's words, and the open tab rendered exactly as page rows are -->
      <ng-container *ngIf="display && !loading && !error && !needsObject && display.tabbed">
        <display-tab-bar [tabs]="tabList" [active]="activeTabKey" (selected)="openTab($event)"></display-tab-bar>
        <p class="display-tab-note" *ngIf="activeTabNote">{{ activeTabNote }}</p>
        <div class="display-tab-error" *ngIf="tabsError">{{ tabsError }}</div>
        <ng-container *ngFor="let d of (tabDisplay ? [tabDisplay] : [])">
          <dashboard-renderer [dashboard]="d" [context]="rendererContext"></dashboard-renderer>
        </ng-container>
      </ng-container>
    </div>
  `,
  styles: [`
    .display-page-container {
      padding: 16px;
      min-height: calc(100vh - 64px);
    }
    .display-page-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 80px 20px;
    }
    .display-page-loading p {
      margin-top: 16px;
      color: var(--text-secondary);
    }
    .display-page-error {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 80px 20px;
      text-align: center;
      color: var(--text-secondary);
    }
    .display-page-error mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: #ccc;
      margin-bottom: 16px;
    }
    .display-tab-note { margin: 0 0 10px; color: var(--text-on-card-muted); font-size: 0.92em; }
    .display-tab-error { padding: 12px; color: var(--error-text, #b3261e); }
    .display-page-error h3 {
      margin: 0 0 8px 0;
      color: var(--text-primary);
    }
  `],
  imports: [CommonModule, MatProgressSpinnerModule, MatIconModule, DisplayRendererComponent, DisplayTabBarComponent]
})
export class DisplayPageComponent implements OnInit, OnDestroy {
  display: Display | null = null;
  loading = true;
  error: string | null = null;
  /** fg-1: the page's object (?object=<name>) — every '{object}' in
   *  the definition's inputs/titles is substituted with it. */
  objectName: string | null = null;
  /** true when the definition still contains '{object}' because the
   *  page was opened without ?object= — banner, not broken panels. */
  needsObject = false;

  /** fsc-3 tabs: the resolved tabs (static + generated), the open tab's key, its Display (rows of the open tab only) and the `?tab=` asked for. */
  tabList: ResolvedTab[] = [];
  activeTabKey = '';
  activeTabNote = '';
  tabsError = '';
  tabDisplay: Display | null = null;
  private wantedTab: string | null = null;

  private sub?: Subscription;
  private eventsSub?: Subscription;
  private currentId: string | null = null;
  /** `id::object` of the last definition actually loaded — guards the
   *  paramMap/queryParamMap subscription below so a query param unrelated
   *  to this page (e.g. a nested no-code panel syncing its own
   *  focusSolution/solution selection into the URL) doesn't re-fetch and
   *  rebuild the whole display, which would destroy and re-mount every
   *  panel on the page (see c-graph-canvas-panel infinite-loop fix). */
  private lastLoadedKey: string | null = null;

  get currentDisplayId(): string { return this.currentId || ''; }

  get rendererContext(): { object: string } {
    return { object: this.objectName || '' };
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private polariService: PolariService,
    private displayManager: DisplayManagerService,
    private displayEvents: DisplayEventsService
  ) {}

  ngOnInit(): void {
    // Displays may contain multi-scale panels (scene/graph/IC pickers)
    // or materials-science pages (basis browser, formulation-search
    // workbench); register their components before rendering.
    registerMsimDisplayComponents();
    registerMsciDisplayComponents();
    registerAquaponicsDisplayComponents();
    registerGenericDisplayComponents();
    registerPsppDisplayComponents();
    registerVideoDisplayComponents();
    // fg-1: one page definition, many objects — the id names the
    // generic page, ?object= names the row it renders for.
    this.sub = combineLatest([this.route.paramMap, this.route.queryParamMap])
      .subscribe(([params, query]) => {
        const id = params.get('id');
        const objectName = query.get('object');
        // fsc-3: ?tab= is NOT part of the reload key below - changing tab re-renders only the tab, never refetches the page
        const tabChanged = (query.get('tab') ?? null) !== this.wantedTab;
        this.wantedTab = query.get('tab') ?? null;
        if (!id) {
          this.loading = false;
          this.error = 'No display ID provided.';
          return;
        }
        this.currentId = id;
        // paramMap/queryParamMap emit a NEW map on every navigation, even one
        // that only touches an unrelated query param — only reload the
        // definition when `id` or the `{object}` substitution target actually
        // changed, or the page would rebuild (and re-mount every panel) on
        // any query param write anywhere on the page.
        const key = `${id}::${objectName ?? ''}`;
        this.objectName = objectName;
        if (key === this.lastLoadedKey) {
          if (tabChanged && this.tabList.length) { this.scope = {}; this.showTab(false); }
          return;
        }
        this.lastLoadedKey = key;
        this.loadDisplay(id);
      });
    // First consumer of the display event bus (P4): a no-code solution
    // emitting an event named 'refreshDisplay' re-fetches this display's
    // data — form saves can refresh what the page shows, no code.
    this.eventsSub = this.displayEvents.on('refreshDisplay').subscribe(() => {
      if (this.currentId) this.loadDisplay(this.currentId);
    });
    // bp-2a: a page SCOPE set by events. A panel (the tensor-tree panel's tree chips, any no-code EmitFrontendEvent)
    // dispatches `setScope` {key, value, facets?}; every `{scope:key}` / `{scope:key.facet}` placeholder in the
    // configured items' inputs and titles is re-substituted and the page re-renders — the tables filter to the
    // selection, the viewer shows its space. Configuration + events, no page code per module. A repeat of the
    // current scope is ignored (the re-created panel re-announces the same pick; that must not loop).
    this.scopeSub = this.displayEvents.on('setScope').subscribe((e) => {
      const key = String(e.payload?.['key'] || '');
      const value = String(e.payload?.['value'] ?? '');
      if (!key) { return; }
      const facets = (e.payload?.['facets'] && typeof e.payload['facets'] === 'object') ? e.payload['facets'] as Record<string, unknown> : {};
      const next: Record<string, string> = { ...this.scope, [key]: value };
      for (const f of Object.keys(facets)) { next[`${key}.${f}`] = String(facets[f] ?? ''); }
      const unchanged = Object.keys(next).length === Object.keys(this.scope).length
        && Object.keys(next).every((k) => this.scope[k] === next[k]);
      if (unchanged) { return; }
      this.scope = next;
      // a tabbed page re-renders only its open tab (the strip, and the page's own rows, stay put)
      if (this.tabList.length) { this.showTab(true); return; }
      if (this.currentId) { this.loadDisplay(this.currentId); }
    });
  }

  /** The page scope: `{scope:tree}` → 'plate-mechanics', `{scope:tree.nodes}` → 'plate,plate-strain,…'. */
  private scope: Record<string, string> = {};
  private scopeSub?: Subscription;

  private loadDisplay(id: string): void {
    this.loading = true;
    this.error = null;
    this.displayManager.loadDisplay(id).subscribe({
      next: (display: Display) => {
        this.needsObject = this.substituteObject(display, this.objectName);
        this.display = display;
        this.loading = false;
        this.loadTabs(display);
      },
      error: (err: any) => {
        this.loading = false;
        this.error = `Could not load display "${id}".`;
        console.error('[DisplayPage] Load failed:', err);
      }
    });
  }

  /** fsc-3: resolve the page's tabs (static + one per row of the `tabs_from` list door) and show the one `?tab=` names. */
  private loadTabs(display: Display): void {
    this.tabList = [];
    this.tabDisplay = null;
    this.tabsError = '';
    if (!display.tabbed) { return; }
    const from = display.tabsFrom;
    if (!from) {
      this.tabList = expandTabs(display.tabs, undefined, []);
      this.showTab(false);
      return;
    }
    const url = /^https?:\/\//.test(from.data_path) ? from.data_path : this.polariService.getBackendBaseUrl() + from.data_path;
    this.http.get<any>(url, this.polariService.backendRequestOptions).subscribe({
      next: (payload: any) => {
        this.tabList = expandTabs(display.tabs, from, listRowsOf(payload));
        this.showTab(false);
      },
      error: () => {
        // the generated tabs could not be listed: keep the static ones and say so in words
        this.tabsError = 'The list of tabs could not be read, so only the fixed tabs are shown.';
        this.tabList = expandTabs(display.tabs, undefined, []);
        this.showTab(false);
      },
    });
  }

  /**
   * Build the open tab's Display from its raw rows. A new tab (or a reload) makes a fresh Display, so its panels are created anew. A SCOPE change on the open tab
   * (`inPlace`) does not: the new inputs are copied into the Display already on screen, so a table whose inputs did not change (the ranked list when a row is clicked)
   * is not rebuilt or refetched, and one whose dataPath changed fetches again by itself.
   */
  private showTab(inPlace: boolean): void {
    const tab = pickTab(this.tabList, this.wantedTab);
    if (!this.display || !tab) { this.tabDisplay = null; return; }
    this.activeTabKey = tab.key;
    this.activeTabNote = tab.description || '';
    const d = new Display(`${this.display.id}-tab-${tab.key}`, '', '');
    this.displayManager.deserializeRows(tab.rows).forEach((row) => d.addRow(row));
    this.substituteObject(d, this.objectName);
    if (inPlace && this.tabDisplay && this.tabDisplay.id === d.id) {
      syncInputs(this.tabDisplay, d);
      return;
    }
    this.tabDisplay = d;
  }

  /** A tab strip click: the tab goes in the URL (`?tab=`), so a shared link opens the same tab. */
  openTab(key: string): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { tab: key }, queryParamsHandling: 'merge' });
  }

  /** Replaces '{object}' in every item title and componentProps
   *  input string (nested rows included). Returns true when a
   *  '{object}' could NOT be resolved — the page was opened without
   *  ?object= — so the caller shows one clear banner instead of a
   *  page of 404ing panels. */
  private substituteObject(display: Display, objectName: string | null): boolean {
    let unresolved = false;
    // One clock for the whole pass so every field agrees on the day.
    const at = new Date();
    const sub = (v: any): any => {
      // {today} / {now}: local date + time, resolved at render time so a
      // seeded form never proposes the day it was seeded.
      v = resolveDatePlaceholders(v, at);
      // bp-2a: `{scope:key}` / `{scope:key.facet}` from the page scope (setScope events); unresolved → '' so a
      // filtered table is simply unfiltered and a title shows nothing, until the first pick arrives
      if (typeof v === 'string' && v.includes('{scope:')) {
        v = v.replace(/\{scope:([A-Za-z0-9_.-]+)\}/g, (_m: string, k: string) => this.scope[k] ?? '');
      }
      if (typeof v !== 'string' || !v.includes('{object}')) { return v; }
      if (!objectName) { unresolved = true; return v; }
      return v.split('{object}').join(objectName);
    };
    const walkItem = (item: any): void => {
      if (!item) { return; }
      item.title = sub(item.title);
      const inputs = item.componentProps?.inputs;
      if (inputs && typeof inputs === 'object') {
        for (const k of Object.keys(inputs)) { inputs[k] = sub(inputs[k]); }
      }
      // mpc: a seeded FORM on a per-object page pre-fills the object
      // (e.g. the person) through its extra variables' defaults.
      // {today}/{now} defaults also keep their raw template
      // (defaultValueTemplate) so the renderer can roll a pristine
      // field over when the local date changes under an open page.
      const extra = item.item?.extraVariables;
      if (Array.isArray(extra)) {
        for (const v of extra) {
          if (!v) { continue; }
          if (hasDatePlaceholder(v.defaultValue)) { v.defaultValueTemplate = v.defaultValue; }
          v.defaultValue = sub(v.defaultValue);
        }
      }
      (item.nestedRows || []).forEach(walkRow);
    };
    // The deserialized model keeps row items in `dashboardItems`
    // (DisplayRow) and column items in `dashboardItems` too
    // (DisplayColumn) — the definition JSON's `items` key does NOT
    // survive deserialization (that miss shipped once: every panel
    // called the API with a literal '{object}').
    const walkRow = (row: any): void => {
      (row?.dashboardItems || row?.items || []).forEach(walkItem);
      (row?.columns || []).forEach((col: any) =>
        (col?.dashboardItems || col?.items || []).forEach(walkItem));
    };
    (display?.rows || []).forEach(walkRow);
    return unresolved;
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.eventsSub?.unsubscribe();
    this.scopeSub?.unsubscribe();
  }
}
