import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { TopologyService } from '@services/topology/topology.service';
import {
  OwnershipReport,
  OwnershipInstance,
  OwnedObject,
} from '@models/topology/topology-types';

/**
 * WHO HOLDS WHAT — objects, the instance responsible for them, and
 * the database that instance is bound to.
 *
 * The coherence chain Polari runs on, made visible:
 *
 *   object class -> the MODULE whose source defines it
 *                -> the PRF INSTANCE that module is assigned to
 *                -> the DATABASE that instance is bound to
 *
 * Data *about* an object, or displays over it, may live in other
 * modules that depend on the owner — but exactly one module is
 * responsible for the object itself. A class claimed by two is a
 * coherence fault and is shown as such, never silently merged.
 *
 * The storage view is grouped by what is genuinely shared. sqlite is
 * local to its instance by construction and can never be pointed
 * elsewhere, so it forms a group of one; a shared relational backend
 * puts every instance on it in one group, which is where a crowding
 * problem would come from.
 */
@Component({
  standalone: true,
  selector: 'object-ownership',
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
  <div class="own page-shell">
    <h2>Objects, instances and their databases</h2>
    <p class="hint prose-measure">
      One module is responsible for each object; the instance holding
      that module is responsible for it here; and that instance's
      database is where it lands. Data and displays <em>about</em> an
      object may live in other modules that depend on the owner — but
      responsibility for the object itself is singular. That is how
      coherence is kept.
    </p>

    <div class="err" *ngIf="error">{{ error }}</div>
    <div class="hint" *ngIf="loading">Resolving ownership…</div>

    <ng-container *ngIf="report as r">
      <!-- coherence faults first: they are the only real alarm -->
      <section class="card fault" *ngIf="r.contested.length">
        <h3>⚠ Coherence faults</h3>
        <p class="hint">A class defined by more than one module. Two
          modules both believing they own an object is how state
          diverges — this is not resolved automatically.</p>
        <div *ngFor="let c of r.contested">
          <code>{{ c.class }}</code> claimed by
          <b>{{ c.modules.join(', ') }}</b>
        </div>
      </section>

      <section class="card">
        <h3>Databases <span class="count">{{ r.storageGroups.length }}</span></h3>
        <p class="hint">Grouped by what is actually shared. A
          <code>sqlite</code> group is one instance by construction —
          it is that instance's own file and cannot point elsewhere.</p>
        <div class="scroll-x">
          <table class="data-table-dashed">
            <tr><th>storage</th><th>relational</th><th>shared</th>
              <th>instances</th><th class="num">objects</th>
              <th class="num">rows</th></tr>
            <tr *ngFor="let g of r.storageGroups"
                [class.dim]="!g.objectCount">
              <td><code>{{ g.identity }}</code></td>
              <td>{{ g.relational }}</td>
              <td>
                <span class="chip" [class.is-info]="g.shared">
                  {{ g.shared ? 'shared' : 'local' }}</span>
              </td>
              <td>{{ g.instances.join(', ') }}</td>
              <td class="num">{{ g.objectCount }}</td>
              <td class="num">{{ g.rowCount }}</td>
            </tr>
          </table>
        </div>
        <p class="hint">
          Only the <strong>relational</strong> store is required to be
          defined. Cache and blob tiers are not yet assignable to an
          instance — shown as absent rather than assumed.
        </p>
      </section>

      <section class="card">
        <h3>Who is responsible for what</h3>
        <div class="row">
          <input class="filter" [(ngModel)]="filter"
                 placeholder="filter by object or module…">
          <label class="inline">
            <input type="checkbox" [(ngModel)]="hideEmpty">
            hide instances holding nothing
          </label>
        </div>

        <div class="inst" *ngFor="let i of visibleInstances()">
          <div class="inst-head" (click)="toggle(i.instance)">
            <b>{{ i.instance }}</b>
            <span class="chip">{{ i.kind }}</span>
            <span class="chip is-info">{{ i.storage.relational }}</span>
            <span class="chip" *ngIf="i.machine">{{ i.machine }}</span>
            <span class="grow"></span>
            <span class="nums">{{ i.modules.length }} modules ·
              {{ i.objectCount }} objects · {{ i.rowCount }} rows</span>
            <span class="chev">{{ open[i.instance] ? '▾' : '▸' }}</span>
          </div>
          <div class="storage-note">{{ i.storage.note }}</div>

          <div *ngIf="open[i.instance]">
            <div class="hint" *ngIf="!i.objects.length">
              No objects — this instance holds no module that defines
              any.
            </div>
            <div class="scroll-x" *ngIf="i.objects.length">
              <table class="data-table-dashed">
                <tr><th>object</th><th>owning module</th>
                  <th class="num">rows</th></tr>
                <tr *ngFor="let o of matching(i.objects)">
                  <td><code>{{ o.class }}</code></td>
                  <td>{{ o.module }}</td>
                  <td class="num">{{ o.rows }}</td>
                </tr>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section class="card">
        <h3>Nobody is responsible for these
          <span class="count">{{ r.unassigned.length }}</span></h3>
        <p class="hint">Their owning module is on no instance in this
          topology. Not an error — the module simply is not deployed
          here — but nothing on this topology can serve them.</p>
        <div class="chip-row">
          <span class="chip" *ngFor="let u of firstFew(r.unassigned)">
            {{ u.class }} <em>{{ u.module }}</em></span>
          <span class="hint" *ngIf="r.unassigned.length > 24">
            + {{ r.unassigned.length - 24 }} more</span>
        </div>
      </section>

      <section class="card" *ngIf="r.orphans.length">
        <h3>Ownerless <span class="count">{{ r.orphans.length }}</span></h3>
        <p class="hint">Live rows exist, but neither a module nor the
          framework core defines the class. Worth looking at.</p>
        <div class="chip-row">
          <span class="chip is-warn" *ngFor="let o of r.orphans">
            {{ o.class }} <em>{{ o.rows }} rows</em></span>
        </div>
      </section>

      <section class="card">
        <h3>Framework core
          <span class="count">{{ r.coreObjects.length }}</span></h3>
        <p class="hint">Owned by the framework itself rather than any
          module, so they are not assignable and travel with every
          instance.</p>
        <div class="chip-row">
          <span class="chip" *ngFor="let c of firstFew(r.coreObjects)">
            {{ c.class }} <em>{{ c.package }} · {{ c.rows }}</em></span>
          <span class="hint" *ngIf="r.coreObjects.length > 24">
            + {{ r.coreObjects.length - 24 }} more</span>
        </div>
      </section>
    </ng-container>
  </div>
  `,
  styles: [`
    .own { color: var(--text-on-bg); }
    h2 { margin: 0 0 4px; }
    .hint { font-size: 12.5px; color: var(--text-on-bg-muted); margin: 4px 0 10px; }
    .card {
      background: var(--surface-primary); color: var(--text-on-card);
      border: 1px solid var(--border-medium);
      border-radius: var(--card-radius); padding: var(--card-pad);
      margin-bottom: var(--page-gap);
    }
    .card h3 { margin: 0 0 4px; font-size: 15px; }
    .card .hint { color: var(--text-on-card-muted); }
    .card.fault { border-color: var(--color-error-border);
      background: var(--color-error-bg); color: var(--color-error-text); }
    .count { font-size: 11px; font-weight: 400; margin-left: 6px;
      border: 1px solid var(--surface-outline); border-radius: 8px;
      padding: 0 6px; }
    .row { display: flex; gap: 12px; align-items: center;
      flex-wrap: wrap; margin-bottom: 8px; }
    .filter { min-width: min(260px, 100%); background: var(--surface-primary);
      color: var(--text-on-card); border: 1px solid var(--border-medium);
      border-radius: var(--radius-sm); padding: 5px 7px; font-size: 13px; }
    label.inline { display: flex; align-items: center; gap: 5px;
      font-size: 12px; color: var(--text-on-card-muted); }
    .inst { border: 1px solid var(--border-light);
      border-radius: var(--radius-md); padding: 8px 10px; margin: 8px 0; }
    .inst-head { display: flex; align-items: center; gap: 8px;
      flex-wrap: wrap; cursor: pointer; }
    .grow { flex: 1 1 auto; }
    .nums { font-size: 12px; color: var(--text-on-card-muted);
      font-variant-numeric: tabular-nums; }
    .chev { color: var(--text-on-card-muted); }
    .storage-note { font-size: 11.5px; color: var(--text-on-card-muted);
      margin: 3px 0 0 2px; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    tr.dim { opacity: 0.55; }
    .chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip em { font-style: normal; color: var(--text-tertiary);
      margin-left: 5px; font-size: 10px; }
    .err { background: var(--color-error-bg); color: var(--color-error-text);
      border: 1px solid var(--color-error-border);
      border-radius: var(--radius-md); padding: 8px 12px; }
  `],
})
export class ObjectOwnershipComponent implements OnInit {
  report: OwnershipReport | null = null;
  loading = true;
  error = '';
  filter = '';
  hideEmpty = true;
  open: Record<string, boolean> = {};

  constructor(private topologyService: TopologyService) {}

  async ngOnInit(): Promise<void> {
    const result = await this.topologyService.objectOwnership();
    this.loading = false;
    if (!result) {
      this.error = 'Could not reach the topology API.';
      return;
    }
    if (!result.ok) {
      this.error = result.error || 'Could not resolve ownership.';
      return;
    }
    this.report = result;
    // Open whichever instance actually holds the most — the one a
    // reader came here to look at.
    const busiest = [...result.instances]
      .sort((a, b) => b.objectCount - a.objectCount)[0];
    if (busiest?.objectCount) { this.open[busiest.instance] = true; }
  }

  toggle(instance: string): void {
    this.open[instance] = !this.open[instance];
  }

  visibleInstances(): OwnershipInstance[] {
    const all = this.report?.instances || [];
    return this.hideEmpty ? all.filter((i) => i.objectCount > 0) : all;
  }

  matching(objects: OwnedObject[]): OwnedObject[] {
    const f = this.filter.trim().toLowerCase();
    if (!f) { return objects; }
    return objects.filter((o) =>
      o.class.toLowerCase().includes(f)
      || o.module.toLowerCase().includes(f));
  }

  /** The lists of unowned/core classes run to the hundreds; showing
   *  every one buries the page. The count is always stated. */
  firstFew<T>(list: T[]): T[] {
    return (list || []).slice(0, 24);
  }
}
