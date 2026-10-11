/**
 * ucd-hdr4 — the Purpose / Atom dropdown model (c-purpose-nav.ts), standalone and pure: the purpose subset, the Atom
 * options per Purpose, the URL round-trip values, the deep-link presets, the red advice count that excludes glue kinds.
 */
import {
  purposeSubset, atomOptions, atomsWithoutPurpose, presetPurpose, purposeOptionLabel, purposeSummary, CPurposeRow, CNavNode,
} from './c-purpose-nav';

const n = (instance: string, kind = 'c-atom'): CNavNode => ({ instance, kind });
const nodes: CNavNode[] = [
  n('usart_init'), n('rx_pop'), n('apply'), n('led'), n('adc'), n('orphan'), n('frame', 'frame'), n('state', 'class'),
];
const purposes: CPurposeRow[] = [
  { name: 'blink-on-command', title: 'Blink the LED on command', task_names: ['rx_pop', 'apply', 'led'] },
  { name: 'temp-sensor-to-os', title: 'Temperature', task_names: ['adc', 'led', 'frame'] },
];

describe('c-purpose-nav — Purpose subset', () => {
  it('"All purposes" ("") draws everything (null)', () => expect(purposeSubset(purposes, '')).toBeNull());
  it('a Purpose draws only its own atoms', () => {
    expect(Array.from(purposeSubset(purposes, 'blink-on-command')!).sort()).toEqual(['apply', 'led', 'rx_pop']);
  });
  it('an unknown Purpose degrades to everything', () => expect(purposeSubset(purposes, 'nope')).toBeNull());
});

describe('c-purpose-nav — Atom options per Purpose', () => {
  it('All: every real atom, glue kinds excluded', () => {
    expect(atomOptions(nodes, purposes, '')).toEqual(['usart_init', 'rx_pop', 'apply', 'led', 'adc', 'orphan']);
  });
  it('a Purpose: only its real atoms, in graph order', () => {
    expect(atomOptions(nodes, purposes, 'blink-on-command')).toEqual(['rx_pop', 'apply', 'led']);
  });
  it('a Purpose naming a glue node does not offer it as an atom', () => {
    expect(atomOptions(nodes, purposes, 'temp-sensor-to-os')).toEqual(['led', 'adc']);
  });
  it('an atom in two Purposes appears under both', () => {
    expect(atomOptions(nodes, purposes, 'blink-on-command')).toContain('led');
    expect(atomOptions(nodes, purposes, 'temp-sensor-to-os')).toContain('led');
  });
});

describe('c-purpose-nav — deep-link presets and URL round-trip', () => {
  it('a Composed-by link (node only) lands on the first Purpose naming the atom', () => {
    expect(presetPurpose(purposes, null, 'led')).toBe('blink-on-command');
    expect(presetPurpose(purposes, null, 'adc')).toBe('temp-sensor-to-os');
  });
  it('an atom no Purpose names lands on All purposes', () => expect(presetPurpose(purposes, null, 'orphan')).toBe(''));
  it('no node and no purpose= lands on All purposes', () => expect(presetPurpose(purposes, null, '')).toBe(''));
  it('an explicit ?purpose= that exists wins over the first-naming rule (round-trip)', () => {
    expect(presetPurpose(purposes, 'temp-sensor-to-os', 'led')).toBe('temp-sensor-to-os');
  });
  it('an explicit ?purpose= that does not exist is ignored', () => {
    expect(presetPurpose(purposes, 'gone', 'led')).toBe('blink-on-command');
  });
});

describe('c-purpose-nav — the red advice (never blocking)', () => {
  it('counts only real atoms no Purpose names — glue kinds are not counted', () => {
    expect(atomsWithoutPurpose(nodes, purposes)).toEqual(['usart_init', 'orphan']);
  });
  it('the summary line says "N atoms without a Purpose" and omits it at zero', () => {
    expect(purposeSummary(3, 8, 'blink-on-command', 2)).toBe('Purpose blink-on-command · 3 of 8 atoms · 2 atoms without a Purpose');
    expect(purposeSummary(8, 8, '', 0)).toBe('All purposes · 8 of 8 atoms');
    expect(purposeSummary(8, 8, '', 1)).toContain('1 atom without a Purpose');
  });
  it('a Purpose over a graph with no Firmware Solution is flagged in its option text', () => {
    expect(purposeOptionLabel(purposes[0], false)).toBe('blink-on-command (no firmware solution)');
    expect(purposeOptionLabel(purposes[0], true)).toBe('blink-on-command');
  });
});
