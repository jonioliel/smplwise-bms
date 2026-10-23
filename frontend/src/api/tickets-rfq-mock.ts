/**
 * TKRFQ2: the demo store of the RFQ manager screens (no backend: the static preview and design review). Fake data only - no real person,
 * company, phone or price list. It follows the server's rules where a screen shows them (contract v0.9: the revision check, the states
 * and moves, the KPIs, lowest / earliest only inside the majority currency, the award with the optional second approval, the message
 * draft that is never sent by itself, "not selected" without a message, cancel with the short notice) and computes figures with the
 * integer rules of tickets/cost-model.ts.
 * TKRFQ4 (contract section 18): the work order of an award - opening the vendor's service request never sends anything; the order
 * message leaves only on the explicit send; one request per awarded vendor; `ordered` once every approved award has its order.
 */
import { ApiError } from './client';
import type { LineInput, LineKind, StoredLine, VatMode } from './tickets-costs';
import type {
  RfqAnswerBody, RfqAnswerPreview, RfqAward, RfqAwardAnswer, RfqBackend, RfqChannel, RfqCompareQuote, RfqComparison, RfqCreateBody, RfqDetail, RfqEvent, RfqFile, RfqKpis, RfqListPage,
  RfqMessage, RfqMeta, RfqOrder, RfqOrderAnswer, RfqOrderPreview, RfqQuestion, RfqQuestionCounts, RfqQuoteBody, RfqScope, RfqState, RfqSummary, RfqVendor, RfqVendorState,
} from './tickets-rfq';
import { decimalToMinor, halfUpDiv, hoursToQuarters, quantityToMilli, vatOf } from '../tickets/cost-model';
import { dayText, dayMonthText } from './day-format';

const sleep = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d+Z$/, 'Z');
let idn = 0;
const nid = (p: string) => `${p}${(++idn).toString(16).padStart(10, '0')}`;
const ME = 'יוני';

function fail(status: number, code: string, msg: string, details: Record<string, unknown> = {}): never {
  throw new ApiError(status, { code, user_message: msg, retryable: false, correlation_id: 'demo', details });
}

interface DQuote {
  id: string;
  version: number;
  state: RfqCompareQuote['state'];
  created_at: string;
  created_by_me: boolean;
  source: 'vendor' | 'on_behalf';
  currency: string;
  vat_mode: VatMode;
  vat_rate_bp: number;
  lines: StoredLine[];
  work_from: string | null;
  work_to: string | null;
  note: string | null;
  vendor_ref: string | null;
  valid_until: string | null;
  revision: number;
}

interface DVendor {
  id: string;
  contact: { id: string; name: string; company: string; lang: string };
  channel: RfqChannel;
  require_code: boolean;
  /** contract 15.2: the directory (the contact or its vendor) demands a code - it cannot be lowered for this vendor */
  code_from_directory?: boolean;
  channel_choice?: 'auto' | RfqChannel;
  state: RfqVendorState;
  invited_at: string;
  sent_at: string | null;
  first_opened_at: string | null;
  open_count: number;
  quoted_at: string | null;
  declined_at: string | null;
  decline_reason: string | null;
  link: 'live' | 'revoked' | 'none';
  quotes: DQuote[];
  messages: RfqMessage[];
  revision: number;
}

interface DRfq {
  id: string;
  number: number;
  state: RfqState;
  title: string;
  description: string;
  dept: string;
  place_text: string | null;
  source_ticket: { id: string; number: number } | null;
  due_at: string | null;
  work_from: string | null;
  work_to: string | null;
  kinds: LineKind[];
  owner: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  awarded_at: string | null;
  closed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  revision: number;
  vendors: DVendor[];
  awards: RfqAward[];
  events: RfqEvent[];
  files: RfqFile[];
}

const DEPTS = [
  { id: 'dept-maintenance', name: 'אחזקה', threshold: null as number | null },
  { id: 'dept-cleaning', name: 'ניקיון', threshold: 500_000 as number | null },
];
const VAT_BP = 1800;
const rfqs: DRfq[] = [];
let seq = 6;

function lineOf(kind: LineKind, description: string, minor: number): StoredLine {
  if (kind === 'labor') return { kind, description, hours: '1', rate_minor: minor, total_minor: minor };
  if (kind === 'parts') return { kind, description, quantity: '1', unit_minor: minor, total_minor: minor };
  return { kind, description, amount_minor: minor, total_minor: minor };
}

function figures(q: Pick<DQuote, 'lines' | 'vat_mode' | 'vat_rate_bp'>) {
  const by_kind: Record<LineKind, number> = { labor: 0, parts: 0, travel: 0, other: 0 };
  for (const l of q.lines) by_kind[l.kind] += l.total_minor;
  const subtotal = by_kind.labor + by_kind.parts + by_kind.travel + by_kind.other;
  const v = vatOf(subtotal, q.vat_mode, q.vat_rate_bp);
  return { by_kind, subtotal, vat: v.vat, total: v.total, net: v.net };
}

function event(r: DRfq, kind: string, at: number, vendor: DVendor | null, actor = ME, data: Record<string, unknown> = {}): void {
  r.events.push({ id: r.events.length + 1, kind, at: iso(at), vendor_id: vendor?.id ?? null, actor: { kind: actor ? 'user' : 'system', name: actor }, data });
}

