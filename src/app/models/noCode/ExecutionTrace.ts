// Author: Dustin Etts
// polari-platform-angular/src/app/models/noCode/ExecutionTrace.ts
//
// Execution Diagnostic Layer: Step-by-step execution snapshots capturing
// context/state at each point in a solution's execution, for backend-driven
// debugging with results relayed to the frontend.
//
// Extends from the existing InstanceContext / InstanceVariable / BranchPoint
// in models/stateSpace/solutionContext.ts.

import {
  BranchPoint,
  InstanceContext,
  InstanceVariable,
  InstanceObject
} from '../stateSpace/solutionContext';
import { TargetRuntime } from './mock-NCS-data';

// ============================================================================
// Serializable Snapshots
// ============================================================================

/**
 * Serializable snapshot of an InstanceVariable (plain object, no Map).
 */
export interface InstanceVariableSnapshot {
  name: string;
  type: string;
  value: any;
  sourceStateName: string;
}

/**
 * Serializable snapshot of an InstanceObject.
 */
export interface InstanceObjectSnapshot {
  className: string;
  instanceId: string;
  data: Record<string, any>;
  sourceStateName: string;
}

/**
 * Serializable mirror of InstanceContext.
 * Uses Record<> instead of Map<> for JSON transport.
 */
export interface InstanceContextSnapshot {
  stateName: string;
  solutionName: string;
  executionId: string;
  variables: Record<string, InstanceVariableSnapshot>;
  objects: Record<string, InstanceObjectSnapshot>;
  capturedAt: string; // ISO timestamp
}

// ============================================================================
// Context Diff
// ============================================================================

export type ChangeType = 'added' | 'modified' | 'removed';

/**
 * A single variable change between two context snapshots.
 */
export interface VariableChange {
  name: string;
  changeType: ChangeType;
  previousValue?: any;
  newValue?: any;
  previousType?: string;
  newType?: string;
}

/**
 * A single object change between two context snapshots.
 */
export interface ObjectChange {
  instanceId: string;
  className: string;
  changeType: ChangeType;
  previousData?: Record<string, any>;
  newData?: Record<string, any>;
}

/**
 * What changed between two context snapshots.
 */
export interface ContextDiff {
  variableChanges: VariableChange[];
  objectChanges: ObjectChange[];
  hasChanges: boolean;
  totalChangeCount: number;
}

// ============================================================================
// Execution Step Snapshot
// ============================================================================

export type ExecutionStepStatus = 'pending' | 'running' | 'completed' | 'errored' | 'skipped';

/**
 * Full diagnostic state at one execution step.
 */
export interface ExecutionStepSnapshot {
  snapshotId: string;

  // State identification
  stateName: string;
  stateClassName: string;
  stateDisplayName: string;
  stepIndex: number;

  // Context before/after this step executed
  contextBefore: InstanceContextSnapshot;
  contextAfter: InstanceContextSnapshot;
  contextDiff: ContextDiff;

  // Execution result
  status: ExecutionStepStatus;
  executionResult?: any;
  executionError?: string;

  // Timing
  startTime: string; // ISO
  endTime?: string;  // ISO
  durationMs?: number;

  // Branch info
  branchPath: BranchPoint[];
  branchTaken?: string;
  branchLabel?: string;

  // Loop info
  loopIterationIndex?: number;
  enclosingLoopStateName?: string;

  // Debug
  hitBreakpoint: boolean;
  logOutput?: string[];
}

// ============================================================================
// Execution Trace
// ============================================================================

export type TraceStatus = 'running' | 'completed' | 'errored' | 'cancelled';

/**
 * Ordered collection of execution step snapshots for one full run.
 */
export class ExecutionTrace {
  executionId: string;
  solutionName: string;
  targetRuntime: TargetRuntime;
  status: TraceStatus = 'running';
  steps: ExecutionStepSnapshot[] = [];

  startedAt: string;
  completedAt?: string;
  finalReturnValue?: any;
  errorSummary?: string;

