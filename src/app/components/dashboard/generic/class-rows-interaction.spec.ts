import { clickIsOnControl, fieldText, hasBlankParam, nextSelection } from './class-rows-interaction';

describe('class-rows-interaction (fsc-3)', () => {
  it('hasBlankParam: an unpicked scope leaves an empty value in the query', () => {
    expect(hasBlankParam('/api/x?mission=m&solution=&profile=p')).toBeTrue();
    expect(hasBlankParam('/api/x?solution=')).toBeTrue();
    expect(hasBlankParam('/api/x?mission=m&solution=s1')).toBeFalse();
    expect(hasBlankParam('/api/x')).toBeFalse();
    expect(hasBlankParam('')).toBeFalse();
  });

  it('nextSelection: a click selects, a second click on the same row clears (click-toggle rule)', () => {
    const row = { solution: 's1' };
    expect(nextSelection(row, 'solution', '')).toBe('s1');
    expect(nextSelection(row, 'solution', 's2')).toBe('s1');
    expect(nextSelection(row, 'solution', 's1')).toBe('');
  });

  it('nextSelection: a row without the field selects nothing', () => {
    expect(nextSelection({}, 'solution', 's1')).toBe('');
  });

  it('fieldText: missing and null are empty, numbers are text', () => {
    expect(fieldText({ a: null }, 'a')).toBe('');
    expect(fieldText({}, 'a')).toBe('');
    expect(fieldText({ a: 0 }, 'a')).toBe('0');
  });

  it('clickIsOnControl: a link or button inside the row is a control, a plain cell is not', () => {
    const cell = document.createElement('td');
    const link = document.createElement('a');
    cell.appendChild(link);
    expect(clickIsOnControl(link)).toBeTrue();
    expect(clickIsOnControl(cell)).toBeFalse();
    expect(clickIsOnControl(null)).toBeFalse();
  });
});
