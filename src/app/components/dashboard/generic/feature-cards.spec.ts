import { FeatureColumn, crudeRows, featureState, sourceOf } from './feature-cards';

// the page seed's columns (hwnocode/schematic_page.py FEATURE_COLUMNS), required flags from feature_columns.py
const COLS: FeatureColumn[] = [
  { key: 'struct', label: 'Struct field', kind: 'fields', source_key: 'struct_field', required: true, fields: { Field: 'struct_field' } },
  { key: 'ui', label: 'UI control', kind: 'fields', source_key: 'ui_control', required: false, fields: { Control: 'ui_control' } },
  { key: 'nocode', label: 'No-code piece', kind: 'fields', source_key: 'nocode_variable', required: true, fields: { Variable: 'nocode_variable' } },
  { key: 'protocol', label: 'Protocol', kind: 'fields', source_key: 'protocol', required: true, fields: { Protocol: 'protocol' } },
  { key: 'schematic', label: 'Schematic component', kind: 'schematic', source_key: 'schematic_component', required: true,
    ref_field: 'schematic_component' },
  { key: 'pins', label: 'Chip and pins', kind: 'fields', source_key: 'pins', required: true, fields: { Pins: 'pins' } },
];
const COMPS = [{ name: 'btn-comp', solve_state: 'solved' }, { name: 'button-unsolved', solve_state: 'unsolved' }];
const BUTTON = { name: 'button-on', struct_field: 'ButtonOn', ui_control: 'btnToggle', schematic_component: 'btn-comp',
  pins: 'GPIO3, GPIO4', chosen: 'struct_field,ui_control,schematic_component,pins' };

describe('feature-cards (cb-2)', () => {
  it('reads each element as chosen, suggested or open', () => {
    expect(sourceOf(BUTTON, 'struct_field')).toBe('chosen');
    expect(sourceOf({ ...BUTTON, protocol: 'active-low' }, 'protocol')).toBe('suggested');
    expect(sourceOf(BUTTON, 'nocode_variable')).toBe('open');
  });

  it('is not complete while a required element is open, and names them; an open optional element does not count', () => {
    const s = featureState({ ...BUTTON, ui_control: '' }, COLS, COMPS);
    expect(s.complete).toBeFalse();
    expect(s.missing).toEqual(['No-code piece', 'Protocol']);
    expect(s.words).toContain('open: No-code piece, Protocol');
  });

  it('is complete when every required element is filled and the component is solved', () => {
    const s = featureState({ ...BUTTON, nocode_variable: 'BUTTON_PIN', protocol: 'active-low' }, COLS, COMPS);
    expect(s.complete).toBeTrue();
  });

  it('is not complete when bound to an unsolved or a missing component, and says which', () => {
    const full = { ...BUTTON, nocode_variable: 'BUTTON_PIN', protocol: 'active-low' };
    expect(featureState({ ...full, schematic_component: 'button-unsolved' }, COLS, COMPS).words).toContain('is unsolved');
    expect(featureState({ ...full, schematic_component: 'nope' }, COLS, COMPS).schematic).toBe('missing');
  });

  it('reads the CRUDE envelope', () => {
    expect(crudeRows([{ HardwareFeature: [{ data: [BUTTON] }] }], 'HardwareFeature')).toEqual([BUTTON]);
    expect(crudeRows(null, 'HardwareFeature')).toEqual([]);
  });
});
