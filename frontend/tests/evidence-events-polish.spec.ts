import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// EVENTS-POLISH-2331: the event centre (Security › investigate › events) against a faked backend (page.route; no device, no recorder).
// The owner's complaint: the side panel's actions sat at the very bottom of the PAGE (the panel was as tall as the list). Asserted here:
// the page itself does not scroll on a desktop / tablet, the list scrolls inside its own panel with a sticky header, the panel's primary
// action is inside the viewport without any scrolling (desktop, tablet and the phone's full-screen sheet), the keyboard moves between
// events (Esc / Up / Down / Enter), the raw device codes read in Hebrew and the technical lines live behind "פרטים טכניים".
// Screenshots: EVPOLISH_OUT (default docs/evidence/EVENTS-POLISH-2331), file prefix EVPOLISH_PHASE (default "after"). With
// EVPOLISH_PHASE=before the assertions are skipped (the shots of the old build only).
//   SW_BASE_URL=http://127.0.0.1:4199/ npx playwright test tests/evidence-events-polish.spec.ts
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.EVPOLISH_OUT || path.resolve(HERE, '..', '..', 'docs', 'evidence', 'EVENTS-POLISH-2331');
const PHASE = process.env.EVPOLISH_PHASE || 'after';
const CHECK = PHASE !== 'before';

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
const PERMS = ['events.read', 'events.ack', 'devices.read', 'map.read', 'cases.read', 'video.playback'];
const CAMS = [
  { id: 'c1', name: 'כניסה ראשית', channel: 1, recorder_id: 'nvr-1' },
  { id: 'c2', name: 'חניה מקורה', channel: 2, recorder_id: 'nvr-1' },
  { id: 'c3', name: 'מסדרון מזרחי', channel: 3, recorder_id: 'nvr-1' },
  { id: 'c4', name: 'חצר אחורית', channel: 4, recorder_id: 'nvr-1' },
];
// invented sample rows in the shape the backend stores them (services/events_ingest.py): raw device codes and the device's own English text
const KINDS: [string, string, string, string][] = [
  ['VMD', 'motion', 'info', 'Motion alarm'],
  ['linedetection', 'line', 'alert', 'linedetection alarm'],
  ['fielddetection', 'field', 'alert', 'fielddetection alarm'],
  ['VMD', 'motion', 'info', 'Motion alarm'],
  ['videoloss', 'offline', 'critical', 'videoloss alarm'],
  ['shelteralarm', 'tamper', 'alert', 'shelteralarm alarm'],
];
const EVENTS = Array.from({ length: 36 }, (_, i) => {
  const [raw, type, severity, description] = KINDS[i % KINDS.length];
  const cam = CAMS[i % CAMS.length];
  const min = 6 + i * 11;
  return {
    id: `e${i + 1}`, source: 'alertstream', raw_type: raw, type, camera_id: cam.id, camera_name: cam.name, recorder_id: 'nvr-1', channel: cam.channel,
    occurred_at: ago(min), ended_at: ago(min - 0.8), received_at: ago(min), state: 'inactive', count: i % 5 === 0 ? 3 : 1, severity, confidence: 'measured',
    details: { description, device_time: ago(min), time_precision: 'device_offset', target: null, active_post_count: 1 },
    acked_at: i % 4 === 3 ? ago(min - 2) : null, acked_by_username: i % 4 === 3 ? 'dana' : null, thumbnail: i % 3 === 2 ? 'unavailable' : 'ready',
  };
});
const FACETS = {
  days: 90, since: ago(90 * 1440), types: [{ type: 'motion', count: 12 }, { type: 'line', count: 6 }], sources: [{ source: 'alertstream', count: 36 }], severities: [],
  unavailable_types: [{ type: 'person', reason: 'המצלמות אינן שולחות זיהוי אדם' }], notes: [],
  places: [{ id: 's1', name: 'אתר', buildings: [{ id: 'b1', name: 'בניין A', floors: [{ id: 'f1', name: 'קומת קרקע', cameras: 4, sensors: 0, zones: [] }] }] }],
};
const INGEST = { connected: true, last_heartbeat_at: ago(0.2), last_event_at: ago(6), last_error: null, reconnects: 0, events_stored: 36, started_at: ago(600) };
// a neutral "frame" (an SVG gradient) for every thumbnail: no customer picture anywhere
const FRAME = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b4a5e"/><stop offset="1" stop-color="#8aa0b8"/></linearGradient></defs><rect width="640" height="360" fill="url(#g)"/><rect x="380" y="150" width="70" height="150" rx="20" fill="#d8e0ea" opacity=".55"/></svg>`;

