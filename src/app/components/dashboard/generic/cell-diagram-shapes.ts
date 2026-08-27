/**
 * fp-5 — shared types + pure helpers for cell-logic-diagram and
 * cell-schematic (GET /api/cntfet/cell/{cell}/logic contract).
 * No Angular here: gate symbol paths, DAG evaluation, switch-level
 * conduction over the transistor netlist, and the d3-zoom hookup.
 */
import * as d3 from 'd3';

export type Bit = 0 | 1;
export type Vector = Record<string, Bit>;
export type GateKind = 'AND' | 'OR' | 'NOT' | 'NAND' | 'NOR' | 'XOR' | 'BUF';

export interface GateNode {
  id: string;
  kind: 'input' | 'output' | 'gate';
  gate?: GateKind;
  label: string;
  inputs: string[];
  level: number;
}
export interface GateDag { nodes: GateNode[]; edges: Array<{ from: string; to: string }>; }

export interface TruthTable {
  inputs: string[];
  rows: Array<{ vector: Vector; output: Bit }>;
  count: number;
}

export interface NetlistNet { id: string; kind: 'vdd' | 'gnd' | 'input' | 'output' | 'internal'; }
export interface NetlistDevice {
  id: string; type: 'n' | 'p';
  drain: string; gate: string; source: string;
  x_hint?: number; y_hint?: number;
}
export interface Netlist {
  nets: NetlistNet[];
  devices: NetlistDevice[];
  composed?: Array<{ sub_cell: string; instance: string; ports: Record<string, string> }>;
  fet_count?: number;
}

export interface Proof {
  proven: boolean;
  vectors?: number;
  mismatches?: Array<{ vector: Vector; boolean: Bit; switch: Bit | null }>;
  contention?: any[];
  floating?: any[];
  note?: string;
}

export interface LogicStep {
  index: number;
  vector: Vector;
  output: Bit | null;
  conducting?: string[];
  stages?: Array<{ sub_cell: string; instance: string; inputs: Vector; output: Bit }>;
}
export interface CombinationalSpace { kind: 'combinational'; steps: LogicStep[]; }
export interface SequentialSpace {
  kind: 'sequential';
  states: string[];
  transitions: Array<{ from: string; input: Record<string, any>; to: string }>;
  description?: string;
  latchNodes?: string[];
}

export interface CellLogicPayload {
  ok: boolean;
  cell: string;
  drive: number;
  function?: string;
  inputs: string[];
  output: string;
  gateDag?: GateDag;
  truthTable?: TruthTable;
  netlist?: Netlist;
  proof?: Proof;
  stateSpace?: CombinationalSpace | SequentialSpace;
  fetCount?: number;
  honesty?: string;
  error?: string;
}

// ---- Gate symbols --------------------------------------------------------
// Each path is drawn in a local box (0,0)-(w,h); the body's output is at
// (w, h/2) and its inputs enter from x=0. Bubbles are added separately.

export function gateBodyPath(gate: GateKind, w: number, h: number): string {
  const mid = h / 2;
  switch (gate) {
    case 'AND': case 'NAND':
      return `M0,0 H${w * 0.5} A${w * 0.5},${mid} 0 0 1 ${w * 0.5},${h} H0 Z`;
    case 'OR': case 'NOR':
      return `M0,0 Q${w * 0.55},0 ${w},${mid} Q${w * 0.55},${h} 0,${h} Q${w * 0.25},${mid} 0,0 Z`;
    case 'XOR':
      return `M${w * 0.12},0 Q${w * 0.62},0 ${w},${mid} Q${w * 0.62},${h} ${w * 0.12},${h} Q${w * 0.37},${mid} ${w * 0.12},0 Z`;
    case 'NOT': case 'BUF':
      return `M0,0 L${w},${mid} L0,${h} Z`;
  }
}

/** XOR's detached second arc, drawn beside the body. */
export function xorExtraArc(w: number, h: number): string {
  return `M0,0 Q${w * 0.25},${h / 2} 0,${h}`;
}

export function gateHasBubble(gate: GateKind): boolean {
  return gate === 'NAND' || gate === 'NOR' || gate === 'NOT';
}

// ---- Boolean evaluation ----------------------------------------------------

export function evalGate(gate: GateKind, ins: Bit[]): Bit {
  const all = ins.every(b => b === 1);
  const any = ins.some(b => b === 1);
  switch (gate) {
    case 'AND': return all ? 1 : 0;
    case 'NAND': return all ? 0 : 1;
    case 'OR': return any ? 1 : 0;
    case 'NOR': return any ? 0 : 1;
    case 'XOR': return (ins.filter(b => b === 1).length % 2) as Bit;
    case 'NOT': return ins[0] === 1 ? 0 : 1;
    case 'BUF': return ins[0] === 1 ? 1 : 0;
  }
}

