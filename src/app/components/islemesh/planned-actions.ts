/** Pure helpers for the "Planned actions" list. The App never executes the
 *  backend's `operatorCommand`/`undo` text; it maps `kind` to a fixed door. */
export interface ChainStep { kind: string; device: string; status: string; }

export interface PlannedAction {
  kind: string; id: string; device: string; dataset: string;
  planId: string; revision: number; itemId: string; digest: string;
  dependsOn: string[];
  status: 'planned' | 'blocked' | 'running' | 'succeeded' | 'failed' | 'interrupted';
  statusWords: string;
  placementState: string | null;
  epoch: number | null;
  execute: any;
  operatorCommand: string | null;
  undo: string | null;
  chain: ChainStep[];
}

export const STORAGE_DOORS = {
  'isle.storage.authorize': 'storage.authorize',
  'isle.storage.migrate': 'storage.migrate',
  'isle.storage.cutover': 'storage.cutover',
} as const;

export function doorFor(kind: string): string | null {
  return Object.prototype.hasOwnProperty.call(STORAGE_DOORS, kind) ? (STORAGE_DOORS as Record<string, string>)[kind] : null;
}

export function shortKind(kind: string): string {
  return kind.replace(/^isle\.storage\./, '');
}

export function isRunnable(action: PlannedAction, all: PlannedAction[], currentDevice: string | null, shellAvailable: boolean): { ok: boolean; reason: string } {
  if (!doorFor(action.kind)) return { ok: false, reason: 'no native door for ' + action.kind };
  if (!shellAvailable) return { ok: false, reason: 'native shell not available' };
  if (!currentDevice) return { ok: false, reason: 'device unknown' };
  if (action.device !== currentDevice) return { ok: false, reason: 'run on ' + action.device };
  for (const id of action.dependsOn || []) {
    const dep = all.find(a => a.id === id);
    if (!dep || dep.status !== 'succeeded') return { ok: false, reason: 'waiting for ' + (dep ? shortKind(dep.kind) : id) };
  }
  if (action.status === 'running' || action.status === 'succeeded') return { ok: false, reason: 'already ' + action.status };
  return { ok: true, reason: '' };
}

export function argsFor(action: PlannedAction, generation?: number): Record<string, any> {
  const door = doorFor(action.kind);
  if (door === 'storage.cutover') {
    if (typeof generation !== 'number' || !isFinite(generation)) throw new Error('generation is required for cutover');
    return { dataset: action.dataset, generation };
  }
  if (door) return { dataset: action.dataset, planId: action.planId, revision: action.revision, itemId: action.itemId, digest: action.digest };
  throw new Error('no native door for ' + action.kind);
}
