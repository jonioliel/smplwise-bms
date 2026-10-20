import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { url } from './access-control-mocks';
import { installExternalMock, XNOW, type ExternalOptions } from './access-external-mocks';
import { settlePage } from './pixel-settle';

// SHAREDID-293 against the mocked backend (tests/access-external-mocks.ts: the wire of GET /access-grants, invented sample data, no PIN anywhere).
// Nothing here reaches a WisKey, a station, a door or WhatsApp. What it pins (owner decisions of 2026-10-20):
//   1 the product is "WisKey" on the screen;
//   2 "Active - verified" only where the server says it holds read-back proof (scope_verified);
//   3 the manual "confirmed gone": only for a system administrator, only on a revocation whose person is missing, three checks + a reference
//     without a phone number + the typed word before the button wakes up; the request carries exactly that;
//   4 the weekly digest: the side panel and the full digest (gaps, slow revocations, who approved, codes);
//   5 the identity card in the drawer: name drift and "push the name";
//   6 the placement setting is saved through PUT /access-grants/settings;
//   7 the attach of a recovered person: system administrators only;
// plus the approval dialog (narrow only), the KPI filters, the empty / feature-off states, desktop and phone, light and dark.
// Evidence screenshots: docs/design/evidence/SHAREDID-293/. Needs the Vite dev server or a built preview (SW_BASE_URL).
const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE = path.resolve(HERE, '..', '..', 'docs', 'design', 'evidence', 'SHAREDID-293');
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

test('the list: KPIs, states, verified only with proof, the banners and the side panels', async ({ page }, info) => {
  const { errors } = await boot(page);
  const s = page.locator(SCREEN);
  await expect(s.locator('h1')).toHaveText('גישת חוץ');
  await expect(s.locator('[data-kpi="attention"] b')).toHaveText('4');
  await expect(s.locator('[data-kpi="waiting"] b')).toHaveText('3');
  // decision 2: exactly the one row whose server answer carries scope_verified
  await expect(s.locator('.gl-r[data-ui-state="verified"]')).toHaveCount(1);
  await expect(s.locator('.gl-r[data-ui-state="accepted"]')).toHaveCount(2); // one of them carries a widening that waits
  await expect(s.locator('[data-banner="revoking"]')).toBeVisible();
  await expect(s.locator('[data-digest-panel]')).toBeVisible();
  await expect(s.locator('[data-extended-identity="locked"] input')).toBeDisabled();
  const text = await s.innerText();
  expect(text).not.toMatch(/אינטרקום|intercom/i); // decision 1
  expect(text).not.toMatch(/913\d{3}/); // no PIN-like value anywhere
  await shot(page, info, '01-list-light');
  await s.locator('[data-kpi="history"]').click();
  await expect(s.locator('.gl-r[data-ui-state="gone"]')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('the dark list and the phone width keep everything in the viewport', async ({ page }, info) => {
  await boot(page, { scheme: 'dark' });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await shot(page, info, '02-list-dark');
});

test('the drawer of an unknown outcome: what is known, what is not, and the ladder', async ({ page }, info) => {
  await boot(page);
  const s = page.locator(SCREEN);
  await s.locator('.gl-r[data-ui-state="unknown"]').click();
  const d = s.locator('sw-drawer[data-grant-drawer]');
  await expect(d.locator('.ku')).toBeVisible();
  await expect(d.locator('[data-ladder] .stp[data-s="unk"]')).toHaveCount(2);
  await shot(page, info, '03-drawer-unknown');
});

test('decision 2 in the drawer: verified shows the full ladder; accepted stops before the read-back step', async ({ page }) => {
  await boot(page);
  const s = page.locator(SCREEN);
  await s.locator('.gl-r[data-ui-state="verified"]').click();
  await expect(s.locator('[data-ladder] .stp[data-s="done"]')).toHaveCount(5);
  await s.locator('sw-drawer[data-grant-drawer]').evaluate((el) => el.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true })));
  await s.locator('.gl-r', { hasText: 'שירן מזרחי' }).click();
  await expect(s.locator('[data-ladder] .stp[data-s="done"]')).toHaveCount(4);
});

test('the approval dialog narrows only and sends the doors and the window it shows', async ({ page }, info) => {
  const { mock } = await boot(page);
  const s = page.locator(SCREEN);
  await s.locator('.gl-r[data-ui-state="pending"]').click();
  await s.locator('[data-action="approve"]').click();
  const dlg = s.locator('sw-dialog[data-approve-dialog]');
  await expect(dlg.locator('[data-approve-ok]')).toBeVisible();
  await shot(page, info, '04-approve');
  await dlg.locator('[data-approve-door="base:1"]').uncheck();
  await dlg.locator('[data-approve-ok]').click();
  const post = mock.posts.find((p) => p.path.endsWith('/approve'));
  expect(post?.body).toMatchObject({ doors: { lobby: [1] }, valid_from: '2026-10-21T04:00:00Z', valid_until: '2026-10-22T13:00:00Z' });
});

