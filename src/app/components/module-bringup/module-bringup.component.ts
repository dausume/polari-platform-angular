import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { ModuleStatusService } from '@services/module-status.service';
import { StompService } from '@services/stomp.service';

/**
 * mlb-4: the boot bring-up panel (/modules/bringup).
 *
 * Module tiles go pending → loading → online/failed/blocked in real
 * time (STOMP push on PolariModule transitions + a poll fallback),
 * with overall progress, time-to-core / time-to-full, and — when
 * ModuleBootRecord history exists for a module — an honest ETA while
 * it loads. No history = no ETA shown, never a guess. Works on any
 * boot: a monolithic boot renders as "everything online"; a restart
 * shows the catch-up live.
 */
@Component({
  standalone: true,
  selector: 'module-bringup',
  imports: [CommonModule, RouterModule],
  template: `
  <div class="bringup">
    <h2>Module bring-up</h2>
    <p class="hint">Two-phase boot: the core answers first, modules
      come online dependency-ordered. Time-to-online is tracked per
      module (after its dependencies) — ETAs come from prior boots'
      records, so a module with no history honestly shows none.</p>

    <div class="summary" *ngIf="status">
      <span class="chip" [class.on]="phase === 'online'"
            [class.warn]="phase !== 'online'">{{ phase }}</span>
      <span *ngIf="status.lazyBoot === false" class="muted">
        monolithic boot — everything was online at listen</span>
      <span *ngIf="status.secondsToCore != null">core ready in
        <b>{{ status.secondsToCore | number:'1.1-1' }}s</b></span>
      <span *ngIf="status.secondsToFull != null">· fully online in
        <b>{{ status.secondsToFull | number:'1.1-1' }}s</b></span>
      <span *ngIf="status.moduleCount">·
        {{ status.onlineCount }}/{{ status.moduleCount }} modules
        ({{ status.percentOnline | number:'1.0-0' }}%)</span>
    </div>
    <div class="bar" *ngIf="status?.moduleCount">
      <div class="fill" [style.width.%]="status.percentOnline"></div>
    </div>

    <div class="tiles">
      <div class="tile" *ngFor="let m of moduleList"
           [attr.class]="'tile st-' + m.row.status">
        <div class="tile-head">
          <b>{{ m.name }}</b>
          <span class="chip">{{ m.row.status }}</span>
        </div>
        <div class="tile-body">
          <span *ngIf="m.row.deps?.length" class="deps">needs:
            {{ m.row.deps.join(', ') }}</span>
          <span *ngIf="m.row.status === 'loading'">
            <ng-container *ngIf="m.row.eta_s != null; else noEta">
              ~{{ m.row.eta_s | number:'1.0-1' }}s expected
              (from prior boots)</ng-container>
            <ng-template #noEta>no prior boots recorded —
              no ETA</ng-template>
          </span>
          <span *ngIf="m.row.status === 'online' && duration(m.row)
                 != null">
            online in {{ duration(m.row) | number:'1.1-1' }}s after
            deps</span>
          <span *ngIf="m.row.error" class="err">{{ m.row.error }}</span>
        </div>
      </div>
    </div>
    <p *ngIf="!moduleList.length && status" class="muted">
      No per-module lifecycle rows — this backend booted
      monolithically (POLARI_LAZY_BOOT=off).</p>

    <p class="links">
      <a routerLink="/topology">Topology</a> ·
      <a routerLink="/module-management">Module management</a></p>
  </div>`,
  styles: [`
    :host { display: block; color: var(--text-on-bg); }
    .bringup { max-width: 900px; margin: 0 auto; padding: 12px; }
    .hint { font-size: 12px; color: var(--text-on-bg-muted); }
    .summary { display: flex; gap: 10px; align-items: center;
      flex-wrap: wrap; font-size: 13px; margin: 8px 0; }
    .chip { font-size: 10px; padding: 2px 8px; border-radius: 10px;
      border: 1px solid var(--border-light);
      background: var(--surface-primary);
      color: var(--text-on-card); }
    .chip.on { background: #2e7d32; color: #fff; border: none; }
    .chip.warn { background: #f9a825; color: #000; border: none; }
    .bar { height: 8px; border-radius: 4px; overflow: hidden;
      background: var(--surface-primary);
      border: 1px solid var(--border-light); margin-bottom: 12px; }
    .fill { height: 100%; background: #2e7d32;
      transition: width .4s; }
    .tiles { display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 8px; }
    .tile { border: 1px solid var(--border-light); border-radius: 8px;
      padding: 8px 10px; background: var(--surface-primary);
      color: var(--text-on-card); }
    .tile-head { display: flex; justify-content: space-between;
      align-items: center; gap: 6px; }
    .tile-body { font-size: 11px; margin-top: 4px; display: flex;
      flex-direction: column; gap: 2px;
      color: var(--text-on-card-muted); }
    .st-online { border-left: 4px solid #2e7d32; }
    .st-loading { border-left: 4px solid #f9a825; }
    .st-pending { border-left: 4px solid var(--border-light);
      opacity: .85; }
    .st-failed { border-left: 4px solid #c62828; }
    .st-blocked { border-left: 4px solid #6d1b1b; }
    .st-disabled { opacity: .5; border-style: dashed; }
    .err { color: #c62828; }
    .muted { color: var(--text-on-bg-muted); }
    .links { font-size: 12px; margin-top: 14px; }
    .links a { color: var(--accent-primary, #3949ab); }
  `],
})
export class ModuleBringupComponent implements OnInit, OnDestroy {
  status: any = null;
  private timer: any = null;
  private stompSub: Subscription | null = null;

  constructor(private moduleStatus: ModuleStatusService,
              private stomp: StompService) {}

  ngOnInit(): void {
    this.refresh();
    // Poll fallback (STOMP is push-first when connected).
    this.timer = setInterval(() => this.refresh(), 4000);
    try {
      this.stompSub = this.stomp.watchTopic('PolariModule')
        .subscribe(() => this.refresh());
    } catch { /* push unavailable — polling covers it */ }
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.stompSub?.unsubscribe();
  }

  refresh(): void {
    this.moduleStatus.modulesStatus().then((r) => {
      if (r) this.status = r;
      // Once everything is online the poll can slow way down.
      if (r?.finishedAt && this.timer) {
        clearInterval(this.timer);
        this.timer = setInterval(() => this.refresh(), 30000);
      }
    });
  }

  get phase(): string {
    if (!this.status) return 'connecting';
    if (this.status.lazyBoot === false) return 'online';
    if (this.status.finishedAt) return 'online';
    if (this.status.coreReadyAt) return 'admitting modules';
    return 'core boot';
  }

  get moduleList(): { name: string; row: any }[] {
    const mods = this.status?.modules || {};
    const order: Record<string, number> = {
      loading: 0, pending: 1, failed: 2, blocked: 3, online: 4,
      disabled: 5,
    };
    return Object.keys(mods)
      .map((name) => ({ name, row: mods[name] }))
      .sort((a, b) =>
        (order[a.row.status] ?? 9) - (order[b.row.status] ?? 9)
        || a.name.localeCompare(b.name));
  }

  duration(row: any): number | null {
    if (row.finished_at && row.deps_ready_at) {
      return row.finished_at - row.deps_ready_at;
    }
    return null;
  }
}
