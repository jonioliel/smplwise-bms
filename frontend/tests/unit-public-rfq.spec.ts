import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pickMode, rfqFragment } from '../src/public-ticket/state';
import { rfqApi, type ApiFailure, type RfqQuote, type RfqView } from '../src/public-ticket/api';
import {
  baseVersion, bodySig, cridFor, dayEndIso, dayStartIso, draftFromQuote, draftProblems, freshDraft, invalidKey, isoToDay, outsideWindow, parseRfqDraft, quoteWire, quoting, rfqFailure,
  rfqKinds, rfqScreen, timeLeft,
} from '../src/public-ticket/rfq/rfq-state';
import { RFQ_TEXT } from '../src/public-ticket/rfq/rfq-text';
import { LANGS } from '../src/public-ticket/strings';
import { mockRfq, resetDemoRfq } from '../src/api/tickets-rfq-mock';
import { ApiError } from '../src/api/client';
import { refusalKey } from '../src/tickets/rfq-model';
import { RFQ_TEXT_KEYS } from '../src/tickets/rfq-text';

// TKRFQVP (2.6.0): the request-for-quotation mode of the public vendor page - its pure logic (node only): the `#q.<token>` fragment, the
// screen of an answer, the refusals, the quote's wire body (inputs only, never a total; base_version; valid_until = the end of the day in
// the building's zone), the words and the guards of the new chunk; and the manager board's per-vendor code switch (the demo store).
//   npx playwright test -c playwright.unit.config.ts tests/unit-public-rfq.spec.ts

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '../src/public-ticket/rfq');
const TOKEN = 'QrStUvWxYz012345AbCdEfGhIjKlMnOp';
const ZONE = 'Asia/Jerusalem';
const fail = (status: number, code: string, extra: Partial<ApiFailure> = {}): ApiFailure => ({ status, code, retryAfter: 0, attemptsLeft: null, offline: false, ...extra });

const FORM: NonNullable<RfqView['form']> = {
  currencies: ['ILS'], allowed_kinds: ['labor', 'parts'], vat: { exempt: false, rate_bp: 1800, default: 'excluded' }, labor_rate_minor: 15000,
  limits: { lines: 30, description: 120, note: 1000, vendor_ref: 40, message: 2000, decline_reason: 200, max_total_minor: 0 },
};
const view = (over: Partial<RfqView> = {}): RfqView => ({
  kind: 'rfq', ref: 'RFQ-07', organization: 'מגדלי הדר', department: 'אחזקה', lang: 'he', dir: 'rtl', time_zone: ZONE, code_required: false, code_ok: true,
  read_only: false, page_state: 'open', rfq: { title: 't', description: null, place_text: null, due_at: '2026-10-20T09:00:00Z', work_from: '2026-10-21T21:00:00Z',
    work_to: '2026-10-27T22:00:00Z', allowed_line_kinds: ['labor', 'parts'], attachments: [] },
  quote: null, declined: null, messages: [], form: FORM, can: { quote: true, withdraw: false, decline: true, ask: true }, ...over,
});
const quote = (over: Partial<RfqQuote> = {}): RfqQuote => ({
  id: 'q1', version: 2, state: 'submitted', currency: 'ILS', vat_mode: 'included', vat_rate_bp: 1800,
  lines: [{ index: 0, kind: 'labor', description: 'התקנה', total_minor: 120000, hours: '8', rate_minor: 15000 },
    { index: 1, kind: 'parts', description: 'יחידה', total_minor: 640000, quantity: '2', unit_minor: 320000 },
    { index: 2, kind: 'travel', description: null, total_minor: 5000, amount_minor: 5000 }],
  subtotal_minor: 765000, vat_minor: 116695, total_minor: 765000, net_minor: 648305, work_from: '2026-10-22T21:00:00Z', work_to: null, in_window: true,
  valid_until: '2026-11-15T21:59:59Z', note: 'כולל פינוי', vendor_ref: 'Q-1', submitted_at: '2026-10-16T08:00:00Z', approved: null, ...over,
});

// ---------------------------------------------------------------- the link (15.1)

