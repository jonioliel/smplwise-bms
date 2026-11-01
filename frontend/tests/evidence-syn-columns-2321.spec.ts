import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// SYN-COLUMNS-2321 (owner request 2026-10-31): "an option to hide columns I have no data for". The synoptic board, the cross-section and the
// settings card. Static demo build: `?xsdata=sparse` is a building with no temperature sensors and no lights (switches only, as on the
// owner's building) - only open doors report; `?xs_<option>=` overrides an option. The settings card runs against a mocked backend.
//   SW_BASE_URL=http://127.0.0.1:4391/ npx playwright test tests/evidence-syn-columns-2321.spec.ts --workers=1

const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/evidence/SYN-COLUMNS-2321');
const SYN = '/#/devices/synoptic';
const FLOORS = '/#/explore/buildings/b1/floors';

async function open(page: Page, url: string) {
  await page.goto(url);
  await page.reload();
}

async function shot(page: Page, name: string, project: string) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCE, `${name}-${project}.png`) });
}

/** Elements that scroll inside the page (a control screen never scrolls). */
async function scrollers(page: Page) {
  return page.evaluate(() => {
    const out: string[] = [];
    const walk = (root: Document | ShadowRoot) => {
      root.querySelectorAll('*').forEach((el) => {
        const sr = (el as HTMLElement).shadowRoot;
        if (sr) walk(sr);
        const h = el as HTMLElement;
        if (el.matches('html,body') || h.clientHeight < 1) return;
        if (/auto|scroll/.test(getComputedStyle(el).overflowY) && h.scrollHeight > h.clientHeight + 1) out.push(`${el.tagName.toLowerCase()}.${el.className}`);
      });
    };
    walk(document);
    return out;
  });
}

/** The column heads the board draws (only the visible ones: the phone hides some). */
async function visibleCols(page: Page) {
  return page.locator('[data-syn-col]').evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent !== null || e.getClientRects().length > 0).filter((e) => getComputedStyle(e).display !== 'none' && (e as HTMLElement).getBoundingClientRect().width > 0).map((e) => e.getAttribute('data-syn-col')));
}

