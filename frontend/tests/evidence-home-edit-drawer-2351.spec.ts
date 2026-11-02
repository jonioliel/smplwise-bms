import { test, expect, type Page } from '@playwright/test';
import { installBv1Mock, BV1_NOW } from './bv1-mocks';

// HOME-EDIT-DRAWER-2351 / PRE-GATE-2360: the home edit drawer (`#/devices/building?edit=1`) at the six widths its change doc names -
// 1920 / 1440 / 1280 (a side drawer at the inline end) and 1180 / 1024 / 390 (a bottom sheet, owner rule OWNER-R12-2341 8B) - against the
// BV1 mocks (invented home, no backend). Per width: the drawer is drawn where the rule puts it; the save / cancel footer is inside the
// viewport; the body is the drawer's own scroll container and scrolling it leaves the footer where it was; no sideways page scroll;
// Shift+Tab on the first key wraps inside the drawer; Escape closes it and gives the focus to the edit bar's "הגדרות המסך" key.
// One project runs the sweep (it sets its own viewports). A screenshot per width is written to the test's output folder
// (test-results/...; nothing in the repository), for the change doc's evidence.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-home-edit-drawer-2351.spec.ts --project=desktop --workers=1

const WIDTHS: [number, number][] = [[1920, 1080], [1440, 900], [1280, 800], [1180, 820], [1024, 768], [390, 844]];

/** Is the deepest focused element inside the drawer (through the shadow roots)? Which data-* key does it carry? */
const focusState = (page: Page) =>
  page.evaluate(() => {
    const find = (root: Document | ShadowRoot, sel: string): Element | null => {
      const hit = root.querySelector(sel);
      if (hit) return hit;
      for (const el of root.querySelectorAll('*')) {
        const sr = (el as Element & { shadowRoot: ShadowRoot | null }).shadowRoot;
        const inner = sr ? find(sr, sel) : null;
        if (inner) return inner;
      }
      return null;
    };
    const drawer = find(document, '[data-home-drawer]');
    let a: Element | null = document.activeElement;
    while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
    let n: Node | null = a;
    let inside = false;
    const keys: string[] = [];
    while (n) {
      if (n === drawer) inside = true;
      if (n instanceof Element) keys.push(...[...n.attributes].map((x) => x.name).filter((x) => x.startsWith('data-home-drawer')));
      n = n.parentNode ?? (n as ShadowRoot).host ?? null;
    }
    return { inside, keys };
  });

test('the home edit drawer at 1920 / 1440 / 1280 / 1180 / 1024 / 390: placement, fixed footer, own scroll, Tab wrap, Escape', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one project runs the sweep (it sets its own viewports)');
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await installBv1Mock(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.setFixedTime(new Date(BV1_NOW));
  for (const [w, h] of WIDTHS) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('about:blank');
    await page.goto('/?design=a&skin=classic&scheme=light#/devices/building?edit=1');
    const drawer = page.locator('sw-app devices-building [data-home-drawer]');
    await expect(drawer, `${w}: the drawer opens with edit mode`).toBeVisible({ timeout: 20_000 });
    await page.evaluate(() => document.fonts.ready);
    const box = (await drawer.boundingBox())!;
    if (w >= 1200) {
      // a side drawer at the inline end (RTL: the left edge), 76 px under the top, 16 px over the bottom
      expect(box.x, `${w}: at the inline end`).toBeLessThanOrEqual(20);
      expect(box.width, `${w}: drawer width`).toBeGreaterThanOrEqual(330);
      expect(box.width, `${w}: drawer width`).toBeLessThanOrEqual(430);
      expect(box.y + box.height, `${w}: bottom edge`).toBeLessThanOrEqual(h - 12);
      expect(box.height, `${w}: drawer height`).toBeGreaterThan(h * 0.6);
    } else {
      // a bottom sheet: full width less 8 px, at most half the viewport, on the bottom edge
      expect(Math.abs(box.x - 8), `${w}: sheet inset`).toBeLessThanOrEqual(2);
      expect(Math.abs(box.x + box.width - (w - 8)), `${w}: sheet inset`).toBeLessThanOrEqual(2);
      expect(box.height, `${w}: sheet height`).toBeLessThanOrEqual(h * 0.5 + 1);
      expect(Math.abs(box.y + box.height - (h - 8)), `${w}: on the bottom edge`).toBeLessThanOrEqual(3);
    }
    // the footer (state, cancel, save) is inside the drawer and the viewport
    const save = drawer.locator('[data-home-drawer-save]');
    const cancel = drawer.locator('[data-home-drawer-cancel]');
    await expect(save).toBeVisible();
    await expect(cancel).toBeVisible();
    const f0 = (await save.boundingBox())!;
    expect(f0.y + f0.height, `${w}: save inside the viewport`).toBeLessThanOrEqual(h);
    expect(f0.y + f0.height, `${w}: save inside the drawer`).toBeLessThanOrEqual(box.y + box.height);
    // the body is the drawer's one scroll container; scrolling it moves nothing else
    const body = drawer.locator('[data-home-drawer-body]');
    const ov = await body.evaluate((el) => getComputedStyle(el).overflowY);
    expect(['auto', 'scroll'], `${w}: the drawer body scrolls (overflow-y)`).toContain(ov);
    await body.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    const f1 = (await save.boundingBox())!;
    expect(Math.abs(f1.y - f0.y), `${w}: the footer stays when the body scrolls`).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${w}: no sideways page scroll`).toBeLessThanOrEqual(1);
    await body.evaluate((el) => { el.scrollTop = 0; });
    await drawer.screenshot({ path: info.outputPath(`home-edit-drawer-${w}.png`) });
    await page.screenshot({ path: info.outputPath(`home-edit-page-${w}.png`) });
    // keyboard: Shift+Tab on the first key wraps inside; Escape closes and the focus goes back to the edit bar's key
    await drawer.locator('[data-home-drawer-close]').focus();
    await page.keyboard.press('Shift+Tab');
    expect((await focusState(page)).inside, `${w}: Shift+Tab stays inside the drawer`).toBe(true);
    await page.keyboard.press('Tab');
    expect((await focusState(page)).inside, `${w}: Tab stays inside the drawer`).toBe(true);
    await page.keyboard.press('Escape');
    await expect(drawer, `${w}: Escape closes the drawer`).toBeHidden();
    await expect.poll(async () => (await focusState(page)).keys, { message: `${w}: the focus goes to "הגדרות המסך"` }).toContain('data-home-drawer-toggle');
  }
  expect(errors).toEqual([]);
});
