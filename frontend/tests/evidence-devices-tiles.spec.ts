import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import path from 'node:path';

// Owner 2026-09-29 (overview tiles) against the devices fixture backend - the REAL backend with a fake Home Assistant
// side (tests/fixtures/devices_fake_ha.py; see its header for how to start it) - SW_LIVE=1 SW_DEVICES_FIXTURE=1:
// the panel lists what GET /devices/items says, a toggle goes through the real action route and the row follows the
// pushed state, a viewer gets no control, unlock needs its own confirmation (and door.unlock), the deep link, the
// ui.tile_layout setting from הגדרות, and the tree rows with long names. Every seeded id carries `cr007t_`.
// SW_SHOTS=<dir> saves screenshots there.
const SHOTS = process.env.SW_SHOTS ?? '';

const FLOORS = [
  { floor_id: 'cr007t_ground', name: 'קרקע', level: 0 },
  { floor_id: 'cr007t_upper', name: 'קומה 1', level: 1 },
];
const AREAS = [
  { area_id: 'cr007t_stairs', name: 'חדר מדרגות ראשי', floor_id: 'cr007t_ground' },
  { area_id: 'cr007t_service', name: 'מרחב שירות משותף ומחסן', floor_id: 'cr007t_ground' },
  { area_id: 'cr007t_office', name: 'משרד', floor_id: 'cr007t_upper' },
];
const ENTITIES = [
  { entity_id: 'switch.cr007t_pump', area_id: 'cr007t_service' },
  { entity_id: 'switch.cr007t_boiler', area_id: 'cr007t_service' },
  { entity_id: 'switch.cr007t_sign', area_id: 'cr007t_stairs' },
  { entity_id: 'light.cr007t_stairs', area_id: 'cr007t_stairs' },
  { entity_id: 'light.cr007t_office', area_id: 'cr007t_office' },
  { entity_id: 'lock.cr007t_front', area_id: 'cr007t_stairs' },
  { entity_id: 'alarm_control_panel.cr007t_house', area_id: 'cr007t_stairs' },
];
const STATES = [
  { entity_id: 'switch.cr007t_pump', state: 'off', attributes: { friendly_name: 'משאבת מים' } },
  { entity_id: 'switch.cr007t_boiler', state: 'off', attributes: { friendly_name: 'דוד שמש' } },
  { entity_id: 'switch.cr007t_sign', state: 'on', attributes: { friendly_name: 'שלט מואר' } },
  { entity_id: 'light.cr007t_stairs', state: 'on', attributes: { friendly_name: 'תאורת מדרגות', brightness: 200, color_mode: 'brightness' } },
  { entity_id: 'light.cr007t_office', state: 'off', attributes: { friendly_name: 'תאורת משרד' } },
  { entity_id: 'lock.cr007t_front', state: 'locked', attributes: { friendly_name: 'דלת כניסה', device_class: 'lock' } },
  { entity_id: 'alarm_control_panel.cr007t_house', state: 'armed_away', attributes: { friendly_name: 'אזעקת הבניין' } },
];

