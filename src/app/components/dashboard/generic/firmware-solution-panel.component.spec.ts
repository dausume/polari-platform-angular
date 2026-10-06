import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { FirmwareSolutionPanelComponent } from './firmware-solution-panel.component';
import { PolariService } from '@services/polari-service';

/**
 * fs-1b — fixtures below are a REAL `GET /api/firmware/solutions/uno-sim-rig` response (captured from an in-process
 * liveboot, `tests/cmod_liveboot_probe.py`'s own boot) and a REAL `GET /api/board/arduino-uno-r3/pinmap.svg`
 * fragment (the D13/A1/D6 pin cells byte-for-byte, `pinmap_svg.py`'s own `data-pin` attributes) — not invented
 * shapes. What must hold: the panel renders all four DERIVED lanes plus the pin map; dragging an unbound target
 * chip onto a pin posts the EXACT assign body fs-0's door expects; a drop that would conflict with another task's
 * pin already on that BoardPin is refused — named, never posted.
 */
describe('FirmwareSolutionPanelComponent', () => {
  let fixture: ComponentFixture<FirmwareSolutionPanelComponent>;
  let component: FirmwareSolutionPanelComponent;
  let posts: Array<{ url: string; body: any }>;

  const SOLUTION = {
    name: 'uno-sim-rig', title: 'UNO sim-rig firmware', graph: 'uno-sim-rig-graph', board_definition: 'arduino-uno-r3',
    board_variable: '', runtime: 'c-device', status: 'validated', last_build: '', board_resolved: 'arduino-uno-r3',
    board_exists: true, validation: 'ok',
    validation_why: "ok: board arduino-uno-r3 resolved (fixed board_definition 'arduino-uno-r3' (not checked against a "
      + "live register here)); 16 target(s), 5 unbound (tick_init, led_init, rx_pop, clock.return, temp.return)",
    task_count: 13,
    purpose: "The firmware-only half of the sim-rig: tasks = the 13 atoms of uno-sim-rig-graph, scheduled by their own "
      + "ISR/tick/loop/init annotations (never authored), registers bound to arduino-uno-r3's pin map (A0/D6/D13/D0/D1); "
      + "temp_c and uptime_ms are memory-field targets, exposed unbound (fs-0, his message 2026-10-05).",
    notes: '',
  };

  // real ScheduleSlot rows (trimmed notes where irrelevant to the test) — all 4 lanes + `called` present
  const SCHEDULE = [
    { name: 'uno-sim-rig:called:led', solution: 'uno-sim-rig', task: 'led', lane: 'called', order: 12, trigger: 'called by another task (not scheduled directly)', period_ms: 0, measured_cycles: -1, isr_vector: '', provenance: 'derived', notes: 'text_bytes_noinline=12 B, stack_bytes=2 (CFunctionAtom.cost; no per-atom cycle count yet)' },
    { name: 'uno-sim-rig:called:pwm', solution: 'uno-sim-rig', task: 'pwm', lane: 'called', order: 13, trigger: 'called by another task (not scheduled directly)', period_ms: 0, measured_cycles: -1, isr_vector: '', provenance: 'derived', notes: 'text_bytes_noinline=130 B, stack_bytes=10 (CFunctionAtom.cost; no per-atom cycle count yet)' },
    { name: 'uno-sim-rig:init:usart_init', solution: 'uno-sim-rig', task: 'usart_init', lane: 'init', order: 1, trigger: '', period_ms: 0, measured_cycles: -1, isr_vector: '', provenance: 'derived', notes: 'text_bytes_noinline=30 B, stack_bytes=2 (CFunctionAtom.cost; no per-atom cycle count yet)' },
    { name: 'uno-sim-rig:init:tick_init', solution: 'uno-sim-rig', task: 'tick_init', lane: 'init', order: 2, trigger: '', period_ms: 0, measured_cycles: -1, isr_vector: '', provenance: 'derived', notes: 'text_bytes_noinline=24 B, stack_bytes=2 (CFunctionAtom.cost; no per-atom cycle count yet)' },
    { name: 'uno-sim-rig:init:led_init', solution: 'uno-sim-rig', task: 'led_init', lane: 'init', order: 3, trigger: '', period_ms: 0, measured_cycles: -1, isr_vector: '', provenance: 'derived', notes: 'text_bytes_noinline=4 B, stack_bytes=2 (CFunctionAtom.cost; no per-atom cycle count yet)' },
    { name: 'uno-sim-rig:init:pwm_init', solution: 'uno-sim-rig', task: 'pwm_init', lane: 'init', order: 4, trigger: '', period_ms: 0, measured_cycles: -1, isr_vector: '', provenance: 'derived', notes: 'text_bytes_noinline=14 B, stack_bytes=2 (CFunctionAtom.cost; no per-atom cycle count yet)' },
    { name: 'uno-sim-rig:init:adc_init', solution: 'uno-sim-rig', task: 'adc_init', lane: 'init', order: 5, trigger: '', period_ms: 0, measured_cycles: -1, isr_vector: '', provenance: 'derived', notes: 'text_bytes_noinline=14 B, stack_bytes=2 (CFunctionAtom.cost; no per-atom cycle count yet)' },
    { name: 'uno-sim-rig:isr:hal.INT0_vect', solution: 'uno-sim-rig', task: 'hal.INT0_vect', lane: 'isr', order: 0, trigger: 'INT0_vect', period_ms: 0, measured_cycles: -1, isr_vector: 'INT0_vect', provenance: 'derived', notes: 'always linked into the glue (project-level ISR, not wired as a graph node)' },
    { name: 'uno-sim-rig:isr:hal.TIMER2_COMPA_vect', solution: 'uno-sim-rig', task: 'hal.TIMER2_COMPA_vect', lane: 'isr', order: 1, trigger: 'TIMER2_COMPA_vect', period_ms: 0, measured_cycles: -1, isr_vector: 'TIMER2_COMPA_vect', provenance: 'derived', notes: 'always linked into the glue' },
    { name: 'uno-sim-rig:isr:hal.USART_RX_vect', solution: 'uno-sim-rig', task: 'hal.USART_RX_vect', lane: 'isr', order: 2, trigger: 'USART_RX_vect', period_ms: 0, measured_cycles: -1, isr_vector: 'USART_RX_vect', provenance: 'derived', notes: 'always linked into the glue' },
    { name: 'uno-sim-rig:loop:rx_pop', solution: 'uno-sim-rig', task: 'rx_pop', lane: 'loop', order: 10, trigger: '', period_ms: 0, measured_cycles: -1, isr_vector: '', provenance: 'derived', notes: 'text_bytes_noinline=52 B, stack_bytes=2 (CFunctionAtom.cost; no per-atom cycle count yet)' },
    { name: 'uno-sim-rig:loop:apply', solution: 'uno-sim-rig', task: 'apply', lane: 'loop', order: 11, trigger: '', period_ms: 0, measured_cycles: -1, isr_vector: '', provenance: 'derived', notes: 'text_bytes_noinline=192 B, stack_bytes=92 (CFunctionAtom.cost; no per-atom cycle count yet)' },
    { name: 'uno-sim-rig:loop:clock', solution: 'uno-sim-rig', task: 'clock', lane: 'loop', order: 20, trigger: '', period_ms: 0, measured_cycles: -1, isr_vector: '', provenance: 'derived', notes: 'text_bytes_noinline=54 B, stack_bytes=2 (CFunctionAtom.cost; no per-atom cycle count yet)' },
    { name: 'uno-sim-rig:loop:adc', solution: 'uno-sim-rig', task: 'adc', lane: 'loop', order: 22, trigger: '', period_ms: 0, measured_cycles: -1, isr_vector: '', provenance: 'derived', notes: 'text_bytes_noinline=36 B, stack_bytes=2 (CFunctionAtom.cost; no per-atom cycle count yet)' },
    { name: 'uno-sim-rig:loop:temp', solution: 'uno-sim-rig', task: 'temp', lane: 'loop', order: 23, trigger: '', period_ms: 0, measured_cycles: -1, isr_vector: '', provenance: 'derived', notes: 'text_bytes_noinline=48 B, stack_bytes=2 (CFunctionAtom.cost; no per-atom cycle count yet)' },
    { name: 'uno-sim-rig:loop:send', solution: 'uno-sim-rig', task: 'send', lane: 'loop', order: 26, trigger: '', period_ms: 0, measured_cycles: -1, isr_vector: '', provenance: 'derived', notes: 'text_bytes_noinline=34 B, stack_bytes=2 (CFunctionAtom.cost; no per-atom cycle count yet)' },
    { name: 'uno-sim-rig:tick:telemetry', solution: 'uno-sim-rig', task: 'telemetry', lane: 'tick', order: 21, trigger: 'period_ms=TELEMETRY_MS', period_ms: 0, measured_cycles: -1, isr_vector: '', provenance: 'derived', notes: "period macro 'TELEMETRY_MS' (resolved in board_config.h, not re-typed here)" },
  ];

  // real RegisterAssignment rows (D-fs-2) — temp.return / clock.return stay unbound (the drag targets); D13 is
  // already bound to 'led' (apply is a dispatcher, exempted from conflict ownership the same way fs-0 derives it).
  const ASSIGNMENTS = [
    { name: 'uno-sim-rig:clock.return', solution: 'uno-sim-rig', task: 'clock', port: 'return', target_kind: 'memory-field', controls: 'SimRigState.uptime_ms <- milliseconds since hal_tick_init', lives_on: 'unbound', status: 'unbound', provenance: 'derived', notes: '' },
    { name: 'uno-sim-rig:temp.return', solution: 'uno-sim-rig', task: 'temp', port: 'return', target_kind: 'memory-field', controls: 'SimRigState.temp_c <- TMP36 temperature', lives_on: 'unbound', status: 'unbound', provenance: 'derived', notes: '' },
    { name: 'uno-sim-rig:apply.r', solution: 'uno-sim-rig', task: 'apply', port: 'r', target_kind: 'pin', controls: "apply a command's actuator fields — touches D13", lives_on: 'arduino-uno-r3:D13', status: 'bound', provenance: 'annotation', notes: '' },
    { name: 'uno-sim-rig:apply.r', solution: 'uno-sim-rig', task: 'apply', port: 'r', target_kind: 'pin', controls: "apply a command's actuator fields — touches D6", lives_on: 'arduino-uno-r3:D6', status: 'bound', provenance: 'annotation', notes: '' },
    { name: 'uno-sim-rig:rx_pop', solution: 'uno-sim-rig', task: 'rx_pop', port: '', target_kind: 'pin', controls: 'pop one byte from the USART0 RX ring', lives_on: 'unbound', status: 'unbound', provenance: 'annotation', notes: '' },
    { name: 'uno-sim-rig:adc.channel', solution: 'uno-sim-rig', task: 'adc', port: 'channel', target_kind: 'register', controls: 'A0..A5 — touches A0', lives_on: 'arduino-uno-r3:A0', status: 'bound', provenance: 'annotation', notes: '' },
    { name: 'uno-sim-rig:led.on', solution: 'uno-sim-rig', task: 'led', port: 'on', target_kind: 'register', controls: 'set the LED on LED_PIN — touches D13', lives_on: 'arduino-uno-r3:D13', status: 'bound', provenance: 'annotation', notes: '' },
    { name: 'uno-sim-rig:led_init', solution: 'uno-sim-rig', task: 'led_init', port: '', target_kind: 'register', controls: 'hal_led_init', lives_on: 'unbound', status: 'unbound', provenance: 'annotation', notes: '' },
    { name: 'uno-sim-rig:pwm.duty', solution: 'uno-sim-rig', task: 'pwm', port: 'duty', target_kind: 'register', controls: 'set the PWM duty — touches D6', lives_on: 'arduino-uno-r3:D6', status: 'bound', provenance: 'annotation', notes: '' },
    { name: 'uno-sim-rig:tick_init', solution: 'uno-sim-rig', task: 'tick_init', port: '', target_kind: 'register', controls: 'hal_tick_init', lives_on: 'unbound', status: 'unbound', provenance: 'annotation', notes: '' },
  ];

  // real pinmap.svg fragment — byte-for-byte the D13 / A1 / D6 `<g>` cells `GET /api/board/arduino-uno-r3/pinmap.svg`
  // produced from pinmap_svg.py's own `data-pin` attributes (fs-1b's addition), wrapped in a minimal real <svg>.
  const PINMAP_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 300" width="600" height="300">'
    + '<g class="pin-cell" data-pin="D13" data-role="led"><title>LED_PIN: net=LED_BUILTIN</title>'
    + '<rect x="202" y="176" width="170" height="26" fill="#f9a825" fill-opacity="0.16" stroke="#f9a825" data-pin="D13"/>'
    + '<text x="208" y="187" font-weight="bold">D13</text><text x="208" y="198" font-size="9" fill="#37474f">PB5 / LED_BUILTIN</text></g>'
    + '<g class="pin-cell" data-pin="A1" data-role="gpio"><title>net=A1</title>'
    + '<rect x="16" y="72" width="170" height="26" fill="#78909c" fill-opacity="0.16" stroke="#78909c" data-pin="A1"/>'
    + '<text x="22" y="83" font-weight="bold">A1</text><text x="22" y="94" font-size="9" fill="#37474f">PC1 / A1</text></g>'
    + '<g class="pin-cell" data-pin="D6" data-role="pwm"><title>PWM_PIN: net=PWM_LED</title>'
    + '<rect x="388" y="202" width="170" height="26" fill="#e65100" fill-opacity="0.16" stroke="#e65100" data-pin="D6"/>'
    + '<text x="394" y="213" font-weight="bold">D6</text><text x="394" y="224" font-size="9" fill="#37474f">PD6 / PWM_LED</text></g>'
    + '</svg>';

  function httpGet(url: string): any {
    if (url.endsWith('/pinmap.svg')) { return of(PINMAP_SVG); }
    if (url.endsWith('/api/firmware/solutions')) { return of({ ok: true, solutions: [{ name: 'uno-sim-rig', title: 'UNO sim-rig firmware' }] }); }
    if (url.endsWith('/api/firmware/solutions/uno-sim-rig')) {
      return of({ ok: true, solution: SOLUTION, schedule: SCHEDULE, assignments: ASSIGNMENTS, validation: { ok: true, why: SOLUTION.validation_why }, builds: [] });
    }
    return of({ ok: false, error: 'unexpected GET ' + url });
  }

  beforeEach(async () => {
    posts = [];
    await TestBed.configureTestingModule({
      imports: [FirmwareSolutionPanelComponent],
      providers: [
        { provide: HttpClient, useValue: {
            get: (url: string) => httpGet(url),
            post: (url: string, body: any) => { posts.push({ url, body }); return of({ ok: true, assignment: { ...body, status: body.lives_on === 'unbound' ? 'unbound' : 'bound' } }); },
          } },
        { provide: PolariService, useValue: { getBackendBaseUrl: () => '', backendRequestOptions: {} } },
        provideRouter([]),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(FirmwareSolutionPanelComponent);
    component = fixture.componentInstance;
  });

  const laneEls = () => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.fsp-lane'));
  const pinEl = (pin: string) => (fixture.nativeElement as HTMLElement).querySelector(`[data-pin="${pin}"]`) as Element;
  const chipByTask = (task: string) => component.unboundTargets.find(a => a.task === task)!;

  it('renders all four DERIVED lanes (init/isr/tick/loop, called nested under its caller) and the inlined pin map', () => {
    fixture.detectChanges();
    const lanes = laneEls();
    expect(lanes.length).toBe(4);
    const labels = lanes.map(l => l.querySelector('.fsp-lane-label')!.textContent!.trim());
    expect(labels).toEqual(['init', 'isr', 'tick', 'loop']);
    // the pin map is inlined (api-svg-panel's own approach) with pinmap_svg.py's data-pin attributes intact
    expect(pinEl('D13')).toBeTruthy();
    expect(pinEl('A1')).toBeTruthy();
    // called tasks (led, pwm — order 12/13) nest under 'apply' (order 11, the nearest preceding non-called task)
    const loopLane = lanes[3];
    expect(loopLane.textContent).toContain('apply');
    expect(loopLane.textContent).toContain('led');
    expect(loopLane.textContent).toContain('called — not scheduled directly');
  });

  it('a drop on an UNUSED pin posts the exact assign body fs-0\'s door expects, then re-fetches', () => {
    fixture.detectChanges();
    const temp = chipByTask('temp');
    component.onDragStart({ dataTransfer: { setData: () => {} } } as any, temp);
    component.onDrop({ preventDefault: () => {}, target: pinEl('A1') } as any);
    expect(posts.length).toBe(1);
    expect(posts[0].url).toBe('/api/firmware/solutions/uno-sim-rig/assign');
    expect(posts[0].body).toEqual({ task: 'temp', port: 'return', lives_on: 'arduino-uno-r3:A1' });
    expect(component.conflictMessage).toBe('');
  });

  it('the keyboard fallback (select a chip, then click a pin) posts the same body', () => {
    fixture.detectChanges();
    const temp = chipByTask('temp');
    component.selectChip(temp);
    component.onPinClick({ target: pinEl('A1') } as any);
    expect(posts.length).toBe(1);
    expect(posts[0].body).toEqual({ task: 'temp', port: 'return', lives_on: 'arduino-uno-r3:A1' });
  });

  it('a drop that would CONFLICT with another task already on that pin is refused — named, never posted', () => {
    fixture.detectChanges();
    const temp = chipByTask('temp');   // unbound; D13 is already bound (both 'apply' and 'led' claim it — a real,
                                        // cooperating multi-owner pin: apply dispatches to led, fs-0's own posture)
    component.onDragStart({ dataTransfer: { setData: () => {} } } as any, temp);
    component.onDrop({ preventDefault: () => {}, target: pinEl('D13') } as any);
    expect(posts.length).toBe(0);
    expect(component.conflictMessage).toContain('temp.return');
    expect(component.conflictMessage).toContain('D13');
    // names the FIRST task already bound there (apply.r) — never silently overwritten
    expect(component.conflictMessage).toMatch(/apply\.r|led\.on/);
  });
});
