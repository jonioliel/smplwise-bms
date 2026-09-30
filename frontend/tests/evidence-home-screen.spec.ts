import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import path from 'node:path';

// Home screen "ראשי" (חשמל והתקנים), owner notes 2026-09-30, against the devices fixture backend - the REAL backend with a
// fake Home Assistant side (tests/fixtures/devices_fake_ha.py; see its header for how to start it) - with
// SW_LIVE=1 SW_DEVICES_FIXTURE=1: the owner's site size (3 floors, 8 areas, ~110 devices, a weather entity and the Jewish
// calendar's three sensors), edit mode by address (`#/devices/building?edit=1`, no button on the screen), the editable
// title, the three optional header widgets (all off by default), the floor order (drag handle + up / down buttons), the
// quiet refresh icon, and the no-scroll fit at 1440x900 / 1920x1080. Every seeded id carries `home1_`.
// SW_SHOTS=<dir> saves screenshots there.
const SHOTS = process.env.SW_SHOTS ?? '';

const FLOORS = [
  { floor_id: 'home1_ground', name: 'קרקע', level: 0 },
  { floor_id: 'home1_first', name: 'קומה 1', level: 1 },
  { floor_id: 'home1_base', name: 'מרתף', level: -1 },
];
const AREAS = [
  { area_id: 'home1_lobby', name: 'לובי', floor_id: 'home1_ground' },
  { area_id: 'home1_kitchen', name: 'מטבח', floor_id: 'home1_ground' },
  { area_id: 'home1_living', name: 'סלון', floor_id: 'home1_ground' },
  { area_id: 'home1_office', name: 'משרד', floor_id: 'home1_first' },
  { area_id: 'home1_bed', name: 'חדר שינה הורים', floor_id: 'home1_first' },
  { area_id: 'home1_kids', name: 'חדר ילדים', floor_id: 'home1_first' },
  { area_id: 'home1_garage', name: 'חניון', floor_id: 'home1_base' },
  { area_id: 'home1_store', name: 'מחסן', floor_id: 'home1_base' },
];
const WEATHER = 'weather.home1_wx';
const PARSHA = 'sensor.home1_jewish_calendar_parshat_hashavua';
const CANDLES = 'sensor.home1_jewish_calendar_upcoming_candle_lighting';
const HAVDALAH = 'sensor.home1_jewish_calendar_upcoming_havdalah';
const HEBDATE = 'sensor.home1_jewish_calendar_date';

const ENTITIES: { entity_id: string; area_id: string | null }[] = [];
const STATES: { entity_id: string; state: string; attributes: Record<string, unknown> }[] = [];
function add(entity_id: string, area_id: string | null, state: string, attributes: Record<string, unknown>) {
  ENTITIES.push({ entity_id, area_id });
  STATES.push({ entity_id, state, attributes });
}
let n = 0;
for (const a of AREAS) {
  for (let i = 0; i < 6; i++) add(`light.home1_${++n}`, a.area_id, n % 3 === 0 ? 'on' : 'off', { friendly_name: `תאורה ${a.name} ${i + 1}`, brightness: 200 });
  for (let i = 0; i < 4; i++) add(`switch.home1_${++n}`, a.area_id, 'off', { friendly_name: `מתג ${a.name} ${i + 1}` });
  for (let i = 0; i < 2; i++) add(`cover.home1_${++n}`, a.area_id, n % 2 ? 'open' : 'closed', { friendly_name: `תריס ${a.name} ${i + 1}`, current_position: 70, device_class: 'blind' });
  add(`climate.home1_${++n}`, a.area_id, 'cool', { friendly_name: `מזגן ${a.name}`, current_temperature: 24.5, temperature: 22, hvac_action: 'cooling' });
}
add('lock.home1_front', 'home1_lobby', 'locked', { friendly_name: 'דלת כניסה', device_class: 'lock' });
add('alarm_control_panel.home1_house', 'home1_lobby', 'armed_away', { friendly_name: 'אזעקה' });
add('media_player.home1_tv', 'home1_living', 'playing', { friendly_name: 'טלוויזיה סלון' });
const FORECAST = [14, 15, 16, 17, 18, 19].map((h, i) => ({ datetime: `2026-09-30T${h}:00:00+03:00`, condition: ['sunny', 'partlycloudy', 'cloudy', 'rainy', 'rainy', 'clear-night'][i], temperature: 29 - i }));
const WEATHER_ATTRS = { friendly_name: 'מזג אוויר בית', temperature: 27.5, humidity: 61, temperature_unit: '°C', wind_speed: 14, wind_speed_unit: 'km/h', forecast: FORECAST };
add(WEATHER, null, 'partlycloudy', WEATHER_ATTRS);
add(HEBDATE, null, 'כ״ט באלול ה׳תשפ״ו', { friendly_name: 'תאריך עברי' });
add(PARSHA, null, 'בראשית', { friendly_name: 'פרשת השבוע' });
add(CANDLES, null, '2026-10-02T17:32:00+03:00', { friendly_name: 'הדלקת נרות', device_class: 'timestamp' });
add(HAVDALAH, null, '2026-10-03T18:30:00+03:00', { friendly_name: 'צאת שבת', device_class: 'timestamp' });

