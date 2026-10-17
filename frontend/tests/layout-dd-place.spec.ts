import { test, expect, type Page } from '@playwright/test';

// 2026-10-17: header dropdown placement at the shell (sw-app), over the mocked backend like the other layout specs. NOT RUN when written
// (the runner was busy with a release gate): run with `npx playwright test tests/layout-dd-place.spec.ts --project=desktop --workers=1`.
// What each placement must do on a wide screen: place 1 keeps the chips in their own row above the title; 2 puts them at the end edge
// (RTL: left), 3 after the title, 4 at the start edge (RTL: right) with the title shifted past them; a narrow screen is place 1 whatever
// the dial says; no placement lets a title and a chip overlap.

async function open(page: Page, hash: string, width: number, place: string) {
  await page.setViewportSize({ width, height: 800 });
  await page.addInitScript((p) => {
    try {
      localStorage.setItem('sw.dd.place', JSON.stringify({ u: 'anon', value: p }));
    } catch {
      /* storage unavailable */
    }
  }, place);
  await page.goto(`/#${hash}`);
  await page.waitForSelector('sw-app[data-shell-ready]');
  await page.waitForTimeout(1500);
}

const facts = (page: Page) =>
  page.locator('sw-app').evaluate((app) => {
    const root = app.shadowRoot!;
    const chip = root.querySelector<HTMLElement>('.tabpair:not(.single) > *, .subnav[data-tabstyle=dropdown] > sw-tabs');
    const row = chip?.parentElement ?? null;
    return {
      place: app.getAttribute('data-dd-place'),
      rowH: row ? Math.round(row.getBoundingClientRect().height) : -1,
      chip: chip ? chip.getBoundingClientRect().toJSON() : null,
      dir: getComputedStyle(app).direction,
      vw: window.innerWidth,
    };
  });

for (const hash of ['/security/live/wall', '/multimedia/screens']) {
  test.describe(hash, () => {
    test('place 1 keeps its own row; 2, 3, 4 collapse the row to zero height', async ({ page }) => {
      await open(page, hash, 1280, '1');
      expect((await facts(page)).rowH).toBeGreaterThan(0);
      for (const p of ['2', '3', '4']) {
        await open(page, hash, 1280, p);
        const f = await facts(page);
        // a screen whose title would collide falls back to place 1 on its own
        expect(['1', p]).toContain(f.place);
        if (f.place === p) expect(f.rowH).toBe(0);
      }
    });

    test('4: the chip sits at the start edge (RTL right), 2: at the end edge (RTL left, clear of the 84 px corner)', async ({ page }) => {
      await open(page, hash, 1280, '4');
      const f4 = await facts(page);
      if (f4.place === '4') expect(f4.dir === 'rtl' ? f4.vw - f4.chip!.right : f4.chip!.left).toBeLessThan(400);
      await open(page, hash, 1280, '2');
      const f2 = await facts(page);
      if (f2.place === '2') expect(f2.dir === 'rtl' ? f2.chip!.left : f2.vw - f2.chip!.right).toBeGreaterThanOrEqual(83);
    });

    test('a narrow screen is place 1 whatever the dial says', async ({ page }) => {
      for (const w of [1099, 768, 390]) {
        await open(page, hash, w, '4');
        const f = await facts(page);
        expect(f.rowH === -1 || f.rowH > 0).toBe(true);
      }
    });
  });
}
