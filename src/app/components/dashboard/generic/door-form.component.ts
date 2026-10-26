import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PolariService } from '@services/polari-service';
import { DisplayEventsService } from '@services/no-code-services/display-events.service';
import { RowActionConfig } from './class-rows-action';
import { runRowAction } from './class-rows-action-run';

/** One typed input of a `door-form`. `name` is the key the action's body_template refers to as `{name}`. */
export interface DoorFormField {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'textarea';
  placeholder?: string;
  required?: boolean;
}

/**
 * wb-3 `door-form`: a small configured form that POSTs/PUTs its values to ONE door through the shared action runner — the same
 * RowActionConfig a table row button uses, with the typed inputs as the "row". A `form` display item runs a no-code solution (a
 * different contract), so creating a row from a page (a Bench, a Mission) had no configured way until this.
 * JSON shape (a `component` item):
 *   { "componentName": "door-form", "inputs": {
 *       "fields": [{"name": "name", "label": "Bench name", "required": true}, {"name": "title", "label": "Title"},
 *                  {"name": "notes", "label": "Notes", "type": "textarea"}],
 *       "action": {"label": "Create", "path": "/api/board/benches", "body_template": {"name": "{name}", "title": "{title}", "notes": "{notes}"},
 *                  "then_scope": {"key": "bench", "from": "name"}},
 *       "submit_label": "Create the bench", "success_text": "Created." } }
 * On success the runner sets `then_scope` and bumps `rev` (tables reload) and the inputs clear; a refusal/failure shows its words
 * under the form, inputs kept. Required fields block submit while empty. Pure presentation otherwise: no page-specific logic.
 */
@Component({
  standalone: true,
  selector: 'door-form',
  imports: [CommonModule, FormsModule],
  template: `
    <form class="door-form" (ngSubmit)="submit()" novalidate>
      <label *ngFor="let f of fields" class="field">
        <span class="name">{{ f.label }}<span *ngIf="f.required" class="req" aria-hidden="true"> *</span></span>
        <textarea *ngIf="f.type === 'textarea'; else line" [name]="f.name" [(ngModel)]="values[f.name]" [placeholder]="f.placeholder || ''" rows="3"></textarea>
        <ng-template #line>
          <input [type]="f.type === 'number' ? 'number' : 'text'" [name]="f.name" [(ngModel)]="values[f.name]" [placeholder]="f.placeholder || ''">
        </ng-template>
      </label>
      <div class="row">
        <button type="submit" class="act" [disabled]="busy || !complete">{{ submit_label || action?.label || 'Submit' }}</button>
        <span class="msg" [class.bad]="!ok" *ngIf="message">{{ message }}</span>
      </div>
    </form>`,
  styles: [`
    :host { display: block; container-type: inline-size; }
    .door-form { display: grid; gap: 10px; max-width: 36rem; }
    .field { display: grid; gap: 4px; }
    .name { font-size: 0.9em; color: var(--text-secondary); }
    .req { color: var(--brand-orange); }
    input, textarea { font: inherit; padding: 6px 10px; border-radius: var(--radius-sm, 6px); border: 1px solid var(--border-medium);
      background: var(--surface-primary); color: var(--text-on-card); }
    input:focus-visible, textarea:focus-visible { outline: 2px solid var(--nav-background); outline-offset: 1px; }
    .row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    button.act { font: inherit; padding: 6px 18px; border-radius: var(--radius-pill); cursor: pointer;
      border: 1px solid var(--nav-background); background: var(--nav-background); color: var(--nav-text); }
    button.act:disabled { opacity: 0.55; cursor: default; }
    .msg { font-size: 0.9em; color: var(--step-done-text); background: var(--step-done); padding: 2px 10px; border-radius: var(--radius-pill); }
    .msg.bad { color: var(--text-secondary); background: var(--surface-secondary); }
    @container (max-width: 24rem) { .row { flex-direction: column; align-items: stretch; } }
  `],
})
export class DoorFormComponent {
  @Input() fields: DoorFormField[] = [];
  @Input() action: RowActionConfig | null = null;
  @Input() submit_label = '';
  @Input() success_text = 'Done.';

  values: Record<string, string> = {};
  message = '';
  ok = true;
  busy = false;

  constructor(private http: HttpClient, private polari: PolariService, private events: DisplayEventsService) {}

  /** every required field has a non-blank value */
  get complete(): boolean {
    return this.fields.every((f) => !f.required || String(this.values[f.name] ?? '').trim() !== '');
  }

  submit(): void {
    if (!this.action || !this.complete || this.busy) { return; }
    this.busy = true;
    const row: Record<string, string> = {};
    for (const f of this.fields) { row[f.name] = String(this.values[f.name] ?? '').trim(); }
    runRowAction(this.http, this.polari, this.events, this.action, row).subscribe((out) => {
      this.busy = false;
      this.ok = out.ok;
      this.message = out.ok ? this.success_text : out.message;
      if (out.ok) { this.values = {}; }
    });
  }
}
