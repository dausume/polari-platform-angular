import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';

import { PolariService } from '@services/polari-service';
import { StompService } from '@services/stomp.service';

/**
 * firmware-installer-panel — the Firmware Installer App's flow as a screen
 * (brd-fi, BOARD_PROGRAMMING_PLAN.md §7a). His intent: "that way we can test
 * different kinds of things on the arduino uno to see if it works".
 *
 * THE ONE NEW COMPONENT of /display/firmware-installer, justified the way
 * `pipeline-setup-panel` was for `pol jenkins setup`: every list on the page
 * (variants, builds, devices, plans, records) is a configured table, but no
 * table can carry the FLOW — pick a variant → build it → read the exact
 * command (the DRY-RUN) → confirm → install → watch what the board says →
 * try another variant.
 *
 * THE LAYER BOUNDARY. This panel never composes a command. It sends NAMES —
 * a variant, a target, a build, a plan, a record — to the local server's
 * installer doors (/api/board/installer/…). The server fixes the argv in the
 * InstallPlan row when the plan is made, shows it here VERBATIM, and runs that
 * argv, and only that, on its own host (the host holding the USB port) after
 * the confirm. A plan for another host is refused by the server, by name.
 *
 * LIVE ROWS. Once the bridge is attached the board's frames update its class
 * row through the existing Push path, which fans out over STOMP like any REST
 * change; the panel watches that class's topic and refetches the result (the
 * row's fields + the first frames + frames/s). A short poll covers the bridge
 * coming up (mvn on first use) and a server without STOMP.
 *
 * NO RAW JSON. Fields are a two-column table, frames a table, argv a code line.
 */
interface Target { name: string; kind: 'twin' | 'board'; label: string; port: string; }
interface Variant { name: string; title: string; purpose: string; app: string; classes_json: string; what_to_watch: string; }
interface Build {
  name: string; variant: string; state: string; flash_bytes: number; flash_max: number; ram_bytes: number; ram_max: number;
  flash_pct: number; ram_pct: number; artifact_sha256: string; header_sha256: string; compat: string; compat_why: string;
  installable: boolean; engines: string; built_at: string;
}
interface InstallerDoc {
  ok: boolean; host: string; board: string; targets: Target[]; adapters: any[]; scan_note: string;
  variants: Variant[]; builds: Build[]; twin: any; records: any[]; error?: string;
}
interface Plan {
  plan: string; argv_text: string; wrapper_text: string; engine: string; engine_how: string; engine_where: string;
  adapter: string; compat: string; compat_why: string; will_stamp: string; target_kind: string; host: string; port: string; state: string;
}
interface Frame { seq: number; device: number; class: string; values: Record<string, string>; }
interface Result {
  record: string; verdict: string; verify: string; variant: string; target_kind: string; bridge_state: string;
  frames: Frame[]; frames_total: number; frames_per_s: number; row_class: string; row_name: string;
  row: Record<string, any> | null; firmware_sha: string;
}

