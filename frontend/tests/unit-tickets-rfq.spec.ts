import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RfqCompareQuote, RfqEvent, RfqKpis, RfqSummary } from '../src/api/tickets-rfq';
import { createWireBody } from '../src/api/tickets-rfq';
import {
  arrangeQuotes, awardBody, awardPreview, currencyGroups, defaultDue, draftProblems, eventLine, inFilter, invitable, invitePreview, isoToLocal, listTiles, localToIso,
  matchesQuery, normalizeKinds, notSelected, parseRfqRoute, plannedChannel, refusalKey, rfqHref, scopeIndexes, scopeValid, secondApprovalHint, selectionTotals, splitPlan,
  statusBar, stripCounts, toggleKind, windowText, type RfqDraft, type Selection,
} from '../src/tickets/rfq-model';
import { RFQ_TEXT_EN_KEYS, RFQ_TEXT_HE, RFQ_TEXT_KEYS, rfqTemplate } from '../src/tickets/rfq-text';
import { TAB_PERMISSIONS, TICKETS_RFQS_HREF, TICKETS_TABS, activeAreaTab } from '../src/shell/nav';

// TKRFQ2 (2.6.1): the pure logic of the RFQ manager screens (tickets/rfq-model.ts), the wire body of the create route, the words
// (tickets/rfq-text.ts) and the navigation entry.
//   npx playwright test -c playwright.unit.config.ts tests/unit-tickets-rfq.spec.ts

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const NOW = new Date('2026-10-16T09:00:00Z');

const kp = (o: Partial<RfqKpis> = {}): RfqKpis => ({ invited: 6, sent: 6, opened: 5, quoted: 3, declined: 1, no_response: 2, lowest_total_minor: 750_000, currency: 'ILS', ...o });
const sum = (state: RfqSummary['state'], o: Partial<RfqSummary> = {}): RfqSummary => ({
  id: `r-${state}`, number: 7, ref: 'RFQ-07', state, title: 'החלפת מזגן', department: { id: 'd1', name: 'אחזקה' }, place_text: null, due_at: null, work_from: null,
  work_to: null, created_at: '', updated_at: '', internal_owner: { id: 'u', name: 'דנה' }, kpis: kp(), ...o,
});

let qn = 0;
function quote(o: Partial<RfqCompareQuote> = {}): RfqCompareQuote {
  qn += 1;
  return {
    vendor_id: `v${qn}`, vendor: { id: `c${qn}`, name: `ספק ${qn}`, company: '' }, quote_id: `q${qn}`, version: 1, state: 'submitted', source: 'vendor', submitted_at: '2026-10-15T08:00:00Z',
    late: false, currency: 'ILS', vat_mode: 'included', vat_rate_bp: 1800,
    lines: [{ index: 0, kind: 'labor', description: 'עבודה', total_minor: 120_000 }, { index: 1, kind: 'parts', description: 'יחידה', total_minor: 640_000 }],
    by_kind: { labor: 120_000, parts: 640_000, travel: 0, other: 0 }, subtotal_minor: 760_000, vat_minor: 115_932, total_minor: 760_000, net_minor: 644_068,
    work_from: '2026-10-20T00:00:00Z', work_to: '2026-10-21T00:00:00Z', in_window: true, note: null, vendor_ref: null, messages: 0, lowest: false, earliest: false,
    award: null, revision: 3, can: { award: true }, ...o,
  };
}

test('list filters follow the server ("open" = not closed / cancelled; one chip for sent + collecting)', () => {
  expect(inFilter('draft', 'open')).toBe(true);
  expect(inFilter('awarded', 'open')).toBe(true);
  expect(inFilter('closed', 'open')).toBe(false);
  expect(inFilter('cancelled', 'open')).toBe(false);
  expect(inFilter('sent', 'collecting')).toBe(true);
  expect(inFilter('collecting', 'collecting')).toBe(true);
  expect(inFilter('due_passed', 'collecting')).toBe(false);
  expect(inFilter('closed', 'all')).toBe(true);
  const items = [sum('draft'), sum('collecting'), sum('sent'), sum('closed'), sum('cancelled')];
  expect(stripCounts(items, ['open', 'collecting', 'closed', 'all'])).toEqual([
    { id: 'open', count: 3 }, { id: 'collecting', count: 2 }, { id: 'closed', count: 1 }, { id: 'all', count: 5 },
  ]);
});

