/**
 * /isle-mesh — the isle topology as a D3 force graph (mac-1).
 *
 * Nodes: devices, their nginx proxies (isle-agent), the OpenWRT
 * router, and the apps served. EDGES from proxy → app are the
 * point (Dustin 2026-08-07): each is one nginx permit and its
 * label IS the access URL. The proxies are the policy; this view
 * just draws it.
 *
 * MOCK DISCIPLINE: the payload's mock_network flag (set only by
 * mock ingests — real data never carries it) renders as a LARGE
 * banner at the top, and every mock node/edge is dashed amber.
 */
import {
  AfterViewInit, Component, ElementRef, NgZone, OnDestroy,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import * as d3 from 'd3';

import { PolariService } from '@services/polari-service';

interface IsleNode {
  id: string;
  kind: 'device' | 'proxy' | 'router' | 'app' | string;
  label: string;
  device: string;
  is_mock: boolean;
  agent_present?: boolean;
  router_running?: boolean;
  connectivity_mode?: string;
  domain?: string;
  availability_mode?: string;
  status?: string;
  implied?: boolean;
  // simulation-managed (self-typed — the repo carries no @types/d3)
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface IsleLink {
  source: string | IsleNode;
  target: string | IsleNode;
  kind: 'serves' | 'hosts' | 'runs-on' | string;
  label: string;
  protocol?: string;
  upstream?: string;
  fragment?: string;
  is_mock: boolean;
}

interface IsleGraph {
  ok: boolean;
  mock_network: boolean;
  banner: string;
  nodes: IsleNode[];
  links: IsleLink[];
  error?: string;
}

const NODE_COLORS: Record<string, string> = {
  device: '#546e7a',
  proxy: '#2e7d32',
  router: '#6a1b9a',
  app: '#1565c0',
};

const NODE_RADIUS: Record<string, number> = {
  device: 26,
  proxy: 18,
  router: 18,
  app: 20,
};

@Component({
  selector: 'app-isle-mesh-graph',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  templateUrl: './isle-mesh-graph.component.html',
  styleUrls: ['./isle-mesh-graph.component.scss'],
})
export class IsleMeshGraphComponent implements AfterViewInit,
    OnDestroy {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLDivElement>;

  graph: IsleGraph | null = null;
  loadError = '';
  loading = true;
  selected: IsleNode | null = null;
  selectedLinks: IsleLink[] = [];

  private sim: any = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor(private http: HttpClient,
              private polariService: PolariService,
              private zone: NgZone) {}

  ngAfterViewInit(): void {
    this.refresh();
    this.resizeObserver = new ResizeObserver(() => this.paint());
    this.resizeObserver.observe(this.canvasRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.sim?.stop();
    this.resizeObserver?.disconnect();
  }

  async refresh(): Promise<void> {
    this.loading = true;
    this.loadError = '';
    const base = this.polariService.getBackendBaseUrl();
    this.graph = await firstValueFrom(this.http.get<IsleGraph>(
      `${base}/api/islemesh/graph`,
      this.polariService.backendRequestOptions))
      .catch((err) => (err?.error?.ok === false ? err.error : null));
    this.loading = false;
    if (!this.graph?.ok) {
      this.loadError = this.graph?.error
        || 'GET /api/islemesh/graph did not answer — is the '
        + 'islemesh module deployed?';
      return;
    }
    this.paint();
  }

  select(node: IsleNode | null): void {
    this.selected = node;
    this.selectedLinks = !node || !this.graph ? []
      : this.graph.links.filter((l) =>
        (l.source as IsleNode).id === node.id
        || (l.target as IsleNode).id === node.id);
  }

  private paint(): void {
    if (!this.graph?.ok || !this.canvasRef) { return; }
    const host = this.canvasRef.nativeElement;
    const width = host.clientWidth || 900;
    const height = Math.max(560, host.clientHeight || 560);
    d3.select(host).selectAll('*').remove();

    const nodes = this.graph.nodes.map((n) => ({ ...n }));
    const links = this.graph.links.map((l) => ({ ...l }));

    const svg = d3.select(host).append('svg')
      .attr('width', width).attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`);
    const root = svg.append('g');
    svg.call(d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => root.attr('transform',
                                       event.transform)));

    this.zone.runOutsideAngular(() => {
      this.sim?.stop();
      this.sim = d3.forceSimulation(nodes as any)
        .force('link', d3.forceLink(links as any)
          .id((d: any) => d.id)
          .distance((l: any) => l.kind === 'serves' ? 170 : 80)
          .strength(0.5))
        .force('charge', d3.forceManyBody().strength(-420))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collide', d3.forceCollide()
          .radius((d: any) => (NODE_RADIUS[d.kind] || 18) + 14));

      const link = root.append('g').selectAll('line')
        .data(links as any).join('line')
        .attr('class', (d: any) => `edge edge-${d.kind}`
          + (d.is_mock ? ' mock' : ''));

      // URL labels ride the serves-edges — they ARE the point.
      const edgeLabel = root.append('g')
        .selectAll('text')
        .data(links.filter((l) => l.kind === 'serves' && l.label) as any)
        .join('text')
        .attr('class', (d: any) => 'edge-url'
          + (d.is_mock ? ' mock' : '')
          + (d.protocol === 'https-mtls' ? ' mtls' : ''))
        .text((d: any) => d.protocol === 'https-mtls'
          ? `${d.label} (mTLS)` : d.label);

      const node = root.append('g').selectAll('g')
        .data(nodes as any).join('g')
        .attr('class', (d: any) => `node node-${d.kind}`
          + (d.is_mock ? ' mock' : ''))
        .call((d3.drag() as any)
          .on('start', (event: any, d: any) => {
            if (!event.active) { this.sim?.alphaTarget(0.25)
              .restart(); }
            d.fx = d.x; d.fy = d.y;
          })
          .on('drag', (event: any, d: any) => { d.fx = event.x;
            d.fy = event.y; })
          .on('end', (event: any, d: any) => {
            if (!event.active) { this.sim?.alphaTarget(0); }
            d.fx = null; d.fy = null;
          }))
        .on('click', (_event: any, d: any) => this.zone.run(
          () => this.select(d)));

      node.append('circle')
        .attr('r', (d: any) => NODE_RADIUS[d.kind] || 18)
        .attr('fill', (d: any) => NODE_COLORS[d.kind] || '#455a64');

      node.append('text')
        .attr('class', 'node-label')
        .attr('dy', (d: any) => (NODE_RADIUS[d.kind] || 18) + 16)
        .text((d: any) => d.label);

      // tiny kind glyph inside the circle
      node.append('text')
        .attr('class', 'node-glyph')
        .attr('dy', 5)
        .text((d: any) => ({ device: '🖥', proxy: 'ngx', router: '⇄',
          app: 'app' } as Record<string, string>)[d.kind] || '');

      this.sim.on('tick', () => {
        link
          .attr('x1', (d: any) => (d.source as IsleNode).x || 0)
          .attr('y1', (d: any) => (d.source as IsleNode).y || 0)
          .attr('x2', (d: any) => (d.target as IsleNode).x || 0)
          .attr('y2', (d: any) => (d.target as IsleNode).y || 0);
        edgeLabel
          .attr('x', (d: any) => (((d.source as IsleNode).x || 0)
            + ((d.target as IsleNode).x || 0)) / 2)
          .attr('y', (d: any) => (((d.source as IsleNode).y || 0)
            + ((d.target as IsleNode).y || 0)) / 2 - 6);
        node.attr('transform',
                  (d: any) => `translate(${d.x || 0},${d.y || 0})`);
      });
    });
  }
}
