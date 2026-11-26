import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHANGE_ID, NOTIFY, installUndo, openSetup } from './nvr-undo-mock';
import { settlePage } from './pixel-settle';

// LISTENER-DEADLINE-2540 (follow-up of CAST-RELAY-HARDEN-2540, deep review V-03) against a MOCKED backend (tests/nvr-undo-mock.ts). The
// NVR change log's "revert" on Settings > Connections:
//   - 409 `changed_since`: the server's reason is shown (amber, "nothing was written"), then the shared confirmation asks "revert anyway"
//     - danger styled, the focus on CANCEL (Enter there sends nothing); only "revert anyway" resends, once, with {"force": true};
//   - 409 `already_rolled_back`: a plain message, no confirmation, never forced; the list is refreshed (the row says "reverted");
//   - Hebrew and English.
// Evidence screenshots (SW_SHOTS=1): docs/design/evidence/LISTENER-DEADLINE-2540/.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-nvr-undo-force-2540.spec.ts --project=desktop --project=mobile

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE = path.resolve(HERE, '..', '..', 'docs', 'design', 'evidence', 'LISTENER-DEADLINE-2540');

async function shot(page: Page, info: TestInfo, name: string) {
  if (!process.env.SW_SHOTS) return;
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await settlePage(page);
  await page.screenshot({ path: path.join(EVIDENCE, `${name}-${info.project.name}.png`) });
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

const HEBREW = /[֐-׿]/;

test.describe('NVR change log: revert anyway after changed_since, plain already_rolled_back', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone');
    test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  });

  test('changed_since: the reason, then "revert anyway" (danger, focus on cancel); Enter cancels; only the confirm resends with force', async ({ page }, info) => {
    const st = await installUndo(page, { mode: 'changed_since' });
    await openSetup(page);
    const card = page.locator(NOTIFY);
    const revert = card.locator(`[data-nvr-rollback="${CHANGE_ID}"]`);
    await expect(revert).toBeVisible({ timeout: 30_000 });
    await revert.click();
    const line = card.locator('[data-nvr-result="warn"]');
    await expect(line).toContainText('שונתה מאז השינוי הזה');
    await expect(line).toContainText('לא נכתב דבר ל־NVR');
    const dlg = page.locator('sw-confirm-dialog');
    await expect(dlg.locator('[data-confirm-text]')).toContainText('שונתה מאז השינוי הזה');
    await expect(dlg.locator('[data-confirm-text]')).toContainText('ותדרוס את מה שמוגדר בו עכשיו');
    await expect(dlg.locator('[data-confirm-ok]')).toHaveAttribute('variant', 'danger');
    await expect(dlg.locator('[data-confirm-ok]')).toContainText('החזר בכל זאת');
    await expect.poll(() => focusIn(page, '[data-confirm-cancel]'), { timeout: 5_000 }).toBe(true);
    await shot(page, info, 'undo-changed-since-confirm');
    await page.keyboard.press('Enter'); // the focus is on cancel: nothing more is sent
    await expect(dlg).toHaveCount(0);
    expect(st.bodies).toEqual([null]);
    await expect(line).toBeVisible(); // the reason stays; the change is still "applied" with its button
    await expect(revert).toBeVisible();
    // a second press asks again; this time the operator confirms
    await revert.click();
    await expect(dlg.locator('[data-confirm-ok]')).toBeVisible();
    await dlg.locator('[data-confirm-ok]').click();
    await expect(card.locator('[data-nvr-result="ok"]')).toContainText('בכל זאת');
    expect(st.bodies).toEqual([null, null, { force: true }]);
    await expect(revert).toHaveCount(0); // the list was read again: the change is reverted
    await expect(card.locator('[data-nvr-changes]')).toContainText('הוחזר');
    await shot(page, info, 'undo-forced-ok');
  });

  test('already_rolled_back: a plain message, no confirmation, never forced; the row shows "reverted"', async ({ page }, info) => {
    const st = await installUndo(page, { mode: 'already_rolled_back' });
    await openSetup(page);
    const card = page.locator(NOTIFY);
    const revert = card.locator(`[data-nvr-rollback="${CHANGE_ID}"]`);
    await expect(revert).toBeVisible({ timeout: 30_000 });
    await revert.click();
    await expect(card.locator('[data-nvr-result="warn"]')).toContainText('כבר הוחזר קודם לכן');
    await expect(card.locator('[data-nvr-result="warn"]')).toContainText('לא נכתב דבר ל־NVR');
    await page.waitForTimeout(500);
    await expect(page.locator('sw-confirm-dialog')).toHaveCount(0);
    expect(st.bodies).toEqual([null]);
    await expect(revert).toHaveCount(0);
    await expect(card.locator('[data-nvr-changes]')).toContainText('הוחזר');
    await shot(page, info, 'undo-already');
  });

  test('English: the reason, the "Revert anyway" confirmation and the already-reverted message are English', async ({ page }, info) => {
    const st = await installUndo(page, { mode: 'changed_since', lang: 'en' });
    await openSetup(page);
    await page.locator('html[data-lang-words="en"]').waitFor({ state: 'attached', timeout: 30_000 });
    const card = page.locator(NOTIFY);
    const revert = card.locator(`[data-nvr-rollback="${CHANGE_ID}"]`);
    await expect(revert).toBeVisible({ timeout: 30_000 });
    await revert.click();
    await expect(card.locator('[data-nvr-result="warn"]')).toContainText('Nothing was written to the NVR.');
    const dlg = page.locator('sw-confirm-dialog');
    await expect(dlg.locator('sw-dialog')).toHaveAttribute('heading', 'Revert a change on the NVR');
    await expect(dlg.locator('[data-confirm-ok]')).toHaveText('Revert anyway');
    await expect(dlg.locator('[data-confirm-text]')).toContainText('Reverting anyway writes the state from before the change Notify ch1');
    expect(await dlg.locator('[data-confirm-text]').innerText()).not.toMatch(HEBREW);
    await expect.poll(() => focusIn(page, '[data-confirm-cancel]'), { timeout: 5_000 }).toBe(true);
    await shot(page, info, 'undo-changed-since-confirm-en');
    await dlg.locator('[data-confirm-cancel]').click();
    await expect(dlg).toHaveCount(0);
    expect(st.bodies).toEqual([null]);
    // the change is reverted elsewhere meanwhile: the next press is the plain English message
    st.status = 'rolled_back';
    await revert.click();
    await expect(card.locator('[data-nvr-result="warn"]')).toContainText('was already reverted earlier');
    await expect(page.locator('sw-confirm-dialog')).toHaveCount(0);
    expect(st.bodies).toEqual([null, null]);
  });
});
