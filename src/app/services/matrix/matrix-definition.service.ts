import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom, throwError } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { PolariService } from '@services/polari-service';
import {
    MatrixComputation,
    MatrixDefinitionRecord,
    MatrixDefinitionSummary,
    MatrixElementType,
    MatrixEvaluateResponse,
    MatrixValidateResponse,
    makeEmptyMatrixDefinition,
} from '@models/matrices/MatrixDefinition';

/**
 * Service wrapping the CRUDE endpoint `/MatrixDefinition` plus the math-logic
 * routes `/api/matrices/evaluate` and `/api/matrices/validate`.
 *
 * Mirrors `EquationDefinitionService` for CRUD layout. The backend stores
 * shape/values/computation as JSON strings; this service (de)serialises them
 * so components work with real arrays/objects.
 */
@Injectable({ providedIn: 'root' })
export class MatrixDefinitionService {

    list$ = new BehaviorSubject<MatrixDefinitionSummary[]>([]);
    loading$ = new BehaviorSubject<boolean>(false);

    private readonly className = 'MatrixDefinition';

    constructor(private http: HttpClient, private polariService: PolariService) {}

    private get baseUrl(): string {
        return `${this.polariService.getBackendBaseUrl()}/${this.className}`;
    }

    private get apiBase(): string {
        return `${this.polariService.getBackendBaseUrl()}/api/matrices`;
    }

    // ─────────────────────────────── CRUD ───────────────────────────────

    refreshList(): void {
        this.loading$.next(true);
        this.http.get<any>(this.baseUrl, this.polariService.backendRequestOptions).subscribe({
            next: (response: any) => {
                const items = this.parseReadAllResponse(response);
                this.list$.next(items.map((item: any) => this.toSummary(item)));
                this.loading$.next(false);
            },
            error: (err: any) => {
                console.error('[MatrixDefinitionService] fetch failed:', err);
                this.loading$.next(false);
            }
        });
    }

    getByName(name: string): Observable<MatrixDefinitionRecord> {
        return this.http.get<any>(this.baseUrl, this.polariService.backendRequestOptions).pipe(
            map((response: any) => {
                const items = this.parseReadAllResponse(response);
                const raw = items.find((item: any) => item.name === name);
                if (!raw) throw new Error(`MatrixDefinition '${name}' not found`);
                return this.deserialise(raw);
            }),
            catchError((err: any) => throwError(() => err))
        );
    }

    create(record: MatrixDefinitionRecord): Observable<any> {
        const formData = new FormData();
        formData.append('initParamSets', JSON.stringify([this.serialiseFields(record)]));
        return this.http.post(this.baseUrl, formData).pipe(tap(() => this.refreshList()));
    }

    save(record: MatrixDefinitionRecord): Observable<any> {
        const formData = new FormData();
        formData.append('polariId', record.id);
        formData.append('updateData', JSON.stringify(this.serialiseFields(record)));
        return this.http.put(this.baseUrl, formData).pipe(tap(() => this.refreshList()));
    }

    delete(id: string): Observable<any> {
        const formData = new FormData();
        formData.append('targetInstance', JSON.stringify({ id }));
        return this.http.request('DELETE', this.baseUrl, { body: formData }).pipe(
            tap(() => this.refreshList())
        );
    }

    // ───────────────────────────── math logic ───────────────────────────

    /** Evaluate a saved matrix by name (optionally with runtime bindings). */
    evaluateByName(name: string, bindings?: { [k: string]: any }): Promise<MatrixEvaluateResponse> {
        return firstValueFrom(this.http.post<MatrixEvaluateResponse>(
            `${this.apiBase}/evaluate`, { name, bindings: bindings || {} }));
    }

    /** Evaluate an unsaved (Test-tab) definition. */
    evaluateInline(record: MatrixDefinitionRecord, bindings?: { [k: string]: any }): Promise<MatrixEvaluateResponse> {
        return firstValueFrom(this.http.post<MatrixEvaluateResponse>(
            `${this.apiBase}/evaluate`,
            { definition: this.serialiseFields(record), bindings: bindings || {} }));
    }

    /** Structural validation of an unsaved definition. */
    validateInline(record: MatrixDefinitionRecord): Promise<MatrixValidateResponse> {
        return firstValueFrom(this.http.post<MatrixValidateResponse>(
            `${this.apiBase}/validate`, { definition: this.serialiseFields(record) }));
    }

    // ─────────────────────────── serialisation ──────────────────────────

    /** Record → backend field dict (shape/values/computation as JSON strings). */
    private serialiseFields(record: MatrixDefinitionRecord): any {
        return {
            name: record.name,
            description: record.description || '',
            shape_json: JSON.stringify(record.shape || []),
            element_type: record.elementType,
            element_matrix_ref: record.elementMatrixRef || '',
            values_json: JSON.stringify(record.values || []),
            computation_json: JSON.stringify(record.computation || { kind: 'literal' }),
            is_template: !!record.isTemplate,
            tags: record.tags || ''
        };
    }

    private deserialise(raw: any): MatrixDefinitionRecord {
        const base = makeEmptyMatrixDefinition();
        return {
            id: raw.id,
            name: raw.name || '',
            description: raw.description || '',
            shape: this.parseJson(raw.shape_json, base.shape),
            elementType: (raw.element_type || 'float') as MatrixElementType,
            elementMatrixRef: raw.element_matrix_ref || '',
            values: this.parseJson(raw.values_json, []),
            computation: this.parseJson(raw.computation_json, { kind: 'literal' }) as MatrixComputation,
            isTemplate: raw.is_template === true || raw.is_template === 'true',
            tags: raw.tags || ''
        };
    }

    private toSummary(raw: any): MatrixDefinitionSummary {
        return {
            id: raw.id,
            name: raw.name || '',
            description: raw.description || '',
            elementType: (raw.element_type || 'float') as MatrixElementType,
            shape: this.parseJson(raw.shape_json, []),
            tags: raw.tags || ''
        };
    }

    private parseJson<T>(raw: any, fallback: T): T {
        if (raw === undefined || raw === null) return fallback;
        if (typeof raw !== 'string') return raw as T;
        try { return JSON.parse(raw) as T; } catch { return fallback; }
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
                    if (item.data && Array.isArray(item.data)) instances.push(...item.data);
                    else if (item.id !== undefined) instances.push(item);
                });
                return instances;
            }
            return Object.keys(classData).map(key => ({ id: key, ...classData[key] }));
        }
        if (Array.isArray(response)) return response;
        if (response && response.data && Array.isArray(response.data)) return response.data;
        return [];
    }
}
