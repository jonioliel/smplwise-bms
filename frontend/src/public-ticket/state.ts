/**
 * CR-038 slice 4 (spec 10.2 / 10.7): the handler page's decisions as pure functions (tests/unit-public-ticket.spec.ts runs them in
 * node, no DOM): where the token comes from, which screen an answer leads to, and the offline-safe plan of an update - every
 * write carries a client request id that is kept with the draft until the server confirms it, so a retry after a lost answer
 * is the SAME request (the server replays the first answer, nothing happens twice).
 */
import type { ApiFailure, TicketView } from './api';

export type Phase = 'loading' | 'redeem' | 'code' | 'ready' | 'readonly' | 'returned' | 'unavailable' | 'busy' | 'error' | 'finished';

const TOKEN_RE = /^[A-Za-z0-9_-]{32}$/;
const RID_RE = /^\/t\/r\/([0-9a-f]{32})\/?$/;
const SESSION_RE = /^[A-Za-z0-9_-]{43}$/;

export interface Boot {
  token: string | null;
  rid: string | null;
  /** the fragment carried the token: the address bar must be replaced with /t/ now */
  fromFragment: boolean;
}

/** Spec 10.2: the token arrives in the URL fragment (`/t/#<token>`); an e-mail carries a redeem path (`/t/r/<rid>`) instead; a
 * reload of the tab finds the token it kept in sessionStorage. Anything malformed is ignored (never sent anywhere). */
export function bootFrom(hash: string, path: string, stored: string | null): Boot {
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash;
  if (TOKEN_RE.test(fragment)) return { token: fragment, rid: null, fromFragment: true };
  const m = RID_RE.exec(path);
  if (m) return { token: null, rid: m[1], fromFragment: false };
  if (stored && TOKEN_RE.test(stored)) return { token: stored, rid: null, fromFragment: false };
  return { token: null, rid: null, fromFragment: false };
}

export function validSession(value: string | null | undefined): string | null {
  return value && SESSION_RE.test(value) ? value : null;
}

/** The screen a ticket answer leads to. */
export function phaseOf(view: TicketView): Phase {
  if (view.code_required && !view.code_ok) return 'code';
  if (view.read_only) return 'readonly';
  return 'ready';
}

export interface Next {
  phase: Phase;
  /** a message key of strings.ts for a banner on the current screen */
  message: string | null;
  /** forget the token in this tab (the link is dead) */
  forget: boolean;
  /** load the ticket again (its state changed under us) */
  reload: boolean;
}

/** What a failed call leads to. A 404 is ALWAYS the uniform "unavailable" (unknown, expired, revoked, closed past its grace,
 * module off - the page cannot and must not tell them apart); a 429 never says "unavailable" (review T1b). */
export function afterFailure(e: ApiFailure, current: Phase): Next {
  const keep = (message: string | null, reload = false): Next => ({ phase: current, message, forget: false, reload });
  if (e.offline) return keep('savedOffline');
  if (e.status === 404) return { phase: 'unavailable', message: null, forget: true, reload: false };
  if (e.status === 429) {
    if (e.code === 'code_locked') return keep('codeLocked');
    if (e.code === 'busy') return keep('e_busy');
    return current === 'ready' || current === 'readonly' || current === 'code' ? keep('e_rate_limited') : { phase: 'busy', message: null, forget: false, reload: false };
  }
  if (e.status === 403 && e.code === 'code_required') return { phase: 'code', message: null, forget: false, reload: true };
  if (e.status === 409 && e.code === 'read_only') return keep('e_read_only', true);
  if (e.status === 409 && (e.code === 'invalid_transition' || e.code === 'invalid_state')) return keep(`e_${e.code}`, true);
  if (e.status === 409 && e.code === 'photo_limit') return keep('e_photo_limit');
  if (e.status === 413) return keep('e_too_large');
  if (e.status === 415 && ['webp_refused', 'heic_refused', 'unsupported_format'].includes(e.code)) return keep(`e_${e.code}`);
  if (e.status === 422 && ['image_invalid', 'too_many_pixels'].includes(e.code)) return keep(`e_${e.code}`);
  if (e.status === 422) return keep('e_invalid');
  if (e.status === 503 && e.code === 'code_unavailable') return keep('codeUnavailable');
  if (e.status === 507) return keep('e_storage_full');
  if (e.status >= 500 || e.status === 0) return keep('e_generic');
  return keep('e_generic');
}