test('the fragment q.<token> is an RFQ link; a plain token stays the ticket page; nothing malformed is used', () => {
  expect(rfqFragment(`#q.${TOKEN}`)).toBe(TOKEN);
  for (const bad of [`#${TOKEN}`, `#q.${TOKEN}x`, '#q.short', `#q.${TOKEN.slice(0, 31)}.`, '#q.', `#Q.${TOKEN}`]) expect(rfqFragment(bad), bad).toBeNull();
  expect(pickMode(`#q.${TOKEN}`, '/t/', null, null)).toEqual({ mode: 'rfq', token: TOKEN, rid: null, fromFragment: true });
  expect(pickMode(`#q.${TOKEN}`, '/support/', 'x'.repeat(32), null).mode).toBe('rfq'); // TK255 prefix: the path does not matter
  expect(pickMode(`#${TOKEN}`, '/t/', null, TOKEN)).toMatchObject({ mode: 'ticket', token: TOKEN, fromFragment: true });
  expect(pickMode('', `/support/r/${'a'.repeat(32)}`, null, TOKEN)).toMatchObject({ mode: 'ticket', rid: 'a'.repeat(32) }); // the redeem answer decides
  expect(pickMode('', '/t/', 'y'.repeat(32), TOKEN)).toEqual({ mode: 'rfq', token: TOKEN, rid: null, fromFragment: false }); // a reload keeps the RFQ
  expect(pickMode('', '/t/', 'y'.repeat(32), null)).toMatchObject({ mode: 'ticket', token: 'y'.repeat(32) });
  expect(pickMode('', '/t/', null, 'tampered value')).toMatchObject({ mode: 'ticket', token: null });
});

// ---------------------------------------------------------------- the screen (15.3)

test('the screen: the code gate first, then the vendor\'s page_state', () => {
  expect(rfqScreen({ code_required: true, code_ok: false })).toBe('code');
  expect(rfqScreen({ code_required: true, code_ok: true, page_state: 'open' })).toBe('open');
  for (const s of ['open', 'due_passed', 'declined', 'awarded', 'closed', 'cancelled'] as const) expect(rfqScreen({ code_required: false, code_ok: true, page_state: s })).toBe(s);
  expect(quoting('open')).toBe(true);
  expect(quoting('declined')).toBe(true);
  for (const s of ['due_passed', 'awarded', 'closed', 'cancelled', 'code'] as const) expect(quoting(s)).toBe(false);
});

test('refusals: 404 is the uniform unavailable, 403 the code gate, 409s reload with words, unknown outcomes keep the request id', () => {
  expect(rfqFailure(fail(404, 'link_unavailable'))).toMatchObject({ unavailable: true, message: null });
  expect(rfqFailure(fail(403, 'code_required'))).toMatchObject({ code: true, reload: true });
  expect(rfqFailure(fail(409, 'read_only'))).toMatchObject({ message: 'r_e_read_only', reload: true, keepCrid: false });
  expect(rfqFailure(fail(409, 'quote_changed', { version: 3 }))).toMatchObject({ message: 'r_e_quote_changed', reload: true });
  expect(rfqFailure(fail(409, 'rfq_due_passed'))).toMatchObject({ message: 'r_e_due_passed', reload: true });
  expect(rfqFailure(fail(409, 'quote_closed'))).toMatchObject({ message: 'r_e_quote_closed', reload: true });
  expect(rfqFailure(fail(409, 'quote_exists')).message).toBe('r_e_quote_exists');
  expect(rfqFailure(fail(409, 'message_limit')).message).toBe('r_e_message_limit');
  expect(rfqFailure(fail(409, 'award_pending')).message).toBe('r_e_award_pending');
  expect(rfqFailure(fail(429, 'rate_limited', { retryAfter: 150 }))).toMatchObject({ message: 'r_e_rate', n: 3, keepCrid: true, unavailable: false });
  expect(rfqFailure(fail(0, 'offline', { offline: true }))).toMatchObject({ message: 'r_offline', keepCrid: true });
  expect(rfqFailure(fail(503, 'error'))).toMatchObject({ keepCrid: true });
  expect(rfqFailure(fail(422, 'invalid', { fields: [{ field: 'lines.0.kind', code: 'kind_not_allowed' }] })).message).toBe('r_e_kind_not_allowed');
  expect(invalidKey('invalid', [{ field: 'valid_until', code: 'range' }])).toBe('r_e_valid_until');
  expect(invalidKey('invalid', [{ field: 'work_to', code: 'before_start' }])).toBe('r_e_dates');
  expect(invalidKey('invalid', [])).toBe('r_e_invalid');
});

