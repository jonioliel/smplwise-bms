import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// UI round 1 (2026-09-30), the tabs: הגדרות › כללי › לשוניות (`ui.tabs`: show / hide / reorder every navigation section's
// tabs, installation-wide), the map's default floor (`map.default_floor`) and the device catalogue that left the map for
// הגדרות › קטלוג התקנים. Static preview + a mocked backend (page.route on api/v1), like evidence-security-r1.spec.ts: this checks
// what the client does with the settings and permissions it is given and what it sends; the server's own validation is the
// backend tests (tests/test_ui_tabs_config.py), and the round trip against a real backend is evidence-tabs-live.spec.ts.
//   SW_BASE_URL=http://127.0.0.1:4741/ npx playwright test tests/evidence-tabs-ui.spec.ts --project=desktop --project=mobile --workers=1

const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/evidence/UIR1-tabs');

const VIEWER = ['video.live', 'video.playback', 'devices.read', 'map.read', 'entity.state.read', 'events.read'];
const ADMIN = [...VIEWER, 'access.read', 'alarm.view', 'cases.manage', 'rules.manage', 'video.export', 'system.configure', 'sources.configure', 'rbac.assign', 'audit.read'];

const floor = (id: string, name: string) => ({ id, building_id: 'b', name, level: 0, sort_order: 0, ha_area_id: null, has_plan: true, published_version_id: null, plan_width_px: null, plan_height_px: null, draft_version_id: null, anchor_count: 0, camera_count: 0, updated_at: '' });
const TREE = [
  {
    id: 's1', name: 'אפרת', address: '', timezone: 'Asia/Jerusalem', sort_order: 0, updated_at: '',
    buildings: [
      { id: 'b1', site_id: 's1', name: 'בניין א', sort_order: 0, updated_at: '', floors: [floor('f-a1', 'קומת קרקע'), floor('f-a2', 'קומה 1')] },
      { id: 'b2', site_id: 's1', name: 'בניין ב', sort_order: 1, updated_at: '', floors: [floor('f-b1', 'קומת כניסה')] },
    ],
  },
];
const entity = (id: string, name: string) => ({
  entity_id: id, registry_id: null, platform: 'demo', device_id: null, area_id: null, area_name: 'סלון', ha_floor_id: null, ha_floor_name: null, name, original_name: name, domain: id.split('.')[0],
  device_class: null, unit: null, icon: null, entity_category: null, disabled: false, hidden: false, supported_features: null, state: 'on', attributes: {}, last_changed: null, last_updated: null,
  state_seen_at: null, available: true, removed_at: null, fresh: true, placements: [], actions: [],
});

interface Tabs {
  [section: string]: { order: string[]; hidden: string[] };
}
interface MockState {
  perms: string[];
  uiTabs: Tabs;
  defaultFloor: string;
  /** floors this user's tree lacks (a floor-scoped user) */
  hideFloors: string[];
  /** the user's own nav.order on the server (null = none) */
  ownOrder: string[] | null;
  patches: Record<string, unknown>[];
  entityRequests: number;
}

