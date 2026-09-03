// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/states/events/cancel-event/cancel-event.model.ts

import { ValueSourceOrLiteral } from '../event-field-mapping';

/**
 * CancelEvent (cal-2) — Soft-cancel an event (status=cancelled, reason kept
 * in notes). Hard delete stays a human CRUDE act. Python backend only.
 */
export class CancelEvent {
  type = 'CancelEvent';
  displayName: string;
  targetClassName: string;
  instanceRef: ValueSourceOrLiteral;
  reason: string;
  description: string;

  constructor(
    displayName: string = 'Cancel Event',
    targetClassName: string = 'CalendarEvent',
    instanceRef: ValueSourceOrLiteral = '',
    reason: string = '',
    description: string = 'Soft-cancel an event'
  ) {
    this.displayName = displayName;
    this.targetClassName = targetClassName;
    this.instanceRef = instanceRef;
    this.reason = reason;
    this.description = description;
  }
}
