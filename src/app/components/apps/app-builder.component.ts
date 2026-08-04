import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { PolariService } from '@services/polari-service';
import { AppsNavService, AppNav, AppNavGroup, AppNavItem }
  from '@services/apps-nav.service';

interface PlanPlacement {
  module: string;
  status: 'already-placed' | 'needs-assignment' | 'missing';
  instances: string[];
  suggestedInstance: string;
  suggestedCommand: string;
}

interface AppPlan {
  ok: boolean;
  app: string;
  topology: string;
  placements: PlanPlacement[];
  readiness: number;
  note?: string;
  error?: string;
}

interface RouteChoice {
  route: string;
  label: string;
  source: string;
}

/**
 * THE APP BUILDER — compose an app from routes, modules and
 * capabilities, by hand.
 *
 * Apps were already pure configuration (PolariAppDefinition rows:
 * modules_json, pages_json, nav_json, personas_json), but the only way
 * to author one was to write a seed in Python. This is the surface
 * that makes the configuration authorable by a person.
 *
 * Three things an app IS, and each gets a real control rather than a
 * JSON textarea:
 *   MODULES      what it needs online — picked from what this node
 *                actually has, with its live state shown, so you
 *                cannot silently require something that is not there
 *   PAGES        its front doors — picked from the routes that
 *                actually exist (published display pages + the app
 *                routes), not typed from memory
 *   NAV          its own menu: groups of items, each a route or a
 *                capability reference, each able to declare the module
 *                it requires. An item whose module is absent is not
 *                hidden — availability is DERIVED live by the backend
 *                and renders as a bring-online affordance.
 *
 * Saving marks the row authored (is_prior false), which is the
 * model's own contract for "a person edited this, the seed pass must
 * never overwrite it".
 */
