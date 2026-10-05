import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_TARGETS, PERMS, iso, installCastMock, session, target, type CastMock, type CastMockOptions } from './cast-mocks';

// CR-028 (CAST1 UI): casting a camera to a screen, against the mocked wire contract of docs/changes/CR-028 section 12.5 (tests/cast-mocks.ts; invented
// names, no device). The cast button next to the full-screen control, the picker (docked panel on a wide screen, list or sheet on the phone by ui.dd_phone),
// blocked screens with their reasons, the status line, the global pill with extend / switch / stop and the power-off question, the live-window event
// refetch, remote (/arx) mode, and the settings: administration, per-screen switches, origin check, the 60-second test cast, "המסכים שלי לשידור".
//   SW_BASE_URL=http://127.0.0.1:5262/ npx playwright test tests/evidence-cast-ui.spec.ts --workers=1
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/CR-028/cast1-ui');
const phone = (page: Page) => (page.viewportSize()?.width ?? 1440) <= 860;
const live = (page: Page) => page.locator('sw-app live-camera');
const pill = (page: Page) => page.locator('sw-app sw-cast-pill');
const picker = (page: Page) => live(page).locator('sw-cast-picker');
const sysMm = (page: Page) => page.locator('sw-app system-multimedia');

async function shot(page: Page, name: string) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${name}-${page.viewportSize()?.width ?? 0}.png`) });
}

async function setup(page: Page, opts: CastMockOptions = {}): Promise<CastMock> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    try { localStorage.removeItem('sw.cast.recent'); } catch { /* storage unavailable */ }
  });
  return installCastMock(page, opts);
}

async function openLive(page: Page, camera = 'cam-1') {
  await page.goto(`/?design=a#/live/cameras/${camera}`);
  await page.waitForSelector('sw-app');
  await page.waitForFunction(() => !!document.querySelector('sw-app')?.shadowRoot?.querySelector('live-camera')?.shadowRoot?.querySelector('[data-camera-settings]'), null, { timeout: 20_000 });
  await page.evaluate(() => document.fonts.ready);
}

const castButton = (page: Page) => live(page).locator('[data-cast-button]');
const open = async (page: Page) => {
  await castButton(page).click();
  await expect(picker(page).locator('[data-cast-list]')).toBeVisible();
};
const rowOf = (page: Page, key: string) => picker(page).locator(`[data-cast-target="${key}"]`);
const startCalls = (m: CastMock) => m.calls.filter((c) => c.method === 'POST' && c.path === 'sessions');

