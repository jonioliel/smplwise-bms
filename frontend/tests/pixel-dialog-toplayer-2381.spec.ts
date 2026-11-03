import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { settlePage } from './pixel-settle';
import { pixelTitle, skinCheck } from './helpers/pixel-skins';

// DIALOG-TOPLAYER-2381: the picture of the fix. A dialog opened from the middle of a tall glass card (the shell scrolled along the card)
// must dim the WHOLE screen - rail, top bar, the card and the page around it - and sit in the middle of the screen. Before 2.38.1 the glass
// skins dimmed only the card and centred the box on it. The existing dialog baselines did not show this: they shoot the box alone
// (pixel-nvr-encoding-batch), a dialog on <body> (visual-matrix) or the classic skin (pixel-access-events). The style guide's own content is
// hidden so only the shell and the card sit behind the dimming. Desktop 1440 and phone 390, light; domus carries the baseline, crystal the
// structural smoke (helpers/pixel-skins.ts). The geometry is asserted in evidence-dialog-toplayer-2381.spec.ts.

const SKINS = ['domus', 'crystal'] as const;

const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function openInTallCard(page: Page, skin: string) {
  await page.clock.setFixedTime(new Date('2026-11-03T09:00:00Z'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('about:blank');
  await page.goto(`/?design=a&look=performance:full&skin=${skin}&scheme=light#/styleguide`);
  await page.waitForSelector('sw-app');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const main = document.querySelector('sw-app')!.shadowRoot!.querySelector('main')!;
    for (const c of Array.from(main.children)) (c as HTMLElement).style.visibility = 'hidden';
    const card = document.createElement('sw-card');
    card.id = 'px-card';
    card.style.cssText = 'display:block;block-size:2400px;margin:16px;visibility:visible';
    card.innerHTML = `<div style="block-size:1150px"></div>
      <button id="px-open" type="button" style="min-block-size:44px">פתח</button>
      <sw-dialog id="px-dlg" heading="שמירה בלי בדיקה" subheading="החיבור לא נבדק">
        <p style="margin:0">הדיאלוג נפתח מתוך כרטיס גבוה, באמצע הגלילה.</p>
        <sw-button slot="footer" variant="ghost">ביטול</sw-button>
        <sw-button slot="footer" variant="primary">שמירה</sw-button>
      </sw-dialog>`;
    main.append(card);
    card.querySelector('#px-open')!.addEventListener('click', () => ((card.querySelector('#px-dlg') as unknown as { open: boolean }).open = true));
    card.querySelector('#px-open')!.scrollIntoView({ block: 'center', behavior: 'instant' });
  });
  await page.locator('#px-open').click();
  await expect(page.locator('#px-dlg')).toHaveAttribute('open', '');
  await page.mouse.move(0, 0);
  await settlePage(page);
}

test.describe('pixel: a dialog opened inside a tall glass card', () => {
  for (const skin of SKINS) {
    test(pixelTitle(skin, 'the dimming covers the screen and the box is centred on it'), async ({ page }, info) => {
      test.skip(info.project.name === 'tablet', 'desktop and phone only');
      const check = skinCheck(page, skin);
      await openInTallCard(page, skin);
      const name = `toplayer-${skin}-dialog-${info.project.name === 'mobile' ? '390' : '1440'}.png`;
      await check(async () => {
        if (noBaseline(info, name)) test.info().annotations.push({ type: 'skipped-pixel', description: `${name}: no baseline on ${process.platform}` });
        else await expect(page).toHaveScreenshot(name, { maxDiffPixels: 60, animations: 'disabled', caret: 'hide' });
      }, '#px-dlg >> .box');
    });
  }
});
