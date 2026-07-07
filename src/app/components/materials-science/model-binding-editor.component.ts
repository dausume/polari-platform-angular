import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

/** The three binding kinds a model slot accepts (+ bare literal). */
export type BindingValue =
  | number | string | null
  | { kind: 'value'; value: unknown }
  | { kind: 'objectRef'; className: string; name: string; path: string }
  | { kind: 'stageDerived'; stage: string; key: string };

/**
 * One model-slot editor: literal value | object reference (live row +
 * dotted path) | stage-derived key. The object-coherence surface —
 * choosing objectRef means the model reads the LIVE row at every
 * execution.
 */
@Component({
  standalone: true,
  selector: 'model-binding-editor',
  imports: [CommonModule, FormsModule, MatIconModule, MatTooltipModule],
  template: `
    <div class="binding">
      <select class="kind" [(ngModel)]="mode" (ngModelChange)="emit()">
        <option value="value">literal</option>
        <option value="objectRef">object ref</option>
        <option value="stageDerived">stage derived</option>
      </select>
      <ng-container [ngSwitch]="mode">
        <input *ngSwitchCase="'value'" class="val"
               [placeholder]="placeholder" [(ngModel)]="literal"
               (ngModelChange)="emit()">
        <span *ngSwitchCase="'objectRef'" class="ref-fields">
          <input class="cls" placeholder="class"
                 matTooltip="e.g. MaterialScaleDefinition"
                 [(ngModel)]="className" (ngModelChange)="emit()">
          <input class="row" placeholder="row name"
                 [(ngModel)]="rowName" (ngModelChange)="emit()">
          <input class="path" placeholder="path (dotted, JSON blobs ok)"
                 matTooltip="e.g. parameters_json.inputs.matrixK — the
                   model reads the LIVE row at every execution"
                 [(ngModel)]="path" (ngModelChange)="emit()">
        </span>
        <span *ngSwitchCase="'stageDerived'" class="ref-fields">
          <input class="row" placeholder="stage key"
                 [(ngModel)]="stage" (ngModelChange)="emit()">
          <input class="path" placeholder="derived key (e.g. model.effectiveK)"
                 [(ngModel)]="derivedKey" (ngModelChange)="emit()">
        </span>
      </ng-container>
    </div>
  `,
  styles: [`
    .binding { display: flex; gap: 6px; align-items: center;
               flex-wrap: wrap; }
    select.kind, input {
      border: 1px solid var(--border-light, #ccc); border-radius: 6px;
      padding: 4px 7px; font-size: 12.5px;
      background: var(--surface-primary, #fff);
    }
    select.kind { font-size: 11.5px; color: var(--text-secondary, #666); }
    .val { width: 130px; }
    .ref-fields { display: flex; gap: 4px; flex-wrap: wrap; }
    .cls { width: 180px; } .row { width: 190px; } .path { width: 240px; }
  `],
})
export class ModelBindingEditorComponent implements OnChanges {
  @Input() value: BindingValue = null;
  @Input() placeholder = 'value';
  @Output() valueChange = new EventEmitter<BindingValue>();

  mode: 'value' | 'objectRef' | 'stageDerived' = 'value';
  literal = '';
  className = '';
  rowName = '';
  path = '';
  stage = '';
  derivedKey = '';

  ngOnChanges(): void {
    const v = this.value as any;
    if (v && typeof v === 'object' && v.kind === 'objectRef') {
      this.mode = 'objectRef';
      this.className = v.className ?? '';
      this.rowName = v.name ?? '';
      this.path = v.path ?? '';
    } else if (v && typeof v === 'object' && v.kind === 'stageDerived') {
      this.mode = 'stageDerived';
      this.stage = v.stage ?? '';
      this.derivedKey = v.key ?? '';
    } else {
      this.mode = 'value';
      const literal = (v && typeof v === 'object' && v.kind === 'value')
        ? v.value : v;
      this.literal = literal === null || literal === undefined
        ? '' : String(literal);
    }
  }

  emit(): void {
    if (this.mode === 'objectRef') {
      this.valueChange.emit({ kind: 'objectRef',
                              className: this.className,
                              name: this.rowName, path: this.path });
    } else if (this.mode === 'stageDerived') {
      this.valueChange.emit({ kind: 'stageDerived', stage: this.stage,
                              key: this.derivedKey });
    } else {
      const n = Number(this.literal);
      this.valueChange.emit(
        this.literal !== '' && !Number.isNaN(n) ? n : this.literal);
    }
  }
}
