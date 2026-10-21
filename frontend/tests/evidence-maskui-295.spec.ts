import { test, expect, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { installMask, newMaskMock, writes, type MaskMock } from './privacy-mask-mock';
import { PM_TABLES } from '../src/i18n/privacy-mask';

// MASKUI-295 evidence: Settings > Security > Privacy masks. API mode against a STATEFUL mocked backend (tests/privacy-mask-mock.ts): no device,
// no NVR write, fake scene pictures only. Proves the flow draw -> review (read only) -> confirm dialog -> write -> per-camera result -> undo;
// that a write leaves the browser ONLY by the confirm button (no queue, no retry, no autosave); the disabled states with their plain lines;
// keyboard operation; 44 px targets; light and dark; he / en / ar / ru; a phone and a desktop.
// Run on the Vite dev server (desktop and mobile projects): SW_SHOTS=../docs/design/evidence/MASKUI-295 npx playwright test tests/evidence-maskui-295.spec.ts --workers=2

const SHOTS = process.env.SW_SHOTS ?? '';
const SCREEN = 'sw-app system-security system-security-privacy-masks';
const phone = (page: Page) => (page.viewportSize()?.width ?? 1440) < 768;

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}-${test.info().project.name}.png`) });
}

const q = (page: Page, sel: string): Locator => page.locator(`${SCREEN} ${sel}`);

async function open(page: Page, extra = '', lang?: 'en' | 'ar' | 'ru') {
  await page.goto('about:blank');
  await page.goto(`/?design=a${extra}#/system/security/cameras`);
  await page.waitForSelector('sw-app');
  if (lang) {
    await page.evaluate((l) => {
      document.documentElement.lang = l;
      document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
    }, lang);
  }
  await page.evaluate(() => (window.location.hash = '#/system/security/privacy-masks'));
  await expect(q(page, '[data-pm-screen]')).toHaveAttribute('data-state', 'ready');
  await expect(q(page, '[data-pm-frame]')).toBeVisible();
}

/** Adds a region with the button (works with a finger and a mouse); returns the new region's locator. */
async function addRegion(page: Page): Promise<Locator> {
  const before = await q(page, '[data-pm-region]').count();
  await q(page, '[data-pm-add]').click();
  await expect(q(page, '[data-pm-region]')).toHaveCount(before + 1);
  return q(page, '[data-pm-region]').last();
}

const rectOf = async (el: Locator) => (await el.getAttribute('data-pm-rect')) ?? '';

