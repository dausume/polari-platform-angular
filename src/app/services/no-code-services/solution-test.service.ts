import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { PolariService } from '@services/polari-service';
import {
  SolutionTestCaseData,
  ExecutionStepAssertionData,
  TestRunResult,
  TestSuiteResult,
  AssertionResult,
} from '@models/noCode/SolutionVersioning';

@Injectable({ providedIn: 'root' })
export class SolutionTestService {

  testCases$ = new BehaviorSubject<SolutionTestCaseData[]>([]);
  assertions$ = new BehaviorSubject<Record<string, ExecutionStepAssertionData[]>>({});
  testResults$ = new BehaviorSubject<TestRunResult[]>([]);
  loading$ = new BehaviorSubject<boolean>(false);

  private readonly testCaseClass = 'SolutionTestCase';
  private readonly assertionClass = 'ExecutionStepAssertion';

  constructor(private http: HttpClient, private polariService: PolariService) {}

  private get testCaseUrl(): string {
    return `${this.polariService.getBackendBaseUrl()}/${this.testCaseClass}`;
  }

  private get assertionUrl(): string {
    return `${this.polariService.getBackendBaseUrl()}/${this.assertionClass}`;
  }

  private get execTestCaseUrl(): string {
    return `${this.polariService.getBackendBaseUrl()}/executeSolutionTestCase`;
  }

  private get execTestSuiteUrl(): string {
    return `${this.polariService.getBackendBaseUrl()}/executeSolutionTestSuite`;
  }

  // --- Test Case CRUD ---

  fetchTestCases(solutionId: string): Observable<SolutionTestCaseData[]> {
    this.loading$.next(true);
    return this.http.get<any>(this.testCaseUrl).pipe(
      map((resp: any) => {
        const all = this.parseReadAllResponse(resp, this.testCaseClass);
        return all.filter((tc: any) => tc.solution_id === solutionId);
      }),
      tap((testCases: SolutionTestCaseData[]) => {
        this.testCases$.next(testCases);
        this.loading$.next(false);
      }),
      catchError((err) => {
        console.error('[SolutionTestService] fetchTestCases failed:', err);
        this.loading$.next(false);
        return of([]);
      })
    );
  }

  createTestCase(data: Partial<SolutionTestCaseData>): Observable<any> {
    const formData = new FormData();
    formData.append('initParamSets', JSON.stringify([{
      solution_id: data.solution_id || '',
      name: data.name || '',
      description: data.description || '',
      input_params: data.input_params || '{}',
      instance_fields: data.instance_fields || '{}',
      target_runtime: data.target_runtime || 'python_backend',
      expected_return_value: data.expected_return_value || '',
      expected_status: data.expected_status || 'completed',
      tags: data.tags || '',
      created_at: new Date().toISOString(),
      created_by: data.created_by || '',
    }]));
    return this.http.post(this.testCaseUrl, formData).pipe(
      catchError((err) => {
        console.error('[SolutionTestService] createTestCase failed:', err);
        throw err;
      })
    );
  }

  updateTestCase(id: string, data: Partial<SolutionTestCaseData>): Observable<any> {
    const formData = new FormData();
    formData.append('polariId', id);
    formData.append('updateData', JSON.stringify(data));
    return this.http.put(this.testCaseUrl, formData).pipe(
      catchError((err) => {
        console.error('[SolutionTestService] updateTestCase failed:', err);
        throw err;
      })
    );
  }

  deleteTestCase(id: string): Observable<any> {
    const formData = new FormData();
    formData.append('targetInstance', JSON.stringify({ polariId: id }));
    return this.http.delete(this.testCaseUrl, { body: formData }).pipe(
      catchError((err) => {
        console.error('[SolutionTestService] deleteTestCase failed:', err);
        throw err;
      })
    );
  }

  /**
   * Create a test case pre-filled from an execution trace's input params.
   */
  createTestCaseFromExecution(
    solutionId: string,
    trace: any,
    name: string = ''
  ): Observable<any> {
    const inputParams = trace?.inputParams || trace?.input_params || {};
    const instanceFields = trace?.instanceFields || trace?.instance_fields || {};
    const targetRuntime = trace?.targetRuntime || trace?.target_runtime || 'python_backend';

    return this.createTestCase({
      solution_id: solutionId,
      name: name || `Test from execution ${trace?.executionId || ''}`.trim(),
      description: 'Auto-created from execution trace',
      input_params: JSON.stringify(inputParams),
      instance_fields: JSON.stringify(instanceFields),
      target_runtime: targetRuntime,
      expected_status: trace?.status || 'completed',
      expected_return_value: trace?.finalReturnValue != null ? String(trace.finalReturnValue) : '',
    });
  }

  // --- Assertion CRUD ---

  fetchAssertions(testCaseId: string): Observable<ExecutionStepAssertionData[]> {
    return this.http.get<any>(this.assertionUrl).pipe(
      map((resp: any) => {
        const all = this.parseReadAllResponse(resp, this.assertionClass);
        return all.filter((a: any) => a.test_case_id === testCaseId);
      }),
      tap((assertions: ExecutionStepAssertionData[]) => {
        const current = { ...this.assertions$.value };
        current[testCaseId] = assertions;
        this.assertions$.next(current);
      }),
      catchError((err) => {
        console.error('[SolutionTestService] fetchAssertions failed:', err);
        return of([]);
      })
    );
  }

