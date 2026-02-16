import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { map, tap, catchError, switchMap } from 'rxjs/operators';
import { PolariService } from '@services/polari-service';
import { Display } from '@models/dashboards/Display';
import { DisplayRow } from '@models/dashboards/DisplayRow';
import { DisplayItem } from '@models/dashboards/DisplayItem';
import { DisplaySummary } from '@models/dashboards/DisplaySummary';

@Injectable({ providedIn: 'root' })
export class DisplayManagerService {

  displayList$ = new BehaviorSubject<DisplaySummary[]>([]);
  activeDisplayId$ = new BehaviorSubject<string | null>(null);
  draftDisplay$ = new BehaviorSubject<Display | null>(null);
  hasDraftChanges$ = new BehaviorSubject<boolean>(false);
  loading$ = new BehaviorSubject<boolean>(false);

  private readonly className = 'DisplayDefinition';

  constructor(private http: HttpClient, private polariService: PolariService) {}

  private get baseUrl(): string {
    return `${this.polariService.getBackendBaseUrl()}/${this.className}`;
  }

  fetchDisplayList(): void {
    this.loading$.next(true);
    this.http.get<any>(this.baseUrl, this.polariService.backendRequestOptions).subscribe({
      next: (response: any) => {
        const items = this.parseReadAllResponse(response);
        const summaries: DisplaySummary[] = items.map((item: any) => ({
          id: item.id,
          name: item.name || '',
          description: item.description || '',
          source_class: item.source_class || ''
        }));
        this.displayList$.next(summaries);
        this.loading$.next(false);
      },
      error: (err: any) => {
        console.error('[DisplayManager] Failed to fetch display list:', err);
        this.loading$.next(false);
      }
    });
  }

  fetchDisplaysForClass(sourceClass: string): void {
    this.loading$.next(true);
    console.log('[DisplayManager] fetchDisplaysForClass called for:', sourceClass);
    this.http.get<any>(this.baseUrl, this.polariService.backendRequestOptions).subscribe({
      next: (response: any) => {
        console.log('[DisplayManager] Raw GET response:', JSON.stringify(response));
        const items = this.parseReadAllResponse(response);
        console.log('[DisplayManager] Parsed items:', JSON.stringify(items));
        console.log('[DisplayManager] Item count:', items.length);
        if (items.length > 0) {
          console.log('[DisplayManager] First item keys:', Object.keys(items[0]));
          console.log('[DisplayManager] First item source_class:', items[0].source_class);
        }
        const summaries: DisplaySummary[] = items
          .filter((item: any) => (item.source_class || '') === sourceClass)
          .map((item: any) => ({
            id: item.id,
            name: item.name || '',
            description: item.description || '',
            source_class: item.source_class || ''
          }));
        console.log('[DisplayManager] Filtered summaries for', sourceClass, ':', summaries.length);
        this.displayList$.next(summaries);
        this.loading$.next(false);
      },
      error: (err: any) => {
        console.error('[DisplayManager] Failed to fetch displays for class:', err);
        this.loading$.next(false);
      }
    });
  }

  loadDisplay(id: string): Observable<Display> {
    this.loading$.next(true);
    this.activeDisplayId$.next(id);
    return this.http.get<any>(this.baseUrl, this.polariService.backendRequestOptions).pipe(
      map((response: any) => {
        const items = this.parseReadAllResponse(response);
        const backendObj = items.find((item: any) => item.id === id);
        if (!backendObj) {
          throw new Error(`Display ${id} not found`);
        }
        return this.deserializeDisplay(backendObj);
      }),
      tap((display: Display) => {
        this.draftDisplay$.next(display);
        this.hasDraftChanges$.next(false);
        this.loading$.next(false);
      }),
      catchError((err: any) => {
        this.loading$.next(false);
        return throwError(() => err);
      })
    );
  }

  createDisplay(name: string, description: string, source_class: string = ''): Observable<any> {
    const formData = new FormData();
    formData.append('initParamSets', JSON.stringify([{ name, description, source_class, definition: '{}' }]));
    return this.http.post(this.baseUrl, formData).pipe(
      tap(() => {
        if (source_class) {
          this.fetchDisplaysForClass(source_class);
        } else {
          this.fetchDisplayList();
        }
      }),
      map((response: any) => {
        // Extract created object id from response
        const items = this.parseReadAllResponse(response);
        if (items.length > 0) {
          return items[0];
        }
        // Parse response format: { "DisplayDefinition": { "id": {...} } }
        if (response && response[this.className]) {
          const ids = Object.keys(response[this.className]);
          if (ids.length > 0) {
            return { id: ids[0], ...response[this.className][ids[0]] };
          }
        }
        return response;
      })
    );
  }

  saveDisplay(display: Display): Observable<any> {
    const definition = this.serializeDisplay(display);
    const formData = new FormData();
    formData.append('polariId', display.id);
    formData.append('updateData', JSON.stringify({
      name: display.name,
      description: display.description,
      definition: definition
    }));
    return this.http.put(this.baseUrl, formData).pipe(
      tap(() => {
        this.hasDraftChanges$.next(false);
      })
    );
  }

  deleteDisplay(id: string): Observable<any> {
    const formData = new FormData();
    formData.append('targetInstance', JSON.stringify({ id }));
    return this.http.request('DELETE', this.baseUrl, { body: formData });
  }

  markDirty(): void {
    this.hasDraftChanges$.next(true);
  }

  updateDraft(display: Display): void {
    this.draftDisplay$.next(display);
    this.hasDraftChanges$.next(true);
  }

