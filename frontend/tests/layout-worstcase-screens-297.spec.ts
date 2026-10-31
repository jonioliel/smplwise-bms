import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { measure } from './breakui-worst';
import { installWorstcase } from './fixtures/worstcase/mocks';
import { DATASETS, type Dataset } from './fixtures/worstcase/devices';

// BREAKUI-297 (P6): the main screens of the app (building / home, area, users & permissions, and the side rail with the signed-in user) fed the
// reusable worst-case fixture set tests/fixtures/worstcase/ - datasets worst, empty, one, huge (504 areas, 500 lights, 500 users), offline -
// on the classic and domus skins, light and dark, at the project's viewport (run it with --project=desktop and --project=mobile).
// Geometry only, no pixel baseline: the page never scrolls sideways, nothing leaves its parent, no text is cut without an ellipsis, no page error,
// the huge dataset settles within 15 s. Invented data, mocked backend; Vite DEV server (the mocks import /src/ like the bubble specs):
//   SW_BASE_URL=http://127.0.0.1:<vite port>/ npx playwright test tests/layout-worstcase-screens-297.spec.ts --project=desktop --project=mobile
// WC_SHOTS=<dir> writes one screenshot per case; WC_REPORT=<file.txt> writes the findings instead of failing on the first case.
const SKINS = ['classic', 'domus'] as const;
const SCHEMES = ['light', 'dark'] as const;
// HARVEST-2290 cut this spec to the users screen: on the R5 design the building and area screens overflowed with worst-case data (the
// rail's active marker, the weather temperature, the area rows' name / reading, the cover row's kind, the tree's count column, the
// reconnect spinner). WORSTCASE-2310 fixed them in the product CSS and asserts all three screens again (WC_USERS_ONLY=1: the users
// screen alone, as before). Measured before / after: private/design-system-2026-10-27/round9/worstcase/index.html.
const ALL_SCREENS = [
  { id: 'building', hash: '#/devices/building', ready: 'sw-app devices-building' },
  { id: 'area', hash: '#/devices/areas/living', ready: 'sw-app devices-area' },
  { id: 'access', hash: '#/system/access', ready: 'sw-app system-access' },
] as const;
const SCREENS = process.env.WC_USERS_ONLY === '1' ? ALL_SCREENS.filter((s) => s.id === 'access') : ALL_SCREENS;
const SHOTS = process.env.WC_SHOTS;
const SETS: readonly Dataset[] = DATASETS.filter((d) => d !== 'demo');

async function open(page: Page, skin: string, scheme: string, hash: string, ready: string) {
  await page.goto('about:blank');
  await page.goto(`/?design=a&skin=${skin}&scheme=${scheme}${hash}`);
  await expect(page.locator(ready).first()).toBeAttached({ timeout: 30_000 });
  await page.waitForTimeout(800);
}

test.describe('worst-case data on the main screens', () => {
  test.beforeAll(() => { if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true }); });
  for (const skin of SKINS) for (const scheme of SCHEMES) for (const ds of SETS) {
    test(`${skin} ${scheme} ${ds}: the building, area and users screens stay inside the viewport`, async ({ page }, info) => {
      test.setTimeout(180_000);
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await installWorstcase(page, ds, { skin, scheme });
      const problems: string[] = [];
      // HARVEST-2290: the timed load must not include the app's first (cold) module load on the dev server - it used to be paid by the
      // building screen, which came first; warm the shell once on the home route before timing the users screen
      if (ds === 'huge') await open(page, skin, scheme, '#/', 'sw-app');
      for (const s of SCREENS) {
        const t0 = Date.now();
        await open(page, skin, scheme, s.hash, s.ready);
        const settle = Date.now() - t0;
        // HARVEST-2290: the 15 s settle budget is a wall-clock check - main without this branch measures 15.6-16.6 s for 500 users on a phone
        // project of a loaded workstation's Vite dev server - so it is enforced only in the timing lane (the test below, @timing-lane)
        if (ds === 'huge' && process.env.WC_TIMING === '1') expect(settle, `${s.id}: the huge dataset settles`).toBeLessThan(15_000);
        const ctx = `${s.id}/${ds}/${skin}-${scheme}/${info.project.name}`;
        const m = await measure(page, ctx, 'sw-app');
        const own = [...m.found.map((f) => `${f.cls} ${f.el} ${f.detail}`), ...(m.scroll > 1 ? [`page scrolls sideways by ${m.scroll}px`] : [])];
        if (own.length) problems.push(`${ctx}: ${Array.from(new Set(own)).slice(0, 8).join(' | ')}`);
        // the side rail / user menu keeps a readable label for the signed-in user (never "undefined" / "null")
        const rail = await page.evaluate(() => document.body.innerText);
        expect(rail, `${ctx}: no raw undefined / null / NaN on screen`).not.toMatch(/\bundefined\b|\bnull\b|\bNaN\b/);
        if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${s.id}-${ds}-${skin}-${scheme}-${info.project.name}.png`), fullPage: ds !== 'huge' });
      }
      if (process.env.WC_REPORT) fs.appendFileSync(process.env.WC_REPORT, problems.join('\n') + '\n');
      expect(errors, 'page errors').toEqual([]);
      if (!process.env.WC_REPORT) expect(problems, problems.join('\n')).toEqual([]);
    });
  }
});

// GATELANES-297 timing lane: the huge dataset's settle budget, one skin / scheme (the geometry above runs in the blocking gate).
test.describe('worst-case data: settle time', { tag: '@timing-lane' }, () => {
  // WORSTCASE-2310: still the users screen only. Measured on a workstation Vite dev server (desktop, after the warm-up): building 12.4 s,
  // area 11.6 s, users 13.0 s with the huge dataset - and 8.9 / 10.3 / 11.5 s with the one-area dataset. ~8-10 s of it is the dev server
  // handing out the unbundled module graph (page load; the CPU profile of the area load is ~75% idle); the 504 areas / 500 lights / 500
  // users add only 1.4-2 s to the first render. Not a product hot spot - the 15-20 s of the harvest were a loaded workstation; the budget
  // stays a timing-lane check of one screen.
  test('classic light huge: the users screen settles within 15 s', async ({ page }) => {
    test.setTimeout(180_000);
    await installWorstcase(page, 'huge', { skin: 'classic', scheme: 'light' });
    await open(page, 'classic', 'light', '#/', 'sw-app');
    for (const s of ALL_SCREENS.filter((x) => x.id === 'access')) {
      const t0 = Date.now();
      await open(page, 'classic', 'light', s.hash, s.ready);
      expect(Date.now() - t0, `${s.id}: the huge dataset settles`).toBeLessThan(15_000);
    }
  });
});
