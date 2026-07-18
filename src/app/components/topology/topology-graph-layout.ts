import * as d3 from 'd3';

import {
  ModuleGraphReport, TopologyGraph, TopologyInstance, TopologyMachine,
} from '@models/topology/topology-types';

/**
 * Pure scene geometry for the revamped topology renderer (tt-2,
 * TECH_TREE_TOPOLOGY_PLAN Part A): modules are CIRCLES nested inside
 * their consumer's circle (depth-capped), instance containers are
 * rectangles sized to their packed module circles, and hosts are the
 * outermost rectangles (host ▸ container ▸ modules). A dependency
 * shared by N>1 consumer modules is SOLID under its designated
 * primary consumer and a DASHED transient copy under the others —
 * the duplicates are intentional.
 *
 * No DOM, no d3 selections — just d3.packSiblings/packEnclose math —
 * so the geometry stays unit-testable and reusable by the tech-tree
 * render mode (tt-4).
 */

export interface ModuleCircle {
  /** Module id ('materialsScience.fem'). */
  module: string;
  /** Center relative to the OWNING instance rectangle. */
  cx: number;
  cy: number;
  r: number;
  /** 0 = assigned top-level module; 1+ = nested dependency copy. */
  depth: number;
  classification: string;
  /** Dashed border — this copy is a transient reference; the solid
   *  primary lives under `primaryConsumer`. */
  transient: boolean;
  primaryConsumer: string;
  /** Assignment state for depth-0 circles ('' when nested). */
  state: string;
  children: ModuleCircle[];
}

export interface InstanceNode {
  id: string;
  instance: TopologyInstance;
  x: number;
  y: number;
  w: number;
  h: number;
  depth: number;
  modules: ModuleCircle[];
}

export interface HostBox {
  name: string;
  machine: TopologyMachine | null;
  x: number;
  y: number;
  w: number;
  h: number;
  instances: InstanceNode[];
}

export interface CirclePoint {
  x: number;
  y: number;
  r: number;
}

export interface Scene {
  hosts: HostBox[];
  nodes: InstanceNode[];
  /** Absolute centers of depth-0 module circles, keyed
   *  `${instanceName}|${moduleName}` — dependency edges anchor here. */
  circleIndex: Map<string, CirclePoint>;
}

/** How many nesting levels are drawn inside a module circle. */
export const NEST_DEPTH_CAP = 2;

const LEAF_R = 16;
const NEST_PAD = 7;
const PACK_GAP = 6;
const HEADER_H = 26;
const TEXT_BLOCK_H = 40;
const RECT_PAD = 14;
const MODULE_LABEL_H = 14;
const MIN_W = 230;
const MIN_H = 112;
const HOST_PAD = 16;
const HOST_LABEL_H = 24;
const HOST_GAP = 56;
const INSTANCE_GAP = 26;
const UNPLACED = 'unplaced';

interface ModuleFacts {
  dependsOn: Map<string, string[]>;
  classification: Map<string, string>;
  /** dependency module -> its designated primary CONSUMER module
   *  ('' when the dependency has a single consumer). */
  primaryConsumer: Map<string, string>;
  sharedDeps: Set<string>;
}

function moduleFacts(moduleGraph: ModuleGraphReport | null): ModuleFacts {
  const facts: ModuleFacts = {
    dependsOn: new Map(),
    classification: new Map(),
    primaryConsumer: new Map(),
    sharedDeps: new Set(),
  };
  if (!moduleGraph?.ok) { return facts; }
  for (const m of moduleGraph.modules) {
    facts.dependsOn.set(m.name, m.dependsOn);
    facts.classification.set(m.name, m.classification);
    if (m.inDegree > 1) { facts.sharedDeps.add(m.name); }
  }
  for (const e of moduleGraph.edges) {
    if (e.isPrimary && facts.sharedDeps.has(e.dependsOnModule)) {
      facts.primaryConsumer.set(e.dependsOnModule, e.moduleName);
    }
  }
  return facts;
}