  createAssertion(data: Partial<ExecutionStepAssertionData>): Observable<any> {
    const formData = new FormData();
    formData.append('initParamSets', JSON.stringify([{
      test_case_id: data.test_case_id || '',
      step_index: data.step_index || 0,
      state_name: data.state_name || '',
      assertion_type: data.assertion_type || 'context_value',
      variable_name: data.variable_name || '',
      expected_value: data.expected_value || '',
      comparison_operator: data.comparison_operator || 'equals',
      expected_branch_taken: data.expected_branch_taken || '',
      expected_branch_label: data.expected_branch_label || '',
      expected_status: data.expected_status || 'completed',
      description: data.description || '',
      enabled: data.enabled !== false,
    }]));
    return this.http.post(this.assertionUrl, formData).pipe(
      catchError((err) => {
        console.error('[SolutionTestService] createAssertion failed:', err);
        throw err;
      })
    );
  }

  /**
   * Create an assertion pre-filled from an actual execution step snapshot.
   */
  createAssertionFromSnapshot(
    testCaseId: string,
    snapshot: any,
    variableName: string = ''
  ): Observable<any> {
    const contextAfter = snapshot?.contextAfter || snapshot?.context_after || {};
    const variables = contextAfter?.variables || {};

    if (variableName && variableName in variables) {
      return this.createAssertion({
        test_case_id: testCaseId,
        step_index: snapshot?.stepIndex ?? snapshot?.step_index ?? 0,
        state_name: snapshot?.stateName || snapshot?.state_name || '',
        assertion_type: 'context_value',
        variable_name: variableName,
        expected_value: JSON.stringify(variables[variableName]),
        comparison_operator: 'equals',
        description: `Assert ${variableName} at step ${snapshot?.stepIndex ?? snapshot?.step_index ?? 0}`,
        enabled: true,
      });
    }

    // Default to status assertion
    return this.createAssertion({
      test_case_id: testCaseId,
      step_index: snapshot?.stepIndex ?? snapshot?.step_index ?? 0,
      state_name: snapshot?.stateName || snapshot?.state_name || '',
      assertion_type: 'status',
      expected_status: snapshot?.status || 'completed',
      description: `Assert status at step ${snapshot?.stepIndex ?? snapshot?.step_index ?? 0}`,
      enabled: true,
    });
  }

  deleteAssertion(id: string): Observable<any> {
    const formData = new FormData();
    formData.append('targetInstance', JSON.stringify({ polariId: id }));
    return this.http.delete(this.assertionUrl, { body: formData }).pipe(
      catchError((err) => {
        console.error('[SolutionTestService] deleteAssertion failed:', err);
        throw err;
      })
    );
  }

  // --- Test Execution ---

  runTestCase(testCaseId: string): Observable<TestRunResult> {
    this.loading$.next(true);
    return this.http.post<any>(this.execTestCaseUrl, { testCaseId }).pipe(
      map((resp: any) => {
        if (!resp.success) {
          throw new Error(resp.error || 'Test case execution failed');
        }
        const result: TestRunResult = {
          testCaseId: resp.testCaseId,
          passed: resp.overallPassed,
          executionTrace: resp.trace,
          assertionResults: resp.assertionResults || [],
          runAt: resp.runAt,
          durationMs: resp.durationMs,
        };
        return result;
      }),
      tap((result: TestRunResult) => {
        const current = [...this.testResults$.value];
        const idx = current.findIndex(r => r.testCaseId === result.testCaseId);
        if (idx >= 0) {
          current[idx] = result;
        } else {
          current.push(result);
        }
        this.testResults$.next(current);
        this.loading$.next(false);
      }),
      catchError((err) => {
        console.error('[SolutionTestService] runTestCase failed:', err);
        this.loading$.next(false);
        throw err;
      })
    );
  }

  runAllTestCases(solutionId: string): Observable<TestSuiteResult> {
    this.loading$.next(true);
    return this.http.post<any>(this.execTestSuiteUrl, { solutionId }).pipe(
      map((resp: any) => {
        if (!resp.success) {
          throw new Error(resp.error || 'Test suite execution failed');
        }
        const suiteResult: TestSuiteResult = {
          solutionId: resp.solutionId,
          totalTests: resp.totalTests,
          passed: resp.passed,
          failed: resp.failed,
          results: (resp.results || []).map((r: any) => ({
            testCaseId: r.testCaseId,
            passed: r.passed,
            executionTrace: null, // Suite doesn't return full traces
            assertionResults: r.assertionResults || [],
            runAt: r.runAt,
            durationMs: r.durationMs,
          })),
        };
        return suiteResult;
      }),
      tap((result: TestSuiteResult) => {
        this.testResults$.next(result.results);
        this.loading$.next(false);
      }),
      catchError((err) => {
        console.error('[SolutionTestService] runAllTestCases failed:', err);
        this.loading$.next(false);
        throw err;
      })
    );
  }

  // --- Response Parser ---

  private parseReadAllResponse(response: any, className: string): any[] {
    let unwrapped = response;

    if (Array.isArray(response) && response.length === 1 && response[0] && response[0][className]) {
      unwrapped = response[0];
    }

    if (unwrapped && unwrapped[className]) {
      const classData = unwrapped[className];

      if (Array.isArray(classData)) {
        const instances: any[] = [];
        classData.forEach((dataSet: any) => {
          if (dataSet.data && Array.isArray(dataSet.data)) {
            instances.push(...dataSet.data);
          } else if (dataSet.id !== undefined) {
            instances.push(dataSet);
          }
        });
        return instances;
      }

      const keys = Object.keys(classData);
      return keys.map(key => ({ id: key, ...classData[key] }));
    }

    if (Array.isArray(response)) {
      return response;
    }
    if (response && response.data && Array.isArray(response.data)) {
      return response.data;
    }

    return [];
  }
}
