import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installMulti } from './multi-nvr-mock';

// CR-024 (multi-NVR) against a MOCKED backend (tests/multi-nvr-mock.ts): the recorders card in Settings › connections (list, connection,
// rename, disable, add), the recorder filter and recorder names in the camera settings table, the wall's and the event log's recorder
// filter, and a single-recorder installation where none of it appears. Desktop, tablet and phone (every project). SW_SHOTS=1 writes
// screenshots to docs/design/evidence/cr024. The server's rules are the backend tests (tests/test_multi_nvr.py).
//   ~/run_remote.sh spec <branch> tests/evidence-multi-nvr.spec.ts
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/cr024');
const CARD = 'sw-app system-setup nvr-recorders-card';
const TABLE = 'sw-app system-security system-security-cameras';

async function shot(page: Page, name: string) {
  if (!process.env.SW_SHOTS) return;
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}.png`) });
}

async function open(page: Page, hash: string) {
  await page.goto('about:blank');
  await page.goto(`/?design=a#${hash}`);
  await page.waitForSelector('sw-app');
}

const FORBIDDEN = /Home Assistant|Ingress|Supervisor|add-on|Add-on/;

test.describe('multi-NVR screens (mocked backend)', () => {
  const errors: string[] = [];
  test.beforeEach(({ page }) => {
    errors.length = 0;
    page.on('pageerror', (e) => errors.push(e.message));
  });
  test.afterEach(() => {
    expect(errors, 'page errors').toEqual([]);
  });

  test('Settings › connections lists both recorders; connection, rename, disable and add', async ({ page }) => {
    const st = await installMulti(page);
    await open(page, '/system/setup');
    const rows = page.locator(`${CARD} [data-recorder]`);
    await expect(rows).toHaveCount(2);
    await expect(page.locator(`${CARD} [data-recorder="nvr-2"] [data-recorder-name]`)).toHaveText('NVR מחסן');
    await expect(page.locator(`${CARD} [data-recorder="nvr-2"] [data-recorder-status]`)).toHaveAttribute('label', 'מחובר');
    await expect(page.locator(`${CARD} [data-recorder="nvr-1"] [data-recorder-cameras]`)).toContainText('3');
    await shot(page, 'recorders-list');
    // the second recorder's connection opens its own form (its own route)
    await page.locator(`${CARD} [data-recorder="nvr-2"] [data-recorder-connection]`).click();
    await expect(page.locator(`${CARD} [data-recorder="nvr-2"] nvr-connection-form [data-conn-summary]`)).toContainText('fake-nvr-2.test');
    expect(st.hits).toContain('GET recorders/nvr-2/connection');
    await shot(page, 'recorder-connection');
    // rename
    await page.locator(`${CARD} [data-recorder="nvr-2"] [data-recorder-rename]`).click();
    await page.locator(`${CARD} [data-recorder="nvr-2"] [data-recorder-name-input]`).fill('מחסן צפון');
    await page.locator(`${CARD} [data-recorder="nvr-2"] [data-recorder-name-save]`).click();
    await expect(page.locator(`${CARD} [data-recorder="nvr-2"] [data-recorder-name]`)).toHaveText('מחסן צפון');
    expect(st.writes.find((w) => w.method === 'PATCH')?.body).toEqual({ name: 'מחסן צפון' });
    // disable: a short confirmation, then the state and the restart
    await page.locator(`${CARD} [data-recorder="nvr-2"] [data-recorder-toggle]`).click();
    await expect(page.locator(`${CARD} sw-dialog[open][data-recorder-toggle-dialog] [data-recorder-toggle-confirm]`)).toBeVisible();
    await shot(page, 'recorder-disable-dialog');
    await page.locator(`${CARD} [data-recorder-toggle-confirm]`).click();
    await expect(page.locator(`${CARD} [data-recorder="nvr-2"]`)).toHaveAttribute('data-recorder-state', 'disabled');
    expect(st.writes.filter((w) => w.method === 'PATCH').at(-1)?.body).toEqual({ enabled: false });
    // add: name, type, fields, test, save
    await page.locator(`${CARD} [data-recorder-add]`).click();
    const dlg = page.locator(`${CARD} sw-dialog[open][data-recorder-add-dialog] nvr-connection-form`);
    await expect(dlg.locator('[data-conn-name]')).toBeVisible();
    await expect(dlg.locator('select[data-conn-vendor] option[value="none"]')).toHaveCount(0); // a further recorder is never "ללא NVR"
    await dlg.locator('[data-conn-name]').fill('NVR חניון');
    await dlg.locator('select[data-conn-vendor]').selectOption('hikvision');
    await dlg.locator('[data-conn-field="host"]').fill('fake-nvr-3.test');
    await dlg.locator('[data-conn-field="username"]').fill('viewer');
    await dlg.locator('[data-conn-password]').fill('canary-add-3301');
    await dlg.locator('[data-conn-test]').click();
    await expect(dlg.locator('[data-conn-test-result]')).toContainText('מחובר');
    await shot(page, 'recorder-add-dialog');
    await dlg.locator('[data-conn-save]').click();
    await expect(page.locator(`${CARD} [data-recorder]`)).toHaveCount(3);
    const add = st.writes.find((w) => w.method === 'POST' && w.path === 'recorders');
    expect(add?.body).toMatchObject({ name: 'NVR חניון', vendor: 'hikvision', host: 'fake-nvr-3.test', username: 'viewer' });
    await expect(page.locator(`${CARD} [data-recorder="nvr-3"]`)).toHaveAttribute('data-recorder-state', 'pending_restart');
    expect(await page.locator(CARD).evaluate((el) => el.shadowRoot!.innerHTML)).not.toContain('canary-add-3301');
    // the NVR system card (clock, disks, outputs, reboot) reads and acts on the recorder chosen above it
    const sysSel = page.locator('sw-app system-setup [data-nvr-system] select[data-nvr-system-recorder]');
    await expect(sysSel).toBeVisible();
    await sysSel.selectOption('nvr-2');
    await expect.poll(() => st.systemRecorder).toBe('nvr-2');
    await expect(page.locator(CARD)).not.toContainText(FORBIDDEN);
  });

  test('the camera settings table names the recorder and filters by it; a batch holds one recorder', async ({ page }) => {
    await installMulti(page);
    await open(page, '/system/security/cameras');
    await expect(page.locator(`${TABLE} [data-nvr-cameras]`)).toHaveAttribute('data-state', 'ready');
    const filter = page.locator(`${TABLE} select[data-nvr-filter="recorder"]`);
    await expect(filter).toBeVisible();
    const wide = (page.viewportSize()?.width ?? 1440) >= 900;
    const scope = wide ? '[data-nvr-table] tr[data-stream-row]' : '[data-nvr-cards] [data-stream-card]';
    const all = await page.locator(`${TABLE} ${scope}`).count();
    await expect(page.locator(`${TABLE} ${scope} [data-nvr-recorder]`).first()).toBeVisible();
    await shot(page, 'cameras-table-all');
    // the multi-camera checklist opened from a camera of the first recorder lists only that recorder's cameras
    const toggle = page.locator(`${TABLE} ${scope}[data-camera="nvr-1:1"][data-stream="101"] sw-toggle[data-svc-toggle]`);
    await expect(toggle).toBeVisible();
    await toggle.click();
    await page.locator('sw-dialog[open][data-nvr-confirm-dialog] [data-nvr-extra]').click();
    const sel = page.locator(`${TABLE} nvr-camera-batch sw-dialog[open][data-nvr-batch-select]`);
    await expect(sel.locator('[data-nvr-batch-next]')).toBeVisible();
    const ids = await sel.locator('[data-nvr-batch-cam]').evaluateAll((els) => els.map((e) => e.getAttribute('data-nvr-batch-cam') ?? ''));
    expect(ids.sort()).toEqual(['cam-1', 'cam-2', 'cam-3']); // never the second recorder's w-cam-* (a mixed batch would be refused)
    await sel.locator('[data-nvr-batch-cancel]').click();
    await filter.selectOption('nvr-2');
    await expect.poll(() => page.locator(`${TABLE} ${scope}`).count()).toBe(all / 2);
    expect(await page.locator(`${TABLE} ${scope}`).evaluateAll((els) => els.every((e) => (e.getAttribute('data-camera') ?? '').startsWith('nvr-2:')))).toBe(true);
    await expect(page.locator('sw-app sw-page[heading="הגדרות מצלמות"]').first()).toHaveAttribute('subheading', 'NVR מחסן');
    await shot(page, 'cameras-table-filtered');
  });

  test('the wall and the event log filter by recorder', async ({ page }) => {
    const st = await installMulti(page);
    await page.addInitScript(() => {
      try {
        localStorage.setItem('sw.wall.count', '32');
        localStorage.removeItem('sw.wall.recorder');
      } catch {
        /* about:blank has no storage */
      }
    });
    await open(page, '/live/wall');
    await expect(page.locator('live-wall sw-camera-tile[data-cam]')).toHaveCount(6);
    const wallFilter = page.locator('live-wall select[data-wall-recorder]');
    await expect(wallFilter).toBeVisible();
    await wallFilter.selectOption('nvr-2');
    await expect(page.locator('live-wall sw-camera-tile[data-cam]')).toHaveCount(3);
    await expect(page.locator('live-wall sw-page')).toHaveAttribute('subheading', /^3 מצלמות/);
    await shot(page, 'wall-filtered');
    await open(page, '/investigate/events');
    const evFilter = page.locator('investigate-events select[data-filter-recorder]');
    await expect(evFilter).toBeVisible();
    await evFilter.selectOption('nvr-2');
    await expect.poll(() => st.eventRecorder).toBe('nvr-2');
    await shot(page, 'events-filtered');
    await expect(page.locator('investigate-events')).not.toContainText(FORBIDDEN);
  });

  test('one recorder: the operator screens stay as they were (no recorder filter, the familiar connection card)', async ({ page }) => {
    await installMulti(page, { count: 1 });
    await open(page, '/live/wall');
    await expect(page.locator('live-wall sw-camera-tile[data-cam]').first()).toBeAttached();
    await expect(page.locator('live-wall select[data-wall-recorder]')).toHaveCount(0);
    await open(page, '/investigate/events');
    await expect(page.locator('investigate-events select[aria-label="מצלמה"]').first()).toBeAttached();
    await expect(page.locator('investigate-events select[data-filter-recorder]')).toHaveCount(0);
    await open(page, '/system/setup');
    await expect(page.locator(`${CARD} [data-nvr-connection] nvr-connection-form`)).toBeAttached();
    await expect(page.locator(`${CARD} [data-recorder]`)).toHaveCount(0);
    await expect(page.locator('sw-app system-setup select[data-nvr-system-recorder]')).toHaveCount(0);
    await expect(page.locator(`${CARD} [data-recorder-add]`)).toBeVisible();
    await shot(page, 'single-recorder-card');
  });
});
