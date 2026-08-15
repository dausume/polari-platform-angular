import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';
import {
  AppNav, AppNavItem, AppsNavService,
} from '@services/apps-nav.service';

/**
 * nav-3: /app/:name — an app's home. Title, use-case, personas, the
 * full menu as cards, and a per-module status strip. Renders in
 * FULL even when every module is absent (nav-6): the structure and
 * the bring-online path ARE the content on such an instance.
 */
@Component({
  standalone: true,
  selector: 'app-home',
  imports: [CommonModule, MatIconModule, MatTooltipModule],
  template: `
  <div class="ah-page" *ngIf="app; else missing">
    <div class="ah-head">
      <h2>{{ app.title }}</h2>
      <button class="ah-chip persona" *ngFor="let p of app.personas"
              matTooltip="see every app for this persona"
              (click)="router.navigate(['/apps'],
                       { queryParams: { persona: p } })">
        {{ p }}</button>
    </div>
    <p class="ah-usecase">{{ app.useCase }}</p>

    <!-- sep-4 (decision 9): the engine's second nature — its data
         page (placement, reachability, usage) rides the same tile. -->
    <button class="ah-chip engine" *ngIf="app.enginePage"
            matTooltip="where this engine lives, whether it is
              reachable, and what flows through it"
            (click)="go(app.enginePage!)">
      <mat-icon inline>memory</mat-icon> engine data page</button>

    <div class="ah-modstrip" *ngIf="app.modules.length">
      <span class="ah-mod" *ngFor="let m of moduleStates"
            [class.on]="m.state === 'enabled'"
            [class.off]="m.state === 'absent'"
            [matTooltip]="m.state === 'absent'
              ? 'not enabled here — click to bring online'
              : 'module ' + m.state"
            (click)="m.state === 'absent' && go('/modules/bringup')">
        <mat-icon>{{ m.state === 'enabled' ? 'check_circle'
          : m.state === 'absent' ? 'power_off' : 'help' }}</mat-icon>
        {{ m.name }}
      </span>
    </div>

    <div class="ah-cards">
      <div class="ah-card" *ngFor="let g of app.nav">
        <div class="ah-card-head">{{ g.group }}
          <span class="ah-chip" *ngIf="g.topMenu">top bar</span>
        </div>
        <div class="ah-item" *ngFor="let it of g.items"
             [class.absent]="it.availability === 'absent'"
             (click)="open(it)">
          <span class="ah-label">{{ it.label }}</span>
          <span class="ah-chip kind">{{ it.kind }}</span>
          <span class="ah-chip off"
                *ngIf="it.availability === 'absent'">
            bring online</span>
          <span class="ah-chip unk"
                *ngIf="it.availability === 'unknown'">?</span>
        </div>
      </div>
    </div>
    <p class="ah-note" *ngIf="app.navSynthesized">
      This app has no nav rows yet — the menu above is derived from
      its front-door pages.</p>
  </div>
  <ng-template #missing>
    <div class="ah-page">
      <h2>App not found</h2>
      <p class="ah-usecase">{{ refusal ||
        'No app by that name on this instance.' }}</p>
      <button class="ah-back" (click)="go('/apps')">
        all apps</button>
    </div>
  </ng-template>
  `,
  styles: [`
    .ah-page { padding: 18px 24px; color: var(--text-on-bg); }
    .ah-head { display: flex; align-items: baseline; gap: 8px;
      flex-wrap: wrap; }
    .ah-head h2 { margin: 0 8px 0 0; }
    .ah-usecase { color: var(--text-on-bg-muted,
      var(--text-on-card-muted)); max-width: 70em; }
    .ah-chip { font-size: 0.72em; border: 1px solid
      var(--surface-outline, #8884); border-radius: 9px;
      padding: 1px 8px; color: var(--text-on-bg-muted,
      var(--text-on-card-muted)); }
    .ah-chip.persona { color: var(--text-on-bg);
      background: transparent; cursor: pointer; }
    .ah-chip.persona:hover { background:
      var(--surface-hover, #8882); }
    .ah-modstrip { display: flex; gap: 10px; flex-wrap: wrap;
      margin: 10px 0 4px; }
    .ah-mod { display: inline-flex; align-items: center; gap: 4px;
      font-size: 0.85em; border: 1px solid
      var(--surface-outline, #8884); border-radius: 14px;
      padding: 2px 10px; color: var(--text-on-bg); }
    .ah-mod mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .ah-mod.on mat-icon { color: #2e9e44; }
    .ah-mod.off { cursor: pointer; }
    .ah-mod.off mat-icon { color: #c98a00; }
    .ah-cards { display: flex; gap: 16px; flex-wrap: wrap;
      margin-top: 14px; }
    .ah-card { border: 1px solid var(--surface-outline, #8884);
      border-radius: 8px; background: var(--surface-primary);
      color: var(--text-on-card); min-width: 240px;
      max-width: 340px; flex: 1 1 260px; padding: 10px 0; }
    .ah-card-head { font-weight: 600; padding: 2px 14px 8px;
      display: flex; align-items: center; gap: 8px; }
    .ah-item { display: flex; align-items: center; gap: 8px;
      padding: 6px 14px; cursor: pointer; font-size: 0.92em; }
    .ah-item:hover { background: var(--surface-hover, #8882); }
    .ah-item.absent .ah-label { opacity: 0.65; }
    .ah-label { flex: 1 1 auto; }
    .ah-chip.off { color: #c98a00; border-color: #c98a0088; }
    .ah-back { margin-top: 8px; border: 1px solid
      var(--surface-outline, #8884); background:
      var(--surface-primary); color: var(--text-on-card);
      border-radius: 6px; padding: 6px 14px; cursor: pointer; }
  `],
})
export class AppHomeComponent implements OnInit, OnDestroy {
  app: AppNav | null = null;
  refusal = '';
  moduleStates: { name: string;
                  state: 'enabled' | 'absent' | 'unknown' }[] = [];
  private subs: Subscription[] = [];

  constructor(private route: ActivatedRoute,
              public router: Router,
              private appsNav: AppsNavService) {}

  ngOnInit(): void {
    this.appsNav.ensureLoaded();
    this.subs.push(this.route.paramMap.subscribe(() => this.bind()));
    this.subs.push(this.appsNav.payload$.subscribe(() => this.bind()));
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  private bind(): void {
    const name = this.route.snapshot.paramMap.get('name') || '';
    const payload = this.appsNav.payload$.value;
    this.refusal = payload?.refusal || '';
    this.app = this.appsNav.appByName(name);
    this.moduleStates = (this.app?.modules ?? []).map(m => ({
      name: m,
      state: this.app?.moduleStates?.[m] ?? 'unknown',
    }));
  }

  open(it: AppNavItem): void {
    if (it.availability === 'absent') {
      this.go(it.bringup?.route || '/modules/bringup');
    } else if (it.kind === 'tech-node' && it.ref) {
      this.router.navigate(['/tech-tree'],
                           { queryParams: { node: it.ref } });
    } else if (it.route) {
      this.go(it.route);
    }
  }

  go(route: string): void { this.router.navigateByUrl(route); }
}
