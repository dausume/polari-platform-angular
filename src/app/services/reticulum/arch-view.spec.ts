import {
  demandPercent,
  deviceKindLabel,
  directionBadge,
  formatBps,
  formatBytesPerMin,
  freshnessLabel,
  offersTransmit,
  verdictTone,
} from './arch-view';

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