test.describe('MASKUI-295 privacy-mask editor (mocked backend, no device)', () => {
  let st: MaskMock;

  test.beforeEach(async ({ page }) => {
    st = newMaskMock();
    await installMask(page, st);
  });

  test('opens in Settings > Security: cameras, the picture, the NVR mask drawn over it, 44 px targets, no hint paragraph, no ticket action', async ({ page }) => {
    await open(page);
    await expect(page.locator('sw-app system-security [data-security-settings-tabs] sw-tabs a').last()).toHaveText('מסכות פרטיות');
    await expect(q(page, '[data-pm-camera]')).toHaveCount(3);
    await expect(q(page, '[data-pm-camera="cam-1"]')).toHaveAttribute('aria-current', 'true');
    await expect(q(page, '[data-pm-region]')).toHaveCount(1);
    await expect(q(page, '[data-pm-rect]')).toHaveAttribute('data-pm-rect', '36,30,150,110');
    await expect(q(page, '[data-pm-count]')).toHaveText('1 מתוך 4 אזורים');
    await expect(q(page, '[data-pm-lock]')).toHaveCount(0);
    // the mask is really drawn: an SVG polygon (not an unknown HTML element) with a visible fill
    expect(await q(page, '[data-pm-frame] svg polygon').first().evaluate((e) => e instanceof SVGPolygonElement && getComputedStyle(e).fill !== 'none')).toBe(true);
    await expect(q(page, '[data-pm-review]')).toHaveAttribute('disabled', ''); // nothing edited
    // 44 px (phone): the camera rows, the buttons, the region rows, the switch and (after a press) the corner handles
    const boxes = [q(page, '[data-pm-camera]').first(), q(page, '[data-pm-enabled]'), q(page, '[data-pm-add]'), q(page, '[data-pm-pick]').first(), q(page, '[data-pm-remove]').first(), q(page, '[data-pm-review]')];
    if (phone(page)) for (const b of boxes) expect((await b.boundingBox())!.height, 'height').toBeGreaterThanOrEqual(43.5); // owner: 44 px on the phone only
    await q(page, '[data-pm-region]').first().focus();
    await expect(q(page, '[data-pm-handle]')).toHaveCount(4);
    for (const h of await q(page, '[data-pm-handle]').all()) {
      const b = (await h.boundingBox())!;
      expect(Math.min(b.width, b.height)).toBeGreaterThanOrEqual(43.5);
    }
    // the picture and its regions are never mirrored: LTR in every language
    expect(await q(page, '[data-pm-frame]').evaluate((e) => getComputedStyle(e).direction)).toBe('ltr');
    // clean screen: no paragraph of hints, no ticket / service-request action, no platform name
    const text = (await q(page, '[data-pm-screen]').innerText()).toLowerCase();
    expect(text).not.toMatch(/ticket|home assistant|ingress|קריאת שירות/);
    await expect(q(page, 'a[href*="tickets"], [data-ticket-action]')).toHaveCount(0);
    expect(st.hits.filter((h) => h.startsWith('POST'))).toEqual([]);
    await shot(page, '01-ready-light');
  });

  test('draw with the mouse (desktop) or the add button, move, resize and delete; the screen is only edited: nothing is sent', async ({ page }) => {
    await open(page);
    const frame = q(page, '[data-pm-frame]');
    if (!phone(page)) {
      const b = (await frame.boundingBox())!;
      await page.mouse.move(b.x + b.width * 0.55, b.y + b.height * 0.55);
      await page.mouse.down();
      await page.mouse.move(b.x + b.width * 0.7, b.y + b.height * 0.8, { steps: 6 });
      await expect(q(page, '.ghost')).toBeVisible();
      await page.mouse.up();
      await expect(q(page, '[data-pm-region]')).toHaveCount(2);
    } else {
      await addRegion(page);
    }
    await expect(q(page, '[data-pm-camera="cam-1"] [data-pm-edited]')).toHaveCount(1);
    await expect(q(page, '[data-pm-review]')).not.toHaveAttribute('disabled');
    await expect(q(page, '[data-pm-review]')).toContainText('(1)');
    const second = q(page, '[data-pm-region]').last();
    const r0 = await rectOf(second);
    // drag the body and a corner
    const bb = (await second.boundingBox())!;
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await page.mouse.down();
    await page.mouse.move(bb.x + bb.width / 2 - 30, bb.y + bb.height / 2 - 20, { steps: 4 });
    await page.mouse.up();
    expect(await rectOf(second)).not.toBe(r0);
    const handle = q(page, '[data-pm-handle="br"]');
    const hb = (await handle.boundingBox())!;
    const r1 = await rectOf(second);
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + hb.width / 2 + 25, hb.y + hb.height / 2 + 15, { steps: 4 });
    await page.mouse.up();
    expect(await rectOf(second)).not.toBe(r1);
    await shot(page, '02-edited-light');
    // delete it with the row button; discard brings back the NVR's own mask
    await q(page, '[data-pm-remove]').last().click();
    await expect(q(page, '[data-pm-region]')).toHaveCount(1);
    await expect(q(page, '[data-pm-camera="cam-1"] [data-pm-edited]')).toHaveCount(0); // back to the NVR's state = not edited
    await expect(q(page, '[data-pm-review]')).toHaveAttribute('disabled', '');
    await addRegion(page);
    await q(page, '[data-pm-discard]').click();
    await expect(q(page, '[data-pm-region]')).toHaveCount(1);
    expect(st.hits.filter((h) => h.startsWith('POST'))).toEqual([]);
  });

  test('keyboard only: arrows move, Shift+arrows resize, Delete removes; Tab reaches the review button; nothing is sent', async ({ page }) => {
    await open(page);
    const reg = q(page, '[data-pm-region]').first();
    await reg.focus();
    await expect(reg).toHaveAttribute('aria-label', 'אזור 1');
    await expect(reg).toHaveAttribute('aria-describedby', 'pm-keys');
    await page.keyboard.press('ArrowRight');
    await expect(reg).toHaveAttribute('data-pm-rect', '43,30,150,110');
    await page.keyboard.press('ArrowDown');
    await expect(reg).toHaveAttribute('data-pm-rect', '43,36,150,110');
    await page.keyboard.press('Shift+ArrowRight');
    await expect(reg).toHaveAttribute('data-pm-rect', '43,36,157,110');
    await page.keyboard.press('Shift+ArrowUp');
    await expect(reg).toHaveAttribute('data-pm-rect', '43,36,157,104');
    await page.keyboard.press('Control+ArrowLeft');
    await expect(reg).toHaveAttribute('data-pm-rect', '0,36,157,104'); // ten percent step, clamped at the frame edge
    await expect(q(page, '[data-pm-review]')).not.toHaveAttribute('disabled');
    // the review button is reachable by Tab from the region
    let reached = false;
    for (let i = 0; i < 12 && !reached; i++) {
      await page.keyboard.press('Tab');
      reached = await q(page, '[data-pm-review] button').evaluate((e) => e === (e.getRootNode() as ShadowRoot).activeElement);
    }
    expect(reached).toBe(true);
    await reg.focus();
    await page.keyboard.press('Delete');
    await expect(q(page, '[data-pm-region]')).toHaveCount(0);
    await expect(q(page, '[data-pm-invalid]')).toBeVisible(); // an active mask with no region cannot be reviewed
    await expect(q(page, '[data-pm-review]')).toHaveAttribute('disabled', '');
    await expect(q(page, '[data-pm-add] button')).toBeFocused(); // focus moved to a live control
    expect(st.hits.filter((h) => h.startsWith('POST'))).toEqual([]);
  });

  test('review is read only; the write leaves ONLY by the confirm button; the result and the undo', async ({ page }) => {
    await open(page);
    const added = await addRegion(page);
    await added.focus();
    await page.keyboard.press('ArrowRight');
    // a second camera is edited too: the confirmation names both
    await q(page, '[data-pm-camera="cam-2"]').click();
    await expect(q(page, '[data-pm-frame]')).toBeVisible();
    await addRegion(page);
    await q(page, '[data-pm-camera="cam-1"]').click();
    await expect(q(page, '[data-pm-review]')).toContainText('(2)');
    await shot(page, '03-two-cameras-edited-light');

    await q(page, '[data-pm-review]').click();
    await expect(q(page, '[data-pm-review-step]')).toBeVisible();
    expect(st.previews).toHaveLength(1);
    expect(st.applies).toHaveLength(0);
    await expect(q(page, '[data-pm-preview]')).toHaveCount(2);
    await expect(q(page, '[data-pm-preview="cam-1"] [data-pm-status]')).toHaveText('ייכתב');
    await expect(q(page, '[data-pm-preview="cam-1"] .thumb')).toHaveCount(2); // before and after
    await shot(page, '04-review-light');

    // continue opens the dialog; cancel sends nothing
    await q(page, '[data-pm-next]').click();
    const dlg = page.locator(`${SCREEN} sw-dialog[open][data-pm-confirm-dialog]`);
    await expect(dlg).toHaveCount(1); // the host has no box of its own (fixed children): the buttons are what shows
    await expect(page.locator(`${SCREEN} [data-pm-confirm]`)).toBeVisible();
    await expect(page.locator(`${SCREEN} [data-pm-confirm-camera]`)).toHaveText(['כניסה ראשית', 'חצר אחורית']);
    await expect(page.locator(`${SCREEN} [data-pm-confirm-count]`)).toHaveText('2 מצלמות ייכתבו');
    await shot(page, '05-confirm-light');
    await page.locator(`${SCREEN} [data-pm-cancel]`).click();
    await expect(dlg).toHaveCount(0);
    expect(st.applies).toHaveLength(0);
    expect(writes(st)).toEqual([]);

    // the one deliberate press
    await q(page, '[data-pm-next]').click();
    await page.locator(`${SCREEN} [data-pm-confirm]`).click();
    await expect(q(page, '[data-pm-done-step]')).toBeVisible();
    expect(st.applies).toHaveLength(1);
    expect(st.applies[0].confirm).toBe(true);
    expect(st.applies[0].items.map((i: { camera_id: string; etag: string }) => i.camera_id)).toEqual(['cam-1', 'cam-2']);
    expect(st.applies[0].items.every((i: { etag: string }) => !!i.etag)).toBe(true);
    await expect(q(page, '[data-pm-result="cam-1"]')).toContainText('נכתב ואומת');
    await expect(q(page, '[data-pm-result="cam-2"]')).toContainText('נכתב ואומת');
    expect(st.masks['cam-1'].regions).toHaveLength(2);
    expect(st.masks['cam-2'].regions).toHaveLength(1);
    await shot(page, '06-results-light');

    // undo of the first camera: one press, one request
    const id = st.changes.find((c) => c.camera_id === 'cam-1')!.id;
    await q(page, `[data-pm-undo="${id}"]`).click();
    await expect(q(page, '[data-pm-result="cam-1"]')).toContainText('הוחזר למצב הקודם');
    expect(st.rollbacks).toEqual([id]);
    expect(st.masks['cam-1'].regions).toHaveLength(1);
    expect(st.applies).toHaveLength(1); // the apply was never repeated
    await q(page, '[data-pm-finish]').click();
    await expect(q(page, '[data-pm-step]')).toHaveAttribute('data-pm-step', 'edit');
    await expect(q(page, '[data-pm-camera] [data-pm-edited]')).toHaveCount(0);
  });

  test('the change history offers the undo on the newest write; changed-since is a plain line', async ({ page }) => {
    await open(page);
    await addRegion(page);
    await q(page, '[data-pm-review]').click();
    await q(page, '[data-pm-next]').click();
    await page.locator(`${SCREEN} [data-pm-confirm]`).click();
    await expect(q(page, '[data-pm-done-step]')).toBeVisible();
    await q(page, '[data-pm-finish]').click();
    await expect(q(page, '[data-pm-change]')).toHaveCount(1);
    await expect(q(page, '[data-pm-history] [data-pm-undo]')).toBeVisible();
    await shot(page, '07-history-light');
    // somebody changes the mask on the NVR meanwhile: the server refuses the undo and the screen says so, once
    st.masks['cam-1'].etag = 'moved-elsewhere';
    await q(page, '[data-pm-history] [data-pm-undo]').click();
    await expect(q(page, '[data-pm-line]')).toHaveText('המסכה במצלמה שונתה מאז, ולכן אין החזרה אוטומטית.');
    expect(st.rollbacks).toHaveLength(1);
  });

  test('a camera that changed on the NVR is skipped (stale) and a failed write stops the rest; neither is repeated', async ({ page }) => {
    await open(page);
    await addRegion(page);
    await q(page, '[data-pm-camera="cam-2"]').click();
    await addRegion(page);
    await q(page, '[data-pm-camera="cam-3"]').click();
    await expect(q(page, '[data-pm-region]')).toHaveCount(2);
    await q(page, '[data-pm-remove]').first().click();
    await q(page, '[data-pm-review]').click();
    await expect(q(page, '[data-pm-preview]')).toHaveCount(3);
    st.mode['cam-1'] = 'stale';
    st.mode['cam-2'] = 'fail';
    await q(page, '[data-pm-next]').click();
    await page.locator(`${SCREEN} [data-pm-confirm]`).click();
    await expect(q(page, '[data-pm-done-step]')).toBeVisible();
    expect(st.applies).toHaveLength(1);
    await expect(q(page, '[data-pm-result="cam-1"]')).toContainText('לא נכתב');
    await expect(q(page, '[data-pm-result="cam-2"]')).toContainText('הכתיבה נכשלה');
    await expect(q(page, '[data-pm-result="cam-2"]')).toContainText('המקור הוחזר');
    await expect(q(page, '[data-pm-result="cam-3"]')).toContainText('לא נוסה');
    await expect(q(page, '[data-pm-result="cam-2"] [data-pm-undo]')).toHaveCount(0);
    await shot(page, '08-partial-light');
    // the unwritten cameras keep their drafts for another, deliberate round
    await q(page, '[data-pm-finish]').click();
    await expect(q(page, '[data-pm-camera] [data-pm-edited]')).toHaveCount(3);
    expect(st.applies).toHaveLength(1);
  });

  test('a dropped connection on the write shows one line and is NOT retried', async ({ page }) => {
    await open(page);
    await addRegion(page);
    st.mode['cam-1'] = 'abort';
    await q(page, '[data-pm-review]').click();
    await q(page, '[data-pm-next]').click();
    await page.locator(`${SCREEN} [data-pm-confirm]`).click();
    await expect(q(page, '[data-pm-line]')).toBeVisible();
    await page.waitForTimeout(1500);
    expect(st.applies).toHaveLength(1); // no automatic second attempt
    await expect(q(page, '[data-pm-step]')).toHaveAttribute('data-pm-step', 'edit');
    await expect(q(page, '[data-pm-camera="cam-1"] [data-pm-edited]')).toHaveCount(1); // the draft is kept, nothing was marked written
  });

  test('switch off: a plain line, the controls are disabled, nothing can be reviewed or written', async ({ page }) => {
    st.switchOn = false;
    await open(page);
    await expect(q(page, '[data-pm-lock="off_switch"]')).toHaveText(PM_TABLES.he.off_switch);
    await expect(q(page, '[data-pm-add]')).toHaveAttribute('disabled', '');
    await expect(q(page, '[data-pm-enabled]')).toHaveAttribute('disabled', '');
    await expect(q(page, '[data-pm-remove]').first()).toHaveAttribute('disabled', '');
    await expect(q(page, '[data-pm-review]')).toHaveAttribute('disabled', '');
    await expect(q(page, '[data-pm-region]')).toHaveCount(1); // the NVR's mask is still shown
    await expect(q(page, '[data-pm-region]').first()).toHaveAttribute('tabindex', '-1');
    if (!phone(page)) {
      const b = (await q(page, '[data-pm-frame]').boundingBox())!;
      await page.mouse.move(b.x + b.width * 0.6, b.y + b.height * 0.6);
      await page.mouse.down();
      await page.mouse.move(b.x + b.width * 0.8, b.y + b.height * 0.9, { steps: 4 });
      await page.mouse.up();
    }
    await expect(q(page, '[data-pm-region]')).toHaveCount(1);
    await shot(page, '09-switch-off-light');
    expect(st.hits.filter((h) => h.startsWith('POST'))).toEqual([]);
  });

  test('no permission: a plain line and view only', async ({ page }) => {
    st = newMaskMock({ canWrite: false });
    await page.unroute('**/api/v1/**');
    await installMask(page, st);
    await open(page);
    await expect(q(page, '[data-pm-lock="off_perm"]')).toHaveText(PM_TABLES.he.off_perm);
    await expect(q(page, '[data-pm-add]')).toHaveAttribute('disabled', '');
    await expect(q(page, '[data-pm-review]')).toHaveAttribute('disabled', '');
    await shot(page, '10-no-permission-light');
  });

  test('a mask that cannot be read and a camera without a picture are states of their own', async ({ page }) => {
    st.readDown = ['cam-3'];
    st.noPicture = ['cam-1'];
    await open(page);
    await expect(q(page, '.nopic')).toBeVisible();
    await expect(q(page, '[data-pm-add]')).not.toHaveAttribute('disabled'); // editing over a blank frame still works
    await q(page, '[data-pm-camera="cam-3"]').click();
    await expect(q(page, '[data-pm-mask-error]')).toBeVisible();
    await shot(page, '11-states-light');
  });

  test('dark', async ({ page }) => {
    await open(page, '&scheme=dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await addRegion(page);
    await shot(page, '12-edit-dark');
    await q(page, '[data-pm-review]').click();
    await expect(q(page, '[data-pm-review-step]')).toBeVisible();
    await shot(page, '13-review-dark');
    await q(page, '[data-pm-next]').click();
    await expect(page.locator(`${SCREEN} [data-pm-confirm]`)).toBeVisible();
    await shot(page, '14-confirm-dark');
    await page.locator(`${SCREEN} [data-pm-confirm]`).click();
    await expect(q(page, '[data-pm-done-step]')).toBeVisible();
    await shot(page, '15-results-dark');
  });

  for (const lang of ['en', 'ar', 'ru'] as const) {
    test(`language ${lang}: the words, the direction, and the picture is not mirrored`, async ({ page }) => {
      await open(page, '', lang);
      await expect(q(page, 'sw-page')).toHaveAttribute('heading', PM_TABLES[lang].heading);
      await expect(q(page, '[data-pm-count]')).toHaveText(PM_TABLES[lang].regions_count.replace('{n}', '1').replace('{max}', '4'));
      await expect(q(page, '[data-pm-add]')).toContainText(PM_TABLES[lang].add_region);
      expect(await q(page, '[data-pm-frame]').evaluate((e) => getComputedStyle(e).direction)).toBe('ltr');
      // the region is where the NVR holds it in every language: 36/704 from the left edge of the picture
      const f = (await q(page, '[data-pm-frame]').boundingBox())!;
      const r = (await q(page, '[data-pm-region]').first().boundingBox())!;
      expect((r.x - f.x) / f.width).toBeCloseTo(36 / 704, 2);
      await addRegion(page);
      await q(page, '[data-pm-review]').click();
      await expect(q(page, '[data-pm-review-step]')).toBeVisible();
      await q(page, '[data-pm-next]').click();
      await expect(page.locator(`${SCREEN} sw-dialog[open] [data-pm-confirm-count]`)).toHaveText(PM_TABLES[lang].confirm_count_one);
      await shot(page, `16-${lang}-confirm-light`);
      await page.locator(`${SCREEN} [data-pm-cancel]`).click();
      await page.locator(`${SCREEN} [data-pm-back]`).click();
      await shot(page, `17-${lang}-edit-light`);
      expect(st.applies).toHaveLength(0);
    });
  }
});
