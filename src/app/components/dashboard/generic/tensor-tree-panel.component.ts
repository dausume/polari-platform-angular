import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import * as d3 from 'd3';
import { PolariService } from '@services/polari-service';

/**
 * A TensorTree, drawn so it gives INTUITION (tt-5; plan COMPUTE_LOD_TENSOR_PLAN §11–§16):
 *
 *   · the rooted STRUCTURE as a d3 tree (top-down): resolved nodes solid, unresolved spaces dashed with their
 *     research-task kind (semantic / structural / visualization / mapping / validation) — a tree may be
 *     incomplete and still be useful, so the gaps are drawn, not hidden;
 *   · the MAPPINGS as arcs that may cross branches, coloured by their evidence level (none · analytical ·
 *     simulated · measured) and dashed when only proposed — the graph reading of §16 over the tree;
 *   · a node's DIMENSIONS → visual CHANNELS as a legend (x → position.x, T → color [300–900 K] …) — the
 *     invariant of §12 made visible: a node is resolved exactly when every dimension has a channel;
 *   · the cycle VISUALIZE → SELECT → DISCOVER → MAP (§15): pick ranges on a resolved node, POST the selection
 *     (a row, not a UI event), read the ranked candidates with their evidence and the refusals with their
 *     reasons, click a candidate to follow the mapping to its target node.
 *
 * One read (`/api/tensortree/trees/{name}/view`), one write (`/api/tensortree/select`). d3 is the existing
 * node-graph home (techtree / msim views use it); no new chart engine. Registered as 'tensor-tree-panel'.
 */
