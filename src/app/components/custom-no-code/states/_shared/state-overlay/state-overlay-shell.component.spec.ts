import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { StateOverlayShellComponent } from './state-overlay-shell.component';

/** Every node shows ITS OWN NAME as the title; the class word ("Variable Creation") is only a small subtitle. */
describe('StateOverlayShellComponent title', () => {
  let fixture: ComponentFixture<StateOverlayShellComponent>;
  const header = () => fixture.nativeElement as HTMLElement;
  const title = () => header().querySelector('.state-overlay-header__title')!.textContent!.trim();
  const kind = () => header().querySelector('.state-overlay-header__class')?.textContent?.trim();

  beforeEach(async () => {
    await TestBed.configureTestingModule({ declarations: [StateOverlayShellComponent], schemas: [NO_ERRORS_SCHEMA] }).compileComponents();
    fixture = TestBed.createComponent(StateOverlayShellComponent);
  });

  it('shows the state name as the title and the kind as a subtitle', () => {
    fixture.componentInstance.stateName = 'turn-on';
    fixture.componentInstance.title = 'Variable Creation';
    fixture.detectChanges();
    expect(title()).toBe('turn-on');
    expect(kind()).toBe('Variable Creation');
  });

  it('a compact node with no kind word still has its name (BackendStateChange used to be blank)', () => {
    fixture.componentInstance.stateName = 'toggle-requested';
    fixture.componentInstance.title = '';
    fixture.detectChanges();
    expect(title()).toBe('toggle-requested');
    expect(kind()).toBeUndefined();
  });

  it('falls back to the kind when no name is given, and never repeats a name that equals its kind', () => {
    fixture.componentInstance.title = 'Return';
    fixture.detectChanges();
    expect(title()).toBe('Return');
    expect(kind()).toBeUndefined();
    fixture.componentInstance.stateName = 'Return';
    fixture.detectChanges();
    expect(kind()).toBeUndefined();
  });
});
