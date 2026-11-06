import { test, expect, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inPageCheck, summarize, type Finding } from './layout-guard';
import { ADMIN, installFrigate, newControlMock, newFrigateMock, type FrigateMock } from './frigate-mocks';
import { isFoundation, PICKER_SKINS } from './helpers/frozen-skins';

// FRIGATE-F2B-2405: the F2b operator screens (CR-029 section 11 server, section 12 FRGD screens, shipped since 2.4.0 / first tag v2.7.2)
// walked in EVERY selectable skin, light and dark, on the three projects (desktop 1440, tablet 1024, phone 390). The FRGD evidence
// (evidence-frigate-ui.spec.ts) guards the review screen in every skin but the management card only in classic light + one dark pass,
// and its per-skin shots were taken in bubble, frozen since 2026-10-26. This spec closes that gap; it changes no screen.
//
// Per skin and scheme: the management card's F2b tabs (profiles with the automatic profile, exports, cases, manual events, supervision)
// and the classes tab (PTZ stays out while the server says ptz_released: false), the export create dialog with the supervision box,
// the typed-name delete dialog (a protected action: the button waits for the exact name), and the review drawer's export dialog.
// Each state: no page error, no sideways overflow of the page, the layout guard (escape / overflow / clipped) over the card or the
// dialog, no platform name. Foundation skins (infra, soft: not yet in the per-skin matrix, SKINFOUND-297) are walked the same way;
// their guard findings are recorded as annotations instead of failing (the skin's own stage, not this screen's).
// Against the MOCKED backend of frigate-mocks.ts; nothing is written anywhere; every name is made up.
// SW_SHOTS=1 writes element shots to docs/design/evidence/frigate-f2b-2405 (classic: every state; the other skins: the exports tab).

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/frigate-f2b-2405');
const ALL_PERMS = [...ADMIN, 'analytics.control', 'analytics.record_control', 'analytics.profile', 'analytics.events', 'analytics.exports', 'analytics.cases', 'video.export'];
const ALL_ON = { analytics: true, record: true, profile: true, review: true, events: true, ptz: false, exports: true, cases: true };
const AUTO = {
  mode: 'suggest' as const, consent: true, consent_at: '2026-10-06T20:00:00Z',
  items: [{ id: 'au1', alarm_state: 'armed_away', profile: 'away', mode: 'suggest', status: 'suggested', reason: null, change_id: null, at: '2026-10-07T06:00:00Z', processed_at: null }],
};
const SCHEMES = ['light', 'dark'] as const;
const PLATFORM = /Home Assistant|Ingress|\bHA\b/;

async function shot(page: Page, target: Locator | null, name: string) {
  if (!process.env.SW_SHOTS) return;
  fs.mkdirSync(OUT, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  const file = path.join(OUT, `${name}-${test.info().project.name}.png`);
  if (target) await target.screenshot({ path: file, animations: 'disabled', caret: 'hide' });
  else await page.screenshot({ path: file, animations: 'disabled', caret: 'hide' });
}

/** One look at a state: the page did not overflow sideways, the guard found nothing inside `within`, no platform name. */
async function look(page: Page, ctx: string, within: string, found: Finding[], text?: Locator) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(120);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (over > 0) found.push({ cls: 'overflow', el: 'html', detail: `page scrolls sideways by ${over}px`, ctx });
  const f = await page.evaluate(inPageCheck, { ctx, within, bubble: '.card, .chip, .row, .tbl', skip: '.skl, sw-icon, svg, img' });
  // the same filter as the FRGD guard: touch-target size and floating are reported by the touch / a11y specs, not here
  found.push(...f.filter((x) => x.cls !== 'target' && x.cls !== 'floating'));
  if (text) expect(await text.innerText(), `${ctx}: no platform name`).not.toMatch(PLATFORM);
}

