import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, of } from 'rxjs';

import { ExecutionPanelComponent } from './execution-panel.component';
import { SolutionExecutionService } from '@services/no-code-services/solution-execution.service';
import { RuntimeConfigService } from '@services/runtime-config.service';

/** The Object picker lists the rows of the solution's target class; a run is started ON the picked row
 *  (`object` = its name + its plain fields such as led_on), so "instanceRef did not resolve" cannot happen. */
describe('ExecutionPanelComponent — Object row picker', () => {
  let fixture: ComponentFixture<ExecutionPanelComponent>;
  let component: ExecutionPanelComponent;
  let started: any[];
  let gets: string[];

  beforeEach(async () => {
    started = []; gets = [];
    const svc: any = {
      executionStatus$: new BehaviorSubject('idle'), currentStep$: new BehaviorSubject(null), currentStepIndex$: new BehaviorSubject(-1),
      totalSteps$: new BehaviorSubject(0), isPlaying$: new BehaviorSubject(false), playbackSpeed$: new BehaviorSubject(1000),
      executionTrace$: new BehaviorSubject(null), activeStateName$: new BehaviorSubject(null),
      startExecution: (...a: any[]) => { started.push(a); return of({}); },
    };
    await TestBed.configureTestingModule({
      imports: [FormsModule], declarations: [ExecutionPanelComponent], schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: SolutionExecutionService, useValue: svc },
        { provide: RuntimeConfigService, useValue: { getBackendBaseUrl: () => 'http://b' } },
        { provide: HttpClient, useValue: { get: (u: string) => { gets.push(u); return of([{ LightState: [{ data: [
          { id: 'x1', name: 'uno-light', led_on: true, toggles: 3, status: 'idle', class: 'LightState' }] }] }]); } } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ExecutionPanelComponent);
    component = fixture.componentInstance;
    component.solutionName = 'light-toggle';
    component.targetClassName = 'LightState';
  });

  it('lists the target class rows, selects the first, and runs ON it (object + its led_on)', () => {
    fixture.detectChanges();
    expect(gets).toEqual(['http://b/LightState']);
    expect(component.selectedObjectName).toBe('uno-light');
    const sel = (fixture.nativeElement as HTMLElement).querySelector('.object-row select') as HTMLSelectElement;
    expect(sel.textContent).toContain('uno-light');
    component.execute();
    const params = started[0][1];
    expect(params['object']).toBe('uno-light');
    expect(params['led_on']).toBeTrue();
    expect(params['id']).toBeUndefined();
  });

  it('shows no picker for a solution that acts on no class', () => {
    component.targetClassName = '';
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.object-row')).toBeNull();
    expect(gets.length).toBe(0);
  });
});
