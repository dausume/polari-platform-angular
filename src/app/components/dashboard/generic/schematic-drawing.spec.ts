import { layoutSchematic, stateWords } from './schematic-drawing';

// the user's drawing (2026-11-24), as the backend seeds it (hwnocode/custom/schematic_seed.py)
const LIGHT = { name: 'light-comp', title: 'LightComp', intent: 'light', core_part: 'led', solve_state: 'solved',
  solved_by: "the user's drawing (2026-11-24); no solver has run yet" };
const BARE = { name: 'light-unsolved', title: 'Light (unsolved)', intent: 'light', core_part: 'led', solve_state: 'unsolved' };
const PORTS = [
  { component: 'light-comp', port: 'b', kind: 'signal', chip: 'chip1', pin: 'GPIO1', pin_source: 'chosen', order: 1 },
  { component: 'light-comp', port: 'a', kind: 'signal', chip: 'chip1', pin: 'GPIO2', pin_source: 'chosen', order: 0 },
  { component: 'light-comp', port: 'supply', kind: 'supply', order: 2 },
  { component: 'light-unsolved', port: 'a', kind: 'signal', chip: 'chip1', pin: 'GPIO8', pin_source: 'chosen', order: 0 },
  { component: 'light-unsolved', port: 'b', kind: 'signal', chip: 'chip1', pin: '', pin_source: '', order: 1 },
];
const PARTS = [
  { component: 'light-comp', ref: 'LED1', role: 'core', part_kind: 'led', order: 0 },
  { component: 'light-comp', ref: 'C1', role: 'filter', part_kind: 'capacitor', port: 'a', order: 1 },
  { component: 'light-comp', ref: 'D1', role: 'guard', part_kind: 'diode', port: 'b', order: 2 },
  { component: 'light-comp', ref: 'BT1', role: 'supply', part_kind: 'battery', port: 'supply', order: 3 },
  { component: 'light-unsolved', ref: 'LED1', role: 'core', part_kind: 'led', order: 0 },
];

describe('schematic-drawing (cb-1)', () => {
  it('lays the solved light out as drawn: core on the left line, C1 on the GPIO2 line, D1 on the GPIO1 line, the battery below', () => {
    const d = layoutSchematic(LIGHT, PORTS, PARTS);
    expect(d.red).toBeFalse();
    const sym = (ref: string) => d.symbols.find((s) => s.ref === ref)!;
    expect(sym('LED1').vertical).toBeTrue();
    expect(sym('C1').kind).toBe('capacitor');
    expect(sym('D1').kind).toBe('diode');
    expect(sym('C1').y).toBeLessThan(sym('D1').y);                    // port a (order 0) is drawn above port b
    expect(sym('BT1').y).toBeGreaterThan(sym('D1').y);                // the supply sits below the last port
    expect(d.labels.map((l) => l.text)).toContain('chip1 GPIO2');
    expect(d.labels.map((l) => l.text)).toContain('chip1 GPIO1');
    expect(d.junctions.length).toBe(1);
    expect(d.height).toBeGreaterThan(sym('BT1').y);
  });

  it('breaks a port\'s line where its part sits, and runs a bare line where none does', () => {
    const d = layoutSchematic(BARE, PORTS, PARTS);
    const horizontal = d.wires.filter((w) => w.y1 === w.y2);
    expect(horizontal.length).toBe(2);                                // one unbroken line per port: nothing sits on them
    expect(d.symbols.map((s) => s.ref)).toEqual(['LED1']);
  });

  it('draws an unsolved component red and says why, and an open pin as open', () => {
    const d = layoutSchematic(BARE, PORTS, PARTS);
    expect(d.red).toBeTrue();
    expect(d.words).toContain('unsolved');
    const open = d.labels.find((l) => l.text === 'chip1');
    expect(open).toBeTruthy();                                         // the chip is named, the pin is not
    expect(d.pins.map((p) => p.source)).toEqual(['chosen', '']);
  });

  it('names what solved a component, and says stale plainly', () => {
    expect(stateWords(LIGHT)).toContain('no solver has run yet');
    expect(stateWords({ name: 'x', solve_state: 'stale' })).toContain('solve it again');
    expect(layoutSchematic({ name: 'x', solve_state: 'stale' }, [], []).red).toBeTrue();
  });

  it('ignores rows of other components', () => {
    const d = layoutSchematic(LIGHT, PORTS, PARTS);
    expect(d.symbols.length).toBe(4);
    expect(d.pins.length).toBe(2);
  });

  // cb-3: the solved UNO light as the solver records it (hwnocode custom/solved/uno-light-system.json): D3 is on D6's net
  const UNO = { name: 'uno-light-system:ubc-led1', title: 'Light LED1', core_part: 'led', solve_state: 'solved',
    findings: 'solved - pull not-needed, series placed, guard not-needed, filter not-needed; 4 numbers not cited (named in its checks)' };
  const UNO_PORTS = [
    { component: UNO.name, port: 'D6', kind: 'signal', chip: 'atmega328p', pin: 'D6', pin_source: 'chosen', order: 0, net: 'LED_CONTROL' },
    { component: UNO.name, port: 'D3', kind: 'signal', chip: 'atmega328p', pin: 'D3', pin_source: 'chosen', order: 1, net: 'LED_CONTROL' },
    { component: UNO.name, port: 'gnd', kind: 'ground', order: 2, net: 'GND' },
  ];
  const UNO_PARTS = [
    { component: UNO.name, ref: 'LED1', role: 'core', part_kind: 'led', order: 0 },
    { component: UNO.name, ref: 'R1', role: 'series', part_kind: 'resistor', value: '220 ohm', port: 'D6', order: 1 },
  ];

  it('draws a port on an earlier port\'s net as a tap of that line, and hangs the core part below its one line', () => {
    const d = layoutSchematic(UNO, UNO_PORTS, UNO_PARTS);
    const sym = (ref: string) => d.symbols.find((s) => s.ref === ref)!;
    const top = d.pins[0].y;
    const tap = d.pins[1].y;
    expect(tap).toBeGreaterThan(top);
    expect(d.junctions.some((j) => j.y === top && j.x > sym('R1').x)).toBeTrue();   // D3 leaves D6's line after R1, before the pin
    expect(sym('LED1').y).toBeGreaterThan(top);                                     // the LED hangs below D6's line ...
    expect(sym('LED1').x).toBeLessThan(sym('R1').x);                                // ... on the vertical line, not between D6 and D3
    expect(d.red).toBeFalse();
    expect(d.words).toContain('series placed');                                     // the solver's own verdict, in words
  });

  it('draws the chip\'s own pull as a resistor, and a blocked component red with the solver\'s reason', () => {
    const btn = { name: 'b', core_part: 'pushbutton', solve_state: 'blocked', findings: 'blocked - pull needed on GPIO3' };
    const d = layoutSchematic(btn, [{ component: 'b', port: 'GPIO3', kind: 'signal', chip: 'esp32c3', pin: 'GPIO3', order: 0, net: 'BUTTON_INPUT' }],
      [{ component: 'b', ref: 'SW1', role: 'core', part_kind: 'pushbutton', order: 0 },
       { component: 'b', ref: 'RPGPIO3', role: 'pull', part_kind: 'internal-pull-up', port: 'GPIO3', order: 1 }]);
    expect(d.symbols.find((s) => s.ref === 'RPGPIO3')!.kind).toBe('resistor');
    expect(d.red).toBeTrue();
    expect(stateWords(btn)).toContain('pull needed on GPIO3');
  });
});