/** Value of every DAG node for one input vector (inputs by label). */
export function evalDag(dag: GateDag, vector: Vector): Record<string, Bit> {
  const byId = new Map(dag.nodes.map(n => [n.id, n]));
  const memo: Record<string, Bit> = {};
  const visit = (id: string, depth = 0): Bit => {
    if (id in memo) { return memo[id]; }
    const n = byId.get(id);
    if (!n || depth > 64) { return 0; }
    let v: Bit;
    if (n.kind === 'input') {
      v = (vector[n.label] ?? vector[n.id] ?? 0) === 1 ? 1 : 0;
    } else if (n.kind === 'gate' && n.gate) {
      v = evalGate(n.gate, n.inputs.map(i => visit(i, depth + 1)));
    } else {
      v = n.inputs.length ? visit(n.inputs[0], depth + 1) : 0;
    }
    memo[id] = v;
    return v;
  };
  for (const n of dag.nodes) { visit(n.id); }
  return memo;
}

export function sameVector(a: Vector | undefined, b: Vector | undefined): boolean {
  if (!a || !b) { return false; }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) { if ((a[k] ?? 0) !== (b[k] ?? 0)) { return false; } }
  return true;
}

// ---- Switch-level conduction ----------------------------------------------

export interface Conduction {
  conductingDevices: Set<string>;
  /** nets reachable from VDD / GND through conducting channels */
  vddNets: Set<string>;
  gndNets: Set<string>;
  output: Bit | null;   // null = floating or contention
  contention: boolean;
}

/** n conducts when gate=1, p when gate=0; gate nets may be inputs or internals. */
export function evalNetlist(netlist: Netlist, vector: Vector, outputNet: string): Conduction {
  const kindOf = new Map(netlist.nets.map(n => [n.id, n.kind]));
  const value: Record<string, Bit | null> = {};
  for (const n of netlist.nets) {
    value[n.id] = n.kind === 'vdd' ? 1 : n.kind === 'gnd' ? 0
      : n.kind === 'input' ? ((vector[n.id] ?? 0) === 1 ? 1 : 0) : null;
  }
  const conducting = new Set<string>();
  const vddNets = new Set<string>();
  const gndNets = new Set<string>();
  // Iterate to a fixed point so composed cells (internal gate nets) settle.
  for (let iter = 0; iter < 8; iter++) {
    conducting.clear(); vddNets.clear(); gndNets.clear();
    for (const d of netlist.devices) {
      const g = value[d.gate];
      if (g === null || g === undefined) { continue; }
      if ((d.type === 'n' && g === 1) || (d.type === 'p' && g === 0)) { conducting.add(d.id); }
    }
    const flood = (seedKind: 'vdd' | 'gnd', into: Set<string>) => {
      const stack = netlist.nets.filter(n => n.kind === seedKind).map(n => n.id);
      while (stack.length) {
        const net = stack.pop()!;
        if (into.has(net)) { continue; }
        into.add(net);
        for (const d of netlist.devices) {
          if (!conducting.has(d.id)) { continue; }
          if (d.drain === net && !into.has(d.source)) { stack.push(d.source); }
          if (d.source === net && !into.has(d.drain)) { stack.push(d.drain); }
        }
      }
    };
    flood('vdd', vddNets); flood('gnd', gndNets);
    let changed = false;
    for (const n of netlist.nets) {
      if (kindOf.get(n.id) === 'vdd' || kindOf.get(n.id) === 'gnd' || kindOf.get(n.id) === 'input') { continue; }
      const v: Bit | null = vddNets.has(n.id) && !gndNets.has(n.id) ? 1
        : gndNets.has(n.id) && !vddNets.has(n.id) ? 0 : null;
      if (value[n.id] !== v) { value[n.id] = v; changed = true; }
    }
    if (!changed) { break; }
  }
  const contention = vddNets.has(outputNet) && gndNets.has(outputNet);
  return { conductingDevices: conducting, vddNets, gndNets,
           output: contention ? null : value[outputNet] ?? null, contention };
}

// ---- d3 zoom ---------------------------------------------------------------

/** Pan/zoom the <g> inside an <svg>; returns the behaviour for resets. */
export function attachZoom(svgEl: SVGSVGElement, gEl: SVGGElement) {
  const g = d3.select(gEl);
  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.3, 4])
    .on('zoom', (ev) => g.attr('transform', ev.transform.toString()));
  d3.select(svgEl).call(zoom);
  return zoom;
}

export function resetZoom(svgEl: SVGSVGElement,
                          zoom: d3.ZoomBehavior<SVGSVGElement, unknown>): void {
  d3.select(svgEl).transition().duration(200).call(zoom.transform, d3.zoomIdentity);
}
