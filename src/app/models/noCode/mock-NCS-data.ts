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
 * Sample Solution 1: "testSolution" - 3 states (existing sample)
 * The original test solution with initial, intermediate, and final states
 */
export const MOCK_SOLUTION_TEST: NoCodeSolutionRawData = {
  id: 1,
  solutionName: "testSolution",
  xBounds: 1200,
  yBounds: 800,
  stateInstances: [
    {
      stateName: "initial-state",
      id: "state-id-0",
      index: 0,
      shapeType: "circle",
      solutionName: "testSolution",
      stateClass: "Polari Wrapped Python Class",
      stateSvgSizeX: null,
      stateSvgSizeY: null,
      stateSvgRadius: 100,
      layerName: "initial-state-layer",
      stateLocationX: 0,
      stateLocationY: 0,
      stateSvgName: "circle",
      slots: [
        {
          index: 0,
          stateName: "initial-state",
          slotAngularPosition: 0,
          connectors: [],
          isInput: false,
          allowOneToMany: false,
          allowManyToOne: false
        }
      ],
      slotRadius: 4,
      backgroundColor: "blue"
    },
    {
      stateName: "state-001",
      id: "state-id-1",
      index: 1,
      shapeType: "circle",
      solutionName: "testSolution",
      stateClass: "Polari Wrapped Python Class",
      stateSvgSizeX: null,
      stateSvgSizeY: null,
      stateSvgRadius: 100,
      layerName: "circle-state-layer",
      stateLocationX: 100,
      stateLocationY: 100,
      stateSvgName: "circle",
      slots: [
        {
          index: 0,
          stateName: "state-001",
          slotAngularPosition: 0,
          connectors: [],
          isInput: false,
          allowOneToMany: false,
          allowManyToOne: false
        },
        {
          index: 1,
          stateName: "state-001",
          slotAngularPosition: 180,
          connectors: [],
          isInput: false,
          allowOneToMany: false,
          allowManyToOne: false
        }
      ],
      slotRadius: 4,
      backgroundColor: "blue"
    },
    {
      stateName: "final-state",
      id: "state-id-2",
      index: 2,
      shapeType: "circle",
      solutionName: "testSolution",
      stateClass: "Polari Wrapped Python Class",
      stateSvgSizeX: null,
      stateSvgSizeY: null,
      stateSvgRadius: 100,
      layerName: "final-state-layer",
      stateLocationX: 200,
      stateLocationY: 200,
      stateSvgName: "circle",
      slots: [
        {
          index: 0,
          stateName: "final-state",
          slotAngularPosition: 0,
          connectors: [],
          isInput: false,
          allowOneToMany: false,
          allowManyToOne: false
        }
      ],
      slotRadius: 4,
      backgroundColor: "blue"
    }
  ]
};

/**
 * Sample Solution 2: "ML Workflow" - 4 states
 * A machine learning workflow with data prep, training, validation, and deployment
 */
