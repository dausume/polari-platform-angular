// Author: Dustin Etts
// Custom overlay for the SolutionInvocation state — the composition
// primitive. Pick a solution, map this context's values into its
// declared inputs, and bind its outputs back into context variables.
// The invoked solution's contract is the whole interface; its internals
// stay its own (the engine runs it in an isolated context).

import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { StateOverlayBase } from '../../../_shared/state-overlay/state-overlay-base';

interface InputMappingRow {
  param: string;
  kind: 'variable' | 'literal';
  value: string;
}

interface ResultBindingRow {
  output: string;      // 'return' or a named callee output
  contextVar: string;  // caller variable it lands in
}

@Component({
  standalone: false,
  selector: 'solution-invocation-overlay',
  template: `
    <div class="solinv-overlay" (mousedown)="$event.stopPropagation()">
      <div class="solinv-title">
        <span class="material-icons solinv-icon">account_tree</span>
        Invoke solution
      </div>

      <select class="solinv-select" [(ngModel)]="solutionRef" (ngModelChange)="emitChange()">
        <option value="" disabled>Pick a solution…</option>
        <option *ngFor="let s of availableSolutions" [value]="s.name">{{ s.name }}</option>
      </select>

      <div class="solinv-section">
        Inputs <span class="solinv-hint">(what it needs, from this context)</span>
        <button class="solinv-add" (click)="addInput()" title="Add input mapping">+</button>
      </div>
      <div class="solinv-row" *ngFor="let m of inputRows; let i = index">
        <input class="solinv-field" placeholder="param" [(ngModel)]="m.param" (ngModelChange)="emitChange()" />
        <select class="solinv-kind" [(ngModel)]="m.kind" (ngModelChange)="emitChange()">
          <option value="variable">var</option>
          <option value="literal">lit</option>
        </select>
        <input class="solinv-field" [placeholder]="m.kind === 'variable' ? 'context variable' : 'literal value'"
               [(ngModel)]="m.value" (ngModelChange)="emitChange()" />
        <button class="solinv-del" (click)="inputRows.splice(i, 1); emitChange()" title="Remove">×</button>
      </div>

      <div class="solinv-section">
        Outputs <span class="solinv-hint">(what it returns, into your variables)</span>
        <button class="solinv-add" (click)="addBinding()" title="Add result binding">+</button>
      </div>
      <div class="solinv-row" *ngFor="let b of bindingRows; let i = index">
        <input class="solinv-field" placeholder="return" [(ngModel)]="b.output" (ngModelChange)="emitChange()" />
        <span class="solinv-arrow">→</span>
        <input class="solinv-field" placeholder="context variable" [(ngModel)]="b.contextVar" (ngModelChange)="emitChange()" />
        <button class="solinv-del" (click)="bindingRows.splice(i, 1); emitChange()" title="Remove">×</button>
      </div>
    </div>
  `,
  styles: [`
    .solinv-overlay {
      font-size: 10px; background: #fff; border-radius: 6px; padding: 6px;
      border: 1px solid #c5cae9; width: 100%; box-sizing: border-box;
      max-height: 100%; overflow-y: auto;
    }
    .solinv-title { font-weight: 600; color: #3F51B5; display: flex; align-items: center; gap: 3px; margin-bottom: 4px; }
    .solinv-icon { font-size: 12px; }
    .solinv-select { width: 100%; font-size: 10px; margin-bottom: 4px; }
    .solinv-section { font-weight: 600; margin: 4px 0 2px; color: #555; display: flex; align-items: center; gap: 4px; }
    .solinv-hint { font-weight: 400; color: #999; font-size: 9px; }
    .solinv-add, .solinv-del {
      border: none; background: #e8eaf6; color: #3F51B5; border-radius: 3px;
      cursor: pointer; font-size: 10px; line-height: 1; padding: 1px 5px;
    }
    .solinv-del { background: #fce4ec; color: #c2185b; }
    .solinv-row { display: flex; align-items: center; gap: 3px; margin-bottom: 2px; }
    .solinv-field { flex: 1; min-width: 0; font-size: 10px; }
    .solinv-kind { font-size: 10px; }
    .solinv-arrow { color: #999; }
  `]
})
export class SolutionInvocationOverlayComponent extends StateOverlayBase implements OnInit {

  @Input() boundClassName: string = 'SolutionInvocation';
  @Input() availableSolutions: { id: number; name: string }[] = [];
  @Input() boundObjectFieldValues: { [key: string]: any } = {};

  @Output() invocationChanged = new EventEmitter<{
    solutionRef: string;
    inputMappings: any[];
    resultBindings: any[];
  }>();

  solutionRef: string = '';
  inputRows: InputMappingRow[] = [];
  bindingRows: ResultBindingRow[] = [];

  override ngOnInit(): void {
    super.ngOnInit();
    const fv = this.boundObjectFieldValues || {};
    this.solutionRef = fv['solutionRef'] || '';
    this.inputRows = (fv['inputMappings'] || []).map((m: any) => {
      const src = m?.valueSource || {};
      if (src.sourceType === 'direct_assignment') {
        return { param: m.param || '', kind: 'literal' as const, value: String(src.directValue ?? '') };
      }
      return {
        param: m?.param || '',
        kind: 'variable' as const,
        value: src.sourceObjectPath || src.inputVariableName || '',
      };
    });
    this.bindingRows = (fv['resultBindings'] || []).map((b: any) => ({
      output: b?.output || 'return',
      contextVar: b?.contextVar || '',
    }));
    if (this.bindingRows.length === 0) {
      this.bindingRows = [{ output: 'return', contextVar: '' }];
    }
  }

  addInput(): void {
    this.inputRows.push({ param: '', kind: 'variable', value: '' });
  }

  addBinding(): void {
    this.bindingRows.push({ output: 'return', contextVar: '' });
  }

  emitChange(): void {
    const inputMappings = this.inputRows
      .filter(m => m.param)
      .map(m => ({
        param: m.param,
        valueSource: m.kind === 'literal'
          ? this.literalSource(m.value)
          : { sourceType: 'from_source_object', sourceObjectPath: m.value },
      }));
    const resultBindings = this.bindingRows
      .filter(b => b.contextVar)
      .map(b => ({ output: b.output || 'return', contextVar: b.contextVar }));
    this.invocationChanged.emit({
      solutionRef: this.solutionRef,
      inputMappings,
      resultBindings,
    });
  }

  /** Literal values keep their obvious type: numeric text becomes a
   *  number, everything else stays a string. */
  private literalSource(raw: string): any {
    const num = Number(raw);
    if (raw.trim() !== '' && !isNaN(num)) {
      return {
        sourceType: 'direct_assignment',
        directValue: num,
        directValueType: Number.isInteger(num) ? 'int' : 'float',
      };
    }
    return { sourceType: 'direct_assignment', directValue: raw, directValueType: 'str' };
  }
}
