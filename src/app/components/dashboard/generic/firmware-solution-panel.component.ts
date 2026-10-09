import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, Input, OnChanges, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { PolariService } from '@services/polari-service';
import { friendlyError } from './friendly-error';

/**
 * firmware-solution-panel — fs-1 (DEMONSTRABLES_PLAN.md §9) + fs-2b (his renames/rulings 2026-10-06)
 * + fs-2c, the UX slice of HARDWARE_DEV_PRIORITIES.md §3b (his rulings 2026-10-06).
 *
 * fs-2c item 1 — Tasks = ALL tasks (fs-2b already built the full table; only the section's own label was wrong,
 * his correction: "the Tab for tasks should not be called Unregistered Tasks since it is all tasks"), now grouped
 * by Purpose (`solution.purposes[].task_names` — D-ucd-12, his ruling: Task and Purpose are the words; the backend
 * payload's `capabilities` key, kept this release for older callers, carries the identical rows) with a
 * "No purpose yet" bucket for tasks no Purpose names. D-ucd-12 also rules that a task can belong to MULTIPLE
 * Purposes: `buildTaskGroups` lists a task under EVERY Purpose that names it (never one exclusive bucket), each
 * such row carrying an "also in: <other purposes>" chip; each group still carries its own Purpose status chip
 * (planned/proven-on-twin/proven-on-hardware/failing) and each row its registered pin or an "unregistered" mark.
 * The compact Unregistered-Tasks chip strip stays beside the pin map only (the assignment shorthand) — fs-2b's own
 * one inside the Tasks section is retired now that the full table already marks "unregistered" per row.
 *
 * fs-2c item 2 — ONE selection model, many entry points: `handleTaskActivate`/`handlePinActivate` are the ONLY two
 * methods any clickable task/pin binds to — the Tasks row, the Unregistered-Tasks chip, a schedule-lane chip, and a
 * Target-details row (the pin list under a selected task; the Registered-Tasks/compatible list under a selected
 * pin) all call the SAME one. `selectTask`/`selectPin` are the toggle-aware primitives they fall back to when
 * nothing on the other side is selected; the SAME click on an already-selected task/pin deselects (the toggle
 * rule), Escape clears everything from anywhere (`@HostListener('document:keydown.escape')`).
 *
 * fs-2c items 3/4 — symmetric highlighting + "selection then action with a confirm" (his ruled pick, the §3b
 * addendum): a task selected marks its OWN registered pins SOLID and its still-valid/undetermined candidates
 * OUTLINED (`applyHighlighting`, the SVG overlay) and its caller/called tasks solid in Tasks + Schedule
 * (`taskHighlight`, `relatedTaskNames`); a pin selected marks its Registered Tasks solid and compatible unregistered
 * tasks outlined (derived from the per-task valid-targets responses already cached by `taskValidityCache` — no new
 * per-pin door). Clicking the opposite, compatible item never POSTs — it only sets `pending` (`offerPair`), rendered
 * as a Register/Unregister confirm in the ONE selection bar above the map (`selectionText`); nothing is written
 * until `confirmPending()` is clicked (`postAssign` — the SAME door for both: lives_on='unbound' is fs-0's existing
 * unassign path, already handled server-side by `on_post_assign`, so no new backend door was needed here). A drag
 * lands on the identical confirm (`onDrop` calls `handlePinActivate`, same as a click) — ONE path to a write. A 422
 * the backend still returns surfaces in the SAME bar (`assignError`).
 *
 * fs-2c item 5 — Target details ranked by relevance (his ruling, same day): for a selected task, valid targets
 * first, then undetermined, then registered-elsewhere (cooperating before conflicting), invalid collapsed behind
 * "show N more" (`taskRanked`); for a selected pin, Registered Tasks first, then compatible unregistered tasks,
 * then the rest collapsed (`pinRanked`). The register facts (SoC pin · port/bit · DDR/PORT/PIN · alternate
 * functions · limits · net/connector) stay above those lists, each cited.
 */

interface SolutionRow { name: string; title: string; }
interface SolutionDetail {
  name: string; title: string; graph: string; board_resolved: string; board_exists: boolean;
  runtime: string; status: string; validation: string; validation_why: string; task_count: number; purpose: string;
}
/** fs-2d (his ask, verbatim: "our tasks to be linked to their no-code solutions that compose them") — the reverse
 * link from a task to where it is COMPOSED: the CGraph + the node it IS, the canvas route that opens straight at
 * it, any SolutionDefinition/HardwareSolution over the same graph, and which Purposes name it (D-ucd-12). Backend:
 * GET /api/firmware/solutions/{name}'s `schedule`/`assignments` rows (cmod_firmware_api.FirmwareAPI._composed_by)
 * — `purposes` and the deprecated `capabilities` carry the same names. */
interface ComposedBy { graph: string; node: string; canvas_route: string; solution: string; capabilities: string[]; purposes: string[]; }
interface ScheduleSlot {
  name: string; solution: string; task: string; lane: string; order: number; trigger: string;
  period_ms: number; measured_cycles: number; isr_vector: string; provenance: string; notes: string;
  composed_by?: ComposedBy | null;
}
interface RegisterAssignment {
  name: string; solution: string; task: string; port: string; target_kind: string; controls: string;
  lives_on: string; status: string; provenance: string; notes: string; composed_by?: ComposedBy | null;
  /** ucd-0b2c (§5h B2/B6, the audit's reconciliation): requirement/assignment rows widened — every field OPTIONAL
   * so an older backend (pre-ucd-0b2a) still renders (the Tasks chip and "Resources this task uses" table fall
   * back to `target_kind` when `requirement_kind` is absent). */
  requirement_kind?: string; role?: string; required?: boolean; resource_kind?: string;
  signal_route?: string; configuration?: string;
  /** ucd-attest: a person's own override of the TargetDefinition's requirement_kind/role, laid over this row —
   * absent when nothing overrides it. `target_definition_name` is the Override dialog's own `target_name` (the
   * TargetDefinition row THIS assignment was joined from — never the assignment's own name). */
  derived_requirement_kind?: string; derived_role?: string; overrides_refs_json?: string; target_definition_name?: string;
}

/** ucd-0b2 RULED (§5h, his words): a FirmwareSolution is hardware-agnostic; a HardwareBinding '<solution>@<board>'
 * is the hardware-specific mask over one board — it owns the assignments/claims/routes for that board and carries
 * a computed status against the task requirements. Optional fields are the refs the panel never reads directly
 * (the backend keeps them for provenance/build tooling). Absent entirely (older backend, no `bindings` key) means
 * the Binding picker degrades to nothing — the Solution picker alone, no status line, no "+ bind" control. */
interface HardwareBindingRow {
  name: string; solution: string; board: string; soc: string; is_default: boolean;
  status: 'valid' | 'incomplete' | 'invalid'; why: string;
  requirements_total: number; requirements_met: number;
  assignments_refs_json?: string; claims_refs_json?: string; settings_refs_json?: string; routes_refs_json?: string;
  last_build?: string; provenance?: string; notes?: string;
  /** ucd-attest: a person may override `status` (his ruling: "we should be able to manually change those values
   * when we prove them correct") — the derivation's own verdict survives beside it. Absent = no override. */
  derived_status?: string; status_why?: string; overrides_refs_json?: string;
}

/** ucd-0b2c item 2: one row of the "Resources this task uses" table — derived client-side from the task's own
 * `assignments` rows (never a new door). `needs_pin`/`memory_field` are the two states the table calls out by
 * name ("needs a pin" / "memory field, no hardware"). */
interface TaskResourceRow {
  port: string; requirement_kind: string; role: string; required: boolean;
  bound_to: string; status: string; route: string; needs_pin: boolean; memory_field: boolean;
  /** ucd-attest: the TargetDefinition row's own name (the Override dialog's `target_name`), and the derivation's
   * own requirement_kind/role surviving beside a person's override. */
  target_definition_name: string; derived_requirement_kind?: string; derived_role?: string; overrides_refs_json?: string;
}
interface TaskRow { task: string; lane: string; order: number; kind: string; ports: string; resources: string; cost: string; target: string; composed_by: ComposedBy | null; }
interface LaneChip { task: string; order: number; measured: string; children: LaneChip[]; }
interface RegisteredTaskRow { task: string; port: string; status: string; cooperating: boolean; }
interface PinRegisteredTask { task: string; port: string; solution: string; lane: string; status: string; cooperating: boolean; }

/** hw priorities P1 (`cmod_firmware_api.py`'s `_capabilities`), D-ucd-12 (his ruling): the Purpose grouping for the
 * Tasks section — read from the payload's `purposes` key (falls back to the deprecated `capabilities` key, same
 * rows, for an older backend). A task may be named by several PurposeRow entries. */
interface PurposeRow {
  name: string; goal: string; status: string; last_proof?: string; task_names: string[];
  /** ucd-attest: 'measured' | 'attested' | '' beside the SAME ladder step — never folded into `status`. */
  proof_kind?: string;
}
/** D-ucd-12: a task lands under EVERY Purpose naming it — `alsoIn` names this row's OTHER Purposes (by goal/name),
 * rendered as the "also in: …" chip; empty for a task named by exactly one Purpose (or none). */
interface GroupedTaskRow extends TaskRow { alsoIn: string[]; }
interface TaskGroup { key: string; title: string; status: string; rows: GroupedTaskRow[]; proofKind?: string; }

type Verdict = 'valid' | 'invalid' | 'undetermined';
interface ValidTargetPin { pin: string; verdict: Verdict; reason: string; registered_to: string[]; cooperating: boolean; }
interface ValidTargetsResponse { ok: boolean; solution: string; task: string; kind: string; pins: ValidTargetPin[]; refused?: string; }

/** fs-2c item 4: the one write-shaped action the selection bar ever offers — nothing POSTs until Register/Unregister
 * is clicked (`confirmPending`). */
type PendingKind = 'register' | 'unregister';
interface PendingAction { kind: PendingKind; task: RegisterAssignment; pin: string; }

/** ucd-0b: the confirm bar's own config fields, shown only when the pending registration's task kind needs them
 * (edge for interrupt-in; pull for digital-in/interrupt-in; initial for digital-out) — sent as `config` on the
 * assign POST. Defaults match the backend contract's stated defaults. */
interface PendingConfig { edge: PinEdge; pull: PinPull; initial: PinInitial; }
const DEFAULT_PENDING_CONFIG: PendingConfig = { edge: 'any', pull: 'up', initial: 'low' };

interface AltFunction { function: string; peripheral: string; signal: string; kind: string; fact: string; }
/** fs-2d (his ask, verbatim: "the power pins have no definitions at all, they should at least have their target
 * sections reactively instead describe what they do and what they are for") — the content of the "Power /
 * reference" block, present on PinDetail only for a power/reference connector label (IOREF, RESET, +3V3, +5V, GND,
 * VIN, AREF — board.custom.power_pins.detail_for). */
interface KitPartRef { name: string; title: string; interface_kind: string; }
interface PowerReferenceDetail {
  label: string; role: string; purpose: string; electrical: Record<string, any>; typical_uses: string[];
  assignable: boolean; assignable_reason: string; locations: { connector: string; number: number }[];
  net: string; sources: { label: string; url: string }[]; parts_that_connect_here: KitPartRef[];
}
interface PinDetail {
  ok: boolean; board: string; pin: string; roles: string[]; soc_pin: string;
  register: { port: string; bit: number | null; package_pin: string; default_function: string; fact: string };
  alternate_functions: AltFunction[];
  current_assignment: { function: string; peripheral: string; signal: string; firmware_symbol: string };
  electrical: Record<string, any>;
  net: string; connector: string; connector_number: number | null; facts: any[];
  registered_tasks: PinRegisteredTask[]; unregistered: boolean;
  power_reference?: PowerReferenceDetail | null; parts_that_connect_here?: KitPartRef[];
}
interface TargetCompatRow { name: string; kind: string; title: string; roles: string; description: string; matches: string; source_label: string; source_url: string; notes: string; }

/** ucd-0b: the firmware-chain contract (HARDWARE_DEV_PRIORITIES.md §5f/§5g) — why a pin is configured the way the
 * firmware configures it. `PinClaim` carries the novice's own design choices (mode/pull/edge/initial), authored at
 * Register time (below); `RegisterFieldSetting`/`RegisterSetting` are the derived rows a claim produces; `hops` is
 * the board's hardware chain for this one pin (BoardPin -> SocPin -> PinFunction -> PeripheralSignal -> Peripheral ->
 * Register -> RegisterField), every hop a `ref` ('Class:name') the generic object page already resolves. Every field
 * here is OPTIONAL in practice — an older backend (pre-ucd-0b) answers 404 on the chain door, or a payload missing a
 * key — so every reader below tolerates absence (renders nothing for that piece, never an error).
 */
type PinMode = 'in' | 'out' | 'alt';
type PinPull = 'none' | 'up' | 'undetermined';
type PinEdge = 'none' | 'any' | 'rising' | 'falling' | 'low' | 'undetermined';
type PinInitial = 'low' | 'high' | 'none';
interface PinClaim {
  name: string; solution: string; board_pin: string; soc_pin: string; task: string; port: string;
  requirement_kind: string; mode: PinMode; pin_function: string; pull: PinPull; edge: PinEdge; initial: PinInitial;
  rule: string; provenance: 'derived' | 'canvas'; status: 'ok' | 'conflict' | 'incomplete'; why: string;
  /** ucd-0b2c: claims are now owned by a HardwareBinding — carried for provenance only, not read by the panel. */
  binding?: string;
  /** ucd-attest: a person's own override of mode/pull/edge/initial — the derivation's own value survives beside
   * it as `derived_<field>`; absent when nothing overrides that field. */
  derived_mode?: string; derived_pull?: string; derived_edge?: string; derived_initial?: string;
  overrides_refs_json?: string;
}
interface RegisterFieldSettingRow {
  name: string; register_setting: string; register_field: string; value: string; meaning: string;
  pin_claim: string; task: string; rule: string;
}
interface RegisterSettingRow {
  name: string; register: string; phase: string; value: string; value_bits?: string;
  write_mask?: string; field_settings_refs_json?: string; status: string;
}
interface SignalRouteRow { name: string; pin_claim: string; pin_function: string; signal: string; peripheral: string; status: string; }
interface ChainHop { hop: number; kind: string; name: string; what: string; detail: string; ref: string; }
interface PinChainResponse {
  ok: boolean; pin: string; claim: PinClaim | null; field_settings: RegisterFieldSettingRow[];
  register_settings: RegisterSettingRow[]; route: SignalRouteRow | null; hops: ChainHop[];
}

