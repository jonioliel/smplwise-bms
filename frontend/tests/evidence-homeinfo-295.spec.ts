import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installBv1Mock, bv1Config, BV1_NOW } from './bv1-mocks';

// HOMEINFO-295 (owner report after 2.20.x): the choice between the thin info row and the widget cards (home.info_style) is also in the
// home screen's own layout editor (not only in the settings), the edit view and the normal view agree with the choice, and a home screen
// with few widgets keeps natural card widths. Demo mode (no backend answers). Light / dark, desktop.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-homeinfo-295.spec.ts --project=desktop
// Screenshots: docs/design/evidence/HOMEINFO-295/.

const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/HOMEINFO-295');
type Info = { project: { name: string } };

async function shot(page: Page, name: string, info: Info) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(EVIDENCE, `${name}-${info.project.name}.png`) });
}

/** The bubble / BV1 home mock (an admin session, the home tree and its widgets) with a settings endpoint that REMEMBERS home.info_style. */
async function openMock(page: Page, hash: string, infoStyle: 'bar' | 'cards' = 'bar') {
  const st = await installBv1Mock(page);
  const saved: Record<string, unknown>[] = [];
  const config = bv1Config();
  let style = infoStyle;
  await page.route('**/api/v1/settings', async (route) => {
    const req = route.request();
    if (req.method() === 'PATCH') {
      const body = req.postDataJSON() as Record<string, unknown>;
      saved.push(body);
      if (typeof body['home.info_style'] === 'string') style = body['home.info_style'] as 'bar' | 'cards';
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ settings: { 'home.info_style': style }, can_edit: true }) });
    }
    const settings = { 'ui.design': 'a', 'ui.skin': 'bubble', 'ui.scheme': 'light', 'ui.look': st.look, 'devices.style': 'smplwise', 'devices.area_design': 'tiles', 'home.direction': 'a', 'home.side': 'end', 'home.title': '', 'home.floor_order': '[]', 'home.widgets': config, 'home.info_style': style };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ settings, can_edit: true }) });
  });
  await page.clock.setFixedTime(new Date(BV1_NOW));
  await page.goto('about:blank');
  await page.goto(`/?design=a#${hash}`);
  await page.waitForSelector('sw-app');
  return saved;
}

const AMBIENT = ['clock', 'weather', 'shabbat', 'alarm'];

test.describe('home layout editor: the info style is chosen where the owner edits', () => {
  test('a visible segmented control in edit mode; the edit view follows it; the normal view agrees', async ({ page }, info) => {
    const saved = await openMock(page, '/devices/building?edit=1');
    const b = page.locator('sw-app devices-building');
    const panel = b.locator('[data-layout-bar]');
    await panel.locator('[data-home-info-style]').waitFor();
    const bar = panel.locator('[data-home-info-option="bar"]');
    const cards = panel.locator('[data-home-info-option="cards"]');
    // it is in the edit bar at the top: no scrolling to find it - in the top third of the first screen (desktop ~136 px of 900; the
    // 1024 x 768 tablet ~219 px of 768, under the info row and the refresh line)
    expect((await bar.boundingBox())!.y).toBeLessThan(page.viewportSize()!.height / 3);
    await expect(bar).toHaveText('שורה דקה');
    await expect(cards).toHaveText('ווידג׳טים');
    await expect(bar).toHaveAttribute('aria-pressed', 'true');
    // thin-row style: the edit view shows the bar, not the four large cards
    await expect(b.locator('home-ambient-bar')).toBeVisible();
    for (const w of AMBIENT) await expect(b.locator(`home-widgets [data-home-widget="${w}"]`)).toHaveCount(0);
    await shot(page, 'edit-bar-light', info);
    // widgets style: the cards (with their size controls) are back, the bar is gone
    await cards.click();
    expect(saved.at(-1)).toEqual({ 'home.info_style': 'cards' });
    await expect(cards).toHaveAttribute('aria-pressed', 'true');
    await expect(b.locator('home-ambient-bar')).toHaveCount(0);
    for (const w of AMBIENT) await expect(b.locator(`home-widgets [data-home-widget="${w}"]`)).toBeVisible();
    await shot(page, 'edit-cards-light', info);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await shot(page, 'edit-cards-dark', info);
    await bar.click();
    await expect(b.locator('home-ambient-bar')).toBeVisible();
  });

  test('with only a few widgets the cards keep a natural width (no stretching across the row) and the page does not scroll', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'one viewport is enough');
    await openMock(page, '/devices/building', 'cards');
    const b = page.locator('sw-app devices-building');
    await b.locator('sw-kpi').first().waitFor();
    const hw = b.locator('home-widgets');
    // keep two cards only: hide the others inside the widget host (the cap is a layout rule, not a data rule)
    await hw.evaluate((el) => {
      const root = (el as HTMLElement & { renderRoot: ShadowRoot }).renderRoot;
      const cards = Array.from(root.querySelectorAll<HTMLElement>('.wg'));
      cards.slice(2).forEach((c) => (c.style.display = 'none'));
    });
    const widths = await hw.evaluate((el) => {
      const root = (el as HTMLElement & { renderRoot: ShadowRoot }).renderRoot;
      return Array.from(root.querySelectorAll<HTMLElement>('.wg')).filter((c) => c.style.display !== 'none').map((c) => Math.round(c.getBoundingClientRect().width));
    });
    expect(widths.length).toBe(2);
    for (const w of widths) expect(w).toBeLessThanOrEqual(440);
    const over = await page.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight);
    expect(over).toBeLessThanOrEqual(0);
    await shot(page, 'few-widgets-light', info);
  });
});