@Component({
  standalone: true,
  selector: 'firmware-installer-panel',
  imports: [CommonModule],
  template: `
    <div class="fip">
      <div class="fip-bar">
        <span class="fip-host">installs run on <strong>{{ doc?.host || '…' }}</strong> — the machine holding the port</span>
        <span class="fip-scan">{{ doc?.scan_note }}</span>
        <button type="button" (click)="reload()" [disabled]="busy">Refresh</button>
      </div>
      <div class="fip-error" *ngIf="error">{{ error }}</div>

      <section class="fip-step">
        <h3><span class="fip-num">1</span> Where it goes</h3>
        <label class="fip-choice" *ngFor="let t of doc?.targets">
          <input type="radio" name="fip-target" [checked]="target === t.name" (change)="pickTarget(t.name)" [disabled]="busy">
          <span><strong>{{ t.kind === 'twin' ? 'The twin' : 'The board' }}</strong> — {{ t.label }}</span>
        </label>
        <p class="fip-note" *ngIf="isTwin()">The simavr twin runs the very same .hex a real UNO is flashed with; it counts as the device until one is plugged in.</p>
        <p class="fip-note" *ngFor="let a of doc?.adapters">
          Adapter seen: {{ a.definition }} at {{ a.by_id_path || a.port }} — {{ a.target_board ? 'wired to ' + a.target_board : 'say which board is wired to it on its row' }}.
        </p>
      </section>

      <section class="fip-step">
        <h3><span class="fip-num">2</span> What to try</h3>
        <div class="fip-variants">
          <label class="fip-variant" *ngFor="let v of doc?.variants" [class.on]="variant === v.name">
            <input type="radio" name="fip-variant" [checked]="variant === v.name" (change)="pickVariant(v.name)" [disabled]="busy">
            <span class="fip-vtitle">{{ v.title }}</span>
            <span class="fip-vname">{{ v.name }} · speaks {{ classes(v) }}</span>
            <span class="fip-vtext">{{ v.purpose }}</span>
            <span class="fip-vwatch"><em>Watch for:</em> {{ v.what_to_watch }}</span>
          </label>
        </div>
        <ng-container *ngIf="variant">
          <table class="fip-table" *ngIf="buildsFor().length">
            <thead><tr><th></th><th>build</th><th>flash</th><th>RAM</th><th>.hex sha256</th><th>fits this server?</th></tr></thead>
            <tbody>
              <tr *ngFor="let b of buildsFor()" [class.dim]="!b.installable">
                <td><input type="radio" name="fip-build" [checked]="build === b.name" (change)="pickBuild(b.name)" [disabled]="busy || !b.installable"></td>
                <td>{{ b.name }}</td>
                <td>{{ b.flash_bytes }} / {{ b.flash_max }} B ({{ b.flash_pct }} %)</td>
                <td>{{ b.ram_bytes }} / {{ b.ram_max }} B ({{ b.ram_pct }} %)</td>
                <td class="fip-mono">{{ short(b.artifact_sha256) }}</td>
                <td [class]="'c-' + b.compat"><strong>{{ b.compat }}</strong><span class="fip-why" *ngIf="b.compat !== 'compatible'"> — {{ b.compat_why }}</span></td>
              </tr>
            </tbody>
          </table>
          <p class="fip-note" *ngIf="!buildsFor().length">No build of {{ variant }} yet.</p>
          <button type="button" (click)="buildVariant()" [disabled]="busy">{{ buildsFor().length ? 'Build it again' : 'Build ' + variant }}</button>
        </ng-container>
      </section>

      <section class="fip-step">
        <h3><span class="fip-num">3</span> Read the command (DRY-RUN — nothing is opened)</h3>
        <button type="button" (click)="makePlan()" [disabled]="busy || !build || !target">Show me what will run</button>
        <div class="fip-plan" *ngIf="plan">
          <code class="fip-cmd">{{ plan.argv_text }}</code>
          <code class="fip-cmd fip-wrap" *ngIf="plan.wrapper_text">runs as: {{ plan.wrapper_text }}</code>
          <table class="fip-kv">
            <tr><th>engine</th><td>{{ plan.engine }} ({{ plan.engine_how }}{{ plan.engine_where ? ': ' + plan.engine_where : '' }})</td></tr>
            <tr><th>adapter</th><td>{{ plan.adapter || 'none — native USB' }}</td></tr>
            <tr><th>compatibility</th><td [class]="'c-' + plan.compat">{{ plan.compat }} — {{ plan.compat_why }}</td></tr>
            <tr><th>will stamp</th><td>{{ plan.will_stamp }}</td></tr>
            <tr><th>runs on</th><td>{{ plan.host }} · {{ plan.port }}</td></tr>
          </table>
        </div>
      </section>

      <section class="fip-step">
        <h3><span class="fip-num">4</span> Install</h3>
        <button type="button" class="fip-confirm" (click)="install()" [disabled]="!canConfirm()">
          {{ plan ? 'Confirm: run exactly this command' : 'Confirm (make the plan first)' }}
        </button>
        <table class="fip-kv" *ngIf="result">
          <tr><th>result</th><td [class]="'v-' + result.verdict"><strong>{{ result.verdict }}</strong> — {{ result.verify }}</td></tr>
          <tr><th>on</th><td>{{ result.target_kind === 'twin' ? 'the twin (simavr)' : 'the board' }} · firmware {{ short(result.firmware_sha) }}</td></tr>
          <tr><th>bridge</th><td>{{ result.bridge_state || 'not attached yet' }}</td></tr>
        </table>
      </section>

      <section class="fip-step" *ngIf="result">
        <h3><span class="fip-num">5</span> What it says now</h3>
        <p class="fip-rate" *ngIf="result.frames_total">
          <strong>{{ result.frames_per_s }}</strong> frames/s · {{ result.frames_total }} frames so far · row {{ result.row_class }} “{{ result.row_name }}”
        </p>
        <table class="fip-kv" *ngIf="result.row">
          <tr *ngFor="let k of rowKeys()"><th>{{ k }}</th><td>{{ result.row[k] }}</td></tr>
        </table>
        <table class="fip-table" *ngIf="result.frames?.length">
          <thead><tr><th>seq</th><th *ngFor="let k of frameKeys()">{{ k }}</th></tr></thead>
          <tbody><tr *ngFor="let f of result.frames"><td>{{ f.seq }}</td><td *ngFor="let k of frameKeys()">{{ f.values[k] }}</td></tr></tbody>
        </table>
        <p class="fip-note" *ngIf="watchText()">Watch for: {{ watchText() }}</p>
        <button type="button" (click)="tryAnother()" [disabled]="busy">Try another variant</button>
      </section>
    </div>
  `,
  styles: [`
    :host { display: block; container-type: inline-size; }
    .fip { font-size: 13px; color: var(--text-on-card); background: var(--surface-primary); }
    .fip-bar { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 8px; }
    .fip-scan { opacity: .8; }
    .fip-error { color: var(--color-error-text); margin-bottom: 8px; white-space: pre-line; }
    .fip-step { border: 1px solid var(--border-medium); border-left-width: 4px; border-left-color: var(--color-warn);
                padding: 10px 12px; margin-bottom: 10px; }
    .fip-step h3 { font-size: 14px; margin: 0 0 8px; display: flex; gap: 8px; align-items: baseline; }
    .fip-num { opacity: .6; font-weight: 400; }
    .fip-choice { display: flex; gap: 6px; align-items: baseline; margin: 4px 0; }
    .fip-note { margin: 6px 0; opacity: .85; }
    .fip-variants { display: grid; gap: 8px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); margin-bottom: 8px; }
    .fip-variant { display: grid; gap: 3px; padding: 8px; border: 1px solid var(--border-medium); cursor: pointer; }
    .fip-variant.on { border-color: var(--color-success); }
    .fip-vtitle { font-weight: 600; }
    .fip-vname { font-size: 11px; opacity: .75; }
    .fip-vwatch { font-size: 12px; }
    .fip-table, .fip-kv { width: 100%; border-collapse: collapse; margin: 8px 0; }
    .fip-table th, .fip-table td, .fip-kv th, .fip-kv td { text-align: left; padding: 3px 8px 3px 0; vertical-align: top;
                                                          border-bottom: 1px solid var(--border-medium); }
    .fip-table th, .fip-kv th { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; opacity: .7; font-weight: 600; }
    .fip-kv th { width: 9em; }
    .fip-table tr.dim { opacity: .6; }
    .fip-mono { font-family: monospace; }
    .fip-why { font-weight: 400; }
    .c-compatible, .v-installed { color: var(--color-success-text); }
    .c-stale-header, .c-unknown-class, .v-failed, .v-refused { color: var(--color-error-text); }
    .fip-cmd { display: block; font-family: monospace; font-size: 12px; padding: 4px 6px; margin: 6px 0;
               color: var(--text-on-card); background: var(--surface-secondary); word-break: break-all; white-space: pre-wrap; }
    .fip-wrap { opacity: .8; }
    .fip-confirm:not([disabled]) { border-color: var(--color-warn); font-weight: 600; }
    .fip-rate { margin: 4px 0 6px; }
    @container (max-width: 560px) {
      .fip-table thead { display: none; }
      .fip-table td { display: block; border-bottom: none; }
      .fip-table tr { display: block; border-bottom: 1px solid var(--border-medium); padding: 4px 0; }
      .fip-kv th { width: auto; }
    }
  `],
})
export class FirmwareInstallerPanelComponent implements OnInit, OnChanges, OnDestroy {
  /** The installer's document door (the base of every other door). */
  @Input() path = '/api/board/installer';
  /** The board family this panel installs onto (the UNO has variants so far). */
  @Input() board = 'arduino-uno-r3';

