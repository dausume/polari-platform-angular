import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';

import { FirmwareInstallerPanelComponent } from './firmware-installer-panel.component';
import { PolariService } from '@services/polari-service';
import { StompService } from '@services/stomp.service';

/**
 * brd-fi — THE CONFIRM IS FOR ONE COMMAND, AND THE PAGE SHOWS IT.
 *
 * What must hold: the confirm button is disabled until the server has made a
 * plan; the plan's argv is shown exactly as the server wrote it; confirming
 * sends only the plan's NAME and confirm=true (never a command); a refusal's
 * words appear as written; the result is tables, never a JSON wall; and "try
 * another variant" keeps the target and moves on.
 */
describe('FirmwareInstallerPanelComponent', () => {
  let fixture: ComponentFixture<FirmwareInstallerPanelComponent>;
  let component: FirmwareInstallerPanelComponent;
  let posts: Array<{ url: string; body: any }>;
  let postReply: (url: string, body: any) => any;
  let stompTicks: Subject<any>;

  const ARGV = 'polari-avr-twin --hex /w/builds/uno-echo-f05014fd1e3b/firmware.hex --mcu atmega328p --freq 16000000 --tcp 9831 --status-ms 1000 --adc0-mv 750';
  const doc = () => ({
    ok: true, host: 'pol-core', board: 'arduino-uno-r3', scan_note: '0 board(s), 2 adapter(s), 4 unadmitted on pol-core',
    targets: [{ name: 'twin:arduino-uno-r3', kind: 'twin', label: 'the simavr twin of the UNO (this host)', port: '/tmp/polari-uno-twin-uart' }],
    adapters: [{ definition: 'cp2102-usb-uart-modules', by_id_path: '/dev/serial/by-id/usb-Silicon_Labs_CP2102', target_board: '' }],
    variants: [
      { name: 'uno-sim-rig', title: 'The whole rig', purpose: 'TMP36, LED, PWM, commands', app: 'sim_rig', classes_json: '["SimRigState"]', what_to_watch: 'temp_c follows a finger' },
      { name: 'uno-echo', title: 'Echo', purpose: 'the protocol test', app: 'echo', classes_json: '["SimRigState"]', what_to_watch: 'values come back whole' },
    ],
    builds: [
      { name: 'uno-echo-f05014fd1e3b', variant: 'uno-echo', state: 'built', flash_bytes: 3152, flash_max: 32256, ram_bytes: 763, ram_max: 2048,
        flash_pct: 9.8, ram_pct: 37.3, artifact_sha256: 'd4348237e51e851e' + '0'.repeat(48), header_sha256: 'ab', compat: 'compatible',
        compat_why: 'byte-identical', installable: true, engines: 'avr-gcc 14.2.0', built_at: '2026-10-01T20:00:00' },
      { name: 'uno-sim-rig-old', variant: 'uno-sim-rig', state: 'built', flash_bytes: 4532, flash_max: 32256, ram_bytes: 763, ram_max: 2048,
        flash_pct: 14.1, ram_pct: 37.3, artifact_sha256: '53bf', header_sha256: 'cd', compat: 'stale-header',
        compat_why: 'the firmware puts SimRigState on the wire as name, pwm_duty…; this server now expects led_on, name… — they would misread each other\'s bytes',
        installable: false, engines: '', built_at: '2026-10-01T19:00:00' },
    ],
    twin: { state: 'down' }, records: [],
  });
  const result = {
    ok: true, record: 'install-uno-echo-f05014fd1e3b-1', verdict: 'installed', verify: 'simavr loaded 3152 flash bytes; they match',
    variant: 'uno-echo', target_kind: 'twin', bridge_state: 'attached', frames_total: 72, frames_per_s: 9.9,
    frames: [{ seq: 1, device: 3, class: 'SimRigState', values: { name: 'uno-echo', status: 'boot', uptime_ms: '100' } }],
    row_class: 'SimRigState', row_name: 'uno-echo', row: { name: 'uno-echo', status: 'echoed', temp_c: 12.5, id: 'x1' }, firmware_sha: 'd434',
  };

  beforeEach(async () => {
    posts = [];
    stompTicks = new Subject<any>();
    postReply = (url: string) => {
      if (url.endsWith('/plan')) {
        return of({ ok: true, plan: 'plan-uno-echo-1', argv_text: ARGV, wrapper_text: '', engine: 'avr-twin', engine_how: 'local-image',
                    engine_where: 'prf-board-engines:trixie', adapter: '', compat: 'compatible', compat_why: 'byte-identical',
                    will_stamp: 'the twin runs it', target_kind: 'twin', host: 'pol-core', port: '/tmp/polari-uno-twin-uart', state: 'planned' });
      }
      if (url.endsWith('/run')) {
        return of({ ok: true, name: result.record, verdict: 'installed', verify: result.verify, variant: 'uno-echo', target_kind: 'twin',
                    row_class: 'SimRigState', row_name: 'uno-echo', firmware_sha: 'd434' });
      }
      if (url.endsWith('/attach')) { return of({ ok: true, state: 'attaching' }); }
      return of({ ok: true });
    };
    await TestBed.configureTestingModule({
      imports: [FirmwareInstallerPanelComponent],
      providers: [
        { provide: HttpClient, useValue: {
            get: (url: string) => of(url.includes('/result/') ? result : doc()),
            post: (url: string, body: any) => { posts.push({ url, body }); return postReply(url, body); },
          } },
        { provide: PolariService, useValue: { getBackendBaseUrl: () => '', backendRequestOptions: {} } },
        { provide: StompService, useValue: { watchChanges: () => stompTicks.asObservable() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(FirmwareInstallerPanelComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => component.ngOnDestroy());

  const text = () => (fixture.nativeElement as HTMLElement).textContent || '';
  const confirmButton = () => (fixture.nativeElement as HTMLElement).querySelector('button.fip-confirm') as HTMLButtonElement;

  it('shows the targets, the variants with what to watch, and the builds with compat in plain words', () => {
    fixture.detectChanges();
    expect(component.target).toBe('twin:arduino-uno-r3');
    expect(text()).toContain('The twin');
    expect(text()).toContain('Watch for: values come back whole');
    expect(text()).toContain('say which board is wired to it');
    component.pickVariant('uno-sim-rig');
    fixture.detectChanges();
    expect(text()).toContain('stale-header');
    expect(text()).toContain('misread each other');
    expect(component.build).toBe('');   // a stale build is never picked
  });

  it('leads with the Mission sample, folds the scenario builds away, and names the machine (id in a tooltip)', () => {
    fixture.detectChanges();
    const v = (name: string, title: string, group: string) =>
      ({ name, title, purpose: 'p', app: 'light', classes_json: '["LightState"]', what_to_watch: 'w', group });
    component.doc = Object.assign(doc(), { host: '1c859e8274aa', host_label: 'pol-core', variants: [
      v('uno-light', 'The light test', 'sample'), v('uno-echo', 'Echo', 'more'), v('uno-ack-wait', 'SCENARIO ONLY — no timeout', 'scenario'),
    ] }) as any;
    component.variant = 'uno-light';
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const host = el.querySelector('.fip-host strong') as HTMLElement;
    expect(host.textContent).toBe('pol-core');
    expect(host.title).toContain('1c859e8274aa');
    expect(el.querySelector('.fip-host')!.textContent).not.toContain('1c859e8274aa');
    const scen = el.querySelector('details.fip-scenarios') as HTMLDetailsElement;
    expect(scen.open).toBeFalse();
    expect(scen.textContent).toContain('SCENARIO ONLY — no timeout');
    expect(scen.textContent).not.toContain('The light test');
    expect(text().indexOf('The light test')).toBeLessThan(text().indexOf('Echo'));
    component.pickVariant('uno-ack-wait');
    fixture.detectChanges();
    expect(scen.open).toBeTrue();   // a picked scenario build is never hidden
  });

  it('keeps the confirm disabled until a plan exists, then shows the argv VERBATIM', () => {
    fixture.detectChanges();
    component.pickVariant('uno-echo');
    fixture.detectChanges();
    expect(confirmButton().disabled).toBeTrue();
    component.makePlan();
    fixture.detectChanges();
    expect(posts[0].body).toEqual({ instance: 'twin:arduino-uno-r3', build: 'uno-echo-f05014fd1e3b' });
    const code = (fixture.nativeElement as HTMLElement).querySelector('code.fip-cmd')!.textContent!.trim();
    expect(code).toBe(ARGV);
    expect(confirmButton().disabled).toBeFalse();
  });

  it('confirms with the plan NAME and confirm=true only, attaches, and renders the result as tables (no JSON)', () => {
    fixture.detectChanges();
    component.pickVariant('uno-echo');
    component.makePlan();
    component.install();
    fixture.detectChanges();
    const run = posts.find(p => p.url.endsWith('/run'))!;
    expect(run.body).toEqual({ plan: 'plan-uno-echo-1', confirm: true });
    expect(posts.some(p => p.url.endsWith('/attach') && p.body.record === result.record)).toBeTrue();
    stompTicks.next({ className: 'SimRigState', operation: 'update' });
    fixture.detectChanges();
    expect(text()).toContain('9.9 frames/s');
    expect(text()).toContain('echoed');
    expect(component.rowKeys()).not.toContain('id');
    expect(text()).not.toContain('{"');
    expect(confirmButton().disabled).toBeTrue();   // the plan ran — a new install needs a new plan
  });

  it('shows a refusal\'s words as the server wrote them', () => {
    postReply = () => throwError(() => ({ error: { ok: false, error: 'REFUSED (stale-header): regenerate it against this server' } }));
    fixture.detectChanges();
    component.pickVariant('uno-echo');
    component.makePlan();
    fixture.detectChanges();
    expect(text()).toContain('REFUSED (stale-header): regenerate it against this server');
    expect(component.plan).toBeNull();
    expect(confirmButton().disabled).toBeTrue();
  });

  // ---- ins-0/1: the Sim | Real toggle and the confirmed-sim gate
  const gatedDoc = (offered: boolean) => {
    const d = doc() as any;
    d.targets.push({ name: 'pol-core:arduino-uno-r3@001-1', kind: 'board', label: 'UNO at /dev/serial/by-id/usb-Arduino', port: '/dev/serial/by-id/usb-Arduino' });
    d.modes = [{ name: 'sim', title: 'Sim install', target_kind: 'twin', words: 'the simulated board (the twin)' },
               { name: 'real', title: 'Real install', target_kind: 'board', words: 'a detected board on this host' }];
    d.default_mode = 'sim';
    d.attest = 'I checked the simulated board does what the firmware says';
    d.variants.unshift({ name: 'uno-light', title: 'The light test', purpose: 'p', app: 'light', classes_json: '["LightState"]', what_to_watch: 'the LED', group: 'sample' });
    d.builds.unshift({ name: 'uno-light-aaaa', variant: 'uno-light', state: 'built', flash_bytes: 3000, flash_max: 32256, ram_bytes: 700, ram_max: 2048, flash_pct: 9, ram_pct: 34,
      artifact_sha256: 'ab'.repeat(32), header_sha256: 'x', compat: 'compatible', compat_why: 'byte-identical', installable: true, engines: '', built_at: '2026-10-20',
      gate: offered
        ? { gated: true, offered: true, words: 'Real install offered: every Purpose passed on the twin and dustin ticked', missing: [], offer: '', anyway: '' }
        : { gated: true, offered: false, words: 'Real install not offered yet: the sim install has not run every Purpose on the twin yet — 0 of 4 passed; nobody has ticked',
            missing: ['0 of 4 passed', 'nobody has ticked'], offer: 'Do the sim install first: install uno-light into the twin.', anyway: 'A real install anyway is possible: say why.' },
      gate_purposes: [{ purpose: 'initialization', scenario: 'initialization-acceptance', status: offered ? 'proven-on-twin' : 'planned', run: offered ? 'sr-1' : '', ran_at: '', outcome: '', why: '' }],
      gate_confirmation: offered ? { name: 'simconf-uno-light-1', who_words: 'dustin', confirmed_at: '2026-10-20T10:00:00', hex_short: 'abababab', words: 'I checked', state: 'valid', purposes_passed: 4, purposes_total: 4 } : null });
    return d;
  };
  const modeButton = (m: string) => (fixture.nativeElement as HTMLElement).querySelector('button.fip-mode-' + m) as HTMLButtonElement;

  it('ins-0: opens on the document\'s default mode, the toggle relabels the steps and moves the target (twin <-> the detected board)', () => {
    fixture.detectChanges();   // ngOnInit's reload first, so the gated document below is not overwritten by the mock's default
    component.doc = gatedDoc(false); component.variant = 'uno-light'; component.build = 'uno-light-aaaa'; (component as any).modeChosen = true;
    fixture.detectChanges();
    expect(modeButton('sim').classList).toContain('on');
    expect(text()).toContain('Where it goes — the twin');
    expect(text()).toContain('Show me what will run on the twin');
    expect(text()).toContain('Validate on the twin, then confirm what you saw');
    modeButton('real').click();
    fixture.detectChanges();
    expect(component.mode).toBe('real');
    expect(component.target).toBe('pol-core:arduino-uno-r3@001-1');
    expect(text()).toContain('Where it goes — the board');
    expect(text()).toContain('Real install not offered yet');
    expect(text()).toContain('Do the sim install first');
    expect(text()).not.toContain('Validate on the twin');
    modeButton('sim').click();
    fixture.detectChanges();
    expect(component.target).toBe('twin:arduino-uno-r3');
  });

  it('ins-1: a real install the gate does not offer cannot be planned until "install anyway" is ticked WITH a reason, which is sent and shown', () => {
    fixture.detectChanges();   // ngOnInit's reload first, so the gated document below is not overwritten by the mock's default
    component.doc = gatedDoc(false); component.variant = 'uno-light'; component.build = 'uno-light-aaaa'; (component as any).modeChosen = true;
    component.setMode('real');
    fixture.detectChanges();
    const planButton = () => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find(b => /Show me what will run|not offered yet/.test(b.textContent || ''))!;
    expect(planButton().disabled).toBeTrue();
    expect(planButton().textContent).toContain('Real install not offered yet');
    component.anyway = true;
    fixture.detectChanges();
    expect(planButton().disabled).toBeTrue();   // a tick without a reason is not enough
    component.reason = 'bench check of the LED wiring';
    fixture.detectChanges();
    expect(planButton().disabled).toBeFalse();
    postReply = (url: string) => of({ ok: true, plan: 'plan-uno-light-aaaa-1', argv_text: 'avrdude -p atmega328p …', wrapper_text: '', engine: 'avrdude', engine_how: 'local-binary',
      engine_where: '', adapter: '', compat: 'compatible', compat_why: 'ok', will_stamp: 'BoardInstance …', target_kind: 'board', host: 'pol-core', port: '/dev/x', state: 'planned',
      install_mode: 'real', gate: 'overridden', gate_words: 'not offered', override_reason: 'bench check of the LED wiring' });
    component.makePlan();
    fixture.detectChanges();
    expect(posts[0].body).toEqual({ instance: 'pol-core:arduino-uno-r3@001-1', build: 'uno-light-aaaa', install_anyway: true, reason: 'bench check of the LED wiring' });
    expect(text()).toContain('recorded — bench check of the LED wiring');
    expect(text()).toContain('Confirm: run exactly this command on the board');
  });

  it('ins-1: an offered real install plans without any override field; the sim side ticks with {config, build, source} and runs the Purposes', () => {
    fixture.detectChanges();   // ngOnInit's reload first, so the gated document below is not overwritten by the mock's default
    component.doc = gatedDoc(true); component.variant = 'uno-light'; component.build = 'uno-light-aaaa'; (component as any).modeChosen = true;
    component.setMode('real');
    fixture.detectChanges();
    expect(text()).toContain('Real install offered: every Purpose passed');
    component.makePlan();
    expect(posts[0].body).toEqual({ instance: 'pol-core:arduino-uno-r3@001-1', build: 'uno-light-aaaa' });
    component.setMode('sim');
    fixture.detectChanges();
    expect(text()).toContain('Confirmed by dustin at 2026-10-20T10:00:00');
    expect(text()).toContain('Go to the real install');
    component.ticked = true;
    component.confirmSim();
    expect(posts.find(p => p.url.endsWith('/sim-confirmations'))!.body).toEqual({ config: 'uno-light', build: 'uno-light-aaaa', source: 'installer' });
    component.doc = gatedDoc(true); component.build = 'uno-light-aaaa';   // confirmSim() reloaded: the mock's default document has no gated build
    postReply = () => throwError(() => ({ error: { ok: false, error: 'this server cannot run the twin itself', retry: 'pol firmware prove uno-light --api https://x' } }));
    component.runPurposes();
    fixture.detectChanges();
    expect(posts.find(p => p.url.endsWith('/sim-install'))!.body).toEqual({ config: 'uno-light' });
    expect(text()).toContain('this server cannot run the twin itself');
    expect(text()).toContain('pol firmware prove uno-light --api https://x');
  });

  it('"try another variant" keeps the target, clears the plan and result, and moves to the next variant', () => {
    fixture.detectChanges();
    component.pickVariant('uno-echo');
    component.makePlan();
    component.install();
    component.tryAnother();
    expect(component.plan).toBeNull();
    expect(component.result).toBeNull();
    expect(component.target).toBe('twin:arduino-uno-r3');
    expect(component.variant).toBe('uno-sim-rig');
  });
});