export const MOCK_SOLUTION_ML_WORKFLOW: NoCodeSolutionRawData = {
  id: 2,
  solutionName: "ML Workflow",
  xBounds: 1200,
  yBounds: 800,
  stateInstances: [
    {
      stateName: "data-preparation",
      id: "state-id-0",
      index: 0,
      shapeType: "circle",
      solutionName: "ML Workflow",
      stateClass: "DataPreparationModule",
      stateSvgSizeX: null,
      stateSvgSizeY: null,
      stateSvgRadius: 90,
      layerName: "prep-state-layer",
      stateLocationX: 100,
      stateLocationY: 350,
      stateSvgName: "circle",
      slots: [
        {
          index: 0,
          stateName: "data-preparation",
          slotAngularPosition: 0,
          connectors: [],
          isInput: false,
          allowOneToMany: true,
          allowManyToOne: false
        }
      ],
      slotRadius: 5,
      backgroundColor: "#9C27B0"
    },
    {
      stateName: "model-training",
      id: "state-id-1",
      index: 1,
      shapeType: "circle",
      solutionName: "ML Workflow",
      stateClass: "ModelTrainingModule",
      stateSvgSizeX: null,
      stateSvgSizeY: null,
      stateSvgRadius: 100,
      layerName: "training-state-layer",
      stateLocationX: 350,
      stateLocationY: 200,
      stateSvgName: "circle",
      slots: [
        {
          index: 0,
          stateName: "model-training",
          slotAngularPosition: 180,
          connectors: [],
          isInput: true,
          allowOneToMany: false,
          allowManyToOne: true
        },
        {
          index: 1,
          stateName: "model-training",
          slotAngularPosition: 0,
          connectors: [],
          isInput: false,
          allowOneToMany: true,
          allowManyToOne: false
        },
        {
          index: 2,
          stateName: "model-training",
          slotAngularPosition: 90,
          connectors: [],
          isInput: false,
          allowOneToMany: false,
          allowManyToOne: false
        }
      ],
      slotRadius: 5,
      backgroundColor: "#E91E63"
    },
    {
      stateName: "model-validation",
      id: "state-id-2",
      index: 2,
      shapeType: "circle",
      solutionName: "ML Workflow",
      stateClass: "ModelValidationModule",
      stateSvgSizeX: null,
      stateSvgSizeY: null,
      stateSvgRadius: 85,
      layerName: "validation-state-layer",
      stateLocationX: 600,
      stateLocationY: 350,
      stateSvgName: "circle",
      slots: [
        {
          index: 0,
          stateName: "model-validation",
          slotAngularPosition: 180,
          connectors: [],
          isInput: true,
          allowOneToMany: false,
          allowManyToOne: false
        },
        {
          index: 1,
          stateName: "model-validation",
          slotAngularPosition: 0,
          connectors: [],
          isInput: false,
          allowOneToMany: true,
          allowManyToOne: false
        }
      ],
      slotRadius: 5,
      backgroundColor: "#00BCD4"
    },
    {
      stateName: "model-deployment",
      id: "state-id-3",
      index: 3,
      shapeType: "circle",
      solutionName: "ML Workflow",
      stateClass: "ModelDeploymentModule",
      stateSvgSizeX: null,
      stateSvgSizeY: null,
      stateSvgRadius: 95,
      layerName: "deployment-state-layer",
      stateLocationX: 850,
      stateLocationY: 200,
      stateSvgName: "circle",
      slots: [
        {
          index: 0,
          stateName: "model-deployment",
          slotAngularPosition: 180,
          connectors: [],
          isInput: true,
          allowOneToMany: false,
          allowManyToOne: true
        },
        {
          index: 1,
          stateName: "model-deployment",
          slotAngularPosition: 270,
          connectors: [],
          isInput: true,
          allowOneToMany: false,
          allowManyToOne: false
        }
      ],
      slotRadius: 5,
      backgroundColor: "#FF9800"
    }
  ]
};

/**
 * Sample Solution 3: "Order.process_order" - Realistic class method
 * Demonstrates a no-code function on a custom Order class
 */
export const MOCK_SOLUTION_ORDER_PROCESS: NoCodeSolutionRawData = {
  id: 3,
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
      stateSvgWidth: 120,  // Comparable to circles with radius 60 (diameter 120)
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
    // End State - Red Rectangle (Failure)
    {
      stateName: "Failed",
      id: "end-failure",
      index: 7,
      shapeType: "rectangle",
      solutionName: "Order.process_order",
      stateClass: "EndState",
      boundObjectClass: "EndState",
      boundObjectFieldValues: {
        displayName: "Failed",
        description: "Order processing failed",
        output: "False"
      },
      stateSvgSizeX: null,
      stateSvgSizeY: null,
      stateSvgRadius: null,
      stateSvgWidth: 120,  // Comparable to circles with radius 60 (diameter 120)
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
  MOCK_SOLUTION_TEST,
  MOCK_SOLUTION_ML_WORKFLOW,
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
