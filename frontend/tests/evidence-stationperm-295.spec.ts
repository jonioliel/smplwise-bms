import { test, expect, type Page, type Route, type TestInfo } from '@playwright/test';
import { install, newMock } from './wiskey-people-mock';
import type { SpPerson, SpStation } from '../src/api/station-permissions';

// STATIONPERM-295: evidence for the per-station access block in the person's page (tab "גישה"), against the people mock plus a mock of
// routers/access_station_permissions.py. No WisKey, no device. SW_SHOTS=<dir> saves the screenshots there.
//   npx playwright test tests/evidence-stationperm-295.spec.ts --project=desktop|mobile

const NOW = '2026-10-20T10:00:00Z';
const SHOTS = process.env.SW_SHOTS || '';
const NONE = { allow: false, deny: false, inherit: false, approve: false, refuse: false, sync: false };
const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

function station(over: Partial<SpStation>): SpStation {
  return { station_id: 'gate', name: null, enabled: true, relays: [1], source: 'group', record: null, request: null, revision: 0, decides: true, request_only: false,
    actions: { ...NONE }, ...over };
}

function view(): SpPerson {
  return {
    person_id: 'p1', read: 'fresh', wiskey_revision: 4, timing_mode: 'ha', grant_live: false, self: false, system_admin: true,
    stations: [
      station({ station_id: 'gate', source: 'group', actions: { ...NONE, allow: true, deny: true } }),
      station({ station_id: 'lobby', source: 'personal', relays: [1, 2], revision: 2,
        record: { effect: 'allow', relays: [1, 2], sync_state: 'applied', decided_at: NOW, decided_by_name: 'יוני', proof_at: NOW, last_error: null },
        actions: { ...NONE, deny: true, inherit: true } }),
      station({ station_id: 'park', source: 'blocked', enabled: false, revision: 3,
        record: { effect: 'deny', relays: [], sync_state: 'unverified', decided_at: NOW, decided_by_name: 'יוני', proof_at: null, last_error: 'revocation_pending' },
        actions: { ...NONE, inherit: true, sync: true } }),
      station({ station_id: 'mgmt', source: 'none', enabled: false, revision: 1,
        request: { effect: 'allow', relays: [1], requested_at: NOW, requested_by_name: 'מונה', mine: false }, actions: { ...NONE, approve: true, refuse: true } }),
    ],
    addable: [{ station_id: 'lab', name: 'מעבדה', relays: [1], request_only: false }],
  };
}

interface SpMock { body: SpPerson | null; status: number; writes: { method: string; path: string; body: unknown }[] }

async function openPerson(page: Page, sp: SpMock, scheme: 'light' | 'dark' = 'light'): Promise<void> {
  await page.clock.setFixedTime(new Date(NOW));
  await install(page, newMock('admin'));
  await page.route('**/api/v1/access-station-permissions/**', async (route: Route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    if (req.method() === 'GET') {
      return sp.body ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sp.body) })
        : route.fulfill({ status: sp.status, contentType: 'application/json', body: JSON.stringify({ code: 'station_permissions_off', user_message: 'off', retryable: false, correlation_id: 'x', details: {} }) });
    }
    sp.writes.push({ method: req.method(), path, body: req.postDataJSON() });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ outcome: 'decided', sync_state: 'applied', code: null }) });
  });
  await page.goto(`/?design=a&skin=classic&scheme=${scheme}#/wiskey/people`);
  await page.waitForSelector('sw-app');
  await expect(page.locator('wiskey-people sw-page')).toHaveAttribute('data-people-phase', 'ready', { timeout: 20_000 });
  await page.locator('wiskey-people [data-person-row="p1"]').click();
  await page.locator('wiskey-person-drawer [data-person-tab="access"]').click();
}

const block = (page: Page) => page.locator('wiskey-station-permissions');
const shot = async (page: Page, info: TestInfo, name: string) => {
  if (!SHOTS) return;
  await settle(page);
  await page.locator('wiskey-person-drawer sw-drawer').screenshot({ path: `${SHOTS}/${name}-${info.project.name}.png` }).catch(() => page.screenshot({ path: `${SHOTS}/${name}-${info.project.name}.png` }));
};

