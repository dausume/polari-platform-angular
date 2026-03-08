import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { PolariService } from '@services/polari-service';
import { SolutionProcessLinkData } from '@models/noCode/SolutionVersioning';

@Injectable({ providedIn: 'root' })
export class SolutionProcessLinkService {

  links$ = new BehaviorSubject<SolutionProcessLinkData[]>([]);
  linksByState$ = new BehaviorSubject<Record<string, SolutionProcessLinkData>>({});
  loading$ = new BehaviorSubject<boolean>(false);

  private readonly className = 'SolutionProcessLink';

  constructor(private http: HttpClient, private polariService: PolariService) {}

  private get baseUrl(): string {
    return `${this.polariService.getBackendBaseUrl()}/${this.className}`;
  }

  /**
   * Fetch all process links for a solution.
   */
  fetchLinks(solutionId: string): Observable<SolutionProcessLinkData[]> {
    this.loading$.next(true);
    return this.http.get<any>(this.baseUrl).pipe(
      map((resp: any) => {
        const all = this.parseReadAllResponse(resp);
        return all.filter((l: any) => l.solution_id === solutionId);
      }),
      tap((links: SolutionProcessLinkData[]) => {
        links.sort((a, b) => a.manual_process_order - b.manual_process_order);
        this.links$.next(links);
        const byState: Record<string, SolutionProcessLinkData> = {};
        links.forEach(l => { byState[l.state_name] = l; });
        this.linksByState$.next(byState);
        this.loading$.next(false);
      }),
      catchError((err) => {
        console.error('[SolutionProcessLinkService] fetchLinks failed:', err);
        this.loading$.next(false);
        return of([]);
      })
    );
  }

  createLink(data: Partial<SolutionProcessLinkData>): Observable<any> {
    const formData = new FormData();
    formData.append('initParamSets', JSON.stringify([{
      solution_id: data.solution_id || '',
      state_name: data.state_name || '',
      manual_process_step: data.manual_process_step || '',
      manual_process_description: data.manual_process_description || '',
      manual_process_order: data.manual_process_order || 0,
      code_snippet: data.code_snippet || '',
      code_line_start: data.code_line_start || 0,
      code_line_end: data.code_line_end || 0,
      code_runtime: data.code_runtime || 'python_backend',
      notes: data.notes || '',
      tags: data.tags || '',
    }]));
    return this.http.post(this.baseUrl, formData).pipe(
      catchError((err) => {
        console.error('[SolutionProcessLinkService] createLink failed:', err);
        throw err;
      })
    );
  }

  updateLink(id: string, data: Partial<SolutionProcessLinkData>): Observable<any> {
    const formData = new FormData();
    formData.append('polariId', id);
    formData.append('updateData', JSON.stringify(data));
    return this.http.put(this.baseUrl, formData).pipe(
      catchError((err) => {
        console.error('[SolutionProcessLinkService] updateLink failed:', err);
        throw err;
      })
    );
  }

  deleteLink(id: string): Observable<any> {
    const formData = new FormData();
    formData.append('targetInstance', JSON.stringify({ polariId: id }));
    return this.http.delete(this.baseUrl, { body: formData }).pipe(
      catchError((err) => {
        console.error('[SolutionProcessLinkService] deleteLink failed:', err);
        throw err;
      })
    );
  }

  /**
   * Auto-generate one process link per state in the solution.
   */
  autoGenerateLinks(
    solutionId: string,
    solutionData: any,
    generatedCode: string = ''
  ): Observable<any[]> {
    const states: any[] = solutionData?.stateInstances || [];
    const codeLines = generatedCode.split('\n');
    const observables: Observable<any>[] = [];

    states.forEach((state: any, index: number) => {
      const stateName = state.stateName || state.state_name || `state_${index}`;
      const stateClass = state.stateClass || state.state_class || '';

      // Try to find code line range by searching for state name in generated code
      let codeLineStart = 0;
      let codeLineEnd = 0;
      for (let i = 0; i < codeLines.length; i++) {
        if (codeLines[i].includes(stateName)) {
          if (codeLineStart === 0) codeLineStart = i + 1;
          codeLineEnd = i + 1;
        }
      }

      observables.push(this.createLink({
        solution_id: solutionId,
        state_name: stateName,
        manual_process_step: `Step ${index + 1}: ${stateName}`,
        manual_process_description: `${stateClass} state: ${stateName}`,
        manual_process_order: index,
        code_snippet: codeLineStart > 0
          ? codeLines.slice(codeLineStart - 1, codeLineEnd).join('\n')
          : '',
        code_line_start: codeLineStart,
        code_line_end: codeLineEnd,
        code_runtime: 'python_backend',
      }));
    });

    if (observables.length === 0) {
      return of([]);
    }

    // Execute sequentially to avoid race conditions
    return new Observable(subscriber => {
      const results: any[] = [];
      let idx = 0;
      const next = () => {
        if (idx >= observables.length) {
          subscriber.next(results);
          subscriber.complete();
          return;
        }
        observables[idx].subscribe({
          next: (res) => { results.push(res); idx++; next(); },
          error: (err) => { results.push({ error: err }); idx++; next(); },
        });
      };
      next();
    });
  }

  /**
   * Re-map code line ranges after solution/code changes.
   */
  syncCodeSnippets(solutionId: string, generatedCode: string): void {
    const links = this.links$.value.filter(l => l.solution_id === solutionId);
    const codeLines = generatedCode.split('\n');

    links.forEach(link => {
      let codeLineStart = 0;
      let codeLineEnd = 0;
      for (let i = 0; i < codeLines.length; i++) {
        if (codeLines[i].includes(link.state_name)) {
          if (codeLineStart === 0) codeLineStart = i + 1;
          codeLineEnd = i + 1;
        }
      }

      if (codeLineStart !== link.code_line_start || codeLineEnd !== link.code_line_end) {
        this.updateLink(link.id, {
          code_line_start: codeLineStart,
          code_line_end: codeLineEnd,
          code_snippet: codeLineStart > 0
            ? codeLines.slice(codeLineStart - 1, codeLineEnd).join('\n')
            : '',
        }).subscribe();
      }
    });
  }

  /**
   * Parse CRUDE GET response.
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
