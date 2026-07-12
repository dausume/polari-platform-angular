import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';

import { XrEntryBannerComponent } from './xr-entry-banner.component';
import { XrCapabilityService } from '@services/xr/xr-capability.service';
import { XrEngineService } from '@services/xr/xr-engine.service';
import { XrSettingsService } from '@services/xr/xr-settings.service';

/** The Enter-XR bar: DEVICE capability decides it exists; the
 *  space's resolved mode is a label, never invisibility (the old
 *  button rendered nothing for mode 'none' — undiscoverable). */
describe('XrEntryBannerComponent', () => {
  let fixture: ComponentFixture<XrEntryBannerComponent>;
  let component: XrEntryBannerComponent;
  let capability: { vr: boolean; ar: boolean; reason: string };
  const state$ = new BehaviorSubject(
    { active: false, boundEntryId: null as string | null,
      entering: false, lastError: null as string | null });
  const enterSpy = jasmine.createSpy('enter');
  const exitSpy = jasmine.createSpy('exit');

  beforeEach(async () => {
    capability = { vr: true, ar: false, reason: '' };
    state$.next({ active: false, boundEntryId: null,
                  entering: false, lastError: null });
    enterSpy.calls.reset();
    await TestBed.configureTestingModule({
      imports: [XrEntryBannerComponent],
      providers: [
        { provide: XrCapabilityService,
          useValue: { capability: () =>
              Promise.resolve(capability) } },
        { provide: XrEngineService,
          useValue: { state$, enter: enterSpy, exit: exitSpy } },
        { provide: XrSettingsService,
          useValue: { resolve: () => Promise.resolve(
              { mode: 'none', modeResolvedFrom: 'global' }) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(XrEntryBannerComponent);
    component = fixture.componentInstance;
  });

  async function render(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('shows ENTER VR for a 3D scene on a VR device even when the '
     + 'space mode resolves to none (label, not invisibility)',
     async () => {
    component.spaceName = 'demo-3d';
    component.entryId = 'entry-1';
    await render();
    const button = fixture.nativeElement.querySelector('.enter');
    expect(button).withContext('the enter button').toBeTruthy();
    expect(button.textContent).toContain('ENTER VR');
    expect(component.modeNote).toContain('none');
    button.click();
    expect(enterSpy).toHaveBeenCalledWith(
      'entry-1', { multiscaleName: undefined });
  });

  it('renders nothing on a 2D space (no XR chatter)', async () => {
    component.spaceName = 'flat-2d';
    component.dimensionality = 2;
    component.entryId = null;
    await render();
    expect(fixture.nativeElement.querySelector('.banner'))
      .toBeNull();
  });

  it('renders nothing on a device without XR', async () => {
    capability.vr = false;
    component.spaceName = 'demo-3d';
    component.entryId = 'entry-1';
    await render();
    expect(fixture.nativeElement.querySelector('.banner'))
      .toBeNull();
  });

  it('offers EXIT VR while its own scene is bound', async () => {
    component.spaceName = 'demo-3d';
    component.entryId = 'entry-1';
    state$.next({ active: true, boundEntryId: 'entry-1',
                  entering: false, lastError: null });
    await render();
    const button = fixture.nativeElement.querySelector('.exit');
    expect(button).toBeTruthy();
    button.click();
    expect(exitSpy).toHaveBeenCalled();
  });
});