async function install(page: Page, st: MockState) {
  await page.route('**/api/v1/**', (route: Route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const err = (status: number, code: string, msg: string) => json({ code, user_message: msg, retryable: false, correlation_id: '', details: {} }, status);
    if (p === 'me') {
      return json({
        channel: 'local', remote: null,
        user: { id: 'u-test', username: 'u-test', display_name: 'בודק', source: 'ingress' },
        active: true, bindings: [{ id: 'b1', role_id: 'r', role_name: 'בדיקה', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
        permissions_installation: st.perms, permissions_any: st.perms, has_access: true, permission_revision: 1,
        permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full',
      });
    }
    if (p === 'me/prefs') return json({ prefs: { 'nav.order': st.ownOrder ?? ['devices', 'security', 'explore', 'wiskey'] }, stored: st.ownOrder ? ['nav.order'] : [], updated_at: null });
    if (p === 'settings' && req.method() === 'PATCH') {
      const body = req.postDataJSON() as Record<string, unknown>;
      st.patches.push(body);
      if ('map.default_floor' in body) {
        const v = String(body['map.default_floor']);
        const known = TREE.flatMap((s) => s.buildings.flatMap((b) => b.floors.map((f) => f.id)));
        if (v && !known.includes(v)) return err(422, 'validation', 'קומת ברירת המחדל של המפה לא קיימת.');
        st.defaultFloor = v;
      }
      if ('ui.tabs' in body) st.uiTabs = body['ui.tabs'] as Tabs;
    }
    if (p === 'settings') {
      return json({
        settings: { 'ui.design': 'a', 'ui.start_route': 'devices', 'ui.hide_map': 'false', 'ui.hide_wiskey': 'false', 'ui.hide_search': 'false', 'ui.security_snapshot': 'true', 'ui.tabs': st.uiTabs, 'map.default_floor': st.defaultFloor },
        can_edit: st.perms.includes('system.configure'),
      });
    }
    if (p === 'sites' || p.startsWith('sites?')) {
      const sites = TREE.map((s) => ({ ...s, buildings: s.buildings.map((b) => ({ ...b, floors: b.floors.filter((f) => !st.hideFloors.includes(f.id)) })) })).filter((s) => s.buildings.some((b) => b.floors.length));
      return json({ sites, can_create_site: false });
    }
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-09-30T00:00:00Z', version: 'test' });
    if (p === 'health') return json({ status: 'ok', version: 'test', nvr_configured: true, mode: 'full', discovery: { cameras: 8, cameras_last_ok: null, cameras_last_error: null }, events: { ingest: { connected: true, last_error: null } } });
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    if (p === 'alarm/panels') return json({ panels: [], counts: { panels: 0 } });
    if (p.startsWith('ha/entities')) {
      st.entityRequests += 1;
      const q = new URL(req.url()).searchParams.get('q') ?? '';
      const all = [entity('light.hall', 'תאורת מסדרון'), entity('switch.boiler', 'דוד'), entity('lock.front', 'דלת כניסה')].filter((e) => !q || e.entity_id.includes(q) || (e.name ?? '').includes(q));
      return json({ entities: all, domains: { light: 1, switch: 1, lock: 1 }, areas: [], can_control: false, sync: { connected: true, last_snapshot_at: null, last_event_at: null, last_registry_at: null, last_error: null, reconnects: 0, sequence: 1, entities: 3, started_at: null, ha_version: '2026.9' } });
    }
    if (p === 'cameras') return json({ cameras: [], recorder: null, can_sync: false });
    return err(404, 'not_found', 'לא נמצא (בדיקה)');
  });
}

async function open(page: Page, hash: string) {
  await page.goto('about:blank');
  await page.goto(`/?design=a#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(700);
}

const hashOf = (page: Page) => page.evaluate(() => location.hash);
const phone = (info: { project: { name: string } }) => info.project.name === 'mobile';
const navSel = (info: { project: { name: string } }) => (phone(info) ? 'sw-app nav.bottom' : 'sw-app nav.rail');
const rail = (page: Page, info: { project: { name: string } }) => page.locator(`${navSel(info)} a[data-nav]`).evaluateAll((els) => els.map((e) => e.getAttribute('data-nav') ?? ''));
const rowTabs = (page: Page) => page.locator('sw-app .subnav sw-tabs a').allTextContents();
async function shot(page: Page, name: string) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCE, `${name}.png`) });
}

test.describe('tabs configuration, the map default floor and the device catalogue (mocked backend)', () => {
  let st: MockState;

  test.beforeEach(async ({ page }) => {
    st = { perms: ADMIN, uiTabs: {}, defaultFloor: '', hideFloors: [], ownOrder: null, patches: [], entityRequests: 0 };
    await page.addInitScript(() => {
      try {
        localStorage.removeItem('sw.nav.order');
        localStorage.removeItem('sw.security.section');
      } catch {
        /* storage unavailable */
      }
    });
    await install(page, st);
  });

  test('nothing configured: the built-in tabs; the map has two tabs and the catalogue is a settings page', async ({ page }, info) => {
    await open(page, '/explore/sites');
    expect(await rail(page, info)).toEqual(['devices', 'security', 'explore', 'wiskey']);
    expect(await rowTabs(page)).toEqual(['אתרים ומבנים', 'מפת קומה']);
    if (info.project.name === 'desktop') await shot(page, 'map-two-tabs-desktop');
    else await shot(page, 'map-two-tabs-phone');
    await open(page, '/system/diagnostics');
    expect(await rowTabs(page)).toContain('קטלוג התקנים');
  });

  test('#/explore/entities: settings (query kept) for system.configure, the map for everyone else; the settings page checks it too', async ({ page }, info) => {
    await open(page, '/explore/entities?q=light.hall');
    await expect.poll(() => hashOf(page)).toBe('#/system/entities?q=light.hall');
    const cat = page.locator('sw-app explore-entities');
    await expect(cat).toHaveCount(1);
    await expect(cat.locator('sw-table tbody tr')).toHaveCount(1); // the search from the link is applied
    await expect(cat.locator('input[type="search"]')).toHaveValue('light.hall');
    const active = page.locator('sw-app .subnav sw-tabs a[aria-current="page"]');
    await expect(active).toHaveText('קטלוג התקנים');
    if (info.project.name === 'desktop') await shot(page, 'settings-entities-desktop');
    else await shot(page, 'settings-entities-phone');

    // a viewer holds entity.state.read and map.read but not system.configure
    st.perms = VIEWER;
    st.entityRequests = 0;
    await open(page, '/explore/entities?q=light.hall');
    await expect.poll(() => hashOf(page)).toBe('#/explore/floors/f-a1'); // the map's own entry, then its first floor
    expect(await rowTabs(page)).toEqual(['אתרים ומבנים', 'מפת קומה']);
    // typing the settings address by hand: no catalogue, no request
    await open(page, '/system/entities');
    await expect(page.locator('sw-app explore-entities [data-entities-forbidden]')).toHaveCount(1);
    expect(st.entityRequests).toBe(0);
  });

  test('the map default floor: the entry opens it; a floor this user cannot read falls back to their first floor; automatic = the first', async ({ page }) => {
    await open(page, '/explore/floors/f0');
    await expect.poll(() => hashOf(page)).toBe('#/explore/floors/f-a1'); // automatic
    st.defaultFloor = 'f-b1';
    await open(page, '/explore/floors/f0');
    await expect.poll(() => hashOf(page)).toBe('#/explore/floors/f-b1');
    st.hideFloors = ['f-b1']; // a floor-scoped user whose tree lacks the default
    await open(page, '/explore/floors/f0');
    await expect.poll(() => hashOf(page)).toBe('#/explore/floors/f-a1');
    st.defaultFloor = 'f-gone'; // a deleted floor the server has not cleared yet
    st.hideFloors = [];
    await open(page, '/explore/floors/f0');
    await expect.poll(() => hashOf(page)).toBe('#/explore/floors/f-a1');
  });

  test('the settings control "קומת ברירת מחדל במפה": grouped by building, saved as map.default_floor', async ({ page }, info) => {
    await open(page, '/system/diagnostics?tab=map');
    const sel = page.locator('sw-app system-diagnostics [data-set-default-floor]');
    await expect(sel).toBeVisible();
    await expect(sel.locator('optgroup')).toHaveCount(2);
    await expect(sel.locator('optgroup').first()).toHaveAttribute('label', 'אפרת › בניין א');
    await expect(sel.locator('option').first()).toHaveText('אוטומטי');
    await sel.selectOption('f-b1');
    if (info.project.name === 'desktop') await shot(page, 'settings-map-default-floor-desktop');
    await page.locator('sw-app system-diagnostics [data-save-map]').click();
    await expect.poll(() => st.patches.length).toBe(1);
    expect(st.patches[0]).toEqual({ 'map.default_floor': 'f-b1' });
    expect(st.defaultFloor).toBe('f-b1');
    // "אוטומטי" clears it
    await sel.selectOption('');
    await page.locator('sw-app system-diagnostics [data-save-map]').click();
    await expect.poll(() => st.patches.length).toBe(2);
    expect(st.patches[1]).toEqual({ 'map.default_floor': '' });
  });

  test('ui.tabs shapes every row: order, hidden, the section that opens first, the rail; deep links to hidden tabs still work', async ({ page }, info) => {
    st.uiTabs = {
      areas: { order: ['explore', 'security', 'devices', 'wiskey'], hidden: [] },
      security: { order: ['investigate', 'live'], hidden: [] },
      'security.investigate': { order: ['search', 'events'], hidden: ['cases', 'rules'] },
      'security.live': { order: ['wall', 'views'], hidden: ['overview'] },
      explore: { order: ['floors', 'sites'], hidden: [] },
    };
    await open(page, '/security');
    await expect.poll(() => hashOf(page)).toBe('#/investigate/search'); // חקירה first, its first visible tab
    const tabs = await rowTabs(page);
    expect(tabs.slice(0, 3)).toEqual(['חיפוש', 'מרכז אירועים', 'הקלטות']);
    expect(tabs).not.toContain('תיקים');
    expect(tabs).not.toContain('חוקים והתראות');
    if (!phone(info)) {
      await expect(page.locator('sw-app main nav[data-security-sections] a')).toHaveText(['חקירה', 'לייב']);
      await shot(page, 'security-configured-desktop');
    } else {
      await expect(page.locator('sw-app nav.secrow a')).toHaveText(['חקירה', 'לייב']);
      await shot(page, 'security-configured-phone');
    }
    expect(await rail(page, info)).toEqual(['explore', 'security', 'devices', 'wiskey']);
    // the map lands on its first visible tab, the floor map
    await expect(page.locator(`${navSel(info)} a[data-nav="explore"]`)).toHaveAttribute('href', '#/explore/floors/f0');
    // לייב opens on all cameras (the overview is hidden here)
    await page.goto('about:blank');
    await open(page, '/live/wall');
    expect(await rowTabs(page)).toEqual(['כל המצלמות', 'תצוגות שמורות']);
    // a hidden tab's address still works for someone with its permission
    await open(page, '/investigate/cases');
    await expect(page.locator('sw-app investigate-cases')).toHaveCount(1);
    expect(await rowTabs(page)).not.toContain('תיקים');
  });

  test('permissions still gate first; a section is never left without a tab; the user own order wins over the admin order', async ({ page }, info) => {
    st.uiTabs = { areas: { order: ['explore', 'security', 'devices', 'wiskey'], hidden: ['wiskey'] }, explore: { order: [], hidden: ['sites', 'floors'] }, 'security.investigate': { order: ['cases', 'events'], hidden: [] } };
    st.perms = VIEWER; // no cases.manage: cases never shows, whatever the order says
    await open(page, '/explore/sites');
    expect(await rail(page, info)).toEqual(['explore', 'security', 'devices']); // wiskey hidden (and not permitted)
    expect(await rowTabs(page)).toEqual(['אתרים ומבנים', 'מפת קומה']); // every explore tab hidden: shown after all, no lock-out
    await open(page, '/investigate/events');
    expect((await rowTabs(page))[0]).toBe('מרכז אירועים');
    expect(await rowTabs(page)).not.toContain('תיקים');
    // the user's own order (stored on the server) wins for that user
    st.ownOrder = ['devices', 'explore', 'security', 'wiskey'];
    await open(page, '/explore/sites');
    await expect.poll(() => rail(page, info)).toEqual(['devices', 'explore', 'security']);
  });

  test('the editor: sections from the registry, reorder by buttons / keyboard / drag, hide with the last one protected, save, reset', async ({ page }, info) => {
    await open(page, '/system/diagnostics?tab=tabs');
    const ed = page.locator('sw-app system-diagnostics system-tabs-config');
    await expect(ed).toBeVisible();
    await expect(ed.locator('[data-tabs-section]')).toHaveCount(9);
    expect(await ed.locator('[data-tabs-section]').evaluateAll((els) => els.map((e) => e.getAttribute('data-tabs-section')))).toEqual(['areas', 'devices', 'security', 'security.live', 'security.investigate', 'explore', 'wiskey', 'system', 'system.security']);
    const rows = (sec: string) => ed.locator(`li[data-sec="${sec}"] .name`).allTextContents();
    expect(await rows('explore')).toEqual(['אתרים ומבנים', 'מפת קומה']);
    expect((await rows('security.live')).map((s) => s.trim())).toEqual(['תמונת מצב', 'כל המצלמות', 'תצוגות שמורות']);
    expect((await rows('security')).map((s) => s.trim())).toEqual(['לייב', 'חקירה', 'אזעקה']); // the alarm section: listed, last by default
    const save = ed.locator('[data-tabs-save]');
    await expect(save.locator('button')).toBeDisabled();
    if (info.project.name === 'desktop') await shot(page, 'editor-default-desktop');

    // buttons: the map's floor tab up
    await ed.locator('li[data-sec="explore"][data-tab="floors"] .mv[data-move="up"]').click();
    expect(await rows('explore')).toEqual(['מפת קומה', 'אתרים ומבנים']);
    await expect(save.locator('button')).toBeEnabled();
    // keyboard: the handle's arrow keys, with the announcement
    await ed.locator('li[data-sec="security"][data-tab="live"] .handle').focus();
    await page.keyboard.press('ArrowDown');
    expect((await rows('security')).map((s) => s.trim())).toEqual(['חקירה', 'לייב', 'אזעקה']);
    await expect(ed.locator('[data-tabs-announce]')).toContainText('לייב הועבר למקום 2 מתוך 3');
    await expect(ed.locator('li[data-sec="security"][data-tab="live"] .handle')).toBeFocused();
    // drag: the third live tab to the top
    if (info.project.name === 'mobile') {
      // a touch device: the rows can lie below the fold and a mouse drag on the emulated phone is a no-op - use the buttons
      const up = ed.locator('li[data-sec="security.live"][data-tab="views"] .mv[data-move="up"]');
      await up.scrollIntoViewIfNeeded();
      await up.click();
      await ed.locator('li[data-sec="security.live"][data-tab="views"] .mv[data-move="up"]').click();
    } else {
      await ed.locator('[data-tabs-section="security.live"]').scrollIntoViewIfNeeded(); // the style card above made the page longer: keep the rows on screen
    const h = await ed.locator('li[data-sec="security.live"][data-tab="views"] .handle').boundingBox();
      const first = await ed.locator('li[data-sec="security.live"][data-tab="overview"]').boundingBox();
      await page.mouse.move(h!.x + h!.width / 2, h!.y + h!.height / 2);
      await page.mouse.down();
      await page.mouse.move(h!.x + h!.width / 2, first!.y + 4, { steps: 8 });
      await page.mouse.up();
    }
    expect((await rows('security.live')).map((s) => s.trim())).toEqual(['תצוגות שמורות', 'תמונת מצב', 'כל המצלמות']);

    // hide: the map's tabs - the last visible one cannot be hidden
    const sitesToggle = ed.locator('li[data-sec="explore"][data-tab="sites"] sw-toggle');
    const floorsToggle = ed.locator('li[data-sec="explore"][data-tab="floors"] sw-toggle');
    await sitesToggle.locator('button').click();
    await expect(ed.locator('li[data-sec="explore"][data-tab="sites"]')).toHaveClass(/off/);
    await expect(floorsToggle).toHaveAttribute('disabled', '');
    // the way back to this editor cannot be hidden
    await expect(ed.locator('li[data-sec="system"][data-tab="general"] sw-toggle')).toHaveAttribute('disabled', '');
    // hide "תיקים" of the investigation
    await ed.locator('li[data-sec="security.investigate"][data-tab="cases"] sw-toggle button').click();
    await ed.locator('[data-tabs-section="security.investigate"]').scrollIntoViewIfNeeded();
    if (info.project.name === 'desktop') await shot(page, 'editor-edited-desktop');
    else await shot(page, 'editor-edited-phone');
    await save.click();
    await expect.poll(() => st.patches.length).toBe(1);
    expect(st.patches[0]).toEqual({
      'ui.tabs': {
        explore: { order: ['floors', 'sites'], hidden: ['sites'] },
        security: { order: ['investigate', 'live', 'alarm'], hidden: [] },
        'security.live': { order: ['views', 'overview', 'wall'], hidden: [] },
        'security.investigate': { order: [], hidden: ['cases'] },
      },
    });
    await expect(ed.locator('.ok')).toHaveText('הלשוניות נשמרו');
    await expect(save.locator('button')).toBeDisabled();

    // the navigation follows at once, without a reload: חקירה first, no "תיקים"
    await page.evaluate(() => (location.hash = '#/security'));
    await expect.poll(() => hashOf(page)).toBe('#/investigate/events');
    expect(await rowTabs(page)).not.toContain('תיקים');

    // reset one section to its defaults and save: the stored object shrinks
    await open(page, '/system/diagnostics?tab=tabs');
    const ed2 = page.locator('sw-app system-diagnostics system-tabs-config');
    await expect(ed2.locator('[data-tabs-reset="security"]')).toBeEnabled();
    await expect(ed2.locator('[data-tabs-reset="wiskey"]')).toBeDisabled();
    await ed2.locator('[data-tabs-reset="security"]').click();
    await ed2.locator('[data-tabs-reset="explore"]').click();
    await ed2.locator('[data-tabs-save]').click();
    await expect.poll(() => st.patches.length).toBe(2);
    expect(st.patches[1]).toEqual({ 'ui.tabs': { 'security.live': { order: ['views', 'overview', 'wall'], hidden: [] }, 'security.investigate': { order: [], hidden: ['cases'] } } });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  test('ids the editor does not know (a WisKey tab not loaded in this browser) keep their stored place through a save', async ({ page }) => {
    st.uiTabs = { wiskey: { order: ['zzz', 'events'], hidden: ['zzz'] } };
    await open(page, '/system/diagnostics?tab=tabs');
    const ed = page.locator('sw-app system-diagnostics system-tabs-config');
    await expect(ed.locator('li[data-sec="wiskey"] .name').first()).toHaveText('פעילות'); // 'events' named first, the rest by default
    await ed.locator('li[data-sec="wiskey"][data-tab="people"] sw-toggle button').click();
    await ed.locator('[data-tabs-save]').click();
    await expect.poll(() => st.patches.length).toBe(1);
    expect(st.patches[0]).toEqual({ 'ui.tabs': { wiskey: { order: ['events', 'overview', 'people', 'devices', 'sync', 'health', 'audit', 'tools', 'zzz'], hidden: ['people', 'zzz'] } } });
  });
});
