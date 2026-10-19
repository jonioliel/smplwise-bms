import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalRoot, cleanCode, demandKeys, isView, money, plausiblePhone, quoteKey, refusal, split, type PortalItem } from '../src/public-ticket/portal/portal-model';
import { PORTAL_TEXT, isPortalKey, pt } from '../src/public-ticket/portal/portal-text';
import { LANGS } from '../src/public-ticket/strings';
import { isRfqs, isTechs, plausibleName, techRefusal } from '../src/public-ticket/portal/portal-more-model';
import { MORE_TEXT, mt } from '../src/public-ticket/portal/portal-more-text';

// VPORTAL: the vendor portal's pure logic (node only) and the guards of its chunk.
//   npx playwright test -c playwright.unit.config.ts tests/unit-public-portal.spec.ts

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORTAL = path.resolve(HERE, '../src/public-ticket/portal');
const SRC = path.resolve(HERE, '../src/public-ticket');

function code(file: string): string {
  return readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
}

const item = (over: Partial<PortalItem> = {}): PortalItem => ({
  id: 'a'.repeat(24), number: 7, title: 'x', place: '', department: '', state: 'open', status: 'assigned', end_reason: null, created_at: '2026-10-01T00:00:00Z',
  assigned_at: '2026-10-01T00:00:00Z', ended_at: null, eta_at: null, quote: null, demand: null, can_open: true, ...over,
});

// ---------------------------------------------------------------- the guards (negative first)

