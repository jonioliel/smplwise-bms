import { test, expect } from '@playwright/test';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { afterFailure, afterStep, bootFrom, codeMessage, linkKind, lineOf, parseDraft, partToggle, phaseOf, planSend, primaryAction, statusChoices, statusLine, validSession, type Draft } from '../src/public-ticket/state';
import { CATALOGUES, LANGS, preferredLang, RTL, renderName, text, type Key } from '../src/public-ticket/strings';
import { etaFor, instantOf, isoToLocalInput, localInputToIso, zonedParts } from '../src/public-ticket/time';
import type { ApiFailure, TicketView } from '../src/public-ticket/api';

// CR-038 slice 4: the handler page's pure logic (node only) and the guards of its bundle.
//   npx playwright test -c playwright.unit.config.ts tests/unit-public-ticket.spec.ts

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '../src/public-ticket');
const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz012345';
const fail = (status: number, code: string, extra: Partial<ApiFailure> = {}): ApiFailure => ({ status, code, retryAfter: 0, attemptsLeft: null, offline: false, ...extra });
const view = (over: Partial<TicketView> = {}): TicketView => ({
  number: 1042, department: 'אחזקה', organization: 'מגדלי הדר', lang: 'he', dir: 'rtl', labels: { one: 'בקשת שירות', many: 'בקשות שירות', gender: 'f' },
  time_zone: 'Asia/Jerusalem', code_required: false, code_ok: true, read_only: false, expires_at: '2026-11-01T00:00:00Z', status: 'assigned', eta_at: null,
  actions: { statuses: ['acknowledged', 'in_progress'], note: true, eta: true, photo: true, return: true }, ...over,
});

// ---------------------------------------------------------------- where the token comes from (spec 10.2)

test('the token comes from the fragment, a redeem path, or this tab - nothing malformed is ever used', () => {
  expect(bootFrom(`#${TOKEN}`, '/t/', null)).toEqual({ token: TOKEN, rid: null, fromFragment: true });
  expect(bootFrom('', `/t/r/${'a'.repeat(32)}`, null)).toEqual({ token: null, rid: 'a'.repeat(32), fromFragment: false });
  expect(bootFrom('', '/t/', TOKEN)).toEqual({ token: TOKEN, rid: null, fromFragment: false });
  for (const bad of ['#short', `#${TOKEN}x`, '#<script>', `#${TOKEN.slice(0, 31)}=`]) expect(bootFrom(bad, '/t/', null).token).toBeNull();
  expect(bootFrom('', '/t/r/../../x', null)).toEqual({ token: null, rid: null, fromFragment: false });
  expect(bootFrom('', '/t/', 'tampered value')).toEqual({ token: null, rid: null, fromFragment: false });
  expect(validSession('x'.repeat(43))).toBe('x'.repeat(43));
  expect(validSession('x'.repeat(42))).toBeNull();
});

// ---------------------------------------------------------------- which screen

test('a ticket answer: code first, then the read-only grace, else the page', () => {
  expect(phaseOf(view({ code_required: true, code_ok: false }))).toBe('code');
  expect(phaseOf(view({ code_required: true, code_ok: true }))).toBe('ready');
  expect(phaseOf(view({ read_only: true }))).toBe('readonly');
  expect(phaseOf(view())).toBe('ready');
});

test('a 404 is always the uniform unavailable screen and forgets the token; a 429 never says unavailable', () => {
  expect(afterFailure(fail(404, 'link_unavailable'), 'ready')).toEqual({ phase: 'unavailable', message: null, forget: true, reload: false });
  const busy = afterFailure(fail(429, 'rate_limited'), 'ready');
  expect(busy.phase).toBe('ready');
  expect(busy.message).toBe('e_rate_limited');
  expect(afterFailure(fail(429, 'rate_limited'), 'loading').phase).toBe('busy');
  expect(afterFailure(fail(429, 'busy'), 'ready').message).toBe('e_busy');
  expect(afterFailure(fail(0, 'offline', { offline: true }), 'ready')).toEqual({ phase: 'ready', message: 'savedOffline', forget: false, reload: false });
  expect(afterFailure(fail(403, 'code_required'), 'ready')).toMatchObject({ phase: 'code', reload: true });
  expect(afterFailure(fail(409, 'read_only'), 'ready')).toMatchObject({ message: 'e_read_only', reload: true });
  expect(afterFailure(fail(415, 'webp_refused'), 'ready').message).toBe('e_webp_refused');
  expect(afterFailure(fail(415, 'heic_refused'), 'ready').message).toBe('e_heic_refused');
  expect(afterFailure(fail(413, 'too_large'), 'ready').message).toBe('e_too_large');
  expect(afterFailure(fail(500, 'server_error'), 'ready').message).toBe('e_generic');
});

