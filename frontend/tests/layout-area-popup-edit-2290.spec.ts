import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { installBubbleMock, AREA_PERMS } from './bubble-mocks';

// AREAEDIT-2290: the area pop-up's edit mode (a manager hides / orders the sections and the devices). Layout contract at the three
// reference viewports: the footer (reset / cancel / save) is ALWAYS inside the viewport, the document never scrolls, the name and the
// "editing" label are not clipped, and the side column (apply-to, the alert switch) keeps a real width.
// Edit mode is only offered with a live API session and system.configure: the specs mock the API (tests/bubble-mocks.ts), no backend.
// The layout tests run in the desktop project only (the spec sets its own viewports); the phone / tablet checks run in every project.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/layout-area-popup-edit-2290.spec.ts --project=desktop
// Screenshots (local only): SW_EDIT_SHOTS=<dir>.

const SHOTS = process.env.SW_EDIT_SHOTS || '';
const VPS = [
  { name: 'phone', w: 375, h: 812 },
  { name: 'tablet', w: 768, h: 1024 },
  { name: 'desktop', w: 1440, h: 900 },
] as const;
// The editor is not offered on a phone (owner 2026-10-30): the layout and 44 px contracts cover the tablet and the desktop.
const EDIT_VPS = VPS.filter((v) => v.name !== 'phone');

async function openArea(page: Page, vp: (typeof VPS)[number]) {
  await installBubbleMock(page, { perms: [...AREA_PERMS, 'system.configure'] });
  await page.setViewportSize({ width: vp.w, height: vp.h });
  await page.goto(`./?design=a&skin=bubble&scheme=light#/devices/building`);
  const row = page.locator('sw-app devices-building').locator('[data-area-row="living"]:visible, a.tile[data-area="living"]:visible').first();
  await row.waitFor({ timeout: 15_000 });
  await row.click();
  const sheet = page.locator('sw-app devices-building area-quick-sheet[open]');
  await expect(sheet.locator('[data-qc-panel]')).toBeVisible();
  await page.waitForTimeout(700); // the spring settles
  return sheet;
}

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

for (const vp of EDIT_VPS) {
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
      if (SHOTS) {
        fs.mkdirSync(SHOTS, { recursive: true });
        await page.screenshot({ path: path.join(SHOTS, `30-edit-${vp.name}-${dark ? 'dark' : 'light'}.png`) });
      }
    });
  }
}

// Touch targets (owner rule: 44 x 44): every control of the editor - the head's buttons, the eye / arrows / chevron of each row, the apply-to
// switch, "show more", the footer keys and the alert switch (measured on its padded host) - reaches 44 px in both directions at all three viewports.
for (const vp of EDIT_VPS) {
  test(`edit mode · ${vp.name} ${vp.w}x${vp.h}: every control is at least 44 x 44`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the spec sets its own three viewports');
    const sheet = await openEdit(page, vp);
    await sheet.locator('[data-ed-expand="sensors"]').click();
    await page.waitForTimeout(300);
    const small = await sheet.evaluate((host) => {
      const root = host.shadowRoot as ShadowRoot;
      const bad: string[] = [];
      for (const e of Array.from(root.querySelectorAll('button, a[href], [role="switch"], sw-toggle, input, select')) as HTMLElement[]) {
        if (e.matches('[role="switch"]') && e.getRootNode() !== root) continue;
        const cs = getComputedStyle(e);
        const b = e.getBoundingClientRect();
        if (cs.display === 'none' || cs.visibility === 'hidden' || !b.width || !b.height) continue;
        if (b.width < 43.5 || b.height < 43.5) bad.push(`${e.tagName.toLowerCase()}${e.className ? '.' + String(e.className).trim().split(/\s+/).join('.') : ''}[${Array.from(e.attributes).map((x) => x.name).filter((n) => n.startsWith('data-')).join(',')}] ${Math.round(b.width)}x${Math.round(b.height)}`);
      }
      return bad;
    });
    expect(small, 'controls under 44 px').toEqual([]);
  });
}

// Phone: no edit entry, edit mode cannot be entered (not by the button, not programmatically), the pop-up still works read-only. Runs in every project.
test('edit mode: phone 375x812 offers no edit entry and refuses programmatic entry; the pop-up stays read-only', async ({ page }) => {
  const sheet = await openArea(page, VPS[0]);
  await expect(sheet).toHaveAttribute('mode', 'sheet');
  await expect(sheet.locator('[data-qc-edit]')).toHaveCount(0);
  await sheet.evaluate((host) => (host as unknown as { startEdit: () => void }).startEdit());
  await page.waitForTimeout(300);
  await expect(sheet.locator('[data-qc-editor]')).toHaveCount(0);
  await expect(sheet).not.toHaveAttribute('data-editing', '');
  await expect(sheet.locator('[data-qc-body]')).toBeVisible();
});

test('edit mode: tablet keeps the edit entry with the drag handle and the arrows', async ({ page }) => {
  const sheet = await openEdit(page, VPS[1]);
  await sheet.locator('[data-ed-expand="sensors"]').click();
  await expect(sheet.locator('[data-ed-list="sensors"] .grip').first()).toBeVisible();
  await expect(sheet.locator('[data-ed-list="sensors"] .mv').first()).toBeVisible();
});