type SectionKey = 'tasks' | 'schedule' | 'pins' | 'detail';
const SECTION_ORDER: SectionKey[] = ['tasks', 'schedule', 'pins', 'detail'];
const SECTION_LABELS: Record<SectionKey, string> = {
  tasks: 'Tasks', schedule: 'Schedule', pins: 'Pin map', detail: 'Target details',
};
const LAYOUT_KEY = 'polari-firmware-panel-layout';
const PAIR_PRESETS: [SectionKey, SectionKey][] = [
  ['tasks', 'pins'], ['pins', 'detail'], ['tasks', 'detail'], ['schedule', 'pins'],
];

const LANES = ['init', 'isr', 'tick', 'loop'];
const LANE_COLORS: Record<string, string> = { init: '#2e7d32', isr: '#c62828', tick: '#6a1b9a', loop: '#1565c0', called: '#8d6e63' };
const VERDICT_COLORS: Record<Verdict, string> = { valid: '#2e7d32', invalid: '#9e9e9e', undetermined: '#f9a825' };
const CAP_STATUS_COLORS: Record<string, string> = {
  planned: '#78909c', 'proven-on-twin': '#1565c0', 'proven-on-hardware': '#2e7d32', failing: '#b00020',
};

@Component({
  standalone: true,
  selector: 'firmware-solution-panel',
  imports: [CommonModule, FormsModule, RouterModule, MatProgressSpinnerModule],
  template: `
    <div class="fsp">
      <div class="fsp-bar">
        <label class="fsp-pick">
          <span>Firmware Solution</span>
          <select [ngModel]="selected" (ngModelChange)="select($event)">
            <option *ngFor="let s of solutions" [value]="s.name">{{ s.title || s.name }}</option>
          </select>
        </label>
        <!-- ucd-0b2c item 1 (§5h RULED: a Solution is hardware-agnostic; a HardwareBinding '<solution>@<board>' is
             the hardware-specific mask) — degrades to nothing when the payload carries no 'bindings' key. -->
        <label class="fsp-pick" *ngIf="bindings.length">
          <span>Binding</span>
          <select [ngModel]="bindingPick" (ngModelChange)="selectBinding($event)">
            <option *ngFor="let b of bindings" [value]="b.name">{{ b.board }} · {{ b.status }}{{ b.is_default ? ' (default)' : '' }}</option>
          </select>
        </label>
        <span class="fsp-validation" *ngIf="validation" [class.fsp-ok]="validation.ok" [class.fsp-bad]="!validation.ok">
          {{ validation.ok ? 'validated' : 'refused' }} — {{ validation.why }}
        </span>
        <button type="button" class="fsp-export-btn" (click)="exportSolution()" [disabled]="!selected || exporting"
                title="Write the CMake project (the rendered C, CMakeLists.txt, toolchain, README, manifest), verify it rebuilds on the engines image, and download it">
          {{ exporting ? 'Exporting…' : 'Export (CMake)' }}
        </button>
        <a class="fsp-link" [routerLink]="'/display/hardware-chain'" title="pins → functions → peripherals → registers → bit fields">Hardware chain</a>
        <a class="fsp-link" [routerLink]="'/display/c-canvas'">&larr; C canvas</a>
        <a class="fsp-link" [routerLink]="'/display/hardware-solutions'">&larr; Hardware solutions</a>
      </div>

      <!-- ucd-0b2c item 1: the one-line binding status + "+ bind to another board" — both absent entirely when
           the backend carries no 'bindings' key (degrade: the Solution picker alone, nothing else changes). -->
      <div class="fsp-binding-status" *ngIf="binding">
        <span>Binding {{ binding.name }}: {{ binding.status }} — {{ binding.requirements_met }}/{{ binding.requirements_total }} required resources met</span>
        <span class="fsp-warning" *ngIf="binding.why"> — {{ binding.why }}</span>
        <!-- ucd-attest: a person may mark a binding valid/invalid with why — the derivation keeps its own verdict
             (derived_status), shown in status_why beside the override. -->
        <span class="fsp-override-marker" *ngIf="binding.derived_status !== undefined" [title]="binding.status_why || ''"
              (click)="retireOverride(overrideRefFor(binding.overrides_refs_json, 'status'))">overridden (retire)</span>
        <button type="button" class="fsp-override-btn" (click)="openOverride('HardwareBinding', binding.name, 'status', binding.status)">Override</button>
      </div>
      <div class="fsp-bind-row" *ngIf="bindings.length">
        <span class="fsp-bind-label">+ bind to another board</span>
        <select [(ngModel)]="newBindBoard">
          <option value="">choose a board…</option>
          <option *ngFor="let b of boardChoices" [value]="b">{{ b }}</option>
        </select>
        <button type="button" class="fsp-bind-btn" (click)="bindToBoard()" [disabled]="!newBindBoard || bindBusy">{{ bindBusy ? 'Binding…' : 'Bind' }}</button>
        <span class="fsp-error" *ngIf="bindError">{{ bindError }}</span>
      </div>

      <!-- ucd-attest: the ONE Override dialog, shared by every overridable field (PinClaim.pull/edge/mode/initial,
           TargetDefinition.requirement_kind/.role, HardwareBinding.status) — nothing POSTs until "Confirm" is
           clicked; Escape cancels. The derived value is shown beside the input so a correction is never a guess. -->
      <div class="fsp-override-dialog" *ngIf="overrideOpenFor as ov" (keydown.escape)="cancelOverride()">
        <strong>Override {{ ov.targetClass }}.{{ ov.field }}</strong> <small>(derived: {{ ov.derivedValue }})</small>
        <label>New value
          <select *ngIf="ov.field === 'status'" [(ngModel)]="overrideForm.value">
            <option value="valid">valid</option>
            <option value="incomplete">incomplete</option>
            <option value="invalid">invalid</option>
          </select>
          <input *ngIf="ov.field !== 'status'" type="text" [(ngModel)]="overrideForm.value" />
        </label>
        <label class="fsp-attest-observed">Why (required)
          <textarea [(ngModel)]="overrideForm.why" rows="2" placeholder="a person's own words — proof it is correct"></textarea>
        </label>
        <div class="fsp-attest-actions">
          <button type="button" class="fsp-confirm-btn" (click)="confirmOverride()" [disabled]="overrideBusy">{{ overrideBusy ? 'Confirming…' : 'Confirm' }}</button>
          <button type="button" (click)="cancelOverride()">Cancel</button>
          <span class="fsp-error" *ngIf="overrideError">{{ overrideError }}</span>
        </div>
      </div>

      <!-- ucd-0f: the export's result — what was written, whether the CMake build reproduced the Makefile build, the download -->
      <div class="fsp-export" *ngIf="exportResult || exportError">
        <ng-container *ngIf="exportResult as x">
          <b>Exported</b> {{ x.name }} —
          <a [href]="base + x.download_url" target="_blank" rel="noopener">download {{ x.name }}.tar.gz</a>
          · parity <span [class.fsp-ok]="x.parity === 'identical'" [class.fsp-bad]="x.parity === 'differs'">{{ x.parity }}</span>
          <small>(Makefile hex {{ (x.makefile_sha256 || '—') | slice:0:12 }} · CMake hex {{ (x.cmake_sha256 || '—') | slice:0:12 }})</small>
          · build it: <code>cmake -S . -B build &amp;&amp; cmake --build build</code> or <code>cmake -P polari-build.cmake</code>
          <span *ngIf="x.why" class="fsp-bad"> · {{ x.why }}</span>
        </ng-container>
        <span *ngIf="exportError" class="fsp-bad">{{ exportError }}</span>
      </div>

      <div class="fsp-presets">
        <span class="fsp-presets-label">Layout:</span>
        <button type="button" (click)="showAll()">All four</button>
        <label class="fsp-preset-pick">One
          <select #oneSel (change)="showOne(oneSel.value); oneSel.value = ''">
            <option value="">choose…</option>
            <option *ngFor="let k of sectionKeys" [value]="k">{{ sectionLabel(k) }}</option>
          </select>
        </label>
        <label class="fsp-preset-pick">Two
          <select #twoSel (change)="showTwoAt(twoSel.value); twoSel.value = ''">
            <option value="">choose…</option>
            <option *ngFor="let p of pairPresets; let i = index" [value]="i">{{ sectionLabel(p[0]) }} + {{ sectionLabel(p[1]) }}</option>
          </select>
        </label>
        <span class="fsp-legend">
          <span class="fsp-legend-item"><i class="fsp-dot" style="background:#2e7d32"></i>valid / solid</span>
          <span class="fsp-legend-item"><i class="fsp-dot" style="background:#9e9e9e"></i>invalid</span>
          <span class="fsp-legend-item"><i class="fsp-dot" style="background:#f9a825"></i>undetermined</span>
          <span class="fsp-legend-item"><i class="fsp-dot fsp-dot-ring"></i>selected</span>
        </span>
      </div>

      <!-- fs-2c item 2/4: the ONE selection bar — always states the current selection and what the next click does,
           and is where a Register/Unregister confirm (and any 422 reason) ever appears. Never more than one. -->
      <div class="fsp-selection-bar" *ngIf="solution">
        <span class="fsp-selection-text">{{ selectionText }}</span>
        <ng-container *ngIf="pending">
          <!-- ucd-0b: the config fields, shown only when THIS registration's task kind needs them (§ contract);
               nothing is sent before Register — picking a value here only updates the pending config. -->
          <label class="fsp-pending-field" *ngIf="pending.kind === 'register' && pendingNeeds.edge">
            edge
            <select [(ngModel)]="pendingConfig.edge">
              <option value="any">any</option><option value="rising">rising</option>
              <option value="falling">falling</option><option value="low">low</option>
            </select>
          </label>
          <label class="fsp-pending-field" *ngIf="pending.kind === 'register' && pendingNeeds.pull">
            pull
            <select [(ngModel)]="pendingConfig.pull">
              <option value="none">none</option><option value="up">up</option>
            </select>
          </label>
          <label class="fsp-pending-field" *ngIf="pending.kind === 'register' && pendingNeeds.initial">
            initial
            <select [(ngModel)]="pendingConfig.initial">
              <option value="low">low</option><option value="high">high</option>
            </select>
          </label>
          <button type="button" class="fsp-confirm-btn" (click)="confirmPending()">{{ pending.kind === 'register' ? 'Register' : 'Unregister' }}</button>
          <button type="button" class="fsp-cancel-btn" (click)="cancelPending()">Cancel</button>
        </ng-container>
        <span class="fsp-error fsp-bar-msg" *ngIf="assignError">{{ assignError }}</span>
        <span class="fsp-warning fsp-bar-msg" *ngIf="assignWarning">{{ assignWarning }}</span>
      </div>

      <div *ngIf="loading" class="fsp-state"><mat-spinner diameter="28"></mat-spinner></div>
      <div *ngIf="error" class="fsp-state fsp-error">{{ error }}</div>

      <div class="fsp-shell" *ngIf="!loading && !error && solution">
        <div class="fsp-collapsed-bar" *ngIf="collapsedKeys.length">
          <button type="button" class="fsp-collapsed-chip" *ngFor="let k of collapsedKeys"
                  (click)="toggleSection(k)" [attr.aria-label]="'expand ' + sectionLabel(k)">
            &#9656; {{ sectionLabel(k) }}
          </button>
        </div>

        <div class="fsp-sections">
          <div class="fsp-section" *ngFor="let k of openKeys" [style.flexBasis.%]="100 / openKeys.length">
            <div class="fsp-section-header">
              <h4>{{ sectionHeading(k) }}</h4>
              <button type="button" class="fsp-collapse-btn" (click)="toggleSection(k)" aria-label="collapse section">&#9662;</button>
            </div>
            <div class="fsp-section-body">

              <ng-container *ngIf="k === 'tasks'">
                <div class="fsp-task-group" *ngFor="let g of taskGroups">
                  <div class="fsp-task-group-header">
                    <strong>{{ g.title }}</strong>
                    <span class="fsp-badge fsp-cap-badge" *ngIf="g.status" [style.background]="capStatusColor(g.status)">
                      {{ g.status }}<small *ngIf="g.proofKind === 'attested'"> (attested)</small>
                    </span>
                    <!-- ucd-attest: "Confirm by hand" — a person's OWN confirmation of this Purpose's acceptance, no
                         engine run. Absent for the "No purpose yet" bucket (its key is the sentinel, never a real
                         Purpose name an attest door could resolve). -->
                    <button type="button" class="fsp-attest-btn" *ngIf="g.key !== NO_PURPOSE"
                            (click)="openAttest(g.key)" title="A person's own confirmation — no engine runs">
                      Confirm by hand
                    </button>
                  </div>
                  <!-- ucd-attest: the confirm dialog — nothing POSTs until "Confirm" is clicked; Escape cancels. -->
                  <div class="fsp-attest-dialog" *ngIf="attestOpenFor === g.key" (keydown.escape)="cancelAttest()">
                    <label>Mode
                      <select [(ngModel)]="attestForm.mode">
                        <option value="digital-twin">digital twin</option>
                        <option value="hardware">hardware</option>
                      </select>
                    </label>
                    <label>Board instance (optional)
                      <input type="text" [(ngModel)]="attestForm.boardInstance" placeholder="e.g. uno-bench-1" />
                    </label>
                    <label>Outcome
                      <select [(ngModel)]="attestForm.outcome">
                        <option value="passed">passed</option>
                        <option value="failed">failed</option>
                      </select>
                    </label>
                    <label class="fsp-attest-observed">What did you see? (required)
                      <textarea [(ngModel)]="attestForm.observed" rows="2" placeholder="a person's own words"></textarea>
                    </label>
                    <div class="fsp-attest-actions">
                      <button type="button" class="fsp-confirm-btn" (click)="confirmAttest()" [disabled]="attestBusy">{{ attestBusy ? 'Confirming…' : 'Confirm' }}</button>
                      <button type="button" (click)="cancelAttest()">Cancel</button>
                      <span class="fsp-error" *ngIf="attestError">{{ attestError }}</span>
                    </div>
                  </div>
                  <table class="fsp-task-table">
                    <thead><tr><th>Task</th><th>Lane</th><th>Target</th><th>Purpose</th><th>Cost</th><th>Composed by</th></tr></thead>
                    <tbody>
                      <tr *ngFor="let t of g.rows" tabindex="0" role="button"
                          [class.fsp-selected-row]="selectedTask?.task === t.task"
                          [class.fsp-h-solid]="taskHighlight(t.task) === 'solid'"
                          [class.fsp-h-outline]="taskHighlight(t.task) === 'outline'"
                          [class.fsp-h-dim]="taskHighlight(t.task) === 'dim'"
                          [attr.aria-label]="'task ' + t.task"
                          (click)="handleTaskActivate(taskAssignment(t.task))"
                          (keydown.enter)="handleTaskActivate(taskAssignment(t.task))"
                          (keydown.escape)="clearSelection()">
                        <td>{{ t.task }}
                          <!-- ucd-0b item 3: a status chip when this task's own PinClaim is incomplete/conflict
                               (the Register dialog didn't finish gathering a field, or two claims collide);
                               absent entirely when claims is empty (older backend) or the claim is 'ok'. -->
                          <span class="fsp-badge fsp-claim-chip" *ngIf="taskClaimChip(t.task) as cc"
                                [class.fsp-claim-conflict]="cc.status === 'conflict'"
                                [class.fsp-claim-incomplete]="cc.status === 'incomplete'"
                                [title]="cc.title">{{ cc.text }}</span>
                          <!-- ucd-0b2c item 3: required-resources summary, red when something required is
                               unbound/conflicting — required rows only. -->
                          <span class="fsp-badge fsp-resource-chip" *ngIf="taskResourceChip(t.task) as rc"
                                [class.fsp-claim-conflict]="rc.bad" [class.fsp-resource-ok]="!rc.bad"
                                [title]="rc.bad ? 'a required resource is unbound or conflicting' : 'every required resource is bound'">{{ rc.text }}</span>
                        </td>
                        <td><span class="fsp-badge" [style.background]="laneColor(t.lane)">{{ t.lane }}</span></td>
                        <td [class.fsp-unregistered]="t.target === 'unregistered'">{{ t.target }}</td>
                        <td>
                          <span class="fsp-badge fsp-cap-badge" *ngIf="g.status" [style.background]="capStatusColor(g.status)">{{ g.status }}</span><span *ngIf="!g.status">—</span>
                          <!-- D-ucd-12: a task belonging to several Purposes shows the others here — never hidden
                               in one exclusive bucket. -->
                          <span class="fsp-badge fsp-also-in-chip" *ngIf="t.alsoIn.length" [title]="'also named by: ' + t.alsoIn.join(', ')">also in: {{ t.alsoIn.join(', ') }}</span>
                        </td>
                        <td>{{ t.cost }}</td>
                        <!-- fs-2d: the reverse link from a task to the no-code graph/node that composes it —
                             opens the c-canvas at exactly that node (CGraphCanvasPanelComponent honours ?node=). -->
                        <td>
                          <a *ngIf="t.composed_by as cb" class="fsp-composed-link" title="open on the c-canvas"
                             [routerLink]="['/display/c-canvas']" [queryParams]="{ graph: cb.graph, node: cb.node }"
                             (click)="$event.stopPropagation()">{{ cb.graph }}:{{ cb.node }}</a>
                          <span *ngIf="!t.composed_by">—</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div class="fsp-state" *ngIf="!taskGroups.length">No tasks on this solution.</div>
              </ng-container>

              <ng-container *ngIf="k === 'schedule'">
                <div class="fsp-lane" *ngFor="let l of lanes">
                  <div class="fsp-lane-label" [style.borderColor]="laneColor(l.lane)">{{ l.lane }}</div>
                  <div class="fsp-lane-chips">
                    <span class="fsp-chip" *ngFor="let c of l.chips" tabindex="0" role="button"
                          [style.borderColor]="laneColor(l.lane)"
                          [class.fsp-chip-selected]="selectedTask?.task === c.task"
                          [class.fsp-h-solid]="taskHighlight(c.task) === 'solid'"
                          [class.fsp-h-outline]="taskHighlight(c.task) === 'outline'"
                          [class.fsp-h-dim]="taskHighlight(c.task) === 'dim'"
                          (click)="handleTaskActivate(taskAssignment(c.task))"
                          (keydown.enter)="handleTaskActivate(taskAssignment(c.task))"
                          (keydown.escape)="clearSelection()">
                      {{ c.task }} <small>({{ c.measured }})</small>
                      <span class="fsp-called" *ngFor="let cc of c.children">
                        &#8627; {{ cc.task }} <small>({{ cc.measured }}, called — not scheduled directly)</small>
                      </span>
                    </span>
                  </div>
                </div>
              </ng-container>

              <ng-container *ngIf="k === 'pins'">
                <div class="fsp-svg-stage" #svgHost tabindex="-1"
                     (drop)="onDrop($event)" (dragover)="onDragOver($event)"
                     (click)="onPinClick($event)" (keydown)="onPinKeydown($event)">
                  <div class="fsp-svg-host" [innerHTML]="svgHtml"></div>
                </div>
                <div class="fsp-chipline fsp-chipline-compact" *ngIf="unregisteredTasks.length">
                  <span class="fsp-unbound-label">Unregistered Tasks:</span>
                  <span class="fsp-chip fsp-unbound-chip" *ngFor="let a of unregisteredTasks"
                        tabindex="0" role="button" [class.fsp-chip-selected]="selectedTask?.task === a.task"
                        draggable="true" (dragstart)="onDragStart($event, a)"
                        (click)="handleTaskActivate(a)" (keydown.enter)="handleTaskActivate(a)" (keydown.escape)="clearSelection()">
                    {{ a.task }}{{ a.port ? '.' + a.port : '' }}
                  </span>
                </div>
                <div class="fsp-conflicts" *ngIf="conflicts.length">
                  <span class="fsp-conflicts-label">Conflicts:</span>
                  <div class="fsp-conflict" *ngFor="let c of conflicts">{{ c.notes || (c.task + (c.port ? '.' + c.port : '') + ' conflicts on ' + c.lives_on) }}</div>
                </div>
              </ng-container>

              <ng-container *ngIf="k === 'detail'">
                <div class="fsp-state" *ngIf="detailMode === 'none'">
                  Click a task to see its valid targets, or click a pin on the map to see its register detail.
                </div>

                <div class="fsp-detail" *ngIf="detailMode === 'task' && selectedTask">
                  <h5>{{ selectedTask.task }}{{ selectedTask.port ? '.' + selectedTask.port : '' }}</h5>
                  <!-- ucd-0b2c item 2: every requirement row of the SELECTED task (so a UART task shows TX and RX
                       together) — degrades to 'target_kind' when 'requirement_kind' is absent (an older backend). -->
                  <ng-container *ngTemplateOutlet="resourceTable; context: { rows: taskResourceRowsFor(selectedTask.task) }"></ng-container>
                  <div *ngIf="taskValidity">
                    <p>Requirement kind: <strong>{{ taskValidity.kind }}</strong></p>
                    <p *ngIf="taskValidity.refused" class="fsp-error">{{ taskValidity.refused }}</p>
                    <table class="fsp-detail-table" *ngIf="!taskValidity.refused">
                      <thead><tr><th>Pin</th><th>Verdict</th><th>Reason</th><th>Registered to</th></tr></thead>
                      <tbody>
                        <tr *ngFor="let p of taskRanked.visible" [attr.data-verdict]="p.verdict"
                            tabindex="0" role="button" [class.fsp-selected-row]="selectedPin === p.pin"
                            (click)="handlePinActivate(p.pin)" (keydown.enter)="handlePinActivate(p.pin)" (keydown.escape)="clearSelection()">
                          <td>{{ p.pin }}</td>
                          <td><i class="fsp-dot" [style.background]="verdictColor(p.verdict)"></i>{{ p.verdict }}</td>
                          <td [title]="p.reason">{{ p.reason }}</td>
                          <td *ngIf="p.registered_to.length">{{ p.registered_to.join(', ') }} ({{ p.cooperating ? 'cooperating' : 'conflict' }})</td>
                          <td *ngIf="!p.registered_to.length">—</td>
                        </tr>
                      </tbody>
                    </table>
                    <button type="button" class="fsp-more-btn" *ngIf="taskRanked.invalid.length && !showMoreInvalidTask" (click)="showMoreInvalidTask = true">
                      show {{ taskRanked.invalid.length }} more (invalid)
                    </button>
                    <table class="fsp-detail-table" *ngIf="showMoreInvalidTask && taskRanked.invalid.length">
                      <tbody>
                        <tr *ngFor="let p of taskRanked.invalid" data-verdict="invalid">
                          <td>{{ p.pin }}</td><td><i class="fsp-dot" [style.background]="verdictColor('invalid')"></i>invalid</td>
                          <td [title]="p.reason">{{ p.reason }}</td><td>—</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div *ngIf="!taskValidity && taskValidityError" class="fsp-error">{{ taskValidityError }}</div>
                </div>

                <div class="fsp-detail" *ngIf="detailMode === 'pin' && selectedPin">
                  <h5>{{ selectedPin }} <small>({{ solution?.board_resolved }})</small></h5>
                  <div *ngIf="pinDetail">
                    <!-- fs-2d (his ask, verbatim: "the power pins have no definitions at all, they should at least
                         have their target sections reactively instead describe what they do and what they are
                         for"): a power/reference pin (IOREF, RESET, +3V3/5V, GND, VIN, AREF) gets THIS block instead
                         of the SoC register facts below — it never has any. -->
                    <ng-container *ngIf="pinDetail.power_reference as pr">
                      <h6>Power / reference</h6>
                      <table class="fsp-kv">
                        <tr><th>Role</th><td>{{ pr.role }}</td></tr>
                        <tr><th>Purpose</th><td>{{ pr.purpose }}</td></tr>
                        <tr><th>Assignable</th><td class="fsp-unregistered">no — {{ pr.assignable_reason }}</td></tr>
                        <tr><th>Net</th><td>{{ pr.net }}</td></tr>
                        <tr><th>Locations</th><td>{{ pinLocationsText(pr) }}</td></tr>
                      </table>
                      <h6>Electrical</h6>
                      <table class="fsp-kv">
                        <tr *ngFor="let kv of objectEntries(pr.electrical)"><th>{{ kv.key }}</th><td>{{ kv.value }}</td></tr>
                      </table>
                      <h6>Typical uses</h6>
                      <ul class="fsp-typical-uses">
                        <li *ngFor="let u of pr.typical_uses">{{ u }}</li>
                      </ul>
                      <h6>Cited sources</h6>
                      <ul class="fsp-typical-uses">
                        <li *ngFor="let s of pr.sources">{{ s.label }}</li>
                      </ul>
                    </ng-container>

                    <table class="fsp-kv" *ngIf="!pinDetail.power_reference">
                      <tr><th>SoC pin</th><td>{{ pinDetail.soc_pin || 'undetermined' }}</td></tr>
                      <tr><th>Register</th><td>{{ registerNames(pinDetail) }} — bit {{ pinDetail.register.bit ?? 'undetermined' }} <small>({{ pinDetail.register.fact }})</small></td></tr>
                      <tr><th>Package pin</th><td>{{ pinDetail.register.package_pin }}</td></tr>
                      <tr><th>Current assignment</th><td>{{ pinDetail.current_assignment.function || '—' }} <small *ngIf="pinDetail.current_assignment.firmware_symbol">({{ pinDetail.current_assignment.firmware_symbol }})</small></td></tr>
                    </table>

                    <ng-container *ngIf="!pinDetail.power_reference">
                    <h6>Alternate functions</h6>
                    <table class="fsp-detail-table" *ngIf="pinDetail.alternate_functions.length">
                      <thead><tr><th>Function</th><th>Peripheral</th><th>Kind</th><th>Citation</th></tr></thead>
                      <tbody>
                        <tr *ngFor="let f of pinDetail.alternate_functions">
                          <td>{{ f.function }}</td><td>{{ f.peripheral }}</td><td>{{ f.kind }}</td><td>{{ f.fact }}</td>
                        </tr>
                      </tbody>
                    </table>
                    <div class="fsp-state" *ngIf="!pinDetail.alternate_functions.length">No alternate-function facts cited for this pin.</div>

                    <h6>Electrical limits</h6>
                    <table class="fsp-kv" *ngIf="electricalLimits(pinDetail).length">
                      <tr *ngFor="let kv of electricalLimits(pinDetail)"><th>{{ kv.key }}</th><td>{{ kv.value }} <small *ngIf="electricalFact(pinDetail)">({{ electricalFact(pinDetail) }})</small></td></tr>
                    </table>

                    <table class="fsp-kv">
                      <tr><th>Net / connector</th><td>{{ pinDetail.net || '—' }} / {{ pinDetail.connector || '—' }}{{ pinDetail.connector_number != null ? ' #' + pinDetail.connector_number : '' }}</td></tr>
                    </table>
                    </ng-container>

                    <!-- ucd-0b item 1: "Why this pin is configured this way" — the PinClaim a task authored on this
                         pin, the RegisterFieldSettings it produced, the register's final value as a bit strip, and
                         the hardware chain hops (both navigable, both cited). Loaded once per pin (cached until the
                         solution changes or an assign happens — see loadPinChain); a 404 (older backend) just
                         leaves this block empty, never an error. -->
                    <div class="fsp-chain-why">
                      <!-- ucd-0b2c item 2, ABOVE the "why" block: the claiming task's own requirement rows (so a
                           UART task shows TX and RX together even though only one pin is open here). -->
                      <ng-container *ngIf="pinChain?.claim as pcc">
                        <ng-container *ngTemplateOutlet="resourceTable; context: { rows: taskResourceRowsFor(pcc.task) }"></ng-container>
                      </ng-container>
                      <h6>Why this pin is configured this way</h6>
                      <ng-container *ngIf="pinChain as pc">
                        <div class="fsp-state" *ngIf="!pc.claim">no task claims this pin in {{ selected }}</div>
                        <table class="fsp-kv" *ngIf="pc.claim as cl">
                          <tr><th>Task</th><td>{{ cl.task }}{{ cl.port ? '.' + cl.port : '' }}</td></tr>
                          <tr><th>Mode</th><td>{{ cl.mode }}
                            <ng-container *ngTemplateOutlet="overrideCell; context: { targetClass: 'PinClaim', targetName: cl.name, field: 'mode', value: cl.mode, derived: cl.derived_mode, refs: cl.overrides_refs_json }"></ng-container>
                          </td></tr>
                          <tr><th>Pull</th><td>{{ cl.pull }}
                            <ng-container *ngTemplateOutlet="overrideCell; context: { targetClass: 'PinClaim', targetName: cl.name, field: 'pull', value: cl.pull, derived: cl.derived_pull, refs: cl.overrides_refs_json }"></ng-container>
                          </td></tr>
                          <tr><th>Edge</th><td>{{ cl.edge }}
                            <ng-container *ngTemplateOutlet="overrideCell; context: { targetClass: 'PinClaim', targetName: cl.name, field: 'edge', value: cl.edge, derived: cl.derived_edge, refs: cl.overrides_refs_json }"></ng-container>
                          </td></tr>
                          <tr><th>Initial</th><td>{{ cl.initial }}
                            <ng-container *ngTemplateOutlet="overrideCell; context: { targetClass: 'PinClaim', targetName: cl.name, field: 'initial', value: cl.initial, derived: cl.derived_initial, refs: cl.overrides_refs_json }"></ng-container>
                          </td></tr>
                          <tr><th>Provenance</th><td>{{ cl.provenance }}</td></tr>
                          <tr><th>Status</th><td [class.fsp-error]="cl.status !== 'ok'">{{ cl.status }}<span *ngIf="cl.why"> — {{ cl.why }}</span></td></tr>
                        </table>
                        <ul class="fsp-fieldsetting-list" *ngIf="pc.field_settings?.length">
                          <li *ngFor="let fs of pc.field_settings">{{ fieldSettingLine(fs) }}</li>
                        </ul>
                        <div class="fsp-regstrip" *ngFor="let rs of pc.register_settings">
                          <div class="fsp-regstrip-title">{{ rs.register }} <small>({{ rs.phase }})</small> <code>{{ rs.value }}</code></div>
                          <ng-container *ngIf="rs.value_bits">
                            <div class="fsp-bitstrip">
                              <span class="fsp-bit" *ngFor="let b of bitIndices(rs.value_bits)">{{ b }}</span>
                            </div>
                            <div class="fsp-bitstrip">
                              <span class="fsp-bit" *ngFor="let b of bitChars(rs.value_bits); let i = index"
                                    [class.fsp-bit-set]="b === '1'">{{ b }}</span>
                            </div>
                          </ng-container>
                        </div>
                        <div class="fsp-chain-hops" *ngIf="pc.hops?.length">
                          <div class="fsp-chain-hop" *ngFor="let h of pc.hops" [style.paddingLeft.px]="(h.hop || 0) * 12">
                            <a *ngIf="h.ref; else hopPlain" [routerLink]="hopRouterLink(h.ref)">{{ h.kind }}: {{ h.name }}</a>
                            <ng-template #hopPlain>{{ h.kind }}: {{ h.name }}</ng-template>
                            <small *ngIf="h.detail"> — {{ h.detail }}</small>
                          </div>
                        </div>
                        <a class="fsp-link" [routerLink]="'/display/hardware-chain'">Hardware chain page</a>
                      </ng-container>
                      <div class="fsp-error" *ngIf="!pinChain && pinChainError">{{ pinChainError }}</div>
                    </div>

                    <!-- fs-2d (his follow-up ask): a power/reference pin's "Parts that connect here" (board.custom.
                         kit_parts.parts_for_pin) replaces the always-empty Registered Tasks list — a power rail is
                         never a task target, but it IS where real kit parts wire (5V -> the TMP36, the potentiometer…). -->
                    <ng-container *ngIf="pinDetail.power_reference; else registeredTasksBlock">
                      <h6>Parts that connect here</h6>
                      <div class="fsp-chipline" *ngIf="pinDetail.parts_that_connect_here?.length">
                        <span class="fsp-chip" *ngFor="let p of pinDetail.parts_that_connect_here" [title]="p.interface_kind">{{ p.title }}</span>
                      </div>
                      <div class="fsp-state" *ngIf="!pinDetail.parts_that_connect_here?.length">No kit part is known to connect here.</div>
                    </ng-container>
                    <ng-template #registeredTasksBlock>
                    <h6>Registered Tasks</h6>
                    <table class="fsp-detail-table" *ngIf="pinRanked.registered.length">
                      <thead><tr><th>Task</th><th>Port</th><th>Solution</th><th>Lane</th><th>Cooperating</th></tr></thead>
                      <tbody>
                        <tr *ngFor="let r of pinRanked.registered" tabindex="0" role="button"
                            [class.fsp-selected-row]="selectedTask?.task === r.task"
                            (click)="handleTaskActivate(taskAssignment(r.task))" (keydown.enter)="handleTaskActivate(taskAssignment(r.task))" (keydown.escape)="clearSelection()">
                          <td>{{ r.task }}</td><td>{{ r.port || '—' }}</td><td>{{ r.solution }}</td><td>{{ r.lane || '—' }}</td>
                          <td>{{ r.cooperating ? 'yes' : 'conflict' }}</td>
                        </tr>
                      </tbody>
                    </table>
                    <div class="fsp-state" *ngIf="!pinRanked.registered.length">No Registered Tasks on this pin.</div>

                    <h6>Compatible unregistered tasks</h6>
                    <div class="fsp-chipline" *ngIf="pinRanked.compatible.length">
                      <span class="fsp-chip" *ngFor="let t of pinRanked.compatible" tabindex="0" role="button"
                            [class.fsp-chip-selected]="selectedTask?.task === t"
                            (click)="handleTaskActivate(taskAssignment(t))" (keydown.enter)="handleTaskActivate(taskAssignment(t))" (keydown.escape)="clearSelection()">
                        {{ t }}
                      </span>
                    </div>
                    <div class="fsp-state" *ngIf="!pinRanked.compatible.length">No unregistered task is known (yet) to be compatible — select one to check.</div>
                    <button type="button" class="fsp-more-btn" *ngIf="pinRanked.restCount && !showMoreRestPin" (click)="showMoreRestPin = true">
                      show {{ pinRanked.restCount }} more
                    </button>
                    <div class="fsp-state" *ngIf="showMoreRestPin && pinRanked.restCount">
                      the rest ({{ pinRanked.restCount }}) — compatibility not yet checked; select a task once to check it against this pin
                    </div>
                    </ng-template>

                    <h6>Compatible task kinds (cited rules)</h6>
                    <table class="fsp-detail-table" *ngIf="compatRowsForSelectedPin.length">
                      <thead><tr><th>Kind</th><th>Title</th><th>Matches</th></tr></thead>
                      <tbody>
                        <tr *ngFor="let c of compatRowsForSelectedPin">
                          <td>{{ c.kind }}</td><td>{{ c.title }}</td><td [title]="c.source_label">{{ c.matches }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div *ngIf="!pinDetail && pinDetailError" class="fsp-error">{{ pinDetailError }}</div>
                </div>
              </ng-container>

            </div>
          </div>
        </div>
      </div>

      <!-- ucd-0b2c item 2: shared by the task-selected view and the pin-detail "why" block — one requirement row
           per (task, port), from 'assignments'; never a new door. -->
      <ng-template #resourceTable let-rows="rows">
        <h6>Resources this task uses</h6>
        <table class="fsp-detail-table" *ngIf="rows.length">
          <thead><tr><th>Port</th><th>Kind</th><th>Role</th><th>Required</th><th>Bound to</th><th>Status</th><th>Route</th></tr></thead>
          <tbody>
            <tr *ngFor="let r of rows" [class.fsp-h-dim]="r.memory_field">
              <td>{{ r.port }}</td>
              <td>{{ r.requirement_kind }}
                <ng-container *ngIf="r.target_definition_name" [ngTemplateOutlet]="overrideCell"
                              [ngTemplateOutletContext]="{ targetClass: 'TargetDefinition', targetName: r.target_definition_name, field: 'requirement_kind', value: r.requirement_kind, derived: r.derived_requirement_kind, refs: r.overrides_refs_json }"></ng-container>
              </td>
              <td>{{ r.role || '—' }}
                <ng-container *ngIf="r.target_definition_name" [ngTemplateOutlet]="overrideCell"
                              [ngTemplateOutletContext]="{ targetClass: 'TargetDefinition', targetName: r.target_definition_name, field: 'role', value: r.role, derived: r.derived_role, refs: r.overrides_refs_json }"></ng-container>
              </td>
              <td>{{ r.required ? 'yes' : 'no' }}</td>
              <td>
                <span *ngIf="r.memory_field">memory field, no hardware</span>
                <ng-container *ngIf="!r.memory_field">
                  {{ r.bound_to }}<span *ngIf="r.needs_pin" class="fsp-error"> — needs a pin</span>
                </ng-container>
              </td>
              <td [class.fsp-error]="r.status === 'conflict'">{{ r.status }}</td>
              <td>{{ r.route || '—' }}</td>
            </tr>
          </tbody>
        </table>
        <div class="fsp-state" *ngIf="!rows.length">No resources recorded for this task.</div>
      </ng-template>

      <!-- ucd-attest: ONE reusable cell — an "Override" link, or (once one is active) an "overridden" marker
           carrying who/when/why + the derived value in its title, with "retire" to undo. Used by both the PinClaim
           design-choice rows above and the TargetDefinition requirement_kind/role cells. -->
      <ng-template #overrideCell let-targetClass="targetClass" let-targetName="targetName" let-field="field"
                   let-value="value" let-derived="derived" let-refs="refs">
        <span class="fsp-override-marker" *ngIf="derived !== undefined && derived !== null"
              [title]="'overridden (derived: ' + derived + ') — click to retire'"
              (click)="retireOverride(overrideRefFor(refs, field))">overridden</span>
        <button type="button" class="fsp-override-btn" (click)="openOverride(targetClass, targetName, field, value)">Override</button>
      </ng-template>
    </div>
  `,
  styles: [`
    .fsp { display: block; color: var(--text-on-card); min-height: 720px; }
    .fsp-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 6px 2px; }
    .fsp-pick { display: flex; align-items: center; gap: 6px; font-size: 0.85em; }
    .fsp-validation { font-size: 0.82em; }
    .fsp-validation.fsp-ok { color: var(--success-text, #2e7d32); }
    .fsp-validation.fsp-bad { color: var(--error-text, #b00020); }
    .fsp-export-btn { margin-left: auto; padding: 4px 12px; border-radius: 6px; border: 1px solid var(--brand-primary, #3f51b5); background: var(--brand-primary, #3f51b5); color: var(--brand-primary-text, #fff); cursor: pointer; }
    .fsp-export-btn[disabled] { opacity: .6; cursor: default; }
    .fsp-export { padding: 6px 10px; margin: 4px 0 8px; border-left: 3px solid var(--brand-primary, #3f51b5); background: var(--surface-alt, rgba(63,81,181,.06)); font-size: 13px; }
    .fsp-export code { font-size: 12px; }
    .fsp-binding-status { font-size: 0.82em; padding: 2px 2px 6px; }
    .fsp-bind-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 0.82em; padding: 2px 2px 8px; }
    .fsp-bind-label { font-weight: 600; }
    .fsp-bind-btn { padding: 2px 10px; border-radius: 4px; border: 1px solid var(--brand-primary, #3f51b5); background: transparent; color: inherit; cursor: pointer; }
    .fsp-bind-btn[disabled] { opacity: .6; cursor: default; }
    .fsp-resource-chip { font-size: 0.75em; margin-left: 6px; background: transparent; border: 1px solid currentColor; border-radius: 8px; padding: 0 6px; }
    .fsp-resource-ok { color: var(--success-text, #2e7d32); }
    .fsp-link { margin-left: auto; font-size: 0.85em; text-decoration: none; color: var(--link-text, #1565c0); }
    .fsp-link:hover { text-decoration: underline; }
    .fsp-composed-link { font-size: 0.85em; text-decoration: none; color: var(--link-text, #1565c0); }
    .fsp-composed-link:hover { text-decoration: underline; }
    .fsp-state { padding: 12px 0; color: var(--text-on-card-muted); }
    .fsp-error { color: var(--color-error-text, #b00020); }
    .fsp-warning { color: var(--warning-text, #e65100); }
    .fsp-presets { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 4px 2px 10px; font-size: 0.82em; border-bottom: 1px solid rgba(128,128,128,0.2); margin-bottom: 8px; }
    .fsp-presets-label { font-weight: 600; }
    .fsp-preset-pick { display: flex; align-items: center; gap: 4px; }
    .fsp-legend { margin-left: auto; display: flex; gap: 10px; }
    .fsp-legend-item { display: inline-flex; align-items: center; gap: 4px; }
    .fsp-dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; }
    .fsp-dot-ring { border: 2px solid #1565c0; background: transparent; }
    .fsp-selection-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 6px 8px; margin-bottom: 8px; border: 1px solid rgba(21,101,192,0.4); border-radius: 6px; background: rgba(21,101,192,0.06); font-size: 0.85em; }
    .fsp-selection-text { font-weight: 500; }
    .fsp-confirm-btn { background: #1565c0; color: #fff; border: none; border-radius: 4px; padding: 3px 10px; cursor: pointer; }
    .fsp-cancel-btn { background: transparent; border: 1px solid rgba(128,128,128,0.5); border-radius: 4px; padding: 3px 10px; cursor: pointer; color: inherit; }
    .fsp-bar-msg { margin-left: 4px; }
    .fsp-collapsed-bar { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
    .fsp-collapsed-chip { font-size: 0.8em; border: 1px solid rgba(128,128,128,0.4); border-radius: 10px; padding: 3px 9px; background: transparent; cursor: pointer; color: inherit; }
    .fsp-sections { display: flex; flex-wrap: wrap; gap: 14px; align-items: stretch; min-height: 680px; }
    .fsp-section { display: flex; flex-direction: column; min-width: 260px; border: 1px solid rgba(128,128,128,0.25); border-radius: 6px; padding: 8px; }
    .fsp-section-header { display: flex; align-items: center; justify-content: space-between; }
    .fsp-section-header h4 { margin: 2px 0 8px; font-size: 0.9em; opacity: 0.85; }
    .fsp-collapse-btn { background: transparent; border: none; cursor: pointer; font-size: 1em; color: inherit; }
    .fsp-section-body { flex: 1 1 auto; overflow: auto; max-height: 680px; }
    .fsp-chipline { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
    .fsp-chipline-compact { margin-top: 8px; font-size: 0.82em; }
    .fsp-unbound-label { font-weight: 600; margin-right: 6px; }
    .fsp-task-group { margin-bottom: 12px; }
    .fsp-task-group-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
    .fsp-unregistered { font-style: italic; opacity: 0.75; }
    .fsp-task-table, .fsp-detail-table, .fsp-kv { width: 100%; border-collapse: collapse; font-size: 0.8em; }
    .fsp-task-table th, .fsp-task-table td, .fsp-detail-table th, .fsp-detail-table td,
    .fsp-kv th, .fsp-kv td { text-align: left; padding: 3px 6px; border-bottom: 1px solid rgba(128,128,128,0.25); }
    .fsp-kv th { white-space: nowrap; opacity: 0.8; width: 1%; }
    .fsp-task-table tr[role="button"], .fsp-detail-table tr[role="button"] { cursor: pointer; }
    .fsp-selected-row { outline: 2px solid #1565c0; }
    .fsp-badge { color: #fff; border-radius: 8px; padding: 1px 7px; font-size: 0.85em; }
    .fsp-cap-badge { font-size: 0.78em; }
    .fsp-typical-uses { margin: 2px 0 10px; padding-left: 18px; font-size: 0.82em; }
    .fsp-typical-uses li { margin-bottom: 2px; }
    .fsp-h-solid { outline: 2px solid #1565c0; }
    .fsp-h-outline { outline: 2px dashed #2e7d32; }
    .fsp-h-dim { opacity: 0.4; }
    .fsp-more-btn { font-size: 0.8em; border: 1px solid rgba(128,128,128,0.4); border-radius: 10px; padding: 2px 8px; background: transparent; cursor: pointer; color: inherit; margin: 4px 0; }
    .fsp-lane { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px; }
    .fsp-lane-label { min-width: 48px; font-weight: 600; font-size: 0.82em; border-left: 4px solid; padding-left: 6px; text-transform: uppercase; }
    .fsp-lane-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .fsp-chip { border: 1.5px solid #888; border-radius: 10px; padding: 2px 8px; font-size: 0.8em; display: inline-flex; flex-direction: column; cursor: pointer; }
    .fsp-chip small { opacity: 0.7; }
    .fsp-called { margin-left: 10px; font-size: 0.92em; opacity: 0.85; }
    .fsp-svg-stage { border: 1px dashed rgba(128,128,128,0.4); min-height: 220px; outline: none; }
    .fsp-svg-host ::ng-deep svg { max-width: 100%; height: auto; display: block; }
    .fsp-unbound-chip { cursor: grab; }
    .fsp-chip-selected { outline: 2px solid #1565c0; }
    .fsp-conflicts { margin-top: 8px; font-size: 0.82em; }
    .fsp-conflicts-label { font-weight: 600; margin-right: 6px; }
    .fsp-conflict { color: var(--error-text, #b00020); }
    .fsp-detail h5 { margin: 2px 0 8px; }
    .fsp-detail h6 { margin: 12px 0 4px; font-size: 0.85em; opacity: 0.8; }
    .fsp-pending-field { display: inline-flex; align-items: center; gap: 4px; font-size: 0.85em; }
    .fsp-claim-chip { font-size: 0.75em; margin-left: 6px; color: var(--warning-text, #e65100); background: transparent; border: 1px solid currentColor; border-radius: 8px; padding: 0 6px; }
    .fsp-also-in-chip { font-size: 0.75em; margin-left: 6px; color: var(--text-on-card-muted); background: transparent; border: 1px dashed currentColor; border-radius: 8px; padding: 0 6px; }
    .fsp-claim-incomplete { color: var(--warning-text, #e65100); }
    .fsp-claim-conflict { color: var(--error-text, #b00020); }
    .fsp-chain-why { margin-top: 10px; }
    .fsp-fieldsetting-list { margin: 4px 0 8px; padding-left: 18px; font-size: 0.82em; }
    .fsp-fieldsetting-list li { margin-bottom: 2px; }
    .fsp-regstrip { margin-bottom: 8px; }
    .fsp-regstrip-title { font-size: 0.82em; margin-bottom: 2px; }
    .fsp-bitstrip { display: flex; gap: 2px; }
    .fsp-bit { display: inline-flex; justify-content: center; width: 16px; font-size: 0.72em; font-family: monospace; color: var(--text-on-card-muted); }
    .fsp-bit-set { color: var(--text-on-card); font-weight: 700; background: var(--brand-primary, #3f51b5); color: var(--brand-primary-text, #fff); border-radius: 2px; }
    .fsp-chain-hops { margin: 6px 0; font-size: 0.82em; }
    .fsp-chain-hop { white-space: nowrap; }
    .fsp-chain-hop a { color: var(--link-text, #1565c0); text-decoration: none; }
    .fsp-chain-hop a:hover { text-decoration: underline; }

    /* ucd-attest: a person's own confirmation (Purpose chip) + a person's own correction of a derived value
       (PinClaim/TargetDefinition/HardwareBinding) — rendered beside the derivation, never over it. */
    .fsp-attest-btn, .fsp-override-btn { font-size: 0.75em; padding: 1px 7px; border-radius: 8px; border: 1px solid var(--brand-primary, #3f51b5); background: transparent; color: var(--brand-primary, #3f51b5); cursor: pointer; }
    .fsp-attest-dialog, .fsp-override-dialog { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px; padding: 8px 10px; margin: 4px 0 10px; border-left: 3px solid var(--brand-primary, #3f51b5); background: var(--surface-alt, rgba(63,81,181,.06)); font-size: 0.85em; }
    .fsp-attest-dialog label, .fsp-override-dialog label { display: flex; flex-direction: column; gap: 2px; font-size: 0.9em; }
    .fsp-attest-observed { flex: 1 1 220px; }
    .fsp-attest-actions { display: flex; align-items: center; gap: 8px; }
    .fsp-override-marker { font-size: 0.75em; margin-left: 4px; color: var(--warning-text, #e65100); border: 1px dashed currentColor; border-radius: 8px; padding: 0 6px; cursor: pointer; }
  `],
})
export class FirmwareSolutionPanelComponent implements OnInit, OnChanges {
  @Input() solutionsPath = '/api/firmware/solutions';
  @Input() initial = '';

