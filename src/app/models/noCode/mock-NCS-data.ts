// Author: Dustin Etts
// polari-platform-angular/src/app/models/noCode/mock-NCS-data.ts
// Mock data for No-Code Solutions - simulates API responses

/**
 * Target runtime for a no-code solution
 */
export type TargetRuntime = 'python_backend' | 'typescript_frontend';

/**
 * Raw data interface for NoCodeState - matches what would come from an API
 */
export interface NoCodeStateRawData {
  stateName: string;
  id: string;
  index: number;
  shapeType: string;
  solutionName: string;
  stateClass: string;
  stateSvgSizeX: number | null;
  stateSvgSizeY: number | null;
  stateSvgRadius: number | null;
  // Rectangle-specific dimensions
  stateSvgWidth?: number;
  stateSvgHeight?: number;
  cornerRadius?: number;
  layerName: string;
  stateLocationX: number;
  stateLocationY: number;
  stateSvgName: string;
  slots: SlotRawData[];
  slotRadius: number;
  backgroundColor: string;
  // State-space bindings
  boundObjectClass?: string;
  boundObjectFieldValues?: { [key: string]: any };
}

/**
 * Bound class definition for a solution
 */
export interface BoundClassRawData {
  className: string;
  displayName: string;
  description: string;
  fields: {
    name: string;
    displayName: string;
    type: string;
    defaultValue?: any;
    description?: string;
  }[];
  methods: {
    name: string;
    displayName: string;
    parameters: { name: string; type: string; default?: any }[];
    returnType: string;
    description?: string;
  }[];
  pythonImports?: string[];
  typescriptImports?: string[];
}

/**
 * Raw data interface for Slot - matches what would come from an API
 */
export interface SlotRawData {
  index: number;
  stateName: string;
  slotAngularPosition: number;
  connectors: ConnectorRawData[];
  isInput: boolean;
  allowOneToMany: boolean;
  allowManyToOne: boolean;
  // Slot configuration properties
  color?: string;
  /** Full name of the slot (unlimited length) */
  name?: string;
  /** Short abbreviation displayed on the visual marker (max 3 characters) */
  label?: string;
  mappingMode?: string;
  description?: string;
  parameterName?: string;
  parameterType?: string;
  returnType?: string;
  // Output-specific configuration
  sourceInstance?: 'solution_instance' | 'helper_instance';
  propertyPath?: string;
  passthroughVariableName?: string;
  // Conditional output configuration
  isConditional?: boolean;
  conditionExpression?: string;
  conditionLabel?: string;
  conditionalGroup?: string;
}

/**
 * Raw data interface for Connector - matches what would come from an API
 */
export interface ConnectorRawData {
  id: number;
  sourceSlot: number;
  sinkSlot: number;
  targetStateName?: string; // The state name that contains the sink slot
}

/**
 * Raw data interface for NoCodeSolution - matches what would come from an API
 */
export interface NoCodeSolutionRawData {
  id: number;
  solutionName: string;
  xBounds: number;
  yBounds: number;
  stateInstances: NoCodeStateRawData[];
  // Bound class for this solution
  boundClass?: BoundClassRawData;
  // Function name for code generation
  functionName?: string;
  // Target runtime for this solution (defaults to 'python_backend' if undefined)
  targetRuntime?: TargetRuntime;
}

/**
 * Sample Solution 1: "AdditionTester.test_addition" - Simple arithmetic with conditional check
 * Tests adding two numbers and checking if the result matches an expected value
 *
 * Flow (Parallel Branch & Merge Pattern):
 *                     ┌→ [Compute Sum] ────────┐
 * [Start] ────────────┤                        ├→ [Check Result] → Return True/False
 *                     └→ [Get Expected] ───────┘
 *
 * 1. Start with input variables (num_a, num_b, expected_result)
 * 2. PARALLEL: Compute Sum (sum_result = num_a + num_b)
 * 3. PARALLEL: Get Expected (comparison_value = expected_result)
 * 4. Check Result compares inputs from both branches using ValueSourceConfig
 * 5. Output the boolean result
 */