test('the text filter matches the title, the department and the number in any form', () => {
  const i = sum('collecting');
  for (const q of ['', 'מזגן', 'אחזקה', '7', 'RFQ-07', 'rfq7', '#7', '007']) expect(matchesQuery(i, q), q).toBe(true);
  for (const q of ['8', 'RFQ-08', 'ניקיון']) expect(matchesQuery(i, q), q).toBe(false);
});

test('KPI tiles count open requests only; "waiting for a decision" = deadline passed or quotes in', () => {
  const t = listTiles([
    sum('collecting', { kpis: kp({ quoted: 2, no_response: 1 }) }),
    sum('sent', { kpis: kp({ quoted: 0, no_response: 4 }) }),
    sum('due_passed', { kpis: kp({ quoted: 1, no_response: 0 }) }),
    sum('draft', { kpis: kp({ quoted: 0, no_response: 0 }) }),
    sum('closed', { kpis: kp({ quoted: 9, no_response: 9 }) }),
  ]);
  expect(t).toEqual({ open: 4, collecting: 2, decide: 2, quotes: 3, noReply: 5 });
});

test('the vendor status bar: quoted / declined / opened without a quote / no reply, shares of the invited', () => {
  const parts = statusBar(kp({ invited: 6, opened: 5, quoted: 3, declined: 1 }));
  expect(parts.map((p) => [p.key, p.n])).toEqual([['quoted', 3], ['declined', 1], ['opened', 1], ['no_reply', 1]]);
  expect(parts.reduce((s, p) => s + p.n, 0)).toBe(6);
  expect(statusBar(kp({ invited: 2, opened: 0, quoted: 0, declined: 0 }))).toEqual([{ key: 'no_reply', n: 2, pct: 100 }]);
  expect(statusBar(kp({ invited: 0, opened: 0, quoted: 0, declined: 0 }))).toEqual([]);
});

test('dates: local form values <-> UTC instants, the default deadline at 12:00, the window text', () => {
  const iso = localToIso('2026-10-18', '12:00');
  expect(iso).toMatch(/^2026-10-1[78]T\d\d:00:00Z$/);
  expect(isoToLocal(iso)).toEqual({ date: '2026-10-18', time: '12:00' });
  expect(localToIso('2026-13-01', '12:00')).toBe('');
  expect(localToIso('', '12:00')).toBe('');
  const due = defaultDue(new Date(2026, 9, 16, 9, 0), 3);
  expect(due).toEqual({ date: '2026-10-19', time: '12:00' });
  expect(defaultDue(new Date(2026, 9, 16), 999).date).toBe('2026-12-15'); // clamped to 60 days
  expect(windowText(localToIso('2026-10-18'), localToIso('2026-10-28'))).toBe('18.10 - 28.10');
  expect(windowText(localToIso('2026-10-18'), localToIso('2026-10-18'))).toBe('18.10');
  expect(windowText(null, null)).toBe('');
});

test('a draft needs a title, a department and a future deadline; a send also needs a vendor; the window may not end before it starts', () => {
  const ok: RfqDraft = { department_id: 'd1', title: 'מזגן', description: '', place_text: '', due_date: '2026-10-20', due_time: '12:00', work_from: '', work_to: '', kinds: ['labor'],
    vendors: [{ contact_id: 'c1', channel: 'whatsapp', require_code: false }], source_ticket_id: '' };
  expect(draftProblems(ok, NOW, true)).toEqual({});
  expect(draftProblems({ ...ok, title: '  ' }, NOW, false)).toEqual({ title: true });
  expect(draftProblems({ ...ok, title: 'x'.repeat(121) }, NOW, false)).toEqual({ title: true });
  expect(draftProblems({ ...ok, department_id: '' }, NOW, false)).toEqual({ department: true });
  expect(draftProblems({ ...ok, due_date: '2026-10-15' }, NOW, false)).toEqual({ due: true });
  expect(draftProblems({ ...ok, work_from: '2026-10-25', work_to: '2026-10-22' }, NOW, false)).toEqual({ window: true });
  expect(draftProblems({ ...ok, vendors: [] }, NOW, false)).toEqual({});
  expect(draftProblems({ ...ok, vendors: [] }, NOW, true)).toEqual({ vendors: true });
});

