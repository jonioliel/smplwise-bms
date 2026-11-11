import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import { settlePage } from './pixel-settle';

// PLAN3D-R28-WIZARD-2433 pixel baselines and layout checks: the plan wizard (#/explore/floors/<id>/wizard) on the demo sample house -
// the seven steps of the round 28 mockup - desktop 1440 and tablet 1024, classic light. Demo mode (no backend; nothing is sent). The 3D
// preview of steps 5 and 7 is masked (WebGL output is not pixel-stable across machines); its presence is checked instead. Baselines are
// per OS, generated on the runner and reviewed image by image; until they exist the pixel checks are skipped (annotated), never failed.
//   run_smart.py preview <branch> tests/pixel-plan-wizard-2433.spec.ts --project=desktop --project=tablet --workers=1 [-u]
const noBaseline = (info: Pick<TestInfo, 'snapshotPath' | 'config'>, name: string) => !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));
const W = 'plan-wizard-screen';

async function open(page: Page, step: number) {
  await page.goto('about:blank');
  await page.goto(`/?design=a#/explore/floors/f0/wizard?step=${step}`);
  await expect(page.locator(`${W} .wz[data-wizard-step="${step}"]`)).toBeVisible({ timeout: 30_000 });
  if (step === 5 || step === 7) await expect(page.locator(`${W} [data-wz-3d]`)).toBeVisible({ timeout: 30_000 });
  await settlePage(page);
}

async function shoot(page: Page, info: TestInfo, name: string) {
  await page.mouse.move(0, 0);
  await settlePage(page);
  const file = `${name}-${info.project.name === 'tablet' ? '1024' : '1440'}.png`;
  if (noBaseline(info, file)) info.annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
  else await expect(page).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled', mask: [page.locator(`${W} [data-wz-3d]`)] });
}

/** A control screen never scrolls: the page, the shell's main area and the wizard's side panel. */
async function overflow(page: Page) {
  return page.evaluate((tag) => {
    const app = document.querySelector('sw-app')!.shadowRoot!;
    const host = app.querySelector(tag)!;
    const out: string[] = [];
    const doc = document.scrollingElement!;
    if (doc.scrollHeight - doc.clientHeight > 1) out.push('document');
    const main = app.querySelector('main') as HTMLElement | null;
    if (main && main.scrollHeight - main.clientHeight > 1) out.push('main');
    for (const sel of ['.wz', '.wz-side', '.wz-steps', '.wz-foot']) {
      const el = host.shadowRoot!.querySelector(sel) as HTMLElement | null;
      if (el && (el.scrollHeight - el.clientHeight > 1 || el.scrollWidth - el.clientWidth > 1)) out.push(sel);
    }
    return out;
  }, W);
}

