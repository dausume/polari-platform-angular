import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';

import { PipelineSetupPanelComponent } from './pipeline-setup-panel.component';
import { PolariService } from '@services/polari-service';
import { ShellBridgeService } from '@services/shell-bridge.service';

/**
 * ci-11a — THE DEGRADATION IS THE TEST.
 *
 * The wizard's whole reason to exist is the desktop application, but the same
 * page opens in a plain browser, where there is no shell and no way to run
 * anything on anybody's machine. What it must do there is not "fail quietly":
 * it must show the state it can see, say that it is a mirror rather than a
 * live reading, disable every button, and print the exact command instead —
 * so a person in a browser is never stuck in front of a button that does
 * nothing and never told something ran when it did not.
 */
describe('PipelineSetupPanelComponent', () => {
  let fixture: ComponentFixture<PipelineSetupPanelComponent>;
  let component: PipelineSetupPanelComponent;
  let available: boolean;
  let mirror: any;
  const runSpy = jasmine.createSpy('pipelineRun');
  const privSpy = jasmine.createSpy('pipelinePrivileged');

  const step = (over: any = {}) => Object.assign({
    name: 'secrets', index: 4, total: 8, title: 'the secrets posture, and the secrets',
    state: 'blocked', explain: 'Two postures.\n\nSYSTEM is the one to want.',
    checks: [{ name: 'posture', value: 'REPO', verdict: 'WARN', fix: 'sudo pol jenkins init-device' }],
    questions: [{ key: 'github/github_token', label: 'the github-release route', kind: 'secret',
                  default: '', answered: '' },
                { key: 'CI_MODE', label: 'What does this pipeline maintain?', kind: 'choice',
                  default: 'suite', answered: 'suite',
                  options: [{ value: 'suite', label: 'the whole suite' },
                            { value: 'app', label: 'one app' }],
                  action: { verb: 'setup-answer',
                            params: { step: 'secrets', key: 'CI_MODE', value: '{answer}' } } }],
    actions: [{ id: 'init-device', label: 'Create the system secrets posture', privileged: true,
                verb: 'init-device', done: false, why: 'it creates a system user' },
              { id: 'generate-cosign', label: 'Generate the cosign key pair', privileged: false,
                verb: 'setup-run', done: false, why: 'made locally',
                params: { action: 'generate-cosign' } }],
    where: [{ what: 'github/github_token', url: 'https://github.com/settings/tokens', scopes: 'Contents: RW' }],
  }, over);

  beforeEach(async () => {
    available = false;
    runSpy.calls.reset();
    privSpy.calls.reset();
    mirror = {
      ok: true, protocol: 'polari-pipeline-setup/1', live: false,
      device: { mode: 'suite', ready: false, name: 'pipeline' },
      steps: [step()],
      todo: [{ step: 'secrets', text: 'put github/github_token in place', command: 'pol jenkins secrets put github/github_token' }],
      summary: { complete: 2, total: 8, ready: false, blocking: 'put this device on a wire' },
      how: 'a MIRROR of the last push, not a live reading.',
    };
    await TestBed.configureTestingModule({
      imports: [PipelineSetupPanelComponent],
      providers: [
        { provide: HttpClient, useValue: { get: () => of(mirror) } },
        { provide: PolariService,
          useValue: { getBackendBaseUrl: () => '', backendRequestOptions: {} } },
        { provide: ShellBridgeService,
          useValue: {
            get available() { return available; },
            pipelineAvailable: () => (available
              ? Promise.resolve({ available: true, mechanism: 'pkexec',
                                  verbsProtocol: 'polari-pipeline-shell/1' })
              : Promise.reject(new Error('no native shell bridge'))),
            pipelineRun: runSpy,
            pipelinePrivileged: privSpy,
          } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PipelineSetupPanelComponent);
    component = fixture.componentInstance;
  });

  async function render(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('with NO shell it renders the mirrored walkthrough, says it is a mirror, '
     + 'and disables every button', async () => {
    await render();
    expect(component.live).withContext('no bridge, so not live').toBeFalse();
    const el = fixture.nativeElement;
    expect(el.querySelector('.psp-mode').textContent).toContain('mirrored');
    expect(el.querySelector('.psp-note').textContent)
      .withContext('it names the desktop application as what the buttons need')
      .toContain('desktop application');
    expect(component.steps.length).toBe(1);
    const buttons: HTMLButtonElement[] =
      Array.from(el.querySelectorAll('.psp-action button'));
    expect(buttons.length).withContext('both actions still SHOWN').toBe(2);
    expect(buttons.every(b => b.disabled))
      .withContext('…and every one of them disabled').toBeTrue();
  });

  it('with no shell it shows the EXACT command for each action instead of running it',
     async () => {
    await render();
    const commands: string[] =
      Array.from(fixture.nativeElement.querySelectorAll('.psp-cmd'))
        .map((n: any) => n.textContent.trim());
    expect(commands).toContain('sudo pol jenkins init-device');
    expect(commands.some(c => c.includes('pol jenkins setup --json --run generate-cosign'))).toBeTrue();
  });

  it('never runs anything on the device without a shell', async () => {
    await render();
    component.run(component.steps[0], component.steps[0].actions[0]);
    component.answer(component.steps[0], component.steps[0].questions[0], 'anything');
    expect(runSpy).not.toHaveBeenCalled();
    expect(privSpy).not.toHaveBeenCalled();
  });

  it('shows a SECRET as presence only — no input to type a value into, in either mode',
     async () => {
    await render();
    const el = fixture.nativeElement;
    expect(el.querySelector('.psp-secret')).withContext('the presence chip').toBeTruthy();
    expect(el.querySelector('.psp-secret').textContent).toContain('not stored yet');
    expect(el.querySelectorAll('input[type=password]').length)
      .withContext('a secret is never typed into this page').toBe(0);
    available = true;
    await render();
    expect(el.querySelectorAll('input[type=password]').length).toBe(0);
  });

  it('a secret question is refused by the component itself, not merely hidden', async () => {
    available = true;
    runSpy.and.returnValue(Promise.resolve({ ok: true }));
    await render();
    runSpy.calls.reset();   // rendering live already refreshes the steps; only the answer matters here
    component.answer(component.steps[0], component.steps[0].questions[0], 'ghp_asecret');
    expect(runSpy).withContext('no answer call carries a secret value').not.toHaveBeenCalled();
  });

  it('with a shell it says live, names the mechanism, and enables the buttons', async () => {
    available = true;
    runSpy.and.returnValue(Promise.resolve({ ok: true, exitCode: 0, output: '' }));
    await render();
    expect(component.live).toBeTrue();
    expect(component.mechanismLine).toContain('pkexec');
    expect(component.mechanismLine).toContain('polari-pipeline-shell/1');
  });

  it('substitutes ONLY the {answer} placeholder of a question\'s own binding — the page '
     + 'never invents a parameter', async () => {
    available = true;
    runSpy.and.returnValue(Promise.resolve({ ok: true, exitCode: 0, output: '' }));
    await render();
    runSpy.calls.reset();
    const s = component.steps[0];
    component.answer(s, s.questions[1], 'app');
    expect(runSpy).toHaveBeenCalledWith('setup-answer',
      { step: 'secrets', key: 'CI_MODE', value: 'app' });
  });

  it('routes a privileged action to pipeline.privileged and an unprivileged one to '
     + 'pipeline.run — the page never chooses the argv, only the verb', async () => {
    available = true;
    runSpy.and.returnValue(Promise.resolve({ ok: true, exitCode: 0, output: 'ok' }));
    privSpy.and.returnValue(Promise.resolve({ ok: true, exitCode: 0, output: 'done' }));
    await render();
    runSpy.calls.reset();
    const s = component.steps[0];
    component.run(s, s.actions[0]);
    component.run(s, s.actions[1]);
    expect(privSpy).toHaveBeenCalledWith('init-device', {});
    expect(runSpy).toHaveBeenCalledWith('setup-run', { action: 'generate-cosign' });
  });

  it('falls back to the mirror when the bridge answers but then throws', async () => {
    available = true;
    runSpy.and.returnValue(Promise.reject(new Error('bridge 3: refused')));
    component.step = 'secrets';
    await render();
    expect(component.live).withContext('a throwing bridge is not a live one').toBeFalse();
    expect(component.steps.length).withContext('the mirror still rendered').toBe(1);
  });

  it('says so when the mirror door itself fails, rather than showing an empty page',
     async () => {
    (TestBed.inject(HttpClient) as any).get =
      () => throwError(() => ({ status: 503, message: 'no core' }));
    await render();
    expect(component.error).toContain('503');
  });
});