test('decision 3: the manual "confirmed gone" wakes up only with the checks, a clean reference and the word', async ({ page }, info) => {
  const { mock } = await boot(page);
  const s = page.locator(SCREEN);
  await s.locator('.gl-r', { hasText: 'משה ביטון' }).click();
  await s.locator('[data-action="gone"]').click();
  const dlg = s.locator('sw-dialog[data-gone-dialog]');
  const ok = dlg.locator('[data-gone-ok]');
  await expect(ok).toHaveAttribute('disabled', '');
  for (const i of [0, 1, 2]) await dlg.locator(`[data-gone-check="${i}"]`).check();
  await dlg.locator('#gref').fill('התקשרתי 050-123-4567');
  await dlg.locator('#gw').fill('נמחק');
  await expect(ok).toHaveAttribute('disabled', '');
  await dlg.locator('#gref').fill('פנייה 5521 לאחראי WisKey');
  await expect(ok).not.toHaveAttribute('disabled', '');
  await shot(page, info, '05-confirmed-gone');
  await ok.click();
  const post = mock.posts.find((p) => p.path.endsWith('/confirm-gone'));
  expect(post?.body).toEqual({ reference: 'פנייה 5521 לאחראי WisKey', confirm: 'נמחק', checks: [true, true, true] });
});

test('decisions 3 and 7: an approver who is not a system administrator gets no manual closure, no attach and no settings', async ({ page }) => {
  await boot(page, { systemAdmin: false });
  const s = page.locator(SCREEN);
  await expect(s.locator('[data-open-settings]')).toHaveCount(0);
  await expect(s.locator('[data-revoke-all]')).toHaveCount(0);
  await s.locator('.gl-r', { hasText: 'משה ביטון' }).click();
  await expect(s.locator('[data-action="gone"]')).toHaveCount(0);
  await s.locator('sw-drawer[data-grant-drawer]').evaluate((el) => el.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true })));
  await s.locator('.gl-r[data-ui-state="unknown"]').click();
  await expect(s.locator('access-identity-card [data-identity-act="attach"] sw-button')).toHaveAttribute('disabled', '');
});

test('decision 4: the full weekly digest', async ({ page }, info) => {
  await boot(page);
  const s = page.locator(SCREEN);
  await s.locator('[data-open-digest]').click();
  const dlg = s.locator('sw-dialog[data-digest-dialog]');
  await expect(dlg.locator('[data-gap]')).toHaveCount(3);
  await shot(page, info, '06-digest');
});

test('decisions 5 and 7: the identity card in the drawer - name drift, and the attach for an unresolved create', async ({ page }, info) => {
  await boot(page);
  const s = page.locator(SCREEN);
  await s.locator('.gl-r[data-ui-state="verified"]').click();
  const card = s.locator('access-identity-card');
  await expect(card.locator('[data-identity-drift]')).toBeVisible();
  await expect(card.locator('[data-identity-act="push"] sw-button')).not.toHaveAttribute('disabled', '');
  await shot(page, info, '07-identity-drift');
  await s.locator('sw-drawer[data-grant-drawer]').evaluate((el) => el.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true })));
  await s.locator('.gl-r[data-ui-state="unknown"]').click();
  await expect(s.locator('access-identity-card [data-identity-act="attach"] sw-button')).not.toHaveAttribute('disabled', '');
});

test('decision 6: the placement is a system administrator setting saved through the screen', async ({ page }, info) => {
  const { mock } = await boot(page);
  const s = page.locator(SCREEN);
  await s.locator('[data-open-settings]').click();
  const dlg = s.locator('sw-dialog[data-settings-dialog]');
  await dlg.locator('[data-setting="placement:both"]').click();
  await dlg.locator('[data-setting="digest_channel:app_whatsapp"]').click();
  await dlg.locator('[data-setting="name_sync:auto"]').click();
  await shot(page, info, '08-settings');
  await dlg.locator('[data-settings-save]').click();
  await expect.poll(() => mock.settingsPuts.length).toBe(1);
  expect(mock.settingsPuts[0]).toMatchObject({ placement: 'both', digest_channel: 'app_whatsapp', name_sync: 'auto', digest_day: 0, digest_hour: 8 });
});

test('the build as shipped: the feature is off and the list is empty', async ({ page }, info) => {
  await boot(page, { enabled: false, empty: true });
  const s = page.locator(SCREEN);
  await expect(s.locator('[data-banner="off"]')).toBeVisible();
  await expect(s.locator('[data-external-empty="off"]')).toBeVisible();
  await shot(page, info, '09-off-empty');
});
