import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installMessagingMock, waUrl, type WaMock, type WaMockOptions } from './messaging-mocks';

// CR-038 slice 5a evidence: Settings › ערוץ ההודעות from the REAL build against the mock layer (fake data), desktop 1440 and phone 390, light
// and dark, the classic and domus skins (the five-skin sweep is layout-messaging-accounts.spec.ts). Also asserts behaviour: state chips,
// the shared chip and warnings, the "כמו ..." / "ברירת המחדל" pickers, a move with queued messages asks first, a manual account is added
// through the dialog and saved, SMS is shown disabled, a system.configure reader sees no editor and no typed number.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-messaging-accounts.spec.ts --project=desktop --project=mobile --workers=1
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/tickets-s5a');
const S = 'sw-app system-messaging-accounts';

async function go(page: Page, o: WaMockOptions = {}, scheme: 'light' | 'dark' = 'light', skin = 'classic', wait = true): Promise<WaMock> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  const mock = await installMessagingMock(page, o);
  await page.goto('about:blank');
  await page.goto(waUrl('/system/messaging-accounts', skin, scheme));
  if (wait) await page.waitForSelector(`${S} [data-messaging-accounts][data-state]`);
  return mock;
}

async function shot(page: Page, name: string, scheme: 'light' | 'dark' = 'light', skin = 'classic'): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${name}: horizontal overflow`).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}-${scheme}-${skin}.png`), fullPage: true });
}

