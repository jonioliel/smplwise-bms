import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installAccessMock, url } from './access-control-mocks';
import { installParityMock } from './access-parity-mocks';
import { settlePage } from './pixel-settle';
import { installStationsMock, newMock, openStations } from './wiskey-stations-mocks';
import { installStationMediaMock, newMediaMock, type StationMediaMock } from './wiskey-station-media-mocks';

// WISKEY-TALK-DIAL-2382 against the MOCKED backend (tests/wiskey-stations-mocks.ts + tests/wiskey-station-media-mocks.ts +
// tests/access-control-mocks.ts: invented stations and answers, a drawn canvas, a fake microphone; no station, no intercom, no go2rtc).
// What it pins:
//   - the drawer's "חיוג לעמדה" in its three states: talk available (it IS Arx's own talk session - one start request, the in-call duration,
//     hang up), the provider is Arx's own source (why not + the classic panel as the secondary way), the signed pairing missing (the same);
//   - "WisKey does not list talk" reads differently from "the source is Arx's own"; the drawer names the integration only in the "no
//     talk" reasons that describe it (owner 04.11, Q21 "b");
//   - Settings › תצוגת מסך התחנות: the source row (Arx / WisKey) and its readiness line in plain Hebrew; saving sends only that key.
// Evidence images: docs/design/evidence/wiskey-talk-dial-2382/.
//   run_smart.py <branch> tests/evidence-wiskey-talk-dial-2382.spec.ts --project=desktop --project=mobile
const SCREEN = 'wiskey-stations';
const BANNED = /wiskey|home\s*assistant|hikvision|ingress|supervisor|add-on|go2rtc|rtsp|webrtc|\bHA\b/i;
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/wiskey-talk-dial-2382');

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