/** The code screens' message for a refused code (spec 10.5). */
export function codeMessage(e: ApiFailure): { key: string; n?: number } {
  switch (e.code) {
    case 'code_invalid':
      return { key: 'codeWrong', n: e.attemptsLeft ?? 0 };
    case 'code_expired':
      return { key: 'codeExpired' };
    case 'code_missing':
      return { key: 'codeMissing' };
    case 'code_malformed':
      return { key: 'codeMalformed' };
    case 'code_locked':
      return { key: 'codeLocked', n: Math.max(1, Math.ceil((e.retryAfter || 60) / 60)) };
    case 'code_unavailable':
      return { key: 'codeUnavailable' };
    default:
      return { key: afterFailure(e, 'code').message ?? 'e_generic' };
  }
}

// ---------------------------------------------------------------- the update draft (offline-safe)

export interface Draft {
  status: string | null;
  note: string;
  /** undefined = untouched; null = clear the ETA; a UTC ISO instant */
  eta: string | null | undefined;
  /** one request id per part, created once and kept until the server confirmed that part */
  crids: { status?: string; note?: string; eta?: string };
}

export const EMPTY_DRAFT: Draft = { status: null, note: '', eta: undefined, crids: {} };

export type Step =
  | { kind: 'status'; status: string; note: string | null; crid: string }
  | { kind: 'note'; text: string; crid: string }
  | { kind: 'eta'; eta: string | null; crid: string };

/** The calls one press of "send" makes, in order: the status (it carries the note when there is one), else the note alone,
 * then the ETA. A part's request id is created the first time it is planned and reused on every retry. */
export function planSend(draft: Draft, view: Pick<TicketView, 'status' | 'eta_at'>, newId: () => string): { steps: Step[]; draft: Draft } {
  const crids = { ...draft.crids };
  const steps: Step[] = [];
  const note = draft.note.trim();
  if (draft.status && draft.status !== view.status) {
    crids.status = crids.status ?? newId();
    steps.push({ kind: 'status', status: draft.status, note: note || null, crid: crids.status });
  } else if (note) {
    crids.note = crids.note ?? newId();
    steps.push({ kind: 'note', text: note, crid: crids.note });
  }
  if (draft.eta !== undefined && draft.eta !== (view.eta_at ?? null)) {
    crids.eta = crids.eta ?? newId();
    steps.push({ kind: 'eta', eta: draft.eta, crid: crids.eta });
  }
  return { steps, draft: { ...draft, crids } };
}

/** The draft after one step was confirmed by the server: that part (and its request id) is done. */
export function afterStep(draft: Draft, step: Step): Draft {
  const crids = { ...draft.crids };
  if (step.kind === 'status') {
    delete crids.status;
    return { ...draft, status: null, note: step.note ? '' : draft.note, crids };
  }
  if (step.kind === 'note') {
    delete crids.note;
    return { ...draft, note: '', crids };
  }
  delete crids.eta;
  return { ...draft, eta: undefined, crids };
}

/** A draft as kept in sessionStorage (a bad stored value is an empty draft). */
export function parseDraft(raw: string | null): Draft {
  if (!raw) return { ...EMPTY_DRAFT, crids: {} };
  try {
    const v = JSON.parse(raw) as Partial<Draft>;
    const crid = (x: unknown) => (typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x) ? x : undefined);
    const c = (v.crids ?? {}) as Record<string, unknown>;
    return {
      status: typeof v.status === 'string' ? v.status : null,
      note: typeof v.note === 'string' ? v.note.slice(0, 4000) : '',
      eta: v.eta === null || typeof v.eta === 'string' ? v.eta : undefined,
      crids: { status: crid(c.status), note: crid(c.note), eta: crid(c.eta) },
    };
  } catch {
    return { ...EMPTY_DRAFT, crids: {} };
  }
}

/** The statuses the page offers: the moves the server allows now, plus the current one (shown selected). */
export function statusChoices(view: Pick<TicketView, 'status' | 'actions'>): string[] {
  const order = ['acknowledged', 'in_progress', 'waiting_part', 'done'];
  const allowed = new Set(view.actions?.statuses ?? []);
  if (view.status && order.includes(view.status)) allowed.add(view.status);
  return order.filter((s) => allowed.has(s));
}
