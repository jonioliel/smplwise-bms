import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installStationsMock, newMock, openStations, type StationsMock } from './wiskey-stations-mocks';
import { installOpsMock, newOpsMock, type OpsMock } from './wiskey-station-ops-mocks';

// WISKEY-STATION-OPS-2390 - a station's maintenance in the stations screen, behind the real shell, against a MOCKED backend
// (tests/wiskey-stations-mocks.ts + tests/wiskey-station-ops-mocks.ts: invented stations, no station, no intercom). Desktop, tablet and
// phone. What it pins:
//   - the drawer's "טכני" section shows the health detail - last sync, event stream, clock, last error, the sign-in failure with its step
//     and time - with NO confirmation and no action sent;
//   - each action needs its confirmation (cancel sends nothing), is sent ONCE with the command envelope, and its result is honest:
//     accepted (sync queued) / done / failed with the reason / sent with no clear answer / not sent (cool-down);
//   - an offline station offers only the sync; a caller without the maintenance permission gets the detail and no button;
//   - the list action: pick the action and the stations, confirm, one request per station (offline ones left out of device reads), a
//     result line per station, no resend;
//   - no platform name anywhere.
// Evidence images: docs/design/evidence/wiskey-station-ops/.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-wiskey-station-ops.spec.ts --workers=1

const SCREEN = 'wiskey-stations';
const BANNED = /wiskey|home\s*assistant|hikvision|ingress|supervisor|add-on|\bHA\b/i;
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/wiskey-station-ops');

async function boot(page: Page, over: Partial<OpsMock> = {}, base: Partial<StationsMock> = {}) {
  const mock = newMock(base);
  await installStationsMock(page, mock);
  const ops = newOpsMock(over);
  await installOpsMock(page, mock, ops);
  await openStations(page);
  await expect(page.locator(`${SCREEN} [data-wk-stations][data-wk-state="ready"]`)).toBeVisible({ timeout: 30_000 });
  return { mock, ops };
}

const inDrawer = (page: Page, sel: string) => page.locator(`${SCREEN} sw-drawer[data-wk-drawer] ${sel}`);
const block = (page: Page) => inDrawer(page, 'wk-station-maintenance');
const inBlock = (page: Page, sel: string) => inDrawer(page, `wk-station-maintenance ${sel}`);

async function openDrawer(page: Page, id: string) {
  await page.locator(`${SCREEN} [data-wk-grid] [data-wk-station="${id}"] button.open`).click();
  await expect(page.locator(`${SCREEN} sw-drawer[data-wk-drawer]`)).toHaveAttribute('open', '');
  await expect(inBlock(page, '[data-wk-maint-state="ready"]')).toBeVisible({ timeout: 15_000 });
  await inBlock(page, '[data-wk-maint-health]').scrollIntoViewIfNeeded();
}

async function shot(page: Page, info: TestInfo, name: string) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.screenshot({ path: path.join(OUT, `${name}-${info.project.name}.png`), animations: 'disabled' });
}

async function confirmAndSend(page: Page, op: string) {
  await inBlock(page, `[data-wk-maint-op="${op}"]`).click();
  await expect(inBlock(page, `sw-dialog[data-wk-maint-confirm="${op}"]`)).toBeVisible();
  await inBlock(page, '[data-wk-maint-send]').click();
}