function seed(): void {
  if (rfqs.length) return;
  const now = Date.now();
  const mk = (n: number, title: string, dept: string, state: RfqState, hoursAgo: number, dueInH: number | null, extra: Partial<DRfq> = {}): DRfq => {
    const created = now - hoursAgo * HOUR;
    return {
      id: `rfq${String(n).padStart(13, '0')}`, number: n, state, title, description: '', dept, place_text: null, source_ticket: null,
      due_at: dueInH === null ? null : iso(now + dueInH * HOUR), work_from: null, work_to: null, kinds: ['labor', 'parts'], owner: ME, created_by: ME,
      created_at: iso(created), updated_at: iso(created), sent_at: state === 'draft' ? null : iso(created + 10 * 60_000), awarded_at: null, closed_at: null,
      cancelled_at: null, cancel_reason: null, revision: 3, vendors: [], awards: [], events: [], files: [], ...extra,
    };
  };
  const vendor = (key: string, name: string, company: string, channel: RfqChannel, state: RfqVendorState, sentAt: number | null, openedAt: number | null): DVendor => ({
    id: `rv-${key}`, contact: { id: `ct-${key}`, name, company, lang: 'he' }, channel, require_code: key === 'kortek', code_from_directory: key === 'kortek', state, invited_at: iso(sentAt ?? Date.now()),
    sent_at: sentAt ? iso(sentAt) : null, first_opened_at: openedAt ? iso(openedAt) : null, open_count: openedAt ? 2 : 0, quoted_at: null, declined_at: null,
    decline_reason: null, link: sentAt && channel !== 'manual' ? 'live' : 'none', quotes: [], messages: [], revision: 1,
  });
  const quote = (v: DVendor, at: number, lines: StoredLine[], from: number, to: number, note: string, currency = 'ILS', ref: string | null = null): void => {
    v.state = 'quoted';
    v.quoted_at = iso(at);
    v.quotes.push({ id: nid('q'), version: 1, state: 'submitted', created_at: iso(at), created_by_me: false, source: 'vendor', currency, vat_mode: 'included', vat_rate_bp: VAT_BP,
      lines, work_from: iso(from), work_to: iso(to), note, vendor_ref: ref, valid_until: iso(at + 30 * DAY), revision: 1 });
  };

  // RFQ-07: the mock-up's request - six vendors, three quotes, one decline, one opened, one without a reply
  const sent = now - 50 * HOUR;
  const r7 = mk(7, 'החלפת מזגן בחדר הישיבות (קומה 2)', 'dept-maintenance', 'collecting', 51, 20, {
    description: 'היחידה הפנימית הישנה דולפת שוב אחרי תיקון; נדרשת החלפה ליחידה חדשה 2.5 כ״ס כולל פינוי הישנה, חיבור לניקוז קיים והפעלה.',
    place_text: 'קומה 2 · חדר ישיבות גדול', work_from: iso(now + 2 * DAY), work_to: iso(now + 12 * DAY), source_ticket: { id: '00000000000c1042', number: 1042 },
    files: [{ id: 'f-1', name: 'תמונות-היחידה.jpg', caption: 'היחידה הפנימית מלפנים', kind: 'image', bytes: 412_000, thumb: false, visible_vendors: true },
      { id: 'f-2', name: 'תוכנית-קומה-2.pdf', caption: '', kind: 'pdf', bytes: 980_000, thumb: false, visible_vendors: true },
      { id: 'f-3', name: 'תקציב-פנימי.xlsx', caption: 'פנימי', kind: 'xlsx', bytes: 24_000, thumb: false, visible_vendors: false }],
  });
  const alon = vendor('alon', 'אלון ד.', 'מיזוג אלון בע״מ', 'whatsapp', 'sent', sent, sent + 30 * 60_000);
  const kortek = vendor('kortek', 'שירה ב.', 'קור-טק מיזוג', 'email', 'sent', sent, sent + 3 * HOUR);
  const aklim = vendor('aklim', 'מוחמד ע.', 'אקלים פלוס', 'whatsapp', 'sent', sent, sent + 45 * 60_000);
  const nm = vendor('nm', 'נדב מ.', 'נ.מ. מיזוג ושירות', 'manual', 'declined', sent, sent + HOUR);
  const tz = vendor('tz', 'צחי ק.', 'צ.ק. אלקטרו-מכני', 'email', 'opened', sent, now - 26 * HOUR);
  const bz = vendor('bz', 'ברק ל.', 'ברק מערכות', 'whatsapp', 'sent', sent, null);
  quote(alon, now - 23 * HOUR, [lineOf('labor', 'התקנה והפעלה', 120_000), lineOf('parts', 'יחידה 2.5 כ״ס', 640_000)], now + 4 * DAY, now + 5 * DAY, 'יחידה 2.5 כ״ס, אחריות 3 שנים', 'ILS', 'Q-2231');
  quote(kortek, now - 41 * HOUR, [lineOf('labor', 'התקנה ביום אחד', 110_000), lineOf('parts', 'יחידה + פינוי הישנה', 690_000)], now + 2 * DAY, now + 2 * DAY, 'התקנה ביום אחד, כולל פינוי הישנה');
  quote(aklim, now - 2 * HOUR, [lineOf('labor', 'התקנה', 140_000), lineOf('parts', 'דגם חלופי שקול', 610_000)], now + 11 * DAY, now + 12 * DAY, 'דגם חלופי שקול, זמינות רק בסוף החודש');
  nm.declined_at = iso(sent + HOUR);
  nm.decline_reason = 'אין זמינות החודש';
  alon.messages.push({ id: nid('m'), direction: 'out', text: 'האם המחיר כולל פינוי?', at: iso(now - 22 * HOUR), by: ME, source: { kind: 'clarify', id: null }, notified: true },
    { id: nid('m'), direction: 'in', text: 'כן, כולל פינוי והובלה', at: iso(now - 21 * HOUR), by: 'אלון ד.', source: null, notified: false,
      question: { state: 'answered', read: true, answered_at: iso(now - 20 * HOUR), answer_id: null, quote_id: null } });
  // RFQQUESTIONS: a question sent with a quote (new) and one by a WhatsApp reply (seen, still unanswered)
  aklim.messages.push({ id: nid('m'), direction: 'in', text: 'האם אפשר לעבוד ביום שישי בבוקר? אחרת המועד נדחה בשבוע.', at: iso(now - 2 * HOUR), by: 'מוחמד ע.', source: null,
    notified: false, question: { state: 'pending', read: false, answered_at: null, answer_id: null, quote_id: aklim.quotes[0].id } });
  tz.messages.push({ id: nid('m'), direction: 'in', text: 'יש חניה לרכב עבודה ליד הבניין?', at: iso(now - 27 * HOUR), by: 'צחי ק.', source: null, notified: false, via: 'whatsapp',
    unverified: true, question: { state: 'pending', read: true, answered_at: null, answer_id: null, quote_id: null } });
  r7.vendors = [alon, kortek, aklim, nm, tz, bz];
  event(r7, 'created', sent - 10 * 60_000, null);
  event(r7, 'sent', sent, null, ME, { vendors: 6 });
  event(r7, 'declined', sent + HOUR, nm, '');
  event(r7, 'quote_submitted', now - 41 * HOUR, kortek, '', { quote_id: kortek.quotes[0].id, version: 1 });
  event(r7, 'quote_submitted', now - 23 * HOUR, alon, '', { quote_id: alon.quotes[0].id, version: 1 });
  event(r7, 'message', now - 22 * HOUR, alon, ME);
  event(r7, 'quote_submitted', now - 2 * HOUR, aklim, '', { quote_id: aklim.quotes[0].id, version: 1 });

  // RFQ-08: cleaning, above the department's double-approval threshold, one quote in another currency
  const r8 = mk(8, 'ניקוי חלונות חיצוני - בניין A', 'dept-cleaning', 'due_passed', 140, -4, { place_text: 'בניין A · חזית', created_by: 'דנה פרץ', owner: 'דנה פרץ', kinds: ['labor', 'parts', 'travel'] });
  const s8 = now - 139 * HOUR;
  const glass = vendor('glass', 'רון ש.', 'זכוכית נקייה', 'whatsapp', 'sent', s8, s8 + HOUR);
  const height = vendor('height', 'ליאת ג.', 'עבודות גובה בע״מ', 'email', 'sent', s8, s8 + 2 * HOUR);
  const intl = vendor('intl', 'Mark T.', 'FacadeCare Ltd', 'email', 'sent', s8, s8 + 5 * HOUR);
  quote(glass, s8 + 20 * HOUR, [lineOf('labor', 'שני ימי עבודה', 420_000), lineOf('travel', 'במה מתרוממת', 180_000)], now + 3 * DAY, now + 4 * DAY, 'כולל ביטוח צד ג׳');
  quote(height, s8 + 30 * HOUR, [lineOf('labor', 'סנפלינג', 520_000), lineOf('parts', 'חומרי ניקוי', 40_000)], now + 6 * DAY, now + 7 * DAY, '');
  quote(intl, s8 + 40 * HOUR, [lineOf('labor', 'Facade cleaning', 150_000)], now + 9 * DAY, now + 9 * DAY, 'Price in USD', 'USD');
  r8.vendors = [glass, height, intl];
  event(r8, 'sent', s8, null, 'דנה פרץ');
  event(r8, 'due_passed', now - 4 * HOUR, null, '');

  // RFQ-06: a draft without vendors yet
  const r6 = mk(6, 'בדיקת מערכת כיבוי אש שנתית', 'dept-maintenance', 'draft', 3, 72, { description: 'בדיקה שנתית של ספרינקלרים ולוח הבקרה.' });
  event(r6, 'created', now - 3 * HOUR, null);

  // RFQ-05: awarded (the baseline), RFQ-04: cancelled
  const r5 = mk(5, 'צביעת חדר המדרגות הצפוני', 'dept-maintenance', 'awarded', 400, -200, { awarded_at: iso(now - 150 * HOUR) });
  const paint = vendor('paint', 'יוסי צ.', 'צבע וגימור', 'whatsapp', 'sent', now - 399 * HOUR, now - 398 * HOUR);
  const paint2 = vendor('paint2', 'עדי ר.', 'גוונים', 'email', 'sent', now - 399 * HOUR, now - 390 * HOUR);
  quote(paint, now - 300 * HOUR, [lineOf('labor', 'צביעה', 380_000), lineOf('parts', 'צבע', 90_000)], now + 3 * DAY, now + 4 * DAY, '');
  quote(paint2, now - 290 * HOUR, [lineOf('labor', 'צביעה', 410_000), lineOf('parts', 'צבע', 70_000)], now + 3 * DAY, now + 5 * DAY, '');
  paint.state = 'awarded';
  paint.quotes[0].state = 'approved';
  paint2.state = 'not_awarded';
  paint2.quotes[0].state = 'not_awarded';
  const f5 = figures(paint.quotes[0]);
  r5.awards.push({ id: nid('aw'), vendor_id: paint.id, quote_id: paint.quotes[0].id, state: 'approved', line_indexes: [0, 1], finalize: true, first_by: ME, first_at: iso(now - 150 * HOUR),
    second_required: false, second_by: null, second_at: null, revision: 1, currency: 'ILS', subtotal_minor: f5.subtotal, vat_minor: f5.vat, total_minor: f5.total });
  r5.vendors = [paint, paint2];
  event(r5, 'awarded', now - 150 * HOUR, paint, ME, { quote_id: paint.quotes[0].id, total_minor: f5.total, currency: 'ILS' });
  const r4 = mk(4, 'החלפת שטיחים בלובי', 'dept-cleaning', 'cancelled', 700, -600, { cancelled_at: iso(now - 600 * HOUR), cancel_reason: 'הפרויקט נדחה' });
  event(r4, 'cancelled', now - 600 * HOUR, null);
  rfqs.push(r8, r7, r6, r5, r4);
}

