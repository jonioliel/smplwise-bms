import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEV_MARKED, DOC_TEXT, dt, safeName, sizeText } from '../src/public-ticket/doc/doc-text';
import { pickMode, rfqFragment } from '../src/public-ticket/state';
import { LANGS } from '../src/public-ticket/strings';

// CR-VENDORQ-294: the document page's chunk (a report sent by a temporary link) - its guards (negative first), its words and the boot
// of a `#d.<token>` link.
//   npx playwright test -c playwright.unit.config.ts tests/unit-public-doc.spec.ts
// (outcomeOf lives in doc-page.ts, which imports a `?url` stylesheet node cannot load; it is checked as source here.)

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(HERE, '../src/public-ticket/doc');
const SRC = path.resolve(HERE, '../src/public-ticket');
const TOKEN = 'A'.repeat(31) + '_';

function code(file: string): string {
  return readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
}

test('the document chunk builds DOM from text nodes only, never stores the token, never sends a cookie; its one link is a blob: URL', () => {
  for (const f of readdirSync(DIR).filter((x) => x.endsWith('.ts'))) {
    const src = code(path.join(DIR, f));
    expect(src, f).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write|unsafeHTML|new Function|eval\(/);
    expect(src, f).not.toMatch(/document\.cookie|localStorage|sessionStorage|serviceWorker|setItem/);
    expect(src, f).not.toMatch(/h\(['"]a['"]|\.href\s*=|window\.open|location\.(assign|replace|href)/);
    expect(src, f).not.toMatch(/from '\.\.\/\.\.\/(shell|api|components|screens|design|arx|pwa|i18n|tickets)\//);
  }
  const page = code(path.join(DIR, 'doc-page.ts'));
  expect(page).toContain("credentials: 'omit'");
  expect(page).toContain("redirect: 'error'");
  expect(page).toContain("referrerPolicy: 'no-referrer'");
  expect(page).toContain("'X-Ticket-Token': token");
  expect(page).not.toMatch(/\?token=|token=\$\{/);
  // the only anchor: created once, its href is the object URL, its name the server's checked name, revoked after the click
  expect(page.match(/createElement\('a'\)/g)?.length).toBe(1);
  expect(page).toContain("a.setAttribute('href', url)");
  expect(page).toContain('const url = URL.createObjectURL(blob)');
  // FABLEFIX-295 D-02: the blob is always opaque bytes, never the answer's own (possibly text/html) type
  expect(page).toContain("new Blob([buf], { type: 'application/octet-stream' })");
  expect(page).not.toMatch(/res\.blob\(\)/);
  expect(page).toContain('URL.revokeObjectURL(url)');
  expect(page).toContain("a.setAttribute('download', safeName(");
});

test('the answer mapping: 404 is the unavailable screen, 429 / offline keep the page', () => {
  const page = code(path.join(DIR, 'doc-page.ts'));
  const fn = page.slice(page.indexOf('export function outcomeOf'), page.indexOf('class DocPage'));
  expect(fn).toContain("if (status === 404) return 'unavailable'");
  expect(fn).toContain("if (status === 429) return 'rateLimited'");
  expect(fn).toContain("if (status === 0) return 'offline'");
});

test('main.ts hands a document link to the lazy chunk and never keeps its token in the tab', () => {
  const main = code(path.join(SRC, 'main.ts'));
  const branch = main.slice(main.indexOf("boot.mode === 'document'"), main.indexOf("boot.mode === 'rfq'"));
  expect(branch).toContain("import('./doc/doc-page')");
  expect(branch).not.toMatch(/setToken|STORE\.token|STORE\.rfq|STORE\.session/);
});

test('a document fragment is `#d.<token>` exactly; it never reads as a ticket, RFQ or consent link', () => {
  expect(rfqFragment(`#d.${TOKEN}`, 'd.')).toBe(TOKEN);
  for (const bad of [`#${TOKEN}`, `#d.${TOKEN}x`, '#d.short', '#d.', `#D.${TOKEN}`, `#c.${TOKEN}`]) expect(rfqFragment(bad, 'd.'), bad).toBeNull();
  expect(pickMode(`#d.${TOKEN}`, '/support/', 'y'.repeat(32), 'z'.repeat(32))).toEqual({ mode: 'document', token: TOKEN, rid: null, fromFragment: true });
  expect(pickMode(`#c.${TOKEN}`, '/t/', null, null).mode).toBe('consent');
  expect(pickMode('', '/t/', null, null).mode).toBe('ticket'); // nothing kept: a reload never reopens the document
});

test('every language has every key and the same placeholders; ar / ru are dev-marked', () => {
  const keys = Object.keys(DOC_TEXT.he).sort();
  const vars = (s: string) => (s.match(/\{[a-z]+\}/g) ?? []).sort();
  for (const lang of LANGS) {
    expect(Object.keys(DOC_TEXT[lang]).sort(), lang).toEqual(keys);
    for (const k of keys) expect(vars(DOC_TEXT[lang][k as keyof typeof DOC_TEXT.he]), `${lang}.${k}`).toEqual(vars(DOC_TEXT.he[k as keyof typeof DOC_TEXT.he]));
  }
  expect([...DEV_MARKED].sort()).toEqual(['ar', 'ru']);
  expect(dt('en', 'lead', { until: '{n}' })).toBe('A document was sent to you. You can download it until {n}.');
});

test('the download name is the server name only when it is a plain .pdf / .html name; sizes read as people read them', () => {
  expect(safeName('haccp-2026-09.pdf', 'application/pdf')).toBe('haccp-2026-09.pdf');
  for (const bad of ['../x.pdf', 'a b.pdf', 'x.exe', '.hidden.pdf', 'דוח.pdf', null, 5]) expect(safeName(bad, 'application/pdf')).toBe('document.pdf');
  expect(safeName('x.js', 'text/html')).toBe('document.html');
  expect(sizeText(512)).toBe('512 B');
  expect(sizeText(2048)).toBe('2 KB');
  expect(sizeText(2 * 1024 * 1024)).toBe('2.0 MB');
  expect(sizeText(-1)).toBe('');
});
