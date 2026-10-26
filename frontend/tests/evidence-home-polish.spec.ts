import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { settlePage } from './pixel-settle';
import { SKINS_UNDER_TEST as SKIN_IDS } from './helpers/frozen-skins';

// HOME polish (2026-10-10): the evidence matrix of the home screen (cards and tiles views), the area screen and the tiles panel,
// across the four skins x light / dark at 1440, the classic skin at 1024 and 390, plus the non-ready states (loading, error, an
// empty area). Against the devices fixture backend (tests/fixtures/devices_fake_ha.py - the REAL backend with a fake Home
// Assistant side; no lab, no secrets); the seed is a site of the owner's size (3 floors, 8 areas, ~150 devices). Every seeded id
// carries `hp_`. Screenshots go to docs/design/evidence/home-polish/<SW_SHOTS_TAG | after>/ (SW_SHOTS_TAG=before captures the
// baseline from the branch point).
//
//   SW_PORT=8349 SW_DATA_DIR=<empty dir> SW_DEV_USER=joni SW_BOOTSTRAP_ADMIN=joni <venv-python> frontend/tests/fixtures/devices_fake_ha.py
//   SW_LIVE=1 SW_DEVICES_FIXTURE=1 SW_API_PORT=8349 SW_BASE_URL=http://127.0.0.1:4189/ SW_SHOTS_TAG=after \
//     npx playwright test tests/evidence-home-polish.spec.ts --workers=1 --project=desktop --project=tablet --project=mobile
const TAG = process.env.SW_SHOTS_TAG || 'after';
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/home-polish', TAG);

const FLOORS = [
  { floor_id: 'hp_ground', name: 'קומת כניסה', level: 0 },
  { floor_id: 'hp_first', name: 'קומה 1-', level: -1 },
  { floor_id: 'hp_base', name: 'קומה 2-', level: -2 },
];
const AREAS = [
  { area_id: 'hp_offices', name: 'משרדים', floor_id: 'hp_ground' },
  { area_id: 'hp_open', name: 'מרחבים', floor_id: 'hp_ground' },
  { area_id: 'hp_lobby', name: 'לובי', floor_id: 'hp_ground' },
  { area_id: 'hp_sports', name: 'אולם ספורט', floor_id: 'hp_first' },
  { area_id: 'hp_halls', name: 'מסדרונות', floor_id: 'hp_first' },
  { area_id: 'hp_lockers', name: 'מלתחות', floor_id: 'hp_first' },
  { area_id: 'hp_garage', name: 'חניון', floor_id: 'hp_base' },
  { area_id: 'hp_plant', name: 'חדר מכונות', floor_id: 'hp_base' },
  { area_id: 'hp_empty', name: 'מחסן', floor_id: 'hp_base' },
];
const AREA = 'hp_sports';
const WEATHER = 'weather.hp_wx';
const ALARM = 'alarm_control_panel.hp_house';
const ENTITIES: { entity_id: string; area_id: string | null; platform?: string }[] = [];
const STATES: { entity_id: string; state: string; attributes: Record<string, unknown> }[] = [];
function add(entity_id: string, area_id: string | null, state: string, attributes: Record<string, unknown>, platform?: string) {
  ENTITIES.push({ entity_id, area_id, ...(platform ? { platform } : {}) });
  STATES.push({ entity_id, state, attributes });
}
let n = 0;
for (const a of AREAS.filter((x) => x.area_id !== 'hp_empty')) {
  for (let i = 0; i < 7; i++) add(`light.hp_${++n}`, a.area_id, n % 3 === 0 ? 'on' : 'off', { friendly_name: `תאורה ${a.name} ${i + 1}`, brightness: 200 });
  for (let i = 0; i < 4; i++) add(`switch.hp_${++n}`, a.area_id, n % 4 === 0 ? 'on' : 'off', { friendly_name: `מתג ${a.name} ${i + 1}` });
  for (let i = 0; i < 3; i++) add(`cover.hp_${++n}`, a.area_id, n % 2 ? 'open' : 'closed', { friendly_name: `תריס ${a.name} ${i + 1}`, current_position: 70, device_class: 'blind' });
  for (let i = 0; i < 2; i++) add(`climate.hp_${++n}`, a.area_id, i ? 'off' : 'cool', { friendly_name: `מזגן ${a.name} ${i + 1}`, current_temperature: 24.5, temperature: 22, hvac_modes: ['off', 'cool', 'heat'], hvac_action: i ? 'idle' : 'cooling' });
  add(`sensor.hp_temp_${++n}`, a.area_id, '23.5', { friendly_name: `טמפרטורה ${a.name}`, unit_of_measurement: '°C', device_class: 'temperature' });
}
add('sensor.hp_hum', AREA, '48', { friendly_name: 'לחות', unit_of_measurement: '%', device_class: 'humidity' });
add('binary_sensor.hp_motion', AREA, 'off', { friendly_name: 'תנועה', device_class: 'motion' });
add('binary_sensor.hp_door', AREA, 'off', { friendly_name: 'דלת ראשית', device_class: 'door' });
add('sensor.hp_pow', AREA, '1200', { friendly_name: 'הספק כללי', unit_of_measurement: 'W', device_class: 'power' });
add('sensor.hp_bat', AREA, '91', { friendly_name: 'סוללת חיישן', unit_of_measurement: '%', device_class: 'battery' });
add('lock.hp_front', 'hp_lobby', 'locked', { friendly_name: 'דלת כניסה', device_class: 'lock' });
add('lock.hp_back', 'hp_lobby', 'unlocked', { friendly_name: 'דלת אחורית', device_class: 'lock' });
add('lock.hp_sports', AREA, 'locked', { friendly_name: 'דלת אולם', device_class: 'lock' });
add(ALARM, 'hp_lobby', 'armed_away', { friendly_name: 'אזעקה ראשית' });
add('media_player.hp_tv', AREA, 'playing', { friendly_name: 'מסך אולם' });
add('light.hp_unavail', AREA, 'unavailable', { friendly_name: 'זרקור חוץ' });
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 1, 13, 0, 0);
const FORECAST = [1, 2, 3, 4, 5].map((d, i) => ({ datetime: new Date(T0 + d * DAY).toISOString(), condition: ['sunny', 'sunny', 'partlycloudy', 'rainy', 'cloudy'][i], temperature: 29 - i, templow: 19 - (i % 2) }));
add(WEATHER, null, 'partlycloudy', { friendly_name: 'תחזית הבית', temperature: 27.5, humidity: 61, temperature_unit: '°C', wind_speed: 14, wind_speed_unit: 'km/h', forecast: FORECAST });
add('sensor.hp_jewish_calendar_date', null, 'ג׳ בחשוון התשפ״ז', { friendly_name: 'תאריך עברי' }, 'jewish_calendar');
add('sensor.hp_jewish_calendar_weekly_portion', null, 'נח', { friendly_name: 'פרשת השבוע' }, 'jewish_calendar');
add('sensor.hp_jewish_calendar_upcoming_candle_lighting', null, new Date(T0 + DAY + 4.5 * 3_600_000).toISOString(), { friendly_name: 'הדלקת נרות', device_class: 'timestamp' }, 'jewish_calendar');
add('sensor.hp_jewish_calendar_upcoming_havdalah', null, new Date(T0 + 2 * DAY + 5.5 * 3_600_000).toISOString(), { friendly_name: 'צאת שבת', device_class: 'timestamp' }, 'jewish_calendar');