const dueOver = (r: DRfq, now = Date.now()) => !!r.due_at && Date.parse(r.due_at) <= now;
function effective(r: DRfq): RfqState {
  return (r.state === 'sent' || r.state === 'collecting') && dueOver(r) ? 'due_passed' : r.state;
}
function vstate(r: DRfq, v: DVendor): RfqVendorState {
  return (v.state === 'sent' || v.state === 'opened') && dueOver(r) ? 'expired' : v.state;
}
const live = (v: DVendor) => v.quotes.find((q) => q.state === 'submitted' || q.state === 'approved' || q.state === 'partially_approved') ?? null;
const OPEN: RfqState[] = ['sent', 'collecting', 'due_passed'];
const pendingOf = (v: DVendor) => v.messages.filter((m) => m.direction === 'in' && m.question?.state === 'pending');
/** RFQQUESTIONS: the server's counts - zero once the request is no longer open */
function qCounts(r: DRfq, v?: DVendor): RfqQuestionCounts {
  if (!OPEN.includes(effective(r))) return { pending: 0, unread: 0 };
  const list = (v ? [v] : r.vendors.filter((x) => x.state !== 'removed')).flatMap(pendingOf);
  return { pending: list.length, unread: list.filter((m) => !m.question?.read).length };
}
function qItems(r: DRfq): RfqQuestion[] {
  if (!OPEN.includes(effective(r))) return [];
  return r.vendors.filter((v) => v.state !== 'removed').flatMap((v) => pendingOf(v).map((m): RfqQuestion => ({
    id: m.id, vendor_id: v.id, vendor: { name: v.contact.name, company: v.contact.company }, text: m.text, at: m.at, read: !!m.question?.read,
    via: m.via === 'whatsapp' ? 'whatsapp' : 'page', unverified: !!m.unverified,
    quote: m.question?.quote_id ? { id: m.question.quote_id, version: v.quotes.find((q) => q.id === m.question?.quote_id)?.version ?? 1 } : null,
    age_h: Math.max(0, Math.floor((Date.now() - Date.parse(m.at)) / HOUR)),
  }))).sort((a, b) => a.at.localeCompare(b.at));
}
const FRAME = { q: 'שאלה שהתקבלה מספק', named: 'שאלה מ{name}', a: 'תשובה' };
const deptOf = (id: string) => DEPTS.find((d) => d.id === id) ?? DEPTS[0];

function majority(qs: DQuote[]): string {
  const counts = new Map<string, number>();
  for (const q of qs) counts.set(q.currency, (counts.get(q.currency) ?? 0) + 1);
  if (!counts.size) return 'ILS';
  const best = Math.max(...counts.values());
  const tied = [...counts.entries()].filter(([, n]) => n === best).map(([c]) => c).sort();
  return tied.includes('ILS') ? 'ILS' : tied[0];
}

function lowestEarliest(qs: DQuote[]): { low: string | null; early: string | null; currency: string } {
  const currency = majority(qs);
  const ranked = qs.filter((q) => q.currency === currency).sort((a, b) => figures(a).total - figures(b).total || a.created_at.localeCompare(b.created_at));
  const dated = qs.filter((q) => q.work_from).sort((a, b) => (a.work_from as string).localeCompare(b.work_from as string) || figures(a).total - figures(b).total);
  return { low: ranked[0]?.id ?? null, early: dated[0]?.id ?? null, currency };
}

function kpis(r: DRfq): RfqKpis {
  const active = r.vendors.filter((v) => v.state !== 'removed');
  const states = active.map((v) => vstate(r, v));
  const lives = active.map(live).filter((q): q is DQuote => !!q);
  const { low, currency } = lowestEarliest(lives);
  const lq = lives.find((q) => q.id === low);
  return {
    invited: active.length, sent: active.filter((v) => v.sent_at).length, opened: active.filter((v) => v.first_opened_at).length, quoted: lives.length,
    declined: states.filter((s) => s === 'declined').length, no_response: states.filter((s) => s === 'sent' || s === 'opened' || s === 'expired').length,
    lowest_total_minor: lq ? figures(lq).total : null, currency,
  };
}

function summary(r: DRfq): RfqSummary {
  return {
    id: r.id, number: r.number, ref: `RFQ-${String(r.number).padStart(2, '0')}`, state: effective(r), title: r.title, department: { id: r.dept, name: deptOf(r.dept).name },
    place_text: r.place_text, due_at: r.due_at, work_from: r.work_from, work_to: r.work_to, created_at: r.created_at, updated_at: r.updated_at,
    internal_owner: { id: 'u-me', name: r.owner }, kpis: kpis(r), questions: qCounts(r),
  };
}