  constructor(executionId: string, solutionName: string, targetRuntime: TargetRuntime) {
    this.executionId = executionId;
    this.solutionName = solutionName;
    this.targetRuntime = targetRuntime;
    this.startedAt = new Date().toISOString();
  }

  addStep(snapshot: ExecutionStepSnapshot): void {
    this.steps.push(snapshot);
  }

  getStepAt(index: number): ExecutionStepSnapshot | undefined {
    return this.steps[index];
  }

  getSnapshotsForState(stateName: string): ExecutionStepSnapshot[] {
    return this.steps.filter(s => s.stateName === stateName);
  }

  getLatestSnapshotForState(stateName: string): ExecutionStepSnapshot | undefined {
    const matches = this.getSnapshotsForState(stateName);
    return matches.length > 0 ? matches[matches.length - 1] : undefined;
  }

  getCurrentStep(): ExecutionStepSnapshot | undefined {
    return this.steps.length > 0 ? this.steps[this.steps.length - 1] : undefined;
  }

  complete(finalReturnValue?: any): void {
    this.status = 'completed';
    this.completedAt = new Date().toISOString();
    this.finalReturnValue = finalReturnValue;
  }

  error(errorSummary: string): void {
    this.status = 'errored';
    this.completedAt = new Date().toISOString();
    this.errorSummary = errorSummary;
  }

  cancel(): void {
    this.status = 'cancelled';
    this.completedAt = new Date().toISOString();
  }

  toJSON(): Record<string, any> {
    return {
      executionId: this.executionId,
      solutionName: this.solutionName,
      targetRuntime: this.targetRuntime,
      status: this.status,
      steps: this.steps,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      finalReturnValue: this.finalReturnValue,
      errorSummary: this.errorSummary
    };
  }

  static fromJSON(data: Record<string, any>): ExecutionTrace {
    const trace = new ExecutionTrace(data['executionId'], data['solutionName'], data['targetRuntime']);
    trace.status = data['status'] || 'running';
    trace.steps = data['steps'] || [];
    trace.startedAt = data['startedAt'] || new Date().toISOString();
    trace.completedAt = data['completedAt'];
    trace.finalReturnValue = data['finalReturnValue'];
    trace.errorSummary = data['errorSummary'];
    return trace;
  }
}

// ============================================================================
// Breakpoint
// ============================================================================

/**
 * A breakpoint on a state.
 */
export interface Breakpoint {
  id: string;
  stateName: string;
  condition?: string; // Optional conditional expression
  enabled: boolean;
  hitCount: number;
}

// ============================================================================
// Debug Session
// ============================================================================

export type DebugSessionStatus = 'idle' | 'running' | 'paused' | 'stepping' | 'completed' | 'errored';
export type SteppingMode = 'run' | 'step_over' | 'step_into' | 'pause' | 'step_back';

/**
 * Interactive stepping controller for debugging a solution execution.
 */
export class DebugSession {
  sessionId: string;
  trace: ExecutionTrace;
  breakpoints: Map<string, Breakpoint> = new Map();
  viewingStepIndex: number = -1;

  status: DebugSessionStatus = 'idle';
  steppingMode: SteppingMode = 'run';

  /** Whether the UI should auto-advance to newest step */
  followLive: boolean = true;

  constructor(sessionId: string, trace: ExecutionTrace) {
    this.sessionId = sessionId;
    this.trace = trace;
  }

  // --- Breakpoint management ---

  addBreakpoint(stateName: string, condition?: string): Breakpoint {
    const bp: Breakpoint = {
      id: generateBreakpointId(),
      stateName,
      condition,
      enabled: true,
      hitCount: 0
    };
    this.breakpoints.set(stateName, bp);
    return bp;
  }

  removeBreakpoint(stateName: string): boolean {
    return this.breakpoints.delete(stateName);
  }

  toggleBreakpoint(stateName: string): void {
    const bp = this.breakpoints.get(stateName);
    if (bp) {
      bp.enabled = !bp.enabled;
    }
  }

  hasBreakpoint(stateName: string): boolean {
    const bp = this.breakpoints.get(stateName);
    return bp !== undefined && bp.enabled;
  }