async function installApi(page: Page) {
  await page.routeWebSocket('**/events/ws', () => { /* accepted, silent */ });
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    if (p === 'me') {
      return json(route, {
        user: { id: 'u1', username: 'dana', display_name: 'דנה', source: 'ingress' }, channel: 'local', remote: null, bindings: [], permissions_installation: PERMS, permissions_any: PERMS,
        has_access: true, permission_revision: 1, bootstrap_state: 'done', mode: 'full',
        capabilities: { nvr: true, go2rtc: true, ha: true, live_video: true, playback: true, events_recorder: true, events_ha: true, ha_cameras_still: true, ha_cameras_live: false, supported: true, unsupported_reason: null },
      });
    }
    if (p === 'me/prefs') return json(route, { prefs: {}, stored: [] });
    if (p === 'settings') return json(route, { settings: { 'ui.design': 'a', 'time.zone': 'Asia/Jerusalem' }, can_edit: false });
    if (p === 'events/facets') return json(route, FACETS);
    if (/^events\/[^/]+\/thumbnail$/.test(p)) return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: FRAME });
    if (p === 'events') {
      const unacked = url.searchParams.get('unacked') === 'true' || url.searchParams.get('unacked') === '1';
      const rows = unacked ? EVENTS.filter((e) => !e.acked_at) : EVENTS;
      return json(route, { events: rows, from: ago(1440), to: ago(-5), timezone: 'Asia/Jerusalem', types: ['motion', 'line'], filters: { applied: {}, unsupported: [] }, ingest: INGEST, derive: { last_run: null, last_ok: null, last_error: null, derived: 0 } });
    }
    if (p === 'cameras') return json(route, { cameras: CAMS, recorders: [{ id: 'nvr-1', name: 'NVR' }] });
    if (p === 'incidents/summary') return json(route, { enabled: false, open: 0, latest_id: null, red_dot: 'off' });
    return json(route, { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: 'mock', details: {} }, 404);
  });
}

