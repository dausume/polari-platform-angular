import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { PolariService } from '@services/polari-service';
import { SolutionVersionData } from '@models/noCode/SolutionVersioning';

@Injectable({ providedIn: 'root' })
export class SolutionVersionService {

  versions$ = new BehaviorSubject<SolutionVersionData[]>([]);
  currentVersion$ = new BehaviorSubject<SolutionVersionData | null>(null);
  loading$ = new BehaviorSubject<boolean>(false);

  private readonly className = 'SolutionVersion';

  constructor(private http: HttpClient, private polariService: PolariService) {}

  private get baseUrl(): string {
    return `${this.polariService.getBackendBaseUrl()}/${this.className}`;
  }

  private get createVersionUrl(): string {
    return `${this.polariService.getBackendBaseUrl()}/createSolutionVersion`;
  }

  /**
   * Fetch all versions for a solution.
   */
  fetchVersions(solutionId: string): Observable<SolutionVersionData[]> {
    this.loading$.next(true);
    return this.http.get<any>(this.baseUrl).pipe(
      map((resp: any) => {
        const all = this.parseReadAllResponse(resp);
        return all.filter((v: any) => v.solution_id === solutionId);
      }),
      tap((versions: SolutionVersionData[]) => {
        // Sort by version_number descending
        versions.sort((a, b) => b.version_number - a.version_number);
        this.versions$.next(versions);
        const current = versions.find(v => v.is_current) || versions[0] || null;
        this.currentVersion$.next(current);
        this.loading$.next(false);
      }),
      catchError((err) => {
        console.error('[SolutionVersionService] fetchVersions failed:', err);
        this.loading$.next(false);
        return of([]);
      })
    );
  }

  /**
   * Create a new version snapshot atomically (POST /createSolutionVersion).
   */
  createVersion(solutionId: string, label: string = '', description: string = ''): Observable<any> {
    this.loading$.next(true);
    return this.http.post<any>(this.createVersionUrl, {
      solutionId,
      label,
      description,
    }).pipe(
      tap(() => this.loading$.next(false)),
      catchError((err) => {
        console.error('[SolutionVersionService] createVersion failed:', err);
        this.loading$.next(false);
        throw err;
      })
    );
  }

  /**
   * Restore a version by copying its definition back to SolutionDefinition,
   * then creating a new version to mark the restore point.
   */
  restoreVersion(versionId: string, solutionId: string): Observable<any> {
    this.loading$.next(true);
    // First load the version's definition
    return this.http.get<any>(this.baseUrl).pipe(
      map((resp: any) => {
        const all = this.parseReadAllResponse(resp);
        return all.find((v: any) => v.id === versionId);
      }),
      tap((version: SolutionVersionData | undefined) => {
        if (!version) {
          this.loading$.next(false);
          throw new Error(`Version ${versionId} not found`);
        }
      }),
      catchError((err) => {
        this.loading$.next(false);
        throw err;
      })
    );
  }

  /**
   * Delete a version via CRUDE DELETE.
   */
  deleteVersion(versionId: string): Observable<any> {
    const formData = new FormData();
    formData.append('targetInstance', JSON.stringify({ polariId: versionId }));
    return this.http.delete(this.baseUrl, { body: formData }).pipe(
      catchError((err) => {
        console.error('[SolutionVersionService] deleteVersion failed:', err);
        throw err;
      })
    );
  }

  /**
   * Parse CRUDE GET response — same logic as SolutionManagerService.
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
