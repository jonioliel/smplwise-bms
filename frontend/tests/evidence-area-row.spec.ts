import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import path from 'node:path';

// What the home screen shows next to an area's name (release 0.1.149, owner 2026-09-30: the big installation's home screen was
// crowded). Two parts:
// - demo data (no backend): the per-A/C chip lists are gone, an area with an A/C carries one indicator, one line per row,
//   nothing overflows sideways on a phone;
// - the devices fixture backend (the REAL backend with a fake Home Assistant side, tests/fixtures/devices_fake_ha.py; run with
//   SW_LIVE=1 SW_DEVICES_FIXTURE=1): the owner's kind of site (2 floors, 8 areas, several A/C per area), the installation's list
//   and its editor in הגדרות › חשמל והתקנים, the "+N" collapse on a phone, the floor header's list, and the personal override
//   of a holder of screen.personalize (החשבון שלי › המסך שלי). Every seeded id carries `arow1_`.
// SW_SHOTS=<dir> saves screenshots there (docs/evidence/0.1.149-area-row).
const SHOTS = process.env.SW_SHOTS ?? '';
const WIDTH: Record<string, number> = { desktop: 1440, tablet: 1024, mobile: 390 };
type Info = { project: { name: string } };

async function shot(page: Page, name: string, info: Info) {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}-${WIDTH[info.project.name] ?? info.project.name}.png`) });
}

/** The page never scrolls sideways (a row that wrapped or overflowed would). */
async function noSidewaysScroll(page: Page) {
  const over = await page.evaluate(() => {
    const out: string[] = [];
    const walk = (root: Document | ShadowRoot) => {
      for (const el of Array.from(root.querySelectorAll('*'))) {
        if (el.scrollWidth > el.clientWidth + 1 && ['visible'].includes(getComputedStyle(el).overflowX) && el.clientWidth > 0 && (el as HTMLElement).offsetWidth > 0 && el.tagName !== 'HTML' && el.tagName !== 'BODY') {
          const r = el.getBoundingClientRect();
          if (r.right > window.innerWidth + 1 || r.left < -1) out.push(`${el.tagName.toLowerCase()} ${Math.round(r.left)}..${Math.round(r.right)}`);
        }
        if (el.shadowRoot) walk(el.shadowRoot);
      }
    };
    walk(document);
    return out;
  });
  return over;
}

test.describe('the area row against demo data', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo data: run the preview with SW_API_PORT pointing at a port nothing listens on');

  test('no per-A/C chip lists; an area with an A/C has one indicator; each row is a single line', async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('sw.devices.layout', 'cards');
      } catch {
        /* storage unavailable */
      }
    });
    await page.goto('/?design=a#/devices/building');
    const b = page.locator('devices-building');
    await expect(b.locator('section[data-floor-card]').first()).toBeVisible({ timeout: 30000 });
    await expect(b.locator('[data-climate-strip]')).toHaveCount(0);
    await expect(b.getByText('מזגני הקומה')).toHaveCount(0);
    await expect(b.getByText('מזגנים בבניין')).toHaveCount(0);
    // the lobby has one cooling A/C: the snowflake with its temperature; nothing else climate-shaped on the row
    const lobby = b.locator('a.arow[data-area-row="lobby"]');
    const ind = lobby.locator('[data-ind="climate"]');
    await expect(ind).toHaveCount(1);
    await expect(ind).toContainText('24.5°');
    await expect(ind.locator('sw-icon')).toHaveAttribute('name', 'snow');
    // the office has two A/C, one heating: still ONE indicator (a flame, with the number working)
    const office = b.locator('a.arow[data-area-row="office"]');
    await expect(office.locator('[data-ind="climate"]')).toHaveCount(1);
    await expect(office.locator('[data-ind="climate"] sw-icon')).toHaveAttribute('name', 'flame');
    // an area without an A/C has none, and a zero counter is not drawn
    await expect(b.locator('a.arow[data-area-row="kitchen"]').locator('[data-ind="climate"]')).toHaveCount(0);
    await expect(b.locator('a.arow[data-area-row="kitchen"]').locator('[data-ind="switches"]')).toHaveCount(0);
    // one line per row: every row is a single-line height
    const heights = await b.locator('a.arow').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
    expect(heights.length).toBeGreaterThan(2);
    expect(Math.max(...heights)).toBeLessThan(Math.min(...heights) * 1.4) // a wrapped row would be twice as tall;
    expect(await noSidewaysScroll(page)).toEqual([]);
    await shot(page, 'demo-home', testInfo);
  });
});

// ------------------------------------------------------------------------------------------------ the fixture backend

const FLOORS = [
  { floor_id: 'arow1_ground', name: 'קרקע', level: 0 },
  { floor_id: 'arow1_first', name: 'קומה 1', level: 1 },
];
const AREAS = [
  { area_id: 'arow1_living', name: 'סלון', floor_id: 'arow1_ground' },
  { area_id: 'arow1_kitchen', name: 'מטבח', floor_id: 'arow1_ground' },
  { area_id: 'arow1_entry', name: 'כניסה', floor_id: 'arow1_ground' },
  { area_id: 'arow1_dining', name: 'פינת אוכל', floor_id: 'arow1_ground' },
  { area_id: 'arow1_yard', name: 'חצר', floor_id: 'arow1_ground' },
  { area_id: 'arow1_work', name: 'חדר עבודה', floor_id: 'arow1_first' },
  { area_id: 'arow1_bed', name: 'חדר שינה', floor_id: 'arow1_first' },
  { area_id: 'arow1_stairs', name: 'מדרגות', floor_id: 'arow1_first' },
];
const ENTITIES: { entity_id: string; area_id: string | null }[] = [];
const STATES: { entity_id: string; state: string; attributes: Record<string, unknown> }[] = [];
let n = 0;
function add(prefix: string, area: string, state: string, attributes: Record<string, unknown>) {
  const entity_id = `${prefix}.arow1_${++n}`;
  ENTITIES.push({ entity_id, area_id: area });
  STATES.push({ entity_id, state, attributes });
}
const lights = (area: string, total: number, on: number) => Array.from({ length: total }, (_, i) => add('light', area, i < on ? 'on' : 'off', { friendly_name: `תאורה ${i + 1}`, brightness: 200 }));
const switches = (area: string, total: number, on: number) => Array.from({ length: total }, (_, i) => add('switch', area, i < on ? 'on' : 'off', { friendly_name: `מתג ${i + 1}` }));
const cover = (area: string, state: string) => add('cover', area, state, { friendly_name: 'תריס', current_position: 70, device_class: 'blind' });
const ac = (area: string, mode: string, cur: number | null, action = 'cooling') => add('climate', area, mode, { friendly_name: 'מזגן', ...(cur === null ? {} : { current_temperature: cur }), temperature: 22, hvac_action: action });
const temp = (area: string, v: string) => add('sensor', area, v, { friendly_name: 'טמפרטורה', unit_of_measurement: '°C', device_class: 'temperature' });

// living: three A/C (two cooling, one off), lit lights, TV playing; kitchen: one heating A/C, a switch on, a window open;
// entry: no A/C, a lock open; dining: one A/C off; yard: nothing climate; work: A/C cooling without a temperature; bed: A/C fan; stairs: only lights
lights('arow1_living', 6, 3); switches('arow1_living', 4, 2); cover('arow1_living', 'open'); cover('arow1_living', 'closed');
ac('arow1_living', 'cool', 24.5); ac('arow1_living', 'cool', 25.5); ac('arow1_living', 'off', 28, 'off'); temp('arow1_living', '24.8');
add('media_player', 'arow1_living', 'playing', { friendly_name: 'טלוויזיה' });
lights('arow1_kitchen', 17, 4); switches('arow1_kitchen', 2, 1); ac('arow1_kitchen', 'heat', 19, 'heating'); temp('arow1_kitchen', '20.1');
add('binary_sensor', 'arow1_kitchen', 'on', { friendly_name: 'חלון', device_class: 'window' });
lights('arow1_entry', 2, 0); add('lock', 'arow1_entry', 'unlocked', { friendly_name: 'דלת כניסה', device_class: 'lock' });
lights('arow1_dining', 3, 0); ac('arow1_dining', 'off', 26, 'off');
lights('arow1_yard', 13, 13); switches('arow1_yard', 1, 0);
lights('arow1_work', 3, 1); ac('arow1_work', 'cool', null); add('media_player', 'arow1_work', 'playing', { friendly_name: 'מסך' });
lights('arow1_bed', 2, 2); ac('arow1_bed', 'fan_only', 23, 'fan'); temp('arow1_bed', '23.0');
lights('arow1_stairs', 6, 0);

const DEFAULT_ROWS = {
  'devices.area_row': { items: ['climate', 'lights', 'switches', 'media'], climate: 'temp', show_empty: false },
  'devices.floor_row': { items: ['lights', 'switches', 'covers', 'climate', 'media', 'locks', 'sensors'] },
};

test.describe('the area row against the devices fixture backend', () => {
  test.skip(process.env.SW_LIVE !== '1' || process.env.SW_DEVICES_FIXTURE !== '1', 'needs tests/fixtures/devices_fake_ha.py (SW_LIVE=1 SW_DEVICES_FIXTURE=1)');

  async function seed(request: APIRequestContext) {
    expect((await request.post('/api/v1/ha/dev/registry', { data: { entities: ENTITIES, devices: [], areas: AREAS, floors: FLOORS } })).status()).toBe(200);
    for (let i = 0; i < STATES.length; i += 50) expect((await request.post('/api/v1/ha/dev/states', { data: { states: STATES.slice(i, i + 50) } })).status()).toBe(200);
  }
  async function reset(request: APIRequestContext) {
    expect((await request.patch('/api/v1/settings', { data: DEFAULT_ROWS })).status()).toBe(200);
    await request.put('/api/v1/me/prefs', { data: { 'devices.area_row': null } });
  }
  async function open(page: Page, hash: string) {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('sw.devices.layout', 'cards');
        localStorage.removeItem('sw.tiles.override');
      } catch {
        /* storage unavailable */
      }
    });
    await page.goto('about:blank');
    await page.goto(`/?design=a#${hash}`);
    await page.waitForSelector('devices-building');
    await page.waitForSelector('devices-building sw-kpi', { timeout: 30000 });
    await page.waitForTimeout(1200);
  }
  const row = (page: Page, area: string) => page.locator('devices-building a.arow[data-area-row="arow1_' + area + '"]');
  const ids = (page: Page, area: string) => row(page, area).locator('[data-ind]:not([data-ind-more])').evaluateAll((els) => els.map((e) => e.getAttribute('data-ind')));

  test('by default: a short row per area - the A/C with its temperature, what is lit - on one line, no A/C lists anywhere', async ({ page, request }, testInfo) => {
    await seed(request);
    await reset(request);
    try {
      await open(page, '/devices/building');
      const b = page.locator('devices-building');
      await expect(b.locator('[data-climate-strip]')).toHaveCount(0);
      await expect(b.getByText('מזגני הקומה')).toHaveCount(0);
      await expect(b.getByText('מזגנים בבניין')).toHaveCount(0);
      // living: three A/C = ONE indicator, cooling (two of them on, the mean of their temperatures), plus lights and the TV
      const living = row(page, 'living');
      await expect(living.locator('[data-ind="climate"]')).toHaveCount(1);
      await expect(living.locator('[data-ind="climate"]')).toContainText('25° (2)');
      await expect(living.locator('[data-ind="climate"] sw-icon')).toHaveAttribute('name', 'snow');
      // (a phone shows three, the fourth collapses into "+1")
      const mobile = testInfo.project.name === 'mobile';
      expect(await ids(page, 'living')).toEqual(['climate', 'lights', 'switches', 'media'].slice(0, mobile ? 3 : 4));
      if (mobile) await expect(row(page, 'living').locator('[data-ind-more]')).toHaveText(/\+1$/);
      // kitchen: heating
      await expect(row(page, 'kitchen').locator('[data-ind="climate"] sw-icon')).toHaveAttribute('name', 'flame');
      // dining: the A/C is off - dimmed, still an indicator
      await expect(row(page, 'dining').locator('[data-ind="climate"]')).toHaveClass(/dim/);
      // work: an A/C that reports no temperature: the icon alone, never a dash
      await expect(row(page, 'work').locator('[data-ind="climate"]')).toBeVisible();
      await expect(row(page, 'work').locator('[data-ind="climate"]')).not.toContainText('—');
      await expect(row(page, 'work').locator('[data-ind="climate"] sw-icon')).toHaveAttribute('name', 'snow');
      // a zero counter is not drawn (entry has lights, none on); a room with nothing to say has an empty row, not a wrapped one
      expect(await ids(page, 'entry')).toEqual([]);
      expect(await ids(page, 'stairs')).toEqual([]);
      // one line per row at every width
      const heights = await b.locator('a.arow').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
      expect(heights.length).toBeGreaterThanOrEqual(8); // the 8 areas (and the unassigned bucket)
      expect(Math.max(...heights)).toBeLessThan(Math.min(...heights) * 1.4) // a wrapped row would be twice as tall;
      expect(await noSidewaysScroll(page)).toEqual([]);
      await shot(page, 'home-default', testInfo);
    } finally {
      await reset(request);
    }
  });

  test('the installation\'s list is editable: order, room temperature, empty counters, the A/C text; the row follows', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name === 'tablet', 'desktop and phone');
    await seed(request);
    await reset(request);
    try {
      expect((await request.patch('/api/v1/settings', { data: { 'devices.area_row': { items: ['temperature', 'climate', 'openings', 'locks', 'lights', 'covers', 'media', 'switches', 'alarm'], climate: 'mode', show_empty: true } } })).status()).toBe(200);
      await open(page, '/devices/building');
      const mobile = testInfo.project.name === 'mobile';
      const max = mobile ? 3 : 6;
      // living: every item that has something to say, in the list's order; past the line's room: "+N"
      const got = await ids(page, 'living');
      expect(got).toEqual(['temperature', 'climate', 'openings', 'lights', 'covers', 'media', 'switches'].slice(0, max)); // locks / alarm: none here; openings: a zero shown (show_empty)
      const more = row(page, 'living').locator('[data-ind-more]');
      await expect(more).toHaveText(mobile ? /\+4$/ : /\+1$/);
      await expect(row(page, 'living').locator('[data-ind="climate"]')).toContainText('קירור');
      await expect(row(page, 'living').locator('[data-ind="temperature"]')).toContainText('24.8°');
      // kitchen: an open window counts; empty counters show with show_empty
      if (!mobile) await expect(row(page, 'kitchen').locator('[data-ind="openings"]')).toContainText('1');
      // a row is still one line, with or without "+N"
      const heights = await page.locator('devices-building a.arow').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
      expect(Math.max(...heights)).toBeLessThan(Math.min(...heights) * 1.4) // a wrapped row would be twice as tall;
      expect(await noSidewaysScroll(page)).toEqual([]);
      await shot(page, 'home-full-list', testInfo);
      // "+N" opens the area like the rest of the row
      await row(page, 'living').click();
      await expect(page).toHaveURL(/#\/devices\/areas\/arow1_living/);
    } finally {
      await reset(request);
    }
  });

  test('the floor header follows its own list on one line', async ({ page, request }, testInfo) => {
    await seed(request);
    await reset(request);
    try {
      expect((await request.patch('/api/v1/settings', { data: { 'devices.floor_row': { items: ['climate', 'media'] } } })).status()).toBe(200);
      await open(page, '/devices/building');
      const card = page.locator('devices-building section[data-floor-card="arow1_ground"]');
      const kinds = await card.locator('.fh-chips [data-floor-chip], .fh-chips [data-floor-count]').evaluateAll((els) => els.map((e) => e.getAttribute('data-floor-chip') ?? e.getAttribute('data-floor-count')));
      expect(kinds).toEqual(['climate', 'media']);
      await expect(card.locator('[data-floor-chip="lights"]')).toHaveCount(0);
      const tops = await card.locator('.fh-chips > *, .fchips > *').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
      expect(new Set(tops.map((x) => Math.round(x / 4))).size).toBe(1); // one line
      await shot(page, 'home-floor-header', testInfo);
    } finally {
      await reset(request);
    }
  });

  test('the settings editor saves the installation\'s list and refuses nothing it offers', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name === 'tablet', 'desktop and phone');
    await seed(request);
    await reset(request);
    try {
      await page.goto('about:blank');
      await page.goto('/?design=a#/system/diagnostics?tab=devices');
      const sec = page.locator('system-diagnostics sw-card[data-devices-settings]');
      await expect(sec).toBeVisible({ timeout: 30000 });
      const ed = sec.locator('area-row-editor');
      await expect(ed.locator('[data-area-item-on="climate"]')).toBeChecked();
      await expect(ed.locator('[data-area-item-on="temperature"]')).not.toBeChecked();
      await ed.locator('[data-area-item-on="temperature"]').check();
      await ed.locator('[data-area-item-earlier="temperature"]').click();
      await ed.locator('[data-area-climate]').selectOption('icon');
      await ed.locator('[data-area-show-empty]').check();
      await ed.locator('[data-floor-item-on="sensors"]').uncheck();
      await sec.scrollIntoViewIfNeeded();
      await shot(page, 'settings-area-row', testInfo);
      const saved = page.waitForResponse((r) => r.url().endsWith('/api/v1/settings') && r.request().method() === 'PATCH');
      await sec.locator('sw-button[data-save-devices]').click();
      expect((await saved).status()).toBe(200);
      const s = (await (await request.get('/api/v1/settings')).json()).settings;
      expect(s['devices.area_row']).toEqual({ items: ['climate', 'lights', 'switches', 'temperature', 'media'], climate: 'icon', show_empty: true });
      expect(s['devices.floor_row'].items).not.toContain('sensors');
      // the server refuses what the editor cannot produce
      expect((await request.patch('/api/v1/settings', { data: { 'devices.area_row': { items: ['fridge'] } } })).status()).toBe(422);
    } finally {
      await reset(request);
    }
  });

  test('the personal override: a holder of screen.personalize (the administrator) picks their own list; the installation\'s is untouched', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop');
    await seed(request);
    await reset(request);
    try {
      await open(page, '/devices/building');
      expect(await ids(page, 'kitchen')).toEqual(['climate', 'lights', 'switches']);
      await page.locator('sw-app [data-profile-menu]').click();
      await page.locator('sw-app sw-user-menu [data-menu-account]').click();
      await page.locator('sw-app sw-user-menu [data-my-home] summary').click();
      const mine = page.locator('sw-app sw-user-menu sw-home-personal [data-home-personal-area-row] area-row-editor');
      await expect(mine.locator('[data-area-item-on="climate"]')).toBeChecked({ timeout: 15000 });
      await mine.locator('[data-area-item-on="temperature"]').check();
      await expect.poll(async () => (await (await request.get('/api/v1/me/prefs')).json()).prefs['devices.area_row']).toEqual({ items: ['climate', 'lights', 'switches', 'media', 'temperature'] });
      expect((await (await request.get('/api/v1/settings')).json()).settings['devices.area_row']).toEqual(DEFAULT_ROWS['devices.area_row']);
      await page.keyboard.press('Escape');
      await open(page, '/devices/building');
      await expect(row(page, 'kitchen').locator('[data-ind="temperature"]')).toContainText('20.1°');
      // "ברירת מחדל של המערכת" clears it
      await page.locator('sw-app [data-profile-menu]').click();
      await page.locator('sw-app sw-user-menu [data-menu-account]').click();
      await page.locator('sw-app sw-user-menu [data-my-home] summary').click();
      await page.locator('sw-app sw-user-menu sw-home-personal [data-home-personal-reset]').click();
      await expect.poll(async () => (await (await request.get('/api/v1/me/prefs')).json()).prefs['devices.area_row']).toBeNull();
    } finally {
      await reset(request);
    }
  });
});
