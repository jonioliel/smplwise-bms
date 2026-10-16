import { test, expect, type Page, type Route } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// TK257 + TK259 evidence: the vendor page's permanent "quote / payment demand" card (on the page from the first moment, before "done")
// and the page's light / dark / auto theme with the vendor's own toggle. The page is BUILT by this spec into a temp folder (so it always
// tests the current source, never a stale committed bundle) and served by route interception on an invented https origin with the public
// listener's own security headers; the API is answered by fixtures. No server, no backend, no network.
//   npx playwright test -c playwright.public.config.ts tests/evidence-public-vendor-card.spec.ts
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../../docs/design/evidence/tickets-tk257');
const ORIGIN = 'https://t-demo.arx.example.test';
const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz012345';
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'self'; form-action 'none'; "
  + "frame-ancestors 'none'; base-uri 'none'; manifest-src 'none'";
const HEADERS = { 'content-security-policy': CSP, 'x-frame-options': 'DENY', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff', 'cache-control': 'no-store' };
type Lang = 'he' | 'en' | 'ar' | 'ru';
const LABELS: Record<Lang, { one: string; many: string; gender: string }> = {
  he: { one: 'בקשת שירות', many: 'בקשות שירות', gender: 'f' },
  en: { one: 'Ticket', many: 'Tickets', gender: '' },
  ar: { one: 'بلاغ', many: 'بلاغات', gender: 'm' },
  ru: { one: 'Заявка', many: 'Заявки', gender: 'f' },
};
const DAY = 24 * 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d+Z$/, 'Z');

let BUNDLE = '';
const LIGHT_BG = 'rgb(242, 244, 248)';
const DARK_BG = 'rgb(17, 23, 34)';

type Json = Record<string, unknown>;

function view(lang: Lang, over: Json = {}): Json {
  const now = Date.now();
  return {
    number: 1043, department: 'אחזקה', organization: 'מגדלי הדר', lang, dir: lang === 'he' || lang === 'ar' ? 'rtl' : 'ltr', labels: LABELS[lang],
    time_zone: 'Asia/Jerusalem', code_required: false, code_ok: true, read_only: false, read_only_until: null, expires_at: iso(now + 12 * DAY), theme: 'light',
    title: 'מזגן לא מקרר - חדר 102', description: 'המזגן פועל אך הטמפרטורה בחדר לא יורדת.', priority: { key: 'high', name: 'גבוהה' },
    place_text: 'בניין A · קומה 1 · חדר 102', device_name: 'מזגן חדר 102', status: 'acknowledged', eta_at: null, assigned_by: 'יוני',
    assigned_at: iso(now - 20 * 3_600_000), created_at: iso(now - 26 * 3_600_000),
    actions: { statuses: ['in_progress', 'done'], note: true, eta: true, photo: true, return: true }, claim: null, timeline: [], photos: [], history: null,
    limits: { note_max: 2000, reason_max: 500, photo_max_bytes: 10 * 1024 * 1024, photos_left: 9 }, ...over,
  };
}

const FORM = {
  currencies: ['ILS'], vat: { exempt: false, rate_bp: 1800, default: 'excluded' }, labor_rate_minor: 15000,
  limits: { lines: 30, description: 120, notes: 1000, max_total_minor: 100_000_000 },
};

function quoteInfo(over: Json = {}): Json {
  return { state: 'none', enabled: true, writable: true, allowed_kinds: ['labor', 'parts'], currency: 'ILS', quote: null, form: FORM, ...over };
}

function approvedQuote(): Json {
  return {
    id: 'q1', seq: 1, state: 'approved', lines: [{ kind: 'labor', description: '', total_minor: 30000, hours: '2', rate_minor: 15000 },
      { kind: 'parts', description: 'מדחס', total_minor: 80000, quantity: '1', unit_minor: 80000 }],
    total_minor: 129800, vat_minor: 19800, net_minor: 110000, vat_mode: 'excluded', vat_rate_bp: 1800, currency: 'ILS', notes: null,
  };
}

