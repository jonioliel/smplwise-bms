import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installMessagingMock, waUrl } from './messaging-mocks';

// CALMSG-POLISH-2331: before / after evidence of the calendars and messaging settings polish - Settings › יומנים (five tabs),
// Settings › חיבורי יומן, Settings › ערוץ ההודעות and the calendars page views, at desktop 1440x900 / 1920x1080, tablet 1180x820 /
// 1024x768 (desktop project) and phone 390x844 (mobile project). Demo data (calendars/demo.ts) and the messaging mock layer, invented data.
// Each capture records the page overflow (shell `main` scroll - client height) and the sideways overflow; the calendars screens must not
// scroll at any size (owner rule 2026-10-24), the messaging page must not scroll sideways.
//   SW_BASE_URL=http://127.0.0.1:4204/ CALMSG_PHASE=after npx playwright test tests/evidence-calmsg-polish-2331.spec.ts --workers=1
const PHASE = process.env.CALMSG_PHASE || 'after';
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), `../../docs/evidence/CALMSG-POLISH-2331/${PHASE}`);
const CLOCK = new Date('2026-10-29T10:40:00+02:00');
const SIZES: [string, number, number][] = [['1440', 1440, 900], ['1920', 1920, 1080], ['1180', 1180, 820], ['1024', 1024, 768]];
const sizes = () => (test.info().project.name === 'mobile' ? ([['390', 390, 844]] as [string, number, number][]) : SIZES);

const CAL: [string, string, string][] = [
  ['set-overlap', '/system/calendars?tab=overlap', 'system-calendars [data-calset-tab]'],
  ['set-behavior', '/system/calendars?tab=behavior', 'system-calendars [data-calset-rows] > *'],
  ['set-approval', '/system/calendars?tab=approval', 'system-calendars [data-calset-rows] > *'],
  ['set-perm', '/system/calendars?tab=perm', 'system-calendars [data-calset-rows] > *'],
  ['set-retention', '/system/calendars?tab=retention', 'system-calendars [data-calset-tab]'],
  ['set-ro', '/system/calendars?tab=behavior&role=operator', 'system-calendars [data-calset-tab]'],
  ['sync', '/system/calendar-sync', 'system-calendar-sync [data-sync-screen]'],
  ['sync-empty', '/system/calendar-sync?data=empty', 'system-calendar-sync [data-sync-screen]'],
  ['sync-worst', '/system/calendar-sync?data=worst', 'system-calendar-sync [data-sync-screen]'],
  ['cal-week', '/calendars/cal?view=week&date=2026-10-29', 'calendars-page'],
  ['cal-month', '/calendars/cal?view=month&date=2026-10-29', 'calendars-page'],
  ['cal-rooms', '/calendars/rooms?date=2026-10-29', 'calendars-page'],
  ['cal-approvals', '/calendars/approvals', 'calendars-page'],
  ['cal-manage', '/calendars/manage', 'calendars-page'],
  ['cal-maint', '/calendars/maint', 'calendars-page'],
];

async function measure(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(450);
  return page.evaluate(() => {
    const main = document.querySelector('sw-app')?.shadowRoot?.querySelector('main');
    return { v: Math.max(0, (main?.scrollHeight ?? 0) - (main?.clientHeight ?? 0)), h: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth) };
  });
}

const log: string[] = [];
test.afterAll(() => {
  if (!log.length) return;
  fs.mkdirSync(OUT, { recursive: true });
  fs.appendFileSync(path.join(OUT, 'overflow.tsv'), `${log.join('\n')}\n`);
});

test.describe('CALMSG-POLISH-2331 evidence', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  for (const [name, hash, ready] of CAL) {
    test(`calendars: ${name}`, async ({ page }) => {
      test.setTimeout(300_000);
      await page.clock.setFixedTime(CLOCK);
      for (const [sz, w, h] of sizes()) {
        await page.setViewportSize({ width: w, height: h });
        await page.goto('about:blank');
        await page.goto(`/?design=a&skin=classic&scheme=light#${hash}`);
        await expect(page.locator(`sw-app ${ready}`).first()).toBeVisible();
        const m = await measure(page);
        log.push([PHASE, name, sz, m.v, m.h].join('\t'));
        // the calendars page views are measured at every size but kept as a picture at 1440 only (not changed by this wave)
        const view = name.startsWith('cal-');
        if (!view || sz === '1440') await page.screenshot({ path: path.join(OUT, `${name}-${sz}.png`), animations: 'disabled' });
        if (!view && (sz === '1440' || sz === '390')) {
          await page.goto('about:blank');
          await page.goto(`/?design=a&skin=classic&scheme=dark#${hash}`);
          await expect(page.locator(`sw-app ${ready}`).first()).toBeVisible();
          await measure(page);
          await page.screenshot({ path: path.join(OUT, `${name}-${sz}-dark.png`), animations: 'disabled' });
        }
        if (PHASE === 'after' && (name.startsWith('set-') || name.startsWith('sync'))) expect(m.v, `${name} ${sz}: page scroll`).toBeLessThanOrEqual(1);
        expect(m.h, `${name} ${sz}: sideways overflow`).toBeLessThanOrEqual(1);
      }
    });
  }

  test('messaging accounts', async ({ page }) => {
    test.setTimeout(300_000);
    for (const [sz, w, h] of sizes()) {
      for (const scheme of ['light', 'dark'] as const) {
        if (scheme === 'dark' && sz !== '1440' && sz !== '390') continue;
        await page.setViewportSize({ width: w, height: h });
        await page.unrouteAll({ behavior: 'ignoreErrors' });
        await installMessagingMock(page, {});
        await page.goto('about:blank');
        await page.goto(waUrl('/system/messaging-accounts', 'classic', scheme));
        await page.waitForSelector('sw-app system-messaging-accounts [data-messaging-accounts][data-state="ready"]');
        const m = await measure(page);
        if (scheme === 'light') log.push([PHASE, 'messaging', sz, m.v, m.h].join('\t'));
        await page.screenshot({ path: path.join(OUT, `messaging-${sz}${scheme === 'dark' ? '-dark' : ''}.png`), animations: 'disabled' });
        expect(m.h, `messaging ${sz}: sideways overflow`).toBeLessThanOrEqual(1);
      }
    }
  });
});