@Component({
  standalone: true,
  selector: 'tensor-tree-panel',
  imports: [CommonModule, FormsModule, MatProgressSpinnerModule],
  template: `
    <div class="tt-root">
      <div *ngIf="loading" class="state"><mat-spinner diameter="28"></mat-spinner></div>
      <div *ngIf="error" class="state error">{{ error }}</div>
      <ng-container *ngIf="!loading && !error">
        <div class="picker">
          <span class="picker-label">Tree:</span>
          <button *ngFor="let t of trees" class="chip" [class.active]="t.name === activeTree" (click)="pickTree(t.name)"
                  title="{{ t.view_kind }} · {{ t.resolved_nodes }}/{{ t.nodes }} resolved · {{ t.unresolved }} unresolved">
            {{ t.name }} <span class="count">{{ t.resolved_nodes }}/{{ t.nodes }}</span>
          </button>
          <span class="legend">
            <span class="lg solid">resolved node</span>
            <span class="lg dashed">unresolved space</span>
            <span class="lg ev none">none</span><span class="lg ev analytical">analytical</span>
            <span class="lg ev simulated">simulated</span><span class="lg ev measured">measured</span>
          </span>
        </div>
        <div class="tree-desc" *ngIf="view">{{ view.tree.description }}</div>
        <div class="columns">
          <div class="canvas"><svg #svg></svg></div>
          <div class="detail" *ngIf="selected">
            <div class="det-head">
              <span class="det-title">{{ selected.title || selected.id }}</span>
              <span class="badge" [class.ok]="selected.status === 'resolved'" [class.unres]="selected.status !== 'resolved'">
                {{ selected.kind === 'node' ? selected.status : 'unresolved: ' + selected.unresolved_kind }}</span>
            </div>
            <div class="det-why" *ngIf="selected.why">{{ selected.why }}</div>
            <div class="det-row" *ngIf="selected.tensor"><span class="k">tensor</span><span class="v mono">{{ selected.tensor }}</span></div>
            <div class="det-row" *ngIf="selected.binding_ref"><span class="k">binding</span><span class="v mono">{{ selected.binding_ref }}</span></div>

            <ng-container *ngIf="selected.kind === 'node'">
              <div class="section">dimensions → channels</div>
              <div class="dims">
                <div *ngFor="let d of selected.dims" class="dim" [class.bad]="selected.incoherent[d.name]">
                  <span class="dim-name">{{ shortDim(d.dimension) }}</span>
                  <span class="arrow">→</span>
                  <span class="chan" [attr.data-chan]="d.channel">{{ d.channel || '(no channel)' }}</span>
                  <span class="range" *ngIf="d.range?.length === 2">[{{ d.range[0] }} … {{ d.range[1] }}]</span>
                  <span class="range" *ngIf="d.scale?.domain">{{ d.scale.kind }} {{ d.scale.domain[0] }}–{{ d.scale.domain[1] }} {{ d.scale.unit || '' }}</span>
                  <span class="bad-why" *ngIf="selected.incoherent[d.name]">{{ selected.incoherent[d.name] }}</span>
                </div>
                <div *ngIf="!selected.dims?.length" class="muted">no localized dimensions yet</div>
              </div>

              <div class="section">select → discover</div>
              <div class="sel-form">
                <div *ngFor="let r of selRanges" class="sel-row">
                  <span class="dim-name">{{ r.dim }}</span>
                  <input type="number" [(ngModel)]="r.lo" step="any"> <span class="arrow">…</span>
                  <input type="number" [(ngModel)]="r.hi" step="any">
                </div>
                <button class="go" (click)="discover()" [disabled]="discovering || !selRanges.length">
                  {{ discovering ? 'discovering…' : 'select this region and discover its mappings' }}</button>
                <div class="muted" *ngIf="!selRanges.length">a selection needs at least one dimension</div>
              </div>
              <div *ngIf="discovery" class="discovery">
                <div class="disc-title">{{ discovery.candidates.length }} candidate mapping(s), ranked — the user chooses</div>
                <div *ngFor="let c of discovery.candidates" class="cand" (click)="followMapping(c)" title="score terms E={{ c.terms.E }} D={{ c.terms.D }} V={{ c.terms.V }} C={{ c.terms.C }} U={{ c.terms.U }}">
                  <div class="cand-head"><span class="mono">{{ c.mapping }}</span> <span class="pill">{{ c.kind }}</span>
                    <span class="ev" [attr.data-ev]="c.evidence_level">{{ c.evidence }}</span></div>
                  <div class="bar"><div class="fill" [style.width.%]="c.score * 100"></div><span class="score">{{ c.score | number:'1.2-2' }}</span></div>
                  <div class="cand-to">→ {{ c.target_node }} <span class="muted" *ngIf="c.evidence_ref">· {{ c.evidence_ref }}</span></div>
                  <div class="muted" *ngIf="c.loss_note">loses: {{ c.loss_note }}</div>
                </div>
                <div *ngIf="discovery.refused?.length" class="refused">
                  <div class="disc-title">refused (never scored)</div>
                  <div *ngFor="let r of discovery.refused" class="ref"><span class="mono">{{ r.mapping }}</span> — {{ r.why }}</div>
                </div>
              </div>
            </ng-container>

            <ng-container *ngIf="selected.kind === 'unresolved'">
              <div class="section">what is known</div>
              <div class="dims"><span *ngFor="let d of selected.known_dims" class="chan">{{ d }}</span>
                <span *ngIf="!selected.known_dims?.length" class="muted">no dimensions known</span></div>
              <div class="section" *ngIf="selected.candidates?.length">candidates</div>
              <div *ngFor="let c of selected.candidates" class="q">{{ c }}</div>
              <div class="section" *ngIf="selected.hypotheses?.length">hypotheses</div>
              <div *ngFor="let h of selected.hypotheses" class="q">{{ h }}</div>
              <div class="section" *ngIf="selected.open_questions?.length">open questions</div>
              <div *ngFor="let q of selected.open_questions" class="q">? {{ q }}</div>
            </ng-container>

            <div class="section" *ngIf="mappingsOf(selected.id).length">mappings from / to this node</div>
            <div *ngFor="let m of mappingsOf(selected.id)" class="map-row" (click)="highlight(m.name)" [class.hl]="m.name === highlighted">
              <span class="ev" [attr.data-ev]="m.evidence_level">{{ m.evidence_level }}</span>
              <span class="mono">{{ m.name }}</span> <span class="pill">{{ m.kind }}</span>
              <span class="muted">{{ m.source_node === selected.id ? '→ ' + m.target_node : '← ' + m.source_node }} · {{ m.mapping_status }}</span>
            </div>
          </div>
          <div class="detail hint" *ngIf="!selected && view">click a node — solid = resolved (every dimension bound to a channel), dashed = an unresolved space with what is known kept</div>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .tt-root { display:flex; flex-direction:column; gap:.5rem; font-size:.85rem; }
    .state { padding:1rem; } .error { color:#b00020; }
    .picker { display:flex; flex-wrap:wrap; gap:.4rem; align-items:center; }
    .picker-label { opacity:.7; }
    .chip { border:1px solid #bbb; background:#fafafa; border-radius:14px; padding:.15rem .6rem; cursor:pointer; }
    .chip.active { background:#1e88e5; color:#fff; border-color:#1e88e5; }
    .count { opacity:.7; margin-left:.3rem; font-size:.75rem; }
    .legend { margin-left:auto; display:flex; gap:.5rem; flex-wrap:wrap; font-size:.72rem; opacity:.85; }
    .lg::before { content:''; display:inline-block; width:14px; height:10px; margin-right:.25rem; vertical-align:middle; border-radius:2px; }
    .lg.solid::before { background:#e3f2fd; border:1.5px solid #1e88e5; }
    .lg.dashed::before { background:#fff; border:1.5px dashed #999; }
    .lg.ev::before { height:3px; }
    .lg.ev.none::before { background:#9e9e9e; } .lg.ev.analytical::before { background:#f9a825; }
    .lg.ev.simulated::before { background:#1e88e5; } .lg.ev.measured::before { background:#2e7d32; }
    .tree-desc { opacity:.75; font-size:.8rem; }
    .columns { display:flex; gap:.75rem; align-items:flex-start; flex-wrap:wrap; }
    .canvas { flex:1 1 480px; min-width:320px; } svg { width:100%; height:420px; background:#fcfcfd; border:1px solid #e6e6e6; border-radius:6px; }
    .detail { flex:1 1 320px; min-width:280px; border:1px solid #e6e6e6; border-radius:6px; padding:.6rem; background:#fff; }
    .detail.hint { opacity:.7; }
    .det-head { display:flex; gap:.5rem; align-items:center; } .det-title { font-weight:600; }
    .badge { border-radius:10px; padding:.05rem .5rem; font-size:.72rem; background:#eee; }
    .badge.ok { background:#c8e6c9; color:#1b5e20; } .badge.unres { background:#ffe0b2; color:#7a4100; }
    .det-why { opacity:.8; margin:.2rem 0; } .det-row { display:flex; gap:.5rem; } .k { opacity:.6; width:60px; }
    .mono { font-family: ui-monospace, monospace; font-size:.8rem; }
    .section { margin-top:.6rem; font-size:.72rem; letter-spacing:.06em; text-transform:uppercase; opacity:.6; }
    .dims { display:flex; flex-direction:column; gap:.2rem; }
    .dim { display:flex; gap:.4rem; align-items:center; flex-wrap:wrap; } .dim.bad { color:#b00020; }
    .dim-name { font-weight:600; min-width:70px; } .arrow { opacity:.5; }
    .chan { background:#ede7f6; color:#4527a0; border-radius:4px; padding:0 .35rem; font-family:ui-monospace, monospace; font-size:.78rem; }
    .range { opacity:.7; font-size:.78rem; } .bad-why { font-size:.75rem; }
    .muted { opacity:.6; font-size:.78rem; }
    .sel-form { display:flex; flex-direction:column; gap:.25rem; } .sel-row { display:flex; gap:.3rem; align-items:center; }
    .sel-row input { width:90px; }
    .go { margin-top:.3rem; border:1px solid #1e88e5; background:#1e88e5; color:#fff; border-radius:4px; padding:.25rem .6rem; cursor:pointer; }
    .go:disabled { opacity:.5; cursor:default; }
    .discovery { margin-top:.4rem; } .disc-title { font-weight:600; margin:.3rem 0; }
    .cand { border:1px solid #e0e0e0; border-radius:6px; padding:.35rem .5rem; margin-bottom:.3rem; cursor:pointer; }
    .cand:hover { border-color:#1e88e5; }
    .cand-head { display:flex; gap:.4rem; align-items:center; flex-wrap:wrap; }
    .pill { background:#eee; border-radius:8px; padding:0 .4rem; font-size:.72rem; }
    .ev { border-radius:8px; padding:0 .4rem; font-size:.72rem; color:#fff; background:#9e9e9e; }
    .ev[data-ev="analytical"] { background:#f9a825; } .ev[data-ev="simulated"] { background:#1e88e5; } .ev[data-ev="measured"] { background:#2e7d32; }
    .bar { position:relative; height:10px; background:#eee; border-radius:5px; margin:.25rem 0; }
    .fill { height:100%; background:#1e88e5; border-radius:5px; }
    .score { position:absolute; right:.3rem; top:-.35rem; font-size:.72rem; }
    .cand-to { font-size:.8rem; }
    .refused { margin-top:.4rem; } .ref { font-size:.78rem; opacity:.85; margin:.15rem 0; }
    .q { font-size:.8rem; margin:.15rem 0; }
    .map-row { display:flex; gap:.4rem; align-items:center; flex-wrap:wrap; padding:.15rem .25rem; cursor:pointer; border-radius:4px; }
    .map-row.hl, .map-row:hover { background:#f1f8ff; }
  `],
})
export class TensorTreePanelComponent implements OnInit, AfterViewInit, OnDestroy {
  /** the tree to open; empty = the first tree the instance lists */
  @Input() treeName = '';
  @ViewChild('svg') svgRef!: ElementRef<SVGSVGElement>;

