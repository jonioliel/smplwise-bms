/**
 * TKRFQ2: the pure logic of the RFQ manager screens (no DOM, no fetch) - read by the screens and by tests/unit-tickets-rfq.spec.ts.
 * Rules mirrored from services/tickets/rfq.py (contract v0.9): the list filters, the vendor buckets of a request, the deadline and window
 * checks of a draft, who may be invited, the comparison grouped by currency (lowest only inside the majority currency, NEVER a sum across
 * currencies), the award body and its preview figures (the server recomputes them), the split plan (finalize on the last award only),
 * the second-approval hint (the server decides), and the invitation preview built from the starter template `rfq_invite`.
 */
import type { LineKind, VatMode } from '../api/tickets-costs';
import type { Contact } from '../api/tickets-s4';
import type {
  RfqAward, RfqAwardBody, RfqChannel, RfqCompareQuote, RfqDetail, RfqEvent, RfqFilter, RfqKpis, RfqOrderBody, RfqScope, RfqState, RfqSummary, RfqVendor,
  RfqVendorState,
} from '../api/tickets-rfq';
import { vatOf } from './cost-model';

export type Tone = 'ok' | 'info' | 'warn' | 'bad' | '';

export const TITLE_MAX = 120;
export const DESCRIPTION_MAX = 4000;
export const PLACE_MAX = 200;
export const MESSAGE_MAX = 2000;
export const KIND_ORDER: readonly LineKind[] = ['labor', 'parts', 'travel', 'other'];

// ---------------------------------------------------------------- states

const STATE_TONE: Record<RfqState, Tone> = {
  draft: '', sent: 'info', collecting: 'info', due_passed: 'warn', awarded: 'ok', ordered: 'ok', closed: '', cancelled: 'bad',
};
export function rfqStateTone(s: RfqState): Tone {
  return STATE_TONE[s] ?? '';
}

const VENDOR_TONE: Record<RfqVendorState, Tone> = {
  draft: '', sent: '', opened: 'info', quoted: 'ok', declined: 'bad', expired: 'warn', withdrawn: 'warn', awarded: 'ok', not_awarded: '', removed: '',
};
export function vendorStateTone(s: RfqVendorState): Tone {
  return VENDOR_TONE[s] ?? '';
}

/** The server's list filters (rfq.LIST_FILTERS): "open" is everything not closed or cancelled. */
export function inFilter(state: RfqState, f: RfqFilter): boolean {
  if (f === 'all') return true;
  if (f === 'open') return state !== 'closed' && state !== 'cancelled';
  if (f === 'collecting') return state === 'collecting' || state === 'sent'; // one chip for "out, waiting for quotes"
  return state === f;
}

/** The chips of the state strip with their counts, read from one `state=all` page. */
export function stripCounts(items: readonly Pick<RfqSummary, 'state'>[], filters: readonly RfqFilter[]): { id: RfqFilter; count: number }[] {
  return filters.map((id) => ({ id, count: items.filter((i) => inFilter(i.state, id)).length }));
}