test('the client reads a refusal\'s fields and version wherever the envelope puts them (top level or details)', async () => {
  const real = globalThis.fetch;
  try {
    const answer = (status: number, body: unknown) => {
      globalThis.fetch = (async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })) as typeof fetch;
    };
    answer(409, { code: 'quote_changed', version: 4 });
    let r = await rfqApi.quote({ token: TOKEN, session: null }, {});
    expect(!r.ok && r.error).toMatchObject({ status: 409, code: 'quote_changed', version: 4 });
    answer(422, { code: 'invalid', details: { fields: [{ field: 'lines.0.kind', code: 'kind_not_allowed' }, { bad: 1 }] } });
    r = await rfqApi.quote({ token: TOKEN, session: null }, {});
    expect(!r.ok && r.error.fields).toEqual([{ field: 'lines.0.kind', code: 'kind_not_allowed' }]);
    let seen: RequestInit | undefined;
    let seenUrl = '';
    globalThis.fetch = (async (u: string, init?: RequestInit) => { seen = init; seenUrl = u; return new Response('{"ok":true}', { status: 200 }); }) as typeof fetch;
    await rfqApi.withdraw({ token: TOKEN, session: 's'.repeat(43) }, 'q1', '00000000-0000-4000-8000-000000000001');
    expect(seenUrl).toBe('/t/api/rfq/withdraw');
    expect((seen?.headers as Record<string, string>)['X-Ticket-Token']).toBe(TOKEN);
    expect((seen?.headers as Record<string, string>)['X-Ticket-Session']).toBe('s'.repeat(43));
    expect(JSON.parse(String(seen?.body))).toEqual({ quote_id: 'q1', client_request_id: '00000000-0000-4000-8000-000000000001' });
    expect(seen?.credentials).toBe('omit');
  } finally {
    globalThis.fetch = real;
  }
});

// ---------------------------------------------------------------- the building's days

test('valid_until is the END of the chosen day in the building zone; work dates its start - across the DST change', () => {
  expect(dayEndIso('2026-10-20', ZONE)).toBe('2026-10-20T20:59:59Z'); // UTC+3
  expect(dayEndIso('2026-10-26', ZONE)).toBe('2026-10-26T21:59:59Z'); // after the change to UTC+2
  expect(dayStartIso('2026-10-20', ZONE)).toBe('2026-10-19T21:00:00Z');
  expect(dayStartIso('2026-10-26', ZONE)).toBe('2026-10-25T22:00:00Z');
  expect(dayEndIso('not a day', ZONE)).toBeNull();
  expect(isoToDay('2026-10-19T21:30:00Z', ZONE)).toBe('2026-10-20');
  expect(isoToDay(null, ZONE)).toBe('');
});

test('the wanted work window: a gentle warning outside it, nothing inside or without a window', () => {
  const wf = '2026-10-21T21:00:00Z'; // 22.10 local
  const wt = '2026-10-27T22:00:00Z'; // 28.10 local
  expect(outsideWindow('2026-10-23', '2026-10-25', wf, wt, ZONE)).toBe(false);
  expect(outsideWindow('2026-10-22', '2026-10-28', wf, wt, ZONE)).toBe(false);
  expect(outsideWindow('2026-10-21', '', wf, wt, ZONE)).toBe(true);
  expect(outsideWindow('', '2026-10-29', wf, wt, ZONE)).toBe(true);
  expect(outsideWindow('2026-10-01', '2026-10-02', null, null, ZONE)).toBe(false);
});

test('time left until the deadline; none once it passed', () => {
  const now = Date.UTC(2026, 9, 16, 9, 0);
  expect(timeLeft('2026-10-18T12:30:00Z', now)).toEqual({ d: 2, h: 3, m: 30 });
  expect(timeLeft('2026-10-16T09:45:00Z', now)).toEqual({ d: 0, h: 0, m: 45 });
  expect(timeLeft('2026-10-16T08:00:00Z', now)).toBeNull();
  expect(timeLeft(null, now)).toBeNull();
});

// ---------------------------------------------------------------- the wire body (15.4)

test('the quote body: inputs only (never a total), base_version null for a first quote, the request id, valid_until as an instant', () => {
  const v = view();
  const d = freshDraft(v);
  expect(d.form.lines.map((l) => l.kind)).toEqual(['labor']);
  expect(d.form.lines[0].rate).toBe('150'); // his hourly rate prefilled
  d.form.lines[0].hours = '2';
  d.form.lines.push({ ...d.form.lines[0], key: 'p', kind: 'parts', description: ' מדחס ', hours: '', rate: '', quantity: '1', unit_price: '800' });
  d.validUntil = '2026-11-15';
  d.workFrom = '2026-10-23';
  d.form.vendor_ref = ' Q-7 ';
  d.form.notes = 'שורה\n\n\n\nשנייה';
  const b = quoteWire(d, v, '00000000-0000-4000-8000-000000000001');
  expect(b).toEqual({
    lines: [{ kind: 'labor', hours: '2', rate: '150' }, { kind: 'parts', description: 'מדחס', quantity: '1', unit_price: '800' }],
    amounts_include_vat: false, work_from: '2026-10-22T21:00:00Z', valid_until: '2026-11-15T21:59:59Z', note: 'שורה\n\nשנייה', vendor_ref: 'Q-7',
    base_version: null, client_request_id: '00000000-0000-4000-8000-000000000001',
  });
  expect(JSON.stringify(b)).not.toMatch(/total|_minor|subtotal|vat_minor|documents|no_charge|notes/);
});

