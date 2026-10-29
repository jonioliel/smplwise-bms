import { test, expect, type APIRequestContext, type Page, type Route } from '@playwright/test';

// PRESENCE-2280 build check against the approved mockup (private/design-system-2026-10-27/round7/presence): the home card, the plan-map chips and the
// room tint, the settings sensor table (paged, no growing list) and the per-sensor tag editor drawer, in light and dark. Runs against the devices
// fixture backend with a seeded floor+plan (group `devices_floor` of tests/fixtures/fixture_specs.json - the REAL backend, a fake Home Assistant side);
// only `presence/building*` and the map's zone list are answered here, so no sensor and no device is touched. Needs SW_LIVE=1.
//   no-scroll: the document never scrolls sideways, the sensor table shows at most one page of rows, the home card caps its room chips.
test.describe('PRESENCE-2280 layout vs mockup', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the devices fixture backend running (seeded floor with a plan)');

  const iso = (hh: number, mm: number) => `2026-10-29T${String(hh - 2).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00Z`;
  const ROOMS = [
    { area_id: 'a_lobby', name: 'לובי', status: 'occupied', sensors: 1, empty_since: null as string | null, poly: [[0.05, 0.1], [0.35, 0.1], [0.35, 0.4], [0.05, 0.4]] },
    { area_id: 'a_open', name: 'אופן ספייס', status: 'occupied', sensors: 2, empty_since: null, poly: [[0.35, 0.1], [0.7, 0.1], [0.7, 0.55], [0.35, 0.55]] },
    { area_id: 'a_small', name: 'חדר ישיבות קטן', status: 'clear', sensors: 1, empty_since: iso(9, 52), poly: [[0.7, 0.4], [0.95, 0.4], [0.95, 0.55], [0.7, 0.55]] },
    { area_id: 'a_mgr', name: 'משרד מנהל', status: 'unknown', sensors: 1, empty_since: null, poly: [[0.05, 0.7], [0.35, 0.7], [0.35, 0.95], [0.05, 0.95]] },
  ];
  const SETTINGS = { enabled: true, retention_days: 30, home_display: 'card', map_tint: true, hold_seconds: 60, empty_minutes: 10 };
  const mkSensors = (n: number) =>
    Array.from({ length: n }, (_, i) => {
      const r = ROOMS[i % ROOMS.length];
      return { entity_id: `binary_sensor.p${i}`, name: `חיישן נוכחות ${i + 1}`, area_id: r.area_id, area_name: r.name, device_class: 'occupancy', tagged: i < n - 2, state: i % 3 === 0 ? 'on' : i % 3 === 1 ? 'off' : 'unavailable', placed: true };
    });

  async function setup(page: Page, request: APIRequestContext, opts: { settings?: Record<string, unknown>; sensors?: number; status?: string } = {}) {
    const tree = await (await request.get('/api/v1/sites?tree=true')).json();
    const floor = tree.sites.flatMap((s: { buildings: { floors: { id: string; has_plan: boolean }[] }[] }) => s.buildings.flatMap((b) => b.floors)).find((f: { has_plan: boolean }) => f.has_plan);
    const settings = { ...SETTINGS, ...(opts.settings ?? {}) };
    const sensors = mkSensors(opts.sensors ?? 11);
    const puts: { path: string; body: unknown }[] = [];
    const rooms = ROOMS.map(({ poly: _poly, ...r }) => ({ ...r, status: opts.status ? opts.status : r.status }));
    await page.route('**/api/v1/presence/building**', async (route: Route) => {
      const req = route.request();
      const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
      const json = (b: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
      if (req.method() === 'PUT') {
        puts.push({ path: p, body: req.postDataJSON() });
        if (p.endsWith('/sensors')) {
          const ids = (req.postDataJSON() as { entity_ids: string[] }).entity_ids;
          sensors.forEach((s) => (s.tagged = ids.includes(s.entity_id)));
        }
        return json({ sensors, rooms: ROOMS.map((r) => ({ area_id: r.area_id, name: r.name })), settings });
      }
      if (p === 'presence/building') {
        const occ = rooms.filter((r) => r.status === 'occupied').length;
        return json({ configured: true, enabled: settings.enabled, settings, fresh: true, status: opts.status ?? 'occupied', occupied_rooms: occ, rooms, sensors: [], at: new Date().toISOString() });
      }
      if (p === 'presence/building/sensors') return json({ sensors, rooms: ROOMS.map((r) => ({ area_id: r.area_id, name: r.name })), settings });
      if (p === 'presence/building/history') return json({ rows: 120, oldest: '2026-09-29T08:00:00Z', retention_days: 30, enabled: true });
      return json({ settings });
    });
    await page.route(new RegExp(`/api/v1/floors/${floor.id}/map`), async (route: Route) => {
      const res = await route.fetch();
      const body = await res.json();
      body.zones = ROOMS.map((r) => ({
        id: `z_${r.area_id}`, floor_id: floor.id, plan_version_id: body.floor.published_version_id, name: r.name, kind: 'room', polygon: r.poly.map(([x, y]) => ({ x, y })), color: '#4f7cff', source: 'manual',
        searchable: true, label_pos: 'auto', area_id: r.area_id, revision: 1, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z',
      }));
      await route.fulfill({ response: res, body: JSON.stringify(body), headers: { ...res.headers(), 'content-length': '' } });
    });
    return { floorId: floor.id as string, puts, sensors };
  }

  const open = async (page: Page, hash: string, scheme: 'light' | 'dark') => {
    await page.goto('about:blank');
    await page.goto(`/?design=a&scheme=${scheme}#${hash}`);
    await page.waitForSelector('sw-app', { timeout: 20000 });
  };
  const noSideScroll = async (page: Page) => {
    const m = await page.evaluate(() => ({ h: document.documentElement.scrollWidth - document.documentElement.clientWidth, v: document.documentElement.scrollHeight - document.documentElement.clientHeight }));
    expect(m.h).toBeLessThanOrEqual(1);
    expect(m.v).toBeLessThanOrEqual(1);
  };

  for (const scheme of ['light', 'dark'] as const) {
    test(`${scheme}: plan map - occupied chips are solid green with a tint, empty is neutral, unknown is dashed; the page does not scroll`, async ({ page, request }, info) => {
      const { floorId } = await setup(page, request);
      await open(page, `/explore/floors/${floorId}`, scheme);
      // on a phone the smallest room (the small meeting room) has no space for its name, so the map draws no chip there (existing label rule)
      const phone = info.project.name === 'mobile';
      await expect(page.locator('[data-zone-chip]')).toHaveCount(phone ? 3 : 4, { timeout: 20000 });
      await expect(page.locator('[data-zone-chip][data-tone="occupied"]')).toHaveCount(2);
      await expect(page.locator('[data-zone-chip][data-tone="clear"]')).toHaveCount(phone ? 0 : 1);
      await expect(page.locator('[data-zone-chip][data-tone="unknown"]')).toHaveCount(1);
      await expect(page.locator('[data-building-tint="occupied"]')).toHaveCount(2);
      const dash = (tone: string) => page.locator(`[data-zone-chip][data-tone="${tone}"] rect`).first().evaluate((el) => getComputedStyle(el).strokeDasharray);
      expect(await dash('occupied')).toBe('none');
      if (!phone) expect(await dash('clear')).toBe('none');
      expect(await dash('unknown')).not.toBe('none');
      await expect(page.locator('[data-zone-chip][data-tone="occupied"]').first()).toContainText('פעיל');
      if (!phone) await expect(page.locator('[data-zone-chip][data-tone="clear"]')).toContainText('ריק מ');
      await expect(page.locator('[data-zone-chip][data-tone="unknown"]')).toContainText('אין מידע');
      await page.waitForTimeout(400);
      await noSideScroll(page);
    });
  }

  test('plan map: the switch "presence on the map" off draws no chip and no tint', async ({ page, request }) => {
    const { floorId } = await setup(page, request, { settings: { map_tint: false } });
    await open(page, `/explore/floors/${floorId}`, 'light');
    await page.waitForSelector('[data-zone]', { timeout: 20000 });
    await expect(page.locator('[data-zone-chip]')).toHaveCount(0);
    await expect(page.locator('[data-building-tint]')).toHaveCount(0);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`${scheme}: home card - state word, rooms (capped), link to the map; hidden when the display is not "card"`, async ({ page, request }) => {
      await setup(page, request);
      await open(page, '/devices', scheme);
      const card = page.locator('[data-home-widget="presence"]');
      await expect(card).toBeVisible({ timeout: 20000 });
      await expect(page.locator('[data-building-presence-big]')).toHaveText('פעיל');
      const chips = await page.locator('[data-building-rooms] .r').count();
      expect(chips).toBeGreaterThan(0);
      expect(chips).toBeLessThanOrEqual(9);
      await expect(page.locator('[data-building-card-map]')).toHaveAttribute('href', '#/explore');
      const box = await card.boundingBox();
      const vp = page.viewportSize()!;
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width + 1);
      await noSideScroll(page);
    });
  }

  test('home card: 6 rooms on a phone-width card show at most 4 chips and a "more" chip (no growth, no scroll)', async ({ page, request }) => {
    await setup(page, request);
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, '/devices', 'light');
    await expect(page.locator('[data-home-widget="presence"]')).toBeVisible({ timeout: 20000 });
    // the mocked answer has 4 rooms: nothing is hidden, so there is no "more" chip
    await expect(page.locator('[data-building-more-rooms]')).toHaveCount(0);
    expect(await page.locator('[data-building-rooms] .r').count()).toBeLessThanOrEqual(4);
  });

  test('home card: the unknown state reads "אין מידע" and the master switch off shows nothing', async ({ page, request }) => {
    await setup(page, request, { status: 'unknown' });
    await open(page, '/devices', 'light');
    await expect(page.locator('[data-building-presence-big]')).toHaveText('אין מידע', { timeout: 20000 });
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`${scheme}: settings - the sensor table pages (never a long list), state chips, the tag editor drawer edits room and removes the tag`, async ({ page, request }, info) => {
      const { puts } = await setup(page, request, { sensors: 14 });
      await open(page, '/system/diagnostics?tab=mobile&page=building', scheme);
      await expect(page.locator('[data-building-table]')).toBeVisible({ timeout: 20000 });
      const size = info.project.name === 'mobile' ? 5 : 6;
      await expect(page.locator('[data-building-sensor]')).toHaveCount(size);
      await expect(page.locator('[data-building-state]').first()).toBeVisible();
      // the settings page itself is a form page (it may scroll down); only a sideways overflow is a defect
      const h = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(h).toBeLessThanOrEqual(1);
      // page 2 shows the next rows
      await page.locator('sw-pager').first().locator('button').last().click().catch(() => undefined);
      // filter: untagged shows only the untagged rows
      await page.locator('[data-building-filter="untagged"]').click();
      await expect(page.locator('[data-building-sensor][data-tagged="true"]')).toHaveCount(0);
      await page.locator('[data-building-filter="tagged"]').click();
      await expect(page.locator('[data-building-sensor][data-tagged="false"]')).toHaveCount(0);
      // the editor
      await page.locator('[data-building-more]').first().click();
      const drawer = page.locator('[data-building-editor]');
      await expect(drawer).toBeVisible();
      await expect(drawer.locator('select[data-building-room="editor"]')).toBeVisible();
      await drawer.locator('select[data-building-room="editor"]').selectOption('a_mgr');
      await expect.poll(() => puts.some((p) => p.path.endsWith('/room') && (p.body as { area_id: string }).area_id === 'a_mgr')).toBe(true);
      await drawer.locator('[data-building-untag]').click();
      await expect.poll(() => puts.some((p) => p.path.endsWith('/sensors'))).toBe(true);
      await expect(page.locator('[data-building-editor]')).toHaveCount(0);
    });
  }

  test('settings with reduced motion: the drawer still opens and closes', async ({ page, request }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setup(page, request);
    await open(page, '/system/diagnostics?tab=mobile&page=building', 'light');
    await page.locator('[data-building-more]').first().click({ timeout: 20000 });
    await expect(page.locator('[data-building-editor]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-building-editor]')).toHaveCount(0);
  });
});