function detail(r: DRfq): RfqDetail {
  const state = effective(r);
  const open = OPEN.includes(state);
  const pending = r.awards.some((a) => a.state === 'pending_second');
  const hasAward = r.awards.some((a) => a.state === 'pending_second' || a.state === 'approved');
  const ended = state === 'closed' || state === 'cancelled';
  const vendors: RfqVendor[] = r.vendors.map((v) => {
    const vs = vstate(r, v);
    const q = live(v);
    const f = q ? figures(q) : null;
    return {
      id: v.id, contact: { ...v.contact, kind: 'vendor', erased: false }, channel: v.channel, state: vs, invited_at: v.invited_at, sent_at: v.sent_at,
      first_opened_at: v.first_opened_at, open_count: v.open_count, quoted_at: v.quoted_at, declined_at: v.declined_at, decline_reason: v.decline_reason,
      link: { state: v.link, expires_at: r.due_at, sent_via: v.channel === 'manual' ? null : v.channel }, delivery: null,
      quote: q && f ? { id: q.id, version: q.version, state: q.state, created_at: q.created_at, total_minor: f.total, subtotal_minor: f.subtotal, currency: q.currency,
        work_from: q.work_from, work_to: q.work_to, revision: q.revision, has_note: !!q.note?.trim() } : null,
      messages: v.messages.length, questions: qCounts(r, v), revision: v.revision, require_code: v.require_code, channel_choice: v.channel_choice ?? 'auto',
      can: {
        remove: !ended && vs !== 'removed' && vs !== 'awarded' && !r.awards.some((a) => a.vendor_id === v.id && a.state !== 'declined'),
        remind: (state === 'sent' || state === 'collecting') && (vs === 'sent' || vs === 'opened') && v.channel !== 'manual',
        quote_on_behalf: (open || state === 'awarded') && !['draft', 'removed', 'awarded', 'not_awarded'].includes(vs),
        decline_on_behalf: !ended && state !== 'draft' && ['sent', 'opened', 'expired', 'withdrawn'].includes(vs),
        message: vs !== 'draft' && vs !== 'removed',
      },
    };
  });
  const threshold = deptOf(r.dept).threshold;
  const amounts = (e: RfqEvent): RfqEvent => {
    if ((e.kind === 'quote_submitted' || e.kind === 'awarded') && typeof e.data.quote_id === 'string') {
      const q = r.vendors.flatMap((v) => v.quotes).find((x) => x.id === e.data.quote_id);
      if (q) return { ...e, data: { ...e.data, total_minor: figures(q).total, currency: q.currency } };
    }
    return e;
  };
  return {
    id: r.id, number: r.number, ref: `RFQ-${String(r.number).padStart(2, '0')}`, state, title: r.title, description: r.description,
    department: { id: r.dept, name: deptOf(r.dept).name }, place: { site_id: null, building_id: null, floor_id: null, text: r.place_text },
    source_ticket: r.source_ticket, due_at: r.due_at, work_from: r.work_from, work_to: r.work_to, allowed_line_kinds: [...r.kinds],
    internal_owner: { id: 'u-me', name: r.owner, active: true }, created_by: { id: 'u-me', name: r.created_by }, created_at: r.created_at, updated_at: r.updated_at,
    sent_at: r.sent_at, awarded_at: r.awarded_at, closed_at: r.closed_at, cancelled_at: r.cancelled_at, cancel_reason: r.cancel_reason, revision: r.revision,
    kpis: kpis(r), vendors, awards: r.awards.map((a) => awardOut(r, a)), second_approval: { threshold_minor: threshold, enabled: threshold !== null },
    timeline: [...r.events].map(amounts).sort((a, b) => b.at.localeCompare(a.at)), vendor_page: true, attachments: clone(r.files.filter((f) => !f.removed)),
    questions: { ...qCounts(r), items: qItems(r) },
    can: {
      answer: true, edit: !ended, add_vendor: state === 'draft' || open, send: (state === 'draft' || state === 'sent' || state === 'collecting') && r.vendors.some((v) => v.state === 'draft'),
      remind: state === 'sent' || state === 'collecting', cancel: (state === 'draft' || open) && !hasAward, close: (open || state === 'awarded' || state === 'ordered') && !pending,
      award: (open || state === 'awarded') && !pending, see_amounts: true, delete: true,
      order: r.awards.some((a) => awardOut(r, a).can?.order), send_order: r.awards.some((a) => awardOut(r, a).can?.send_order),
      attach: state === 'draft' || open,
    },
  };
}

// ---------------------------------------------------------------- TKRFQ4: the work order (no table of its own on the server either)

interface DOrder extends RfqOrder { documents: string | null; request_key: string }
const orders = new Map<string, DOrder>();
const orderKeys = new Map<string, string>();
let ticketSeq = 2043;

function quoteOf(r: DRfq, a: RfqAward): DQuote | undefined {
  return r.vendors.find((v) => v.id === a.vendor_id)?.quotes.find((q) => q.id === a.quote_id);
}

function scopeOf(q: DQuote | undefined, idx: number[]): RfqScope | null {
  if (!q) return null;
  const kinds = [...new Set(idx.map((i) => q.lines[i]?.kind).filter((k): k is LineKind => !!k))];
  if (idx.length === q.lines.length) return { kind: 'all', kinds, lines: q.lines.length };
  const byKinds = q.lines.map((l, i) => (kinds.includes(l.kind) ? i : -1)).filter((i) => i >= 0);
  return { kind: byKinds.length === idx.length ? 'kinds' : 'lines', kinds, lines: idx.length };
}

function awardOut(r: DRfq, a: RfqAward): RfqAward {
  const o = orders.get(a.id);
  const q = quoteOf(r, a);
  const state = effective(r);
  const out: RfqAward = { ...clone(a), scope: scopeOf(q, a.line_indexes), order: null, ticket: null, order_defaults: null, can: { order: false, send_order: false } };
  if (o) {
    const { documents: _d, request_key: _k, ...pub } = o;
    out.order = clone(pub);
    out.ticket = clone(o.ticket);
    out.can = { order: false, send_order: !o.sent };
  } else if (a.state === 'approved') {
    out.order_defaults = { work_from: q?.work_from ?? r.work_from, work_to: q?.work_to ?? q?.work_from ?? r.work_to };
    out.can = { order: state === 'awarded' || state === 'ordered', send_order: false };
  }
  return out;
}

function orderAnswer(r: DRfq, awardId: string, extra: Partial<RfqOrderAnswer> = {}): RfqOrderAnswer {
  const d = detail(r);
  return { rfq: d, award: d.awards.find((a) => a.id === awardId) ?? null, ...extra };
}

function orderText(r: DRfq, o: RfqOrder): string {
  const d = (s: string | null) => (s ? dayMonthText(new Date(s)) : '');
  const a = d(o.work_from);
  const b = d(o.work_to);
  const win = a && b && a !== b ? `${a}-${b}` : a || b || 'גמיש';
  return `ההצעה שלכם ל"${r.title}" (מס' ${r.number}) אושרה. מועד העבודה: ${win}.\nהזמנת העבודה והמסמכים: [קישור]\nנא לאשר את המועד בקישור.`;
}

function find(id: string): DRfq {
  seed();
  const r = rfqs.find((x) => x.id === id);
  if (!r) fail(404, 'rfq_not_found', 'הבקשה לא נמצאה');
  return r;
}
function checkRev(r: DRfq, revision: number): void {
  if (revision !== r.revision) fail(409, 'rfq_stale', 'הבקשה השתנתה בינתיים', { revision: r.revision });
}
function touch(r: DRfq): void {
  r.revision += 1;
  r.updated_at = iso(Date.now());
}
function vendorOf(r: DRfq, id: string): DVendor {
  const v = r.vendors.find((x) => x.id === id);
  if (!v) fail(404, 'vendor_not_found', 'הספק לא נמצא');
  return v;
}

function storedLine(l: LineInput): StoredLine {
  if (l.kind === 'labor') {
    const q = hoursToQuarters(l.hours);
    const r = decimalToMinor(l.rate);
    if (q === null || r === null) fail(422, 'validation', 'סעיף לא תקין');
    return { kind: 'labor', description: l.description ?? '', hours: l.hours, rate_minor: r, total_minor: Number(halfUpDiv(BigInt(q) * BigInt(r), 4n)) };
  }
  if (l.kind === 'parts') {
    const m = quantityToMilli(l.quantity);
    const u = decimalToMinor(l.unit_price);
    if (m === null || u === null) fail(422, 'validation', 'סעיף לא תקין');
    return { kind: 'parts', description: l.description, quantity: l.quantity, unit_minor: u, total_minor: Number(halfUpDiv(BigInt(m) * BigInt(u), 1000n)) };
  }
  const a = decimalToMinor(l.amount);
  if (a === null) fail(422, 'validation', 'סעיף לא תקין');
  return { kind: l.kind, description: l.description ?? '', amount_minor: a, total_minor: a };
}