  @ViewChild('svgHost') svgHostRef?: ElementRef<HTMLElement>;

  /** D-ucd-12: the bucket for a task no Purpose names — "No purpose yet" (never "Ungrouped"). */
  readonly NO_PURPOSE = '__no_purpose';

  solutions: SolutionRow[] = [];
  selected = '';
  solution: SolutionDetail | null = null;
  schedule: ScheduleSlot[] = [];
  assignments: RegisterAssignment[] = [];
  unregisteredTasks: RegisterAssignment[] = [];
  registeredTasks: Record<string, RegisteredTaskRow[]> = {};
  /** D-ucd-12: read from the payload's `purposes` key; falls back to the deprecated `capabilities` key for an
   * older backend (same rows). Still called `capabilities` nowhere a person reads. */
  purposes: PurposeRow[] = [];
  validation: { ok: boolean; why: string } | null = null;
  // ucd-0f: the last export made from this panel (POST .../export → the FirmwareExport row)
  exporting = false;
  exportResult: any = null;
  exportError = '';

  taskRows: TaskRow[] = [];
  taskGroups: TaskGroup[] = [];
  lanes: { lane: string; chips: LaneChip[] }[] = [];
  svgHtml: SafeHtml | null = null;

  // fs-2b: section layout (persisted per-viewer under ONE localStorage key)
  sections: Record<SectionKey, boolean> = { tasks: true, schedule: true, pins: true, detail: true };
  readonly sectionKeys = SECTION_ORDER;
  readonly pairPresets = PAIR_PRESETS;