const CLAIM_INFO = {
  status: 'awaiting', required: false, claim_until: iso(Date.now() + 10 * DAY), writable: true, currency: 'ILS', no_charge: false, revisions: [],
  form: { currencies: ['ILS'], vat: { exempt: false, rate_bp: 1800, default: 'excluded' }, labor_rate_minor: 15000, require_invoice: false,
    limits: { lines: 30, description: 120, vendor_ref: 40, notes: 1000, documents: 3, pages: 10, files: 25, pdf_bytes: 10485760, photo_bytes: 8388608, max_total_minor: 100000000 } },
};

interface Served { calls: { method: string; path: string; body: unknown }[]; quote: Json; view: Json | null }

async function serve(page: Page, v: Json | null, quote: Json = quoteInfo()): Promise<Served> {
  const s: Served = { calls: [], quote, view: v };
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.route(`${ORIGIN}/**`, async (route: Route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname;
    let body: unknown = null;
    try {
      body = req.postDataJSON();
    } catch {
      body = null;
    }
    s.calls.push({ method: req.method(), path: p, body });
    const json = (status: number, data: unknown) => route.fulfill({ status, headers: { ...HEADERS, 'content-type': 'application/json' }, body: JSON.stringify(data) });
    if (p.startsWith('/t/assets/')) {
      const file = path.join(BUNDLE, 'assets', path.basename(p));
      if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
      const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'image/svg+xml';
      return route.fulfill({ status: 200, headers: { ...HEADERS, 'content-type': type }, body: fs.readFileSync(file) });
    }
    if (p === '/t/' || p.startsWith('/t/r/')) {
      return route.fulfill({ status: 200, headers: { ...HEADERS, 'content-type': 'text/html; charset=utf-8' }, body: fs.readFileSync(path.join(BUNDLE, 'index.html')) });
    }
    if (req.headers()['x-ticket-token'] !== TOKEN) return json(404, { code: 'link_unavailable' });
    if (p === '/t/api/ticket') return s.view ? json(200, s.view) : json(404, { code: 'link_unavailable' });
    if (p === '/t/api/quote' && req.method() === 'GET') return json(200, s.quote);
    if (p === '/t/api/quote' && req.method() === 'POST') {
      const lines = (body as { lines?: unknown[] })?.lines ?? [];
      s.quote = quoteInfo({ state: 'submitted', writable: true, quote: { ...approvedQuote(), state: 'submitted', lines, notes: null } });
      return json(201, { ok: true });
    }
    if (p === '/t/api/claim' && req.method() === 'GET') return json(200, CLAIM_INFO);
    return json(200, { ok: true });
  });
  return s;
}

async function open(page: Page, v: Json | null, opts: { scheme?: 'light' | 'dark'; quote?: Json; lang?: Lang } = {}): Promise<Served> {
  const s = await serve(page, v, opts.quote);
  await page.emulateMedia({ colorScheme: opts.scheme ?? 'light', reducedMotion: 'reduce' });
  await page.goto('about:blank');
  await page.goto(`${ORIGIN}/t/#${TOKEN}`);
  await page.waitForSelector('[data-ticket], [data-state-title]');
  return s;
}

const bg = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

async function shot(page: Page, name: string): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${name}: horizontal overflow`).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}.png`), fullPage: true });
}