/** The text filter of the list: the title, the number ("7", "RFQ-07", "#7") or the department. */
export function matchesQuery(item: Pick<RfqSummary, 'title' | 'number' | 'ref' | 'department'>, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const n = /^(?:rfq-?|#)?0*(\d+)$/.exec(s);
  if (n) return item.number === Number(n[1]);
  return item.title.toLowerCase().includes(s) || item.ref.toLowerCase().includes(s) || item.department.name.toLowerCase().includes(s);
}

export interface ListTiles { open: number; collecting: number; decide: number; quotes: number; noReply: number }

/** The KPI tiles above the list: open requests, out waiting for quotes, waiting for a decision (deadline passed or quotes in), quotes
 * received and vendors without a reply - over the open requests only. */
export function listTiles(items: readonly Pick<RfqSummary, 'state' | 'kpis'>[]): ListTiles {
  const open = items.filter((i) => inFilter(i.state, 'open'));
  return {
    open: open.length,
    collecting: open.filter((i) => i.state === 'sent' || i.state === 'collecting').length,
    decide: open.filter((i) => i.state === 'due_passed' || ((i.state === 'collecting' || i.state === 'sent') && i.kpis.quoted > 0)).length,
    quotes: open.reduce((s, i) => s + i.kpis.quoted, 0),
    noReply: open.reduce((s, i) => s + i.kpis.no_response, 0),
  };
}

export type VendorBucket = 'invited' | 'opened' | 'quoted' | 'declined' | 'no_reply';
export const VENDOR_BUCKETS: readonly VendorBucket[] = ['invited', 'opened', 'quoted', 'declined', 'no_reply'];

/** The vendor status of one request (the list's mini strip and the board's tiles), from the server's KPIs. */
export function vendorBuckets(k: RfqKpis): Record<VendorBucket, number> {
  return { invited: k.invited, opened: k.opened, quoted: k.quoted, declined: k.declined, no_reply: k.no_response };
}

/** The segments of the stacked status bar of a request (quoted / declined / opened without a quote / no reply), in that order, each a
 * share of the invited vendors; empty segments are left out. */
export function statusBar(k: RfqKpis): { key: 'quoted' | 'declined' | 'opened' | 'no_reply'; n: number; pct: number }[] {
  const total = Math.max(k.invited, 1);
  const openedOnly = Math.max(0, k.opened - k.quoted - k.declined);
  const noReply = Math.max(0, k.invited - k.quoted - k.declined - openedOnly);
  const parts = [
    { key: 'quoted' as const, n: k.quoted },
    { key: 'declined' as const, n: k.declined },
    { key: 'opened' as const, n: openedOnly },
    { key: 'no_reply' as const, n: noReply },
  ];
  return parts.filter((p) => p.n > 0).map((p) => ({ ...p, pct: Math.round((p.n / total) * 1000) / 10 }));
}

// ---------------------------------------------------------------- dates

const pad = (n: number) => String(n).padStart(2, '0');

/** A local date and time from the form into a UTC instant ("2026-10-16" + "12:00" -> ISO); '' when either is invalid. */
export function localToIso(date: string, time = '00:00'): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return '';
  const d = new Date(`${date}T${time}:00`);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().replace(/\.\d+Z$/, 'Z');
}

/** A UTC instant into the form's local date and time. */
export function isoToLocal(iso: string | null | undefined): { date: string; time: string } {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return { date: '', time: '' };
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

/** The default deadline of a new request: `days` from today at 12:00 local (the installation's default_due_days, 1-60). */
export function defaultDue(now: Date, days: number): { date: string; time: string } {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + Math.min(60, Math.max(1, Math.round(days) || 3)), 12, 0);
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: '12:00' };
}