  trees: any[] = [];
  activeTree = '';
  view: any = null;
  selected: any = null;
  selRanges: Array<{ dim: string; lo: number | null; hi: number | null }> = [];
  discovery: any = null;
  discovering = false;
  highlighted = '';
  loading = true;
  error: string | null = null;
  private viewReady = false;
  private resizeObs?: ResizeObserver;

  constructor(private http: HttpClient, private polariService: PolariService) {}

  ngOnInit(): void {
    const base = this.polariService.getBackendBaseUrl();
    this.http.get<any>(`${base}/api/tensortree`, this.polariService.backendRequestOptions).subscribe({
      next: (p: any) => {
        this.trees = p?.trees || [];
        this.loading = false;
        const first = this.treeName || (this.trees[0]?.name ?? '');
        if (first) { this.pickTree(first); } else { this.error = 'no tensor trees on this instance yet'; }
      },
      error: (e: any) => { this.loading = false; this.error = `could not read /api/tensortree (${e?.status ?? '?'})`; },
    });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    if (typeof ResizeObserver !== 'undefined' && this.svgRef?.nativeElement) {
      this.resizeObs = new ResizeObserver(() => this.draw());
      this.resizeObs.observe(this.svgRef.nativeElement.parentElement as Element);
    }
    this.draw();
  }