test('labour is always an allowed line kind; the order is the server\'s', () => {
  expect(normalizeKinds(['other', 'parts'])).toEqual(['labor', 'parts', 'other']);
  expect(toggleKind(['labor', 'parts'], 'travel')).toEqual(['labor', 'parts', 'travel']);
  expect(toggleKind(['labor', 'parts'], 'parts')).toEqual(['labor']);
  expect(toggleKind(['labor'], 'labor')).toEqual(['labor']);
});

test('who may be invited: an active vendor or person, never an employee, an account holder, an erased contact or another department\'s only', () => {
  const c = { kind: 'vendor' as const, active: true, erased: false, user_linked: false, departments: [] as string[] };
  expect(invitable(c, 'd1')).toBe(true);
  expect(invitable({ ...c, kind: 'person' }, 'd1')).toBe(true);
  expect(invitable({ ...c, kind: 'employee' }, 'd1')).toBe(false);
  expect(invitable({ ...c, user_linked: true }, 'd1')).toBe(false);
  expect(invitable({ ...c, active: false }, 'd1')).toBe(false);
  expect(invitable({ ...c, erased: true }, 'd1')).toBe(false);
  expect(invitable({ ...c, departments: ['d1', 'd2'] }, 'd1')).toBe(true);
  expect(invitable({ ...c, departments: ['d2'] }, 'd1')).toBe(false);
  expect(plannedChannel({ preferred_channel: 'whatsapp', has_phone: true, email: null })).toBe('whatsapp');
  expect(plannedChannel({ preferred_channel: 'whatsapp', has_phone: false, email: 'a@b.c' })).toBe('email');
  expect(plannedChannel({ preferred_channel: 'email', has_phone: true, email: null })).toBe('whatsapp');
  expect(plannedChannel({ preferred_channel: 'manual', has_phone: true, email: 'a@b.c' })).toBe('manual');
});

test('the invitation preview is the starter template rfq_invite, with empty lines dropped and never an amount', () => {
  const t = invitePreview({ name: 'אלון', number: '7', title: 'החלפת מזגן', place: '', due: '16.10 · 12:00', window: '18.10 - 28.10', link: '{קישור}', organization: '' });
  expect(t.split('\n')).toEqual([
    'שלום אלון,', "בקשה להצעת מחיר מס' 7: החלפת מזגן", 'מועד אחרון להצעה: 16.10 · 12:00', 'חלון עבודה רצוי: 18.10 - 28.10', 'פרטים וטופס ההצעה: {קישור}',
    'אפשר גם לסמן בקישור שאינכם מעוניינים.',
  ]);
  expect(t).not.toMatch(/₪|ILS/);
  expect(invitePreview({ name: 'A', number: '7', title: 'T', place: 'P', due: 'D', window: 'W', link: 'L', organization: 'O' }, 'en')).toContain('Request for quotation no. 7: T\nP\n');
});

test('the comparison groups quotes by currency: the comparison currency first and ranked, the others shown apart', () => {
  const a = quote({ currency: 'ILS', total_minor: 800_000 });
  const b = quote({ currency: 'USD', total_minor: 150_000 });
  const c = quote({ currency: 'ILS', total_minor: 760_000 });
  const g = currencyGroups([b, a, c], 'ILS');
  expect(g.map((x) => [x.currency, x.ranked, x.quotes.map((q) => q.quote_id)])).toEqual([['ILS', true, [a.quote_id, c.quote_id]], ['USD', false, [b.quote_id]]]);
});

