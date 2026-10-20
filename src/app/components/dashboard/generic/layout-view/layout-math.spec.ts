import { BoardFrame, P, bounds, breadboardRows, headerIndex, headerPins, holeAt, layoutBoards, parseTie, railX, stripKey, stripX, tieAnchor, wirePath } from './layout-geometry';
import { dutyFromEdges, holeInfo, injectBody, mvFor, outputLook, pinLabelFromParam, stepFromParam, stepView } from './layout-interact';
import { BAND_HEX, legPoints, ohmsText, resistorBands, spriteFor } from './layout-sprites';
import { FIXTURE_LAYOUT, FIXTURE_STEPS } from './layout-view.fixture';
import { LvInteraction } from './layout-view.types';

/**
 * lay-2 / sim-3 - the PURE layout math: hole -> x/y on a breadboard and on the UNO's header, board tiling, sprite geometry (resistor bands from the value, the LED's flat side and long leg, the
 * pushbutton across the trench, the TMP36's flat face, the transistor's E-B-C), the overlay -> twin mapping (press levels, TMP36 500 mV + 10 mV/degC, the pot), PWM duty from edges,
 * step visibility, and what a click on a hole answers. The payloads are real layout-door output (layout-view.fixture.ts).
 */
describe('layout geometry', () => {
  const [uno, half] = FIXTURE_LAYOUT.scene.boards;
  const frames: BoardFrame[] = layoutBoards(FIXTURE_LAYOUT.scene.boards);

  it('parses the tie-point grammar: hole, older strip, rail, header label', () => {
    expect(parseTie('r11d')).toEqual({ t: 'hole', row: 11, col: 'd' });
    expect(parseTie('r5L')).toEqual({ t: 'strip', row: 5, side: 'L' });
    expect(parseTie('rail:top:-:12')).toEqual({ t: 'rail', pos: 'top', pol: '-', n: 12 });
    expect(parseTie('D6')).toEqual({ t: 'pin', label: 'D6' });
  });

  it('puts holes on the 2.54 mm grid: one pitch between strips and between columns, a three-pitch trench between e and f', () => {
    const rows = breadboardRows();
    expect(stripX(8) - stripX(7)).toBe(P);
    expect(rows.colY['b'] - rows.colY['a']).toBe(P);
    expect(rows.colY['f'] - rows.colY['e']).toBe(3 * P);
    expect(rows.colY['j'] - rows.colY['f']).toBe(4 * P);
  });

  it('places the rail holes in groups of five with a half-pitch gap, centred on the strips', () => {
    expect(railX(half, 6) - railX(half, 5)).toBe(1.5 * P);
    expect(railX(half, 2) - railX(half, 1)).toBe(P);
    const mid = (railX(half, 1) + railX(half, half.rail_holes)) / 2;
    expect(mid).toBeCloseTo((stripX(1) + stripX(half.rows)) / 2, 5);
  });

  it('tiles the UNO above the breadboard and resolves a hole, a rail hole and a header pin to picture positions', () => {
    expect(frames.map(f => f.board.name)).toEqual(['bench-uno-1', 'bench-half-1']);
    expect(frames[1].y).toBeGreaterThan(frames[0].y + frames[0].h);
    const h = tieAnchor(frames, { board: 'bench-half-1', tie: 'r7a' })!;
    expect(h.x).toBe(frames[1].x + stripX(7));
    expect(h.dir).toBe('up');
    expect(tieAnchor(frames, { board: 'bench-half-1', tie: 'r7j' })!.dir).toBe('down');
    expect(tieAnchor(frames, { board: 'bench-half-1', tie: 'r99a' })).toBeNull();
    const r = tieAnchor(frames, { board: 'bench-half-1', tie: 'rail:top:-:1' })!;
    expect(r.y).toBe(frames[1].y + breadboardRows().railY['top-']);
    const d6 = tieAnchor(frames, { board: 'bench-uno-1', tie: 'D6' })!;
    expect(d6.y).toBeLessThan(frames[0].y + frames[0].h / 2);   // the digital header is on the UNO's top edge
    expect(d6.dir).toBe('down');
  });

  it('orders the UNO header the way the connectors list it: D0 at the right of the top edge, D8 left of the 0.16 in gap, GND resolves to the POWER header (the layout\'s own rule)', () => {
    const pins = headerPins(uno);
    const at = headerIndex(pins);
    expect(at.get('D0')!.x).toBeGreaterThan(at.get('D1')!.x);
    expect(at.get('D7')!.x - at.get('D8')!.x).toBeCloseTo(1.6 * P, 5);
    expect(at.get('GND')!.connector).toBe('POWER');
    expect(at.get('A0')!.y).toBe(at.get('GND')!.y);
    expect(pins.filter(p => p.connector === 'DIGITAL_L').length).toBe(8);
    expect(pins.filter(p => p.connector === 'ICSP').length).toBe(6);
  });

  it('finds the hole under a picture position and names strips and rails', () => {
    const f = frames[1];
    const rows = breadboardRows();
    expect(holeAt(f, f.x + stripX(3), f.y + rows.colY['e'])).toBe('r3e');
    expect(holeAt(f, f.x + stripX(3) + 2, f.y + rows.colY['f'] - 1)).toBe('r3f');
    expect(holeAt(f, f.x + stripX(3), f.y + rows.colY['e'] + 1.5 * P)).toBeNull();     // in the trench
    expect(holeAt(f, f.x + railX(f.board, 4), f.y + rows.railY['top+'])).toBe('rail:top:+:4');
    expect(stripKey('b', 'r5a')).toBe('b:5L');
    expect(stripKey('b', 'r5e')).toBe('b:5L');
    expect(stripKey('b', 'r5f')).toBe('b:5R');
    expect(stripKey('b', 'rail:top:-:3')).toBe('b:rail:top:-');
    expect(stripKey('b', 'D6')).toBeNull();
  });

  it('fits the boards in the bounds and draws a wire as a cubic leaving each end along its edge', () => {
    const b = bounds(frames);
    expect(b.h).toBeGreaterThan(frames[0].h + frames[1].h);
    const a = tieAnchor(frames, { board: 'bench-uno-1', tie: 'D2' })!, z = tieAnchor(frames, { board: 'bench-half-1', tie: 'r3a' })!;
    const d = wirePath(a, z);
    expect(d.startsWith(`M${Math.round(a.x * 10) / 10},${Math.round(a.y * 10) / 10} C`)).toBeTrue();
    expect(d).toContain(`${Math.round(z.x * 10) / 10},${Math.round(z.y * 10) / 10}`);
    expect(d.match(/C/g)!.length).toBe(1);
  });
});