  ngOnDestroy(): void { this.resizeObs?.disconnect(); }

  pickTree(name: string): void {
    this.activeTree = name; this.selected = null; this.discovery = null; this.highlighted = '';
    const base = this.polariService.getBackendBaseUrl();
    this.http.get<any>(`${base}/api/tensortree/trees/${encodeURIComponent(name)}/view`, this.polariService.backendRequestOptions).subscribe({
      next: (v: any) => { this.view = v; this.draw(); },
      error: (e: any) => { this.error = `could not read the tree ${name} (${e?.status ?? '?'})`; },
    });
  }

  shortDim(d: string): string { return (d || '').split('.').pop() || d; }

  mappingsOf(id: string): any[] {
    return (this.view?.mappings || []).filter((m: any) => m.source_node === id || m.target_node === id);
  }

  selectNode(id: string): void {
    this.selected = (this.view?.nodes || []).find((n: any) => n.id === id) || null;
    this.discovery = null; this.highlighted = '';
    const prior = (this.view?.selections || []).filter((s: any) => s.node === id).slice(-1)[0];
    this.selRanges = (this.selected?.dims || []).map((d: any) => {
      const short = this.shortDim(d.dimension);
      const seeded = prior?.ranges?.[short] || prior?.ranges?.[d.dimension];
      const r = seeded || (d.range?.length === 2 ? d.range : (d.scale?.domain?.length === 2 ? d.scale.domain : null));
      return { dim: short, lo: r ? r[0] : null, hi: r ? r[1] : null };
    }).filter((r: any) => r.dim);
    this.draw();
  }

