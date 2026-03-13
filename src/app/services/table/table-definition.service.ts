import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { PolariService } from '@services/polari-service';
import { NamedTableConfig, TableDefinitionSummary } from '@models/tables/NamedTableConfig';

@Injectable({ providedIn: 'root' })
export class TableDefinitionService {

  configList$ = new BehaviorSubject<TableDefinitionSummary[]>([]);
  allConfigList$ = new BehaviorSubject<TableDefinitionSummary[]>([]);
  draftConfig$ = new BehaviorSubject<NamedTableConfig | null>(null);
  hasDraftChanges$ = new BehaviorSubject<boolean>(false);
  loading$ = new BehaviorSubject<boolean>(false);

  private readonly className = 'TableDefinition';

  constructor(private http: HttpClient, private polariService: PolariService) {}

  private get baseUrl(): string {
    return `${this.polariService.getBackendBaseUrl()}/${this.className}`;
  }

  fetchAllConfigs(): void {
    this.http.get<any>(this.baseUrl, this.polariService.backendRequestOptions).subscribe({
      next: (response: any) => {
        const items = this.parseReadAllResponse(response);
        const summaries: TableDefinitionSummary[] = items.map((item: any) => ({
          id: item.id,
          name: item.name || '',
          description: item.description || '',
          source_class: item.source_class || '',
          is_default_table: !!item.is_default_table,
          is_default_instance_display: !!(item.is_default_instance_display || item.is_default_display),
          is_default_dataset_display: !!item.is_default_dataset_display
        }));
        this.allConfigList$.next(summaries);
      },
      error: (err: any) => {
        console.error('[TableDefinitionService] Failed to fetch all configs:', err);
      }
    });
  }

  fetchConfigsForClass(sourceClass: string): void {
    this.loading$.next(true);
    this.http.get<any>(this.baseUrl, this.polariService.backendRequestOptions).subscribe({
      next: (response: any) => {
        const items = this.parseReadAllResponse(response);
        const summaries: TableDefinitionSummary[] = items
          .filter((item: any) => (item.source_class || '') === sourceClass)
          .map((item: any) => ({
            id: item.id,
            name: item.name || '',
            description: item.description || '',
            source_class: item.source_class || '',
            is_default_table: !!item.is_default_table,
            is_default_instance_display: !!(item.is_default_instance_display || item.is_default_display),
            is_default_dataset_display: !!item.is_default_dataset_display
          }));
        this.configList$.next(summaries);
        this.loading$.next(false);
      },
      error: (err: any) => {
        console.error('[TableDefinitionService] Failed to fetch configs:', err);
        this.loading$.next(false);
      }
    });
  }

  loadConfig(id: string, classTypeData?: Record<string, any>): Observable<NamedTableConfig> {
    this.loading$.next(true);
    return this.http.get<any>(this.baseUrl, this.polariService.backendRequestOptions).pipe(
      map((response: any) => {
        const items = this.parseReadAllResponse(response);
        const backendObj = items.find((item: any) => item.id === id);
        if (!backendObj) {
          throw new Error(`TableDefinition ${id} not found`);
        }
        return NamedTableConfig.fromBackend(backendObj, classTypeData);
      }),
      tap((config: NamedTableConfig) => {
        this.draftConfig$.next(config);
        this.hasDraftChanges$.next(false);
        this.loading$.next(false);
      }),
      catchError((err: any) => {
        this.loading$.next(false);
        return throwError(() => err);
      })
    );
  }

  /**
   * Load a config without updating draft state.
   * Use this when loading a config for read-only purposes (e.g., overview display).
   */
  loadConfigSilent(id: string, classTypeData?: Record<string, any>): Observable<NamedTableConfig> {
    return this.http.get<any>(this.baseUrl, this.polariService.backendRequestOptions).pipe(
      map((response: any) => {
        const items = this.parseReadAllResponse(response);
        const backendObj = items.find((item: any) => item.id === id);
        if (!backendObj) {
          throw new Error(`TableDefinition ${id} not found`);
        }
        return NamedTableConfig.fromBackend(backendObj, classTypeData);
      })
    );
  }

