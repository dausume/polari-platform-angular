// Author: Dustin Etts
// polari-platform-angular/src/app/components/custom-no-code/states/events/event-window-query/event-window-query.model.ts

/**
 * EventWindowQuery (cal-2) — Read the events an EventDefinition or a
 * CalendarDefinition produces inside [from, to] (person/household scoped)
 * into a context list. Python backend only.
 */
export class EventWindowQuery {
  type = 'EventWindowQuery';
  displayName: string;
  definition: string;
  calendar: string;
  from: string;
  to: string;
  person: string;
  household: string;
  resultVariable: string;
  description: string;

  constructor(
    displayName: string = 'Event Window Query',
    definition: string = '',
    calendar: string = '',
    from: string = '',
    to: string = '',
    person: string = '',
    household: string = '',
    resultVariable: string = 'events',
    description: string = 'Read events inside a window into a context list'
  ) {
    this.displayName = displayName;
    this.definition = definition;
    this.calendar = calendar;
    this.from = from;
    this.to = to;
    this.person = person;
    this.household = household;
    this.resultVariable = resultVariable;
    this.description = description;
  }
}
