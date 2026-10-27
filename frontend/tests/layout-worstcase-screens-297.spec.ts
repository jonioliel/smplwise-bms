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
const SCREENS = [
  { id: 'building', hash: '#/devices/building', ready: 'sw-app devices-building' },
  { id: 'area', hash: '#/devices/areas/living', ready: 'sw-app devices-area' },
  { id: 'access', hash: '#/system/access', ready: 'sw-app system-access' },
] as const;
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
    test(`${skin} ${scheme} ${ds}: building, area and users screens stay inside the viewport`, async ({ page }, info) => {
      test.setTimeout(180_000);
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await installWorstcase(page, ds, { skin, scheme });
      const problems: string[] = [];
      for (const s of SCREENS) {
        const t0 = Date.now();
        await open(page, skin, scheme, s.hash, s.ready);
        const settle = Date.now() - t0;
        if (ds === 'huge') expect(settle, `${s.id}: the huge dataset settles`).toBeLessThan(15_000);
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
