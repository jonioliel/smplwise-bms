import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installGeneratorMock, PERMS, url } from './generator-mocks';

// 2.9.2 (owner 2026-10-20, INFRATABS): the infrastructure page rows (גנרטור: מצב חי / התראות פעילות / גרפים / היסטוריה, מוני חשמל: מונים / ...)
//   1. never jump: the row (or its chip) keeps its position from the first frame (it used to draw under the header and then move down a row
//      when the dd_place safety net fell back to the own row after 900 ms);
//   2. follow the tab mode: in the dropdown form the page row is the shell's second chip (shell/tab-pair.ts), not an in-page tab row;
//   3. that chip sits beside the area's chip, on its visual left (RTL: after it), in the same row, for every dd_place 1-4 (infra declines
//      2-4 up front: data-dd-fallback="declared"), and on the phone both chips share one row.
// Desktop 1440 and phone 390, light and dark, RTL. Screenshots in docs/design/evidence/infra-tabs/.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-infra-tabs.spec.ts --project=desktop --workers=1
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/infra-tabs');
const PERMS_INFRA = [...PERMS.manage, 'energy.view', 'energy.manage'];
type Mode = 'tabs' | 'dropdown';

async function stage(page: Page, hash: string, mode: Mode, place: string, scheme: 'light' | 'dark', width: number, height: number) {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: scheme });
  await page.setViewportSize({ width, height });
  await installGeneratorMock(page, { perms: PERMS_INFRA, level: 'full' });
  // registered after the mock, so it answers first: the tab mode and the placement under test
  await page.route('**/api/v1/settings', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ settings: { 'ui.design': 'a', 'ui.tabs_mode': mode, 'ui.dd_place': place }, can_edit: false }) }));
  await page.addInitScript(() => {
    try {
      localStorage.removeItem('sw.dd.place');
      localStorage.removeItem('sw.tabs.mode');
    } catch {
      /* storage unavailable */
    }
  });
  await page.goto('about:blank');
  await page.goto(url(hash, 'classic', scheme));
  await page.waitForSelector('sw-app[data-shell-ready]', { timeout: 20_000 });
}

/** Samples the boxes of the page row (or its chip) and of the page body for `ms`; returns every sample. */
async function samples(page: Page, rowSel: string, bodySel: string, ms = 2600) {
  const out: { row: number; body: number; place: string | null; fallback: string | null }[] = [];
  const end = Date.now() + ms;
  while (Date.now() < end) {
    out.push(
      await page.evaluate(([r, b]) => {
        const app = document.querySelector('sw-app')!;
        const find = (sel: string): Element | null => {
          // through the open shadow roots
          const walk = (root: ParentNode): Element | null => {
            const hit = root.querySelector(sel);
            if (hit) return hit;
            for (const el of root.querySelectorAll('*')) if (el.shadowRoot) { const x = walk(el.shadowRoot); if (x) return x; }
            return null;
          };
          return walk(app.shadowRoot!);
        };
        const top = (sel: string) => Math.round(find(sel)?.getBoundingClientRect().top ?? -1);
        return { row: top(r), body: top(b), place: app.getAttribute('data-dd-place'), fallback: app.getAttribute('data-dd-fallback') };
      }, [rowSel, bodySel] as const),
    );
    await page.waitForTimeout(150);
  }
  return out;
}

const box = (page: Page, sel: string) => page.locator(sel).first().boundingBox();
const shot = (page: Page, name: string) => page.screenshot({ path: path.join(OUT, `${name}.png`) });