test.describe('synoptic board: a building with no temperature and no lights', () => {
  test('hide-empty (default): no temperature / lighting / alerts column, no "-" placeholders, a quiet note with the way to the option', async ({ page }, info) => {
    await open(page, `${SYN}?xsdemo=6&xsdata=sparse`);
    const board = page.locator('[data-syn-board]');
    await expect(board).toBeVisible();
    await expect(page.locator('[data-syn-row]')).toHaveCount(6);
    expect(await visibleCols(page)).toEqual(['cameras', 'doors']);
    await expect(page.locator('[data-syn-col="temp"], [data-syn-col="light"], [data-syn-col="alerts"]')).toHaveCount(0);
    // the head chips follow: no average temperature, no lights-on chip
    await expect(page.locator('[data-syn-chip="temp"], [data-syn-chip="light"]')).toHaveCount(0);
    // no cell of a drawn column is a lone "-"
    const dashes = await page.locator('[data-syn-row] .cell, [data-syn-row] .deg').evaluateAll((els) => els.filter((e) => (e as HTMLElement).getBoundingClientRect().width > 0 && e.textContent?.trim() === '-').length);
    expect(dashes).toBe(0);
    if (info.project.name === 'mobile') {
      // SYNOPTIC-MOBILE-2342 (sub-answer 3B): the phone keeps the note behind the info button; the floor name opens the floor
      await page.waitForTimeout(300);
      expect(await scrollers(page)).toEqual([]);
      await shot(page, 'board-sparse', info.project.name);
      await page.locator('[data-syn-info]').click();
      await expect(page.locator('[data-syn-info-hidden]')).toHaveText('תאורה, טמפרטורה, נוכחות, התראות');
      await page.locator('[data-syn-info-settings]').click();
      await expect(page).toHaveURL(/#\/system\/diagnostics\?focus=xs/);
      return;
    }
    // the note names what is hidden (presence too: no count reaches the demo floors)
    const note = page.locator('[data-syn-hidden]');
    await expect(note).toBeVisible();
    await expect(note).toHaveAttribute('data-syn-hidden', 'light,temp,presence,alerts');
    await expect(note).toContainText('עמודות בלי נתונים מוסתרות: תאורה, טמפרטורה, נוכחות, התראות');
    await page.waitForTimeout(300);
    expect(await scrollers(page)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await shot(page, 'board-sparse', info.project.name);
    // a selected floor's line repeats only the drawn columns
    await page.locator('[data-syn-row]').nth(1).click();
    const detail = page.locator('[data-syn-detail]');
    await expect(detail).toContainText('מצלמות');
    await expect(detail).not.toContainText('טמפרטורה:');
    await expect(detail).not.toContainText('תאורה:');
    // the link opens the settings card
    await page.locator('[data-syn-hidden-opt]').click();
    await expect(page).toHaveURL(/#\/system\/diagnostics\?focus=xs/);
  });

  test('hide-empty off: every column is back with its "-", and no note', async ({ page }, info) => {
    await open(page, `${SYN}?xsdemo=6&xsdata=sparse&xs_syn_hide_empty=0`);
    await expect(page.locator('[data-syn-board]')).toBeVisible();
    const cols = await visibleCols(page);
    // SYNOPTIC-MOBILE-2342: the phone keeps the columns with data first, then (360 px and wider) the empty ones dashed, five at most
    if (info.project.name === 'mobile') expect(cols).toEqual(['cameras', 'doors', 'light', 'temp', 'presence']);
    else expect(cols).toEqual(['light', 'temp', 'presence', 'cameras', 'doors', 'alerts']);
    await expect(page.locator('[data-syn-hidden]')).toHaveCount(0);
  });

  test('custom columns: the ticked ones in the fixed order; a ticked column without a source is still left out and named', async ({ page }) => {
    await open(page, `${SYN}?xsdemo=6&xsdata=sparse&xs_syn_columns=custom&xs_syn_custom=doors,temp`);
    await expect(page.locator('[data-syn-board]')).toBeVisible();
    expect(await visibleCols(page)).toEqual(['doors']);
    await expect(page.locator('[data-syn-hidden]')).toHaveAttribute('data-syn-hidden', 'temp');
    await open(page, `${SYN}?xsdemo=6&xs_syn_columns=custom&xs_syn_custom=doors,temp,cameras`);
    expect(await visibleCols(page)).toEqual(['temp', 'cameras', 'doors']);
  });

  test('a building WITH data keeps temperature and lighting (only the alerts column, which has no source yet, is left out)', async ({ page }, info) => {
    await open(page, `${SYN}?xsdemo=6`);
    await expect(page.locator('[data-syn-board]')).toBeVisible();
    const cols = await visibleCols(page);
    expect(cols.slice(0, 2)).toEqual(['light', 'temp']);
    expect(cols).not.toContain('alerts');
    if (info.project.name === 'mobile') {
      await page.locator('[data-syn-info]').click();
      await expect(page.locator('[data-syn-info-hidden]')).toHaveText('התראות');
    } else await expect(page.locator('[data-syn-hidden]')).toHaveAttribute('data-syn-hidden', 'alerts');
    await shot(page, 'board-with-data', info.project.name);
  });
});

test.describe('cross-section: the same rule', () => {
  test('a building with no temperature and no lights draws no facade, no lit chip, no degrees and no hot/cold legend', async ({ page }, info) => {
    await open(page, `${FLOORS}?xsdemo=5&xsdata=sparse`);
    await expect(page.locator('[data-floor-card]').first()).toBeVisible();
    if (info.project.name === 'mobile') {
      const tiles = page.locator('[data-xs-tile]');
      await expect(tiles.first()).toBeVisible();
      await expect(tiles.locator('.tv')).toHaveCount(0);
      await expect(tiles.locator('.fac')).toHaveCount(0);
    } else {
      const sec = page.locator('[data-xsection]');
      await expect(sec).toBeVisible();
      await expect(page.locator('[data-xs-row]')).toHaveCount(5);
      await expect(page.locator('[data-xs-row] .fac')).toHaveCount(0);
      await expect(page.locator('[data-xs-row] .deg')).toHaveCount(0);
      await expect(page.locator('[data-xs-row] .lc')).toHaveCount(0);
      await expect(sec.locator('.legend .hot, .legend .lit')).toHaveCount(0);
    }
    await page.waitForTimeout(300);
    expect(await scrollers(page)).toEqual([]);
    await shot(page, 'xsection-sparse', info.project.name);
  });

  test('with data (and with hide-empty off) the metrics are drawn as before', async ({ page }, info) => {
    test.skip(info.project.name === 'mobile', 'the rows are the desktop / tablet section; the tile is covered above');
    await open(page, `${FLOORS}?xsdemo=5&xsdata=ha`);
    await expect(page.locator('[data-xs-row] .fac').first()).toBeVisible();
    await open(page, `${FLOORS}?xsdemo=5&xsdata=sparse&xs_syn_hide_empty=0`);
    await expect(page.locator('[data-xs-row] .fac').first()).toBeVisible();
    await expect(page.locator('[data-xs-row] .deg').first()).toBeVisible();
  });
});

/* ---------------------------------------------------------------- the settings card (mocked backend) */

const ADMIN = ['devices.read', 'map.read', 'entity.state.read', 'events.read', 'system.configure', 'sources.configure', 'audit.read'];
const XS = { desktop_place: 'left', phone_place: 'side', many: 'steps', links: 'fold', click: 'select', shafts: true, animate: true, temp_threshold: 2, syn_tab: true, syn_columns: 'all', syn_custom: ['light', 'temp', 'presence', 'cameras', 'doors', 'alerts', 'fire'], syn_hide_empty: true, syn_events: true, fire_column: 'hidden', fire_ui: false, ack: 'hold', ack_who: 'separate', alarm_bar: 'everywhere', wall: true };

async function mockApi(page: Page, patches: Record<string, unknown>[]) {
  let xs: Record<string, unknown> = { ...XS };
  await page.route('**/api/v1/**', (route: Route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p === 'me') {
      return json({
        channel: 'local', remote: null, user: { id: 'u-test', username: 'u-test', display_name: 'בודק', source: 'ingress' }, active: true,
        bindings: [{ id: 'b1', role_id: 'r', role_name: 'בדיקה', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
        permissions_installation: ADMIN, permissions_any: ADMIN, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full',
      });
    }
    if (p === 'me/prefs') return json({ prefs: {}, stored: [], updated_at: null });
    if (p === 'settings' && req.method() === 'PATCH') {
      const body = req.postDataJSON() as Record<string, unknown>;
      patches.push(body);
      if (body['ui.xs']) xs = body['ui.xs'] as Record<string, unknown>;
    }
    if (p === 'settings') return json({ settings: { 'ui.start_route': 'devices', 'ui.xs': xs }, can_edit: true });
    if (p === 'sites' || p.startsWith('sites?')) return json({ sites: [], can_create_site: false });
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-10-31T00:00:00Z', version: 'test' });
    if (p === 'health') return json({ status: 'ok', version: 'test', nvr_configured: true, mode: 'full', discovery: { cameras: 0, cameras_last_ok: null, cameras_last_error: null }, events: { ingest: { connected: true, last_error: null } } });
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    return json({ code: 'not_found', user_message: 'לא נמצא (בדיקה)', retryable: false, correlation_id: '', details: {} }, 404);
  });
}

test.describe('settings: the board columns', () => {
  test('hide-empty is a switch (on by default); "chosen by hand" opens seven ticks in the board order and saves through ui.xs', async ({ page }, info) => {
    const patches: Record<string, unknown>[] = [];
    await mockApi(page, patches);
    await page.goto('about:blank');
    await page.goto('/#/system/diagnostics?focus=xs');
    const card = page.locator('[data-xs-options]');
    await expect(card).toBeVisible();
    await expect(card).toBeInViewport();
    const hide = page.locator('sw-toggle[data-xs-toggle="syn_hide_empty"]');
    await expect(hide).toHaveAttribute('checked', '');
    await expect(page.locator('[data-xs-option="syn_hide_empty"]')).toContainText('(ברירת מחדל)');
    const sel = page.locator('select[data-xs-select="syn_columns"]');
    await expect(sel.locator('option')).toHaveText([/תאורה, טמפרטורה/, /פחות/, /בחירה ידנית/]);
    await expect(page.locator('[data-xs-option="syn_custom"]')).toHaveCount(0);
    await sel.selectOption('custom');
    const ticks = page.locator('[data-xs-option="syn_custom"] input[type="checkbox"]');
    await expect(ticks).toHaveCount(7);
    expect(await ticks.evaluateAll((els) => els.map((e) => e.getAttribute('data-xs-col')))).toEqual(['light', 'temp', 'presence', 'cameras', 'doors', 'alerts', 'fire']);
    for (const c of ['light', 'temp', 'presence', 'alerts', 'fire']) await page.locator(`[data-xs-col="${c}"]`).uncheck();
    await expect(page.locator('[data-xs-col="doors"]')).toBeChecked();
    await page.locator('[data-xs-option="syn_custom"]').scrollIntoViewIfNeeded();
    await shot(page, 'settings-custom', info.project.name);
    await page.locator('[data-xs-save]').click();
    await expect(page.locator('[data-xs-message]')).toBeVisible();
    const sent = patches.at(-1)!['ui.xs'] as Record<string, unknown>;
    expect(sent.syn_columns).toBe('custom');
    expect(sent.syn_custom).toEqual(['cameras', 'doors']);
    expect(sent.syn_hide_empty).toBe(true);
    // the switch saves the other way, too
    await hide.locator('button').click();
    await page.locator('[data-xs-save]').click();
    await expect.poll(() => (patches.at(-1)!['ui.xs'] as Record<string, unknown>).syn_hide_empty).toBe(false);
    // unticking every column says what the board will show
    for (const c of ['cameras', 'doors']) await page.locator(`[data-xs-col="${c}"]`).uncheck();
    await expect(page.locator('[data-xs-custom-none]')).toBeVisible();
  });
});
