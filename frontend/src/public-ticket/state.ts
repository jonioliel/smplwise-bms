/**
 * CR-038 slice 4 (spec 10.2 / 10.7): the handler page's decisions as pure functions (tests/unit-public-ticket.spec.ts runs them in
 * node, no DOM): where the token comes from, which screen an answer leads to, and the offline-safe plan of an update - every
 * write carries a client request id that is kept with the draft until the server confirms it, so a retry after a lost answer
 * is the SAME request (the server replays the first answer, nothing happens twice).
 */
import type { ApiFailure, TicketView } from './api';

export type Phase = 'loading' | 'redeem' | 'code' | 'ready' | 'readonly' | 'returned' | 'unavailable' | 'busy' | 'error' | 'finished';

const TOKEN_RE = /^[A-Za-z0-9_-]{32}$/;
// 2.5.4 / TK255: `/t/r/<rid>` or `/<prefix>/r/<rid>` (the listener serves its one-segment prefix itself; public_prefix.py shape)
const RID_RE = /^\/(?:t|[a-z0-9][a-z0-9_-]{1,31})\/r\/([0-9a-f]{32})\/?$/;
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

/** TKRFQVP (contract 15.1): `#q.<token>` is an RFQ link (`.` is not a base64url character, so it is never a ticket token). */
export function rfqFragment(hash: string, mark = 'q.'): string | null {
  const f = hash.startsWith('#') ? hash.slice(1) : hash;
  return f.startsWith(mark) && TOKEN_RE.test(f.slice(2)) ? f.slice(2) : null;
}

export type Mode = 'rfq' | 'ticket' | 'consent';

/**
 * TKRFQVP: which link the tab opens. A fragment wins and decides the mode (`#q.<token>` = RFQ, `#<token>` = ticket), then an e-mail
 * redeem path (its answer names the kind), then the token this tab kept - the RFQ one first (each fragment entry clears the other
 * kind's kept token, so only one is ever kept).
 */
export function pickMode(hash: string, path: string, storedTicket: string | null, storedRfq: string | null): { mode: Mode; token: string | null; rid: string | null; fromFragment: boolean } {
  const q = rfqFragment(hash);
  if (q) return { mode: 'rfq', token: q, rid: null, fromFragment: true };
  // WA-CONSENT-LINK: `#c.<token>` is a WhatsApp consent link (single use; never kept in this tab's storage)
  const c = rfqFragment(hash, 'c.');
  if (c) return { mode: 'consent', token: c, rid: null, fromFragment: true };
  const boot = bootFrom(hash, path, storedTicket);
  if (boot.fromFragment || boot.rid) return { mode: 'ticket', ...boot };
  if (storedRfq && TOKEN_RE.test(storedRfq)) return { mode: 'rfq', token: storedRfq, rid: null, fromFragment: false };
  return { mode: 'ticket', ...boot };
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
  /** CR-038 18A: the note is a question for the manager (sent as its own call, never with the status) */
  ask?: boolean;
  /** undefined = untouched; null = clear the ETA; a UTC ISO instant */
  eta: string | null | undefined;
  /** one request id per part, created once and kept until the server confirmed that part */
  crids: { status?: string; note?: string; eta?: string };
}

export const EMPTY_DRAFT: Draft = { status: null, note: '', eta: undefined, crids: {} };

export type Step =
  | { kind: 'status'; status: string; note: string | null; crid: string }
  | { kind: 'note'; text: string; crid: string; ask?: boolean }
  | { kind: 'eta'; eta: string | null; crid: string };

/** The calls one press of "send" makes, in order: the status (it carries the note when there is one), else the note alone,
 * then the ETA. A part's request id is created the first time it is planned and reused on every retry. */
export function planSend(draft: Draft, view: Pick<TicketView, 'status' | 'eta_at'>, newId: () => string): { steps: Step[]; draft: Draft } {
  const crids = { ...draft.crids };
  const steps: Step[] = [];
  const note = draft.note.trim();
  const moves = !!draft.status && draft.status !== view.status;
  if (moves && draft.status) {
    crids.status = crids.status ?? newId();
    steps.push({ kind: 'status', status: draft.status, note: draft.ask ? null : note || null, crid: crids.status });
  }
  if (note && (draft.ask || !moves)) {
    crids.note = crids.note ?? newId();
    steps.push(draft.ask ? { kind: 'note', text: note, crid: crids.note, ask: true } : { kind: 'note', text: note, crid: crids.note });
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
    return { ...draft, note: '', ask: undefined, crids };
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
      ...(v.ask === true ? { ask: true } : {}),
      eta: v.eta === null || typeof v.eta === 'string' ? v.eta : undefined,
      crids: { status: crid(c.status), note: crid(c.note), eta: crid(c.eta) },
    };
  } catch {
    return { ...EMPTY_DRAFT, crids: {} };
  }
}

/** 2.5.6: "waiting for a part" is a sub-state of "in progress" (the stored status stays `waiting_part`), never a step of its own. */
export function lineOf(status: string | null | undefined): string | null {
  return status === 'waiting_part' ? 'in_progress' : status ?? null;
}

/** The statuses the page offers (the steps; the part wait is a toggle under "in progress"): the moves the server allows now, plus the current step (shown selected). */
export function statusChoices(view: Pick<TicketView, 'status' | 'actions'>): string[] {
  const order = ['acknowledged', 'in_progress', 'done'];
  const allowed = new Set(view.actions?.statuses ?? []);
  const line = lineOf(view.status);
  if (line && order.includes(line)) allowed.add(line);
  return order.filter((s) => allowed.has(s));
}