test('the quote body: the currency only when there is a choice; no VAT choice when exempt; base_version names the live version', () => {
  const multi = view({ form: { ...FORM, currencies: ['ILS', 'USD'] } });
  const d = freshDraft(multi);
  d.form.lines[0].hours = '1';
  d.form.currency = 'USD';
  expect(quoteWire(d, multi, 'x').currency).toBe('USD');
  const exempt = view({ form: { ...FORM, vat: { exempt: true, rate_bp: 0, default: 'none' } } });
  expect('amounts_include_vat' in quoteWire(freshDraft(exempt), exempt, 'x')).toBe(false);
  expect(quoteWire(d, view({ quote: quote() }), 'x').base_version).toBe(2);
  expect(quoteWire(d, view({ quote: quote({ state: 'withdrawn' }) }), 'x').base_version).toBeNull();
  expect(baseVersion(null)).toBeNull();
  expect(baseVersion(quote({ version: 5 }))).toBe(5);
});

test('"update" starts from his own inputs (only the allowed kinds), and the checks name what the server would refuse', () => {
  const v = view();
  const d = draftFromQuote(quote(), v);
  expect(d.form.lines.map((l) => [l.kind, l.hours || l.quantity, l.rate || l.unit_price])).toEqual([['labor', '8', '150'], ['parts', '2', '3200']]); // travel is not allowed here
  expect(d.form.include_vat).toBe(true);
  expect(d.form.notes).toBe('כולל פינוי');
  expect(d.form.vendor_ref).toBe('Q-1');
  expect(d.workFrom).toBe('2026-10-23');
  expect(d.validUntil).toBe('2026-11-15');
  const now = Date.UTC(2026, 9, 16, 9, 0);
  expect(draftProblems(d, v, now)).toEqual([]);
  d.workTo = '2026-10-22';
  expect(draftProblems(d, v, now).map((e) => e.field)).toContain('work_to');
  d.workTo = '';
  d.validUntil = '2026-10-15';
  expect(draftProblems(d, v, now).map((e) => e.field)).toContain('valid_until');
  d.validUntil = '2028-01-01';
  expect(draftProblems(d, v, now).map((e) => e.field)).toContain('valid_until');
  d.validUntil = '';
  d.form.lines.push({ ...d.form.lines[0], kind: 'other', description: 'x', amount: '5' });
  expect(draftProblems(d, v, now).some((e) => e.code === 'kind_not_allowed')).toBe(true);
  expect(rfqKinds(view({ form: { ...FORM, allowed_kinds: ['other', 'labor', 'travel'] } }))).toEqual(['labor', 'travel', 'other']);
});

test('a write keeps its request id while the content is the same (a retry), a new id when the content changed', () => {
  let n = 0;
  const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const sig = bodySig({ lines: [], client_request_id: 'a' });
  expect(sig).toBe(bodySig({ lines: [], client_request_id: 'b' }));
  const first = cridFor(null, sig, id);
  expect(cridFor(first, sig, id)).toBe(first);
  expect(cridFor(first, bodySig({ lines: [1] }), id).crid).not.toBe(first.crid);
});

test('a kept draft survives a reload; a tampered one is no draft', () => {
  const d = freshDraft(view());
  d.validUntil = '2026-11-01';
  expect(parseRfqDraft(JSON.stringify(d))?.validUntil).toBe('2026-11-01');
  expect(parseRfqDraft('{bad')).toBeNull();
  expect(parseRfqDraft(JSON.stringify({ form: { lines: [{ kind: 'evil' }] } }))?.form.lines).toEqual([]);
  expect(parseRfqDraft(JSON.stringify({ form: { lines: [] }, validUntil: '../../x' }))?.validUntil).toBe('');
});

// ---------------------------------------------------------------- the words and the guards

