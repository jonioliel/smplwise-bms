import { test, expect, type Page, type Route } from '@playwright/test';
import { FLOOR, SITE, SWITCH_AT, T_DAY, installReplayMock } from './replay-3d-mocks';

// CR-TIMESCRUB101 section 10.4 (owner layout rule 2026-10-24): with the time scrub on, the historical map never scrolls - at
// 1366x768, 1024x768, 375x812 and 375x667, after a wheel over the plan and over the panel, the document and the shell's
// content column stay at scrollTop 0, the document's scrollHeight fits the viewport, and the timeline bar is inside the
// viewport (above the phone's bottom bar). Also: presence is off by default, a locked layer is drawn locked with its switch
// disabled, and a gap at the cursor shows the warning bar. Mocked backend (replay-3d-mocks + the history routes below);
// no device, no network beyond the page.

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const GAP = { from: '2026-06-21T09:20:00Z', to: '2026-06-21T09:40:00Z', reason: 'disconnected' };
const COVERAGE = { from: '2026-06-01T00:00:00Z', to: null, gaps: [GAP], forward_fill_max_s: 86400 };
const layer = (entities: Record<string, unknown>, status = 'ok', retention = 30) => ({ status, retention_days: retention, from: '2026-06-01T00:00:00Z', entities });
const st = (state: string, at = SWITCH_AT) => ({ state, changed_at: at, known: true, reason: null });

function snapshot(at: string) {
  const on = at >= SWITCH_AT;
  const inGap = at >= GAP.from && at < GAP.to;
  const s = (v: string) => (inGap ? { state: null, changed_at: null, known: false, reason: 'gap' } : st(v));
  return {
    at, floor_id: FLOOR, settings: { range_max_days: 7, presence_retention_days: 7 }, coverage: COVERAGE,
    layers: {
      lights: layer({ 'light.hall': s(on ? 'on' : 'off') }, inGap ? 'gap' : 'ok'),
      presence: layer({}, 'not_permitted', 7),
      openings: layer({ 'binary_sensor.front_door': s(on ? 'on' : 'off'), 'lock.front': s('locked') }, inGap ? 'gap' : 'ok'),
      temperature: layer({ 'sensor.office_temp': s('22.5') }, inGap ? 'gap' : 'ok'),
      devices: layer({}, 'empty'),
      alarm: layer({}, 'empty'),
      elevators: { status: 'empty', retention_days: 8, from: null, position: 'not_recorded', items: {} },
      cameras: { status: 'ok', camera_ids: ['cam-hist'] },
      events: { status: 'ok', retention_days: 30 },
    },
  };
}

function range(from: string, to: string) {
  const pts = (pre: string, post: string) => {
    const points: [string, string, number][] = SWITCH_AT >= from && SWITCH_AT <= to ? [[SWITCH_AT, post, 1]] : [];
    return { initial: { state: pre, known: true }, points, bounded_after: false };
  };
  return {
    from, to, floor_id: FLOOR, bucket_s: null, coverage: COVERAGE,
    layers: {
      lights: layer({ 'light.hall': pts('off', 'on') }),
      presence: layer({}, 'not_permitted', 7),
      openings: layer({ 'binary_sensor.front_door': pts('off', 'on') }),
      temperature: layer({}), devices: layer({}, 'empty'), alarm: layer({}, 'empty'),
      elevators: { status: 'empty', retention_days: 8, from: null, position: 'not_recorded', items: {} },
    },
  };
}

