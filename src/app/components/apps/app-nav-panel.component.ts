import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AppNav, AppNavItem } from '@services/apps-nav.service';

/**
 * nav-3: an app's OWN side menu, rendered from its nav_json rows.
 * The complete map always shows — an item whose module is absent is
 * kept, marked, and leads to /modules/bringup (never hidden); an
 * unknown item says so. Used inside the shell side nav whenever a
 * route sits in an app's territory, above the collapsible core nav.
 */
@Component({
  standalone: true,
  selector: 'app-nav-panel',
  imports: [CommonModule, MatIconModule, MatTooltipModule],
  template: `
  <div class="anp" *ngIf="app">
    <div class="anp-head" (click)="go('/app/' + app.name)">
      <mat-icon class="anp-icon">apps</mat-icon>
      <span class="anp-title">{{ app.title }}</span>
    </div>
    <div class="anp-group" *ngFor="let g of app.nav">
      <div class="anp-group-label">
        {{ g.group }}
        <mat-icon *ngIf="g.topMenu" class="anp-top-chip"
                  matTooltip="also in the top bar">north</mat-icon>
      </div>
      <div class="anp-item" *ngFor="let it of g.items"
           [class.absent]="it.availability === 'absent'"
           [class.unknown]="it.availability === 'unknown'"
           (click)="open(it)">
        <mat-icon class="anp-kind">{{ kindIcon(it) }}</mat-icon>
        <span class="anp-label">{{ it.label }}</span>
        <span class="anp-chip" *ngIf="it.availability === 'absent'"
              [matTooltip]="bringupHint(it)">bring online</span>
        <span class="anp-chip unk"
              *ngIf="it.availability === 'unknown'"
              matTooltip="module gating unreadable here">?</span>
      </div>
    </div>
    <div class="anp-note" *ngIf="app.navSynthesized">
      menu derived from the app's pages (no nav rows yet)</div>
  </div>
  `,
  styles: [`
    .anp { padding: 4px 0 8px; }
    .anp-head { display: flex; align-items: center; gap: 6px;
      padding: 8px 14px; cursor: pointer; font-weight: 600;
      color: var(--text-on-card); }
    .anp-head:hover { background: var(--surface-hover, #8882); }
    .anp-icon { font-size: 20px; width: 20px; height: 20px; }
    .anp-group-label { padding: 8px 14px 2px; font-size: 0.72em;
      text-transform: uppercase; letter-spacing: 0.08em;
      color: var(--text-on-card-muted); display: flex;
      align-items: center; gap: 4px; }
    .anp-top-chip { font-size: 12px; width: 12px; height: 12px; }
    .anp-item { display: flex; align-items: center; gap: 8px;
      padding: 6px 14px 6px 22px; cursor: pointer;
      color: var(--text-on-card); font-size: 0.92em; }
    .anp-item:hover { background: var(--surface-hover, #8882); }
    .anp-kind { font-size: 16px; width: 16px; height: 16px;
      color: var(--text-on-card-muted); }
    .anp-label { flex: 1 1 auto; overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap; }
    .anp-chip { font-size: 0.72em; border: 1px solid
      var(--surface-outline, #8884); border-radius: 9px;
      padding: 0 6px; color: var(--text-on-card-muted); }
    .anp-item.absent .anp-label { opacity: 0.65; }
    .anp-item.absent .anp-chip { color: #c98a00;
      border-color: #c98a0088; }
    .anp-item.unknown .anp-label { opacity: 0.65; }
    .anp-note { padding: 6px 14px; font-size: 0.78em;
      color: var(--text-on-card-muted); font-style: italic; }
  `],
})
export class AppNavPanelComponent {
  @Input() app: AppNav | null = null;

  constructor(private router: Router) {}

  kindIcon(it: AppNavItem): string {
    switch (it.kind) {
      case 'simspace': return 'view_in_ar';
      case 'view': return 'dashboard';
      case 'tech-node': return 'account_tree';
      default: return 'description';
    }
  }

  bringupHint(it: AppNavItem): string {
    const chain = it.bringup?.requires?.length
      ? ` (requires ${it.bringup.requires.join(' → ')})` : '';
    return `module '${it.requiresModule}' is not enabled here — ` +
      `open the bringup panel${chain}`;
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

  go(route: string): void {
    this.router.navigateByUrl(route);
  }
}
