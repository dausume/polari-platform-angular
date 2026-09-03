// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/states/events/generate-event/generate-event.model.ts

import { ValueSourceConfig } from '../../_shared/value-source-config';
import { EventFieldMapping, EventFieldsDict } from '../event-field-mapping';

/**
 * GenerateEvent (cal-2) — Create a CalendarEvent (or a row of any class an
 * EventDefinition reads) from resolved fields. Python backend only.
 * Field names match the backend handler's field_values keys.
 */
export class GenerateEvent {
  type = 'GenerateEvent';
  displayName: string;
  targetClassName: string;
  fields: EventFieldsDict;
  fieldMappings: EventFieldMapping[];
  eventsFrom: ValueSourceConfig | null;
  dedupeBy: string;
  resultVariable: string;
  description: string;

  constructor(
    displayName: string = 'Generate Event',
    targetClassName: string = 'CalendarEvent',
    fields: EventFieldsDict = {},
    fieldMappings: EventFieldMapping[] = [],
    eventsFrom: ValueSourceConfig | null = null,
    dedupeBy: string = '',
    resultVariable: string = 'generatedEvent',
    description: string = 'Create an event row from resolved fields'
  ) {
    this.displayName = displayName;
    this.targetClassName = targetClassName;
    this.fields = fields;
    this.fieldMappings = fieldMappings;
    this.eventsFrom = eventsFrom;
    this.dedupeBy = dedupeBy;
    this.resultVariable = resultVariable;
    this.description = description;
  }
}