export const MOCK_SOLUTION_ADDITION_TEST: NoCodeSolutionRawData = {
  id: 1,
  solutionName: "AdditionTester.test_addition",
  functionName: "test_addition",
  targetRuntime: 'python_backend',
  xBounds: 1000,
  yBounds: 600,
  boundClass: {
    className: "AdditionTester",
    displayName: "Addition Tester",
    description: "A simple test that adds two numbers and checks if the result matches an expected value",
    pythonImports: [],
    fields: [
      { name: "num_a", displayName: "Number A", type: "int", defaultValue: 0, description: "First number to add" },
      { name: "num_b", displayName: "Number B", type: "int", defaultValue: 0, description: "Second number to add" },
      { name: "expected_result", displayName: "Expected Result", type: "int", defaultValue: 0, description: "Expected sum for comparison" },
      { name: "sum_result", displayName: "Sum Result", type: "int", defaultValue: 0, description: "Calculated sum of num_a + num_b" },
      { name: "test_passed", displayName: "Test Passed", type: "bool", defaultValue: false, description: "Whether the sum matches expected" }
    ],
    methods: [
      {
        name: "test_addition",
        displayName: "Test Addition",
        parameters: [
          { name: "num_a", type: "int" },
          { name: "num_b", type: "int" },
          { name: "expected_result", type: "int" }
        ],
        returnType: "bool",
        description: "Add two numbers and check if result matches expected value"
      }
    ]
  },
  stateInstances: [
    // Start State - Green Circle (1 output slot → Compute Sum)
    {
      stateName: "Start",
      id: "start-state",
      index: 0,
      shapeType: "circle",
      solutionName: "AdditionTester.test_addition",
      stateClass: "InitialState",
      boundObjectClass: "InitialState",
      boundObjectFieldValues: {
        displayName: "Start",
        description: "Begin addition test with input parameters",
        inputParams: [
          { name: "num_a", type: "int", description: "First number" },
          { name: "num_b", type: "int", description: "Second number" },
          { name: "expected_result", type: "int", description: "Expected sum" }
        ]
      },
      stateSvgSizeX: null,
      stateSvgSizeY: null,
      stateSvgRadius: 60,
      layerName: "start-layer",
      stateLocationX: 80,
      stateLocationY: 280,
      stateSvgName: "circle",
      slots: [
        // Output slot 0 → Compute Sum
        {
          index: 0,
          stateName: "Start",
          slotAngularPosition: 0,
          connectors: [{ id: 1, sourceSlot: 0, sinkSlot: 0, targetStateName: "Compute Sum" }],
          isInput: false,
          allowOneToMany: true,
          allowManyToOne: false,
          label: "Out"
        }
      ],
      slotRadius: 5,
      backgroundColor: "#4CAF50"  // Green for start
    },
    // Compute Sum - Variable Assignment (Purple) - computes sum_result = num_a + num_b
    {
      stateName: "Compute Sum",
      id: "compute-sum",
      index: 1,
      shapeType: "circle",
      solutionName: "AdditionTester.test_addition",
      stateClass: "VariableAssignment",
      boundObjectClass: "VariableAssignment",
      boundObjectFieldValues: {
        displayName: "Compute Sum",
        variableName: "sum_result",
        value: "num_a + num_b",
        dataType: "int",
        description: "Calculate the sum of the two input numbers"
      },
      stateSvgSizeX: null,
      stateSvgSizeY: null,
      stateSvgRadius: 65,
      layerName: "assignment-layer",
      stateLocationX: 300,
      stateLocationY: 280,
      stateSvgName: "circle",
      slots: [
        // Input slot 0 - receives from Start
        {
          index: 0,
          stateName: "Compute Sum",
          slotAngularPosition: 180,
          connectors: [],
          isInput: true,
          allowOneToMany: false,
          allowManyToOne: true,
          label: "In"
        },
        // Output slot 1 → Check Result
        {
          index: 1,
          stateName: "Compute Sum",
          slotAngularPosition: 0,
          connectors: [{ id: 2, sourceSlot: 1, sinkSlot: 0, targetStateName: "Check Result" }],
          isInput: false,
          allowOneToMany: true,
          allowManyToOne: false,
          label: "Out"
        }
      ],
      slotRadius: 5,
      backgroundColor: "#9C27B0"  // Purple for variable assignment
    },
    // Check Result - Conditional (Diamond shape) - compares sum_result == expected_result
    {
      stateName: "Check Result",
      id: "check-result",
      index: 2,
      shapeType: "diamond",
      solutionName: "AdditionTester.test_addition",
      stateClass: "ConditionalChain",
      boundObjectClass: "ConditionalChain",
      boundObjectFieldValues: {
        displayName: "Check Result",
        description: "Check if the calculated sum matches the expected result",
        defaultLogicalOperator: "AND",
        links: [
          {
            id: "link_check_equality",
            displayName: "sum_result == expected_result",
            conditionType: "equals",
            logicalOperator: "AND",
            isStateSpaceObject: true,
            leftSource: {
              sourceType: "from_object",
              objectFieldPath: "self.sum_result"
            },
            rightSource: {
              sourceType: "from_object",
              objectFieldPath: "self.expected_result"
            },
            fieldName: "sum_result",
            conditionValue: "expected_result"
          }
        ]
      },
      stateSvgSizeX: null,
      stateSvgSizeY: null,
      stateSvgRadius: 70,
      layerName: "conditional-layer",
      stateLocationX: 520,
      stateLocationY: 280,
      stateSvgName: "diamond",
      slots: [
        // Input slot 0 - receives from Compute Sum
        {
          index: 0,
          stateName: "Check Result",
          slotAngularPosition: 180,
          connectors: [],
          isInput: true,
          allowOneToMany: false,
          allowManyToOne: true,
          label: "In"
        },
        // Output slot 1 - True path
        {
          index: 1,
          stateName: "Check Result",
          slotAngularPosition: 30,
          connectors: [{ id: 3, sourceSlot: 1, sinkSlot: 0, targetStateName: "Return True" }],
          isInput: false,
          allowOneToMany: true,
          allowManyToOne: false,
          label: "T",
          color: "#4CAF50",
          isConditional: true,
          conditionExpression: "true",
          conditionLabel: "If True",
          conditionalGroup: "conditional_result"
        },
        // Output slot 2 - False path
        {
          index: 2,
          stateName: "Check Result",
          slotAngularPosition: 330,
          connectors: [{ id: 4, sourceSlot: 2, sinkSlot: 0, targetStateName: "Return False" }],
          isInput: false,
          allowOneToMany: true,
          allowManyToOne: false,
          label: "F",
          color: "#F44336",
          isConditional: true,
          conditionExpression: "false",
          conditionLabel: "If False",
          conditionalGroup: "conditional_result"
        }
      ],
      slotRadius: 5,
      backgroundColor: "#4CAF50"  // Green for conditional
    },
    // Return True - End State (Success)
    {
      stateName: "Return True",
      id: "return-true",
      index: 3,
      shapeType: "rectangle",
      solutionName: "AdditionTester.test_addition",
      stateClass: "ReturnStatement",
      boundObjectClass: "ReturnStatement",
      boundObjectFieldValues: {
        displayName: "Return True",
        description: "Test passed - sum matches expected",
        returnValue: "True"
      },
      stateSvgSizeX: null,
      stateSvgSizeY: null,
      stateSvgRadius: null,
      stateSvgWidth: 120,
      stateSvgHeight: 80,
      cornerRadius: 8,
      layerName: "end-layer",
      stateLocationX: 740,
      stateLocationY: 180,
      stateSvgName: "rectangle",
      slots: [
        { index: 0, stateName: "Return True", slotAngularPosition: 180, connectors: [], isInput: true, allowOneToMany: false, allowManyToOne: true }
      ],
      slotRadius: 5,
      backgroundColor: "#4CAF50"  // Green for success
    },
    // Return False - End State (Failure)
    {
      stateName: "Return False",
      id: "return-false",
      index: 4,
      shapeType: "rectangle",
      solutionName: "AdditionTester.test_addition",
      stateClass: "ReturnStatement",
      boundObjectClass: "ReturnStatement",
      boundObjectFieldValues: {
        displayName: "Return False",
        description: "Test failed - sum does not match expected",
        returnValue: "False"
      },
      stateSvgSizeX: null,
      stateSvgSizeY: null,
      stateSvgRadius: null,
      stateSvgWidth: 120,
      stateSvgHeight: 80,
      cornerRadius: 8,
      layerName: "end-layer",
      stateLocationX: 740,
      stateLocationY: 380,
      stateSvgName: "rectangle",
      slots: [
        { index: 0, stateName: "Return False", slotAngularPosition: 180, connectors: [], isInput: true, allowOneToMany: false, allowManyToOne: true }
      ],
      slotRadius: 5,
      backgroundColor: "#F44336"  // Red for failure
    }
  ]
};