  // --- Navigation ---

  navigateToStep(index: number): void {
    if (index >= 0 && index < this.trace.steps.length) {
      this.viewingStepIndex = index;
      this.followLive = false;
    }
  }

  navigateForward(): void {
    if (this.viewingStepIndex < this.trace.steps.length - 1) {
      this.viewingStepIndex++;
    }
    if (this.viewingStepIndex === this.trace.steps.length - 1) {
      this.followLive = true;
    }
  }

  navigateBackward(): void {
    if (this.viewingStepIndex > 0) {
      this.viewingStepIndex--;
      this.followLive = false;
    }
  }

  navigateToLatest(): void {
    this.viewingStepIndex = this.trace.steps.length - 1;
    this.followLive = true;
  }

  // --- Live execution ---

  /**
   * Called when a new step snapshot arrives from the backend.
   * Appends to trace; auto-advances viewingStepIndex if followLive.
   */
  onStepReceived(snapshot: ExecutionStepSnapshot): void {
    this.trace.addStep(snapshot);

    if (this.followLive) {
      this.viewingStepIndex = this.trace.steps.length - 1;
    }

    if (snapshot.hitBreakpoint) {
      this.status = 'paused';
      this.steppingMode = 'pause';
    }
  }

  // --- Serialization ---

  toJSON(): Record<string, any> {
    return {
      sessionId: this.sessionId,
      trace: this.trace.toJSON(),
      breakpoints: Array.from(this.breakpoints.values()),
      viewingStepIndex: this.viewingStepIndex,
      status: this.status,
      steppingMode: this.steppingMode,
      followLive: this.followLive
    };
  }

  static fromJSON(data: Record<string, any>): DebugSession {
    const trace = ExecutionTrace.fromJSON(data['trace']);
    const session = new DebugSession(data['sessionId'], trace);
    session.viewingStepIndex = data['viewingStepIndex'] ?? -1;
    session.status = data['status'] || 'idle';
    session.steppingMode = data['steppingMode'] || 'run';
    session.followLive = data['followLive'] ?? true;

    if (Array.isArray(data['breakpoints'])) {
      for (const bp of data['breakpoints']) {
        session.breakpoints.set(bp.stateName, bp);
      }
    }

    return session;
  }
}

// ============================================================================
// WebSocket Protocol Types (for future backend wiring)
// ============================================================================

export type DebugCommandType =
  | 'start_execution'
  | 'resume'
  | 'pause'
  | 'step_over'
  | 'step_into'
  | 'step_back'
  | 'stop'
  | 'add_breakpoint'
  | 'remove_breakpoint'
  | 'toggle_breakpoint';

/**
 * Commands FROM frontend TO backend.
 */
export interface DebugCommand {
  type: DebugCommandType;
  sessionId: string;
  payload?: {
    stateName?: string;
    condition?: string;
    solutionName?: string;
    targetRuntime?: TargetRuntime;
    inputData?: any;
  };
}

export type DebugEventType =
  | 'step_completed'
  | 'breakpoint_hit'
  | 'execution_completed'
  | 'execution_errored'
  | 'execution_started'
  | 'execution_paused'
  | 'execution_resumed'
  | 'execution_cancelled';

/**
 * Events FROM backend TO frontend.
 */
