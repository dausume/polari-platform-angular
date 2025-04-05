// interaction-state.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type InteractionState =
  | 'none'
  | 'slot-drag'
  | 'connector-drag'
  | 'state-drag';

@Injectable({ providedIn: 'root' })
export class InteractionStateService {
  private interactionStateSubject = new BehaviorSubject<InteractionState>('none');
  public readonly interactionState$ = this.interactionStateSubject.asObservable();

  setInteractionState(state: InteractionState): void {
    this.interactionStateSubject.next(state);
  }

  clearInteractionState(): void {
    this.interactionStateSubject.next('none');
  }

  getCurrentState(): InteractionState {
    return this.interactionStateSubject.getValue();
  }
}