/**
 * Sample Solution 2: "UserFormSolution.detectChanges" - Frontend TypeScript solution
 * Detects changes on the user profile display and calls the backend to persist updates.
 *
 * Flow (with conditional gate):
 *                                             ┌→ [Call User.backend_update (AwaitBackendCall)] → [Log Success] → [Done]
 * [Start] → [Subscribe userForm$] → [Has Changes?] ─┤
 *                                             └→ [Skip - No Changes] → [Done]
 *
 * Demonstrates: FormSubscription for reactive form watching, ConditionalChain
 * to gate on actual changes, AwaitBackendCall to bridge to the backend solution,
 * and standard VariableAssignment / ReturnStatement blocks.
 */
export const MOCK_SOLUTION_USER_FORM_DETECT: NoCodeSolutionRawData = {
  id: 2,
  solutionName: "UserFormSolution.detectChanges",
  functionName: "detectChanges",
  targetRuntime: 'typescript_frontend',
  xBounds: 1400,
  yBounds: 700,
  boundClass: {
    className: "UserFormSolution",
    displayName: "User Form Solution",
    description: "Reactive frontend solution that watches the user profile form for changes and pushes updates to the backend",
    pythonImports: [],
    typescriptImports: [
      "import { Observable, Subscription } from 'rxjs';",
      "import { distinctUntilChanged, debounceTime, filter } from 'rxjs/operators';",
      "import { PolariService } from '@services/polari.service';"
    ],
    fields: [
      { name: "userId", displayName: "User ID", type: "str", defaultValue: "", description: "ID of the currently authenticated user" },
      { name: "originalData", displayName: "Original Data", type: "dict", defaultValue: {}, description: "Snapshot of the user data when the form loaded" },
      { name: "formData", displayName: "Form Data", type: "dict", defaultValue: {}, description: "Current form field values (two-way bound)" },
      { name: "hasChanges", displayName: "Has Changes", type: "bool", defaultValue: false, description: "Whether the form differs from the original data" },
      { name: "isSaving", displayName: "Is Saving", type: "bool", defaultValue: false, description: "Whether a backend save is in progress" },
      { name: "lastSaveResult", displayName: "Last Save Result", type: "bool", defaultValue: false, description: "Result of the most recent backend save" }
    ],
    methods: [
      {
        name: "detectChanges",
        displayName: "Detect Changes",
        parameters: [],
        returnType: "None",
        description: "Subscribe to user form changes and push updates to the backend when the form is dirty"
      }
    ]
  },
  stateInstances: [
    // ── Start ──
    {
      stateName: "Start",
      id: "start-state",
      index: 0,
      shapeType: "circle",
      solutionName: "UserFormSolution.detectChanges",
      stateClass: "InitialState",
      boundObjectClass: "InitialState",
      boundObjectFieldValues: {
        displayName: "Start",
        description: "Begin watching the user profile form for changes",
        inputParams: []
      },
      stateSvgSizeX: null, stateSvgSizeY: null, stateSvgRadius: 60,
      layerName: "start-layer",
      stateLocationX: 80, stateLocationY: 320,
      stateSvgName: "circle",
      slots: [
        {
          index: 0, stateName: "Start", slotAngularPosition: 0,
          connectors: [{ id: 201, sourceSlot: 0, sinkSlot: 0, targetStateName: "Subscribe Form" }],
          isInput: false, allowOneToMany: true, allowManyToOne: false,
          label: "To Subscribe"
        }
      ],
      slotRadius: 5,
      backgroundColor: "#4CAF50"
    },
    // ── Subscribe to userForm$ ──
    {
      stateName: "Subscribe Form",
      id: "subscribe-form",
      index: 1,
      shapeType: "circle",
      solutionName: "UserFormSolution.detectChanges",
      stateClass: "FormSubscription",
      boundObjectClass: "FormSubscription",
      boundObjectFieldValues: {
        displayName: "Watch User Form",
        sourceName: "userForm$",
        triggerType: "form_subscription",
        description: "Subscribe to the reactive user-profile form value stream (debounced & deduplicated)"
      },
      stateSvgSizeX: null, stateSvgSizeY: null, stateSvgRadius: 70,
      layerName: "frontend-layer",
      stateLocationX: 300, stateLocationY: 320,
      stateSvgName: "circle",
      slots: [
        { index: 0, stateName: "Subscribe Form", slotAngularPosition: 180, connectors: [], isInput: true, allowOneToMany: false, allowManyToOne: true, label: "Input" },
        {
          index: 1, stateName: "Subscribe Form", slotAngularPosition: 0,
          connectors: [{ id: 202, sourceSlot: 1, sinkSlot: 0, targetStateName: "Has Changes?" }],
          isInput: false, allowOneToMany: true, allowManyToOne: false,
          label: "formData", passthroughVariableName: "formData"
        }
      ],
      slotRadius: 5,
      backgroundColor: "#E91E63"
    },
    // ── Conditional: Has Changes? ──
    {
      stateName: "Has Changes?",
      id: "has-changes",
      index: 2,
      shapeType: "diamond",
      solutionName: "UserFormSolution.detectChanges",
      stateClass: "ConditionalChain",
      boundObjectClass: "ConditionalChain",
      boundObjectFieldValues: {
        displayName: "Has Changes?",
        description: "Check whether form data differs from the original snapshot",
        condition: "JSON.stringify(formData) !== JSON.stringify(this.originalData)",
        defaultLogicalOperator: "AND",
        links: [
          {
            id: "link_has_changes",
            displayName: "formData !== originalData",
            conditionType: "not_equals",
            logicalOperator: "AND",
            isStateSpaceObject: true,
            leftSource: { sourceType: "from_input", inputSlotIndex: 0, inputVariableName: "formData" },
            rightSource: { sourceType: "from_field", fieldPath: "self.originalData" },
            fieldName: "formData",
            conditionValue: "self.originalData"
          }
        ]
      },
      stateSvgSizeX: null, stateSvgSizeY: null, stateSvgRadius: 70,
      layerName: "conditional-layer",
      stateLocationX: 540, stateLocationY: 320,
      stateSvgName: "diamond",
      slots: [
        { index: 0, stateName: "Has Changes?", slotAngularPosition: 180, connectors: [], isInput: true, allowOneToMany: false, allowManyToOne: true, label: "formData", parameterName: "formData", parameterType: "object" },
        {
          index: 1, stateName: "Has Changes?", slotAngularPosition: 30,
          connectors: [{ id: 203, sourceSlot: 1, sinkSlot: 0, targetStateName: "Call Backend Update" }],
          isInput: false, allowOneToMany: true, allowManyToOne: false,
          label: "True", color: "#4CAF50", passthroughVariableName: "formData"
        },
        {
          index: 2, stateName: "Has Changes?", slotAngularPosition: 330,
          connectors: [{ id: 204, sourceSlot: 2, sinkSlot: 0, targetStateName: "No Changes" }],
          isInput: false, allowOneToMany: true, allowManyToOne: false,
          label: "False", color: "#F44336"
        }
      ],
      slotRadius: 5,
      backgroundColor: "#4CAF50"
    },
    // ── True path: Call User.backend_update via AwaitBackendCall ──
    {
      stateName: "Call Backend Update",
      id: "call-backend-update",
      index: 3,
      shapeType: "circle",
      solutionName: "UserFormSolution.detectChanges",
      stateClass: "AwaitBackendCall",
      boundObjectClass: "AwaitBackendCall",
      boundObjectFieldValues: {
        displayName: "Save to Backend",
        targetSolutionName: "User.backend_update",
        resultVariable: "saveResult",
        description: "Call User.backend_update with the changed form data and await success/failure"
      },
      stateSvgSizeX: null, stateSvgSizeY: null, stateSvgRadius: 70,
      layerName: "cross-runtime-layer",
      stateLocationX: 780, stateLocationY: 220,
      stateSvgName: "circle",
      slots: [
        { index: 0, stateName: "Call Backend Update", slotAngularPosition: 180, connectors: [], isInput: true, allowOneToMany: false, allowManyToOne: true, label: "formData" },
        {
          index: 1, stateName: "Call Backend Update", slotAngularPosition: 0,
          connectors: [{ id: 205, sourceSlot: 1, sinkSlot: 0, targetStateName: "Update Snapshot" }],
          isInput: false, allowOneToMany: true, allowManyToOne: false,
          label: "saveResult", passthroughVariableName: "saveResult"
        }
      ],
      slotRadius: 5,
      backgroundColor: "#FF5722"
    },
    // ── Update original snapshot so we don't re-trigger ──
    {
      stateName: "Update Snapshot",
      id: "update-snapshot",
      index: 4,
      shapeType: "circle",
      solutionName: "UserFormSolution.detectChanges",
      stateClass: "VariableAssignment",
      boundObjectClass: "VariableAssignment",
      boundObjectFieldValues: {
        displayName: "Update Snapshot",
        variableName: "this.originalData",
        value: "{ ...this.formData }",
        dataType: "object",
        description: "Sync the original-data snapshot with the saved form so subsequent comparisons are clean"
      },
      stateSvgSizeX: null, stateSvgSizeY: null, stateSvgRadius: 60,
      layerName: "assignment-layer",
      stateLocationX: 1020, stateLocationY: 220,
      stateSvgName: "circle",
      slots: [
        { index: 0, stateName: "Update Snapshot", slotAngularPosition: 180, connectors: [], isInput: true, allowOneToMany: false, allowManyToOne: true, label: "Input" },
        {
          index: 1, stateName: "Update Snapshot", slotAngularPosition: 0,
          connectors: [{ id: 206, sourceSlot: 1, sinkSlot: 0, targetStateName: "Done" }],
          isInput: false, allowOneToMany: true, allowManyToOne: false,
          label: "Output"
        }
      ],
      slotRadius: 5,
      backgroundColor: "#9C27B0"
    },
    // ── False path: No Changes (skip) ──
    {
      stateName: "No Changes",
      id: "no-changes",
      index: 5,
      shapeType: "circle",
      solutionName: "UserFormSolution.detectChanges",
      stateClass: "LogOutput",
      boundObjectClass: "LogOutput",
      boundObjectFieldValues: {
        displayName: "No Changes",
        messageTemplate: "Form unchanged — skipping backend call",
        logLevel: "debug"
      },
      stateSvgSizeX: null, stateSvgSizeY: null, stateSvgRadius: 55,
      layerName: "debug-layer",
      stateLocationX: 780, stateLocationY: 440,
      stateSvgName: "circle",
      slots: [
        { index: 0, stateName: "No Changes", slotAngularPosition: 180, connectors: [], isInput: true, allowOneToMany: false, allowManyToOne: true, label: "Input" },
        {
          index: 1, stateName: "No Changes", slotAngularPosition: 0,
          connectors: [{ id: 207, sourceSlot: 1, sinkSlot: 0, targetStateName: "Done" }],
          isInput: false, allowOneToMany: true, allowManyToOne: false,
          label: "Output"
        }
      ],
      slotRadius: 5,
      backgroundColor: "#607D8B"
    },
    // ── Done (merge point) ──
    {
      stateName: "Done",
      id: "done-state",
      index: 6,
      shapeType: "rectangle",
      solutionName: "UserFormSolution.detectChanges",
      stateClass: "ReturnStatement",
      boundObjectClass: "ReturnStatement",
      boundObjectFieldValues: {
        displayName: "Done",
        description: "Change-detection cycle complete",
        returnValue: "void"
      },
      stateSvgSizeX: null, stateSvgSizeY: null, stateSvgRadius: null,
      stateSvgWidth: 120, stateSvgHeight: 80, cornerRadius: 8,
      layerName: "end-layer",
      stateLocationX: 1240, stateLocationY: 320,
      stateSvgName: "rectangle",
      slots: [
        { index: 0, stateName: "Done", slotAngularPosition: 180, connectors: [], isInput: true, allowOneToMany: false, allowManyToOne: true }
      ],
      slotRadius: 5,
      backgroundColor: "#F44336"
    }
  ]
};

