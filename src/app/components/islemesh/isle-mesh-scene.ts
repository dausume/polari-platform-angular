/**
 * Deterministic scene layout for the isle graph (mac-1).
 *
 * Force layouts fought us (clusters too tight, devices too far,
 * spawn-corner bugs) — so, like topology-graph-layout, the scene
 * is BUILT, not simulated: every device is a BOX containing its
 * proxy / router / apps (containment = location, Dustin
 * 2026-08-07), boxes ring the L2 segment hub, and serves-edges
 * are bundled per proxy→app pair with their URL labels stacked so
 * they never overlap.
 */

export interface SceneNode {
  id: string;
  kind: string;
  label: string;
  device: string;
  is_mock: boolean;
  [key: string]: unknown;
}

export interface SceneLink {
  source: string;
  target: string;
  kind: string;
  label: string;
  protocol?: string;
  upstream?: string;
  fragment?: string;
  is_mock: boolean;
}

export interface PlacedNode {
  node: SceneNode;
  x: number;   // absolute scene coords
  y: number;
  r: number;
}

export interface DeviceBox {
  device: string;
  node: SceneNode | null;   // the device node itself (title bar)
  x: number;
  y: number;
  w: number;
  h: number;
  is_mock: boolean;
  members: PlacedNode[];
}

export interface ServesBundle {
  from: PlacedNode;
  to: PlacedNode;
  sameBox: boolean;
  is_mock: boolean;
  urls: Array<{ label: string; protocol?: string;
    upstream?: string; fragment?: string; is_mock: boolean }>;
}

export interface L2Edge {
  from: DeviceBox;
  label: string;
  is_mock: boolean;
}

export interface Scene {
  boxes: DeviceBox[];
  floats: PlacedNode[];
  segment: { x: number; y: number; node: SceneNode } | null;
  serves: ServesBundle[];
  l2: L2Edge[];
  bbox: { x: number; y: number; w: number; h: number };
}

const CELL_W = 96;
const CELL_H = 66;
const TITLE_H = 30;
const PAD = 16;
const INNER_R: Record<string, number> = {
  proxy: 15, router: 15, app: 16,
};