const HOME_KEYS = ['home.title', 'home.floor_order', 'home.clock', 'home.weather', 'home.weather_entity', 'home.jewish', 'home.jewish_parsha', 'home.jewish_candles', 'home.jewish_havdalah', 'home.clock_size', 'home.clock_seconds', 'home.weather_size', 'home.jewish_size', 'home.jewish_date'];
const HOME_DEFAULTS: Record<string, string> = { 'home.title': '', 'home.floor_order': '[]', 'home.clock': 'off', 'home.weather': 'false', 'home.weather_entity': '', 'home.jewish': 'false', 'home.jewish_parsha': '', 'home.jewish_candles': '', 'home.jewish_havdalah': '', 'home.clock_size': 'medium', 'home.clock_seconds': 'false', 'home.weather_size': 'medium', 'home.jewish_size': 'medium', 'home.jewish_date': '' };

test.describe('the home screen against the devices fixture backend', () => {
  test.skip(process.env.SW_LIVE !== '1' || process.env.SW_DEVICES_FIXTURE !== '1', 'needs tests/fixtures/devices_fake_ha.py (SW_LIVE=1 SW_DEVICES_FIXTURE=1)');

  async function seed(request: APIRequestContext) {
    expect((await request.post('/api/v1/ha/dev/registry', { data: { entities: ENTITIES, devices: [], areas: AREAS, floors: FLOORS } })).status()).toBe(200);
    for (let i = 0; i < STATES.length; i += 50) expect((await request.post('/api/v1/ha/dev/states', { data: { states: STATES.slice(i, i + 50) } })).status()).toBe(200);
  }

  async function resetHome(request: APIRequestContext) {
    expect((await request.patch('/api/v1/settings', { data: HOME_DEFAULTS })).status()).toBe(200);
  }

  async function homeSettings(request: APIRequestContext): Promise<Record<string, string>> {
    const all = (await (await request.get('/api/v1/settings')).json()).settings as Record<string, string>;
    return Object.fromEntries(HOME_KEYS.map((k) => [k, all[k]]));
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
    await page.waitForTimeout(1000);
  }

  async function bindUser(request: APIRequestContext, username: string, roleId: string): Promise<string> {
    const me = await (await request.get('/api/v1/me', { headers: { 'X-SW-Dev-User': username } })).json();
    const r = await request.post('/api/v1/access/bindings', { data: { subject_kind: 'user', subject_id: me.user.id, role_id: roleId, scope_type: 'installation', scope_id: '*' } });
    expect(r.status()).toBeLessThan(300);
    return ((await r.json()) as { id: string }).id;
  }

  async function shot(page: Page, name: string, testInfo: { project: { name: string } }) {
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}-${testInfo.project.name}.png`) });
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

  // (this file's floors only: another spec's seed may still be on a shared backend - run against a fresh one for the fit test)
  const treeOrder = (page: Page) => page.locator('devices-building nav.tree [data-tree-floor]').evaluateAll((els) => els.map((e) => e.getAttribute('data-tree-floor')).filter((id) => id!.startsWith('home1_')));

  test('by default: the settings are off, the header row is only the title and a small refresh icon (no chip, no line), and there is no edit button', async ({ page, request }, testInfo) => {
    await seed(request);
    await resetHome(request);
    expect(await homeSettings(request)).toEqual(HOME_DEFAULTS);
    await open(page, '/devices/building');
    const b = page.locator('devices-building');
    await expect(b.locator('sw-page')).toHaveAttribute('heading', 'חשמל והתקנים');
    await expect(b.locator('[data-layout-edit]')).toHaveCount(0);
    await expect(b.locator('home-widgets:visible')).toHaveCount(0);
    await expect(b.locator('home-widgets [data-home-widget]')).toHaveCount(0);
    const refresh = b.locator('sw-button[data-devices-refresh]');
    await expect(refresh).toBeVisible();
    await expect(refresh).toHaveAttribute('icononly', '');
    const box = (await refresh.boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(32);
    await expect(refresh.locator('button')).toHaveAttribute('aria-label', /רענן/);
    await expect(refresh.locator('button')).toHaveAttribute('title', /המבנה/);
    // nothing else in the header row: no "מסונכרן" chip while fine, no freshness line, no structure badge
    await expect(b.locator('[data-devices-sync], [data-devices-refreshed], [data-devices-checked], [data-structure-changed]')).toHaveCount(0);
    const headerText = (await b.locator('[slot="actions"]').innerText()).trim();
    expect(headerText).toBe('');
    await shot(page, 'home-default', testInfo);
  });

  test('summary tiles: small rectangles with the icon at the END of the text (the left in Hebrew), not above it', async ({ page, request }, testInfo) => {
    await seed(request);
    await open(page, '/devices/building');
    const kpis = page.locator('devices-building sw-kpi[data-kpi]');
    await expect(kpis.first()).toBeVisible();
    expect(await kpis.count()).toBeGreaterThanOrEqual(5);
    await expect(kpis.first()).toHaveAttribute('layout', 'compact');
    const geo = await kpis.evaluateAll((els) =>
      els.map((k) => {
        const r = k.getBoundingClientRect();
        const icon = k.shadowRoot!.querySelector('.icon')!.getBoundingClientRect();
        const txt = k.shadowRoot!.querySelector('.txt')!.getBoundingClientRect();
        return { h: r.height, iconRight: icon.right, txtLeft: txt.left, sameRow: Math.abs(icon.top + icon.height / 2 - (txt.top + txt.height / 2)) < 20 };
      }),
    );
    for (const g of geo) {
      expect(g.h).toBeLessThanOrEqual(64);
      expect(g.iconRight).toBeLessThanOrEqual(g.txtLeft + 1); // the icon is to the LEFT of the text block (RTL end side)
      expect(g.sameRow).toBe(true);
    }
    await shot(page, 'home-kpis', testInfo);
  });

  test('edit mode by address: the title is editable and saved, empty = the default; the address stays clean; "סיום עריכה" leaves without changes and "בטל" drops a draft', async ({ page, request }, testInfo) => {
    await seed(request);
    await resetHome(request);
    try {
      await open(page, '/devices/building?edit=1');
      const b = page.locator('devices-building');
      await expect(b.locator('[data-layout-bar]')).toBeVisible({ timeout: 30000 });
      await expect(b.locator('[data-home-edit]')).toBeVisible();
      await expect(b.locator('[data-layout-edit]')).toHaveCount(0);
      // the clear exit control inside edit mode
      const exit = b.locator('sw-button[data-layout-cancel]');
      await expect(exit).toHaveText('סיום עריכה');
      await shot(page, 'home-edit', testInfo);
      // a draft: live heading, "בטל" (the label changes with the draft), and dropping it changes nothing
      const title = b.locator('[data-home-title]');
      await expect(title).toHaveAttribute('placeholder', 'חשמל והתקנים');
      await title.fill('הבית של רון');
      await expect(b.locator('sw-page')).toHaveAttribute('heading', 'הבית של רון');
      await expect(exit).toHaveText('בטל');
      await exit.click();
      await expect(b.locator('[data-layout-bar]')).toHaveCount(0);
      await expect(b.locator('sw-page')).toHaveAttribute('heading', 'חשמל והתקנים');
      await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/devices/building');
      expect((await homeSettings(request))['home.title']).toBe('');
      // saving it stores it as the installation's setting (audited by the server) and does not pin the automatic layout
      await page.evaluate(() => (location.hash = '#/devices/building?edit=1'));
      await expect(b.locator('[data-home-edit]')).toBeVisible();
      await expect(b.locator('sw-button[data-layout-save]')).toHaveAttribute('disabled', ''); // nothing changed yet
      await b.locator('[data-home-title]').fill('  הבית של רון  ');
      await b.locator('sw-button[data-layout-save]').click();
      await expect(b.locator('[data-layout-bar]')).toHaveCount(0, { timeout: 15000 });
      await expect(b.locator('sw-page')).toHaveAttribute('heading', 'הבית של רון');
      await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/devices/building');
      expect((await homeSettings(request))['home.title']).toBe('הבית של רון');
      const layout = await (await request.get('/api/v1/devices/layouts/building/main')).json();
      expect(layout.desktop, 'a title change does not store the measured layout').toBeNull();
      // it survives a reload, for another user too
      await page.reload();
      await expect(b.locator('sw-page')).toHaveAttribute('heading', 'הבית של רון', { timeout: 30000 });
      // empty again = the default
      await page.evaluate(() => (location.hash = '#/devices/building?edit=1'));
      await b.locator('[data-home-title]').fill('');
      await b.locator('sw-button[data-layout-save]').click();
      await expect(b.locator('[data-layout-bar]')).toHaveCount(0, { timeout: 15000 });
      await expect(b.locator('sw-page')).toHaveAttribute('heading', 'חשמל והתקנים');
      // the address alone re-enters edit mode after it ended (the user menu item on the screen the user is already on)
      await page.evaluate(() => (location.hash = '#/devices/building?edit=1'));
      await expect(b.locator('[data-layout-bar]')).toBeVisible();
    } finally {
      await resetHome(request);
    }
  });

  test('a viewer never gets edit mode - not from the address either - and the server refuses their writes; they do see the widgets an administrator switched on', async ({ browser, request }, testInfo) => {
    await seed(request);
    await resetHome(request);
    const user = `home1viewer${testInfo.project.name}`;
    const bindings: string[] = [];
    try {
      expect((await request.patch('/api/v1/settings', { data: { 'home.clock': 'time', 'home.weather': 'true', 'home.weather_entity': WEATHER } })).status()).toBe(200);
      bindings.push(await bindUser(request, user, 'viewer'));
      const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-SW-Dev-User': user } });
      const p = await ctx.newPage();
      await open(p, '/devices/building?edit=1');
      await expect(p.locator('devices-building sw-kpi').first()).toBeVisible({ timeout: 30000 });
      await expect(p.locator('devices-building [data-layout-bar], devices-building [data-home-edit], devices-building [data-layout-edit]')).toHaveCount(0);
      await expect.poll(() => p.evaluate(() => location.hash)).toBe('#/devices/building');
      await expect(p.locator('devices-building home-widgets [data-home-widget="clock"]')).toBeVisible();
      await expect(p.locator('devices-building home-widgets [data-home-widget="weather"]')).toContainText('מעונן חלקית');
      expect((await p.request.patch('/api/v1/settings', { data: { 'home.title': 'x' } })).status()).toBe(403);
      expect((await p.request.patch('/api/v1/settings', { data: { 'home.floor_order': '["home1_base"]' } })).status()).toBe(403);
      expect((await p.request.get('/api/v1/devices/home-candidates')).status()).toBe(403);
      await ctx.close();
    } finally {
      for (const id of bindings) await request.delete(`/api/v1/access/bindings/${id}`).catch(() => {});
      await resetHome(request);
    }
  });

  test('widgets: a clock, the weather of a weather.* entity and the Jewish-calendar times - each switched on in edit mode, saved, shown only when configured; all off by default', async ({ page, request }, testInfo) => {
    await seed(request);
    await resetHome(request);
    try {
      await open(page, '/devices/building?edit=1');
      const b = page.locator('devices-building');
      await expect(b.locator('[data-home-edit]')).toBeVisible({ timeout: 30000 });
      // all off: the draft shows nothing in the header
      await expect(b.locator('home-widgets [data-home-widget]')).toHaveCount(0);
      await expect(b.locator('[data-home-clock="off"]')).toHaveAttribute('aria-pressed', 'true');
      await expect(b.locator('input[data-home-weather]')).not.toBeChecked();
      await expect(b.locator('input[data-home-jewish]')).not.toBeChecked();
      // the candidates come from the platform's mirrored entity list: weather.* and sensor.* (the Jewish calendar first)
      const weatherSel = b.locator('select[data-home-weather-entity]');
      await expect(weatherSel).toBeDisabled();
      await b.locator('input[data-home-weather]').check();
      await expect(weatherSel).toBeEnabled();
      await expect(weatherSel.locator(`option[value="${WEATHER}"]`)).toHaveCount(1, { timeout: 15000 });
      // switched on but no entity chosen: still nothing shown, no room taken
      await expect(b.locator('home-widgets:visible')).toHaveCount(0);
      await weatherSel.selectOption(WEATHER);
      await b.locator('[data-home-clock="datetime"]').click();
      await b.locator('input[data-home-jewish]').check();
      const parsha = b.locator('select[data-home-jewish="parsha"]');
      await expect(parsha.locator(`option[value="${PARSHA}"]`)).toHaveCount(1);
      await parsha.selectOption(PARSHA);
      await b.locator('select[data-home-jewish="candles"]').selectOption(CANDLES);
      await b.locator('select[data-home-jewish="havdalah"]').selectOption(HAVDALAH);
      // the draft previews in the header before it is saved
      const w = b.locator('home-widgets');
      await expect(w.locator('[data-home-widget="clock"]')).toBeVisible();
      await expect(w.locator('[data-home-widget="weather"]')).toContainText('מעונן חלקית');
      expect((await homeSettings(request))['home.clock']).toBe('off'); // not saved yet
      await b.locator('sw-button[data-layout-save]').click();
      await expect(b.locator('[data-layout-bar]')).toHaveCount(0, { timeout: 15000 });
      expect(await homeSettings(request)).toEqual({
        ...HOME_DEFAULTS,
        'home.clock': 'datetime',
        'home.weather': 'true',
        'home.weather_entity': WEATHER,
        'home.jewish': 'true',
        'home.jewish_parsha': PARSHA,
        'home.jewish_candles': CANDLES,
        'home.jewish_havdalah': HAVDALAH,
      });
      await page.reload();
      await expect(w.locator('[data-home-widget="clock"]')).toBeVisible({ timeout: 30000 });
      await expect(w.locator('[data-home-widget="clock"]')).toContainText(/\d{2}:\d{2}/);
      await expect(w.locator('[data-home-widget="clock"]')).toContainText(/\d+ ב/); // the date (a medium card: "30 בספטמבר")
      const wx = w.locator('[data-home-widget="weather"]');
      await expect(wx).toContainText('מעונן חלקית');
      await expect(wx).toContainText('28'); // 27.5 rounded, in the entity's own unit
      await expect(wx).toContainText('61%');
      await expect(w.locator('[data-home-widget="parsha"]')).toContainText('פרשת בראשית');
      await expect(w.locator('[data-home-widget="candles"]')).toContainText('17:32'); // the sensor's timestamp in the site's zone
      await expect(w.locator('[data-home-widget="havdalah"]')).toContainText('18:30');
      // read-only: no control in any of them
      await expect(w.locator('button, a, input, select, sw-button')).toHaveCount(0);
      await shot(page, 'home-widgets', testInfo);
      // a state change of the weather entity reaches the open screen (the same push the tree follows)
      await request.post('/api/v1/ha/dev/states', { data: { states: [{ entity_id: WEATHER, state: 'rainy', attributes: { friendly_name: 'מזג אוויר בית', temperature: 19.2, humidity: 80, temperature_unit: '°C' } }] } });
      await expect(wx).toContainText('גשם', { timeout: 15000 });
      await expect(wx).toContainText('19');
      // an unavailable entity: that widget disappears, the others stay
      await request.post('/api/v1/ha/dev/states', { data: { states: [{ entity_id: WEATHER, state: 'unavailable', attributes: { friendly_name: 'מזג אוויר בית' } }] } });
      await expect(wx).toHaveCount(0, { timeout: 15000 });
      await expect(w.locator('[data-home-widget="parsha"]')).toBeVisible();
      // and off again: nothing, no room
      await resetHome(request);
      await page.reload();
      await expect(b.locator('sw-kpi').first()).toBeVisible({ timeout: 30000 });
      await expect(b.locator('home-widgets:visible')).toHaveCount(0);
    } finally {
      await request.post('/api/v1/ha/dev/states', { data: { states: [{ entity_id: WEATHER, state: 'partlycloudy', attributes: { friendly_name: 'מזג אוויר בית', temperature: 27.5, humidity: 61, temperature_unit: '°C' } }] } });
      await resetHome(request);
    }
  });

  test('widget sizes: a small chip, or a medium / large glass card beside the summary tiles - chosen per widget in edit mode, saved, fitting the viewport; the phone scrolls the cards sideways', async ({ page, request }, testInfo) => {
    test.setTimeout(120_000);
    await seed(request);
    await resetHome(request);
    const all = { 'home.clock': 'datetime', 'home.clock_seconds': 'true', 'home.weather': 'true', 'home.weather_entity': WEATHER, 'home.jewish': 'true', 'home.jewish_parsha': PARSHA, 'home.jewish_candles': CANDLES, 'home.jewish_havdalah': HAVDALAH, 'home.jewish_date': HEBDATE };
    const phone = testInfo.project.name === 'mobile';
    const numbers: Record<string, unknown> = {};
    try {
      expect((await request.patch('/api/v1/settings', { data: all })).status()).toBe(200);
      // newly enabled widgets are medium cards (the default), not chips
      await open(page, '/devices/building', 'tiles');
      const b = page.locator('devices-building');
      const cards = b.locator('home-widgets[data-mode="cards"] .card');
      await expect(cards).toHaveCount(3, { timeout: 30000 });
      for (const c of await cards.all()) await expect(c).toHaveAttribute('data-size', 'medium');
      await expect(b.locator('home-widgets[data-mode="chips"] [data-home-widget]')).toHaveCount(0);
      await expect(b.locator('home-widgets[data-mode="cards"] [data-home-widget="clock"]')).toContainText('בספטמבר');
      await expect(b.locator('home-widgets[data-mode="cards"] [data-home-hebrew-date]')).toContainText('תשפ');
      await expect(b.locator('home-widgets[data-mode="cards"] [data-home-widget="parsha"]')).toContainText('פרשת בראשית');
      await expect(b.locator('home-widgets[data-mode="cards"] [data-home-widget="candles"]')).toContainText('17:32');
      await expect(b.locator('home-widgets[data-mode="cards"] [data-home-widget="havdalah"]')).toContainText('18:30');
      // medium weather: big temperature, condition, humidity and wind (no forecast row)
      const wx = b.locator('home-widgets[data-mode="cards"] .card.weather');
      await expect(wx).toContainText('28');
      await expect(wx).toContainText('מעונן חלקית');
      await expect(wx).toContainText('61%');
      await expect(wx).toContainText('14');
      await expect(wx.locator('[data-home-forecast]')).toHaveCount(0);
      // seconds tick while a card shows them
      const sec1 = await b.locator('.card.clock .digits small').innerText();
      await expect.poll(() => b.locator('.card.clock .digits small').innerText(), { timeout: 5000 }).not.toBe(sec1);
      const measure = () =>
        page.evaluate(() => {
          const b = document.querySelector('sw-app')!.shadowRoot!.querySelector('devices-building')!;
          const r = (el: Element | null) => (el ? el.getBoundingClientRect() : null);
          const cardEls = [...b.shadowRoot!.querySelectorAll('home-widgets[data-mode="cards"]')].flatMap((h) => [...h.shadowRoot!.querySelectorAll('.card')]);
          const kpis = [...b.shadowRoot!.querySelectorAll('sw-kpi[data-kpi]')];
          const top = r(b.shadowRoot!.querySelector('.top'));
          return {
            cardH: cardEls.map((c) => Math.round(r(c)!.height)),
            cardW: cardEls.map((c) => Math.round(r(c)!.width)),
            kpiH: kpis.map((k) => Math.round(r(k)!.height)),
            kpiW: Math.min(...kpis.map((k) => Math.round(r(k)!.width))),
            topH: Math.round(top?.height ?? 0),
            fit: b.shadowRoot!.querySelector('.split')?.getAttribute('data-fit'),
          };
        });
      if (!phone) {
        for (const [w, h] of [[1440, 900], [1920, 1080]]) {
          await page.setViewportSize({ width: w, height: h });
          await open(page, '/devices/building', 'tiles');
          await expect(cards).toHaveCount(3, { timeout: 30000 });
          await page.waitForTimeout(700);
          const m = await measure();
          numbers[`medium ${w}x${h}`] = m;
          expect(await scrolls(page), `medium ${w}x${h}`).toEqual([]);
          expect(m.kpiW, 'the summary tiles are not squeezed').toBeGreaterThanOrEqual(130);
          expect(Math.max(...m.cardH) - Math.min(...m.cardH), 'the cards of a row are equally tall').toBeLessThanOrEqual(2);
          await shot(page, `home-cards-medium-${w}`, testInfo);
        }
      }
      // edit mode: a size per widget - large weather gets the forecast row, small ones become chips in the header
      await open(page, '/devices/building?edit=1', 'tiles');
      await expect(b.locator('[data-home-edit]')).toBeVisible({ timeout: 30000 });
      await expect(b.locator('[data-home-size="weather:medium"]')).toHaveAttribute('aria-pressed', 'true');
      await b.locator('[data-home-size="weather:large"]').click();
      await b.locator('[data-home-size="clock:large"]').click();
      await b.locator('[data-home-size="jewish:chip"]').click();
      await expect(b.locator('home-widgets[data-mode="cards"] .card.weather[data-size="large"] [data-home-forecast] .fc')).toHaveCount(5);
      await expect(b.locator('home-widgets[data-mode="cards"] .card.clock[data-size="large"]')).toBeVisible();
      await expect(b.locator('home-widgets[data-mode="chips"] [data-home-widget="parsha"]')).toBeVisible(); // a chip in the header row
      await expect(b.locator('home-widgets[data-mode="cards"] .card.jewish')).toHaveCount(0);
      expect((await homeSettings(request))['home.weather_size']).toBe('medium'); // not saved yet
      await b.locator('sw-button[data-layout-save]').click();
      await expect(b.locator('[data-layout-bar]')).toHaveCount(0, { timeout: 15000 });
      const saved = await homeSettings(request);
      expect([saved['home.weather_size'], saved['home.clock_size'], saved['home.jewish_size']]).toEqual(['large', 'large', 'chip']);
      // large: every widget a big card; the page still fits
      expect((await request.patch('/api/v1/settings', { data: { 'home.jewish_size': 'large' } })).status()).toBe(200);
      const sizes = phone ? [[390, 844]] : [[1440, 900], [1920, 1080]];
      for (const [w, h] of sizes) {
        await page.setViewportSize({ width: w, height: h });
        await open(page, '/devices/building', 'tiles');
        await expect(cards).toHaveCount(3, { timeout: 30000 });
        await expect(b.locator('.card.weather [data-home-forecast] .fc')).toHaveCount(5);
        await expect(b.locator('.card.weather')).toContainText('קמ״ש');
        await page.waitForTimeout(700);
        const m = await measure();
        numbers[`large ${w}x${h}`] = m;
        if (!phone) {
          expect(await scrolls(page), `large ${w}x${h}`).toEqual([]);
          expect(m.kpiW).toBeGreaterThanOrEqual(130);
        } else {
          // a phone: one row of cards that scrolls sideways and snaps; the page itself has no horizontal overflow
          const row = await b.locator('home-widgets[data-mode="cards"]').evaluate((h) => ({ sw: h.scrollWidth, cw: h.clientWidth, snap: getComputedStyle(h).scrollSnapType }));
          expect(row.sw).toBeGreaterThan(row.cw);
          expect(row.snap).toContain('x');
          expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
        }
        await shot(page, `home-cards-large-${w}`, testInfo);
      }
      // unavailable / unconfigured: no card, no room
      await resetHome(request);
      await open(page, '/devices/building', 'tiles');
      await expect(b.locator('sw-kpi').first()).toBeVisible({ timeout: 30000 });
      await expect(b.locator('home-widgets:visible')).toHaveCount(0);
      testInfo.annotations.push({ type: 'layout-numbers', description: JSON.stringify(numbers) });
    } finally {
      await resetHome(request);
    }
  });

  test('floor order: up / down buttons and a drag handle in edit mode; the tree, the cards and the tiles follow, saved per installation, the rest in level order, new floors append', async ({ page, request }, testInfo) => {
    test.setTimeout(120_000);
    await seed(request);
    await resetHome(request);
    try {
      // default: level order (the basement first)
      await open(page, '/devices/building?edit=1');
      const b = page.locator('devices-building');
      await expect(b.locator('[data-home-floors]')).toBeVisible({ timeout: 30000 });
      const listed = () => b.locator('[data-home-floors] [data-home-floor]').evaluateAll((els) => els.map((e) => e.getAttribute('data-home-floor')).filter((id) => id!.startsWith('home1_')));
      expect(await listed()).toEqual(['home1_base', 'home1_ground', 'home1_first']);
      expect(await treeOrder(page)).toEqual(['home1_base', 'home1_ground', 'home1_first']);
      // ground floor first: up on "קרקע" (a keyboard-reachable button with its own name)
      const up = b.locator('[data-home-floor-up="home1_ground"]');
      await expect(up).toHaveAttribute('aria-label', 'העבר את קרקע למעלה');
      await up.focus();
      await page.keyboard.press('Enter');
      expect(await listed()).toEqual(['home1_ground', 'home1_base', 'home1_first']);
      expect(await treeOrder(page), 'the tree previews the draft').toEqual(['home1_ground', 'home1_base', 'home1_first']);
      await expect(b.locator('[data-home-floor-up="home1_ground"]')).toBeDisabled(); // first: no further up
      await expect(b.locator('[data-home-floor-down="home1_ground"]')).toBeFocused(); // focus stays with the keyboard user
      // then the basement to the end with the drag handle (drag and drop on the last row)
      await b.locator('[data-home-floor="home1_base"]').dragTo(b.locator('[data-home-floor="home1_first"]'));
      expect(await listed()).toEqual(['home1_ground', 'home1_first', 'home1_base']);
      await shot(page, 'home-floor-order', testInfo);
      expect(JSON.parse((await homeSettings(request))['home.floor_order'])).toEqual([]); // not saved yet
      await b.locator('sw-button[data-layout-save]').click();
      await expect(b.locator('[data-layout-bar]')).toHaveCount(0, { timeout: 15000 });
      expect(JSON.parse((await homeSettings(request))['home.floor_order'])).toEqual(['home1_ground', 'home1_first', 'home1_base']);
      const tree = await (await request.get('/api/v1/devices/tree')).json();
      expect((tree.floors as { floor_id: string }[]).map((f) => f.floor_id).filter((id) => id.startsWith('home1_'))).toEqual(['home1_ground', 'home1_first', 'home1_base']);
      // the cards view, the tiles view and the tree all follow after a reload
      await page.reload();
      await expect(b.locator('section[data-floor-card]').first()).toBeVisible({ timeout: 30000 });
      expect(await treeOrder(page)).toEqual(['home1_ground', 'home1_first', 'home1_base']);
      const cards = await b.locator('section[data-floor-card]').evaluateAll((els) => els.map((e) => e.getAttribute('data-floor-card')).filter((id) => id !== 'unassigned'));
      expect(cards.filter((id) => id!.startsWith('home1_'))).toEqual(['home1_ground', 'home1_first', 'home1_base']);
      await b.locator('button[data-layout="tiles"]').click();
      const sections = await b.locator('.floors section.floor[data-floor]').evaluateAll((els) => els.map((e) => e.getAttribute('data-floor')).filter((id) => id !== 'unassigned'));
      expect(sections.filter((id) => id!.startsWith('home1_'))).toEqual(['home1_ground', 'home1_first', 'home1_base']);
      // the floor panel groups follow it too
      const items = await (await request.get('/api/v1/devices/items?kind=lights')).json();
      expect((items.floors as { floor_id: string }[]).map((f) => f.floor_id).filter((id) => id.startsWith('home1_'))).toEqual(['home1_ground', 'home1_first', 'home1_base']);
      // a floor that is not in the list follows in level order; a stale id is ignored
      expect((await request.patch('/api/v1/settings', { data: { 'home.floor_order': JSON.stringify(['gone', 'home1_first']) } })).status()).toBe(200);
      const t2 = await (await request.get('/api/v1/devices/tree')).json();
      expect((t2.floors as { floor_id: string }[]).map((f) => f.floor_id).filter((id) => id.startsWith('home1_'))).toEqual(['home1_first', 'home1_base', 'home1_ground']);
    } finally {
      await resetHome(request);
    }
  });

  test('"אריחים" shows the floors tree too and the whole screen fits the viewport without a vertical scroll at 1440x900 and 1920x1080 (3 floors, 8 areas, ~110 devices); the cards view too', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop sizes');
    test.setTimeout(120_000);
    await seed(request);
    await resetHome(request);
    for (const [w, h] of [[1440, 900], [1920, 1080]]) {
      for (const layout of ['tiles', 'cards'] as const) {
        await page.setViewportSize({ width: w, height: h });
        await open(page, '/devices/building', layout);
        const b = page.locator('devices-building');
        await expect(b.locator(`.split[data-layout-view="${layout}"] nav.tree`)).toBeVisible({ timeout: 30000 });
        await expect(b.locator('a.tile[data-area="home1_lobby"], section[data-floor-card="home1_ground"]').first()).toBeVisible();
        await page.waitForTimeout(600); // the packing settles (a few frames)
        expect(await scrolls(page), `${layout} ${w}x${h}`).toEqual([]);
        if (layout === 'tiles') {
          // all eight area tiles are drawn, in packed floor sections (no one-row-per-floor with empty space beside it)
          await expect(b.locator('a.tile[data-area^="home1_"]')).toHaveCount(8);
          const rows = await b.locator('.floors section.floor[data-floor^="home1_"]').evaluateAll((els) => new Set(els.map((e) => Math.round(e.getBoundingClientRect().top))).size);
          expect(rows).toBeLessThanOrEqual(2);
        }
        await shot(page, `home-${layout}-${w}`, testInfo);
      }
    }
  });

  test('phone: the tiles view and the edit mode scroll, with no horizontal overflow and no tree', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'the phone layout');
    await seed(request);
    await resetHome(request);
    await open(page, '/devices/building', 'tiles');
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await expect(page.locator('devices-building a.tile[data-area="home1_lobby"]')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('devices-building nav.tree')).toBeHidden();
    expect(await overflow()).toBeLessThanOrEqual(0);
    await shot(page, 'home-tiles', testInfo);
    await open(page, '/devices/building?edit=1', 'tiles');
    await expect(page.locator('devices-building [data-home-edit]')).toBeVisible({ timeout: 30000 });
    expect(await overflow()).toBeLessThanOrEqual(0);
    await shot(page, 'home-edit', testInfo);
  });
});
