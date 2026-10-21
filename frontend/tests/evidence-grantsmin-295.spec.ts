import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { url } from './access-control-mocks';
import { installExternalMock, XNOW, type ExternalOptions } from './access-external-mocks';
import { settlePage } from './pixel-settle';

// GRANTSMIN-295 against the mocked backend (tests/access-external-mocks.ts: GET /access-grants/drift and /access-grants/export.csv, invented
// sample data, no PIN anywhere). Nothing here reaches a WisKey, a station, a door or WhatsApp. What it pins:
//   the drift view: a side panel (the three most urgent people) and the full list (per person: what differs, why, when it was last read);
//   "push the name" only where the server allows it, "read back now" where a read decides something, "open the grant" opens the drawer;
//   the CSV export: one request, the toast with the row count, the once-a-minute refusal as a plain message;
// light and dark, desktop and phone, and no horizontal overflow on the phone.
// Evidence screenshots: docs/design/evidence/GRANTSMIN-295/. Needs the Vite dev server or a built preview (SW_BASE_URL).
const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE = path.resolve(HERE, '..', '..', 'docs', 'design', 'evidence', 'GRANTSMIN-295');
const SCREEN = 'sw-app access-external-screen';

async function boot(page: Page, o: ExternalOptions & { scheme?: 'light' | 'dark'; hash?: string } = {}) {
  const mock = await installExternalMock(page, o);
  await page.clock.setFixedTime(XNOW);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('about:blank');
  await page.goto(url(o.hash ?? '/wiskey/external', 'classic', o.scheme ?? 'light'));
  await expect(page.locator(`${SCREEN} .kpis`).first()).toBeVisible({ timeout: 30_000 });
  return { mock, errors };
}

async function shot(page: Page, info: TestInfo, name: string) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await settlePage(page);
  await page.screenshot({ path: path.join(EVIDENCE, `${name}-${info.project.name}.png`) });
}

test('the drift panel lists the most urgent differences and opens the full view', async ({ page }, info) => {
  const { errors } = await boot(page);
  const s = page.locator(SCREEN);
  const panel = s.locator('[data-drift-panel]');
  await expect(panel).toBeVisible();
  await expect(panel.locator('[data-drift-row]')).toHaveCount(3);
  await expect(panel.locator('[data-drift-row]').first()).toHaveAttribute('data-drift-kinds', 'missing');
  await panel.scrollIntoViewIfNeeded();
  await shot(page, info, '01-drift-panel-light');
  await panel.locator('[data-open-drift]').click();
  const dlg = s.locator('sw-dialog[data-drift-dialog]');
  await expect(dlg.locator('[data-drift-row]')).toHaveCount(5);
  await expect(dlg.locator('[data-drift-insync]')).toContainText('2');
  const text = await dlg.innerText();
  expect(text).toContain('WisKey');
  expect(text).not.toMatch(/אינטרקום|intercom/i);
  expect(text).not.toMatch(/913\d{3}/);
  await shot(page, info, '02-drift-dialog-light');
  expect(errors).toEqual([]);
});

test('the drift actions: push the name only where allowed, read back, open the grant', async ({ page }) => {
  const { mock } = await boot(page, { hash: '/wiskey/external?drift=1' });
  const dlg = page.locator(`${SCREEN} sw-dialog[data-drift-dialog]`);
  await expect(dlg.locator('[data-drift-row]')).toHaveCount(5);
  await expect(dlg.locator('[data-drift-push]')).toHaveCount(1); // the one name difference the server allows
  await expect(dlg.locator('[data-drift-row="c-g12"] .dact sw-button')).toHaveCount(0); // a person with no grant: nothing to read or open
  await dlg.locator('[data-drift-push="l-g05"]').click();
  await expect.poll(() => mock.posts.map((p) => p.path)).toContain('access-grants/links/l-g05/push-name');
  await dlg.locator('[data-drift-row="c-g06"] [data-drift-read]').click();
  await expect.poll(() => mock.posts.map((p) => p.path)).toContain(`access-grants/${'g06'.padEnd(32, '0')}/read-now`);
  await dlg.locator('[data-drift-row="c-g09"] [data-drift-open]').click();
  await expect(page.locator(`${SCREEN} sw-drawer[data-grant-drawer="${'g09'.padEnd(32, '0')}"]`)).toBeVisible();
});

test('the drift view in dark, and on the phone without horizontal overflow', async ({ page }, info) => {
  await boot(page, { scheme: 'dark', hash: '/wiskey/external?drift=1' });
  const dlg = page.locator(`${SCREEN} sw-dialog[data-drift-dialog]`);
  await expect(dlg.locator('[data-drift-row]')).toHaveCount(5);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await shot(page, info, '03-drift-dialog-dark');
});

test('no differences: the empty state', async ({ page }, info) => {
  await boot(page, { noDrift: true, hash: '/wiskey/external?drift=1' });
  const dlg = page.locator(`${SCREEN} sw-dialog[data-drift-dialog]`);
  await expect(dlg.locator('sw-state-panel[state="empty"]')).toBeVisible();
  await expect(dlg.locator('[data-drift-insync]')).toContainText('7');
  await shot(page, info, '04-drift-empty');
});

test('the feature off: no drift panel', async ({ page }) => {
  await boot(page, { enabled: false, empty: true });
  await expect(page.locator(`${SCREEN} [data-drift-panel]`)).toHaveCount(0);
  await expect(page.locator(`${SCREEN} [data-export-csv]`)).toHaveAttribute('disabled', '');
});

test('the CSV export: one request in the screen language, a download and the row count', async ({ page }, info) => {
  const { mock } = await boot(page);
  const s = page.locator(SCREEN);
  const download = page.waitForEvent('download');
  await s.locator('[data-export-csv]').click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('external-access-20261020-1020.csv');
  expect(mock.exports).toEqual(['?lang=he']);
  await expect(s.locator('[data-toast]')).toContainText('14');
  await shot(page, info, '05-export-toast');
});

test('the CSV export once a minute: a plain message, no error page', async ({ page }) => {
  await boot(page, { exportRate: true });
  const s = page.locator(SCREEN);
  await s.locator('[data-export-csv]').click();
  await expect(s.locator('[data-toast]')).toContainText('פעם בדקה');
  await expect(s.locator('.err-line')).toHaveCount(0);
});