test.describe('live camera: the cast button and the picker', () => {
  test('the button sits next to full screen, only for a caster with a screen to list; never a hint otherwise', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await setup(page);
    await openLive(page);
    await expect(castButton(page)).toBeVisible();
    // next to the full-screen control, inside the same round group
    const siblings = await live(page).locator('.round > button').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? e.getAttribute('data-cast-button') ?? ''));
    expect(siblings.indexOf('שדר למסך') - siblings.indexOf('מסך מלא')).toBe(1);
    await shot(page, 'live-button');
    expect(errors).toEqual([]);
  });

  test('no button without media.cast, with no screens, or while casting is not ready', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project is enough');
    await setup(page, { perms: PERMS.viewer });
    await openLive(page);
    await expect(live(page).locator('[data-camera-settings]')).toBeVisible();
    await expect(castButton(page)).toHaveCount(0);
    expect(await live(page).innerText()).not.toContain('שדר למסך');
  });

  test('no button when the server lists no screen or says casting is not ready', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project is enough');
    await setup(page, { targets: [] });
    await openLive(page);
    await expect(live(page).locator('[data-camera-settings]')).toBeVisible();
    await expect(castButton(page)).toHaveCount(0);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await setup(page, { ready: false, reason: 'relay_off' });
    await page.reload();
    await page.waitForSelector('sw-app live-camera [data-camera-settings]');
    await expect(castButton(page)).toHaveCount(0);
  });

  test('the picker lists screens by floor with state words and operator badges; blocked ones are grey with the reason and cannot be picked', async ({ page }) => {
    const m = await setup(page, { ddPhone: 'list' });
    await openLive(page);
    await open(page);
    const mode = await picker(page).locator('[data-cast-picker]').getAttribute('data-cast-picker');
    expect(mode).toBe(phone(page) ? 'list' : 'pop'); // ui.dd_phone = list: the phone gets the docked list
    await expect(picker(page).locator('[data-cast-group]')).toHaveCount(2);
    await expect(rowOf(page, 'md-living')).toContainText('פנוי');
    await expect(rowOf(page, 'md-kitchen')).toContainText('מנגן מוזיקה');
    await expect(rowOf(page, 'md-lobby')).toContainText('מסך ציבורי');
    await expect(rowOf(page, 'md-old')).toContainText('השידור למסך הזה לא הופעל');
    await expect(rowOf(page, 'md-lobby').locator('.row')).toHaveAttribute('aria-disabled', 'true');
    await expect(rowOf(page, 'md-hub').locator('sw-badge')).toHaveAttribute('label', 'כנראה'); // operator words, never a technology name
    const text = await picker(page).innerText();
    for (const word of ['Cast', 'Chromecast', 'Home Assistant', 'DLNA']) expect(text).not.toContain(word);
    await expect(picker(page).locator('[data-cast-mine]')).toHaveAttribute('href', '#/multimedia/cast');
    await shot(page, 'picker-open');
    // a blocked row starts nothing
    await rowOf(page, 'md-lobby').locator('.row').click({ force: true });
    expect(startCalls(m)).toHaveLength(0);
    // Escape closes
    await page.keyboard.press('Escape');
    await expect(picker(page).locator('[data-cast-list]')).toHaveCount(0);
  });

  test('on the phone the owner can choose the bottom sheet (ui.dd_phone = sheet); a wide screen keeps the docked panel', async ({ page }) => {
    await setup(page, { ddPhone: 'sheet' });
    await openLive(page);
    await open(page);
    await expect(picker(page).locator('[data-cast-picker]')).toHaveAttribute('data-cast-picker', phone(page) ? 'sheet' : 'pop');
    await shot(page, 'picker-ddphone-sheet');
  });

  test('a tap starts the cast at once: the request names the screen, the camera and a request id; the status line goes starting, then playing with the countdown; the pill appears', async ({ page }) => {
    const m = await setup(page);
    await openLive(page);
    await open(page);
    await rowOf(page, 'md-living').locator('.row').click();
    await expect(picker(page).locator('[data-cast-list]')).toHaveCount(0); // the picker closed
    const [req] = startCalls(m);
    expect(req.body).toMatchObject({ target_key: 'md-living', camera_id: 'cam-1', profile: 'sub', duration: 'default' });
    expect(String((req.body as { client_request_id: string }).client_request_id).length).toBeGreaterThan(8);
    const status = live(page).locator('[data-cast-status]');
    await expect(status).toBeVisible();
    await expect(status).toHaveAttribute('data-cast-status-state', 'starting');
    await expect(status).toContainText('מתחבר למסך');
    await expect(status).toHaveAttribute('data-cast-status-state', 'playing', { timeout: 6000 });
    await expect(status).toContainText('משדר: טלוויזיה סלון');
    await expect(live(page).locator('[data-cast-status-left]')).toHaveText(/^(29|30):\d\d$/);
    await expect(pill(page).locator('[data-cast-pill]')).toBeVisible();
    await expect(pill(page).locator('[data-cast-pill-label]')).toContainText('טלוויזיה סלון');
    await shot(page, 'live-casting');
    // the recents remember the screen
    expect(await page.evaluate(() => localStorage.getItem('sw.cast.recent'))).toContain('md-living');
  });

  test('a screen playing music asks first; "כן" repeats the start with confirmed; "ביטול" starts nothing', async ({ page }) => {
    const m = await setup(page);
    await openLive(page);
    await open(page);
    await rowOf(page, 'md-kitchen').locator('.row').click();
    await expect(picker(page).locator('[data-cast-confirm]')).toBeVisible();
    expect(startCalls(m)).toHaveLength(0);
    await shot(page, 'picker-confirm-music');
    await picker(page).locator('[data-cast-confirm-no]').click();
    await expect(picker(page).locator('[data-cast-confirm]')).toHaveCount(0);
    expect(startCalls(m)).toHaveLength(0);
    await rowOf(page, 'md-kitchen').locator('.row').click();
    await picker(page).locator('[data-cast-confirm-yes]').click();
    await expect(live(page).locator('[data-cast-status]')).toBeVisible();
    expect(startCalls(m)[0].body).toMatchObject({ target_key: 'md-kitchen', confirmed: true });
  });

  test('a permanent cast is offered only on a screen the administrator marked, and sends duration permanent; the countdown says "קבוע"', async ({ page }) => {
    const m = await setup(page);
    await openLive(page);
    await open(page);
    await expect(rowOf(page, 'md-living').locator('[data-cast-permanent]')).toHaveCount(0);
    await rowOf(page, 'md-hub').locator('[data-cast-permanent]').click();
    await expect(live(page).locator('[data-cast-status]')).toBeVisible();
    expect(startCalls(m)[0].body).toMatchObject({ target_key: 'md-hub', duration: 'permanent' });
    await expect(pill(page).locator('[data-cast-pill-label]')).toContainText('קבוע');
  });

  test('the main stream is offered only when the server says a screen can take it', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project is enough');
    const m = await setup(page, { mainPossible: true });
    await openLive(page);
    await open(page);
    await picker(page).locator('[data-cast-q="main"]').click();
    await rowOf(page, 'md-hub').locator('.row').click();
    await expect(live(page).locator('[data-cast-status]')).toBeVisible();
    expect(startCalls(m)[0].body).toMatchObject({ profile: 'main' });
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await setup(page);
    await page.reload();
    await page.waitForSelector('sw-app live-camera [data-camera-settings]');
    await open(page);
    await expect(picker(page).locator('[data-cast-q="main"]')).toBeDisabled();
  });

  test('errors show the server sentence and keep the list: the cap, a refused start (200), a TV that cannot be reached', async ({ page }) => {
    const m = await setup(page);
    await openLive(page);
    await open(page);
    m.failNextStart = { status: 409, code: 'cast_limit', message: 'נגמרה מכסת השידורים (2).' };
    await rowOf(page, 'md-living').locator('.row').click();
    await expect(picker(page).locator('[data-cast-error]')).toContainText('נגמרה מכסת השידורים (2).');
    await expect(rowOf(page, 'md-living')).toBeVisible();
    await shot(page, 'picker-error-limit');
    m.refuseNextStart = 'cast_unsupported';
    await rowOf(page, 'md-living').locator('.row').click();
    await expect(picker(page).locator('[data-cast-error]')).toContainText('לא יכול לקבל שידור');
    m.failNextStart = { status: 503, code: 'ha_unavailable', message: 'תשתית המערכת לא זמינה כרגע.' };
    await rowOf(page, 'md-living').locator('.row').click();
    await expect(picker(page).locator('[data-cast-error]')).toContainText('תשתית המערכת לא זמינה כרגע.');
  });

  test('a camera that already casts to a screen of mine is switched, not restarted', async ({ page }) => {
    const m = await setup(page, { sessions: [session({ camera_id: 'cam-2', camera_name: 'חניה' })] });
    await openLive(page, 'cam-1');
    await open(page);
    await expect(rowOf(page, 'md-living')).toContainText('משדר');
    await rowOf(page, 'md-living').locator('.row').click();
    await expect.poll(() => m.calls.some((c) => c.path === 'sessions/cs-1/switch')).toBe(true);
    expect(startCalls(m)).toHaveLength(0);
    expect(m.calls.find((c) => c.path === 'sessions/cs-1/switch')?.body).toMatchObject({ camera_id: 'cam-1' });
  });
});

