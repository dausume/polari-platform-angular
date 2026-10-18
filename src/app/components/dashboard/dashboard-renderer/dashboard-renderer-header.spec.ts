import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { DisplayRendererComponent } from './dashboard-renderer';
import { Display } from '@models/dashboards/Display';
import { DisplaySolutionRunnerService } from '@services/no-code-services/display-solution-runner.service';
import { DisplayFormFeedbackService } from '@services/no-code-services/display-form-feedback.service';
import { displayHeaderTitle, humanizeName } from '../../../utils/display-title';

/** The page header shows the display's own title when it carries one, else its internal name made readable ("pin-view" -> "Pin view"). */
describe('dashboard header title', () => {
  function header(d: Display): string {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [DisplayRendererComponent],
      providers: [provideRouter([]), { provide: DisplaySolutionRunnerService, useValue: {} }, { provide: DisplayFormFeedbackService, useValue: {} }],
    });
    const fixture = TestBed.createComponent(DisplayRendererComponent);
    fixture.componentInstance.dashboard = d;
    fixture.detectChanges(false);   // the renderer measures its width after view init (a dev-mode checkNoChanges quirk unrelated to the header)
    return (fixture.nativeElement.querySelector('.dashboard-name') as HTMLElement).textContent!.trim();
  }

  it('prefers the display title', () => {
    const d = new Display('x', 'pin-view', '');
    d.title = 'Pin view';
    expect(header(d)).toBe('Pin view');
    const e = new Display('y', 'register-profile', '');
    e.title = 'Register profile (ATmega328P)';
    expect(header(e)).toBe('Register profile (ATmega328P)');
  });

  it('humanizes the internal name when there is no title', () => {
    expect(header(new Display('x', 'pin-view', ''))).toBe('Pin view');
  });

  it('humanizeName: hyphens and underscores become spaces, the first letter is capitalised, prose names are left alone', () => {
    expect(humanizeName('register-profile')).toBe('Register profile');
    expect(humanizeName('memory_map')).toBe('Memory map');
    expect(humanizeName('Meal planner')).toBe('Meal planner');
    expect(humanizeName('nutrition-home')).toBe('Nutrition home');
    expect(humanizeName('')).toBe('');
    expect(displayHeaderTitle({ name: 'pin-view', title: '  ' })).toBe('Pin view');
    expect(displayHeaderTitle(null)).toBe('');
  });
});