@Component({
  standalone: true,
  selector: 'app-builder',
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
  <div class="builder page-shell">
    <h2>{{ isNew ? 'Build an app' : 'Edit ' + (draft.title || draft.name) }}</h2>
    <p class="hint prose-measure">
      An app is a named configuration: the modules it needs, the pages
      it opens on, and its own menu. Nothing here is code — saving
      writes one PolariAppDefinition row, and the app appears in the
      Apps menu immediately.
    </p>

    <div class="err" *ngIf="error">{{ error }}</div>
    <div class="ok" *ngIf="saved">{{ saved }}</div>

    <!-- ---------- identity ---------- -->
    <section class="card">
      <h3>What it is</h3>
      <div class="fields">
        <label>name
          <input [(ngModel)]="draft.name" [disabled]="!isNew"
                 placeholder="app-my-thing">
          <span class="sub" *ngIf="isNew">
            lowercase id, used in the URL — cannot change later</span>
        </label>
        <label>title
          <input [(ngModel)]="draft.title" placeholder="My Thing"></label>
        <label>discipline
          <input [(ngModel)]="draft.discipline"
                 placeholder="blank for a use-case app"></label>
      </div>
      <label class="wide">use case
        <input [(ngModel)]="draft.useCase"
               placeholder="who enters here and what they do"></label>
      <label class="wide">description
        <textarea [(ngModel)]="draft.description" rows="2"></textarea></label>
    </section>

    <!-- ---------- modules ---------- -->
    <section class="card">
      <h3>Modules it needs
        <span class="count">{{ draft.modules.length }}</span></h3>
      <p class="hint">Picked from what this node has. The state is
        live — requiring an absent module is allowed, and its nav items
        will offer to bring it online rather than disappear.</p>
      <input class="filter" [(ngModel)]="moduleFilter"
             placeholder="filter modules…">
      <div class="chip-row modules">
        <button *ngFor="let m of visibleModules()"
                class="chip chip-outline"
                [class.on]="draft.modules.includes(m.name)"
                (click)="toggleModule(m.name)">
          {{ m.name }}
          <span class="state" [class.absent]="m.state === 'absent'">
            {{ m.state }}</span>
        </button>
      </div>
    </section>

    <!-- ---------- pages ---------- -->
    <section class="card">
      <h3>Front doors
        <span class="count">{{ draft.pages.length }}</span></h3>
      <p class="hint">The routes this app opens on, chosen from routes
        that exist.</p>
      <div class="chip-row" *ngIf="draft.pages.length">
        <span class="chip" *ngFor="let p of draft.pages">
          {{ p }}
          <button class="x" (click)="removePage(p)" title="remove">×</button>
        </span>
      </div>
      <div class="row">
        <select [(ngModel)]="pageToAdd">
          <option value="">— pick a route —</option>
          <option *ngFor="let r of unusedRoutes()" [value]="r.route">
            {{ r.route }} — {{ r.label }} ({{ r.source }})
          </option>
        </select>
        <button class="add" [disabled]="!pageToAdd"
                (click)="addPage(pageToAdd)">add</button>
      </div>
    </section>

    <!-- ---------- nav ---------- -->
    <section class="card">
      <h3>Its menu
        <span class="count">{{ draft.nav.length }} groups</span></h3>
      <p class="hint">Groups become dropdowns in the top bar; every
        item names the route or capability it opens and, optionally,
        the module it needs.</p>

      <div class="nav-group" *ngFor="let g of draft.nav; let gi = index">
        <div class="group-head">
          <input class="group-name" [(ngModel)]="g.group"
                 placeholder="group name">
          <label class="inline">
            <input type="checkbox" [(ngModel)]="g.topMenu"> top menu
          </label>
          <span class="grow"></span>
          <button class="x" (click)="removeGroup(gi)">remove group</button>
        </div>

        <table class="items" *ngIf="g.items.length">
          <tr><th>label</th><th>kind</th><th>route / ref</th>
            <th>requires module</th><th></th></tr>
          <tr *ngFor="let it of g.items; let ii = index">
            <td><input [(ngModel)]="it.label" placeholder="label"></td>
            <td>
              <select [(ngModel)]="it.kind">
                <option value="page">page</option>
                <option value="simspace">simspace</option>
                <option value="view">view</option>
                <option value="tech-node">tech-node</option>
              </select>
            </td>
            <td>
              <input *ngIf="it.kind === 'page'" [(ngModel)]="it.route"
                     placeholder="/route" list="known-routes">
              <input *ngIf="it.kind !== 'page'" [(ngModel)]="it.ref"
                     placeholder="reference name">
            </td>
            <td>
              <select [(ngModel)]="it.requiresModule">
                <option value="">— none —</option>
                <option *ngFor="let m of draft.modules" [value]="m">
                  {{ m }}</option>
              </select>
            </td>
            <td><button class="x" (click)="removeItem(gi, ii)">×</button></td>
          </tr>
        </table>

        <button class="add" (click)="addItem(gi)">+ item</button>
      </div>

      <button class="add" (click)="addGroup()">+ group</button>
      <datalist id="known-routes">
        <option *ngFor="let r of routes" [value]="r.route"></option>
      </datalist>
    </section>

    <!-- ---------- personas ---------- -->
    <section class="card">
      <h3>Who enters here</h3>
      <div class="chip-row" *ngIf="draft.personas.length">
        <span class="chip" *ngFor="let p of draft.personas">
          {{ p }}
          <button class="x" (click)="removePersona(p)">×</button>
        </span>
      </div>
      <div class="row">
        <input [(ngModel)]="personaToAdd" placeholder="electrical-engineer"
               (keyup.enter)="addPersona()">
        <button class="add" [disabled]="!personaToAdd"
                (click)="addPersona()">add</button>
      </div>
    </section>

    <!-- ---------- deployment ---------- -->
    <section class="card" *ngIf="!isNew">
      <h3>Put it on a topology</h3>
      <p class="hint">Plan first, then apply. Applying writes
        <strong>ModuleAssignment rows only</strong> — it does not
        deploy containers. That stays a human-run
        <code>pol topology apply</code>.</p>

      <div class="row">
        <label class="inline">topology
          <select [(ngModel)]="topology">
            <option *ngFor="let t of topologies" [value]="t">{{ t }}</option>
          </select>
        </label>
        <button class="add" [disabled]="planning" (click)="loadPlan()">
          {{ planning ? 'planning…' : (plan ? 're-plan' : 'Plan') }}
        </button>
      </div>

      <div class="err" *ngIf="planError">{{ planError }}</div>

      <ng-container *ngIf="plan">
        <div class="readiness">
          <div class="bar">
            <div class="fill" [style.width.%]="plan.readiness * 100"></div>
          </div>
          <span>{{ placedCount() }} of {{ plan.placements.length }}
            modules already placed</span>
        </div>

        <div class="scroll-x">
          <table class="data-table-dashed">
            <tr><th>module</th><th>status</th><th>where</th>
              <th>what it would take</th></tr>
            <tr *ngFor="let p of plan.placements">
              <td>{{ p.module }}</td>
              <td>
                <span class="chip"
                      [class.is-ok]="p.status === 'already-placed'"
                      [class.is-warn]="p.status === 'needs-assignment'"
                      [class.is-error]="p.status === 'missing'">
                  {{ p.status }}</span>
              </td>
              <td>{{ p.instances?.join(', ') || p.suggestedInstance }}</td>
              <td class="cmd">{{ p.suggestedCommand }}</td>
            </tr>
          </table>
        </div>

        <!-- A module that is not in the image cannot be assigned, so
             applying would be a lie. Say so and refuse the action. -->
        <div class="warn" *ngIf="missingCount() > 0">
          {{ missingCount() }} module(s) are not in this image — apply
          cannot place them. Build or install them first; the command
          is in the table.
        </div>

        <div class="row">
          <button class="primary"
                  [disabled]="applying || !canApply()"
                  (click)="apply()">
            {{ applying ? 'applying…' : 'Apply to ' + topology }}
          </button>
          <span class="hint" *ngIf="!canApply() && !applied">
            nothing to assign — every module is already placed or
            missing</span>
        </div>
      </ng-container>

      <div class="ok" *ngIf="applied">
        {{ applied }}
      </div>
    </section>

    <div class="actions">
      <button class="primary" [disabled]="!canSave() || saving"
              (click)="save()">
        {{ saving ? 'saving…' : (isNew ? 'Create app' : 'Save changes') }}
      </button>
      <a class="secondary" routerLink="/apps">back to apps</a>
      <span class="hint" *ngIf="!canSave()">
        a name and at least one front door or menu item</span>
    </div>
  </div>
  `,
  styles: [`
    .builder { color: var(--text-on-bg); }
    h2 { margin: 0 0 4px; }
    .hint { font-size: 12.5px; color: var(--text-on-bg-muted); margin: 4px 0 10px; }
    .card {
      background: var(--surface-primary);
      color: var(--text-on-card);
      border: 1px solid var(--border-medium);
      border-radius: var(--card-radius);
      padding: var(--card-pad);
      margin-bottom: var(--page-gap);
    }
    .card h3 { margin: 0 0 4px; font-size: 15px; }
    .card .hint { color: var(--text-on-card-muted); }
    .count {
      font-size: 11px; font-weight: 400; margin-left: 6px;
      border: 1px solid var(--surface-outline);
      border-radius: 8px; padding: 0 6px;
    }
    .fields {
      display: grid; gap: 10px;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
    }
    label { display: flex; flex-direction: column; gap: 3px; font-size: 12px;
      color: var(--text-on-card-muted); }
    label.wide { margin-top: 10px; }
    label.inline { flex-direction: row; align-items: center; gap: 4px; }
    .sub { font-size: 11px; }
    input, select, textarea {
      background: var(--surface-primary);
      color: var(--text-on-card);
      border: 1px solid var(--border-medium);
      border-radius: var(--radius-sm);
      padding: 5px 7px; font-size: 13px; min-width: 0;
      font-family: inherit;
    }
    .filter { width: min(280px, 100%); margin-bottom: 8px; }
    .chip-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .chip-row.modules { max-height: 240px; overflow-y: auto; }
    .chip { cursor: default; }
    button.chip { cursor: pointer; }
    button.chip.on {
      border-color: var(--color-success-text);
      color: var(--color-success-text);
    }
    .state {
      font-size: 10px; margin-left: 5px; color: var(--text-tertiary);
    }
    .state.absent { color: var(--color-warn-text); }
    .x {
      border: none; background: none; cursor: pointer;
      color: var(--text-on-card-muted); font-size: 13px; padding: 0 2px;
    }
    .row { display: flex; gap: 8px; align-items: center; margin-top: 8px;
      flex-wrap: wrap; }
    .add {
      border: 1px solid var(--border-dark); background: var(--surface-secondary);
      color: var(--text-on-card); border-radius: var(--radius-md);
      padding: 4px 12px; font-size: 12px; cursor: pointer; margin-top: 6px;
    }
    .nav-group {
      border: 1px solid var(--border-light); border-radius: var(--radius-md);
      padding: 8px 10px; margin: 8px 0;
    }
    .group-head { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .group-name { font-weight: 600; }
    .grow { flex: 1 1 auto; }
    .items { width: 100%; border-collapse: collapse; font-size: 12px;
      margin-top: 6px; }
    .items th {
      text-align: left; font-size: 10px; text-transform: uppercase;
      letter-spacing: 0.04em; color: var(--text-on-card-muted);
      padding: 3px 6px 3px 0;
    }
    .items td { padding: 3px 6px 3px 0; border-top: 1px dashed var(--border-light); }
    .items input, .items select { width: 100%; }
    .actions { display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
      margin-top: 4px; }
    .primary {
      background: var(--brand-indigo); color: var(--text-on-primary);
      border: 1px solid var(--brand-indigo); border-radius: var(--radius-md);
      padding: 7px 18px; font-size: 13px; cursor: pointer;
    }
    .primary:disabled { opacity: 0.5; cursor: default; }
    .secondary { color: var(--color-info-text); font-size: 13px; }
    .err {
      background: var(--color-error-bg); color: var(--color-error-text);
      border: 1px solid var(--color-error-border);
      border-radius: var(--radius-md); padding: 8px 12px; margin-bottom: 10px;
    }
    .readiness { display: flex; align-items: center; gap: 10px;
      margin: 10px 0; font-size: 12px; color: var(--text-on-card-muted); }
    .bar { flex: 1 1 auto; max-width: 320px; height: 8px;
      border-radius: 4px; background: var(--surface-hover);
      overflow: hidden; }
    .fill { height: 100%; background: var(--brand-blue);
      border-radius: 4px; transition: width 300ms; }
    .cmd { font-family: monospace; font-size: 11px;
      color: var(--text-on-card-muted); }
    .warn {
      background: var(--color-warn-bg); color: var(--color-warn-text);
      border: 1px solid var(--color-warn-border);
      border-radius: var(--radius-md); padding: 7px 11px;
      font-size: 12.5px; margin: 8px 0;
    }
    .ok {
      background: var(--color-success-bg); color: var(--color-success-text);
      border: 1px solid var(--color-success-border);
      border-radius: var(--radius-md); padding: 8px 12px; margin-bottom: 10px;
    }
  `],
})
export class AppBuilderComponent implements OnInit {
  isNew = true;
  saving = false;
  error = '';
  saved = '';

  moduleFilter = '';
  pageToAdd = '';
  personaToAdd = '';

  // ---- deployment (plan -> review -> apply) ----
  topologies: string[] = [];
  topology = '';
  plan: AppPlan | null = null;
  planning = false;
  planError = '';
  applying = false;
  applied = '';

  /** What this node actually has, with live state — so the builder
   *  cannot offer a module that does not exist here. */
  modules: { name: string; state: string }[] = [];

  /** Routes that actually exist, so a front door is picked rather
   *  than typed from memory. */
  routes: RouteChoice[] = [];

  draft = {
    name: '', title: '', useCase: '', description: '', discipline: '',
    modules: [] as string[],
    pages: [] as string[],
    personas: [] as string[],
    nav: [] as AppNavGroup[],
  };

  constructor(private http: HttpClient,
              private polariService: PolariService,
              private appsNav: AppsNavService,
              private route: ActivatedRoute,
              private router: Router) {}

  private url(path: string): string {
    return `${this.polariService.getBackendBaseUrl()}${path}`;
  }

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadModules(), this.loadRoutes(),
                       this.loadTopologies()]);
    const name = this.route.snapshot.paramMap.get('name') || '';
    if (name) {
      this.isNew = false;
      await this.loadExisting(name);
    } else {
      // A new app starts with one empty group: the menu is the point,
      // and an empty builder should show its shape.
      this.draft.nav = [{ group: 'Main', topMenu: true, items: [] }];
    }
  }

  // ---- loading ----------------------------------------------------

  private async loadModules(): Promise<void> {
    try {
      const payload = await this.appsNav.whenLoaded();
      const states: Record<string, string> = {};
      for (const app of (payload?.apps || [])) {
        Object.assign(states, app.moduleStates || {});
      }
      const listed = await firstValueFrom(
        this.http.get<any>(this.url('/api/modules'),
          this.polariService.backendRequestOptions));
      const names = this.moduleNames(listed);
      this.modules = names.map((n) => ({
        name: n, state: states[n] || 'unknown',
      })).sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      this.error = 'Could not read the module list — pick modules by '
        + 'name at your own risk, or retry.';
    }
  }

  private moduleNames(payload: any): string[] {
    const walk = (x: any): string[] => {
      if (Array.isArray(x)) {
        return x.map((i) => (typeof i === 'string' ? i : i?.name))
          .filter(Boolean);
      }
      if (x && typeof x === 'object') {
        for (const k of ['modules', 'data', 'items']) {
          if (k in x) { return walk(x[k]); }
        }
      }
      return [];
    };
    return [...new Set(walk(payload))];
  }

  /** Published display pages are real routes with real names; the
   *  app routes are the framework's own front doors. */
  private async loadRoutes(): Promise<void> {
    const choices: RouteChoice[] = [];
    try {
      const envelope = await firstValueFrom(
        this.http.get<any>(this.url('/DisplayDefinition'),
          this.polariService.backendRequestOptions));
      const rows = envelope?.[0]?.['DisplayDefinition']?.[0]?.data ?? [];
      for (const row of rows) {
        if (row?.isPage && row?.pageRoute) {
          choices.push({
            route: `/display/${row.pageRoute}`,
            label: row.name || row.pageRoute,
            source: 'display page',
          });
        }
      }
    } catch { /* the static routes below are still offered */ }

    for (const r of AppBuilderComponent.FRAMEWORK_ROUTES) {
      choices.push({ ...r, source: 'framework' });
    }
    this.routes = choices.sort((a, b) => a.route.localeCompare(b.route));
  }

  /** Framework front doors worth offering as app pages. Kept short
   *  and explicit rather than scraped from the router, because most
   *  routes (dialogs, detail pages, callbacks) are not front doors. */
  private static readonly FRAMEWORK_ROUTES: RouteChoice[] = [
    { route: '/topology', label: 'Topology', source: '' },
    { route: '/tech-tree', label: 'Tech tree', source: '' },
    { route: '/testing', label: 'Testing', source: '' },
    { route: '/scoring', label: 'Scoring', source: '' },
    { route: '/matrices', label: 'Matrices', source: '' },
    { route: '/equations', label: 'Equations', source: '' },
    { route: '/sim-spaces', label: 'Sim spaces', source: '' },
    { route: '/multi-scale-sims', label: 'Multi-scale sims', source: '' },
    { route: '/module-management', label: 'Modules', source: '' },
    { route: '/custom-no-code', label: 'No-code editor', source: '' },
    { route: '/graphs', label: 'Graphs', source: '' },
    { route: '/tables', label: 'Tables', source: '' },
    { route: '/displays', label: 'Displays', source: '' },
    { route: '/datasets', label: 'Datasets', source: '' },
    { route: '/maps', label: 'Maps', source: '' },
  ];

  private async loadExisting(name: string): Promise<void> {
    const payload = await this.appsNav.whenLoaded();
    const app: AppNav | undefined =
      (payload?.apps || []).find((a) => a.name === name);
    if (!app) {
      this.error = `No app named "${name}" on this node.`;
      return;
    }
    this.draft = {
      name: app.name,
      title: app.title || '',
      useCase: app.useCase || '',
      description: '',
      discipline: app.discipline || '',
      modules: [...(app.modules || [])],
      pages: [...(app.pages || [])],
      personas: [...(app.personas || [])],
      // The backend DERIVES availability; strip it so editing does not
      // write a stale verdict back into the definition.
      nav: (app.nav || []).map((g) => ({
        group: g.group, topMenu: g.topMenu,
        items: (g.items || []).map((i) => ({
          label: i.label, kind: i.kind, route: i.route, ref: i.ref,
          requiresModule: i.requiresModule,
        } as AppNavItem)),
      })),
    };
    if (app.navSynthesized) {
      this.saved = 'This app had no menu of its own — one was '
        + 'synthesized from its pages. Saving will make it explicit '
        + 'and editable.';
    }
  }

  // ---- editing ----------------------------------------------------

  visibleModules(): { name: string; state: string }[] {
    const f = this.moduleFilter.trim().toLowerCase();
    return f ? this.modules.filter((m) => m.name.toLowerCase().includes(f))
      : this.modules;
  }

  toggleModule(name: string): void {
    const i = this.draft.modules.indexOf(name);
    if (i >= 0) { this.draft.modules.splice(i, 1); }
    else { this.draft.modules.push(name); }
  }

  unusedRoutes(): RouteChoice[] {
    return this.routes.filter((r) => !this.draft.pages.includes(r.route));
  }

  addPage(route: string): void {
    if (route && !this.draft.pages.includes(route)) {
      this.draft.pages.push(route);
    }
    this.pageToAdd = '';
  }

  removePage(route: string): void {
    this.draft.pages = this.draft.pages.filter((p) => p !== route);
  }

  addPersona(): void {
    const p = this.personaToAdd.trim();
    if (p && !this.draft.personas.includes(p)) {
      this.draft.personas.push(p);
    }
    this.personaToAdd = '';
  }

  removePersona(p: string): void {
    this.draft.personas = this.draft.personas.filter((x) => x !== p);
  }

  addGroup(): void {
    this.draft.nav.push({ group: '', topMenu: true, items: [] });
  }

  removeGroup(index: number): void {
    this.draft.nav.splice(index, 1);
  }

  addItem(groupIndex: number): void {
    this.draft.nav[groupIndex].items.push({
      label: '', kind: 'page', route: '', requiresModule: '',
    } as AppNavItem);
  }

  removeItem(groupIndex: number, itemIndex: number): void {
    this.draft.nav[groupIndex].items.splice(itemIndex, 1);
  }

  canSave(): boolean {
    const named = /^[a-z0-9][a-z0-9-]*$/.test(this.draft.name.trim());
    const hasSomething = this.draft.pages.length > 0
      || this.draft.nav.some((g) => g.items.length > 0);
    return named && hasSomething;
  }

  // ---- saving -----------------------------------------------------

  async save(): Promise<void> {
    this.saving = true; this.error = ''; this.saved = '';
    try {
      // Drop blank rows rather than persisting half-typed items.
      // ⚠ ASYMMETRIC KEYS. nav_json is STORED snake_case
      // (top_menu, requires_module) and the nav API RETURNS camelCase
      // (topMenu, requiresModule). Writing camelCase here parses
      // without error and is silently ignored — the group just never
      // reaches the top bar.
      const nav = this.draft.nav
        .map((g) => ({
          group: g.group.trim(), top_menu: !!g.topMenu,
          items: g.items
            .filter((i) => (i.label || '').trim())
            .map((i) => {
              const item: any = { label: i.label.trim(), kind: i.kind };
              if (i.kind === 'page' && i.route) { item.route = i.route.trim(); }
              if (i.kind !== 'page' && i.ref) { item.ref = i.ref.trim(); }
              if (i.requiresModule) { item.requires_module = i.requiresModule; }
              return item;
            }),
        }))
        .filter((g) => g.group && g.items.length);

      const body = {
        name: this.draft.name.trim(),
        title: this.draft.title.trim(),
        use_case: this.draft.useCase.trim(),
        description: this.draft.description.trim(),
        discipline: this.draft.discipline.trim(),
        modules_json: JSON.stringify(this.draft.modules),
        pages_json: JSON.stringify(this.draft.pages),
        nav_json: JSON.stringify(nav),
        personas_json: JSON.stringify(this.draft.personas),
        // Authored by a person, so the seed pass must leave it alone.
        is_prior: false,
      };

      const result = await firstValueFrom(this.http.post<any>(
        this.url('/api/apps/definition'), body,
        this.polariService.backendRequestOptions));

      if (!result?.ok) {
        this.error = result?.refusal || 'The node refused the save.';
        return;
      }
      // The Apps menu reads a cached payload; force it to re-read so
      // the new app is reachable immediately rather than next reload.
      await this.appsNav.whenLoaded(true);
      this.saved = result.created
        ? `Created "${body.name}" — it is in the Apps menu now.`
        : `Saved "${body.name}".`;
      if (this.isNew) {
        this.isNew = false;
        // Move to the edit URL so a refresh reopens this app. The
        // navigation re-runs ngOnInit, which would wipe the
        // just-set confirmation — carry it across and restore it,
        // or the save appears to have done nothing.
        const confirmation = this.saved;
        await this.router.navigate(['/apps/build', body.name],
          { replaceUrl: true });
        this.saved = confirmation;
      }
    } catch (e: any) {
      this.error = `Could not save: ${e?.message || 'request failed'}`;
    } finally {
      this.saving = false;
    }
  }

  // ---- deployment -------------------------------------------------

  private async loadTopologies(): Promise<void> {
    try {
      const envelope = await firstValueFrom(
        this.http.get<any>(this.url('/TopologyDefinition'),
          this.polariService.backendRequestOptions));
      const rows = envelope?.[0]?.['TopologyDefinition']?.[0]?.data ?? [];
      this.topologies = rows.map((r: any) => r?.name).filter(Boolean);
      const active = rows.find((r: any) => r?.is_active);
      this.topology = active?.name || this.topologies[0] || '';
    } catch {
      // Not fatal: without the list the section simply cannot plan,
      // and says so when you try.
      this.topologies = [];
    }
  }

  placedCount(): number {
    return (this.plan?.placements || [])
      .filter((p) => p.status === 'already-placed').length;
  }

  missingCount(): number {
    return (this.plan?.placements || [])
      .filter((p) => p.status === 'missing').length;
  }

  /** Apply is only meaningful when something is actually assignable.
   *  Every module already placed = nothing to do; a module missing
   *  from the image cannot be assigned at all. */
  canApply(): boolean {
    return (this.plan?.placements || [])
      .some((p) => p.status === 'needs-assignment');
  }

  async loadPlan(): Promise<void> {
    this.planning = true; this.planError = ''; this.applied = '';
    this.plan = null;
    try {
      if (!this.topology) {
        this.planError = 'No topology to plan against on this node.';
        return;
      }
      const result = await firstValueFrom(this.http.get<AppPlan>(
        this.url(`/api/apps/plan?name=${encodeURIComponent(this.draft.name)}`
          + `&topology=${encodeURIComponent(this.topology)}`),
        this.polariService.backendRequestOptions));
      if (!result?.ok) {
        this.planError = result?.error || 'The node could not plan this app.';
        return;
      }
      this.plan = result;
    } catch (e: any) {
      this.planError = `Could not plan: ${e?.message || 'request failed'}`;
    } finally {
      this.planning = false;
    }
  }

  async apply(): Promise<void> {
    this.applying = true; this.planError = ''; this.applied = '';
    try {
      // `confirm` is required by the endpoint — it refuses without
      // it, precisely so an apply cannot happen by accident. Pressing
      // this button IS the confirmation, after reading the plan above.
      const result = await firstValueFrom(this.http.post<any>(
        this.url('/api/apps/apply'),
        { name: this.draft.name, topology: this.topology, confirm: true },
        this.polariService.backendRequestOptions));
      if (!result?.ok) {
        this.planError = result?.refusal || result?.error
          || 'The node refused the apply.';
        return;
      }
      const created = (result.created || []).length;
      const skipped = (result.skipped || []).length;
      const receipt = `Wrote ${created} assignment row(s)`
        + (skipped ? `, skipped ${skipped} already present` : '')
        + `. Receipt: ${result.planReceipt || '(none)'}. `
        + 'Containers are NOT deployed — run `pol topology apply` '
        + 'when you are ready.';
      // The plan is now stale by construction; re-read it so the
      // table reflects what was just written. loadPlan() clears
      // `applied` (it is a fresh plan, not a fresh apply), so the
      // receipt is set AFTER it — otherwise a successful apply
      // silently shows nothing.
      await this.loadPlan();
      this.applied = receipt;
    } catch (e: any) {
      this.planError = `Could not apply: ${e?.message || 'request failed'}`;
    } finally {
      this.applying = false;
    }
  }
}
