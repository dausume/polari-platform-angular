import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { StepsComponent } from './steps.component';
import { StepConfig, stepStates } from './class-rows-cards';

const set = (v: string): StepConfig['done_when'] => ({ scope_key: v, op: 'set' });
const gte = (v: string, n: number): StepConfig['done_when'] => ({ scope_key: v, op: 'gte', value: n });

describe('steps derivation (wb-1)', () => {
  it('op set: done when the substituted value is non-empty; the first not-done is current, the rest todo', () => {
    const s = (a: string, b: string, c: string): StepConfig[] =>
      [{ label: 'A', done_when: set(a) }, { label: 'B', done_when: set(b) }, { label: 'C', done_when: set(c) }];
    expect(stepStates(s('x', '', ''))).toEqual(['done', 'current', 'todo']);
    expect(stepStates(s('', '', ''))).toEqual(['current', 'todo', 'todo']);
    expect(stepStates(s('x', 'y', 'z'))).toEqual(['done', 'done', 'done']);
    expect(stepStates(s('', 'y', ''))).toEqual(['current', 'done', 'todo']);        // not locked: a later step can be done early
  });

  it('op gte: numeric compare; blank or non-numeric is not done', () => {
    expect(stepStates([{ label: 'A', done_when: gte('2', 1) }, { label: 'B', done_when: gte('0', 1) }, { label: 'C', done_when: gte('', 1) }]))
      .toEqual(['done', 'current', 'todo']);
    expect(stepStates([{ label: 'A', done_when: gte('abc', 1) }])).toEqual(['current']);
    expect(stepStates([{ label: 'A', done_when: gte('1', 1) }])).toEqual(['done']);
  });
});

describe('StepsComponent (wb-1)', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [StepsComponent, RouterTestingModule] }));

  it('renders done / current / todo and a click on a step navigates to its tab', () => {
    const f = TestBed.createComponent(StepsComponent);
    f.componentInstance.steps = [
      { label: 'Name', done_when: set('b1'), target: 'name' },
      { label: 'Boards', done_when: gte('0', 1), target: 'boards' },
      { label: 'Mission', done_when: set('') },
    ];
    f.detectChanges();
    const lis = Array.from(f.nativeElement.querySelectorAll('li')) as HTMLElement[];
    expect(lis.map((l) => ['done', 'current', 'todo'].find((c) => l.classList.contains(c)))).toEqual(['done', 'current', 'todo']);
    expect(lis[1].getAttribute('aria-current')).toBe('step');
    const nav = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    (lis[1].querySelector('button') as HTMLButtonElement).click();
    expect(nav).toHaveBeenCalledWith([], { queryParams: { tab: 'boards' }, queryParamsHandling: 'merge' });
    expect((lis[2].querySelector('button') as HTMLButtonElement).disabled).toBeTrue();
  });
});
