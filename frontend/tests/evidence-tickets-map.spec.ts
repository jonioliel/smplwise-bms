import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// TKMAP1 evidence (owner 16.10): the vendor page's "location on the map" card from the BUILT handler page (smplwise_vms/www-public, or
// SW_PUBLIC_BUNDLE for a build elsewhere), served by route interception with the public listener's own headers (CSP `img-src 'self' blob:`).
// The picture is a fixture the server renderer produced (tests/tickets-map-fixture.svg, services/tickets/map_image.py); the page fetches it
// with the token header and shows it through a blob: URL. States: the picture, the text only (the element left the map), no element.
//   npx playwright test -c playwright.public.config.ts tests/evidence-tickets-map.spec.ts
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../../docs/design/evidence/tickets-map');
const BUNDLE = process.env.SW_PUBLIC_BUNDLE ? path.resolve(process.env.SW_PUBLIC_BUNDLE) : path.resolve(HERE, '../../smplwise_vms/www-public');
const SVG = fs.readFileSync(path.join(HERE, 'tickets-map-fixture.svg'));
const ORIGIN = 'https://t-demo.arx.example.test';
const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz012345';
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'self'; form-action 'none'; "
  + "frame-ancestors 'none'; base-uri 'none'; manifest-src 'none'";
const HEADERS = { 'content-security-policy': CSP, 'x-frame-options': 'DENY', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff', 'cache-control': 'no-store' };
const HOUR = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d+Z$/, 'Z');

type View = Record<string, unknown>;
function view(over: View = {}): View {
  const now = Date.now();
  return {
    number: 1043, department: 'אחזקה', organization: 'מגדלי הדר', lang: 'he', dir: 'rtl', labels: { one: 'בקשת שירות', many: 'בקשות שירות', gender: 'f' },
    time_zone: 'Asia/Jerusalem', code_required: false, code_ok: true, read_only: false, read_only_until: null, expires_at: iso(now + 240 * HOUR),
    title: 'המזגן מטפטף על השולחן', description: 'טפטוף מהיחידה הפנימית מהבוקר.', priority: { key: 'high', name: 'גבוהה' }, place_text: 'קומה 2 · משרד 12',
    device_name: '', status: 'assigned', eta_at: null, assigned_by: 'יוני', assigned_at: iso(now - 2 * HOUR), created_at: iso(now - 3 * HOUR),
    actions: { statuses: ['acknowledged', 'in_progress'], note: true, eta: true, photo: true, return: true }, timeline: [], photos: [], claim: null, history: null,
    limits: { note_max: 2000, reason_max: 500, photo_max_bytes: 10 * 1024 * 1024, photos_left: 9 },
    map_element: { name: 'מזגן משרד', floor: 'קומה 2', room: 'משרד 12', image: true },
    ...over,
  };
}

async function open(page: Page, v: View, scheme: 'light' | 'dark' = 'light'): Promise<{ mapCalls: Record<string, string>[] }> {
  const mapCalls: Record<string, string>[] = [];
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.route(`${ORIGIN}/**`, async (route: Route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname;
    const tokenOk = req.headers()['x-ticket-token'] === TOKEN;
    const json = (status: number, data: unknown) => route.fulfill({ status, headers: { ...HEADERS, 'content-type': 'application/json' }, body: JSON.stringify(data) });
    if (p.startsWith('/t/assets/')) {
      const file = path.join(BUNDLE, 'assets', path.basename(p));
      if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
      const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream';
      return route.fulfill({ status: 200, headers: { ...HEADERS, 'content-type': type }, body: fs.readFileSync(file) });
    }
    if (p === '/t/') return route.fulfill({ status: 200, headers: { ...HEADERS, 'content-type': 'text/html; charset=utf-8' }, body: fs.readFileSync(path.join(BUNDLE, 'index.html')) });
    if (p === '/t/api/ticket') return tokenOk ? json(200, v) : json(404, { code: 'link_unavailable' });
    if (p === '/t/api/map-image') {
      mapCalls.push(req.headers());
      const has = (v.map_element as { image?: boolean } | undefined)?.image === true;
      return tokenOk && has
        ? route.fulfill({ status: 200, headers: { ...HEADERS, 'cache-control': 'private, no-store', 'content-type': 'image/svg+xml; charset=utf-8' }, body: SVG })
        : json(404, { code: 'link_unavailable' });
    }
    if (p.startsWith('/t/api/')) return json(200, { ok: true });
    return route.fulfill({ status: 404, body: '' });
  });
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
  await page.goto('about:blank');
  await page.goto(`${ORIGIN}/t/#${TOKEN}`);
  await page.waitForSelector('[data-ticket]');
  return { mapCalls };
}

async function shot(page: Page, name: string, scheme: 'light' | 'dark' = 'light'): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(250);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${name}: horizontal overflow`).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}-${scheme}.png`), fullPage: true });
}

test.describe('TKMAP1: the map element on the vendor page', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
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

  test('the picture: fetched with the token header, shown from a blob: URL, the text under the title, nothing to click', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      const { mapCalls } = await open(page, view(), scheme);
      const card = page.locator('[data-map-card="image"]');
      await expect(card).toBeVisible();
      await expect(card.locator('[data-map-line]')).toHaveText('מזגן משרד · קומה 2 · משרד 12');
      const img = card.locator('img.map-img');
      await expect(img).toHaveAttribute('src', /^blob:/);
      await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
      expect(mapCalls.length).toBeGreaterThan(0);
      expect(mapCalls[0]['x-ticket-token']).toBe(TOKEN);
      await expect(card.locator('a, button, input, [tabindex]')).toHaveCount(0);
      await shot(page, 'public-map-image', scheme);
    }
  });

  test('the element left the map: the stored text only, no picture is asked for; no element: no card', async ({ page }) => {
    const gone = await open(page, view({ map_element: { name: 'מזגן משרד', floor: 'קומה 2', room: 'משרד 12', image: false } }));
    await expect(page.locator('[data-map-card="text"] [data-map-text-only]')).toBeVisible();
    expect(gone.mapCalls).toHaveLength(0);
    await shot(page, 'public-map-text-only');
    await open(page, view({ map_element: undefined }));
    await expect(page.locator('[data-map-card]')).toHaveCount(0);
  });
});
