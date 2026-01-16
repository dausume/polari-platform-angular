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
  layerName: string;
  stateLocationX: number;
  stateLocationY: number;
  stateSvgName: string;
  slots: SlotRawData[];
  slotRadius: number;
  backgroundColor: string;
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
 * Collection of all mock solutions
 */
export const MOCK_SOLUTIONS: NoCodeSolutionRawData[] = [
  MOCK_SOLUTION_TEST,
  MOCK_SOLUTION_ML_WORKFLOW
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
