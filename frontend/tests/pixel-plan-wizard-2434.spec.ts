import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import { settlePage } from './pixel-settle';

// PLAN3D-R28-WIZARD2-2434: the plan wizard's second round on the demo sample house - cameras in the devices step, "back" to the
// upload keeps the version (and another file asks before the earlier draft is discarded), the resume card. Demo mode (nothing is
// sent), desktop 1440 / tablet 1024. Baselines per OS from the runner; until they exist the pixel checks are skipped (annotated).
//   run_smart.py preview <branch> tests/pixel-plan-wizard-2434.spec.ts --project=desktop --project=tablet --workers=1 [-u]
const noBaseline = (info: Pick<TestInfo, 'snapshotPath' | 'config'>, name: string) => !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));
const W = 'plan-wizard-screen';

async function open(page: Page, step: number, extra = '') {
  await page.goto('about:blank');
  await page.goto(`/?design=a#/explore/floors/f0/wizard?step=${step}${extra}`);
  await expect(page.locator(`${W} .wz[data-wizard-step="${step}"]`)).toBeVisible({ timeout: 30_000 });
  await settlePage(page);
}

async function shoot(page: Page, info: TestInfo, name: string) {
  await page.mouse.move(0, 0);
  await settlePage(page);
  const file = `${name}-${info.project.name === 'tablet' ? '1024' : '1440'}.png`;
  if (noBaseline(info, file)) info.annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
  else await expect(page).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled', mask: [page.locator(`${W} [data-wz-3d]`)] });
}

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

test.describe('the plan wizard, round 2', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo-mode spec');
  test.beforeEach(({}, info) => test.skip(info.project.name === 'mobile', 'desktop and tablet (the phone shows the desktop-only state)'));

  test('cameras: their own tab, a click places one as a square, it counts in the summary and can be taken off again', async ({ page }, info) => {
    await open(page, 6);
    const side = page.locator(`${W} [data-wz-side]`);
    await expect(side.locator('[data-wz-tab="devices"]')).toHaveAttribute('aria-selected', 'true');
    await expect(side.locator('.dev.todo')).toHaveCount(2); // the devices tab is the first round's list, unchanged
    await side.locator('[data-wz-tab="cameras"]').click();
    await expect(side.locator('[data-wz-tab="cameras"]')).toHaveAttribute('aria-selected', 'true');
    await expect(side.locator('[data-dev-row]')).toHaveCount(3);
    await expect(side.locator('.dev.todo')).toHaveCount(0); // a camera without a place is not a warning: it is simply not placed
    expect(await overflow(page)).toEqual([]);
    await shoot(page, info, 'wizard2-cameras');
    await side.locator('[data-dev-row="demo-cam-entry"]').click();
    const plan = page.locator(`${W} [data-wz-canvas] svg.plan`);
    const box = (await plan.boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.8);
    await expect(page.locator(`${W} [data-dev="demo-cam-entry"][data-dev-kind="camera"] rect`)).toHaveCount(1);
    await expect(side.locator('[data-dev-row="demo-cam-entry"] .w')).toHaveText('הוצבה במקום שסימנת');
    await expect(side.locator('[data-wz-tab="cameras"] .num')).toHaveText('1/3');
    await side.locator('[data-dev-row="demo-cam-terrace"]').click();
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.2);
    // take the second one off again: back to waiting, not placed
    await side.locator('[data-dev-row="demo-cam-terrace"]').click();
    await side.getByText('הסר מהמפה').click();
    await expect(page.locator(`${W} [data-dev="demo-cam-terrace"]`)).toHaveCount(0);
    await page.locator(`${W} [data-wz-next]`).click();
    await expect(page.locator(`${W} .wz[data-wizard-step="7"]`)).toBeVisible();
    await expect(page.locator(`${W} [data-wz-cams-count]`)).toHaveText('1');
  });

  test('back from the review keeps the plan: "continue" detects it again, another file asks before the draft is discarded', async ({ page }, info) => {
    await open(page, 3);
    await page.locator(`${W} [data-wz-back]`).click();
    await expect(page.locator(`${W} .wz[data-wizard-step="1"]`)).toBeVisible();
    const side = page.locator(`${W} [data-wz-side]`);
    await expect(side.locator('[data-wz-kept]')).toBeVisible();
    await expect(page.locator(`${W} [data-wz-next]`)).not.toHaveAttribute('disabled', '');
    expect(await overflow(page)).toEqual([]);
    await shoot(page, info, 'wizard2-kept');
    // another file: the confirmation, and "cancel" changes nothing
    await page.locator(`${W} input[data-wz-file]`).setInputFiles({ name: 'אחרת.png', mimeType: 'image/png', buffer: Buffer.from('demo') });
    const dlg = page.locator(`${W} sw-dialog[data-wz-replace-dialog]`);
    await expect(dlg).toHaveAttribute('open', '');
    await shoot(page, info, 'wizard2-replace');
    await dlg.locator('[data-wz-replace-cancel]').click();
    await expect(dlg).toHaveCount(0);
    await expect(side.locator('[data-wz-kept]')).toBeVisible();
    // "continue" runs the detection again on the same version and comes back to the review
    await page.locator(`${W} [data-wz-next]`).click();
    await expect(page.locator(`${W} .wz[data-wizard-step="3"]`)).toBeVisible({ timeout: 15_000 });
    // and the yes: the draft goes, the new file starts a new pass
    await page.locator(`${W} [data-wz-back]`).click();
    await page.locator(`${W} input[data-wz-file]`).setInputFiles({ name: 'אחרת.png', mimeType: 'image/png', buffer: Buffer.from('demo') });
    await page.locator(`${W} [data-wz-replace-go]`).click();
    await expect(page.locator(`${W} sw-dialog[data-wz-replace-dialog]`)).toHaveCount(0);
    await expect(page.locator(`${W} .wz[data-wizard-step="3"]`)).toBeVisible({ timeout: 15_000 });
  });

  test('resume: a wizard draft left mid-way is offered on the upload step and continues the wizard', async ({ page }, info) => {
    await open(page, 1, '&resume=1');
    const card = page.locator(`${W} [data-wz-resume]`);
    await expect(card).toBeVisible();
    await expect(card).toContainText('12.11');
    expect(await overflow(page)).toEqual([]);
    await shoot(page, info, 'wizard2-resume');
    // a new file while the draft is there asks first, like "back"
    await page.locator(`${W} input[data-wz-file]`).setInputFiles({ name: 'אחרת.png', mimeType: 'image/png', buffer: Buffer.from('demo') });
    await expect(page.locator(`${W} sw-dialog[data-wz-replace-dialog]`)).toHaveAttribute('open', '');
    await page.locator(`${W} [data-wz-replace-cancel]`).click();
    await card.locator('[data-wz-resume-go]').click();
    // the sample draft has no accepted structure yet: the detection runs and the wizard goes on from the review
    await expect(page.locator(`${W} .wz[data-wizard-step="3"]`)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(`${W} [data-wz-resume]`)).toHaveCount(0);
  });
});
