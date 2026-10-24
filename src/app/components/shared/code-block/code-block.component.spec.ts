import { legendChips, segmentLine } from './code-block-segments';
import { CodeBlockComponent } from './code-block.component';
import { TestBed } from '@angular/core/testing';

describe('code-block segments', () => {
  const ids = [{ name: 'LED_PIN', kind: 'pin-macro', why: 'w' }, { name: 'DDRB', kind: 'register' }, { name: 'PIN', kind: 'knob' }];

  it('colours two identifiers in one line', () => {
    const s = segmentLine('DDRB |= (1 << LED_PIN);', ids);
    expect(s.map((x) => x.text).join('')).toBe('DDRB |= (1 << LED_PIN);');
    expect(s.filter((x) => x.kind).map((x) => [x.text, x.kind])).toEqual([['DDRB', 'register'], ['LED_PIN', 'pin-macro']]);
    expect(s.find((x) => x.text === 'LED_PIN')!.why).toBe('w');
  });
  it('does not match a substring of a longer token', () => {
    const s = segmentLine('x = LED_PINS + MYDDRB + PIN;', ids);
    expect(s.filter((x) => x.kind).map((x) => x.text)).toEqual(['PIN']);
  });
  it('empty identifiers give one plain segment', () => {
    expect(segmentLine('a = b;', [])).toEqual([{ text: 'a = b;' }]);
  });
  it('legend is in fixed order with counts, only present kinds', () => {
    const chips = legendChips([
      { name: 'a', kind: 'library' }, { name: 'b', kind: 'register' }, { name: 'c', kind: 'pin-macro' }, { name: 'd', kind: 'register' },
    ]);
    expect(chips.map((c) => [c.kind, c.label, c.count])).toEqual([
      ['pin-macro', 'pin macro', 1], ['register', 'register', 2], ['library', 'library call', 1]]);
  });
});

describe('CodeBlockComponent identifiers', () => {
  it('renders spans and legend only when identifiers are given', () => {
    const f = TestBed.createComponent(CodeBlockComponent);
    f.componentInstance.lines = [{ n: 1, text: 'DDRB = 1;' }];
    f.detectChanges();
    expect(f.nativeElement.querySelector('.ident')).toBeNull();
    expect(f.nativeElement.querySelector('.kind-legend')).toBeNull();
    f.componentInstance.identifiers = [{ name: 'DDRB', kind: 'register' }];
    f.componentInstance.ngOnChanges();
    f.detectChanges();
    expect(f.nativeElement.querySelector('.ident.kind-register').textContent).toBe('DDRB');
    expect(f.nativeElement.querySelector('.kind-legend').textContent).toContain('register');
  });
});