  doc: InstallerDoc | null = null;
  target = '';
  variant = '';
  build = '';
  plan: Plan | null = null;
  record = '';
  result: Result | null = null;
  busy = false;
  error = '';
  private watch?: Subscription;
  private poll?: any;

  constructor(private http: HttpClient, private polariService: PolariService, private stomp: StompService) {}

  ngOnInit(): void { this.reload(); }
  ngOnChanges(ch: SimpleChanges): void { if (ch['path'] && !ch['path'].firstChange) { this.reload(); } }
  ngOnDestroy(): void { this.stopLive(); }

  private url(suffix = ''): string { return this.polariService.getBackendBaseUrl() + this.path + suffix; }
  private opts(): { headers?: any } { return this.polariService.backendRequestOptions as { headers?: any }; }

  /** A refusal answers {ok:false, error}: its words are shown exactly as the server wrote them. */
  private fail(err: any): void {
    this.busy = false;
    const body = err && err.error;
    this.error = (body && (body.error || body.message)) || (err && err.message) || String(err);
  }

  reload(): void {
    this.http.get<InstallerDoc>(this.url(), this.opts()).subscribe({
      next: (d: InstallerDoc) => {
        if (!d || d.ok === false) { this.error = (d && d.error) || 'the installer document is empty'; return; }
        this.doc = d;
        if (!this.target && d.targets && d.targets.length) {
          // a plugged-in board wins over the twin; the twin is always there
          const board = d.targets.find(t => t.kind === 'board');
          this.target = (board || d.targets[0]).name;
        }
        if (!this.variant && d.variants && d.variants.length) { this.variant = d.variants[0].name; }
        if (!this.build) { this.autoBuild(); }
      },
      error: (e: any) => this.fail(e),
    });
  }