/** One module circle with its dependencies nested inside (A3),
 *  recursive to NEST_DEPTH_CAP; cycles cut by the visited path. */
function buildCircle(module: string, depth: number, facts: ModuleFacts,
                     state: string, visited: Set<string>,
                     parent = ''): ModuleCircle {
  const shared = facts.sharedDeps.has(module);
  const primary = facts.primaryConsumer.get(module) ?? '';
  const circle: ModuleCircle = {
    module,
    cx: 0, cy: 0, r: LEAF_R,
    depth,
    classification: facts.classification.get(module) ?? 'independent',
    // A nested copy of a shared dependency is transient everywhere
    // except under its designated primary consumer (A4).
    transient: depth > 0 && shared && parent !== primary,
    primaryConsumer: primary,
    state,
    children: [],
  };
  const deps = facts.dependsOn.get(module) ?? [];
  if (depth < NEST_DEPTH_CAP && deps.length) {
    const path = new Set(visited);
    path.add(module);
    circle.children = deps
      .filter(dep => !path.has(dep))
      .map(dep => buildCircle(dep, depth + 1, facts, '', path, module));
    if (circle.children.length) {
      const packed = circle.children.map(
        child => ({ r: child.r + PACK_GAP / 2, child }));
      d3.packSiblings(packed);
      const enclose = d3.packEnclose(
        packed as unknown as Array<{ r: number; x: number; y: number }>);
      for (const p of packed as unknown as
           Array<{ x: number; y: number; child: ModuleCircle }>) {
        p.child.cx = p.x - enclose.x;
        p.child.cy = p.y - enclose.y;
      }
      circle.r = Math.max(LEAF_R, enclose.r + NEST_PAD);
    }
  }
  return circle;
}

/** Pack an instance's top-level module circles and size its
 *  rectangle around them (A1). Positions are rect-relative. */
function packInstance(instance: TopologyInstance, modules:
    Array<{ module: string; state: string }>, facts: ModuleFacts,
    depth: number): InstanceNode {
  const circles = modules.map(
    m => buildCircle(m.module, 0, facts, m.state, new Set()));
  let w = MIN_W;
  let h = MIN_H;
  if (circles.length) {
    const packed = circles.map(
      circle => ({ r: circle.r + PACK_GAP + MODULE_LABEL_H / 2, circle }));
    d3.packSiblings(packed);
    const enclose = d3.packEnclose(
      packed as unknown as Array<{ r: number; x: number; y: number }>);
    w = Math.max(MIN_W, enclose.r * 2 + RECT_PAD * 2);
    h = HEADER_H + TEXT_BLOCK_H + enclose.r * 2 + RECT_PAD * 2;
    const cx0 = w / 2;
    const cy0 = HEADER_H + TEXT_BLOCK_H + RECT_PAD + enclose.r;
    for (const p of packed as unknown as
         Array<{ x: number; y: number; circle: ModuleCircle }>) {
      p.circle.cx = cx0 + (p.x - enclose.x);
      p.circle.cy = cy0 + (p.y - enclose.y);
    }
  }
  return {
    id: instance.name, instance,
    x: 0, y: 0, w, h: Math.max(MIN_H, h), depth,
    modules: circles,
  };
}

/** Longest-path layer per instance over the drawn dependency edges —
 *  the same left→right reading the flat layout had. */
function instanceDepths(graph: TopologyGraph): Map<string, number> {
  const depth = new Map<string, number>(
    graph.instances.map(i => [i.name, 0]));
  for (let pass = 0; pass < graph.instances.length + 1; pass++) {
    let changed = false;
    for (const e of graph.edges) {
      if (!depth.has(e.providerInstanceName)
          || !depth.has(e.consumerInstanceName)) { continue; }
      const d = (depth.get(e.providerInstanceName) ?? 0) + 1;
      if (d > (depth.get(e.consumerInstanceName) ?? 0)) {
        depth.set(e.consumerInstanceName, d);
        changed = true;
      }
    }
    if (!changed) { break; }
  }
  return depth;
}

