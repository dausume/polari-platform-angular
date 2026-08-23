import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PolariService } from '@services/polari-service';

/**
 * Microchip design-ladder traversal (Dustin 2026-08-21): the five
 * design levels (device -> standard-cell -> functional-block ->
 * core -> chip) as a rail, a design picker, and click-to-traverse
 * nodes — parent chain up, children down, artifact/citation
 * references resolved by the backend (absent modules and unbuilt
 * rungs surface their refusal text; the UI invents nothing).
 *
 * Pure read surface over /api/microchip/* — editing nodes stays in
 * CRUDE. Registered as 'microchip-ladder' so /display pages mount
 * it as data.
 */
@Component({
  standalone: true,
  selector: 'microchip-ladder',
  imports: [CommonModule, MatProgressSpinnerModule],
  template: `
    <div class="ladder-root">
      <div *ngIf="loading" class="state"><mat-spinner diameter="28"></mat-spinner></div>
      <div *ngIf="error" class="state error">{{ error }}</div>
      <ng-container *ngIf="!loading && !error">
        <div class="design-picker">
          <span class="picker-label">Design:</span>
          <button *ngFor="let design of designs"
                  class="chip"
                  [class.active]="design.design === activeDesign"
                  (click)="pickDesign(design.design)">
            {{ design.design }}
            <span class="count">{{ design.nodeCount }}</span>
          </button>
        </div>

        <div class="columns">
          <div class="rail">
            <div *ngFor="let level of levelsTopDown" class="rung"
                 [class.live]="level.status === 'live'">
              <div class="rung-head">
                <span class="rung-name">{{ level.name }}</span>
                <span class="badge" [class.live]="level.status === 'live'">
                  {{ level.status }}</span>
              </div>
              <div class="rung-desc">{{ level.description }}</div>
              <div *ngIf="level.refusal" class="refusal">
                {{ level.refusal }}</div>
              <div *ngIf="level.status === 'live'" class="axes">
                <span *ngFor="let axis of level.scaleAxes"
                      class="axis" title="{{ axis.source }}">
                  {{ axis.axis }}</span>
              </div>
              <div class="rung-nodes">
                <button *ngFor="let node of nodesAtLevel(level.name)"
                        class="node"
                        [class.selected]="node.name === selectedName"
                        [class.unbuilt]="node.status === 'unbuilt'"
                        [class.reference]="node.status === 'reference'"
                        (click)="selectNode(node.name)">
                  {{ node.title || node.name }}
                </button>
              </div>
            </div>
          </div>

          <div class="detail" *ngIf="selected">
            <div *ngIf="detailLoading" class="state">
              <mat-spinner diameter="22"></mat-spinner></div>
            <ng-container *ngIf="!detailLoading">
              <div class="crumbs" *ngIf="selected.up.length > 0">
                <ng-container *ngFor="let ancestor of selected.up.slice().reverse()">
                  <button class="crumb" (click)="selectNode(ancestor.name)">
                    {{ ancestor.title || ancestor.name }}</button>
                  <span class="crumb-sep">›</span>
                </ng-container>
                <span class="crumb current">{{ selected.node.title }}</span>
              </div>
              <h3>
                {{ selected.node.title }}
                <span class="badge" [class.live]="selected.node.status === 'live'">
                  {{ selected.node.status }}</span>
                <span class="level-chip">{{ selected.node.level }}</span>
              </h3>
              <div *ngIf="selected.node.citation" class="citation">
                {{ selected.node.citation }}</div>
              <dl class="kv" *ngIf="metricEntries.length > 0">
                <ng-container *ngFor="let entry of metricEntries">
                  <dt>{{ entry[0] }}</dt><dd>{{ entry[1] }}</dd>
                </ng-container>
              </dl>
              <div *ngIf="selected.node.notes" class="notes">
                {{ selected.node.notes }}</div>

              <div *ngIf="selected.node.artifacts?.length > 0" class="artifacts">
                <h4>Linked artifacts &amp; citations</h4>
                <div *ngFor="let artifact of selected.node.artifacts"
                     class="artifact"
                     [class.absent]="!artifact.resolved">
                  <span class="kind">{{ artifact.kind }}</span>
                  <ng-container *ngIf="artifact.kind === 'citation-anchor'">
                    <span class="ref">{{ artifact.ref.anchor }}</span>
                    <span *ngIf="artifact.resolved" class="value">
                      = {{ artifact.value }} {{ artifact.unit }}
                      <span class="doi" *ngIf="artifact.doi">DOI {{ artifact.doi }}</span>
                    </span>
                  </ng-container>
                  <ng-container *ngIf="artifact.kind === 'object-row'">
                    <span class="ref">{{ artifact.ref.module }} /
                      {{ artifact.ref.class }} / {{ artifact.ref.name }}</span>
                    <span *ngIf="artifact.resolved" class="value">
                      {{ artifact.status }}</span>
                  </ng-container>
                  <span *ngIf="!artifact.resolved" class="why">
                    {{ artifact.why }}</span>
                </div>
              </div>

              <div *ngIf="selected.down.length > 0" class="children">
                <h4>Down the ladder</h4>
                <button *ngFor="let child of selected.down" class="node"
                        [class.unbuilt]="child.status === 'unbuilt'"
                        (click)="selectNode(child.name)">
                  {{ child.title || child.name }}
                </button>
              </div>
            </ng-container>
          </div>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .ladder-root { container-type: inline-size; }
    .state { padding: 16px; color: var(--text-secondary, #666); }
    .state.error { color: var(--error-text, #b3261e); }
    .design-picker {
      display: flex; align-items: center; gap: 8px;
      flex-wrap: wrap; margin-bottom: 12px;
    }
    .picker-label { color: var(--text-secondary, #666); font-weight: 600; }
    .chip {
      border: 1px solid var(--border-color, #ccc); border-radius: 16px;
      padding: 4px 12px; background: var(--surface-secondary, #f5f5f5);
      color: var(--text-primary, #222); cursor: pointer;
    }
    .chip.active {
      background: var(--brand-primary, #3f51b5);
      color: var(--brand-primary-text, #fff);
      border-color: var(--brand-primary, #3f51b5);
    }
    .chip .count { opacity: 0.7; margin-left: 4px; font-size: 0.85em; }
    .columns { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    @container (max-width: 760px) {
      .columns { grid-template-columns: 1fr; }
    }
    .rung {
      border: 1px solid var(--border-color, #ddd); border-radius: 8px;
      padding: 10px 12px; margin-bottom: 8px;
      background: var(--surface-secondary, #fafafa);
    }
    .rung.live { border-color: var(--success-text, #2e7d32); }
    .rung-head { display: flex; align-items: center; gap: 8px; }
    .rung-name { font-weight: 700; text-transform: capitalize; }
    .rung-desc {
      color: var(--text-secondary, #666); font-size: 0.85em;
      margin: 4px 0;
    }
    .refusal {
      color: var(--warning-text, #8a6d00); font-size: 0.85em;
      font-style: italic;
    }
    .axes { display: flex; gap: 6px; margin-top: 4px; flex-wrap: wrap; }
    .axis {
      font-size: 0.75em; font-family: monospace;
      border: 1px dashed var(--border-color, #bbb);
      border-radius: 4px; padding: 1px 6px;
      color: var(--text-secondary, #666);
    }
    .badge {
      font-size: 0.7em; text-transform: uppercase; border-radius: 4px;
      padding: 2px 6px; background: var(--surface-tertiary, #eee);
      color: var(--text-secondary, #666);
    }
    .badge.live {
      background: var(--success-surface, #e8f5e9);
      color: var(--success-text, #2e7d32);
    }
    .rung-nodes, .children { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
    .node {
      border: 1px solid var(--border-color, #ccc); border-radius: 6px;
      padding: 4px 10px; cursor: pointer;
      background: var(--surface-primary, #fff);
      color: var(--text-primary, #222); text-align: left;
    }
    .node.selected {
      border-color: var(--brand-primary, #3f51b5);
      box-shadow: 0 0 0 1px var(--brand-primary, #3f51b5) inset;
    }
    .node.unbuilt { opacity: 0.6; border-style: dashed; }
    .node.reference { border-style: dotted; }
    .detail {
      border: 1px solid var(--border-color, #ddd); border-radius: 8px;
      padding: 12px 14px; align-self: start;
    }
    .crumbs { margin-bottom: 8px; font-size: 0.85em; }
    .crumb {
      background: none; border: none; cursor: pointer; padding: 0;
      color: var(--link-text, #1a56a8); text-decoration: underline;
    }
    .crumb-sep { margin: 0 4px; color: var(--text-secondary, #666); }
    .crumb.current { color: var(--text-secondary, #666); }
    h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 6px 0; }
    .level-chip {
      font-size: 0.7em; font-family: monospace;
      border: 1px solid var(--border-color, #bbb); border-radius: 4px;
      padding: 2px 6px; color: var(--text-secondary, #666);
    }
    .citation {
      font-size: 0.8em; color: var(--text-secondary, #666);
      border-left: 3px solid var(--border-color, #ddd);
      padding-left: 8px; margin-bottom: 8px;
    }
    dl.kv {
      display: grid; grid-template-columns: minmax(120px, auto) 1fr;
      gap: 2px 14px; margin: 0 0 8px 0;
    }
    dt { color: var(--text-secondary, #666); font-weight: 600; }
    dd { margin: 0; font-family: monospace; overflow-wrap: anywhere; }
    .notes { font-size: 0.85em; color: var(--text-secondary, #666); margin-bottom: 8px; }
    h4 { margin: 10px 0 6px 0; font-size: 0.9em; }
    .artifact {
      display: flex; flex-wrap: wrap; gap: 6px; align-items: baseline;
      padding: 4px 0; font-size: 0.85em;
    }
    .artifact .kind {
      font-size: 0.75em; text-transform: uppercase;
      color: var(--text-secondary, #666);
    }
    .artifact .ref { font-family: monospace; }
    .artifact .doi { margin-left: 6px; color: var(--text-secondary, #666); }
    .artifact.absent .ref { opacity: 0.6; }
    .artifact .why { color: var(--warning-text, #8a6d00); font-style: italic; }
  `],
})
export class MicrochipLadderComponent implements OnInit {
  /** Design preselected by the page seed; '' = first available. */
  @Input() design = '';