test.describe('TK257 / TK259: the vendor page card and theme', () => {
  test.beforeAll(() => {
    fs.mkdirSync(OUT, { recursive: true });
    BUNDLE = fs.mkdtempSync(path.join(os.tmpdir(), 'sw-public-'));
    const vite = path.resolve(HERE, '../node_modules/vite/bin/vite.js');
    execFileSync(process.execPath, [vite, 'build', '-c', 'vite.public.config.ts', '--outDir', BUNDLE], { cwd: path.resolve(HERE, '..'), env: { ...process.env, SW_PUBLIC_OUT: BUNDLE }, stdio: 'pipe' });
  });
  test.afterAll(() => {
    if (BUNDLE) fs.rmSync(BUNDLE, { recursive: true, force: true });
  });
  test.beforeEach(async ({ page }, info) => {
    test.setTimeout(180_000);
    test.skip(info.project.name === 'tablet', 'desktop 1440 and phone 390');
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    (page as unknown as { __errors: string[] }).__errors = errors;
  });
  test.afterEach(async ({ page }) => {
    const errors = (page as unknown as { __errors?: string[] }).__errors ?? [];
    expect(errors.filter((e) => /Content Security Policy|Refused to/i.test(e)), 'no CSP violation').toEqual([]);
  });

  test('TK257: the card is on the first screen before the work is done, with the one-sentence explanation', async ({ page }) => {
    await open(page, view('he'));
    const card = page.locator('[data-cost-card]');
    await expect(card).toBeVisible();
    await expect(card).toContainText('הצעת מחיר / דרישת תשלום');
    await expect(page.locator('[data-cost-intro="intro_now"]')).toContainText('עכשיו אפשר לשלוח הצעת מחיר');
    await expect(page.locator('[data-cost-intro="intro_now"]')).toContainText('בוצע');
    await expect(page.locator('[data-demand-part="later"]')).toBeVisible();
    await expect(page.locator('[data-quote-part="none"]')).toContainText('לפני העבודה');
    // work + parts only by default
    await expect(card.locator('.swc-add button')).toHaveCount(2);
    await expect(card).not.toContainText('נסיעה');
    await expect(page.locator('body')).not.toContainText('קריא');
    await shot(page, 'card-first-screen-he');
  });

  test('TK257: a quote is filled and sent; the server computes the figures, nothing else is sent', async ({ page }) => {
    const s = await open(page, view('he'));
    const card = page.locator('[data-cost-card]');
    await card.locator('input[data-quote-field="hours"]').fill('2');
    await card.locator('input[data-quote-field="rate"]').fill('150');
    await card.locator('.swc-add button').nth(1).click(); // + parts
    const last = card.locator('.swc-line').last();
    await last.locator('input[data-quote-field="description"]').fill('מדחס');
    await last.locator('input[data-quote-field="unit_price"]').fill('800');
    await shot(page, 'card-quote-filled-he');
    await card.locator('[data-quote-send]').click();
    await expect(page.locator('[data-quote-part="submitted"]')).toBeVisible();
    await expect(page.locator('[data-quote-part="submitted"]')).toContainText('נשלחה');
    const post = s.calls.find((c) => c.method === 'POST' && c.path === '/t/api/quote');
    expect(post).toBeTruthy();
    const b = post!.body as { lines: { kind: string }[]; client_request_id: string; documents?: unknown };
    expect(b.lines.map((l) => l.kind)).toEqual(['labor', 'parts']);
    expect(b.client_request_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(b.documents).toBeUndefined();
    expect(s.calls.filter((c) => c.method === 'POST').length, 'only the quote was posted').toBe(1);
    await shot(page, 'card-quote-sent-he');
  });

  test('TK257: travel and other appear only when the server lists them; "other" needs a description', async ({ page }) => {
    await open(page, view('he'), { quote: quoteInfo({ allowed_kinds: ['labor', 'parts', 'travel', 'other'] }) });
    const card = page.locator('[data-cost-card]');
    await expect(card.locator('.swc-add button')).toHaveCount(4);
    await card.locator('.swc-add button').nth(3).click(); // + other
    await card.locator('[data-quote-send]').click();
    await expect(card.locator('.swc-error:not([hidden])')).toBeVisible();
  });

  test('TK257: a correction request shows its reason and lets the vendor send again', async ({ page }) => {
    await open(page, view('he'), { quote: quoteInfo({ state: 'rejected', quote: { ...approvedQuote(), state: 'rejected', reason: 'מחיר החלק גבוה, נא לבדוק' } }) });
    await expect(page.locator('[data-quote-part="rejected"]')).toContainText('מחיר החלק גבוה, נא לבדוק');
    await expect(page.locator('[data-quote-send]')).toBeVisible();
  });

  test('TK257: after "done" the payment part opens against the approved quote and the card keeps the quote as reference', async ({ page }) => {
    await open(page, view('he', { status: 'done', actions: { statuses: [], note: true, eta: true, photo: true, return: true }, claim: { status: 'awaiting', required: false, writable: true, claim_until: iso(Date.now() + 10 * DAY) } }),
      { quote: quoteInfo({ state: 'approved', writable: false, quote: approvedQuote() }) });
    await expect(page.locator('[data-demand-part="open"]')).toBeVisible();
    await expect(page.locator('[data-quote-ref="129800"]')).toBeVisible();
    await expect(page.locator('[data-demand-part="open"] .swc')).toBeVisible();
    await expect(page.locator('[data-quote-part="approved"]')).toContainText('אושרה');
    await shot(page, 'card-after-done-he');
  });

  test('TK257: a request with costs off shows no card', async ({ page }) => {
    await open(page, view('he'), { quote: quoteInfo({ enabled: false, writable: false }) });
    await page.waitForTimeout(600);
    await expect(page.locator('[data-cost-card]')).toBeHidden();
  });

  test('TK257: four languages - Arabic and Russian carry the preliminary-translation line', async ({ page }) => {
    for (const lang of ['he', 'en', 'ar', 'ru'] as Lang[]) {
      await open(page, view(lang));
      await expect(page.locator('[data-cost-card]')).toBeVisible();
      await expect(page.locator('[data-cost-card]')).toHaveAttribute('dir', lang === 'he' || lang === 'ar' ? 'rtl' : 'ltr');
      await expect(page.locator('.swq-tr')).toHaveCount(lang === 'ar' || lang === 'ru' ? 1 : 0);
      await shot(page, `card-${lang}`);
    }
  });

  test('TK259: light by default - the device being dark does not make the page dark', async ({ page }) => {
    await open(page, view('he', { theme: 'light' }), { scheme: 'dark' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(await bg(page)).toBe(LIGHT_BG);
    await shot(page, 'theme-light-on-dark-device');
  });

  test('TK259: dark mode is dark even on a light device; auto follows the device', async ({ page }) => {
    await open(page, view('he', { theme: 'dark' }), { scheme: 'light' });
    expect(await bg(page)).toBe(DARK_BG);
    await shot(page, 'theme-dark');
    await open(page, view('he', { theme: 'auto' }), { scheme: 'dark' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'auto');
    expect(await bg(page)).toBe(DARK_BG);
    await open(page, view('he', { theme: 'auto' }), { scheme: 'light' });
    expect(await bg(page)).toBe(LIGHT_BG);
  });

  test('TK259: the toggle flips the look and the choice is remembered in this browser', async ({ page }) => {
    await open(page, view('he', { theme: 'light' }));
    expect(await bg(page)).toBe(LIGHT_BG);
    await page.locator('[data-theme-toggle]').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await bg(page)).toBe(DARK_BG);
    await expect(page.locator('[data-theme-toggle]')).toHaveAttribute('data-theme-toggle', 'dark');
    await shot(page, 'theme-toggled-dark');
    // a reload (the installation still says light): the vendor's own choice wins
    await open(page, view('he', { theme: 'light' }));
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.locator('[data-theme-toggle]').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(await bg(page)).toBe(LIGHT_BG);
  });

  test('TK259: with storage blocked the toggle still works for this visit and nothing throws', async ({ page }) => {
    await page.addInitScript(() => {
      const boom = () => { throw new DOMException('blocked', 'SecurityError'); };
      Storage.prototype.getItem = boom;
      Storage.prototype.setItem = boom;
      Storage.prototype.removeItem = boom;
    });
    await open(page, view('he', { theme: 'light' }));
    await page.locator('[data-theme-toggle]').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await bg(page)).toBe(DARK_BG);
    expect((page as unknown as { __errors: string[] }).__errors.filter((e) => /SecurityError|blocked/.test(e))).toEqual([]);
  });
});
