// polari-platform-angular/src/app/components/custom-no-code/states/hardware/c-atom-overlay/c-atom-overlay.component.ts
//
// hn-0 (HARDWARE_NOCODE_PLAN.md D-hn-2: ONE canvas, new node kinds; the c-atom overlay is the planned cmod-3).
// The inline overlay for the two DEVICE node kinds — both are C on the board, never run in the engine:
//
//   CAtom             one cmod CFunctionAtom: its signature, ports (direction + Polari type), ISR-safety, cost as a node
//   HardwareSubgraph  a whole cmod CGraph (D-hn-1: the hardware SUBGRAPH stays cmod's rows) shown as ONE collapsed node;
//                     the expand toggle opens its nodes (instance, kind, atom, stage) INSIDE the overlay. The canvas has no
//                     grouping layer to reuse, and SolutionInvocation is the precedent for "a node that references another
//                     graph" — so the expand/collapse is the overlay's own, minimal, and adds nothing to the D3 layers.
//
// Reuses the canvas's overlay pattern: StateOverlayBase (positioning, size tiers, view/page outputs), the shared
// <state-overlay-shell>, the appStateOverlayRoot directive, `fieldValuesChanged` for edits. Data is READ from the existing
// endpoints (GET /api/cmod/atoms/{atom}, GET /api/cmod/graphs/{graph}); nothing is shown as raw JSON.

import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';

import { StateOverlayBase } from '../../_shared/state-overlay/state-overlay-base';
import { PolariService } from '@services/polari-service';

export interface CAtomView {
  name: string; function: string; signature: string; kind: string; isr_safe: string; pure: boolean;
  text_bytes_noinline: number; role: string;
}
export interface CPortView { port: string; direction: string; polari_type: string; ctype: string; unit: string; }
export interface CGraphView {
  name: string; title: string; status: string; node_count: number; edge_count: number; atom_count: number;
  cost_estimate_bytes: number; graph_sha256: string;
}
export interface CGraphNodeView { instance: string; kind: string; atom: string; stage: string; order: number; ports_summary?: string; }
export interface CGraphEdgeView { kind: string; from_node: string; from_port: string; to_node: string; to_port: string; }
export interface TargetDefinitionView {
  node: string; port: string; port_ref: string; kind: string; controls: string; lives_on: string; provenance: string;
}

@Component({
  standalone: false,
  selector: 'c-atom-overlay',
  templateUrl: './c-atom-overlay.component.html',
  styleUrls: ['./c-atom-overlay.component.css'],
})
export class CAtomOverlayComponent extends StateOverlayBase implements OnInit, OnDestroy {
  /** 'CAtom' (one atom) or 'HardwareSubgraph' (a CGraph as one collapsible node). */
  @Input() boundClassName: string = 'CAtom';
  @Input() boundObjectFieldValues: { [key: string]: any } | null = null;
  /** From the palette entry (the placement rule's word): 'board' for both device kinds. */
  @Input() placement: string = 'board';

  @Output() fieldValuesChanged = new EventEmitter<{ [key: string]: any }>();

  mode: 'atom' | 'subgraph' = 'atom';
  expanded = false;
  loading = false;
  error = '';
  atom: CAtomView | null = null;
  ports: CPortView[] = [];
  graph: CGraphView | null = null;
  nodes: CGraphNodeView[] = [];
  /** demo-4: the graph's wires and derived target badges — read straight off GET /api/cmod/graphs/{g} (both now
   *  carried there), never a second fetch, never raw JSON (grouped per node in the template). */
  edges: CGraphEdgeView[] = [];
  targets: TargetDefinitionView[] = [];

  private sub: Subscription | null = null;

  constructor(private http: HttpClient, private polariService: PolariService) {
    super();
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.mode = this.boundClassName === 'HardwareSubgraph' ? 'subgraph' : 'atom';
    this.load();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  get ref(): string {
    const v = this.boundObjectFieldValues || {};
    return String((this.mode === 'subgraph' ? v['cgraph'] : v['atom']) || '');
  }

  get title(): string {
    if (this.mode === 'subgraph') {
      return this.ref || 'Hardware Subgraph';
    }
    return this.atom?.function || this.ref.split('.').pop() || 'C Atom';
  }

  get summary(): string {
    if (this.mode === 'subgraph') {
      return this.graph ? `${this.graph.node_count} nodes · ${this.graph.atom_count} atoms · ${this.graph.edge_count} edges` : '';
    }
    return this.atom ? `${this.ports.length} ports · ${this.atom.text_bytes_noinline} B as a node` : '';
  }

  load(): void {
    const ref = this.ref;
    this.error = '';
    if (!ref) {
      this.error = this.mode === 'subgraph' ? 'No CGraph named yet' : 'No atom named yet';
      return;
    }
    const base = this.polariService.getBackendBaseUrl();
    const url = this.mode === 'subgraph'
      ? `${base}/api/cmod/graphs/${encodeURIComponent(ref)}`
      : `${base}/api/cmod/atoms/${encodeURIComponent(ref)}`;
    this.loading = true;
    this.sub?.unsubscribe();
    this.sub = this.http.get<any>(url, { headers: (this.polariService.backendRequestOptions as any)?.headers }).subscribe({
      next: (r: any) => {
        this.loading = false;
        if (this.mode === 'subgraph') {
          this.graph = r?.graph || null;
          this.nodes = [...(r?.nodes || [])].sort((a: CGraphNodeView, b: CGraphNodeView) => (a.order || 0) - (b.order || 0));
          this.edges = r?.edges || [];
          this.targets = r?.targets || [];
        } else {
          this.atom = r?.atom || null;
          this.ports = r?.ports || [];
        }
      },
      error: (e: any) => {
        this.loading = false;
        this.error = e?.error?.error || e?.error?.refused || `could not read ${ref}`;
      },
    });
  }

  toggleExpanded(event?: MouseEvent): void {
    event?.stopPropagation();
    this.expanded = !this.expanded;
  }

  /** The atom (or graph) name edited inline — persisted like every overlay field, then re-read. */
  onRefChange(value: string): void {
    const key = this.mode === 'subgraph' ? 'cgraph' : 'atom';
    this.boundObjectFieldValues = { ...(this.boundObjectFieldValues || {}), [key]: value };
    this.fieldValuesChanged.emit({ [key]: value });
    this.load();
  }

  atomFunction(atom: string): string {
    return (atom || '').split('.').pop() || '';
  }

  /** demo-4: every TargetDefinition derived for one node — badges under its row when the subgraph is expanded. */
  targetsFor(instance: string): TargetDefinitionView[] {
    return this.targets.filter(t => t.node === instance);
  }

  /** demo-4: every wire touching one node (either end) — shown alongside its ports when expanded. */
  edgesFor(instance: string): CGraphEdgeView[] {
    return this.edges.filter(e => e.from_node === instance || e.to_node === instance);
  }
}
