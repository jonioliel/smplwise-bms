import { test } from '@playwright/test';
import { settle } from './helpers/settle';
import { mountPlayer, openPage, playerError, setValue } from './player-error-text-2530-harness';

// PLAYER-ERROR-TEXT-2530: before / after captures of the player's error state for the relay's fixed codes (live `upstream_error`,
// recording `upstream_error`, an unknown code, `presence_required`; English live), desktop 1440 (480 px tile) and phone 390 (360 px
// tile), light and dark. Not a gate: the same file runs against the build before this row and after it, for the compare page.
// Runs only with SW_SHOTS=1 and writes <SW_SHOTS_DIR>/<case>-<size>-<scheme>.png. Mocked relay (tests/player-error-text-2530-harness.ts).

const OUT = process.env.SW_SHOTS_DIR || 'test-results/player-error-text-2530';
const CASES: { name: string; value: string; props: Record<string, unknown>; lang?: 'en' }[] = [
  { name: 'live-upstream', value: 'upstream_error', props: { cameraId: 'probe-cam', mode: 'mse', retry: false } },
  { name: 'live-upstream-retry', value: 'upstream_error', props: { cameraId: 'probe-cam', mode: 'mse', retry: true } },
  { name: 'rec-upstream', value: 'upstream_error', props: { wsUrl: 'ws://127.0.0.1:9/api/v1/playback/sessions/s1/ws', mode: 'mse', retry: false, recorded: true } },
  { name: 'live-unknown', value: 'brand_new_code', props: { cameraId: 'probe-cam', mode: 'mse', retry: false } },
  { name: 'live-presence', value: 'presence_required', props: { cameraId: 'probe-cam', mode: 'mse', retry: false } },
  { name: 'live-upstream-en', value: 'upstream_error', props: { cameraId: 'probe-cam', mode: 'mse', retry: false }, lang: 'en' },
];

test.describe('player error captures', () => {
  test.skip(process.env.SW_SHOTS !== '1', 'captures only (SW_SHOTS=1)');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'one project: the phone tile is sized here');
  });
  for (const c of CASES)
    for (const phone of [false, true])
      for (const scheme of ['light', 'dark'] as const)
        test(`${c.name} ${phone ? 'p390' : 'd1440'} ${scheme}`, async ({ page }) => {
          if (phone) await page.setViewportSize({ width: 390, height: 844 });
          await page.addInitScript((v) => ((window as unknown as { __wsValue: string }).__wsValue = v), c.value);
          await openPage(page, { scheme, lang: c.lang });
          await setValue(page, c.value);
          await mountPlayer(page, 'probe', c.props, phone);
          await playerError(page, 'probe');
          await settle(page);
          await page.locator('#probe').screenshot({ path: `${OUT}/${c.name}-${phone ? 'p390' : 'd1440'}-${scheme}.png`, animations: 'disabled' });
        });
});
