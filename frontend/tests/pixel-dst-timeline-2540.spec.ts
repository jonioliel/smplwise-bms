import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { settle } from './helpers/settle';
import { P, R, localIso, mockRooms, open, openResidentBar } from './dst-timeline-2540-mocks';

// DST-TIMELINE-2540: the looks that are new - the night window of the two DST-change days on the phone: the rooms timeline (the skipped
// spring hour hatched and unlabelled, the repeated autumn hour "01 ×2") and the resident's time bar (the same, plus its one-line note).
// Light and dark, the element only, no now pill (the clock is on another day). Titles carry "pixel-stable" (the gate's pixel lane). Linux
// baselines are generated on the runner with --update-snapshots, looked at, then committed; on an OS without a baseline the check is skipped.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/pixel-dst-timeline-2540.spec.ts --project=mobile -u

const proj = () => test.info().project.name;
const noBaseline = (name: string) => {
  const info = test.info();
  return !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));
};
const NIGHT = [{ date: '2026-03-27', kind: 'spring', clock: '2026-03-20T00:30:00+02:00' }, { date: '2026-10-25', kind: 'autumn', clock: '2026-10-20T00:30:00+03:00' }] as const;
const entries = (date: string) => [
  { id: 'p1', start: localIso(date, 1), end: localIso(date, 1, 30) },
  { id: 'n4', start: localIso(date, 4), end: localIso(date, 5, 30) },
];

for (const scheme of ['light', 'dark'] as const) {
  for (const n of NIGHT) {
    test(`pixel-stable: rooms timeline, phone, ${n.kind} night (${scheme})`, async ({ page }) => {
      test.skip(proj() !== 'mobile', 'the phone window of six hours');
      const name = `dst-rooms-${n.kind}-${scheme}.png`;
      test.skip(noBaseline(name), 'no baseline for this OS');
      await mockRooms(page, { manage: true, entries });
      await open(page, `/calendars/rooms?date=${n.date}`, n.clock, scheme);
      await expect(page.locator(`${P} [data-cal-entry="n4"]`)).toBeVisible();
      await settle(page);
      await expect(page.locator(`${P} [data-cal-timeline]`)).toHaveScreenshot(name, { animations: 'disabled', maxDiffPixelRatio: 0.01 });
    });

    test(`pixel-stable: resident time bar, ${n.kind} night (${scheme})`, async ({ page }) => {
      test.skip(proj() !== 'mobile', 'the resident flow is the phone layout');
      const name = `dst-resident-${n.kind}-${scheme}.png`;
      test.skip(noBaseline(name), 'no baseline for this OS');
      await openResidentBar(page, n.date, n.kind, entries, scheme);
      await settle(page);
      await expect(page.locator(`${R} [data-res-timeline]`)).toHaveScreenshot(name, { animations: 'disabled', maxDiffPixelRatio: 0.01 });
    });
  }
}
