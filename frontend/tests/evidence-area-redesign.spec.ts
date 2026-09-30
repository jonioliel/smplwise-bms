import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import path from 'node:path';

// Owner decisions 2026-09-30 - the AREA screen redesign, against the devices fixture backend (tests/fixtures/devices_fake_ha.py,
// SW_LIVE=1 SW_DEVICES_FIXTURE=1): the two directions ("אריחים צפופים" - the default, "מקטעים ברצף"), the installation setting and
// the personal choice of a screen.personalize holder, the security strip, the main sensors strip (only what the area has; the
// owner's own pick of ANY sensor of the installation), the sections' "כבה הכל" with its look, everything editable in both
// directions (duplicate a section, rename, ...), the no-scroll fit of a 30-device room at 1440x900 and 1920x1080, and the phone's
// folding sections. Every seeded id carries `ar2_`. SW_SHOTS=<dir> saves screenshots there (docs/evidence/UIR2-area/).
const SHOTS = process.env.SW_SHOTS ?? '';
const AREA = 'ar2_sports';

const FLOORS = [{ floor_id: 'ar2_f1', name: 'קומה 1-', level: -1 }];
const AREAS = [
  { area_id: AREA, name: 'אולם ספורט', floor_id: 'ar2_f1' },
  { area_id: 'ar2_lockers', name: 'מלתחות', floor_id: 'ar2_f1' },
  { area_id: 'ar2_offices', name: 'משרדים', floor_id: 'ar2_f1' },
];
const ENT: { entity_id: string; area_id: string }[] = [];
const ST: { entity_id: string; state: string; attributes: Record<string, unknown> }[] = [];
const add = (entity_id: string, area_id: string, state: string, attributes: Record<string, unknown>) => {
  ENT.push({ entity_id, area_id });
  ST.push({ entity_id, state, attributes });
};
['זרקור אולם 1', 'זרקור אולם 2', 'זרקור אולם 3', 'זרקור אולם 4', 'פס לד מגרש', 'תאורת יציע', 'כניסה ראשית', 'מחסן ציוד', 'תאורת חירום', 'קיר צפוני'].forEach((n, i) => add(`light.ar2_l${i + 1}`, AREA, i < 6 ? 'on' : 'off', { friendly_name: n, brightness: 200 }));
['לוח תוצאות', 'מערכת הגברה', 'מכונת מים', 'מאוורר ענק', 'שקע יציע', 'מפזר ריח'].forEach((n, i) => add(`switch.ar2_s${i + 1}`, AREA, i < 3 ? 'on' : 'off', { friendly_name: n }));
[['וילון יציע', 'open'], ['תריס חלונות עליוני', 'open'], ['תריס יציאת חירום', 'closed']].forEach(([n, s], i) => add(`cover.ar2_c${i + 1}`, AREA, s, { friendly_name: n, current_position: s === 'open' ? 60 : 0, device_class: 'blind' }));
[['מזגן צפון', 'cool'], ['מזגן דרום', 'off']].forEach(([n, s], i) => add(`climate.ar2_a${i + 1}`, AREA, s, { friendly_name: n, current_temperature: 24.5, temperature: 23, hvac_modes: ['off', 'cool', 'heat'], hvac_action: s === 'cool' ? 'cooling' : 'idle' }));
add('media_player.ar2_tv', AREA, 'off', { friendly_name: 'מסך ראשי' });
add('sensor.ar2_temp', AREA, '24.5', { friendly_name: 'טמפרטורה', unit_of_measurement: '°C', device_class: 'temperature' });
add('sensor.ar2_hum', AREA, '48', { friendly_name: 'לחות', unit_of_measurement: '%', device_class: 'humidity' });
add('binary_sensor.ar2_motion', AREA, 'off', { friendly_name: 'תנועה', device_class: 'motion' });
add('binary_sensor.ar2_door', AREA, 'off', { friendly_name: 'דלת ראשית', device_class: 'door' });
add('sensor.ar2_pow', AREA, '1200', { friendly_name: 'הספק כללי', unit_of_measurement: 'W', device_class: 'power' });
add('sensor.ar2_bat', AREA, '91', { friendly_name: 'סוללת חיישן', unit_of_measurement: '%', device_class: 'battery' });
add('lock.ar2_front', AREA, 'locked', { friendly_name: 'דלת כניסה', device_class: 'lock' });
add('alarm_control_panel.ar2_alarm', AREA, 'armed_away', { friendly_name: 'אזעקה' });
add('camera.ar2_cam', AREA, 'idle', { friendly_name: 'מצלמת כניסה' });
add('sensor.ar2_outside_temp', 'ar2_offices', '19', { friendly_name: 'טמפרטורה חוץ', unit_of_measurement: '°C', device_class: 'temperature' });
add('sensor.ar2_lock_hum', 'ar2_lockers', '70', { friendly_name: 'לחות מלתחות', unit_of_measurement: '%', device_class: 'humidity' });
for (let i = 1; i <= 3; i++) add(`light.ar2_k${i}`, 'ar2_lockers', 'off', { friendly_name: `מלתחה תאורה ${i}` });