test.describe('dial the station from the drawer', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  test('talk available: "חיוג לעמדה" is Arx\'s own talk - one start, the in-call duration, hang up', async ({ page }, info) => {
    const mm = await boot(page);
    await openDrawer(page, 'lobby'); // an idle station: the call section says "no call" and offers the dial
    const dial = callSection(page).locator('wk-talk-button[data-wk-dial="native"]');
    await expect(dial).toBeVisible();
    await expect(callSection(page).locator('[data-wk-dial]:not(wk-talk-button)')).toHaveCount(0); // no classic-panel dial link in its place
    // owner 03.11 (Q2 "ג"): a small secondary link to the classic panel stays beside the native dial
    await expect(callSection(page).locator('.dialnative [data-wk-dial-classic="secondary"]')).toBeVisible();
    await expect(inDrawer(page, 'wk-talk-button')).toHaveCount(1); // the one talk control of the drawer
    await expect(inDrawer(page, 'wk-station-live wk-talk-button')).toHaveCount(0);
    const btn = dial.locator('[data-wk-ptt]');
    await expect(btn).toHaveText('חיוג לעמדה');
    await expect(btn).toHaveAttribute('data-phase', 'idle');
    await shot(page, info, 'dial-native-idle');
    await btn.click();
    await expect(btn).toHaveAttribute('data-phase', 'talking', { timeout: 10_000 });
    expect(mm.starts.map((s) => s.station)).toEqual(['lobby']);
    await expect(dial.locator('[data-wk-talk-elapsed]')).toContainText('בשיחה');
    await expect(dial.locator('[data-wk-talk-left]')).toBeVisible();
    const end = dial.locator('[data-wk-talk-end]');
    await expect(end).toHaveText('ניתוק');
    await shot(page, info, 'dial-native-in-call');
    await end.click();
    await expect(btn).toHaveAttribute('data-phase', 'idle');
    await expect.poll(() => mm.talkText.some((m) => m.type === 'talk/stop')).toBe(true);
    expect(mm.starts).toHaveLength(1); // never retried
  });

  test('a station in a call: the same control says "talk to the station"', async ({ page }) => {
    await boot(page);
    await openDrawer(page, 'lab');
    await expect(callSection(page).locator('wk-talk-button[data-wk-dial="native"] [data-wk-ptt]')).toHaveText('דיבור עם העמדה');
  });

  test('provider local: why not, in plain words, with the classic panel as the secondary way', async ({ page }, info) => {
    await boot(page, { talkReason: 'provider_local' });
    await openDrawer(page, 'lobby');
    const row = callSection(page).locator('[data-wk-dial="reason"]');
    await expect(row).toHaveAttribute('data-reason', 'provider_local');
    await expect(row.locator('[data-wk-dial-reason]')).toHaveText('המקור המקומי מציג וידאו בלבד, בלי דיבור');
    await expect(row.locator('[data-wk-dial-classic]')).toBeVisible();
    await expect(inDrawer(page, 'wk-talk-button')).toHaveCount(0);
    await expect(inDrawer(page, '[data-wk-dial]:not([data-wk-dial="reason"])')).toHaveCount(0); // no silent classic-panel dial link
    expect(await inDrawer(page, '[data-wk-dsec="call"]').innerText()).not.toMatch(BANNED);
    await shot(page, info, 'dial-provider-local');
  });

  test('pairing missing: its own reason; WisKey not listing talk reads differently', async ({ page }, info) => {
    await boot(page, { talkReason: 'pairing' });
    await openDrawer(page, 'lobby');
    const row = callSection(page).locator('[data-wk-dial="reason"]');
    await expect(row).toHaveAttribute('data-reason', 'pairing');
    // owner 04.11 (Q21 "b"): the "no talk" reasons that describe WisKey name it - the exception is the reason text only
    await expect(row.locator('[data-wk-dial-reason]')).toHaveText('חסר צימוד חתום ל-WisKey, ולכן אין דיבור מהמסך');
    await expect(row.locator('[data-wk-dial-classic]')).toBeVisible();
    await shot(page, info, 'dial-pairing');
    await page.goto('about:blank');
    await boot(page, { talkReason: 'not_listed' });
    await openDrawer(page, 'lobby');
    const notListed = 'WisKey לא מפרסם פקודות דיבור ל-Arx';
    await expect(callSection(page).locator('[data-wk-dial-reason]')).toHaveText(notListed);
    expect((await callSection(page).innerText()).replace(notListed, '')).not.toMatch(BANNED);
  });

  test('the setting "video" says talk is off, and an unknown reason is still explained', async ({ page }) => {
    await boot(page, { mode: 'video' });
    await openDrawer(page, 'lobby');
    await expect(callSection(page).locator('[data-wk-dial="reason"]')).toHaveAttribute('data-reason', 'off');
    await page.goto('about:blank');
    await boot(page, { talkReason: 'something_new' });
    await openDrawer(page, 'lobby');
    await expect(callSection(page).locator('[data-wk-dial-reason]')).toHaveText('דיבור אינו זמין כרגע');
  });

  test('the setting off: the classic-panel dial link exactly as before, and no media read', async ({ page }) => {
    const mm = await boot(page, { mode: 'off' });
    await openDrawer(page, 'lobby');
    await expect(callSection(page).locator('wk-action-button[data-wk-dial]')).toBeVisible();
    await expect(callSection(page).locator('[data-wk-dial="reason"], wk-talk-button')).toHaveCount(0);
    expect(mm.mediaReads).toEqual([]);
  });
});

// ---------------------------------------------------------------- Settings: the media source and what WisKey mode needs

const SETTINGS = '/system/diagnostics?tab=access-control';
const DISPLAY = 'sw-app system-diagnostics system-access-display';
const SOURCE = `${DISPLAY} select[data-set-access-display="access.station_media_provider"]`;

const READY = { choice: 'local', active: 'local', mode: 'video_talk', wiskey: { reachable: true, video_listed: true, talk_listed: true, signing: true }, missing: [], video_ready: true, talk_ready: true };

