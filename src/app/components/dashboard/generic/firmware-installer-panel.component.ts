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
 *
 * ins-0/1 (HARDWARE_BENCH_CONVERGENCE_PLAN.md §12). His words: "an obvious
 * toggle for switching between a Sim install and a Real Install … Validation
 * via a sim install is a step we want confirmed by a user before moving to a
 * real install." The two-state toggle at the top sets the MODE; the target,
 * the step titles, the button words and the confirm follow it. The Real side
 * shows the server's gate words for the picked build (what is missing, the
 * sim-install offer) and asks for a plan only when the gate offers it, or when
 * "install anyway" is ticked WITH a reason (sent as install_anyway + reason,
 * recorded on the plan). The Sim side adds the validation step: the four
 * Purposes on the twin (POST …/sim-install, or the server's words on how to
 * run them elsewhere) and the person's tick (POST …/sim-confirmations).
 */
interface Target { name: string; kind: 'twin' | 'board'; label: string; port: string; }
interface Variant { name: string; title: string; purpose: string; app: string; classes_json: string; what_to_watch: string; group?: string; }
/** ins-1: the confirmed-sim gate's reading for one build (the server's words; the panel never judges). */
interface Gate { gated: boolean; offered: boolean; words: string; missing: string[]; offer: string; anyway: string; }
interface Purpose { purpose: string; scenario: string; status: string; run: string; ran_at: string; outcome: string; why: string; }
interface Confirmation { name: string; who_words: string; confirmed_at: string; hex_short: string; words: string; state: string; purposes_passed: number; purposes_total: number; }
interface Build {
  name: string; variant: string; state: string; flash_bytes: number; flash_max: number; ram_bytes: number; ram_max: number;
  flash_pct: number; ram_pct: number; artifact_sha256: string; header_sha256: string; compat: string; compat_why: string;
  installable: boolean; engines: string; built_at: string; gate?: Gate; gate_purposes?: Purpose[]; gate_confirmation?: Confirmation | null;
}
/** ins-0: one of the two install modes, as the server words them. */
interface Mode { name: 'sim' | 'real'; title: string; target_kind: 'twin' | 'board'; words: string; }
interface InstallerDoc {
  ok: boolean; host: string; host_label?: string; board: string; targets: Target[]; adapters: any[]; scan_note: string;
  variants: Variant[]; builds: Build[]; twin: any; records: any[]; error?: string;
  modes?: Mode[]; default_mode?: 'sim' | 'real'; attest?: string; prove_command?: string;
}
interface Plan {
  plan: string; argv_text: string; wrapper_text: string; engine: string; engine_how: string; engine_where: string;
  adapter: string; compat: string; compat_why: string; will_stamp: string; target_kind: string; host: string; port: string; state: string;
  install_mode?: string; gate?: string; gate_words?: string; override_reason?: string;
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
        <span class="fip-host">installs run on <strong [title]="'host id: ' + (doc?.host || '')">{{ doc?.host_label || 'this server' }}</strong> — the machine holding the port</span>
        <span class="fip-scan">{{ doc?.scan_note }}</span>
        <button type="button" (click)="reload()" [disabled]="busy">Refresh</button>
      </div>
      <div class="fip-error" *ngIf="error">{{ error }}</div>

      <!-- ins-0: THE TWO-STATE TOGGLE — Sim install (the twin) | Real install (a detected board); everything below re-labels to it -->
      <div class="fip-modes" role="tablist" aria-label="Install mode">
        <button type="button" class="fip-mode fip-mode-sim" role="tab" [attr.aria-selected]="mode === 'sim'" [class.on]="mode === 'sim'" (click)="setMode('sim')" [disabled]="busy">
          <span class="fip-mode-title">Sim install</span>
          <span class="fip-mode-sub">the simulated board (the twin) — validate here first</span>
        </button>
        <button type="button" class="fip-mode fip-mode-real" role="tab" [attr.aria-selected]="mode === 'real'" [class.on]="mode === 'real'" (click)="setMode('real')" [disabled]="busy">
          <span class="fip-mode-title">Real install</span>
          <span class="fip-mode-sub">a detected board over USB — offered after a confirmed sim install</span>
        </button>
      </div>
      <p class="fip-modewords"><strong>{{ modeTitle() }}:</strong> {{ modeWords() }}</p>