test('the block shows group, personal, blocked and a waiting request, light and dark', async ({ page }, info) => {
  const sp: SpMock = { body: view(), status: 200, writes: [] };
  await openPerson(page, sp);
  await expect(block(page).locator('[data-sp-block="ready"]')).toBeVisible();
  await expect(block(page).locator('[data-sp-station]')).toHaveCount(4);
  await expect(block(page).locator('[data-sp-station="gate"] [data-sp-source="group"]')).toBeVisible();
  await expect(block(page).locator('[data-sp-station="park"] [data-sp-sync="unverified"]')).toBeVisible();
  await expect(block(page).locator('[data-sp-station="mgmt"] [data-sp-action="approve"]')).toBeVisible();
  await expect(block(page).locator('[data-sp-station="lobby"] [data-sp-sync]')).toHaveCount(0); // proven: no chip
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await shot(page, info, '01-access-tab-light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(page.url().replace('scheme=light', 'scheme=dark'));
  await page.waitForSelector('sw-app');
  await expect(page.locator('wiskey-people sw-page')).toHaveAttribute('data-people-phase', 'ready', { timeout: 20_000 });
  await page.locator('wiskey-people [data-person-row="p1"]').click();
  await page.locator('wiskey-person-drawer [data-person-tab="access"]').click();
  await expect(block(page).locator('[data-sp-station]')).toHaveCount(4);
  await shot(page, info, '02-access-tab-dark');
});

test('a block asks for one confirmation, then sends one PUT with the row revision', async ({ page }, info) => {
  const sp: SpMock = { body: view(), status: 200, writes: [] };
  await openPerson(page, sp);
  await block(page).locator('[data-sp-station="gate"] [data-sp-action="deny"]').click();
  await expect(block(page).locator('[data-sp-confirm]')).toBeVisible();
  await shot(page, info, '03-confirm-block');
  expect(sp.writes).toHaveLength(0);
  await block(page).locator('[data-sp-confirm]').click();
  await expect(block(page).locator('[data-sp-line]')).toBeVisible();
  expect(sp.writes).toEqual([{ method: 'PUT', path: 'access-station-permissions/people/p1/stations/gate', body: { effect: 'deny', revision: 0 } }]);
  await shot(page, info, '04-saved');
});

test('approve and add a station send their own calls', async ({ page }) => {
  const sp: SpMock = { body: view(), status: 200, writes: [] };
  await openPerson(page, sp);
  await block(page).locator('[data-sp-station="mgmt"] [data-sp-action="approve"]').click();
  await expect.poll(() => sp.writes.length).toBe(1);
  expect(sp.writes[0]).toEqual({ method: 'POST', path: 'access-station-permissions/people/p1/stations/mgmt/approve', body: { revision: 1 } });
  await block(page).locator('[data-sp-add-pick]').selectOption('lab');
  await block(page).locator('[data-sp-add]').click();
  await expect.poll(() => sp.writes.length).toBe(2);
  expect(sp.writes[1]).toEqual({ method: 'PUT', path: 'access-station-permissions/people/p1/stations/lab', body: { effect: 'allow', revision: 0, relays: [1] } });
});

test('while the feature is off the access tab shows no block at all', async ({ page }, info) => {
  const sp: SpMock = { body: null, status: 404, writes: [] };
  await openPerson(page, sp);
  await expect(page.locator('wiskey-person-drawer [data-person-section="access"]')).toBeVisible();
  await page.waitForTimeout(300);
  await expect(block(page).locator('section')).toHaveCount(0);
  await shot(page, info, '05-off');
});

test('a live external grant: one short notice, no actions', async ({ page }, info) => {
  const v = view();
  v.grant_live = true;
  v.addable = [];
  v.stations = v.stations.map((s) => ({ ...s, actions: { ...NONE } }));
  const sp: SpMock = { body: v, status: 200, writes: [] };
  await openPerson(page, sp);
  await expect(block(page).locator('[data-sp-notice="grantLive"]')).toBeVisible();
  await expect(block(page).locator('[data-sp-action]')).toHaveCount(0);
  await shot(page, info, '06-grant-live');
});
