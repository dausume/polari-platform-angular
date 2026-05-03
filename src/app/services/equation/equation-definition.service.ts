import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { PolariService } from '@services/polari-service';
import {
    EquationDefinitionConfig,
    EquationDefinitionRecord,
    EquationDefinitionSummary,
    makeEmptyEquationDefinitionConfig
} from '@models/equations/EquationDefinition';

/**
 * Service wrapping the CRUDE endpoint `/EquationDefinition`.
 *
 * Mirrors `DataSetDefinitionService` for layout and conventions.
 *
 * The backend stores the config object as a JSON string in the
 * `definition` field of the EquationDefinition row. This service
 * handles (de)serialisation transparently.
 */
@Injectable({ providedIn: 'root' })
export class EquationDefinitionService {

    /** Filtered list (e.g. for a single source class). */
    configList$ = new BehaviorSubject<EquationDefinitionSummary[]>([]);
    /** All EquationDefinitions across all classes. */
    allConfigList$ = new BehaviorSubject<EquationDefinitionSummary[]>([]);
    loading$ = new BehaviorSubject<boolean>(false);

    private readonly className = 'EquationDefinition';

    constructor(private http: HttpClient, private polariService: PolariService) {}

    private get baseUrl(): string {
        return `${this.polariService.getBackendBaseUrl()}/${this.className}`;
    }

    refreshList(): void {
        this.fetchAllConfigs();
    }

    fetchAllConfigs(): void {
        this.loading$.next(true);
        this.http.get<any>(this.baseUrl, this.polariService.backendRequestOptions).subscribe({
            next: (response: any) => {
                const items = this.parseReadAllResponse(response);
                const summaries: EquationDefinitionSummary[] = items.map((item: any) => ({
                    id: item.id,
                    name: item.name || '',
                    description: item.description || '',
                    source_class: item.source_class || ''
                }));
                this.allConfigList$.next(summaries);
                this.configList$.next(summaries);
                this.loading$.next(false);
            },
            error: (err: any) => {
                console.error('[EquationDefinitionService] Failed to fetch all configs:', err);
                this.loading$.next(false);
            }
        });
    }

    /**
     * Load a single EquationDefinition by ID. Returns the full record
     * with its `definition` already deserialised.
     */
    getById(id: string): Observable<EquationDefinitionRecord> {
        this.loading$.next(true);
        return this.http.get<any>(this.baseUrl, this.polariService.backendRequestOptions).pipe(
            map((response: any) => {
                const items = this.parseReadAllResponse(response);
                const backendObj = items.find((item: any) => item.id === id);
                if (!backendObj) {
                    throw new Error(`EquationDefinition ${id} not found`);
                }
                return this.deserialiseRecord(backendObj);
            }),
            tap(() => this.loading$.next(false)),
            catchError((err: any) => {
                this.loading$.next(false);
                return throwError(() => err);
            })
        );
    }

    /**
     * Create a new EquationDefinition with the given metadata + initial
     * definition. Returns the newly created record (id assigned by backend).
     */
    createConfig(
        name: string,
        description: string,
        source_class: string = '',
        definition: EquationDefinitionConfig = makeEmptyEquationDefinitionConfig()
    ): Observable<any> {
        const formData = new FormData();
        formData.append('initParamSets', JSON.stringify([{
            name,
            description,
            source_class,
            definition: JSON.stringify(definition)
        }]));
        return this.http.post(this.baseUrl, formData).pipe(
            tap(() => this.fetchAllConfigs()),
            map((response: any) => {
                const items = this.parseReadAllResponse(response);
                if (items.length > 0) return items[0];
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

    /**
     * Persist updates to an existing EquationDefinition. Serialises the
     * `definition` config back into a JSON string for the backend.
     */
    saveConfig(record: EquationDefinitionRecord): Observable<any> {
        const formData = new FormData();
        formData.append('polariId', record.id);
        formData.append('updateData', JSON.stringify({
            name: record.name,
            description: record.description,
            source_class: record.source_class || '',
            definition: JSON.stringify(record.definition)
        }));
        return this.http.put(this.baseUrl, formData).pipe(
            tap(() => this.fetchAllConfigs())
        );
    }

    deleteConfig(id: string): Observable<any> {
        const formData = new FormData();
        formData.append('targetInstance', JSON.stringify({ id }));
        return this.http.request('DELETE', this.baseUrl, { body: formData }).pipe(
            tap(() => this.fetchAllConfigs())
        );
    }

    // ---------------------------------------------------------------------
    // Private helpers
    // ---------------------------------------------------------------------

    private deserialiseRecord(raw: any): EquationDefinitionRecord {
        let def: EquationDefinitionConfig;
        const rawDef = raw.definition;
        if (rawDef && typeof rawDef === 'string') {
            try {
                def = JSON.parse(rawDef) as EquationDefinitionConfig;
            } catch (e) {
                console.warn('[EquationDefinitionService] Failed to parse definition JSON, using empty config:', e);
                def = makeEmptyEquationDefinitionConfig();
            }
        } else if (rawDef && typeof rawDef === 'object') {
            def = rawDef as EquationDefinitionConfig;
        } else {
            def = makeEmptyEquationDefinitionConfig();
        }
        // Backfill defaults for forward-compatibility.
        if (!def.variableBindings) def.variableBindings = [];
        if (!def.options) def.options = {};
        if (!def.resultSpec) def.resultSpec = { type: 'scalar' };
        if (def.bounds === undefined) def.bounds = null;

        return {
            id: raw.id,
            name: raw.name || '',
            description: raw.description || '',
            source_class: raw.source_class || '',
            definition: def
        };
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
                classData.forEach((item: any) => {
                    if (item.data && Array.isArray(item.data)) {
                        instances.push(...item.data);
                    } else if (item.id !== undefined) {
                        instances.push(item);
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
