import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { PolariService } from '@services/polari-service';
import { NamedGraphConfig, GraphDefinitionSummary } from '@models/graphs/NamedGraphConfig';

@Injectable({ providedIn: 'root' })
export class GraphDefinitionService {

  configList$ = new BehaviorSubject<GraphDefinitionSummary[]>([]);
  draftConfig$ = new BehaviorSubject<NamedGraphConfig | null>(null);
  hasDraftChanges$ = new BehaviorSubject<boolean>(false);
  loading$ = new BehaviorSubject<boolean>(false);

  private readonly className = 'GraphDefinition';

  constructor(private http: HttpClient, private polariService: PolariService) {}

  private get baseUrl(): string {
    return `${this.polariService.getBackendBaseUrl()}/${this.className}`;
  }

  fetchConfigsForClass(sourceClass: string): void {
    this.loading$.next(true);
    this.http.get<any>(this.baseUrl, this.polariService.backendRequestOptions).subscribe({
      next: (response: any) => {
        const items = this.parseReadAllResponse(response);
        const summaries: GraphDefinitionSummary[] = items
          .filter((item: any) => (item.source_class || '') === sourceClass)
          .map((item: any) => ({
            id: item.id,
            name: item.name || '',
            description: item.description || '',
            source_class: item.source_class || ''
          }));
        this.configList$.next(summaries);
        this.loading$.next(false);
      },
      error: (err: any) => {
        console.error('[GraphDefinitionService] Failed to fetch configs:', err);
        this.loading$.next(false);
      }
    });
  }

  loadConfig(id: string): Observable<NamedGraphConfig> {
    this.loading$.next(true);
    return this.http.get<any>(this.baseUrl, this.polariService.backendRequestOptions).pipe(
      map((response: any) => {
        const items = this.parseReadAllResponse(response);
        const backendObj = items.find((item: any) => item.id === id);
        if (!backendObj) {
          throw new Error(`GraphDefinition ${id} not found`);
        }
        return NamedGraphConfig.fromBackend(backendObj);
      }),
      tap((config: NamedGraphConfig) => {
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

  saveConfig(config: NamedGraphConfig): Observable<any> {
    const definition = config.toDefinitionJSON();
    const formData = new FormData();
    formData.append('polariId', config.id);
    formData.append('updateData', JSON.stringify({
      name: config.name,
      description: config.description,
      definition: definition
    }));
    return this.http.put(this.baseUrl, formData).pipe(
      tap(() => {
        this.hasDraftChanges$.next(false);
      })
    );
  }

  deleteConfig(id: string): Observable<any> {
    const formData = new FormData();
    formData.append('targetInstance', JSON.stringify({ id }));
    return this.http.request('DELETE', this.baseUrl, { body: formData });
  }

  markDirty(): void {
    this.hasDraftChanges$.next(true);
  }

  updateDraft(config: NamedGraphConfig): void {
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