describe('sprites', () => {
  const frames = layoutBoards(FIXTURE_LAYOUT.scene.boards);
  const at = (hole: string) => { const a = tieAnchor(frames, { board: 'bench-half-1', tie: hole }); return a ? { x: a.x, y: a.y } : null; };
  const sprite = (name: string, state = {}) => {
    const pl = FIXTURE_LAYOUT.placements.find(p => p.name === name)!;
    const { first, all } = legPoints(pl.legs, at, pl.terminal_ids);
    return spriteFor(pl.name, pl.kind, pl.part, pl.params, first, all, state);
  };

  it('computes resistor colour bands from the value: 220 ohm red-red-brown, 10k brown-black-orange, 4.7k yellow-violet-red, 1M brown-black-green, 4.7 ohm yellow-violet-gold; gold tolerance', () => {
    expect(resistorBands(220)).toEqual(['red', 'red', 'brown', 'gold']);
    expect(resistorBands(10000)).toEqual(['brown', 'black', 'orange', 'gold']);
    expect(resistorBands(4700)).toEqual(['yellow', 'violet', 'red', 'gold']);
    expect(resistorBands(1e6)).toEqual(['brown', 'black', 'green', 'gold']);
    expect(resistorBands(4.7)).toEqual(['yellow', 'violet', 'gold', 'gold']);
    expect(resistorBands(330)).toEqual(['orange', 'orange', 'brown', 'gold']);
    expect(resistorBands(0)).toBeNull();
    expect(resistorBands(NaN)).toBeNull();
    expect(ohmsText(220)).toBe('220 ohm');
    expect(ohmsText(4700)).toBe('4.7 kohm');
    expect(Object.keys(BAND_HEX)).toContain('gold');
  });

  it('draws R1 (220 ohm) between its two legs: lead lines out to the legs, a body, three value bands + a gold tolerance band in the colour code', () => {
    const s = sprite('R1');
    const bands = s.shapes.filter(x => x.cls.startsWith('lv-band'));
    expect(bands.length).toBe(4);
    expect(bands.map(b => b.cls.split(' ')[1])).toEqual(['band-red', 'band-red', 'band-brown', 'band-gold']);
    expect(s.shapes.filter(x => x.cls === 'lv-lead').length).toBe(2);
    const r1 = at('r7e')!, r2 = at('r11e')!;
    expect(s.transform).toContain(`translate(${(r1.x + r2.x) / 2} ${(r1.y + r2.y) / 2})`);
    expect(s.legs.length).toBe(2);
  });

  it('draws LED1 with the FLAT SIDE on the cathode side (+x of the anode-to-cathode axis) and the LONG leg on the anode', () => {
    const s = sprite('LED1');
    const flat = s.shapes.find(x => x.cls === 'lv-led-flat') as any;
    expect(flat.x1).toBeGreaterThan(0);
    const longL = s.shapes.find(x => x.cls.includes('lv-lead-long')) as any, shortL = s.shapes.find(x => x.cls.includes('lv-lead-short')) as any;
    expect(longL.x2).toBeLessThan(0);                                   // the anode lead runs to the -x side
    expect(Math.abs(longL.x2 - longL.x1)).toBeGreaterThan(Math.abs(shortL.x2 - shortL.x1));
    expect(s.shapes.some(x => x.cls === 'lv-led-glow')).toBeTrue();
  });

  it('draws SW1 across the trench: a square over its four legs with a cap that is smaller when pressed', () => {
    const s = sprite('SW1'), p = sprite('SW1', { pressed: true });
    expect(s.legs.length).toBe(4);
    const body = s.shapes.find(x => x.cls === 'lv-btn-body') as any;
    expect(body.w).toBeGreaterThan(2 * P);                              // spans rows 3-5
    expect(body.h).toBeGreaterThan(3 * P);                              // spans the 3-pitch trench (e to f)
    expect((p.shapes.find(x => x.cls === 'lv-btn-cap') as any).r).toBeLessThan((s.shapes.find(x => x.cls === 'lv-btn-cap') as any).r);
  });

  it('draws a TMP36 with its flat face toward the reader (the name on the face, a half-round top) and three labelled legs, and a transistor labelled E B C in terminal order', () => {
    const legs = (hs: string[]) => hs.map((h, i) => ({ terminal: `U.${i}`, name: String(i), x: at(h)!.x, y: at(h)!.y }));
    const l3 = legs(['r20e', 'r22e', 'r24e']);
    const t = spriteFor('U1', 'tmp36', 'tmp36', {}, l3, l3);
    expect(t.shapes.some(x => x.k === 'text' && x.cls === 'lv-to92-face' && x.t === 'TMP36')).toBeTrue();
    expect((t.shapes.find(x => x.k === 'path') as any).d).toContain('A');                  // the half-round top
    expect(t.shapes.filter(x => x.cls === 'lv-leg-label').map((x: any) => x.t)).toEqual(['+', 'out', '−']);
    const q = spriteFor('Q1', 'transistor', 'transistor', {}, l3, l3);
    expect(q.shapes.filter(x => x.cls === 'lv-leg-label').map((x: any) => x.t)).toEqual(['E', 'B', 'C']);
    expect(q.shapes.some(x => x.cls === 'lv-to92-face')).toBeFalse();
  });

  it('turns a potentiometer\'s notch with its setting and draws a generic labelled box for a part it has no sprite for', () => {
    const l3 = ['r20e', 'r22e', 'r24e'].map((h, i) => ({ terminal: `RV.${i}`, name: String(i), x: at(h)!.x, y: at(h)!.y }));
    const lo = spriteFor('RV1', 'pot', 'potentiometer', {}, l3, l3, { turn: 0 }), hi = spriteFor('RV1', 'pot', 'potentiometer', {}, l3, l3, { turn: 100 });
    const nx = (s: any) => (s.shapes.find((x: any) => x.cls === 'lv-pot-notch') as any).x2;
    expect(nx(lo)).toBeLessThan(0);
    expect(nx(hi)).toBeGreaterThan(0);
    const g = spriteFor('BZ1', 'piezo', 'piezo', {}, l3.slice(0, 2), l3.slice(0, 2));
    expect(g.shapes.some(x => x.cls === 'lv-generic-body')).toBeTrue();
    expect(g.shapes.some(x => x.k === 'text' && x.t === 'piezo')).toBeTrue();
  });
});

