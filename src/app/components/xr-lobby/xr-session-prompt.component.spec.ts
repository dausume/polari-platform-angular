import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { XrSessionPromptComponent } from './xr-session-prompt.component';
import { XrCapabilityService } from '@services/xr/xr-capability.service';

const CHOICE_KEY = 'polari-xr-prompt-choice';

/** Session-start XR offer: once per session, choice remembered. */
describe('XrSessionPromptComponent', () => {
  let fixture: ComponentFixture<XrSessionPromptComponent>;
  let component: XrSessionPromptComponent;
  const navigateSpy = jasmine.createSpy('navigate');
  let vr = true;

  beforeEach(async () => {
    sessionStorage.removeItem(CHOICE_KEY);
    navigateSpy.calls.reset();
    vr = true;
    await TestBed.configureTestingModule({
      imports: [XrSessionPromptComponent],
      providers: [
        { provide: XrCapabilityService,
          useValue: { capability: () => Promise.resolve(
              { vr, ar: false, reason: '' }) } },
        { provide: Router,
          useValue: { url: '/', navigate: navigateSpy } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(XrSessionPromptComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => sessionStorage.removeItem(CHOICE_KEY));

  async function render(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('prompts once on a VR device', async () => {
    await render();
    expect(component.visible).toBeTrue();
    expect(fixture.nativeElement.textContent)
      .toContain('XR headset detected');
  });

  it('never prompts on a flat device', async () => {
    vr = false;
    await render();
    expect(component.visible).toBeFalse();
  });

  it('accept navigates to /xr and remembers the choice', async () => {
    await render();
    component.choose(true);
    expect(navigateSpy).toHaveBeenCalledWith(['/xr']);
    expect(sessionStorage.getItem(CHOICE_KEY)).toBe('xr');
  });

  it('decline hides, remembers, and never navigates', async () => {
    await render();
    component.choose(false);
    expect(component.visible).toBeFalse();
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(CHOICE_KEY)).toBe('flat');
  });

  it('a stored choice suppresses the prompt for the session',
     async () => {
    sessionStorage.setItem(CHOICE_KEY, 'flat');
    await render();
    expect(component.visible).toBeFalse();
  });
});
