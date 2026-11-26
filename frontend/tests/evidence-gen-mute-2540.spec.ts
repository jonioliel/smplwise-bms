import { test, expect, type Page } from '@playwright/test';
import { installGeneratorMock, PERMS, url } from './generator-mocks';

// RELEASE-2540-TRAIN (train fix on DATA-RULES-2540, review D-03): the generator alert drawer and the server's mute rules.
// - a CRITICAL alert's mute needs generator.manage: a view-only user's refusal says so in the drawer (not a generic line, never silent);
// - the server caps a critical mute: the drawer names the real (shorter) end;
// - a running mute can be ended ("ביטול ההשתקה") only from its own confirmation, which opens with the focus on cancel; cancel sends nothing.
// Mocked backend only (generator-mocks.ts `muteRules`).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-gen-mute-2540.spec.ts --project=desktop --project=mobile
const S = 'sw-app infra-generator';

async function open(page: Page, id: string, perms: string[]) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const mock = await installGeneratorMock(page, { perms, muteRules: true });
  await page.goto('about:blank');
  await page.goto(url(`/infra/generator/alerts/${id}`));
  await page.locator(`${S} [data-detail] [data-mute]`).waitFor({ timeout: 20_000 });
  return mock;
}

/** Whether the focus (through the shadow roots) is inside the element matching `sel`. */
async function focusIn(page: Page, sel: string): Promise<boolean> {
  return page.evaluate((sel) => {
    let a: Element | null = document.activeElement;
    while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
    for (let n: Node | null = a; n; n = (n as Element).parentNode ?? ((n as ShadowRoot).host ?? null)) {
      if (n instanceof Element && n.matches(sel)) return true;
    }
    return false;
  }, sel);
}

test.describe('generator alert mute (DATA-RULES-2540 server rules)', () => {
  test('a view-only user muting a critical alert is told why it was refused', async ({ page }) => {
    const mock = await open(page, 'al5', PERMS.view);
    await page.locator(`${S} [data-detail] [data-mute]`).click();
    const notice = page.locator(`${S} [data-detail] [data-notice]`);
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('השתקה של התראה קריטית דורשת הרשאת ניהול גנרטור');
    await expect(page.locator(`${S} [data-detail] [data-muted]`)).toHaveCount(0);
    await expect(page.locator(`${S} [data-detail] [data-unmute]`)).toHaveCount(0);
    expect(mock.calls.filter((c) => c.method === 'POST' && /alerts\/al5\/mute/.test(c.path))).toHaveLength(1);
  });

  test('a non-critical mute by a view-only user works and names no shorter end', async ({ page }) => {
    await open(page, 'al1', PERMS.view);
    await page.locator(`${S} [data-detail] [data-mute]`).click();
    await expect(page.locator(`${S} [data-detail] [data-muted]`)).toBeVisible();
    await expect(page.locator(`${S} [data-detail] [data-notice]`)).toHaveCount(0);
    await expect(page.locator(`${S} [data-detail] [data-mute-info]`)).toHaveCount(0);
  });

  test('a manager mutes a critical alert: the shorter end is named; ending the mute asks first, focus on cancel', async ({ page }) => {
    const mock = await open(page, 'al5', PERMS.manage);
    await page.locator(`${S} [data-detail] [data-mute]`).click();
    await expect(page.locator(`${S} [data-detail] [data-mute-info]`)).toContainText('הושתקה רק עד');
    await expect(page.locator(`${S} [data-detail] [data-muted]`)).toBeVisible();
    const unmute = page.locator(`${S} [data-detail] [data-unmute]`);
    await expect(unmute).toBeVisible();

    // cancel: nothing is sent, the mute stays
    await unmute.click();
    const dlg = page.locator('sw-confirm-dialog');
    await expect(dlg.locator('[data-confirm-ok]')).toBeVisible();
    await expect.poll(() => focusIn(page, '[data-confirm-cancel]'), { timeout: 5_000 }).toBe(true);
    await dlg.locator('[data-confirm-cancel]').click();
    await expect(dlg.locator('[data-confirm-ok]')).toHaveCount(0);
    expect(mock.calls.filter((c) => c.method === 'DELETE')).toHaveLength(0);
    await expect(page.locator(`${S} [data-detail] [data-muted]`)).toBeVisible();

    // confirm: one DELETE, the mute is gone
    await unmute.click();
    await dlg.locator('[data-confirm-ok]').click();
    await expect(page.locator(`${S} [data-detail] [data-mute-info]`)).toContainText('ההשתקה בוטלה');
    await expect(page.locator(`${S} [data-detail] [data-muted]`)).toHaveCount(0);
    await expect(page.locator(`${S} [data-detail] [data-unmute]`)).toHaveCount(0);
    expect(mock.calls.filter((c) => c.method === 'DELETE' && /alerts\/al5\/mute/.test(c.path))).toHaveLength(1);
  });
});