test.describe('pixel: the plan wizard', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo-mode spec');
  test.beforeEach(({}, info) => test.skip(info.project.name === 'mobile', 'desktop and tablet (on a phone the structure guard shows the desktop-only state, checked below)'));

  for (const step of [1, 2, 3, 4, 5, 6, 7]) {
    test(`step ${step} is pixel-stable and does not scroll`, async ({ page }, info) => {
      await open(page, step);
      expect(await overflow(page)).toEqual([]);
      await shoot(page, info, `wizard-step${step}`);
    });
  }

  test('the review: a choice is kept, the pager moves on, the counts and the hint follow the choices', async ({ page }) => {
    await open(page, 3);
    const side = page.locator(`${W} [data-wz-side]`);
    await expect(side.locator('[data-wz-counts]')).toContainText('19');
    await expect(side.locator('[data-wz-pos]')).toHaveText('1 / 8');
    await expect(side.locator('[data-wz-item]')).toHaveAttribute('data-wz-item', 'auto-d-liv-kit');
    await expect(side.locator('[data-choice="passage"]')).toHaveAttribute('aria-pressed', 'true'); // what the detector said
    await side.locator('[data-choice="sliding"]').click();
    await expect(side.locator('[data-wz-pos]')).toHaveText('2 / 8'); // on to the next undecided item
    await side.locator('button[aria-label="הקודם"]').click();
    await expect(side.locator('[data-choice="sliding"]')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('4'); // the keys pick the options too
    await expect(side.locator('[data-wz-pos]')).toHaveText('2 / 8');
    await expect(page.locator(`${W} .wz-foot .hint`)).toContainText('"לבדיקה" ייכנס כמו שזוהה');
  });

  test('the rooms: a name of an existing area links it, an empty name is marked, a click on the plan focuses its row', async ({ page }) => {
    await open(page, 4);
    const rows = page.locator(`${W} [data-wz-rooms] .rrow`);
    await expect(rows).toHaveCount(8);
    await expect(rows.nth(3).locator('input')).toHaveClass(/linked/); // "סלון" is an area of the installation
    await expect(rows.nth(6).locator('input')).toHaveClass(/empty/);
    await expect(page.locator(`${W} .rnote .warn`)).toHaveText('2 חדרים עוד בלי שם');
    await rows.nth(6).locator('input').fill('שירותים');
    await expect(rows.nth(6).locator('select')).toHaveValue('wc'); // the type follows the name
    await expect(page.locator(`${W} .rnote .warn`)).toHaveText('חדר אחד עוד בלי שם');
  });

  test('the style: choosing a kit changes the selection; the empty kit turns the furniture off', async ({ page }) => {
    await open(page, 5);
    const side = page.locator(`${W} [data-wz-side]`);
    await expect(side.locator('[data-kit="apartment"]')).toHaveAttribute('aria-checked', 'true');
    await side.locator('[data-kit="empty"]').click();
    await expect(side.locator('[data-kit="empty"]')).toHaveAttribute('aria-checked', 'true');
    await expect(side.locator('[data-wz-furniture]')).toBeDisabled();
    await expect(side.locator('[data-wz-furniture]')).not.toBeChecked();
  });

  test('the devices: the ones without an area wait for a place; selecting one and clicking the plan places it', async ({ page }) => {
    await open(page, 6);
    const side = page.locator(`${W} [data-wz-side]`);
    await expect(side.locator('.dev.todo')).toHaveCount(2);
    await side.locator('[data-dev-row="light.floor_lamp"]').click();
    await expect(side.locator('[data-wz-dev-sel]')).toContainText('מנורת רצפה סלון');
    const plan = page.locator(`${W} [data-wz-canvas] svg.plan`);
    const box = (await plan.boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.62, box.y + box.height * 0.3);
    await expect(side.locator('.dev.todo')).toHaveCount(1);
    await expect(page.locator(`${W} [data-dev="light.floor_lamp"]`)).toHaveCount(1);
  });

  test('the settings open from the step bar and keep the thresholds ordered', async ({ page }) => {
    await open(page, 3);
    await page.locator(`${W} [data-wz-prefs]`).click();
    const dlg = page.locator(`${W} sw-dialog[data-wz-prefs-dialog]`);
    await expect(dlg).toHaveAttribute('open', '');
    const nums = dlg.locator('input[type="number"]');
    await nums.nth(1).fill('90');
    await expect(dlg.locator('[data-wz-prefs-save]')).toHaveAttribute('disabled', '');
    await nums.nth(1).fill('65');
    await dlg.locator('[data-wz-prefs-save]').click();
    await expect(page.locator(`${W} [data-wz-counts]`)).toContainText('19'); // the 0.60 / 0.62 items moved from "check" to "doubt"
    await expect(page.locator(`${W} [data-wz-counts] .cnt.low b`)).toHaveText('6');
  });
});

test('on a phone the wizard route shows the desktop-only state, like the plan editor and the import', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'phone only');
  await page.goto('about:blank');
  await page.goto('/?design=a#/explore/floors/f0/wizard');
  await expect(page.locator('[data-desktop-only="structure"]')).toBeVisible({ timeout: 30_000 });
});