  // fs-2c: ONE selection model — selectedTask XOR selectedPin XOR neither; `pending` is the confirm offer.
  selectedTask: RegisterAssignment | null = null;
  taskValidity: ValidTargetsResponse | null = null;
  taskValidityError = '';
  selectedPin = '';
  pinDetail: PinDetail | null = null;
  pinDetailError = '';
  detailMode: 'none' | 'task' | 'pin' = 'none';
  compatRows: TargetCompatRow[] = [];
  private compatLoaded = false;
  pending: PendingAction | null = null;
  pendingConfig: PendingConfig = { ...DEFAULT_PENDING_CONFIG };
  showMoreInvalidTask = false;
  showMoreRestPin = false;

  /** ucd-0b item 3: the solution-level PinClaim rows (payload gains `claims`) — used only to surface a status chip
   * on an incomplete/conflicting task in the Tasks table; empty array (older backend) renders no chips at all. */
  claims: PinClaim[] = [];

  /** ucd-0b2c item 1: the HardwareBinding rows for the selected solution (payload gains `binding`/`bindings`) —
   * both stay empty on an older backend, which is the whole degrade: no picker, no status line, no "+ bind"
   * control, every door keeps calling the bare solution name. */
  bindings: HardwareBindingRow[] = [];
  binding: HardwareBindingRow | null = null;
  /** The Binding picker's own selection — a HardwareBinding `name` ('<solution>@<board>'), or '' before any
   * payload with `binding` has loaded. */
  bindingPick = '';
  boardChoices: string[] = [];
  private boardsLoaded = false;
  newBindBoard = '';
  bindBusy = false;
  bindError = '';

