import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CRUDEservicesManager } from '@services/crude-services-manager';
import { layoutSolution, solutionsOf } from './solution-schematic';
import { SolutionSchematicComponent } from './solution-schematic.component';

// uno-light-system as the solver records it (hwnocode custom/solved/uno-light-system.json), plus one blocked component of another solution
// and one of the drawing's rows (no solution)
const SOL = 'uno-light-system';
const COMPS = [
  { name: `${SOL}:ubc-led1`, title: 'Light LED1', core_part: 'led', solve_state: 'solved', hardware_solution: SOL, board: 'arduino-uno-r3' },
  { name: `${SOL}:ubc-sw1`, title: 'Button SW1', core_part: 'pushbutton', solve_state: 'solved', hardware_solution: SOL, board: 'arduino-uno-r3' },
  { name: 'c3:c3l-sw1', title: 'Button SW1', core_part: 'pushbutton', solve_state: 'blocked', hardware_solution: 'c3-light-system', board: 'esp32-c3' },
  { name: 'btn-comp', title: 'BtnSchematicComponent', core_part: 'pushbutton', solve_state: 'solved' },
];
const PORTS = [
  { component: `${SOL}:ubc-led1`, port: 'D6', kind: 'signal', chip: 'atmega328p', pin: 'D6', pin_source: 'chosen', order: 0, net: 'LED_CONTROL' },
  { component: `${SOL}:ubc-led1`, port: 'D3', kind: 'signal', chip: 'atmega328p', pin: 'D3', pin_source: 'chosen', order: 1, net: 'LED_CONTROL' },
  { component: `${SOL}:ubc-led1`, port: 'gnd', kind: 'ground', order: 2, net: 'GND' },
  { component: `${SOL}:ubc-sw1`, port: 'D2', kind: 'signal', chip: 'atmega328p', pin: 'D2', pin_source: 'chosen', order: 0, net: 'BUTTON_INPUT' },
  { component: `${SOL}:ubc-sw1`, port: 'gnd', kind: 'ground', order: 1, net: 'GND' },
  { component: 'c3:c3l-sw1', port: 'GPIO3', kind: 'signal', chip: 'esp32c3', pin: 'GPIO3', pin_source: 'chosen', order: 0, net: 'BUTTON_INPUT' },
];
const PARTS = [
  { component: `${SOL}:ubc-led1`, ref: 'LED1', role: 'core', part_kind: 'led', order: 0 },
  { component: `${SOL}:ubc-led1`, ref: 'R1', role: 'series', part_kind: 'resistor', value: '220 ohm', port: 'D6', order: 1 },
  { component: `${SOL}:ubc-sw1`, ref: 'SW1', role: 'core', part_kind: 'pushbutton', order: 0 },
  { component: `${SOL}:ubc-sw1`, ref: 'RPD2', role: 'pull', part_kind: 'internal-pull-up', port: 'D2', order: 1 },
  { component: 'c3:c3l-sw1', ref: 'SW1', role: 'core', part_kind: 'pushbutton', order: 0 },
];

describe('solution-schematic (cb-6)', () => {
  it('names the solutions the rows carry; the drawing\'s own rows belong to none', () => {
    expect(solutionsOf(COMPS)).toEqual(['c3-light-system', SOL]);
  });

  it('puts every component of one solution on one drawing, each pin line running on to the chip, the pins named in the chip', () => {
    const v = layoutSolution(SOL, COMPS, PORTS, PARTS);
    expect(v.blocks.map((b) => b.title)).toEqual(['Button SW1', 'Light LED1']);
    expect(v.chip).toBe('atmega328p');
    expect(v.chipPins.map((p) => p.pin).sort()).toEqual(['D2', 'D3', 'D6']);
    expect(v.stubs.every((s) => s.x2 === v.chipBox.x)).toBeTrue();
    for (const p of v.chipPins) {                                     // the chip box spans every pin
      expect(p.y).toBeGreaterThan(v.chipBox.y);
      expect(p.y).toBeLessThan(v.chipBox.y + v.chipBox.h);
    }
    expect(v.blocks[1].offsetY).toBeGreaterThan(v.blocks[0].offsetY + v.blocks[0].drawing.height - 1);   // stacked, never overlapping
    expect(v.unsolved).toBe(0);
    expect(v.words).toContain('all solved');
  });

  it('keeps a blocked component red, its line to the chip too', () => {
    const v = layoutSolution('c3-light-system', COMPS, PORTS, PARTS);
    expect(v.blocks[0].red).toBeTrue();
    expect(v.stubs[0].red).toBeTrue();
    expect(v.words).toContain('1 not solved');
  });

  it('draws one section per solution from the classes, through CRUDE', () => {
    const rows: Record<string, any[]> = { SchematicComponent: COMPS, SchematicComponentPort: PORTS, SchematicComponentPart: PARTS };
    TestBed.configureTestingModule({
      imports: [SolutionSchematicComponent],
      providers: [{ provide: CRUDEservicesManager, useValue: { getCRUDEclassService: (c: string) => ({ readAll: () => of([{ [c]: [{ data: rows[c] }] }]) }) } }],
    });
    const f: ComponentFixture<SolutionSchematicComponent> = TestBed.createComponent(SolutionSchematicComponent);
    f.detectChanges();
    const sections = f.nativeElement.querySelectorAll('section.one');
    expect(sections.length).toBe(2);
    const uno = Array.from(sections as NodeListOf<HTMLElement>).find((s) => s.textContent!.includes(SOL))!;
    expect(uno.querySelectorAll('g.symbol').length).toBe(6);           // LED1, R1, SW1, the pull, and each block's ground
    expect(uno.querySelector('rect.chip')).toBeTruthy();
    expect(uno.textContent).toContain('D6');
  });
});