      <section class="fip-step">
        <h3><span class="fip-num">1</span> Where it goes — {{ isSim() ? 'the twin' : 'the board' }}</h3>
        <ng-container *ngIf="isSim()">
          <p class="fip-choice"><strong>The twin</strong> — {{ twinTarget()?.label || 'the simavr twin of the UNO' }}</p>
          <p class="fip-note">The simavr twin runs the very same .hex a real UNO is flashed with. A real install is offered only after the firmware ran its Purposes here and you confirmed what you saw.</p>
        </ng-container>
        <ng-container *ngIf="!isSim()">
          <label class="fip-choice" *ngFor="let t of boardTargets()">
            <input type="radio" name="fip-target" [checked]="target === t.name" (change)="pickTarget(t.name)" [disabled]="busy">
            <span><strong>The board</strong> — {{ t.label }}</span>
          </label>
          <p class="fip-note fip-missing" *ngIf="!boardTargets().length">No board is detected on {{ doc?.host_label || 'this server' }} ({{ doc?.scan_note }}). Plug the UNO in and press Refresh — or do the sim install first.
            <button type="button" (click)="setMode('sim')" [disabled]="busy">Do the sim install first</button></p>
        </ng-container>
        <p class="fip-note" *ngFor="let a of doc?.adapters">
          Adapter seen: {{ a.definition }} at {{ a.by_id_path || a.port }} — {{ a.target_board ? 'wired to ' + a.target_board : 'say which board is wired to it on its row' }}.
        </p>
      </section>