function comparison(r: DRfq): RfqComparison {
  const qs = r.vendors.map((v) => ({ v, q: live(v) })).filter((x): x is { v: DVendor; q: DQuote } => !!x.q).sort((a, b) => a.q.created_at.localeCompare(b.q.created_at));
  const { low, early, currency } = lowestEarliest(qs.map((x) => x.q));
  const due = r.due_at ? Date.parse(r.due_at) : null;
  const items: RfqCompareQuote[] = qs.map(({ v, q }) => {
    const f = figures(q);
    const a = r.awards.find((x) => x.quote_id === q.id && (x.state === 'pending_second' || x.state === 'approved'));
    const inWindow = r.work_from && r.work_to && q.work_from ? r.work_from <= q.work_from && (q.work_to ?? q.work_from) <= r.work_to : null;
    return {
      vendor_id: v.id, vendor: { ...v.contact }, quote_id: q.id, version: q.version, state: q.state, source: q.source, submitted_at: q.created_at,
      late: !!due && Date.parse(q.created_at) > due, currency: q.currency, vat_mode: q.vat_mode, vat_rate_bp: q.vat_rate_bp,
      lines: q.lines.map((l, index) => ({ index, ...l })), by_kind: f.by_kind, subtotal_minor: f.subtotal, vat_minor: f.vat, total_minor: f.total, net_minor: f.net,
      work_from: q.work_from, work_to: q.work_to, in_window: inWindow === null ? null : !!inWindow, note: q.note, vendor_ref: q.vendor_ref, messages: v.messages.length,
      questions: qCounts(r, v), lowest: q.id === low, earliest: q.id === early, award: a ? { id: a.id, state: a.state, line_indexes: a.line_indexes } : null, revision: q.revision,
      valid_until: q.valid_until, can: { award: q.state === 'submitted' && !q.created_by_me },
    };
  });
  return { rfq_id: r.id, ref: `RFQ-${String(r.number).padStart(2, '0')}`, state: effective(r), currency, quotes: items, lowest_quote_id: low, earliest_quote_id: early,
    filters: { all: items.length, in_window: items.filter((i) => i.in_window).length } };
}

function finalAward(r: DRfq, a: RfqAward): void {
  const v = vendorOf(r, a.vendor_id);
  const q = v.quotes.find((x) => x.id === a.quote_id) as DQuote;
  a.state = 'approved';
  q.state = a.line_indexes.length === q.lines.length ? 'approved' : 'partially_approved';
  v.state = 'awarded';
  r.state = 'awarded';
  r.awarded_at = iso(Date.now());
  if (a.finalize) {
    for (const o of r.vendors) {
      const oq = live(o);
      if (o.id !== v.id && oq && oq.state === 'submitted' && !r.awards.some((x) => x.vendor_id === o.id && x.state !== 'declined')) {
        oq.state = 'not_awarded';
        o.state = 'not_awarded';
      }
    }
  }
  event(r, 'awarded', Date.now(), v, ME, { quote_id: q.id });
}

function draftOf(r: DRfq, a: RfqAward): RfqAwardAnswer['message_draft'] {
  const v = vendorOf(r, a.vendor_id);
  const q = v.quotes.find((x) => x.id === a.quote_id) as DQuote;
  const partial = a.line_indexes.length !== q.lines.length;
  const names: Record<LineKind, string> = { labor: 'עבודה', parts: 'חלקים', travel: 'נסיעות', other: 'אחר' };
  const kinds = [...new Set(a.line_indexes.map((i) => q.lines[i]?.kind).filter(Boolean))].map((k) => names[k as LineKind]).join(', ');
  const d = (s: string | null) => (s ? dayText(new Date(s)) : '');
  const win = q.work_from || q.work_to ? ` (חלון עבודה: ${[d(q.work_from), d(q.work_to)].filter(Boolean).join(' - ')})` : '';
  const text = partial ? `שלום ${v.contact.name}, ההצעה שלכם עבור "${r.title}" אושרה חלקית: ${kinds}${win}.` : `שלום ${v.contact.name}, ההצעה שלכם עבור "${r.title}" אושרה במלואה${win}.`;
  return { text, lang: 'he', notify_default: true, send: { route: `POST /tickets/rfqs/${r.id}/vendors/${v.id}/messages`, source: { kind: 'award', id: a.id } } };
}

