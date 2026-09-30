import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Mobile audit 2026-09-30 (owner screenshots, real Android Chrome, 390 wide):
//  1. the camera wall's toolbar (quality dropdown, an 11-button count row, "סידור הקיר", the kiosk button, the column chips, the
//     caps note) took a large part of the phone screen before the first camera -> ONE short row of compact selects;
//  2. the kiosk on a phone spread 2 x 2 tiles over the whole screen height with dead space between the rows, offered no single
//     column, and its header ran off the screen edge -> tiles pack at their own 16:9 height, the phone has its own layout
//     choices (1x1, 1x2, 1x3, 1x4, 2x2, 2x3) and opens on one column, the header wraps, the summary tiles are one row;
//  3. the amber ring around a tapped `select` is Android Chrome's default focus ring -> one brand-coloured focus ring
//     (styles/focus-policy.ts) for every shadow root.
// Against a MOCKED backend (page.route; snapshots only, no relay). Runs in the "mobile" project (Pixel 7, touch).
// npm run build first; the preview serves dist/.
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/evidence/UIR2-mobile');
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
const CAMS = 8;

test.skip(({ hasTouch }) => !hasTouch, 'the phone project (Pixel 7, touch)');

async function mock(page: Page) {
  await page.route('**/api/v1/**', async (route) => {
    const p = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p === 'me') {
      const perms = ['video.live', 'sources.configure'];
      return json({ user: { id: 'u', username: 'dana', display_name: 'Dana', source: 'ingress' }, channel: 'local', remote: null, bindings: [], permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, bootstrap_state: 'done' });
    }
    if (p === 'cameras') {
      const cameras = Array.from({ length: CAMS }, (_, i) => ({
        id: `c${i + 1}`, recorder_id: 'r', channel: i + 1, name: `מצלמה ${i + 1}`, name_source: 'nvr', alias: null, enabled: true, sort_order: i, grid_col_span: 1, main_track: 1, sub_track: 2,
        status: 'online', last_seen_at: null, can_view_live: false, encoding: { main: { codec: 'H.264', webrtc: 'ok' }, sub: { codec: 'H.264', webrtc: 'ok' } },
      }));
      return json({ cameras, recorder: null, can_sync: true, media: {} });
    }
    if (p === 'settings') return json({ settings: { 'media.transport_default': 'mse', 'media.max_live_sessions': 16, 'media.wall_profile': 'sub', 'snapshots.max_age_s': 60, 'ui.kiosk_cols': 3, 'ui.kiosk_rows': 2 }, can_edit: false });
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-09-30T00:00:00Z', version: 'test' });
    if (/^cameras\/[^/]+\/snapshot\.jpg$/.test(p)) return route.fulfill({ status: 200, contentType: 'image/jpeg', body: GIF });
    if (p === 'me/prefs') return json({ prefs: { 'nav.order': ['devices', 'security', 'explore', 'wiskey'] }, stored: [], updated_at: null });
    return json({ code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: '', details: {} }, 404);
  });
}