  /** ucd-0b item 1: the chain door's response for the selected pin, cached per pin until the solution reloads or an
   * assign happens (both go through `select()`, which clears the cache). */
  pinChain: PinChainResponse | null = null;
  pinChainError = '';
  private pinChainCache: Record<string, PinChainResponse> = {};

  /** fs-2c item 3: per-task valid-targets responses, cached as they are fetched — the ONLY source the pin→task
   * symmetric highlight and the pin-first register offer use (no new per-pin compatibility door). */
  private taskValidityCache: Record<string, ValidTargetsResponse> = {};
  private callerOfTask: Record<string, string> = {};
  private childrenOfTask: Record<string, string[]> = {};

  private dragging: RegisterAssignment | null = null;
  assignError = '';
  assignWarning = '';

  /** ucd-attest: "Confirm by hand" on a Purpose's chip — nothing is written before `confirmAttest()`. */
  attestOpenFor: string | null = null;
  attestForm: { mode: 'digital-twin' | 'hardware'; observed: string; boardInstance: string; outcome: 'passed' | 'failed' }
    = { mode: 'digital-twin', observed: '', boardInstance: '', outcome: 'passed' };
  attestBusy = false;
  attestError = '';

  /** ucd-attest: the Override dialog shared by every overridable field (PinClaim.pull/edge/mode/initial,
   * TargetDefinition.requirement_kind/.role, HardwareBinding.status) — nothing is written before `confirmOverride()`. */
  overrideOpenFor: { targetClass: string; targetName: string; field: string; derivedValue: string } | null = null;
  overrideForm: { value: string; why: string } = { value: '', why: '' };
  overrideBusy = false;
  overrideError = '';

  loading = false;
  error: string | null = null;

  constructor(private http: HttpClient, private sanitizer: DomSanitizer, private polariService: PolariService) {}

  get base(): string { return this.polariService.getBackendBaseUrl(); }
  private get headers(): any { return (this.polariService.backendRequestOptions as any)?.headers; }

