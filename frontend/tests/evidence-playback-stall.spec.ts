import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fakePlay, mock, openAndPlay, overlay, setAdv, stage } from './playback-stall-mock';

// 2.0.0 stall detection and automatic resume in the recordings screen (docs/changes/PLAYBACK-STALL-RESUME.md). Against a MOCKED backend
// (page.route on api/v1, page.routeWebSocket for the relay socket) with the player's media clock stubbed from the test: the picture
// "plays" while window.__adv is true and freezes when it is false. States: stalled ("מתחבר מחדש" at once), reconnecting (the automatic
// resume = a seek, a new generation at the frozen position), resumed (the overlay gone, counted), gave up ("הניגון נעצר" + retry, the
// session released). The stall threshold is set to 2 s and the attempts to 2 through the settings, so the run stays short.
//   npm run build; SW_BASE_URL=http://127.0.0.1:5291/ npx playwright test tests/evidence-playback-stall.spec.ts --project=desktop
//   SW_SHOTS=<dir> also saves screenshots.
const SHOTS = process.env.SW_SHOTS ?? '';
const shot = async (page: Page, name: string) => {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `playback-stall-${name}.png`) });
};

test.describe('playback stall: detect, reconnect, resume, give up', () => {
  test.beforeEach(async ({}, info) => {
    test.skip(info.project.name !== 'desktop', 'one project; the layout guard spec covers the widths');
  });

  test('a frozen picture: "מתחבר מחדש", then an automatic resume at the frozen position, then playing again', async ({ page }) => {
    const st = await mock(page);
    await openAndPlay(page);
    expect(st.creates).toBe(1);
    await setAdv(page, false); // the source stops: the media clock freezes, the player still says "playing"
    const frozen = await page.evaluate(() => (window as unknown as { __mt: number }).__mt);
    await expect(overlay(page)).toHaveAttribute('data-stall', 'stalled', { timeout: 4000 });
    await expect(overlay(page)).toContainText('מתחבר מחדש');
    await shot(page, 'stalled');
    await expect.poll(() => st.seeks.length, { timeout: 5000 }).toBe(1); // after the grace period: a seek = a new generation
    await expect(overlay(page)).toHaveAttribute('data-stall', 'reconnecting');
    await expect(overlay(page)).toContainText('מתחבר מחדש');
    // the same position: requested_at + the frozen media time (within a second; the request is to the second)
    const requested = Date.parse(st.seeks[0].start_at);
    const sessionStart = Date.parse(await page.evaluate(() => location.hash.split('t=')[1]));
    expect(Math.abs(requested - (sessionStart + frozen * 1000))).toBeLessThanOrEqual(1500);
    // the player reconnects to generation 2 (a new socket) and plays from 0 again
    await expect.poll(() => page.locator('investigate-playback sw-live-player').evaluate((p) => (p as unknown as { wsUrl: string }).wsUrl), { timeout: 5000 }).toContain('generation=2');
    await page.evaluate(() => ((window as unknown as { __mt: number }).__mt = 0));
    await fakePlay(page);
    await setAdv(page, true);
    await expect(overlay(page)).toHaveCount(0, { timeout: 4000 });
    await expect(stage(page)).toHaveAttribute('data-stall-phase', 'ok');
    await expect(stage(page)).toHaveAttribute('data-stall-resumes', '1');
    await expect(page.locator('investigate-playback [data-stall-diag]')).toContainText('הצליחו 1');
    await shot(page, 'resumed');
    // still playing a while later: no further request
    await page.waitForTimeout(3000);
    expect(st.seeks.length).toBe(1);
    expect(st.creates).toBe(1);
  });

  test('go2rtc recovers by itself inside the grace period: the state clears, no request', async ({ page }) => {
    const st = await mock(page);
    await openAndPlay(page);
    await setAdv(page, false);
    await expect(overlay(page)).toHaveAttribute('data-stall', 'stalled', { timeout: 4000 });
    await setAdv(page, true);
    await expect(overlay(page)).toHaveCount(0, { timeout: 3000 });
    await page.waitForTimeout(2500);
    expect(st.seeks.length).toBe(0);
  });

  test('every attempt fails: back-off, the cap, then "הניגון נעצר" with a retry; the session is released; retry starts again', async ({ page }) => {
    const st = await mock(page);
    st.seekFails = true;
    await openAndPlay(page);
    await setAdv(page, false);
    await expect(overlay(page)).toHaveAttribute('data-stall', 'gave_up', { timeout: 15000 });
    await expect(overlay(page)).toContainText('הניגון נעצר');
    await expect(overlay(page).locator('[data-stall-retry]')).toContainText('נסה שוב');
    await shot(page, 'gave-up');
    expect(st.seeks.length).toBe(2); // playback.auto_resume_attempts = 2: never a third
    await expect.poll(() => st.closes, { timeout: 3000 }).toContain('playback/sessions/s1'); // nothing left pulling from the recorder
    await page.waitForTimeout(4000);
    expect(st.seeks.length).toBe(2);
    expect(st.creates).toBe(1);
    // the operator retries: a new session at the position it stopped at, the state clears
    await overlay(page).locator('[data-stall-retry]').click();
    await expect.poll(() => st.creates, { timeout: 5000 }).toBe(2);
    await expect(overlay(page)).toHaveCount(0);
  });

  test('the connection drops (socket closed): reconnecting without waiting for the frozen picture; a denial never resumes', async ({ page }) => {
    const st = await mock(page);
    await openAndPlay(page);
    await st.sockets.at(-1)!.close({ code: 1000, reason: 'drop' }); // closed in the middle of the range
    await expect(overlay(page)).toHaveAttribute('data-stall', /stalled|reconnecting/, { timeout: 1500 });
    await expect.poll(() => st.seeks.length, { timeout: 5000 }).toBe(1);
    await expect.poll(() => page.locator('investigate-playback sw-live-player').evaluate((p) => (p as unknown as { wsUrl: string }).wsUrl), { timeout: 5000 }).toContain('generation=2');
    await page.evaluate(() => ((window as unknown as { __mt: number }).__mt = 0));
    await fakePlay(page);
    await expect(overlay(page)).toHaveCount(0, { timeout: 4000 });
    // now a denial (4403): the player shows its own error, the screen does not resume
    await expect.poll(() => st.sockets.length).toBeGreaterThanOrEqual(2);
    await st.sockets.at(-1)!.close({ code: 4403, reason: 'denied' });
    await page.waitForTimeout(5000);
    expect(st.seeks.length).toBe(1);
  });

  test('a synchronized group: one frozen tile resumes the whole group (one group seek, never a single member)', async ({ page }) => {
    const st = await mock(page);
    await openAndPlay(page, '&extra=c2');
    expect(st.groupCreates).toBe(1);
    await expect(page.locator('investigate-playback sw-live-player')).toHaveCount(2);
    await page.waitForTimeout(1500); // the barrier passes, the clock runs
    // only c2 freezes
    await page.evaluate(() => {
      const w = window as unknown as { __mt: number; __mtc: Record<string, number>; __adv: boolean };
      w.__mtc = { c2: w.__mt };
    });
    await expect(overlay(page)).toHaveAttribute('data-stall', 'stalled', { timeout: 4000 });
    await shot(page, 'group-stalled');
    await expect.poll(() => st.groupSeeks.length, { timeout: 5000 }).toBe(1);
    expect(st.seeks.length).toBe(0);
    // every tile reconnects to its next generation
    await expect.poll(() => page.locator('investigate-playback sw-live-player').evaluateAll((ps) => ps.map((p) => (p as unknown as { wsUrl: string }).wsUrl.includes('generation=2'))), { timeout: 5000 }).toEqual([true, true]);
    await page.evaluate(() => {
      const w = window as unknown as { __mt: number; __mtc?: Record<string, number> };
      w.__mt = 0;
      delete w.__mtc;
    });
    await fakePlay(page);
    await expect(overlay(page)).toHaveCount(0, { timeout: 5000 });
    expect(st.groupSeeks.length).toBe(1);
  });
});
