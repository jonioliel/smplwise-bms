import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 0.1.148 (owner request 2026-09-30): the look of the tab bars. The first hierarchy level of an area (home, the security
// sections, map, WisKey, settings) is the narrow segmented pill by default; the sub-tabs (the pages of לייב and חקירה, and of
// הגדרות › אבטחה) are the compact underline row. הגדרות › כללי › לשוניות › סגנון סרגל picks a default per level and an override
// per section (`ui.tabs`: `styles` + a `style` per section). Static preview + a mocked backend (page.route on api/v1); the
// server's validation of the values is backend tests/test_ui_tabs_config.py.
//   SW_BASE_URL=http://127.0.0.1:4931/ npx playwright test tests/evidence-tabs-styles.spec.ts --project=desktop --project=mobile --workers=1

const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/evidence/UIR2-tabs');

const ADMIN = ['video.live', 'video.playback', 'devices.read', 'map.read', 'entity.state.read', 'events.read', 'access.read', 'alarm.view', 'cases.manage', 'rules.manage', 'video.export', 'system.configure', 'sources.configure', 'rbac.assign', 'audit.read', 'schedule.view', 'schedule.manage'];

interface MockState {
  uiTabs: Record<string, unknown>;
  patches: Record<string, unknown>[];
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
        permissions_installation: ADMIN, permissions_any: ADMIN, has_access: true, permission_revision: 1,
        permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full',
      });
    }
    if (p === 'me/prefs') return json({ prefs: { 'nav.order': ['devices', 'security', 'explore', 'wiskey'] }, stored: [], updated_at: null });
    if (p === 'settings' && req.method() === 'PATCH') {
      const body = req.postDataJSON() as Record<string, unknown>;
      st.patches.push(body);
      if ('ui.tabs' in body) st.uiTabs = body['ui.tabs'] as Record<string, unknown>;
    }
    if (p === 'settings') {
      return json({ settings: { 'ui.start_route': 'devices', 'ui.hide_map': 'false', 'ui.hide_wiskey': 'false', 'ui.hide_search': 'false', 'ui.security_snapshot': 'true', 'schedules.enabled': 'true', 'ui.tabs': st.uiTabs }, can_edit: true });
    }
    if (p === 'sites' || p.startsWith('sites?')) return json({ sites: [], can_create_site: false });
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-09-30T00:00:00Z', version: 'test' });
    if (p === 'health') return json({ status: 'ok', version: 'test', nvr_configured: true, mode: 'full', discovery: { cameras: 8, cameras_last_ok: null, cameras_last_error: null }, events: { ingest: { connected: true, last_error: null } } });
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    if (p === 'alarm/panels') return json({ panels: [{ entity_id: 'alarm_control_panel.home', name: 'בית' }], counts: { panels: 1 } });
    if (p === 'cameras') return json({ cameras: [], recorder: null, can_sync: false });
    return err(404, 'not_found', 'לא נמצא (בדיקה)');
  });
}