/** A short date ("16.10") and a date with time ("16.10 · 12:00") for the screens and the preview. */
export function shortDate(iso: string | null | undefined): string {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
}
export function dateTime(iso: string | null | undefined): string {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "18.10 - 28.10", one side when the other is missing, '' when neither. */
export function windowText(from: string | null | undefined, to: string | null | undefined): string {
  const a = shortDate(from);
  const b = shortDate(to);
  if (a && b) return a === b ? a : `${a} - ${b}`;
  return a || b;
}

export function duePassed(due: string | null | undefined, now: Date): boolean {
  const t = due ? Date.parse(due) : NaN;
  return !Number.isNaN(t) && t <= now.getTime();
}

// ---------------------------------------------------------------- the draft (the new-request sheet)

export interface RfqDraft {
  department_id: string;
  title: string;
  description: string;
  place_text: string;
  due_date: string;
  due_time: string;
  work_from: string;
  work_to: string;
  kinds: LineKind[];
  vendors: { contact_id: string; channel: RfqChannel; require_code: boolean }[];
  source_ticket_id: string;
}

export type DraftField = 'title' | 'description' | 'department' | 'due' | 'window' | 'vendors' | 'place';

/** The problems of a draft, per field; `forSend` also needs a vendor. The server checks again (and the deadline in its zone). */
export function draftProblems(d: RfqDraft, now: Date, forSend: boolean): Partial<Record<DraftField, true>> {
  const out: Partial<Record<DraftField, true>> = {};
  const title = d.title.trim();
  if (!title || [...title].length > TITLE_MAX) out.title = true;
  if ([...d.description].length > DESCRIPTION_MAX) out.description = true;
  if ([...d.place_text].length > PLACE_MAX) out.place = true;
  if (!d.department_id) out.department = true;
  const due = localToIso(d.due_date, d.due_time || '12:00');
  if (!due || Date.parse(due) <= now.getTime()) out.due = true;
  if (d.work_from && d.work_to && d.work_to < d.work_from) out.window = true;
  if (forSend && !d.vendors.length) out.vendors = true;
  return out;
}

/** Labour is always allowed (contract section 2); the order is the server's. */
export function normalizeKinds(kinds: readonly LineKind[]): LineKind[] {
  const set = new Set<LineKind>(['labor', ...kinds]);
  return KIND_ORDER.filter((k) => set.has(k));
}

export function toggleKind(kinds: readonly LineKind[], k: LineKind): LineKind[] {
  if (k === 'labor') return normalizeKinds(kinds);
  return normalizeKinds(kinds.includes(k) ? kinds.filter((x) => x !== k) : [...kinds, k]);
}

/** A date of the work window as the server stores it (the local day's start, UTC). */
export function dayToIso(day: string): string {
  return day ? localToIso(day, '00:00') : '';
}

/**
 * Who may be invited (contract section 3): an active, not erased vendor, or a person that works for a vendor / a free-lance person -
 * never a contact that names an internal user and never an employee; a contact limited to OTHER departments only is refused.
 */
export function invitable(c: Pick<Contact, 'kind' | 'active' | 'erased' | 'user_linked' | 'departments'>, departmentId: string): boolean {
  if (!c.active || c.erased || c.user_linked) return false;
  if (c.kind !== 'vendor' && c.kind !== 'person') return false;
  return !c.departments.length || !departmentId || c.departments.includes(departmentId);
}

/** The planned channel of a contact (its preferred channel, `manual` when it has neither a phone nor an e-mail for it). */
export function plannedChannel(c: Pick<Contact, 'preferred_channel' | 'has_phone' | 'email'>): RfqChannel {
  const p = c.preferred_channel as string;
  if (p === 'manual') return 'manual';
  if (p === 'email' && c.email) return 'email';
  if (c.has_phone) return 'whatsapp';
  return c.email ? 'email' : 'manual';
}

/** Initials for the avatar of a vendor row ("מיזוג אלון" -> "מא"). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = [...parts[0]][0] ?? '';
  const second = parts.length > 1 ? [...parts[parts.length - 1]][0] ?? '' : [...parts[0]][1] ?? '';
  return `${first}${second}`;
}

export interface PreviewParts { name: string; number: string; title: string; place: string; due: string; window: string; link: string; organization: string }

/**
 * The invitation as the vendor will read it: the Hebrew / English starter template `rfq_invite` of services/tickets/message_templates.py
 * filled with the draft's values (C2 gap: the server has no preview route for an RFQ yet; an installation that edited its template sees
 * the starter here). Empty lines (no place, no organization) are dropped like the server's renderer does.
 */
export function invitePreview(p: PreviewParts, lang: 'he' | 'en' = 'he'): string {
  const he = `שלום ${p.name},\nבקשה להצעת מחיר מס' ${p.number}: ${p.title}\n${p.place}\nמועד אחרון להצעה: ${p.due}\nחלון עבודה רצוי: ${p.window}\nפרטים וטופס ההצעה: ${p.link}\nאפשר גם לסמן בקישור שאינכם מעוניינים.\n${p.organization}`;
  const en = `Hello ${p.name},\nRequest for quotation no. ${p.number}: ${p.title}\n${p.place}\nQuote deadline: ${p.due}\nWanted work window: ${p.window}\nDetails and the quote form: ${p.link}\nYou can also mark in the link that you are not interested.\n${p.organization}`;
  return (lang === 'en' ? en : he).split('\n').filter((l) => l.trim()).join('\n');
}

// ---------------------------------------------------------------- the vendors board

/** Vendors a reminder goes to (the server's rule for "everyone": sent / opened, never a manual channel). */
export function remindable(vendors: readonly RfqVendor[]): RfqVendor[] {
  return vendors.filter((v) => v.can.remind);
}

/** The vendors shown on the board (a removed vendor stays out of the table; its rows remain in the timeline). */
export function boardVendors(vendors: readonly RfqVendor[]): RfqVendor[] {
  const order: Record<RfqVendorState, number> = { awarded: 0, quoted: 1, opened: 2, sent: 3, draft: 4, withdrawn: 5, expired: 6, declined: 7, not_awarded: 8, removed: 9 };
  return vendors.filter((v) => v.state !== 'removed').sort((a, b) => order[a.state] - order[b.state]);
}

/** The live quotes of a request (the comparison button's count). */
export function liveQuotes(d: Pick<RfqDetail, 'vendors'>): number {
  return d.vendors.filter((v) => v.quote && (v.quote.state === 'submitted' || v.quote.state === 'approved' || v.quote.state === 'partially_approved')).length;
}

export interface EventLine { key: string; vars: Record<string, string> }

/** One timeline row as a text key and its variables (the screen renders it with rt()). Unknown kinds read "update". */
export function eventLine(e: RfqEvent, vendorName: (id: string | null) => string, money: (minor: number, currency: string) => string): EventLine {
  const vendor = vendorName(e.vendor_id);
  const actor = e.actor?.name ?? '';
  const total = typeof e.data.total_minor === 'number' ? e.data.total_minor : null;
  const currency = typeof e.data.currency === 'string' ? e.data.currency : '';
  const amount = total !== null && currency ? money(total, currency) : '';
  const vars = { vendor, actor, amount };
  if (e.kind === 'quote_submitted' && amount) return { key: 'ev_quote_submitted_amount', vars };
  if (e.kind === 'awarded' && amount) return { key: 'ev_awarded_amount', vars };
  const known = ['created', 'edited', 'vendor_added', 'vendor_removed', 'sent', 'reminder', 'quote_submitted', 'quote_withdrawn', 'declined', 'link_revoked', 'message',
    'award_pending', 'awarded', 'award_declined', 'due_passed', 'cancelled', 'closed', 'message_sent', 'message_failed', 'message_unknown', 'message_fallback',
    'order_created', 'order_sent'];
  return { key: known.includes(e.kind) ? `ev_${e.kind}` : 'ev_other', vars };
}

// ---------------------------------------------------------------- the comparison

export interface CurrencyGroup { currency: string; ranked: boolean; quotes: RfqCompareQuote[] }

/**
 * The quotes grouped by currency: the comparison's currency first (the only ranked one - lowest / earliest come from the server), then
 * every other currency in the order the quotes arrived. Amounts are never added across groups.
 */
export function currencyGroups(quotes: readonly RfqCompareQuote[], main: string): CurrencyGroup[] {
  const order: string[] = [];
  for (const q of quotes) if (!order.includes(q.currency)) order.push(q.currency);
  order.sort((a, b) => (a === main ? -1 : b === main ? 1 : 0));
  return order.map((currency) => ({ currency, ranked: currency === main, quotes: quotes.filter((q) => q.currency === currency) }));
}

export type CompareSort = 'price' | 'date';
export type CompareFilter = 'all' | 'in_window';

/** The quotes after the filter and the sort of the comparison bar (price: total; date: work_from, undated last). */
export function arrangeQuotes(quotes: readonly RfqCompareQuote[], filter: CompareFilter, sort: CompareSort): RfqCompareQuote[] {
  const list = quotes.filter((q) => filter === 'all' || q.in_window === true);
  const byPrice = (a: RfqCompareQuote, b: RfqCompareQuote) => a.total_minor - b.total_minor;
  const byDate = (a: RfqCompareQuote, b: RfqCompareQuote) => (a.work_from ?? '9999').localeCompare(b.work_from ?? '9999') || byPrice(a, b);
  return [...list].sort(sort === 'price' ? byPrice : byDate);
}

/** The line kinds a quote actually has (the scope chips "עבודה בלבד" / "חלקים בלבד" are offered only for those). */
export function kindsOf(q: Pick<RfqCompareQuote, 'lines'>): LineKind[] {
  return KIND_ORDER.filter((k) => q.lines.some((l) => l.kind === k));
}

export type AwardScope = { mode: 'all' } | { mode: 'kinds'; kinds: LineKind[] } | { mode: 'lines'; indexes: number[] };

/** The line indexes a scope approves. */
export function scopeIndexes(q: Pick<RfqCompareQuote, 'lines'>, s: AwardScope): number[] {
  if (s.mode === 'all') return q.lines.map((l) => l.index);
  if (s.mode === 'kinds') return q.lines.filter((l) => s.kinds.includes(l.kind)).map((l) => l.index);
  const set = new Set(s.indexes);
  return q.lines.filter((l) => set.has(l.index)).map((l) => l.index);
}

/** Whether a scope approves something (an empty kind / line choice cannot be sent). */
export function scopeValid(q: Pick<RfqCompareQuote, 'lines'>, s: AwardScope): boolean {
  return scopeIndexes(q, s).length > 0;
}

/** The award body of contract section 7: the whole quote (neither field), the lines of some kinds, or chosen lines. */
export function awardBody(q: Pick<RfqCompareQuote, 'quote_id' | 'revision' | 'lines'>, s: AwardScope, finalize: boolean): RfqAwardBody {
  const body: RfqAwardBody = { quote_id: q.quote_id, revision: q.revision, finalize };
  const idx = scopeIndexes(q, s);
  if (s.mode === 'kinds' && idx.length < q.lines.length) body.kinds = [...s.kinds];
  else if (s.mode === 'lines' && idx.length < q.lines.length) body.line_indexes = idx;
  return body;
}

/** The figures of an award (DISPLAY ONLY - the server recomputes with money.compute): the approved lines' sum and the quote's VAT. */
export function awardPreview(q: Pick<RfqCompareQuote, 'lines' | 'vat_mode' | 'vat_rate_bp' | 'total_minor' | 'subtotal_minor' | 'vat_minor'>, s: AwardScope): { subtotal: number; vat: number; total: number } {
  const idx = new Set(scopeIndexes(q, s));
  if (idx.size === q.lines.length) return { subtotal: q.subtotal_minor, vat: q.vat_minor, total: q.total_minor };
  const subtotal = q.lines.filter((l) => idx.has(l.index)).reduce((sum, l) => sum + l.total_minor, 0);
  const v = vatOf(subtotal, q.vat_mode as VatMode, q.vat_rate_bp);
  return { subtotal, vat: v.vat, total: v.total };
}

export interface Selection { quote: RfqCompareQuote; scope: AwardScope }

/** The selected amounts per currency (never one sum across currencies), in the order the currencies first appear. */
export function selectionTotals(sel: readonly Selection[]): { currency: string; total: number; count: number }[] {
  const out: { currency: string; total: number; count: number }[] = [];
  for (const s of sel) {
    const t = awardPreview(s.quote, s.scope).total;
    const row = out.find((r) => r.currency === s.quote.currency);
    if (row) {
      row.total += t;
      row.count += 1;
    } else out.push({ currency: s.quote.currency, total: t, count: 1 });
  }
  return out;
}

/** The awards to post for a selection, in order: `finalize` only on the last (a split, contract section 7). */
export function splitPlan(sel: readonly Selection[]): RfqAwardBody[] {
  return sel.map((s, i) => awardBody(s.quote, s.scope, i === sel.length - 1));
}

/**
 * Whether the second-approval hint is shown for a selection: only when the department has a threshold (OFF by default) and an award in
 * the threshold's currency is ABOVE it. The server decides finally (and skips it when no approver above the requester exists).
 */
export function secondApprovalHint(threshold: number | null | undefined, sel: readonly Selection[], currency: string): boolean {
  if (threshold === null || threshold === undefined) return false;
  return sel.some((s) => s.quote.currency === currency && awardPreview(s.quote, s.scope).total > threshold);
}

/** The vendors that quoted and were not selected (the optional "not selected" drafts - never sent by default). */
export function notSelected(quotes: readonly RfqCompareQuote[], sel: readonly Selection[]): RfqCompareQuote[] {
  const picked = new Set(sel.map((s) => s.quote.vendor_id));
  return quotes.filter((q) => !picked.has(q.vendor_id) && q.state === 'submitted');
}

/** A refusal code of the server mapped to the screen's words (`err_<code>`), or null for the server's own message. */
export function refusalKey(code: string | undefined): string | null {
  const known = ['rfq_stale', 'quote_stale', 'rfq_vendor_page_unavailable', 'self_approval', 'second_approver_required', 'award_pending', 'rfq_has_award',
    'vendor_not_allowed', 'vendor_duplicate', 'rfq_no_vendors', 'rfq_due_passed', 'rfq_field_locked', 'rfq_invalid_transition', 'vendor_code_locked',
    // TKRFQ4: the work order
    'order_exists', 'order_not_found', 'order_channel_unavailable', 'order_link_unavailable', 'order_ticket_closed', 'public_link_unavailable'];
  return code && known.includes(code) ? `err_${code}` : null;
}

// ---------------------------------------------------------------- the route

export type RfqView = 'list' | 'board' | 'compare';
export interface RfqRoute { view: RfqView; id: string; state: RfqFilter; dept: string; q: string; creating: boolean; from: string }

const FILTERS: readonly RfqFilter[] = ['open', 'all', 'draft', 'sent', 'collecting', 'due_passed', 'awarded', 'ordered', 'closed', 'cancelled'];

/** `#/tickets/rfqs[?rfq=<id>&view=compare][&state=&dept=&q=][&new=1&from=<ticket id>]` */
export function parseRfqRoute(p: URLSearchParams): RfqRoute {
  const id = (p.get('rfq') ?? '').trim();
  const st = p.get('state') as RfqFilter | null;
  return {
    view: !id ? 'list' : p.get('view') === 'compare' ? 'compare' : 'board',
    id: /^[\w-]{1,64}$/.test(id) ? id : '',
    state: st && FILTERS.includes(st) ? st : 'open',
    dept: p.get('dept') ?? '',
    q: p.get('q') ?? '',
    creating: p.get('new') === '1',
    from: /^[0-9a-f]{16}$/.test(p.get('from') ?? '') ? (p.get('from') as string) : '',
  };
}

export function rfqHref(r: Partial<RfqRoute>): string {
  const p = new URLSearchParams();
  if (r.id) {
    p.set('rfq', r.id);
    if (r.view === 'compare') p.set('view', 'compare');
  } else {
    if (r.state && r.state !== 'open') p.set('state', r.state);
    if (r.dept) p.set('dept', r.dept);
    if (r.q?.trim()) p.set('q', r.q.trim());
  }
  if (r.creating) p.set('new', '1');
  if (r.creating && r.from) p.set('from', r.from);
  const s = p.toString();
  return `#/tickets/rfqs${s ? `?${s}` : ''}`;
}

/** A client request id for the idempotent create / send (8-64 chars of the server's pattern). */
export function clientRequestId(): string {
  const a = new Uint8Array(12);
  (globalThis.crypto ?? { getRandomValues: (x: Uint8Array) => x.map(() => Math.floor(Math.random() * 256)) }).getRandomValues(a);
  return `rfq-${[...a].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

// ---------------------------------------------------------------- TKRFQ4: the work order (contract section 18)

/** The approved awards in the order the board lists them (the awards that get a work order). */
export function orderAwards(d: Pick<RfqDetail, 'awards'>): RfqAward[] {
  return d.awards.filter((a) => a.state === 'approved');
}

/** Vendors that quoted and were NOT selected (they get no message at all - owner decision). */
export function notSelectedCount(d: Pick<RfqDetail, 'vendors' | 'awards'>): number {
  const picked = new Set(orderAwards(d).map((a) => a.vendor_id));
  return d.vendors.filter((v) => !picked.has(v.id) && (v.state === 'not_awarded' || (v.quote !== null && v.state !== 'awarded' && v.state !== 'removed'))).length;
}

/** The scope line of an award: the whole quote, the lines of some kinds, or n chosen lines (kind names from the caller). */
export function scopeText(s: RfqScope | null | undefined, kindName: (k: LineKind) => string): { key: 'ordScopeAll' | 'ordScopeKinds' | 'ordScopeLines'; vars: Record<string, string | number> } | null {
  if (!s) return null;
  if (s.kind === 'all') return { key: 'ordScopeAll', vars: {} };
  if (s.kind === 'kinds') return { key: 'ordScopeKinds', vars: { kinds: s.kinds.map(kindName).join(', ') } };
  return { key: 'ordScopeLines', vars: { n: s.lines } };
}

/** The order form of one award: its dates as local days (the server's defaults = the quote's work window, else the request's). */
export function orderForm(a: Pick<RfqAward, 'order_defaults'>): { from: string; to: string; docs: string } {
  return { from: isoToLocal(a.order_defaults?.work_from).date, to: isoToLocal(a.order_defaults?.work_to ?? a.order_defaults?.work_from).date, docs: '' };
}

/** Whether the order form can be sent: a start day, and an end day not before it. */
export function orderFormValid(f: { from: string; to: string }): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(f.from) && (!f.to || f.to >= f.from);
}

/** The create body (idempotent by request_key; empty documents are not sent). */
export function orderBody(f: { from: string; to: string; docs: string }, requestKey: string): RfqOrderBody {
  const out: RfqOrderBody = { work_from: dayToIso(f.from), work_to: dayToIso(f.to || f.from), request_key: requestKey };
  if (f.docs.trim()) out.documents = f.docs.trim();
  return out;
}