test.describe('infrastructure page rows: tab mode, placement, no jump', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));

  for (const scheme of ['light', 'dark'] as const) {
    for (const place of ['1', '2', '3', '4']) {
      test(`desktop 1440 ${scheme}, dropdown, dd_place ${place}: the page chip beside the area chip, on its left, nothing jumps`, async ({ page }) => {
        await stage(page, '/infra/generator/charts', 'dropdown', place, scheme, 1440, 900);
        const pair = 'sw-app [data-pair-chip]';
        const main = 'sw-app .tabpair > sw-tabs[data-area-tabs]';
        await expect(page.locator(pair)).toBeVisible({ timeout: 15_000 });
        await expect(page.locator('sw-app infra-generator [data-infra-pages]')).toHaveCount(0);
        await expect(page.locator('sw-app infra-generator gen-charts-page')).toBeVisible();
        const s = await samples(page, '[data-pair-chip]', 'infra-generator .body');
        const tops = new Set(s.map((x) => x.row));
        const bodies = new Set(s.map((x) => x.body));
        expect([...tops], 'the page chip never moves').toHaveLength(1);
        expect([...bodies], 'the page body never moves').toHaveLength(1);
        expect(new Set(s.map((x) => x.place)), 'the effective placement is the own row from the first sample').toEqual(new Set(['1']));
        expect(new Set(s.map((x) => x.fallback)), 'never a measured (collision) fallback').toEqual(new Set([place === '1' ? null : 'declared']));
        const m = (await box(page, main))!;
        const p = (await box(page, pair))!;
        expect(m, 'the area chip').toBeTruthy();
        expect(p.x + p.width, 'RTL: the page chip is on the visual left of the area chip').toBeLessThanOrEqual(m.x + 0.5);
        expect(p.y < m.y + m.height && p.y + p.height > m.y, 'same row').toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
        await page.evaluate(() => document.fonts.ready);
        await shot(page, `generator-charts-dropdown-p${place}-desktop-${scheme}`);
      });
    }

    test(`desktop 1440 ${scheme}, dropdown: picking a page from the chip navigates and keeps the device`, async ({ page }) => {
      await stage(page, '/infra/generator/live', 'dropdown', '4', scheme, 1440, 900);
      await expect(page.locator('sw-app [data-pair-chip]')).toBeVisible({ timeout: 15_000 });
      await page.locator('sw-app [data-pair-chip]').click();
      await page.waitForTimeout(250);
      await shot(page, `generator-live-dropdown-open-desktop-${scheme}`);
      await page.getByRole('option', { name: /גרפים/ }).first().click();
      await expect.poll(() => page.evaluate(() => location.hash)).toMatch(/^#\/infra\/generator\/charts\?device=/);
    });

    test(`desktop 1440 ${scheme}, tabs mode: the in-page row stays and does not jump`, async ({ page }) => {
      await stage(page, '/infra/generator/charts', 'tabs', '4', scheme, 1440, 900);
      await expect(page.locator('sw-app infra-generator [data-infra-pages]')).toBeVisible({ timeout: 15_000 });
      await expect(page.locator('sw-app [data-pair-chip]')).toHaveCount(0);
      const s = await samples(page, 'infra-generator [data-infra-pages]', 'infra-generator .body');
      expect(new Set(s.map((x) => x.row)).size, 'the tab row never moves').toBe(1);
      await shot(page, `generator-charts-tabs-desktop-${scheme}`);
    });

    test(`desktop 1440 ${scheme}, dropdown, dd_place 3: the electricity pages follow too`, async ({ page }) => {
      await stage(page, '/infra/electricity/meters', 'dropdown', '3', scheme, 1440, 900);
      await expect(page.locator('sw-app [data-pair-chip]')).toBeVisible({ timeout: 15_000 });
      await expect(page.locator('sw-app infra-electricity [data-infra-pages]')).toHaveCount(0);
      const s = await samples(page, '[data-pair-chip]', 'infra-electricity .body', 1800);
      expect(new Set(s.map((x) => x.row)).size, 'the page chip never moves').toBe(1);
      expect(new Set(s.map((x) => x.fallback))).toEqual(new Set(['declared']));
      const m = (await box(page, 'sw-app .tabpair > sw-tabs[data-area-tabs]'))!;
      const p = (await box(page, 'sw-app [data-pair-chip]'))!;
      expect(p.x + p.width).toBeLessThanOrEqual(m.x + 0.5);
      await shot(page, `electricity-meters-dropdown-p3-desktop-${scheme}`);
    });

    test(`phone 390 ${scheme}, dropdown: both chips in one row, the page chip on the left, no overflow`, async ({ page }) => {
      await stage(page, '/infra/generator/charts', 'dropdown', '4', scheme, 390, 844);
      await expect(page.locator('sw-app [data-pair-chip]')).toBeVisible({ timeout: 15_000 });
      await expect(page.locator('sw-app infra-generator [data-infra-pages]')).toHaveCount(0);
      const m = (await box(page, 'sw-app .tabpair > sw-tabs[data-area-tabs]'))!;
      const p = (await box(page, 'sw-app [data-pair-chip]'))!;
      expect(p.x + p.width).toBeLessThanOrEqual(m.x + 0.5);
      expect(p.y < m.y + m.height && p.y + p.height > m.y, 'same row').toBe(true);
      expect(p.x).toBeGreaterThanOrEqual(-0.5);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await page.evaluate(() => document.fonts.ready);
      await shot(page, `generator-charts-dropdown-mobile-${scheme}`);
    });
  }
});
