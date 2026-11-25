import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { installStationsMock, newMock, openStations } from './wiskey-stations-mocks';
import { MOCK_REQUEST_ID, installOpsMock, newOpsMock, type OpsMock } from './wiskey-station-ops-mocks';
import { tallDesktop } from './helpers/tall-desktop';

// WISKEY-R4-2520 - the station sync's numbered form in the stations drawer's maintenance block, behind the real shell, against a MOCKED
// backend (tests/wiskey-stations-mocks.ts + tests/wiskey-station-ops-mocks.ts with `syncMode: 'request_id'`: invented answers, no
// station, no intercom). What it pins:
//   - an accepted sync shows the request id and says it is queued, not proof of a sync; "check sync status" is a READ (no POST) and
//     says where the request stands;
//   - a sync with no clear answer holds the station: the sync button is disabled with the reason, and the status read is offered - it
//     settles the hold; nothing is repeated by itself;
//   - no platform name anywhere.
// Pictures (before / after compare page): SW_SHOT_DIR=<dir> SW_SCHEME=light|dark. SW_BEFORE=1 runs the same steps against a build without
// the row (only the pictures, no assertion on the new elements).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-wiskey-sync-v1-2520.spec.ts --workers=1

const SCREEN = 'wiskey-stations';
const BANNED = /wiskey|home\s*assistant|hikvision|ingress|supervisor|add-on|\bHA\b/i;
const SCHEME = process.env.SW_SCHEME === 'dark' ? 'dark' : 'light';
const BEFORE = process.env.SW_BEFORE === '1';
const OUT = process.env.SW_SHOT_DIR ?? '';

const inBlock = (page: Page, sel: string) => page.locator(`${SCREEN} sw-drawer[data-wk-drawer] wk-station-maintenance ${sel}`);
const block = (page: Page) => page.locator(`${SCREEN} sw-drawer[data-wk-drawer] wk-station-maintenance`);

async function boot(page: Page, over: Partial<OpsMock>) {
  const mock = newMock({});
  await installStationsMock(page, mock);
  const ops = newOpsMock({ syncMode: 'request_id', authFailed: new Set(), ...over });
  await installOpsMock(page, mock, ops);
  await openStations(page, { scheme: SCHEME });
  await expect(page.locator(`${SCREEN} [data-wk-stations][data-wk-state="ready"]`)).toBeVisible({ timeout: 30_000 });
  await page.locator(`${SCREEN} [data-wk-grid] [data-wk-station="lobby"] button.open`).click();
  await expect(page.locator(`${SCREEN} sw-drawer[data-wk-drawer]`)).toHaveAttribute('open', '');
  await expect(inBlock(page, '[data-wk-maint-state="ready"]')).toBeVisible({ timeout: 15_000 });
  await inBlock(page, '[data-wk-maint-ops]').scrollIntoViewIfNeeded();
  return ops;
}

async function shot(page: Page, info: TestInfo, name: string) {
  if (!OUT) return;
  fs.mkdirSync(OUT, { recursive: true });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await block(page).screenshot({ path: path.join(OUT, `${name}-${info.project.name}-${SCHEME}${BEFORE ? '-before' : ''}.png`), animations: 'disabled' });
}

async function sendSync(page: Page) {
  await inBlock(page, '[data-wk-maint-op="sync"]').click();
  await expect(inBlock(page, 'sw-dialog[data-wk-maint-confirm="sync"]')).toHaveAttribute('open', '');
  await inBlock(page, '[data-wk-maint-send]').click();
}

test.describe('station maintenance: the numbered sync', () => {
  tallDesktop();
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  test('an accepted sync shows its request id as queued; the status read is a read and says where it stands', async ({ page }, info) => {
    const ops = await boot(page, { syncMatch: 'queued' });
    await sendSync(page);
    await expect(inBlock(page, '[data-wk-maint-result="sync"][data-status="acknowledged"]')).toContainText('התקבל');
    if (BEFORE) {
      await shot(page, info, 'accepted');
      return;
    }
    await expect(inBlock(page, `[data-wk-maint-request-id="${MOCK_REQUEST_ID}"]`)).toContainText(MOCK_REQUEST_ID.split('-')[0]);
    await expect(inBlock(page, '[data-wk-maint-accepted]')).toContainText('עדיין לא הוכחה');
    await shot(page, info, 'accepted');
    await inBlock(page, '[data-wk-maint-sync-check]').click();
    await expect(inBlock(page, '[data-wk-maint-sync-answer="queued"]')).toContainText('הבקשה ממתינה בתור');
    expect(ops.posts).toHaveLength(1); // the read posted nothing
    expect(ops.syncReads).toEqual(['lobby']);
    await shot(page, info, 'status-queued');
    const text = await block(page).evaluate((el) => el.shadowRoot?.textContent ?? '');
    expect(text).not.toMatch(BANNED);
  });

  test('no clear answer holds the next sync until the status read; the read settles it and nothing repeats', async ({ page }, info) => {
    const ops = await boot(page, { result: { sync: 'unknown' } });
    await sendSync(page);
    await expect(inBlock(page, '[data-wk-maint-result="sync"][data-status="unknown"]')).toContainText('ייתכן שבוצע');
    if (BEFORE) {
      await shot(page, info, 'held');
      return;
    }
    await expect(inBlock(page, '[data-wk-maint-sync-gate="readback_required"]')).toContainText('אחרי בדיקת מצב הסנכרון');
    await expect(inBlock(page, '[data-wk-maint-op="sync"]')).toHaveAttribute('disabled', '');
    await shot(page, info, 'held');
    await inBlock(page, '[data-wk-maint-sync-check]').click();
    await expect(inBlock(page, '[data-wk-maint-sync-answer]')).toContainText('סנכרון ממתין בתור בעמדה');
    await expect(inBlock(page, '[data-wk-maint-sync-gate]')).toHaveCount(0);
    await expect(inBlock(page, '[data-wk-maint-op="sync"]')).not.toHaveAttribute('disabled', '');
    await shot(page, info, 'held-settled');
    await page.waitForTimeout(500);
    expect(ops.posts).toHaveLength(1);
  });
});
