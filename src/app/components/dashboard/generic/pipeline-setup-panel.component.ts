import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

import { PolariService } from '@services/polari-service';
import { ShellBridgeService } from '@services/shell-bridge.service';

/**
 * pipeline-setup-panel — the build pipeline's setup walkthrough, as a screen
 * (ci-11a; his ask 2026-09-19: run the Polari pipeline as a desktop app
 * "similar to how the isle mesh is working", guiding people through use like
 * a normal app, eliminating the terminal).
 *
 * THE ONE NEW COMPONENT. Everything else on /display/cicd-setup is a
 * configured table or the structured panel. This one exists because his ask
 * needs a thing no configured table can be: a button that runs a command on
 * the machine the browser is sitting on. The store's own surface could not be
 * extended with a mode — `app-isle-store` is a routed page with no @Input() at
 * all, hard-wired to catalogue fetching and installs — so this follows the
 * `security-threat-sim` shape instead: a registered panel with typed inputs.
 *
 * THE LAYER BOUNDARY (his rule, same day — "keep different pieces logically
 * separate, like CLI vs JavaFX"). This component knows the PROTOCOL and the
 * BRIDGE and nothing else. It never composes a command: an action carries a
 * verb id from the tracked allowlist `polari-jenkins/shell-verbs.json`, and
 * the shell owns the argv and the elevation. It never asks for a secret: a
 * `secret` question is answered by the shell's own native prompt, because a
 * value typed into this page would be in this page.
 *
 * TWO SOURCES, AND IT SAYS WHICH. With a shell it re-runs each step live on
 * the device (`setup-step` / `setup-run` / `setup-answer`, unprivileged) and
 * that answer replaces the step. Without one — a plain browser — it reads
 * `/api/cicd/setup`, the last walkthrough the device PUSHED, marks itself
 * read-only, and shows the exact command beside each step instead of a button.
 */
interface Check { name: string; value: string; verdict: 'OK' | 'WARN' | 'FAIL'; fix?: string; }
interface Option { value: string; label: string; }
interface Binding { verb: string; params: Record<string, string>; }
interface Question {
  key: string; label: string; kind: 'choice' | 'text' | 'secret' | 'confirm' | 'checklist';
  default?: string; answered?: string; options?: Option[];
  /** ci-11a — how this question is written back: a verb id from the allowlist
   *  and its parameters, with `{answer}` standing where the person's own value
   *  goes. The page substitutes that ONE placeholder and nothing else. A
   *  `secret` question carries no binding: there is nowhere in a page to type
   *  a secret. */
  action?: Binding;
}
interface Action {
  id: string; label: string; privileged: boolean; verb: string; done: boolean;
  why?: string; params?: Record<string, string>;
}
interface Where { what: string; url: string; scopes?: string; }
interface Step {
  name: string; index: number; total: number; title: string;
  state: 'done' | 'todo' | 'blocked' | 'skipped';
  explain: string; checks: Check[]; questions: Question[]; actions: Action[]; where: Where[];
}
interface Todo { step: string; text: string; command: string; }
interface Summary { complete: number; total: number; ready: boolean; blocking: string; }

