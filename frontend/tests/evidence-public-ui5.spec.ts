import { test, expect, type Page, type Route } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

// TKUI5 (2.6.0) evidence: the public handler page in the approved ticket-module look (mock-up v5). ONE component, the layout chosen by
// the link's kind: a vendor (the server's view carries the `claim` key) gets the first screen (organisation, number + title, place, one
// status line, ONE big primary button) and the permanent quote / payment-demand card; a staff link (no `claim` key) gets no cost card, no
// claim surface and no request to the quote / claim routes, and the device-history card instead. The page is BUILT by this spec into a
// temp folder (so it always tests the current source) and served by route interception on an invented https origin with the public
// listener's own security headers; the API is answered by fixtures. No server, no backend, no network.
//   npx playwright test -c playwright.public.config.ts tests/evidence-public-ui5.spec.ts --project=desktop --project=mobile
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../../docs/design/evidence/tickets-ui5');
const SHOTS = path.resolve(HERE, '../.ui5-shots');
const ORIGIN = 'https://t-demo.arx.example.test';
const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz012345';
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'self'; form-action 'none'; "
  + "frame-ancestors 'none'; base-uri 'none'; manifest-src 'none'";
const HEADERS = { 'content-security-policy': CSP, 'x-frame-options': 'DENY', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff', 'cache-control': 'no-store' };
type Lang = 'he' | 'en' | 'ar' | 'ru';
const LANGS: Lang[] = ['he', 'en', 'ar', 'ru'];
const LABELS: Record<Lang, { one: string; many: string; gender: string }> = {
  he: { one: 'בקשת שירות', many: 'בקשות שירות', gender: 'f' },
  en: { one: 'Ticket', many: 'Tickets', gender: '' },
  ar: { one: 'بلاغ', many: 'بلاغات', gender: 'm' },
  ru: { one: 'Заявка', many: 'Заявки', gender: 'f' },
};
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d+Z$/, 'Z');
const LIGHT_BG = 'rgb(242, 244, 248)';
const DARK_BG = 'rgb(17, 23, 34)';

let BUNDLE = '';

