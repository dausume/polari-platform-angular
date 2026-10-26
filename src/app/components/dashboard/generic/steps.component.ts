import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';
import { StepConfig, StepState, stepStates } from './class-rows-cards';

/**
 * wb-1 `steps`: an ordered step strip (done / current / todo) derived purely from page scope - no network. Inputs: { steps: StepConfig[] },
 * see class-rows-cards.ts. A click on a step with a `target` opens that page tab the way class-rows-table's rowLinkTabField does (`?tab=`).
 */
@Component({
  standalone: true,
  selector: 'steps',
  imports: [CommonModule],
  template: `
    <ol class="steps">
      <li *ngFor="let s of steps; let i = index" [class]="'step ' + states[i]" [attr.aria-current]="states[i] === 'current' ? 'step' : null">
        <button type="button" (click)="go(s)" [disabled]="!s.target">
          <span class="num">{{ states[i] === 'done' ? '✓' : i + 1 }}</span><span class="label">{{ s.label }}</span>
        </button>
      </li>
    </ol>`,
  styles: [`
    :host { display: block; container-type: inline-size; }
    .steps { display: flex; flex-wrap: wrap; gap: 8px; list-style: none; margin: 0; padding: 0; }
    .step button { display: flex; align-items: center; gap: 8px; font: inherit; padding: 4px 14px 4px 6px; border-radius: var(--radius-pill);
      border: 1px solid transparent; cursor: pointer; }
    .step button:disabled { cursor: default; }
    .step button:focus-visible { outline: 2px solid var(--nav-background); outline-offset: 2px; }
    .num { display: inline-grid; place-items: center; width: 1.6em; height: 1.6em; border-radius: 50%; font-weight: 700;
      background: var(--surface-primary); color: var(--text-on-card); }
    .step.done button { background: var(--step-done); color: var(--step-done-text); }
    .step.current button { background: var(--step-current); color: var(--step-current-text); font-weight: 600; }
    .step.todo button { background: var(--step-todo); color: var(--step-todo-text); border-color: var(--border-medium); }
    @container (max-width: 28rem) { .steps { flex-direction: column; } }
  `],
})
export class StepsComponent {
  @Input() steps: StepConfig[] = [];

  constructor(private router: Router) {}

  get states(): StepState[] { return stepStates(this.steps); }

  go(s: StepConfig): void {
    if (s.target) { void this.router.navigate([], { queryParams: { tab: s.target }, queryParamsHandling: 'merge' }); }
  }
}