  ngOnInit(): void { this.loadLayout(); this.loadSolutions(); }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['solutionsPath'] && !changes['solutionsPath'].firstChange) { this.loadSolutions(); }
  }

  /** fs-2c: a Polari-wide rule (HARDWARE_DEV_PRIORITIES.md §3b) — Escape clears every selection, from anywhere.
   * ucd-attest: also cancels an open attest/override dialog — nothing is written before its own confirm, so
   * Escape loses nothing but the unsent form. */
  @HostListener('document:keydown.escape')
  onEscapeKey(): void { this.clearSelection(); this.cancelAttest(); this.cancelOverride(); }

  // ------------------------------------------------------------------ fs-2b: layout (collapse/expand + presets)
  sectionLabel(k: SectionKey): string { return SECTION_LABELS[k]; }

  sectionHeading(k: SectionKey): string {
    if (k === 'tasks') { return `Tasks (${this.taskRows.length})`; }
    return SECTION_LABELS[k];
  }

  get openKeys(): SectionKey[] { return SECTION_ORDER.filter(k => this.sections[k]); }
  get collapsedKeys(): SectionKey[] { return SECTION_ORDER.filter(k => !this.sections[k]); }

  private loadLayout(): void {
    try {
      const raw = localStorage.getItem(LAYOUT_KEY);
      if (!raw) { return; }
      const saved = JSON.parse(raw);
      for (const k of SECTION_ORDER) { if (typeof saved[k] === 'boolean') { this.sections[k] = saved[k]; } }
    } catch { /* renders fine with the default (all four open) */ }
  }

  private persistLayout(): void {
    try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(this.sections)); } catch { /* per-viewer convenience only */ }
  }

  toggleSection(k: SectionKey): void { this.sections[k] = !this.sections[k]; this.persistLayout(); }

  showAll(): void { this.sections = { tasks: true, schedule: true, pins: true, detail: true }; this.persistLayout(); }

  showOne(key: string): void {
    if (!key) { return; }
    const next: Record<SectionKey, boolean> = { tasks: false, schedule: false, pins: false, detail: false };
    next[key as SectionKey] = true;
    this.sections = next;
    this.persistLayout();
  }

  showTwoAt(idx: string): void {
    if (idx === '') { return; }
    const pair = PAIR_PRESETS[Number(idx)];
    if (!pair) { return; }
    this.showTwo(pair[0], pair[1]);
  }

  showTwo(a: SectionKey, b: SectionKey): void {
    const next: Record<SectionKey, boolean> = { tasks: false, schedule: false, pins: false, detail: false };
    next[a] = true; next[b] = true;
    this.sections = next;
    this.persistLayout();
  }

  laneColor(lane: string): string { return LANE_COLORS[lane] || '#607d8b'; }
  verdictColor(v: Verdict): string { return VERDICT_COLORS[v]; }
  capStatusColor(status: string): string { return CAP_STATUS_COLORS[status] || '#607d8b'; }

  get conflicts(): RegisterAssignment[] { return this.assignments.filter(a => a.status === 'conflict'); }

  private loadSolutions(): void {
    this.error = null;
    this.http.get<any>(this.base + this.solutionsPath, { headers: this.headers }).subscribe({
      next: (r: any) => {
        if (!r || r.ok === false) { this.error = (r && r.error) || 'could not list firmware solutions'; return; }
        this.solutions = r.solutions || [];
        const pick = this.initial && this.solutions.some(s => s.name === this.initial) ? this.initial : (this.solutions[0]?.name || '');
        if (pick) { this.select(pick); }
      },
      error: (err: any) => { const f = friendlyError(err, `GET ${this.solutionsPath}`); this.error = f.text; },
    });
  }

  /** ucd-0f: export the selected solution as a CMake project (verified on the engines image), then offer the download. */
  exportSolution(): void {
    if (!this.selected || this.exporting) { return; }
    this.exporting = true; this.exportResult = null; this.exportError = '';
    this.http.post<any>(`${this.base}${this.solutionsPath}/${encodeURIComponent(this.doorTarget)}/export`, { target: 'both', verify: true },
                        { headers: this.headers }).subscribe({
      next: (r) => { this.exporting = false; if (r?.export) { this.exportResult = r.export; } else { this.exportError = r?.refused || r?.error || 'export refused'; } },
      error: (e) => { this.exporting = false; this.exportError = e?.error?.refused || e?.error?.error || friendlyError(e, 'POST export').text; },
    });
  }

  select(name: string): void {
    if (!name) { return; }
    this.selected = name;
    this.bindingPick = ''; // ucd-0b2c: a new solution always starts at ITS default binding, re-resolved below
    this.clearSelection();
    this.reloadSolution();
  }

  /** ucd-0b2c item 1: picking a binding (or the default) re-targets EVERY door the panel calls — `doorTarget`
   * below is the one place that decides whether that's '<solution>' or '<solution>@<board>'. Re-fetches the full
   * solution detail, since assignments/claims/the pin map are now owned by the binding, not the bare solution. */
  selectBinding(name: string): void {
    if (!name || name === this.bindingPick) { return; }
    this.bindingPick = name;
    this.clearSelection();
    this.reloadSolution();
  }

  /** The cache-invalidating reload `select()`/`selectBinding()`/a just-confirmed assign all share — unlike
   * `select()`, this keeps `bindingPick` as-is (an assign made ON a binding must reload that SAME binding, never
   * fall back to the default). */
  private reloadSolution(): void {
    this.taskValidityCache = {};
    this.pinChainCache = {}; // a new solution/binding (or a just-confirmed assign) invalidates every cached chain
    this.loadSolutionDetail(this.doorTarget);
  }

  /** ucd-0b2c: '<solution>@<board>' for every door EXCEPT when the chosen binding is the solution's own default —
   * then the bare '<solution>' name, "so older backends still work" (the deliverable's own words). */
  get doorTarget(): string {
    if (this.bindingPick) {
      const b = this.bindings.find(x => x.name === this.bindingPick);
      if (b && !b.is_default) { return b.name; }
    }
    return this.selected;
  }

  private loadSolutionDetail(target: string): void {
    this.loading = true; this.error = null;
    this.http.get<any>(`${this.base}${this.solutionsPath}/${encodeURIComponent(target)}`, { headers: this.headers }).subscribe({
      next: (r: any) => {
        this.loading = false;
        if (!r || r.ok === false) { this.error = (r && r.error) || `could not load ${target}`; return; }
        this.solution = r.solution; this.schedule = r.schedule || []; this.assignments = r.assignments || [];
        this.unregisteredTasks = r.unregistered_tasks || this.assignments.filter((a: RegisterAssignment) => a.status === 'unbound');
        this.registeredTasks = r.registered_tasks || {};
        this.purposes = r.purposes || r.capabilities || [];
        this.claims = r.claims || []; // ucd-0b item 3: absent on an older backend — chips just never render
        this.validation = r.validation || null;
        // ucd-0b2c item 1: HardwareBinding rows — both empty on an older backend (no `bindings` key), which is the
        // whole degrade (no picker, no status line, no "+ bind" control).
        this.bindings = r.bindings || [];
        this.binding = r.binding || null;
        if (!this.bindingPick && this.binding) { this.bindingPick = this.binding.name; }
        if (this.bindings.length) { this.ensureBoardChoicesLoaded(); }
        this.buildTaskRows();
        this.buildLanes();
        this.loadPinmap();
      },
      error: (err: any) => { this.loading = false; const f = friendlyError(err, `GET solution ${target}`); this.error = f.text; },
    });
  }

  /** ucd-0b2c item 1: the "+ bind to another board" select's options — the SAME readiness door the boards page
   * uses (`/api/board/boards/readiness`'s rows' `name`), loaded once per solution load and tolerated silently on
   * any failure (the control just offers no boards; never blocks the panel). */
  private ensureBoardChoicesLoaded(): void {
    if (this.boardsLoaded) { return; }
    this.boardsLoaded = true;
    this.http.get<any>(`${this.base}/api/board/boards/readiness`, { headers: this.headers }).subscribe({
      next: (r: any) => {
        const rows = Array.isArray(r) ? r : (r?.rows || []);
        this.boardChoices = Array.from(new Set(rows.map((row: any) => row.name).filter(Boolean)));
      },
      error: () => { /* the "+ bind to another board" control degrades to an empty list */ },
    });
  }

  /** ucd-0b2c item 1: POST .../bindings {board} — nothing is written before this click. On success, re-targets
   * the picker at the NEW binding's own qualified name and reloads through it (never through the stale local
   * `bindings` cache, which doesn't carry the new row yet). */
  bindToBoard(): void {
    if (!this.newBindBoard || this.bindBusy) { return; }
    this.bindBusy = true; this.bindError = '';
    this.http.post<any>(`${this.base}${this.solutionsPath}/${encodeURIComponent(this.selected)}/bindings`,
      { board: this.newBindBoard }, { headers: this.headers }).subscribe({
      next: (r: any) => {
        this.bindBusy = false;
        if (!r || r.ok === false) { this.bindError = (r && (r.error || r.refused)) || 'bind refused'; return; }
        this.newBindBoard = '';
        const name = r.binding?.name || '';
        if (name) { this.bindingPick = name; this.loadSolutionDetail(name); }
        else { this.loadSolutionDetail(this.doorTarget); }
      },
      error: (err: any) => { this.bindBusy = false; const f = friendlyError(err, 'POST bindings'); this.bindError = f.text; },
    });
  }

  private buildTaskRows(): void {
    this.taskRows = this.schedule.map(s => {
      const own = this.assignments.filter(a => a.task === s.task);
      const kind = own[0]?.target_kind || '—';
      const ports = Array.from(new Set(own.map(a => a.port).filter(Boolean))).join(', ') || '—';
      const resources = Array.from(new Set(own.map(a => a.controls).filter(Boolean))).join('; ') || '—';
      const m = (s.notes || '').match(/text_bytes_noinline=(\S+) B, stack_bytes=(\S+)/);
      const cost = m ? `${m[1]} B text / ${m[2]} B stack` : (s.measured_cycles >= 0 ? `${s.measured_cycles} cycles` : '—');
      const bound = own.find(a => a.status === 'bound');
      const target = bound ? (bound.lives_on.split(':').pop() || bound.lives_on) : (own.length ? 'unregistered' : '—');
      // fs-2d: the schedule row carries its own composed_by; an assignment's (own[0]) is the same shape — either
      // one answers "where is this task composed", a ScheduleSlot just always exists so it is read first.
      const composedBy = s.composed_by ?? own[0]?.composed_by ?? null;
      return { task: s.task, lane: s.lane, order: s.order, kind, ports, resources, cost, target, composed_by: composedBy };
    });
    this.buildTaskGroups();
  }

  /** fs-2c item 1 + D-ucd-12 (his ruling, verbatim: "a task can belong to multiple purpose groupings"): group the
   * full Tasks table by Purpose (`purposes[].task_names`) — a task named by SEVERAL Purposes lands under EVERY
   * one of them (never one exclusive bucket), each such row carrying `alsoIn` (its OTHER Purposes, for the
   * "also in: …" chip). A "No purpose yet" bucket lists every task no Purpose names. */
  private buildTaskGroups(): void {
    const byTask = new Map(this.taskRows.map(r => [r.task, r]));
    const titleFor = (p: PurposeRow) => p.goal || p.name;
    // every Purpose naming each task, so a row can list its siblings ("also in: …") by title, excluding itself.
    const purposesByTask = new Map<string, { name: string; title: string }[]>();
    for (const p of this.purposes) {
      for (const t of p.task_names) {
        const list = purposesByTask.get(t) || [];
        list.push({ name: p.name, title: titleFor(p) });
        purposesByTask.set(t, list);
      }
    }
    const named = new Set<string>();
    const groups: TaskGroup[] = [];
    for (const p of this.purposes) {
      const rows: GroupedTaskRow[] = p.task_names.map(t => byTask.get(t)).filter((r): r is TaskRow => !!r)
        .map(r => ({ ...r, alsoIn: (purposesByTask.get(r.task) || []).filter(ref => ref.name !== p.name).map(ref => ref.title) }));
      rows.forEach(r => named.add(r.task));
      if (rows.length) { groups.push({ key: p.name, title: titleFor(p), status: p.status, rows, proofKind: p.proof_kind }); }
    }
    const rest: GroupedTaskRow[] = this.taskRows.filter(r => !named.has(r.task)).map(r => ({ ...r, alsoIn: [] }));
    if (rest.length) { groups.push({ key: this.NO_PURPOSE, title: 'No purpose yet', status: '', rows: rest }); }
    this.taskGroups = groups;
  }

  /** D-fs-1: lanes are DERIVED, never authored — this only groups the already-derived ScheduleSlot rows. `called`
   * tasks (dispatched, not scheduled directly) nest under the nearest PRECEDING non-called task by the glue's own
   * emission `order` — the same field, no new data, no second ordering scheme. Also records caller/called task
   * NAMES (fs-2c item 3's "its caller/called tasks solid in Tasks + Schedule"). */
  private buildLanes(): void {
    const byOrder = [...this.schedule].sort((a, b) => a.order - b.order);
    const callerOf: Record<string, string> = {};
    let lastNonCalled = '';
    for (const s of byOrder) {
      if (s.lane === 'called') { if (lastNonCalled) { callerOf[s.task] = lastNonCalled; } }
      else { lastNonCalled = s.task; }
    }
    const childrenOf: Record<string, LaneChip[]> = {};
    const childrenNamesOf: Record<string, string[]> = {};
    for (const s of this.schedule) {
      if (s.lane !== 'called') { continue; }
      const caller = callerOf[s.task];
      if (!caller) { continue; }
      (childrenOf[caller] = childrenOf[caller] || []).push(this.toChip(s));
      (childrenNamesOf[caller] = childrenNamesOf[caller] || []).push(s.task);
    }
    this.callerOfTask = callerOf;
    this.childrenOfTask = childrenNamesOf;
    this.lanes = LANES.map(lane => ({
      lane,
      chips: this.schedule.filter(s => s.lane === lane).sort((a, b) => a.order - b.order)
        .map(s => ({ ...this.toChip(s), children: childrenOf[s.task] || [] })),
    }));
  }

  private toChip(s: ScheduleSlot): LaneChip {
    return { task: s.task, order: s.order, measured: s.measured_cycles >= 0 ? `${s.measured_cycles} cycles` : 'not measured', children: [] };
  }

  private loadPinmap(): void {
    this.svgHtml = null;
    const board = this.solution?.board_resolved;
    if (!board) { return; }
    this.http.get(`${this.base}/api/board/${encodeURIComponent(board)}/pinmap.svg`, { responseType: 'text' }).subscribe({
      next: (text: string) => {
        this.svgHtml = this.sanitizer.bypassSecurityTrustHtml(text);
        setTimeout(() => this.applyHighlighting(), 0);
      },
      error: () => { /* the pin map degrades to the chips/conflicts lists only — never blocks the panel */ },
    });
  }

  private laneOf(task: string): string {
    const s = this.schedule.find(x => x.task === task);
    return s ? s.lane : '';
  }

  // ------------------------------------------------------------------ fs-2c item 3: symmetric highlighting
  /** A task's OWN bound pin(s) — distinct from "valid candidates" (which include its own pin too, since
   * valid-targets excludes the selected task from its own conflict check). */
  private taskOwnPins(task: string): string[] {
    return this.assignments.filter(a => a.task === task && a.status === 'bound')
      .map(a => (a.lives_on.split(':').pop() || a.lives_on));
  }

  get relatedTaskNames(): Set<string> {
    const out = new Set<string>();
    if (!this.selectedTask) { return out; }
    const t = this.selectedTask.task;
    (this.childrenOfTask[t] || []).forEach(c => out.add(c));
    if (this.callerOfTask[t]) { out.add(this.callerOfTask[t]); }
    return out;
  }

  /** fs-2c item 3, the Tasks-table/Schedule-chip half of symmetric highlighting (the pin-map half is
   * `applyHighlighting`, a direct SVG overlay). */
  taskHighlight(task: string): 'solid' | 'outline' | 'dim' | '' {
    if (this.selectedTask) {
      if (task === this.selectedTask.task || this.relatedTaskNames.has(task)) { return 'solid'; }
      return '';
    }
    if (this.selectedPin) {
      const regNames = (this.pinDetail?.registered_tasks || []).map(r => r.task);
      if (regNames.includes(task)) { return 'solid'; }
      const cached = this.taskValidityCache[task];
      const row = cached?.pins.find(p => p.pin === this.selectedPin);
      if (row && (row.verdict === 'valid' || row.verdict === 'undetermined')) { return 'outline'; }
      return 'dim';
    }
    return '';
  }

  private ensureBaseTitle(el: Element): string {
    const title = el.querySelector('title');
    if (!title) { return ''; }
    if (!el.hasAttribute('data-base-title')) { el.setAttribute('data-base-title', title.textContent || ''); }
    return el.getAttribute('data-base-title') || '';
  }

  private applyHighlighting(): void {
    const host = this.svgHostRef?.nativeElement;
    if (!host) { return; }
    host.querySelectorAll('[data-pin]').forEach(el => {
      (el as HTMLElement).style.outline = '';
      (el as HTMLElement).style.filter = '';
      el.removeAttribute('data-verdict');
      el.removeAttribute('data-highlight');
    });
    if (this.selectedTask && this.taskValidity && !this.taskValidity.refused) {
      const ownPins = new Set(this.taskOwnPins(this.selectedTask.task));
      for (const row of this.taskValidity.pins) {
        const sel = `[data-pin="${row.pin.replace(/"/g, '')}"]`;
        const isOwn = ownPins.has(row.pin);
        const highlight: 'solid' | 'outline' | 'dim' = isOwn ? 'solid' : (row.verdict === 'invalid' ? 'dim' : 'outline');
        const color = isOwn ? (this.laneColor(this.laneOf(this.selectedTask.task)) || VERDICT_COLORS.valid) : VERDICT_COLORS[row.verdict];
        host.querySelectorAll(sel).forEach(el => {
          const e = el as HTMLElement;
          e.style.outline = `${isOwn ? 4 : 3}px ${isOwn ? 'solid' : 'dashed'} ${color}`;
          e.setAttribute('data-verdict', row.verdict);
          e.setAttribute('data-highlight', highlight);
          const title = e.querySelector('title');
          if (title) {
            const base = this.ensureBaseTitle(e);
            const coop = row.registered_to.length
              ? ` — registered to ${row.registered_to.join(', ')} (${row.cooperating ? 'cooperating' : 'conflict'})` : '';
            title.textContent = `${base}\n${row.reason}${coop}`;
          }
        });
      }
    } else {
      this.applyDefaultPinColors(host);
    }
    if (this.selectedPin) {
      host.querySelectorAll(`[data-pin="${this.selectedPin.replace(/"/g, '')}"]`).forEach(el => {
        (el as HTMLElement).style.filter = 'drop-shadow(0 0 4px #1565c0)';
      });
    }
  }

  private applyDefaultPinColors(host: HTMLElement): void {
    for (const a of this.assignments) {
      if (a.status !== 'bound') { continue; }
      const pin = a.lives_on.split(':').pop() || '';
      const color = this.laneColor(this.laneOf(a.task));
      host.querySelectorAll(`[data-pin="${pin.replace(/"/g, '')}"]`).forEach(el => { (el as HTMLElement).style.outline = `3px solid ${color}`; });
    }
    this.applyRegisteredTooltips(host);
  }

  /** fs-2b: the pin tooltip lists "Registered Tasks: …" (his naming, verbatim) — only when no valid-targets
   * overlay is active (that overlay sets its own, more specific, per-verdict reason + cooperation tooltip). */
  private applyRegisteredTooltips(host: HTMLElement): void {
    const board = this.solution?.board_resolved || '';
    host.querySelectorAll('[data-pin]').forEach(el => {
      const pin = el.getAttribute('data-pin') || '';
      const regs = this.registeredTasks[`${board}:${pin}`] || [];
      const title = el.querySelector('title');
      if (!title) { return; }
      const base = this.ensureBaseTitle(el);
      const names = regs.length ? regs.map(r => r.task).join(', ') : 'none';
      title.textContent = `${base}\nRegistered Tasks: ${names}`;
    });
  }

  // ------------------------------------------------------------------ fs-2c item 5: ranked Target details
  /** For a selected task: valid (unclaimed) targets first, then undetermined, then registered-elsewhere
   * (cooperating before conflicting), invalid collapsed. The first row of `visible` is always a viable one
   * (valid/undetermined/cooperating) when any exists. */
  get taskRanked(): { visible: ValidTargetPin[]; invalid: ValidTargetPin[] } {
    const pins = (this.taskValidity && !this.taskValidity.refused) ? this.taskValidity.pins : [];
    const byPin = (a: ValidTargetPin, b: ValidTargetPin) => a.pin.localeCompare(b.pin);
    const valid = pins.filter(p => p.verdict === 'valid' && !p.registered_to.length).sort(byPin);
    const undetermined = pins.filter(p => p.verdict === 'undetermined').sort(byPin);
    const elsewhereCoop = pins.filter(p => p.verdict === 'valid' && p.registered_to.length > 0).sort(byPin);
    const elsewhereConflict = pins.filter(p => p.verdict === 'invalid' && p.registered_to.length > 0).sort(byPin);
    const invalid = pins.filter(p => p.verdict === 'invalid' && !p.registered_to.length);
    return { visible: [...valid, ...undetermined, ...elsewhereCoop, ...elsewhereConflict], invalid };
  }

  /** For a selected pin: Registered Tasks first, then compatible unregistered tasks (from the per-task
   * valid-targets cache — fs-2c item 3's own note: "derive from the per-task valid-targets results you already
   * have"), the rest collapsed. */
  get pinRanked(): { registered: PinRegisteredTask[]; compatible: string[]; restCount: number } {
    if (!this.pinDetail) { return { registered: [], compatible: [], restCount: 0 }; }
    const registered = this.pinDetail.registered_tasks;
    const regNames = new Set(registered.map(r => r.task));
    const unregisteredNames = Array.from(new Set(this.unregisteredTasks.map(a => a.task))).filter(t => !regNames.has(t));
    const compatible = unregisteredNames.filter(t => {
      const cached = this.taskValidityCache[t];
      const row = cached?.pins.find(p => p.pin === this.selectedPin);
      return !!row && (row.verdict === 'valid' || row.verdict === 'undetermined');
    });
    const restCount = unregisteredNames.length - compatible.length;
    return { registered, compatible, restCount };
  }

  // ------------------------------------------------------------------ fs-2c item 2: ONE selection model
  taskAssignment(task: string): RegisterAssignment {
    return this.assignments.find(a => a.task === task) || this.syntheticAssignment(task);
  }

  private syntheticAssignment(task: string): RegisterAssignment {
    return { name: `${this.selected}:${task}`, solution: this.selected, task, port: '', target_kind: '', controls: '', lives_on: 'unbound', status: 'unbound', provenance: '', notes: '' };
  }

  private sameTask(x: RegisterAssignment, y: RegisterAssignment): boolean {
    return x.task === y.task && (x.port || '') === (y.port || '');
  }

  /** The toggle-aware PRIMITIVE for selecting a task when no pin is already selected. `selectTask`/`selectPin`
   * are never bound directly in the template — every clickable task/pin goes through `handleTaskActivate`/
   * `handlePinActivate` (fs-2c item 2's "one selection model, many entry points"), which falls back to these. */
  selectTask(a: RegisterAssignment): void {
    if (this.selectedTask && this.sameTask(this.selectedTask, a)) { this.clearSelection(); return; }
    this.applyTaskSelection(a);
  }

  selectPin(pin: string): void {
    if (this.selectedPin === pin) { this.clearSelection(); return; }
    this.applyPinSelection(pin);
  }

  private validTargetsUrl(task: string): string {
    return `${this.base}${this.solutionsPath}/${encodeURIComponent(this.doorTarget)}/tasks/${encodeURIComponent(task)}/valid-targets`;
  }

  private applyTaskSelection(a: RegisterAssignment): void {
    this.pending = null; this.assignError = ''; this.assignWarning = '';
    this.showMoreInvalidTask = false; this.showMoreRestPin = false;
    this.selectedTask = a; this.taskValidity = null; this.taskValidityError = ''; this.detailMode = 'task';
    this.selectedPin = ''; this.pinDetail = null; this.pinDetailError = '';
    this.http.get<ValidTargetsResponse>(this.validTargetsUrl(a.task), { headers: this.headers }).subscribe({
      next: (r: any) => {
        if (!r || r.ok === false) { this.taskValidityError = (r && r.error) || 'could not check valid targets'; return; }
        this.taskValidity = r; this.taskValidityCache[a.task] = r;
        this.applyHighlighting();
      },
      error: (err: any) => { const f = friendlyError(err, 'GET valid-targets'); this.taskValidityError = f.text; },
    });
  }

  private applyPinSelection(pin: string): void {
    this.pending = null; this.assignError = ''; this.assignWarning = '';
    this.showMoreInvalidTask = false; this.showMoreRestPin = false;
    this.selectedPin = pin; this.pinDetail = null; this.pinDetailError = ''; this.detailMode = 'pin';
    this.selectedTask = null; this.taskValidity = null; this.taskValidityError = '';
    const board = this.solution?.board_resolved || '';
    this.loadCompatRowsOnce();
    this.loadPinChain(pin);
    this.http.get<PinDetail>(`${this.base}/api/board/${encodeURIComponent(board)}/pins/${encodeURIComponent(pin)}`, { headers: this.headers }).subscribe({
      next: (r: any) => {
        if (!r || r.ok === false) { this.pinDetailError = (r && r.error) || `could not load pin ${pin}`; return; }
        this.pinDetail = r;
        this.applyHighlighting();
      },
      error: (err: any) => { const f = friendlyError(err, 'GET pin detail'); this.pinDetailError = f.text; },
    });
  }

  clearSelection(): void {
    this.selectedTask = null; this.taskValidity = null; this.taskValidityError = '';
    this.selectedPin = ''; this.pinDetail = null; this.pinDetailError = '';
    this.pinChain = null; this.pinChainError = '';
    this.detailMode = 'none'; this.pending = null; this.pendingConfig = { ...DEFAULT_PENDING_CONFIG };
    this.assignError = ''; this.assignWarning = '';
    this.applyHighlighting();
  }

  /** ucd-0b item 1: GET .../pins/{pin}/chain, cached per pin (cleared by `select()` on a new solution or a
   * just-confirmed assign). A 404 (older backend without the chain door) is swallowed — the block above just
   * shows nothing beyond what `pinDetail` already gives; any other error surfaces as `pinChainError`. */
  private loadPinChain(pin: string): void {
    this.pinChain = null; this.pinChainError = '';
    const cached = this.pinChainCache[pin];
    if (cached) { this.pinChain = cached; return; }
    const url = `${this.base}${this.solutionsPath}/${encodeURIComponent(this.doorTarget)}/pins/${encodeURIComponent(pin)}/chain`;
    this.http.get<PinChainResponse>(url, { headers: this.headers }).subscribe({
      next: (r: any) => {
        if (!r || r.ok === false) { return; }
        this.pinChain = r; this.pinChainCache[pin] = r;
      },
      error: (err: any) => {
        if (err?.status === 404) { return; } // older backend — tolerate silently
        this.pinChainError = friendlyError(err, 'GET pin chain').text;
      },
    });
  }

  /** ucd-0b item 1: one line per RegisterFieldSetting, e.g. "EICRA.ISC1 = 01 — Any logical change on INT1 generates
   * an interrupt request · from sense.isr · rule edge-any-to-ISC". */
  fieldSettingLine(fs: RegisterFieldSettingRow): string {
    const from = fs.task || fs.pin_claim || '—';
    return `${fs.register_field} = ${fs.value} — ${fs.meaning} · from ${from} · rule ${fs.rule}`;
  }

  /** ucd-0b item 1: the bit strip above/below a RegisterSetting's final value — a plain flex row of spans, no
   * library. `value_bits` is a bit string, e.g. "00001101"; absent entirely when the backend hasn't derived it. */
  bitIndices(bits: string): number[] { return bits.split('').map((_, i) => bits.length - 1 - i); }
  bitChars(bits: string): string[] { return bits.split(''); }

  /** ucd-0b item 1: a chain hop's `ref` ('Class:name') -> the generic object page's route. */
  hopRouterLink(ref: string): string[] {
    const idx = ref.indexOf(':');
    if (idx < 0) { return ['/object', ref]; }
    return ['/object', ref.slice(0, idx), ref.slice(idx + 1)];
  }

  /** ucd-0b item 3: a status chip for a Tasks-table row when its own PinClaim is 'incomplete' or 'conflict' — null
   * (no chip) when `claims` is empty/absent or every claim for this task is 'ok'. The short text names the first
   * undetermined design-choice field for 'incomplete' (e.g. "edge?"), else falls back to the status word. */
  taskClaimChip(task: string): { text: string; title: string; status: 'conflict' | 'incomplete' } | null {
    const c = this.claims.find(cl => cl.task === task && (cl.status === 'incomplete' || cl.status === 'conflict'));
    if (!c) { return null; }
    if (c.status === 'conflict') { return { text: 'conflict', title: c.why || 'conflicting claim', status: 'conflict' }; }
    const missing = c.edge === 'undetermined' ? 'edge?' : c.pull === 'undetermined' ? 'pull?' : 'incomplete';
    return { text: missing, title: c.why || 'incomplete claim', status: 'incomplete' };
  }

  /** ucd-0b2c item 2: one row per requirement of `task` (its own `assignments` rows — never a new door), for the
   * "Resources this task uses" table. `required` falls back to "not a memory-field" when the backend hasn't sent
   * it (an older backend, pre-ucd-0b2a); `requirement_kind` falls back to `target_kind` the same way (degrade #4). */
  taskResourceRowsFor(task: string): TaskResourceRow[] {
    return this.assignments.filter(a => a.task === task).map(a => this.toResourceRow(a));
  }

  private toResourceRow(a: RegisterAssignment): TaskResourceRow {
    const kind = a.requirement_kind || a.target_kind || '—';
    const required = a.required !== undefined ? a.required : kind !== 'memory-field';
    const bound = a.status === 'bound' || a.status === 'conflict';
    return {
      port: a.port || '—', requirement_kind: kind, role: a.role || '', required,
      bound_to: bound ? (a.lives_on.split(':').pop() || a.lives_on) : '—',
      status: a.status, route: a.signal_route || '',
      needs_pin: required && !bound, memory_field: !required,
      target_definition_name: a.target_definition_name || '',
      derived_requirement_kind: a.derived_requirement_kind, derived_role: a.derived_role,
      overrides_refs_json: a.overrides_refs_json,
    };
  }

  /** ucd-0b2c item 3: the Tasks-table chip — "N/M bound" over REQUIRED rows only (a memory-field is never
   * "required"); null when the task has no required rows at all (nothing to summarize, no chip renders). */
  taskResourceChip(task: string): { text: string; bad: boolean } | null {
    const required = this.taskResourceRowsFor(task).filter(r => r.required);
    if (!required.length) { return null; }
    const bound = required.filter(r => r.status === 'bound').length;
    return { text: `${bound}/${required.length} bound`, bad: bound < required.length };
  }

  /** ucd-0b item 2: which config selects the confirm bar shows for the pending registration's task kind
   * (`target_kind`, the same kind vocabulary as `compatRowsForSelectedPin`'s rule kinds). */
  get pendingNeeds(): { edge: boolean; pull: boolean; initial: boolean } {
    const kind = this.pending?.task.target_kind || '';
    return {
      edge: kind === 'interrupt-in',
      pull: kind === 'digital-in' || kind === 'interrupt-in',
      initial: kind === 'digital-out',
    };
  }

  private loadCompatRowsOnce(): void {
    if (this.compatLoaded) { return; }
    this.http.get<any>(`${this.base}/api/board/target-compat`, { headers: this.headers }).subscribe({
      next: (r: any) => { this.compatRows = (r && r.rows) || []; this.compatLoaded = true; },
      error: () => { /* the Target details section degrades to register detail + Registered Tasks only */ },
    });
  }

  registerNames(d: PinDetail): string {
    const p = d.register.port;
    if (!p || p === 'undetermined') { return 'undetermined'; }
    return `DDR${p} / PORT${p} / PIN${p}`;
  }

  electricalLimits(d: PinDetail): { key: string; value: any }[] {
    return Object.keys(d.electrical || {}).filter(k => k !== 'fact').map(k => ({ key: k, value: d.electrical[k] }));
  }

  electricalFact(d: PinDetail): string { return (d.electrical || {})['fact'] || ''; }

  /** fs-2d: the Power / reference block's own `electrical` dict (board.custom.power_pins) — unlike `electricalLimits`
   * above (one SoC pin's register facts, 'fact' key held back for the inline citation), this one has no such
   * reserved key, so every entry renders. */
  objectEntries(o: Record<string, any> | null | undefined): { key: string; value: any }[] {
    return Object.keys(o || {}).map(k => ({ key: k, value: (o as any)[k] }));
  }

  /** fs-2d: "POWER:5, DIGITAL_H:7, …" for a power/reference pin's every physical location (GND has 4 on the UNO) —
   * a plain method, not a template arrow function (Angular template expressions cannot contain them). */
  pinLocationsText(pr: PowerReferenceDetail): string {
    return pr.locations.length ? pr.locations.map(l => `${l.connector}:${l.number}`).join(', ') : '—';
  }

  /** fs-2b: the globally-cited TargetCompatibilityRule rows that apply to THIS pin's own alternate-function
   * facts — a display FILTER of the door's own cited rows, never a re-derivation of compatible()'s verdicts. */
  get compatRowsForSelectedPin(): TargetCompatRow[] {
    if (!this.pinDetail || !this.compatRows.length) { return []; }
    const d = this.pinDetail;
    const kinds = new Set<string>(['digital-in', 'digital-out']);
    if (d.roles.includes('power')) { kinds.add('power'); }
    if (d.roles.includes('ground')) { kinds.add('ground'); }
    const SIGNAL_KIND: Record<string, string> = {
      RXD: 'uart-rx', TXD: 'uart-tx', SDA: 'i2c-sda', SCL: 'i2c-scl',
      MOSI: 'spi-mosi', MISO: 'spi-miso', SCK: 'spi-sck', SS: 'spi-ss',
    };
    for (const f of d.alternate_functions) {
      if (f.kind === 'ADC channel') { kinds.add('analog-in'); }
      if (f.kind === 'timer channel') { kinds.add('pwm-out'); }
      if (f.kind === 'external interrupt' || f.kind === 'pin-change interrupt') { kinds.add('interrupt-in'); }
      if (SIGNAL_KIND[f.signal]) { kinds.add(SIGNAL_KIND[f.signal]); }
    }
    return this.compatRows.filter(r => kinds.has(r.kind));
  }

  // ------------------------------------------------------------------ fs-2c items 2/4: the ONE entry point per side
  /** The ONLY method any clickable PIN binds to (map click/keydown, a drag's drop, a Target-details pin row).
   * With no task selected, this is just pin selection (toggle-aware, via `selectPin`). With a task already
   * selected, this evaluates the (task, pin) pair and — for a valid/undetermined pin — sets `pending` for the
   * selection bar's confirm; it NEVER posts. */
  handlePinActivate(pin: string): void {
    this.assignError = ''; this.assignWarning = '';
    if (this.selectedTask) {
      if (this.pending && this.pending.pin === pin) { this.pending = null; return; } // same pin again cancels the offer
      const row = this.taskValidity?.pins.find(p => p.pin === pin);
      this.offerPair(this.selectedTask, pin, row);
      return;
    }
    this.selectPin(pin);
  }

  /** The ONLY method any clickable TASK binds to (a Tasks-section row, an Unregistered-Tasks chip, a
   * schedule-lane chip, a Target-details row). With no pin selected, this is just task selection (toggle-aware,
   * via `selectTask`). With a pin already selected, this evaluates the pair from the cached per-task
   * valid-targets response — fetching it first if it is not yet cached — and sets `pending` the same way. */
  handleTaskActivate(a: RegisterAssignment): void {
    this.assignError = ''; this.assignWarning = '';
    if (this.selectedPin) {
      const pin = this.selectedPin;
      if (this.pending && this.sameTask(this.pending.task, a)) { this.pending = null; return; } // same task again cancels
      const cached = this.taskValidityCache[a.task];
      if (cached) { this.offerPair(a, pin, cached.pins.find(p => p.pin === pin)); return; }
      const ownPins = this.taskOwnPins(a.task);
      if (ownPins.includes(pin)) { this.setPending({ kind: 'unregister', task: a, pin }); return; }
      this.http.get<ValidTargetsResponse>(this.validTargetsUrl(a.task), { headers: this.headers }).subscribe({
        next: (r: any) => {
          if (!r || r.ok === false) { return; }
          this.taskValidityCache[a.task] = r;
          if (this.selectedPin === pin) { this.offerPair(a, pin, r.pins.find((p: ValidTargetPin) => p.pin === pin)); }
        },
        error: () => { /* informational only — never a silent write */ },
      });
      return;
    }
    this.selectTask(a);
  }

  /** fs-2c item 4 (his ruled pick, "selection then action with a confirm"): the ONE place that decides whether a
   * (task, pin) pair offers Register, Unregister, or neither — used from BOTH directions (task-first and
   * pin-first) so the offer is identical regardless of which side was clicked first. */
  private offerPair(task: RegisterAssignment, pin: string, row: ValidTargetPin | undefined): void {
    const ownPins = this.taskOwnPins(task.task);
    if (ownPins.includes(pin)) { this.setPending({ kind: 'unregister', task, pin }); return; }
    if (row && (row.verdict === 'valid' || row.verdict === 'undetermined')) { this.setPending({ kind: 'register', task, pin }); return; }
    this.assignError = row ? row.reason : `${task.task} has no known compatibility with ${pin} yet — select ${task.task} once to check`;
  }

  /** ucd-0b: the one place `pending` is ever set to a non-null offer — always resets `pendingConfig` to defaults so
   * a stale pick from a previous offer never carries over. */
  private setPending(p: PendingAction): void {
    this.pending = p;
    this.pendingConfig = { ...DEFAULT_PENDING_CONFIG };
  }

  get selectionText(): string {
    if (this.pending) {
      const label = this.taskLabel(this.pending.task);
      if (this.pending.kind === 'unregister') { return `Unregister ${label} from ${this.pending.pin}? `; }
      // ucd-0b item 2: state what Register will actually write — the needed config fields, in the chosen values.
      const needs = this.pendingNeeds;
      const bits: string[] = [];
      if (needs.edge) { bits.push(`${this.pendingConfig.edge} edge`); }
      if (needs.pull) { bits.push(this.pendingConfig.pull === 'up' ? 'pull-up on' : 'no pull'); }
      if (needs.initial) { bits.push(`initial ${this.pendingConfig.initial}`); }
      const extra = bits.length ? `, ${bits.join(', ')}` : '';
      return `Register ${label} to ${this.pending.pin}${extra}? `;
    }
    if (this.selectedTask) {
      const label = this.taskLabel(this.selectedTask);
      return `Selected: task ${label} — click an outlined pin to register it there, or click ${label} again to deselect`;
    }
    if (this.selectedPin) {
      return `Selected: pin ${this.selectedPin} — click an outlined task to register it there, or click the pin again to deselect`;
    }
    return 'Nothing selected — click a task or a pin to begin';
  }

  taskLabel(a: RegisterAssignment): string { return a.task + (a.port ? '.' + a.port : ''); }

  confirmPending(): void {
    if (!this.pending) { return; }
    const { task, pin, kind } = this.pending;
    const board = this.solution?.board_resolved || '';
    const livesOn = kind === 'unregister' ? 'unbound' : `${board}:${pin}`;
    // ucd-0b item 2: only the fields this task kind needs ever go in `config` — never a stray default for a field
    // the backend didn't ask for.
    let config: Partial<PendingConfig> | undefined;
    if (kind === 'register') {
      const needs = this.pendingNeeds;
      config = {};
      if (needs.edge) { config.edge = this.pendingConfig.edge; }
      if (needs.pull) { config.pull = this.pendingConfig.pull; }
      if (needs.initial) { config.initial = this.pendingConfig.initial; }
    }
    this.postAssign(task, livesOn, config);
  }

  cancelPending(): void { this.pending = null; this.pendingConfig = { ...DEFAULT_PENDING_CONFIG }; }

  /** fs-2c item 4: the SAME door for Register and Unregister — `lives_on: 'unbound'` is fs-0's existing unassign
   * path (`cmod_firmware_api.py`'s `on_post_assign` already treats it as "set status back to unbound"), so no new
   * backend endpoint was needed ("one path to a write"). ucd-0b: `config` rides beside the existing fields, only
   * on a register (never on an unregister, and never a field the task kind doesn't need). */
  private postAssign(task: RegisterAssignment, livesOn: string, config?: Partial<PendingConfig>): void {
    const body: any = { task: task.task, port: task.port, lives_on: livesOn };
    if (config && Object.keys(config).length) { body.config = config; }
    this.http.post<any>(`${this.base}${this.solutionsPath}/${encodeURIComponent(this.doorTarget)}/assign`,
      body, { headers: this.headers }).subscribe({
      next: (r: any) => {
        if (!r || r.ok === false) { this.assignError = (r && (r.error || r.refused)) || 'assign refused'; this.pending = null; return; }
        if (r.warning) { this.assignWarning = r.warning; }
        this.pending = null;
        this.clearSelection();
        this.reloadSolution(); // ucd-0b2c: reloads the SAME binding the assign was made on, never the default
      },
      error: (err: any) => { const f = friendlyError(err, 'POST assign'); this.assignError = f.text; this.pending = null; },
    });
  }

  // ------------------------------------------------------------------ ucd-attest: attestation + overrides

  /** "Confirm by hand" on a Purpose's chip (`g.key` is the Purpose's own `name`) — opens the inline confirm dialog.
   * Nothing is written until `confirmAttest()`. */
  openAttest(purposeName: string): void {
    this.attestOpenFor = purposeName;
    this.attestForm = { mode: 'digital-twin', observed: '', boardInstance: '', outcome: 'passed' };
    this.attestError = '';
  }

  cancelAttest(): void { this.attestOpenFor = null; this.attestError = ''; this.attestBusy = false; }

  confirmAttest(): void {
    if (!this.attestOpenFor || this.attestBusy) { return; }
    const observed = (this.attestForm.observed || '').trim();
    if (!observed) { this.attestError = "A person's own words on what was seen are required."; return; }
    const purpose = this.attestOpenFor;
    const body: any = { mode: this.attestForm.mode, observed, outcome: this.attestForm.outcome };
    if (this.attestForm.boardInstance.trim()) { body.board_instance = this.attestForm.boardInstance.trim(); }
    this.attestBusy = true; this.attestError = '';
    this.http.post<any>(`${this.base}/api/capabilities/${encodeURIComponent(purpose)}/attest`, body, { headers: this.headers }).subscribe({
      next: (r: any) => {
        this.attestBusy = false;
        if (!r || r.ok === false) { this.attestError = (r && r.error) || 'attest refused'; return; }
        this.attestOpenFor = null;
        this.reloadSolution(); // re-reads the chip: "proven-on-hardware (attested)" etc.
      },
      error: (err: any) => { this.attestBusy = false; this.attestError = friendlyError(err, 'POST attest').text; },
    });
  }

  /** The "overridden" marker's own refs (from `overrides_refs_json`) for one field — '' when nothing overrides it. */
  overrideRefFor(refsJson: string | undefined, field: string): string {
    if (!refsJson) { return ''; }
    try {
      const refs: string[] = JSON.parse(refsJson) || [];
      return refs.find(r => r.endsWith(':' + field)) || '';
    } catch { return ''; }
  }

  /** Opens the Override dialog for one (targetClass, targetName, field) — `currentValue` is what the row shows
   * RIGHT NOW (the override's own value if one is already active, else the bare derivation), seeded as the form's
   * starting value so a person edits from what they see, never a blank. */
  openOverride(targetClass: string, targetName: string, field: string, currentValue: string): void {
    this.overrideOpenFor = { targetClass, targetName, field, derivedValue: currentValue };
    this.overrideForm = { value: currentValue, why: '' };
    this.overrideError = '';
  }

  cancelOverride(): void { this.overrideOpenFor = null; this.overrideError = ''; this.overrideBusy = false; }

  confirmOverride(): void {
    if (!this.overrideOpenFor || this.overrideBusy) { return; }
    const why = (this.overrideForm.why || '').trim();
    if (!why) { this.overrideError = "A person's own words (why) are required."; return; }
    const { targetClass, targetName, field } = this.overrideOpenFor;
    this.overrideBusy = true; this.overrideError = '';
    this.http.post<any>(`${this.base}/api/firmware/overrides`,
      { target_class: targetClass, target_name: targetName, field, value: this.overrideForm.value, why },
      { headers: this.headers }).subscribe({
      next: (r: any) => {
        this.overrideBusy = false;
        if (!r || r.ok === false) { this.overrideError = (r && r.error) || 'override refused'; return; }
        this.overrideOpenFor = null;
        this.reloadSolution();
      },
      error: (err: any) => { this.overrideBusy = false; this.overrideError = friendlyError(err, 'POST overrides').text; },
    });
  }

  /** The marker's own "retire" — `ref` is an `overrides_refs_json` entry ("DerivedOverride:<name>"); the name after
   * the first ':' is the DerivedOverride row's own name (which itself contains further ':'s — never re-split). */
  retireOverride(ref: string): void {
    if (!ref) { return; }
    const name = ref.slice(ref.indexOf(':') + 1);
    this.http.delete<any>(`${this.base}/api/firmware/overrides/${encodeURIComponent(name)}`, { headers: this.headers }).subscribe({
      next: () => { this.reloadSolution(); },
      error: (err: any) => { this.overrideError = friendlyError(err, 'DELETE overrides').text; },
    });
  }

  // ------------------------------------------------------------------ drag / click / keyboard
  onDragStart(ev: DragEvent, a: RegisterAssignment): void {
    this.dragging = a;
    ev.dataTransfer?.setData('text/plain', a.name);
    this.applyTaskSelection(a); // a drag gesture always (re)selects the dragged task, regardless of prior selection
  }

  onDragOver(ev: DragEvent): void { ev.preventDefault(); }

  /** fs-2c item 4: drag lands on the SAME confirm a click would — `handlePinActivate` is the one path, never a
   * direct POST from a drop. */
  onDrop(ev: DragEvent): void {
    ev.preventDefault();
    const target = this.dragging;
    this.dragging = null;
    if (!target) { return; }
    const pinEl = (ev.target as Element)?.closest?.('[data-pin]');
    if (!pinEl) { return; }
    const pin = pinEl.getAttribute('data-pin') || '';
    this.handlePinActivate(pin);
  }

  onPinClick(ev: MouseEvent): void {
    const pinEl = (ev.target as Element)?.closest?.('[data-pin]');
    if (!pinEl) { return; }
    this.handlePinActivate(pinEl.getAttribute('data-pin') || '');
  }

  onPinKeydown(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') { this.clearSelection(); return; }
    if (ev.key !== 'Enter') { return; }
    const active = document.activeElement;
    const pinEl = active?.closest?.('[data-pin]');
    if (!pinEl) { return; }
    this.handlePinActivate(pinEl.getAttribute('data-pin') || '');
  }
}