test('the code screens name the refusal', () => {
  expect(codeMessage(fail(422, 'code_invalid', { attemptsLeft: 3 }))).toEqual({ key: 'codeWrong', n: 3 });
  expect(codeMessage(fail(429, 'code_locked', { retryAfter: 1800 }))).toEqual({ key: 'codeLocked', n: 30 });
  expect(codeMessage(fail(503, 'code_unavailable'))).toEqual({ key: 'codeUnavailable' });
  expect(codeMessage(fail(422, 'code_expired'))).toEqual({ key: 'codeExpired' });
});

// ---------------------------------------------------------------- the offline-safe update

test('an update keeps its request ids until confirmed: a retry is the SAME request', () => {
  let n = 0;
  const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const d0: Draft = { status: 'in_progress', note: 'הגעתי', eta: '2026-10-15T09:00:00Z', crids: {} };
  const first = planSend(d0, view(), id);
  expect(first.steps.map((s) => s.kind)).toEqual(['status', 'eta']);
  expect(first.steps[0]).toMatchObject({ kind: 'status', status: 'in_progress', note: 'הגעתי' });
  const retry = planSend(first.draft, view(), id);
  expect(retry.steps.map((s) => s.crid)).toEqual(first.steps.map((s) => s.crid)); // same ids: the server replays, never twice
  const afterStatus = afterStep(retry.draft, retry.steps[0]);
  expect(afterStatus).toMatchObject({ status: null, note: '' });
  const rest = planSend(afterStatus, view(), id);
  expect(rest.steps.map((s) => [s.kind, s.crid])).toEqual([['eta', first.steps[1].crid]]);
  expect(planSend({ status: null, note: '   ', eta: undefined, crids: {} }, view(), id).steps).toEqual([]);
  expect(planSend({ status: null, note: 'רק הערה', eta: undefined, crids: {} }, view(), id).steps[0].kind).toBe('note');
  expect(planSend({ status: 'assigned', note: '', eta: null, crids: {} }, view({ eta_at: null }), id).steps).toEqual([]);
});

test('a stored draft survives a reload; a tampered one is an empty draft', () => {
  const d: Draft = { status: 'done', note: 'x', eta: null, crids: { status: '00000000-0000-4000-8000-000000000001' } };
  expect(parseDraft(JSON.stringify(d))).toEqual({ ...d, crids: { status: d.crids.status, note: undefined, eta: undefined } });
  expect(parseDraft('{not json')).toEqual({ status: null, note: '', eta: undefined, crids: {} });
  expect(parseDraft(JSON.stringify({ crids: { status: '../../evil' } })).crids.status).toBeUndefined();
});

test('the status buttons: the allowed moves plus the current one, in the line order', () => {
  expect(statusChoices(view())).toEqual(['acknowledged', 'in_progress']);
  expect(statusChoices(view({ status: 'in_progress', actions: { statuses: ['waiting_part', 'done'], note: true, eta: true, photo: true, return: true } })))
    .toEqual(['in_progress', 'done']);
  expect(statusChoices(view({ status: 'waiting_part', actions: { statuses: ['in_progress', 'done'], note: true, eta: true, photo: true, return: true } })))
    .toEqual(['in_progress', 'done']);
  expect(statusChoices(view({ status: 'closed', actions: { statuses: [], note: false, eta: false, photo: false, return: false } }))).toEqual([]);
});