test.describe('station maintenance: the drawer', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  test('the health detail and the sign-in failure are shown without any confirmation and nothing is sent', async ({ page }, info) => {
    const { ops } = await boot(page);
    await openDrawer(page, 'gate');
    expect(ops.reads).toContain('gate');
    expect(ops.posts).toEqual([]);
    await expect(inBlock(page, '[data-wk-maint-last-sync]')).not.toBeEmpty();
    await expect(inBlock(page, '[data-wk-maint-stream="connected"]')).toBeVisible();
    await expect(inBlock(page, '[data-wk-maint-auth="sync"]')).toBeVisible();
    await expect(inBlock(page, '[data-wk-maint-auth-line]')).toContainText('קריאת משתמשים מהעמדה');
    await expect(inBlock(page, '[data-wk-maint-auth-count]')).toContainText('3');
    await expect(inBlock(page, '[data-wk-maint-auth-now]')).toContainText('סנכרון');
    await expect(inBlock(page, '[data-wk-maint-ops] [data-wk-maint-op]')).toHaveCount(4);
    await expect(inBlock(page, 'sw-dialog')).toHaveCount(0);
    await shot(page, info, 'drawer-detail');
    const text = await block(page).evaluate((el) => el.shadowRoot?.textContent ?? '');
    expect(text).not.toMatch(BANNED);
  });

  test('sync now: the confirmation, cancel sends nothing, send sends once with the envelope, the result is "accepted"', async ({ page }, info) => {
    const { ops } = await boot(page);
    await openDrawer(page, 'lobby');
    await inBlock(page, '[data-wk-maint-op="sync"]').click();
    await expect(inBlock(page, '[data-wk-maint-sentence]')).toContainText('לובי');
    await shot(page, info, 'drawer-confirm');
    await inBlock(page, '[data-wk-maint-cancel]').click();
    await expect(inBlock(page, 'sw-dialog')).toHaveCount(0);
    expect(ops.posts).toEqual([]);
    await confirmAndSend(page, 'sync');
    await expect(inBlock(page, '[data-wk-maint-result="sync"][data-status="acknowledged"]')).toContainText('התקבל');
    expect(ops.posts).toHaveLength(1);
    const b = ops.posts[0];
    expect(b.station).toBe('lobby');
    expect(b.action).toBe('sync');
    expect(b.body.confirmed).toBe(true);
    expect(String(b.body.client_request_id)).toMatch(/^[A-Za-z0-9-]{8,64}$/);
    expect(String(b.body.expires_at)).toMatch(/Z$/);
    await shot(page, info, 'drawer-acknowledged');
    await page.waitForTimeout(500);
    expect(ops.posts).toHaveLength(1); // nothing repeats by itself
  });

  test('honest results: failed with the reason, sent with no clear answer, not sent in the cool-down', async ({ page }, info) => {
    const { ops } = await boot(page, { result: { rescan: 'failed', health_refresh: 'unknown', clock_refresh: 'cooldown' } });
    await openDrawer(page, 'gate');
    await confirmAndSend(page, 'rescan');
    await expect(inBlock(page, '[data-wk-maint-result="rescan"][data-status="failed"]')).toContainText('העמדה דחתה את פרטי ההתחברות');
    await confirmAndSend(page, 'health_refresh');
    await expect(inBlock(page, '[data-wk-maint-result="health_refresh"][data-status="unknown"]')).toContainText('ייתכן שבוצע');
    await confirmAndSend(page, 'clock_refresh');
    await expect(inBlock(page, '[data-wk-maint-result="clock_refresh"][data-status="not_sent"]')).toContainText('לא נשלח');
    await shot(page, info, 'drawer-outcomes');
    expect(ops.posts.map((p) => p.action)).toEqual(['rescan', 'health_refresh', 'clock_refresh']);
  });

  test('while an action runs the other buttons wait; done is "done"', async ({ page }) => {
    const { ops } = await boot(page, { result: { health_refresh: 'slow' } });
    await openDrawer(page, 'gate');
    await confirmAndSend(page, 'health_refresh');
    await expect(inBlock(page, '[data-wk-maint-op="sync"]')).toHaveAttribute('disabled', '');
    await expect(inBlock(page, '[data-wk-maint-result="health_refresh"][data-status="completed"]')).toContainText('הושלם', { timeout: 10_000 });
    await expect(inBlock(page, '[data-wk-maint-op="sync"]')).not.toHaveAttribute('disabled', '');
    expect(ops.posts).toHaveLength(1);
  });

  test('an offline station offers only the sync; a failing read says so', async ({ page }, info) => {
    await boot(page, { readFails: new Set(['park']) });
    await openDrawerAny(page, 'store');
    await expect(inBlock(page, '[data-wk-maint-offline]')).toBeVisible();
    await expect(inBlock(page, '[data-wk-maint-op="rescan"]')).toHaveAttribute('disabled', '');
    await expect(inBlock(page, '[data-wk-maint-op="clock_refresh"]')).toHaveAttribute('disabled', '');
    await expect(inBlock(page, '[data-wk-maint-op="sync"]')).not.toHaveAttribute('disabled', '');
    await shot(page, info, 'drawer-offline');
  });

  test('without the maintenance permission: the detail, no button, no list action', async ({ page }) => {
    const { ops } = await boot(page, { manage: false });
    await expect(page.locator(`${SCREEN} wk-stations-maintenance [data-wk-maint-list]`)).toHaveCount(0);
    await openDrawer(page, 'gate');
    await expect(inBlock(page, '[data-wk-maint-health]')).toBeVisible();
    await expect(inBlock(page, '[data-wk-maint-op]')).toHaveCount(0);
    expect(ops.posts).toEqual([]);
  });

  test('a caller without the technical part sees no maintenance block and no read is made', async ({ page }) => {
    const { ops } = await boot(page, {}, { persona: 'door' });
    await page.locator(`${SCREEN} [data-wk-grid] [data-wk-station="gate"] button.open`).click();
    await expect(page.locator(`${SCREEN} sw-drawer[data-wk-drawer]`)).toHaveAttribute('open', '');
    await page.waitForTimeout(300);
    await expect(block(page)).toHaveCount(0);
    expect(ops.reads).toEqual([]);
  });
});