async function open(page: Page, hash: string) {
  await page.goto('about:blank');
  await page.goto(`/?design=a#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(900);
}

const phone = (info: { project: { name: string } }) => info.project.name === 'mobile';
const size = (info: { project: { name: string } }) => (phone(info) ? 'phone' : 'desktop');
async function shot(page: Page, name: string, info: { project: { name: string } }) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCE, `${name}-${size(info)}.png`) });
}

/** What the shell's tab row looks like: its style, the tab hit height, the row's footprint in the layout, where the page starts. */
async function bar(page: Page) {
  return page.locator('sw-app').evaluate((app) => {
    const root = app.shadowRoot!;
    const host = root.querySelector<HTMLElement>('sw-tabs[data-area-tabs]');
    if (!host) return null;
    const hr = host.getBoundingClientRect();
    const cs = getComputedStyle(host);
    const a = host.shadowRoot!.querySelector<HTMLElement>('a')!;
    const ar = a.getBoundingClientRect();
    const screen = root.querySelector<HTMLElement>('.screen')!.getBoundingClientRect();
    const sub = root.querySelector<HTMLElement>('.subnav')!.getBoundingClientRect();
    const track = host.shadowRoot!.querySelector<HTMLElement>('.row')!;
    const on = host.shadowRoot!.querySelector<HTMLElement>('.on')!.getBoundingClientRect();
    const lbl = host.shadowRoot!.querySelector<HTMLElement>('.on .lbl')!.getBoundingClientRect();
    return {
      variant: host.getAttribute('data-variant'),
      hostH: Math.round(hr.height),
      layoutH: Math.round(hr.height + parseFloat(cs.marginTop || '0') + parseFloat(cs.marginBottom || '0')),
      hitH: Math.round(ar.height),
      visibleH: Math.round(lbl.height),
      subnavH: Math.round(sub.height),
      pageTop: Math.round(screen.top),
      rowW: Math.round(track.getBoundingClientRect().width),
      hostW: Math.round(hr.width),
      scrolls: host.scrollWidth > host.clientWidth + 1,
      fade: host.getAttribute('data-fade') ?? '',
      activeInView: on.left >= hr.left - 1 && on.right <= hr.right + 1,
    };
  });
}

const variantOf = (page: Page) => page.locator('sw-app').evaluate((app) => app.shadowRoot!.querySelector('sw-tabs[data-area-tabs]')?.getAttribute('data-variant') ?? null);

test.describe('tab bar styles (mocked backend)', () => {
  let st: MockState;

  test.beforeEach(async ({ page }) => {
    st = { uiTabs: {}, patches: [] };
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

  test('defaults: the first level of every area is the narrow pill, the security sub-tabs the compact underline row', async ({ page }, info) => {
    // level 1: home, map, WisKey, settings - the tab row itself is a pill
    for (const [name, hash] of [['home', '/devices/building'], ['map', '/explore/sites'], ['wiskey', '/wiskey/overview'], ['settings', '/system/diagnostics']] as const) {
      await open(page, hash);
      expect(await variantOf(page), name).toBe('pill');
      await shot(page, `${name}-pill`, info);
    }
    // security: the sections (level 1) are the segmented control as before, its pages (level 2) the compact underline row
    await open(page, '/live/wall');
    expect(await variantOf(page)).toBe('underline-compact');
    await expect(page.locator(phone(info) ? 'sw-app nav.secrow' : 'sw-app nav[data-security-sections]')).toHaveCount(1);
    await expect(page.locator('sw-app nav.sectabs')).toHaveCount(0);
    await shot(page, 'security-live', info);
    await open(page, '/investigate/events');
    expect(await variantOf(page)).toBe('underline-compact');
    await shot(page, 'security-investigate', info);
    // הגדרות › אבטחה: its sub-tabs are level 2 too
    await open(page, '/system/security/alarm');
    const style = await page.locator('sw-app system-security sw-tabs').evaluate((el) => el.getAttribute('data-variant'));
    expect(style).toBe('underline-compact');
  });

  test('old or unknown configs fall back to the new defaults', async ({ page }) => {
    st.uiTabs = { explore: { order: [], hidden: [], style: 'glass' }, styles: { level1: 'rounded', level2: 7 }, wiskey: { order: [], hidden: ['tools'] } };
    await open(page, '/explore/sites');
    expect(await variantOf(page)).toBe('pill');
    await open(page, '/live/wall');
    expect(await variantOf(page)).toBe('underline-compact');
    st.uiTabs = { explore: { order: ['floors', 'sites'], hidden: [] } }; // a config from before styles existed
    await open(page, '/explore/sites');
    expect(await variantOf(page)).toBe('pill');
  });

  test('a default per level, and an override per section that wins over it', async ({ page }, info) => {
    st.uiTabs = { styles: { level1: 'underline', level2: 'pill' }, explore: { order: [], hidden: [], style: 'underline-compact' }, 'security.investigate': { order: [], hidden: [], style: 'underline' } };
    await open(page, '/devices/building');
    expect(await variantOf(page)).toBe('underline'); // level 1 default
    await open(page, '/wiskey/overview');
    expect(await variantOf(page)).toBe('underline');
    await open(page, '/explore/sites');
    expect(await variantOf(page)).toBe('underline-compact'); // the section's own choice
    await open(page, '/live/wall');
    expect(await variantOf(page)).toBe('pill'); // level 2 default
    await open(page, '/investigate/events');
    expect(await variantOf(page)).toBe('underline'); // override
    await shot(page, 'security-investigate-underline-override', info);
    // the security sections (level 1 = underline here) are drawn as a tab row too, on the same rules
    await expect(page.locator('sw-app nav.sectabs sw-tabs')).toHaveCount(1);
    expect(await page.locator('sw-app nav.sectabs sw-tabs').evaluate((el) => el.getAttribute('data-variant'))).toBe('underline');
    await expect(page.locator('sw-app nav.sectabs sw-tabs a[aria-current="page"]')).toHaveText('חקירה');
    // a section override for the sections themselves
    st.uiTabs = { security: { order: [], hidden: [], style: 'underline-compact' } };
    await open(page, '/live/wall');
    expect(await page.locator('sw-app nav.sectabs sw-tabs').evaluate((el) => el.getAttribute('data-variant'))).toBe('underline-compact');
  });

  test('measurements: the bar height of each variant (phone: the tap target stays 44 px and the compact row takes less room)', async ({ page }, info) => {
    const rows: Record<string, unknown> = {};
    for (const variant of ['pill', 'underline', 'underline-compact']) {
      st.uiTabs = { explore: { order: [], hidden: [], style: variant } };
      await open(page, '/explore/sites');
      const b = await bar(page);
      expect(b?.variant).toBe(variant);
      rows[variant] = b;
    }
    const m = rows as Record<'pill' | 'underline' | 'underline-compact', NonNullable<Awaited<ReturnType<typeof bar>>>>;
    fs.mkdirSync(EVIDENCE, { recursive: true });
    fs.writeFileSync(path.join(EVIDENCE, `bar-heights-${size(info)}.json`), JSON.stringify(rows, null, 2));
    test.info().annotations.push({ type: 'bar-heights', description: JSON.stringify(rows) });
    if (phone(info)) {
      for (const v of ['pill', 'underline', 'underline-compact'] as const) expect(m[v].hitH, `${v} tap target`).toBeGreaterThanOrEqual(44);
      expect(m['underline-compact'].layoutH, 'the compact row takes 32 px').toBeLessThanOrEqual(33);
      expect(m['underline-compact'].layoutH).toBeLessThan(m.underline.layoutH);
      expect(m.pill.visibleH, 'the pill segments are slim (28 px inside a 34 px track)').toBeLessThanOrEqual(30);
      expect(m.pill.layoutH).toBeLessThanOrEqual(m.underline.layoutH);
    } else {
      expect(m['underline-compact'].layoutH).toBeLessThan(m.underline.layoutH);
      expect(m.pill.layoutH).toBeLessThanOrEqual(36);
    }
    // the page starts right under the row: nothing above it grew
    expect(m['underline-compact'].pageTop).toBeLessThanOrEqual(m.underline.pageTop);
  });

  test('a long row (WisKey has 8+ tabs) scrolls sideways with an edge fade and keeps the active tab in view; RTL, arrows and roles as before', async ({ page }, info) => {
    await open(page, '/wiskey/tools');
    const b = await bar(page);
    expect(b?.variant).toBe('pill');
    if (phone(info)) {
      expect(b?.scrolls).toBe(true);
      expect(b?.fade).not.toBe('');
      await page.waitForTimeout(400);
      expect((await bar(page))?.activeInView).toBe(true); // the last tab is the active one and is not clipped
      await shot(page, 'wiskey-pill-scrolled', info);
    }
    const tabs = page.locator('sw-app sw-tabs[data-area-tabs] a');
    // RTL: the first tab is at the right edge
    const first = await tabs.first().boundingBox();
    const second = await tabs.nth(1).boundingBox();
    expect(first!.x).toBeGreaterThan(second!.x);
    // roles unchanged: links, one aria-current="page", reachable with Tab
    await expect(page.locator('sw-app sw-tabs[data-area-tabs] a[aria-current="page"]')).toHaveCount(1);
    await tabs.first().focus();
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => (document.querySelector('sw-app')!.shadowRoot!.querySelector('sw-tabs[data-area-tabs]')!.shadowRoot!.activeElement as HTMLElement | null)?.getAttribute('href'))).toBe('#/wiskey/events');
  });

  test('the editor: a default per level with a preview, an override per section, saved in ui.tabs, easy to flip back', async ({ page }, info) => {
    await open(page, '/system/diagnostics?tab=tabs');
    const ed = page.locator('sw-app system-diagnostics system-tabs-config');
    await expect(ed).toBeVisible();
    const l1 = ed.locator('[data-style-default="1"]');
    const l2 = ed.locator('[data-style-default="2"]');
    expect(await l1.locator('option').allTextContents()).toEqual(['כמוסבה (ברירת מחדל)', 'פס תחתון']);
    expect(await l2.locator('option').allTextContents()).toEqual(['פס תחתון קומפקטי (ברירת מחדל)', 'פס תחתון', 'כמוסבה']);
    await expect(l1).toHaveValue('pill');
    await expect(l2).toHaveValue('underline-compact');
    await expect(ed.locator('[data-style-preview="1"]')).toHaveAttribute('data-variant', 'pill');
    // the rail has no bar style; every other section card has its own choice
    await expect(ed.locator('[data-style-row="areas"]')).toHaveCount(0);
    await expect(ed.locator('[data-style-section]')).toHaveCount(8);
    if (info.project.name === 'desktop') await shot(page, 'editor-styles', info);
    else await shot(page, 'editor-styles', info);

    await l1.selectOption('underline');
    await l2.selectOption('underline');
    await expect(ed.locator('[data-style-preview="1"]')).toHaveAttribute('data-variant', 'underline');
    await ed.locator('[data-style-section="explore"]').selectOption('pill');
    await ed.locator('[data-tabs-save]').click();
    await expect.poll(() => st.patches.length).toBe(1);
    expect(st.patches[0]).toEqual({ 'ui.tabs': { explore: { order: [], hidden: [], style: 'pill' }, styles: { level1: 'underline', level2: 'underline' } } });
    // the shell follows without a reload
    await page.evaluate(() => (location.hash = '#/wiskey/overview'));
    await expect.poll(() => variantOf(page)).toBe('underline');
    await page.evaluate(() => (location.hash = '#/explore/sites'));
    await expect.poll(() => variantOf(page)).toBe('pill');
    await page.evaluate(() => (location.hash = '#/live/wall'));
    await expect.poll(() => variantOf(page)).toBe('underline');

    // flip back: the built-in choice is stored as nothing; a section override is cleared with its "לפי ברירת המחדל"
    await open(page, '/system/diagnostics?tab=tabs');
    const ed2 = page.locator('sw-app system-diagnostics system-tabs-config');
    await ed2.locator('[data-style-default="1"]').selectOption('pill');
    await ed2.locator('[data-style-section="explore"]').selectOption('');
    await ed2.locator('[data-tabs-save]').click();
    await expect.poll(() => st.patches.length).toBe(2);
    expect(st.patches[1]).toEqual({ 'ui.tabs': { styles: { level2: 'underline' } } });
    // a style survives an order edit of the same section
    await ed2.locator('[data-style-section="explore"]').selectOption('underline');
    await ed2.locator('li[data-sec="explore"][data-tab="floors"] .mv[data-move="up"]').click();
    await ed2.locator('[data-tabs-save]').click();
    await expect.poll(() => st.patches.length).toBe(3);
    expect(st.patches[2]).toEqual({ 'ui.tabs': { styles: { level2: 'underline' }, explore: { order: ['floors', 'sites'], hidden: [], style: 'underline' } } });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
});