test.describe('overview tiles against the devices fixture backend', () => {
  test.skip(process.env.SW_LIVE !== '1' || process.env.SW_DEVICES_FIXTURE !== '1', 'needs tests/fixtures/devices_fake_ha.py (SW_LIVE=1 SW_DEVICES_FIXTURE=1)');

  async function seed(request: APIRequestContext) {
    expect((await request.post('/api/v1/ha/dev/registry', { data: { entities: ENTITIES, devices: [], areas: AREAS, floors: FLOORS } })).status()).toBe(200);
    expect((await request.post('/api/v1/ha/dev/states', { data: { states: STATES } })).status()).toBe(200);
  }

  async function open(page: Page, hash: string) {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('sw.devices.layout', 'cards');
      } catch {
        /* storage unavailable */
      }
    });
    await page.goto('about:blank');
    await page.goto(`/?design=a#${hash}`);
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1200);
  }

  async function bindUser(request: APIRequestContext, username: string, roleId: string): Promise<string> {
    const me = await (await request.get('/api/v1/me', { headers: { 'X-SW-Dev-User': username } })).json();
    const r = await request.post('/api/v1/access/bindings', { data: { subject_kind: 'user', subject_id: me.user.id, role_id: roleId, scope_type: 'installation', scope_id: '*' } });
    expect(r.status()).toBeLessThan(300);
    return ((await r.json()) as { id: string }).id;
  }

  test('the switches tile opens the panel with exactly what the server lists; a toggle is sent through the action route and the row follows the pushed state', async ({ page, request }, testInfo) => {
    await seed(request);
    const items = await (await request.get('/api/v1/devices/items?kind=switches')).json();
    const want = (items.floors as { areas: { items: { entity_id: string }[] }[] }[]).flatMap((f) => f.areas.flatMap((a) => a.items.map((r) => r.entity_id)));
    await open(page, '/devices/building');
    const b = page.locator('devices-building');
    const tile = b.locator('sw-kpi[data-tile-kind="switches"]');
    await expect(tile).toHaveAttribute('data-value', `${items.counts.active}/${items.counts.total}`, { timeout: 30000 });
    await tile.locator('button.hit').click();
    const panel = b.locator('devices-tiles-panel');
    const rows = panel.locator('.row[data-entity]');
    await expect(rows).toHaveCount(want.length, { timeout: 15000 });
    expect(await rows.evaluateAll((els) => els.map((e) => e.getAttribute('data-entity')))).toEqual(want);
    await expect(panel.locator('sw-drawer')).toHaveAttribute('subheading', new RegExp(`${items.counts.total} מתגים · ‎?${items.counts.active} פעילים`));
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `panel-fixture-${testInfo.project.name}.png`) });
    // the pump: off -> the toggle -> the real route (202) -> the fake device reports on -> confirmed, row active
    const pump = panel.locator('.row[data-entity="switch.cr007t_pump"]');
    await expect(pump).toHaveAttribute('data-state', 'inactive');
    const posted: number[] = [];
    page.on('response', (res) => {
      if (/\/api\/v1\/ha\/entities\/switch\.cr007t_pump\/actions$/.test(res.url())) posted.push(res.status());
    });
    await pump.locator('sw-toggle[data-control="power"]').click();
    await expect(pump.locator('[data-cmd-status="confirmed"]')).toBeVisible({ timeout: 8000 });
    await expect(pump).toHaveAttribute('data-state', 'active', { timeout: 5000 });
    expect(posted).toEqual([202]);
    // the header and the tile behind follow the same push
    await expect(panel.locator('sw-drawer')).toHaveAttribute('subheading', new RegExp(`‎?${items.counts.active + 1} פעילים`), { timeout: 5000 });
    await page.keyboard.press('Escape');
    await expect(tile).toHaveAttribute('data-value', `${items.counts.active + 1}/${items.counts.total}`, { timeout: 5000 });
    await seed(request);
  });

  test('a viewer sees the same rows read-only, each saying why; no bulk action', async ({ browser, request }, testInfo) => {
    await seed(request);
    const user = `cr007tviewer${testInfo.project.name}`;
    const binding = await bindUser(request, user, 'viewer');
    try {
      const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-SW-Dev-User': user } });
      const p = await ctx.newPage();
      await open(p, '/devices/building?domain=lights');
      const panel = p.locator('devices-building devices-tiles-panel');
      await expect(panel.locator('.row[data-entity="light.cr007t_stairs"]')).toBeVisible({ timeout: 30000 });
      await expect(panel.locator('.row sw-toggle, .row sw-button, .row input[type="range"], .row select')).toHaveCount(0);
      await expect(panel.locator('[data-panel-bulk]')).toHaveCount(0);
      const ro = panel.locator('.row[data-entity="light.cr007t_stairs"] button[data-readonly]');
      await expect(ro).toHaveAttribute('title', 'אין לך הרשאת שליטה בהתקן הזה');
      await ro.click();
      await expect(panel.locator('.row[data-entity="light.cr007t_stairs"] [data-readonly-why]')).toBeVisible();
      await ctx.close();
    } finally {
      await request.delete(`/api/v1/access/bindings/${binding}`).catch(() => {});
    }
  });

  test('locks: unlock is offered only with door.unlock and never sends before its own confirmation; lock is one tap', async ({ browser, page, request }, testInfo) => {
    await seed(request);
    // the administrator (ha.entity.control, no door.unlock): can lock, the unlock says it needs its own permission
    await open(page, '/devices/building?domain=locks');
    const adminRow = page.locator('devices-building devices-tiles-panel .row[data-entity="lock.cr007t_front"]');
    await expect(adminRow.locator('[data-control="unlock-denied"]')).toBeVisible({ timeout: 30000 });
    await expect(adminRow.locator('sw-button[data-control="unlock"]')).toHaveCount(0);
    // a role that holds door.unlock
    const role = await request.post('/api/v1/access/roles', { data: { name: `פתיחת דלתות ${testInfo.project.name} ${Date.now()}`, permissions: ['devices.read'], sensitive: ['ha.entity.control', 'door.unlock'] } });
    expect(role.status(), await role.text()).toBeLessThan(300);
    const roleId = ((await role.json()) as { id: string }).id;
    const user = `cr007tdoor${testInfo.project.name}`;
    const binding = await bindUser(request, user, roleId);
    try {
      const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-SW-Dev-User': user } });
      const p = await ctx.newPage();
      const sent: Record<string, unknown>[] = [];
      p.on('request', (r) => {
        if (r.method() === 'POST' && /\/ha\/entities\/lock\.cr007t_front\/actions$/.test(r.url())) sent.push(r.postDataJSON() as Record<string, unknown>);
      });
      await open(p, '/devices/building?domain=locks');
      const panel = p.locator('devices-building devices-tiles-panel');
      const row = panel.locator('.row[data-entity="lock.cr007t_front"]');
      await row.locator('sw-button[data-control="unlock"]').click({ timeout: 30000 });
      const dlg = panel.locator('sw-dialog[data-unlock-dialog="open"]');
      await expect(dlg.locator('sw-button[data-unlock-confirm]')).toBeVisible(); // the host itself has no box (a fixed backdrop inside)
      await expect(dlg).toContainText('דלת כניסה');
      await p.waitForTimeout(500);
      expect(sent).toEqual([]); // nothing before the confirmation
      await dlg.locator('sw-button[data-unlock-cancel]').click();
      await expect(panel.locator('sw-dialog[data-unlock-dialog="open"]')).toHaveCount(0);
      expect(sent).toEqual([]);
      await row.locator('sw-button[data-control="unlock"]').click();
      await panel.locator('sw-dialog[data-unlock-dialog="open"] sw-button[data-unlock-confirm]').click();
      await expect(row.locator('[data-cmd-status="confirmed"]')).toBeVisible({ timeout: 8000 });
      expect(sent.map((s) => [s.allowed_action_id, s.confirmation_grant])).toEqual([['lock.unlock', 'confirmed']]);
      await expect(row.locator('[data-row-state]')).toHaveText('לא נעול', { timeout: 5000 });
      if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `panel-locks-${testInfo.project.name}.png`) });
      // lock again: one tap
      await row.locator('sw-button[data-control="lock"]').click();
      await expect(row.locator('[data-row-state]')).toHaveText('נעול', { timeout: 8000 });
      expect(sent.map((s) => s.allowed_action_id)).toEqual(['lock.unlock', 'lock.lock']);
      await ctx.close();
    } finally {
      await request.delete(`/api/v1/access/bindings/${binding}`).catch(() => {});
      await seed(request);
    }
  });

  test('deep link to a floor with a filter; the alarm panel is listed with its state and a way to the alarm screen', async ({ page, request }) => {
    await seed(request);
    await open(page, '/devices/building?domain=switches&floor=cr007t_ground&filter=inactive');
    const panel = page.locator('devices-building devices-tiles-panel');
    await expect(panel.locator('sw-drawer')).toHaveAttribute('heading', 'מתגים בקומה קרקע', { timeout: 30000 });
    await expect(panel.locator('.row[data-entity]')).toHaveCount(2);
    await expect(panel.locator('.row[data-entity="switch.cr007t_sign"]')).toHaveCount(0);
    await page.evaluate(() => (location.hash = '#/devices/building?domain=alarm'));
    await expect(panel.locator('.row[data-entity="alarm_control_panel.cr007t_house"] [data-row-state]')).toHaveText('דרוכה (חוץ)', { timeout: 10000 });
    await expect(panel.locator('.row[data-entity="alarm_control_panel.cr007t_house"] sw-button')).toHaveCount(0);
    await expect(panel.locator('a[data-alarm-link]')).toHaveAttribute('href', '#/security/alarm');
  });

  test('הגדרות › עיצוב הממשק › פריסת אריחים switches the tiles for everyone (installation setting), with a live preview', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'one run is enough: the setting is per installation');
    await seed(request);
    try {
      await open(page, '/system/diagnostics');
      const row = page.locator('system-diagnostics select[data-set-tile-layout]');
      await expect(row).toBeVisible({ timeout: 30000 });
      await row.selectOption('compact');
      await expect(page.locator('system-diagnostics [data-tile-preview]')).toHaveAttribute('data-tile-preview', 'compact');
      if (SHOTS) await page.locator('system-diagnostics [data-tile-layout-row]').screenshot({ path: path.join(SHOTS, 'settings-tile-layout.png') });
      const saved = page.waitForResponse((r) => r.url().includes('/api/v1/settings') && r.request().method() === 'PATCH');
      await page.locator('system-diagnostics sw-button', { hasText: 'שמור עיצוב' }).click();
      expect((await saved).status()).toBe(200);
      expect((await (await request.get('/api/v1/settings')).json()).settings['ui.tile_layout']).toBe('compact');
      await open(page, '/devices/building');
      const b = page.locator('devices-building');
      await expect(b).toHaveAttribute('data-tile-layout', 'compact', { timeout: 30000 });
      const h = await b.locator('sw-kpi').first().evaluate((e) => e.getBoundingClientRect().height);
      expect(h).toBeLessThanOrEqual(80);
      await open(page, '/live');
      await expect(page.locator('live-overview')).toHaveAttribute('data-tile-layout', 'compact');
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'live-compact-desktop.png') });
    } finally {
      await request.patch('/api/v1/settings', { data: { 'ui.tile_layout': 'auto' } });
    }
  });

  test('the tree: long area names are not cut while the row has room; count and "⋯" columns line up (bulk holder)', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the tree panel is a desktop view');
    await seed(request);
    await page.setViewportSize({ width: 2000, height: 990 });
    await open(page, '/devices/building');
    const tree = page.locator('devices-building nav.tree');
    await expect(tree.locator('[data-area-row="cr007t_service"]')).toBeVisible({ timeout: 30000 });
    for (const id of ['cr007t_stairs', 'cr007t_service']) {
      const cut = await tree.locator(`[data-area-row="${id}"] .nm`).evaluate((e) => e.scrollWidth > e.clientWidth + 1);
      expect(cut, id).toBe(false);
    }
    // the hover "כבה אזור" takes no room in the row
    await expect(tree.locator('.tree-area .quick').first()).toHaveCSS('position', 'absolute');
    const ends = await tree.locator('.tree-row .lit').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
    expect(new Set(ends).size, JSON.stringify(ends)).toBe(1);
    if (SHOTS) await tree.screenshot({ path: path.join(SHOTS, 'tree-after-2000x990-fixture.png') });
  });

  // ---------------------------------------------------------------- owner answers 2026-09-29: the master control

  test('lights: the smart master button shows the group state, asks the question, acts on what is shown (scope + filter + search) through the bulk flow', async ({ page, request }, testInfo) => {
    test.setTimeout(90_000);
    await seed(request);
    const previews: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/v1/devices/actions/preview')) previews.push(decodeURIComponent(r.url()));
    });
    await open(page, '/devices/building?domain=lights');
    const panel = page.locator('devices-building devices-tiles-panel');
    const master = panel.locator('button[data-panel-master="lights"]');
    // one of two on: filled, a count badge, the words only in the label / tooltip
    await expect(master).toHaveAttribute('data-state', 'mixed', { timeout: 30000 });
    await expect(master.locator('[data-master-badge]')).toHaveText(/1/);
    await expect(master).toHaveAttribute('aria-label', /כבה את כל התאורה/);
    await expect(master).toHaveAttribute('title', 'כבה את כל התאורה');
    const box = await master.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await master.click();
    const dlg = panel.locator('devices-bulk-dialog');
    await expect(dlg.locator('[data-bulk-question]')).toHaveText('לכבות גוף תאורה אחד?', { timeout: 10000 });
    expect(previews.at(-1)).toContain('kind=lights_off');
    expect(previews.at(-1)).not.toContain('only=');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `master-confirm-${testInfo.project.name}.png`) });
    await dlg.locator('sw-button[data-bulk-confirm]').click();
    await expect(dlg.locator('[data-bulk-result="ok"]')).toBeVisible({ timeout: 20000 });
    await dlg.locator('sw-button[data-bulk-cancel]').click();
    await expect(panel).toHaveAttribute('open', ''); // the confirmation closed, the panel stays
    await expect(master).toHaveAttribute('data-state', 'off', { timeout: 10000 });
    await expect(master).toHaveAttribute('aria-label', 'הדלק את כל התאורה');
    // narrowed by the search: only the office light
    await panel.locator('input[data-panel-search]').fill('משרד');
    await master.click();
    await expect(dlg.locator('[data-bulk-question]')).toHaveText('להדליק גוף תאורה אחד?', { timeout: 10000 });
    expect(previews.at(-1)).toContain('only=light.cr007t_office');
    await dlg.locator('sw-button[data-bulk-confirm]').click();
    await expect(dlg.locator('[data-bulk-result="ok"]')).toBeVisible({ timeout: 20000 });
    const e = await (await request.get('/api/v1/ha/entities/light.cr007t_office')).json();
    expect(e.state).toBe('on');
    expect((await (await request.get('/api/v1/ha/entities/light.cr007t_stairs')).json()).state).toBe('off');
    await seed(request);
  });

  test('switches: only switches an administrator marked bulk-safe are ever sent (the "כבה הכל" rule), for ON as for OFF', async ({ page, request }) => {
    await seed(request);
    await request.put('/api/v1/devices/entities/switch.cr007t_sign/bulk-safe', { data: { bulk_safe: false } });
    await open(page, '/devices/building?domain=switches');
    const panel = page.locator('devices-building devices-tiles-panel');
    const master = panel.locator('button[data-panel-master="switches"]');
    await expect(master).toHaveAttribute('data-state', 'mixed', { timeout: 30000 });
    await master.click();
    const dlg = panel.locator('devices-bulk-dialog');
    await expect(dlg.locator('[data-bulk-nothing]')).toBeVisible({ timeout: 10000 }); // nothing marked: nothing to send
    await expect(dlg.locator('[data-bulk-excluded] li[data-entity="switch.cr007t_sign"]')).toHaveAttribute('data-reason', 'switch_not_marked');
    await dlg.locator('sw-button[data-bulk-cancel]').click();
    expect((await request.put('/api/v1/devices/entities/switch.cr007t_sign/bulk-safe', { data: { bulk_safe: true } })).status()).toBe(200);
    await master.click();
    await expect(dlg.locator('[data-bulk-question]')).toHaveText('לכבות מתג אחד?', { timeout: 10000 });
    await dlg.locator('sw-button[data-bulk-cancel]').click();
    await request.put('/api/v1/devices/entities/switch.cr007t_sign/bulk-safe', { data: { bulk_safe: false } });
  });

  test('locks: a lock-all icon (never unlock-all) - one confirmation, then each lock locked one at a time with its own result', async ({ page, request }) => {
    await seed(request);
    await request.post('/api/v1/ha/dev/states', { data: { states: [{ entity_id: 'lock.cr007t_front', state: 'unlocked', attributes: { friendly_name: 'דלת כניסה', device_class: 'lock' } }] } });
    const sent: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'POST' && /\/ha\/entities\/lock\.[^/]+\/actions$/.test(r.url())) sent.push((r.postDataJSON() as { allowed_action_id: string }).allowed_action_id);
    });
    await open(page, '/devices/building?domain=locks');
    const panel = page.locator('devices-building devices-tiles-panel');
    const all = panel.locator('button[data-panel-master="locks"]');
    await expect(all).toBeEnabled({ timeout: 30000 });
    await expect(all).toHaveAttribute('title', 'נעל את כל המנעולים');
    await expect(panel.locator('[data-master*="unlock"]')).toHaveCount(0);
    await all.click();
    const dlg = panel.locator('sw-dialog[data-lock-all-dialog="confirm"]');
    await expect(dlg.locator('[data-lock-all-question]')).toHaveText('לנעול מנעול אחד?');
    expect(sent).toEqual([]);
    await dlg.locator('sw-button[data-lock-all-confirm]').click();
    await expect(panel.locator('sw-dialog[data-lock-all-dialog="done"] [data-lock-all-question]')).toHaveText('ננעלו 1 מתוך 1', { timeout: 15000 });
    expect(sent).toEqual(['lock.lock']);
    await expect(panel.locator('[data-lock-all-item="lock.cr007t_front"]')).toHaveAttribute('data-outcome', 'confirmed');
    await panel.locator('sw-button[data-lock-all-close]').click();
    await expect(panel.locator('.row[data-entity="lock.cr007t_front"] [data-row-state]')).toHaveText('נעול', { timeout: 10000 });
    await expect(all).toBeDisabled(); // everything is locked now
  });

  test('review B1: Escape, ✕ and the backdrop of a nested confirmation close only that confirmation - the panel stays open and focus returns', async ({ page, request }) => {
    await seed(request);
    await request.post('/api/v1/ha/dev/states', { data: { states: [{ entity_id: 'lock.cr007t_front', state: 'unlocked', attributes: { friendly_name: 'דלת כניסה', device_class: 'lock' } }] } });
    await open(page, '/devices/building?domain=lights');
    const panel = page.locator('devices-building devices-tiles-panel');
    const master = panel.locator('button[data-panel-master="lights"]');
    const question = panel.locator('devices-bulk-dialog [data-bulk-question]');
    const focusedMaster = () => page.evaluate(() => {
      let a: Element | null = document.activeElement;
      while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
      return a?.getAttribute('data-panel-master') ?? a?.tagName ?? null;
    });
    // Escape
    await master.click();
    await expect(question).toBeVisible({ timeout: 10000 });
    await page.keyboard.press('Escape');
    await expect(question).toHaveCount(0);
    await expect(panel).toHaveAttribute('open', '');
    await expect.poll(focusedMaster).toBe('lights');
    // ✕
    await master.click();
    await expect(question).toBeVisible({ timeout: 10000 });
    await panel.locator('devices-bulk-dialog sw-dialog sw-button[label="סגור"]').click();
    await expect(question).toHaveCount(0);
    await expect(panel).toHaveAttribute('open', '');
    // the confirmation's own backdrop
    await master.click();
    await expect(question).toBeVisible({ timeout: 10000 });
    await page.mouse.click(4, 4);
    await expect(question).toHaveCount(0);
    await expect(panel).toHaveAttribute('open', '');
    // the lock-all confirmation, the same
    await page.evaluate(() => (location.hash = '#/devices/building?domain=locks'));
    const all = panel.locator('button[data-panel-master="locks"]');
    await all.click({ timeout: 15000 });
    await expect(panel.locator('sw-dialog[data-lock-all-dialog="confirm"]')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(panel.locator('sw-dialog[data-lock-all-dialog="confirm"]')).toHaveCount(0);
    await expect(panel).toHaveAttribute('open', '');
    // and the panel's own Escape still closes it
    await page.keyboard.press('Escape');
    await expect(panel).not.toHaveAttribute('open', '');
    await seed(request);
  });

  test('review M4: a push about a listed row patches it in place (no refetch); an entity the panel does not list refetches', async ({ page, request }) => {
    await seed(request);
    await open(page, '/devices/building?domain=switches');
    const panel = page.locator('devices-building devices-tiles-panel');
    const pump = panel.locator('.row[data-entity="switch.cr007t_pump"]');
    await expect(pump).toHaveAttribute('data-state', 'inactive', { timeout: 30000 });
    await page.waitForTimeout(1500);
    const fetched: number[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/v1/devices/items')) fetched.push(Date.now());
    });
    await request.post('/api/v1/ha/dev/states', { data: { states: [{ entity_id: 'switch.cr007t_pump', state: 'on', attributes: { friendly_name: 'משאבת מים' } }] } });
    await expect(pump).toHaveAttribute('data-state', 'active', { timeout: 5000 });
    await expect(panel.locator('.seg button[data-filter="active"]')).toContainText('2');
    await page.waitForTimeout(1500);
    expect(fetched).toEqual([]);
    // a switch the panel has never listed: refetched (it may have entered the scope)
    await request.post('/api/v1/ha/dev/states', { data: { states: [{ entity_id: `switch.cr007t_new_${Date.now()}`, state: 'off', attributes: { friendly_name: 'מתג חדש' } }] } });
    await expect.poll(() => fetched.length, { timeout: 5000 }).toBeGreaterThan(0);
    await seed(request);
  });

  test('review M5: the preview shows the installation value; a local override is named next to it and can be cleared', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the settings screen');
    await page.addInitScript(() => localStorage.setItem('sw.tiles.override', 'cards'));
    await open(page, '/system/diagnostics');
    const sel = page.locator('system-diagnostics select[data-set-tile-layout]');
    await expect(sel).toBeVisible({ timeout: 30000 });
    const note = page.locator('system-diagnostics [data-tile-override-note]');
    await expect(note).toContainText('כרטיסים');
    await sel.selectOption('compact');
    await expect(page.locator('system-diagnostics [data-tile-preview]')).toHaveAttribute('data-tile-preview', 'compact'); // not the override's cards
    await page.evaluate(() => localStorage.removeItem('sw.tiles.override')); // the init script would set it again on a reload only
    await page.evaluate(() => localStorage.setItem('sw.tiles.override', 'cards'));
    await page.locator('system-diagnostics sw-button[data-tile-override-clear]').click();
    await expect(note).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('sw.tiles.override'))).toBeNull();
  });
});
