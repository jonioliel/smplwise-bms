import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// POLISH-295 (owner approval 2026-10-25): the polished home screen (the clock, the weather, Shabbat and the alarm in a thin header bar by
// default; readable counters; no technical line under the title) and the schedules list (rows by default, one page at a time, the review
// count as a chip instead of a banner, "today" as a timeline) - in demo mode (no backend answers). Light and dark, desktop and phone.
// The automations rows are in evidence-automations-list.spec.ts; the settings and the pages logic in unit-screen-display.spec.ts.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-polish-295.spec.ts --project=desktop --project=mobile
// Screenshots: docs/design/evidence/POLISH-295/.

const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/POLISH-295');
type Info = { project: { name: string } };
const phone = (info: Info) => info.project.name === 'mobile';

async function shot(page: Page, name: string, info: Info) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(EVIDENCE, `${name}-${info.project.name}.png`) });
}

const clocked = new WeakSet<Page>();
async function openDemo(page: Page, query: string, hash: string, init: Record<string, string> = {}) {
  await page.route('**/api/v1/**', (route) => route.abort()); // demo mode whatever runs on the preview's proxy target
  if (!clocked.has(page)) {
    clocked.add(page);
    await page.clock.install({ time: new Date('2026-10-23T09:00:00Z') }); // a Friday morning: the Shabbat times are near
  }
  await page.addInitScript((kv) => {
    try {
      for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v);
    } catch {
      /* storage unavailable */
    }
  }, init);
  await page.goto('about:blank');
  await page.goto(`/?design=a${query}#${hash}`);
  await page.waitForSelector('sw-app');
}

const overflowX = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe('home: the thin info bar (default)', () => {
  test('the clock, the weather, Shabbat and the alarm sit in one bar in the header; no card band for them; no technical line', async ({ page }, info) => {
    await openDemo(page, '', '/devices/building', { 'sw.devices.layout': 'tiles' });
    const b = page.locator('sw-app devices-building');
    await b.locator('sw-kpi').first().waitFor();
    const bar = b.locator('home-ambient-bar');
    await expect(bar.locator('[data-home-ambient]')).toBeVisible();
    await expect(bar.locator('[data-home-time]')).toHaveText(/^\d\d:\d\d$/);
    for (const w of ['clock', 'weather', 'shabbat', 'alarm']) await expect(b.locator(`home-widgets [data-home-widget="${w}"]`)).toHaveCount(0);
    await expect(b.locator('sw-page')).not.toHaveAttribute('subheading', /.+/);
    if (!phone(info)) {
      await expect(bar.locator('[data-home-temp]')).toHaveText('28°C');
      await expect(bar.locator('[data-ambient="shabbat"] [data-ambient-field="candles"]')).toHaveText(/\d\d:\d\d/);
      await expect(bar.locator('[data-home-alarm-state]')).toHaveText('דרוכה (חוץ)');
      // the bar is thin: one control row high
      const box = (await bar.boundingBox())!;
      expect(box.height).toBeLessThanOrEqual(40);
    } else {
      await expect(bar.locator('[data-ambient="shabbat"]')).toBeHidden(); // the phone keeps the time and the temperature
    }
    // the alarm is in the bar, so it is not also a counter
    await expect(b.locator('sw-kpi[data-kpi="אזעקה"]')).toHaveCount(0);
    // the counters read "on / total"
    const lights = b.locator('sw-kpi[data-kpi="תאורה דולקת"]');
    if (await lights.count()) await expect(lights).toHaveAttribute('value', /^\d+ \/ \d+$/);
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
    await shot(page, 'home-bar-light', info);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await shot(page, 'home-bar-dark', info);
  });

  test('the large cards stay one setting away (home.info_style = cards): the band is back, the bar is gone', async ({ page }, info) => {
    test.skip(phone(info), 'one viewport is enough');
    await openDemo(page, '&home_info=cards', '/devices/building', { 'sw.devices.layout': 'tiles' });
    const b = page.locator('sw-app devices-building');
    await b.locator('sw-kpi').first().waitFor();
    await expect(b.locator('home-ambient-bar')).toHaveCount(0);
    for (const w of ['clock', 'weather', 'shabbat', 'alarm']) await expect(b.locator(`home-widgets [data-home-widget="${w}"]`)).toBeVisible();
    await shot(page, 'home-cards', info);
  });
});