/**
 * The toggle under "in progress": `on` = the ticket is (or will be, per the draft) waiting for a part; `next` = the draft status a tap sets
 * (null = back to the stored status, so nothing is sent). null when the in-progress step is not the one shown or the server does not allow the move.
 */
export function partToggle(view: Pick<TicketView, 'status' | 'actions'>, draftStatus: string | null): { on: boolean; next: string | null } | null {
  const cur = view.status;
  if (!cur) return null;
  const eff = draftStatus ?? cur;
  if (lineOf(eff) !== 'in_progress') return null;
  const on = eff === 'waiting_part';
  const target = on ? 'in_progress' : 'waiting_part';
  if (target !== cur && !(view.actions?.statuses ?? []).includes(target)) return null;
  return { on, next: target === cur ? null : target };
}

// ---------------------------------------------------------------- TKUI5: one component, the layout chosen by the link's kind

export type LinkKind = 'vendor' | 'staff';

/**
 * The page is ONE component; the contact kind decides the layout. TKFIX260: the server says it - handler_actions.view() sends an explicit
 * `kind` ('vendor' | 'staff', TKUI3) after the code gate, and that wins. The fallback is for a view WITHOUT it (the code screen, where the
 * kind is deliberately not sent, or an older server): the `claim` key - GET /t/api/ticket sets it (a block or null) on every vendor link
 * and never on a staff link (TKSTAFF1 R2, public_routes.py). A view without content is treated as vendor: nothing of the layout shows.
 */
export function linkKind(view: Pick<TicketView, 'title' | 'claim' | 'claim_mode' | 'kind'>): LinkKind {
  if (view.claim_mode) return 'vendor';
  if (view.kind === 'vendor' || view.kind === 'staff') return view.kind;
  if (view.title === undefined) return 'vendor';
  return 'claim' in view ? 'vendor' : 'staff';
}

export type Tone = 'acc' | 'ok' | 'warn' | 'bad' | 'mut';
export interface StatusLine { tone: Tone; icon: string; key: string }

/**
 * The ONE status line of the first screen, in the vendor's words (never the manager's): derived from the ticket's status, the cost
 * claim (after "done") and the state of the quote (before the work; null until the quote card has answered, and always null for staff).
 */
export function statusLine(view: Pick<TicketView, 'status' | 'claim' | 'read_only' | 'claim_mode'>, quote: string | null): StatusLine {
  const st = view.status ?? '';
  const claim = view.claim?.status ?? null;
  if (view.claim_mode) return { tone: 'acc', icon: 'coin', key: 'line_demand_ask' };
  if (view.read_only || st === 'closed' || st === 'cancelled') return { tone: 'mut', icon: 'lock', key: 'line_closed' };
  if (claim === 'paid') return { tone: 'ok', icon: 'check', key: 'line_paid' };
  if (claim === 'approved') return { tone: 'ok', icon: 'check', key: 'line_demand_ok' };
  if (claim === 'submitted') return { tone: 'acc', icon: 'clock', key: 'line_demand_wait' };
  if (claim === 'rejected') return { tone: 'bad', icon: 'alert', key: 'line_demand_fix' };
  if (claim === 'awaiting' && view.claim?.writable) return { tone: 'warn', icon: 'coin', key: 'line_demand_ask' };
  if (st === 'done') return { tone: 'ok', icon: 'check', key: 'line_done' };
  if (st === 'new' || st === 'assigned') return { tone: 'acc', icon: 'check', key: 'line_ack' };
  if (st === 'waiting_part') return { tone: 'warn', icon: 'box', key: 'line_part' };
  if (st === 'in_progress') return { tone: 'acc', icon: 'wrench', key: 'line_working' };
  if (st === 'acknowledged') {
    if (quote === 'rejected') return { tone: 'bad', icon: 'alert', key: 'line_quote_fix' };
    if (quote === 'submitted') return { tone: 'acc', icon: 'clock', key: 'line_quote_wait' };
    if (quote === 'approved') return { tone: 'ok', icon: 'check', key: 'line_quote_ok' };
    return { tone: 'acc', icon: 'check', key: 'line_received' };
  }
  return { tone: 'mut', icon: 'info', key: 'line_working' };
}

export type PrimaryKind = 'ack' | 'quote_fix' | 'demand' | 'send' | 'none';

/**
 * The ONE big button of the first screen. A draft the vendor started always wins (it is "send the update"); then the next thing the
 * state asks for: confirm receipt, correct a quote the organisation sent back, send the payment request; else "send the update".
 * Nothing at all on a page that cannot be written (closed, claim mode: the claim step has its own button).
 */
export function primaryAction(view: Pick<TicketView, 'status' | 'actions' | 'claim' | 'read_only' | 'claim_mode'>, kind: LinkKind, hasDraft: boolean, quote: string | null): PrimaryKind {
  if (view.read_only || view.claim_mode || !view.actions) return 'none';
  if (hasDraft) return 'send';
  if ((view.status === 'new' || view.status === 'assigned') && view.actions.statuses.includes('acknowledged')) return 'ack';
  if (kind === 'vendor') {
    if (quote === 'rejected' && view.status !== 'done') return 'quote_fix';
    const c = view.claim;
    if (c && (c.status === 'awaiting' || c.status === 'rejected') && c.writable) return 'demand';
  }
  return 'send';
}
