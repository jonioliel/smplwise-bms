import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installAccessMock, url } from './access-control-mocks';
import { installParityMock } from './access-parity-mocks';
import { settlePage } from './pixel-settle';
import { installStationsMock, newMock, openStations } from './wiskey-stations-mocks';
import { installStationMediaMock, newMediaMock, type StationMediaMock } from './wiskey-station-media-mocks';

// WISKEY-TALK-CAPS-2382 against the MOCKED backend (tests/wiskey-stations-mocks.ts + tests/wiskey-station-media-mocks.ts +
// tests/access-control-mocks.ts: invented stations and answers; no station, no intercom, no go2rtc, no signed read anywhere).
// What it pins, for the three states of WisKey's signed direct/capabilities when the overview lists no W10 command (WisKey 2.0.1-rc.10):
//   - W10 only in the signed capabilities: the drawer dials natively (talk available) and the Settings row says WisKey is ready;
//   - listed in neither: the drawer says WisKey does not publish talk; the row names video and talk as not published;
//   - the signed read refused / failed: the drawer says it could not check (its own reason, apart from "not published"), the row names the
//     failed signed check with its reason in plain words; the drawer names WisKey only in its "no talk" reason (owner 04.11, Q21 "b").
// Evidence images: docs/design/evidence/wiskey-talk-caps-2382/.
//   run_smart.py <branch> tests/evidence-wiskey-talk-caps-2382.spec.ts --project=desktop --project=mobile
const SCREEN = 'wiskey-stations';
const BANNED = /wiskey|home\s*assistant|hikvision|ingress|supervisor|add-on|go2rtc|rtsp|webrtc|\bHA\b/i;
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/wiskey-talk-caps-2382');

async function boot(page: Page, over: Partial<StationMediaMock> = {}) {
  const mock = newMock();
  await installStationsMock(page, mock);
  const mm = newMediaMock({ mode: 'video_talk', ...over });
  await installStationMediaMock(page, mock, mm);
  await openStations(page);
  await expect(page.locator(`${SCREEN} [data-wk-stations][data-wk-state="ready"]`)).toBeVisible({ timeout: 30_000 });
  return mm;
}

const inDrawer = (page: Page, sel: string) => page.locator(`${SCREEN} sw-drawer[data-wk-drawer] ${sel}`);
const callSection = (page: Page) => inDrawer(page, '[data-wk-dsec="call"]');

async function openDrawer(page: Page, id: string) {
  await page.locator(`${SCREEN} [data-wk-grid] [data-wk-station="${id}"] button.open`).click();
  await expect(page.locator(`${SCREEN} sw-drawer[data-wk-drawer]`)).toHaveAttribute('open', '');
}

async function shot(page: Page, info: TestInfo, name: string) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.screenshot({ path: path.join(OUT, `${name}-${info.project.name}.png`), animations: 'disabled' });
}

test.describe('the drawer when the overview lists no W10 command', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  test('W10 only in the signed capabilities: the drawer dials natively', async ({ page }, info) => {
    const mm = await boot(page); // the server selected WisKey from the signed document: talk available, exactly as with the overview
    await openDrawer(page, 'lobby');
    const dial = callSection(page).locator('wk-talk-button[data-wk-dial="native"]');
    await expect(dial).toBeVisible();
    await expect(dial.locator('[data-wk-ptt]')).toHaveText('חיוג לעמדה');
    await expect(callSection(page).locator('[data-wk-dial="reason"]')).toHaveCount(0);
    expect(mm.starts).toEqual([]); // nothing starts before the press
    await shot(page, info, 'drawer-caps-listed');
  });

  test('listed in neither: "does not publish talk", with the classic panel as the secondary way', async ({ page }, info) => {
    await boot(page, { talkReason: 'not_listed' });
    await openDrawer(page, 'lobby');
    const row = callSection(page).locator('[data-wk-dial="reason"]');
    await expect(row).toHaveAttribute('data-reason', 'not_listed');
    await expect(row.locator('[data-wk-dial-reason]')).toHaveText('WisKey לא מפרסם פקודות דיבור ל-Arx'); // owner 04.11 Q21 "b"
    await expect(row.locator('[data-wk-dial-classic]')).toBeVisible();
    await expect(inDrawer(page, 'wk-talk-button')).toHaveCount(0);
    await shot(page, info, 'drawer-caps-not-listed');
  });

  test('the signed read refused: its own reason, apart from "not published", naming WisKey only in the reason', async ({ page }, info) => {
    await boot(page, { talkReason: 'capabilities_unread' });
    await openDrawer(page, 'lobby');
    const row = callSection(page).locator('[data-wk-dial="reason"]');
    await expect(row).toHaveAttribute('data-reason', 'capabilities_unread');
    const reason = 'לא ניתן היה לבדוק מול WisKey אם דיבור זמין; מוצג וידאו בלבד'; // owner 04.11 Q21 "b"
    await expect(row.locator('[data-wk-dial-reason]')).toHaveText(reason);
    await expect(row.locator('[data-wk-dial-classic]')).toBeVisible();
    await expect(inDrawer(page, 'wk-talk-button')).toHaveCount(0);
    expect((await callSection(page).innerText()).replace(reason, '')).not.toMatch(BANNED); // the exception is the reason text only
    await shot(page, info, 'drawer-caps-unread');
  });
});

