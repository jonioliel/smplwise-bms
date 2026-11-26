import { test, expect } from '@playwright/test';
import { mountPlayer, openPage, playerError, setValue, sockets } from './player-error-text-2530-harness';

// PLAYER-ERROR-TEXT-2530 (docs/changes/PLAYER-ERROR-TEXT-2530.md), demo mode with a fake WebSocket (tests/player-error-text-2530-harness.ts):
// since 2.52 the relay sends fixed error codes instead of go2rtc's text, and the player showed "שגיאת זרם: upstream_error". Here a
// mocked relay answers with each code and the player must say a sentence (live camera / recording), with the retry hint that matches
// whether it reconnects by itself - never the code. A denial (`presence_required`) is not retried. What it does not prove: a real
// go2rtc error (the lab check of VIDEO-SECFIX-2520 question 3).

test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
test.beforeEach(({}, info) => {
  test.skip(info.project.name !== 'desktop', 'player behaviour: desktop only (the phone picture is in pixel-player-error-text-2530)');
});

const text = (page: import('@playwright/test').Page, id: string) => page.locator(`#${id} .center`).innerText();

test('live: upstream_error is a sentence about the camera, with the "try again" hint when the player does not retry', async ({ page }) => {
  await openPage(page);
  await mountPlayer(page, 'probe', { cameraId: 'probe-cam', mode: 'mse', retry: false });
  await playerError(page, 'probe');
  await expect(page.locator('#probe [data-player-error]')).toHaveText('שרת הווידאו לא הצליח לקבל את השידור מהמצלמה');
  await expect(page.locator('#probe [data-stream-error-hint]')).toHaveText('נסו שוב בעוד רגע; אם זה נמשך, בדקו שהמצלמה מחוברת ופועלת');
  const shown = await text(page, 'probe');
  expect(shown).not.toContain('upstream_error');
  expect(shown).not.toContain('שגיאת זרם');
  await page.locator('#probe').screenshot({ path: test.info().outputPath('live-upstream-error.png') });
});

test('live with automatic retry: the hint says so, and the player does reconnect', async ({ page }) => {
  await openPage(page);
  await mountPlayer(page, 'probe', { cameraId: 'probe-cam', mode: 'mse', retry: true });
  await playerError(page, 'probe');
  await expect(page.locator('#probe [data-player-error]')).toHaveText('שרת הווידאו לא הצליח לקבל את השידור מהמצלמה');
  await expect(page.locator('#probe [data-stream-error-hint]')).toHaveText('ננסה שוב אוטומטית; אם זה נמשך, בדקו שהמצלמה מחוברת ופועלת');
  const n = await sockets(page);
  await expect.poll(() => sockets(page), { timeout: 15_000, message: 'the automatic retry opened a new socket' }).toBeGreaterThan(n);
});

test('recording: upstream_error names the recorder', async ({ page }) => {
  await openPage(page);
  await mountPlayer(page, 'rec', { wsUrl: 'ws://127.0.0.1:9/api/v1/playback/sessions/s1/ws', mode: 'mse', retry: false, recorded: true });
  await playerError(page, 'rec');
  await expect(page.locator('#rec [data-player-error]')).toHaveText('שרת הווידאו לא הצליח לקבל את ההקלטה מהמקליט');
  await expect(page.locator('#rec [data-stream-error-hint]')).toHaveText('נסו שוב בעוד רגע; אם זה נמשך, בדקו שהמקליט מחובר ופועל');
  expect(await text(page, 'rec')).not.toContain('upstream_error');
  await page.locator('#rec').screenshot({ path: test.info().outputPath('recording-upstream-error.png') });
});

test('an unknown code gets the generic sentence, never the code', async ({ page }) => {
  await openPage(page);
  await setValue(page, 'brand_new_code');
  await mountPlayer(page, 'probe', { cameraId: 'probe-cam', mode: 'mse', retry: false });
  await playerError(page, 'probe');
  await expect(page.locator('#probe [data-player-error]')).toHaveText('שגיאה בזרם הווידאו');
  await expect(page.locator('#probe [data-stream-error-hint]')).toHaveText('נסו שוב בעוד רגע; אם זה נמשך, פנו למנהל המערכת');
  expect(await text(page, 'probe')).not.toContain('brand_new_code');
});

test('a refused caller (presence_required) is a denial: its sentence, no hint, no retry', async ({ page }) => {
  await openPage(page);
  await setValue(page, 'presence_required');
  await mountPlayer(page, 'probe', { cameraId: 'probe-cam', mode: 'mse', retry: true });
  await playerError(page, 'probe');
  await expect(page.locator('#probe [data-player-error]')).toHaveText('כדי לצפות בווידאו מהאפליקציה יש להפעיל את שיתוף הנתונים הנדרש');
  await expect(page.locator('#probe [data-stream-error-hint]')).toHaveCount(0);
  const n = await sockets(page);
  await page.waitForTimeout(4_000); // longer than the first automatic retry (3 s)
  expect(await sockets(page), 'no reconnect after a denial').toBe(n);
  await expect(page.locator('#probe')).toHaveJSProperty('status', 'error');
});

test('a compact tile shows the sentence only', async ({ page }) => {
  await openPage(page);
  await mountPlayer(page, 'probe', { cameraId: 'probe-cam', mode: 'mse', retry: false, compact: true });
  await playerError(page, 'probe');
  await expect(page.locator('#probe [data-player-error]')).toHaveText('שרת הווידאו לא הצליח לקבל את השידור מהמצלמה');
  await expect(page.locator('#probe [data-stream-error-hint]')).toHaveCount(0);
});

test('in English: the sentence and the hint are English', async ({ page }) => {
  await openPage(page, { lang: 'en' });
  await mountPlayer(page, 'probe', { cameraId: 'probe-cam', mode: 'mse', retry: false });
  await playerError(page, 'probe');
  await expect(page.locator('#probe [data-player-error]')).toHaveText('The video server could not get the stream from the camera');
  await expect(page.locator('#probe [data-stream-error-hint]')).toHaveText('Try again in a moment; if it continues, check that the camera is connected and working');
  await page.locator('#probe').screenshot({ path: test.info().outputPath('live-upstream-error-en.png') });
});
