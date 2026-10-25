import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKIN_IDS } from '../src/design/skins';
import { installStationsMock, newMock, openStations, type StationsMock } from './wiskey-stations-mocks';
import { installStationMediaMock, newMediaMock, type StationMediaMock } from './wiskey-station-media-mocks';

// CR-036 slice S18 - a station's live video and push-to-talk in the stations screen's drawer, behind the real shell, against a
// MOCKED backend (tests/wiskey-stations-mocks.ts + tests/wiskey-station-media-mocks.ts: invented stations, a drawn canvas for the
// live picture, a fake microphone; no station, no intercom, no go2rtc). Desktop / tablet / phone. What it pins:
//   - OFF by default (`access.station_media`): the drawer is exactly S6's - the still, the classic panel - and no media read is made;
//   - `video`: the live player on the station's relay path, the sub profile WebRTC first, the main profile MSE, the quality choice;
//     talk stays the classic-panel link;
//   - `video_talk` with a talk transport: press and hold to talk (pointer and keyboard), ONE start request per press, frames only
//     while held, release / end / the server's own end; busy, a blocked microphone, a refused start, a station without talk (the
//     classic link comes back), a caller without the call permission (no talk control), video not allowed (the poster + talk);
//   - a card in a call offers "talk" that opens the drawer; no platform name in the drawer.
// Evidence images: docs/design/evidence/wiskey-station-media/ (every skin, light and dark, desktop and phone).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-wiskey-station-media.spec.ts --workers=1

const SCREEN = 'wiskey-stations';
const BANNED = /wiskey|home\s*assistant|hikvision|ingress|supervisor|add-on|go2rtc|rtsp|webrtc|\bHA\b/i;
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/wiskey-station-media');

async function boot(page: Page, over: Partial<StationMediaMock> = {}, base: Partial<StationsMock> = {}, o: Parameters<typeof openStations>[1] = {}) {
  const mock = newMock(base);
  await installStationsMock(page, mock);
  const mm = newMediaMock(over);
  await installStationMediaMock(page, mock, mm);
  await openStations(page, o);
  await expect(page.locator(`${SCREEN} [data-wk-stations][data-wk-state="ready"]`)).toBeVisible({ timeout: 30_000 });
  return { mock, mm };
}

const drawer = (page: Page) => page.locator(`${SCREEN} sw-drawer[data-wk-drawer]`);
const inDrawer = (page: Page, sel: string) => page.locator(`${SCREEN} sw-drawer[data-wk-drawer] ${sel}`);
const live = (page: Page) => inDrawer(page, 'wk-station-live');
const ptt = (page: Page) => inDrawer(page, 'wk-station-live wk-talk-button [data-wk-ptt]');
const talkLine = (page: Page) => inDrawer(page, 'wk-station-live wk-talk-button [data-wk-talk-line]');

async function openDrawer(page: Page, id: string) {
  await page.locator(`${SCREEN} [data-wk-grid] [data-wk-station="${id}"] button.open`).click();
  await expect(drawer(page)).toHaveAttribute('open', '');
}

const sockets = (page: Page) => page.evaluate(() => (window as unknown as { __liveSockets: { url: string; kind: string }[] }).__liveSockets);

async function holdAndRelease(page: Page, during: () => Promise<void>) {
  const box = (await ptt(page).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await during();
  await page.mouse.up();
}

async function shot(page: Page, info: TestInfo, name: string) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.screenshot({ path: path.join(OUT, `${name}-${info.project.name}.png`), animations: 'disabled' });
}

test.describe('station media: off by default', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  test('the drawer is S6 as before: the still, the classic panel, and no media read', async ({ page }) => {
    const { mm } = await boot(page, { mode: 'off' });
    await openDrawer(page, 'gate');
    await expect(inDrawer(page, '[data-wk-live] img')).toBeVisible();
    await expect(inDrawer(page, '[data-wk-classic-link]')).toBeVisible();
    await expect(live(page)).toHaveCount(0);
    await page.waitForTimeout(300);
    expect(mm.mediaReads).toEqual([]);
  });
});

