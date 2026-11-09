import { PlannedAction, doorFor, isRunnable, argsFor } from './planned-actions';

const mk = (o: Partial<PlannedAction>): PlannedAction => ({
  kind: 'isle.storage.authorize', id: 'a1', device: 'core', dataset: 'tank/x', planId: 'p', revision: 3, itemId: 'i', digest: 'd',
  dependsOn: [], status: 'planned', statusWords: '', placementState: null, epoch: null, execute: null, operatorCommand: null, undo: null, chain: [], ...o,
});

describe('planned-actions', () => {
  it('doorFor maps storage kinds and rejects others', () => {
    expect(doorFor('isle.storage.authorize')).toBe('storage.authorize');
    expect(doorFor('isle.storage.migrate')).toBe('storage.migrate');
    expect(doorFor('isle.storage.cutover')).toBe('storage.cutover');
    expect(doorFor('polari.topology.retire-example')).toBeNull();
    expect(doorFor('isle.storage.witness')).toBeNull();
    expect(doorFor('toString')).toBeNull();
  });
  it('isRunnable refusals and ok case', () => {
    const a = mk({});
    expect(isRunnable(mk({ kind: 'isle.storage.witness' }), [], 'core', true).ok).toBeFalse();
    expect(isRunnable(a, [a], 'core', false).reason).toContain('shell');
    expect(isRunnable(a, [a], null, true).reason).toBe('device unknown');
    expect(isRunnable(a, [a], 'other', true).reason).toBe('run on core');
    const m = mk({ kind: 'isle.storage.migrate', id: 'm1', device: 'econ', dependsOn: ['a1'] });
    expect(isRunnable(m, [a, m], 'econ', true).reason).toBe('waiting for authorize');
    expect(isRunnable(mk({ status: 'running' }), [], 'core', true).ok).toBeFalse();
    expect(isRunnable(mk({ status: 'succeeded' }), [], 'core', true).ok).toBeFalse();
    const done = mk({ status: 'succeeded' });
    expect(isRunnable(m, [done, m], 'econ', true)).toEqual({ ok: true, reason: '' });
  });
  it('argsFor builds payloads; cutover requires generation', () => {
    expect(argsFor(mk({}))).toEqual({ dataset: 'tank/x', planId: 'p', revision: 3, itemId: 'i', digest: 'd' });
    const c = mk({ kind: 'isle.storage.cutover' });
    expect(() => argsFor(c)).toThrow();
    expect(argsFor(c, 7)).toEqual({ dataset: 'tank/x', generation: 7 });
  });
});