test.describe('the area screen redesign', () => {
  test.skip(process.env.SW_LIVE !== '1' || process.env.SW_DEVICES_FIXTURE !== '1', 'needs tests/fixtures/devices_fake_ha.py (SW_LIVE=1 SW_DEVICES_FIXTURE=1)');

  async function seed(request: APIRequestContext) {
    expect((await request.post('/api/v1/ha/dev/registry', { data: { entities: ENT, devices: [], areas: AREAS, floors: FLOORS } })).status()).toBe(200);
    for (let i = 0; i < ST.length; i += 50) expect((await request.post('/api/v1/ha/dev/states', { data: { states: ST.slice(i, i + 50) } })).status()).toBe(200);
    for (const a of AREAS) await request.delete(`/api/v1/devices/layouts/area/${a.area_id}`);
    await design(request, 'tiles');
  }

  const design = async (request: APIRequestContext, d: 'tiles' | 'sections') => expect((await request.patch('/api/v1/settings', { data: { 'devices.area_design': d } })).status()).toBe(200);

  async function open(page: Page, areaId = AREA, dropBanner = true) {
    await page.goto('about:blank');
    await page.goto(`/?design=a#/devices/areas/${areaId}`);
    await page.waitForSelector('devices-area sw-card');
    await page.waitForTimeout(700);
    // the setup banner is part of a half-installed lab only: the fit rule is measured without it
    if (dropBanner) await page.evaluate(() => document.querySelector('sw-app')!.shadowRoot!.querySelector('.setuphint')?.remove());
  }

  async function shot(page: Page, name: string, testInfo: { project: { name: string } }) {
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}-${testInfo.project.name}.png`) });
  }

  const area = (page: Page) => page.locator('devices-area');

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

  async function editMode(page: Page) {
    await page.locator('sw-app').getByRole('button', { name: /תפריט המשתמש/ }).click();
    await page.locator('[data-menu-screen-edit="devices-layout"]').click();
    await expect(area(page).locator('[data-layout-bar]')).toBeVisible();
  }

  const record = async (request: APIRequestContext, id = AREA) => (await (await request.get(`/api/v1/devices/layouts/area/${id}`)).json()).desktop?.layout;

  test('dense tiles is the default: section cards in columns, the security strip, the main sensors (only those the area has), a "כבה הכל" per section', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the desktop layout');
    await seed(request);
    await open(page);
    const a = area(page);
    await expect(a).toHaveAttribute('data-area-design', 'tiles');
    // the security state is a strip of read-only chips, not a section
    const strip = a.locator('[data-security-strip]');
    for (const id of ['lock.ar2_front', 'alarm_control_panel.ar2_alarm', 'camera.ar2_cam', 'binary_sensor.ar2_door']) await expect(strip.locator(`[data-sec-chip="${id}"]`)).toBeVisible();
    await expect(a.locator('sw-card[data-card="security"]')).toHaveCount(0);
    // sections: lighting, switches, covers, climate, media, sensors; columns (the cards sit side by side)
    for (const c of ['lighting', 'switches', 'covers', 'climate', 'media', 'sensors']) await expect(a.locator(`sw-card[data-card="${c}"]`)).toBeVisible();
    const xs = await a.locator('.grid > sw-card').evaluateAll((els) => new Set(els.map((e) => Math.round(e.getBoundingClientRect().left))).size);
    expect(xs).toBeGreaterThanOrEqual(3);
    // main sensors: temperature, humidity, motion, door - all four exist here - and the rest behind "עוד N חיישנים"
    const main = a.locator('sw-card[data-card="sensors"] [data-main-sensors] [data-main-sensor]');
    await expect(main).toHaveCount(4);
    expect(await main.evaluateAll((els) => els.map((e) => e.getAttribute('data-slot')))).toEqual(['temperature', 'humidity', 'motion', 'door']);
    await expect(a.locator('[data-sensors-more]')).toContainText('עוד 2 חיישנים');
    await expect(a.locator('sw-card[data-card="sensors"] [data-sensor-group]')).toHaveCount(0); // folded
    await a.locator('[data-sensors-more]').click();
    await expect(a.locator('sw-card[data-card="sensors"] [data-sensor-group]')).toHaveCount(2);
    // a room without those sensors shows none of the missing ones: the lockers have a humidity sensor only
    await open(page, 'ar2_lockers');
    const lockers = area(page).locator('sw-card[data-card="sensors"] [data-main-sensor]');
    await expect(lockers).toHaveCount(1);
    await expect(lockers.first()).toHaveAttribute('data-slot', 'humidity');
    await expect(area(page).locator('[data-security-strip]')).toHaveCount(0); // and no security devices, no strip
    // bulk buttons per section (a devices.control_bulk holder): lights and switches, blinds open / close, climate; none for sensors
    await open(page);
    for (const [card, kinds] of [['lighting', ['lights_off']], ['switches', ['switches_off']], ['covers', ['covers_open', 'covers_close']], ['climate', ['climate_off']]] as const) {
      const box = area(page).locator(`sw-card[data-card="${card}"] [data-section-bulk]`);
      await expect(box).toBeVisible();
      expect(await box.locator('[data-section-bulk-kind]').evaluateAll((els) => els.map((e) => e.getAttribute('data-section-bulk-kind')))).toEqual(kinds);
    }
    await expect(area(page).locator('sw-card[data-card="sensors"] [data-section-bulk]')).toHaveCount(0);
    await shot(page, 'area-tiles', testInfo);
  });

  test('"כבה הכל" opens the bulk flow\'s confirmation first and sends nothing; blinds open / close too; a viewer has no button', async ({ page, browser, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the desktop layout');
    await seed(request);
    await open(page);
    const a = area(page);
    let sent = 0;
    page.on('request', (r) => {
      if (r.method() === 'POST' && /\/devices\/actions$/.test(r.url())) sent += 1;
    });
    await a.locator('sw-card[data-card="lighting"] [data-section-bulk-kind="lights_off"]').click();
    const dlg = a.locator('devices-bulk-dialog sw-dialog[data-bulk-dialog="confirm"]');
    await expect(dlg.locator('[data-bulk-what]')).toBeVisible({ timeout: 15000 }); // (the sw-dialog host itself has no box)
    await expect(dlg.locator('[data-bulk-domains] [data-domain="light"]')).toContainText('6'); // the lights that are on
    await page.keyboard.press('Escape');
    await expect(a.locator('devices-bulk-dialog sw-dialog[open]')).toHaveCount(0);
    expect(sent, 'the dialog alone sends - and only after its own confirm').toBe(0);
    await a.locator('sw-card[data-card="covers"] [data-section-bulk-kind="covers_close"]').click();
    await expect(dlg.locator('[data-bulk-what]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(a.locator('devices-bulk-dialog sw-dialog[open]')).toHaveCount(0);
    expect(sent).toBe(0);
    // a viewer holds devices.read only: no bulk button anywhere on the screen
    const me = await (await request.get('/api/v1/me', { headers: { 'X-SW-Dev-User': 'ar2viewer' } })).json();
    const b = await request.post('/api/v1/access/bindings', { data: { subject_kind: 'user', subject_id: me.user.id, role_id: 'viewer', scope_type: 'installation', scope_id: '*' } });
    const binding = ((await b.json()) as { id: string }).id;
    try {
      const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-SW-Dev-User': 'ar2viewer' } });
      const p = await ctx.newPage();
      await open(p);
      await expect(p.locator('devices-area sw-card[data-card="lighting"]')).toBeVisible({ timeout: 30000 });
      await expect(p.locator('devices-area [data-section-bulk]')).toHaveCount(0);
      // and the personal direction is not offered to them either (no screen.personalize)
      await p.evaluate(() => localStorage.setItem('sw.area.design', 'sections'));
      await open(p);
      await expect(p.locator('devices-area')).toHaveAttribute('data-area-design', 'tiles');
      await ctx.close();
    } finally {
      await request.delete(`/api/v1/access/bindings/${binding}`).catch(() => {});
    }
  });

  test('sequential sections is selectable per installation: the title at the side of each section, the sensors and the media beside them', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the desktop layout');
    await seed(request);
    await design(request, 'sections');
    try {
      await open(page);
      const a = area(page);
      await expect(a).toHaveAttribute('data-area-design', 'sections');
      const lighting = a.locator('sw-card[data-card="lighting"]');
      await expect(lighting).toHaveAttribute('row', '');
      const box = async (sel: string) => (await a.locator(sel).boundingBox())!;
      const l = await box('sw-card[data-card="lighting"]');
      const s = await box('sw-card[data-card="switches"]');
      const sens = await box('sw-card[data-card="sensors"]');
      expect(s.y).toBeGreaterThan(l.y + l.height - 2); // one after the other
      expect(sens.x + sens.width).toBeLessThanOrEqual(l.x + 2); // the sensors stand beside them, on the end side (the left in RTL)
      const media = await box('sw-card[data-card="media"]');
      expect(media.x + media.width).toBeLessThanOrEqual(l.x + 2); // the media beside them too, inside its own column
      expect(media.x).toBeGreaterThanOrEqual(sens.x - 2);
      expect(Math.min(sens.y, media.y)).toBeLessThan(l.y + 60); // ...from the top
      await shot(page, 'area-sections', testInfo);
    } finally {
      await design(request, 'tiles');
    }
  });

  test('a screen.personalize holder may choose their own direction (in the edit bar, this browser only); the installation setting is unchanged', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the desktop layout');
    // the permission is defined by the home branch (label, sensitivity, system_admin): until that is merged nobody holds it
    const me = (await (await request.get('/api/v1/me')).json()) as { permissions_installation?: string[] };
    test.skip(!(me.permissions_installation ?? []).includes('screen.personalize'), 'screen.personalize is not defined on this branch yet (the home branch owns it)');
    await seed(request);
    await open(page);
    const a = area(page);
    await expect(a).toHaveAttribute('data-area-design', 'tiles');
    await editMode(page);
    const sel = a.locator('[data-design-personal-select]');
    await expect(sel).toBeVisible();
    await sel.selectOption('sections');
    await expect(a).toHaveAttribute('data-area-design', 'sections');
    expect((await (await request.get('/api/v1/settings')).json()).settings['devices.area_design']).toBe('tiles');
    await a.locator('sw-button[data-layout-cancel]').click();
    await page.reload();
    await expect(area(page)).toHaveAttribute('data-area-design', 'sections', { timeout: 30000 }); // kept in this browser
    await editMode(page);
    await area(page).locator('[data-design-personal-select]').selectOption('');
    await expect(area(page)).toHaveAttribute('data-area-design', 'tiles');
  });

  test('a 30-device room fits the viewport without a vertical scroll at 1440x900 and 1920x1080, in both directions', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop sizes');
    test.setTimeout(120_000);
    await seed(request);
    for (const d of ['tiles', 'sections'] as const) {
      await design(request, d);
      for (const [w, h] of [[1440, 900], [1920, 1080]]) {
        await page.setViewportSize({ width: w, height: h });
        await open(page);
        await expect(area(page).locator('sw-card[data-card="lighting"]')).toBeVisible({ timeout: 30000 });
        await page.waitForTimeout(400);
        expect(await scrolls(page), `${d} ${w}x${h}`).toEqual([]);
        await shot(page, `area-${d}-${w}`, testInfo);
      }
    }
    await design(request, 'tiles');
  });

  test('main sensors: the owner picks ANY sensors of the installation (search, select all / none), a per-sensor "show in this area" toggle; saved and shown to everyone', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the desktop layout');
    test.setTimeout(120_000);
    await seed(request);
    try {
      await open(page);
      const a = area(page);
      await editMode(page);
      await a.locator('.lay-item[data-lay-key="card:sensors"]').focus();
      const panel = a.locator('[data-layout-panel="card:sensors"]');
      const main = panel.locator('[data-layout-main-picker]');
      await expect(main).toBeVisible();
      await expect(main.locator('[data-layout-ent-count]')).toContainText('0 מתוך'); // nothing picked: the automatic strip
      // the area's own sensors only, until "מכל המערכת" adds the whole installation's
      await expect(main.locator('input[data-layout-entity="sensor.ar2_outside_temp"]')).toHaveCount(0);
      await main.locator('input[data-layout-all-system]').check();
      await main.locator('[data-layout-ent-filter]').fill('חוץ');
      await expect(main.locator('input[data-layout-entity="sensor.ar2_outside_temp"]')).toHaveCount(1, { timeout: 15000 });
      await main.locator('[data-layout-ent-all]').click(); // select all - of the filtered results only
      await main.locator('[data-layout-ent-filter]').fill('');
      await main.locator('input[data-layout-entity="sensor.ar2_hum"]').check();
      await expect(main.locator('[data-layout-ent-count]')).toContainText('2 מתוך');
      await shot(page, 'area-main-picker', testInfo);
      // the per-sensor toggle for the section's own list: uncheck the power sensor ("show in this area")
      const own = panel.locator('[data-layout-picker]');
      await own.locator('input[data-layout-entity="sensor.ar2_pow"]').uncheck();
      await a.locator('sw-button[data-layout-save]').click();
      await expect(a.locator('[data-layout-bar]')).toHaveCount(0, { timeout: 15000 });
      const saved = await record(request);
      expect(saved.items['card:sensors'].main.sort()).toEqual(['sensor.ar2_hum', 'sensor.ar2_outside_temp']);
      expect(saved.items['card:sensors'].hidden_entities).toContain('sensor.ar2_pow');
      await page.reload();
      const strip = area(page).locator('sw-card[data-card="sensors"] [data-main-sensors] [data-main-sensor]');
      await expect(strip).toHaveCount(2, { timeout: 30000 });
      await expect(area(page).locator('[data-main-sensor="sensor.ar2_outside_temp"]')).toContainText('19'); // a sensor of another area, live
      await expect(area(page).locator('[data-main-sensor="sensor.ar2_temp"]')).toHaveCount(0); // the automatic four are replaced
      await open(page);
      await area(page).locator('[data-sensors-more]').click();
      await expect(area(page).locator('[data-entity="sensor.ar2_pow"]')).toHaveCount(0); // hidden in this area
    } finally {
      await request.delete(`/api/v1/devices/layouts/area/${AREA}`);
    }
  });

  test('the "כבה הכל" look is chosen per section in edit mode (icon / text / both) and saved; a section can be duplicated and renamed in either direction', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the desktop layout');
    test.setTimeout(120_000);
    await seed(request);
    try {
      for (const d of ['tiles', 'sections'] as const) {
        await design(request, d);
        await request.delete(`/api/v1/devices/layouts/area/${AREA}`);
        await open(page);
        const a = area(page);
        await editMode(page);
        await a.locator('.lay-item[data-lay-key="card:lighting"]').focus();
        const panel = a.locator('[data-layout-panel="card:lighting"]');
        await panel.locator('[data-layout-bulk-look="icon"]').click();
        await a.locator('.lay-item[data-lay-key="card:switches"]').focus();
        await a.locator('[data-layout-panel="card:switches"] [data-layout-bulk-look="text"]').click();
        // duplicate the lighting section: a copy with its own name (renamed), the same devices
        await a.locator('.lay-item[data-lay-key="card:lighting"]').focus();
        await panel.locator('[data-layout-duplicate-card]').click();
        const copyKey = (await a.locator('.lay-item[data-lay-key^="card:c-"]').first().getAttribute('data-lay-key'))!;
        const copyPanel = a.locator(`[data-layout-panel="${copyKey}"]`);
        await expect(copyPanel.locator('[data-layout-title]')).toHaveValue('תאורה 2');
        await copyPanel.locator('[data-layout-title]').fill('תאורת יציע');
        await a.locator('sw-button[data-layout-save]').click();
        await expect(a.locator('[data-layout-bar]')).toHaveCount(0, { timeout: 15000 });
        const saved = await record(request);
        expect(saved.items['card:lighting'].bulk_look).toBe('icon');
        expect(saved.items['card:switches'].bulk_look).toBe('text');
        expect(saved.items[copyKey].custom.type).toBe('lighting');
        expect(saved.items[copyKey].custom.entities).toHaveLength(10);
        await page.reload();
        await expect(area(page).locator('sw-card[heading="תאורת יציע"] .tile')).toHaveCount(10, { timeout: 30000 });
        // the look: icon only (no text), text only (no icon), and the default (both) on the others
        const iconOnly = area(page).locator('sw-card[data-card="lighting"] [data-section-bulk-kind]');
        await expect(iconOnly).toHaveAttribute('icononly', '');
        const textOnly = area(page).locator('sw-card[data-card="switches"] [data-section-bulk-kind]');
        await expect(textOnly).not.toHaveAttribute('icononly', '');
        await expect(textOnly).not.toHaveAttribute('icon', /.+/);
        await expect(textOnly).toContainText('כבה הכל');
        const both = area(page).locator('sw-card[data-card="climate"] [data-section-bulk-kind]');
        await expect(both).toHaveAttribute('icon', 'power');
        await expect(both).toContainText('כבה הכל');
        await shot(page, `area-${d}-edited`, testInfo);
      }
    } finally {
      await design(request, 'tiles');
      await request.delete(`/api/v1/devices/layouts/area/${AREA}`);
    }
  });

  test('phone: the sections fold (the sensors section starts folded), the security strip wraps, nothing scrolls sideways', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'the phone layout');
    await seed(request);
    await open(page);
    const a = area(page);
    const sensors = a.locator('sw-card[data-card="sensors"]');
    await expect(sensors).toHaveAttribute('collapsed', '');
    await expect(a.locator('sw-card[data-card="lighting"]')).not.toHaveAttribute('collapsed', '');
    await expect(a.locator('[data-security-strip]')).toBeVisible();
    // fold the lights, unfold the sensors
    await a.locator('sw-card[data-card="lighting"] button.fold').click();
    await expect(a.locator('sw-card[data-card="lighting"]')).toHaveAttribute('collapsed', '');
    await sensors.locator('button.fold').click();
    await expect(sensors).not.toHaveAttribute('collapsed', '');
    await expect(sensors.locator('[data-main-sensor]')).toHaveCount(4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await shot(page, 'area-phone', testInfo);
  });
});