test.describe('the global pill and the tray', () => {
  const mineOn = (over = {}) => session({ camera_id: 'cam-1', ...over });

  test('the pill appears in the action row of every screen with the screen and the time; nothing without an open cast', async ({ page }) => {
    const m = await setup(page, { sessions: [mineOn()] });
    await page.goto('/?design=a#/live/overview');
    await page.waitForSelector('sw-app sw-cast-pill [data-cast-pill]', { timeout: 20_000 });
    await expect(pill(page).locator('[data-cast-pill-label]')).toHaveText(/משדר · טלוויזיה סלון · (27|28):\d\d/);
    await shot(page, 'pill-corner');
    // the clock ticks without a request
    const before = await pill(page).locator('[data-cast-pill-label]').innerText();
    await page.waitForTimeout(2200);
    expect(await pill(page).locator('[data-cast-pill-label]').innerText()).not.toBe(before);
    // another screen: the pill follows
    await page.goto('/?design=a#/system/multimedia');
    await expect(pill(page).locator('[data-cast-pill]')).toBeVisible();
    m.sessions = [];
    m.emit();
    await expect(pill(page).locator('[data-cast-pill]')).toHaveCount(0);
  });

  test('the live-window event cast_sessions_changed makes the client refetch: a cast started elsewhere shows up without any click', async ({ page }) => {
    const m = await setup(page);
    await openLive(page);
    await expect(pill(page).locator('[data-cast-pill]')).toHaveCount(0);
    const before = m.calls.filter((c) => c.path === 'sessions' && c.method === 'GET').length;
    m.sessions.push(mineOn({ session_id: 'cs-x' }));
    await expect.poll(() => !!m.ws).toBe(true);
    m.emit();
    await expect(pill(page).locator('[data-cast-pill]')).toBeVisible();
    expect(m.calls.filter((c) => c.path === 'sessions' && c.method === 'GET').length).toBeGreaterThan(before);
    await expect(live(page).locator('[data-cast-status]')).toContainText('טלוויזיה סלון'); // this camera's own cast is on the live screen too
  });

  test('the tray: extend counts down to the limit and then says why; the other person\'s cast is listed with the name and has no controls I lack', async ({ page }) => {
    const m = await setup(page, {
      sessions: [mineOn({ extensions_left: 1, extended_n: 7 }), session({ session_id: 'cs-2', device_key: 'md-hub', screen_name: 'מסך חכם (Nest Hub)', mine: false, started_by_name: 'יוסי', camera_name: 'חניה', camera_id: 'cam-2', can: { stop: false, extend: false, switch: false } })],
    });
    await page.goto('/?design=a#/live/overview');
    await pill(page).locator('[data-cast-pill]').click();
    const tray = pill(page).locator('[data-cast-tray]');
    await expect(tray).toBeVisible();
    await expect(tray.locator('[data-cast-session]')).toHaveCount(2);
    const mine = tray.locator('[data-cast-session="cs-1"]');
    const other = tray.locator('[data-cast-session="cs-2"]');
    await expect(other).toContainText('יוסי');
    await expect(other.locator('[data-cast-extend], [data-cast-stop], [data-cast-switch]')).toHaveCount(0);
    await shot(page, 'tray-open');
    await expect(mine.locator('[data-cast-extend]')).toContainText('(1)');
    await mine.locator('[data-cast-extend]').click();
    await expect(mine.locator('[data-cast-extend]')).toBeDisabled();
    await expect(mine.locator('[data-cast-extend]')).toHaveAttribute('title', /אי אפשר להאריך יותר/);
    expect(m.calls.filter((c) => c.path === 'sessions/cs-1/extend')).toHaveLength(1);
    await shot(page, 'tray-extend-limit');
    await page.keyboard.press('Escape');
    await expect(tray).toHaveCount(0);
  });

  test('stop: a screen that was off asks about power-off (ticked by default); unticking sends power_off=false; a plain screen stops at once', async ({ page }) => {
    const m = await setup(page, { sessions: [mineOn({ power_off_after: true }), session({ session_id: 'cs-2', device_key: 'md-hub', screen_name: 'מסך חכם', camera_id: 'cam-2', camera_name: 'חניה' })] });
    await page.goto('/?design=a#/live/overview');
    await pill(page).locator('[data-cast-pill]').click();
    const first = pill(page).locator('[data-cast-session="cs-1"]');
    await first.locator('[data-cast-stop]').click();
    await expect(first.locator('[data-cast-stop-confirm]')).toBeVisible();
    await expect(first.locator('[data-cast-stop-off]')).toBeChecked();
    await shot(page, 'tray-stop-poweroff');
    await first.locator('[data-cast-stop-off]').uncheck();
    await first.locator('[data-cast-stop-yes]').click();
    await expect.poll(() => m.calls.find((c) => c.method === 'DELETE' && c.path.startsWith('sessions/cs-1'))?.path).toBe('sessions/cs-1?power_off=false');
    await expect(pill(page).locator('[data-cast-session="cs-1"]')).toHaveCount(0);
    // the second one has no power-off rule: one click stops it
    await pill(page).locator('[data-cast-session="cs-2"] [data-cast-stop]').click();
    await expect.poll(() => m.calls.find((c) => c.method === 'DELETE' && c.path.startsWith('sessions/cs-2'))?.path).toBe('sessions/cs-2');
    await expect(pill(page).locator('[data-cast-pill]')).toHaveCount(0);
  });

  test('stop with the power-off left ticked sends no query; "המשך לשדר" cancels the question', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project is enough');
    const m = await setup(page, { sessions: [mineOn({ power_off_after: true })] });
    await page.goto('/?design=a#/live/overview');
    await pill(page).locator('[data-cast-pill]').click();
    const card = pill(page).locator('[data-cast-session="cs-1"]');
    await card.locator('[data-cast-stop]').click();
    await card.locator('[data-cast-stop-keep]').click();
    await expect(card.locator('[data-cast-stop-confirm]')).toHaveCount(0);
    expect(m.calls.filter((c) => c.method === 'DELETE')).toHaveLength(0);
    await card.locator('[data-cast-stop]').click();
    await card.locator('[data-cast-stop-yes]').click();
    await expect.poll(() => m.calls.find((c) => c.method === 'DELETE')?.path).toBe('sessions/cs-1');
  });

  test('the live screen\'s own status line stops the cast too; a TV that never reached the stream says so', async ({ page }) => {
    const m = await setup(page, { sessions: [mineOn({ state: 'not_confirmed', first_segment_at: null })] });
    await openLive(page);
    const status = live(page).locator('[data-cast-status]');
    await expect(status).toContainText('המסך לא הגיע לזרם');
    await shot(page, 'live-not-confirmed');
    await status.locator('[data-cast-stop]').click();
    await expect.poll(() => m.calls.some((c) => c.method === 'DELETE')).toBe(true);
    await expect(status).toHaveCount(0);
  });

  test('switch camera from the tray: the cameras are listed and one switch is sent', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project is enough');
    const m = await setup(page, { sessions: [mineOn()] });
    await page.goto('/?design=a#/live/overview');
    await pill(page).locator('[data-cast-pill]').click();
    await pill(page).locator('[data-cast-switch]').click();
    await expect(pill(page).locator('[data-cast-cam]')).toHaveCount(2);
    await pill(page).locator('[data-cast-cam="cam-3"]').click();
    await expect.poll(() => m.calls.find((c) => c.path === 'sessions/cs-1/switch')?.body).toMatchObject({ camera_id: 'cam-3' });
  });
});