  levels: any[] = [];
  designs: any[] = [];
  activeDesign = '';
  treeNodes: any[] = [];
  selected: any = null;
  selectedName = '';
  metricEntries: Array<[string, string]> = [];
  loading = true;
  detailLoading = false;
  error: string | null = null;

  constructor(private http: HttpClient, private polariService: PolariService) {}

  /** Chip at the top of the rail, device at the bottom. */
  get levelsTopDown(): any[] {
    return this.levels.slice().sort((a, b) => b.rank - a.rank);
  }

  ngOnInit(): void {
    const base = this.polariService.getBackendBaseUrl();
    const opts = this.polariService.backendRequestOptions;
    this.http.get<any>(`${base}/api/microchip/levels`, opts).subscribe({
      next: (payload: any) => {
        this.levels = payload?.levels || [];
        this.http.get<any>(`${base}/api/microchip/designs`, opts).subscribe({
          next: (designsPayload: any) => {
            this.designs = designsPayload?.designs || [];
            this.loading = false;
            const preferred = this.design
              || (this.designs[0]?.design ?? '');
            if (preferred) { this.pickDesign(preferred); }
          },
          error: (err: any) => this.fail('designs', err),
        });
      },
      error: (err: any) => this.fail('levels', err),
    });
  }

  pickDesign(design: string): void {
    this.activeDesign = design;
    this.selected = null;
    this.selectedName = '';
    const base = this.polariService.getBackendBaseUrl();
    this.http.get<any>(
      `${base}/api/microchip/designs/${encodeURIComponent(design)}`,
      this.polariService.backendRequestOptions).subscribe({
      next: (payload: any) => {
        this.treeNodes = this.flatten(payload?.tree || []);
        const live = this.treeNodes.find(
          (node: any) => node.status === 'live');
        this.selectNode((live || this.treeNodes[0])?.name || '');
      },
      error: (err: any) => this.fail(`design ${design}`, err),
    });
  }