// ---------------------------------------------------------------- a small PNG (the photo the page fetches as a blob)

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  let c = 0xffffffff;
  for (const b of td) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE((c ^ 0xffffffff) >>> 0);
  return Buffer.concat([len, td, crc]);
}
function png(w = 240, h = 160): Buffer {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = y * (w * 3 + 1) + 1 + x * 3;
      raw[i] = 70 + Math.round((x / w) * 60);
      raw[i + 1] = 110 + Math.round((y / h) * 70);
      raw[i + 2] = 170 + Math.round(((x + y) / (w + h)) * 60);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const PHOTO = png();

// ---------------------------------------------------------------- fixtures

type Json = Record<string, unknown>;

/** A vendor link's view: the `claim` key is present (null before "done"), exactly like GET /t/api/ticket. */
function view(lang: Lang, over: Json = {}): Json {
  const now = Date.now();
  return {
    number: 2041, department: 'אחזקה', organization: 'מתנ״ס אפרת', lang, dir: lang === 'he' || lang === 'ar' ? 'rtl' : 'ltr', labels: LABELS[lang],
    time_zone: 'Asia/Jerusalem', code_required: false, code_ok: true, read_only: false, read_only_until: null, expires_at: iso(now + 12 * DAY), theme: 'light',
    title: 'דליפת מים ממזגן בחדר הישיבות', description: 'מים על הרצפה ליד החלון, נראה שמגיעים מהיחידה הפנימית. הונח דלי. החדר בשימוש מחר ב-10:00.',
    priority: { key: 'high', name: 'גבוהה' }, place_text: 'קומה 2 · חדר ישיבות גדול', device_name: 'מזגן VRF יחידה 2-07', status: 'acknowledged', eta_at: null,
    assigned_by: 'דני כ.', assigned_at: iso(now - 20 * HOUR), created_at: iso(now - 26 * HOUR),
    actions: { statuses: ['in_progress', 'done'], note: true, eta: true, photo: true, return: true }, claim: null,
    timeline: [
      { id: 11, at: iso(now - 20 * HOUR), kind: 'note', mine: false, name: 'דני כ.', from: null, to: null, body: 'שלום, נפתחה בקשה. נא לשלוח הצעת מחיר לפני תחילת העבודה.' },
      { id: 12, at: iso(now - 18 * HOUR), kind: 'status', mine: true, name: '', from: 'assigned', to: 'acknowledged', body: null },
      { id: 13, at: iso(now - 17 * HOUR), kind: 'photo', mine: true, name: '', from: null, to: null, body: null, photo_id: 'p1' },
    ],
    photos: [{ id: 'p1', at: iso(now - 17 * HOUR), width: 240, height: 160, mine: true }], history: null,
    limits: { note_max: 2000, reason_max: 500, photo_max_bytes: 10 * 1024 * 1024, photos_left: 9 }, ...over,
  };
}

/** A staff link's view: NO `claim` key at all (the server never sets it on a staff link). */
function staffView(lang: Lang, over: Json = {}): Json {
  const v = view(lang, over);
  delete v.claim;
  const tl = v.timeline as { id: number; body: string | null }[];
  v.timeline = tl.map((e) => (e.id === 11 ? { ...e, body: 'שלום, נפתחה בקשה. הדלת למחסן פתוחה.' } : e));
  return v;
}

const HISTORY = [
  { at: iso(Date.now() - 9 * HOUR), from: 'off', to: 'on', actor: 'schedule' },
  { at: iso(Date.now() - 6 * HOUR), from: 'on', to: 'alarm', actor: 'device' },
  { at: iso(Date.now() - 2 * HOUR), from: 'alarm', to: 'on', actor: 'manual' },
];

const FORM = {
  currencies: ['ILS'], vat: { exempt: false, rate_bp: 1800, default: 'excluded' }, labor_rate_minor: 15000,
  limits: { lines: 30, description: 120, notes: 1000, max_total_minor: 100_000_000 },
};
function quoteInfo(over: Json = {}): Json {
  return { state: 'none', enabled: true, writable: true, allowed_kinds: ['labor', 'parts'], currency: 'ILS', quote: null, form: FORM, ...over };
}
function quoteOf(state: string, extra: Json = {}): Json {
  return {
    id: 'q1', seq: 1, state, lines: [{ kind: 'labor', description: '', total_minor: 30000, hours: '2', rate_minor: 15000 },
      { kind: 'parts', description: 'משאבת ניקוז', total_minor: 80000, quantity: '1', unit_minor: 80000 }],
    total_minor: 129800, vat_minor: 19800, net_minor: 110000, vat_mode: 'excluded', vat_rate_bp: 1800, currency: 'ILS', notes: null, ...extra,
  };
}
const CLAIM_INFO = {
  status: 'awaiting', required: false, claim_until: iso(Date.now() + 10 * DAY), writable: true, currency: 'ILS', no_charge: false, revisions: [],
  form: { currencies: ['ILS'], vat: { exempt: false, rate_bp: 1800, default: 'excluded' }, labor_rate_minor: 15000, require_invoice: false,
    limits: { lines: 30, description: 120, vendor_ref: 40, notes: 1000, documents: 3, pages: 10, files: 25, pdf_bytes: 10485760, photo_bytes: 8388608, max_total_minor: 100000000 } },
};

interface Served { calls: { method: string; path: string; body: unknown }[] }

async function serve(page: Page, v: Json | null, quote: Json): Promise<Served> {
  const s: Served = { calls: [] };
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
    if (p === '/t/api/ticket') return v ? json(200, v) : json(404, { code: 'link_unavailable' });
    if (p.startsWith('/t/api/photo/')) return route.fulfill({ status: 200, headers: { ...HEADERS, 'content-type': 'image/png' }, body: PHOTO });
    if (p === '/t/api/quote' && req.method() === 'GET') return json(200, quote);
    if (p === '/t/api/claim' && req.method() === 'GET') return json(200, CLAIM_INFO);
    if (p === '/t/api/code/send') return json(200, { sent: true, channel: 'whatsapp', expires_in_s: 600 });
    return json(200, { ok: true });
  });
  return s;
}

interface Opts { scheme?: 'light' | 'dark'; quote?: Json; lang?: Lang; wait?: string }