test('the portal chunk builds DOM from text nodes only, never reads a cookie, never stores the session, never builds a link', () => {
  for (const f of readdirSync(PORTAL).filter((x) => x.endsWith('.ts'))) {
    const src = code(path.join(PORTAL, f));
    expect(src, f).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write|unsafeHTML|new Function|eval\(/);
    expect(src, f).not.toMatch(/document\.cookie|localStorage|sessionStorage|serviceWorker/); // the session is an HttpOnly cookie only
    expect(src, f).not.toMatch(/createElement\(['"]a['"]\)|h\(['"]a['"]|\.href\s*=|window\.open|location\.(assign|replace|href)/);
    expect(src, f).not.toMatch(/from '\.\.\/\.\.\/(shell|api|components|screens|design|arx|pwa|i18n|tickets)\//);
  }
  const page = code(path.join(PORTAL, 'portal-page.ts'));
  expect(page).toContain("credentials: 'same-origin'"); // the cookie travels; nothing else does
  expect(page).toContain("redirect: 'error'");
  expect(page).not.toMatch(/token\s*:\s*this|store\(|setItem/); // the handed-over handler token is never kept by the portal
});

test('VPORTALRFQ: the extra sections are a lazy chunk that calls only through the portal page and never keeps a token', () => {
  const more = code(path.join(PORTAL, 'portal-more.ts'));
  expect(more).not.toMatch(/fetch\(|XMLHttpRequest|withBase/); // every call goes through the page's own `call` (same-origin, no redirect)
  expect(more).not.toMatch(/token\s*:\s*this|this\.token|store\(|setItem/);
  const page = code(path.join(PORTAL, 'portal-page.ts'));
  expect(page).toMatch(/import\('\.\/portal-more'\)/); // never a static import: the chunk loads after sign-in, only with a section on
  expect(page).not.toMatch(/from '\.\/portal-more'/);
  expect(page).not.toMatch(/from '\.\/portal-more-(text|model)'/);
});

test('VPORTALRFQ: every language has every extra-section key, the same placeholders, and no word says whether a number is known', () => {
  const keys = Object.keys(MORE_TEXT.he).sort();
  for (const lang of LANGS) {
    expect(Object.keys(MORE_TEXT[lang]).sort()).toEqual(keys);
    for (const k of keys) {
      const vars = (s: string) => (s.match(/\{[a-z_]+\}/g) ?? []).sort();
      const v = MORE_TEXT[lang][k as keyof typeof MORE_TEXT.he];
      expect(vars(v), `${lang}.${k}`).toEqual(vars(MORE_TEXT.he[k as keyof typeof MORE_TEXT.he]));
      expect(v).not.toMatch(/already|כבר קיים|קיים במערכת|موجود|уже есть/i);
    }
  }
  expect(mt('he', 'techH', { company: '{tickets}' })).toContain('{tickets}'); // a value is never read as a token
});

test('VPORTALRFQ: technician-request refusals map to fixed words; 404 hands back to the list; shapes are checked', () => {
  expect(techRefusal(404, { code: 'link_unavailable' }, false)).toBe('gone');
  expect(techRefusal(0, null, true)).toBe('offline');
  expect(techRefusal(429, { code: 'rate_limited' }, false)).toBe('rate');
  expect(techRefusal(409, { code: 'tech_limit' }, false)).toBe('limit');
  expect(techRefusal(422, { code: 'invalid', fields: [{ field: 'phone', code: 'format' }] }, false)).toBe('badPhone');
  expect(techRefusal(422, { code: 'invalid', fields: [{ field: 'replaces', code: 'unknown' }] }, false)).toBe('badReplace');
  expect(techRefusal(422, { code: 'invalid', fields: [{ field: 'name', code: 'format' }] }, false)).toBe('badName');
  expect(techRefusal(500, null, false)).toBe('error');
  for (const ok of ['יוסי כהן', 'Yossi Cohen', 'Юрий', 'أحمد علي']) expect(plausibleName(ok), ok).toBe(true);
  for (const bad of ['', 'x', '12345', ' a ', 'י'.repeat(81)]) expect(plausibleName(bad), bad).toBe(false);
  expect(isRfqs({ items: [] }) && !isRfqs({ items: 'x' }) && !isRfqs(null)).toBe(true);
  expect(isTechs({ companies: [], limits: { name: 80, pending: 5 } }) && !isTechs({})).toBe(true);
});

test('the logo is a same-origin file named by the server\'s exact shape - nothing else reaches an image address', () => {
  const brand = code(path.join(SRC, 'brand.ts'));
  expect(brand).toContain("/^[0-9a-f]{16}\\.jpg$/");
  expect(brand).toMatch(/withBase\(`\/t\/brand\/\$\{logo\}`\)/);
});

test('the sign-in words never say whether a number is known', () => {
  for (const lang of LANGS) {
    const t = PORTAL_TEXT[lang];
    expect(t.sentIf.length).toBeGreaterThan(10);
    for (const k of Object.keys(t)) expect(t[k as keyof typeof t]).not.toMatch(/not registered|לא רשום|אינו רשום|غير مسجل|не зарегистрирован/i);
  }
});

test('every language has every key and the same placeholders', () => {
  const keys = Object.keys(PORTAL_TEXT.he).sort();
  for (const lang of LANGS) {
    expect(Object.keys(PORTAL_TEXT[lang]).sort()).toEqual(keys);
    for (const k of keys) {
      const vars = (s: string) => (s.match(/\{[a-z_]+\}/g) ?? []).sort();
      expect(vars(PORTAL_TEXT[lang][k as keyof typeof PORTAL_TEXT.he]), `${lang}.${k}`).toEqual(vars(PORTAL_TEXT.he[k as keyof typeof PORTAL_TEXT.he]));
    }
  }
  expect(pt('ru', 'resendIn', { s: 12 })).toContain('12');
  expect(pt('he', 'until', { when: '{tickets}' })).toContain('{tickets}'); // a value is never read as a token
  expect(isPortalKey('q_approved') && !isPortalKey('nope')).toBe(true);
});

// ---------------------------------------------------------------- the logic

test('refusals map to the uniform words: a wrong code, a rate limit with minutes, a bad number, offline', () => {
  expect(refusal({ status: 422, data: { code: 'code_invalid' }, offline: false })).toEqual({ key: 'badCode' });
  expect(refusal({ status: 422, data: { code: 'invalid', fields: [] }, offline: false })).toEqual({ key: 'badPhone' });
  expect(refusal({ status: 429, data: { code: 'rate_limited', retry_after_s: 125 }, offline: false })).toEqual({ key: 'rateLimited', minutes: 3 });
  expect(refusal({ status: 0, data: null, offline: true })).toEqual({ key: 'offline' });
  expect(refusal({ status: 500, data: null, offline: false })).toEqual({ key: 'error' });
});

test('the phone and code inputs accept what people type and nothing else', () => {
  for (const ok of ['050-900-7676', '+972 50 900 7676', '0509007676', '(050) 900-7676', '٠٥٠٩٠٠٧٦٧٦']) expect(plausiblePhone(ok), ok).toBe(true);
  for (const bad of ['', 'abc', '12', '050-900-76x6', '1'.repeat(16)]) expect(plausiblePhone(bad), bad).toBe(false);
  expect(cleanCode(' 123 456 ')).toBe('123456');
  expect(cleanCode('123-456')).toBe('123456');
  for (const bad of ['12345', '1234567', '12a456', '']) expect(cleanCode(bad)).toBeNull();
});

test('the address bar moves to the canonical root only for the bare / any-case root', () => {
  const js = 'https://t.example.test/support/assets/portal-page-AbCd1234.js';
  expect(canonicalRoot('/Support', js)).toBe('/support/');
  expect(canonicalRoot('/support', js)).toBe('/support/');
  expect(canonicalRoot('/SUPPORT/', js)).toBe('/support/');
  expect(canonicalRoot('/support/', js)).toBeNull();
  expect(canonicalRoot('/support/r/abc', js)).toBeNull();
  expect(canonicalRoot('/other/', js)).toBeNull();
  expect(canonicalRoot('/Support', 'http://localhost:5173/src/public-ticket/portal/portal-page.ts')).toBeNull(); // development: nothing
  expect(canonicalRoot('/Support', 'not a url')).toBeNull();
});

test('items split into open and finished; money lines say amount and paid / not paid', () => {
  const s = split([item(), item({ state: 'closed', status: 'closed' }), item({ state: 'closed', status: 'ended', end_reason: 'reassigned' })]);
  expect([s.open.length, s.closed.length]).toEqual([1, 2]);
  expect(quoteKey({ state: 'partially_approved', total_minor: 1, currency: 'ILS' })).toBe('q_partially_approved');
  expect(demandKeys({ status: 'paid', total_minor: 11000, currency: 'ILS', paid: true, no_charge: false })).toEqual({ amount: true, key: 'paid' });
  expect(demandKeys({ status: 'approved', total_minor: 11000, currency: 'ILS', paid: false, no_charge: false })).toEqual({ amount: true, key: 'unpaid' });
  expect(demandKeys({ status: 'awaiting', total_minor: null, currency: 'ILS', paid: false, no_charge: false })).toEqual({ amount: false, key: 'd_awaiting' });
  expect(demandKeys({ status: 'approved', total_minor: 0, currency: 'ILS', paid: false, no_charge: true })).toEqual({ amount: false, key: 'noCharge' });
  expect(money(11000, 'ILS', 'en')).toMatch(/110\.00/);
  expect(money(11000, 'XXX-bad', 'he')).toBe('110.00 XXX-bad');
  expect(isView({ items: [], expires_in_s: 10 })).toBe(true);
  expect(isView({ items: 'x' })).toBe(false);
});

test('vendor-portal-leftovers: an item opened from the portal offers "back to the list" in every language; a direct link never does', () => {
  const src = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/public-ticket/main.ts'), 'utf8');
  const strings = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/public-ticket/strings.ts'), 'utf8');
  expect(strings.match(/^ {2}backToList: /gm)?.length).toBe(LANGS.length);
  expect(src).toContain('this.fromPortal ? this.backToListButton() : null');
  expect(src).toMatch(/openFromPortal[\s\S]{0,200}this\.forget\(\);\s+this\.fromPortal = true;/);
  expect(src).toMatch(/private forget\(\): void \{\s+this\.fromPortal = false;/);
  expect(src).not.toMatch(/fromPortal = true[\s\S]*fromPortal = true/);
});