async function open(page: Page, hash: string) {
  await page.goto('about:blank');
  await page.goto(`/?design=a#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(1500);
}

async function shot(page: Page, name: string) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}

const noSideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

test.describe('camera wall on a phone: one short toolbar row', () => {
  test('quality, count and columns are compact selects in one row and the first camera starts high', async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.setItem('sw.wall.count', '9'); localStorage.removeItem('sw.wall.cols'); } catch { /* */ } });
    await mock(page);
    await open(page, '/live/wall');
    const wall = page.locator('live-wall');
    const bar = wall.locator('[data-wall-phone-bar]');
    await expect(bar).toBeVisible();
    const b = (await bar.boundingBox())!;
    expect(b.height, 'one row').toBeLessThanOrEqual(56);
    for (const sel of ['[data-wall-quality]', '[data-wall-count-select]', '[data-wall-cols-select]']) {
      const s = (await bar.locator(sel).boundingBox())!;
      expect(s.height, `${sel} is a touch-sized control`).toBeGreaterThanOrEqual(40);
      expect(s.x + s.width, `${sel} stays inside the screen`).toBeLessThanOrEqual(390);
    }
    // the old controls are gone from the phone: no 11-button row, no column chips
    await expect(wall.locator('.layouts')).toHaveCount(0);
    await expect(wall.locator('[data-wall-cols-row]')).toHaveCount(0);
    // the first camera starts in the top third of the screen
    const first = (await wall.locator('sw-camera-tile[data-cam]').first().boundingBox())!;
    expect(first.y, 'the first camera is high on the screen').toBeLessThan(260);
    expect(await noSideways(page)).toBeLessThanOrEqual(0);
    await shot(page, 'wall-phone-toolbar');
    // the choices work with two taps: the count select and the columns select
    await bar.locator('[data-wall-count-select]').selectOption('4');
    await expect(wall.locator('sw-camera-tile[data-cam]')).toHaveCount(4);
    await bar.locator('[data-wall-cols-select]').selectOption('1');
    await expect(wall.locator('.grid')).toHaveAttribute('data-wall-cols', '1');
    await bar.locator('[data-wall-cols-select]').selectOption('0');
    await expect(wall.locator('.grid')).not.toHaveAttribute('data-wall-cols-manual', '');
  });
});

test.describe('kiosk on a phone', () => {
  test('opens on one column, packs the tiles at 16:9 with no dead space, offers phone layouts, and the header fits', async ({ page }) => {
    await mock(page);
    await open(page, '/kiosk/all');
    const kiosk = page.locator('kiosk-wall');
    const tiles = kiosk.locator('sw-camera-tile[data-kiosk-tile]');
    await expect(tiles).toHaveCount(3); // 1 column x 3 rows
    const boxes = [];
    for (const t of await tiles.all()) boxes.push((await t.boundingBox())!);
    expect(boxes[0].width, 'a single column fills the width').toBeGreaterThan(330);
    expect(Math.abs(boxes[0].width / boxes[0].height - 16 / 9), 'the tile keeps its own 16:9 height').toBeLessThan(0.05);
    const gap = boxes[1].y - (boxes[0].y + boxes[0].height);
    expect(gap, 'no dead space between the rows').toBeLessThanOrEqual(14);
    // the header wraps instead of running off the screen; the select is fully visible; 44 px targets
    const sel = kiosk.locator('[data-kiosk-layout]');
    const sb = (await sel.boundingBox())!;
    expect(sb.x).toBeGreaterThanOrEqual(0);
    expect(sb.x + sb.width).toBeLessThanOrEqual(390);
    expect(sb.height).toBeGreaterThanOrEqual(44);
    expect((await kiosk.locator('a[data-kiosk-exit]').boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const overflowing = await kiosk.evaluate((el) => Array.from(el.shadowRoot!.querySelectorAll('header > *')).filter((c) => c.getBoundingClientRect().right > innerWidth + 1 || c.getBoundingClientRect().left < -1).length);
    expect(overflowing, 'no header item is cut off').toBe(0);
    expect(await noSideways(page)).toBeLessThanOrEqual(0);
    // the phone's layout choices
    const options = await sel.locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
    expect(options).toEqual(['1x1', '1x2', '1x3', '1x4', '2x2', '2x3']);
    await expect(sel).toHaveValue('1x3');
    // the summary tiles are one compact scrolling row
    const stats = (await kiosk.locator('.stats').boundingBox())!;
    expect(stats.height, 'compact summary row').toBeLessThan(90);
    await shot(page, 'kiosk-phone-1col');
    // a choice is applied (2 x 2) and the address carries it
    await sel.selectOption('2x2');
    await expect.poll(() => page.evaluate(() => location.hash)).toContain('cols=2');
    await expect(tiles).toHaveCount(4);
    const two = [];
    for (const t of await tiles.all()) two.push((await t.boundingBox())!);
    expect(two[2].y - (two[0].y + two[0].height), 'rows stay packed at 2 columns').toBeLessThanOrEqual(14);
    await shot(page, 'kiosk-phone-2x2');
  });

  test('the address still overrides (cols / rows), the layout in force is always one of the choices; the desktop is unchanged', async ({ page }) => {
    await mock(page);
    await open(page, '/kiosk/all?cols=3&rows=2');
    const kiosk = page.locator('kiosk-wall');
    await expect(kiosk.locator('sw-camera-tile[data-kiosk-tile]')).toHaveCount(6);
    await expect(kiosk.locator('[data-kiosk-layout]')).toHaveValue('3x2');
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page, '/kiosk/all');
    await expect(kiosk.locator('sw-camera-tile[data-kiosk-tile]')).toHaveCount(6); // the installation's 3 x 2
    const options = await kiosk.locator('[data-kiosk-layout] option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
    expect(options).toEqual(['2x2', '3x2', '3x3', '4x3', '4x4', '5x4', '6x4']);
  });
});

test.describe('one focus ring for everything (not the browser\'s amber)', () => {
  const amber = (c: string) => {
    const m = c.match(/\d+(\.\d+)?/g)?.map(Number) ?? [];
    const [r, g, b] = m;
    return r > 180 && g > 100 && b < 100; // amber / yellow / orange family
  };

  test('a focused select or link shows a blue 2 px ring in a touch context', async ({ page }) => {
    await mock(page);
    await open(page, '/kiosk/all');
    const kiosk = page.locator('kiosk-wall');
    const sel = kiosk.locator('[data-kiosk-layout]');
    await sel.tap({ trial: true });
    await sel.focus();
    const ring = await sel.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { color: cs.outlineColor, style: cs.outlineStyle, width: cs.outlineWidth, focus: getComputedStyle(document.documentElement).getPropertyValue('--sw-focus').trim(), visible: el.matches(':focus-visible') };
    });
    expect(ring.visible, 'Chrome treats a focused select as focus-visible').toBe(true);
    expect(ring.style).toBe('solid');
    expect(ring.width).toBe('2px');
    expect(amber(ring.color), `outline ${ring.color} is not amber`).toBe(false);
    const [r, g, b] = (ring.color.match(/\d+/g) ?? []).map(Number);
    expect(b, `outline ${ring.color} is blue`).toBeGreaterThan(Math.max(r, g));
    await shot(page, 'focus-ring-select-phone');
    // keyboard focus on a link: the same ring
    const exit = kiosk.locator('a[data-kiosk-exit]');
    await page.keyboard.press('Tab');
    await exit.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    const link = await exit.evaluate((el) => ({ style: getComputedStyle(el).outlineStyle, color: getComputedStyle(el).outlineColor, focused: el.matches(':focus-visible') }));
    if (link.focused) {
      expect(link.style).toBe('solid');
      expect(amber(link.color)).toBe(false);
    }
  });

  test('an input inside a shared field keeps the field\'s own focus style (no second ring)', async ({ page }) => {
    await mock(page);
    await open(page, '/live/wall');
    const q = page.locator('live-wall [data-wall-quality]');
    await q.focus();
    const st = await q.evaluate((el) => ({ outline: getComputedStyle(el).outlineStyle, shadow: getComputedStyle(el).boxShadow }));
    expect(st.outline, 'sw-field draws its own ring: no outline on top of it').toBe('none');
    expect(st.shadow).not.toBe('none');
  });

  test('the shared sheet is adopted by the document and by shadow roots, and iframes never get a ring from it', async ({ page }) => {
    await mock(page);
    await open(page, '/kiosk/all');
    const r = await page.evaluate(() => {
      const kiosk = document.querySelector('sw-app')!.shadowRoot!.querySelector('kiosk-wall')!;
      const fr = document.createElement('iframe');
      kiosk.shadowRoot!.appendChild(fr);
      fr.focus();
      const cs = getComputedStyle(fr);
      const out = { doc: document.adoptedStyleSheets.length, shadow: kiosk.shadowRoot!.adoptedStyleSheets.length, iframe: cs.outlineStyle };
      fr.remove();
      return out;
    });
    expect(r.doc).toBeGreaterThanOrEqual(1);
    expect(r.shadow).toBeGreaterThanOrEqual(2); // the component's own styles + the focus policy
    expect(r.iframe).toBe('none');
  });
});
