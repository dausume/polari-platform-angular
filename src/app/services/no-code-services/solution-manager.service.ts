import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { PolariService } from '@services/polari-service';
import { NoCodeSolutionRawData } from '@models/noCode/mock-NCS-data';

export interface SolutionSummary {
  id: string;
  name: string;
  function_name: string;
  target_runtime: string;
}

@Injectable({ providedIn: 'root' })
export class SolutionManagerService {

  solutionList$ = new BehaviorSubject<SolutionSummary[]>([]);
  loading$ = new BehaviorSubject<boolean>(false);

  private readonly className = 'SolutionDefinition';

  constructor(private http: HttpClient, private polariService: PolariService) {}

  private get baseUrl(): string {
    return `${this.polariService.getBackendBaseUrl()}/${this.className}`;
  }

  fetchSolutionList(): void {
    this.loading$.next(true);
    this.http.get<any>(this.baseUrl, this.polariService.backendRequestOptions).subscribe({
      next: (response: any) => {
        const items = this.parseReadAllResponse(response);
        const summaries: SolutionSummary[] = items.map((item: any) => ({
          id: item.id,
          name: item.name || '',
          function_name: item.function_name || '',
          target_runtime: item.target_runtime || 'python_backend'
        }));
        this.solutionList$.next(summaries);
        this.loading$.next(false);
      },
      error: (err: any) => {
        console.error('[SolutionManager] Failed to fetch solution list:', err);
        this.loading$.next(false);
      }
    });
  }

  /**
   * Load a specific solution by ID, returning the full definition parsed from JSON
   */
  loadSolution(id: string): Observable<NoCodeSolutionRawData> {
    this.loading$.next(true);
    return this.http.get<any>(this.baseUrl, this.polariService.backendRequestOptions).pipe(
      map((response: any) => {
        const items = this.parseReadAllResponse(response);
        const backendObj = items.find((item: any) => item.id === id);
        if (!backendObj) {
          throw new Error(`Solution ${id} not found`);
        }
        return this.deserializeSolution(backendObj);
      }),
      tap(() => this.loading$.next(false)),
      catchError((err: any) => {
        this.loading$.next(false);
        return throwError(() => err);
      })
    );
  }

  /**
   * Load a solution by name
   */
  loadSolutionByName(name: string): Observable<NoCodeSolutionRawData> {
    this.loading$.next(true);
    return this.http.get<any>(this.baseUrl, this.polariService.backendRequestOptions).pipe(
      map((response: any) => {
        const items = this.parseReadAllResponse(response);
        const backendObj = items.find((item: any) => item.name === name);
        if (!backendObj) {
          throw new Error(`Solution '${name}' not found`);
        }
        return this.deserializeSolution(backendObj);
      }),
      tap(() => this.loading$.next(false)),
      catchError((err: any) => {
        this.loading$.next(false);
        return throwError(() => err);
      })
    );
  }

  /**
   * Load ALL solutions with their full definitions
   */
  loadAllSolutions(): Observable<NoCodeSolutionRawData[]> {
    this.loading$.next(true);
    return this.http.get<any>(this.baseUrl, this.polariService.backendRequestOptions).pipe(
      map((response: any) => {
        const items = this.parseReadAllResponse(response);
        return items.map((item: any) => this.deserializeSolution(item));
      }),
      tap(() => this.loading$.next(false)),
      catchError((err: any) => {
        console.error('[SolutionManager] Failed to load all solutions:', err);
        this.loading$.next(false);
        return of([]);
      })
    );
  }

  /**
   * Create a new solution on the backend
   */
  createSolution(solutionData: NoCodeSolutionRawData): Observable<any> {
    const formData = new FormData();
    formData.append('initParamSets', JSON.stringify([{
      name: solutionData.solutionName,
      function_name: solutionData.functionName || '',
      target_runtime: solutionData.targetRuntime || 'python_backend',
      definition: JSON.stringify(solutionData)
    }]));
    return this.http.post(this.baseUrl, formData).pipe(
      tap(() => this.fetchSolutionList()),
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

  /**
   * Save (update) an existing solution on the backend
   */
  saveSolution(id: string, solutionData: NoCodeSolutionRawData): Observable<any> {
    const formData = new FormData();
    formData.append('polariId', id);
    formData.append('updateData', JSON.stringify({
      name: solutionData.solutionName,
      function_name: solutionData.functionName || '',
      target_runtime: solutionData.targetRuntime || 'python_backend',
      definition: JSON.stringify(solutionData)
    }));
    return this.http.put(this.baseUrl, formData);
  }

  /**
   * Delete a solution from the backend
   */
  deleteSolution(id: string): Observable<any> {
    const formData = new FormData();
    formData.append('targetInstance', JSON.stringify({ id }));
    return this.http.request('DELETE', this.baseUrl, { body: formData });
  }

  /**
   * Generate code for a solution by name via the backend code generation endpoint
   */
  generateCode(solutionName: string, runtime: string): Observable<string> {
    const codeUrl = `${this.polariService.getBackendBaseUrl()}/solutionCode/${encodeURIComponent(solutionName)}?runtime=${encodeURIComponent(runtime)}`;
    return this.http.get<any>(codeUrl, this.polariService.backendRequestOptions).pipe(
      map((response: any) => response.code || response.generated_code || ''),
      catchError((err: any) => {
        console.error('[SolutionManager] Code generation failed:', err);
        return of('');
      })
    );
  }

  /**
   * Execute a solution via the backend execution endpoint
   */
  executeSolution(solutionName: string, inputParams: any, targetRuntime: string): Observable<any> {
    const execUrl = `${this.polariService.getBackendBaseUrl()}/executeSolution`;
    const body = { solutionName, inputParams: inputParams || {}, targetRuntime };
    return this.http.post<any>(execUrl, body);
  }

  /**
   * Execute a solution step-by-step via the backend stepped execution endpoint.
   * Returns a full ExecutionTrace for frontend replay.
   */
  executeSolutionStepped(
    solutionName: string,
    inputParams: any,
    targetRuntime: string,
    stepConfig?: any
  ): Observable<any> {
    const execUrl = `${this.polariService.getBackendBaseUrl()}/executeSolutionStepped`;
    const body = {
      solutionName,
      inputParams: inputParams || {},
      targetRuntime,
      ...(stepConfig ? { stepConfig } : {})
    };
    return this.http.post<any>(execUrl, body);
  }

  /**
   * Deserialize a backend object into NoCodeSolutionRawData
   */
  private deserializeSolution(backendObj: any): NoCodeSolutionRawData {
    let parsed: NoCodeSolutionRawData;
    if (backendObj.definition && backendObj.definition !== '{}') {
      try {
        parsed = typeof backendObj.definition === 'string'
          ? JSON.parse(backendObj.definition)
          : backendObj.definition;
      } catch (e) {
        console.warn('[SolutionManager] Failed to parse definition:', e);
        parsed = this.createEmptySolution(backendObj.name);
      }
    } else {
      parsed = this.createEmptySolution(backendObj.name);
    }

    // Attach the backend ID so we can update later
    (parsed as any)._backendId = backendObj.id;
    return parsed;
  }

  private createEmptySolution(name: string): NoCodeSolutionRawData {
    return {
      id: 0,
      solutionName: name || 'Untitled',
      xBounds: 1200,
      yBounds: 800,
      stateInstances: []
    };
  }

  /**
   * Parse CRUDE GET response - same logic as DisplayManagerService
   */
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
