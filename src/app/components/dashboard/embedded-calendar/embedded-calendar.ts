import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { FullCalendarComponent, FullCalendarModule } from '@fullcalendar/angular';
import { CalendarOptions, EventClickArg, EventDropArg, EventInput } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin, { EventResizeDoneArg } from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import timeGridPlugin from '@fullcalendar/timegrid';

import { CrudDialogComponent } from '@components/shared/crud-dialog/crud-dialog';
import { CrudDialogData, CrudDialogResult, VariableDefinition } from '@components/shared/models/crud-config.models';
import { CRUDEservicesManager } from '@services/crude-services-manager';
import { PolariService } from '@services/polari-service';

interface LayerSummary {
  eventDefinition: string;
  class?: string;
  count: number;
  color?: string | null;
  missing?: boolean;
  reason?: string;
  unresolved?: { count: number; reasons: string[] };
  mapping?: { spanField: string; startField: string; endField: string; timeField: string; writable: boolean };
}

/**
 * cal-3: the CALENDAR display kind, embedded — the calendar twin of
 * embeddedTable / embeddedGraph. Resolves a CalendarDefinition by
 * NAME through /api/calendar/{name}/events for whatever range the
 * calendar shows (ids are instance-local; names are seedable), draws
 * it with FullCalendar (the one calendar engine — the same plugins
 * calendar-view-dialog uses), lets the reader toggle layers, opens
 * the linked row's CRUD dialog on click, and — when `editable` — lets
 * a drag/resize propose a write that is applied only after a confirm
 * (D4), through the row's own CRUDE class. Derived starts (relative
 * or recurring) are not draggable: the notice says so and points at
 * the row.
 */
@Component({
  standalone: true,
  selector: 'embedded-calendar',
  imports: [CommonModule, FullCalendarModule, MatDialogModule],
  template: `
    <div class="embedded-calendar">
      <div class="layers" *ngIf="layers.length">
        <button *ngFor="let l of layers" type="button" class="layer"
                [class.off]="hidden.has(l.eventDefinition)" [class.missing]="l.missing"
                [style.--layer-color]="l.color || '#5c6bc0'"
                (click)="toggle(l)" [title]="l.reason || (l.class || '')">
          <span class="dot"></span>{{ l.eventDefinition }}
          <span class="count">{{ l.count }}</span>
        </button>
      </div>
      <div class="notice" *ngIf="notice">{{ notice }}</div>
      <div class="pending" *ngIf="pending">
        Move <b>{{ pending.title }}</b> to {{ pending.when }}?
        <button type="button" class="apply" (click)="applyPending()">Apply</button>
        <button type="button" (click)="cancelPending()">Undo</button>
      </div>
      <div *ngIf="error" class="embedded-error">{{ error }}</div>
      <full-calendar *ngIf="!error" [options]="calendarOptions"></full-calendar>
      <div class="honesty" *ngIf="unresolvedText">{{ unresolvedText }}</div>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; min-width: 0; }
    .embedded-calendar { color: var(--text-on-card, #222); }
    .layers { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
    .layer {
      display: inline-flex; align-items: center; gap: 6px; font-size: 12px;
      padding: 2px 10px; border-radius: 12px; cursor: pointer;
      border: 1px solid var(--surface-outline, #bbb);
      background: var(--surface-secondary, #f5f5f5); color: inherit;
    }
    .layer .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--layer-color); }
    .layer.off { opacity: 0.45; }
    .layer.off .dot { background: transparent; border: 1px solid var(--layer-color); }
    .layer.missing { border-style: dashed; }
    .layer .count { font-variant-numeric: tabular-nums; opacity: 0.8; }
    .notice, .honesty { font-size: 12px; color: var(--text-on-card-muted, #666); margin: 4px 0; }
    .pending {
      font-size: 13px; padding: 6px 10px; margin-bottom: 6px; border-radius: 6px;
      background: var(--surface-secondary, #fff8e1); border: 1px solid var(--surface-outline, #ddd);
      display: flex; gap: 8px; align-items: center;
    }
    .pending button { font-size: 12px; padding: 2px 10px; border-radius: 4px; cursor: pointer;
      border: 1px solid var(--surface-outline, #bbb); background: transparent; color: inherit; }
    .pending button.apply { background: var(--brand-primary, #1565c0); color: var(--brand-primary-text, #fff); }
    .embedded-error {
      padding: 16px; color: var(--color-error-text, #c62828);
      background: var(--color-error-surface, #ffebee); font-size: 13px; border-radius: 4px;
    }
    :host ::ng-deep .fc { font-size: 12px; }
    :host ::ng-deep .fc .fc-toolbar-title { font-size: 15px; }
    :host ::ng-deep .fc .fc-button { padding: 2px 8px; font-size: 12px; text-transform: none; }
  `],
})
export class EmbeddedCalendarComponent implements OnInit {
  /** CalendarDefinition.name — resolved by name, never by id. Required. */
  @Input() calendarName = '';
  /** Scope every layer to a person / household (the page may pass '{object}'). */
  @Input() person = '';
  @Input() household = '';
  /** Override the definition's defaultView (dayGridMonth | timeGridWeek | timeGridDay | listWeek). */
  @Input() view = '';
  /** Drag/resize proposes a write (confirm → CRUDE PUT); default read-only. */
  @Input() editable: boolean | string = false;
  /** Calendar height (FullCalendar 'auto' or a CSS size). */
  @Input() height: string = 'auto';