export const mockRfq: RfqBackend = {
  async meta(): Promise<RfqMeta> {
    seed();
    await sleep(60);
    return {
      vendor_page: true, settings: { default_due_days: 3, grace_hours: 24, link_keep_days: 30, retention_months: 24, reminder_hours: 24 },
      departments: DEPTS.map((d) => ({ id: d.id, name: d.name, can_create: true, second_approval_minor: d.threshold, second_approval_enabled: d.threshold !== null })),
      line_kinds: ['labor', 'parts', 'travel', 'other'], currencies: ['ILS', 'USD', 'EUR'], attachments: true, vendor_options: true,
    };
  },
  async list(q = {}): Promise<RfqListPage> {
    seed();
    await sleep();
    const st = q.state ?? 'open';
    const s = (q.q ?? '').trim();
    const items = rfqs
      .filter((r) => st === 'all' || (st === 'open' ? !['closed', 'cancelled'].includes(effective(r)) : effective(r) === st))
      .filter((r) => !q.department_id || r.dept === q.department_id)
      .filter((r) => !s || r.title.includes(s) || String(r.number) === s.replace(/\D/g, ''))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .map(summary);
    return { items, next_cursor: null };
  },
  async get(id) {
    await sleep();
    return detail(find(id));
  },
  async create(body: RfqCreateBody) {
    seed();
    await sleep(200);
    const now = Date.now();
    const r: DRfq = {
      id: nid('rfq'), number: ++seq + 2, state: 'draft', title: body.title.trim(), description: body.description ?? '', dept: body.department_id,
      place_text: body.place_text ?? null, source_ticket: body.source_ticket_id ? { id: body.source_ticket_id, number: 1042 } : null, due_at: body.due_at ?? null,
      work_from: body.work_from ?? null, work_to: body.work_to ?? null, kinds: body.allowed_line_kinds ?? ['labor', 'parts'], owner: ME, created_by: ME,
      created_at: iso(now), updated_at: iso(now), sent_at: null, awarded_at: null, closed_at: null, cancelled_at: null, cancel_reason: null, revision: 1,
      vendors: [], awards: [], events: [], files: [],
    };
    for (const ref of body.vendors) {
      const c = contactNames.get(ref.contact_id) ?? { name: ref.contact_id, company: '' };
      r.vendors.push({ id: nid('rv'), contact: { id: ref.contact_id, name: c.name, company: c.company, lang: 'he' }, channel: ref.channel ?? 'whatsapp', require_code: !!ref.require_code,
        state: 'draft', invited_at: iso(now), sent_at: null, first_opened_at: null, open_count: 0, quoted_at: null, declined_at: null, decline_reason: null, link: 'none',
        quotes: [], messages: [], revision: 1 });
    }
    event(r, 'created', now, null);
    rfqs.unshift(r);
    return detail(r);
  },
  async edit(id, body) {
    await sleep();
    const r = find(id);
    checkRev(r, body.revision);
    if (r.state !== 'draft' && (body.title !== undefined || body.description !== undefined || body.place_text !== undefined || body.allowed_line_kinds !== undefined)) {
      fail(409, 'rfq_field_locked', 'השדה נעול אחרי השליחה');
    }
    if (body.title !== undefined) r.title = body.title;
    if (body.description !== undefined) r.description = body.description;
    if (body.place_text !== undefined) r.place_text = body.place_text;
    if (body.due_at !== undefined) r.due_at = body.due_at;
    if (body.work_from !== undefined) r.work_from = body.work_from;
    if (body.work_to !== undefined) r.work_to = body.work_to;
    if (body.allowed_line_kinds !== undefined) r.kinds = body.allowed_line_kinds;
    touch(r);
    event(r, 'edited', Date.now(), null);
    return detail(r);
  },
  async remove(id) {
    await sleep();
    const i = rfqs.findIndex((x) => x.id === id);
    if (i < 0) fail(404, 'rfq_not_found', 'הבקשה לא נמצאה');
    rfqs.splice(i, 1);
  },
  async addVendor(id, contactId, revision) {
    await sleep();
    const r = find(id);
    checkRev(r, revision);
    if (r.vendors.some((v) => v.contact.id === contactId && v.state !== 'removed')) fail(409, 'vendor_duplicate', 'הספק כבר בבקשה');
    const c = contactNames.get(contactId) ?? { name: contactId, company: '' };
    const v: DVendor = { id: nid('rv'), contact: { id: contactId, name: c.name, company: c.company, lang: 'he' }, channel: 'whatsapp', require_code: false, state: 'draft',
      invited_at: iso(Date.now()), sent_at: null, first_opened_at: null, open_count: 0, quoted_at: null, declined_at: null, decline_reason: null, link: 'none', quotes: [], messages: [], revision: 1 };
    r.vendors.push(v);
    touch(r);
    event(r, 'vendor_added', Date.now(), v);
    return detail(r);
  },
  async removeVendor(id, vendorId, revision) {
    await sleep();
    const r = find(id);
    checkRev(r, revision);
    const v = vendorOf(r, vendorId);
    if (v.state === 'awarded') fail(409, 'rfq_invalid_transition', 'אי אפשר להסיר ספק שנבחר', { from: v.state, action: 'remove' });
    v.state = 'removed';
    v.link = 'revoked';
    for (const q of v.quotes) if (q.state === 'submitted') q.state = 'withdrawn';
    touch(r);
    event(r, 'vendor_removed', Date.now(), v);
    return detail(r);
  },
  async vendorOptions(id, vendorId, body) {
    await sleep();
    const r = find(id);
    checkRev(r, body.revision);
    const v = vendorOf(r, vendorId);
    if (body.channel !== undefined) {
      if (v.state !== 'draft') fail(409, 'rfq_field_locked', 'הערוץ נעול אחרי השליחה');
      v.channel_choice = body.channel;
      if (body.channel !== 'auto') v.channel = body.channel;
    }
    if (body.require_code !== undefined) {
      if (v.state === 'awarded' || v.state === 'removed') fail(409, 'rfq_invalid_transition', 'אי אפשר לשנות ספק שנבחר או הוסר', { from: v.state, action: 'options' });
      if (!body.require_code && v.code_from_directory) fail(409, 'vendor_code_locked', 'ספר הספקים דורש קוד אימות לספק הזה');
      v.require_code = body.require_code;
    }
    v.revision += 1;
    touch(r);
    return detail(r);
  },
  async revokeLink(id, vendorId) {
    await sleep();
    const r = find(id);
    const v = vendorOf(r, vendorId);
    v.link = 'revoked';
    event(r, 'link_revoked', Date.now(), v);
    return detail(r);
  },
  async send(id, revision, channel) {
    await sleep(250);
    const r = find(id);
    checkRev(r, revision);
    const drafts = r.vendors.filter((v) => v.state === 'draft');
    if (!drafts.length) fail(409, 'rfq_no_vendors', 'אין ספקים לשליחה');
    if (r.due_at && Date.parse(r.due_at) <= Date.now()) fail(409, 'rfq_due_passed', 'המועד האחרון עבר');
    const now = Date.now();
    for (const v of drafts) {
      v.state = 'sent';
      v.sent_at = iso(now);
      if (channel === 'manual') v.channel = 'manual';
      v.link = v.channel === 'manual' ? 'none' : 'live';
    }
    if (r.state === 'draft') {
      r.state = 'sent';
      r.sent_at = iso(now);
    }
    touch(r);
    event(r, 'sent', now, null, ME, { vendors: drafts.length });
    return { ...detail(r), sent: { vendors: drafts.length, channel } };
  },
  async remind(id, vendorIds) {
    await sleep();
    const r = find(id);
    const targets = r.vendors.filter((v) => (!vendorIds?.length || vendorIds.includes(v.id)) && (vstate(r, v) === 'sent' || vstate(r, v) === 'opened') && v.channel !== 'manual');
    for (const v of targets) event(r, 'reminder', Date.now(), v);
    return detail(r);
  },
  async quoteOnBehalf(id, vendorId, body: RfqQuoteBody) {
    await sleep(200);
    const r = find(id);
    const v = vendorOf(r, vendorId);
    if (!body.lines.length) fail(422, 'validation', 'נדרש לפחות סעיף אחד');
    const prev = live(v);
    if (prev && prev.state === 'submitted') prev.state = 'superseded';
    const q: DQuote = {
      id: nid('q'), version: v.quotes.length + 1, state: 'submitted', created_at: iso(Date.now()), created_by_me: true, source: 'on_behalf', currency: body.currency ?? 'ILS',
      vat_mode: body.amounts_include_vat === false ? 'excluded' : 'included', vat_rate_bp: VAT_BP, lines: body.lines.map(storedLine), work_from: body.work_from ?? null,
      work_to: body.work_to ?? null, note: body.note ?? null, vendor_ref: body.vendor_ref ?? null, valid_until: null, revision: 1,
    };
    v.quotes.push(q);
    v.state = 'quoted';
    v.quoted_at = q.created_at;
    if (r.state === 'sent') r.state = 'collecting';
    touch(r);
    event(r, 'quote_submitted', Date.now(), v, ME, { quote_id: q.id, version: q.version });
    return detail(r);
  },
  async withdrawQuote(id, vendorId, quoteId, revision) {
    await sleep();
    const r = find(id);
    const v = vendorOf(r, vendorId);
    const q = v.quotes.find((x) => x.id === quoteId);
    if (!q || q.state !== 'submitted') fail(409, 'quote_not_open', 'ההצעה לא פתוחה');
    if (q.revision !== revision) fail(409, 'quote_stale', 'ההצעה השתנתה בינתיים');
    q.state = 'withdrawn';
    v.state = 'withdrawn';
    touch(r);
    event(r, 'quote_withdrawn', Date.now(), v);
    return detail(r);
  },
  async declineOnBehalf(id, vendorId, reason) {
    await sleep();
    const r = find(id);
    const v = vendorOf(r, vendorId);
    v.state = 'declined';
    v.declined_at = iso(Date.now());
    v.decline_reason = reason ?? null;
    touch(r);
    event(r, 'declined', Date.now(), v);
    return detail(r);
  },
  async comparison(id) {
    await sleep();
    return comparison(find(id));
  },
  async award(id, body) {
    await sleep(250);
    const r = find(id);
    if (r.awards.some((a) => a.state === 'pending_second')) fail(409, 'award_pending', 'יש בחירה שממתינה לאישור שני');
    const v = r.vendors.find((x) => x.quotes.some((q) => q.id === body.quote_id));
    const q = v?.quotes.find((x) => x.id === body.quote_id);
    if (!v || !q || q.state !== 'submitted') fail(409, 'quote_not_open', 'ההצעה לא פתוחה');
    if (q.revision !== body.revision) fail(409, 'quote_stale', 'ההצעה השתנתה בינתיים');
    if (q.created_by_me) fail(409, 'self_approval', 'מי שהזין את ההצעה לא יכול לאשר אותה');
    const idx = body.line_indexes ?? (body.kinds ? q.lines.map((l, i) => (body.kinds?.includes(l.kind) ? i : -1)).filter((i) => i >= 0) : q.lines.map((_, i) => i));
    const sub = idx.reduce((s, i) => s + (q.lines[i]?.total_minor ?? 0), 0);
    const f = vatOf(sub, q.vat_mode, q.vat_rate_bp);
    const threshold = deptOf(r.dept).threshold;
    const second = threshold !== null && q.currency === 'ILS' && f.total > threshold && r.created_by !== ME;
    const a: RfqAward = {
      id: nid('aw'), vendor_id: v.id, quote_id: q.id, state: second ? 'pending_second' : 'approved', line_indexes: idx, finalize: body.finalize, first_by: ME,
      first_at: iso(Date.now()), second_required: second, second_by: null, second_at: null, revision: 1, currency: q.currency, subtotal_minor: sub, vat_minor: f.vat,
      total_minor: f.total, threshold_minor: threshold,
    };
    r.awards.push(a);
    if (second) event(r, 'award_pending', Date.now(), v, ME, { quote_id: q.id });
    else finalAward(r, a);
    touch(r);
    return { rfq: detail(r), award: clone(a), message_draft: a.state === 'approved' ? draftOf(r, a) : null };
  },
  async confirmAward(id, awardId, revision) {
    await sleep(200);
    const r = find(id);
    const a = r.awards.find((x) => x.id === awardId);
    if (!a) fail(404, 'award_not_found', 'הבחירה לא נמצאה');
    if (a.revision !== revision) fail(409, 'rfq_stale', 'הבחירה השתנתה בינתיים');
    a.second_by = 'מאשר שני';
    a.second_at = iso(Date.now());
    a.revision += 1;
    finalAward(r, a);
    touch(r);
    return { rfq: detail(r), award: clone(a), message_draft: draftOf(r, a) };
  },
  async declineAward(id, awardId, revision, reason) {
    await sleep();
    const r = find(id);
    const a = r.awards.find((x) => x.id === awardId);
    if (!a) fail(404, 'award_not_found', 'הבחירה לא נמצאה');
    if (a.revision !== revision) fail(409, 'rfq_stale', 'הבחירה השתנתה בינתיים');
    a.state = 'declined';
    a.decline_reason = reason;
    touch(r);
    event(r, 'award_declined', Date.now(), vendorOf(r, a.vendor_id));
    return detail(r);
  },
  async cancel(id, revision, reason) {
    await sleep();
    const r = find(id);
    checkRev(r, revision);
    if (r.awards.some((a) => a.state !== 'declined')) fail(409, 'rfq_has_award', 'כבר נבחר ספק');
    r.state = 'cancelled';
    r.cancelled_at = iso(Date.now());
    r.cancel_reason = reason ?? null;
    for (const v of r.vendors) for (const q of v.quotes) if (q.state === 'submitted') q.state = 'not_awarded';
    touch(r);
    event(r, 'cancelled', Date.now(), null);
    return detail(r);
  },
  async close(id, revision) {
    await sleep();
    const r = find(id);
    checkRev(r, revision);
    for (const v of r.vendors) {
      const q = live(v);
      if (q && q.state === 'submitted') {
        q.state = 'not_awarded';
        v.state = 'not_awarded';
      }
    }
    r.state = 'closed';
    r.closed_at = iso(Date.now());
    touch(r);
    event(r, 'closed', Date.now(), null);
    return detail(r);
  },
  async messages(id, vendorId) {
    await sleep(80);
    return { items: clone(vendorOf(find(id), vendorId).messages) };
  },
  async writeMessage(id, vendorId, text, notify, source) {
    await sleep();
    const r = find(id);
    const v = vendorOf(r, vendorId);
    const item: RfqMessage = { id: nid('m'), direction: 'out', text, at: iso(Date.now()), by: ME, source: source ? { kind: source.kind, id: source.id } : { kind: 'clarify', id: null }, notified: notify && v.channel !== 'manual' };
    v.messages.push(item);
    if (!source) for (const m of pendingOf(v)) m.question = { ...m.question!, state: 'answered', read: true, answered_at: item.at, answer_id: item.id };
    event(r, 'message', Date.now(), v);
    return { item: clone(item), notified: { queued: item.notified, channel: item.notified ? v.channel : null } };
  },
  async setThreshold(departmentId, minor) {
    await sleep();
    const d = DEPTS.find((x) => x.id === departmentId);
    if (!d) fail(404, 'department_not_found', 'המחלקה לא נמצאה');
    d.threshold = minor;
    return { department_id: departmentId, second_approval_minor: minor };
  },
  async createOrder(id, awardId, body) {
    await sleep(220);
    const r = find(id);
    const a = r.awards.find((x) => x.id === awardId);
    if (!a) fail(404, 'award_not_found', 'האישור לא נמצא');
    const prior = orderKeys.get(`${awardId}:${body.request_key}`);
    const priorOrder = prior ? orders.get(prior) : undefined;
    if (priorOrder) return orderAnswer(r, awardId, { ticket: { id: priorOrder.ticket.id ?? '', number: priorOrder.ticket.number }, replayed: true });
    if (a.state === 'pending_second') fail(409, 'award_pending', 'יש אישור שממתין לאישור שני');
    const state = effective(r);
    if (a.state !== 'approved' || (state !== 'awarded' && state !== 'ordered')) fail(409, 'rfq_invalid_transition', 'הפעולה הזו אינה אפשרית במצב הנוכחי של הבקשה', { from: state, action: 'order' });
    const existing = orders.get(a.id);
    if (existing) fail(409, 'order_exists', 'כבר נפתחה הזמנת עבודה לספק הזה', { ticket_id: existing.ticket.id });
    const q = quoteOf(r, a);
    const wf = body.work_from || q?.work_from || r.work_from;
    const wt = body.work_to || (body.work_from ? wf : q?.work_to || q?.work_from || r.work_to) || wf;
    if (!wf) fail(422, 'validation', 'ערך לא תקין', { fields: [{ field: 'work_from', code: 'required' }] });
    if (wt && wt < wf) fail(422, 'validation', 'ערך לא תקין', { fields: [{ field: 'work_to', code: 'order' }] });
    const number = ++ticketSeq;
    const o: DOrder = { ticket: { id: `0000000000${number.toString(16).padStart(6, '0')}`, number, status: 'assigned' }, work_from: wf, work_to: wt ?? wf,
      created_at: iso(Date.now()), created_by: ME, sent: null, documents: body.documents?.trim() || null, request_key: body.request_key };
    orders.set(a.id, o);
    orderKeys.set(`${awardId}:${body.request_key}`, a.id);
    const approved = r.awards.filter((x) => x.state === 'approved');
    if (approved.some((x) => x.finalize) && approved.every((x) => orders.has(x.id))) r.state = 'ordered';
    touch(r);
    event(r, 'order_created', Date.now(), vendorOf(r, a.vendor_id), ME, { award_id: a.id, ticket_number: number });
    return orderAnswer(r, awardId, { ticket: { id: o.ticket.id as string, number }, replayed: false });
  },
  async orderPreview(id, awardId): Promise<RfqOrderPreview> {
    await sleep(100);
    const r = find(id);
    const a = r.awards.find((x) => x.id === awardId);
    const o = a ? orders.get(a.id) : undefined;
    if (!a || !o) fail(404, 'order_not_found', 'עדיין לא נפתחה הזמנת עבודה לספק הזה');
    const v = vendorOf(r, a.vendor_id);
    const channel = v.channel;
    return { award_id: awardId, text: orderText(r, o), lang: 'he', channel, refusals: channel === 'manual' ? ['order_channel_unavailable'] : [], sent: !!o.sent, sent_at: o.sent?.at ?? null };
  },
  async sendOrder(id, awardId) {
    await sleep(180);
    const r = find(id);
    const a = r.awards.find((x) => x.id === awardId);
    const o = a ? orders.get(a.id) : undefined;
    if (!a || !o) fail(404, 'order_not_found', 'עדיין לא נפתחה הזמנת עבודה לספק הזה');
    if (o.sent) return orderAnswer(r, awardId, { notified: { queued: true, channel: o.sent.channel, already: true } });
    const v = vendorOf(r, a.vendor_id);
    if (v.channel === 'manual') fail(409, 'order_channel_unavailable', 'אין כרגע ערוץ שיכול לשלוח את הזמנת העבודה לספק');
    o.sent = { at: iso(Date.now()), channel: v.channel, by: ME };
    touch(r);
    event(r, 'order_sent', Date.now(), v, ME, { award_id: a.id });
    return orderAnswer(r, awardId, { notified: { queued: true, channel: v.channel, already: false } });
  },
  async questionsSummary() {
    seed();
    await sleep(40);
    const c = rfqs.map((r) => qCounts(r));
    return { pending: c.reduce((n, x) => n + x.pending, 0), unread: c.reduce((n, x) => n + x.unread, 0), requests: c.filter((x) => x.pending).length };
  },
  async markRead(id, vendorId) {
    await sleep(40);
    let n = 0;
    for (const m of pendingOf(vendorOf(find(id), vendorId))) if (!m.question?.read) { m.question = { ...m.question!, read: true }; n += 1; }
    return { read: n };
  },
  async answerPreview(id, qid, body) {
    await sleep(80);
    return answerPlan(find(id), qid, body);
  },
  async answer(id, qid, body) {
    await sleep();
    const r = find(id);
    const p = answerPlan(r, qid, body);
    const at = iso(Date.now());
    const items = p.recipients.map((x) => {
      const v = vendorOf(r, x.vendor_id);
      const m: RfqMessage = { id: nid('m'), direction: 'out', text: x.text, at, by: ME, source: { kind: 'clarify', id: null }, notified: !!x.notify_channel, answers_id: qid, to_all: p.scope === 'all' };
      v.messages.push(m);
      return { vendor_id: v.id, message_id: m.id, notified: m.notified };
    });
    const q = r.vendors.flatMap((v) => v.messages).find((m) => m.id === qid);
    if (q) q.question = { ...q.question!, state: 'answered', read: true, answered_at: at, answer_id: items.find((x) => p.recipients.find((y) => y.vendor_id === x.vendor_id)?.asker)?.message_id ?? null };
    touch(r);
    event(r, 'question_answered', Date.now(), vendorOf(r, p.recipients[0].vendor_id), ME, { scope: p.scope, copies: items.length });
    return { rfq: detail(r), answer: { question_id: qid, scope: p.scope, items, notified: items.filter((x) => x.notified).length, broadcast_id: p.scope === 'all' ? nid('b') : null }, replayed: false };
  },
  async resolveQuestion(id, qid) {
    await sleep();
    const r = find(id);
    const v = r.vendors.find((x) => x.messages.some((m) => m.id === qid && m.direction === 'in'));
    const q = v?.messages.find((m) => m.id === qid);
    if (!v || !q) fail(404, 'message_not_found', 'השאלה לא נמצאה.');
    if (q.question?.state === 'answered') fail(409, 'question_answered', 'כבר ניתנה תשובה לשאלה הזו.');
    q.question = { ...q.question!, state: 'answered', read: true, answered_at: iso(Date.now()), answer_id: null };
    event(r, 'question_resolved', Date.now(), v);
    return detail(r);
  },
  // RFQATT: the demo store keeps the picked file in memory (an object URL) - the real server checks, re-encodes and stores it
  async uploadAttachment(id, file, options = {}) {
    await sleep(150);
    const r = find(id);
    const state = effective(r);
    if (!['draft', 'sent', 'collecting', 'due_passed'].includes(state)) fail(409, 'attachment_locked', 'אפשר לצרף קבצים רק בטיוטה או בזמן איסוף ההצעות');
    const live = r.files.filter((f) => !f.removed);
    if (live.length >= 10) fail(409, 'attachment_limit', 'הגעתם למספר הקבצים המרבי לבקשה', { max_files: 10 });
    const kind = demoKind(file);
    if (!kind) fail(415, 'unsupported_format', 'סוג הקובץ אינו נתמך');
    if (file.size > (kind === 'image' ? 8 : 10) * 1024 * 1024) fail(413, 'payload_too_large', 'הקובץ גדול מדי');
    const stem = (file.name || 'file').replace(/^.*[\\/]/, '').replace(/\.[^.]*$/, '') || 'file';
    const f: RfqFile = { id: nid('f'), name: `${stem}.${kind === 'image' ? 'jpg' : kind}`, caption: options.caption ?? '', kind, bytes: file.size, thumb: kind === 'image',
      visible_vendors: options.visible_vendors ?? true, created_at: iso(Date.now()) };
    blobs.set(f.id, file);
    r.files.push(f);
    r.updated_at = iso(Date.now());
    return { ...detail(r), attachment: clone(f) };
  },
  async editAttachment(id, attachmentId, options) {
    await sleep(80);
    const r = find(id);
    const f = r.files.find((x) => x.id === attachmentId && !x.removed);
    if (!f) fail(404, 'attachment_not_found', 'הקובץ לא נמצא');
    if (options.caption !== undefined) f.caption = options.caption;
    if (options.visible_vendors !== undefined) f.visible_vendors = options.visible_vendors;
    return detail(r);
  },
  async removeAttachment(id, attachmentId) {
    await sleep(80);
    const r = find(id);
    const i = r.files.findIndex((x) => x.id === attachmentId && !x.removed);
    if (i < 0) fail(404, 'attachment_not_found', 'הקובץ לא נמצא');
    r.files.splice(i, 1);
    blobs.delete(attachmentId);
    return detail(r);
  },
  attachmentUrl(_id, attachmentId) {
    const b = blobs.get(attachmentId);
    if (!b) return '';
    let u = urls.get(attachmentId);
    if (!u) {
      u = URL.createObjectURL(b);
      urls.set(attachmentId, u);
    }
    return u;
  },
};

