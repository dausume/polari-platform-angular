import { stripKey } from './layout-geometry';
import { LvInteraction, LvPayload, LvPlacement, LvStep } from './layout-view.types';

/**
 * lay-2 / sim-3 - the PURE logic of the layout view that is not geometry: what an overlay sends to the twin, how an output follows the watched pin, what step k shows, what a click on
 * a hole answers, and which header pin a `?pin=` value means. No DOM, no HTTP.
 */

// ------------------------------------------------------------------------------------------------------------------ overlays -> the twin
export type Gesture = 'down' | 'up' | 'on' | 'off' | { value: number };

/** The inject body for one gesture on one overlay, or null when the overlay has no pin to drive (the server said so in its note). The part name rides along for the interaction record. */
export function injectBody(part: string, inter: LvInteraction, g: Gesture, adcMax = 5000): Record<string, unknown> | null {
  if (inter.control === 'slider') {
    if (typeof g !== 'object' || inter.adc === null || inter.adc === undefined) { return null; }
    const mv = mvFor(inter, g.value, adcMax);
    return { adc: inter.adc, mv, part, what: `${(inter.label || 'value').toLowerCase()} set to ${g.value}${inter.unit ? ' ' + inter.unit : ''} on ${part} (${mv} mV on analog input ${inter.adc})` };
  }
  if (!inter.twin_pin || typeof g === 'object') { return null; }
  const pressed = inter.pressed_level ?? 0;
  const down = g === 'down' || g === 'on';
  const level = down ? pressed : 1 - pressed;
  const kind = inter.control === 'press' ? (down ? 'press' : 'release') : 'toggle';
  return { set: inter.twin_pin, level, part, kind };
}

/** mv = offset + per_unit x value, kept inside the twin's accepted 0..adc_max millivolts. TMP36: 500 mV + 10 mV/degC (Analog Devices TMP35/36/37 datasheet). */
export function mvFor(inter: LvInteraction, x: number, adcMax = 5000): number {
  const raw = (inter.offset_mv ?? 0) + (inter.per_unit_mv ?? 0) * x;
  return Math.max(0, Math.min(adcMax, Math.round(raw)));
}

// ------------------------------------------------------------------------------------------------------------------ outputs follow the twin
export interface Edge { level: number; cycle: number; }
export const F_CPU_HZ = 16_000_000;   // the UNO's clock; the twin runs --freq 16000000 (board.custom.twin_sessions MCU/BOARD defaults)

/** PWM duty from the edges of ONE watched pin: needs at least 6 recent edges whose whole span is under 50 ms of the twin's own clock (a faster pattern than anyone blinks an LED by hand);
 *  the duty is the high time over the last full periods. null when the pin is not toggling that fast - the caller then says there is no duty figure and uses the level. */
export function dutyFromEdges(edges: Edge[], hz = F_CPU_HZ): number | null {
  const e = edges.slice(-9);
  if (e.length < 6) { return null; }
  if ((e[e.length - 1].cycle - e[0].cycle) / hz > 0.05) { return null; }
  let hi = 0, tot = 0;
  for (let i = 1; i < e.length; i++) { const dt = e[i].cycle - e[i - 1].cycle; tot += dt; if (e[i - 1].level === 1) { hi += dt; } }
  return tot > 0 ? Math.round((hi / tot) * 100) / 100 : null;
}

export interface PinState { level: number | null; edges: Edge[]; lastWallMs: number; }
export interface OutputLook { lit: boolean; opacity: number; note: string; tone: boolean; }

/** How an output sprite looks from its pin's state. LED: lit at level 1, dimmed to the duty when a PWM figure exists; never seen an edge = dark and said so. Piezo: a tone marker while the pin toggles. */
export function outputLook(kind: 'led' | 'tone', st: PinState | undefined, nowMs: number, toneWindowMs = 600): OutputLook {
  if (!st || st.level === null) { return { lit: false, opacity: 0, note: 'no change seen yet on its pin (the stream reports changes, not the level at the start)', tone: false }; }
  if (kind === 'tone') {
    const on = st.edges.length >= 2 && nowMs - st.lastWallMs <= toneWindowMs;
    return { lit: on, opacity: on ? 1 : 0, note: on ? 'its pin is toggling' : 'its pin is quiet', tone: on };
  }
  const duty = dutyFromEdges(st.edges);
  if (duty !== null) { return { lit: duty > 0, opacity: duty, note: `PWM: about ${Math.round(duty * 100)} % duty (from the pin's edges at 16 MHz)`, tone: false }; }
  return { lit: st.level === 1, opacity: st.level === 1 ? 1 : 0, note: st.level === 1 ? 'pin high' : 'pin low', tone: false };
}