const RESET = {
  'home.title': '', 'home.floor_order': '[]', 'home.direction': 'a', 'home.side': 'end', 'home.widgets': {}, 'home.clock': 'off', 'home.weather': 'false',
  'home.weather_entity': '', 'home.jewish': 'false', 'home.jewish_parsha': '', 'home.jewish_candles': '', 'home.jewish_havdalah': '', 'home.jewish_date': '',
  'home.clock_size': 'medium', 'home.weather_size': 'medium', 'home.jewish_size': 'medium', 'home.clock_seconds': 'false', 'devices.area_design': 'tiles',
};

const SKINS = SKIN_IDS;
const SCHEMES = ['light', 'dark'] as const;
const WIDTH: Record<string, string> = { desktop: '1440', tablet: '1024', mobile: '390' };

test.describe('home polish evidence', () => {
  test.skip(process.env.SW_LIVE !== '1' || process.env.SW_DEVICES_FIXTURE !== '1', 'needs tests/fixtures/devices_fake_ha.py (SW_LIVE=1 SW_DEVICES_FIXTURE=1)');

  async function seed(request: APIRequestContext) {
    const mine = new Set(ENTITIES.map((e) => e.entity_id));
    const foreign = ((await (await request.get('/api/v1/ha/entities?limit=2000')).json()).entities as { entity_id: string }[]).map((e) => e.entity_id).filter((id) => !mine.has(id));
    for (let i = 0; i < foreign.length; i += 400) {
      const entities = foreign.slice(i, i + 400).map((entity_id) => ({ entity_id, area_id: null, disabled_by: 'user' }));
      expect((await request.post('/api/v1/ha/dev/registry', { data: { entities, devices: [], areas: AREAS, floors: FLOORS } })).status()).toBe(200);
    }
    expect((await request.post('/api/v1/ha/dev/registry', { data: { entities: ENTITIES, devices: [], areas: AREAS, floors: FLOORS } })).status()).toBe(200);
    for (let i = 0; i < STATES.length; i += 50) expect((await request.post('/api/v1/ha/dev/states', { data: { states: STATES.slice(i, i + 50) } })).status()).toBe(200);
    expect((await request.patch('/api/v1/settings', { data: RESET })).status()).toBe(200);
    await request.put('/api/v1/me/prefs', { data: { 'home.personal': null } });
    for (const a of AREAS) await request.delete(`/api/v1/devices/layouts/area/${a.area_id}`);
    await request.delete('/api/v1/devices/layouts/building/main');
  }

  async function open(page: Page, hash: string, query = '', layout: 'cards' | 'tiles' = 'cards') {
    await page.clock.setFixedTime(new Date(T0));
    await page.addInitScript((l) => {
      try {
        localStorage.setItem('sw.devices.layout', l);
        localStorage.removeItem('sw.devices.treeCollapsed');
      } catch {
        /* storage unavailable */
      }
    }, layout);
    await page.goto('about:blank');
    await page.goto(`/?design=a&look=performance:full${query}#${hash}`);
    await page.waitForSelector('sw-app');
  }

  async function shot(page: Page, name: string, settle = true) {
    fs.mkdirSync(OUT, { recursive: true });
    if (settle) await settlePage(page);
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  }

  const q = (skin: string, scheme: string) => `&skin=${skin}&scheme=${scheme}`;

  for (const skin of SKINS) {
    for (const scheme of SCHEMES) {
      test(`${skin} ${scheme}: home (cards, tiles), area, panel`, async ({ page, request }, info) => {
        const w = WIDTH[info.project.name];
        test.skip(skin !== 'classic' && w !== '1440', 'the other skins at the desktop width only');
        await seed(request);
        const tag = `${skin}-${scheme}-${w}`;
        await open(page, '/devices/building', q(skin, scheme), 'cards');
        await page.waitForSelector('devices-building sw-kpi', { timeout: 30000 });
        await shot(page, `home-cards-${tag}`);
        if (w === '390') {
          await page.locator('devices-building').evaluate((el) => el.shadowRoot!.querySelector('section.fcard')!.scrollIntoView({ block: 'start' }));
          await shot(page, `home-floors-${tag}`);
        }
        await open(page, '/devices/building', q(skin, scheme), 'tiles');
        await page.waitForSelector('devices-building sw-kpi', { timeout: 30000 });
        await shot(page, `home-tiles-${tag}`);
        // the tiles panel of the building's lights
        await page.locator('devices-building sw-kpi[data-tile-kind="lights"] .hit').click();
        await page.waitForSelector('devices-tiles-panel [data-panel-floor]', { timeout: 30000 });
        await shot(page, `panel-lights-${tag}`);
        // the area screen (dense tiles direction)
        await open(page, `/devices/areas/${AREA}`, q(skin, scheme));
        await page.waitForSelector('devices-area sw-card', { timeout: 30000 });
        await shot(page, `area-${tag}`);
        if (skin === 'classic' && w === '1440') {
          expect((await request.patch('/api/v1/settings', { data: { 'devices.area_design': 'sections' } })).status()).toBe(200);
          await open(page, `/devices/areas/${AREA}`, q(skin, scheme));
          await page.waitForSelector('devices-area sw-card', { timeout: 30000 });
          await shot(page, `area-sections-${tag}`);
          expect((await request.patch('/api/v1/settings', { data: { 'devices.area_design': 'tiles' } })).status()).toBe(200);
        }
      });
    }
  }

  test('classic: the non-ready states - loading, error, an empty area, a folded tree', async ({ page, request }, info) => {
    const w = WIDTH[info.project.name];
    test.skip(w === '1024', 'two widths are enough for the states');
    test.setTimeout(180_000);
    await seed(request);
    // loading: the tree answer is held back while the screenshot is taken
    let release: (() => void) | null = null;
    const held = new Promise<void>((r) => (release = r));
    await page.route('**/api/v1/devices/tree*', async (route) => {
      await held;
      await route.continue();
    });
    await open(page, '/devices/building', q('classic', 'light'));
    await page.waitForSelector('devices-building', { timeout: 30000 });
    await page.waitForTimeout(600);
    await shot(page, `home-loading-${w}`, false); // the held request never goes idle: no settle here
    release!();
    await page.waitForSelector('devices-building sw-kpi', { timeout: 30000 });
    await page.unroute('**/api/v1/devices/tree*');
    // error: the tree answers 500
    await page.route('**/api/v1/devices/tree*', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'fixture failure' }) }));
    await open(page, '/devices/building', q('classic', 'light'));
    await page.waitForSelector('devices-building sw-state-panel[data-devices-state="load_error"]', { timeout: 30000 });
    await shot(page, `home-error-${w}`);
    await page.unroute('**/api/v1/devices/tree*');
    // the empty area
    await open(page, '/devices/areas/hp_empty', q('classic', 'light'));
    await page.waitForSelector('devices-area sw-state-panel[data-devices-state="area_empty"]', { timeout: 30000 });
    await shot(page, `area-empty-${w}`);
    if (w === '1440') {
      // the tree with two floors folded and one selected (the per-floor collapse survives every design)
      await open(page, '/devices/building', q('classic', 'light'));
      await page.waitForSelector('devices-building sw-kpi', { timeout: 30000 });
      await page.locator('devices-building [data-tree-fold="hp_base"]').click();
      await page.locator('devices-building [data-tree-select="hp_first"]').click();
      await shot(page, `home-tree-folded-${w}`);
      // keyboard focus on an area row of the tree
      await page.locator('devices-building [data-tree-select="hp_first"]').focus();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await shot(page, `home-focus-${w}`);
    }
  });
});
