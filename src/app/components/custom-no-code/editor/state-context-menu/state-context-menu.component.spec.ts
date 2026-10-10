import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatIconModule } from '@angular/material/icon';

import { StateContextMenuComponent } from './state-context-menu.component';

/**
 * ucd-iso-1 (his ruling 2026-10-10): "in the States for C-atoms in no-code, we should have a option in one of
 * the right click pop up menus to look at the c-atom details page". What must hold: the "Open C-atom details"
 * entry emits `openCAtomDetails` with the atom name when the right-clicked state names one (`cAtomAtomName` set
 * by the canvas from `boundObjectFieldValues['atom']` under `boundObjectClass === 'CAtom'` — see
 * custom-no-code.ts's `contextMenuAtomName`); for every other state it is disabled, says why in its title, and
 * never emits.
 */
describe('StateContextMenuComponent — "Open C-atom details" enablement (ucd-iso-1)', () => {
  let fixture: ComponentFixture<StateContextMenuComponent>;
  let component: StateContextMenuComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [StateContextMenuComponent],
      imports: [MatIconModule],
    }).compileComponents();
    fixture = TestBed.createComponent(StateContextMenuComponent);
    component = fixture.componentInstance;
    component.stateName = 'adc_read_1';
  });

  afterEach(() => {
    // StateContextMenuComponent moves itself onto document.body (ngOnInit) and removes itself (ngOnDestroy) —
    // destroy explicitly so a later spec file's body isn't left holding a stray node.
    fixture.destroy();
  });

  it('a c-atom state (cAtomAtomName set): the entry is enabled, has no title, and clicking emits the atom name', () => {
    component.cAtomAtomName = 'uno:hal.hal_adc_read';
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const items = Array.from(el.querySelectorAll('.menu-item'));
    const entry = items.find((n) => (n.textContent || '').includes('Open C-atom details')) as HTMLElement;
    expect(entry).toBeTruthy();
    expect(entry.classList.contains('disabled')).toBe(false);
    expect(entry.getAttribute('title') || '').toBe('');

    let emitted: any = null;
    component.menuAction.subscribe((a) => { emitted = a; });
    let closed = false;
    component.menuClosed.subscribe(() => { closed = true; });
    entry.click();
    expect(emitted).toEqual({ type: 'openCAtomDetails', stateName: 'adc_read_1', value: 'uno:hal.hal_adc_read' });
    expect(closed).toBe(true);
  });

  it('a non-c-atom state (cAtomAtomName empty): the entry is disabled, says why, and clicking emits nothing', () => {
    component.cAtomAtomName = '';
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const items = Array.from(el.querySelectorAll('.menu-item'));
    const entry = items.find((n) => (n.textContent || '').includes('Open C-atom details')) as HTMLElement;
    expect(entry).toBeTruthy();
    expect(entry.classList.contains('disabled')).toBe(true);
    expect(entry.getAttribute('title')).toBe('Only a C-atom state has a details page');

    let emitted: any = null;
    component.menuAction.subscribe((a) => { emitted = a; });
    let closed = false;
    component.menuClosed.subscribe(() => { closed = true; });
    entry.click();
    expect(emitted).toBeNull();
    expect(closed).toBe(false);
  });
});
