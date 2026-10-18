import { actionShown, failureWords, fillBody, fillPath, parseWeight, rowEditable } from './class-rows-action';

describe('class-rows-action (fsc-3)', () => {
  const row = { profile: 'my-fast', term: 'wires', editable: true, seeded: false, name: 'fsc-fastest' };

  it('fillBody: {field} in keys and values comes from the row; "{value}" is the edited number itself', () => {
    const body = fillBody({ name: '{profile}', weights: { '{term}': '{value}' } }, row, 0.25);
    expect(body).toEqual({ name: 'my-fast', weights: { wires: 0.25 } });
    expect(typeof body.weights.wires).toBe('number');
  });

  it('fillBody: a text value around a field stays text, and arrays are templated', () => {
    expect(fillBody({ name: 'my-{name}', copy_of: '{name}', list: ['{term}'] }, row)).toEqual({ name: 'my-fsc-fastest', copy_of: 'fsc-fastest', list: ['wires'] });
  });

  it('fillBody: a field the row lacks becomes empty, never the word undefined', () => {
    expect(fillBody({ a: '{nope}' }, row)).toEqual({ a: '' });
  });

  it('fillPath: row fields are URL-encoded into the path', () => {
    expect(fillPath('/api/p/{name}/x', { name: 'a b/c' })).toBe('/api/p/a%20b%2Fc/x');
  });

  it('parseWeight: a number of 0 or more, else null', () => {
    expect(parseWeight('0.5')).toBe(0.5);
    expect(parseWeight(' 2 ')).toBe(2);
    expect(parseWeight('0')).toBe(0);
    expect(parseWeight('')).toBeNull();
    expect(parseWeight('abc')).toBeNull();
    expect(parseWeight('-1')).toBeNull();
    expect(parseWeight('Infinity')).toBeNull();
  });

  it('rowEditable: no enabling field means editable; otherwise the field must be truthy', () => {
    expect(rowEditable(row, '')).toBeTrue();
    expect(rowEditable(row, 'editable')).toBeTrue();
    expect(rowEditable({ editable: false }, 'editable')).toBeFalse();
    expect(rowEditable({ editable: 'false' }, 'editable')).toBeFalse();
    expect(rowEditable({}, 'editable')).toBeFalse();
  });

  it('actionShown: a Copy-to-edit button shows only on seeded rows', () => {
    const action = { path: '/x', show_when_field: 'seeded' };
    expect(actionShown({ seeded: true }, action)).toBeTrue();
    expect(actionShown({ seeded: false }, action)).toBeFalse();
    expect(actionShown({}, null)).toBeFalse();
  });

  it('failureWords: the door\'s own error text, else a plain sentence', () => {
    expect(failureWords({ error: { ok: false, error: 'profile is seeded: copy it' } })).toBe('profile is seeded: copy it');
    expect(failureWords({})).toBe('The change could not be saved.');
  });
});