test.describe('schedules: rows and pages (default)', () => {
  test('rows by default, at most a page of them, no review banner; the pager moves between pages; the selection box only in selection mode', async ({ page }, info) => {
    await openDemo(page, '', '/devices/schedules', { 'sw.demo.schedules': JSON.stringify({ persona: 'admin' }) });
    const s = page.locator('sw-app devices-schedules');
    const rows = s.locator('[data-sched-rows] [data-schedule]');
    await expect(rows.first()).toBeVisible();
    const per = phone(info) ? 7 : 10;
    const n = await rows.count();
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(per);
    await expect(s.locator('[data-view-btn="rows"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(s.locator('.banner[data-sched-attention]')).toHaveCount(0);
    await expect(s.locator('[data-sched-rows] input[data-select]')).toHaveCount(0);
    // a row is one line high
    const h = await rows.first().evaluate((el) => el.getBoundingClientRect().height);
    expect(h).toBeGreaterThanOrEqual(52);
    expect(h).toBeLessThanOrEqual(58);
    // a control screen does not scroll: the page of rows, "today" and the pager fit 1440x900
    if (!phone(info)) {
      await page.evaluate(() => document.fonts.ready);
      const fit = await s.evaluate((el) => {
        const r = (el as HTMLElement & { renderRoot: ShadowRoot }).renderRoot;
        const b = (sel: string) => Math.round(r.querySelector(sel)?.getBoundingClientRect().height ?? -1);
        return { over: el.scrollHeight - el.clientHeight, header: b('[data-sched-header]'), up: b('[data-sched-upnext]'), rows: b('[data-sched-rows]'), pager: b('[data-sched-pager]') };
      });
      expect(fit.over, JSON.stringify(fit)).toBeLessThanOrEqual(1);
    }
    const total = Number((await s.locator('button[data-segment="schedules"] small').textContent().catch(() => '0')) || '0');
    if (total > per) {
      const pager = s.locator('[data-sched-pager] sw-pager');
      await expect(pager).toBeVisible();
      await pager.locator('[data-pager-next]').click();
      await expect(pager.locator('[data-pager-at]')).toHaveText(/^2 \/ \d+$/);
    }
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
    await shot(page, 'schedules-rows-light', info);
    // dark: the glass screens follow devices.scheme (the demo reads it from sw.demo.automations), the shell its own theme
    await openDemo(page, '', '/devices/schedules', { 'sw.demo.schedules': JSON.stringify({ persona: 'admin' }), 'sw.demo.automations': JSON.stringify({ scheme: 'dark' }) });
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await expect(s).toHaveAttribute('data-devices-scheme', 'dark');
    await expect(rows.first()).toBeVisible();
    await shot(page, 'schedules-rows-dark', info);
  });

  test('"today" is one timeline with a dot per remaining run and only the next one named', async ({ page }, info) => {
    test.skip(phone(info), 'one viewport is enough');
    await openDemo(page, '', '/devices/schedules', { 'sw.demo.schedules': JSON.stringify({ persona: 'admin' }) });
    const s = page.locator('sw-app devices-schedules');
    await expect(s.locator('[data-sched-rows]')).toBeVisible();
    const up = s.locator('[data-sched-upnext]');
    if (await up.count()) {
      await expect(up.locator('.tl .now')).toHaveCount(1);
      await expect(up.locator('[data-upcoming-next]')).toHaveCount(1);
      expect(await up.locator('.tdot').count()).toBeGreaterThan(0);
      await expect(up.locator('a[data-upcoming-next]')).toHaveAttribute('href', /#\/devices\/schedules\//);
    }
  });
});
