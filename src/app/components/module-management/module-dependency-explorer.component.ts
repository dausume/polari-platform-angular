import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';

import { PolariService } from '@services/polari-service';

interface BoundaryNode {
  name: string;
  description: string;
  present: boolean;
  boundaryImports: string[];
  pythonImports: string[];
  expanded?: boolean;
  pythonTrees?: PyNode[] | null;
  loadingTrees?: boolean;
}

interface PyNode {
  name: string;
  resolvedVersion: string | null;
  installed: boolean;
  shared: boolean;
  conditional?: boolean;
  spec?: string;
  children: PyNode[];
  expanded?: boolean;
}

/**
 * The dependency explorer (msci-21): the coherent-module BOUNDARY map
 * (framework packages + the tracked import edges between them), each
 * boundary's external python imports expandable into full
 * requires-trees (shared downstream deps appear ONCE, marked), and
 * the union install plan — shown as a suggestion, executed only on
 * the explicit confirm knob.
 */
@Component({
  standalone: true,
  selector: 'module-dependency-explorer',
  imports: [CommonModule, MatButtonModule, MatIconModule,
            MatProgressSpinnerModule, MatTooltipModule],
  templateUrl: './module-dependency-explorer.component.html',
  styleUrls: ['./module-dependency-explorer.component.scss'],
})
export class ModuleDependencyExplorerComponent implements OnInit {

  boundaries: BoundaryNode[] = [];
  plan: any = null;
  installing = false;
  installReport: any = null;
  loading = true;

  constructor(private http: HttpClient,
              private polariService: PolariService) {}

  private get base(): string {
    return this.polariService.getBackendBaseUrl();
  }

  async ngOnInit(): Promise<void> {
    try {
      const [graph, plan] = await Promise.all([
        firstValueFrom(this.http.get<any>(
          `${this.base}/api/modules/boundary-graph`,
          this.polariService.backendRequestOptions)),
        firstValueFrom(this.http.get<any>(
          `${this.base}/api/modules/dependencies/install-plan`,
          this.polariService.backendRequestOptions)),
      ]);
      this.boundaries = graph?.data?.boundaries ?? [];
      this.plan = plan?.data ?? null;
    } finally {
      this.loading = false;
    }
  }

  async toggle(node: BoundaryNode): Promise<void> {
    node.expanded = !node.expanded;
    if (node.expanded && node.pythonTrees === undefined
        && node.pythonImports.length) {
      node.loadingTrees = true;
      try {
        const res = await firstValueFrom(this.http.get<any>(
          `${this.base}/api/modules/dependencies/tree`
          + `?boundary=${encodeURIComponent(node.name)}`,
          this.polariService.backendRequestOptions));
        node.pythonTrees = res?.data?.trees ?? [];
      } catch {
        node.pythonTrees = null;
      } finally {
        node.loadingTrees = false;
      }
    }
  }

  /** The EXPLICIT install knob — sends confirm:true for the plan. */
  async installPlan(): Promise<void> {
    if (!this.plan?.packages?.length) return;
    this.installing = true;
    this.installReport = null;
    try {
      this.installReport = await firstValueFrom(this.http.post<any>(
        `${this.base}/api/modules/dependencies/install`,
        { confirm: true },
        this.polariService.backendRequestOptions));
      // Refresh the plan — accepted packages should now resolve.
      const plan = await firstValueFrom(this.http.get<any>(
        `${this.base}/api/modules/dependencies/install-plan`,
        this.polariService.backendRequestOptions));
      this.plan = plan?.data ?? this.plan;
    } catch (err: any) {
      this.installReport = err?.error
        ?? { ok: false, error: String(err) };
    } finally {
      this.installing = false;
    }
  }
}
