import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom, throwError } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { PolariService } from '@services/polari-service';
import { MatrixEvaluateResponse } from '@models/matrices/MatrixDefinition';
import {
    MatrixEquationOperation,
    MatrixEquationOperand,
    MatrixEquationRecord,
    MatrixEquationSummary,
    MatrixEquationValidateResponse,
    makeEmptyMatrixEquation,
} from '@models/matrices/MatrixEquationDefinition';

/**
 * Service for /MatrixEquationDefinition CRUD + the math-logic routes
 * /api/matrix-equations/{evaluate,validate}. Mirrors MatrixDefinitionService.
 */
@Injectable({ providedIn: 'root' })
export class MatrixEquationService {

    list$ = new BehaviorSubject<MatrixEquationSummary[]>([]);
    loading$ = new BehaviorSubject<boolean>(false);

    private readonly className = 'MatrixEquationDefinition';

    constructor(private http: HttpClient, private polariService: PolariService) {}

    private get baseUrl(): string {
        return `${this.polariService.getBackendBaseUrl()}/${this.className}`;
    }
    private get apiBase(): string {
        return `${this.polariService.getBackendBaseUrl()}/api/matrix-equations`;
    }

    refreshList(): void {
        this.loading$.next(true);
        this.http.get<any>(this.baseUrl, this.polariService.backendRequestOptions).subscribe({
            next: (response: any) => {
                this.list$.next(this.parseReadAllResponse(response).map(r => this.toSummary(r)));
                this.loading$.next(false);
            },
            error: (err: any) => {
                console.error('[MatrixEquationService] fetch failed:', err);
                this.loading$.next(false);
            }
        });
    }

    getByName(name: string): Observable<MatrixEquationRecord> {
        return this.http.get<any>(this.baseUrl, this.polariService.backendRequestOptions).pipe(
            map((response: any) => {
                const raw = this.parseReadAllResponse(response).find((i: any) => i.name === name);
                if (!raw) throw new Error(`MatrixEquationDefinition '${name}' not found`);
                return this.deserialise(raw);
            }),
            catchError((err: any) => throwError(() => err))
        );
    }

    create(record: MatrixEquationRecord): Observable<any> {
        const formData = new FormData();
        formData.append('initParamSets', JSON.stringify([this.serialiseFields(record)]));
        return this.http.post(this.baseUrl, formData).pipe(tap(() => this.refreshList()));
    }

    save(record: MatrixEquationRecord): Observable<any> {
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

    evaluateInline(record: MatrixEquationRecord, bindings?: { [k: string]: any }): Promise<MatrixEvaluateResponse> {
        return firstValueFrom(this.http.post<MatrixEvaluateResponse>(
            `${this.apiBase}/evaluate`, { definition: this.serialiseFields(record), bindings: bindings || {} }));
    }

    validateInline(record: MatrixEquationRecord): Promise<MatrixEquationValidateResponse> {
        return firstValueFrom(this.http.post<MatrixEquationValidateResponse>(
            `${this.apiBase}/validate`, { definition: this.serialiseFields(record) }));
    }

    // ─────────────────────────── serialisation ───────────────────────────

    private serialiseFields(record: MatrixEquationRecord): any {
        return {
            name: record.name,
            description: record.description || '',
            latex: record.latex || '',
            operation_json: JSON.stringify(record.operation || {}),
            operands_json: JSON.stringify(record.operands || {}),
            tags: record.tags || ''
        };
    }

    private deserialise(raw: any): MatrixEquationRecord {
        const base = makeEmptyMatrixEquation();
        return {
            id: raw.id,
            name: raw.name || '',
            description: raw.description || '',
            latex: raw.latex || '',
            operation: this.parseJson(raw.operation_json, base.operation) as MatrixEquationOperation,
            operands: this.parseJson(raw.operands_json, {}) as { [s: string]: MatrixEquationOperand },
            tags: raw.tags || ''
        };
    }

    private toSummary(raw: any): MatrixEquationSummary {
        const op = this.parseJson(raw.operation_json, {}) as MatrixEquationOperation;
        return {
            id: raw.id, name: raw.name || '', description: raw.description || '',
            latex: raw.latex || '', kind: op.kind, tags: raw.tags || ''
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
