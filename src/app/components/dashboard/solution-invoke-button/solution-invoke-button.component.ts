import { Component, Input, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { SolutionManagerService } from '@services/no-code-services/solution-manager.service';

@Component({
  standalone: false,
  selector: 'solution-invoke-button',
  template: `
    <button
      class="solution-invoke-btn"
      [style.background-color]="buttonColor"
      [disabled]="loading"
      (click)="onInvoke()"
      [title]="'Execute ' + solutionName">
      <mat-icon *ngIf="icon && !loading">{{ icon }}</mat-icon>
      <mat-icon *ngIf="loading" class="spin">sync</mat-icon>
      <span>{{ loading ? 'Running...' : buttonLabel }}</span>
    </button>
    <div *ngIf="lastError" class="invoke-error">{{ lastError }}</div>
    <div *ngIf="lastResult" class="invoke-result">{{ lastResult }}</div>
  `,
  styles: [`
    :host {
      display: inline-block;
    }
    .solution-invoke-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      color: white;
      cursor: pointer;
      font-size: 14px;
      transition: opacity 0.2s;
    }
    .solution-invoke-btn:hover:not(:disabled) {
      opacity: 0.85;
    }
    .solution-invoke-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .spin {
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      100% { transform: rotate(360deg); }
    }
    .invoke-error {
      color: #f44336;
      font-size: 12px;
      margin-top: 4px;
    }
    .invoke-result {
      color: #4caf50;
      font-size: 12px;
      margin-top: 4px;
      white-space: pre-wrap;
      max-height: 100px;
      overflow-y: auto;
    }
  `]
})
export class SolutionInvokeButtonComponent {
  @Input() solutionName: string = '';
  @Input() buttonLabel: string = 'Run Solution';
  @Input() buttonColor: string = '#1976d2';
  @Input() icon: string = 'play_arrow';
  @Input() inputParams: any = {};
  @Input() targetRuntime: string = 'python_backend';

  @Output() executionComplete = new EventEmitter<any>();
  @Output() executionError = new EventEmitter<any>();

  loading = false;
  lastError: string = '';
  lastResult: string = '';

  constructor(
    private solutionManager: SolutionManagerService,
    private cdr: ChangeDetectorRef
  ) {}

  onInvoke(): void {
    if (!this.solutionName || this.loading) return;

    this.loading = true;
    this.lastError = '';
    this.lastResult = '';
    this.cdr.markForCheck();

    this.solutionManager.executeSolution(
      this.solutionName,
      this.inputParams,
      this.targetRuntime
    ).subscribe({
      next: (result: any) => {
        this.loading = false;
        this.lastResult = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
        this.executionComplete.emit(result);
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        this.loading = false;
        this.lastError = err?.message || 'Execution failed';
        this.executionError.emit(err);
        this.cdr.markForCheck();
      }
    });
  }
}
