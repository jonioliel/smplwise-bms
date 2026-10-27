import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { areaDetail, installBubbleMock, tree } from './bubble-mocks';
import { SKINS_UNDER_TEST } from './helpers/frozen-skins';
import { AR, EMAIL, EMOJI, LONG_HE, MIXED, ONE, RU, UNBREAK, measure } from './breakui-worst';

// WIDGETBREAK-297: the device tiles / cards of the AREA screen (lights, covers, climate, media, security, sensors, the camera tile) and the building tree
// against WORST-CASE names and values: every entity renamed with a long Hebrew, unbreakable Latin, mixed RTL/LTR, emoji, Arabic, Russian, one letter or
// 80-character name; sensor values of 1,234,567.89; a 70-character media title; very long area and floor names. The mocked backend of
// tests/bubble-mocks.ts (fake data, no device). Geometry assertions only (the shared guard + page scroll). Vite DEV server:
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/layout-devices-break-297.spec.ts --project=desktop
// DB_SHOTS=<dir> writes a screenshot per case.
const NAMES = [LONG_HE, UNBREAK, MIXED, ONE, EMOJI, AR, RU, EMAIL, 'ב'.repeat(80)];
// a cover row's kind (span.muted) sits inside the name, which is overflow:hidden with an ellipsis (the full text is the row tooltip): the guard sees its box, the eye does not
const SHOTS = process.env.DB_SHOTS;
const json = (route: Route, body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

function worstArea() {
  const d = JSON.parse(JSON.stringify(areaDetail('living')));
  let i = 0;
  const walk = (o: unknown): void => {
    if (Array.isArray(o)) return o.forEach(walk);
    if (o && typeof o === 'object') {
      const r = o as Record<string, unknown>;
      if (typeof r.entity_id === 'string' && typeof r.name === 'string') {
        r.name = NAMES[i++ % NAMES.length];
        if (typeof r.media_title === 'string') r.media_title = LONG_HE + ' · ' + UNBREAK;
        if (typeof r.value === 'number') { r.value = 1234567.89; r.state = '1234567.89'; r.unit = 'kWh'; }
      }
      Object.values(r).forEach(walk);
    }
  };
  walk(d);
  d.area.name = LONG_HE;
  d.area.floor_name = LONG_HE;
  for (const a of d.areas ?? []) a.name = LONG_HE.slice(0, 50);
  return d;
}

function worstTree() {
  const t = tree();
  t.floors.forEach((f, i) => { f.name = NAMES[i % NAMES.length] + ' קומה'; f.areas.forEach((a, j) => { a.name = NAMES[(i + j) % NAMES.length]; }); });
  return t;
}

async function boot(page: Page, scheme: 'light' | 'dark', skin: string) {
  await installBubbleMock(page, {});
  await page.route('**/api/v1/devices/areas/living', (r) => json(r, worstArea()));
  await page.route('**/api/v1/devices/tree', (r) => json(r, worstTree()));
  await page.goto('about:blank');
  await page.goto(`/?design=a&skin=${skin}&scheme=${scheme}#/devices/areas/living`);
  await expect(page.locator('sw-app devices-area').first()).toBeAttached({ timeout: 30_000 });
  await page.waitForTimeout(800);
}

test.describe('device tiles break test', () => {
  test.beforeAll(() => { if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true }); });
  for (const skin of SKINS_UNDER_TEST) for (const scheme of ['light', 'dark'] as const) {
    test(`${skin} ${scheme}: the area screen stays inside the viewport with worst-case names`, async ({ page }) => {
      test.setTimeout(180_000);
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      const problems: string[] = [];
      await boot(page, scheme, skin);
      for (const w of [320, 360, 390, 768, 1280]) {
        await page.setViewportSize({ width: w, height: w <= 480 ? 844 : 900 });
        await page.waitForTimeout(250);
        const m = await measure(page, `area/${w}/${skin}-${scheme}`, 'devices-area');
        const own = [...m.found.filter((f) => !(f.cls === 'escape' && f.el.startsWith('span.muted'))).map((f) => `${f.cls} ${f.el} ${f.detail}`), ...(m.scroll > 1 ? [`page scrolls sideways by ${m.scroll}px`] : [])];
        if (own.length) problems.push(`area/${w}/${skin}-${scheme}: ${Array.from(new Set(own)).slice(0, 6).join(' | ')}`);
        if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `area-${w}-${skin}-${scheme}.png`), fullPage: true });
      }
      if (process.env.DB_REPORT) fs.writeFileSync(process.env.DB_REPORT.replace('.txt', `-${skin}-${scheme}.txt`), problems.join('\n'));
      expect(errors, 'page errors').toEqual([]);
      expect(problems, problems.join('\n')).toEqual([]);
    });
  }
});