function indexCircles(scene: Scene): void {
  for (const node of scene.nodes) {
    for (const circle of node.modules) {
      scene.circleIndex.set(`${node.id}|${circle.module}`, {
        x: node.x + circle.cx,
        y: node.y + circle.cy,
        r: circle.r,
      });
    }
  }
}

/**
 * The whole scene: instances packed with module circles, grouped
 * into host rectangles (groupByHost) or laid out in the flat layered
 * columns (the pre-revamp reading, kept as a toggle).
 */
export function buildScene(graph: TopologyGraph,
                           moduleGraph: ModuleGraphReport | null,
                           groupByHost: boolean): Scene {
  const facts = moduleFacts(moduleGraph);
  const depths = instanceDepths(graph);
  const nodes = graph.instances.map(instance => packInstance(
    instance,
    graph.assignments
      .filter(a => a.instanceName === instance.name)
      .map(a => ({ module: a.moduleName, state: a.state })),
    facts,
    depths.get(instance.name) ?? 0));
  const scene: Scene = { hosts: [], nodes, circleIndex: new Map() };

  if (!groupByHost) {
    const columns = new Map<number, InstanceNode[]>();
    for (const n of nodes) {
      if (!columns.has(n.depth)) { columns.set(n.depth, []); }
      columns.get(n.depth)!.push(n);
    }
    let x = 40;
    const sorted = [...columns.entries()].sort((a, b) => a[0] - b[0]);
    const maxH = Math.max(1, ...sorted.map(([, col]) => col.reduce(
      (sum, n) => sum + n.h + INSTANCE_GAP, 0)));
    for (const [, col] of sorted) {
      col.sort((a, b) => a.id.localeCompare(b.id));
      const colH = col.reduce((s, n) => s + n.h + INSTANCE_GAP, 0);
      let y = 40 + (maxH - colH) / 2;
      let colW = 0;
      for (const n of col) {
        n.x = x;
        n.y = y;
        y += n.h + INSTANCE_GAP;
        colW = Math.max(colW, n.w);
      }
      x += colW + 60;
    }
    indexCircles(scene);
    return scene;
  }

  const machines = new Map(graph.machines.map(m => [m.name, m]));
  const byHost = new Map<string, InstanceNode[]>();
  for (const n of nodes) {
    const host = n.instance.machineName || UNPLACED;
    if (!byHost.has(host)) { byHost.set(host, []); }
    byHost.get(host)!.push(n);
  }
  // Hosts ordered by their shallowest instance so providers still
  // read left→right; 'unplaced' sinks to the end.
  const hostNames = [...byHost.keys()].sort((a, b) => {
    if (a === UNPLACED) { return 1; }
    if (b === UNPLACED) { return -1; }
    const da = Math.min(...byHost.get(a)!.map(n => n.depth));
    const db = Math.min(...byHost.get(b)!.map(n => n.depth));
    return da - db || a.localeCompare(b);
  });
  let hostX = 40;
  for (const host of hostNames) {
    const members = byHost.get(host)!;
    members.sort((a, b) => a.depth - b.depth
      || a.id.localeCompare(b.id));
    let y = 40 + HOST_LABEL_H + HOST_PAD;
    let w = 0;
    for (const n of members) {
      n.x = hostX + HOST_PAD;
      n.y = y;
      y += n.h + INSTANCE_GAP;
      w = Math.max(w, n.w);
    }
    for (const n of members) {  // center narrow cards in the host
      n.x += (w - n.w) / 2;
    }
    scene.hosts.push({
      name: host,
      machine: machines.get(host) ?? null,
      x: hostX,
      y: 40,
      w: w + HOST_PAD * 2,
      h: (y - INSTANCE_GAP + HOST_PAD) - 40,
      instances: members,
    });
    hostX += w + HOST_PAD * 2 + HOST_GAP;
  }
  indexCircles(scene);
  return scene;
}
