import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pickCols } from './wall-count-helpers';

// Mobile audit 2026-09-30 (owner screenshots, real Android Chrome, 390 wide):
//  1. the camera wall's toolbar (quality dropdown, an 11-button count row, "סידור הקיר", the kiosk button, the column chips, the
//     caps note) took a large part of the phone screen before the first camera -> ONE short row of compact selects;
//  2. the kiosk on a phone spread 2 x 2 tiles over the whole screen height with dead space between the rows, offered no single
//     column, and its header ran off the screen edge -> tiles pack at their own 16:9 height, the phone has its own layout
//     choices (1x1, 1x2, 1x3, 1x4, 2x2, 2x3) and opens on one column, the header wraps, the summary tiles are one row;
//  3. the amber ring around a tapped `select` is Android Chrome's default focus ring -> one brand-coloured focus ring
//     (styles/focus-policy.ts) for every shadow root.
// WALL-PHONE-TOOLBAR-2401 (owner 04.11 evening): the toolbar is ONE row of icon keys by default (<= 56 px at 390 px, 44 px keys, the full name
// on a long press / as the tooltip and accessible name); the setting ui.wall_phone_bar = labels brings back the two rows with full labels.
// Neither mode cuts a label with an ellipsis, neither scrolls sideways.
// Against a MOCKED backend (page.route; snapshots only, no relay). Runs in the "mobile" project (Pixel 7, touch).
// npm run build first; the preview serves dist/.
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/evidence/UIR2-mobile');
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
const CAMS = 8;

test.skip(({ hasTouch }) => !hasTouch, 'the phone project (Pixel 7, touch)');

