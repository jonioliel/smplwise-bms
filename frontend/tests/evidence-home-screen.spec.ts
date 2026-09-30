import { test, expect, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import path from 'node:path';

// Home screen "ראשי" (חשמל והתקנים), home redesign (owner decisions 2026-09-30), against the devices fixture backend - the REAL
// backend with a fake Home Assistant side (tests/fixtures/devices_fake_ha.py; see its header for how to start it) - with
// SW_LIVE=1 SW_DEVICES_FIXTURE=1: the owner's site size (3 floors, 8 areas, ~150 devices, two weather entities, the Jewish
// calendar's sensors, an alarm panel). Covers the three directions (a control centre - the default, b side panel, c compact
// row) in both floor views without a vertical scroll at 1440x900 and 1920x1080 and as a snap row on a phone; the settings
// block; edit mode (direction, per-widget on / size / heading / order by keyboard and by drag, the weather checklist of what the
// entity offers, a sensor per Jewish-calendar field, the alarm card, the quick actions, the floor order); and the personal
// override that exists only for a holder of screen.personalize. Every seeded id carries `home1_`.
// SW_SHOTS=<dir> saves screenshots there (docs/evidence/UIR2-home).
const SHOTS = process.env.SW_SHOTS ?? '';

const FLOORS = [
  { floor_id: 'home1_ground', name: 'קומת כניסה', level: 0 },
  { floor_id: 'home1_first', name: 'קומה 1-', level: -1 },
  { floor_id: 'home1_base', name: 'קומה 2-', level: -2 },
];
const AREAS = [
  { area_id: 'home1_offices', name: 'משרדים', floor_id: 'home1_ground' },
  { area_id: 'home1_open', name: 'מרחבים', floor_id: 'home1_ground' },
  { area_id: 'home1_lobby', name: 'לובי', floor_id: 'home1_ground' },
  { area_id: 'home1_sports', name: 'אולם ספורט', floor_id: 'home1_first' },
  { area_id: 'home1_halls', name: 'מסדרונות', floor_id: 'home1_first' },
  { area_id: 'home1_lockers', name: 'מלתחות', floor_id: 'home1_first' },
  { area_id: 'home1_garage', name: 'חניון', floor_id: 'home1_base' },
  { area_id: 'home1_plant', name: 'חדר מכונות', floor_id: 'home1_base' },
];
const WEATHER = 'weather.home1_wx';
const WEATHER_BARE = 'weather.home1_zbare';
const OUTDOOR = 'sensor.home1_outdoor_temp';
const ALARM = 'alarm_control_panel.home1_house';
const PARSHA = 'sensor.home1_jewish_calendar_weekly_portion';
const CANDLES = 'sensor.home1_jewish_calendar_upcoming_candle_lighting';
const HAVDALAH = 'sensor.home1_jewish_calendar_upcoming_havdalah';
const HEBDATE = 'sensor.home1_jewish_calendar_date';
const HOLIDAY = 'sensor.home1_jewish_calendar_holiday';
const ISSUR = 'binary_sensor.home1_jewish_calendar_issur_melacha_in_effect';

const ENTITIES: { entity_id: string; area_id: string | null; platform?: string }[] = [];
const STATES: { entity_id: string; state: string; attributes: Record<string, unknown> }[] = [];
function add(entity_id: string, area_id: string | null, state: string, attributes: Record<string, unknown>, platform?: string) {
  ENTITIES.push({ entity_id, area_id, ...(platform ? { platform } : {}) });
  STATES.push({ entity_id, state, attributes });
}
let n = 0;
for (const a of AREAS) {
  for (let i = 0; i < 7; i++) add(`light.home1_${++n}`, a.area_id, n % 3 === 0 ? 'on' : 'off', { friendly_name: `תאורה ${a.name} ${i + 1}`, brightness: 200 });
  for (let i = 0; i < 4; i++) add(`switch.home1_${++n}`, a.area_id, n % 4 === 0 ? 'on' : 'off', { friendly_name: `מתג ${a.name} ${i + 1}` });
  for (let i = 0; i < 3; i++) add(`cover.home1_${++n}`, a.area_id, n % 2 ? 'open' : 'closed', { friendly_name: `תריס ${a.name} ${i + 1}`, current_position: 70, device_class: 'blind' });
  for (let i = 0; i < 2; i++) add(`climate.home1_${++n}`, a.area_id, 'cool', { friendly_name: `מזגן ${a.name} ${i + 1}`, current_temperature: 24.5, temperature: 22, hvac_action: 'cooling' });
  add(`sensor.home1_temp_${++n}`, a.area_id, '23.5', { friendly_name: `טמפרטורה ${a.name}`, unit_of_measurement: '°C', device_class: 'temperature' });
}
add('lock.home1_front', 'home1_lobby', 'locked', { friendly_name: 'דלת כניסה', device_class: 'lock' });
add('lock.home1_back', 'home1_lobby', 'locked', { friendly_name: 'דלת אחורית', device_class: 'lock' });
add(ALARM, 'home1_lobby', 'armed_away', { friendly_name: 'אזעקה ראשית' });
add('media_player.home1_tv', 'home1_sports', 'playing', { friendly_name: 'מסך אולם' });
const DAY = 86_400_000;
const T0 = Date.now();
const FORECAST = [1, 2, 3, 4, 5, 6].map((d, i) => ({ datetime: new Date(T0 + d * DAY).toISOString(), condition: ['sunny', 'sunny', 'partlycloudy', 'rainy', 'cloudy', 'sunny'][i], temperature: 29 - i, templow: 19 - (i % 2), precipitation_probability: i === 3 ? 60 : 5 }));
const WEATHER_ATTRS = { friendly_name: 'מזג אוויר בית', temperature: 27.5, humidity: 61, temperature_unit: '°C', wind_speed: 14, wind_speed_unit: 'km/h', pressure: 1012.3, pressure_unit: 'hPa', visibility: 10, visibility_unit: 'km', uv_index: 6, forecast: FORECAST };
add(WEATHER, null, 'partlycloudy', WEATHER_ATTRS);
add(WEATHER_BARE, null, 'sunny', { friendly_name: 'תחנה בסיסית', temperature: 22 });
add(OUTDOOR, null, '31.4', { friendly_name: 'טמפרטורה בחוץ', unit_of_measurement: '°C', device_class: 'temperature' });
const friday = new Date(T0);
friday.setDate(friday.getDate() + ((5 - friday.getDay() + 7) % 7 || 7));
friday.setHours(17, 34, 0, 0);
const saturday = new Date(friday.getTime() + DAY);
saturday.setHours(18, 29, 0, 0);
add(HEBDATE, null, 'ג׳ בחשוון התשפ״ז', { friendly_name: 'תאריך עברי' }, 'jewish_calendar');
add(PARSHA, null, 'נח', { friendly_name: 'פרשת השבוע' }, 'jewish_calendar');
add(CANDLES, null, friday.toISOString(), { friendly_name: 'הדלקת נרות', device_class: 'timestamp' }, 'jewish_calendar');
add(HAVDALAH, null, saturday.toISOString(), { friendly_name: 'צאת שבת', device_class: 'timestamp' }, 'jewish_calendar');
add(HOLIDAY, null, 'שמחת תורה', { friendly_name: 'חג' }, 'jewish_calendar');
add(ISSUR, null, 'off', { friendly_name: 'איסור מלאכה' }, 'jewish_calendar');

const RESET = {
  'home.title': '',
  'home.floor_order': '[]',
  'home.direction': 'a',
  'home.side': 'end',
  'home.widgets': {},
  'home.clock': 'off',
  'home.weather': 'false',
  'home.weather_entity': '',
  'home.jewish': 'false',
  'home.jewish_parsha': '',
  'home.jewish_candles': '',
  'home.jewish_havdalah': '',
  'home.jewish_date': '',
  'home.clock_size': 'medium',
  'home.weather_size': 'medium',
  'home.jewish_size': 'medium',
  'home.clock_seconds': 'false',
};

type Info = { project: { name: string } };
const WIDTH: Record<string, number> = { desktop: 1440, tablet: 1024, mobile: 390 };

test.describe('the home screen against the devices fixture backend', () => {
  test.skip(process.env.SW_LIVE !== '1' || process.env.SW_DEVICES_FIXTURE !== '1', 'needs tests/fixtures/devices_fake_ha.py (SW_LIVE=1 SW_DEVICES_FIXTURE=1)');

  async function seed(request: APIRequestContext) {
    // The dev registry seed only upserts entities: what an earlier spec file left on the shared fixture backend (its rooms and
    // devices) would still be counted and drawn, and the "fits without a scroll" checks measure the owner's site size. So first
    // disable every foreign entity (a registry listing with disabled_by, as Home Assistant reports one), then seed this site last.
    const mine = new Set([...ENTITIES.map((e) => e.entity_id), ...STATES.map((s) => s.entity_id)]);
    const foreign = ((await (await request.get('/api/v1/ha/entities?limit=2000')).json()).entities as { entity_id: string }[]).map((e) => e.entity_id).filter((id) => !mine.has(id));
    for (let i = 0; i < foreign.length; i += 400) {
      const entities = foreign.slice(i, i + 400).map((entity_id) => ({ entity_id, area_id: null, disabled_by: 'user' }));
      expect((await request.post('/api/v1/ha/dev/registry', { data: { entities, devices: [], areas: AREAS, floors: FLOORS } })).status()).toBe(200);
    }
    expect((await request.post('/api/v1/ha/dev/registry', { data: { entities: ENTITIES, devices: [], areas: AREAS, floors: FLOORS } })).status()).toBe(200);
    for (let i = 0; i < STATES.length; i += 50) expect((await request.post('/api/v1/ha/dev/states', { data: { states: STATES.slice(i, i + 50) } })).status()).toBe(200);
  }

  async function resetHome(request: APIRequestContext) {
    expect((await request.patch('/api/v1/settings', { data: RESET })).status()).toBe(200);
    await request.put('/api/v1/me/prefs', { data: { 'home.personal': null } });
  }

  async function settings(request: APIRequestContext): Promise<Record<string, any>> {
    return (await (await request.get('/api/v1/settings')).json()).settings as Record<string, any>;
  }

  async function setWidgets(request: APIRequestContext, patch: (c: any) => void, extra: Record<string, unknown> = {}) {
    const cfg = (await settings(request))['home.widgets'];
    patch(cfg);
    expect((await request.patch('/api/v1/settings', { data: { 'home.widgets': cfg, ...extra } })).status()).toBe(200);
  }

  async function open(page: Page, hash: string, layout: 'cards' | 'tiles' = 'cards') {
    await page.addInitScript((l) => {
      try {
        localStorage.setItem('sw.devices.layout', l);
        localStorage.removeItem('sw.tiles.override');
      } catch {
        /* storage unavailable */
      }
    }, layout);
    await page.goto('about:blank');
    await page.goto(`/?design=a#${hash}`);
    await page.waitForSelector('devices-building');
    await page.waitForSelector('devices-building sw-kpi', { timeout: 30000 });
    await page.waitForTimeout(1200);
  }

  async function bindUser(request: APIRequestContext, username: string, roleId: string): Promise<string> {
    const me = await (await request.get('/api/v1/me', { headers: { 'X-SW-Dev-User': username } })).json();
    const r = await request.post('/api/v1/access/bindings', { data: { subject_kind: 'user', subject_id: me.user.id, role_id: roleId, scope_type: 'installation', scope_id: '*' } });
    expect(r.status()).toBeLessThan(300);
    return ((await r.json()) as { id: string }).id;
  }

  async function userPage(browser: Browser, username: string, width = 1440, height = 900): Promise<{ page: Page; close: () => Promise<void> }> {
    const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-SW-Dev-User': username }, viewport: { width, height }, locale: 'he-IL', timezoneId: 'Asia/Jerusalem', colorScheme: 'light' });
    return { page: await ctx.newPage(), close: () => ctx.close() };
  }

  async function shot(page: Page, name: string, info: Info) {
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}-${WIDTH[info.project.name] ?? info.project.name}.png`) });
  }

  /** Every element that scrolls vertically and has something to scroll (through shadow roots). */
  async function scrolls(page: Page): Promise<string[]> {
    return page.evaluate(() => {
      const out: string[] = [];
      const walk = (root: Document | ShadowRoot) => {
        for (const el of Array.from(root.querySelectorAll('*'))) {
          const cs = getComputedStyle(el);
          if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1) out.push(`${el.tagName.toLowerCase()} ${el.scrollHeight}/${el.clientHeight}`);
          if (el.shadowRoot) walk(el.shadowRoot);
        }
      };
      walk(document);
      return out;
    });
  }

  /** The widget cards of the screen in the order they are drawn. */
  const cardIds = (page: Page) => page.locator('devices-building home-widgets [data-home-widget]').evaluateAll((els) => els.map((e) => e.getAttribute('data-home-widget')));

  const savedWait = async (page: Page) => {
    await page.locator('devices-building sw-button[data-layout-save]').click();
    await expect(page.locator('devices-building [data-layout-bar]')).toHaveCount(0, { timeout: 20000 });
  };

  // ------------------------------------------------------------------------------------------------ defaults and directions

  test('by default: the control centre with every widget on and the catalogue\'s suggestions; the header row is only the refresh icon; no edit button', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'the desktop band; the phone is below');
    await seed(request);
    await resetHome(request);
    const st = await settings(request);
    expect(st['home.direction']).toBe('a');
    expect(st['home.widgets'].order).toEqual(['clock', 'weather', 'shabbat', 'alarm', 'quick']);
    expect(st['home.widgets'].weather.entity).toBe(WEATHER); // the first available weather entity of the catalogue
    expect(st['home.widgets'].calendar).toMatchObject({ date: HEBDATE, parsha: PARSHA, candles: CANDLES, havdalah: HAVDALAH, holiday: HOLIDAY });
    await open(page, '/devices/building');
    const b = page.locator('devices-building');
    await expect(b.locator('sw-page')).toHaveAttribute('heading', 'חשמל והתקנים');
    await expect(b.locator('.page-body')).toHaveAttribute('data-home-direction', 'a');
    await expect(b.locator('[data-layout-edit]')).toHaveCount(0);
    expect(await cardIds(page)).toEqual(['clock', 'weather', 'shabbat', 'alarm', 'quick']);
    const w = b.locator('home-widgets');
    await expect(w.locator('[data-home-time]')).toHaveText(/^\d\d:\d\d$/);
    await expect(w.locator('[data-home-hebrew-date]')).toHaveText('ג׳ בחשוון התשפ״ז');
    await expect(w.locator('[data-home-temp]')).toHaveText('28°C');
    await expect(w.locator('[data-home-cond]')).toHaveText('מעונן חלקית');
    await expect(w.locator('[data-home-fact="humidity"]')).toContainText('61%');
    await expect(w.locator('[data-home-fact="wind"]')).toContainText('14 קמ״ש');
    await expect(w.locator('[data-home-forecast] .fc')).toHaveCount(5); // the default forecast length
    await expect(w.locator('[data-home-parsha]')).toHaveText('פרשת נח');
    await expect(w.locator('[data-home-field="candles"] b')).toHaveText(/^\u200E?17:34$/);
    await expect(w.locator('[data-home-field="havdalah"] b')).toHaveText(/^\u200E?18:29$/);
    await expect(w.locator('[data-home-alarm-state]')).toHaveText('דרוכה (חוץ)');
    // the alarm is a read-only card, not also a tile; no control in it (no arm / disarm from the home screen)
    await expect(b.locator('sw-kpi[data-kpi="אזעקה"]')).toHaveCount(0);
    await expect(w.locator('[data-home-widget="alarm"] button, [data-home-widget="alarm"] a, [data-home-widget="alarm"] input')).toHaveCount(0);
    // the quick actions moved from the toolbar into their card
    await expect(b.locator('[data-bulk-building]')).toHaveCount(0);
    await expect(w.locator('[data-home-quick]')).toHaveCount(2);
    // the header row: nothing but the refresh icon
    const refresh = b.locator('sw-button[data-devices-refresh]');
    await expect(refresh).toBeVisible();
    await expect(b.locator('[data-devices-sync], [data-structure-changed]')).toHaveCount(0);
    expect((await b.locator('[slot="actions"]').innerText()).trim()).toBe('');
    await shot(page, 'home-default', testInfo);
  });

  for (const view of ['cards', 'tiles'] as const) {
    test(`the three directions (${view} view) draw where the mockup puts them and the whole screen fits without a vertical scroll at 1440x900 and 1920x1080`, async ({ page, request }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop', 'desktop sizes');
      test.setTimeout(180_000);
      await seed(request);
      await resetHome(request);
      for (const dir of ['a', 'b', 'c'] as const) {
        expect((await request.patch('/api/v1/settings', { data: { 'home.direction': dir, 'home.side': 'end' } })).status()).toBe(200);
        for (const [w, h] of [[1440, 900], [1920, 1080]]) {
          await page.setViewportSize({ width: w, height: h });
          await open(page, '/devices/building', view);
          const b = page.locator('devices-building');
          await expect(b.locator('.page-body')).toHaveAttribute('data-home-direction', dir);
          const hw = b.locator('home-widgets');
          await expect(hw).toBeVisible();
          const box = (await hw.boundingBox())!;
          const kpis = (await b.locator('.kpis').boundingBox())!;
          const split = (await b.locator('.split').boundingBox())!;
          if (dir === 'a') {
            await expect(hw).toHaveAttribute('layout', 'hero');
            expect(box.y + box.height, 'the band is above the summary tiles').toBeLessThanOrEqual(kpis.y + 1);
            await expect(b.locator('.split nav.tree')).toBeVisible();
            expect(box.width, 'a wide band').toBeGreaterThan(w * 0.55);
          } else if (dir === 'b') {
            await expect(hw).toHaveAttribute('layout', 'side');
            await expect(b.locator('.split nav.tree')).toHaveCount(0); // the tree became a floor filter
            await expect(b.locator('[data-floor-filter-btn]')).toHaveCount(4); // "כל המבנה" + 3 floors
            expect(box.x + box.width / 2, 'the column is on the left (side "end")').toBeLessThan(split.x + split.width / 2);
            expect(box.y, 'beside the floors, under the summary tiles').toBeGreaterThanOrEqual(kpis.y + kpis.height - 1);
          } else {
            await expect(hw).toHaveAttribute('layout', 'row');
            expect(box.y + box.height, 'the row is above the summary tiles').toBeLessThanOrEqual(kpis.y + 1);
            const tops = await hw.locator('[data-home-widget]').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
            expect(Math.max(...tops) - Math.min(...tops), 'one row').toBeLessThanOrEqual(3);
            expect(box.height, 'about 90 px').toBeLessThanOrEqual(130);
          }
          expect(await scrolls(page), `${dir} ${view} ${w}x${h}`).toEqual([]);
          expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${dir} ${view} ${w}x${h} sideways`).toBeLessThanOrEqual(0);
          if (w === 1440) await shot(page, `home-${dir}-${view}`, testInfo);
          if (w === 1920 && view === 'cards') await page.screenshot({ path: SHOTS ? path.join(SHOTS, `home-${dir}-cards-1920.png`) : path.join(process.cwd(), 'test-results', `home-${dir}-1920.png`) });
        }
      }
    });
  }

  test('direction b: the widget column can be on either side, and the floor filter narrows the floors', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop');
    await seed(request);
    await resetHome(request);
    await request.patch('/api/v1/settings', { data: { 'home.direction': 'b', 'home.side': 'start' } });
    await open(page, '/devices/building');
    const b = page.locator('devices-building');
    const hw = (await b.locator('home-widgets').boundingBox())!;
    const split = (await b.locator('.split').boundingBox())!;
    expect(hw.x + hw.width / 2, 'side "start" = the right edge in Hebrew').toBeGreaterThan(split.x + split.width / 2);
    await expect(b.locator('.floor-filter [data-floor-filter-btn="all"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(b.locator('section.fcard[data-floor-card^="home1_"]')).toHaveCount(3);
    await b.locator('[data-floor-filter-btn="home1_first"]').click();
    await expect(b.locator('section.fcard[data-floor-card^="home1_"]')).toHaveCount(1);
    await expect(b.locator('section.fcard[data-floor-card="home1_first"]')).toBeVisible();
    await b.locator('[data-floor-filter-btn="all"]').click();
    await expect(b.locator('section.fcard[data-floor-card^="home1_"]')).toHaveCount(3);
    await resetHome(request);
  });

  /** The widget cards of the phone's widget area with their boxes. */
  const phoneBoxes = (page: Page) =>
    page.locator('devices-building home-widgets .wg').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { id: e.getAttribute('data-w'), size: e.getAttribute('data-size'), x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; }));

  test('phone: the default presentation is one card under the other for every direction, full width, above the tiles, with nothing overflowing sideways', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'the phone layout');
    await seed(request);
    await resetHome(request);
    for (const dir of ['a', 'b', 'c'] as const) {
      await request.patch('/api/v1/settings', { data: { 'home.direction': dir } });
      await open(page, '/devices/building', 'cards');
      const hw = page.locator('devices-building home-widgets');
      await expect(hw).toHaveAttribute('layout', 'stack');
      const boxes = await phoneBoxes(page);
      expect(boxes.length).toBeGreaterThanOrEqual(4);
      for (let i = 1; i < boxes.length; i++) expect(boxes[i].y, 'one under the other').toBeGreaterThan(boxes[i - 1].y + boxes[i - 1].h - 2);
      for (const b of boxes) expect(b.w, `${b.id} full width`).toBeGreaterThanOrEqual(340);
      // the desktop size capped at medium: nothing is large on a phone by default
      expect(boxes.every((b) => b.size !== 'l')).toBe(true);
      const box = (await hw.boundingBox())!;
      const kpis = (await page.locator('devices-building .kpis').boundingBox())!;
      expect(box.y + box.height).toBeLessThanOrEqual(kpis.y + 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      await shot(page, `home-${dir}`, testInfo);
    }
    await resetHome(request);
  });

  test('phone: the three presentations - a snap row, one under the other, two per row - each fits 390 px without sideways overflow', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'the phone layout');
    await seed(request);
    await resetHome(request);
    for (const layout of ['snap', 'stack', 'two'] as const) {
      await setWidgets(request, (c) => (c.phone_layout = layout));
      await open(page, '/devices/building', 'cards');
      const hw = page.locator('devices-building home-widgets');
      await expect(hw).toHaveAttribute('layout', layout);
      const boxes = await phoneBoxes(page);
      if (layout === 'snap') {
        expect(new Set(boxes.map((b) => b.y)).size, 'one row').toBe(1);
        const wrap = await hw.locator('.wrap').evaluate((el) => ({ overflowX: getComputedStyle(el).overflowX, snap: getComputedStyle(el).scrollSnapType, canScroll: el.scrollWidth > el.clientWidth }));
        expect(wrap).toMatchObject({ overflowX: 'auto', canScroll: true });
        expect(wrap.snap).toContain('x');
      } else if (layout === 'stack') {
        expect(new Set(boxes.map((b) => b.y)).size, 'every card its own row').toBe(boxes.length);
        for (const b of boxes) expect(b.w).toBeGreaterThanOrEqual(340);
      } else {
        // two per row: medium cards share a row (about half the width each), the rest wraps
        const rows = new Map<number, number>();
        for (const b of boxes) rows.set(b.y, (rows.get(b.y) ?? 0) + 1);
        expect([...rows.values()].some((n) => n === 2), 'two cards in a row').toBe(true);
        expect(Math.max(...[...rows.values()])).toBe(2);
        for (const b of boxes.filter((x) => rows.get(x.y) === 2)) expect(b.w).toBeLessThanOrEqual(200);
      }
      for (const b of boxes) expect(b.x >= 0 && b.x + b.w <= 391 || layout === 'snap', `${b.id} inside the screen`).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), layout).toBeLessThanOrEqual(0);
      await shot(page, `home-phone-${layout}`, testInfo);
    }
    await resetHome(request);
  });

  test('phone: a widget hidden on the phone takes no room there, and each widget has a phone size of its own - the desktop keeps its own', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'the phone layout');
    await seed(request);
    await resetHome(request);
    await setWidgets(request, (c) => {
      c.alarm.phone_on = false;
      c.quick.phone_on = false;
      c.clock.phone_size = 'l';
      c.weather.phone_size = 's';
      c.shabbat.phone_size = 'm';
    });
    await open(page, '/devices/building', 'cards');
    const boxes = await phoneBoxes(page);
    expect(boxes.map((b) => `${b.id}:${b.size}`)).toEqual(['clock:l', 'weather:s', 'shabbat:m']); // the alarm and the quick actions are gone, no gap where they were
    const kpis = (await page.locator('devices-building .kpis').boundingBox())!;
    const last = boxes[boxes.length - 1];
    expect(kpis.y - (last.y + last.h), 'the tiles follow the last card directly').toBeLessThanOrEqual(24);
    await expect(page.locator('devices-building sw-kpi[data-kpi="אזעקה"]')).toHaveCount(1); // the alarm card is off on the phone, so its status is the summary tile again (no widget, no lost information)
    // a widget that is off on the desktop but on for the phone is drawn on the phone
    await setWidgets(request, (c) => {
      c.alarm.phone_on = null;
      c.quick.phone_on = null;
      c.shabbat.on = false;
      c.shabbat.phone_on = true;
    });
    await open(page, '/devices/building', 'cards');
    expect((await phoneBoxes(page)).map((b) => b.id)).toContain('shabbat');
    await shot(page, 'home-phone-hidden', testInfo);
    // every widget hidden on the phone: the widget area takes no room at all
    await setWidgets(request, (c) => {
      for (const id of ['clock', 'weather', 'shabbat', 'alarm', 'quick']) c[id].phone_on = false;
    });
    await open(page, '/devices/building', 'cards');
    await expect(page.locator('devices-building home-widgets')).toBeHidden();
    await resetHome(request);
  });

  test('desktop: the phone settings never change the desktop - a widget hidden on the phone shows here, a phone-only widget does not, and the sizes are the direction\'s own', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop');
    await seed(request);
    await resetHome(request);
    await setWidgets(request, (c) => {
      c.alarm.phone_on = false;
      c.clock.phone_size = 's';
      c.shabbat.on = false;
      c.shabbat.phone_on = true;
      c.phone_layout = 'two';
    });
    await open(page, '/devices/building', 'cards');
    const boxes = await phoneBoxes(page);
    expect(boxes.map((b) => `${b.id}:${b.size}`)).toEqual(['clock:l', 'weather:l', 'alarm:m', 'quick:m']);
    await expect(page.locator('devices-building home-widgets')).toHaveAttribute('layout', 'hero');
    await resetHome(request);
  });


  test('phone: the edit mode works at 390 px - the phone layout, a phone size and "הצג בנייד" per widget beside the desktop ones, the card controls edit the phone values - and saves', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'the phone layout');
    test.setTimeout(120_000);
    await seed(request);
    await resetHome(request);
    try {
      await open(page, '/devices/building?edit=1', 'cards');
      const b = page.locator('devices-building');
      await expect(b.locator('home-edit-panel')).toBeVisible({ timeout: 30000 });
      // usable at 390 px: the phone controls are inside the screen, the page does not scroll sideways
      const inside = async (sel: string) => {
        const r = (await b.locator(sel).first().boundingBox())!;
        expect(r.x, sel).toBeGreaterThanOrEqual(-1);
        expect(r.x + r.width, sel).toBeLessThanOrEqual(391);
      };
      await inside('[data-home-phone-layouts]');
      for (const id of ['clock', 'weather', 'shabbat', 'alarm', 'quick']) await inside(`[data-home-wphone="${id}"]`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      await expect(b.locator('[data-home-wphone="clock"] .pl')).toHaveText('בנייד'); // clearly labelled
      await shot(page, 'home-phone-edit', testInfo);
      // the phone layout, live
      await expect(b.locator('[data-home-phone-layout="stack"]')).toHaveAttribute('aria-pressed', 'true');
      await b.locator('[data-home-phone-layout="two"]').click();
      await expect(b.locator('home-widgets')).toHaveAttribute('layout', 'two');
      // a phone size beside the desktop one: "אוטומטי" shows what it resolves to (the desktop size capped at medium)
      await expect(b.locator('[data-home-phone-size="clock"] option[value=""]')).toHaveText('אוטומטי (בינוני)');
      await b.locator('[data-home-phone-size="weather"]').selectOption('s');
      await expect(b.locator('[data-home-widget="weather"]')).toHaveAttribute('data-size', 's');
      // the card's own controls edit the phone values here: size ...
      await b.locator('[data-home-size="clock:l"]').click();
      await expect(b.locator('[data-home-widget="clock"]')).toHaveAttribute('data-size', 'l');
      // ... and hide (the phone only)
      await b.locator('[data-home-hide="quick"]').click();
      await expect(b.locator('[data-home-ghost="quick"]')).toHaveAttribute('data-home-avail', 'off');
      // the row's own switch
      await b.locator('[data-home-phone-on="alarm"]').uncheck();
      await expect(b.locator('[data-home-ghost="alarm"]')).toBeVisible();
      await savedWait(page);
      const cfg = (await settings(request))['home.widgets'];
      expect(cfg.phone_layout).toBe('two');
      expect(cfg.weather.phone_size).toBe('s');
      expect(cfg.clock.phone_size).toBe('l');
      expect(cfg.clock.sizes).toEqual({ a: 'l', b: 'm', c: 'm' }); // the desktop sizes are untouched
      expect(cfg.quick.phone_on).toBe(false);
      expect(cfg.alarm.phone_on).toBe(false);
      expect(cfg.quick.on && cfg.alarm.on).toBe(true); // ... so are the desktop switches
      await page.reload();
      await expect(b.locator('home-widgets')).toHaveAttribute('layout', 'two', { timeout: 30000 });
      expect(await cardIds(page)).toEqual(['clock', 'weather', 'shabbat']);
    } finally {
      await resetHome(request);
    }
  });

  test('the personal phone layout: a holder of screen.personalize chooses how the widgets sit on their phone, and "ברירת מחדל של המערכת" clears it', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop');
    await seed(request);
    await resetHome(request);
    try {
      await open(page, '/devices/building');
      await page.locator('sw-app [data-profile-menu]').click();
      await page.locator('sw-app sw-user-menu [data-menu-account]').click();
      await page.locator('sw-app sw-user-menu [data-my-home] summary').click();
      const mine = page.locator('sw-app sw-user-menu sw-home-personal');
      await expect(mine.locator('[data-home-personal-phone-layout]')).toHaveCount(4, { timeout: 15000 }); // "ברירת מחדל" + the three
      await expect(mine.locator('[data-home-personal-phone-layout=""]')).toHaveAttribute('aria-pressed', 'true');
      await mine.locator('[data-home-personal-phone-layout="snap"]').click();
      await expect.poll(async () => (await (await request.get('/api/v1/devices/tree')).json()).home.config.phone_layout).toBe('snap');
      expect((await settings(request))['home.widgets'].phone_layout).toBe('stack'); // the installation's own is unchanged
      await mine.locator('[data-home-personal-reset]').click();
      await expect.poll(async () => (await (await request.get('/api/v1/devices/tree')).json()).home.config.phone_layout).toBe('stack');
    } finally {
      await resetHome(request);
    }
  });

  test('a widget that has nothing to show takes no room: no weather entity, an alarm nobody may see, Shabbat with nothing chosen', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'desktop');
    await seed(request);
    await resetHome(request);
    await setWidgets(request, (c) => {
      c.weather.entity = '';
      c.alarm.entity = 'alarm_control_panel.home1_nowhere';
      c.calendar = { date: '', parsha: '', candles: '', havdalah: '', holiday: '', extras: [] };
    });
    await open(page, '/devices/building');
    expect(await cardIds(page)).toEqual(['clock', 'quick']);
    // edit mode explains each one with a dashed ghost
    await page.evaluate(() => (location.hash = '#/devices/building?edit=1'));
    const b = page.locator('devices-building');
    await expect(b.locator('home-edit-panel')).toBeVisible({ timeout: 30000 });
    await expect(b.locator('[data-home-ghost="weather"]')).toHaveAttribute('data-home-avail', 'none');
    await expect(b.locator('[data-home-ghost="shabbat"]')).toHaveAttribute('data-home-avail', 'none');
    await expect(b.locator('[data-home-ghost="alarm"]')).toHaveAttribute('data-home-avail', 'noalarm');
    await expect(b.locator('[data-home-ghost="alarm"]')).toContainText('אין מערכת אזעקה באתר');
    await b.locator('sw-button[data-layout-cancel]').click();
    await resetHome(request);
  });

  // ------------------------------------------------------------------------------------------------ edit mode

  test('edit mode: the direction, a size per widget and direction, hide / add, a heading, the order by keyboard and by drag - saved together, and the plain screen follows', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop');
    test.setTimeout(150_000);
    await seed(request);
    await resetHome(request);
    try {
      await open(page, '/devices/building?edit=1');
      const b = page.locator('devices-building');
      await expect(b.locator('home-edit-panel')).toBeVisible({ timeout: 30000 });
      await expect(b.locator('sw-button[data-layout-save]')).toHaveAttribute('disabled', ''); // nothing changed yet
      await shot(page, 'home-a-edit', testInfo);
      // every card carries its own controls in edit mode
      for (const id of ['clock', 'weather', 'shabbat', 'alarm', 'quick']) await expect(b.locator(`[data-home-edit-bar="${id}"]`)).toBeVisible();
      // sizes are per direction: weather is large in a, and small in b
      await expect(b.locator('[data-home-widget="weather"]')).toHaveAttribute('data-size', 'l');
      await b.locator('[data-home-size="weather:s"]').click();
      await expect(b.locator('[data-home-widget="weather"]')).toHaveAttribute('data-size', 's');
      await b.locator('[data-home-direction="b"]').click();
      await expect(b.locator('home-widgets')).toHaveAttribute('layout', 'side');
      await expect(b.locator('[data-home-widget="weather"]')).toHaveAttribute('data-size', 'm'); // b has its own size
      await expect(b.locator('[data-home-side]')).toHaveCount(2); // the side choice exists for b only
      await shot(page, 'home-b-edit', testInfo);
      await b.locator('[data-home-direction="c"]').click();
      await expect(b.locator('home-widgets')).toHaveAttribute('layout', 'row');
      await expect(b.locator('[data-home-side]')).toHaveCount(0);
      await shot(page, 'home-c-edit', testInfo);
      await b.locator('[data-home-direction="a"]').click();
      // hide, and add back from the ghost
      await b.locator('[data-home-hide="alarm"]').click();
      await expect(b.locator('[data-home-ghost="alarm"]')).toHaveAttribute('data-home-avail', 'off');
      await expect(b.locator('[data-home-widget="alarm"]')).toHaveCount(0);
      await b.locator('[data-home-add="alarm"]').click();
      await expect(b.locator('[data-home-widget="alarm"]')).toBeVisible();
      // the order by keyboard: the grip's arrow keys (right / up = earlier)
      await b.locator('[data-home-grip="weather"]').focus();
      await page.keyboard.press('ArrowRight');
      expect(await cardIds(page)).toEqual(['weather', 'clock', 'shabbat', 'alarm', 'quick']);
      await expect(b.locator('[data-home-grip="weather"]')).toBeFocused(); // the focus stays with the moved card
      await page.keyboard.press('ArrowLeft');
      expect(await cardIds(page)).toEqual(['clock', 'weather', 'shabbat', 'alarm', 'quick']);
      // the order by drag: the quick actions onto the clock
      await b.locator('[data-home-widget="quick"]').dragTo(b.locator('[data-home-widget="clock"]'), { sourcePosition: { x: 40, y: 30 }, targetPosition: { x: 40, y: 30 } });
      expect(await cardIds(page)).toEqual(['quick', 'clock', 'weather', 'shabbat', 'alarm']);
      // and the panel's own up / down buttons
      await b.locator('[data-home-wearlier="alarm"]').click();
      await b.locator('[data-home-wearlier="alarm"]').click();
      expect(await cardIds(page)).toEqual(['quick', 'clock', 'alarm', 'weather', 'shabbat']);
      // a heading of its own, from the card's settings button
      await b.locator('[data-home-widget-settings="clock"]').click();
      await expect(b.locator('[data-home-wbody="clock"]')).toBeVisible();
      await b.locator('[data-home-label="clock"]').fill('שעה בבניין');
      await expect(b.locator('[data-home-widget="clock"]')).toHaveAttribute('aria-label', 'שעה בבניין');
      await b.locator('[data-home-clock-seconds]').check();
      await b.locator('[data-home-size="clock:l"]').click();
      await expect(b.locator('[data-home-widget="clock"] .ss')).toBeVisible();
      // not saved yet
      expect((await settings(request))['home.widgets'].order[0]).toBe('clock');
      await savedWait(page);
      const cfg = (await settings(request))['home.widgets'];
      expect(cfg.order).toEqual(['quick', 'clock', 'alarm', 'weather', 'shabbat']);
      expect(cfg.weather.sizes).toEqual({ a: 's', b: 'm', c: 'm' });
      expect(cfg.clock).toMatchObject({ label: 'שעה בבניין', seconds: true, on: true });
      expect((await settings(request))['home.direction']).toBe('a');
      // the plain screen follows, after a reload too
      await page.reload();
      await expect(b.locator('home-widgets [data-home-widget]').first()).toBeVisible({ timeout: 30000 });
      expect(await cardIds(page)).toEqual(['quick', 'clock', 'alarm', 'weather', 'shabbat']);
      await expect(b.locator('[data-home-widget="weather"]')).toHaveAttribute('data-size', 's');
      await expect(b.locator('[data-home-widget="clock"]')).toHaveAttribute('aria-label', 'שעה בבניין');
      // "בטל" drops a draft
      await page.evaluate(() => (location.hash = '#/devices/building?edit=1'));
      await b.locator('[data-home-hide="quick"]').click();
      await expect(b.locator('[data-home-ghost="quick"]')).toBeVisible();
      await b.locator('sw-button[data-layout-cancel]').click(); // "בטל" (the label changes with the draft)
      await expect(b.locator('[data-layout-bar]')).toHaveCount(0);
      expect(await cardIds(page)).toContain('quick');
      // "אפס ווידג׳טים לברירת מחדל" restores the built-in default with the catalogue's suggestions (saved with "שמור")
      await page.evaluate(() => (location.hash = '#/devices/building?edit=1'));
      await expect(b.locator('home-edit-panel')).toBeVisible();
      await b.locator('sw-button[data-home-reset-widgets]').click();
      expect(await cardIds(page)).toEqual(['clock', 'weather', 'shabbat', 'alarm', 'quick']);
      await savedWait(page);
      expect((await settings(request))['home.widgets'].clock.label).toBe('');
    } finally {
      await resetHome(request);
    }
  });

  test('the weather: a checklist of exactly the fields the chosen entity offers, the forecast length, a sensor for one field - and only the chosen fields show', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop');
    test.setTimeout(120_000);
    await seed(request);
    await resetHome(request);
    try {
      await open(page, '/devices/building?edit=1');
      const b = page.locator('devices-building');
      await expect(b.locator('home-edit-panel')).toBeVisible({ timeout: 30000 });
      await b.locator('[data-home-wopen="weather"]').click();
      const entity = b.locator('select[data-home-weather-entity]');
      await expect(entity.locator('option')).toHaveCount(3); // none + the two weather entities
      const fields = () => b.locator('[data-home-wfields] [data-home-wfield]').evaluateAll((els) => els.map((e) => e.getAttribute('data-home-wfield')));
      // the rich entity: everything it reports
      await expect.poll(fields, { timeout: 15000 }).toEqual(['condition', 'temperature', 'humidity', 'wind', 'pressure', 'visibility', 'uv', 'forecast']);
      await expect(b.locator('[data-home-forecast-len]')).toHaveCount(3);
      await expect(b.locator('[data-home-forecast-len="max"]')).toContainText('(6)'); // it carries six entries
      await expect(b.locator('[data-home-forecast-len="5"]')).toContainText('(5)');
      await expect(b.locator('[data-home-forecast-len="3"]')).toContainText('(3)');
      await shot(page, 'home-weather-edit', testInfo);
      // the bare entity offers only the condition and the temperature - no forecast length
      await entity.selectOption(WEATHER_BARE);
      await expect.poll(fields).toEqual(['condition', 'temperature']);
      await expect(b.locator('[data-home-forecast-len]')).toHaveCount(0);
      await expect(b.locator('[data-home-widget="weather"] [data-home-forecast]')).toHaveCount(0);
      await expect(b.locator('[data-home-widget="weather"] [data-home-temp]')).toHaveText('22°C');
      // back to the rich one: choose the fields, the length and a sensor for the temperature
      await entity.selectOption(WEATHER);
      await expect.poll(fields).toContain('pressure');
      for (const f of ['humidity', 'wind']) await b.locator(`[data-home-wfield="${f}"]`).uncheck();
      for (const f of ['pressure', 'uv', 'visibility']) await b.locator(`[data-home-wfield="${f}"]`).check();
      await b.locator('[data-home-forecast-len="3"]').click();
      await b.locator('select[data-home-wsource="temperature"]').selectOption(OUTDOOR);
      const card = b.locator('[data-home-widget="weather"]');
      await expect(card.locator('[data-home-temp]')).toHaveText('31°C'); // 31.4 from the outdoor sensor
      await expect(card.locator('[data-home-fact]')).toHaveCount(3);
      await expect(card.locator('[data-home-fact="pressure"]')).toContainText('1012.3');
      await expect(card.locator('[data-home-fact="uv"]')).toContainText('6');
      await expect(card.locator('[data-home-fact="humidity"]')).toHaveCount(0);
      await expect(card.locator('[data-home-forecast] .fc')).toHaveCount(3);
      await savedWait(page);
      const w = (await settings(request))['home.widgets'].weather;
      expect(w.entity).toBe(WEATHER);
      expect(w.fields).toEqual(['condition', 'temperature', 'pressure', 'visibility', 'uv', 'forecast']); // the checklist's own order
      expect(w.forecast).toBe('3');
      expect(w.sources).toEqual({ temperature: OUTDOOR });
      await page.reload();
      await expect(b.locator('[data-home-widget="weather"] [data-home-temp]')).toHaveText('31°C', { timeout: 30000 });
      await expect(b.locator('[data-home-widget="weather"] [data-home-forecast] .fc')).toHaveCount(3);
      await shot(page, 'home-weather', testInfo);
      // the sensor follows its own state, no network
      await request.post('/api/v1/ha/dev/states', { data: { states: [{ entity_id: OUTDOOR, state: '18.2', attributes: { friendly_name: 'טמפרטורה בחוץ', unit_of_measurement: '°C', device_class: 'temperature' } }] } });
      await expect(b.locator('[data-home-widget="weather"] [data-home-temp]')).toHaveText('18°C', { timeout: 20000 });
      // the entity going unavailable hides the card
      await request.post('/api/v1/ha/dev/states', { data: { states: [{ entity_id: WEATHER, state: 'unavailable', attributes: { friendly_name: 'מזג אוויר בית' } }] } });
      await expect(b.locator('[data-home-widget="weather"]')).toHaveCount(0, { timeout: 20000 });
    } finally {
      await request.post('/api/v1/ha/dev/states', { data: { states: [{ entity_id: WEATHER, state: 'partlycloudy', attributes: WEATHER_ATTRS }, { entity_id: OUTDOOR, state: '31.4', attributes: { friendly_name: 'טמפרטורה בחוץ', unit_of_measurement: '°C', device_class: 'temperature' } }] } });
      await resetHome(request);
    }
  });

  test('the Jewish calendar: a sensor per field with suggestions, an extra field, and the Hebrew date computed in the browser when no sensor is chosen', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop');
    test.setTimeout(120_000);
    await seed(request);
    await resetHome(request);
    try {
      await setWidgets(request, (c) => {
        c.calendar = { date: '', parsha: '', candles: '', havdalah: '', holiday: '', extras: [] };
      });
      await open(page, '/devices/building?edit=1');
      const b = page.locator('devices-building');
      await expect(b.locator('home-edit-panel')).toBeVisible({ timeout: 30000 });
      // nothing chosen: the card says so (edit mode) and the clock computes the Hebrew date itself (Intl he-u-ca-hebrew)
      await expect(b.locator('[data-home-ghost="shabbat"]')).toHaveAttribute('data-home-avail', 'none');
      await expect(b.locator('[data-home-widget="clock"] [data-home-hebrew-date]')).toHaveText(/^[א-ת״׳]+ ב[א-ת׳ ]+ ה[א-ת״]+$/);
      await b.locator('[data-home-wopen="shabbat"]').click();
      // every field is its own choice, listing the Jewish Calendar integration's sensors first, and suggests one
      for (const f of ['parsha', 'candles', 'havdalah', 'holiday']) {
        const sel = b.locator(`select[data-home-cal="${f}"]`);
        await expect(sel.locator('optgroup[label="לוח שנה עברי"] option').first()).toBeAttached({ timeout: 15000 });
        await expect(sel.locator('option', { hasText: 'הצעה:' })).toHaveCount(1);
      }
      await b.locator('sw-button[data-home-suggest]').click();
      await expect(b.locator('select[data-home-cal="parsha"]')).toHaveValue(PARSHA);
      await expect(b.locator('select[data-home-cal="candles"]')).toHaveValue(CANDLES);
      await expect(b.locator('select[data-home-cal="havdalah"]')).toHaveValue(HAVDALAH);
      await expect(b.locator('select[data-home-cal="holiday"]')).toHaveValue(HOLIDAY);
      const card = b.locator('[data-home-widget="shabbat"]');
      await expect(card.locator('[data-home-parsha]')).toHaveText('פרשת נח');
      await expect(card.locator('[data-home-field="holiday"]')).toHaveText('שמחת תורה');
      // one field on its own: drop the holiday, take havdalah from another sensor entry is possible too - here: no holiday
      await b.locator('select[data-home-cal="holiday"]').selectOption('');
      await expect(card.locator('[data-home-field="holiday"]')).toHaveCount(0);
      // an extra field: any sensor the platform mirrors (here the issur-melacha binary sensor), with its own label
      await b.locator('sw-button[data-home-extra-add]').click();
      await b.locator('select[data-home-extra-entity="0"]').selectOption(ISSUR);
      await b.locator('input[data-home-extra-label="0"]').fill('איסור מלאכה');
      await expect(card.locator('[data-home-extras]')).toContainText('איסור מלאכה');
      await expect(card.locator('[data-home-extras]')).toContainText('לא');
      // the Hebrew date of a sensor of its own
      await b.locator('[data-home-wopen="clock"]').click();
      await b.locator('select[data-home-cal="date"]').selectOption(HEBDATE);
      await expect(b.locator('[data-home-widget="clock"] [data-home-hebrew-date]')).toHaveText('ג׳ בחשוון התשפ״ז');
      await shot(page, 'home-calendar-edit', testInfo);
      await savedWait(page);
      const cal = (await settings(request))['home.widgets'].calendar;
      expect(cal).toMatchObject({ date: HEBDATE, parsha: PARSHA, candles: CANDLES, havdalah: HAVDALAH, holiday: '' });
      expect(cal.extras).toEqual([{ entity_id: ISSUR, label: 'איסור מלאכה' }]);
      await page.reload();
      await expect(b.locator('[data-home-widget="shabbat"] [data-home-extras]')).toContainText('איסור מלאכה', { timeout: 30000 });
      await shot(page, 'home-calendar', testInfo);
    } finally {
      await resetHome(request);
    }
  });

  test('the quick actions open the confirmation of the bulk action; the toolbar carries them when the card is off; a user without the bulk permission has no card', async ({ page, browser, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop');
    await seed(request);
    await resetHome(request);
    const user = `home1operator${testInfo.project.name}`;
    const bindings: string[] = [];
    try {
      await open(page, '/devices/building');
      const b = page.locator('devices-building');
      await b.locator('[data-home-quick="lights_off"]').click();
      const dialog = b.locator('devices-bulk-dialog sw-dialog[data-bulk-dialog="confirm"]');
      await expect(dialog.locator('[data-bulk-what]')).toBeVisible({ timeout: 10000 });
      await dialog.locator('sw-button[data-bulk-cancel]').click(); // nothing is sent from the card itself
      await expect(b.locator('devices-bulk-dialog sw-dialog[open]')).toHaveCount(0);
      // off: the building's bulk buttons are back in the toolbar row
      await setWidgets(request, (c) => (c.quick.on = false));
      await page.reload();
      await expect(b.locator('[data-bulk-building] [data-bulk-kind="all_off"]')).toBeVisible({ timeout: 30000 });
      await expect(b.locator('[data-home-widget="quick"]')).toHaveCount(0);
      await setWidgets(request, (c) => (c.quick.on = true));
      // an operator holds devices.control but not devices.control_bulk: no quick card, the rest of the screen is the same
      bindings.push(await bindUser(request, user, 'operator'));
      const u = await userPage(browser, user);
      await open(u.page, '/devices/building');
      expect(await cardIds(u.page)).toEqual(['clock', 'weather', 'shabbat', 'alarm']);
      await expect(u.page.locator('devices-building [data-bulk-building], devices-building [data-home-quick]')).toHaveCount(0);
      await u.close();
    } finally {
      for (const id of bindings) await request.delete(`/api/v1/access/bindings/${id}`).catch(() => {});
      await resetHome(request);
    }
  });

  test('the floor order is still editable in the same session (drag handle and up / down buttons) and the direction b filter follows it', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop');
    await seed(request);
    await resetHome(request);
    try {
      await open(page, '/devices/building?edit=1');
      const b = page.locator('devices-building');
      await expect(b.locator('home-edit-panel')).toBeVisible({ timeout: 30000 });
      const order = () => b.locator('[data-home-floors] [data-home-floor]').evaluateAll((els) => els.map((e) => e.getAttribute('data-home-floor')).filter((id) => id!.startsWith('home1_')));
      expect(await order()).toEqual(['home1_base', 'home1_first', 'home1_ground']); // level order
      await b.locator('[data-home-floor-up="home1_ground"]').click();
      await b.locator('[data-home-floor-up="home1_ground"]').click();
      expect(await order()).toEqual(['home1_ground', 'home1_base', 'home1_first']);
      await savedWait(page);
      expect(JSON.parse((await settings(request))['home.floor_order'])).toEqual(expect.arrayContaining(['home1_ground']));
      const tree = await (await request.get('/api/v1/devices/tree')).json();
      expect(tree.floors.map((f: { floor_id: string }) => f.floor_id).filter((id: string) => id.startsWith('home1_'))[0]).toBe('home1_ground');
    } finally {
      await resetHome(request);
    }
  });

  // ------------------------------------------------------------------------------------------------ settings, personal, navigation

  test('הגדרות › חשמל והתקנים › מסך ראשי: a direction picker with a preview each, saved at once, the side of b; read-only for a viewer', async ({ page, browser, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop');
    await seed(request);
    await resetHome(request);
    const user = `home1setviewer${testInfo.project.name}`;
    const bindings: string[] = [];
    try {
      await page.goto('about:blank');
      await page.goto('/?design=a#/system/diagnostics?tab=devices');
      const card = page.locator('system-home-screen');
      await expect(card.locator('[data-home-dir-option]')).toHaveCount(3, { timeout: 30000 });
      await expect(card.locator('[data-home-dir-thumb]')).toHaveCount(3); // a live preview thumbnail per direction
      await expect(card.locator('[data-home-dir-option="a"]')).toHaveAttribute('aria-pressed', 'true'); // the default
      await expect(card.locator('[data-home-side-option]')).toHaveCount(0);
      await card.locator('[data-home-dir-option="b"]').click();
      await expect(card.locator('[data-home-message]')).toHaveText('המסך הראשי נשמר');
      expect((await settings(request))['home.direction']).toBe('b');
      await expect(card.locator('[data-home-side-option="end"]')).toHaveAttribute('aria-pressed', 'true');
      await card.locator('[data-home-side-option="start"]').click();
      await expect.poll(async () => (await settings(request))['home.side']).toBe('start');
      await shot(page, 'home-settings', testInfo);
      // the screen follows
      await open(page, '/devices/building');
      await expect(page.locator('devices-building home-widgets')).toHaveAttribute('layout', 'side');
      // the link opens the screen's edit mode
      await page.goto('about:blank');
      await page.goto('/?design=a#/system/diagnostics?tab=devices');
      await page.locator('system-home-screen sw-button[data-home-edit-link]').click();
      await expect(page.locator('devices-building home-edit-panel')).toBeVisible({ timeout: 30000 });
      // a viewer sees the picker but cannot change it; the server refuses too
      bindings.push(await bindUser(request, user, 'viewer'));
      const u = await userPage(browser, user);
      await u.page.goto('/?design=a#/system/diagnostics?tab=devices');
      await expect(u.page.locator('system-home-screen [data-home-dir-option]').first()).toBeVisible({ timeout: 30000 });
      await expect(u.page.locator('system-home-screen [data-home-dir-option="c"] ')).toBeDisabled();
      expect((await u.page.request.patch('/api/v1/settings', { data: { 'home.direction': 'c' } })).status()).toBe(403);
      await u.close();
    } finally {
      for (const id of bindings) await request.delete(`/api/v1/access/bindings/${id}`).catch(() => {});
      await resetHome(request);
    }
  });

  test('a viewer never gets edit mode - not from the address either - and the server refuses their writes; they see the widgets an administrator switched on', async ({ browser, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop');
    await seed(request);
    await resetHome(request);
    const user = `home1viewer${testInfo.project.name}`;
    const bindings: string[] = [];
    try {
      bindings.push(await bindUser(request, user, 'viewer'));
      const u = await userPage(browser, user);
      await open(u.page, '/devices/building?edit=1');
      const p = u.page;
      await expect(p.locator('devices-building sw-kpi').first()).toBeVisible({ timeout: 30000 });
      await expect(p.locator('devices-building [data-layout-bar], devices-building home-edit-panel, devices-building [data-layout-edit]')).toHaveCount(0);
      await expect.poll(() => p.evaluate(() => location.hash)).toBe('#/devices/building');
      expect(await cardIds(p)).toEqual(['clock', 'weather', 'shabbat', 'alarm']); // no quick actions without the bulk permission
      await expect(p.locator('devices-building home-widgets [data-home-widget="weather"]')).toContainText('מעונן חלקית');
      for (const data of [{ 'home.title': 'x' }, { 'home.direction': 'c' }, { 'home.side': 'start' }, { 'home.widgets': { clock: { on: false } } }, { 'home.floor_order': '["home1_base"]' }]) expect((await p.request.patch('/api/v1/settings', { data })).status(), JSON.stringify(data)).toBe(403);
      expect((await p.request.get('/api/v1/devices/home-candidates')).status()).toBe(403);
      // and a viewer's personal choice is refused
      expect((await p.request.put('/api/v1/me/prefs', { data: { 'home.personal': { direction: 'c' } } })).status()).toBe(403);
      await u.close();
    } finally {
      for (const id of bindings) await request.delete(`/api/v1/access/bindings/${id}`).catch(() => {});
      await resetHome(request);
    }
  });

  test('the personal screen exists only for a holder of screen.personalize: החשבון שלי › המסך שלי changes their screen alone, and losing the permission drops it', async ({ page, browser, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop');
    test.setTimeout(150_000);
    await seed(request);
    await resetHome(request);
    const holder = `home1dana${testInfo.project.name}`;
    const plain = `home1ron${testInfo.project.name}`;
    const bindings: string[] = [];
    try {
      const role = await request.post('/api/v1/access/roles', { data: { name: `התאמה אישית ${testInfo.project.name} ${Date.now()}`, permissions: ['devices.read', 'screen.personalize'], sensitive: [] } });
      expect(role.status()).toBeLessThan(300);
      const roleId = ((await role.json()) as { id: string }).id;
      // the permission is listed with its label for the access screens
      const roles = await (await request.get('/api/v1/access/roles')).json();
      expect(roles.labels['screen.personalize']).toBe('התאמה אישית של המסך שלי');
      bindings.push(await bindUser(request, holder, roleId));
      bindings.push(await bindUser(request, plain, 'viewer'));
      // a run that stopped half way left a personal value behind: start clean
      await request.put('/api/v1/me/prefs', { headers: { 'X-SW-Dev-User': holder }, data: { 'home.personal': null } });
      const menu = 'sw-app sw-user-menu';
      // ---- a user without it: no section, and the server refuses
      const r = await userPage(browser, plain);
      await open(r.page, '/devices/building');
      await r.page.locator('sw-app [data-profile-menu]').click();
      await r.page.locator(`${menu} [data-menu-account]`).click();
      await expect(r.page.locator(`${menu} [data-my-home]`)).toHaveCount(0);
      expect((await r.page.request.put('/api/v1/me/prefs', { data: { 'home.personal': { direction: 'b' } } })).status()).toBe(403);
      await r.close();
      // ---- the holder
      const d = await userPage(browser, holder);
      const p = d.page;
      await open(p, '/devices/building');
      const hw = p.locator('devices-building home-widgets');
      await expect(hw).toHaveAttribute('layout', 'hero');
      await p.locator('sw-app [data-profile-menu]').click();
      await p.locator(`${menu} [data-menu-account]`).click();
      await p.locator(`${menu} [data-my-home] summary`).click();
      const mine = p.locator(`${menu} sw-home-personal`);
      await expect(mine.locator('[data-home-personal-dir]')).toHaveCount(4, { timeout: 15000 }); // "ברירת מחדל" + a / b / c
      await expect(mine.locator('[data-home-personal-widget]')).toHaveCount(5);
      await shot(p, 'home-personal', testInfo);
      // a direction of their own
      await mine.locator('[data-home-personal-dir="c"]').click();
      await expect(hw).toHaveAttribute('layout', 'row', { timeout: 20000 });
      // a widget off, another in a size of their own, another first
      await mine.locator('[data-home-personal-on="weather"]').uncheck();
      await mine.locator('[data-home-personal-size="clock:s"]').click();
      await mine.locator('[data-home-personal-earlier="alarm"]').click();
      await expect.poll(() => cardIds(p), { timeout: 20000 }).not.toContain('weather');
      const mineOrder = await cardIds(p);
      expect(mineOrder.indexOf('alarm'), 'the alarm moved one place earlier than Shabbat').toBeLessThan(mineOrder.indexOf('shabbat'));
      await expect(p.locator('devices-building home-widgets [data-home-widget="clock"]')).toHaveAttribute('data-size', 's');
      const stored = await (await p.request.get('/api/v1/me/prefs')).json();
      expect(stored.prefs['home.personal']).toMatchObject({ direction: 'c', widgets: { weather: { on: false }, clock: { size: 's' } } });
      // everyone else - the administrator included - still sees the installation's screen
      await open(page, '/devices/building');
      await expect(page.locator('devices-building home-widgets')).toHaveAttribute('layout', 'hero');
      expect(await cardIds(page)).toContain('weather');
      // "ברירת מחדל של המערכת" clears it
      await mine.locator('[data-home-personal-reset]').click();
      await expect(hw).toHaveAttribute('layout', 'hero', { timeout: 20000 });
      expect(await cardIds(p)).toContain('weather');
      // set it again, then the holder loses the permission: the stored value stays but is ignored on every read
      await mine.locator('[data-home-personal-dir="b"]').click();
      await expect(hw).toHaveAttribute('layout', 'side', { timeout: 20000 });
      await d.close();
      const drop = bindings.shift()!;
      expect((await request.delete(`/api/v1/access/bindings/${drop}`)).status()).toBeLessThan(300);
      bindings.push(await bindUser(request, holder, 'viewer'));
      const again = await userPage(browser, holder);
      await open(again.page, '/devices/building');
      await expect(again.page.locator('devices-building home-widgets')).toHaveAttribute('layout', 'hero');
      const prefs = await (await again.page.request.get('/api/v1/me/prefs')).json();
      expect(prefs.prefs['home.personal']).toBeNull();
      expect(prefs.stored).not.toContain('home.personal');
      await again.close();
    } finally {
      for (const id of bindings) await request.delete(`/api/v1/access/bindings/${id}`).catch(() => {});
      await resetHome(request);
    }
  });

  // ------------------------------------------------------------------------------------------------ the view choice in the user menu

  test('the view choice (cards | tiles) is a compact "תצוגה" item of the user menu, not a row of the page; it keeps its per-browser persistence and only exists on this screen', async ({ page, request }, testInfo) => {
    await seed(request);
    await resetHome(request);
    const phone = testInfo.project.name === 'mobile';
    const me = phone ? 'sw-app [data-nav-me]' : 'sw-app [data-profile-menu]';
    const item = 'sw-app sw-user-menu [data-menu-screen-view]';
    await open(page, '/devices/building', 'cards');
    const b = page.locator('devices-building');
    // no row on the page: neither the segmented control nor an empty toolbar
    await expect(b.locator('button[data-layout]')).toHaveCount(0);
    await expect(b.locator('[data-toolbar]')).toHaveCount(0); // the quick-actions card carries the building buttons: nothing else to put in a row
    await expect(b.locator('[data-layout-view="cards"]')).toBeVisible();
    await page.locator(me).click();
    await expect(page.locator(item)).toHaveCount(1);
    await expect(page.locator(`${item} .txt`)).toHaveText('תצוגה');
    await expect(page.locator(`${item} [data-menu-view-option]`)).toHaveText(['כרטיסים', 'אריחים']);
    await expect(page.locator(`${item} [data-menu-view-option="cards"]`)).toHaveAttribute('aria-pressed', 'true');
    await shot(page, 'home-menu-view', testInfo);
    // a pick changes the screen at once and the menu stays open; the choice is this browser's own (localStorage), as before
    await page.locator(`${item} [data-menu-view-option="tiles"]`).click();
    await expect(b.locator('[data-layout-view="tiles"]')).toBeVisible();
    await expect(page.locator('sw-app sw-user-menu [data-user-menu]')).toBeVisible();
    await expect(page.locator(`${item} [data-menu-view-option="tiles"]`)).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => localStorage.getItem('sw.devices.layout'))).toBe('tiles');
    await page.keyboard.press('Escape');
    // only on a screen that has such a choice: gone when the screen leaves, back when it returns
    await page.evaluate(() => (location.hash = '#/system/diagnostics'));
    await expect(page.locator('system-diagnostics')).toBeVisible({ timeout: 30000 });
    await page.locator(me).click();
    await expect(page.locator(item)).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.evaluate(() => (location.hash = '#/devices/building'));
    await expect(b.locator('[data-layout-view="tiles"]')).toBeVisible({ timeout: 30000 }); // the screen came back on the remembered view
    await page.locator(me).click();
    await expect(page.locator(item)).toHaveCount(1);
    await expect(page.locator(`${item} [data-menu-view-option="tiles"]`)).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    if (!phone) {
      // not offered while the layout editor is open (one view at a time)
      await page.evaluate(() => (location.hash = '#/devices/building?edit=1'));
      await expect(b.locator('home-edit-panel')).toBeVisible({ timeout: 30000 });
      await page.locator(me).click();
      await expect(page.locator(item)).toHaveCount(0);
      await page.keyboard.press('Escape');
      await b.locator('sw-button[data-layout-cancel]').click();
    }
    await page.evaluate(() => localStorage.removeItem('sw.devices.layout'));
  });

  test('phone: with the view choice in the menu the first floor starts higher above the fold, and the refresh icon sits in the title line (no empty row)', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'the phone layout');
    await seed(request);
    await resetHome(request);
    for (const view of ['cards', 'tiles'] as const) {
      await open(page, '/devices/building', view);
      const m = await page.evaluate(() => {
        const b = document.querySelector('sw-app')!.shadowRoot!.querySelector('devices-building')!.shadowRoot!;
        const y = (el: Element | null) => (el ? Math.round(el.getBoundingClientRect().top) : null);
        const first = b.querySelector('section.fcard h2, .floor-head h2');
        const refresh = b.querySelector('sw-button[data-devices-refresh]');
        const page = b.querySelector('sw-page')!.shadowRoot!;
        const kp = b.querySelector('.kpis')!.getBoundingClientRect();
        return { gap: Math.round((first?.getBoundingClientRect().top ?? 0) - kp.bottom), first: y(first), refresh: y(refresh), h1: y(page.querySelector('h1')), sub: y(page.querySelector('.sub')), header: Math.round(page.querySelector('header')!.getBoundingClientRect().height) };
      });
      testInfo.annotations.push({ type: `first-floor-y-${view}`, description: String(m.first) });
      testInfo.annotations.push({ type: `kpis-to-first-floor-`, description: String(m.gap) });
      // measured on the same 390x844 site before / after this change (the seeded 3-floor site): the first floor heading at y=508 / 465 (cards) and 497 / 454 (tiles);
      // the row that held the view choice (about 43 px with its gap) is gone, so the floors start right under the summary tiles
      expect(m.gap, `${view}: the first floor starts right under the summary tiles`).toBeLessThanOrEqual(view === 'cards' ? 40 : 30);
      expect(Math.abs(m.refresh! - m.sub!), 'the refresh icon is on the subtitle line').toBeLessThanOrEqual(30);
      expect(m.header, 'the header is the title and the subtitle only').toBeLessThanOrEqual(90);
      await expect(page.locator('devices-building [data-toolbar]')).toHaveCount(0);
      await shot(page, `home-phone-${view}`, testInfo);
    }
  });

  test('the navigation rail is large by default (the installation default is the "l" preset); nothing forces it', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop');
    await seed(request);
    await resetHome(request);
    expect((await settings(request))['ui.nav_size']).toEqual({ mode: 'rel', preset: 'l' });
    await open(page, '/devices/building');
    const vars = await page.evaluate(() => {
      const app = document.querySelector('sw-app') as HTMLElement;
      const cs = getComputedStyle(app);
      return { icon: cs.getPropertyValue('--nav-icon').trim(), item: cs.getPropertyValue('--nav-item-h').trim(), rail: (app.shadowRoot!.querySelector('nav.rail') as HTMLElement).getBoundingClientRect().width };
    });
    expect(vars.icon).toBe('25px');
    expect(vars.item).toBe('64px');
    testInfo.annotations.push({ type: 'rail-width', description: String(vars.rail) });
    // a saved choice is kept: the small preset stays small
    expect((await request.patch('/api/v1/settings', { data: { 'ui.nav_size': { mode: 'rel', preset: 's' } } })).status()).toBe(200);
    await page.reload();
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector('sw-app') as HTMLElement).getPropertyValue('--nav-icon').trim()), { timeout: 30000 }).toBe('18px');
    await request.patch('/api/v1/settings', { data: { 'ui.nav_size': { mode: 'rel', preset: 'l' } } });
  });
});
