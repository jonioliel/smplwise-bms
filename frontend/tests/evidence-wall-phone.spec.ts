import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pickCols } from './wall-count-helpers';

// Owner bug 2026-09-30 (phone): the camera wall with a MANUAL column choice (localStorage `sw.wall.cols`, or the
// "עמודות" buttons) rendered a narrow strip of small tiles instead of filling the width, because the tile size was
// min(width-based, height-based-to-fit-the-whole-wall-in-the-viewport). Fix 0aa7f748: below 768 px the wall scrolls,
// so a manual column choice is sized by WIDTH only; on a desktop the fit-to-viewport behaviour is unchanged.
//
// No backend: the built app (npx vite build; the preview serves dist/), the API answered by page.route. The wall's
// demo mode (isApi() false) has no column buttons and no fit maths, so it cannot exercise this code path: the
// API-mode wall is used, with 11 cameras that show snapshots only (can_view_live=false: no relay, no WebRTC).

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'docs', 'evidence', 'CR-wall-phone');
const CAMS = 11; // the lab wall of the owner report
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

async function openWall(page: Page, cols: number | null) {
  const ids = Array.from({ length: CAMS }, (_, i) => `c${i + 1}`);
  await page.addInitScript(
    (c) => {
      localStorage.setItem('sw.wall.count', '32'); // the wall shows every camera
      if (c) localStorage.setItem('sw.wall.cols', String(c));
      else localStorage.removeItem('sw.wall.cols');
    },
    cols,
  );
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p === 'me') {
      const perms = ['video.live'];
      return json({
        user: { id: 'u', username: 'dana', display_name: 'Dana', source: 'ingress' }, channel: 'local', remote: null, bindings: [],
        permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, bootstrap_state: 'done',
      });
    }
    if (p === 'cameras') {
      const cameras = ids.map((id, i) => ({
        id, recorder_id: 'r', channel: i + 1, name: `מצלמה ${i + 1}`, name_source: 'nvr', alias: null, enabled: true, sort_order: i, grid_col_span: 1, main_track: 1, sub_track: 2,
        status: 'online', last_seen_at: null, can_view_live: false,
        encoding: { main: { codec: 'H.264', webrtc: 'ok' }, sub: { codec: 'H.264', webrtc: 'ok' } },
      }));
      return json({ cameras, recorder: null, can_sync: false, media: {} });
    }
    if (p === 'settings') return json({ settings: { 'media.transport_default': 'mse', 'media.max_live_sessions': 16, 'media.wall_profile': 'sub', 'snapshots.max_age_s': 60 }, can_edit: false });
    if (/^cameras\/[^/]+\/snapshot\.jpg$/.test(p)) return route.fulfill({ status: 200, contentType: 'image/jpeg', body: GIF });
    return json({ code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: '', details: {} }, 404);
  });
  await page.goto('/?design=a#/live/wall');
  await page.waitForSelector('live-wall');
  await expect(page.locator('live-wall sw-camera-tile[data-cam]')).toHaveCount(CAMS);
  await settle(page);
}

interface Metrics {
  innerW: number;
  innerH: number;
  gridW: number;
  gridBottom: number;
  wallBottom: number;
  gap: number;
  renderedCols: number;
  widths: number[];
  heights: number[];
  attrCols: string | null;
}

