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
