// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/states/emit-event/emit-event.model.ts

import { EndStateCompletionType } from '../../_shared/end-state-types';

/**
 * EmitEvent — Emit an event for cross-solution signaling.
 * TypeScript frontend only.
 */
export class EmitEvent {
  type = 'EmitEvent';
  completionType: EndStateCompletionType = 'emit_event';
  displayName: string;
  eventName: string;
  eventPayload: string;
  description: string;

  constructor(
    displayName: string = 'Emit Event',
    eventName: string = '',
    eventPayload: string = '{}',
    description: string = 'Emit event for cross-solution signaling'
  ) {
    this.displayName = displayName;
    this.eventName = eventName;
    this.eventPayload = eventPayload;
    this.description = description;
  }
}