test.describe('remote (/arx)', () => {
  test('start, extend and stop work remotely with the note that the playback is on the home network; the administration says it is local only', async ({ page }) => {
    const m = await setup(page, { channel: 'remote', perms: PERMS.admin });
    await openLive(page);
    await open(page);
    await expect(picker(page).locator('[data-cast-remote-note]')).toContainText('ברשת הביתית');
    await shot(page, 'remote-picker');
    await rowOf(page, 'md-living').locator('.row').click();
    await expect(live(page).locator('[data-cast-status]')).toBeVisible();
    expect(startCalls(m)).toHaveLength(1);
    await pill(page).locator('[data-cast-pill]').click();
    await pill(page).locator('[data-cast-extend]').click();
    await expect.poll(() => m.calls.some((c) => c.path.endsWith('/extend'))).toBe(true);
    await page.goto('/?design=a#/system/multimedia?tab=cast');
    await expect(page.locator('sw-app system-cast [data-cast-admin-state="local"]')).toBeVisible();
    expect(m.calls.filter((c) => c.path === 'config' || c.path === 'screens')).toHaveLength(0); // never even asked
    await shot(page, 'remote-admin-local-only');
  });
});

test.describe('settings: שידור למסכים', () => {
  const cast = (page: Page) => page.locator('sw-app system-cast');
  async function openCast(page: Page, opts: CastMockOptions = {}) {
    const m = await setup(page, { perms: PERMS.admin, ...opts });
    await page.goto('/?design=a#/system/multimedia?tab=cast');
    await page.waitForSelector('sw-app system-cast [data-cast-general]', { timeout: 20_000 });
    await page.evaluate(() => document.fonts.ready);
    return m;
  }

  test('the general card: every change is saved at once with the right payload; the tab and its address agree', async ({ page }) => {
    const m = await openCast(page);
    await expect(page.locator('sw-app system-multimedia sw-tabs')).toBeVisible();
    await expect(cast(page).locator('[data-cast-ready]')).toContainText('מוכן לשידור');
    await shot(page, 'settings-general');
    const put = (key: string) => m.calls.filter((c) => c.method === 'PUT' && c.path === 'config').map((c) => c.body as Record<string, unknown>).find((b) => key in b);
    await cast(page).locator('[data-cast-enabled]').click();
    await expect.poll(() => put('enabled')).toEqual({ enabled: false });
    await cast(page).locator('[data-cast-max]').fill('4');
    await cast(page).locator('[data-cast-max]').blur();
    await expect.poll(() => put('max_sessions')).toEqual({ max_sessions: 4 });
    await cast(page).locator('[data-cast-minutes]').selectOption('60');
    await expect.poll(() => put('minutes')).toEqual({ minutes: 60 });
    await cast(page).locator('[data-cast-blocked-display]').selectOption('hide');
    await expect.poll(() => put('blocked_display')).toEqual({ blocked_display: 'hide' });
    await cast(page).locator('[data-cast-allow-main]').click();
    await expect.poll(() => put('allow_main')).toEqual({ allow_main: true });
    await cast(page).locator('[data-cast-power-off]').click();
    await expect.poll(() => put('power_off_after')).toEqual({ power_off_after: false });
    await expect(cast(page).locator('[data-cast-saved]')).toBeVisible();
    expect(page.url()).toContain('tab=cast');
  });

  test('the origin: a bad address shows the server\'s sentence; "בדוק" verifies and says so', async ({ page }) => {
    const m = await openCast(page);
    await cast(page).locator('[data-cast-origin]').fill('http://tv.local:18092');
    await cast(page).locator('[data-cast-origin-save]').click();
    await expect(cast(page).locator('[data-cast-err]')).toContainText('כתובת המקור חייבת');
    await cast(page).locator('[data-cast-origin]').fill('http://192.0.2.20:18092');
    await cast(page).locator('[data-cast-origin-save]').click();
    await expect.poll(() => m.calls.filter((c) => c.method === 'PUT' && c.path === 'config').length).toBeGreaterThan(1);
    await cast(page).locator('[data-cast-origin-check]').click();
    await expect(cast(page).locator('[data-cast-origin-result]')).toContainText('ה־relay עונה');
    expect(m.calls.some((c) => c.method === 'POST' && c.path === 'origin/check')).toBe(true);
    await shot(page, 'settings-origin-check');
  });

  test('not ready: the status names the fix (the relay option) in settings words', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project is enough');
    await openCast(page, { ready: false, reason: 'relay_off' });
    await expect(cast(page).locator('[data-cast-ready]')).toContainText('cast_relay');
  });

  test('per screen: allow, method, minutes, permanent, main stream - each saved at once; casting is off until the administrator turns it on', async ({ page }) => {
    const m = await openCast(page);
    const put = (key: string) => m.calls.filter((c) => c.method === 'PUT' && c.path === `screens/${key}`).map((c) => c.body as Record<string, unknown>);
    await expect(cast(page).locator('[data-cast-screens] [data-cast-screen]')).toHaveCount(5);
    await expect(cast(page).locator('[data-cast-allow="md-old"]')).not.toHaveAttribute('checked', '');
    await cast(page).locator('[data-cast-allow="md-old"]').click();
    await expect.poll(() => put('md-old')).toContainEqual({ allow: true });
    await cast(page).locator('[data-cast-screen-minutes="md-living"]').selectOption('45');
    await expect.poll(() => put('md-living')).toContainEqual({ minutes: 45 });
    await cast(page).locator('[data-cast-permanent="md-living"]').click();
    await expect.poll(() => put('md-living')).toContainEqual({ permanent: true });
    await cast(page).locator('[data-cast-screen-main="md-living"]').selectOption('yes');
    await expect.poll(() => put('md-living')).toContainEqual({ allow_main: true });
    await cast(page).locator('[data-cast-method="md-living"]').selectOption('none');
    await expect.poll(() => put('md-living')).toContainEqual({ method: 'none' });
    await shot(page, 'settings-screens');
  });

  test('the 60-second test cast: pick a camera, start; the state and the countdown show, and it can be stopped', async ({ page }) => {
    const m = await openCast(page);
    await cast(page).locator('[data-cast-test-open="md-living"]').click();
    await expect(cast(page).locator('[data-cast-test-panel="md-living"]')).toBeVisible();
    await cast(page).locator('[data-cast-test-camera]').selectOption('cam-2');
    await cast(page).locator('[data-cast-test-run]').click();
    await expect.poll(() => m.calls.find((c) => c.path === 'test')?.body).toEqual({ target_key: 'md-living', camera_id: 'cam-2' });
    await expect(cast(page).locator('[data-cast-test-state]')).toContainText('0:');
    await expect(cast(page).locator('[data-cast-test-state]')).toContainText('משדר', { timeout: 6000 });
    await shot(page, 'settings-test-cast');
    await cast(page).locator('[data-cast-test-panel="md-living"] [data-cast-stop]').click();
    await expect.poll(() => m.calls.some((c) => c.method === 'DELETE')).toBe(true);
  });

  test('a user without system.configure sees the forbidden state, not the forms', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project is enough');
    await setup(page, { perms: PERMS.operator });
    await page.goto('/?design=a#/system/multimedia?tab=cast');
    await page.waitForSelector('sw-app');
    // the settings page itself is an administrator's; the component answers for itself when it is mounted
    await page.waitForTimeout(800);
    await expect(page.locator('sw-app system-cast [data-cast-general]')).toHaveCount(0);
  });
});