// ------------------------------------------------------------------------------------------------------------------ steps
export interface StepView { shownParts: Set<string>; shownWires: Set<string>; newParts: Set<string>; newWires: Set<string>; whole: boolean; }

/** Step k shows steps 0..k (the step's own `draw` list); the elements it ADDS are highlighted and the rest dimmed. `k === null` is the whole build: everything, nothing dimmed. */
export function stepView(p: LvPayload, steps: LvStep[], k: number | null): StepView {
  if (k === null || !steps.length) {
    return { shownParts: new Set(p.placements.map(x => x.name)), shownWires: new Set(p.wires.map(w => w.name)), newParts: new Set(), newWires: new Set(), whole: true };
  }
  const s = steps[Math.max(0, Math.min(k, steps.length - 1))];
  return { shownParts: new Set(s.draw.parts), shownWires: new Set(s.draw.wires), newParts: new Set(s.adds.parts), newWires: new Set(s.adds.wires), whole: false };
}

/** `?step=` is 1-based; absent / "all" / garbage = the whole build. */
export function stepFromParam(v: string | null, count: number): number | null {
  if (!v || v === 'all' || count <= 0) { return null; }
  const n = parseInt(v, 10);
  return isFinite(n) && n >= 1 ? Math.min(n, count) - 1 : null;
}

// ------------------------------------------------------------------------------------------------------------------ a click on a hole
export interface HoleInfo { board: string; tie: string; strip: string; net: string; netMembers: string[]; onStrip: { kind: 'part' | 'wire'; name: string; text: string }[]; empty: boolean; words: string; }

/** What a hole answers: its strip, the net on that strip (from the parts' legs and the wires' ends that sit on it) and what else is on the strip. */
export function holeInfo(p: LvPayload, board: string, tie: string): HoleInfo {
  const key = stripKey(board, tie) || '';
  const onStrip: HoleInfo['onStrip'] = [];
  let net = '';
  for (const pl of p.placements) {
    for (const leg of pl.legs) {
      if (stripKey(board, leg.hole) === key && board === p.board.name) {
        net = net || leg.net;
        if (!onStrip.some(x => x.name === pl.name)) { onStrip.push({ kind: 'part', name: pl.name, text: `${pl.name} (${pl.part}), ${leg.name} leg in ${leg.hole}` }); }
      }
    }
  }
  for (const w of p.wires) {
    for (const end of [w.from, w.to]) {
      if (end.board === board && stripKey(board, end.tie) === key) {
        net = net || w.net;
        if (!onStrip.some(x => x.name === w.name)) { onStrip.push({ kind: 'wire', name: w.name, text: `${w.name}, ${w.colour_effective} wire, ${end.tie}` }); }
      }
    }
  }
  const members = net ? (p.nets[net] || []) : [];
  const empty = !onStrip.length;
  const words = empty ? `${tie}: nothing is connected on this strip.`
    : `${tie}: strip ${key.split(':').slice(1).join(' ')} is on net ${net}; also here: ${onStrip.map(x => x.name).join(', ')}.`;
  return { board, tie, strip: key, net, netMembers: members, onStrip, empty, words };
}

/** Everything a part's legs are on, for the "click a part" row. */
export function partRow(pl: LvPlacement): { name: string; part: string; legs: string } {
  return { name: pl.name, part: pl.part, legs: pl.legs.map(l => `${l.name}: ${l.hole} (net ${l.net})`).join('; ') };
}

/** A `?pin=` value from the pin view is an id such as `BoardPin:arduino-uno-r3:D6` or a bare `D6`: the header label is the last segment. */
export function pinLabelFromParam(v: string | null): string {
  if (!v) { return ''; }
  const last = v.split(':').pop() || '';
  return last.trim();
}
