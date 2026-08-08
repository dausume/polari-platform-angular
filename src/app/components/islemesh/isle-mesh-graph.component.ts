/**
 * /isle-mesh — the isle topology view (mac-1).
 *
 * Deterministic scene (isle-mesh-scene.ts): every device is a BOX
 * containing its nginx proxy / router / apps — containment says
 * WHERE containers live. Boxes ring the L2 segment hub (the
 * switch) with interface-labeled connection edges. serves-edges
 * proxy→app are bundled and their labels ARE the access URLs
 * (Dustin 2026-08-07) — stacked so they never overlap. Fit-to-view
 * on paint; zoom/pan for detail.
 *
 * MOCK DISCIPLINE: payload mock_network (a flag real ingests never
 * carry) renders as a LARGE banner; mock elements dash amber.
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
import {
  buildScene, PlacedNode, Scene, SceneLink, SceneNode,
} from './isle-mesh-scene';

interface IsleGraph {
  ok: boolean;
  mock_network: boolean;
  banner: string;
  nodes: SceneNode[];
  links: SceneLink[];
  error?: string;
}

const NODE_COLORS: Record<string, string> = {
  proxy: '#2e7d32',
  router: '#6a1b9a',
  app: '#1565c0',
  segment: '#37474f',
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
  selected: SceneNode | null = null;
  selectedLinks: SceneLink[] = [];
  selectedEdge: {
    kind: string; title: string; is_mock: boolean;
    urls: Array<{ label: string; protocol?: string;
      upstream?: string; fragment?: string; is_mock: boolean }>;
  } | null = null;

  private resizeObserver: ResizeObserver | null = null;
  private paintedWidth = 0;

  constructor(private http: HttpClient,
              private polariService: PolariService,
              private zone: NgZone) {}

  ngAfterViewInit(): void {
    this.refresh();
    this.resizeObserver = new ResizeObserver(() => {
      const w = this.canvasRef?.nativeElement.clientWidth || 0;
      if (w > 0 && Math.abs(w - this.paintedWidth) > 24) {
        this.paint();
      }
    });
    this.resizeObserver.observe(this.canvasRef.nativeElement);
  }

  ngOnDestroy(): void {
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

  selectEdge(edge: typeof this.selectedEdge): void {
    this.selectedEdge = edge;
    if (edge) { this.selected = null; this.selectedLinks = []; }
  }

  select(node: SceneNode | null): void {
    if (node) { this.selectedEdge = null; }
    this.selected = node;
    this.selectedLinks = !node || !this.graph ? []
      : this.graph.links.filter((l) =>
        l.source === node.id || l.target === node.id);
  }

  private paint(): void {
    if (!this.graph?.ok || !this.canvasRef) { return; }
    const host = this.canvasRef.nativeElement;
    const width = host.clientWidth;
    if (!width) {
      requestAnimationFrame(() => this.paint());
      return;
    }
    this.paintedWidth = width;
    const height = host.clientHeight || 480;
    d3.select(host).selectAll('*').remove();

    const scene: Scene = buildScene(this.graph.nodes,
                                    this.graph.links);

    const svg = d3.select(host).append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');
    const root = svg.append('g');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.25, 3])
      .on('zoom', (event) => root.attr('transform',
                                       event.transform));
    svg.call(zoom);

    // ---- FIT TO VIEW: every box visible on first paint.
    const { bbox } = scene;
    const scale = Math.min(width / bbox.w, height / bbox.h, 1.4);
    const tx = width / 2 - (bbox.x + bbox.w / 2) * scale;
    const ty = height / 2 - (bbox.y + bbox.h / 2) * scale;
    svg.call(zoom.transform,
             d3.zoomIdentity.translate(tx, ty).scale(scale));

    const select = (n: SceneNode) =>
      this.zone.run(() => this.select(n));

    // ---- l2 edges (under everything): box edge → segment hub
    if (scene.segment) {
      for (const edge of scene.l2) {
        const bx = edge.from.x + edge.from.w / 2;
        const by = edge.from.y + edge.from.h / 2;
        root.append('line')
          .attr('class', 'edge edge-l2'
            + (edge.is_mock ? ' mock' : ''))
          .attr('x1', bx).attr('y1', by)
          .attr('x2', scene.segment.x)
          .attr('y2', scene.segment.y);
        root.append('line')
          .attr('class', 'edge-hit')
          .attr('x1', bx).attr('y1', by)
          .attr('x2', scene.segment.x)
          .attr('y2', scene.segment.y)
          .on('click', () => this.zone.run(() => this.selectEdge({
            kind: 'l2', is_mock: edge.is_mock,
            title: `${edge.from.device} — isle L2 segment`,
            urls: [{ label: `interface ${edge.label}`,
              is_mock: edge.is_mock }],
          })));
        root.append('text')
          .attr('class', 'edge-iface'
            + (edge.is_mock ? ' mock' : ''))
          .attr('x', (bx + scene.segment.x) / 2)
          .attr('y', (by + scene.segment.y) / 2 - 5)
          .text(edge.label);
      }
    }

    // ---- device boxes
    const boxG = root.selectAll('g.device-box')
      .data(scene.boxes).join('g')
      .attr('class', (b: any) => 'device-box'
        + (b.is_mock ? ' mock' : ''))
      .attr('transform',
            (b: any) => `translate(${b.x},${b.y})`);
    boxG.append('rect')
      .attr('class', 'box-body')
      .attr('width', (b: any) => b.w)
      .attr('height', (b: any) => b.h)
      .attr('rx', 10);
    boxG.append('rect')
      .attr('class', 'box-title-bar')
      .attr('width', (b: any) => b.w)
      .attr('height', 30)
      .attr('rx', 10);
    boxG.append('text')
      .attr('class', 'box-title')
      .attr('x', (b: any) => b.w / 2)
      .attr('y', 20)
      .text((b: any) => b.device
        + (b.is_mock ? '  (mock)' : ''))
      .on('click', (_e: any, b: any) => b.node && select(b.node));
    boxG.filter((b: any) => !b.members.length)
      .append('text')
      .attr('class', 'box-empty')
      .attr('x', (b: any) => b.w / 2)
      .attr('y', (b: any) => (30 + b.h) / 2 + 4)
      .text('no isle containers yet');

    // ---- segment hub
    if (scene.segment) {
      const seg = root.append('g')
        .attr('class', 'node node-segment')
        .attr('transform',
              `translate(${scene.segment.x},${scene.segment.y})`)
        .on('click', () => select(scene.segment!.node));
      seg.append('circle').attr('r', 22)
        .attr('fill', NODE_COLORS['segment']);
      seg.append('text').attr('class', 'node-glyph')
        .attr('dy', 4).text('L2');
      seg.append('text').attr('class', 'node-label')
        .attr('dy', 40).text(scene.segment.node.label);
    }

    // ---- serves edges (bundled) + stacked URL labels
    for (const bundle of scene.serves) {
      const { from, to } = bundle;
      let midX: number;
      let midY: number;
      let path: string;
      if (bundle.sameBox) {
        // bracket arc out the LEFT of the box so labels hang in
        // clear space instead of over box contents
        const bend = Math.max(70, 40 + bundle.urls.length * 14);
        const bx = Math.min(from.x, to.x) - bend;
        midX = bx;
        midY = (from.y + to.y) / 2;
        path = `M ${from.x - from.r} ${from.y}`
          + ` C ${bx} ${from.y}, ${bx} ${to.y},`
          + ` ${to.x - to.r} ${to.y}`;
      } else {
        midX = (from.x + to.x) / 2;
        midY = (from.y + to.y) / 2;
        path = `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
      }
      root.append('path')
        .attr('class', 'edge edge-serves'
          + (bundle.is_mock ? ' mock' : ''))
        .attr('d', path);
      root.append('path')
        .attr('class', 'edge-hit')
        .attr('d', path)
        .on('click', () => this.zone.run(() => this.selectEdge({
          kind: 'serves', is_mock: bundle.is_mock,
          title: `${bundle.from.node.label} → `
            + `${bundle.to.node.label}`,
          urls: bundle.urls,
        })));
      bundle.urls.forEach((u, i) => {
        root.append('text')
          .attr('class', 'edge-url'
            + (u.is_mock ? ' mock' : '')
            + (u.protocol === 'https-mtls' ? ' mtls' : ''))
          .attr('x', bundle.sameBox ? midX - 6 : midX)
          .attr('y', midY - 6
            + (i - (bundle.urls.length - 1) / 2) * 15)
          .attr('text-anchor',
                bundle.sameBox ? 'end' : 'middle')
          .text(u.protocol === 'https-mtls'
            ? `${u.label} (mTLS)` : u.label);
      });
    }

    // ---- inner nodes (proxies, routers, apps) + floats
    const drawNode = (placed: PlacedNode) => {
      const n = placed.node;
      const g = root.append('g')
        .attr('class', `node node-${n.kind}`
          + (n.is_mock ? ' mock' : ''))
        .attr('transform',
              `translate(${placed.x},${placed.y})`)
        .on('click', () => select(n));
      g.append('circle').attr('r', placed.r)
        .attr('fill', NODE_COLORS[n.kind] || '#455a64');
      g.append('text').attr('class', 'node-glyph').attr('dy', 4)
        .text(({ proxy: 'ngx', router: '⇄', app: 'app' } as
          Record<string, string>)[n.kind] || '');
      // SHORT labels inside boxes — the full label lives in the
      // detail panel (long ones caused the isle-core overlap).
      const short = ({ proxy: 'nginx agent', router: 'router' } as
        Record<string, string>)[n.kind] || n.label;
      g.append('text').attr('class', 'node-label')
        .attr('dy', placed.r + 14)
        .text(short.length > 16
          ? short.slice(0, 15) + '…' : short);
    };
    scene.boxes.forEach((b) => b.members.forEach(drawNode));
    scene.floats.forEach(drawNode);
  }
}