  discover(): void {
    if (!this.selected) { return; }
    const ranges: any = {};
    for (const r of this.selRanges) { if (r.lo !== null && r.hi !== null && r.lo <= r.hi) { ranges[r.dim] = [Number(r.lo), Number(r.hi)]; } }
    if (!Object.keys(ranges).length) { return; }
    this.discovering = true;
    const base = this.polariService.getBackendBaseUrl();
    this.http.post<any>(`${base}/api/tensortree/select`, { node: this.selected.id, ranges, created_from: 'tensor-tree-panel' }, this.polariService.backendRequestOptions).subscribe({
      next: (p: any) => { this.discovery = p?.discovery || null; this.discovering = false; this.draw(); },
      error: (e: any) => { this.discovering = false; this.discovery = { candidates: [], refused: [{ mapping: '', why: e?.error?.error || `select failed (${e?.status ?? '?'})` }] }; },
    });
  }

  followMapping(c: any): void {
    this.highlighted = c.mapping;
    const target = (this.view?.nodes || []).find((n: any) => n.id === c.target_node);
    if (target) { this.selectNode(target.id); this.highlighted = c.mapping; this.draw(); }
    else { this.draw(); }
  }

  highlight(name: string): void { this.highlighted = this.highlighted === name ? '' : name; this.draw(); }

