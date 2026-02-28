// Author: Dustin Etts
// polari-platform-angular/src/app/models/stateSpace/frontendStates.ts
// Frontend state-space classes for TypeScript/reactive frontend solutions

/**
 * ReactiveTransform — Apply RxJS pipe operators (map, filter, switchMap, etc.)
 * Transforms data flowing through a reactive stream.
 */
export class ReactiveTransform {
  type = 'ReactiveTransform';
  displayName: string;
  operator: string;
  expression: string;
  description: string;

  constructor(
    displayName: string = 'Transform',
    operator: string = 'map',
    expression: string = '',
    description: string = 'Apply RxJS pipe transformation'
  ) {
    this.displayName = displayName;
    this.operator = operator;
    this.expression = expression;
    this.description = description;
  }
}

/**
 * AwaitBackendCall — Call a backend Python solution and await the response.
 * Cross-runtime bridge: frontend → backend.
 */
export class AwaitBackendCall {
  type = 'AwaitBackendCall';
  displayName: string;
  targetSolutionName: string;
  resultVariable: string;
  description: string;

  constructor(
    displayName: string = 'Await Backend',
    targetSolutionName: string = '',
    resultVariable: string = 'result',
    description: string = 'Call a backend solution and await response'
  ) {
    this.displayName = displayName;
    this.targetSolutionName = targetSolutionName;
    this.resultVariable = resultVariable;
    this.description = description;
  }
}