const measure = (page: Page): Promise<Metrics> =>
  page.evaluate(() => {
    const find = (root: Document | ShadowRoot): Element | null => {
      const hit = root.querySelector('live-wall');
      if (hit) return hit;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const r = el.shadowRoot && find(el.shadowRoot);
        if (r) return r;
      }
      return null;
    };
    const wall = find(document)!;
    const g = wall.shadowRoot!.querySelector<HTMLElement>('.grid')!;
    const cs = getComputedStyle(g);
    const gb = g.getBoundingClientRect();
    const tiles = Array.from(g.querySelectorAll<HTMLElement>('sw-camera-tile[data-cam]'));
    let bottom = gb.bottom;
    for (let el = g.nextElementSibling as HTMLElement | null; el; el = el.nextElementSibling as HTMLElement | null) bottom = Math.max(bottom, el.getBoundingClientRect().bottom);
    return {
      innerW: window.innerWidth,
      innerH: window.innerHeight,
      gridW: g.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
      gridBottom: gb.bottom,
      wallBottom: bottom,
      gap: parseFloat(cs.columnGap),
      renderedCols: cs.gridTemplateColumns.split(' ').filter(Boolean).length,
      widths: tiles.map((t) => Math.round(t.getBoundingClientRect().width * 10) / 10),
      heights: tiles.map((t) => Math.round(t.getBoundingClientRect().height * 10) / 10),
      attrCols: g.getAttribute('data-wall-cols'),
    };
  });

/** Wait until the layout stops changing (the box is measured after the first paint and re-rendered). */
async function settle(page: Page) {
  let last = '';
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(250);
    const m = JSON.stringify((await measure(page)).widths);
    if (m === last) return;
    last = m;
  }
}

async function clickCols(page: Page, n: number) {
  await pickCols(page, n); // LV1: the columns are the shared compact dropdown on every width
  await settle(page);
}

/** every span-1 tile is (grid width - gaps) / columns wide; the tile is floored to whole px by the sizing maths */
function expectFillsWidth(m: Metrics, cols: number, label: string) {
  const exact = (m.gridW - m.gap * (cols - 1)) / cols;
  const ofGrid = m.gridW / cols; // the plain "inner width / columns" figure: differs from `exact` by the gaps only
  console.log(`${label}: cols=${cols} gridW=${m.gridW} gap=${m.gap} expected=${exact.toFixed(1)} (w/cols=${ofGrid.toFixed(1)}) rendered=${m.widths[0]} (min ${Math.min(...m.widths)}, max ${Math.max(...m.widths)}) height=${m.heights[0]} renderedCols=${m.renderedCols}`);
  expect(m.renderedCols, `${label}: rendered columns`).toBe(cols);
  for (const w of m.widths) expect(Math.abs(w - exact), `${label}: tile width ${w} vs ${exact.toFixed(1)}`).toBeLessThanOrEqual(3);
  expect(Math.abs(m.widths[0] - ofGrid), `${label}: within the gap share of w/cols`).toBeLessThanOrEqual(m.gap + 3);
}

test.describe('camera wall on a phone (390x844): a manual column choice fills the width', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test.beforeEach(async ({}, testInfo) => {
    testInfo.skip(testInfo.project.name !== 'desktop', 'the desktop project with a phone-sized viewport');
    fs.mkdirSync(OUT, { recursive: true });
  });

  for (const cols of [1, 2, 3]) {
    test(`manual ${cols} column(s) from localStorage before load: tiles fill the width`, async ({ page }) => {
      await openWall(page, cols);
      const m = await measure(page);
      expect(m.innerW).toBe(390);
      expectFillsWidth(m, cols, `phone localStorage ${cols}`);
      await page.screenshot({ path: path.join(OUT, `phone-390-manual-${cols}.png`) });
    });

    test(`manual ${cols} column(s) by clicking the "עמודות" button: tiles fill the width`, async ({ page }) => {
      await openWall(page, null);
      await clickCols(page, cols);
      expectFillsWidth(await measure(page), cols, `phone click ${cols}`);
    });
  }

  test('1 -> 6 -> 1 (buttons) gives the same widths as the first load with 1 column', async ({ page }) => {
    await openWall(page, 1);
    const first = await measure(page);
    expectFillsWidth(first, 1, 'first load 1');
    await clickCols(page, 6);
    const six = await measure(page);
    console.log(`after 6: renderedCols=${six.renderedCols} width=${six.widths[0]}`);
    expect(six.renderedCols).toBe(6);
    await clickCols(page, 1);
    const back = await measure(page);
    console.log(`1 -> 6 -> 1: first=${first.widths[0]} back=${back.widths[0]}`);
    expect(back.widths).toEqual(first.widths);
    expect(back.heights).toEqual(first.heights);
    // and the other way: a load with 6 columns, then 1
    await page.evaluate(() => localStorage.setItem('sw.wall.cols', '6'));
    await page.reload();
    await page.waitForSelector('live-wall');
    await expect(page.locator('live-wall sw-camera-tile[data-cam]')).toHaveCount(CAMS);
    await settle(page);
    await clickCols(page, 1);
    expect((await measure(page)).widths).toEqual(first.widths);
  });

  test('auto mode on a phone still caps at 2 columns', async ({ page }) => {
    await openWall(page, null);
    const m = await measure(page);
    console.log(`phone auto: attr cols=${m.attrCols} renderedCols=${m.renderedCols} width=${m.widths[0]} gridW=${m.gridW} gap=${m.gap}`);
    expect(m.renderedCols).toBe(2);
    const exact = (m.gridW - m.gap) / 2;
    for (const w of m.widths) expect(Math.abs(w - exact)).toBeLessThanOrEqual(3);
    await page.screenshot({ path: path.join(OUT, 'phone-390-auto.png') });
  });
});