test('2.5.6: the part wait is a toggle under "in progress": on / off, the draft it sets, and nothing where the server does not allow it', () => {
  const acts = (statuses: string[]) => ({ statuses, note: true, eta: true, photo: true, return: true });
  expect(partToggle(view({ status: 'in_progress', actions: acts(['waiting_part', 'done']) }), null)).toEqual({ on: false, next: 'waiting_part' });
  expect(partToggle(view({ status: 'in_progress', actions: acts(['waiting_part', 'done']) }), 'waiting_part')).toEqual({ on: true, next: null });
  expect(partToggle(view({ status: 'waiting_part', actions: acts(['in_progress', 'done']) }), null)).toEqual({ on: true, next: 'in_progress' });
  expect(partToggle(view({ status: 'waiting_part', actions: acts(['in_progress', 'done']) }), 'in_progress')).toEqual({ on: false, next: null });
  expect(partToggle(view({ status: 'acknowledged', actions: acts(['in_progress', 'waiting_part', 'done']) }), null)).toBeNull();
  expect(partToggle(view({ status: 'acknowledged', actions: acts(['in_progress', 'waiting_part', 'done']) }), 'in_progress')).toEqual({ on: false, next: 'waiting_part' });
  expect(partToggle(view({ status: 'in_progress', actions: acts(['done']) }), null)).toBeNull();
  expect(partToggle(view({ status: 'waiting_part', actions: acts([]) }), null)).toBeNull();
  expect(partToggle(view({ status: 'done', actions: acts([]) }), null)).toBeNull();
  expect(lineOf('waiting_part')).toBe('in_progress');
  expect(lineOf('done')).toBe('done');
  expect(lineOf(null)).toBeNull();
});

test('2.5.6: the toggle strings exist in all four languages; the part wait has no step button of its own', () => {
  for (const lang of LANGS) {
    for (const k of ['wait_mark', 'wait_back', 's_waiting_part'] as const) expect(CATALOGUES[lang][k], `${lang}.${k}`).toBeTruthy();
    expect(Object.keys(CATALOGUES[lang])).not.toContain('btn_waiting_part');
  }
});

// ---------------------------------------------------------------- the building's time (review C12)

test('ETA chips and the date input are read in the building zone, across a DST change', () => {
  const zone = 'Asia/Jerusalem';
  const noon = Date.UTC(2026, 9, 14, 9, 0); // 12:00 in Jerusalem (UTC+3)
  expect(etaFor('tomorrow', noon, zone)).toBe('2026-10-15T09:00:00Z');
  expect(etaFor('today', noon, zone)).toBe('2026-10-14T14:00:00Z'); // 17:00 local
  expect(localInputToIso('2026-10-25T12:00', zone)).toBe('2026-10-25T10:00:00Z'); // after the change to UTC+2
  expect(localInputToIso('2026-10-24T12:00', zone)).toBe('2026-10-24T09:00:00Z');
  expect(isoToLocalInput('2026-10-24T09:00:00Z', zone)).toBe('2026-10-24T12:00');
  expect(localInputToIso('not a date', zone)).toBeNull();
  const t = instantOf(2026, 3, 27, 3, 0, zone);
  expect(zonedParts(t, zone)).toMatchObject({ d: 27, h: 3 });
  const late = Date.UTC(2026, 9, 14, 20, 40); // 23:40 local: "today" becomes an hour from now
  expect(Date.parse(etaFor('today', late, zone))).toBeGreaterThan(late + 30 * 60000);
});

// ---------------------------------------------------------------- the words (D26, D33)

test('every language has every key; RTL for Hebrew and Arabic only', () => {
  const keys = Object.keys(CATALOGUES.he) as Key[];
  for (const l of LANGS) for (const k of keys) expect(CATALOGUES[l][k], `${l}.${k}`).toBeDefined();
  expect([...RTL].sort()).toEqual(['ar', 'he']);
});