  nodesAtLevel(level: string): any[] {
    return this.treeNodes.filter((node: any) => node.level === level);
  }

  selectNode(name: string): void {
    if (!name) { return; }
    this.selectedName = name;
    this.detailLoading = true;
    const base = this.polariService.getBackendBaseUrl();
    this.http.get<any>(
      `${base}/api/microchip/nodes/${encodeURIComponent(name)}`,
      this.polariService.backendRequestOptions).subscribe({
      next: (payload: any) => {
        this.selected = payload;
        this.metricEntries = Object.entries(
          payload?.node?.metrics || {}).map(
          ([key, value]) => [key, typeof value === 'string'
            ? value : JSON.stringify(value)] as [string, string]);
        this.detailLoading = false;
      },
      error: (err: any) => {
        this.detailLoading = false;
        this.fail(`node ${name}`, err);
      },
    });
  }

  private flatten(tree: any[]): any[] {
    const out: any[] = [];
    const walk = (node: any) => {
      out.push(node);
      (node.children || []).forEach(walk);
    };
    tree.forEach(walk);
    return out;
  }

  private fail(what: string, err: any): void {
    this.loading = false;
    this.error = `GET /api/microchip ${what} failed: `
      + `${err?.message || 'request failed'} — is the microchip `
      + 'module loaded on this instance?';
  }
}