test.describe('camera wall on a desktop (1440x900): fit-to-viewport is unchanged', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.beforeEach(async ({}, testInfo) => {
    testInfo.skip(testInfo.project.name !== 'desktop', 'the desktop project');
    fs.mkdirSync(OUT, { recursive: true });
  });

  test('auto: the whole wall fits the viewport height, no vertical overflow', async ({ page }) => {
    await openWall(page, null);
    const m = await measure(page);
    console.log(`desktop auto: cols=${m.attrCols} tile=${m.widths[0]}x${m.heights[0]} gridBottom=${m.gridBottom} wallBottom=${m.wallBottom} innerH=${m.innerH}`);
    expect(m.gridBottom).toBeLessThanOrEqual(m.innerH);
    expect(m.wallBottom).toBeLessThanOrEqual(m.innerH);
    await page.screenshot({ path: path.join(OUT, 'desktop-1440-auto.png') });
  });

  test('manual 3 columns (localStorage and button): the wall still fits the viewport height; tiles are height-bound, not full width', async ({ page }) => {
    await openWall(page, 3);
    const m = await measure(page);
    const full = (m.gridW - m.gap * 2) / 3;
    console.log(`desktop manual 3: tile=${m.widths[0]}x${m.heights[0]} fullWidthTile=${full.toFixed(1)} gridBottom=${m.gridBottom} wallBottom=${m.wallBottom} innerH=${m.innerH}`);
    expect(m.renderedCols).toBe(3);
    expect(m.gridBottom).toBeLessThanOrEqual(m.innerH);
    expect(m.wallBottom).toBeLessThanOrEqual(m.innerH);
    expect(m.widths[0], 'the height budget binds on a desktop: narrower than the full column width').toBeLessThan(full - 20);
    await page.screenshot({ path: path.join(OUT, 'desktop-1440-manual-3.png') });
    // the button path gives the same result
    await openWallClickOnly(page);
  });

  async function openWallClickOnly(page: Page) {
    const viaLs = await measure(page);
    await page.evaluate(() => localStorage.removeItem('sw.wall.cols'));
    await page.reload();
    await page.waitForSelector('live-wall');
    await expect(page.locator('live-wall sw-camera-tile[data-cam]')).toHaveCount(CAMS);
    await settle(page);
    await clickCols(page, 3);
    const viaClick = await measure(page);
    console.log(`desktop manual 3 by click: tile=${viaClick.widths[0]}x${viaClick.heights[0]} wallBottom=${viaClick.wallBottom}`);
    expect(viaClick.widths).toEqual(viaLs.widths);
    expect(viaClick.wallBottom).toBeLessThanOrEqual(viaClick.innerH);
  }
});
