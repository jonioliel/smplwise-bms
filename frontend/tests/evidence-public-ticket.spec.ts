import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

// CR-038 slice 4 evidence: the handler page (the vendor's page) from the BUILT bundle (smplwise_vms/www-public - run
// `npm run build:public:addon` first), served by route interception on an invented https origin with the public listener's own
// security headers (services/tickets/public_http.py), the API answered by fixtures. No server, no backend, no network.
// Four languages (Hebrew and Arabic right to left), a desktop wrapper (1440) and a phone (390), light and dark; the states: the page,
// a chosen update, the code screen, the read-only grace after close, "not mine" with its required reason and its confirmation, and
// the uniform "unavailable".
//   npx playwright test tests/evidence-public-ticket.spec.ts --project=desktop --project=mobile --workers=1
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../../docs/design/evidence/tickets-s4');
const BUNDLE = path.resolve(HERE, '../../smplwise_vms/www-public');
const ORIGIN = 'https://t-demo.arx.example.test';
const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz012345';
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'self'; form-action 'none'; "
  + "frame-ancestors 'none'; base-uri 'none'; manifest-src 'none'";
const HEADERS = {
  'content-security-policy': CSP, 'x-frame-options': 'DENY', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff',
  'cache-control': 'no-store',
};
type Lang = 'he' | 'en' | 'ar' | 'ru';
const LANGS: Lang[] = ['he', 'en', 'ar', 'ru'];
// what the server sends as `labels` (the module's name in the contact's language, D33 / owner decision 2026-10-14 for Hebrew)
const LABELS: Record<Lang, { one: string; many: string; gender: string }> = {
  he: { one: 'בקשת שירות', many: 'בקשות שירות', gender: 'f' },
  en: { one: 'Ticket', many: 'Tickets', gender: '' },
  ar: { one: 'بلاغ', many: 'بلاغات', gender: 'm' },
  ru: { one: 'Заявка', many: 'Заявки', gender: 'f' },
};
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d+Z$/, 'Z');

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
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w = 480, h = 320): Buffer {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y += 1) {
    raw[y * (w * 3 + 1)] = 0;
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

// ---------------------------------------------------------------- the fixtures

type View = Record<string, unknown>;
function view(lang: Lang, over: View = {}): View {
  const now = Date.now();
  return {
    number: 1043, department: 'אחזקה', organization: 'מגדלי הדר', lang, dir: lang === 'he' || lang === 'ar' ? 'rtl' : 'ltr', labels: LABELS[lang],
    time_zone: 'Asia/Jerusalem', code_required: false, code_ok: true, read_only: false, read_only_until: null, expires_at: iso(now + 12 * DAY),
    title: 'מזגן לא מקרר - חדר 102', description: 'המזגן פועל אך הטמפרטורה בחדר לא יורדת מתחת ל-27 מעלות מאז הבוקר. יש ריח קל ליד היחידה החיצונית.',
    priority: { key: 'high', name: 'גבוהה' }, place_text: 'בניין A · קומה 1 · חדר 102', device_name: 'מזגן חדר 102', status: 'acknowledged', eta_at: null,
    assigned_by: 'יוני', assigned_at: iso(now - 20 * HOUR), created_at: iso(now - 26 * HOUR),
    actions: { statuses: ['in_progress', 'waiting_part', 'done'], note: true, eta: true, photo: true, return: true },
    timeline: [
      { id: 11, at: iso(now - 20 * HOUR), kind: 'note', mine: false, name: 'יוני', from: null, to: null, body: 'המפתח אצל השומר בלובי.' },
      { id: 12, at: iso(now - 18 * HOUR), kind: 'status', mine: true, name: '', from: 'assigned', to: 'acknowledged', body: null },
      { id: 13, at: iso(now - 17 * HOUR), kind: 'photo', mine: true, name: '', from: null, to: null, body: null, photo_id: 'p1' },
    ],
    photos: [{ id: 'p1', at: iso(now - 17 * HOUR), width: 480, height: 320, mine: true }],
    history: null,
    limits: { note_max: 2000, reason_max: 500, photo_max_bytes: 10 * 1024 * 1024, photos_left: 9 },
    ...over,
  };
}

interface Served { view: View | null; calls: { method: string; path: string; body: unknown }[] }

async function serve(page: Page, v: View | null): Promise<Served> {
  const s: Served = { view: v, calls: [] };
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.route(`${ORIGIN}/**`, async (route: Route) => {
    const req = route.request();
    const u = new URL(req.url());
    const p = u.pathname;
    let body: unknown = null;
    try {
      body = req.postDataJSON();
    } catch {
      body = null;
    }
    s.calls.push({ method: req.method(), path: p, body });
    if (p.startsWith('/t/assets/')) {
      const file = path.join(BUNDLE, 'assets', path.basename(p));
      if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
      const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream';
      return route.fulfill({ status: 200, headers: { ...HEADERS, 'content-type': type }, body: fs.readFileSync(file) });
    }
    if (p === '/t/' || p.startsWith('/t/r/')) {
      return route.fulfill({ status: 200, headers: { ...HEADERS, 'content-type': 'text/html; charset=utf-8' }, body: fs.readFileSync(path.join(BUNDLE, 'index.html')) });
    }
    const json = (status: number, data: unknown) => route.fulfill({ status, headers: { ...HEADERS, 'content-type': 'application/json' }, body: JSON.stringify(data) });
    const tokenOk = req.headers()['x-ticket-token'] === TOKEN;
    if (p === '/t/api/ticket') return s.view && tokenOk ? json(200, s.view) : json(404, { code: 'link_unavailable' });
    if (p.startsWith('/t/api/photo/')) return tokenOk ? route.fulfill({ status: 200, headers: { ...HEADERS, 'content-type': 'image/png' }, body: PHOTO }) : json(404, { code: 'link_unavailable' });
    if (p === '/t/api/return') return json(200, { ok: true, status: 'returned', kind: (body as { kind?: string })?.kind ?? 'not_mine', number: 1043 });
    if (p === '/t/api/code/send') return json(200, { sent: true, channel: 'whatsapp', expires_in_s: 600 });
    if (p.startsWith('/t/api/')) return json(200, { ok: true });
    return route.fulfill({ status: 404, body: '' });
  });
  return s;
}

async function open(page: Page, v: View | null, scheme: 'light' | 'dark' = 'light', lang: Lang | null = null): Promise<Served> {
  const s = await serve(page, v);
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
  await page.goto('about:blank');
  await page.goto(`${ORIGIN}/t/#${TOKEN}`);
  if (v) await page.waitForSelector('[data-ticket], [data-code-send], [data-state-title]');
  else await page.waitForSelector('[data-state-title]');
  if (lang) {
    await page.locator('[data-lang-picker]').selectOption(lang);
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
  }
  return s;
}

async function shot(page: Page, name: string, scheme: 'light' | 'dark' = 'light'): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0)); // a full-page image from the top: the sticky header stays at the top
  await page.waitForTimeout(250);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${name}: horizontal overflow`).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}-${scheme}.png`), fullPage: true });
}

