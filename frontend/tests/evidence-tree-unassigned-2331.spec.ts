import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installBv1Mock, bv1Config, BV1_NOW, BV1_PERMS } from './bv1-mocks';

// TREE-HIDE-UNASSIGNED-2331 (owner 01.11): the building tree's "ללא שיוך" row follows home.screen.tree_unassigned (always / only while
// editing / never), with "הסתר מהעץ" on the row's "⋯" (an undo notice) for a system.configure holder and the screen editor's hint.
// The BV1 home mock (API mode: an administrator session, a tree with one unassigned device) with a settings endpoint that REMEMBERS
// home.screen and records every PATCH - so the real save path (one partial key) is what is checked.
//   npm run build && npx vite preview --host 127.0.0.1 --port 4198
//   SW_BASE_URL=http://127.0.0.1:4198/ npx playwright test tests/evidence-tree-unassigned-2331.spec.ts --workers=1
// Screenshots: docs/evidence/TREE-HIDE-UNASSIGNED-2331/.

const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/evidence/TREE-HIDE-UNASSIGNED-2331');

interface Opened {
  patches: Record<string, unknown>[];
}

async function open(page: Page, opts: { mode?: 'always' | 'editing' | 'never'; edit?: boolean; canEdit?: boolean; refuse?: boolean } = {}): Promise<Opened> {
  const canEdit = opts.canEdit ?? true;
  const st = await installBv1Mock(page, { perms: canEdit ? BV1_PERMS : BV1_PERMS.filter((p) => p !== 'system.configure') });
  const config = bv1Config();
  let screen: Record<string, unknown> = { tree_unassigned: opts.mode ?? 'always' };
  const patches: Record<string, unknown>[] = [];
  const settings = () => ({ 'ui.design': 'a', 'ui.skin': 'bubble', 'ui.scheme': 'light', 'ui.look': st.look, 'devices.style': 'smplwise', 'devices.area_design': 'tiles', 'home.direction': 'a', 'home.side': 'end', 'home.title': '', 'home.floor_order': '[]', 'home.widgets': config, 'home.info_style': 'bar', 'home.screen': screen });
  await page.route('**/api/v1/settings', async (route) => {
    const req = route.request();
    if (req.method() === 'PATCH') {
      const body = req.postDataJSON() as Record<string, unknown>;
      patches.push(body);
      if (opts.refuse || !canEdit) return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ detail: 'forbidden' }) });
      if (body['home.screen']) screen = { ...screen, ...(body['home.screen'] as Record<string, unknown>) };
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ settings: settings(), can_edit: canEdit }) });
  });
  await page.addInitScript(() => {
    try {
      const nav = navigator as Navigator & { deviceMemory?: number };
      const sig = `${nav.hardwareConcurrency ?? '?'}/${nav.deviceMemory ?? '?'}/${Math.round(devicePixelRatio * 100) / 100}`;
      localStorage.setItem('sw.ui.performance', JSON.stringify({ tier: 'full', sig, at: Date.now() }));
      localStorage.setItem('sw.devices.layout', 'cards');
    } catch {
      /* storage unavailable */
    }
  });
  await page.clock.setFixedTime(new Date(BV1_NOW));
  await page.goto('about:blank');
  await page.goto(`/?design=a#/devices/building${opts.edit ? '?edit=1' : ''}`);
  await page.waitForSelector('sw-app devices-building');
  if (opts.edit) await B(page).locator('[data-layout-bar]').waitFor({ timeout: 30000 });
  else await B(page).locator('[data-devices-tree], [data-phone-tree]').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(400);
  return { patches };
}

async function shot(page: Page, name: string, project: string) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await page.evaluate(() => document.querySelectorAll('[data-perf-probe]').forEach((n) => n.remove()));
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(EVIDENCE, `${name}-${project}.png`) });
}

const B = (page: Page) => page.locator('sw-app devices-building');
const phone = (page: Page) => (page.viewportSize()?.width ?? 1000) <= 600;
const overflowX = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** The tree: beside the floors on a desktop / tablet, in the bottom sheet on a phone. */
async function tree(page: Page) {
  if (phone(page)) {
    await B(page).locator('[data-phone-tree]').click();
    const sheet = B(page).locator('[data-tree-sheet] [data-devices-tree]');
    await sheet.waitFor();
    return sheet;
  }
  return B(page).locator('.split > nav[data-devices-tree]');
}