async function bootSettings(page: Page, settings: Record<string, string>, readiness: Record<string, unknown> | 'fail') {
  const mock = await installAccessMock(page, { settings });
  await installParityMock(page, mock, 'ready');
  const reads: string[] = [];
  await page.route('**/api/v1/access-control/station-media/readiness', async (route) => {
    reads.push(route.request().method());
    if (readiness === 'fail') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'unavailable', user_message: 'x', retryable: true, correlation_id: '', details: {} }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(readiness) });
  });
  await page.goto('about:blank');
  await page.goto(url(SETTINGS));
  await expect(page.locator(`${DISPLAY} sw-card[data-access-display="ready"]`)).toBeVisible({ timeout: 30_000 });
  return { mock, reads };
}

test.describe('Settings: the station media source', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'behaviour on one project');
    test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  });

  test('hidden while the media setting is off', async ({ page }) => {
    await bootSettings(page, {}, READY);
    await expect(page.locator(`${DISPLAY} [data-access-display-source]`)).toHaveCount(0);
  });

  test('Arx / WisKey, the readiness line in plain Hebrew (the lab case: WisKey publishes no W10 command), saving sends only the source', async ({ page }, info) => {
    const lab = { ...READY, wiskey: { reachable: true, video_listed: false, talk_listed: false, signing: true }, missing: ['video_not_listed', 'talk_not_listed'], video_ready: false, talk_ready: false };
    const { mock } = await bootSettings(page, { 'access.station_media': 'video_talk' }, lab);
    const row = page.locator(`${DISPLAY} [data-access-display-source]`);
    await expect(row).toBeVisible();
    await expect(page.locator(SOURCE)).toHaveValue('local');
    expect(await page.locator(`${SOURCE} option`).evaluateAll((os) => os.map((o) => [(o as HTMLOptionElement).value, o.textContent?.trim()]))).toEqual([
      ['local', 'Arx (וידאו בלבד)'],
      ['auto', 'WisKey (וידאו ודיבור)'],
    ]);
    const line = row.locator('[data-access-display-readiness]');
    await expect(line).toHaveAttribute('data-access-display-readiness', 'missing');
    await expect(line).toHaveText('חסר למצב WisKey: WisKey לא מפרסם פקודות וידאו ל-Arx; WisKey לא מפרסם פקודות דיבור ל-Arx');
    await page.locator(SOURCE).selectOption('auto');
    await expect(line).toContainText('עד אז מוצג וידאו מ-Arx בלבד');
    await settlePage(page);
    await page.locator(`${DISPLAY} sw-card`).first().screenshot({ path: path.join(OUT, `settings-source-lab-${info.project.name}.png`) });
    await page.locator(`${DISPLAY} sw-button[data-save-access-display]`).click();
    await expect(page.locator(`${DISPLAY} .msg.ok`)).toBeVisible();
    expect(mock.patches).toEqual([{ 'access.station_media_provider': 'auto' }]);
  });

  test('ready, pairing missing, and a failed check each say so', async ({ page }) => {
    await bootSettings(page, { 'access.station_media': 'video', 'access.station_media_provider': 'auto' }, { ...READY, choice: 'auto', active: 'wiskey' });
    const line = page.locator(`${DISPLAY} [data-access-display-source] [data-access-display-readiness]`);
    await expect(line).toHaveText('WisKey מוכן: וידאו ודיבור מתוך המסך');
    await page.goto('about:blank');
    await bootSettings(page, { 'access.station_media': 'video', 'access.station_media_provider': 'auto' }, { ...READY, choice: 'auto', wiskey: { ...READY.wiskey, signing: false }, missing: ['pairing_missing'], video_ready: false, talk_ready: false });
    await expect(line).toHaveText('חסר למצב WisKey: אין צימוד חתום ל-WisKey - עד אז מוצג וידאו מ-Arx בלבד');
    await page.goto('about:blank');
    await bootSettings(page, { 'access.station_media': 'video' }, 'fail');
    await expect(line).toHaveAttribute('data-access-display-readiness', 'failed');
  });
});