test.describe('station media: live video', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  test('video: the live player on the station path - sub WebRTC first, main MSE - and talk stays the classic link', async ({ page }, info) => {
    const { mm } = await boot(page, { mode: 'video' });
    await openDrawer(page, 'gate');
    await expect(live(page)).toBeVisible();
    expect(mm.mediaReads).toContain('gate');
    const player = inDrawer(page, 'wk-station-live sw-live-player');
    await expect(player).toBeVisible();
    await expect.poll(async () => (await sockets(page)).map((s) => [new URL(s.url).pathname.replace(/^.*\/api\/v1\//, '') + new URL(s.url).search, s.kind])).toContainEqual(['access-control/stations/gate/live/ws?profile=sub', 'webrtc']);
    await expect.poll(() => player.evaluate((el) => (el as unknown as { status: string }).status), { timeout: 15_000 }).toBe('playing');
    await expect(inDrawer(page, 'wk-station-live [data-wk-talk="classic"]')).toBeVisible();
    await expect(inDrawer(page, 'wk-station-live wk-talk-button')).toHaveCount(0);
    await expect(inDrawer(page, '[data-wk-classic-link]')).toHaveCount(0); // the still's overlay is gone with the still
    await shot(page, info, 'video-classic-light');
    await inDrawer(page, 'wk-station-live [data-wk-quality] button[data-profile="main"]').click();
    await expect.poll(async () => (await sockets(page)).map((s) => [new URL(s.url).search, s.kind])).toContainEqual(['?profile=main', 'mse']);
    await expect(inDrawer(page, 'wk-station-live [data-wk-quality] button[data-profile="main"]')).toHaveAttribute('aria-pressed', 'true');
    const text = (await drawer(page).innerText()) + (await live(page).evaluate((el) => el.shadowRoot?.textContent ?? ''));
    expect(text).not.toMatch(BANNED);
  });

  test('a station with only the main profile has no quality choice; video not allowed keeps the still', async ({ page }) => {
    await boot(page, { mode: 'video', station: { lobby: 'main_only' } });
    await openDrawer(page, 'lobby');
    await expect(inDrawer(page, 'wk-station-live sw-live-player')).toBeVisible();
    await expect(inDrawer(page, 'wk-station-live [data-wk-quality]')).toHaveCount(0);
    await page.goto('about:blank');
    await boot(page, { mode: 'video', liveAllowed: false });
    await openDrawer(page, 'gate');
    await expect(inDrawer(page, '[data-wk-live] img')).toBeVisible();
    await expect(live(page)).toHaveCount(0);
  });

  test('an unavailable station keeps the still and the classic panel', async ({ page }) => {
    await boot(page, { mode: 'video_talk', station: { gate: 'unavailable:no_host' } });
    await openDrawer(page, 'gate');
    await expect(inDrawer(page, '[data-wk-live] img')).toBeVisible();
    await expect(live(page)).toHaveCount(0);
  });
});

test.describe('station media: push-to-talk', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  test('press and hold: one start, the floor while held, frames only then; release; end', async ({ page }, info) => {
    const { mm } = await boot(page, { mode: 'video_talk' });
    await openDrawer(page, 'gate');
    await expect(ptt(page)).toBeVisible();
    await expect(inDrawer(page, 'wk-station-live [data-wk-talk="classic"]')).toHaveCount(0);
    await expect(inDrawer(page, '[data-wk-talk="classic"]')).toHaveCount(0); // the call section's classic link too (gate is ringing)
    await shot(page, info, 'talk-ready-light');
    await holdAndRelease(page, async () => {
      await expect(ptt(page)).toHaveAttribute('data-phase', 'talking', { timeout: 10_000 });
      await expect.poll(() => mm.talkText.filter((m) => m.type === 'talk/ptt').map((m) => m.value)).toEqual(['down']);
      await expect(talkLine(page)).toContainText('נותרו');
      await shot(page, info, 'talk-talking-light');
      await expect.poll(() => mm.frames.length, { timeout: 5_000 }).toBeGreaterThan(0);
    });
    await expect(ptt(page)).toHaveAttribute('data-phase', 'open');
    await expect.poll(() => mm.talkText.filter((m) => m.type === 'talk/ptt').map((m) => m.value)).toEqual(['down', 'up']);
    const after = mm.frames.length;
    await page.waitForTimeout(400);
    expect(mm.frames.length).toBeLessThanOrEqual(after + 1); // at most one in flight when released
    expect(mm.frames.every((n) => n === 160)).toBe(true);
    expect(mm.starts).toHaveLength(1);
    expect(String(mm.starts[0].body.client_request_id)).toMatch(/^ptt-[0-9a-f]{24}$/);
    // the keyboard: Space held on the focused button is the same press, on the same session
    await ptt(page).focus();
    await page.keyboard.down('Space');
    await expect(ptt(page)).toHaveAttribute('data-phase', 'talking');
    await page.keyboard.up('Space');
    await expect(ptt(page)).toHaveAttribute('data-phase', 'open');
    expect(mm.starts).toHaveLength(1);
    await inDrawer(page, 'wk-station-live wk-talk-button [data-wk-talk-end]').click();
    await expect(ptt(page)).toHaveAttribute('data-phase', 'idle');
    await expect.poll(() => mm.talkText.at(-1)).toEqual({ type: 'talk/stop' });
    await expect(talkLine(page)).toHaveText('הדיבור הסתיים');
  });

  // 2.19.0 gate (release/2190-fix): listening (WKAUDIN-295) is off here; its host stayed a grid item of the drawer and added an empty
  // row + gap under the push-to-talk. "No trace while off" means no box at all; when the server offers it, the button is there.
  test('listening not offered: no trace in the drawer, not even a gap; offered: the listen button under the push-to-talk', async ({ page }) => {
    await boot(page, { mode: 'video_talk' });
    await openDrawer(page, 'gate');
    await expect(ptt(page)).toBeVisible();
    const host = inDrawer(page, 'wk-station-live wk-listen-button');
    await expect(host).toHaveAttribute('hidden', '');
    expect(await host.boundingBox()).toBeNull();
    await page.route('**/api/v1/access-control/stations/*/listen', (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ station_id: 'lobby', available: true, reason: null, codec: 'pcmu', sample_rate: 8000, frame_ms: 20, max_seconds: 120 }) })
        : route.fallback(),
    );
    await page.keyboard.press('Escape');
    await openDrawer(page, 'lobby');
    const offered = inDrawer(page, 'wk-station-live wk-listen-button');
    await expect(offered.locator('[data-wk-listen-toggle]')).toBeVisible();
    await expect(offered).not.toHaveAttribute('hidden', '');
  });

  test('the server ends the session: the time is over', async ({ page }) => {
    const { mm } = await boot(page, { mode: 'video_talk' });
    await openDrawer(page, 'gate');
    await holdAndRelease(page, async () => {
      await expect(ptt(page)).toHaveAttribute('data-phase', 'talking', { timeout: 10_000 });
    });
    mm.serverEnd('expired', 4408);
    await expect(ptt(page)).toHaveAttribute('data-phase', 'idle');
    await expect(talkLine(page)).toHaveAttribute('data-problem', 'expired');
    await expect(talkLine(page)).toHaveText('זמן הדיבור הסתיים');
  });

  test('busy, a blocked microphone, a refused start', async ({ page }, info) => {
    await boot(page, { mode: 'video_talk', busy: true });
    await openDrawer(page, 'gate');
    await expect(ptt(page)).toBeDisabled();
    await expect(inDrawer(page, 'wk-station-live wk-talk-button [data-wk-talk-line]')).toHaveText('העמדה בדיבור עם מפעיל אחר');
    await shot(page, info, 'talk-busy-light');
    await page.goto('about:blank');
    await boot(page, { mode: 'video_talk', mic: 'denied' });
    await openDrawer(page, 'gate');
    await expect(ptt(page)).toBeDisabled();
    await expect(talkLine(page)).toHaveAttribute('data-problem', 'denied');
    await page.goto('about:blank');
    const { mm } = await boot(page, { mode: 'video_talk', startFail: { status: 409, code: 'intercom_talk_user_busy' } });
    await openDrawer(page, 'gate');
    await holdAndRelease(page, async () => {
      await expect(talkLine(page)).toHaveAttribute('data-problem', 'user_busy');
    });
    expect(mm.starts).toHaveLength(1);
    expect(mm.talkSockets).toHaveLength(0);
    await page.waitForTimeout(500);
    expect(mm.starts).toHaveLength(1); // never retried
  });

  test('no talk transport: the classic-panel link; no call permission: no talk control at all', async ({ page }) => {
    await boot(page, { mode: 'video_talk', station: { gate: 'video_only' } });
    await openDrawer(page, 'gate');
    await expect(inDrawer(page, 'wk-station-live [data-wk-talk="classic"]')).toBeVisible();
    await expect(inDrawer(page, 'wk-station-live wk-talk-button')).toHaveCount(0);
    await page.goto('about:blank');
    await boot(page, { mode: 'video_talk', talkAllowed: false }, { persona: 'operator' });
    await openDrawer(page, 'gate');
    await expect(inDrawer(page, 'wk-station-live sw-live-player')).toBeVisible();
    await expect(inDrawer(page, 'wk-station-live wk-talk-button')).toHaveCount(0);
    await expect(inDrawer(page, '[data-wk-talk]')).toHaveCount(0);
  });

  test('video not allowed but talk is: the poster and the push-to-talk', async ({ page }) => {
    await boot(page, { mode: 'video_talk', liveAllowed: false });
    await openDrawer(page, 'gate');
    await expect(inDrawer(page, 'wk-station-live [data-wk-live-frame] img')).toBeVisible();
    await expect(inDrawer(page, 'wk-station-live sw-live-player')).toHaveCount(0);
    await expect(ptt(page)).toBeVisible();
  });

  test('a card in a call offers talk, which opens the drawer with the push-to-talk', async ({ page }) => {
    await boot(page, { mode: 'video_talk' });
    const btn = page.locator(`${SCREEN} [data-wk-grid] [data-wk-station="lab"] [data-wk-talk="drawer"]`);
    await expect(btn).toBeVisible();
    await btn.click();
    await expect(drawer(page)).toHaveAttribute('data-wk-drawer-station', 'lab');
    await expect(ptt(page)).toBeVisible();
  });
});

test.describe('station media: every skin (evidence images)', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  for (const skin of SKIN_IDS) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`${skin} ${scheme}: live video and push-to-talk in the drawer`, async ({ page }, info) => {
        test.skip(info.project.name === 'tablet', 'desktop and phone');
        await boot(page, { mode: 'video_talk' }, {}, { skin, scheme });
        await openDrawer(page, 'gate');
        await expect.poll(() => inDrawer(page, 'wk-station-live sw-live-player').evaluate((el) => (el as unknown as { status: string }).status), { timeout: 15_000 }).toBe('playing');
        await expect(ptt(page)).toBeVisible();
        await shot(page, info, `drawer-${skin}-${scheme}`);
      });
    }
  }
});
