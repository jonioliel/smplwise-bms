import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// PRESENCE-DESIGN-2300: the building presence home card (beside the clock and alarm cards, in the layout the home picks for the width) and
// its settings page, in every state (loading / empty / error / ready, plus unknown, one room and a 500-room worst case), light and dark,
// at the three reference widths (projects desktop 1440, tablet 1024, mobile 390). Harness: tests/presence-design-harness (needs the Vite
// DEV server - the harness imports /src/; a preview build has no tests/ page). Invented data only, no backend.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-presence-design-2300.spec.ts
// PD_SHOTS=<dir> also writes one screenshot per case (docs/evidence/PRESENCE-DESIGN-2300/<phase>).
const SHOTS = process.env.PD_SHOTS;
const LONG = 'חיישן נוכחות בחדר הישיבות הגדול של הנהלת המבנה הצפוני';
const ROOMS = [{ area_id: 'a0', name: 'לובי' }, { area_id: 'a1', name: 'אופן ספייס' }, { area_id: 'a2', name: 'חדר ישיבות קטן' }, { area_id: 'a3', name: 'משרד מנהל' }];

type SettingsState = 'loading' | 'error' | 'off' | 'ready' | 'none';

async function mockSettings(page: Page, st: SettingsState) {
  await page.unroute('**/api/v1/presence/building**').catch(() => undefined);
  const settings = { enabled: st !== 'off', retention_days: 30, home_display: 'card', map_tint: true, hold_seconds: 60, empty_minutes: 10 };
  const sensors = st === 'none' ? [] : Array.from({ length: 14 }, (_, i) => ({
    entity_id: `binary_sensor.p${i}`, name: i === 0 ? LONG : i === 1 ? 'binary_sensor.presence_north_wing_meeting_room_3b' : `חיישן נוכחות ${i + 1}`,
    area_id: ROOMS[i % 4].area_id, area_name: ROOMS[i % 4].name, device_class: i % 2 ? 'motion' : 'occupancy', tagged: i < 9, state: i % 3 === 0 ? 'on' : i % 3 === 1 ? 'off' : 'unavailable', placed: true,
  }));
  await page.route('**/api/v1/presence/building**', async (route: Route) => {
    if (st === 'loading') return; // never answers: the page stays in its loading state
    if (st === 'error') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ detail: 'השרת לא זמין כרגע' }) });
    const p = new URL(route.request().url()).pathname;
    const json = (b: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    if (p.endsWith('/history')) return json({ rows: 1284, oldest: '2026-09-29T08:00:00Z', retention_days: 30, enabled: true });
    return json({ sensors, rooms: ROOMS, settings });
  });
}

async function open(page: Page, scheme: 'light' | 'dark') {
  await page.goto('about:blank');
  await page.goto(`/tests/presence-design-harness/index.html?scheme=${scheme}`);
  await page.waitForFunction(() => (window as unknown as { pdReady?: boolean }).pdReady === true, null, { timeout: 30_000 });
}

const layoutFor = (w: number) => (w < 700 ? 'stack' : 'hero');

async function shot(page: Page, name: string, info: { project: { name: string } }) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.locator('#root').screenshot({ path: path.join(SHOTS, `${info.project.name}-${name}.png`) });
}

const sideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const scheme of ['light', 'dark'] as const) {
  test(`${scheme}: presence home card in every state stays inside its card and the page never scrolls sideways`, async ({ page }, info) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await open(page, scheme);
    const w = page.viewportSize()!.width;
    for (const ds of ['ready', 'empty', 'unknown', 'one', 'worst', 'error', 'loading'] as const) {
      for (const size of ds === 'ready' || ds === 'worst' ? (['s', 'm', 'l'] as const) : (['m'] as const)) {
        await page.evaluate(([d, l, s]) => (window as unknown as { pdMountHome: (...a: unknown[]) => Promise<void> }).pdMountHome(d, l, s), [ds, layoutFor(w), size] as const);
        const card = page.locator('[data-home-widget="presence"]');
        if (ds === 'loading') await expect(card).toHaveCount(0);
        else await expect(card).toBeVisible();
        if (ds === 'error') await expect(page.locator('[data-home-widget-failed="presence"]')).toBeVisible();
        if (ds === 'worst' && size !== 's') {
          // 500 rooms: the chips are capped (no growth, no scroll), the rest is one "more" chip
          expect(await page.locator('[data-building-rooms] .r').count()).toBeLessThanOrEqual(9);
          await expect(page.locator('[data-building-more-rooms]')).toHaveCount(1);
          if (process.env.PD_PHASE !== 'before') {
            // a long room name gives way; the room's state never does (it stays whole inside its chip)
            const first = page.locator('[data-building-rooms] .r').first();
            const [c, s] = [(await first.boundingBox())!, (await first.locator('.st').boundingBox())!];
            expect(s.width).toBeGreaterThan(10);
            expect(s.x).toBeGreaterThanOrEqual(c.x - 0.5);
            expect(s.x + s.width).toBeLessThanOrEqual(c.x + c.width + 0.5);
            expect(await first.locator('.st').evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
          }
        }
        if (ds !== 'loading') {
          const box = (await card.boundingBox())!;
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width).toBeLessThanOrEqual(w + 1);
        }
        expect(await sideScroll(page)).toBeLessThanOrEqual(1);
        await shot(page, `home-${ds}-${size}-${scheme}`, info);
      }
    }
    expect(errors).toEqual([]);
  });

  test(`${scheme}: presence settings - loading, error, off, no sensors and ready`, async ({ page }, info) => {
    test.setTimeout(120_000);
    await open(page, scheme);
    for (const st of ['loading', 'error', 'off', 'none', 'ready'] as const) {
      await mockSettings(page, st);
      await page.evaluate(() => (window as unknown as { pdMountSettings: () => Promise<void> }).pdMountSettings());
      if (st === 'ready') await expect(page.locator('[data-building-table]')).toBeVisible();
      if (st === 'off') await expect(page.locator('[data-building-off-note]')).toBeVisible();
      if (process.env.PD_PHASE !== 'before') {
        // a failed read is an error state with a retry (never the switch drawn as "off"); a pending read is a loading state (never blank)
        if (st === 'loading') await expect(page.locator('[data-building-loading]')).toBeVisible();
        if (st === 'error') {
          await expect(page.locator('[data-building-load-error]')).toBeVisible();
          await expect(page.locator('[data-building-enabled]')).toHaveCount(0);
        }
        if (st === 'ready') await expect(page.locator('[data-building-more] sw-icon').first()).toBeVisible();
      }
      expect(await sideScroll(page)).toBeLessThanOrEqual(1);
      await shot(page, `settings-${st}-${scheme}`, info);
    }
  });
}
