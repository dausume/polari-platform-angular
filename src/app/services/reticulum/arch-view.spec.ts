import {
  agoLabel,
  demandPercent,
  deviceKindLabel,
  directionBadge,
  formatBps,
  formatBytesPerMin,
  formatMeters,
  freshnessLabel,
  heardViaList,
  km2ToM2,
  offersTransmit,
  plannerVerdictTone,
  rangeFidelityLabel,
  truncateHash,
  verdictTone,
} from './arch-view';
import { normalizePlan } from './meshsim.service';

/** ret-1b: the .arch view's honesty rules, pinned without a DOM
 *  (the meeting-xr spec idiom). */
describe('arch-view pure rules', () => {
  it('maps verdict states to tones, with unknown loud enough to read as a question', () => {
    expect(verdictTone('fits')).toBe('tone-ok');
    expect(verdictTone('oversubscribed')).toBe('tone-error');
    expect(verdictTone('idle')).toBe('tone-quiet');
    expect(verdictTone('unknown')).toBe('tone-unknown');
    expect(verdictTone(undefined)).toBe('tone-unknown');
  });

  it('never draws a demand bar against an unknown capacity', () => {
    expect(demandPercent(500, null)).toBeNull();
    expect(demandPercent(500, undefined)).toBeNull();
    expect(demandPercent(500, 0)).toBeNull();
  });

  it('computes and clamps the demand percentage', () => {
    expect(demandPercent(500, 1000)).toBe(50);
    expect(demandPercent(2000, 1000)).toBe(100);   // clamped; overflow is said in text
    expect(demandPercent(null, 1000)).toBe(0);
  });

  it('renders absent numbers as a dash, never zero', () => {
    expect(formatBytesPerMin(null)).toBe('—');
    expect(formatBytesPerMin(undefined)).toBe('—');
    expect(formatBps(null)).toBe('—');
  });

  it('humanizes byte and bit rates', () => {
    expect(formatBytesPerMin(1200)).toBe('1.2 kB/min');
    expect(formatBytesPerMin(200)).toBe('200 B/min');
    expect(formatBps(62500)).toBe('62.5 kbps');
    expect(formatBps(950)).toBe('950 bps');
  });

  it('labels device kinds, with amateur domain winning over bearer', () => {
    expect(deviceKindLabel('rnode-lora', 'ism')).toBe('LoRa');
    expect(deviceKindLabel('rnode-lora', 'amateur')).toBe('HAM');
    expect(deviceKindLabel('wifi-halow', 'none')).toBe('HaLow');
    expect(deviceKindLabel(undefined, undefined)).toBe('unknown');
  });

  it('a device that cannot transmit never earns a TX affordance', () => {
    expect(offersTransmit('rx')).toBeFalse();
    expect(offersTransmit('both')).toBeTrue();
    expect(directionBadge('rx')).toBe('RX only');
    expect(directionBadge(undefined)).toBe('direction unknown');
  });

  it('stale measurements say their age; absent ones say never', () => {
    expect(freshnessLabel(true, 100, 200)).toBe('fresh');
    expect(freshnessLabel(false, 0, 200)).toBe('never measured');
    expect(freshnessLabel(false, 0, 200)).not.toContain('min ago');
    expect(freshnessLabel(false, 1_000_000, 1_720_000)).toBe('measured 12 min ago — stale');
  });
});

/** ret-1d/ret-1e: the peers + planner panels' honesty rules. */
describe('peers + planner view rules', () => {
  it('truncates hashes for chips but never renders empty as text', () => {
    expect(truncateHash('2fe7c84c227721d6d615e22934c00c26'))
      .toBe('2fe7c84c22…');
    expect(truncateHash('abc')).toBe('abc');
    expect(truncateHash(undefined)).toBe('—');
  });

  it('sighting ages: zero/missing is never, not now', () => {
    expect(agoLabel(0, 1000)).toBe('never');
    expect(agoLabel(undefined, 1000)).toBe('never');
    expect(agoLabel(1000, 20_000)).toBe('just now');
    expect(agoLabel(1_000_000, 1_180_000)).toBe('3 min ago');
    expect(agoLabel(0o0, 7_200_000)).toBe('never');
    expect(agoLabel(1, 7_200_001)).toBe('2 h ago');
  });

  it('heard-via handles both row and live spellings', () => {
    expect(heardViaList({ heard_via: 'LoRa Serial,TCP Server' }))
      .toEqual(['LoRa Serial', 'TCP Server']);
    expect(heardViaList({ interface: 'LoRa Serial' }))
      .toEqual(['LoRa Serial']);
    expect(heardViaList({})).toEqual([]);
  });

  it('planner verdict tones: absent relay reads as unknown, not calm', () => {
    expect(plannerVerdictTone(true)).toBe('tone-ok');
    expect(plannerVerdictTone(false)).toBe('tone-error');
    expect(plannerVerdictTone(undefined)).toBe('tone-unknown');
  });

  it('range fidelity badges spell out the flat-terrain assumption', () => {
    expect(rangeFidelityLabel('declared')).toBe('vendor-declared');
    expect(rangeFidelityLabel('derived-flat'))
      .toContain('flat-terrain');
    expect(rangeFidelityLabel('unknown')).toContain('not guessed');
  });

  it('meters humanize and absent stays a dash', () => {
    expect(formatMeters(850)).toBe('850 m');
    expect(formatMeters(12_400)).toBe('12.4 km');
    expect(formatMeters(null)).toBe('—');
  });

  it('km² converts to m² and refuses negatives', () => {
    expect(km2ToM2(3)).toBe(3_000_000);
    expect(km2ToM2(-1)).toBe(0);
    expect(km2ToM2(null)).toBe(0);
  });

  it('normalizePlan flattens the nested range shape and keeps flat ones', () => {
    const nested = normalizePlan({
      ok: true,
      perBearer: {
        'rnode-lora': {
          range: { rangeM: 1000, fidelity: 'declared' },
        } as never,
      },
    });
    expect(nested?.perBearer?.['rnode-lora'].rangeM).toBe(1000);
    expect(nested?.perBearer?.['rnode-lora'].rangeFidelity)
      .toBe('declared');
    const flat = normalizePlan({
      ok: true,
      perBearer: { wifi: { rangeM: 50, rangeFidelity: 'measured' } },
    });
    expect(flat?.perBearer?.['wifi'].rangeM).toBe(50);
    expect(normalizePlan(null)).toBeNull();
  });
});
