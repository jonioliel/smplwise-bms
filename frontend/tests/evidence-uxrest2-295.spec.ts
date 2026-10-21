import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import { installBubbleMock, tree } from './bubble-mocks';
import { PERMS } from './tickets-mocks';

// UXREST2-295 evidence: before / after screenshots of the three UX-audit leftovers (16 users list, 17 WisKey loading, 19 home widget failures).
// Run against the vite DEV server (never a pixel baseline compare):
//   SW_BASE_URL=http://127.0.0.1:<port>/ UX_PHASE=before|after npx playwright test tests/evidence-uxrest2-295.spec.ts --project=desktop
// Checks assert the AFTER behaviour only when UX_PHASE=after; the before run just records the pictures.
const PHASE = process.env.UX_PHASE || 'after';
const OUT = `../docs/design/evidence/UXREST2-295/${PHASE}`;
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const ENVELOPE = { code: 'internal_error', user_message: '', retryable: true, correlation_id: 'x', details: {} };

test.skip(({ viewport }) => (viewport?.width ?? 0) < 1200, 'desktop evidence');
test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));

// ---------------------------------------------------------------------------------------------------------------- 16

const USER = (id: string, name: string, username: string, extra: Record<string, unknown> = {}) => ({
  id, name, username, is_admin: false, active: true, source: 'both', sync_status: 'verified', synced_at: null, first_seen_at: null, last_seen_at: null,
  groups: [], bindings: [], is_self: false, ...extra,
});

test('16: the users list prints the username under the name only when it differs', async ({ page }) => {
  const perms = [...PERMS.admin];
  await page.route('**/api/v1/**', async (route) => {
    const p = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1\//, '');
    if (p === 'me') {
      return json(route, { user: { id: 'u1', username: 'ronit', display_name: 'רונית לוי', source: 'ingress' }, channel: 'local', remote: null, bindings: [{ id: 'b1', role_id: 'system_admin', role_name: 'מנהל מערכת', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }], permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, bootstrap_state: 'done', modules: { tickets: true } });
    }
    if (p === 'identity/users') {
      return json(route, { users: [USER('u1', 'רונית לוי', 'ronit', { is_self: true }), USER('u7', 'u7', 'u7'), USER('dana', 'dana@example.com', 'dana@example.com'), USER('moshe', 'משה כהן', 'moshe')], directory: { paired: true, last_directory_at: null, users: 4 }, revision: 1, can_assign: true });
    }
    if (p === 'access/roles') return json(route, { roles: [], revision: 1 });
    if (p === 'access/groups') return json(route, { groups: [], can_manage: true });
    return json(route, {});
  });
  await page.goto('/#/system/access');
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(2500);
  const rows = page.locator('system-access sw-table tbody tr');
  await expect(rows.first()).toBeVisible();
  await page.screenshot({ path: `${OUT}/users-list.png` });
  const cells = await rows.evaluateAll((trs) => trs.map((tr) => (tr.querySelector('td') as HTMLElement | null)?.innerText.replace(/\s+/g, ' ').trim() ?? ''));
  console.log(`users first cells ${PHASE}: ${JSON.stringify(cells)}`);
  if (PHASE === 'after') {
    const find = (s: string) => cells.find((c) => c.includes(s)) ?? '';
    expect(find('u7')).toBe('u7');
    expect(find('dana@example.com')).toBe('dana@example.com');
    expect(find('moshe')).toContain('משה כהן moshe');
    expect(find('ronit')).toContain('ronit');
  }
});

// ---------------------------------------------------------------------------------------------------------------- 19

async function homeWithMedia(page: Page, mediaOk: () => boolean) {
  await installBubbleMock(page, { perms: ['devices.read', 'devices.control', 'devices.control_bulk', 'map.read', 'media.read'] });
  const home = { direction: 'a', side: 'end', time_zone: 'Asia/Jerusalem', personalize: false, config: { clock: { on: true }, media: { on: true } }, data: {} };
  await page.route('**/api/v1/devices/tree', (route) => json(route, { ...tree(), home }));
  await page.route('**/api/v1/multimedia/**', (route) => {
    if (!mediaOk()) return json(route, ENVELOPE, 500);
    const p = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1\//, '');
    if (p === 'multimedia/status') return json(route, { enabled: true });
    if (p === 'multimedia/devices') {
      return json(route, { devices: [{ key: 'tv1', name: 'טלוויזיה סלון', kind: 'screen', live: { power: 'on', state: 'on' } }] });
    }
    return json(route, { devices: [] });
  });
}