/** The drawer of a station that may be offline (its card's own open button). */
async function openDrawerAny(page: Page, id: string) {
  await openDrawer(page, id);
}

test.describe('station maintenance: the list action', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  test('pick, confirm, one request per station, a result line each; offline stations left out of a device read', async ({ page }, info) => {
    const { ops, mock } = await boot(page, { result: { 'mgmt/rescan': 'failed', 'lab/rescan': 'unknown' } });
    const button = page.locator(`${SCREEN} wk-stations-maintenance [data-wk-maint-list]`);
    await expect(button).toBeVisible();
    await button.click();
    const dlg = page.locator(`${SCREEN} wk-stations-maintenance sw-dialog[data-wk-maint-dialog]`);
    await expect(dlg).toHaveAttribute('data-step', 'pick');
    await page.locator(`${SCREEN} wk-stations-maintenance [data-wk-maint-action="rescan"]`).click();
    await expect(page.locator(`${SCREEN} wk-stations-maintenance [data-wk-maint-station="store"] input`)).toBeDisabled();
    await shot(page, info, 'list-pick');
    await page.locator(`${SCREEN} wk-stations-maintenance [data-wk-maint-next]`).click();
    await expect(dlg).toHaveAttribute('data-step', 'confirm');
    const online = mock.stations.filter((s) => s.online).map((s) => s.id);
    await expect(page.locator(`${SCREEN} wk-stations-maintenance [data-wk-maint-many]`)).toContainText(String(online.length));
    expect(ops.posts).toEqual([]);
    await page.locator(`${SCREEN} wk-stations-maintenance [data-wk-maint-send-many]`).click();
    await expect(page.locator(`${SCREEN} wk-stations-maintenance [data-wk-maint-done]`)).not.toHaveAttribute('disabled', '', { timeout: 15_000 });
    expect(ops.posts.map((p) => p.station)).toEqual(online);
    expect(new Set(ops.posts.map((p) => p.body.client_request_id)).size).toBe(online.length);
    expect(ops.posts.every((p) => p.action === 'rescan' && p.body.confirmed === true)).toBe(true);
    await expect(page.locator(`${SCREEN} wk-stations-maintenance [data-wk-maint-row="mgmt"]`)).toHaveAttribute('data-status', 'failed');
    await expect(page.locator(`${SCREEN} wk-stations-maintenance [data-wk-maint-row="lab"]`)).toHaveAttribute('data-status', 'unknown');
    await expect(page.locator(`${SCREEN} wk-stations-maintenance [data-wk-maint-row="gate"]`)).toHaveAttribute('data-status', 'completed');
    await expect(page.locator(`${SCREEN} wk-stations-maintenance [data-wk-maint-row="store"]`)).toHaveCount(0);
    await expect(page.locator(`${SCREEN} wk-stations-maintenance [data-wk-maint-progress]`)).toContainText('1 נכשלו');
    await shot(page, info, 'list-results');
    const text = await page.locator(`${SCREEN} wk-stations-maintenance`).evaluate((el) => el.shadowRoot?.textContent ?? '');
    expect(text).not.toMatch(BANNED);
    await page.locator(`${SCREEN} wk-stations-maintenance [data-wk-maint-done]`).click();
    await expect(dlg).toHaveCount(0);
    await page.waitForTimeout(400);
    expect(ops.posts).toHaveLength(online.length); // no resend
  });

  test('a sync may include an offline station; clearing the choice blocks "continue"', async ({ page }) => {
    const { ops } = await boot(page);
    await page.locator(`${SCREEN} wk-stations-maintenance [data-wk-maint-list]`).click();
    await page.locator(`${SCREEN} wk-stations-maintenance [data-wk-maint-clear]`).click();
    await expect(page.locator(`${SCREEN} wk-stations-maintenance [data-wk-maint-next]`)).toHaveAttribute('disabled', '');
    await page.locator(`${SCREEN} wk-stations-maintenance [data-wk-maint-station="store"] input`).check();
    await page.locator(`${SCREEN} wk-stations-maintenance [data-wk-maint-station="gate"] input`).check();
    await page.locator(`${SCREEN} wk-stations-maintenance [data-wk-maint-next]`).click();
    await page.locator(`${SCREEN} wk-stations-maintenance [data-wk-maint-send-many]`).click();
    await expect(page.locator(`${SCREEN} wk-stations-maintenance [data-wk-maint-done]`)).not.toHaveAttribute('disabled', '', { timeout: 15_000 });
    expect(ops.posts.map((p) => `${p.station}:${p.action}`).sort()).toEqual(['gate:sync', 'store:sync']);
  });
});
