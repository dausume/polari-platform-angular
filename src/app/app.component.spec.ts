// app.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { AppComponent } from './app.component';
import { PolariService } from '@services/polari-service';
import { ClassTypingService } from '@services/class-typing-service';
import { CRUDEservicesManager } from '@services/crude-services-manager';
import { of } from 'rxjs';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

describe('AppComponent', () => {
  let mockPolariService: jasmine.SpyObj<PolariService>;
  let mockClassTypingService: jasmine.SpyObj<ClassTypingService>;
  let mockCRUDEservicesManager: jasmine.SpyObj<CRUDEservicesManager>;

  beforeEach(async () => {
    // Create mock observables with unsubscribe method
    const mockConnectionSubject = of(false);
    (mockConnectionSubject as any).unsubscribe = jasmine.createSpy('unsubscribe');

    const mockNavComponents = of([]);
    (mockNavComponents as any).unsubscribe = jasmine.createSpy('unsubscribe');

    const mockNavComponentsBehavior = of([]);
    (mockNavComponentsBehavior as any).unsubscribe = jasmine.createSpy('unsubscribe');

    // Create mock services with the required observables and methods
    mockPolariService = jasmine.createSpyObj('PolariService', ['connect'], {
      connectionSuccessSubject: mockConnectionSubject,
      navComponents: mockNavComponents
    });

    mockClassTypingService = jasmine.createSpyObj('ClassTypingService', ['getTyping'], {
      navComponentsBehaviorSubject: mockNavComponentsBehavior
    });

    mockCRUDEservicesManager = jasmine.createSpyObj('CRUDEservicesManager', ['getCRUDE']);

    await TestBed.configureTestingModule({
      imports: [
        RouterTestingModule,
        HttpClientTestingModule,
        MatSidenavModule,
        MatListModule,
        MatIconModule,
        BrowserAnimationsModule
      ],
      declarations: [
        AppComponent
      ],
      providers: [
        { provide: PolariService, useValue: mockPolariService },
        { provide: ClassTypingService, useValue: mockClassTypingService },
        { provide: CRUDEservicesManager, useValue: mockCRUDEservicesManager }
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have as title 'polari-platform'`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('polari-platform');
  });

  it('should initialize with default values', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.sideNavOpened).toBe(false);
    expect(app.isConnected).toBe(false);
    expect(app.currentComponentTitle).toBe('Home');
  });
});