test('19: a media read that fails shows that widget failed with a retry; the other widgets stay; retry restores it', async ({ page }) => {
  let ok = false;
  await homeWithMedia(page, () => ok);
  await page.goto('about:blank');
  await page.goto('/?design=a&skin=classic#/devices/building');
  const W = 'sw-app devices-building home-widgets';
  await expect(page.locator(`${W} [data-home-widget="clock"]`)).toHaveCount(1);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/home-media-failed.png` });
  const failedPanel = page.locator(`${W} [data-home-widget-failed="media"]`);
  console.log(`media failed panel ${PHASE}: ${await failedPanel.count()}`);
  if (PHASE !== 'after') return;
  await expect(failedPanel).toHaveCount(1);
  await expect(page.locator(`${W} [data-home-widget="clock"]`)).toHaveCount(1); // the others did not blank
  await expect(page.locator('sw-app devices-building sw-state-panel[state="error"]:not([data-home-widget-failed])')).toHaveCount(0); // not a whole-page failure
  ok = true;
  await failedPanel.locator('button, sw-button').first().click().catch(() => {});
  await failedPanel.evaluate((el) => el.dispatchEvent(new CustomEvent('action', { bubbles: true, composed: true })));
  await expect(failedPanel).toHaveCount(0, { timeout: 8000 });
  await expect(page.locator(`${W} [data-home-widget="media"]`)).toHaveCount(1);
  await page.screenshot({ path: `${OUT}/home-media-retried.png` });
});

test('19: the elevators widget whose later read fails says so with a retry, keeps the other widgets, and recovers on retry', async ({ page }) => {
  let ok = true;
  const NOW = '2026-10-18T09:00:00Z';
  const e = (id: string, name: string) => ({ id, name, area_id: null, area_name: 'לובי', state: 'active', reason: 'active', partial: false, stale: false, since: NOW, roles: ['fault'], extras: [], flags: { fault: false }, history: null });
  await installBubbleMock(page, { perms: ['devices.read', 'devices.control', 'devices.control_bulk', 'map.read'] });
  const home = { direction: 'a', side: 'end', time_zone: 'Asia/Jerusalem', personalize: false, config: { clock: { on: true }, elevators: { on: true, mode: 'both', hidden: [], filter: 'all' } }, data: {} };
  await page.route('**/api/v1/devices/tree', (route) => json(route, { ...tree(), home }));
  await page.route('**/api/v1/infra/elevators**', (route) => (ok ? json(route, { elevators: [e('e1', 'מעלית צפונית')], summary: {}, stale: false, at: NOW }) : json(route, ENVELOPE, 500)));
  await page.clock.install();
  await page.goto('about:blank');
  await page.goto('/?design=a&skin=classic#/devices/building');
  const W = 'sw-app devices-building home-widgets';
  await expect(page.locator(`${W} [data-home-widget="elevators"]`)).toHaveCount(1);
  ok = false;
  await page.clock.runFor(31_000); // the widget polls every 30 s
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/home-elevators-failed.png` });
  const failedPanel = page.locator(`${W} [data-home-widget-failed="elevators"]`);
  console.log(`elevators failed panel ${PHASE}: ${await failedPanel.count()}, widget present: ${await page.locator(`${W} [data-home-widget="elevators"]`).count()}`);
  if (PHASE !== 'after') return;
  await expect(failedPanel).toHaveCount(1);
  await expect(page.locator(`${W} [data-home-widget="clock"]`)).toHaveCount(1);
  ok = true;
  await failedPanel.evaluate((el) => el.dispatchEvent(new CustomEvent('action', { bubbles: true, composed: true })));
  await expect(failedPanel).toHaveCount(0, { timeout: 8000 });
  await expect(page.locator(`${W} [data-home-elevator-card="e1"], ${W} [data-home-elevators-top]`).first()).toBeVisible();
});