test('arrange: in-window filter and price / date sort (undated last)', () => {
  const a = quote({ total_minor: 900, work_from: '2026-10-25T00:00:00Z', in_window: true });
  const b = quote({ total_minor: 500, work_from: null, in_window: null });
  const c = quote({ total_minor: 700, work_from: '2026-10-18T00:00:00Z', in_window: false });
  expect(arrangeQuotes([a, b, c], 'all', 'price').map((q) => q.total_minor)).toEqual([500, 700, 900]);
  expect(arrangeQuotes([a, b, c], 'all', 'date').map((q) => q.total_minor)).toEqual([700, 900, 500]);
  expect(arrangeQuotes([a, b, c], 'in_window', 'price').map((q) => q.total_minor)).toEqual([900]);
});

test('award scope -> body: whole quote sends neither field, a kind sends kinds, chosen lines send line_indexes', () => {
  const q = quote();
  expect(awardBody(q, { mode: 'all' }, true)).toEqual({ quote_id: q.quote_id, revision: 3, finalize: true });
  expect(awardBody(q, { mode: 'kinds', kinds: ['labor'] }, false)).toEqual({ quote_id: q.quote_id, revision: 3, finalize: false, kinds: ['labor'] });
  expect(awardBody(q, { mode: 'lines', indexes: [1] }, true)).toEqual({ quote_id: q.quote_id, revision: 3, finalize: true, line_indexes: [1] });
  // every line chosen = the whole quote
  expect(awardBody(q, { mode: 'lines', indexes: [0, 1] }, true)).toEqual({ quote_id: q.quote_id, revision: 3, finalize: true });
  expect(scopeIndexes(q, { mode: 'kinds', kinds: ['travel'] })).toEqual([]);
  expect(scopeValid(q, { mode: 'kinds', kinds: ['travel'] })).toBe(false);
  expect(scopeValid(q, { mode: 'lines', indexes: [] })).toBe(false);
});

test('award preview: the whole quote keeps the server figures; a part recomputes VAT with integer rules', () => {
  const q = quote();
  expect(awardPreview(q, { mode: 'all' })).toEqual({ subtotal: 760_000, vat: 115_932, total: 760_000 });
  // labour only, VAT included in 1,200.00 at 18%: VAT = round(120000 * 1800 / 11800) = 18305
  expect(awardPreview(q, { mode: 'kinds', kinds: ['labor'] })).toEqual({ subtotal: 120_000, vat: 18_305, total: 120_000 });
  const ex = quote({ vat_mode: 'excluded' });
  expect(awardPreview(ex, { mode: 'lines', indexes: [0] })).toEqual({ subtotal: 120_000, vat: 21_600, total: 141_600 });
});

test('a split: totals per currency (never one sum across currencies) and finalize only on the last award', () => {
  const a = quote({ currency: 'ILS' });
  const b = quote({ currency: 'ILS' });
  const c = quote({ currency: 'USD', total_minor: 150_000, subtotal_minor: 150_000, vat_minor: 0, vat_mode: 'none', lines: [{ index: 0, kind: 'labor', description: '', total_minor: 150_000 }] });
  const sel: Selection[] = [{ quote: a, scope: { mode: 'kinds', kinds: ['labor'] } }, { quote: c, scope: { mode: 'all' } }, { quote: b, scope: { mode: 'kinds', kinds: ['parts'] } }];
  expect(selectionTotals(sel)).toEqual([{ currency: 'ILS', total: 760_000, count: 2 }, { currency: 'USD', total: 150_000, count: 1 }]);
  expect(splitPlan(sel).map((x) => x.finalize)).toEqual([false, false, true]);
  expect(notSelected([a, b, c, quote({ state: 'withdrawn' })], sel.slice(0, 1)).map((q) => q.quote_id)).toEqual([b.quote_id, c.quote_id]);
});

