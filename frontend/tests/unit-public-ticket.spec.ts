import { test, expect } from '@playwright/test';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { afterFailure, afterStep, bootFrom, codeMessage, parseDraft, phaseOf, planSend, statusChoices, validSession, type Draft } from '../src/public-ticket/state';
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
    .toEqual(['in_progress', 'waiting_part', 'done']);
  expect(statusChoices(view({ status: 'closed', actions: { statuses: [], note: false, eta: false, photo: false, return: false } }))).toEqual([]);
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
    expect(src, f).not.toMatch(/localStorage|document\.cookie|serviceWorker/);
    expect(src, f).not.toMatch(/createElement\(['"]a['"]\)|h\(['"]a['"]/); // no link is ever built (W20: no auto-linkify)
  }
  const html = readFileSync(path.resolve(HERE, '../public-ticket.html'), 'utf8');
  expect(html).not.toMatch(/<style|\sstyle=|\son[a-z]+=|<script>(?!<\/script>)/i);
  expect(html).toContain('<meta name="referrer" content="no-referrer" />');
});

test('a built bundle is outside www, script- and style-file only, and within the 60 KB gzip budget', () => {
  const out = path.resolve(HERE, '../../smplwise_vms/www-public');
  expect(existsSync(path.resolve(HERE, '../../smplwise_vms/www/t'))).toBe(false);
  test.skip(!existsSync(path.join(out, 'index.html')), 'not built here (npm run build:public:addon)');
  const html = readFileSync(path.join(out, 'index.html'), 'utf8');
  expect(html).not.toMatch(/<style|style=|<script>(?!<\/script>)|<script(?![^>]*src=)/i);
  let gz = 0;
  for (const f of readdirSync(path.join(out, 'assets'))) {
    const p = path.join(out, 'assets', f);
    if (statSync(p).isFile() && /\.(js|css)$/.test(f)) gz += gzipSync(readFileSync(p)).length;
    expect(f).toMatch(/^[A-Za-z0-9][A-Za-z0-9_.-]*\.(js|css|svg|png|ico)$/); // the listener's asset name rule
  }
  expect(gz).toBeLessThanOrEqual(60 * 1024);
});