/**
 * Sample Solution 3: "User.backend_update" - Backend Python solution
 * Called by UserFormSolution.detectChanges to persist user profile changes.
 *
 * Flow:
 *                              ┌→ [Update Fields] → [Log Success] → [Return True]
 * [Start] → [Validate Data] ──┤
 *                              └→ [Log Failure] → [Return False]
 *
 * Bound to the User class with fields typical of a user profile.
 */
export const MOCK_SOLUTION_USER_BACKEND_UPDATE: NoCodeSolutionRawData = {
  id: 3,
  solutionName: "User.backend_update",
  functionName: "backend_update",
  targetRuntime: 'python_backend',
  xBounds: 1200,
  yBounds: 700,
  boundClass: {
    className: "User",
    displayName: "User",
    description: "Represents an authenticated user in the system — the owner of the profile being edited",
    pythonImports: [
      "from typing import Optional",
      "from datetime import datetime"
    ],
    fields: [
      { name: "user_id", displayName: "User ID", type: "str", description: "Unique user identifier" },
      { name: "username", displayName: "Username", type: "str", defaultValue: "", description: "Login name" },
      { name: "email", displayName: "Email", type: "str", defaultValue: "", description: "Primary email address" },
      { name: "display_name", displayName: "Display Name", type: "str", defaultValue: "", description: "Name shown in the UI" },
      { name: "bio", displayName: "Bio", type: "str", defaultValue: "", description: "Short user biography" },
      { name: "avatar_url", displayName: "Avatar URL", type: "Optional[str]", description: "URL to the profile picture" },
      { name: "updated_at", displayName: "Updated At", type: "Optional[datetime]", description: "Timestamp of the last profile update" }
    ],
    methods: [
      {
        name: "backend_update",
        displayName: "Backend Update",
        parameters: [
          { name: "update_data", type: "dict" }
        ],
        returnType: "bool",
        description: "Validate and persist user profile changes — only the owning user may call this"
      },
      {
        name: "get_profile",
        displayName: "Get Profile",
        parameters: [],
        returnType: "dict",
        description: "Return a sanitised dict of the user profile for the frontend"
      }
    ]
  },
  stateInstances: [
    // ── Start ──
    {
      stateName: "Start",
      id: "start-state",
      index: 0,
      shapeType: "circle",
      solutionName: "User.backend_update",
      stateClass: "InitialState",
      boundObjectClass: "InitialState",
      boundObjectFieldValues: {
        displayName: "Start",
        description: "Receive update_data dict from the frontend",
        inputParams: [
          { name: "update_data", type: "dict", description: "Dictionary of changed profile fields" }
        ]
      },
      stateSvgSizeX: null, stateSvgSizeY: null, stateSvgRadius: 60,
      layerName: "start-layer",
      stateLocationX: 80, stateLocationY: 320,
      stateSvgName: "circle",
      slots: [
        {
          index: 0, stateName: "Start", slotAngularPosition: 0,
          connectors: [{ id: 301, sourceSlot: 0, sinkSlot: 0, targetStateName: "Validate Data" }],
          isInput: false, allowOneToMany: true, allowManyToOne: false,
          label: "To Validate", passthroughVariableName: "update_data"
        }
      ],
      slotRadius: 5,
      backgroundColor: "#4CAF50"
    },
    // ── Validate incoming data ──
    {
      stateName: "Validate Data",
      id: "validate-data",
      index: 1,
      shapeType: "diamond",
      solutionName: "User.backend_update",
      stateClass: "ConditionalChain",
      boundObjectClass: "ConditionalChain",
      boundObjectFieldValues: {
        displayName: "Validate Data",
        description: "Ensure the update payload is non-empty and contains only allowed fields",
        condition: "update_data and all(k in allowed_fields for k in update_data)",
        defaultLogicalOperator: "AND",
        links: [
          {
            id: "link_validate",
            displayName: "update_data is valid",
            conditionType: "custom",
            logicalOperator: "AND",
            isStateSpaceObject: true,
            leftSource: { sourceType: "from_input", inputSlotIndex: 0, inputVariableName: "update_data" },
            rightSource: { sourceType: "literal", literalValue: "True" },
            fieldName: "update_data",
            conditionValue: "True"
          }
        ]
      },
      stateSvgSizeX: null, stateSvgSizeY: null, stateSvgRadius: 70,
      layerName: "conditional-layer",
      stateLocationX: 300, stateLocationY: 320,
      stateSvgName: "diamond",
      slots: [
        { index: 0, stateName: "Validate Data", slotAngularPosition: 180, connectors: [], isInput: true, allowOneToMany: false, allowManyToOne: true, label: "update_data", parameterName: "update_data", parameterType: "dict" },
        {
          index: 1, stateName: "Validate Data", slotAngularPosition: 30,
          connectors: [{ id: 302, sourceSlot: 1, sinkSlot: 0, targetStateName: "Update Fields" }],
          isInput: false, allowOneToMany: true, allowManyToOne: false,
          label: "Valid", color: "#4CAF50", passthroughVariableName: "update_data"
        },
        {
          index: 2, stateName: "Validate Data", slotAngularPosition: 330,
          connectors: [{ id: 303, sourceSlot: 2, sinkSlot: 0, targetStateName: "Log Failure" }],
          isInput: false, allowOneToMany: true, allowManyToOne: false,
          label: "Invalid", color: "#F44336"
        }
      ],
      slotRadius: 5,
      backgroundColor: "#4CAF50"
    },
    // ── Update User Fields (ForEach over update_data keys) ──
    {
      stateName: "Update Fields",
      id: "update-fields",
      index: 2,
      shapeType: "circle",
      solutionName: "User.backend_update",
      stateClass: "ForEachLoop",
      boundObjectClass: "ForEachLoop",
      boundObjectFieldValues: {
        displayName: "Apply Updates",
        itemVariable: "field_name",
        indexVariable: "idx",
        collectionVariable: "update_data.keys()",
        description: "Iterate over each changed field and set it on the User object"
      },
      stateSvgSizeX: null, stateSvgSizeY: null, stateSvgRadius: 65,
      layerName: "loop-layer",
      stateLocationX: 540, stateLocationY: 220,
      stateSvgName: "circle",
      slots: [
        { index: 0, stateName: "Update Fields", slotAngularPosition: 180, connectors: [], isInput: true, allowOneToMany: false, allowManyToOne: true, label: "update_data" },
        {
          index: 1, stateName: "Update Fields", slotAngularPosition: 0,
          connectors: [{ id: 304, sourceSlot: 1, sinkSlot: 0, targetStateName: "Set Timestamp" }],
          isInput: false, allowOneToMany: true, allowManyToOne: false,
          label: "Loop Done"
        }
      ],
      slotRadius: 5,
      backgroundColor: "#2196F3"
    },
    // ── Set updated_at timestamp ──
    {
      stateName: "Set Timestamp",
      id: "set-timestamp",
      index: 3,
      shapeType: "circle",
      solutionName: "User.backend_update",
      stateClass: "VariableAssignment",
      boundObjectClass: "VariableAssignment",
      boundObjectFieldValues: {
        displayName: "Set Timestamp",
        variableName: "self.updated_at",
        value: "datetime.utcnow()",
        dataType: "datetime",
        description: "Record the timestamp of this profile update"
      },
      stateSvgSizeX: null, stateSvgSizeY: null, stateSvgRadius: 60,
      layerName: "assignment-layer",
      stateLocationX: 740, stateLocationY: 220,
      stateSvgName: "circle",
      slots: [
        { index: 0, stateName: "Set Timestamp", slotAngularPosition: 180, connectors: [], isInput: true, allowOneToMany: false, allowManyToOne: true, label: "Input" },
        {
          index: 1, stateName: "Set Timestamp", slotAngularPosition: 0,
          connectors: [{ id: 305, sourceSlot: 1, sinkSlot: 0, targetStateName: "Log Success" }],
          isInput: false, allowOneToMany: true, allowManyToOne: false,
          label: "Output"
        }
      ],
      slotRadius: 5,
      backgroundColor: "#9C27B0"
    },
    // ── Log Success ──
    {
      stateName: "Log Success",
      id: "log-success",
      index: 4,
      shapeType: "circle",
      solutionName: "User.backend_update",
      stateClass: "LogOutput",
      boundObjectClass: "LogOutput",
      boundObjectFieldValues: {
        displayName: "Log Success",
        messageTemplate: "User {self.user_id} profile updated successfully",
        logLevel: "info"
      },
      stateSvgSizeX: null, stateSvgSizeY: null, stateSvgRadius: 55,
      layerName: "debug-layer",
      stateLocationX: 940, stateLocationY: 220,
      stateSvgName: "circle",
      slots: [
        { index: 0, stateName: "Log Success", slotAngularPosition: 180, connectors: [], isInput: true, allowOneToMany: false, allowManyToOne: true, label: "Input" },
        {
          index: 1, stateName: "Log Success", slotAngularPosition: 0,
          connectors: [{ id: 306, sourceSlot: 1, sinkSlot: 0, targetStateName: "Commit Changes" }],
          isInput: false, allowOneToMany: true, allowManyToOne: false,
          label: "Output"
        }
      ],
      slotRadius: 5,
      backgroundColor: "#607D8B"
    },
    // ── Commit Changes (success — StateChangeCommit end state) ──
    {
      stateName: "Commit Changes",
      id: "commit-changes",
      index: 5,
      shapeType: "rectangle",
      solutionName: "User.backend_update",
      stateClass: "StateChangeCommit",
      boundObjectClass: "StateChangeCommit",
      boundObjectFieldValues: {
        displayName: "Commit Changes",
        description: "Profile update succeeded — commit to backend",
        targetFieldName: "user_profile",
        changeType: "update"
      },
      stateSvgSizeX: null, stateSvgSizeY: null, stateSvgRadius: null,
      stateSvgWidth: 120, stateSvgHeight: 80, cornerRadius: 8,
      layerName: "end-layer",
      stateLocationX: 1100, stateLocationY: 220,
      stateSvgName: "rectangle",
      slots: [
        { index: 0, stateName: "Commit Changes", slotAngularPosition: 180, connectors: [], isInput: true, allowOneToMany: false, allowManyToOne: true }
      ],
      slotRadius: 5,
      backgroundColor: "#4CAF50"
    },
    // ── Log Failure (invalid data path) ──
    {
      stateName: "Log Failure",
      id: "log-failure",
      index: 6,
      shapeType: "circle",
      solutionName: "User.backend_update",
      stateClass: "LogOutput",
      boundObjectClass: "LogOutput",
      boundObjectFieldValues: {
        displayName: "Log Failure",
        messageTemplate: "User {self.user_id} update rejected — invalid payload",
        logLevel: "warning"
      },
      stateSvgSizeX: null, stateSvgSizeY: null, stateSvgRadius: 55,
      layerName: "debug-layer",
      stateLocationX: 540, stateLocationY: 440,
      stateSvgName: "circle",
      slots: [
        { index: 0, stateName: "Log Failure", slotAngularPosition: 180, connectors: [], isInput: true, allowOneToMany: false, allowManyToOne: true, label: "Input" },
        {
          index: 1, stateName: "Log Failure", slotAngularPosition: 0,
          connectors: [{ id: 307, sourceSlot: 1, sinkSlot: 0, targetStateName: "Return False" }],
          isInput: false, allowOneToMany: true, allowManyToOne: false,
          label: "Output"
        }
      ],
      slotRadius: 5,
      backgroundColor: "#607D8B"
    },
    // ── Return False (failure) ──
    {
      stateName: "Return False",
      id: "return-false",
      index: 7,
      shapeType: "rectangle",
      solutionName: "User.backend_update",
      stateClass: "ReturnStatement",
      boundObjectClass: "ReturnStatement",
      boundObjectFieldValues: {
        displayName: "Return False",
        description: "Profile update failed — invalid data",
        returnValue: "False"
      },
      stateSvgSizeX: null, stateSvgSizeY: null, stateSvgRadius: null,
      stateSvgWidth: 120, stateSvgHeight: 80, cornerRadius: 8,
      layerName: "end-layer",
      stateLocationX: 780, stateLocationY: 440,
      stateSvgName: "rectangle",
      slots: [
        { index: 0, stateName: "Return False", slotAngularPosition: 180, connectors: [], isInput: true, allowOneToMany: false, allowManyToOne: true }
      ],
      slotRadius: 5,
      backgroundColor: "#F44336"
    }
  ]
};

/**
 * Collection of all mock solutions
 */
export const MOCK_SOLUTIONS: NoCodeSolutionRawData[] = [
  MOCK_SOLUTION_ADDITION_TEST,
  MOCK_SOLUTION_USER_FORM_DETECT,
  MOCK_SOLUTION_USER_BACKEND_UPDATE
];

/**
 * Get a mock solution by ID
 */
export function getMockSolutionById(id: number): NoCodeSolutionRawData | undefined {
  return MOCK_SOLUTIONS.find(solution => solution.id === id);
}

/**
 * Get a mock solution by name
 */
export function getMockSolutionByName(name: string): NoCodeSolutionRawData | undefined {
  return MOCK_SOLUTIONS.find(solution => solution.solutionName === name);
}

/**
 * Get all available solution names for selector UI
 */
export function getAvailableSolutionNames(): { id: number; name: string }[] {
  return MOCK_SOLUTIONS.map(solution => ({
    id: solution.id,
    name: solution.solutionName
  }));
}