export function buildScene(nodes: SceneNode[],
                           links: SceneLink[]): Scene {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const deviceNodes = nodes.filter((n) => n.kind === 'device');
  const segmentNode = nodes.find((n) => n.kind === 'segment')
    || null;

  // ---- boxes: one per device, members laid out on a small grid
  const boxes: DeviceBox[] = deviceNodes.map((dev) => {
    const members = nodes.filter((n) =>
      n.kind !== 'device' && n.kind !== 'segment'
      && n.device === dev.device);
    // row 0: infrastructure (proxy, router); rows 1+: apps, 3/row
    const infra = members.filter((m) => m.kind !== 'app');
    const apps = members.filter((m) => m.kind === 'app');
    const rows: SceneNode[][] = [];
    if (infra.length) { rows.push(infra); }
    for (let i = 0; i < apps.length; i += 3) {
      rows.push(apps.slice(i, i + 3));
    }
    const maxRow = Math.max(1, ...rows.map((r) => r.length));
    const w = Math.max(170, maxRow * CELL_W + PAD * 2);
    const h = TITLE_H + PAD
      + Math.max(1, rows.length) * CELL_H + PAD / 2;
    const placed: PlacedNode[] = [];
    rows.forEach((row, ri) => {
      const rowW = row.length * CELL_W;
      row.forEach((m, ci) => {
        placed.push({
          node: m,
          x: (w - rowW) / 2 + ci * CELL_W + CELL_W / 2,
          y: TITLE_H + PAD + ri * CELL_H + CELL_H / 2 - 8,
          r: INNER_R[m.kind] || 15,
        });
      });
    });
    return { device: dev.device, node: dev, x: 0, y: 0, w, h,
      is_mock: dev.is_mock, members: placed };
  });

  // ---- ring the boxes around the hub; radius from box sizes so
  // neighbors never collide but nothing drifts unnecessarily far.
  const circumference = boxes.reduce(
    (sum, b) => sum + Math.max(b.w, b.h) + 70, 0);
  const radius = Math.max(240, circumference / (2 * Math.PI));
  boxes.forEach((b, i) => {
    const angle = (2 * Math.PI * i) / Math.max(1, boxes.length)
      - Math.PI / 2;
    b.x = radius * Math.cos(angle) - b.w / 2;
    b.y = radius * Math.sin(angle) - b.h / 2;
    // shift members to absolute coords
    b.members.forEach((m) => { m.x += b.x; m.y += b.y; });
  });

  // ---- floats: nodes with no device box (implied apps)
  const boxedDevices = new Set(boxes.map((b) => b.device));
  const floats: PlacedNode[] = nodes
    .filter((n) => n.kind !== 'device' && n.kind !== 'segment'
      && !boxedDevices.has(n.device))
    .map((n, i) => ({
      node: n,
      x: (i - 0.5) * 120,
      y: radius + 140,
      r: INNER_R[n.kind] || 15,
    }));

  const segment = segmentNode
    ? { x: 0, y: 0, node: segmentNode } : null;

  // ---- resolve a node id to its placed position
  const placedById = new Map<string, PlacedNode>();
  boxes.forEach((b) => b.members.forEach(
    (m) => placedById.set(m.node.id, m)));
  floats.forEach((f) => placedById.set(f.node.id, f));

  // ---- serves edges, BUNDLED per (source,target) so parallel
  // permits become one edge with stacked URL labels.
  const bundles = new Map<string, ServesBundle>();
  const boxOf = new Map<string, string>();
  boxes.forEach((b) => b.members.forEach(
    (m) => boxOf.set(m.node.id, b.device)));
  for (const link of links) {
    if (link.kind !== 'serves') { continue; }
    const from = placedById.get(link.source);
    const to = placedById.get(link.target);
    if (!from || !to) { continue; }
    const key = `${link.source}→${link.target}`;
    let bundle = bundles.get(key);
    if (!bundle) {
      bundle = {
        from, to,
        sameBox: boxOf.get(link.source) === boxOf.get(link.target),
        is_mock: link.is_mock,
        urls: [],
      };
      bundles.set(key, bundle);
    }
    bundle.is_mock = bundle.is_mock && link.is_mock;
    bundle.urls.push({ label: link.label,
      protocol: link.protocol, upstream: link.upstream,
      fragment: link.fragment, is_mock: link.is_mock });
  }
  const serves = [...bundles.values()];
  serves.forEach((b) => b.urls.sort(
    (a, u) => a.label.localeCompare(u.label)));

  // ---- l2 edges: device box → segment hub, labeled w/ interface
  const l2: L2Edge[] = [];
  for (const link of links) {
    if (link.kind !== 'l2') { continue; }
    const dev = byId.get(link.source);
    const box = boxes.find((b) => b.device === dev?.device);
    if (box) {
      l2.push({ from: box, label: link.label,
        is_mock: link.is_mock });
    }
  }

  // ---- bbox for fit-to-view (labels get margin)
  let minX = -60, minY = -60, maxX = 60, maxY = 60;
  boxes.forEach((b) => {
    minX = Math.min(minX, b.x - 30);
    minY = Math.min(minY, b.y - 30);
    maxX = Math.max(maxX, b.x + b.w + 30);
    maxY = Math.max(maxY, b.y + b.h + 60);
  });
  floats.forEach((f) => {
    minX = Math.min(minX, f.x - 80);
    maxX = Math.max(maxX, f.x + 80);
    maxY = Math.max(maxY, f.y + 60);
  });

  return { boxes, floats, segment, serves, l2,
    bbox: { x: minX, y: minY, w: maxX - minX, h: maxY - minY } };
}
