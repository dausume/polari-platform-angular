/**
 * mtg-4: the realtime wire codec, CLIENT side.
 *
 * There is no hand-copied message catalog here on purpose. The
 * backend serves the contract (`GET /api/collab/realtime-schema`,
 * generated from collab/realtime_schemas.py) and this codec validates
 * against whatever it receives — so a VR shell that ships on its own
 * schedule and a browser page built today read the SAME catalog, and
 * there is no second copy to drift.
 *
 * The four compatibility rules are implemented exactly as the Python
 * side states them: unknown kind → ignore, unknown field → drop and
 * deliver, newer kind minor → accept, protocol major mismatch →
 * refuse by name.
 *
 * THE LINE: everything here is ephemeral. Nothing decoded by this
 * file may write a Polari row — commits ride the propose/execute
 * path through the normal API.
 */

export interface CatalogField {
  name: string;
  type: 'str' | 'int' | 'float' | 'bool' | 'vec3' | 'quat' | 'list';
  required: boolean;
  note?: string;
}

export interface CatalogKind {
  version: number;
  maxHz: number;
  purpose: string;
  fields: CatalogField[];
}

export interface RealtimeCatalog {
  kind: string;
  protocol: string;
  schemaVersion: number;
  protocolVersion: string;
  ephemeralOnly: boolean;
  authoritativeKinds: string[];
  kinds: Record<string, CatalogKind>;
}

export type Decoded =
  | { ok: true; kind: string; data: Record<string, any>; sender: string; sentAt: number; dropped: string[] }
  | { ok: false; ignore: true; reason: string }
  | { ok: false; refused: true; reason: string };

const isNum = (v: any) => typeof v === 'number' && Number.isFinite(v);

const CHECKS: Record<string, (v: any) => boolean> = {
  str: (v) => typeof v === 'string',
  int: (v) => Number.isInteger(v),
  float: isNum,
  bool: (v) => typeof v === 'boolean',
  vec3: (v) => Array.isArray(v) && v.length === 3 && v.every(isNum),
  quat: (v) => Array.isArray(v) && v.length === 4 && v.every(isNum),
  list: (v) => Array.isArray(v),
};

export class RealtimeCodec {
  private lastSentAt = new Map<string, number>();

  constructor(
    private catalog: RealtimeCatalog,
    private identity: string,
  ) {}

  get protocolVersion(): string {
    return this.catalog.protocolVersion;
  }

  kinds(): string[] {
    return Object.keys(this.catalog.kinds);
  }

  /** True when this kind may be sent now without exceeding the
   *  catalog's declared rate ceiling. Bandwidth is the real cost of a
   *  media meeting and the resource ledger cannot measure it yet
   *  (mtg-1) — so the sender honours the ceiling the protocol
   *  declares rather than streaming as fast as it can. */
  mayEmit(kind: string, now = Date.now()): boolean {
    const spec = this.catalog.kinds[kind];
    if (!spec) { return false; }
    const minGap = 1000 / Math.max(spec.maxHz, 0.001);
    const last = this.lastSentAt.get(kind) ?? -Infinity;
    return now - last >= minGap;
  }

  /** Build a wire message, or null when the kind is unknown, a
   *  required field is missing/mistyped, or the rate ceiling says
   *  not yet. A malformed message is a SENDER bug — better dropped
   *  here than puzzled over by every peer. */
  encode(kind: string, data: Record<string, any>, now = Date.now()): any | null {
    const spec = this.catalog.kinds[kind];
    if (!spec || !this.mayEmit(kind, now)) { return null; }
    const payload: Record<string, any> = {};
    for (const field of spec.fields) {
      const value = data[field.name];
      if (value === undefined || value === null) {
        if (field.required) { return null; }
        continue;
      }
      if (!CHECKS[field.type]?.(value)) { return null; }
      payload[field.name] = value;
    }
    this.lastSentAt.set(kind, now);
    return {
      p: this.catalog.protocol,
      v: this.catalog.schemaVersion,
      k: kind,
      kv: spec.version,
      t: Math.round(now) / 1000,
      s: this.identity,
      d: payload,
    };
  }

  decode(raw: any): Decoded {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { ok: false, refused: true, reason: 'message is not an object' };
    }
    if (raw.p !== this.catalog.protocol) {
      return { ok: false, refused: true, reason: `not a ${this.catalog.protocol} message` };
    }
    if (raw.v !== this.catalog.schemaVersion) {
      return {
        ok: false, refused: true,
        reason: `protocol major ${raw.v} != ours ${this.catalog.schemaVersion}`
          + ' — majors are refused by name, never guessed at',
      };
    }
    const spec = this.catalog.kinds[raw.k];
    if (!spec) {
      // A newer peer may speak kinds we do not know. Silence is the
      // forward-compatible answer.
      return { ok: false, ignore: true, reason: `unknown kind ${raw.k}` };
    }
    if (!raw.d || typeof raw.d !== 'object') {
      return { ok: false, refused: true, reason: `${raw.k}: payload is not an object` };
    }
    const known = new Map(spec.fields.map((f) => [f.name, f]));
    const data: Record<string, any> = {};
    const dropped: string[] = [];
    for (const [name, value] of Object.entries(raw.d)) {
      const field = known.get(name);
      if (!field) { dropped.push(name); continue; }
      if (!CHECKS[field.type]?.(value)) {
        return { ok: false, refused: true, reason: `${raw.k}.${name}: expected ${field.type}` };
      }
      data[name] = value;
    }
    const missing = spec.fields.filter((f) => f.required && !(f.name in data));
    if (missing.length) {
      return {
        ok: false, refused: true,
        reason: `${raw.k}: missing required ${missing.map((f) => f.name).join(', ')}`,
      };
    }
    return {
      ok: true, kind: raw.k, data,
      sender: typeof raw.s === 'string' ? raw.s : '',
      sentAt: typeof raw.t === 'number' ? raw.t : 0,
      dropped,
    };
  }
}
