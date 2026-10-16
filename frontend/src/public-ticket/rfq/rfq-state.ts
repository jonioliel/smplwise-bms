/**
 * TKRFQVP (release 2.6.0, contract section 15): the request-for-quotation mode of the public page - its decisions as pure functions
 * (tests/unit-public-rfq.spec.ts runs them in node, no DOM): the `#q.<token>` fragment, the screen an answer leads to, what a refusal
 * means, and the quote's wire body. The server computes every amount (money.py) and refuses client totals (`extra = forbid`): the body
 * carries the vendor's inputs only - decimal strings, never a figure the page computed.
 */
import type { ApiFailure, RfqKind, RfqPageState, RfqQuote, RfqView } from '../api';
import { instantOf, parseIso, zonedParts } from '../time';
import { type ClaimForm, type ClaimFormSettings, type FieldError, type LineDraft, type LineKind, DEFAULT_LIMITS, LINE_KINDS, buildPayload, cleanText, minorToInput, newForm,
  newLine, validateForm } from '../claim/claim-model';

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

// ---------------------------------------------------------------- the screen (the link itself: state.ts rfqFragment / pickMode - the entry chunk)

export type RfqScreen = 'code' | RfqPageState;

/** The screen of an answer: the code gate first (the minimal card carries nothing else), else the vendor's own page state. */
export function rfqScreen(v: Pick<RfqView, 'code_required' | 'code_ok' | 'page_state'>): RfqScreen {
  if (v.code_required && !v.code_ok) return 'code';
  return v.page_state ?? 'open';
}

/** Whether the screen still takes a quote (open, or "not interested" - he may change his mind until the deadline) - the server's `can` decides the buttons. */
export function quoting(screen: RfqScreen): boolean {
  return screen === 'open' || screen === 'declined';
}

export interface RfqNext {
  /** a message key of rfq-text.ts (or strings.ts for the code keys), shown in the banner */
  message: string | null;
  n?: number;
  /** load the request again (its state changed under us) */
  reload: boolean;
  /** the link is dead: forget the token, show the uniform "unavailable" screen */
  unavailable: boolean;
  /** the code gate */
  code: boolean;
  /** the outcome is unknown (no reception, a busy server): keep the request id, a retry is the SAME request */
  keepCrid: boolean;
  fields?: { field: string; code: string }[];
}

/** What a refused write (or read) means on the RFQ page. A 404 is always the uniform "unavailable"; a 429 never is. */
export function rfqFailure(e: ApiFailure): RfqNext {
  const base: RfqNext = { message: null, reload: false, unavailable: false, code: false, keepCrid: false };
  const say = (message: string, reload = false, extra: Partial<RfqNext> = {}): RfqNext => ({ ...base, message, reload, ...extra });
  if (e.offline) return say('r_offline', false, { keepCrid: true });
  if (e.status === 404) return { ...base, unavailable: true };
  if (e.status === 429) {
    if (e.code === 'code_locked') return say('codeLocked', false, { n: Math.max(1, Math.ceil((e.retryAfter || 60) / 60)) });
    return say('r_e_rate', false, { keepCrid: true, n: Math.max(1, Math.ceil((e.retryAfter || 60) / 60)) });
  }
  if (e.status === 403 && e.code === 'code_required') return { ...base, code: true, reload: true };
  if (e.status === 409) {
    switch (e.code) {
      case 'read_only':
        return say('r_e_read_only', true);
      case 'quote_changed':
        return say('r_e_quote_changed', true);
      case 'rfq_due_passed':
        return say('r_e_due_passed', true);
      case 'quote_closed':
        return say('r_e_quote_closed', true);
      case 'quote_exists':
        return say('r_e_quote_exists', true);
      case 'message_limit':
        return say('r_e_message_limit', true);
      case 'award_pending':
        return say('r_e_award_pending', true);
      case 'request_in_progress':
        return say('r_e_rate', false, { keepCrid: true, n: 1 });
      default:
        return say('r_e_generic', true);
    }
  }
  if (e.status === 422) {
    const fields = e.fields ?? [];
    return say(invalidKey(e.code, fields), false, { fields });
  }
  if (e.status === 0 || e.status >= 500) return say('r_e_generic', false, { keepCrid: true });
  return say('r_e_generic');
}

