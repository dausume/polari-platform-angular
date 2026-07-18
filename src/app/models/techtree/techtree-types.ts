/**
 * @cross-cutting
 * @tags @xc:bindings
 * @consumers
 *   - services/techtree/techtree.service.ts
 *   - components/techtree/tech-tree-home.component.ts,
 *     tech-tree-view.component.ts
 * @impact-on-edit
 *   Mirror of the /api/techtree payload shapes (tt-3) — add new
 *   response shapes here, not in the service.
 * @see /OVERLAP_MAP.md
 *
 * Tech-tree-as-data shapes (tt-4): trees, technology nodes with
 * derived theory/real/business/politics segments, dependency edges
 * with transient/primary designation, completion rollups, and
 * evidence-bearing gaps.
 */

export type SegmentKind = 'theory' | 'real' | 'business' | 'politics';

export interface TechTreeListEntry {
  name: string;
  /** Domain display title, e.g. 'Electronics / Microelectronics'. */
  title: string;
  owner: string;
  isActive: boolean;
  isBaseline: boolean;
  description: string;
}

export interface TechTreeSummary {
  ok: boolean;
  activeTree: string;
  trees: TechTreeListEntry[];
  counts: Record<string, number>;
}

/** One assignment's done-test result — evidence-bearing, the knob
 *  and action name exactly what closes the gap. */
export interface SegmentAssignmentReport {
  name: string;
  refName: string;
  segmentKind: SegmentKind;
  done: boolean;
  evidence: string;
  knob: string;
  action: string;
}

export interface TechSegmentReport {
  kind: SegmentKind;
  color: string;
  weight: number;
  assignments: SegmentAssignmentReport[];
  done: number;
  total: number;
  completion: number;
}

export interface TechGap {
  severity: string;
  check: string;
  subject: string;
  evidence: string;
  knob: string;
  action: string;
}

export interface TechNodeReport {
  name: string;
  title: string;
  description: string;
  dependsOn: string[];
  layoutHints: Record<string, unknown>;
  segmentsPresent: SegmentKind[];
  segments: TechSegmentReport[];
  completionLevel: number;
  gaps: TechGap[];
}

export interface TechEdgeReport {
  name: string;
  techNode: string;
  dependsOnTech: string;
  isPrimary: boolean;
  isTransient: boolean;
}

export interface TechTreeMeta {
  name: string;
  title: string;
  owner: string;
  isBaseline: boolean;
  completionLevel: number;
  baselineAchieved: boolean;
}

/** tt-8: the OSEB rollup across baseline DOMAIN trees
 *  (GET /api/techtree/baseline) — reaching the end of ALL of them,
 *  combined, is the Open Source Economic Baseline. */
export interface BaselineTreeReport {
  name: string;
  title: string;
  owner: string;
  completionLevel: number;
  baselineAchieved: boolean;
  nodeCount: number;
  gapCount: number;
}

export interface BaselineReport {
  ok: boolean;
  error?: string;
  trees: BaselineTreeReport[];
  completionLevel: number;
  baselineAchieved: boolean;
  note: string;
}

export interface TechTreePayload {
  ok: boolean;
  error?: string;
  tree: TechTreeMeta;
  segmentColors: Record<SegmentKind, string>;
  nodes: TechNodeReport[];
  edges: TechEdgeReport[];
  gaps: TechGap[];
}

export interface TechTreeValidateReport {
  ok: boolean;
  error?: string;
  tree: string;
  valid: boolean;
  findings: TechGap[];
  errorCount: number;
  warnCount: number;
}