  classes(v: Variant): string {
    try { return (JSON.parse(v.classes_json || '[]') as string[]).join(', '); } catch { return v.classes_json; }
  }

  short(sha: string): string { return sha ? sha.slice(0, 16) + '…' : '—'; }
  isTwin(): boolean { return this.target.startsWith('twin:'); }

  buildsFor(): Build[] { return (this.doc?.builds || []).filter(b => b.variant === this.variant); }

  private autoBuild(): void {
    const ok = this.buildsFor().find(b => b.installable);
    this.build = ok ? ok.name : '';
  }

  pickTarget(name: string): void { this.target = name; this.plan = null; }
  pickVariant(name: string): void { this.variant = name; this.plan = null; this.autoBuild(); }
  pickBuild(name: string): void { this.build = name; this.plan = null; }

  buildVariant(): void {
    this.busy = true; this.error = ''; this.plan = null;
    this.http.post<any>(this.url('/build'), { variant: this.variant }, this.opts()).subscribe({
      next: (r: any) => {
        this.busy = false;
        if (r.state !== 'built') { this.error = `build ${r.build}: ${r.notes}`; }
        this.build = r.state === 'built' ? r.build : '';
        this.reload();
      },
      error: (e: any) => this.fail(e),
    });
  }

  makePlan(): void {
    if (!this.build || !this.target) { return; }
    this.busy = true; this.error = ''; this.plan = null;
    this.http.post<Plan>(this.url('/plan'), { instance: this.target, build: this.build }, this.opts()).subscribe({
      next: (p: Plan) => { this.busy = false; this.plan = p; },
      error: (e: any) => this.fail(e),
    });
  }

