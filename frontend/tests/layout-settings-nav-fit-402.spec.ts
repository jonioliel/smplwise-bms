import { test, expect, type Page } from '@playwright/test';

// Owner decision 402 (2.16.0), demo mode (no backend), desktop project only:
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/layout-settings-nav-fit-402.spec.ts --project=desktop --workers=1
// The settings side column (screens/system-nav.ts) used to be 34 links tall and cut off at the bottom of every desktop screen it fitted on
// (an inner scroll). One group is open at a time now and the open group is drawn denser on a short screen, so the column fits the
// viewport WITHOUT a scroll of its own (the control-screen rule): scrollHeight <= clientHeight for every group, at 1440x900 and 1366x768.

const SIZES: [number, number][] = [[1440, 900], [1366, 768]];

async function probe(page: Page, group: string | null) {
  return page.evaluate((id) => {
    const nav = document.querySelector('sw-app')?.shadowRoot?.querySelector('system-nav') as HTMLElement | null;
    if (!nav?.shadowRoot) return null;
    if (id) (nav.shadowRoot.querySelector(`[data-settings-group-toggle="${id}"]`) as HTMLElement | null)?.click();
    return new Promise<{ scroll: number; client: number; open: string[]; last: number; win: number } | null>((res) => requestAnimationFrame(() => requestAnimationFrame(() => {
      const open = [...nav.shadowRoot!.querySelectorAll('.grp[data-open="true"]')].map((g) => (g as HTMLElement).dataset.settingsGroup ?? '');
      const links = [...nav.shadowRoot!.querySelectorAll('a')];
      const last = links.length ? links[links.length - 1].getBoundingClientRect().bottom : 0;
      res({ scroll: nav.scrollHeight, client: nav.clientHeight, open, last, win: innerHeight });
    })));
  }, group);
}

test.describe('settings side column fits the viewport (no inner scroll)', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'a desktop-width behaviour');
  });

  for (const [w, h] of SIZES) {
    test(`${w}x${h}: every group, opened one at a time, fits`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto('./?skin=classic&scheme=light#/system/diagnostics');
      await page.locator('sw-app system-nav [data-settings-group-toggle]').first().waitFor();
      const first = await probe(page, null);
      expect(first?.open.length, 'the group of the current page is open by default').toBe(1);
      expect(first!.scroll).toBeLessThanOrEqual(first!.client);
      const ids = await page.evaluate(() => [...(document.querySelector('sw-app')!.shadowRoot!.querySelector('system-nav')!.shadowRoot!.querySelectorAll('[data-settings-group-toggle]'))].map((x) => (x as HTMLElement).dataset.settingsGroupToggle ?? ''));
      expect(ids.length).toBeGreaterThanOrEqual(2);
      for (const id of ids) {
        const r1 = await probe(page, id); // open it (or close it when it was the open one)
        const r = r1 && r1.open.includes(id) ? r1 : await probe(page, id);
        expect(r?.open, `only ${id} is open`).toEqual([id]);
        expect(r!.scroll, `${id}: the column needs no scroll of its own at ${w}x${h}`).toBeLessThanOrEqual(r!.client);
        expect(r!.last, `${id}: the last link is inside the window`).toBeLessThanOrEqual(r!.win);
      }
    });
  }

  test('a group header is a button that opens and closes its entries', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('./?skin=classic&scheme=light#/system/diagnostics');
    const btn = page.locator('sw-app system-nav [data-settings-group-toggle]').first();
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    await btn.click();
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('sw-app system-nav [data-settings-link]')).toHaveCount(0);
    await btn.click();
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
  });
});
