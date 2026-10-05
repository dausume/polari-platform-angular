import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatIconModule } from '@angular/material/icon';

import { HwInterfaceOverlayComponent } from './hw-interface-overlay.component';
import { StateOverlayShellComponent } from '../../_shared/state-overlay/state-overlay-shell.component';
import { StateOverlayInteractionsDirective } from '../../_shared/state-overlay/state-overlay-interactions.directive';
import { PolariService } from '@services/polari-service';

/**
 * hn-0 — THE hw-interface OVERLAY: the split point between the board and the backend.
 *
 * What must hold: the node reads its HardwareInterfaceBinding from GET /api/hwnocode/interface?binding=… and shows the
 * row it ties, the board instance ⇄ port, the bridge, frames seen and refused (refused frames highlighted) and the
 * "split point" badge; when the binding cannot be read it falls back to the node's own fields and SAYS so; editing
 * the binding emits fieldValuesChanged.
 */
describe('HwInterfaceOverlayComponent (hn-0)', () => {
  const BASE = 'http://backend.test';
  const BINDING = 'uno-temp-split/SimRigState/0';
  const URL = `${BASE}/api/hwnocode/interface?binding=${encodeURIComponent(BINDING)}`;
  const FIELDS = { binding: BINDING, object_class: 'SimRigState', object_name: 'uno-digital-twin', bridge_name: 'uno-temp-split',
                   board_instance: 'twin:arduino-uno-r3#0', port: '/tmp/polari-uno-twin-uart', interface_kind: 'twin-pty' };
  let fixture: ComponentFixture<HwInterfaceOverlayComponent>;
  let comp: HwInterfaceOverlayComponent;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [HwInterfaceOverlayComponent, StateOverlayShellComponent, StateOverlayInteractionsDirective],
      imports: [MatIconModule],
      providers: [provideHttpClient(), provideHttpClientTesting(),
                  { provide: PolariService, useValue: { getBackendBaseUrl: () => BASE, backendRequestOptions: {} } }],
    }).compileComponents();
    fixture = TestBed.createComponent(HwInterfaceOverlayComponent);
    comp = fixture.componentInstance;
    fixture.componentRef.setInput('boundObjectFieldValues', FIELDS);
    fixture.componentRef.setInput('width', 260);
    fixture.componentRef.setInput('placement', 'bridge');
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('shows the live binding: row, board instance ⇄ port, bridge, frames seen / refused, the split-point badge', () => {
    http.expectOne(URL).flush({ ok: true, placement: 'bridge', binding: {
      name: BINDING, bridge_name: 'uno-temp-split', object_class: 'SimRigState', object_name: 'uno-digital-twin',
      board_instance: 'twin:arduino-uno-r3#0', board_definition: 'arduino-uno-r3', interface_kind: 'twin-pty', interface_name: 'usart0',
      port: '/tmp/polari-uno-twin-uart', instance_index: 0, frames_seen: 120, refused_frames: 2, last_seen_at: '2026-10-03T13:00:00' } });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(comp.live).toBeTrue();
    expect(el.querySelector('.state-overlay-header__title')?.textContent).toContain('SimRigState · uno-digital-twin');
    expect(el.querySelector('.hw-line')?.textContent?.replace(/\s+/g, ' ')).toContain('twin:arduino-uno-r3#0 ⇄ /tmp/polari-uno-twin-uart');
    expect(el.querySelector('.hw-frames')?.textContent).toContain('120');
    expect(el.querySelector('.hw-refused')?.classList).toContain('hw-refused--some');
    expect(el.querySelector('.hw-badge--split')?.textContent).toContain('split point');
    expect(el.textContent).not.toContain('{');
  });

  it('a binding not on this node → the node\'s own fields, said plainly; frames rows hidden (not live)', () => {
    http.expectOne(URL).flush({ ok: false, error: 'no HardwareInterfaceBinding' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(comp.live).toBeFalse();
    expect(el.textContent).toContain("showing the node's fields");
    expect(el.querySelector('.hw-line')?.textContent).toContain('/tmp/polari-uno-twin-uart');
    expect(el.querySelector('.hw-frames')).toBeNull();
  });

  it('editing the binding emits fieldValuesChanged and re-reads', () => {
    http.expectOne(URL).flush({ ok: true, binding: null });
    const emitted: any[] = [];
    comp.fieldValuesChanged.subscribe(v => emitted.push(v));
    comp.onBindingChange('uno-pair/SimRigState/1');
    expect(emitted).toEqual([{ binding: 'uno-pair/SimRigState/1' }]);
    http.expectOne(`${BASE}/api/hwnocode/interface?binding=${encodeURIComponent('uno-pair/SimRigState/1')}`).flush({ ok: true, binding: null });
  });
});