test.describe('the handler page (slice 4)', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));
  test.beforeEach(async ({ page }, info) => {
    test.setTimeout(180_000);
    test.skip(info.project.name === 'tablet', 'desktop 1440 (the framed column) and phone 390');
    test.skip(!fs.existsSync(path.join(BUNDLE, 'index.html')), 'build the page first: npm run build:public:addon');
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    (page as unknown as { __errors: string[] }).__errors = errors;
  });
  test.afterEach(async ({ page }) => {
    const errors = (page as unknown as { __errors?: string[] }).__errors ?? [];
    expect(errors.filter((e) => /Content Security Policy|Refused to/i.test(e)), 'no CSP violation').toEqual([]);
  });

  test('the page in four languages, light and dark: the token leaves the address bar, the name comes from the labels', async ({ page }) => {
    for (const lang of LANGS) {
      for (const scheme of ['light', 'dark'] as const) {
        if (scheme === 'dark' && test.info().project.name === 'desktop' && lang !== 'he') continue; // dark desktop: Hebrew only
        await open(page, view(lang), scheme);
        await expect(page.locator('html')).toHaveAttribute('dir', lang === 'he' || lang === 'ar' ? 'rtl' : 'ltr');
        expect(new URL(page.url()).hash, 'the token never stays in the address bar').toBe('');
        await page.waitForSelector('.photos img, .timeline img');
        await shot(page, `public-page-${lang}`, scheme);
      }
    }
    // the words: the configured name, never a default one (Hebrew: the owner's "בקשת שירות")
    await open(page, view('he'));
    await expect(page.locator('body')).not.toContainText('קריא');
    // W20: an address someone typed stays text - the page builds no link at all
    const url = 'https://evil.example.test/pay';
    const tl = (view('he').timeline as unknown[]).concat([{ id: 14, at: iso(Date.now() - HOUR), kind: 'note', mine: false, name: 'יוני', from: null, to: null, body: `לפרטים: ${url}` }]);
    await open(page, view('he', { timeline: tl, description: `ראו ${url}` }));
    await expect(page.locator('body')).toContainText(url);
    await expect(page.locator('a')).toHaveCount(0);
  });

  test('an update chosen: a status, an ETA chip and a note, then "send" sends them with request ids', async ({ page }) => {
    const s = await open(page, view('he'));
    await page.locator('[data-status-choice="in_progress"]').click();
    await page.locator('[data-eta="tomorrow"]').click();
    await page.locator('[data-note]').fill('הגעתי, חסר מדחס. אחזור מחר בבוקר.');
    await shot(page, 'public-update-he');
    await page.locator('[data-send]').click();
    await expect(page.locator('[data-banner="sent"]')).toBeVisible();
    const status = s.calls.find((c) => c.path === '/t/api/status');
    expect(status?.body).toMatchObject({ status: 'in_progress', note: 'הגעתי, חסר מדחס. אחזור מחר בבוקר.' });
    expect(String((status?.body as { client_request_id?: string })?.client_request_id ?? '')).toMatch(/^[0-9a-f-]{36}$/);
    expect(s.calls.some((c) => c.path === '/t/api/eta')).toBe(true);
  });

  test('the code screen, the read-only grace after close, and the uniform "unavailable"', async ({ page }) => {
    const code = { code_required: true, code_ok: false, title: undefined, description: undefined, actions: undefined, timeline: undefined, photos: undefined };
    for (const lang of ['he', 'en'] as Lang[]) {
      await open(page, view(lang, code));
      await page.locator('[data-code-send]').click();
      await expect(page.locator('[data-code-input]')).toBeVisible();
      await shot(page, `public-code-${lang}`);
    }
    const closed = { status: 'closed', read_only: true, read_only_until: iso(Date.now() + 20 * HOUR), actions: { statuses: [], note: false, eta: false, photo: false, return: false } };
    for (const lang of ['he', 'ar'] as Lang[]) {
      await open(page, view(lang, closed));
      await expect(page.locator('[data-readonly]')).toBeVisible();
      await expect(page.locator('[data-send]')).toHaveCount(0);
      await expect(page.locator('[data-not-mine]')).toHaveCount(0);
      await shot(page, `public-readonly-${lang}`);
    }
    for (const lang of ['he', 'ru'] as Lang[]) {
      await page.addInitScript((l) => sessionStorage.setItem('arx.t.lang', l), lang);
      await open(page, null);
      await expect(page.locator('[data-state-title="unavailableTitle"]')).toBeVisible();
      await shot(page, `public-unavailable-${lang}`);
    }
  });

  test('"not mine" asks for a reason, then confirms from the answer and forgets the link', async ({ page }) => {
    const s = await open(page, view('he'));
    await page.locator('[data-not-mine]').click();
    await page.locator('[data-return-send]').click();
    await expect(page.locator('.field-error')).toBeVisible();
    await page.locator('[data-return-reason]').fill('זו תקלת חשמל, לא מיזוג. כדאי לשלוח חשמלאי.');
    await expect(page.locator('.field-error'), 'the "reason required" line goes once a reason is typed').toHaveCount(0);
    await expect(page.locator('[data-return-reason]')).toBeFocused();
    await shot(page, 'public-notmine-he');
    await page.locator('[data-return-send]').click();
    await expect(page.locator('[data-returned]')).toBeVisible();
    expect(s.calls.filter((c) => c.path === '/t/api/ticket').length, 'the confirmation never asks the dead link again').toBe(1);
    expect(await page.evaluate(() => sessionStorage.getItem('arx.t.token'))).toBeNull();
    await shot(page, 'public-returned-he');
  });
});