test('second approval hint: OFF without a threshold; only above it and only in the threshold\'s currency', () => {
  const a = quote();
  const sel: Selection[] = [{ quote: a, scope: { mode: 'all' } }];
  expect(secondApprovalHint(null, sel, 'ILS')).toBe(false);
  expect(secondApprovalHint(undefined, sel, 'ILS')).toBe(false);
  expect(secondApprovalHint(500_000, sel, 'ILS')).toBe(true);
  expect(secondApprovalHint(760_000, sel, 'ILS')).toBe(false); // equal is not above
  expect(secondApprovalHint(500_000, [{ quote: a, scope: { mode: 'kinds', kinds: ['labor'] } }], 'ILS')).toBe(false);
  expect(secondApprovalHint(100, sel, 'USD')).toBe(false);
});

test('timeline rows map to texts; amounts appear only when the server resolved them; unknown kinds read "update"', () => {
  const ev = (kind: string, data: Record<string, unknown> = {}): RfqEvent => ({ id: 1, kind, at: '', vendor_id: 'v1', actor: { kind: 'user', name: 'דנה' }, data });
  const name = () => 'קור-טק';
  const money = (m: number, c: string) => `${m}/${c}`;
  expect(eventLine(ev('quote_submitted'), name, money)).toEqual({ key: 'ev_quote_submitted', vars: { vendor: 'קור-טק', actor: 'דנה', amount: '' } });
  expect(eventLine(ev('quote_submitted', { total_minor: 5, currency: 'ILS' }), name, money).key).toBe('ev_quote_submitted_amount');
  expect(eventLine(ev('awarded', { total_minor: 5, currency: 'ILS' }), name, money).vars.amount).toBe('5/ILS');
  expect(eventLine(ev('something_new'), name, money).key).toBe('ev_other');
  for (const k of ['created', 'sent', 'reminder', 'declined', 'award_pending', 'cancelled', 'closed', 'message_failed']) {
    expect(RFQ_TEXT_KEYS, k).toContain(eventLine(ev(k), name, money).key);
  }
});

test('refusal codes map to words; an unknown code keeps the server message', () => {
  expect(refusalKey('rfq_stale')).toBe('err_rfq_stale');
  expect(refusalKey('self_approval')).toBe('err_self_approval');
  expect(refusalKey('something')).toBeNull();
  expect(refusalKey(undefined)).toBeNull();
  for (const code of ['rfq_stale', 'quote_stale', 'rfq_vendor_page_unavailable', 'self_approval', 'second_approver_required', 'award_pending', 'rfq_has_award',
    'vendor_not_allowed', 'vendor_duplicate', 'rfq_no_vendors', 'rfq_due_passed', 'rfq_field_locked', 'rfq_invalid_transition']) {
    expect(RFQ_TEXT_KEYS, code).toContain(refusalKey(code));
  }
});

test('the route: list filters, one request, its comparison, the new sheet from an item', () => {
  expect(parseRfqRoute(new URLSearchParams(''))).toEqual({ view: 'list', id: '', state: 'open', dept: '', q: '', creating: false, from: '' });
  expect(parseRfqRoute(new URLSearchParams('state=closed&dept=d1&q=x')).state).toBe('closed');
  expect(parseRfqRoute(new URLSearchParams('state=bogus')).state).toBe('open');
  expect(parseRfqRoute(new URLSearchParams('rfq=abc123')).view).toBe('board');
  expect(parseRfqRoute(new URLSearchParams('rfq=abc123&view=compare')).view).toBe('compare');
  expect(parseRfqRoute(new URLSearchParams('rfq=<script>')).id).toBe('');
  expect(parseRfqRoute(new URLSearchParams('new=1&from=00000000000c1042'))).toMatchObject({ creating: true, from: '00000000000c1042' });
  expect(parseRfqRoute(new URLSearchParams('new=1&from=nope')).from).toBe('');
  expect(rfqHref({})).toBe('#/tickets/rfqs');
  expect(rfqHref({ state: 'closed', dept: 'd1', q: ' מזגן ' })).toBe(`#/tickets/rfqs?state=closed&dept=d1&q=${encodeURIComponent('מזגן')}`);
  expect(rfqHref({ id: 'r1', view: 'compare', state: 'closed' })).toBe('#/tickets/rfqs?rfq=r1&view=compare');
  expect(rfqHref({ creating: true, from: '00000000000c1042' })).toBe('#/tickets/rfqs?new=1&from=00000000000c1042');
});