describe('overlays, outputs, steps, clicks', () => {
  const press: LvInteraction = { control: 'press', label: 'Press and hold', pin: 'D2', twin_pin: 'PD2', pressed_level: 0 };
  const tmp36: LvInteraction = { control: 'slider', label: 'Temperature', pin: 'A1', twin_pin: 'PC1', adc: 1, unit: '°C', min: -40, max: 125, step: 1, initial: 25, offset_mv: 500, per_unit_mv: 10 };
  const pot: LvInteraction = { control: 'slider', label: 'Turn the knob', pin: 'A0', twin_pin: 'PC0', adc: 0, unit: '%', min: 0, max: 100, step: 1, offset_mv: 0, per_unit_mv: 50 };
  const tilt: LvInteraction = { control: 'toggle', label: 'Tilt', pin: 'D4', twin_pin: 'PD4', pressed_level: 0 };

  it('a held pushbutton sends set <pin> 0 on mouse down and 1 on release, with the part named', () => {
    expect(injectBody('SW1', press, 'down')).toEqual({ set: 'PD2', level: 0, part: 'SW1', kind: 'press' });
    expect(injectBody('SW1', press, 'up')).toEqual({ set: 'PD2', level: 1, part: 'SW1', kind: 'release' });
    expect(injectBody('SW1', { ...press, pressed_level: 1 }, 'down')).toEqual({ set: 'PD2', level: 1, part: 'SW1', kind: 'press' });
    expect(injectBody('SW1', { ...press, twin_pin: '' }, 'down')).toBeNull();
  });

  it('a tilt sensor is a toggle: on drives the pressed level, off the opposite', () => {
    expect(injectBody('S2', tilt, 'on')).toEqual({ set: 'PD4', level: 0, part: 'S2', kind: 'toggle' });
    expect(injectBody('S2', tilt, 'off')).toEqual({ set: 'PD4', level: 1, part: 'S2', kind: 'toggle' });
  });

  it('the TMP36 slider is degC -> mV with 500 mV + 10 mV/degC (0 degC 500, 25 degC 750, -40 degC 100, 125 degC 1750) and adc <channel> mv', () => {
    expect([0, 25, -40, 125].map(x => mvFor(tmp36, x))).toEqual([500, 750, 100, 1750]);
    const b = injectBody('U1', tmp36, { value: 25 })!;
    expect(b['adc']).toBe(1);
    expect(b['mv']).toBe(750);
    expect(b['part']).toBe('U1');
    expect(String(b['what'])).toContain('25 °C');
    expect(injectBody('U1', { ...tmp36, adc: null }, { value: 25 })).toBeNull();
  });

  it('the potentiometer slider is % of the turn -> 0..5000 mV and is never allowed past the twin\'s 5 V limit', () => {
    expect([0, 50, 100].map(x => mvFor(pot, x))).toEqual([0, 2500, 5000]);
    expect(mvFor(pot, 140)).toBe(5000);
    expect(mvFor(tmp36, -80)).toBe(0);
  });

  it('PWM duty is worked out from the watched pin\'s own edges (cycles at 16 MHz); too few edges or too slow = no figure', () => {
    const per = 16000;   // 1 kHz
    const edges = (hiCyc: number) => Array.from({ length: 10 }, (_, i) => ({ level: i % 2 === 0 ? 1 : 0, cycle: Math.round((i >> 1) * per + (i % 2 === 0 ? 0 : hiCyc)) }));
    expect(dutyFromEdges(edges(4000))).toBeCloseTo(0.25, 1);
    expect(dutyFromEdges(edges(8000))).toBeCloseTo(0.5, 1);
    expect(dutyFromEdges(edges(4000).slice(0, 4))).toBeNull();
    expect(dutyFromEdges(Array.from({ length: 8 }, (_, i) => ({ level: i % 2, cycle: i * 16_000_000 })))).toBeNull();   // a 1 Hz blink is not PWM
  });

  it('an LED is dark until an edge is seen (said in words), lit at level 1, dimmed to the duty when PWM, and a piezo shows a tone marker only while its pin toggles', () => {
    expect(outputLook('led', undefined, 0).lit).toBeFalse();
    expect(outputLook('led', undefined, 0).note).toContain('no change seen yet');
    expect(outputLook('led', { level: 1, edges: [{ level: 1, cycle: 5 }], lastWallMs: 0 }, 0)).toEqual(jasmine.objectContaining({ lit: true, opacity: 1 }));
    expect(outputLook('led', { level: 0, edges: [{ level: 0, cycle: 5 }], lastWallMs: 0 }, 0).lit).toBeFalse();
    const pwm = Array.from({ length: 10 }, (_, i) => ({ level: i % 2 === 0 ? 1 : 0, cycle: Math.round((i >> 1) * 16000 + (i % 2 === 0 ? 0 : 4000)) }));
    const look = outputLook('led', { level: 0, edges: pwm, lastWallMs: 0 }, 0);
    expect(look.opacity).toBeCloseTo(0.25, 1);
    expect(look.note).toContain('PWM');
    const toggling = { level: 1, edges: [{ level: 0, cycle: 1 }, { level: 1, cycle: 2 }], lastWallMs: 1000 };
    expect(outputLook('tone', toggling, 1200).tone).toBeTrue();
    expect(outputLook('tone', toggling, 5000).tone).toBeFalse();
    expect(outputLook('tone', { level: 1, edges: [{ level: 1, cycle: 1 }], lastWallMs: 1000 }, 1100).tone).toBeFalse();
  });

  it('step k shows steps 0..k: the step\'s draw list is shown, its additions highlighted and the rest dimmed; the whole build shows everything', () => {
    const steps = FIXTURE_STEPS.steps;
    expect(steps.length).toBe(11);
    const s2 = stepView(FIXTURE_LAYOUT, steps, 2);
    expect([...s2.shownParts]).toEqual(['SW1']);
    expect([...s2.newParts]).toEqual(['SW1']);
    expect([...s2.shownWires]).toEqual(['w-gnd-header']);
    expect(s2.newWires.size).toBe(0);
    expect(s2.whole).toBeFalse();
    const last = stepView(FIXTURE_LAYOUT, steps, 10);
    expect(last.shownParts.size).toBe(3);
    expect(last.shownWires.size).toBe(6);
    expect(last.newParts.size + last.newWires.size).toBe(0);
    const whole = stepView(FIXTURE_LAYOUT, steps, null);
    expect(whole.whole).toBeTrue();
    expect(whole.shownParts.size).toBe(3);
    expect(stepView(FIXTURE_LAYOUT, [], 3).whole).toBeTrue();
  });

  it('?step= is 1-based; none, "all" or junk is the whole build; past the end is the last step', () => {
    expect(stepFromParam('3', 11)).toBe(2);
    expect(stepFromParam(null, 11)).toBeNull();
    expect(stepFromParam('all', 11)).toBeNull();
    expect(stepFromParam('x', 11)).toBeNull();
    expect(stepFromParam('99', 11)).toBe(10);
  });

  it('a click on a hole answers its strip, its net and what else is on the strip; an empty strip says so', () => {
    const r7 = holeInfo(FIXTURE_LAYOUT, 'bench-half-1', 'r7c');                 // the strip of D6's wire and R1's first leg
    expect(r7.net).toBe('LED_CONTROL');
    expect(r7.onStrip.map(x => x.name).sort()).toEqual(['R1', 'w-d3', 'w-d6'].sort());
    expect(r7.netMembers).toContain('hdr:D6');
    expect(r7.empty).toBeFalse();
    const sw = holeInfo(FIXTURE_LAYOUT, 'bench-half-1', 'r3b');
    expect(sw.net).toBe('BUTTON_INPUT');
    expect(sw.onStrip.some(x => x.name === 'SW1')).toBeTrue();
    const none = holeInfo(FIXTURE_LAYOUT, 'bench-half-1', 'r28c');
    expect(none.empty).toBeTrue();
    expect(none.words).toContain('nothing is connected');
    const rail = holeInfo(FIXTURE_LAYOUT, 'bench-half-1', 'rail:top:-:9');
    expect(rail.net).toBe('GND');
  });

  it('reads a ?pin= from the pin view (an id such as BoardPin:arduino-uno-r3:D6, or a bare label) as a header label', () => {
    expect(pinLabelFromParam('BoardPin:arduino-uno-r3:D6')).toBe('D6');
    expect(pinLabelFromParam('D2')).toBe('D2');
    expect(pinLabelFromParam(null)).toBe('');
  });
});
