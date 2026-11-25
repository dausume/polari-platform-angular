import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { CRUDEservicesManager } from '@services/crude-services-manager';
import { SchematicComponentCardsComponent } from './schematic-component-cards.component';
import { FeatureCardsTableComponent } from './feature-cards-table.component';

const ROWS: Record<string, any[]> = {
  SchematicComponent: [
    { name: 'btn-comp', title: 'BtnSchematicComponent', intent: 'button', core_part: 'pushbutton', solve_state: 'solved',
      solved_by: "the user's drawing (2026-11-24); no solver has run yet" },
    { name: 'button-unsolved', title: 'Button (unsolved)', intent: 'button', core_part: 'pushbutton', solve_state: 'unsolved' },
  ],
  SchematicComponentPort: [
    { component: 'btn-comp', port: 'a', kind: 'signal', chip: 'chip2', pin: 'GPIO4', pin_source: 'chosen', order: 0 },
    { component: 'btn-comp', port: 'b', kind: 'signal', chip: 'chip1', pin: 'GPIO3', pin_source: 'chosen', order: 1 },
    { component: 'button-unsolved', port: 'a', kind: 'signal', chip: 'chip1', pin: 'GPIO6', pin_source: 'chosen', order: 0 },
  ],
  SchematicComponentPart: [
    { component: 'btn-comp', ref: 'SW1', role: 'core', part_kind: 'pushbutton', order: 0 },
    { component: 'btn-comp', ref: 'C1', role: 'filter', part_kind: 'capacitor', port: 'a', order: 1 },
    { component: 'btn-comp', ref: 'D1', role: 'guard', part_kind: 'diode', port: 'b', order: 2 },
    { component: 'button-unsolved', ref: 'SW1', role: 'core', part_kind: 'pushbutton', order: 0 },
  ],
  SchematicComponentCheck: [
    { component: 'btn-comp', rule: 'pull', status: 'placed', subject: 'GPIO4', detail: 'RP: the firmware pull-up', order: 0 },
    { component: 'button-unsolved', rule: 'pull', status: 'needed', subject: 'GPIO6', detail: 'the switch leaves GPIO6 floating', order: 0 },
  ],
  HardwareFeature: [
    { name: 'button-on', title: 'The button', struct_instance: 'struct-instance-1', struct_field: 'ButtonOn', ui_control: 'btnToggle',
      schematic_component: 'btn-comp', pins: 'GPIO3, GPIO4', chosen: 'struct_field,ui_control,schematic_component,pins' },
    { name: 'loose', title: 'Loose', struct_field: 'Spare', schematic_component: 'nope', chosen: '' },
  ],
};

function crudeFake(read: string[], fail = '') {
  return {
    getCRUDEclassService: (cls: string) => ({
      readAll: () => { read.push(cls); return cls === fail ? throwError(() => new Error('offline')) : of([{ [cls]: [{ data: ROWS[cls] || [] }] }]); },
    }),
  };
}