  createConfig(name: string, description: string, source_class: string): Observable<any> {
    const formData = new FormData();
    formData.append('initParamSets', JSON.stringify([{ name, description, source_class, definition: '{}' }]));
    return this.http.post(this.baseUrl, formData).pipe(
      tap(() => {
        if (source_class) {
          this.fetchConfigsForClass(source_class);
        }
      }),
      map((response: any) => {
        const items = this.parseReadAllResponse(response);
        if (items.length > 0) {
          return items[0];
        }
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

  saveConfig(config: NamedTableConfig): Observable<any> {
    const definition = config.toDefinitionJSON();
    const formData = new FormData();
    formData.append('polariId', config.id);
    formData.append('updateData', JSON.stringify({
      name: config.name,
      description: config.description,
      definition: definition,
      is_default_table: config.is_default_table,
      is_default_instance_display: config.is_default_instance_display,
      is_default_display: config.is_default_instance_display, // backwards compat
      is_default_dataset_display: config.is_default_dataset_display
    }));
    return this.http.put(this.baseUrl, formData).pipe(
      tap(() => {
        this.hasDraftChanges$.next(false);
      })
    );
  }

  /**
   * Clear the default flag on all other configs for the same class.
   * Called before saving a config that has been set as default.
   * @param sourceClass The class to scope the clearing to
   * @param exceptId The config ID to skip (the one being set as default)
   * @param flagName Which default flag to clear
   */
  clearOtherDefaults(sourceClass: string, exceptId: string, flagName: 'is_default_table' | 'is_default_instance_display' | 'is_default_dataset_display'): Observable<void> {
    // Get current list and find any other configs with this flag set
    const currentList = this.configList$.getValue();
    const toUpdate = currentList.filter(
      s => s.source_class === sourceClass && s.id !== exceptId && s[flagName]
    );

    if (toUpdate.length === 0) {
      return new Observable(subscriber => { subscriber.next(); subscriber.complete(); });
    }

    // Clear each one
    let completed = 0;
    return new Observable(subscriber => {
      toUpdate.forEach(summary => {
        const formData = new FormData();
        formData.append('polariId', summary.id);
        // Send both old and new field names for backwards compatibility
        const updatePayload: Record<string, boolean> = { [flagName]: false };
        if (flagName === 'is_default_instance_display') {
          updatePayload['is_default_display'] = false;
        }
        formData.append('updateData', JSON.stringify(updatePayload));
        this.http.put(this.baseUrl, formData).subscribe({
          next: () => {
            // Update local summary
            summary[flagName] = false;
            completed++;
            if (completed === toUpdate.length) {
              this.configList$.next([...currentList]);
              subscriber.next();
              subscriber.complete();
            }
          },
          error: (err) => {
            console.error(`[TableDefinitionService] Failed to clear ${flagName} on ${summary.id}:`, err);
            completed++;
            if (completed === toUpdate.length) {
              subscriber.next();
              subscriber.complete();
            }
          }
        });
      });
    });
  }

  deleteConfig(id: string): Observable<any> {
    const formData = new FormData();
    formData.append('targetInstance', JSON.stringify({ id }));
    return this.http.request('DELETE', this.baseUrl, { body: formData });
  }

  markDirty(): void {
    this.hasDraftChanges$.next(true);
  }

  updateDraft(config: NamedTableConfig): void {
    this.draftConfig$.next(config);
    this.hasDraftChanges$.next(true);
  }

  private parseReadAllResponse(response: any): any[] {
    let unwrapped = response;
    if (Array.isArray(response) && response.length === 1 && response[0] && response[0][this.className]) {
      unwrapped = response[0];
    }
    if (unwrapped && unwrapped[this.className]) {
      const classData = unwrapped[this.className];
      if (Array.isArray(classData)) {
        const instances: any[] = [];
        classData.forEach((dataSet: any) => {
          if (dataSet.data && Array.isArray(dataSet.data)) {
            instances.push(...dataSet.data);
          } else if (dataSet.id !== undefined) {
            instances.push(dataSet);
          }
        });
        return instances;
      }
      const keys = Object.keys(classData);
      return keys.map(key => ({ id: key, ...classData[key] }));
    }
    if (Array.isArray(response)) {
      return response;
    }
    if (response && response.data && Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  }
}
