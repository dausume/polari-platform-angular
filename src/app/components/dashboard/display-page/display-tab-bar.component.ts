import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

/** fsc-3: the tab strip of a tabbed configured page (see utils/display-tabs.ts). A tab is a PLACE, not a selection: clicking the open tab does nothing. */
@Component({
  standalone: true,
  selector: 'display-tab-bar',
  imports: [CommonModule],
  template: `
    <div class="tabs" role="tablist" aria-label="Page tabs">
      <button *ngFor="let t of tabs" type="button" role="tab" class="tab"
              [class.active]="t.key === active" [attr.aria-selected]="t.key === active"
              [title]="t.title" (click)="choose(t.key)">{{ t.title }}</button>
    </div>
  `,
  styles: [`
    :host { display: block; container-type: inline-size; }
    .tabs { display: flex; flex-wrap: wrap; gap: 2px 4px; border-bottom: 1px solid var(--border-medium); margin-bottom: 10px; }   /* wraps onto more lines, so no tab is ever clipped or hidden off to the side */
    .tab { font: inherit; flex: 0 0 auto; background: transparent; border: 0; border-bottom: 2px solid transparent; padding: 8px 12px; color: var(--text-on-card-muted); cursor: pointer; white-space: nowrap; }
    .tab:hover { background: var(--surface-hover); }
    .tab.active { color: var(--text-on-card); border-bottom-color: var(--primary-color); font-weight: 600; }
    .tab:focus-visible { outline: 2px solid var(--primary-color); outline-offset: -2px; }
    @container (max-width: 560px) { .tab { padding: 10px 10px; font-size: 0.92em; } .tabs { gap: 0 2px; } }
  `],
})
export class DisplayTabBarComponent {
  @Input() tabs: { key: string; title: string }[] = [];
  @Input() active = '';
  @Output() selected = new EventEmitter<string>();

  choose(key: string): void {
    if (key !== this.active) { this.selected.emit(key); }
  }
}
