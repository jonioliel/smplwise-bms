import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { installBubbleMock, AREA_PERMS } from './bubble-mocks';

// AREAEDIT-2290: the area pop-up's edit mode (a manager hides / orders the sections and the devices). Layout contract at the three
// reference viewports: the footer (reset / cancel / save) is ALWAYS inside the viewport, the document never scrolls, the name and the
// "editing" label are not clipped, and the side column (apply-to, the alert switch) keeps a real width.
// Edit mode is only offered with a live API session and system.configure: the specs mock the API (tests/bubble-mocks.ts), no backend.
// Only the desktop project runs it: the spec sets its own three viewports.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/layout-area-popup-edit-2290.spec.ts --project=desktop
// Screenshots (local only): SW_EDIT_SHOTS=<dir>.

const SHOTS = process.env.SW_EDIT_SHOTS || '';
const VPS = [
  { name: 'phone', w: 375, h: 812 },
  { name: 'tablet', w: 768, h: 1024 },
  { name: 'desktop', w: 1440, h: 900 },
] as const;

async function openEdit(page: Page, vp: (typeof VPS)[number], dark = false) {
  await installBubbleMock(page, { perms: [...AREA_PERMS, 'system.configure'] });
  await page.setViewportSize({ width: vp.w, height: vp.h });
  if (dark) await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(`./?design=a&skin=bubble&scheme=${dark ? 'dark' : 'light'}#/devices/building`);
  const row = page.locator('sw-app devices-building').locator('[data-area-row="living"]:visible, a.tile[data-area="living"]:visible').first();
  await row.waitFor({ timeout: 15_000 });
  await row.click();
  const sheet = page.locator('sw-app devices-building area-quick-sheet[open]');
  await expect(sheet.locator('[data-qc-panel]')).toBeVisible();
  await page.waitForTimeout(700); // the spring settles
  await sheet.locator('[data-qc-edit]').click();
  await expect(sheet.locator('[data-qc-editor]')).toBeVisible();
  await page.waitForTimeout(700);
  return sheet;
}

for (const vp of VPS) {
  for (const dark of [false, true]) {
    test(`edit mode ֲ· ${vp.name} ${vp.w}x${vp.h} ֲ· ${dark ? 'dark' : 'light'}: footer on screen, no page scroll, title and side column intact`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'the spec sets its own three viewports');
      const sheet = await openEdit(page, vp, dark);
      const save = sheet.locator('[data-qc-ed-save]');
      const cancel = sheet.locator('[data-ed-cancel]');
      for (const b of [save, cancel, sheet.locator('[data-ed-reset]')]) {
        await expect(b).toBeVisible();
        const box = (await b.boundingBox())!;
        expect(box.y, 'the button starts inside the viewport').toBeGreaterThanOrEqual(0);
        expect(box.y + box.height, 'the button ends inside the viewport').toBeLessThanOrEqual(vp.h + 0.5);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.height, 'the footer label stays on one line').toBeLessThanOrEqual(48);
        expect(box.x + box.width).toBeLessThanOrEqual(vp.w + 0.5);
      }
      const doc = await page.evaluate(() => ({ y: document.documentElement.scrollHeight - document.documentElement.clientHeight, x: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
      expect(doc.y).toBeLessThanOrEqual(1);
      expect(doc.x).toBeLessThanOrEqual(1);
      // the name is not clipped (no ellipsis cut) and the "editing" label is there and inside the panel
      const head = await sheet.locator('h2').evaluate((h) => {
        const hn = h.querySelector('.hn') as HTMLElement;
        const lab = h.querySelector('[data-qc-editing]') as HTMLElement | null;
        const panel = (h.getRootNode() as ShadowRoot).querySelector('[data-qc-panel]')!.getBoundingClientRect();
        const l = lab?.getBoundingClientRect();
        return { clipped: hn.scrollWidth > hn.clientWidth + 1, label: !!lab, labelIn: !!l && l.left >= panel.left - 0.5 && l.right <= panel.right + 0.5 && l.width > 0, text: hn.textContent };
      });
      expect(head.clipped, `title "${head.text}" is clipped`).toBe(false);
      expect(head.label).toBe(true);
      expect(head.labelIn).toBe(true);
      // the side column keeps a real width and sits inside the panel; the section names are visible
      const side = (await sheet.locator('.ed-side').boundingBox())!;
      const panel = (await sheet.locator('[data-qc-panel]').boundingBox())!;
      expect(side.width).toBeGreaterThanOrEqual(Math.min(200, panel.width - 60));
      expect(side.x).toBeGreaterThanOrEqual(panel.x - 0.5);
      expect(side.x + side.width).toBeLessThanOrEqual(panel.x + panel.width + 0.5);
      const names = sheet.locator('.sr .nm');
      expect(await names.count()).toBeGreaterThan(2);
      for (const n of await names.all()) {
        const clipped = await n.evaluate((e) => e.scrollWidth > e.clientWidth + 1);
        expect(clipped, 'a section name is cut off').toBe(false);
        expect((await n.boundingBox())!.width).toBeGreaterThan(20);
      }
      // the list and the side column do not overlap (stacked or side by side)
      const list = (await sheet.locator('.ed-list').boundingBox())!;
      const overlap = list.x < side.x + side.width - 0.5 && side.x < list.x + list.width - 0.5 && list.y < side.y + side.height - 0.5 && side.y < list.y + list.height - 0.5;
      expect(overlap, 'the list and the side column overlap').toBe(false);
      // "show more": the phone lists the first four devices of an expanded section, the rest behind a button
      if (vp.name === 'phone') {
        await sheet.locator('[data-ed-expand="sensors"]').click();
        await expect(sheet.locator('[data-ed-list="sensors"] [data-ed-row]')).toHaveCount(4);
        await expect(sheet.locator('[data-ed-more]')).toBeVisible();
        await sheet.locator('[data-ed-more]').click();
        await expect(sheet.locator('[data-ed-list="sensors"] [data-ed-row]')).toHaveCount(8);
        const box2 = (await save.boundingBox())!;
        expect(box2.y + box2.height).toBeLessThanOrEqual(vp.h + 0.5); // still on screen with a long list (the list scrolls, the footer stays)
      }
      if (SHOTS) {
        fs.mkdirSync(SHOTS, { recursive: true });
        await page.screenshot({ path: path.join(SHOTS, `30-edit-${vp.name}-${dark ? 'dark' : 'light'}.png`) });
      }
    });
  }
}

test('edit mode: reduced motion still opens the editor with the footer on screen (phone)', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the spec sets its own three viewports');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const sheet = await openEdit(page, VPS[0]);
  const box = (await sheet.locator('[data-qc-ed-save]').boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(812.5);
});