  /** Disabled until a plan exists — the confirm is for THIS command, nothing else. */
  canConfirm(): boolean { return !!this.plan && this.plan.state === 'planned' && !this.busy; }

  install(): void {
    if (!this.canConfirm() || !this.plan) { return; }
    this.busy = true; this.error = '';
    this.http.post<any>(this.url('/run'), { plan: this.plan.plan, confirm: true }, this.opts()).subscribe({
      next: (r: any) => {
        this.record = r.name;
        this.result = { record: r.name, verdict: r.verdict, verify: r.verify, variant: r.variant, target_kind: r.target_kind,
                        bridge_state: '', frames: [], frames_total: 0, frames_per_s: 0, row_class: r.row_class, row_name: r.row_name,
                        row: null, firmware_sha: r.firmware_sha };
        this.plan = Object.assign({}, this.plan, { state: 'ran' });
        if (r.verdict !== 'installed') { this.busy = false; return; }
        this.http.post<any>(this.url('/attach'), { record: r.name }, this.opts()).subscribe({
          next: () => { this.busy = false; this.startLive(r.row_class); },
          error: (e: any) => { this.fail(e); this.refreshResult(); },
        });
      },
      error: (e: any) => this.fail(e),
    });
  }

  refreshResult(): void {
    if (!this.record) { return; }
    this.http.get<Result>(this.url('/result/' + encodeURIComponent(this.record)), this.opts()).subscribe({
      next: (r: Result) => { this.result = r; },
      error: (e: any) => this.fail(e),
    });
  }

  /** The row's own topic (STOMP) refetches the result; a 2 s poll covers the bridge coming up. */
  private startLive(rowClass: string): void {
    this.stopLive();
    this.refreshResult();
    if (rowClass) {
      try {
        this.watch = this.stomp.watchChanges(rowClass).subscribe(() => this.refreshResult());
      } catch { /* no STOMP here: the poll still runs */ }
    }
    this.poll = setInterval(() => this.refreshResult(), 2000);
  }

  private stopLive(): void {
    if (this.watch) { this.watch.unsubscribe(); this.watch = undefined; }
    if (this.poll) { clearInterval(this.poll); this.poll = undefined; }
  }

  rowKeys(): string[] {
    const r = this.result?.row || {};
    return Object.keys(r).filter(k => k !== 'id' && k !== 'manager' && k !== 'branch' && k !== 'inTree').sort();
  }

  frameKeys(): string[] {
    const f = this.result?.frames || [];
    return f.length ? Object.keys(f[0].values) : [];
  }

  watchText(): string {
    const v = (this.doc?.variants || []).find(x => x.name === (this.result?.variant || this.variant));
    return v ? v.what_to_watch : '';
  }

  /** The loop his intent asks for: keep the target, pick a different variant. */
  tryAnother(): void {
    this.stopLive();
    this.plan = null; this.record = ''; this.result = null; this.error = '';
    const names = (this.doc?.variants || []).map(v => v.name);
    const i = names.indexOf(this.variant);
    this.variant = names.length ? names[(i + 1) % names.length] : '';
    this.autoBuild();
    this.reload();
  }
}
