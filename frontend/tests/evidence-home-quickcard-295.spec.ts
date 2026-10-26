import { test, expect, type Page, type Route } from '@playwright/test';
import { installGeneratorMock } from './generator-mocks';
import { tree } from './bubble-mocks';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// QUICKHIDE-295 (FIX2231B): the home's quick-actions widget (the "תאורה" / "הכל" pills) can be hidden from הגדרות › מסך ראשי
// (`home.screen.quick_card`, default show). Hidden: the widget is absent and the cards left take the whole row (no hole), on a
// phone, a tablet and the desktop, with no scrolling added. The real build against fake data (the generator mock serves the session; the notices board is on so its card sits beside the quick actions).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-home-quickcard-295.spec.ts --project=desktop
// Screenshots: docs/design/evidence/QUICKHIDE-295/.

const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/QUICKHIDE-295');
const VP = { d: { width: 1366, height: 768 }, t: { width: 1024, height: 1366 }, m: { width: 390, height: 844 } } as const;
type Vp = keyof typeof VP;

const json = (route: Route, body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
const NOTICE = {
  id: 'n1', title: 'פלאפל במבצע', body: 'עד 02.11', severity: 'info', starts_at: '2026-10-22T05:30:00Z', ends_at: '2026-11-02T09:00:00Z', pinned: false, state: 'active', dwell_s: null,
  when_text: null, published_at: '2026-10-22T05:40:00Z', updated_at: '2026-10-23T08:00:00Z', boards: [], read: true,
};
const CAN = { view: true, manage: false, manage_all: false, push: false, boards: false, configure: false };

async function open(page: Page, vp: Vp, quickCard: 'show' | 'hide') {
  await page.setViewportSize(VP[vp]);
  await installGeneratorMock(page, { perms: ['devices.read', 'devices.control_bulk', 'notices.view'], count: 0, modules: { tickets: false, notices: true } as { tickets: boolean } });
  await page.route('**/api/v1/notices**', async (route) => {
    const p = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1\//, '');
    if (p === 'notices/module') return json(route, { enabled: true, can: CAN });
    if (p === 'notices') return json(route, { notices: [NOTICE], can: CAN, now: '2026-10-23T09:00:00Z', defaults: { default_days: 7, default_severity: 'info', home_empty: 'hide' } });
    return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: 'mock', details: {} }) });
  });
  const home = { direction: 'a', side: 'end', time_zone: 'Asia/Jerusalem', personalize: false, config: { notices: { on: true }, quick: { on: true } }, data: {} };
  await page.route('**/api/v1/devices/tree', (route) => json(route, { ...tree(), home }));
  await page.route((u) => u.pathname.endsWith('/api/v1/settings'), (route) => json(route, { settings: { 'ui.design': 'a', 'ui.skin': 'bubble', 'home.info_style': 'cards', 'home.screen': { quick_card: quickCard } }, can_edit: false }));
  await page.addInitScript(() => {
    try {
      localStorage.setItem('sw.devices.layout', 'cards');
    } catch {
      /* storage unavailable */
    }
  });
  await page.goto('about:blank');
  await page.goto('/?design=a&skin=bubble#/devices/building');
  await page.waitForSelector('sw-app devices-building home-widgets');
  await page.waitForTimeout(500);
}

async function shot(page: Page, name: string) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCE, `${name}.png`) });
}

const B = (page: Page) => page.locator('sw-app devices-building');
const overflowX = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** Per row of cards (same top): how far its cards' union is from the widget area's two edges - 0 = no hole. */
const rowGaps = (page: Page) =>
  page.evaluate(() => {
    const host = document.querySelector('sw-app')?.shadowRoot?.querySelector('devices-building')?.shadowRoot?.querySelector('home-widgets');
    const root = host?.shadowRoot;
    const wrap = root?.querySelector('.wrap') as HTMLElement | null;
    if (!wrap) return null;
    const w = wrap.getBoundingClientRect();
    const rows = new Map<number, { l: number; r: number }>();
    for (const el of Array.from(root!.querySelectorAll('[data-home-widget]'))) {
      const b = (el as HTMLElement).getBoundingClientRect();
      if (!b.width) continue;
      const k = Math.round(b.top / 6);
      const cur = rows.get(k) ?? { l: b.left, r: b.right };
      rows.set(k, { l: Math.min(cur.l, b.left), r: Math.max(cur.r, b.right) });
    }
    return { count: rows.size, gaps: [...rows.values()].map((r) => Math.max(r.l - w.left, w.right - r.r)) };
  });

const noticesWidth = (page: Page) =>
  page.evaluate(() => {
    const root = document.querySelector('sw-app')?.shadowRoot?.querySelector('devices-building')?.shadowRoot?.querySelector('home-widgets')?.shadowRoot;
    return (root?.querySelector('[data-home-widget="notices"]') as HTMLElement).getBoundingClientRect().width;
  });
const WN = '[data-home-widget="notices"]';
const WQ = '[data-home-widget="quick"]';
const W = (page: Page, sel: string) => B(page).locator(`home-widgets ${sel}`);

for (const vp of ['d', 'm', 't'] as const) {
  test(`${vp}: the quick-actions widget is shown by default (unchanged)`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the spec sets its own viewports');
    await open(page, vp, 'show');
    await expect(W(page, WQ)).toHaveCount(1);
    await expect(W(page, WN)).toHaveCount(1);
    await expect(W(page, '[data-home-quick="lights_off"], [data-home-quick-pill="lights_off"]').first()).toBeVisible();
    await shot(page, `quick-shown-${vp}`);
  });

  test(`${vp}: hidden - the widget is absent, the notices card fills the row, nothing scrolls sideways`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the spec sets its own viewports');
    await open(page, vp, 'hide');
    await expect(W(page, WQ)).toHaveCount(0);
    await expect(W(page, '[data-home-quick], [data-home-quick-pill]')).toHaveCount(0);
    await expect(W(page, WN)).toHaveCount(1);
    const g = await rowGaps(page);
    expect(g).not.toBeNull();
    for (const gap of g!.gaps) expect(gap).toBeLessThanOrEqual(2);
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
    await shot(page, `quick-hidden-${vp}`);
  });
}

for (const vp of ['d', 'm'] as const) {
  test(`${vp}: hiding the quick actions never narrows the notices card (it takes the freed room)`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the spec sets its own viewports');
    await open(page, vp, 'show');
    const before = await noticesWidth(page);
    await open(page, vp, 'hide');
    const after = await noticesWidth(page);
    expect(after).toBeGreaterThanOrEqual(before - 1);
    if (vp === 'm') expect(after).toBeGreaterThan(before * 1.5); // two per row on a phone: half a row becomes the whole row
  });
}