test('the create body sent to the real route carries only the contract\'s fields unless the server says it takes more', () => {
  const body = { department_id: 'd1', title: 'T', description: '', vendors: [{ contact_id: 'c1', channel: 'email' as const, require_code: true }], client_request_id: 'rfq-12345678',
    due_at: '2026-10-20T09:00:00Z' };
  expect(createWireBody(body, null)).toEqual({ department_id: 'd1', title: 'T', vendors: [{ contact_id: 'c1' }], client_request_id: 'rfq-12345678', due_at: '2026-10-20T09:00:00Z' });
  expect(createWireBody(body, { vendor_options: true, attachments: true })).toEqual({ department_id: 'd1', title: 'T', vendors: [{ contact_id: 'c1', channel: 'email', require_code: true }],
    client_request_id: 'rfq-12345678', due_at: '2026-10-20T09:00:00Z' }); // RFQATT: files go one by one onto the draft, never in this body
});

test('the words: every English key exists in Hebrew; no retired word; the RFQ vocabulary is kept apart', () => {
  for (const k of RFQ_TEXT_EN_KEYS) expect(RFQ_TEXT_KEYS, k).toContain(k);
  const he = Object.values(RFQ_TEXT_HE).join('\n');
  expect(he).not.toMatch(/קריא(ה|ות|ת)/);
  expect(he).not.toMatch(/דרישת עלות/);
  expect(he).not.toMatch(/בקש(ת|ות) ה?שירות/);
  expect(rfqTemplate('navTitle', 'he')).toBe('בקשות הצעת מחיר');
  expect(rfqTemplate('oneTitle', 'he')).toBe('בקשת הצעת מחיר');
  for (const f of ['tickets/rfq-text.ts', 'tickets/rfq-model.ts', 'tickets/rfq-new.ts', 'tickets/rfq-board.ts', 'tickets/rfq-compare.ts', 'tickets/rfq-quote-dialog.ts',
    'tickets/rfq-message-dialog.ts', 'tickets/rfq-styles.ts', 'tickets/rfq-icons.ts', 'screens/tickets-rfqs.ts', 'api/tickets-rfq.ts', 'api/tickets-rfq-mock.ts']) {
    const src = readFileSync(path.join(SRC, f), 'utf8');
    expect(src, f).not.toMatch(/קריא(ה|ות|ת)/);
    expect(src, f).not.toMatch(/דרישת עלות/);
    expect(src, f).not.toMatch(/Home Assistant|\bHA\b|Ingress/);
  }
});

test('navigation: "בקשות הצעת מחיר" is a tab of the area before the vendors account, for openers and deciders', () => {
  const tab = TICKETS_TABS.find((t) => t.id === 'rfqs');
  expect(tab?.href).toBe(TICKETS_RFQS_HREF);
  expect(tab?.label).toBe('בקשות הצעת מחיר');
  expect(TICKETS_TABS.at(-1)?.id).toBe('accounts');
  expect(TAB_PERMISSIONS[TICKETS_RFQS_HREF]).toEqual(['tickets.external', 'tickets.costs']);
  expect(activeAreaTab({ path: '/tickets/rfqs', mode: 'tickets', segments: ['tickets', 'rfqs'], params: new URLSearchParams('rfq=r1') } as never)).toBe('rfqs');
});

// rfq-thread-system-author: the manager's thread shows an automatic message under the localized "System" label, styled apart from a person's.
test('the manager thread uses the System label and a distinct style for an automatic message', () => {
  expect(RFQ_TEXT_HE.systemAuthor).toBe('מערכת');
  expect(RFQ_TEXT_EN_KEYS).toContain('systemAuthor');
  const dlg = readFileSync(path.resolve(SRC, 'tickets/rfq-message-dialog.ts'), 'utf8');
  expect(dlg).toContain("m.system ? rt('systemAuthor') : m.by");
  expect(readFileSync(path.resolve(SRC, 'tickets/rfq-styles.ts'), 'utf8')).toContain('.thread .m[data-rfq-system]');
});