test.describe('messaging accounts evidence', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'desktop 1440 and phone 390');
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('the screen: accounts, uses, channels, the selected account - light / dark x classic / domus', async ({ page }) => {
    for (const skin of ['classic', 'domus'])
      for (const scheme of ['light', 'dark'] as const) {
        await go(page, {}, scheme, skin);
        await shot(page, 'messaging-accounts', scheme, skin);
      }
    const s = page.locator(S);
    await expect(s.locator('[data-account]')).toHaveCount(4);
    await expect(s.locator('[data-account="entry:01JFAKEOFFICE"] [data-state="connected"]')).toHaveText('מחובר');
    await expect(s.locator('[data-account="entry:01JFAKESPARE0"] [data-state="disconnected"]')).toHaveText('מנותק');
    await expect(s.locator('[data-account="entry:01JFAKEINTERC"] [data-shared]')).toBeVisible();
    await expect(s.locator('[data-account="entry:01JFAKEOFFICE"]')).toContainText('····0191');
    await expect(s.locator('[data-use-pick="tickets.codes"] option').first()).toHaveText('כמו הודעות בקשות שירות');
    await expect(s.locator('[data-channel="sms"]')).toHaveAttribute('aria-disabled', 'true');
    await expect(s.locator('[data-channel="sms"] [data-channel-state]')).toHaveText('בקרוב');
    await expect(s.locator('[data-test-send] button')).toBeDisabled(); // no number typed yet
    await expect(s.locator('[data-test-off]')).toHaveCount(0); // owner 2026-10-14: open without an environment switch
    // a typed number, one confirm, then the queued line (the mock answers; nothing leaves)
    await s.locator('[data-test-target]').fill('+1 555 555 0199');
    await s.locator('[data-test-send] button').click();
    await expect(s.locator('[data-test-dialog]')).toHaveAttribute('open', '');
    await s.locator('[data-test-confirm] button').click();
    await expect(s).toContainText('הבדיקה נשלחה לתור');
    await expect(s.locator('[data-save] button')).toBeDisabled();
    const text = await s.evaluate((el) => el.shadowRoot?.textContent ?? '');
    expect(text).not.toMatch(/Home Assistant|Ingress/);
  });

  test('departments: the override rows and their warnings', async ({ page }) => {
    for (const skin of ['classic', 'domus'])
      for (const scheme of ['light', 'dark'] as const) {
        await go(page, {}, scheme, skin);
        await page.locator(`${S} [data-dept-row="dept-cleaning"]`).scrollIntoViewIfNeeded();
        await shot(page, 'messaging-departments', scheme, skin);
      }
    const row = page.locator(`${S} [data-dept-row="dept-cleaning"]`);
    await expect(row.locator('[data-warning="shared_outside"]')).toHaveText('המספר משמש גם מחוץ למערכת');
    await expect(row.locator('[data-warning="shared_module"]')).toContainText('בקרת כניסה');
    await expect(page.locator(`${S} [data-dept-pick="tickets.messages@dept:dept-maintenance"] option`).first()).toHaveText('ברירת המחדל');
  });

  test('a move with queued messages asks first, then saves with the confirm', async ({ page }) => {
    const mock = await go(page, { queued: 3 });
    const s = page.locator(S);
    await s.locator('[data-use-pick="tickets.messages"]').selectOption('entry:01JFAKEINTERC');
    await expect(s.locator('[data-save] button')).toBeEnabled();
    await s.locator('[data-save]').click();
    const dlg = s.locator('[data-confirm-dialog]');
    await expect(dlg.locator('[data-confirm-count="3"]')).toHaveText('3 הודעות ממתינות יישלחו מהחשבון החדש');
    await shot(page, 'messaging-confirm');
    await dlg.locator('[data-confirm-save]').click();
    await expect.poll(() => mock.calls.filter((c) => c.method === 'PUT').length).toBe(2);
    const last = mock.calls.filter((c) => c.method === 'PUT').pop()?.body as { confirm_queued?: boolean; uses: Record<string, string | null>; revision: number };
    expect(last.confirm_queued).toBe(true);
    expect(last.uses['tickets.messages']).toBe('entry:01JFAKEINTERC');
    expect(last.revision).toBe(3);
    await expect(s.locator('[data-ok]')).toHaveText('נשמר');
  });

  test('a manual account: the dialog refuses a discovered entry id, then adds and saves', async ({ page }) => {
    const mock = await go(page);
    const s = page.locator(S);
    await s.locator('[data-manual-add]').click();
    const dlg = s.locator('[data-manual-dialog]');
    await dlg.locator('[data-manual-label]').fill('טלפון המחסן');
    await dlg.locator('[data-manual-new-value]').fill('01JFAKEOFFICE');
    await dlg.locator('[data-manual-ok]').click();
    await expect(dlg.locator('[data-manual-error]')).toHaveText('המזהה הזה הוא של חשבון שכבר נמצא - בחרו אותו מהרשימה');
    await dlg.locator('[data-manual-new-value]').fill('15555550188');
    await shot(page, 'messaging-manual');
    await dlg.locator('[data-manual-ok]').click();
    await expect(s.locator('[data-account^="manual:"]')).toHaveCount(2);
    await expect(s.locator('[data-selected^="manual:"] [data-manual-value]')).toHaveValue('15555550188');
    await s.locator('[data-save]').click();
    await expect.poll(() => mock.calls.filter((c) => c.method === 'PUT').length).toBe(1);
    const put = mock.calls.find((c) => c.method === 'PUT')?.body as { accounts: { key: string; kind: string; account?: string; label: string }[] };
    const added = put.accounts.find((a) => a.label === 'טלפון המחסן');
    expect(added?.kind).toBe('manual');
    expect(added?.key).toMatch(/^manual:[a-z0-9]{8}$/);
    expect(added?.account).toBe('15555550188');
  });

  test('a system.configure reader: read-only, the typed value masked', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await go(page, { persona: 'configure' }, scheme);
      await shot(page, 'messaging-readonly', scheme);
    }
    const s = page.locator(S);
    // the page's own read-only note and (since WAPACE-295) the send-policy card's own "view only" tag - both must show
    await expect(s.locator('p[data-read-only]')).toBeVisible();
    await expect(s.locator('messaging-policy-card [data-read-only]')).toBeVisible();
    await expect(s.locator('[data-savebar]')).toHaveCount(0);
    await expect(s.locator('[data-use-pick="tickets.messages"]')).toBeDisabled();
    await s.locator('[data-account="manual:k3f9demo"]').click();
    await expect(s.locator('[data-manual-value]')).toHaveValue('····0197');
    const text = await s.evaluate((el) => el.shadowRoot?.textContent ?? '');
    expect(text).not.toContain('15555550197');
  });

  test('states: nothing found, module off, no permission, platform down', async ({ page }) => {
    await go(page, { empty: true, wsDown: true });
    await expect(page.locator(`${S} [data-no-accounts]`)).toBeVisible();
    await expect(page.locator(`${S} [data-required-unmapped]`)).toHaveText('לא נבחר חשבון - הודעות לא יישלחו בוואטסאפ');
    await expect(page.locator(`${S} [data-ws-down]`)).toBeVisible();
    await shot(page, 'messaging-empty');
    await go(page, { ticketsOn: false });
    await expect(page.locator(`${S} [data-no-uses]`)).toBeVisible();
    await expect(page.locator(`${S} [data-channel="whatsapp"] [data-channel-state]`)).toHaveText('לא בשימוש');
    // without either permission the shell offers no tab; reached by its address the screen shows nothing of the accounts
    await go(page, { persona: 'operator' }, 'light', 'classic', false);
    await page.waitForTimeout(1500);
    await expect(page.locator(`${S} [data-account]`)).toHaveCount(0);
  });
});
