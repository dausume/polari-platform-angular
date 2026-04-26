// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/states/await-backend-call/await-backend-call.model.ts

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