async function install(page: Page) {
  await installReplayMock(page);
  // registered after the replay mock: these answer first
  await page.route('**/api/v1/settings', (route) => json(route, {
    settings: { 'ui.design': 'a', 'ui.scheme': 'light', 'time.zone': 'Asia/Jerusalem', 'plan.quality': '1', 'map.default_view': '2d', 'plan.levels': 'all', 'site.latitude': SITE.latitude, 'site.longitude': SITE.longitude, 'history.timescrub': 'true', 'history.range_max_days': 7 },
    can_edit: false, nvr_channels: [], warnings: [],
  }));
  await page.route(`**/api/v1/floors/${FLOOR}/history/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/history/snapshot')) return json(route, snapshot(url.searchParams.get('at') ?? T_DAY));
    if (url.pathname.endsWith('/history/range')) return json(route, range(url.searchParams.get('from') ?? T_DAY, url.searchParams.get('to') ?? T_DAY));
    return json(route, { code: 'not_found', user_message: 'not found', retryable: false, correlation_id: '', details: {} }, 404);
  });
}

async function noScroll(page: Page) {
  const host = page.locator('investigate-history-map');
  for (const sel of ['investigate-history-map .stage', 'investigate-history-map .panel']) {
    const box = await page.locator(sel).first().boundingBox();
    if (!box) continue;
    await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 40));
    await page.mouse.wheel(0, 2000);
  }
  await page.waitForTimeout(300);
  const m = await page.evaluate(() => {
    const main = document.querySelector('sw-app')?.shadowRoot?.querySelector('main') as HTMLElement | null;
    const se = document.scrollingElement as HTMLElement;
    return { docTop: se.scrollTop, docH: se.scrollHeight, innerH: window.innerHeight, mainTop: main?.scrollTop ?? 0, mainOverflow: main ? main.scrollHeight - main.clientHeight : 0 };
  });
  expect(m.docTop).toBe(0);
  expect(m.docH).toBeLessThanOrEqual(m.innerH);
  expect(m.mainTop).toBe(0);
  expect(m.mainOverflow).toBeLessThanOrEqual(1);
  const tl = await host.locator('[data-history-timeline]').boundingBox();
  expect(tl).toBeTruthy();
  const vh = page.viewportSize()!.height;
  expect(tl!.y).toBeGreaterThanOrEqual(0);
  expect(tl!.y + tl!.height).toBeLessThanOrEqual(vh + 0.5);
  // above the phone's bottom bar, when it is shown
  const bottomBar = await page.locator('sw-app nav.bottom').first().boundingBox().catch(() => null);
  if (bottomBar && bottomBar.height > 0) expect(tl!.y + tl!.height).toBeLessThanOrEqual(bottomBar.y + 0.5);
}

const SIZES = [
  { width: 1366, height: 768 },
  { width: 1024, height: 768 },
  { width: 375, height: 812 },
  { width: 375, height: 667 },
];

test.describe('time scrub: the page never scrolls (CR-TIMESCRUB101 3.1 / 10.4)', () => {
  for (const size of SIZES) {
    test(`${size.width}x${size.height}: no document scroll, timeline inside the viewport`, async ({ page }) => {
      await page.setViewportSize(size);
      await install(page);
      await page.goto(`/?design=a#/investigate/floors/${FLOOR}/history?t=${encodeURIComponent(T_DAY)}`);
      const host = page.locator('investigate-history-map');
      await expect(host).toHaveAttribute('data-scrub', '');
      await expect(host.locator('[data-history-timeline]')).toBeVisible({ timeout: 20000 });
      await expect(host.locator('[data-history-layers] .lyr[data-layer="lights"]')).toHaveAttribute('data-status', /^(ok|gap)$/, { timeout: 20000 });
      await noScroll(page);
      // play mode adds the play / speed controls: still one row, still no scroll
      await host.locator('[data-mode="play"]').click();
      await noScroll(page);
      if (size.width <= 767) {
        await host.locator('[data-history-details]').click();
        await expect(host.locator('[data-history-details-sheet]')).toBeVisible();
        await noScroll(page);
      }
    });
  }

  test('legend: presence off by default, a locked layer is drawn locked, a gap at the cursor shows the warning bar', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await install(page);
    await page.addInitScript(() => { try { localStorage.removeItem('sw.history.layers'); } catch { /* */ } });
    await page.goto(`/?design=a#/investigate/floors/${FLOOR}/history?t=${encodeURIComponent(T_DAY)}`);
    const host = page.locator('investigate-history-map');
    const pres = host.locator('.lyr[data-layer="presence"]');
    await expect(pres).toHaveAttribute('data-status', 'not_permitted', { timeout: 20000 });
    await expect(pres.locator('[role="switch"]')).toBeDisabled();
    await expect(pres.locator('[role="switch"]')).toHaveAttribute('aria-checked', 'false');
    await expect(pres).toContainText('לא מורשה');
    await expect(host.locator('.lyr[data-layer="lights"] [role="switch"]')).toHaveAttribute('aria-checked', 'true');
    // T_DAY (09:30Z) is inside the mocked gap 09:20-09:40Z
    await expect(host.locator('[data-history-gap]')).toBeVisible({ timeout: 20000 });
    await expect(host.locator('[data-history-tag]')).toHaveClass(/gap/);
  });
});
