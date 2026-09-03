// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/states/events/modify-event/modify-event.model.ts

import { EventFieldMapping, EventFieldsDict, ValueSourceOrLiteral } from '../event-field-mapping';

/**
 * ModifyEvent (cal-2) — Update fields of an existing event (or linked row).
 * Python backend only (the StateChangeCommit commit path).
 */
export class ModifyEvent {
  type = 'ModifyEvent';
  displayName: string;
  targetClassName: string;
  instanceRef: ValueSourceOrLiteral;
  fields: EventFieldsDict;
  fieldMappings: EventFieldMapping[];
  description: string;

  constructor(
    displayName: string = 'Modify Event',
    targetClassName: string = 'CalendarEvent',
    instanceRef: ValueSourceOrLiteral = '',
    fields: EventFieldsDict = {},
    fieldMappings: EventFieldMapping[] = [],
    description: string = 'Update fields of an existing event'
  ) {
    this.displayName = displayName;
    this.targetClassName = targetClassName;
    this.instanceRef = instanceRef;
    this.fields = fields;
    this.fieldMappings = fieldMappings;
    this.description = description;
  }
}