export interface DebugEvent {
  type: DebugEventType;
  sessionId: string;
  timestamp: string;
  payload?: {
    snapshot?: ExecutionStepSnapshot;
    finalReturnValue?: any;
    errorSummary?: string;
    executionId?: string;
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert a live InstanceContext to a serializable InstanceContextSnapshot.
 */
export function snapshotInstanceContext(ctx: InstanceContext): InstanceContextSnapshot {
  const variables: Record<string, InstanceVariableSnapshot> = {};
  for (const [key, v] of ctx.variables) {
    variables[key] = {
      name: v.name,
      type: v.type,
      value: v.value,
      sourceStateName: v.sourceStateName
    };
  }

  const objects: Record<string, InstanceObjectSnapshot> = {};
  for (const [key, o] of ctx.objects) {
    objects[key] = {
      className: o.className,
      instanceId: o.instanceId,
      data: { ...o.data },
      sourceStateName: o.sourceStateName
    };
  }

  return {
    stateName: ctx.stateName,
    solutionName: ctx.solutionName,
    executionId: ctx.executionId,
    variables,
    objects,
    capturedAt: new Date().toISOString()
  };
}

/**
 * Restore a live InstanceContext from a snapshot.
 */
export function restoreInstanceContext(snapshot: InstanceContextSnapshot): InstanceContext {
  const ctx = new InstanceContext(
    snapshot.solutionName,
    snapshot.stateName,
    snapshot.executionId
  );

  for (const [key, v] of Object.entries(snapshot.variables)) {
    ctx.variables.set(key, {
      name: v.name,
      type: v.type,
      value: v.value,
      sourceStateName: v.sourceStateName
    });
  }

  for (const [key, o] of Object.entries(snapshot.objects)) {
    ctx.objects.set(key, {
      className: o.className,
      instanceId: o.instanceId,
      data: { ...o.data },
      sourceStateName: o.sourceStateName
    });
  }

  return ctx;
}

/**
 * Compute the diff between two context snapshots.
 */
export function computeContextDiff(
  before: InstanceContextSnapshot,
  after: InstanceContextSnapshot
): ContextDiff {
  const variableChanges: VariableChange[] = [];
  const objectChanges: ObjectChange[] = [];

  // Check for added and modified variables
  for (const [name, afterVar] of Object.entries(after.variables)) {
    const beforeVar = before.variables[name];
    if (!beforeVar) {
      variableChanges.push({
        name,
        changeType: 'added',
        newValue: afterVar.value,
        newType: afterVar.type
      });
    } else if (JSON.stringify(beforeVar.value) !== JSON.stringify(afterVar.value)) {
      variableChanges.push({
        name,
        changeType: 'modified',
        previousValue: beforeVar.value,
        newValue: afterVar.value,
        previousType: beforeVar.type,
        newType: afterVar.type
      });
    }
  }

  // Check for removed variables
  for (const name of Object.keys(before.variables)) {
    if (!(name in after.variables)) {
      variableChanges.push({
        name,
        changeType: 'removed',
        previousValue: before.variables[name].value,
        previousType: before.variables[name].type
      });
    }
  }

  // Check for added and modified objects
  for (const [id, afterObj] of Object.entries(after.objects)) {
    const beforeObj = before.objects[id];
    if (!beforeObj) {
      objectChanges.push({
        instanceId: id,
        className: afterObj.className,
        changeType: 'added',
        newData: afterObj.data
      });
    } else if (JSON.stringify(beforeObj.data) !== JSON.stringify(afterObj.data)) {
      objectChanges.push({
        instanceId: id,
        className: afterObj.className,
        changeType: 'modified',
        previousData: beforeObj.data,
        newData: afterObj.data
      });
    }
  }

  // Check for removed objects
  for (const [id, beforeObj] of Object.entries(before.objects)) {
    if (!(id in after.objects)) {
      objectChanges.push({
        instanceId: id,
        className: beforeObj.className,
        changeType: 'removed',
        previousData: beforeObj.data
      });
    }
  }

  const totalChangeCount = variableChanges.length + objectChanges.length;

  return {
    variableChanges,
    objectChanges,
    hasChanges: totalChangeCount > 0,
    totalChangeCount
  };
}

let _executionIdCounter = 0;
let _snapshotIdCounter = 0;
let _debugSessionIdCounter = 0;
let _breakpointIdCounter = 0;

export function generateExecutionId(): string {
  return `exec_${Date.now()}_${++_executionIdCounter}`;
}

export function generateSnapshotId(): string {
  return `snap_${Date.now()}_${++_snapshotIdCounter}`;
}

export function generateDebugSessionId(): string {
  return `dbg_${Date.now()}_${++_debugSessionIdCounter}`;
}

function generateBreakpointId(): string {
  return `bp_${Date.now()}_${++_breakpointIdCounter}`;
}