test('every language has every key; the owner vocabulary - never the retired cost word, no English abbreviation in Hebrew, no branding', () => {
  const keys = Object.keys(RFQ_TEXT.he);
  for (const l of LANGS) for (const k of keys) expect(RFQ_TEXT[l][k as keyof typeof RFQ_TEXT.he], `${l}.${k}`).toBeTruthy();
  expect(RFQ_TEXT.he.kind).toBe('בקשה להצעת מחיר');
  expect(RFQ_TEXT.he.closedTitle).toBe('הבקשה נסגרה');
  expect(RFQ_TEXT.he.cancelledTitle).toBe('הבקשה בוטלה');
  const all = JSON.stringify(RFQ_TEXT);
  expect(all).not.toContain('דרישת עלות');
  expect(all).not.toMatch(/קריא|Home Assistant|\bHA\b/i);
  expect(JSON.stringify(RFQ_TEXT.he)).not.toMatch(/RFQ/);
});

/** A source without its comments (the guards read the code, not the words that explain it). */
function code(file: string): string {
  return readFileSync(path.join(SRC, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
}

test('the RFQ chunk builds DOM from text nodes only, never imports the app, builds no link, keeps nothing in localStorage', () => {
  const files = readdirSync(SRC).filter((x) => x.endsWith('.ts'));
  expect(files.sort()).toEqual(['rfq-files.ts', 'rfq-page.ts', 'rfq-state.ts', 'rfq-text.ts']);
  for (const f of files) {
    // RFQATT: the ONE reviewed W20 exception - rfq-files.ts `save()` hands a blob of OUR fetch to the browser's save dialog through an
    // anchor that is never attached to the page; the rest of that file (and every other file) builds no link
    const raw = code(f);
    const src = f === 'rfq-files.ts' ? raw.replace(/function save\(blob: Blob, name: string\): void \{[\s\S]*?\n\}/, '') : raw;
    if (f === 'rfq-files.ts') {
      expect(src.length, 'save() was found and cut out').toBeLessThan(raw.length);
      expect(raw.match(/createElement\(['"]a['"]\)/g)?.length ?? 0).toBe(1);
      expect(raw).toContain("type: 'application/octet-stream'"); // a document can never render inline
    }
    expect(src, f).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write|unsafeHTML|new Function|eval\(/);
    expect(src, f).not.toMatch(/from '\.\.\/\.\.\/(shell|api|components|screens|design|arx|pwa|i18n|tickets)\//);
    expect(src, f).not.toMatch(/localStorage|document\.cookie|serviceWorker/);
    expect(src, f).not.toMatch(/createElement\(['"]a['"]\)|h\(['"]a['"]|\.href\s*=/);
    expect(src, f).not.toMatch(/\buser_id\b|\busername\b|\bprincipal\b/);
  }
  // the entry chunk loads the RFQ chunk lazily (the ticket page never fetches it)
  const main = readFileSync(path.resolve(HERE, '../src/public-ticket/main.ts'), 'utf8');
  expect(main).toContain("import('./rfq/rfq-page')");
  expect(main).not.toMatch(/from '\.\/rfq\//);
  // RFQATT: the ticket page loads the request files' chunk lazily too (only when a work order referenced files)
  expect(main).toContain("import('./rfq/rfq-files')");
});

// ---------------------------------------------------------------- the manager board: the per-vendor verification-code switch (15.6)

test('board code switch: the demo store follows 15.6 - on / off, the directory\'s demand cannot be lowered, removed vendors refuse', async () => {
  resetDemoRfq();
  const id = 'rfq0000000000007';
  let d = await mockRfq.get(id);
  const alon = d.vendors.find((v) => v.id === 'rv-alon')!;
  expect(alon.require_code).toBe(false);
  expect(alon.channel_choice).toBe('auto');
  d = await mockRfq.vendorOptions(id, alon.id, { revision: d.revision, require_code: true });
  expect(d.vendors.find((v) => v.id === 'rv-alon')!.require_code).toBe(true);
  d = await mockRfq.vendorOptions(id, alon.id, { revision: d.revision, require_code: false });
  expect(d.vendors.find((v) => v.id === 'rv-alon')!.require_code).toBe(false);
  const err = await mockRfq.vendorOptions(id, 'rv-kortek', { revision: d.revision, require_code: false }).catch((e: unknown) => e);
  expect(err instanceof ApiError && err.status === 409 && err.code === 'vendor_code_locked').toBe(true);
  const stale = await mockRfq.vendorOptions(id, alon.id, { revision: d.revision - 1, require_code: true }).catch((e: unknown) => e);
  expect(stale instanceof ApiError && stale.code === 'rfq_stale').toBe(true);
  expect(refusalKey('vendor_code_locked')).toBe('err_vendor_code_locked');
  expect(RFQ_TEXT_KEYS).toContain('err_vendor_code_locked');
  const board = readFileSync(path.resolve(HERE, '../src/tickets/rfq-board.ts'), 'utf8');
  expect(board).toContain('vendorOptions(');
  expect(board).toMatch(/vendor_options/);
});