@Component({
  standalone: true,
  selector: 'pipeline-setup-panel',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="psp">
      <div class="psp-bar">
        <span class="psp-mode" [class.live]="live" [class.mirror]="!live">
          {{ live ? 'this machine · live' : 'mirrored · read-only' }}
        </span>
        <span class="psp-where">{{ live ? mechanismLine : mirrorLine }}</span>
        <button type="button" (click)="reloadAll()" [disabled]="busy">Refresh</button>
      </div>

      <div class="psp-note" *ngIf="!live">
        This page is showing the last walkthrough the device pushed, not a live reading. The buttons need
        the Polari desktop application, which runs these on the machine itself. In a browser, run the
        command shown under each step.
      </div>

      <div class="psp-summary" *ngIf="summary">
        <strong>{{ summary.complete }} of {{ summary.total }} steps complete</strong>
        <span class="psp-verdict" [class.ready]="summary.ready" [class.notready]="!summary.ready">
          {{ summary.ready ? 'READY' : 'NOT READY' }}
        </span>
        <span *ngIf="!summary.ready && summary.blocking">first: {{ summary.blocking }}</span>
      </div>

      <div class="psp-error" *ngIf="error">{{ error }}</div>

      <div class="psp-step" *ngFor="let s of steps" [class]="'state-' + s.state">
        <h3>
          <span class="psp-num">{{ s.index }}/{{ s.total }}</span>
          {{ s.title }}
          <span class="psp-state">{{ s.state }}</span>
        </h3>

        <p class="psp-explain" *ngFor="let p of paragraphs(s.explain)">{{ p }}</p>

        <table class="psp-checks" *ngIf="s.checks?.length">
          <thead><tr><th>check</th><th>reading</th><th>verdict</th><th>what to do</th></tr></thead>
          <tbody>
            <tr *ngFor="let c of s.checks" [class]="'v-' + c.verdict">
              <td>{{ c.name }}</td>
              <td>{{ c.value }}</td>
              <td class="psp-verdict-cell">{{ c.verdict }}</td>
              <td>{{ c.fix }}</td>
            </tr>
          </tbody>
        </table>

        <div class="psp-question" *ngFor="let q of s.questions">
          <label>{{ q.label }}</label>

          <ng-container [ngSwitch]="q.kind">
            <select *ngSwitchCase="'choice'" [ngModel]="q.answered || q.default"
                    (ngModelChange)="answer(s, q, $event)" [disabled]="!live || busy">
              <option *ngFor="let o of q.options" [value]="o.value">{{ o.label }}</option>
            </select>

            <div *ngSwitchCase="'checklist'" class="psp-checklist">
              <label *ngFor="let o of q.options" class="psp-tick">
                <input type="checkbox" [checked]="isTicked(q, o.value)" [disabled]="!live || busy"
                       (change)="tick(s, q, o.value, $event)"> {{ o.label }}
              </label>
            </div>

            <div *ngSwitchCase="'secret'" class="psp-secret">
              <span class="psp-present" [class.yes]="q.answered === 'present'">
                {{ q.answered === 'present' ? 'stored on the device' : 'not stored yet' }}
              </span>
              <em>this value is typed into the application's own prompt, never into this page</em>
            </div>

            <input *ngSwitchDefault type="text" [ngModel]="q.answered" [disabled]="!live || busy"
                   (change)="answer(s, q, asValue($event))">
          </ng-container>

          <code class="psp-cmd" *ngIf="!live && q.kind !== 'secret'">pol jenkins setup --json --step {{ s.name }} --answer {{ q.key }}=&lt;value&gt;</code>
          <code class="psp-cmd" *ngIf="!live && q.kind === 'secret'">pol jenkins secrets put {{ q.key }}   # the value on stdin, never in an argument</code>
        </div>

        <div class="psp-where" *ngIf="s.where?.length">
          <div *ngFor="let w of s.where">
            <strong>{{ w.what }}</strong>
            <a *ngIf="w.url" [href]="w.url" target="_blank" rel="noopener noreferrer">{{ w.url }}</a>
            <span *ngIf="w.scopes" class="psp-scopes">{{ w.scopes }}</span>
          </div>
        </div>

        <div class="psp-actions" *ngIf="s.actions?.length">
          <div class="psp-action" *ngFor="let a of s.actions">
            <button type="button" (click)="run(s, a)" [disabled]="!live || busy || a.done"
                    [class.priv]="a.privileged">
              {{ a.done ? '✓ ' : '' }}{{ a.label }}{{ a.privileged ? ' — asks for your password' : '' }}
            </button>
            <span class="psp-why">{{ a.why }}</span>
            <code class="psp-cmd" *ngIf="!live">{{ commandFor(a) }}</code>
          </div>
        </div>

        <pre class="psp-log" *ngIf="logs[s.name]" [class.err]="logErr[s.name]">{{ logs[s.name] }}</pre>
      </div>

      <div class="psp-todo" *ngIf="todo?.length">
        <h3>Still to do, in order</h3>
        <ol>
          <li *ngFor="let t of todo">
            <span class="psp-step-tag">{{ t.step }}</span> {{ t.text }}
            <code class="psp-cmd" *ngIf="t.command">{{ t.command }}</code>
          </li>
        </ol>
      </div>
    </div>
  `,
  styles: [`
    .psp { font-size: 13px; color: var(--text-on-card); background: var(--surface-primary); }
    .psp-bar { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 8px; }
    .psp-mode { font-size: 11px; text-transform: uppercase; letter-spacing: .08em;
                padding: 2px 8px; border: 1px solid currentColor; border-radius: 3px; }
    .psp-mode.live { color: var(--color-success-text); }
    .psp-mode.mirror { color: var(--color-warn-text); }
    .psp-where { opacity: .8; }
    .psp-note { border-left: 3px solid var(--color-warn); padding: 6px 10px; margin-bottom: 10px;
                color: var(--text-on-card); background: var(--surface-secondary); }
    .psp-summary { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 10px; }
    .psp-verdict.ready { color: var(--color-success-text); font-weight: 600; }
    .psp-verdict.notready { color: var(--color-warn-text); font-weight: 600; }
    .psp-error { color: var(--color-error-text); margin-bottom: 8px; }
    .psp-step { border: 1px solid var(--border-medium); border-left-width: 4px;
                padding: 10px 12px; margin-bottom: 10px; }
    .psp-step.state-done { border-left-color: var(--color-success); }
    .psp-step.state-todo { border-left-color: var(--color-warn); }
    .psp-step.state-blocked { border-left-color: var(--color-error); }
    .psp-step.state-skipped { border-left-color: var(--border-medium); opacity: .7; }
    .psp-step h3 { font-size: 14px; margin: 0 0 6px; display: flex; gap: 10px; align-items: baseline; }
    .psp-num { opacity: .6; font-weight: 400; }
    .psp-state { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; opacity: .8; }
    .psp-explain { margin: 4px 0; white-space: pre-line; }
    .psp-checks { width: 100%; border-collapse: collapse; margin: 8px 0; }
    .psp-checks th, .psp-checks td { text-align: left; padding: 3px 8px 3px 0; vertical-align: top;
                                     border-bottom: 1px solid var(--border-medium); }
    .psp-checks th { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; opacity: .7; }
    .psp-verdict-cell { font-weight: 600; }
    .psp-checks tr.v-OK .psp-verdict-cell { color: var(--color-success-text); }
    .psp-checks tr.v-WARN .psp-verdict-cell { color: var(--color-warn-text); }
    .psp-checks tr.v-FAIL .psp-verdict-cell { color: var(--color-error-text); }
    .psp-question { margin: 8px 0; display: grid; gap: 4px; }
    .psp-question label { font-weight: 600; }
    .psp-question select, .psp-question input[type=text] { max-width: 520px; }
    .psp-checklist { display: flex; flex-wrap: wrap; gap: 10px; }
    .psp-tick { font-weight: 400; display: flex; gap: 4px; align-items: center; }
    .psp-secret { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    .psp-present { font-size: 11px; text-transform: uppercase; letter-spacing: .06em;
                   color: var(--color-warn-text); }
    .psp-present.yes { color: var(--color-success-text); }
    .psp-where { margin: 8px 0; display: grid; gap: 4px; }
    .psp-where a { word-break: break-all; }
    .psp-scopes { display: block; opacity: .85; }
    .psp-actions { display: grid; gap: 8px; margin-top: 8px; }
    .psp-action { display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; }
    .psp-action button.priv { border-color: var(--color-warn); }
    .psp-why { opacity: .85; flex: 1 1 320px; }
    .psp-cmd { display: block; font-family: monospace; font-size: 12px; padding: 2px 6px;
               color: var(--text-on-card); background: var(--surface-secondary); word-break: break-all; }
    .psp-log { white-space: pre-wrap; max-height: 260px; overflow: auto; padding: 6px 8px;
               color: var(--text-on-card); background: var(--surface-secondary);
               border-left: 3px solid var(--color-success); }
    .psp-log.err { border-left-color: var(--color-error); }
    .psp-todo ol { margin: 4px 0; padding-left: 20px; }
    .psp-todo li { margin-bottom: 6px; }
    .psp-step-tag { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; opacity: .7;
                    margin-right: 6px; }
    @container (max-width: 560px) {
      .psp-action { flex-direction: column; align-items: stretch; }
      .psp-checks thead { display: none; }
    }
  `],
})
export class PipelineSetupPanelComponent implements OnInit, OnChanges {
  /** The mirror door — the last walkthrough the device pushed. */
  @Input() path = '/api/cicd/setup';
  /** Render one step only (its protocol name), or every step when empty. */
  @Input() step = '';
  /** Which pipeline device, when the core knows more than one. */
  @Input() device = '';

  steps: Step[] = [];
  todo: Todo[] = [];
  summary: Summary | null = null;
  /** True only when the desktop shell answered `pipeline.available`. */
  live = false;
  mechanismLine = '';
  mirrorLine = '';
  error = '';
  busy = false;
  logs: Record<string, string> = {};
  logErr: Record<string, boolean> = {};

  constructor(private http: HttpClient,
              private polariService: PolariService,
              public bridge: ShellBridgeService) {}

  ngOnInit(): void { this.reloadAll(); }
  ngOnChanges(ch: SimpleChanges): void {
    if (ch['path'] || ch['step'] || ch['device']) { this.reloadAll(); }
  }

  paragraphs(text: string): string[] {
    return (text || '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  }

  asValue(ev: any): string { return (ev && ev.target && ev.target.value) || ''; }

  isTicked(q: Question, value: string): boolean {
    return (q.answered || '').split(',').map(s => s.trim()).includes(value);
  }

  /** What a person would type instead. Built from the ALLOWLIST's own shape,
   *  not invented here: a verb id plus its parameters, spelled the way
   *  `pol jenkins verbs` prints it. */
  commandFor(a: Action): string {
    const p = a.params || {};
    switch (a.verb) {
      case 'init-device': return 'sudo pol jenkins init-device';
      case 'secrets-put': return `pol jenkins secrets put ${p['area']}/${p['name']}   # the value on stdin`;
      case 'apt-install-tools':
        return 'sudo apt-get install -y libvirt-clients virtinst qemu-utils cloud-image-utils whiptail';
      case 'docker-group': return `sudo usermod -aG docker ${p['user']}`;
      case 'wired-up': return `nmcli con up "${p['con']}"`;
      case 'doctor': return 'pol jenkins doctor';
      case 'preflight': return 'pol jenkins preflight --isle';
      case 'setup-step': return `pol jenkins setup --step ${p['step']}`;
      case 'setup-run': return `pol jenkins setup --json --run ${p['action']}`;
      case 'up': return 'pol jenkins up';
      default: return 'pol jenkins verbs';
    }
  }

  // ------------------------------------------------------------- loading
  reloadAll(): void {
    this.error = '';
    this.bridge.pipelineAvailable()
      .then(res => { this.live = !!(res && res.available); this.mechanismLine = this.liveLine(res); })
      .catch(() => { this.live = false; this.mechanismLine = ''; })
      .then(() => (this.live ? this.loadLive() : this.loadMirror()));
  }

  private liveLine(res: any): string {
    const mech = (res && res.mechanism) || 'the desktop application';
    const proto = (res && res.verbsProtocol) || '';
    return `run here through ${mech}${proto ? ` · verbs ${proto}` : ''}`;
  }

  /** The mirror: what the device last pushed. Always safe, never a command. */
  private loadMirror(): void {
    const q: string[] = [];
    if (this.device) { q.push(`device=${encodeURIComponent(this.device)}`); }
    const url = this.polariService.getBackendBaseUrl() + this.path + (q.length ? '?' + q.join('&') : '');
    this.http.get<any>(url, this.polariService.backendRequestOptions).subscribe({
      next: (body: any) => {
        if (!body || body.ok === false) {
          this.error = (body && (body.error || body.refusal)) || `GET ${this.path}: empty response`;
          return;
        }
        this.apply(body);
        this.mirrorLine = body.how || '';
        if (!this.steps.length) { this.error = body.how || ''; }
      },
      error: (err: any) => {
        this.error = `GET ${this.path} failed: ${err?.status || ''} ${err?.message || ''}`.trim();
      },
    });
  }

  /** The device itself, through the shell: the whole walkthrough, recomputed. */
  private loadLive(): void {
    this.busy = true;
    const verb = this.step ? 'setup-step' : 'setup-step';
    const params = this.step ? { step: this.step } : { step: 'summary' };
    // With no single step asked for we still want every step, which is what the
    // mirror door already holds — so the live path recomputes the named step and
    // the mirror supplies the rest. One document either way.
    if (!this.step) { this.busy = false; this.loadMirror(); this.refreshEachStep(); return; }
    this.bridge.pipelineRun(verb, params)
      .then(res => { this.busy = false; this.applyResult(res); })
      .catch(err => { this.busy = false; this.live = false; this.error = String(err); this.loadMirror(); });
  }

  /** Re-run every step on the device, one at a time, replacing each as it lands. */
  private refreshEachStep(): void {
    this.bridge.pipelineRun('setup-step', { step: 'role' })
      .then(res => {
        const doc = res && res.json;
        if (!doc) { return; }
        this.applyResult(res);
        const names = (this.steps || []).map(s => s.name).filter(n => n !== 'role');
        return names.reduce(
          (chain: Promise<any>, name: string) => chain.then(() =>
            this.bridge.pipelineRun('setup-step', { step: name }).then(r => this.applyResult(r))),
          Promise.resolve());
      })
      .catch(() => { /* the mirror is already on screen; a live refresh is a bonus */ });
  }

  private apply(doc: any): void {
    this.steps = (doc.steps || []).filter((s: Step) => !this.step || s.name === this.step);
    this.todo = doc.todo || [];
    this.summary = doc.summary || this.summary;
  }

  /** One `{ok, exitCode, output, json}` answer from the bridge. */
  private applyResult(res: any): void {
    if (!res) { return; }
    const doc = res.json;
    if (doc && doc.step) { this.replace(doc.step); }
    if (doc && doc.steps) { this.apply(doc); }
    if (doc && doc.summary) { this.summary = doc.summary; }
    if (doc && doc.todo) { this.todo = doc.todo; }
  }

  private replace(step: Step): void {
    const i = this.steps.findIndex(s => s.name === step.name);
    if (i >= 0) { this.steps[i] = step; } else { this.steps = [...this.steps, step].sort((a, b) => a.index - b.index); }
  }

  // -------------------------------------------------------------- acting
  /** Answer one question: `setup-answer`, unprivileged, one KEY=VALUE.
   *  A `secret` never comes through here — it has no input to type into. */
  answer(s: Step, q: Question, value: string): void {
    if (!this.live || q.kind === 'secret') { return; }
    this.busy = true;
    const bind = q.action || { verb: 'setup-answer', params: { step: s.name, key: q.key, value: '{answer}' } };
    const params: Record<string, string> = {};
    // the binding came with the question; the page fills ONLY the placeholder
    Object.keys(bind.params || {}).forEach(k => {
      params[k] = bind.params[k] === '{answer}' ? value : bind.params[k];
    });
    this.bridge.pipelineRun(bind.verb, params)
      .then(res => { this.busy = false; this.note(s, res); this.applyResult(res); })
      .catch(err => { this.busy = false; this.fail(s, err); });
  }

  tick(s: Step, q: Question, value: string, ev: any): void {
    const on = !!(ev && ev.target && ev.target.checked);
    const now = (q.answered || '').split(',').map(x => x.trim()).filter(Boolean);
    const next = on ? Array.from(new Set([...now, value])) : now.filter(x => x !== value);
    this.answer(s, q, next.join(','));
  }

  /** Run one action. Unprivileged goes to `pipeline.run`; privileged goes to
   *  `pipeline.privileged`, where the shell raises the system's own prompt —
   *  and, for a verb the allowlist marks `stdin: "secret"`, collects the value
   *  itself. Neither path is composed here. */
  run(s: Step, a: Action): void {
    if (!this.live) { return; }
    this.busy = true;
    const params = a.params || {};
    const call = a.privileged
      ? this.bridge.pipelinePrivileged(a.verb, params)
      : this.bridge.pipelineRun(a.verb, params);
    call.then(res => { this.busy = false; this.note(s, res); this.applyResult(res); this.afterAction(s, a, res); })
        .catch(err => { this.busy = false; this.fail(s, err); });
  }

  /** A privileged verb returns no setup document — the shell ran a command, not
   *  the walkthrough. Ask the device to recompute the step it belonged to. */
  private afterAction(s: Step, a: Action, res: any): void {
    if (!a.privileged || !(res && res.ok)) { return; }
    this.bridge.pipelineRun('setup-step', { step: s.name })
      .then(r => this.applyResult(r))
      .catch(() => { /* the log already says what happened */ });
  }

  private note(s: Step, res: any): void {
    const ok = !!(res && res.ok);
    this.logs[s.name] = (res && (res.output || res.error)) || (ok ? 'done' : 'that did not work');
    this.logErr[s.name] = !ok;
  }

  private fail(s: Step, err: any): void {
    this.logs[s.name] = String(err && err.message ? err.message : err);
    this.logErr[s.name] = true;
  }
}