async function boot(page: Page) {
  await installApi(page);
  await page.goto('about:blank');
  await page.goto('/?design=a#/investigate/events');
  await page.waitForSelector('investigate-events sw-table tr[data-row-id]', { state: 'visible', timeout: 15_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
}

/** How far the shell's scroll container (sw-app's <main>) can scroll: 0 = the page fits. */
const pageScroll = (page: Page) => page.evaluate(() => {
  const main = document.querySelector('sw-app')?.shadowRoot?.querySelector('main');
  const doc = document.scrollingElement!;
  return Math.max(main ? main.scrollHeight - main.clientHeight : 0, doc.scrollHeight - doc.clientHeight);
});

const shot = (page: Page, name: string) => {
  fs.mkdirSync(OUT, { recursive: true });
  return page.screenshot({ path: path.join(OUT, `${PHASE}-${name}.png`) });
};

test.describe('EVENTS-POLISH-2331 event centre', () => {
  test('list, drawer, keyboard and actions in view', async ({ page }, info) => {
    test.setTimeout(90_000);
    const vp = info.project.name;
    await boot(page);
    const screen = page.locator('investigate-events');
    await shot(page, `list-${vp}`);
    if (CHECK && vp !== 'mobile') {
      expect(await pageScroll(page), 'the page itself never scrolls; the list scrolls in its own panel').toBeLessThanOrEqual(1);
      // the list scrolls inside its panel, its header stays put
      const table = screen.locator('sw-table').first();
      const scrolls = await table.evaluate((el) => el.scrollHeight > el.clientHeight + 4);
      expect(scrolls, 'the 36-row list overflows its panel').toBe(true);
      await expect(screen.locator('sw-table tr[data-row-id]').first()).toContainText('זיהוי תנועה');
      await expect(screen.locator('[data-tech-details]')).toHaveCount(1);
      await expect(screen.locator('[data-tech-details]')).not.toHaveAttribute('open', '');
    }

    // open a row near the END of the list: the old panel was as tall as the list, so its actions sat far below the fold
    const rows = screen.locator('sw-table tr[data-row-id]');
    const target = vp === 'mobile' ? rows.nth(3) : rows.nth(20);
    await target.scrollIntoViewIfNeeded();
    await target.click();
    await page.mouse.move(2, 400); // off the list: the hover preview of the row stays out of the shot
    await page.waitForTimeout(700);
    const drawer = screen.locator('sw-drawer[open]').first();
    await expect(drawer).toHaveCount(1);
    await shot(page, `drawer-${vp}`);
    const primary = drawer.locator('[data-review]');
    if (CHECK) {
      // the primary action is inside the viewport as it opens - no scroll of the page, the list or the panel needed
      const vh = await page.evaluate(() => window.innerHeight);
      const vw = await page.evaluate(() => window.innerWidth);
      const box = await primary.boundingBox();
      expect(box, 'the primary action is rendered').not.toBeNull();
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height, 'the primary action is above the bottom edge').toBeLessThanOrEqual(vh);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(vw);
      for (const sel of ['[data-ack]']) {
        const b = await drawer.locator(sel).boundingBox();
        expect(b && b.y + b.height <= vh, `${sel} in view`).toBe(true);
      }
      if (vp !== 'mobile') expect(await pageScroll(page), 'still no page scroll with the panel open').toBeLessThanOrEqual(1);
      // Hebrew for the device's own text; the raw values only behind the technical details
      const body = await drawer.innerText();
      expect(body).not.toContain('device_offset');
      expect(body).not.toContain('Motion alarm');
      expect(body).not.toMatch(/raw:/);
    }

    if (CHECK && vp !== 'mobile') {
      // keyboard: Down moves to the next event, Up back, Enter opens the full review, Esc closes
      const before = await drawer.getAttribute('heading');
      const firstId = await target.getAttribute('data-row-id');
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(200);
      await expect(screen.locator('sw-table tr.selected')).not.toHaveAttribute('data-row-id', firstId!);
      await page.keyboard.press('ArrowUp');
      await page.waitForTimeout(200);
      await expect(screen.locator('sw-table tr.selected')).toHaveAttribute('data-row-id', firstId!);
      expect(await drawer.getAttribute('heading')).toBe(before);
      await page.keyboard.press('Escape');
      await expect(screen.locator('sw-drawer[open]')).toHaveCount(0);
      // the technical details open on demand
      await screen.locator('[data-tech-details] summary').click();
      await page.waitForTimeout(200);
      await shot(page, `tech-${vp}`);
      await screen.locator('[data-tech-details] summary').click();
      // Enter on an open event goes to its full review
      await target.click();
      await page.waitForTimeout(300);
      await page.keyboard.press('Enter');
      await expect.poll(() => page.evaluate(() => location.hash)).toMatch(/#\/investigate\/events\/e\d+/);
    }
    if (CHECK && vp === 'mobile') {
      // the phone's sheet covers the screen and its actions sit in a bottom bar
      const vh = await page.evaluate(() => window.innerHeight);
      const panel = await drawer.evaluate((el) => { const r = el.shadowRoot!.querySelector('.panel')!.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; });
      expect(panel.top).toBeLessThanOrEqual(2);
      expect(panel.bottom).toBeGreaterThanOrEqual(vh - 2);
    }
  });

  test('wide and in-between sizes', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'extra sizes from the desktop project');
    test.setTimeout(90_000);
    for (const [w, h] of [[1920, 1080], [1180, 820]] as const) {
      await page.setViewportSize({ width: w, height: h });
      await boot(page);
      const screen = page.locator('investigate-events');
      await screen.locator('sw-table tr[data-row-id]').nth(2).click();
      await page.waitForTimeout(700);
      await shot(page, `drawer-${w}`);
      if (CHECK) {
        const box = await screen.locator('sw-drawer[open] [data-review]').boundingBox();
        expect(box!.y + box!.height).toBeLessThanOrEqual(h);
        expect(await pageScroll(page)).toBeLessThanOrEqual(1);
      }
    }
  });
});
