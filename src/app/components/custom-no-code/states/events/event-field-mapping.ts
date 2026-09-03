// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/states/events/event-field-mapping.ts

import { ValueSourceConfig } from '../_shared/value-source-config';

/**
 * One entry of a `fieldMappings` list on the event-family nodes
 * (GenerateEvent / ModifyEvent): the backend engine reads
 * `{ fieldName, valueSource }` and writes the resolved value onto the
 * target instance field. Shape mirrors SolutionExecutionEngine's
 * `_writes()` reader — keep the keys in step.
 */
export interface EventFieldMapping {
  fieldName: string;
  valueSource: ValueSourceConfig;
}

/**
 * A `fields` dict: fieldName → literal OR a ValueSourceConfig. The backend
 * distinguishes the two by the presence of `sourceType`.
 */
export type EventFieldsDict = { [fieldName: string]: any | ValueSourceConfig };

/** A value-source dict or a literal name/id string (instanceRef, schedule…). */
export type ValueSourceOrLiteral = ValueSourceConfig | string | null;
