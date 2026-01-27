// Author: Dustin Etts
// polari-platform-angular/src/app/models/noCode/mock-NCS-data.ts
// Mock data for No-Code Solutions - simulates API responses

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
  label?: string;
  mappingMode?: string;
  description?: string;
  parameterName?: string;
  parameterType?: string;
  returnType?: string;
  // Output-specific configuration
  triggerType?: 'reactive' | 'functional';
  sourceInstance?: 'solution_instance' | 'helper_instance';
  propertyPath?: string;
  passthroughVariableName?: string;
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
}

/**
 * Sample Solution 1: "Addition Test" - Simple arithmetic with conditional check
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
  solutionName: "Addition Test",
  functionName: "test_addition",
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
      { name: "comparison_value", displayName: "Comparison Value", type: "int", defaultValue: 0, description: "Expected value passed through for comparison" },
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
    // Start State - Green Circle (2 output slots for parallel branches)
    {
      stateName: "Start",
      id: "start-state",
      index: 0,
      shapeType: "circle",
      solutionName: "Addition Test",
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
          slotAngularPosition: 30,
          connectors: [{ id: 1, sourceSlot: 0, sinkSlot: 0, targetStateName: "Compute Sum" }],
          isInput: false,
          allowOneToMany: true,
          allowManyToOne: false,
          label: "To Sum",
          passthroughVariableName: "num_a,num_b"
        },
        // Output slot 1 → Get Expected
        {
          index: 1,
          stateName: "Start",
          slotAngularPosition: 330,
          connectors: [{ id: 2, sourceSlot: 1, sinkSlot: 0, targetStateName: "Get Expected" }],
          isInput: false,
          allowOneToMany: true,
          allowManyToOne: false,
          label: "To Expected",
          passthroughVariableName: "expected_result"
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
      solutionName: "Addition Test",
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
      stateLocationX: 280,
      stateLocationY: 180,
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
          label: "Input"
        },
        // Output slot 1 → Check Result input 0
        {
          index: 1,
          stateName: "Compute Sum",
          slotAngularPosition: 0,
          connectors: [{ id: 3, sourceSlot: 1, sinkSlot: 0, targetStateName: "Check Result" }],
          isInput: false,
          allowOneToMany: true,
          allowManyToOne: false,
          label: "sum_result",
          passthroughVariableName: "sum_result"
        }
      ],
      slotRadius: 5,
      backgroundColor: "#9C27B0"  // Purple for variable assignment
    },
    // Get Expected - Variable Assignment (Purple) - passes through comparison_value = expected_result
    {
      stateName: "Get Expected",
      id: "get-expected",
      index: 2,
      shapeType: "circle",
      solutionName: "Addition Test",
      stateClass: "VariableAssignment",
      boundObjectClass: "VariableAssignment",
      boundObjectFieldValues: {
        displayName: "Get Expected",
        variableName: "comparison_value",
        value: "expected_result",
        dataType: "int",
        description: "Pass through the expected result for comparison"
      },
      stateSvgSizeX: null,
      stateSvgSizeY: null,
      stateSvgRadius: 65,
      layerName: "assignment-layer",
      stateLocationX: 280,
      stateLocationY: 380,
      stateSvgName: "circle",
      slots: [
        // Input slot 0 - receives from Start
        {
          index: 0,
          stateName: "Get Expected",
          slotAngularPosition: 180,
          connectors: [],
          isInput: true,
          allowOneToMany: false,
          allowManyToOne: true,
          label: "Input"
        },
        // Output slot 1 → Check Result input 1
        {
          index: 1,
          stateName: "Get Expected",
          slotAngularPosition: 0,
          connectors: [{ id: 4, sourceSlot: 1, sinkSlot: 1, targetStateName: "Check Result" }],
          isInput: false,
          allowOneToMany: true,
          allowManyToOne: false,
          label: "comparison_value",
          passthroughVariableName: "comparison_value"
        }
      ],
      slotRadius: 5,
      backgroundColor: "#9C27B0"  // Purple for variable assignment
    },
    // Check Result - Conditional (Green) - 2 input slots for merge
    {
      stateName: "Check Result",
      id: "check-result",
      index: 3,
      shapeType: "circle",
      solutionName: "Addition Test",
      stateClass: "ConditionalChain",
      boundObjectClass: "ConditionalChain",
      boundObjectFieldValues: {
        displayName: "Check Result",
        description: "Check if the calculated sum matches the expected result",
        defaultLogicalOperator: "AND",
        // New: ValueSourceConfig-based condition
        links: [
          {
            id: "link_check_equality",
            displayName: "sum_result == comparison_value",
            conditionType: "equals",
            logicalOperator: "AND",
            isStateSpaceObject: true,
            // Left side: from input slot 0 (sum_result)
            leftSource: {
              sourceType: "from_input",
              inputSlotIndex: 0,
              inputVariableName: "sum_result"
            },
            // Right side: from input slot 1 (comparison_value)
            rightSource: {
              sourceType: "from_input",
              inputSlotIndex: 1,
              inputVariableName: "comparison_value"
            },
            // Legacy compatibility
            fieldName: "sum_result",
            conditionValue: "comparison_value"
          }
        ]
      },
      stateSvgSizeX: null,
      stateSvgSizeY: null,
      stateSvgRadius: 70,
      layerName: "conditional-layer",
      stateLocationX: 520,
      stateLocationY: 280,
      stateSvgName: "circle",
      slots: [
        // Input slot 0 - receives sum_result from Compute Sum
        {
          index: 0,
          stateName: "Check Result",
          slotAngularPosition: 150,
          connectors: [],
          isInput: true,
          allowOneToMany: false,
          allowManyToOne: true,
          label: "sum_result",
          parameterName: "sum_result",
          parameterType: "int"
        },
        // Input slot 1 - receives comparison_value from Get Expected
        {
          index: 1,
          stateName: "Check Result",
          slotAngularPosition: 210,
          connectors: [],
          isInput: true,
          allowOneToMany: false,
          allowManyToOne: true,
          label: "comparison_value",
          parameterName: "comparison_value",
          parameterType: "int"
        },
        // Output slot 2 - True path
        {
          index: 2,
          stateName: "Check Result",
          slotAngularPosition: 30,
          connectors: [{ id: 5, sourceSlot: 2, sinkSlot: 0, targetStateName: "Return True" }],
          isInput: false,
          allowOneToMany: true,
          allowManyToOne: false,
          label: "True",
          color: "#4CAF50"
        },
        // Output slot 3 - False path
        {
          index: 3,
          stateName: "Check Result",
          slotAngularPosition: 330,
          connectors: [{ id: 6, sourceSlot: 3, sinkSlot: 0, targetStateName: "Return False" }],
          isInput: false,
          allowOneToMany: true,
          allowManyToOne: false,
          label: "False",
          color: "#F44336"
        }
      ],
      slotRadius: 5,
      backgroundColor: "#4CAF50"  // Green for conditional
    },
    // Return True - End State (Success)
    {
      stateName: "Return True",
      id: "return-true",
      index: 4,
      shapeType: "rectangle",
      solutionName: "Addition Test",
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
      index: 5,
      shapeType: "rectangle",
      solutionName: "Addition Test",
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
 * Sample Solution 2: "Order.process_order" - Realistic class method
 * Demonstrates a no-code function on a custom Order class
 */