  private draw(): void {
    if (!this.viewReady || !this.view || !this.svgRef?.nativeElement) { return; }
    const svgEl = this.svgRef.nativeElement;
    const width = Math.max(320, svgEl.clientWidth || 640), height = svgEl.clientHeight || 420;
    const svg = d3.select(svgEl); svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`);
    const nodes: any[] = this.view.nodes || []; const edges: any[] = this.view.edges || [];
    if (!nodes.length) { return; }
    const byId = new Map(nodes.map((n: any) => [n.id, n]));
    const parentOf = new Map<string, string>(); edges.forEach((e: any) => parentOf.set(e.to, e.from));
    // a forest is possible while a tree is being built: every parentless node hangs off a hidden root
    const data = nodes.map((n: any) => ({ id: n.id, parentId: parentOf.get(n.id) && byId.has(parentOf.get(n.id) as string) ? parentOf.get(n.id) : '__root__' }));
    data.push({ id: '__root__', parentId: undefined as any });
    let root: d3.HierarchyNode<any>;
    try { root = d3.stratify<any>().id((d: any) => d.id).parentId((d: any) => d.parentId)(data); } catch { return; }
    const margin = { top: 28, right: 24, bottom: 20, left: 24 };
    const layout = d3.tree<any>().size([width - margin.left - margin.right, height - margin.top - margin.bottom - 40]);
    layout(root);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const pos = new Map<string, { x: number; y: number }>();
    root.descendants().forEach((d: any) => { if (d.id !== '__root__') { pos.set(d.id, { x: d.x, y: d.y - (root.children && root.children.length === 1 ? 0 : 0) }); } });
    // structural edges
    g.append('g').selectAll('path').data(root.links().filter((l: any) => l.source.id !== '__root__')).join('path')
      .attr('fill', 'none').attr('stroke', '#bdbdbd').attr('stroke-width', 1.5)
      .attr('d', (l: any) => `M${l.source.x},${l.source.y} C${l.source.x},${(l.source.y + l.target.y) / 2} ${l.target.x},${(l.source.y + l.target.y) / 2} ${l.target.x},${l.target.y}`);
    // mapping arcs (may cross branches; may point outside this tree → drawn to a stub)
    const evColor: any = { none: '#9e9e9e', analytical: '#f9a825', simulated: '#1e88e5', measured: '#2e7d32' };
    const maps: any[] = this.view.mappings || [];
    const arcs = g.append('g');
    maps.forEach((m: any) => {
      const s = pos.get(m.source_node); if (!s) { return; }
      let t = pos.get(m.target_node);
      const external = !t;
      if (!t) { t = { x: Math.min(width - margin.right - 60, s.x + 120), y: s.y + 70 }; }
      const dx = t.x - s.x, dy = t.y - s.y; const mx = (s.x + t.x) / 2 + (external ? 0 : -dy * 0.35), my = (s.y + t.y) / 2 + dx * 0.35;
      const hl = m.name === this.highlighted;
      arcs.append('path').attr('fill', 'none').attr('stroke', evColor[m.evidence_level] || '#9e9e9e').attr('stroke-width', hl ? 3 : 1.6)
        .attr('stroke-dasharray', m.mapping_status === 'proposed' ? '4 3' : null).attr('opacity', hl ? 1 : 0.75)
        .attr('d', `M${s.x},${s.y} Q${mx},${my} ${t!.x},${t!.y}`).attr('marker-end', 'url(#tt-arrow)')
        .append('title').text(`${m.name} (${m.kind}) — ${m.mapping_status} / ${m.evidence_level}${m.loss_note ? ' — loses: ' + m.loss_note : ''}`);
      if (external) {
        arcs.append('text').attr('x', t.x + 4).attr('y', t.y + 4).attr('font-size', 10).attr('fill', '#777').text(`→ ${m.target_node} (another tree)`);
      }
      const lx = (s.x + t.x) / 2 + (external ? 0 : -dy * 0.18), ly = (s.y + t.y) / 2 + dx * 0.18;
      arcs.append('text').attr('x', lx).attr('y', ly).attr('font-size', 9).attr('fill', evColor[m.evidence_level] || '#9e9e9e').attr('text-anchor', 'middle').text(m.kind);
    });
    svg.append('defs').append('marker').attr('id', 'tt-arrow').attr('viewBox', '0 0 10 10').attr('refX', 9).attr('refY', 5).attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto')
      .append('path').attr('d', 'M0,0 L10,5 L0,10 z').attr('fill', '#777');
    // nodes
    const boxW = 150, boxH = 40;
    const gn = g.append('g').selectAll('g').data(nodes).join('g')
      .attr('transform', (n: any) => { const p = pos.get(n.id)!; return `translate(${p.x - boxW / 2},${p.y - boxH / 2})`; })
      .style('cursor', 'pointer').on('click', (_: any, n: any) => this.selectNode(n.id));
    gn.append('rect').attr('width', boxW).attr('height', boxH).attr('rx', 8)
      .attr('fill', (n: any) => n.kind === 'unresolved' ? '#fff' : (n.status === 'resolved' ? '#e3f2fd' : '#fff8e1'))
      .attr('stroke', (n: any) => n.id === this.selected?.id ? '#0d47a1' : (n.kind === 'unresolved' ? '#999' : (n.status === 'resolved' ? '#1e88e5' : '#f9a825')))
      .attr('stroke-width', (n: any) => n.id === this.selected?.id ? 2.5 : 1.5)
      .attr('stroke-dasharray', (n: any) => n.kind === 'unresolved' ? '5 3' : null);
    gn.append('text').attr('x', 8).attr('y', 16).attr('font-size', 11).attr('font-weight', 600).text((n: any) => (n.title || n.id).slice(0, 24));
    gn.append('text').attr('x', 8).attr('y', 31).attr('font-size', 9.5).attr('fill', '#555')
      .text((n: any) => n.kind === 'unresolved' ? `unresolved · ${n.unresolved_kind}` : (n.status === 'resolved' ? `resolved · ${(n.dims || []).length} dims bound` : `unresolved · ${n.why || ''}`.slice(0, 30)));
    gn.append('title').text((n: any) => n.kind === 'unresolved' ? `${n.id}\n${(n.open_questions || []).join('\n')}` : `${n.id}\n${(n.dims || []).map((d: any) => `${this.shortDim(d.dimension)} → ${d.channel}`).join('\n')}`);
  }
}
