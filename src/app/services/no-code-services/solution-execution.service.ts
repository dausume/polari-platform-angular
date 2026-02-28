// Author: Dustin Etts
// polari-platform-angular/src/app/services/no-code-services/solution-execution.service.ts
//
// Frontend service managing solution execution state, stepping, and playback.
// Uses batch execution + frontend replay strategy.

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, Subscription, interval } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { PolariService } from '@services/polari-service';
import {
  ExecutionTrace,
  ExecutionStepSnapshot,
  DebugSession,
  computeContextDiff,
  generateDebugSessionId,
} from '@models/noCode/ExecutionTrace';

export type ExecutionStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'completed' | 'errored';

@Injectable({ providedIn: 'root' })
export class SolutionExecutionService {

  // Observable state
  executionTrace$ = new BehaviorSubject<ExecutionTrace | null>(null);
  debugSession$ = new BehaviorSubject<DebugSession | null>(null);
  currentStep$ = new BehaviorSubject<ExecutionStepSnapshot | null>(null);
  activeStateName$ = new BehaviorSubject<string | null>(null);
  executionStatus$ = new BehaviorSubject<ExecutionStatus>('idle');
  isPlaying$ = new BehaviorSubject<boolean>(false);
  playbackSpeed$ = new BehaviorSubject<number>(1000); // ms per step
  currentStepIndex$ = new BehaviorSubject<number>(-1);
  totalSteps$ = new BehaviorSubject<number>(0);

  private playbackSubscription: Subscription | null = null;

  constructor(private http: HttpClient, private polariService: PolariService) {}

  /**
   * Start execution: calls the backend /executeSolutionStepped endpoint,
   * receives the full ExecutionTrace, sets up the DebugSession for replay.
   */
  startExecution(
    solutionName: string,
    inputParams: Record<string, any>,
    targetRuntime: string,
    stepConfig?: any
  ): Observable<ExecutionTrace> {
    this.executionStatus$.next('loading');
    this.stop(); // Clean up any previous session

    const execUrl = `${this.polariService.getBackendBaseUrl()}/executeSolutionStepped`;
    const body = {
      solutionName,
      inputParams: inputParams || {},
      targetRuntime,
      ...(stepConfig ? { stepConfig } : {})
    };

    return this.http.post<any>(execUrl, body).pipe(
      map((response: any) => {
        if (!response.success || !response.trace) {
          throw new Error(response.error || 'Execution failed');
        }

        // Parse the ExecutionTrace from the response
        const trace = ExecutionTrace.fromJSON(response.trace);
        this.executionTrace$.next(trace);
        this.totalSteps$.next(trace.steps.length);

        // Create a DebugSession for navigation
        const session = new DebugSession(
          generateDebugSessionId(),
          trace
        );
        this.debugSession$.next(session);

        // Navigate to the first step
        if (trace.steps.length > 0) {
          this.navigateToStep(0);
          this.executionStatus$.next('ready');
        } else {
          this.executionStatus$.next('completed');
        }

        return trace;
      }),
      catchError((err: any) => {
        console.error('[SolutionExecution] Execution failed:', err);
        this.executionStatus$.next('errored');
        throw err;
      })
    );
  }

  /**
   * Step forward one step in the trace.
   */
  stepForward(): void {
    const trace = this.executionTrace$.value;
    if (!trace) return;

    const currentIndex = this.currentStepIndex$.value;
    const nextIndex = currentIndex + 1;

    if (nextIndex < trace.steps.length) {
      this.navigateToStep(nextIndex);
    } else {
      // Reached the end
      this.pause();
      this.executionStatus$.next('completed');
    }
  }

  /**
   * Step backward one step in the trace.
   */
  stepBackward(): void {
    const currentIndex = this.currentStepIndex$.value;
    if (currentIndex > 0) {
      this.navigateToStep(currentIndex - 1);
    }
  }

  /**
   * Navigate to a specific step by index.
   */
  navigateToStep(index: number): void {
    const trace = this.executionTrace$.value;
    if (!trace) return;

    const step = trace.getStepAt(index);
    if (!step) return;

    this.currentStepIndex$.next(index);
    this.currentStep$.next(step);
    this.activeStateName$.next(step.stateName);

    // Update debug session viewing index
    const session = this.debugSession$.value;
    if (session) {
      session.navigateToStep(index);
      this.debugSession$.next(session);
    }

    // If we were completed but navigated back, set to paused
    if (this.executionStatus$.value === 'completed' && index < trace.steps.length - 1) {
      this.executionStatus$.next('paused');
    }
  }

  /**
   * Start auto-play: advances one step at the configured speed interval.
   */
  play(): void {
    const trace = this.executionTrace$.value;
    if (!trace) return;

    // If already at end, restart from beginning
    if (this.currentStepIndex$.value >= trace.steps.length - 1) {
      this.navigateToStep(0);
    }

    this.isPlaying$.next(true);
    this.executionStatus$.next('playing');

    this.stopPlayback();
    this.playbackSubscription = interval(this.playbackSpeed$.value).subscribe(() => {
      const currentIndex = this.currentStepIndex$.value;
      const totalSteps = this.totalSteps$.value;

      if (currentIndex < totalSteps - 1) {
        this.stepForward();
      } else {
        this.pause();
        this.executionStatus$.next('completed');
      }
    });
  }

  /**
   * Pause auto-play.
   */
  pause(): void {
    this.isPlaying$.next(false);
    this.stopPlayback();
    if (this.executionStatus$.value === 'playing') {
      this.executionStatus$.next('paused');
    }
  }

  /**
   * Stop execution entirely - reset all state.
   */
  stop(): void {
    this.stopPlayback();
    this.isPlaying$.next(false);
    this.executionTrace$.next(null);
    this.debugSession$.next(null);
    this.currentStep$.next(null);
    this.activeStateName$.next(null);
    this.currentStepIndex$.next(-1);
    this.totalSteps$.next(0);
    this.executionStatus$.next('idle');
  }

  /**
   * Set the playback speed (ms per step).
   */
  setPlaybackSpeed(ms: number): void {
    this.playbackSpeed$.next(ms);
    // If currently playing, restart with new speed
    if (this.isPlaying$.value) {
      this.stopPlayback();
      this.playbackSubscription = interval(ms).subscribe(() => {
        const currentIndex = this.currentStepIndex$.value;
        const totalSteps = this.totalSteps$.value;
        if (currentIndex < totalSteps - 1) {
          this.stepForward();
        } else {
          this.pause();
          this.executionStatus$.next('completed');
        }
      });
    }
  }

  /**
   * Discard execution results without committing.
   */
  discardResults(): void {
    this.stop();
  }

  private stopPlayback(): void {
    if (this.playbackSubscription) {
      this.playbackSubscription.unsubscribe();
      this.playbackSubscription = null;
    }
  }
}