  serializeDisplay(display: Display): string {
    const data = {
      rows: display.rows.map(row => this.serializeRow(row))
    };
    return JSON.stringify(data);
  }

  private serializeRow(row: DisplayRow): any {
    return {
      index: row.index,
      rowSegments: row.rowSegments,
      minRowHeight: row.minRowHeight,
      maxRowHeight: row.maxRowHeight,
      autoHeight: row.autoHeight,
      cssClass: row.cssClass || '',
      items: row.dashboardItems.map(item => this.serializeItem(item))
    };
  }

  private serializeItem(item: DisplayItem): any {
    return {
      id: item.id,
      index: item.index,
      type: item.type,
      rowSegmentsUsed: item.rowSegmentsUsed,
      gridColumnStart: item.gridColumnStart ?? null,
      title: item.title || '',
      visible: item.visible,
      collapsed: item.collapsed,
      cssClass: item.cssClass || '',
      componentProps: item.componentProps || {},
      item: item.type === 'metric' || item.type === 'text' ? item.item : null,
      nestedRows: (item.nestedRows || []).map(r => this.serializeRow(r))
    };
  }

  deserializeDisplay(backendObj: any): Display {
    const display = new Display(backendObj.id, backendObj.name || '', backendObj.description || '');

    let parsed: any = {};
    if (backendObj.definition && backendObj.definition !== '{}') {
      try {
        parsed = typeof backendObj.definition === 'string'
          ? JSON.parse(backendObj.definition)
          : backendObj.definition;
      } catch (e) {
        console.warn('[DisplayManager] Failed to parse definition:', e);
      }
    }

    if (parsed.rows && Array.isArray(parsed.rows)) {
      parsed.rows.forEach((rowData: any) => {
        display.addRow(this.deserializeRow(rowData));
      });
    }

    return display;
  }

  private deserializeRow(rowData: any): DisplayRow {
    const row = new DisplayRow(
      rowData.index || 0,
      rowData.rowSegments || 12,
      rowData.minRowHeight || 250,
      rowData.maxRowHeight
    );
    row.autoHeight = rowData.autoHeight || false;
    row.cssClass = rowData.cssClass || undefined;

    if (rowData.items && Array.isArray(rowData.items)) {
      rowData.items.forEach((itemData: any) => {
        row.addItem(this.deserializeItem(itemData));
      });
    }

    return row;
  }

  private deserializeItem(itemData: any): DisplayItem {
    const item = new DisplayItem(
      itemData.index || 0,
      itemData.type || 'text',
      itemData.item || null,
      itemData.rowSegmentsUsed || 1,
      itemData.componentProps || {}
    );
    item.title = itemData.title || undefined;
    item.visible = itemData.visible !== false;
    item.collapsed = itemData.collapsed || false;
    item.cssClass = itemData.cssClass || undefined;
    if (itemData.id) {
      (item as any).id = itemData.id;
    }
    if (itemData.gridColumnStart != null) {
      item.gridColumnStart = itemData.gridColumnStart;
    }
    if (itemData.nestedRows && Array.isArray(itemData.nestedRows) && itemData.nestedRows.length > 0) {
      item.nestedRows = itemData.nestedRows.map((rd: any) => this.deserializeRow(rd));
    }
    return item;
  }

  private parseReadAllResponse(response: any): any[] {
    // Polari CRUDE GET returns:
    //   [{"ClassName": [{"class":"ClassName","varsLimited":[...],"data":[{instance},...]}, ...]}]
    // Step 1: Unwrap outer array → get the class-keyed object
    let unwrapped = response;
    if (Array.isArray(response) && response.length === 1 && response[0] && response[0][this.className]) {
      console.log('[DisplayManager] parseReadAll: unwrapping outer array');
      unwrapped = response[0];
    }
    // Step 2: Extract instances from the class data
    if (unwrapped && unwrapped[this.className]) {
      const classData = unwrapped[this.className];
      console.log('[DisplayManager] parseReadAll: classData type:', typeof classData, 'isArray:', Array.isArray(classData));
      if (Array.isArray(classData)) {
        // DataSet format: [{"class":"...","varsLimited":[...],"data":[instances...]}]
        const instances: any[] = [];
        classData.forEach((dataSet: any, idx: number) => {
          console.log('[DisplayManager] parseReadAll: dataSet[' + idx + '] keys:', Object.keys(dataSet));
          if (dataSet.data && Array.isArray(dataSet.data)) {
            console.log('[DisplayManager] parseReadAll: extracting', dataSet.data.length, 'instances from dataSet.data');
            instances.push(...dataSet.data);
          } else if (dataSet.id !== undefined) {
            console.log('[DisplayManager] parseReadAll: dataSet is plain instance with id:', dataSet.id);
            instances.push(dataSet);
          } else {
            console.log('[DisplayManager] parseReadAll: dataSet has no .data and no .id, skipping. Full dataSet:', JSON.stringify(dataSet));
          }
        });
        console.log('[DisplayManager] parseReadAll: total extracted instances:', instances.length);
        return instances;
      }
      // Object format: { id: { ...data } }
      const keys = Object.keys(classData);
      console.log('[DisplayManager] parseReadAll: object format, keys:', keys);
      return keys.map(key => ({ id: key, ...classData[key] }));
    }
    if (Array.isArray(response)) {
      console.log('[DisplayManager] parseReadAll: fallback - returning raw array, length:', response.length);
      return response;
    }
    if (response && response.data && Array.isArray(response.data)) {
      console.log('[DisplayManager] parseReadAll: fallback - returning response.data');
      return response.data;
    }
    console.log('[DisplayManager] parseReadAll: no matching format, returning []');
    return [];
  }
}
