/**
 * Unit tests for DisplaysComponent — the config/data-driven display
 * list. Uses a mocked DisplayManagerService (BehaviorSubjects) so the
 * component's reactive wiring is verified without a backend.
 * NO_ERRORS_SCHEMA ignores unrelated child components in the template.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Router } from '@angular/router';

import { DisplaysComponent } from './displays.component';
import { DisplayManagerService } from '@services/dashboard/display-manager.service';
import { DisplaySummary } from '@models/dashboards/DisplaySummary';

describe('DisplaysComponent', () => {
  let fixture: ComponentFixture<DisplaysComponent>;
  let component: DisplaysComponent;
  let managerStub: any;

  const sampleDisplays: DisplaySummary[] = [
    { id: 'd1', name: 'Widget Form' } as DisplaySummary,
    { id: 'd2', name: 'Chart Page' } as DisplaySummary,
  ];

  beforeEach(async () => {
    managerStub = {
      displayList$: new BehaviorSubject<DisplaySummary[]>([]),
      publishedDisplays$: new BehaviorSubject<DisplaySummary[]>([]),
      loading$: new BehaviorSubject<boolean>(false),
      fetchDisplayList: jasmine.createSpy('fetchDisplayList'),
      fetchPublishedDisplays: jasmine.createSpy('fetchPublishedDisplays'),
    };

    await TestBed.configureTestingModule({
      declarations: [DisplaysComponent],
      providers: [
        { provide: DisplayManagerService, useValue: managerStub },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(DisplaysComponent);
    component = fixture.componentInstance;
  });

  it('creates and defaults to the all-displays tab', () => {
    expect(component).toBeTruthy();
    expect(component.activeTab).toBe('all-displays');
  });

  it('fetches lists and reflects manager state on init', () => {
    fixture.detectChanges(); // triggers ngOnInit
    expect(managerStub.fetchDisplayList).toHaveBeenCalled();
    expect(managerStub.fetchPublishedDisplays).toHaveBeenCalled();

    managerStub.displayList$.next(sampleDisplays);
    managerStub.loading$.next(true);
    expect(component.allDisplays.length).toBe(2);
    expect(component.loading).toBe(true);
  });

  it('setActiveTab switches tabs and refetches on published-pages', () => {
    fixture.detectChanges();
    managerStub.fetchPublishedDisplays.calls.reset();

    component.setActiveTab('forms');
    expect(component.activeTab).toBe('forms');
    expect(managerStub.fetchPublishedDisplays).not.toHaveBeenCalled();

    component.setActiveTab('published-pages');
    expect(component.activeTab).toBe('published-pages');
    expect(managerStub.fetchPublishedDisplays).toHaveBeenCalledTimes(1);
  });
});
