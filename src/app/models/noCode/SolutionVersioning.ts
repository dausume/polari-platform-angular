/**
 * Interfaces for Solution Versioning, Test Cases, Assertions, and Process Links.
 * These map to backend treeObject models with the same field names.
 */

// --- Solution Version ---

export interface SolutionVersionData {
  id: string;
  solution_id: string;
  version_number: number;
  label: string;
  description: string;
  definition: string;        // JSON string snapshot of the solution
  generated_code: string;    // JSON string: {"python_backend": "...", "typescript_frontend": "..."}
  created_at: string;
  created_by: string;
  parent_version_id: string;
  is_current: boolean;
}

// --- Solution Test Case ---

export interface SolutionTestCaseData {
  id: string;
  solution_id: string;
  name: string;
  description: string;
  input_params: string;      // JSON string of input parameter values
  instance_fields: string;   // JSON string of pre-initialized fields
  target_runtime: string;
  expected_return_value: string;
  expected_status: string;
  tags: string;
  created_at: string;
  created_by: string;
  last_run_at: string;
  last_run_passed: boolean;
}

// --- Execution Step Assertion ---

export type AssertionType = 'context_value' | 'branch_taken' | 'status' | 'return_value';

export interface ExecutionStepAssertionData {
  id: string;
  test_case_id: string;
  step_index: number;
  state_name: string;
  assertion_type: AssertionType;
  variable_name: string;
  expected_value: string;
  comparison_operator: string;
  expected_branch_taken: string;
  expected_branch_label: string;
  expected_status: string;
  description: string;
  enabled: boolean;
}

// --- Solution Process Link ---

export interface SolutionProcessLinkData {
  id: string;
  solution_id: string;
  state_name: string;
  manual_process_step: string;
  manual_process_description: string;
  manual_process_order: number;
  code_snippet: string;
  code_line_start: number;
  code_line_end: number;
  code_runtime: string;
  notes: string;
  tags: string;
}

// --- Test Run Results ---

export interface TestRunResult {
  testCaseId: string;
  passed: boolean;
  executionTrace: any;
  assertionResults: AssertionResult[];
  runAt: string;
  durationMs: number;
}

export interface AssertionResult {
  assertionId: string;
  passed: boolean;
  actualValue: any;
  expectedValue: any;
  message: string;
}

export interface TestSuiteResult {
  solutionId: string;
  totalTests: number;
  passed: number;
  failed: number;
  results: TestRunResult[];
}