test.describe('המסכים שלי לשידור', () => {
  test('a settings tab and, for operators, a page at #/multimedia/cast (the picker\'s link): usable screens with their state, the ones not available with the reason', async ({ page }) => {
    await setup(page, { perms: PERMS.operator });
    await openLive(page);
    await open(page);
    await picker(page).locator('[data-cast-mine]').click();
    await page.waitForSelector('sw-app cast-my-screens [data-cast-mine-list]', { timeout: 20_000 });
    expect(page.url()).toContain('#/multimedia/cast');
    const mine = page.locator('sw-app cast-my-screens');
    await expect(mine.locator('[data-cast-mine-ok] [data-cast-mine-item]')).toHaveCount(3);
    await expect(mine.locator('[data-cast-mine-blocked] [data-cast-mine-item]')).toHaveCount(2);
    await expect(mine.locator('[data-cast-mine-blocked]')).toContainText('מסך ציבורי');
    await expect(mine.locator('[data-cast-mine-item="md-hub"]')).toContainText('משך קבוע אפשרי');
    await shot(page, 'mine-page');
  });

  test('as a tab of the administrator\'s settings', async ({ page }) => {
    test.skip(test.info().project.name === 'tablet', 'desktop and phone cover it');
    await setup(page, { perms: PERMS.admin });
    await page.goto('/?design=a#/system/multimedia?tab=mine');
    await page.waitForSelector('sw-app system-multimedia cast-my-screens [data-cast-mine-list]', { timeout: 20_000 });
    await expect(sysMm(page).locator('cast-my-screens [data-cast-mine-ok] [data-cast-mine-item]').first()).toBeVisible();
    await shot(page, 'mine-tab');
  });

  test('a viewer without media.cast is told the page is not theirs', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project is enough');
    await setup(page, { perms: PERMS.viewer });
    await page.goto('/?design=a#/multimedia/cast');
    await page.waitForTimeout(1500);
    // the route is guarded by the navigation map: no cast screen content for a viewer
    await expect(page.locator('sw-app cast-my-screens [data-cast-mine-list]')).toHaveCount(0);
  });
});

test.describe('static demo (no backend)', () => {
  test('no cast button, no pill, no cast words on the live screen', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project is enough');
    await page.route('**/api/v1/**', (route) => route.abort());
    await page.goto('/?design=a#/live/cameras/cam-1');
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1200);
    await expect(page.locator('sw-app [data-cast-button], sw-app [data-cast-pill]')).toHaveCount(0);
  });
});

// keep the fixtures referenced (an unused import would fail the type check of the spec)
void [DEFAULT_TARGETS, iso, target];