describe('SchematicComponentCardsComponent (cb-1)', () => {
  let fixture: ComponentFixture<SchematicComponentCardsComponent>;
  let read: string[];

  function setup(fail = ''): void {
    read = [];
    TestBed.configureTestingModule({
      imports: [SchematicComponentCardsComponent],
      providers: [{ provide: CRUDEservicesManager, useValue: crudeFake(read, fail) }],
    });
    fixture = TestBed.createComponent(SchematicComponentCardsComponent);
    fixture.detectChanges();
  }
  const el = (): HTMLElement => fixture.nativeElement;

  it('reads the four classes through CRUDE (no door) and draws a card per component, unsolved first', () => {
    setup();
    expect(read.sort()).toEqual(['SchematicComponent', 'SchematicComponentCheck', 'SchematicComponentPart', 'SchematicComponentPort']);
    const titles = Array.from(el().querySelectorAll('.sc-card .title')).map((t) => t.textContent!.trim());
    expect(titles).toEqual(['Button (unsolved)', 'BtnSchematicComponent']);
    expect(el().querySelector('.summary')!.textContent).toContain('1 not solved');
  });

  it('marks the unsolved card red, the solved one not, and draws each component\'s own parts', () => {
    setup();
    const cards = el().querySelectorAll('.sc-card');
    expect(cards[0].classList.contains('red')).toBeTrue();
    expect(cards[1].classList.contains('red')).toBeFalse();
    expect(cards[1].querySelectorAll('svg .symbol').length).toBe(3);     // SW1, C1, D1
    expect(cards[0].querySelectorAll('svg .symbol').length).toBe(1);     // SW1 only
    expect(cards[1].textContent).toContain('no solver has run yet');
    expect(cards[1].textContent).toContain('unverified');                 // no value was worked out: never a guessed one
  });

  it('lists each component\'s own solver decisions, a needed part in red', () => {
    setup();
    const cards = el().querySelectorAll('.sc-card');
    const rows0 = cards[0].querySelectorAll('.checks li.bad');
    expect(rows0.length).toBe(1);                                         // button-unsolved: pull needed
    expect(rows0[0].textContent).toContain('floating');
    expect(cards[1].querySelector('.checks')!.textContent).toContain('placed');
    expect(cards[1].querySelectorAll('.checks li.bad').length).toBe(0);
    expect((cards[0].querySelector('details.checks') as HTMLDetailsElement).open).toBeTrue();    // red: opened, so what blocks it is seen
    expect((cards[1].querySelector('details.checks') as HTMLDetailsElement).open).toBeFalse();
  });

  it('says so in words when a class cannot be read', () => {
    setup('SchematicComponentPort');
    expect(el().querySelector('[role="alert"]')!.textContent).toContain('Could not read');
  });
});

describe('FeatureCardsTableComponent (cb-2)', () => {
  let fixture: ComponentFixture<FeatureCardsTableComponent>;
  let read: string[];
  const COLUMNS = [
    { key: 'struct', label: 'Struct field', kind: 'fields', source_key: 'struct_field', required: true,
      fields: { Instance: 'struct_instance', Field: 'struct_field' } },
    { key: 'nocode', label: 'No-code piece', kind: 'fields', source_key: 'nocode_variable', required: true, fields: { Variable: 'nocode_variable' } },
    { key: 'schematic', label: 'Schematic component', kind: 'schematic', source_key: 'schematic_component', required: true,
      ref_field: 'schematic_component' },
  ];

  beforeEach(() => {
    read = [];
    TestBed.configureTestingModule({
      imports: [FeatureCardsTableComponent],
      providers: [{ provide: CRUDEservicesManager, useValue: crudeFake(read) }],
    });
    fixture = TestBed.createComponent(FeatureCardsTableComponent);
    fixture.componentInstance.columns = COLUMNS as any;
    fixture.detectChanges();
  });
  const el = (): HTMLElement => fixture.nativeElement;

  it('one row per feature, one card per column, plus the verdict', () => {
    expect(read.sort()).toEqual(['HardwareFeature', 'SchematicComponent', 'SchematicComponentPart', 'SchematicComponentPort']);
    const rows = el().querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].querySelectorAll('.el-card').length).toBe(3);
    expect(rows[0].querySelector('th')!.textContent).toContain('The button');
  });

  it('marks each card chosen / open, draws the bound component, and names what is open', () => {
    const first = el().querySelectorAll('tbody tr')[0];
    const cards = first.querySelectorAll('.el-card');
    expect(cards[0].classList.contains('src-chosen')).toBeTrue();
    expect(cards[1].classList.contains('src-open')).toBeTrue();
    expect(cards[1].textContent).toContain('needed');
    expect(cards[2].querySelector('schematic-component-card svg')).toBeTruthy();
    expect(first.querySelector('.verdict')!.textContent).toContain('open: No-code piece');
  });

  it('says plainly when a feature names a component that does not exist', () => {
    const second = el().querySelectorAll('tbody tr')[1];
    expect(second.textContent).toContain('names nope, which does not exist');
    expect(second.querySelector('.verdict')!.textContent).toContain('missing');
  });
});