async function mock(page: Page, extra: Record<string, unknown> = {}) {
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
    if (p === 'settings') return json({ settings: { 'media.transport_default': 'mse', 'media.max_live_sessions': 16, 'media.wall_profile': 'sub', 'snapshots.max_age_s': 60, 'ui.kiosk_cols': 3, 'ui.kiosk_rows': 2, ...extra }, can_edit: false });
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
    for (const sel of ['[data-wall-quality]', '[data-wall-count-select]', '[data-wall-cols-dd]']) {
      const s = (await bar.locator(sel).boundingBox())!;
      expect(s.height, `${sel} is a touch-sized control`).toBeGreaterThanOrEqual(sel === '[data-wall-cols-dd]' ? 32 : 40); // the dropdown chip is 32 px with a 44 px hit area (::after)
      expect(s.x + s.width, `${sel} stays inside the screen`).toBeLessThanOrEqual(390);
    }
    // WALL-PHONE-TOOLBAR-2401: the default is the icon row - every key a 44 px target with no text on it (nothing to cut, no ellipsis), its
    // full name as the accessible name and the tooltip
    await expect(bar).toHaveAttribute('data-mode', 'icons');
    const keys = await bar.evaluate((el) => Array.from(el.querySelectorAll('[data-wall-key]')).map((k) => {
      const r = k.getBoundingClientRect();
      const chip = k.shadowRoot?.querySelector('.chip');
      const own = (chip ?? k) as Element;
      // the words drawn on the key: a dropdown's label text, or the key's own text nodes (the select inside is invisible, the badge is a number)
      const drawn = chip ? chip.querySelector('.txt')?.textContent ?? '' : Array.from(k.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent ?? '').join('');
      return { w: r.width, h: r.height, right: r.right, hint: k.getAttribute('data-hint') ?? '', title: own.getAttribute('title') ?? '', text: drawn.trim(), ellipsis: getComputedStyle(own).textOverflow === 'ellipsis' };
    }));
    expect(keys.length, 'quality, count, columns, kiosk').toBe(4);
    for (const k of keys) {
      expect(Math.min(k.w, k.h), `${k.hint}: a touch-sized key`).toBeGreaterThanOrEqual(44);
      expect(k.right, `${k.hint}: inside the screen`).toBeLessThanOrEqual(390);
      expect(k.hint, 'a full name').toMatch(/^(איכות|מספר מצלמות|עמודות בקיר|קיוסק): .+/);
      expect(k.title, `${k.hint}: the tooltip is the full name`).not.toBe('');
      expect(k.text, `${k.hint}: no label on the key`).toBe('');
      expect(k.ellipsis).toBe(false);
    }
    await expect(bar.locator('[data-wall-quality]')).toHaveAttribute('aria-label', 'איכות');
    await expect(bar.locator('sw-dropdown[data-wall-cols-dd] [data-dropdown-chip]')).toHaveAttribute('aria-label', 'עמודות בקיר: עמודות אוטו');
    expect(await bar.locator('[data-wall-count-select]').evaluate((s) => s.closest('[data-wall-key]')?.getAttribute('data-hint'))).toBe('מספר מצלמות: כל המצלמות (8)'); // 9 stored, 8 cameras: all
    await expect(bar.locator('.kbadge')).toHaveText('8');
    for (const sel of ['[data-wall-quality]', '[data-wall-count-select]']) {
      const s = (await bar.locator(sel).boundingBox())!;
      expect(Math.min(s.width, s.height), `${sel}: the select covers the whole 44 px key`).toBeGreaterThanOrEqual(44);
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
    await pickCols(page, 1);
    await expect(wall.locator('.grid')).toHaveAttribute('data-wall-cols', '1');
    await pickCols(page, 0);
    await expect(wall.locator('.grid')).not.toHaveAttribute('data-wall-cols-manual', '');
    // the count key carries the number chosen; the columns key a number only when chosen by hand
    await expect(bar.locator('.kbadge')).toHaveText('4');
    await expect(bar.locator('sw-dropdown[data-wall-cols-dd] [data-dd-badge]')).toHaveCount(0);
  });

  test('a long press shows the key\'s full name and does not also open the control', async ({ page }) => {
    await mock(page);
    await open(page, '/live/wall');
    const bar = page.locator('live-wall [data-wall-phone-bar]');
    await expect(bar).toHaveAttribute('data-mode', 'icons');
    const press = async (sel: string) => {
      const b = (await bar.locator(sel).boundingBox())!;
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(800);
    };
    // the columns key: the name shows while the finger rests, the release does not open the list
    await press('sw-dropdown[data-wall-cols-dd]');
    const hint = bar.locator('[data-wall-key-hint]');
    await expect(hint).toHaveText('עמודות בקיר: עמודות אוטו');
    const hb = (await hint.boundingBox())!;
    expect(hb.x).toBeGreaterThanOrEqual(0);
    expect(hb.x + hb.width, 'the name stays inside the screen').toBeLessThanOrEqual(390);
    const before = (await bar.boundingBox())!;
    expect(before.height, 'the name floats: the row keeps its height').toBeLessThanOrEqual(56);
    await page.mouse.up();
    await page.waitForTimeout(300);
    await expect(bar.locator('sw-dropdown[data-wall-cols-dd] [data-dropdown-chip]')).toHaveAttribute('aria-expanded', 'false');
    await shot(page, 'wall-phone-toolbar-longpress');
    // the kiosk key: a long press names it and does not open a new tab
    const tabs = page.context().pages().length;
    await press('[data-open-kiosk]');
    await expect(hint).toHaveText('קיוסק: פותח את הקיוסק בלשונית חדשה');
    await page.mouse.up();
    await page.waitForTimeout(500);
    expect(page.context().pages().length, 'no kiosk tab from a long press').toBe(tabs);
    // the name goes away by itself
    await expect(hint).toHaveCount(0, { timeout: 5000 });
    expect(await noSideways(page)).toBeLessThanOrEqual(0);
  });

  test('the option "two rows with full labels": every label whole, no ellipsis, no sideways scroll', async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.setItem('sw.wall.count', '9'); localStorage.removeItem('sw.wall.cols'); } catch { /* */ } });
    await mock(page, { 'ui.wall_phone_bar': 'labels' });
    await open(page, '/live/wall');
    const wall = page.locator('live-wall');
    const bar = wall.locator('[data-wall-phone-bar]');
    await expect(bar).toHaveAttribute('data-mode', 'labels');
    await expect(bar.locator('[data-wall-key]')).toHaveCount(0);
    const b = (await bar.boundingBox())!;
    expect(b.height, 'two rows').toBeGreaterThan(56);
    expect(b.height, 'not more than two rows').toBeLessThanOrEqual(120);
    const controls = await bar.evaluate((el) => {
      const canvas = document.createElement('canvas').getContext('2d')!;
      const out: { name: string; text: string; fits: boolean; ellipsis: boolean; right: number; h: number }[] = [];
      for (const sel of Array.from(el.querySelectorAll('select'))) {
        const cs = getComputedStyle(sel);
        const field = sel.closest('sw-field');
        // the field's icon and chevron sit inside the padding of a capsule select; a plain select draws its own arrow at the end
        const arrow = field?.hasAttribute('capsule') ? 0 : 20;
        const avail = sel.clientWidth - parseFloat(cs.paddingInlineStart) - parseFloat(cs.paddingInlineEnd) - arrow;
        canvas.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const text = sel.selectedOptions[0]?.textContent?.trim() ?? '';
        const r = sel.getBoundingClientRect();
        out.push({ name: sel.getAttribute('aria-label') ?? '?', text, fits: canvas.measureText(text).width <= avail + 0.5, ellipsis: cs.textOverflow === 'ellipsis', right: r.right, h: r.height });
      }
      const dd = el.querySelector('sw-dropdown[data-wall-cols-dd]');
      const txt = dd?.shadowRoot?.querySelector('.chip .txt') as HTMLElement | null;
      if (dd && txt) {
        const r = dd.getBoundingClientRect();
        out.push({ name: 'עמודות בקיר', text: txt.textContent?.trim() ?? '', fits: txt.scrollWidth <= txt.clientWidth + 0.5 && txt.scrollHeight <= txt.clientHeight + 3, ellipsis: getComputedStyle(txt).textOverflow === 'ellipsis', right: r.right, h: r.height });
      }
      return out;
    });
    expect(controls.map((c) => c.name), 'quality, count, columns').toEqual(['איכות', 'מספר מצלמות', 'עמודות בקיר']);
    expect(controls.map((c) => c.text)).toEqual(['איכות: אוטו', 'כל המצלמות (8)', 'עמודות אוטו']); // 9 stored, 8 cameras: all
    for (const c of controls) {
      expect(c.fits, `${c.name}: "${c.text}" is shown whole`).toBe(true);
      expect(c.ellipsis, `${c.name}: no ellipsis`).toBe(false);
      expect(c.right, `${c.name}: inside the screen`).toBeLessThanOrEqual(390);
      expect(c.h, `${c.name}: touch-sized`).toBeGreaterThanOrEqual(40);
    }
    expect(await noSideways(page)).toBeLessThanOrEqual(0);
    await shot(page, 'wall-phone-toolbar-two-rows');
    // the controls work the same
    await bar.locator('[data-wall-count-select]').selectOption('4');
    await expect(wall.locator('sw-camera-tile[data-cam]')).toHaveCount(4);
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
