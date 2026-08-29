/**
 * Shared shapes + helpers for the freedom-to-use proof surfaces
 * (freedom-proof-panel, evidence-browser, evidence-detail-drawer).
 * Mirrors the backend contract EXACTLY:
 *   GET /api/cntfet/{device|cell}/{name}/proof   -> ProofPayload
 *   GET /api/cntfet/evidence/{name}              -> EvidenceDetailPayload
 *   GET /api/cntfet/evidence?kind=&subject=      -> EvidenceListPayload
 *   GET /api/cntfet/proof                        -> LibraryProofPayload
 */

export type ProofStatus = 'proven-free' | 'free-unverified' | 'encumbered' | 'unknown';
export type Verdict = 'green' | 'amber' | 'red';
export type EvidenceKind =
  'patent' | 'publication' | 'textbook' | 'standard' | 'licence' | 'prior-art';

export interface EvidenceRef {
  name: string;
  kind: EvidenceKind | string;
  title?: string;
  ref?: string;
  date?: string;
  proves?: string;
  proves_detail?: string;
  expiry?: string;
  verified?: boolean;
  url?: string;
  detailPath?: string;
}

export interface ProofRecord {
  record: string;
  display_name?: string;
  verdict: Verdict | string;
  ip_kind?: string;
  fto_reasoning?: string;
  evidence?: EvidenceRef[];
}

export interface ProofPayload {
  ok: boolean;
  subject_kind: 'device' | 'cell' | 'route' | string;
  subject: string;
  status: ProofStatus | string;
  rule_applied: string;
  chain: ProofRecord[];
  gaps: string[];
  self_manufacture_answer?: string;
  disclaimer: string;
  error?: string;
}

export interface EvidenceItem extends EvidenceRef {
  parties?: string;
  jurisdiction?: string;
  verified_via?: string;
  verified_at?: string;
  licence_bucket?: string;
  notes?: string;
  subjectsCount?: number;
}

export interface EvidenceDetailPayload {
  ok: boolean;
  item: EvidenceItem;
  supports: { records: string[]; devices: string[]; cells: string[] };
  citedBy: Array<{ className: string; name: string; display_name?: string }>;
  disclaimer: string;
  error?: string;
}

export interface EvidenceListPayload {
  ok: boolean;
  items: EvidenceItem[];
  counts?: { byKind: Record<string, number>; verified: number; unverified: number };
  error?: string;
}

export interface LibrarySubject {
  subject_kind: string;
  subject: string;
  status: ProofStatus | string;
  ipVerdict?: string;
  evidenceCount?: number;
  verifiedCount?: number;
  gaps?: string[] | number;
  detailPath: string;
}

export interface LibraryProofPayload {
  ok: boolean;
  subjects: LibrarySubject[];
  counts: Record<string, number>;
  disclaimer: string;
  error?: string;
}

export const PROOF_STATUSES: ProofStatus[] =
  ['proven-free', 'free-unverified', 'encumbered', 'unknown'];

/** Chip-pattern state class for a proof status (global _chip-patterns). */
export function statusClass(status: string | undefined): string {
  switch (status) {
    case 'proven-free': return 'is-ok';
    case 'free-unverified': return 'is-warn';
    case 'encumbered': return 'is-error';
    default: return 'is-muted';
  }
}

/** Chip-pattern state class for a record verdict. */
export function verdictClass(verdict: string | undefined): string {
  switch (verdict) {
    case 'green': return 'is-ok';
    case 'amber': return 'is-warn';
    case 'red': return 'is-error';
    default: return 'is-muted';
  }
}

/** One-letter glyph per evidence kind for the chips. */
export function kindLetter(kind: string | undefined): string {
  switch (kind) {
    case 'patent': return 'P';
    case 'publication': return 'J';
    case 'textbook': return 'T';
    case 'standard': return 'S';
    case 'licence': return 'L';
    case 'prior-art': return 'A';
    default: return '?';
  }
}

/** Number of gaps whether the backend sent a list or a count. */
export function gapCount(gaps: string[] | number | undefined): number {
  if (Array.isArray(gaps)) { return gaps.length; }
  return typeof gaps === 'number' ? gaps : 0;
}

/** The backend's own `error` string verbatim when it sent one. */
export function errorText(err: any, path: string): string {
  const body = err?.error;
  if (body && typeof body.error === 'string') { return body.error; }
  return `GET ${path} failed: ${err?.message || 'request failed'}`;
}
