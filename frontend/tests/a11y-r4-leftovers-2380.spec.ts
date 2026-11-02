import { test, expect, type Page } from '@playwright/test';

// A11Y-R4-LEFTOVERS-2380: the browser half (docs/changes/A11Y-R4-LEFTOVERS-2380.md). Style guide mount (demo data, no backend), as in
// tests/a11y-polished-2342.spec.ts. The runner builds the app first; `--workers=1`.
//   - sw-tabs: role=tablist / tab, aria-selected, roving tabindex, arrows + Home / End, a tabpanel marked through `panel`.
// The switch off track is computed in tests/unit-switch-contrast-2380.spec.ts; the 44 px hit area of the plan editor bar is measured in
// the plan-editor touch spec listed in the change document.

async function styleguide(page: Page) {
  await page.goto('about:blank');
  await page.goto('/?design=a#/styleguide');
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(800);
}

test('sw-tabs is a tablist: roles, one tab stop, arrows and Home / End move the focus', async ({ page }) => {
  await styleguide(page);
  await page.evaluate(async () => {
    const box = document.createElement('div');
    box.innerHTML = '<sw-tabs id="r4-tabs" panel="r4-panel"></sw-tabs><div id="r4-panel">content</div>';
    document.body.appendChild(box);
    const el = document.getElementById('r4-tabs') as HTMLElement & { items: unknown[]; active: string };
    el.items = [{ id: 'a', label: 'אחת' }, { id: 'b', label: 'שתיים' }, { id: 'c', label: 'שלוש' }];
    el.active = 'b';
    await new Promise((r) => setTimeout(r, 300));
  });
  const root = page.locator('#r4-tabs');
  await expect(root.locator('[role="tablist"]')).toHaveCount(1);
  await expect(root.locator('[role="tab"]')).toHaveCount(3);
  await expect(root.locator('[role="tab"][aria-selected="true"]')).toHaveText(/שתיים/);
  await expect(root.locator('[role="tab"][tabindex="0"]')).toHaveCount(1);
  await expect(root.locator('button[aria-pressed]')).toHaveCount(0);
  await expect(page.locator('#r4-panel')).toHaveAttribute('role', 'tabpanel');
  await expect(page.locator('#r4-panel')).toHaveAttribute('aria-label', 'שתיים');
  await root.locator('[role="tab"][aria-selected="true"]').focus();
  const dir = await page.evaluate(() => getComputedStyle(document.getElementById('r4-tabs')!).direction);
  const next = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
  const prev = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
  const focused = () => page.evaluate(() => (document.getElementById('r4-tabs')!.shadowRoot!.activeElement as HTMLElement | null)?.textContent?.trim());
  await page.keyboard.press(next);
  expect(await focused()).toContain('שלוש');
  await page.keyboard.press('Home');
  expect(await focused()).toContain('אחת');
  await page.keyboard.press('End');
  expect(await focused()).toContain('שלוש');
  await page.keyboard.press(prev);
  expect(await focused()).toContain('שתיים');
  // manual activation: the arrow moved the focus only, the selection stays
  await expect(root.locator('[role="tab"][aria-selected="true"]')).toHaveText(/שתיים/);
});
