// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/execution-panel/execution-panel.component.ts
//
// Execution Panel Component - Bottom panel for manual process step-by-step execution.

import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { SolutionExecutionService, ExecutionStatus } from '@services/no-code-services/solution-execution.service';
import { ExecutionStepSnapshot, ContextDiff, VariableChange, computeContextDiff } from '@models/noCode/ExecutionTrace';
import { TargetRuntime } from '@models/noCode/mock-NCS-data';

export interface InputParamField {
  name: string;
  type: string;
  value: any;
}

@Component({
  standalone: false,
  selector: 'execution-panel',
  templateUrl: './execution-panel.component.html',
  styleUrls: ['./execution-panel.component.css']
})
export class ExecutionPanelComponent implements OnInit, OnDestroy {

  @Input() solutionName: string = '';
  @Input() targetRuntime: TargetRuntime = 'python_backend';
  @Input() inputParamDefinitions: InputParamField[] = [];
  @Output() closed = new EventEmitter<void>();
  @Output() activeStateChanged = new EventEmitter<string | null>();

  // Execution state
  status: ExecutionStatus = 'idle';
  steps: ExecutionStepSnapshot[] = [];
  currentStep: ExecutionStepSnapshot | null = null;
  currentStepIndex: number = -1;
  totalSteps: number = 0;
  isPlaying: boolean = false;
  playbackSpeed: number = 1000;

  // Input params form
  inputParams: InputParamField[] = [];

  // Context display
  contextVariables: { name: string; type: string; value: any; changeType?: string }[] = [];
  contextDiff: ContextDiff | null = null;

  private destroy$ = new Subject<void>();

  constructor(private executionService: SolutionExecutionService) {}

