import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';

import { XrLobbyPageComponent } from './xr-lobby-page.component';
import { SimSpaceService } from '@services/sim-space/sim-space.service';
import { MultiScaleSimDefinitionService } from '@services/multi-scale/multi-scale-sim-definition.service';

/** /xr lobby: paging instead of scrolling, msim cards expand to
 *  their panels' bound 3D spaces (the XR-enterable things). */
describe('XrLobbyPageComponent', () => {
  let fixture: ComponentFixture<XrLobbyPageComponent>;
  let component: XrLobbyPageComponent;

  const spaces = Array.from({ length: 7 }, (_, index) => ({
    name: `space-${index}`, description: `space number ${index}`,
    dimensionality: '3d' as const, coordinateSystem: 'cartesian',
  }));
  const msimList$ = new BehaviorSubject([{
    id: 'm1', name: 'wax-multiscale', description: '',
    primary_simulation_ref: 'wax-sim', memberCount: 2,
    couplingCount: 1,
  } as any]);
  const msimConfig = { name: 'wax-multiscale', panels: [] } as any;

  beforeEach(async () => {
    // Specs run in random order and one of them mutates panels —
    // reset the shared fixture every time.
    msimConfig.panels = [
      { kind: 'scene', simSpaceRef: 'wax-space' },
      { kind: 'scene', simSpaceRef: 'wax-space' },
      { kind: 'graph' },
      { kind: 'selector', simSpaceRef: 'selector-space' },
    ];
    await TestBed.configureTestingModule({
      imports: [XrLobbyPageComponent],
      providers: [
        provideRouter([]),
        { provide: SimSpaceService,
          useValue: { list: () => Promise.resolve(spaces) } },
        { provide: MultiScaleSimDefinitionService,
          useValue: { allConfigList$: msimList$,
                      fetchAllConfigs: jasmine.createSpy(),
                      loadByName: () => of(msimConfig) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(XrLobbyPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('pages sim spaces with big buttons instead of scrolling', () => {
    expect(component.spaces.length).toBe(7);
    expect(component.pagedSpaces.length).toBe(6);
    expect(component.spacePages).toBe(2);
    component.spacePage = 1;
    expect(component.pagedSpaces.length).toBe(1);
    expect(component.pagedSpaces[0].name).toBe('space-6');
  });

  it('renders giant space cards linking to the slim viewer', () => {
    const cards = fixture.nativeElement
      .querySelectorAll('a.card');
    expect(cards.length).toBe(6);
    expect(cards[0].getAttribute('href'))
      .toContain('/xr/view/space-0');
  });

  it('expands an msim to its panels\' DEDUPED bound spaces (the '
     + 'XR-enterable things — members are simulation refs)', () => {
    component.toggleMsim('wax-multiscale');
    expect(component.expandedSpaces)
      .toEqual(['wax-space', 'selector-space']);
    expect(component.expandedNote).toBe('');
  });

  it('an msim with no bound spaces reports the honest gap', () => {
    msimConfig.panels = [{ kind: 'graph' }];
    component.toggleMsim('wax-multiscale');
    expect(component.expandedSpaces).toEqual([]);
    expect(component.expandedNote).toContain('honest gap');
  });

  it('collapses on a second toggle', () => {
    component.toggleMsim('wax-multiscale');
    component.toggleMsim('wax-multiscale');
    expect(component.expandedMsim).toBeNull();
  });
});