// ---------------------------------------------------------------- Settings: the source row's readiness line

const SETTINGS = '/system/diagnostics?tab=access-control';
const DISPLAY = 'sw-app system-diagnostics system-access-display';
const LINE = `${DISPLAY} [data-access-display-source] [data-access-display-readiness]`;

const capsBlock = (over: Record<string, unknown> = {}) => ({ state: 'read', video_listed: true, talk_listed: true, reason: null, reason_kind: null, source: 'read', read_at: '2026-11-03T20:00:00Z', ...over });
const READY = {
  choice: 'auto',
  active: 'wiskey',
  mode: 'video_talk',
  wiskey: { reachable: true, video_listed: true, talk_listed: true, signing: true, listed_in: 'capabilities', capabilities: capsBlock() },
  missing: [],
  video_ready: true,
  talk_ready: true,
};
const NEITHER = {
  ...READY,
  active: 'local',
  wiskey: { ...READY.wiskey, video_listed: false, talk_listed: false, listed_in: null, capabilities: capsBlock({ video_listed: false, talk_listed: false }) },
  missing: ['video_not_listed', 'talk_not_listed'],
  video_ready: false,
  talk_ready: false,
};
const unread = (reason: string, kind: string | null) => ({
  ...NEITHER,
  wiskey: { ...NEITHER.wiskey, capabilities: capsBlock({ state: 'unread', video_listed: false, talk_listed: false, reason, reason_kind: kind }) },
  missing: ['capabilities_unread'],
});

async function bootSettings(page: Page, settings: Record<string, string>, readiness: Record<string, unknown>) {
  const mock = await installAccessMock(page, { settings });
  await installParityMock(page, mock, 'ready');
  const reads: string[] = [];
  await page.route('**/api/v1/access-control/station-media/readiness', async (route) => {
    reads.push(route.request().method());
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(readiness) });
  });
  await page.goto('about:blank');
  await page.goto(url(SETTINGS));
  await expect(page.locator(`${DISPLAY} sw-card[data-access-display="ready"]`)).toBeVisible({ timeout: 30_000 });
  return { mock, reads };
}

test.describe('Settings: the readiness line with the signed capabilities', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'behaviour on one project');
    test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  });

  test('W10 only in the signed capabilities: WisKey is ready', async ({ page }, info) => {
    const { reads } = await bootSettings(page, { 'access.station_media': 'video_talk', 'access.station_media_provider': 'auto' }, READY);
    const line = page.locator(LINE);
    await expect(line).toHaveAttribute('data-access-display-readiness', 'ok');
    await expect(line).toHaveText('WisKey מוכן: וידאו ודיבור מתוך המסך');
    expect(reads).toEqual(['GET']);
    await settlePage(page);
    await page.locator(`${DISPLAY} sw-card`).first().screenshot({ path: path.join(OUT, `settings-caps-listed-${info.project.name}.png`) });
  });

  test('listed in neither: video and talk are not published', async ({ page }) => {
    await bootSettings(page, { 'access.station_media': 'video_talk', 'access.station_media_provider': 'auto' }, NEITHER);
    const line = page.locator(LINE);
    await expect(line).toHaveAttribute('data-access-display-readiness', 'missing');
    await expect(line).toHaveText('חסר למצב WisKey: WisKey לא מפרסם פקודות וידאו ל-Arx; WisKey לא מפרסם פקודות דיבור ל-Arx - עד אז מוצג וידאו מ-Arx בלבד');
  });

  test('the signed read refused or unreachable: the failed check with its reason in plain words', async ({ page }, info) => {
    await bootSettings(page, { 'access.station_media': 'video_talk', 'access.station_media_provider': 'auto' }, unread('discovery_refused:Unauthorized', 'refused'));
    const line = page.locator(LINE);
    await expect(line).toHaveAttribute('data-access-display-readiness', 'missing');
    await expect(line).toHaveText('חסר למצב WisKey: בדיקת היכולות החתומה מול WisKey נכשלה (WisKey דחה את החיבור החתום) - עד אז מוצג וידאו מ-Arx בלבד');
    expect(await line.innerText()).not.toContain('discovery_refused'); // the rule code stays in the API answer
    await settlePage(page);
    await page.locator(`${DISPLAY} sw-card`).first().screenshot({ path: path.join(OUT, `settings-caps-unread-${info.project.name}.png`) });
    await page.goto('about:blank');
    await bootSettings(page, { 'access.station_media': 'video_talk' }, unread('direct_unreachable', 'unreachable'));
    await expect(line).toHaveText('חסר למצב WisKey: בדיקת היכולות החתומה מול WisKey נכשלה (WisKey לא ענה)');
    await page.goto('about:blank');
    await bootSettings(page, { 'access.station_media': 'video_talk' }, unread('read_error:X', null));
    await expect(line).toHaveText('חסר למצב WisKey: בדיקת היכולות החתומה מול WisKey נכשלה (סיבה לא ידועה)');
  });

  test('an older server without the capabilities block still reads', async ({ page }) => {
    const old = { ...READY, wiskey: { reachable: true, video_listed: true, talk_listed: true, signing: true } };
    await bootSettings(page, { 'access.station_media': 'video_talk', 'access.station_media_provider': 'auto' }, old);
    await expect(page.locator(LINE)).toHaveText('WisKey מוכן: וידאו ודיבור מתוך המסך');
  });
});