async function openSetup(page: Page, skin: string, scheme: string): Promise<{ m: FrigateMock; box: Locator }> {
  const m = newFrigateMock({
    perms: ALL_PERMS,
    ctl: newControlMock({ classes: { ...ALL_ON }, auto: AUTO, firstWrites: { export_rename: true, case_create: true, case_rename: true, case_delete: true, event_create: true, event_end: true } }),
  });
  await installFrigate(page, m);
  await page.goto('about:blank');
  await page.goto(`/?design=a&skin=${skin}&scheme=${scheme}#/system/setup`);
  await page.waitForSelector('sw-app');
  expect(await page.evaluate(() => document.documentElement.getAttribute('data-skin')), 'the requested skin is the one drawn').toBe(skin);
  await page.locator('nvr-recorders-card [data-recorder="nvr-2"] [data-recorder-connection]').click();
  const box = page.locator('nvr-recorders-card [data-frigate-control-settings]');
  await expect(box).toBeVisible();
  return { m, box };
}

const tab = (box: Locator, name: string) => box.locator('[data-fcs-tabs]').getByRole('tab', { name });

for (const skin of PICKER_SKINS) {
  test.describe(`F2b screens in ${skin}`, () => {
    test(`${skin}: the management card's F2b tabs and their protected dialogs, light and dark`, async ({ page }) => {
      test.setTimeout(180_000);
      const errors: string[] = [];
      page.on('pageerror', (e) => { if (!page.url().startsWith('about:')) errors.push(e.message); });
      const found: Finding[] = [];
      const CARD = '[data-frigate-control-settings]';
      const shotAll = skin === 'classic';
      for (const scheme of SCHEMES) {
        const { box } = await openSetup(page, skin, scheme);
        const ctx = (s: string) => `${skin} ${scheme} ${s}`;
        // classes: exports and cases are listed; PTZ is not offered while the server has not released it
        await expect(box.locator('[data-fcs-class="exports"]')).toBeVisible();
        await expect(box.locator('[data-fcs-class="cases"]')).toBeVisible();
        await expect(box.locator('[data-fcs-class="ptz"]')).toHaveCount(0);
        await look(page, ctx('classes'), CARD, found, box);
        if (shotAll) await shot(page, box, `classes-${skin}-${scheme}`);
        // profiles: the automatic profile with its open suggestion
        await tab(box, 'פרופילים').click();
        await expect(box.locator('[data-frigate-auto] [data-auto-item="au1"]')).toBeVisible();
        await look(page, ctx('profiles'), CARD, found, box);
        if (shotAll) await shot(page, box, `profiles-${skin}-${scheme}`);
        // exports: Frigate's and Arx's rows; rename / delete only on Arx's
        await tab(box, 'ייצואים').click();
        const fx = box.locator('[data-frigate-exports]');
        await expect(fx.locator('[data-fx-row]')).toHaveCount(2);
        await expect(fx.locator('[data-fx-row="exp-fr-1"] [data-fx-delete-btn]')).toHaveCount(0);
        await look(page, ctx('exports'), CARD, found, box);
        await shot(page, box, `exports-${skin}-${scheme}`);
        // the create dialog: the first export of this recorder carries the supervision box and waits for it
        await fx.locator('[data-fx-new]').click();
        const create = page.locator('[data-fx-create]');
        await expect(create.locator('[data-fx-name]')).toBeVisible();
        await expect(create.locator('[data-supervised-box="export_create"]')).toBeVisible();
        await create.locator('[data-fx-name]').fill('בדיקת שער');
        await expect(create.locator('[data-fx-create-ok]')).toHaveAttribute('disabled', '');
        await look(page, ctx('export create dialog'), '[data-fx-create]', found);
        if (shotAll) await shot(page, null, `export-create-${skin}-${scheme}`);
        await page.keyboard.press('Escape');
        await expect(create.locator('[data-fx-name]')).toHaveCount(0);
        // the typed-name delete: a protected action, the button waits for the exact name
        await fx.locator('[data-fx-row="exp-arx-1"] [data-fx-delete-btn]').click();
        const del = page.locator('[data-fx-delete]');
        await expect(del.locator('[data-fx-delete-ok]')).toHaveAttribute('disabled', '');
        await del.locator('[data-fx-delete-typed]').fill('לא השם');
        await expect(del.locator('[data-fx-delete-ok]')).toHaveAttribute('disabled', '');
        await look(page, ctx('export delete dialog'), '[data-fx-delete]', found);
        if (shotAll) await shot(page, null, `export-delete-${skin}-${scheme}`);
        await page.keyboard.press('Escape');
        await expect(del.locator('[data-fx-delete-typed]')).toHaveCount(0);
        // cases
        await tab(box, 'תיקים').click();
        await expect(box.locator('[data-frigate-cases] [data-fc-row]')).toHaveCount(2);
        await look(page, ctx('cases'), CARD, found, box);
        if (shotAll) await shot(page, box, `cases-${skin}-${scheme}`);
        // manual events: the form on one camera, nothing open yet
        await tab(box, 'אירועים ידניים').click();
        await expect(box.locator('[data-frigate-events] [data-fe-empty]')).toBeVisible();
        await box.locator('[data-frigate-events] [data-fe-label]').fill('בדיקת מערכת');
        await look(page, ctx('manual events'), CARD, found, box);
        if (shotAll) await shot(page, box, `events-${skin}-${scheme}`);
        // supervision: every supervised kind with its state and the clip read
        await tab(box, 'פיקוח').click();
        await expect(box.locator('[data-frigate-supervision] [data-fs-kind]').first()).toBeVisible();
        await expect(box.locator('[data-frigate-supervision] [data-fs-open]')).toHaveAttribute('disabled', '');
        await look(page, ctx('supervision'), CARD, found, box);
        if (shotAll) await shot(page, box, `supervision-${skin}-${scheme}`);
      }
      expect(errors, 'page errors').toEqual([]);
      settle(skin, found);
    });

    test(`${skin}: the review drawer's export dialog (supervised first export), light and dark`, async ({ page }) => {
      test.setTimeout(120_000);
      const errors: string[] = [];
      page.on('pageerror', (e) => { if (!page.url().startsWith('about:')) errors.push(e.message); });
      const found: Finding[] = [];
      const m = newFrigateMock({ perms: ALL_PERMS, ctl: newControlMock({ classes: { ...ALL_ON } }) });
      await installFrigate(page, m);
      for (const scheme of SCHEMES) {
        await page.goto('about:blank');
        await page.goto(`/?design=a&skin=${skin}&scheme=${scheme}#/investigate/reviews`);
        await page.waitForSelector('investigate-reviews frigate-review-card');
        await page.locator('investigate-reviews frigate-review-card').nth(1).locator('[data-review-open]').click();
        const drawer = page.locator('investigate-reviews [data-review-drawer]');
        await expect(drawer.locator('[data-review-detail="rv-2"]')).toBeVisible();
        await drawer.locator('[data-review-export]').click();
        const dlg = page.locator('[data-review-export-dialog]');
        await expect(dlg.locator('[data-review-export-name]')).toBeVisible();
        await expect(dlg.locator('[data-review-export-supervised]')).toBeVisible();
        await expect(dlg.locator('[data-review-export-ok]')).toHaveAttribute('disabled', '');
        await look(page, `${skin} ${scheme} review export dialog`, '[data-review-export-dialog]', found);
        if (skin === 'classic') await shot(page, null, `review-export-${skin}-${scheme}`);
        await page.keyboard.press('Escape');
      }
      expect(m.ctl.writes.filter((w) => w.includes('/exports')), 'nothing was exported: the dialog was only looked at').toEqual([]);
      expect(errors, 'page errors').toEqual([]);
      settle(skin, found);
    });
  });
}

/** Skins under test fail on any finding; foundation skins record them (SKINFOUND-297: not yet in the per-skin layout matrix). */
function settle(skin: string, found: Finding[]) {
  const { lines } = summarize(found as never);
  if (isFoundation(skin)) {
    for (const l of lines) test.info().annotations.push({ type: 'foundation-skin-finding', description: l });
    return;
  }
  expect(lines, 'layout findings').toEqual([]);
}