/** The words of a 422: the first field's problem the page can name, else a generic "check the form". */
export function invalidKey(code: string, fields: readonly { field: string; code: string }[]): string {
  const f = fields[0];
  if (code === 'kind_not_allowed' || fields.some((x) => x.code === 'kind_not_allowed')) return 'r_e_kind_not_allowed';
  if (f?.field === 'valid_until') return 'r_e_valid_until';
  if (f && (f.field === 'work_from' || f.field === 'work_to')) return 'r_e_dates';
  if (f?.code === 'claim_too_large' || f?.code === 'too_large' || f?.field === 'total') return 'r_e_too_large';
  return 'r_e_invalid';
}

// ---------------------------------------------------------------- the building's days

/** `YYYY-MM-DD` of an instant in the building's zone ('' for none). */
export function isoToDay(iso: string | null | undefined, zone: string): string {
  const t = parseIso(iso);
  if (t === null) return '';
  const p = zonedParts(t, zone);
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

/** The start of a day in the building's zone as a UTC instant (the manager's quote dialog sends work dates the same way). */
export function dayStartIso(day: string, zone: string): string | null {
  const m = DAY_RE.exec(day);
  if (!m) return null;
  return new Date(instantOf(+m[1], +m[2], +m[3], 0, 0, zone)).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** 15.4: `valid_until` = the END of the chosen day in the installation's zone (23:59:59 there), as an instant. */
export function dayEndIso(day: string, zone: string): string | null {
  const m = DAY_RE.exec(day);
  if (!m) return null;
  return new Date(instantOf(+m[1], +m[2], +m[3], 23, 59, zone) + 59_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Whether the vendor's work dates leave the wanted window (a gentle warning only - the server computes `in_window`). */
export function outsideWindow(from: string, to: string, wantFrom: string | null | undefined, wantTo: string | null | undefined, zone: string): boolean {
  const wf = isoToDay(wantFrom, zone);
  const wt = isoToDay(wantTo, zone);
  if (!wf && !wt) return false;
  for (const d of [from, to]) {
    if (!d) continue;
    if (wf && d < wf) return true;
    if (wt && d > wt) return true;
  }
  return false;
}

/** The time left until the deadline (null once it passed). */
export function timeLeft(due: string | null | undefined, nowMs: number): { d: number; h: number; m: number } | null {
  const t = parseIso(due);
  if (t === null || t <= nowMs) return null;
  const mins = Math.floor((t - nowMs) / 60_000);
  return { d: Math.floor(mins / 1440), h: Math.floor((mins % 1440) / 60), m: mins % 60 };
}

// ---------------------------------------------------------------- the quote form

export interface RfqDraft {
  form: ClaimForm;
  /** `YYYY-MM-DD` in the building's zone, '' = not given */
  workFrom: string;
  workTo: string;
  validUntil: string;
  /** RFQQUESTIONS: a question sent with the quote (its own field - never mixed into the quote's notes) */
  question?: string;
}

/** The kinds the form offers: the server's list, in the fixed order (labour is always allowed on a request). */
export function rfqKinds(v: Pick<RfqView, 'form' | 'rfq'>): LineKind[] {
  const allowed: readonly string[] = v.form?.allowed_kinds ?? v.rfq?.allowed_line_kinds ?? ['labor'];
  const kinds = LINE_KINDS.filter((k) => allowed.includes(k));
  return kinds.length ? kinds : ['labor'];
}

/** The claim form's settings from the RFQ form block (the shared editor and its checks read these). */
export function rfqSettings(v: Pick<RfqView, 'form'>): ClaimFormSettings | null {
  const f = v.form;
  if (!f) return null;
  return {
    currencies: f.currencies.length ? f.currencies : ['ILS'],
    vat: f.vat,
    labor_rate_minor: f.labor_rate_minor,
    require_invoice: false,
    limits: { ...DEFAULT_LIMITS, lines: f.limits.lines, description: f.limits.description, notes: f.limits.note, vendor_ref: f.limits.vendor_ref,
      max_total_minor: f.limits.max_total_minor > 0 ? f.limits.max_total_minor : DEFAULT_LIMITS.max_total_minor },
  };
}

/** A fresh form: the first currency, the vendor's VAT default, one line of the first allowed kind (his hourly rate prefilled). */
export function freshDraft(v: Pick<RfqView, 'form' | 'rfq'>): RfqDraft {
  const s = rfqSettings(v);
  const form = newForm(s, s?.currencies[0]);
  const kinds = rfqKinds(v);
  form.lines = [newLine(kinds[0], s)];
  return { form, workFrom: '', workTo: '', validUntil: '' };
}

/** "Edit": the form starts from the quote he sent (his inputs, not the server's figures). */
export function draftFromQuote(q: RfqQuote, v: Pick<RfqView, 'form' | 'rfq' | 'time_zone'>): RfqDraft {
  const s = rfqSettings(v);
  const kinds = rfqKinds(v);
  const lines: LineDraft[] = [];
  for (const ln of q.lines) {
    if (!kinds.includes(ln.kind)) continue;
    const d = newLine(ln.kind, null);
    d.description = ln.description ?? '';
    if (ln.kind === 'labor') {
      d.hours = ln.hours ?? '';
      d.rate = minorToInput(ln.rate_minor);
    } else if (ln.kind === 'parts') {
      d.quantity = ln.quantity ?? '1';
      d.unit_price = minorToInput(ln.unit_minor);
    } else {
      d.amount = minorToInput(ln.amount_minor);
    }
    lines.push(d);
  }
  const form = newForm(s, q.currency);
  form.lines = lines.length ? lines : form.lines;
  form.include_vat = s?.vat.exempt ? false : q.vat_mode === 'included';
  form.notes = q.note ?? '';
  form.vendor_ref = q.vendor_ref ?? '';
  return { form, workFrom: isoToDay(q.work_from, v.time_zone), workTo: isoToDay(q.work_to, v.time_zone), validUntil: isoToDay(q.valid_until, v.time_zone) };
}

/** 15.4 `base_version`: the version of his current LIVE quote, null when he has none (never quoted, or withdrawn). */
export function baseVersion(q: RfqQuote | null | undefined): number | null {
  return q && q.state !== 'withdrawn' ? q.version : null;
}

/** Every problem the page can see before sending (the server checks again): the shared line checks, the kinds, the dates. */
export function draftProblems(d: RfqDraft, v: Pick<RfqView, 'form' | 'rfq' | 'time_zone'>, nowMs: number): FieldError[] {
  const out = validateForm(d.form, { settings: rfqSettings(v), docs: { docs: [] } });
  const kinds = rfqKinds(v);
  d.form.lines.forEach((l, i) => {
    if (!kinds.includes(l.kind)) out.push({ field: `lines.${i}.kind`, code: 'kind_not_allowed' });
  });
  if (d.workFrom && d.workTo && d.workTo < d.workFrom) out.push({ field: 'work_to', code: 'before_start' });
  if (d.validUntil) {
    const end = dayEndIso(d.validUntil, v.time_zone);
    const t = end ? Date.parse(end) : NaN;
    if (!Number.isFinite(t) || t <= nowMs || t > nowMs + 366 * 86_400_000) out.push({ field: 'valid_until', code: 'range' });
  }
  return out;
}

/**
 * 15.4: the body of `POST /t/api/rfq/quote` - the ticket quote's line (kind, description?, hours + rate | quantity + unit_price |
 * amount, decimal strings), currency only when the form offers more than one, the VAT choice unless exempt, the work dates (the start
 * of the day in the building's zone), `valid_until` (the end of the day there), note, vendor_ref, `base_version` and the request id.
 * NEVER a total, a VAT amount or a line total.
 */
export function quoteWire(d: RfqDraft, v: Pick<RfqView, 'form' | 'quote' | 'time_zone'>, crid: string): Record<string, unknown> {
  const s = rfqSettings(v);
  const p = buildPayload({ ...d.form, no_charge: false }, { docs: [] }, s, crid) as unknown as Record<string, unknown>;
  const body: Record<string, unknown> = { lines: p.lines };
  if ((s?.currencies.length ?? 1) > 1) body.currency = d.form.currency;
  if (!s?.vat.exempt) body.amounts_include_vat = d.form.include_vat;
  const wf = d.workFrom ? dayStartIso(d.workFrom, v.time_zone) : null;
  const wt = d.workTo ? dayStartIso(d.workTo, v.time_zone) : null;
  const vu = d.validUntil ? dayEndIso(d.validUntil, v.time_zone) : null;
  if (wf) body.work_from = wf;
  if (wt) body.work_to = wt;
  if (vu) body.valid_until = vu;
  const note = cleanText(d.form.notes, true);
  if (note) body.note = note;
  const ref = cleanText(d.form.vendor_ref);
  if (ref) body.vendor_ref = ref;
  const question = cleanText(d.question ?? '', true);
  if (question) body.question = question;
  body.base_version = baseVersion(v.quote);
  body.client_request_id = crid;
  return body;
}

/** One request id per CONTENT: kept while the outcome of that content is unknown (a retry is the same request), new when the content changed. */
export function cridFor(pending: { crid: string; sig: string } | null, sig: string, newId: () => string): { crid: string; sig: string } {
  return pending && pending.sig === sig ? pending : { crid: newId(), sig };
}

/** The signature of a write's content (the body without its request id). */
export function bodySig(body: Record<string, unknown>): string {
  const { client_request_id: _c, ...rest } = body;
  return JSON.stringify(rest);
}

/** A draft as kept in this tab (sessionStorage); a tampered value is no draft. */
export function parseRfqDraft(raw: string | null): RfqDraft | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<RfqDraft>;
    const f = v.form as Partial<ClaimForm> | undefined;
    if (!f || !Array.isArray(f.lines)) return null;
    const str = (x: unknown, max = 4000) => (typeof x === 'string' ? x.slice(0, max) : '');
    const day = (x: unknown) => (typeof x === 'string' && DAY_RE.test(x) ? x : '');    const lines: LineDraft[] = f.lines.slice(0, 100).filter((l): l is LineDraft => !!l && typeof l === 'object' && (LINE_KINDS as readonly string[]).includes((l as LineDraft).kind))
      .map((l) => ({ key: str(l.key, 40) || `l${Math.random().toString(36).slice(2)}`, kind: l.kind, description: str(l.description, 400), hours: str(l.hours, 20), rate: str(l.rate, 20),
        quantity: str(l.quantity, 20), unit_price: str(l.unit_price, 20), amount: str(l.amount, 20) }));
    return {
      form: { lines, currency: str(f.currency, 3) || 'ILS', include_vat: f.include_vat === true, no_charge: false, vendor_ref: str(f.vendor_ref, 200), notes: str(f.notes) },
      workFrom: day(v.workFrom), workTo: day(v.workTo), validUntil: day(v.validUntil), question: str(v.question, 2000),
    };
  } catch {
    return null;
  }
}

/** The kinds as the request card lists them. */
export function kindList(kinds: readonly RfqKind[] | undefined): LineKind[] {
  return LINE_KINDS.filter((k) => (kinds ?? []).includes(k));
}