test('before a ticket answers, the page speaks the browser\'s first language it knows (Hebrew otherwise)', () => {
  expect(preferredLang(['ru-RU', 'en-US'])).toBe('ru');
  expect(preferredLang(['fr-FR', 'ar-EG'])).toBe('ar');
  expect(preferredLang(['iw-IL'])).toBe('he');
  expect(preferredLang(['fr-FR', 'de'])).toBeNull();
  expect(preferredLang(null)).toBeNull();
});

test('D33: the module name comes from the labels with gender agreement; the default words are never written', () => {
  const male = { one: 'אירוע', many: 'אירועים', gender: 'm' };
  expect(text('he', 'closedTitle', {}, male)).toBe('אירוע נסגר, תודה');
  expect(text('he', 'closedTitle', {}, { one: 'בקשת שירות', many: 'בקשות שירות', gender: 'f' })).toBe('בקשת שירות נסגרה, תודה');
  expect(renderName('{ticket} {f:a|m:b|n:c}', { one: 'Заявка', many: 'Заявки', gender: 'n' })).toBe('Заявка c');
  // a word a person reads - not a protocol name like the X-Ticket-Token header or a type name like TicketView
  const defaults = /קריא[הות]|קריאת|בקש(?:ת|ות) ה?שירות|ניהול השירות|(?<![-\w])Tickets?(?![-\w])|بلاغ|Заявк/;
  for (const f of readdirSync(SRC).filter((x) => x.endsWith('.ts'))) {
    expect(defaults.test(code(f)), `${f} writes a default module word`).toBe(false);
  }
});

