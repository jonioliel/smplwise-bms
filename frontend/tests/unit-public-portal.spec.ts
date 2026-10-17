import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalRoot, cleanCode, demandKeys, isView, money, plausiblePhone, quoteKey, refusal, split, type PortalItem } from '../src/public-ticket/portal/portal-model';
import { PORTAL_TEXT, isPortalKey, pt } from '../src/public-ticket/portal/portal-text';
import { LANGS } from '../src/public-ticket/strings';

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
