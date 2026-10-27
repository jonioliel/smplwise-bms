import { test, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { areaDetail, installBubbleMock, tree } from './bubble-mocks';
import { AR, EMOJI, LONG_HE, MIXED, ONE, RU, UNBREAK } from './breakui-worst';

// P8 (HOMEFABLE-297) shoot harness, not a test: the home screen, the area screen and the area quick-control pop-up through the
// mocked API boundary of tests/bubble-mocks.ts (the demo mode has no area detail), every selectable skin, light + dark.
//   P8_OUT=<dir> P8_SCREENS=home,area,popup P8_SKINS=classic,domus SW_BASE_URL=http://127.0.0.1:4187/ npx playwright test tests/p8-shoot.spec.ts --project=desktop --project=mobile
const OUT = process.env.P8_OUT ?? '';
const SCREENS = (process.env.P8_SCREENS ?? 'home,area,popup').split(',');
const SKINS = (process.env.P8_SKINS ?? 'classic,domus,tesla,crystal,infra,soft').split(',');
const json = (route: Route, body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
const NAMES = [LONG_HE, UNBREAK, MIXED, ONE, EMOJI, AR, RU, 'ב'.repeat(80)];

function worstArea() {
  const d = JSON.parse(JSON.stringify(areaDetail('living')));
  let i = 0;
  const walk = (o: unknown): void => {
    if (Array.isArray(o)) return o.forEach(walk);
    if (o && typeof o === 'object') {
      const r = o as Record<string, unknown>;
      if (typeof r.entity_id === 'string' && typeof r.name === 'string') {
        r.name = NAMES[i++ % NAMES.length];
        if (typeof r.value === 'number') { r.value = 1234567.89; r.state = '1234567.89'; r.unit = 'kWh'; }
      }
      Object.values(r).forEach(walk);
    }
  };
  walk(d);
  d.area.name = LONG_HE;
  d.area.floor_name = LONG_HE;
  return d;
}
function worstTree() {
  const t = tree();
  t.floors.forEach((f, i) => { f.name = NAMES[i % NAMES.length] + ' קומה'; f.areas.forEach((a, j) => { a.name = NAMES[(i + j) % NAMES.length]; }); });
  return t;
}
function emptyTree() {
  const t = tree();
  return { ...t, floors: [], building: { ...t.building, entities: 0, lights: 0, lights_on: 0, switches: 0, switches_on: 0, covers: 0, covers_open: 0, climate: 0, climate_active: 0, media: 0, media_on: 0, locks: 0, cameras: 0, sensors: 0 } };
}

interface Screen { hash: string; open?: boolean; worst?: boolean; empty?: boolean; reduced?: boolean; desktopArea?: string }
const DEF: Record<string, Screen> = {
  home: { hash: '/devices/building' },
  area: { hash: '/devices/areas/living' },
  popup: { hash: '/devices/building', open: true, desktopArea: 'popup' },
  drawer: { hash: '/devices/building', open: true, desktopArea: 'drawer' },
  'home-worst': { hash: '/devices/building', worst: true },
  'home-empty': { hash: '/devices/building', empty: true },
  'area-worst': { hash: '/devices/areas/living', worst: true },
  'popup-worst': { hash: '/devices/building', open: true, desktopArea: 'popup', worst: true },
  'popup-reduced': { hash: '/devices/building', open: true, desktopArea: 'popup', reduced: true },
};

async function boot(page: Page, s: Screen, skin: string, scheme: 'light' | 'dark') {
  await installBubbleMock(page, {});
  await page.route('**/api/v1/settings', (r) => json(r, { settings: { 'ui.design': 'a', 'ui.skin': skin, 'ui.scheme': scheme, 'devices.style': 'smplwise', 'devices.area_design': 'tiles', 'home.info_style': 'cards', 'home.screen': { desktop_area: s.desktopArea ?? 'drawer', phone_area: 'sheet' } }, can_edit: false }));
  if (s.worst) {
    await page.route('**/api/v1/devices/areas/living', (r) => json(r, worstArea()));
    await page.route('**/api/v1/devices/tree', (r) => json(r, worstTree()));
  }
  if (s.empty) await page.route('**/api/v1/devices/tree', (r) => json(r, emptyTree()));
  await page.addInitScript(() => { try { localStorage.setItem('sw.devices.layout', 'cards'); } catch {} });
  if (s.reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('about:blank');
  await page.goto(`/?design=a&look=performance:full&skin=${skin}&scheme=${scheme}#${s.hash}`);
  await page.waitForSelector('sw-app', { state: 'attached' });
  await page.waitForTimeout(1800);
  await page.evaluate(() => document.fonts.ready);
  if (s.open) {
    const row = page.locator('devices-building a.arow, devices-building a.tile').first();
    await row.waitFor({ state: 'visible', timeout: 10_000 });
    await row.click();
    await page.waitForTimeout(1200);
  }
}

test.describe('p8 shoot', () => {
  test.skip(!OUT, 'P8_OUT not set');
  test.beforeAll(() => { if (OUT) fs.mkdirSync(OUT, { recursive: true }); });
  for (const skin of SKINS) for (const scheme of ['light', 'dark'] as const) for (const id of SCREENS) {
    test(`${id} ${skin} ${scheme}`, async ({ page }, info) => {
      const vp = info.project.name === 'mobile' ? 'phone' : 'desktop';
      const s = DEF[id];
      await page.emulateMedia({ colorScheme: scheme });
      await boot(page, s, skin, scheme);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      const file = path.join(OUT, `${id}-${skin}-${scheme}-${vp}.png`);
      await page.screenshot({ path: file, fullPage: vp === 'phone' && !s.open });
      if (over > 1) fs.appendFileSync(path.join(OUT, 'overflow.log'), `${path.basename(file)} sideways ${over}px\n`);
    });
  }
});
