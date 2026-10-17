import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONSENT_TEXT, DEV_MARKED, ct } from '../src/public-ticket/consent/consent-text';
import { pickMode, rfqFragment } from '../src/public-ticket/state';
import { LANGS } from '../src/public-ticket/strings';

// WA-CONSENT-LINK: the WhatsApp consent page's chunk - its guards (negative first), its words and the boot of a `#c.<token>` link.
//   npx playwright test -c playwright.unit.config.ts tests/unit-public-consent.spec.ts
// (outcomeOf lives in consent-page.ts, which imports a `?url` stylesheet node cannot load; its mapping is checked as source here.)

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(HERE, '../src/public-ticket/consent');
const SRC = path.resolve(HERE, '../src/public-ticket');
const TOKEN = 'A'.repeat(31) + '_';

function code(file: string): string {
  return readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
}

test('the consent chunk builds DOM from text nodes only, never stores the token, never sends a cookie, never builds a link', () => {
  for (const f of readdirSync(DIR).filter((x) => x.endsWith('.ts'))) {
    const src = code(path.join(DIR, f));
    expect(src, f).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write|unsafeHTML|new Function|eval\(/);
    expect(src, f).not.toMatch(/document\.cookie|localStorage|sessionStorage|serviceWorker|setItem/);
    expect(src, f).not.toMatch(/createElement\(['"]a['"]\)|h\(['"]a['"]|\.href\s*=|window\.open|location\.(assign|replace|href)/);
    expect(src, f).not.toMatch(/from '\.\.\/\.\.\/(shell|api|components|screens|design|arx|pwa|i18n|tickets)\//);
  }
  const page = code(path.join(DIR, 'consent-page.ts'));
  expect(page).toContain("credentials: 'omit'");
  expect(page).toContain("redirect: 'error'");
  expect(page).toContain("referrerPolicy: 'no-referrer'");
  expect(page).toContain("'X-Ticket-Token': token"); // the token travels in the header only (never a URL, never a body)
  expect(page).not.toMatch(/\?token=|token=\$\{/);
});

test('main.ts hands a consent link to the lazy chunk and never keeps its token in the tab', () => {
  const main = code(path.join(SRC, 'main.ts'));
  const branch = main.slice(main.indexOf("boot.mode === 'consent'"), main.indexOf("boot.mode === 'rfq'"));
  expect(branch).toContain("import('./consent/consent-page')");
  expect(branch).not.toMatch(/setToken|STORE\.token|STORE\.rfq|STORE\.session/);
});

test('a consent fragment is `#c.<token>` exactly; it never reads as a ticket or RFQ link and wins over a kept token', () => {
  expect(rfqFragment(`#c.${TOKEN}`, 'c.')).toBe(TOKEN);
  for (const bad of [`#${TOKEN}`, `#c.${TOKEN}x`, '#c.short', '#c.', `#C.${TOKEN}`, `#q.${TOKEN}`]) expect(rfqFragment(bad, 'c.'), bad).toBeNull();
  expect(pickMode(`#c.${TOKEN}`, '/support/', 'y'.repeat(32), 'z'.repeat(32))).toEqual({ mode: 'consent', token: TOKEN, rid: null, fromFragment: true });
  expect(pickMode(`#q.${TOKEN}`, '/t/', null, null).mode).toBe('rfq');
  expect(pickMode(`#${TOKEN}`, '/t/', null, null).mode).toBe('ticket');
  expect(pickMode('', '/t/', null, null).mode).toBe('ticket'); // nothing kept: a reload after the answer never reopens the consent
});

test('every language has every key and the same placeholders; ar / ru are dev-marked', () => {
  const keys = Object.keys(CONSENT_TEXT.he).sort();
  for (const lang of LANGS) {
    expect(Object.keys(CONSENT_TEXT[lang]).sort(), lang).toEqual(keys);
    for (const k of keys) {
      const vars = (s: string) => (s.match(/\{[a-z]+\}/g) ?? []).sort();
      expect(vars(CONSENT_TEXT[lang][k as keyof typeof CONSENT_TEXT.he]), `${lang}.${k}`).toEqual(vars(CONSENT_TEXT.he[k as keyof typeof CONSENT_TEXT.he]));
    }
  }
  expect([...DEV_MARKED].sort()).toEqual(['ar', 'ru']);
});

test('the notice promises no code or password and names the organisation; a value is never read as a placeholder', () => {
  for (const lang of LANGS) {
    expect(ct(lang, 'notice', { org: 'ORG' })).toContain('ORG');
    expect(ct(lang, 'noCode').length).toBeGreaterThan(10);
  }
  expect(ct('he', 'notice', { org: '{org}' })).toContain('{org}');
  expect(ct('en', 'revoke', { org: 'Acme' })).toBe('You can ask to stop the messages at any time through Acme.');
});

test('the answer mapping: 404 is the unavailable screen, 409 notice_changed reloads, 429 / offline keep the page', () => {
  const page = code(path.join(DIR, 'consent-page.ts'));
  const fn = page.slice(page.indexOf('export function outcomeOf'), page.indexOf('class Consent'));
  expect(fn).toContain("if (status === 404) return 'unavailable'");
  expect(fn).toContain("d.code === 'notice_changed') return 'reload'");
  expect(fn).toContain("if (status === 429) return 'rateLimited'");
  expect(fn).toContain("if (status === 0) return 'offline'");
});
