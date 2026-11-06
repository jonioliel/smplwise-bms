import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { settlePage } from './pixel-settle';
import { pixelTitle, skinCheck } from './helpers/pixel-skins';
import { SKINS_UNDER_TEST } from './helpers/frozen-skins';
import { ADMIN, installFrigate, newControlMock, newFrigateMock } from './frigate-mocks';

// FRIGATE-F2B-2405: pixel baselines for the two F2b tabs of the Frigate management card that carry the most structure - the exports
// table (origin, state, Arx-only rename / delete) and the automatic profile (mode, consent, the status line, an open suggestion).
// The FRGD shots (docs/design/evidence/frgd) are evidence, not baselines; nothing guarded these tabs against a silent drift. The card
// alone is compared (an element shot), so the shell around it does not move the picture. Desktop 1440 and phone 390, light; the pixel
// skins (helpers/pixel-skins.ts: classic, domus) carry baselines, the other skins under test the structural smoke.
// The layout across every skin, light and dark, is guarded in evidence-frigate-f2b-skins-2405.spec.ts. Mocked backend, made-up names.

const PERMS = [...ADMIN, 'analytics.control', 'analytics.record_control', 'analytics.profile', 'analytics.events', 'analytics.exports', 'analytics.cases', 'video.export'];
const ALL_ON = { analytics: true, record: true, profile: true, review: true, events: true, ptz: false, exports: true, cases: true };
const AUTO = {
  mode: 'suggest' as const, consent: true, consent_at: '2026-10-06T20:00:00Z',
  items: [{ id: 'au1', alarm_state: 'armed_away', profile: 'away', mode: 'suggest', status: 'suggested', reason: null, change_id: null, at: '2026-10-07T06:00:00Z', processed_at: null }],
};

const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function openCard(page: Page, skin: string) {
  await page.clock.setFixedTime(new Date('2026-10-07T09:00:00Z'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installFrigate(page, newFrigateMock({ perms: PERMS, ctl: newControlMock({ classes: { ...ALL_ON }, auto: AUTO, firstWrites: { export_create: true, export_rename: true, export_delete: true } }) }));
  await page.goto('about:blank');
  await page.goto(`/?design=a&look=performance:full&skin=${skin}&scheme=light#/system/setup`);
  await page.waitForSelector('sw-app');
  await page.locator('nvr-recorders-card [data-recorder="nvr-2"] [data-recorder-connection]').click();
  const box = page.locator('nvr-recorders-card [data-frigate-control-settings]');
  await expect(box).toBeVisible();
  return box;
}

const TABS = [
  { id: 'exports', label: 'ייצואים', ready: '[data-frigate-exports] [data-fx-row="exp-arx-1"]' },
  { id: 'profiles', label: 'פרופילים', ready: '[data-frigate-auto] [data-auto-item="au1"]' },
] as const;

test.describe('pixel: the F2b tabs of the Frigate management card', () => {
  for (const skin of SKINS_UNDER_TEST) {
    for (const t of TABS) {
      test(pixelTitle(skin, `the ${t.id} tab of the Frigate management card`), async ({ page }, info) => {
        test.skip(info.project.name === 'tablet', 'desktop and phone only');
        const check = skinCheck(page, skin);
        const box = await openCard(page, skin);
        await box.locator('[data-fcs-tabs]').getByRole('tab', { name: t.label }).click();
        await expect(box.locator(t.ready)).toBeVisible();
        await box.scrollIntoViewIfNeeded();
        await page.mouse.move(0, 0);
        await settlePage(page);
        const name = `frigate-f2b-${skin}-${t.id}-${info.project.name === 'mobile' ? '390' : '1440'}.png`;
        await check(async () => {
          if (noBaseline(info, name)) test.info().annotations.push({ type: 'skipped-pixel', description: `${name}: no baseline on ${process.platform}` });
          else await expect(box).toHaveScreenshot(name, { maxDiffPixels: 60, animations: 'disabled', caret: 'hide' });
        }, box);
      });
    }
  }
});