      <section class="fip-step">
        <h3><span class="fip-num">2</span> What to try</h3>
        <ng-template #vcards let-list>
          <div class="fip-variants">
            <label class="fip-variant" *ngFor="let v of list" [class.on]="variant === v.name">
              <input type="radio" name="fip-variant" [checked]="variant === v.name" (change)="pickVariant(v.name)" [disabled]="busy">
              <span class="fip-vtitle">{{ v.title }}</span>
              <span class="fip-vname">{{ v.name }} · speaks {{ classes(v) }}</span>
              <span class="fip-vtext">{{ v.purpose }}</span>
              <span class="fip-vwatch"><em>Watch for:</em> {{ v.what_to_watch }}</span>
            </label>
          </div>
        </ng-template>
        <p class="fip-group" *ngIf="variantsIn('sample').length">The Mission's sample — the light configurations (the first one is the demo's)</p>
        <ng-container *ngTemplateOutlet="vcards; context: { $implicit: variantsIn('sample') }"></ng-container>
        <p class="fip-group" *ngIf="variantsIn('more').length">Other firmware to try</p>
        <ng-container *ngTemplateOutlet="vcards; context: { $implicit: variantsIn('more') }"></ng-container>
        <details class="fip-scenarios" *ngIf="variantsIn('scenario').length" [open]="inScenarioGroup()">
          <summary>Fault-scenario builds ({{ variantsIn('scenario').length }}) — scenario only, for the fault tests, not the demo</summary>
          <ng-container *ngTemplateOutlet="vcards; context: { $implicit: variantsIn('scenario') }"></ng-container>
        </details>
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
          <!-- ins-1: the Real side says, in words, whether this build is offered and what is missing -->
          <div class="fip-gate" *ngIf="!isSim() && gate() as g" [class.fip-offered]="g.offered" [class.fip-notoffered]="!g.offered">
            <p class="fip-gate-words">{{ g.words }}</p>
            <ng-container *ngIf="!g.offered">
              <p class="fip-note">{{ g.offer }} <button type="button" (click)="setMode('sim')" [disabled]="busy">Do the sim install first</button></p>
              <details class="fip-anyway">
                <summary>Install anyway (recorded with your reason)</summary>
                <p class="fip-note">{{ g.anyway }}</p>
                <label class="fip-choice"><input type="checkbox" [checked]="anyway" (change)="anyway = !anyway" [disabled]="busy"> <span>Install on the real board without the confirmed sim</span></label>
                <textarea class="fip-reason" rows="2" placeholder="why — this goes on the plan and the record" [value]="reason" (input)="reason = $any($event.target).value" [disabled]="busy || !anyway"></textarea>
              </details>
            </ng-container>
          </div>
        </ng-container>
      </section>

      <section class="fip-step">
        <h3><span class="fip-num">3</span> Read the command (DRY-RUN — nothing is opened on {{ isSim() ? 'the twin' : 'the board' }})</h3>
        <button type="button" (click)="makePlan()" [disabled]="busy || !build || !target || (!isSim() && !gateAllows())">{{ planLabel() }}</button>
        <div class="fip-plan" *ngIf="plan">
          <code class="fip-cmd">{{ plan.argv_text }}</code>
          <code class="fip-cmd fip-wrap" *ngIf="plan.wrapper_text">runs as: {{ plan.wrapper_text }}</code>
          <table class="fip-kv">
            <tr><th>engine</th><td>{{ plan.engine }} ({{ plan.engine_how }}{{ plan.engine_where ? ': ' + plan.engine_where : '' }})</td></tr>
            <tr><th>adapter</th><td>{{ plan.adapter || 'none — native USB' }}</td></tr>
            <tr><th>compatibility</th><td [class]="'c-' + plan.compat">{{ plan.compat }} — {{ plan.compat_why }}</td></tr>
            <tr><th>will stamp</th><td>{{ plan.will_stamp }}</td></tr>
            <tr><th>runs on</th><td><span [title]="'host id: ' + plan.host">{{ doc?.host_label || 'this server' }}</span> · {{ plan.port }}</td></tr>
            <tr *ngIf="plan.install_mode"><th>mode</th><td>{{ plan.install_mode === 'sim' ? 'Sim install (the twin)' : 'Real install (the board)' }} · gate {{ plan.gate }}</td></tr>
            <tr *ngIf="plan.override_reason" class="fip-override"><th>install anyway</th><td>recorded — {{ plan.override_reason }}</td></tr>
          </table>
        </div>
      </section>

      <section class="fip-step">
        <h3><span class="fip-num">4</span> {{ isSim() ? 'Sim install' : 'Real install' }}</h3>
        <button type="button" class="fip-confirm" (click)="install()" [disabled]="!canConfirm()">
          {{ plan ? 'Confirm: run exactly this command on ' + (isSim() ? 'the twin' : 'the board') : 'Confirm (make the plan first)' }}
        </button>
        <table class="fip-kv" *ngIf="result">
          <tr><th>result</th><td [class]="'v-' + result.verdict"><strong>{{ result.verdict }}</strong> — {{ result.verify }}</td></tr>
          <tr><th>on</th><td>{{ result.target_kind === 'twin' ? 'the twin (simavr)' : 'the board' }} · firmware {{ short(result.firmware_sha) }}</td></tr>
          <tr><th>bridge</th><td>{{ result.bridge_state || 'not attached yet' }}</td></tr>
        </table>
      </section>

      <!-- ins-1: the validation step of a SIM install — the four Purposes on the twin, then the person's tick -->
      <section class="fip-step fip-validate" *ngIf="isSim() && pickedBuild()?.gate?.gated">
        <h3><span class="fip-num">5</span> Validate on the twin, then confirm what you saw</h3>
        <table class="fip-table">
          <thead><tr><th>Purpose</th><th>on the twin</th><th>run</th></tr></thead>
          <tbody><tr *ngFor="let p of purposes()"><td>{{ p.purpose }}</td><td [class]="'s-' + p.status">{{ p.status }}</td><td class="fip-mono">{{ p.run || '—' }}</td></tr></tbody>
        </table>
        <button type="button" (click)="runPurposes()" [disabled]="busy || !build">Run the four Purposes on the twin</button>
        <p class="fip-note fip-missing" *ngIf="purposeNote">{{ purposeNote }}</p>
        <code class="fip-cmd" *ngIf="purposeRetry">{{ purposeRetry }}</code>
        <label class="fip-choice fip-attest"><input type="checkbox" [checked]="ticked" (change)="ticked = !ticked" [disabled]="busy || !build"> <span>{{ doc?.attest || 'I checked the simulated board does what the firmware says' }}</span></label>
        <button type="button" class="fip-confirm" (click)="confirmSim()" [disabled]="busy || !ticked || !build">Record my confirmation for this build</button>
        <p class="fip-note" *ngIf="pickedBuild()?.gate_confirmation as c">Confirmed by {{ c.who_words }} at {{ c.confirmed_at }} for {{ c.hex_short }}… ({{ c.purposes_passed }}/{{ c.purposes_total }} Purposes passed then).</p>
        <p class="fip-gate-words" [class.fip-offered]="pickedBuild()?.gate?.offered" [class.fip-notoffered]="!pickedBuild()?.gate?.offered" *ngIf="pickedBuild()?.gate as g">{{ g.words }}
          <button type="button" *ngIf="g.offered" (click)="setMode('real')" [disabled]="busy">Go to the real install</button></p>
      </section>

      <section class="fip-step" *ngIf="result">
        <h3><span class="fip-num">{{ isSim() && pickedBuild()?.gate?.gated ? 6 : 5 }}</span> What it says now</h3>
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
    .fip-modes { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 4px 0 6px; }
    .fip-mode { display: grid; gap: 2px; text-align: left; padding: 10px 12px; border: 2px solid var(--border-medium); background: var(--surface-secondary);
                color: var(--text-on-card); cursor: pointer; opacity: .75; }
    .fip-mode.on { opacity: 1; border-color: var(--color-success); background: var(--surface-primary); box-shadow: inset 0 -4px 0 var(--color-success); }
    .fip-mode-real.on { border-color: var(--color-warn); box-shadow: inset 0 -4px 0 var(--color-warn); }
    .fip-mode-title { font-size: 16px; font-weight: 700; }
    .fip-mode-sub { font-size: 12px; opacity: .85; }
    .fip-modewords { margin: 0 0 10px; }
    .fip-gate { margin-top: 8px; padding: 8px 10px; border: 1px solid var(--border-medium); }
    .fip-gate-words { margin: 0 0 6px; font-weight: 600; }
    .fip-offered { color: var(--color-success-text); }
    .fip-notoffered, .fip-missing { color: var(--color-error-text); }
    .fip-anyway { margin-top: 6px; }
    .fip-anyway summary { cursor: pointer; }
    .fip-reason { width: 100%; box-sizing: border-box; margin-top: 4px; font: inherit; color: var(--text-on-card); background: var(--surface-secondary); }
    .fip-override td { color: var(--color-warn); }
    .fip-attest { margin-top: 8px; font-weight: 600; }
    .fip input[type=checkbox] { width: 16px; height: 16px; min-width: 16px; margin: 0; accent-color: var(--color-success); }
    .s-proven-on-twin, .s-proven-on-hardware { color: var(--color-success-text); }
    .s-planned { opacity: .8; }
    .fip-step { border: 1px solid var(--border-medium); border-left-width: 4px; border-left-color: var(--color-warn);
                padding: 10px 12px; margin-bottom: 10px; }
    .fip-step h3 { font-size: 14px; margin: 0 0 8px; display: flex; gap: 8px; align-items: baseline; }
    .fip-num { opacity: .6; font-weight: 400; }
    .fip-choice { display: flex; gap: 6px; align-items: baseline; margin: 4px 0; }
    /* one size for every radio circle (the cards, the targets and the build table drew them differently) */
    .fip input[type=radio] { width: 16px; height: 16px; min-width: 16px; margin: 0; padding: 0; flex: none;
                             accent-color: var(--color-success); align-self: flex-start; }
    .fip-choice input[type=radio] { align-self: center; }
    .fip-group { margin: 10px 0 6px; font-weight: 600; }
    .fip-scenarios { margin: 10px 0; }
    .fip-scenarios summary { cursor: pointer; opacity: .85; margin-bottom: 8px; }
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
  /** ins-0: the install mode — 'sim' (the twin) | 'real' (a detected board). Set from the document's default_mode once, then by the toggle. */
  mode: 'sim' | 'real' = 'sim';
  private modeChosen = false;
  target = '';
  variant = '';
  build = '';
  plan: Plan | null = null;
  record = '';
  result: Result | null = null;
  busy = false;
  error = '';
  /** ins-1: the Real side's "install anyway" (ticked + a reason) and the Sim side's tick + the Purposes' last answer. */
  anyway = false;
  reason = '';
  ticked = false;
  purposeNote = '';
  purposeRetry = '';
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
        if (!this.modeChosen) {
          // the page opens on the real board when one is plugged in, else on the twin (the server's default_mode)
          this.mode = d.default_mode === 'real' ? 'real' : 'sim';
          this.modeChosen = true;
        }
        this.syncTarget();
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
  isSim(): boolean { return this.mode === 'sim'; }

  /** ins-0: the toggle. The target follows the mode (the twin, or the first detected board); a plan is for one mode, so it is dropped. */
  setMode(m: 'sim' | 'real'): void {
    if (this.mode === m) { return; }
    this.mode = m; this.modeChosen = true;
    this.plan = null; this.error = '';
    this.syncTarget();
  }

  private syncTarget(): void {
    const ts = this.doc?.targets || [];
    const twin = ts.find(t => t.kind === 'twin');
    const boards = ts.filter(t => t.kind === 'board');
    if (this.isSim()) { this.target = twin ? twin.name : ''; return; }
    if (!boards.some(b => b.name === this.target)) { this.target = boards.length ? boards[0].name : ''; }
  }

  twinTarget(): Target | undefined { return (this.doc?.targets || []).find(t => t.kind === 'twin'); }
  boardTargets(): Target[] { return (this.doc?.targets || []).filter(t => t.kind === 'board'); }
  modeDef(): Mode | undefined { return (this.doc?.modes || []).find(m => m.name === this.mode); }
  modeTitle(): string { return this.modeDef()?.title || (this.isSim() ? 'Sim install' : 'Real install'); }
  modeWords(): string {
    return this.modeDef()?.words || (this.isSim() ? 'the simulated board (the twin). Install here first, run the four Purposes, watch it, then tick what you saw.'
                                               : 'a detected board on this host. Offered only after a confirmed sim install.');
  }

  pickedBuild(): Build | undefined { return (this.doc?.builds || []).find(b => b.name === this.build); }
  /** ins-1: the server's gate reading for the picked build (the Real side's words). */
  gate(): Gate | undefined { return this.pickedBuild()?.gate; }
  purposes(): Purpose[] { return this.pickedBuild()?.gate_purposes || []; }
  /** A real plan may be asked for when the gate offers it, or when "install anyway" is ticked with a reason. */
  gateAllows(): boolean {
    const g = this.gate();
    if (!g || !g.gated || g.offered) { return true; }
    return this.anyway && this.reason.trim().length > 0;
  }
  planLabel(): string {
    if (this.isSim()) { return 'Show me what will run on the twin'; }
    const g = this.gate();
    if (g && g.gated && !g.offered) { return this.anyway ? 'Show me what will run on the board (install anyway)' : 'Real install not offered yet — see why above'; }
    return 'Show me what will run on the board';
  }

  /** The variants of one group (sample | more | scenario); a document without groups lists all under "more". */
  variantsIn(group: string): Variant[] {
    return (this.doc?.variants || []).filter(v => (v.group || 'more') === group);
  }

  /** The collapsed scenario section opens itself when the picked variant lives in it. */
  inScenarioGroup(): boolean { return this.variantsIn('scenario').some(v => v.name === this.variant); }

  buildsFor(): Build[] { return (this.doc?.builds || []).filter(b => b.variant === this.variant); }

  private autoBuild(): void {
    const ok = this.buildsFor().find(b => b.installable);
    this.build = ok ? ok.name : '';
  }

  pickTarget(name: string): void { this.target = name; this.plan = null; }
  pickVariant(name: string): void { this.variant = name; this.plan = null; this.ticked = false; this.purposeNote = ''; this.purposeRetry = ''; this.autoBuild(); }
  pickBuild(name: string): void { this.build = name; this.plan = null; this.ticked = false; }

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
    const body: any = { instance: this.target, build: this.build };
    const g = this.gate();
    if (!this.isSim() && g && g.gated && !g.offered && this.anyway && this.reason.trim()) {
      // ins-1: past the gate only by saying so, with the reason — the server records both on the plan
      body.install_anyway = true; body.reason = this.reason.trim();
    }
    this.http.post<Plan>(this.url('/plan'), body, this.opts()).subscribe({
      next: (p: Plan) => { this.busy = false; this.plan = p; },
      error: (e: any) => this.fail(e),
    });
  }

  /** ins-0: the sim install's validation — the four Purposes on the twin, run by the server (or its words on how to run them elsewhere). */
  runPurposes(): void {
    this.busy = true; this.error = ''; this.purposeNote = ''; this.purposeRetry = '';
    this.http.post<any>(this.url('/sim-install'), { config: this.variant }, this.opts()).subscribe({
      next: (r: any) => {
        this.busy = false;
        const runs = (r.runs || []) as Array<{ purpose: string; outcome: string }>;
        this.purposeNote = runs.length ? runs.map(x => `${x.purpose}: ${x.outcome}`).join(' · ') : 'no Purpose ran';
        this.reload();
      },
      error: (e: any) => {
        this.busy = false;
        const body = e && e.error;
        this.purposeNote = (body && body.error) || (e && e.message) || String(e);
        this.purposeRetry = (body && body.retry) || '';
      },
    });
  }

  /** ins-1: the person's tick for the picked build — a SimInstallConfirmation row on the server (who = the signed-in user). */
  confirmSim(): void {
    if (!this.ticked || !this.build) { return; }
    this.busy = true; this.error = '';
    this.http.post<any>(this.url('/sim-confirmations'), { config: this.variant, build: this.build, source: 'installer' }, this.opts()).subscribe({
      next: () => { this.busy = false; this.ticked = false; this.reload(); },
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
    this.plan = null; this.record = ''; this.result = null; this.error = ''; this.ticked = false; this.purposeNote = ''; this.purposeRetry = '';
    const names = (this.doc?.variants || []).map(v => v.name);
    const i = names.indexOf(this.variant);
    this.variant = names.length ? names[(i + 1) % names.length] : '';
    this.autoBuild();
    this.reload();
  }
}