async function open(page: Page, v: Json | null, opts: Opts = {}): Promise<Served> {
  const s = await serve(page, v, opts.quote ?? quoteInfo());
  await page.emulateMedia({ colorScheme: opts.scheme ?? 'light', reducedMotion: 'reduce' });
  await page.goto('about:blank');
  await page.goto(`${ORIGIN}/t/#${TOKEN}`);
  await page.waitForSelector('[data-ticket], [data-code-send], [data-state-title]');
  if (opts.wait) await page.waitForSelector(opts.wait);
  return s;
}

async function shot(page: Page, name: string): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(250);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${name}: horizontal overflow`).toBeLessThanOrEqual(1);
  const file = `${name}-${test.info().project.name}.png`;
  await page.screenshot({ path: path.join(OUT, file), fullPage: true });
  // the runner's job restores docs/ when it ends: a copy outside it is what gets fetched back (frontend/.ui5-shots is untracked)
  fs.mkdirSync(SHOTS, { recursive: true });
  fs.copyFileSync(path.join(OUT, file), path.join(SHOTS, file));
}

const bg = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test.describe('TKUI5: the public page in the approved look', () => {
  test.beforeAll(() => {
    fs.mkdirSync(OUT, { recursive: true });
    BUNDLE = fs.mkdtempSync(path.join(os.tmpdir(), 'sw-public-ui5-'));
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

  test('the bundle stays within the 61 KB gzip budget (TKPOLISH: was 60) and carries no inline script or style', () => {
    // TKGATEFIX1: same meaning as the guard in unit-public-ticket.spec.ts (TKRFQVP) - the vendor RFQ page is a lazy chunk (`rfq-page-*`)
    // a ticket link never fetches, so it has its own 20 KB budget; the 60 KB stays the ticket page's (page + CSS + the lazy claim chunks)
    let gz = 0;
    let rfq = 0;
    let rfqTerms = 0;
    let rfqUpload = 0;
    let portal = 0;
    let portalMore = 0;
    let consent = 0;
    let claimPrefill = 0;
    for (const f of fs.readdirSync(path.join(BUNDLE, 'assets'))) {
      if (!/\.(js|css)$/.test(f)) continue;
      const n = zlib.gzipSync(fs.readFileSync(path.join(BUNDLE, 'assets', f))).length;
      if (/^claim-prefill[-.]/.test(f)) claimPrefill += n; // CR-CLAIM-PREFILL (as the unit guard): the demand loaded from the approved quote, own 3 KB cap
      else if (/^rfq-page-terms[-.]/.test(f)) rfqTerms += n; // integ/264 (decision a): the lazy payment-terms chunk, own 3 KB cap, before the rfq rule
      else if (/^rfq-upload[-.]/.test(f)) rfqUpload += n; // RFQ-VENDOR-UPLOAD: the vendor's own files (lazy, switch on only), own 5 KB cap (quote + question-with-files UI)
      else if (/^rfq-(page|files)[-.]/.test(f)) rfq += n; // RFQATT: the request files' chunk is the RFQ page's (lazy on a ticket link, only with an order's files)
      else if (/^portal-more[-.]/.test(f)) portalMore += n; // VPORTALRFQ (integ/270, as the unit guard): the portal's extra sections, own 6 KB cap
      else if (/^portal-page[-.]/.test(f)) portal += n; // VPORTAL: the vendor portal's lazy chunk + stylesheet has its own budget (as the unit guard)
      else if (/^consent-(page|text)[-.]/.test(f)) consent += n; // WA-CONSENT-LINK (integ/270, as the unit guard): the consent page, own 5 KB cap
      else gz += n;
    }
    test.info().annotations.push({ type: 'gzip-bytes', description: `${gz} (rfq-page ${rfq}, rfq-terms ${rfqTerms}, rfq-upload ${rfqUpload}, portal ${portal}, portal-more ${portalMore}, consent ${consent}, claim-prefill ${claimPrefill})` });
    expect(gz).toBeLessThanOrEqual(61 * 1024);
    expect(rfq).toBeLessThanOrEqual(20 * 1024);
    expect(rfqTerms).toBeLessThanOrEqual(3 * 1024);
    expect(rfqUpload).toBeLessThanOrEqual(5 * 1024);
    expect(portal).toBeLessThanOrEqual(12 * 1024);
    expect(portalMore).toBeLessThanOrEqual(6 * 1024);
    expect(consent).toBeLessThanOrEqual(5 * 1024);
    expect(claimPrefill).toBeLessThanOrEqual(3 * 1024);
    const html =fs.readFileSync(path.join(BUNDLE, 'index.html'), 'utf8');
    expect(html).not.toMatch(/<style|\sstyle=|\son[a-z]+=|<script>(?!<\/script>)/i);
  });

  test('vendor first screen: organisation, number + title, place, ONE status line, ONE big primary; confirming receipt sends one status', async ({ page }) => {
    const s = await open(page, view('he', { status: 'assigned', actions: { statuses: ['acknowledged', 'in_progress'], note: true, eta: true, photo: true, return: true }, timeline: [], photos: [] }), { wait: '[data-cost-card]:not([hidden])' });
    await expect(page.locator('[data-kind="vendor"]')).toHaveCount(1);
    await expect(page.locator('.top .org')).toHaveText('מתנ״ס אפרת');
    await expect(page.locator('.hero h1')).toHaveText('דליפת מים ממזגן בחדר הישיבות');
    await expect(page.locator('.hero .where')).toContainText('קומה 2 · חדר ישיבות גדול');
    await expect(page.locator('[data-statusline]')).toHaveText('הארגון ממתין לאישור הקבלה שלכם');
    await expect(page.locator('[data-statusline]')).toHaveAttribute('data-status', 'assigned');
    const primary = page.locator('[data-bar] button');
    await expect(primary).toHaveCount(1);
    await expect(primary).toHaveAttribute('data-primary', 'ack');
    await expect(primary).toHaveText('קיבלתי');
    const box = await primary.boundingBox();
    const vp = page.viewportSize()!;
    expect(box!.height, 'a 56 px primary').toBeGreaterThanOrEqual(55);
    expect(box!.y + box!.height, 'the primary is inside the first screen').toBeLessThanOrEqual(vp.height + 1);
    await shot(page, 'vendor-ack-he');
    await primary.click();
    await expect(page.locator('[data-banner="sent"]')).toBeVisible();
    const posts = s.calls.filter((c) => c.method === 'POST');
    expect(posts.map((c) => c.path)).toEqual(['/t/api/status']);
    expect(posts[0].body).toMatchObject({ status: 'acknowledged' });
  });

  test('the cards are numbered in the page order and the cost card keeps the words "הצעת מחיר" / "דרישת תשלום"', async ({ page }) => {
    await open(page, view('he'), { wait: '[data-cost-card]:not([hidden])' });
    // the badge numbers are a CSS counter (the screenshots show them); the order of the cards is the contract here
    const marks = await page.locator('.card.num > h2, .swq > .swc-head .swc-title').evaluateAll((els) => els.map((e) => ({ text: (e.textContent ?? '').trim(), n: getComputedStyle(e, '::before').content })));
    expect(marks.map((m) => m.text)).toEqual(['עדכון מצב', 'מתי תגיעו / תסיימו?', 'מה נעשה / מה נשאר', 'תמונות', 'הצעת מחיר / דרישת תשלום', 'עדכונים']);
    expect(marks.every((m) => m.n !== 'none' && m.n !== 'normal')).toBe(true);
    await expect(page.locator('[data-cost-card]')).toContainText('הצעת מחיר / דרישת תשלום');
    const text = await page.locator('body').innerText();
    expect(text).not.toMatch(/קריא/);
    expect(text).not.toContain('דרישת עלות');
    expect(text).not.toMatch(/Home Assistant/i);
  });

  test('before the quote: the status line and the primary follow the quote card; a correction request leads the primary to the quote', async ({ page }) => {
    await open(page, view('he'), { quote: quoteInfo({ state: 'rejected', quote: quoteOf('rejected', { reason: 'מחיר החלק גבוה מהמקובל, נא לבדוק' }) }), wait: '[data-quote-part="rejected"]' });
    await expect(page.locator('[data-statusline]')).toHaveText('נדרש תיקון בהצעת המחיר');
    await expect(page.locator('[data-bar] button')).toHaveAttribute('data-primary', 'quote_fix');
    await shot(page, 'vendor-quote-fix-he');
    await page.locator('[data-bar] button').click();
    await expect(page.locator('[data-quote-part="rejected"] input').first()).toBeFocused();
    // typing a note makes "send the update" the primary
    await page.locator('[data-note]').fill('בדקתי שוב את המחיר');
    await expect(page.locator('[data-bar] button')).toHaveAttribute('data-primary', 'send');
    await expect(page.locator('[data-bar] button')).toHaveAttribute('data-send', '');
  });

  test('quote sent, quote approved, work in progress, waiting for a part', async ({ page }) => {
    await open(page, view('he'), { quote: quoteInfo({ state: 'submitted', quote: quoteOf('submitted') }), wait: '[data-quote-part="submitted"]' });
    await expect(page.locator('[data-statusline]')).toHaveText('הצעת המחיר אצל הארגון לאישור');
    await shot(page, 'vendor-quote-sent-he');
    await open(page, view('he'), { quote: quoteInfo({ state: 'approved', quote: quoteOf('approved') }), wait: '[data-quote-part="approved"]' });
    await expect(page.locator('[data-statusline]')).toHaveText('הצעת המחיר אושרה · אפשר להתחיל');
    await open(page, view('he', { status: 'in_progress', actions: { statuses: ['waiting_part', 'done'], note: true, eta: true, photo: true, return: true } }),
      { quote: quoteInfo({ state: 'approved', quote: quoteOf('approved') }), wait: '[data-quote-part="approved"]' });
    await expect(page.locator('[data-statusline]')).toHaveText('בטיפול');
    await shot(page, 'vendor-working-he');
    await page.locator('[data-waiting-toggle="mark"]').click();
    await expect(page.locator('[data-waiting-sub]')).toHaveText('ממתין לחלק');
    await page.locator('[data-send]').click();
    await expect(page.locator('[data-banner="sent"]')).toBeVisible();
    await open(page, view('he', { status: 'waiting_part', actions: { statuses: ['in_progress', 'done'], note: true, eta: true, photo: true, return: true } }),
      { quote: quoteInfo({ state: 'approved', quote: quoteOf('approved') }), wait: '[data-quote-part="approved"]' });
    await expect(page.locator('[data-statusline]')).toHaveText('בטיפול · ממתין לחלק');
    await shot(page, 'vendor-part-wait-he');
  });

  test('after "done": the payment demand against the approved quote, the primary points at it', async ({ page }) => {
    await open(page, view('he', { status: 'done', actions: { statuses: [], note: true, eta: true, photo: true, return: true }, claim: { status: 'awaiting', required: false, writable: true, claim_until: iso(Date.now() + 10 * DAY) } }),
      { quote: quoteInfo({ state: 'approved', writable: false, quote: quoteOf('approved') }), wait: '[data-demand-part="open"] .swc' });
    await expect(page.locator('[data-statusline]')).toHaveText('ממתינים לדרישת התשלום שלכם');
    await expect(page.locator('[data-bar] button')).toHaveAttribute('data-primary', 'demand');
    await expect(page.locator('[data-quote-ref="129800"]')).toBeVisible();
    await shot(page, 'vendor-demand-he');
  });

  test('staff link: no cost card, no claim surface, no quote / claim request; the device history is a card of its own; WhatsApp copy', async ({ page }) => {
    const s = await open(page, staffView('he', { history: HISTORY, status: 'assigned', actions: { statuses: ['acknowledged', 'in_progress'], note: true, eta: true, photo: true, return: true } }));
    await page.waitForTimeout(800); // a vendor page would have asked the quote route by now
    await expect(page.locator('[data-kind="staff"]')).toHaveCount(1);
    await expect(page.locator('[data-cost-card]')).toHaveCount(0);
    await expect(page.locator('[data-claim-host]')).toHaveCount(0);
    await expect(page.locator('[data-device-history]')).toBeVisible();
    await expect(page.locator('.hist')).toHaveCount(0);
    expect(s.calls.filter((c) => /\/t\/api\/(quote|claim)/.test(c.path)), 'a staff link never asks the cost routes').toEqual([]);
    const text = await page.locator('body').innerText();
    expect(text).not.toMatch(/הצעת מחיר|דרישת תשלום|₪/);
    await expect(page.locator('[data-bar] button')).toHaveAttribute('data-primary', 'ack');
    await shot(page, 'staff-he');
    // no device history shared by the department: no card at all
    await open(page, staffView('he', { history: null }));
    await expect(page.locator('[data-device-history]')).toHaveCount(0);
  });

  test('staff link after "done": no payment line and no demand button', async ({ page }) => {
    await open(page, staffView('he', { status: 'done', actions: { statuses: [], note: true, eta: true, photo: true, return: false } }));
    await expect(page.locator('[data-statusline]')).toHaveText('הטיפול הסתיים · ממתינים לאישור הארגון');
    await expect(page.locator('[data-bar] button')).toHaveAttribute('data-primary', 'send');
  });

  test('the code screen says WhatsApp when the code went there; read-only and unavailable screens', async ({ page }) => {
    const code = { code_required: true, code_ok: false, title: undefined, description: undefined, actions: undefined, timeline: undefined, photos: undefined, claim: undefined };
    await open(page, view('he', code));
    await page.locator('[data-code-send]').click();
    await expect(page.locator('[data-code-message="codeSentWa"]')).toContainText('WhatsApp');
    await shot(page, 'code-he');
    const closed = { status: 'closed', read_only: true, read_only_until: iso(Date.now() + 20 * HOUR), actions: { statuses: [], note: false, eta: false, photo: false, return: false } };
    await open(page, view('he', closed));
    await expect(page.locator('[data-readonly]')).toBeVisible();
    await expect(page.locator('[data-bar]')).toHaveCount(0);
    await expect(page.locator('[data-statusline]')).toHaveText('הטיפול הסתיים');
    await shot(page, 'readonly-he');
    await page.addInitScript(() => sessionStorage.setItem('arx.t.lang', 'en'));
    await open(page, null);
    await expect(page.locator('[data-state-title="unavailableTitle"]')).toBeVisible();
    await shot(page, 'unavailable-en');
  });

  test('four languages, light and dark, vendor and staff: direction, no overflow, the preliminary-translation line for Arabic and Russian', async ({ page }) => {
    const mobile = test.info().project.name === 'mobile';
    for (const lang of LANGS) {
      for (const scheme of ['light', 'dark'] as const) {
        if (scheme === 'dark' && !mobile && lang !== 'he') continue;
        await open(page, view(lang, { theme: scheme }), { scheme, quote: quoteInfo({ state: 'submitted', quote: quoteOf('submitted') }), wait: '[data-quote-part="submitted"]' });
        await expect(page.locator('html')).toHaveAttribute('dir', lang === 'he' || lang === 'ar' ? 'rtl' : 'ltr');
        await expect(page.locator('[data-prelim]')).toHaveCount(lang === 'ar' || lang === 'ru' ? 1 : 0);
        expect(await bg(page)).toBe(scheme === 'dark' ? DARK_BG : LIGHT_BG);
        await shot(page, `vendor-${lang}-${scheme}`);
      }
      if (lang !== 'he') {
        await open(page, staffView(lang, { history: HISTORY }), { scheme: 'light' });
        await expect(page.locator('[data-cost-card]')).toHaveCount(0);
        await expect(page.locator('[data-prelim]')).toHaveCount(lang === 'ar' || lang === 'ru' ? 1 : 0);
        await shot(page, `staff-${lang}-light`);
      }
    }
    await open(page, staffView('he', { history: HISTORY, theme: 'dark' }), { scheme: 'dark' });
    await shot(page, 'staff-he-dark');
  });

  test('phone: every target is at least 44 px; the theme toggle still works', async ({ page }) => {
    test.skip(test.info().project.name !== 'mobile', 'the phone');
    await open(page, view('ru'), { quote: quoteInfo(), wait: '[data-quote-part="none"]' });
    const small = await page.locator('button:visible, select:visible, label.btn:visible, input[type="text"]:visible, textarea:visible').evaluateAll((els) =>
      els.map((e) => ({ cls: (e as HTMLElement).className, h: Math.round(e.getBoundingClientRect().height) })).filter((x) => x.h < 44));
    expect(small, 'targets under 44 px').toEqual([]);
    await page.locator('[data-theme-toggle]').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
});