test('always (default): the row and its "⋯"; "הסתר מהעץ" saves one key, hides the row, and the notice undoes it', async ({ page }, info) => {
  const o = await open(page);
  const t = await tree(page);
  await expect(t.locator('[data-tree-unassigned]')).toBeVisible();
  await expect(t.locator('[data-tree-unassigned]')).toContainText('ללא שיוך');
  const all = await t.locator('[data-tree="all"]').innerText();
  await shot(page, '01-always', info.project.name);
  await t.locator('[data-tree-unassigned-menu]').click();
  await expect(t.locator('[data-tree-unassigned-hide]')).toHaveText('הסתר מהעץ');
  await shot(page, '02-menu', info.project.name);
  await t.locator('[data-tree-unassigned-hide]').click();
  await expect(t.locator('[data-tree-unassigned]')).toHaveCount(0);
  const toast = B(page).locator('[data-tree-unassigned-toast="hidden"]');
  await expect(toast).toBeVisible();
  await expect(toast.locator('[data-tree-unassigned-undo]')).toBeFocused();
  expect(o.patches).toEqual([{ 'home.screen': { tree_unassigned: 'editing' } }]);
  expect(await t.locator('[data-tree="all"]').innerText()).toBe(all); // hiding changes no number
  await shot(page, '03-hidden-undo', info.project.name);
  expect(await overflowX(page)).toBeLessThanOrEqual(0);
  await toast.locator('[data-tree-unassigned-undo]').click();
  await expect(t.locator('[data-tree-unassigned]')).toBeVisible();
  await expect(B(page).locator('[data-tree-unassigned-toast]')).toHaveCount(0);
  expect(o.patches).toEqual([{ 'home.screen': { tree_unassigned: 'editing' } }, { 'home.screen': { tree_unassigned: 'always' } }]);
});

test('a refused save puts the row back and says so', async ({ page }) => {
  const o = await open(page, { refuse: true });
  const t = await tree(page);
  await t.locator('[data-tree-unassigned-menu]').click();
  await t.locator('[data-tree-unassigned-hide]').click();
  await expect(B(page).locator('[data-tree-unassigned-toast="failed"]')).toBeVisible();
  await expect(t.locator('[data-tree-unassigned]')).toBeVisible();
  expect(o.patches.length).toBe(1);
});

test('without system.configure: the row, no "⋯"', async ({ page }, info) => {
  await open(page, { canEdit: false });
  const t = await tree(page);
  await expect(t.locator('[data-tree-unassigned]')).toBeVisible();
  await expect(t.locator('[data-tree-unassigned-menu]')).toHaveCount(0);
  await shot(page, '08-viewer', info.project.name);
});

test('editing: hidden outside the editor; in the editor the row and the hint, "הצג תמיד" brings it back', async ({ page }, info) => {
  test.skip(phone(page), 'the screen editor is a desktop / tablet surface');
  test.setTimeout(150_000); // two page loads
  await open(page, { mode: 'editing' });
  let t = await tree(page);
  await expect(t).toBeVisible();
  await expect(t.locator('[data-tree-unassigned]')).toHaveCount(0);
  await shot(page, '04-editing-normal', info.project.name);
  await open(page, { mode: 'editing', edit: true });
  t = await tree(page);
  await expect(t.locator('[data-tree-unassigned]')).toBeVisible();
  await expect(t.locator('[data-tree-unassigned-menu]')).toHaveCount(0); // the editor carries the hint instead
  const hint = t.locator('[data-tree-unassigned-hint="editing"]');
  await expect(hint).toContainText('מוצג רק בעריכה');
  await hint.scrollIntoViewIfNeeded();
  await shot(page, '05-editing-editor', info.project.name);
  await hint.locator('[data-tree-unassigned-show]').click();
  await expect(t.locator('[data-tree-unassigned-hint]')).toHaveCount(0);
  await expect(t.locator('[data-tree-unassigned]')).toBeVisible();
});

test('never: no row; the editor says so and where to bring it back', async ({ page }, info) => {
  test.setTimeout(150_000); // two page loads
  await open(page, { mode: 'never' });
  const t = await tree(page);
  await expect(t.locator('[data-tree-unassigned]')).toHaveCount(0);
  await shot(page, '06-never', info.project.name);
  if (phone(page)) return;
  await open(page, { mode: 'never', edit: true });
  const e = await tree(page);
  await expect(e.locator('[data-tree-unassigned]')).toHaveCount(0);
  await expect(e.locator('[data-tree-unassigned-hint="never"]')).toContainText('מוסתר מהעץ');
  await expect(e.locator('[data-tree-unassigned-hint="never"]')).toContainText('מסך ראשי');
});

test('the choice in the screen editor\'s options form', async ({ page }, info) => {
  test.skip(phone(page), 'the screen editor is a desktop / tablet surface');
  await open(page, { edit: true });
  const opt = B(page).locator('home-screen-options [data-hs-option="tree_unassigned"]');
  await expect(opt).toHaveCount(1);
  await expect(opt.locator('button')).toHaveText(['תמיד', 'רק כשאני עורך', 'אף פעם']);
  await expect(opt.locator('[data-hs-value="always"]')).toHaveAttribute('aria-pressed', 'true');
  await opt.scrollIntoViewIfNeeded();
  await shot(page, '07-settings-choice', info.project.name);
  await opt.locator('[data-hs-value="never"]').click();
  await expect(B(page).locator('[data-tree-unassigned-hint="never"]')).toBeVisible();
});