export const MOCK_SOLUTION_ORDER_PROCESS: NoCodeSolutionRawData = {
  id: 2,
  solutionName: "Order.process_order",
  functionName: "process_order",
  xBounds: 1200,
  yBounds: 800,
  boundClass: {
    className: "Order",
    displayName: "Order",
    description: "Represents a customer order in the e-commerce system",
    pythonImports: [
      "from typing import Optional, List",
      "from datetime import datetime",
      "from decimal import Decimal"
    ],
    fields: [
      { name: "order_id", displayName: "Order ID", type: "str", description: "Unique identifier for the order" },
      { name: "customer_id", displayName: "Customer ID", type: "str", description: "ID of the customer who placed the order" },
      { name: "items", displayName: "Order Items", type: "List[dict]", defaultValue: [], description: "List of items in the order" },
      { name: "total_amount", displayName: "Total Amount", type: "Decimal", defaultValue: 0, description: "Total order amount" },
      { name: "status", displayName: "Status", type: "str", defaultValue: "pending", description: "Current order status" },
      { name: "created_at", displayName: "Created At", type: "datetime", description: "When the order was created" },
      { name: "processed_at", displayName: "Processed At", type: "Optional[datetime]", description: "When the order was processed" }
    ],
    methods: [
      {
        name: "process_order",
        displayName: "Process Order",
        parameters: [
          { name: "validate_inventory", type: "bool", default: true },
          { name: "send_notification", type: "bool", default: true }
        ],
        returnType: "bool",
        description: "Process the order: validate inventory, calculate totals, and update status"
      },
      {
        name: "cancel_order",
        displayName: "Cancel Order",
        parameters: [
          { name: "reason", type: "str" }
        ],
        returnType: "bool",
        description: "Cancel the order and refund if applicable"
      },
      {
        name: "get_total",
        displayName: "Get Total",
        parameters: [],
        returnType: "Decimal",
        description: "Calculate and return the total order amount"
      }
    ]
  },
  stateInstances: [
    // Initial State - Green Circle (Start)
    {
      stateName: "Start",
      id: "start-state",
      index: 0,
      shapeType: "circle",
      solutionName: "Order.process_order",
      stateClass: "InitialState",
      boundObjectClass: "InitialState",
      boundObjectFieldValues: {
        displayName: "Start",
        description: "Begin order processing",
        inputParams: [
          { name: "validate_inventory", type: "bool" },
          { name: "send_notification", type: "bool" }
        ]
      },
      stateSvgSizeX: null,
      stateSvgSizeY: null,
      stateSvgRadius: 60,
      layerName: "start-layer",
      stateLocationX: 100,
      stateLocationY: 350,
      stateSvgName: "circle",
      slots: [
        { index: 0, stateName: "Start", slotAngularPosition: 0, connectors: [], isInput: false, allowOneToMany: true, allowManyToOne: false }
      ],
      slotRadius: 5,
      backgroundColor: "#4CAF50"  // Green
    },
    // Validate Inventory - Conditional
    {
      stateName: "Check Inventory",
      id: "check-inventory",
      index: 1,
      shapeType: "circle",
      solutionName: "Order.process_order",
      stateClass: "ConditionalChain",
      boundObjectClass: "ConditionalChain",
      boundObjectFieldValues: {
        displayName: "Check Inventory",
        condition: "validate_inventory and self._check_stock()",
        defaultLogicalOperator: "AND"
      },
      stateSvgSizeX: null,
      stateSvgSizeY: null,
      stateSvgRadius: 70,
      layerName: "conditional-layer",
      stateLocationX: 280,
      stateLocationY: 350,
      stateSvgName: "circle",
      slots: [
        { index: 0, stateName: "Check Inventory", slotAngularPosition: 180, connectors: [], isInput: true, allowOneToMany: false, allowManyToOne: true },
        { index: 1, stateName: "Check Inventory", slotAngularPosition: 0, connectors: [], isInput: false, allowOneToMany: true, allowManyToOne: false },
        { index: 2, stateName: "Check Inventory", slotAngularPosition: 270, connectors: [], isInput: false, allowOneToMany: true, allowManyToOne: false }
      ],
      slotRadius: 5,
      backgroundColor: "#4CAF50"  // Green for conditional
    },
    // Calculate Total - Variable Assignment
    {
      stateName: "Calculate Total",
      id: "calc-total",
      index: 2,
      shapeType: "circle",
      solutionName: "Order.process_order",
      stateClass: "VariableAssignment",
      boundObjectClass: "VariableAssignment",
      boundObjectFieldValues: {
        displayName: "Calculate Total",
        variableName: "self.total_amount",
        value: "sum(item['price'] * item['quantity'] for item in self.items)",
        dataType: "Decimal"
      },
      stateSvgSizeX: null,
      stateSvgSizeY: null,
      stateSvgRadius: 65,
      layerName: "assignment-layer",
      stateLocationX: 460,
      stateLocationY: 250,
      stateSvgName: "circle",
      slots: [
        { index: 0, stateName: "Calculate Total", slotAngularPosition: 180, connectors: [], isInput: true, allowOneToMany: false, allowManyToOne: true },
        { index: 1, stateName: "Calculate Total", slotAngularPosition: 0, connectors: [], isInput: false, allowOneToMany: true, allowManyToOne: false }
      ],
      slotRadius: 5,
      backgroundColor: "#9C27B0"  // Purple for variable
    },
    // Update Status - Variable Assignment
    {
      stateName: "Update Status",
      id: "update-status",
      index: 3,
      shapeType: "circle",
      solutionName: "Order.process_order",
      stateClass: "VariableAssignment",
      boundObjectClass: "VariableAssignment",
      boundObjectFieldValues: {
        displayName: "Update Status",
        variableName: "self.status",
        value: "processing",
        dataType: "str"
      },
      stateSvgSizeX: null,
      stateSvgSizeY: null,
      stateSvgRadius: 65,
      layerName: "assignment-layer",
      stateLocationX: 640,
      stateLocationY: 250,
      stateSvgName: "circle",
      slots: [
        { index: 0, stateName: "Update Status", slotAngularPosition: 180, connectors: [], isInput: true, allowOneToMany: false, allowManyToOne: true },
        { index: 1, stateName: "Update Status", slotAngularPosition: 0, connectors: [], isInput: false, allowOneToMany: true, allowManyToOne: false }
      ],
      slotRadius: 5,
      backgroundColor: "#9C27B0"  // Purple for variable
    },
    // Send Notification - Conditional Function Call
    {
      stateName: "Send Notification",
      id: "send-notification",
      index: 4,
      shapeType: "circle",
      solutionName: "Order.process_order",
      stateClass: "ConditionalChain",
      boundObjectClass: "ConditionalChain",
      boundObjectFieldValues: {
        displayName: "Send Notification?",
        condition: "send_notification"
      },
      stateSvgSizeX: null,
      stateSvgSizeY: null,
      stateSvgRadius: 60,
      layerName: "conditional-layer",
      stateLocationX: 820,
      stateLocationY: 250,
      stateSvgName: "circle",
      slots: [
        { index: 0, stateName: "Send Notification", slotAngularPosition: 180, connectors: [], isInput: true, allowOneToMany: false, allowManyToOne: true },
        { index: 1, stateName: "Send Notification", slotAngularPosition: 0, connectors: [], isInput: false, allowOneToMany: true, allowManyToOne: false }
      ],
      slotRadius: 5,
      backgroundColor: "#4CAF50"
    },
    // Log Output - Debug
    {
      stateName: "Log Processing",
      id: "log-processing",
      index: 5,
      shapeType: "circle",
      solutionName: "Order.process_order",
      stateClass: "LogOutput",
      boundObjectClass: "LogOutput",
      boundObjectFieldValues: {
        displayName: "Log Processing",
        messageTemplate: "Order {self.order_id} processed successfully",
        logLevel: "info"
      },
      stateSvgSizeX: null,
      stateSvgSizeY: null,
      stateSvgRadius: 55,
      layerName: "debug-layer",
      stateLocationX: 460,
      stateLocationY: 450,
      stateSvgName: "circle",
      slots: [
        { index: 0, stateName: "Log Processing", slotAngularPosition: 90, connectors: [], isInput: true, allowOneToMany: false, allowManyToOne: true },
        { index: 1, stateName: "Log Processing", slotAngularPosition: 0, connectors: [], isInput: false, allowOneToMany: true, allowManyToOne: false }
      ],
      slotRadius: 5,
      backgroundColor: "#607D8B"  // Gray for debug
    },
    // End State - Red Rectangle (Success)
    {
      stateName: "Success",
      id: "end-success",
      index: 6,
      shapeType: "rectangle",
      solutionName: "Order.process_order",
      stateClass: "EndState",
      boundObjectClass: "EndState",
      boundObjectFieldValues: {
        displayName: "Success",
        description: "Order processed successfully",
        output: "True"
      },
      stateSvgSizeX: null,
      stateSvgSizeY: null,
      stateSvgRadius: null,
      stateSvgWidth: 120,
      stateSvgHeight: 120,
      cornerRadius: 8,
      layerName: "end-layer",
      stateLocationX: 1000,
      stateLocationY: 250,
      stateSvgName: "rectangle",
      slots: [
        { index: 0, stateName: "Success", slotAngularPosition: 180, connectors: [], isInput: true, allowOneToMany: false, allowManyToOne: true }
      ],
      slotRadius: 5,
      backgroundColor: "#F44336"  // Red for end state
    },
    // Return Statement - Red Rectangle (Failure path)
    {
      stateName: "Failed",
      id: "return-failure",
      index: 7,
      shapeType: "rectangle",
      solutionName: "Order.process_order",
      stateClass: "ReturnStatement",
      boundObjectClass: "ReturnStatement",
      boundObjectFieldValues: {
        displayName: "Failed",
        description: "Return failure result",
        returnValue: "False"
      },
      stateSvgSizeX: null,
      stateSvgSizeY: null,
      stateSvgRadius: null,
      stateSvgWidth: 120,
      stateSvgHeight: 120,
      cornerRadius: 8,
      layerName: "end-layer",
      stateLocationX: 460,
      stateLocationY: 550,
      stateSvgName: "rectangle",
      slots: [
        { index: 0, stateName: "Failed", slotAngularPosition: 90, connectors: [], isInput: true, allowOneToMany: false, allowManyToOne: true }
      ],
      slotRadius: 5,
      backgroundColor: "#F44336"  // Red for end state
    }
  ]
};

/**
 * Collection of all mock solutions
 */
export const MOCK_SOLUTIONS: NoCodeSolutionRawData[] = [
  MOCK_SOLUTION_ADDITION_TEST,
  MOCK_SOLUTION_ORDER_PROCESS
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