  ngOnInit(): void {
    // Initialize input params from definitions
    this.inputParams = (this.inputParamDefinitions || []).map(p => ({
      name: p.name,
      type: p.type,
      value: this.getDefaultValue(p.type)
    }));

    // Subscribe to execution service state
    this.executionService.executionStatus$
      .pipe(takeUntil(this.destroy$))
      .subscribe(status => this.status = status);

    this.executionService.currentStep$
      .pipe(takeUntil(this.destroy$))
      .subscribe(step => {
        this.currentStep = step;
        this.updateContextDisplay();
      });

    this.executionService.currentStepIndex$
      .pipe(takeUntil(this.destroy$))
      .subscribe(index => this.currentStepIndex = index);

    this.executionService.totalSteps$
      .pipe(takeUntil(this.destroy$))
      .subscribe(total => this.totalSteps = total);

    this.executionService.isPlaying$
      .pipe(takeUntil(this.destroy$))
      .subscribe(playing => this.isPlaying = playing);

    this.executionService.playbackSpeed$
      .pipe(takeUntil(this.destroy$))
      .subscribe(speed => this.playbackSpeed = speed);

    this.executionService.executionTrace$
      .pipe(takeUntil(this.destroy$))
      .subscribe(trace => {
        this.steps = trace ? trace.steps : [];
      });

    this.executionService.activeStateName$
      .pipe(takeUntil(this.destroy$))
      .subscribe(name => this.activeStateChanged.emit(name));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // --- Actions ---

  execute(): void {
    const params: Record<string, any> = {};
    for (const p of this.inputParams) {
      params[p.name] = this.coerceValue(p.value, p.type);
    }

    this.executionService.startExecution(
      this.solutionName,
      params,
      this.targetRuntime,
      { mode: 'step', recordContext: true }
    ).subscribe({
      error: (err: any) => console.error('[ExecutionPanel] Execution failed:', err)
    });
  }

  stepForward(): void {
    this.executionService.stepForward();
  }

  rewindToStart(): void {
    this.executionService.navigateToStep(0);
  }

  stepBackward(): void {
    this.executionService.stepBackward();
  }

  play(): void {
    this.executionService.play();
  }

  pause(): void {
    this.executionService.pause();
  }

  stop(): void {
    this.executionService.stop();
  }

  onSpeedChange(event: Event): void {
    const value = +(event.target as HTMLInputElement).value;
    this.executionService.setPlaybackSpeed(value);
  }

  navigateToStep(index: number): void {
    this.executionService.navigateToStep(index);
  }

  close(): void {
    this.executionService.stop();
    this.closed.emit();
  }

  discard(): void {
    this.executionService.discardResults();
  }

  // --- Helpers ---

  getStepStatusIcon(step: ExecutionStepSnapshot, index: number): string {
    if (index === this.currentStepIndex) return 'radio_button_checked';
    if (index < this.currentStepIndex) return 'check_circle';
    return 'radio_button_unchecked';
  }

  getStepStatusClass(step: ExecutionStepSnapshot, index: number): string {
    if (index === this.currentStepIndex) return 'step-active';
    if (index < this.currentStepIndex) return 'step-completed';
    return 'step-pending';
  }

  getStateClassIcon(stateClass: string): string {
    const iconMap: Record<string, string> = {
      'DirectInvocation': 'play_arrow',
      'InitialState': 'play_arrow',
      'VariableAssignment': 'assignment',
      'ConditionalChain': 'call_split',
      'ForLoop': 'loop',
      'WhileLoop': 'loop',
      'ForEachLoop': 'loop',
      'FunctionCall': 'functions',
      'ReturnValue': 'output',
      'ReturnStatement': 'output',
      'LogOutput': 'terminal',
      'MathOperation': 'calculate',
      'FilterList': 'filter_list',
    };
    return iconMap[stateClass] || 'circle';
  }

  getChangeTypeClass(changeType: string): string {
    return `change-${changeType}`;
  }

  formatValue(value: any): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'object') {
      try { return JSON.stringify(value); } catch { return String(value); }
    }
    return String(value);
  }

  get speedLabel(): string {
    return (this.playbackSpeed / 1000).toFixed(1) + 's';
  }

  get canExecute(): boolean {
    return this.status === 'idle' || this.status === 'completed' || this.status === 'errored';
  }

  get canStep(): boolean {
    return this.status === 'ready' || this.status === 'paused' || this.status === 'completed';
  }

  get canPlay(): boolean {
    return (this.status === 'ready' || this.status === 'paused' || this.status === 'completed')
      && this.currentStepIndex < this.totalSteps - 1;
  }

  private updateContextDisplay(): void {
    if (!this.currentStep) {
      this.contextVariables = [];
      this.contextDiff = null;
      return;
    }

    // Show variables from context_after
    const afterVars = this.currentStep.contextAfter?.variables || {};
    const diff = this.currentStep.contextDiff;
    this.contextDiff = diff || null;

    const changeMap = new Map<string, string>();
    if (diff) {
      for (const vc of diff.variableChanges) {
        changeMap.set(vc.name, vc.changeType);
      }
    }

    this.contextVariables = Object.entries(afterVars).map(([name, snap]: [string, any]) => ({
      name,
      type: snap.type || typeof snap.value,
      value: snap.value,
      changeType: changeMap.get(name)
    }));
  }

  private getDefaultValue(type: string): any {
    switch (type) {
      case 'int': case 'float': case 'number': return 0;
      case 'str': case 'string': return '';
      case 'bool': case 'boolean': return false;
      case 'list': case 'array': return [];
      case 'dict': case 'object': return {};
      default: return '';
    }
  }

  private coerceValue(value: any, type: string): any {
    if (value === null || value === undefined) return value;
    switch (type) {
      case 'int': return parseInt(String(value), 10) || 0;
      case 'float': case 'number': return parseFloat(String(value)) || 0;
      case 'bool': case 'boolean':
        if (typeof value === 'string') return value.toLowerCase() === 'true';
        return Boolean(value);
      case 'list': case 'array':
      case 'dict': case 'object':
        if (typeof value === 'string') {
          try { return JSON.parse(value); } catch { return value; }
        }
        return value;
      default: return value;
    }
  }
}