  @ViewChild(FullCalendarComponent) calendarRef?: FullCalendarComponent;

  calendarOptions: CalendarOptions = {};
  layers: LayerSummary[] = [];
  hidden = new Set<string>();
  error = '';
  notice = '';
  unresolvedText = '';
  pending: { info: EventDropArg | EventResizeDoneArg; layer: LayerSummary; title: string; when: string } | null = null;
  private appliedDefaultView = false;

  constructor(private http: HttpClient,
              private polariService: PolariService,
              private crudeManager: CRUDEservicesManager,
              private dialog: MatDialog) {}

  ngOnInit(): void {
    if (!this.calendarName) {
      this.error = 'embedded-calendar: no calendarName input — which CalendarDefinition should this show?';
      return;
    }
    const editable = this.editable === true || this.editable === 'true';
    this.calendarOptions = {
      plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
      initialView: this.view || 'timeGridWeek',
      headerToolbar: { left: 'prev,next today', center: 'title',
                       right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek' },
      buttonText: { today: 'Today', month: 'Month', week: 'Week', day: 'Day', list: 'List' },
      firstDay: 1,
      height: this.height,
      nowIndicator: true,
      dayMaxEvents: 4,
      editable,
      eventStartEditable: editable,
      eventDurationEditable: editable,
      eventTimeFormat: { hour: '2-digit', minute: '2-digit', meridiem: 'short' },
      events: (info, success, failure) => {
        this.fetch(info.startStr.slice(0, 10), this.inclusiveEnd(info.endStr))
          .then(evs => success(evs))
          .catch(err => { this.error = err; failure(err); });
      },
      eventClick: (arg) => this.onEventClick(arg),
      eventDrop: (arg) => this.onEventChange(arg),
      eventResize: (arg) => this.onEventChange(arg),
    };
  }

  // ---- data ----------------------------------------------------------
  private fetch(from: string, to: string): Promise<EventInput[]> {
    const base = this.polariService.getBackendBaseUrl();
    const params: string[] = [`from=${from}`, `to=${to}`];
    if (this.person) { params.push(`person=${encodeURIComponent(this.person)}`); }
    if (this.household) { params.push(`household=${encodeURIComponent(this.household)}`); }
    const url = `${base}/api/calendar/${encodeURIComponent(this.calendarName)}/events?${params.join('&')}`;
    return new Promise((resolve, reject) => {
      this.http.get<any>(url, this.polariService.backendRequestOptions).subscribe({
        next: (body) => {
          if (!body || body.ok === false) {
            reject(body?.error || `GET ${url} answered without events`);
            return;
          }
          this.error = '';
          this.layers = (body.layers || []) as LayerSummary[];
          this.unresolvedText = this.describeUnresolved(this.layers);
          this.applyConfig(body.config || {});
          const evs = (body.events || []) as EventInput[];
          resolve(evs.filter(e => !this.hidden.has(String((e as any).extendedProps?.layer || ''))));
        },
        error: (err) => reject(err?.error?.error || err?.message || 'calendar request failed'),
      });
    });
  }

  private inclusiveEnd(endStr: string): string {
    // FullCalendar's end is EXCLUSIVE; the API window is inclusive dates.
    const d = new Date(endStr);
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  private applyConfig(config: any): void {
    if (this.appliedDefaultView) { return; }
    this.appliedDefaultView = true;
    const api = this.calendarRef?.getApi();
    if (api && !this.view && config.defaultView && config.defaultView !== api.view.type) {
      setTimeout(() => api.changeView(config.defaultView));
    }
    if (api && config.slotMinTime) { api.setOption('slotMinTime', config.slotMinTime); }
    if (api && config.slotMaxTime) { api.setOption('slotMaxTime', config.slotMaxTime); }
    if (api && config.weekStart !== undefined) { api.setOption('firstDay', Number(config.weekStart)); }
  }

  private describeUnresolved(layers: LayerSummary[]): string {
    const parts: string[] = [];
    for (const l of layers) {
      if (l.missing) { parts.push(`${l.eventDefinition}: ${l.reason}`); continue; }
      const u = l.unresolved;
      if (u && u.count > 0) {
        parts.push(`${l.eventDefinition}: ${u.count} row(s) not readable as events` +
          (u.reasons?.length ? ` (${u.reasons[0]})` : ''));
      }
    }
    return parts.join(' · ');
  }

  toggle(layer: LayerSummary): void {
    if (this.hidden.has(layer.eventDefinition)) { this.hidden.delete(layer.eventDefinition); }
    else { this.hidden.add(layer.eventDefinition); }
    this.calendarRef?.getApi().refetchEvents();
  }

  private refetch(): void { this.calendarRef?.getApi().refetchEvents(); }

  // ---- click → the linked row's own CRUD dialog ------------------------
  onEventClick(arg: EventClickArg): void {
    const props: any = arg.event.extendedProps || {};
    const className = props['class'];
    const rowName = props['rowName'];
    if (!className || !rowName) {
      this.notice = `${arg.event.title}: no linked row to open.`;
      return;
    }
    const svc = this.crudeManager.getCRUDEclassService(className);
    svc.readAll({ name: rowName }).subscribe({
      next: (data: any) => {
        const rows = this.parseInstances(data, className);
        const row = rows.find(r => String(r['name']) === String(rowName)) || rows[0];
        if (!row) { this.notice = `${className} "${rowName}" was not found.`; return; }
        this.openRow(className, row);
      },
      error: () => { this.notice = `Could not read ${className} "${rowName}".`; },
    });
  }

  private openRow(className: string, row: any): void {
    const dialogData: CrudDialogData = {
      mode: 'edit', className, classDisplayName: className,
      schema: this.inferSchema(row), instance: row, readOnlyFields: ['id'],
    };
    const ref = this.dialog.open(CrudDialogComponent, { data: dialogData, width: '640px', disableClose: true });
    ref.afterClosed().subscribe((result: CrudDialogResult) => {
      if (result?.action === 'save') { this.refetch(); }
    });
  }

  /** The dialog needs a schema; without class typing on a display page
   *  the row's own values say what each field is. */
  private inferSchema(row: any): VariableDefinition[] {
    const skip = new Set(['id', 'polariId', 'inTree', 'manager', 'branch']);
    const schema: VariableDefinition[] = [];
    for (const [key, value] of Object.entries(row || {})) {
      if (skip.has(key)) { continue; }
      let varType = 'str';
      if (typeof value === 'number') { varType = Number.isInteger(value) ? 'int' : 'float'; }
      else if (typeof value === 'boolean') { varType = 'bool'; }
      else if (Array.isArray(value)) { varType = 'list'; }
      else if (value && typeof value === 'object') { varType = 'dict'; }
      schema.push({ varName: key, varDisplayName: key.replace(/_/g, ' '), varType });
    }
    return schema;
  }

  private parseInstances(data: any, className: string): any[] {
    if (!data) { return []; }
    if (Array.isArray(data)) {
      if (data.length && data[0]?.[className]) {
        const out: any[] = [];
        for (const ds of data[0][className]) { if (Array.isArray(ds?.data)) { out.push(...ds.data); } }
        return out;
      }
      if (data.length === 1 && Array.isArray(data[0]?.data)) { return data[0].data; }
      return data;
    }
    if (Array.isArray(data.data)) { return data.data; }
    return [];
  }

  // ---- drag / resize → confirm → CRUDE PUT ---------------------------------
  onEventChange(info: EventDropArg | EventResizeDoneArg): void {
    const props: any = info.event.extendedProps || {};
    const layer = this.layers.find(l => l.eventDefinition === props['layer']);
    if (!layer?.mapping?.writable || !props['class'] || !props['rowId'] || props['occurrence'] !== null && props['occurrence'] !== undefined) {
      info.revert();
      this.notice = `${info.event.title}: its time is derived (a relative start or a recurrence) — ` +
        `change it on the row (${props['class'] || 'unknown class'}) instead of by dragging.`;
      return;
    }
    if (this.pending) { this.pending.info.revert(); }
    const start = info.event.start;
    const end = info.event.end;
    const when = start ? (info.event.allDay ? this.localDate(start) : this.localDateTime(start).replace('T', ' '))
      + (end ? ` – ${info.event.allDay ? this.localDate(end) : this.localDateTime(end).replace('T', ' ')}` : '') : '?';
    this.pending = { info, layer, title: info.event.title, when };
  }

  applyPending(): void {
    if (!this.pending) { return; }
    const { info, layer } = this.pending;
    const props: any = info.event.extendedProps || {};
    const m = layer.mapping!;
    const start = info.event.start!;
    const end = info.event.end;
    const allDay = info.event.allDay;
    const fmt = (d: Date) => allDay ? this.localDate(d) : this.localDateTime(d);
    const data: Record<string, string> = {};
    if (m.spanField) {
      data[m.spanField] = JSON.stringify(end ? { start: fmt(start), end: fmt(end) } : { start: fmt(start) });
    } else {
      if (m.startField) { data[m.startField] = m.timeField ? this.localDate(start) : fmt(start); }
      if (m.timeField && !allDay) { data[m.timeField] = this.localDateTime(start).slice(11, 16); }
      if (m.endField && end) { data[m.endField] = fmt(end); }
    }
    const svc = this.crudeManager.getCRUDEclassService(props['class']);
    svc.update(String(props['rowId']), data).subscribe({
      next: () => { this.pending = null; this.notice = `${info.event.title} moved.`; this.refetch(); },
      error: () => { info.revert(); this.pending = null; this.notice = `Could not save the move of ${info.event.title}.`; },
    });
  }

  cancelPending(): void {
    if (this.pending) { this.pending.info.revert(); }
    this.pending = null;
  }

  private localDate(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  private localDateTime(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${this.localDate(d)}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }
}