function demoKind(file: File): RfqFile['kind'] | null {
  const n = (file.name || '').toLowerCase();
  if (/^image\/(jpeg|png|webp)$/.test(file.type) || /\.(jpe?g|png|webp)$/.test(n)) return 'image';
  if (file.type === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
  if (n.endsWith('.docx')) return 'docx';
  if (n.endsWith('.xlsx')) return 'xlsx';
  return null;
}

/** RFQQUESTIONS: the server's plan of an answer - the asker gets the answer, the others the question as worded + the answer (no name unless chosen). */
function answerPlan(r: DRfq, qid: string, body: RfqAnswerBody): RfqAnswerPreview {
  const asker = r.vendors.find((v) => v.messages.some((m) => m.id === qid && m.direction === 'in'));
  const q = asker?.messages.find((m) => m.id === qid);
  if (!asker || !q) fail(404, 'message_not_found', 'השאלה לא נמצאה.');
  if (q.question?.state === 'answered') fail(409, 'question_answered', 'כבר ניתנה תשובה לשאלה הזו.');
  const text = body.text.trim();
  if (!text || text.length > 2000) fail(422, 'validation', 'ערך לא תקין.', { fields: [{ field: 'text', code: text ? 'too_long' : 'required' }] });
  const shown = (body.question_text ?? q.text).trim();
  if (body.scope === 'all' && (!shown || shown.length > 1000)) fail(422, 'validation', 'ערך לא תקין.', { fields: [{ field: 'question_text', code: shown ? 'too_long' : 'required' }] });
  const named = body.scope === 'all' && !!body.name_asker;
  const vs = body.scope === 'all' ? [asker, ...r.vendors.filter((v) => v !== asker && !['draft', 'removed', 'not_awarded'].includes(v.state))] : [asker];
  return {
    question_id: qid, scope: body.scope, name_asker: named,
    recipients: vs.map((v) => ({
      vendor_id: v.id, vendor: { name: v.contact.name, company: v.contact.company }, asker: v === asker, lang: v.contact.lang,
      text: v === asker ? text : `${named ? FRAME.named.replace('{name}', asker.contact.company || asker.contact.name) : FRAME.q}: ${shown}\n${FRAME.a}: ${text}`,
      notify_channel: body.notify && v.channel !== 'manual' && v.link === 'live' ? v.channel : null,
    })),
  };
}

/** Back to the seeded requests (the evidence specs replay the demo store as a fake server, one clean store per test). */
export function resetDemoRfq(): void {
  rfqs.length = 0;
  seq = 6;
  orders.clear();
  orderKeys.clear();
  ticketSeq = 2043;
  DEPTS[0].threshold = null;
  DEPTS[1].threshold = 500_000;
  seed();
}

/** The demo names of directory contacts the new-request sheet picked (the sheet tells the store; the real server reads its directory). */
const contactNames = new Map<string, { name: string; company: string }>();
const blobs = new Map<string, Blob>();
const urls = new Map<string, string>();
export function rememberDemoContact(id: string, name: string, company: string): void {
  contactNames.set(id, { name, company });
}