/** A page source without its comments (the guards read the code, not the words that explain it). */
function code(file: string): string {
  return readFileSync(path.join(SRC, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
}

test('variables never become tokens: a typed title with braces stays text', () => {
  expect(text('he', 'sentBy', { who: '{ticket} {f:x|m:y}' }, { one: 'X', many: 'Y', gender: 'f' })).toBe('נשלחה על ידי {ticket} {f:x|m:y}');
  expect(text('he', 'sentBy', { who: 'יוני' }, { one: 'אירוע', many: 'אירועים', gender: 'm' })).toBe('נשלח על ידי יוני');
});

// ---------------------------------------------------------------- the bundle's guards (W16, W20, spec 5)

test('the page builds DOM from text nodes only and never imports the app', () => {
  for (const f of readdirSync(SRC).filter((x) => x.endsWith('.ts'))) {
    const src = code(f);
    expect(src, f).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write|unsafeHTML|new Function|eval\(/);
    expect(src, f).not.toMatch(/from '\.\.\/(shell|api|components|screens|design|arx|pwa|i18n|tickets)\//);
    // TK259: localStorage is allowed in theme.ts ONLY (the vendor's light / dark choice, every access in try/catch); never a cookie
    expect(src, f).not.toMatch(f === 'theme.ts' ? /document\.cookie|serviceWorker/ : /localStorage|document\.cookie|serviceWorker/);
    expect(src, f).not.toMatch(/createElement\(['"]a['"]\)|h\(['"]a['"]/); // no link is ever built (W20: no auto-linkify)
  }
  const html = readFileSync(path.resolve(HERE, '../public-ticket.html'), 'utf8');
  expect(html).not.toMatch(/<style|\sstyle=|\son[a-z]+=|<script>(?!<\/script>)/i);
  expect(html).toContain('<meta name="referrer" content="no-referrer" />');
});

test('a built bundle is outside www, script- and style-file only, and within the 62 KB gzip budget (2.9.0: was 61, TKPOLISH: was 60)', () => {
  const out = path.resolve(HERE, '../../smplwise_vms/www-public');
  expect(existsSync(path.resolve(HERE, '../../smplwise_vms/www/t'))).toBe(false);
  test.skip(!existsSync(path.join(out, 'index.html')), 'not built here (npm run build:public:addon)');
  const html = readFileSync(path.join(out, 'index.html'), 'utf8');
  expect(html).not.toMatch(/<style|style=|<script>(?!<\/script>)|<script(?![^>]*src=)/i);
  // TKRFQVP: the vendor RFQ page is a lazy chunk (`rfq-page-*`) a ticket link never fetches - it has its own budget; the 60 KB stays
  // the ticket page's
  // VPORTAL: the vendor portal is a lazy chunk + its own stylesheet (`portal-page-*`), fetched only on the bare page address - its own
  // budget too
  let gz = 0;
  let rfq = 0;
  let rfqTerms = 0;
  let rfqUpload = 0;
  let portal = 0;
  let portalMore = 0;
  let consent = 0;
  let claimPrefill = 0;
  for (const f of readdirSync(path.join(out, 'assets'))) {
    const p = path.join(out, 'assets', f);
    if (statSync(p).isFile() && /\.(js|css)$/.test(f)) {
      const n = gzipSync(readFileSync(p)).length;
      // CR-CLAIM-PREFILL: the demand loaded from the approved quote - a lazy chunk the claim step fetches only when the claim carries
      // `prefill` (an approved quote on the link's assignment); its own 3 KB cap, so the 61 KB ticket page never grows for it
      if (/^claim-prefill[-.]/.test(f)) claimPrefill += n;
      // integ/264 (budget decision a): the payment-terms module is a lazy chunk the vendor page fetches only with the switch on -
      // its own 3 KB cap, booked BEFORE the rfq rule so that rule measures the common path (page + files) only
      else if (/^rfq-page-terms[-.]/.test(f)) rfqTerms += n;
      // RFQ-VENDOR-UPLOAD: the vendor's own files on his quote - a lazy chunk fetched only with the installation switch on; its own 5 KB cap (quote + question-with-files UI)
      else if (/^rfq-upload[-.]/.test(f)) rfqUpload += n;
      // RFQATT: `rfq-files-*` (the request's files) belongs to the RFQ page; a ticket link fetches it only when a work order referenced files
      else if (/^rfq-(page|files)[-.]/.test(f)) rfq += n;
      // VPORTALRFQ: the portal's extra sections (open RFQs, technician requests) - a lazy chunk fetched after sign-in only while a
      // section is on; its own 6 KB cap, so the portal page keeps its 12 KB and the ticket page its 61 KB
      else if (/^portal-more[-.]/.test(f)) portalMore += n;
      else if (/^portal-page[-.]/.test(f)) portal += n;
      else if (/^consent-(page|text)[-.]/.test(f)) consent += n; // WA-CONSENT-LINK: the consent page's lazy chunk + stylesheet, its own cap
      else gz += n;
    }
    expect(f).toMatch(/^[A-Za-z0-9][A-Za-z0-9_.-]*\.(js|css|svg|png|ico)$/); // the listener's asset name rule
  }
  // 2.9.0 release: 61 -> 62 KB. The "ask the manager" switch and "back to the list" (four languages each) grew the ticket page to
  // 62,858 B gzip (394 B over 61 KB); no dead code to trim, the growth is the feature. Headroom now 630 B.
  expect(gz).toBeLessThanOrEqual(62 * 1024);
  expect(rfq).toBeLessThanOrEqual(20 * 1024);
  expect(rfqTerms).toBeLessThanOrEqual(3 * 1024);
  expect(rfqUpload).toBeLessThanOrEqual(5 * 1024);
  expect(portal).toBeLessThanOrEqual(12 * 1024);
  expect(portalMore).toBeLessThanOrEqual(6 * 1024);
  expect(consent).toBeLessThanOrEqual(5 * 1024);
  expect(claimPrefill).toBeLessThanOrEqual(3 * 1024);
});

test('2.5.4: a redeem path behind a one-segment public prefix is read like /t/r/<rid>; deeper or odd prefixes are not', () => {
  const rid = 'b'.repeat(32);
  expect(bootFrom('', `/support/r/${rid}`, null)).toEqual({ token: null, rid, fromFragment: false });
  expect(bootFrom('', `/support/r/${rid}/`, null).rid).toBe(rid);
  for (const bad of [`/a/b/r/${rid}`, `/Support/r/${rid}`, `/x/r/${rid}`, `//r/${rid}`, `/support/r/${rid}x`]) expect(bootFrom('', bad, null).rid).toBeNull();
});

// ---------------------------------------------------------------- TKSTAFF1: the staff link is the handler page unchanged (security design 6, items 17-20)

test('TKSTAFF1 17: the page renders no link and no user identifier - a staff view is the external view', () => {
  for (const f of readdirSync(SRC).filter((x) => x.endsWith('.ts'))) {
    const src = code(f);
    expect(src, f).not.toMatch(/\buser_id\b|\busername\b|\bactor_user_id\b|\bprincipal\b/);
    expect(src, f).not.toMatch(/createElement\(['"]a['"]\)|\.href\s*=/);
  }
  // the staff view carries no claim block: the page then shows no claim step
  const v = view({ actions: { statuses: ['acknowledged'], note: true, eta: false, photo: true, return: true } });
  expect('claim' in v).toBe(false);
  expect(phaseOf(v)).toBe('ready');
});

test('TKSTAFF1 18 / 19: a 404 forgets the token; "סיום" clears the token, the code session and the draft', () => {
  expect(afterFailure(fail(404, 'link_unavailable'), 'ready').forget).toBe(true);
  expect(afterFailure(fail(404, 'link_unavailable'), 'code').forget).toBe(true);
  const main = code('main.ts');
  const forget = main.slice(main.indexOf('private forget(): void {'), main.indexOf('private saveDraft(): void {'));
  expect(forget).toContain('this.setToken(null)');
  expect(forget).toContain('store(STORE.session, null)');
  expect(forget).toContain('store(STORE.draft, null)');
  const finish = main.slice(main.indexOf('private finish(): void {'), main.indexOf('private setLang('));
  expect(finish).toContain('this.forget()');
  expect(main).toMatch(/if \(next\.forget\) this\.forget\(\)|next\.forget/);
});

// ---------------------------------------------------------------- TKUI5: one component, the layout chosen by the link's kind

test('TKUI5: the kind comes from the claim key - a vendor link always has it (even null), a staff link never does', () => {
  expect(linkKind(view({ title: 'x', claim: null }))).toBe('vendor');
  expect(linkKind(view({ title: 'x', claim: { status: 'awaiting', required: false, writable: true, claim_until: null } }))).toBe('vendor');
  expect(linkKind(view({ title: 'x' }))).toBe('staff'); // no claim key at all
  expect(linkKind(view({ title: 'x', claim_mode: true }))).toBe('vendor'); // the claim mode of a dead link is a vendor's
  expect(linkKind(view({ code_required: true, code_ok: false }))).toBe('vendor'); // the code screen shows no content: nothing of the layout is visible
});

test('TKUI5: the one status line speaks in the vendor words and follows the quote and the payment demand', () => {
  const key = (over: Partial<TicketView>, quote: string | null = null) => statusLine(view({ claim: null, ...over }), quote).key;
  expect(key({ status: 'assigned' })).toBe('line_ack');
  expect(key({ status: 'acknowledged' })).toBe('line_received');
  expect(key({ status: 'acknowledged' }, 'rejected')).toBe('line_quote_fix');
  expect(key({ status: 'acknowledged' }, 'submitted')).toBe('line_quote_wait');
  expect(key({ status: 'acknowledged' }, 'approved')).toBe('line_quote_ok');
  expect(key({ status: 'in_progress' })).toBe('line_working');
  expect(key({ status: 'waiting_part' })).toBe('line_part');
  expect(key({ status: 'done' })).toBe('line_done');
  expect(key({ status: 'done', claim: { status: 'awaiting', required: false, writable: true, claim_until: null } })).toBe('line_demand_ask');
  expect(key({ status: 'done', claim: { status: 'awaiting', required: false, writable: false, claim_until: null } })).toBe('line_done');
  expect(key({ status: 'done', claim: { status: 'submitted', required: false, writable: false, claim_until: null } })).toBe('line_demand_wait');
  expect(key({ status: 'done', claim: { status: 'rejected', required: false, writable: true, claim_until: null } })).toBe('line_demand_fix');
  expect(key({ status: 'done', claim: { status: 'approved', required: false, writable: false, claim_until: null } })).toBe('line_demand_ok');
  expect(key({ status: 'done', claim: { status: 'paid', required: false, writable: false, claim_until: null } })).toBe('line_paid');
  expect(key({ status: 'closed', read_only: true })).toBe('line_closed');
  expect(statusLine(view({ status: 'assigned', claim: null }), null).tone).toBe('acc');
  for (const l of LANGS) for (const k of ['line_ack', 'line_part', 'line_demand_ask', 'btn_ack', 'btn_quote_fix', 'btn_demand', 'prelim'] as Key[]) expect(CATALOGUES[l][k].length).toBeGreaterThan(2);
});

test('TKUI5: the ONE primary - a draft wins, then receipt, a quote correction, the payment demand, else the update; none when nothing can be written', () => {
  const v = (over: Partial<TicketView>) => view({ claim: null, ...over });
  expect(primaryAction(v({ status: 'assigned' }), 'vendor', false, null)).toBe('ack');
  expect(primaryAction(v({ status: 'assigned' }), 'staff', false, null)).toBe('ack');
  expect(primaryAction(v({ status: 'assigned' }), 'vendor', true, null)).toBe('send');
  expect(primaryAction(v({ status: 'assigned', actions: { statuses: ['in_progress'], note: true, eta: true, photo: true, return: true } }), 'vendor', false, null)).toBe('send');
  expect(primaryAction(v({ status: 'acknowledged' }), 'vendor', false, 'rejected')).toBe('quote_fix');
  expect(primaryAction(v({ status: 'acknowledged' }), 'staff', false, 'rejected')).toBe('send'); // staff has no quote
  const awaiting = { status: 'awaiting', required: false, writable: true, claim_until: null };
  expect(primaryAction(v({ status: 'done', claim: awaiting }), 'vendor', false, null)).toBe('demand');
  expect(primaryAction(v({ status: 'done', claim: { ...awaiting, status: 'rejected' } }), 'vendor', false, null)).toBe('demand');
  expect(primaryAction(v({ status: 'done', claim: { ...awaiting, status: 'submitted' } }), 'vendor', false, null)).toBe('send');
  expect(primaryAction(v({ status: 'done', claim: awaiting }), 'vendor', true, null)).toBe('send');
  expect(primaryAction(v({ status: 'closed', read_only: true, actions: undefined }), 'vendor', false, null)).toBe('none');
  expect(primaryAction(v({ claim_mode: true }), 'vendor', false, null)).toBe('none');
});

test('TKUI5: the cost words - "הצעת מחיר" before the work, "דרישת תשלום" after, never "דרישת עלות"; no module default name, no HA branding', () => {
  const all = JSON.stringify(CATALOGUES) + readFileSync(path.join(SRC, 'claim/quote-text.ts'), 'utf8');
  expect(all).not.toContain('דרישת עלות');
  expect(all).not.toMatch(/קריא/);
  expect(all).not.toMatch(/Home Assistant/i);
  expect(CATALOGUES.he.btn_quote_fix).toContain('הצעת המחיר');
  expect(CATALOGUES.he.btn_demand).toContain('דרישת תשלום');
});

// ---------------------------------------------------------------- TKFIX260 (release 2.6.0 review fixes)

test('TKFIX260: the explicit kind of the view wins over the claim-key guess; the guess stays for a view without it', () => {
  expect(linkKind(view({ title: 'x', kind: 'staff', claim: null }))).toBe('staff'); // the server says staff - a stray claim key does not make it a vendor
  expect(linkKind(view({ title: 'x', kind: 'vendor' }))).toBe('vendor'); // the server says vendor even without a claim key
  expect(linkKind(view({ title: 'x', kind: 'staff', claim_mode: true }))).toBe('vendor'); // the claim mode is a vendor's
  expect(linkKind(view({ code_required: true, code_ok: false }))).toBe('vendor'); // the code screen: no kind is sent
  expect(linkKind(view({ title: 'x' }))).toBe('staff'); // an older server: the claim-key fallback
});

test('TKFIX260: an on-behalf quote is labelled on the vendor card, and the note field holds what the server accepts', () => {
  const card = code('claim/quote-card.ts');
  expect(card).toContain("quote.on_behalf");
  expect(card).toContain("t('q_on_behalf')");
  expect(card).not.toMatch(/limits\.notes \?\? 1000\) \* 2/);
  expect(card).toMatch(/notes\.maxLength = s\?\.limits\.notes \?\? 1000;/);
  const texts = readFileSync(path.join(SRC, 'claim/quote-text.ts'), 'utf8');
  expect(texts.match(/q_on_behalf:/g)?.length).toBe(4); // he / en / ar / ru
  expect(texts).toContain("q_on_behalf: 'הוזן על ידי המנהל'");
});

test('TKQVALID: the vendor card shows the validity of the link\'s own quote (shown here; TKPOLISH below sends it), in four languages', () => {
  const card = code('claim/quote-card.ts');
  expect(card).toContain('quote.valid_until');
  expect(card).toContain("t('q_valid_until'");
  expect(card).toContain('Intl.DateTimeFormat(lang');
  expect(card).not.toMatch(/valid_until\s*[:=]\s*form/); // the form never sends it
  const texts = readFileSync(path.join(SRC, 'claim/quote-text.ts'), 'utf8');
  expect(texts.match(/q_valid_until:/g)?.length).toBe(4); // he / en / ar / ru
  expect(texts.match(/q_valid_until:[^\n]*\{date\}/g)?.length).toBe(4);
});

test('TKPOLISH: the quote form sends the optional work window and validity, validated like the server, in four languages', () => {
  const card = code('claim/quote-card.ts');
  expect(card).toContain("type = 'date'");
  expect(card).toContain('dataset.quoteDate');
  expect(card).toContain('body.work_from = ');
  expect(card).toContain('body.work_to = ');
  expect(card).toContain('body.valid_until = win.valid');
  expect(card).toMatch(/d \+ 367 \* DAY_MS/); // the server's horizon (WORK_HORIZON_DAYS 366 days ahead of now, a day back from d = now - 1 day)
  expect(card).toMatch(/win\.to < win\.from/); // the window order (422 order)
  expect(card).toContain('if (errs.length || windowError()) return;'); // nothing is sent while a date is out of range
  const texts = readFileSync(path.join(SRC, 'claim/quote-text.ts'), 'utf8');
  for (const k of ['q_work_from', 'q_work_to']) expect(texts.match(new RegExp(`${k}:`, 'g'))?.length, k).toBe(4);
});

// ---------------------------------------------------------------- "ask the manager" (CR-038 18A)

test('a question to the manager is its own call and never rides on the status', () => {
  let n = 0;
  const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const asked = planSend({ status: 'in_progress', note: 'איזה מזגן?', ask: true, eta: undefined, crids: {} }, view(), id);
  expect(asked.steps.map((s) => s.kind)).toEqual(['status', 'note']);
  expect(asked.steps[0]).toMatchObject({ kind: 'status', note: null });
  expect(asked.steps[1]).toMatchObject({ kind: 'note', text: 'איזה מזגן?', ask: true });
  const only = planSend({ status: null, note: 'איזה מזגן?', ask: true, eta: undefined, crids: {} }, view(), id);
  expect(only.steps).toHaveLength(1);
  expect(only.steps[0]).toMatchObject({ kind: 'note', ask: true });
  // a plain note (no ask) is unchanged: it carries no ask flag
  const plain = planSend({ status: null, note: 'בדרך', eta: undefined, crids: {} }, view(), id).steps[0];
  expect(plain.kind === 'note' && plain.ask).toBeFalsy();
  // the question is done once the note step is confirmed: the toggle resets
  const done = afterStep(only.draft, only.steps[0]);
  expect(done.note).toBe('');
  expect(done.ask).toBeFalsy();
  expect(parseDraft(JSON.stringify({ note: 'x', ask: true })).ask).toBe(true);
  expect(parseDraft(JSON.stringify({ note: 'x', ask: 'yes' })).ask).toBeUndefined();
});
