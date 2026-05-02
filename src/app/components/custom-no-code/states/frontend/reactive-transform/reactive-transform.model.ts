// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/states/reactive-transform/reactive-transform.model.ts

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
