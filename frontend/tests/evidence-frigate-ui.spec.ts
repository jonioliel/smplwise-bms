import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inPageCheck, summarize } from './layout-guard';
import { ADMIN, installFrigate, newControlMock, newFrigateMock, openApp, type FrigateControlMock, type FrigateMock } from './frigate-mocks';

// FRGD (owner 2026-10-07): the Frigate user interface, polished and completed - the restyled review screen (cards AND a table view, the
// state chips, the keys behind one help button, the drawer with "ייצוא הקטע"), and Settings > the Frigate recorder as one tabbed
// management card: write classes (with exports / cases), profiles (the alarm mapping + the automatic profile), exports, cases, manual
// events, the change log with undo, and the supervision view (first supervised writes, the supervised clip read). Against a MOCKED
// backend (page.route on api/v1; the routes of routers/frigate*.py), three projects, light and dark. SW_SHOTS=1 writes evidence
// screenshots to docs/design/evidence/frgd. Every name is made up: no real host, frame or credential.
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/frgd');
const SCREEN = 'investigate-reviews';
const ALL_PERMS = [...ADMIN, 'analytics.control', 'analytics.record_control', 'analytics.profile', 'analytics.events', 'analytics.exports', 'analytics.cases', 'video.export'];
const ALL_ON = { analytics: true, record: true, profile: true, review: true, events: true, ptz: false, exports: true, cases: true };
const ALL_OFF = { analytics: false, record: false, profile: false, review: false, events: false, ptz: false, exports: false, cases: false };
const cards = (page: Page) => page.locator(`${SCREEN} frigate-review-card`);
const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
const writes = (m: FrigateMock, needle: string) => m.ctl.writes.filter((w) => w.includes(needle));

async function shot(page: Page, name: string, scheme = '') {
  if (!process.env.SW_SHOTS) return;
  fs.mkdirSync(OUT, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(OUT, `${name}${scheme ? `-${scheme}` : ''}-${test.info().project.name}.png`), fullPage: name.startsWith('settings') });
}

async function start(page: Page, hash: string, over: Partial<FrigateMock> = {}, ctl: Partial<FrigateControlMock> = {}, query = ''): Promise<FrigateMock> {
  const m = newFrigateMock({ perms: ALL_PERMS, ctl: newControlMock({ classes: { ...ALL_ON }, ...ctl }), ...over });
  await installFrigate(page, m);
  await openApp(page, hash, query);
  return m;
}

// ------------------------------------------------------------------------------------------------ the review screen

test.describe('review: the restyled screen', () => {
  test('cards: the still carries camera, time, layer and state; no hints or paragraphs on the screen; the state chips are short; light and dark', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await start(page, '/investigate/reviews');
    await expect(cards(page)).toHaveCount(4);
    const first = cards(page).first();
    await expect(first).toHaveAttribute('variant', 'card');
    await expect(first.locator('.over .cam')).toHaveText('כניסה ראשית');
    await expect(first.locator('.layer')).toContainText('התראה');
    await expect(first.locator('[data-review-state]')).toHaveAttribute('data-review-state', 'new');
    await expect(first.locator('[data-review-zones]')).toHaveText('מדרגות כניסה');
    // clean operator screen: no subtitle paragraph, no shortcuts line, the partial-coverage notice is one chip
    await expect(page.locator(`${SCREEN} sw-page`)).toHaveAttribute('subheading', '');
    await expect(page.locator(`${SCREEN} .keys`)).toHaveCount(0);
    await expect(page.locator(`${SCREEN} [data-review-partial]`)).toHaveText('הקלטה על תנועה בלבד: כיסוי חלקי');
    const text = await page.locator(`${SCREEN} [data-review-screen]`).innerText();
    expect(text).not.toMatch(/Home Assistant|Ingress|\bHA\b/);
    expect(text).not.toContain('חצים או J/K');
    await noOverflow(page);
    await shot(page, 'review-cards', 'light');
    // the keys live behind one help button
    await page.locator(`${SCREEN} [data-review-keys]`).click();
    await expect(page.locator(`${SCREEN} [data-review-keys-dialog] kbd`).first()).toBeVisible(); // the sw-dialog host has no box of its own
    await expect(page.locator(`${SCREEN} [data-review-keys-dialog] dd`)).toHaveCount(8); // FRG-polish: + Home / End, + the drawer's J / K
    await shot(page, 'review-keys');
    await page.keyboard.press('Escape');
    await expect(page.locator(`${SCREEN} [data-review-keys-dialog]`)).toHaveCount(0);
    // dark
    await page.goto('about:blank');
    await openApp(page, '/investigate/reviews', '&scheme=dark');
    await expect(cards(page)).toHaveCount(4);
    await noOverflow(page);
    await shot(page, 'review-cards', 'dark');
    expect(errors).toEqual([]);
  });

  test('table view: the same items as rows with the facts in columns; the choice is remembered; selection, marking and opening work from a row', async ({ page }) => {
    const m = await start(page, '/investigate/reviews');
    await expect(cards(page)).toHaveCount(4);
    await page.locator(`${SCREEN} [data-review-view-table]`).click();
    const tbl = page.locator(`${SCREEN} [data-review-table]`);
    await expect(tbl).toBeVisible();
    await expect(cards(page)).toHaveCount(4);
    await expect(cards(page).first()).toHaveAttribute('variant', 'row');
    await expect(cards(page).first().locator('.cell.cam b')).toHaveText('כניסה ראשית');
    await expect(cards(page).first().locator('[data-obj="person"]')).toHaveText('אדם');
    if (test.info().project.name === 'mobile') await expect(tbl.locator('.h')).toBeHidden(); // under 900 px the table folds: no header, two text lines per row
    else await expect(tbl.locator('.h')).toBeVisible();
    await noOverflow(page);
    await shot(page, 'review-table', 'light');
    // a row marks and selects like a card
    await cards(page).first().locator('[data-review-toggle]').click();
    await expect.poll(() => m.marks.length).toBe(1);
    await expect(cards(page).first().locator('[data-review-state]')).toHaveAttribute('data-review-state', 'reviewed');
    await cards(page).nth(1).locator('[data-review-select]').check();
    await expect(page.locator(`${SCREEN} [data-review-bulk]`)).toContainText('1 נבחרו');
    await expect(cards(page).nth(1).locator('[data-review-select]')).toBeFocused(); // FRG-polish: a click keeps its focus (the ring follows, the focus is not taken)
    await expect(cards(page).nth(1)).toHaveAttribute('focused', '');
    // the row's open control points forward in the reading direction (Hebrew: left), the selection bar sits at the reading start
    await expect(cards(page).nth(1).locator('[data-review-open-row] sw-icon')).toHaveAttribute('name', 'chevron');
    await page.keyboard.press('Escape');
    // open from the row's own button
    await cards(page).nth(1).locator('[data-review-open-row]').click();
    await expect(page.locator(`${SCREEN} [data-review-drawer] [data-review-detail="rv-2"]`)).toBeVisible();
    await page.keyboard.press('Escape');
    // remembered across a reload; dark
    await page.goto('about:blank');
    await openApp(page, '/investigate/reviews', '&scheme=dark');
    await expect(page.locator(`${SCREEN} [data-review-table]`)).toBeVisible();
    await noOverflow(page);
    await shot(page, 'review-table', 'dark');
    await page.locator(`${SCREEN} [data-review-view-cards]`).click();
    await expect(page.locator(`${SCREEN} [data-review-grid]`)).toBeVisible();
  });

  test('drawer: the hero still, the fact grid, the timeline; "ייצוא הקטע" is offered only when the caller may export now and sends the item\'s range; the first export of a recorder is supervised', async ({ page }) => {
    const m = await start(page, '/investigate/reviews');
    await cards(page).nth(1).locator('[data-review-open]').click();
    const drawer = page.locator(`${SCREEN} [data-review-drawer]`);
    await expect(drawer.locator('[data-review-detail="rv-2"]')).toBeVisible();
    await expect(drawer.locator('.hero .tag.layer')).toContainText('התראה');
    await expect(drawer.locator('.facts .fact')).toHaveCount(4); // camera, time, zones, objects (the F1 server sends no plan location)
    await expect(drawer.locator('[data-review-detections]')).toHaveText('2');
    await expect(drawer.locator('[data-review-activity] [data-timeline-row]')).toHaveCount(2);
    await expect(drawer.locator('[data-review-events] frigate-event-control[ready]')).toHaveCount(2);
    // FRG-polish: the drawer walks the list - the buttons beside the heading and J / K; the ring on the list follows
    await expect(drawer.locator('[data-review-drawer-pos]')).toHaveText('2 מתוך 4');
    const third = (await cards(page).nth(2).locator('[data-review-card]').getAttribute('data-review-card'))!;
    const first = (await cards(page).nth(0).locator('[data-review-card]').getAttribute('data-review-card'))!;
    await drawer.locator('[data-review-drawer-next]').click();
    await expect(drawer.locator(`[data-review-detail="${third}"]`)).toBeVisible();
    await expect(drawer.locator('[data-review-drawer-pos]')).toHaveText('3 מתוך 4');
    await page.keyboard.press('k');
    await expect(drawer.locator('[data-review-detail="rv-2"]')).toBeVisible();
    await expect(cards(page).nth(1)).toHaveAttribute('focused', '');
    await page.keyboard.press('Home');
    await expect(drawer.locator(`[data-review-detail="${first}"]`)).toBeVisible();
    await expect(drawer.locator('[data-review-drawer-prev]')).toHaveAttribute('disabled', '');
    await page.keyboard.press('j');
    await expect(drawer.locator('[data-review-detail="rv-2"]')).toBeVisible();
    const exp = drawer.locator('[data-review-export]');
    await expect(exp).toBeVisible();
    await shot(page, 'review-drawer', 'light');
    await exp.click();
    const dlg = page.locator('[data-review-export-dialog]');
    await expect(dlg.locator('[data-review-export-name]')).toBeVisible(); // the sw-dialog host itself has no box: its fields prove it is open
    await expect(dlg.locator('[data-review-export-name]')).toHaveValue(/כניסה ראשית/);
    await expect(dlg.locator('[data-review-export-range]')).toContainText('1 דק׳');
    // the first export of this recorder: a system administrator ticks the supervision box; without it the button waits
    const sup = dlg.locator('[data-review-export-supervised]');
    await expect(sup).toBeVisible();
    await expect(dlg.locator('[data-review-export-ok]')).toHaveAttribute('disabled', '');
    await sup.check();
    await shot(page, 'review-export');
    await dlg.locator('[data-review-export-ok]').click();
    await expect.poll(() => writes(m, 'POST frigate/nvr-2/exports').length).toBe(1);
    const sent = JSON.parse(writes(m, 'POST frigate/nvr-2/exports')[0].replace(/^POST \S+ /, '')) as Record<string, unknown>;
    expect(sent.camera_id).toBe('fg-front');
    expect(sent.supervised).toBe(true);
    expect(sent.end as number).toBeGreaterThan(sent.start as number);
    await expect(page.locator(`${SCREEN} [data-review-toast]`)).toHaveText('הייצוא נוצר');
    await expect(page.locator('[data-review-export-dialog]')).toHaveCount(0);
    expect(m.ctl.firstWrites.export_create).toBe(true);
    await page.keyboard.press('Escape');
    // dark
    await page.goto('about:blank');
    await openApp(page, '/investigate/reviews', '&scheme=dark');
    await cards(page).nth(1).locator('[data-review-open]').click();
    await expect(drawer.locator('[data-review-detail="rv-2"]')).toBeVisible();
    await shot(page, 'review-drawer', 'dark');
  });

  test('without the export permissions, or with the exports class off, the drawer offers no export (and reads no policy without the permission)', async ({ page }) => {
    const off = await start(page, '/investigate/reviews', {}, { classes: { ...ALL_ON, exports: false } });
    await cards(page).first().locator('[data-review-open]').click();
    await expect(page.locator(`${SCREEN} [data-review-detail]`)).toBeVisible();
    await expect(page.locator(`${SCREEN} [data-review-export]`)).toHaveCount(0);
    expect(off.hits.some((h) => h.includes('control/policy'))).toBe(true);
    await page.goto('about:blank');
    const noPerm = await start(page, '/investigate/reviews', { perms: ADMIN });
    await cards(page).first().locator('[data-review-open]').click();
    await expect(page.locator(`${SCREEN} [data-review-detail]`)).toBeVisible();
    await expect(page.locator(`${SCREEN} [data-review-export]`)).toHaveCount(0);
    expect(noPerm.hits.some((h) => h.includes('control/policy'))).toBe(false);
  });

  test('layout guard: cards and table in four skins, light and dark', async ({ page }) => {
    test.skip(test.info().project.name === 'tablet', 'two projects are enough');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const m = newFrigateMock({ perms: ALL_PERMS, ctl: newControlMock({ classes: { ...ALL_ON } }) });
    await installFrigate(page, m);
    const findings: { cls: string }[] = [];
    for (const view of ['cards', 'table'] as const) {
      for (const skin of ['classic', 'domus', 'tesla', 'bubble'] as const) {
        for (const scheme of ['light', 'dark'] as const) {
          await page.goto('about:blank');
          await page.goto(`/?design=a&skin=${skin}&scheme=${scheme}#/investigate/reviews`);
          await page.waitForSelector(`${SCREEN} frigate-review-card`);
          await page.locator(`${SCREEN} [data-review-view-${view}]`).click();
          await cards(page).nth(1).locator('[data-review-select]').check();
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(150);
          const found = await page.evaluate(inPageCheck, { ctx: `${view} ${skin} ${scheme}`, bubble: '.card, .chip', skip: '.skl, sw-icon, svg, img', roots: [SCREEN] });
          findings.push(...found.filter((f) => f.cls !== 'target' && f.cls !== 'floating'));
          if (skin === 'bubble') await shot(page, `review-${view}-bubble`, scheme);
        }
      }
    }
    const { lines } = summarize(findings as never);
    expect(errors, 'page errors').toEqual([]);
    expect(lines, 'layout findings').toEqual([]);
  });
});

// ------------------------------------------------------------------------------------------------ settings: the management card

test.describe('settings: the Frigate management card', () => {
  async function openCard(page: Page) {
    await page.locator('nvr-recorders-card [data-recorder="nvr-2"] [data-recorder-connection]').click();
    const box = page.locator('nvr-recorders-card [data-frigate-control-settings]');
    await expect(box).toBeVisible();
    return box;
  }
  const tab = (box: ReturnType<Page['locator']>, name: string) => box.locator('[data-fcs-tabs]').getByRole('button', { name });

  test('tabs: classes with the two new ones; the profiles tab holds the mapping and the automatic profile; mode, consent and the status line follow the server', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const m = await start(page, '/system/setup', {}, { classes: { ...ALL_OFF } });
    const box = await openCard(page);
    await expect(box.locator('[data-fcs-tabs]').getByRole('button')).toHaveText(['סוגי פעולה', 'פרופילים', 'אזורים והגדרות', 'ייצואים', 'תיקים', 'אירועים ידניים', 'יומן שינויים', 'פיקוח']);
    await expect(box.locator('[data-fcs-class]')).toHaveCount(8); // FRGS: + config
    await expect(box.locator('[data-fcs-all-off]')).toBeVisible();
    await noOverflow(page);
    await shot(page, 'settings-classes', 'light');
    await tab(box, 'פרופילים').click();
    const auto = box.locator('[data-frigate-auto]');
    await expect(auto).toBeVisible();
    await expect(auto.locator('[data-auto-status]')).toHaveAttribute('data-auto-status', 'off');
    await expect(auto.locator('[data-auto-mode="apply"]')).toHaveAttribute('disabled', ''); // no consent yet
    await expect(auto.locator('[data-auto-empty]')).toBeVisible();
    // suggest only
    await auto.locator('[data-auto-mode="suggest"]').click();
    await expect.poll(() => writes(m, 'profile-auto/setting').length).toBe(1);
    expect(writes(m, 'profile-auto/setting')[0]).toContain('{"mode":"suggest"}');
    await expect(auto.locator('[data-auto-status]')).toHaveAttribute('data-auto-status', 'suggest');
    // consent, then apply: blocked until the class is on and the first write is done - the line says why
    await auto.locator('[data-auto-consent]').click();
    await expect.poll(() => writes(m, 'profile-auto/setting').length).toBe(2);
    expect(writes(m, 'profile-auto/setting')[1]).toContain('{"auto_apply_consent":true}');
    await expect(auto.locator('[data-auto-consent-by]')).toBeVisible();
    await auto.locator('[data-auto-mode="apply"]').click();
    await expect.poll(() => writes(m, 'profile-auto/setting').length).toBe(3);
    await expect(auto.locator('[data-auto-status]')).toHaveAttribute('data-auto-status', 'blocked');
    await expect(auto.locator('[data-auto-status]')).toContainText('סוג הפעולה "החלפת פרופיל" כבוי');
    await expect(auto.locator('[data-auto-status]')).toContainText('טרם בוצעה כתיבה ראשונה בפיקוח');
    await expect(auto.locator('[data-auto-first-note]')).toBeVisible();
    await noOverflow(page);
    await shot(page, 'settings-profiles', 'light');
    expect(errors).toEqual([]);
  });

  test('an open suggestion is applied with a confirmation (the first one supervised) or dismissed; the log shows the switch', async ({ page }) => {
    const items = [
      { id: 'au1', alarm_state: 'armed_away', profile: 'away', mode: 'suggest', status: 'suggested', reason: null, change_id: null, at: '2026-10-07T06:00:00Z', processed_at: null },
      { id: 'au0', alarm_state: 'disarmed', profile: 'home', mode: 'suggest', status: 'expired', reason: null, change_id: null, at: '2026-10-06T22:00:00Z', processed_at: '2026-10-06T22:10:00Z' },
    ];
    const m = await start(page, '/system/setup', {}, { auto: { mode: 'suggest', consent: true, consent_at: '2026-10-06T20:00:00Z', items } });
    const box = await openCard(page);
    await tab(box, 'פרופילים').click();
    const auto = box.locator('[data-frigate-auto]');
    await expect(auto.locator('[data-auto-item="au1"]')).toContainText('דריכה מחוץ לבית');
    await expect(auto.locator('[data-auto-recent-item="au0"]')).toContainText('פג');
    await auto.locator('[data-auto-item="au1"] [data-auto-apply]').click();
    const dlg = page.locator('[data-auto-confirm]');
    await expect(dlg.locator('[data-auto-apply-ok]')).toBeVisible();
    await expect(dlg.locator('[data-auto-apply-ok]')).toHaveAttribute('disabled', ''); // the supervision box first
    await dlg.locator('[data-supervised-box="profile_auto"] input').check();
    await shot(page, 'settings-auto-apply');
    await dlg.locator('[data-auto-apply-ok]').click();
    await expect.poll(() => writes(m, 'profile-auto/au1/apply').length).toBe(1);
    expect(writes(m, 'profile-auto/au1/apply')[0]).toContain('{"confirm":true,"supervised":true}');
    expect(m.ctl.active).toBe('away');
    expect(m.ctl.firstWrites.profile_auto).toBe(true);
    await expect(auto.locator('[data-auto-msg]')).toContainText('הפרופיל הוחלף');
    await expect(auto.locator('[data-auto-item]')).toHaveCount(0);
    await expect(auto.locator('[data-auto-recent-item="au1"]')).toContainText('הוחל');
    await tab(box, 'יומן שינויים').click();
    await expect(box.locator('[data-change]').first()).toContainText('פרופיל: away');
    await tab(box, 'פיקוח').click();
    await expect(box.locator('[data-fs-kind="profile_auto"]')).toHaveAttribute('data-done', 'true');
  });

  test('exports: the table lists Frigate\'s and Arx\'s exports; only Arx\'s have rename and delete; a new export is one camera and a bounded range; delete asks for the typed name', async ({ page }) => {
    const m = await start(page, '/system/setup', {}, { firstWrites: { export_create: true, export_rename: true, export_delete: true } });
    const box = await openCard(page);
    await tab(box, 'ייצואים').click();
    const panel = box.locator('[data-frigate-exports]');
    await expect(panel.locator('[data-fx-row]')).toHaveCount(2);
    await expect(panel.locator('[data-fx-row="exp-arx-1"] [data-fx-rename]')).toBeVisible();
    await expect(panel.locator('[data-fx-row="exp-fr-1"] [data-fx-rename]')).toHaveCount(0);
    await expect(panel.locator('[data-fx-row="exp-fr-1"] [data-fx-state]')).toHaveAttribute('data-fx-state', 'progress');
    await noOverflow(page);
    await shot(page, 'settings-exports', 'light');
    // create
    await panel.locator('[data-fx-new]').click();
    const dlg = page.locator('[data-fx-create]');
    await expect(dlg.locator('[data-fx-name]')).toBeVisible();
    await expect(dlg.locator('[data-supervised-box]')).toHaveCount(0); // the first export was already supervised
    await dlg.locator('[data-fx-name]').fill('בדיקה');
    await dlg.locator('[data-fx-end]').fill('2026-10-06T11:00');
    await dlg.locator('[data-fx-start]').fill('2026-10-06T08:00'); // three hours: too long
    await dlg.locator('[data-fx-create-ok]').click();
    await expect(dlg.locator('[data-fx-error]')).toHaveText('הטווח ארוך משעתיים');
    await dlg.locator('[data-fx-start]').fill('2026-10-06T10:00');
    await dlg.locator('[data-fx-create-ok]').click();
    await expect.poll(() => writes(m, 'POST frigate/nvr-2/exports').length).toBe(1);
    const sent = JSON.parse(writes(m, 'POST frigate/nvr-2/exports')[0].replace(/^POST \S+ /, '')) as Record<string, unknown>;
    expect(sent.name).toBe('בדיקה');
    expect((sent.end as number) - (sent.start as number)).toBe(3600);
    await expect(panel.locator('[data-fx-row]')).toHaveCount(3);
    await expect(panel.locator('[data-fx-msg]')).toContainText('הייצוא נוצר');
    // rename inline
    await panel.locator('[data-fx-row="exp-arx-1"] [data-fx-rename]').click();
    await panel.locator('[data-fx-rename-input]').fill('כניסה - שם חדש');
    await panel.locator('[data-fx-rename-save]').click();
    await expect.poll(() => writes(m, 'PATCH frigate/nvr-2/exports/exp-arx-1').length).toBe(1);
    await expect(panel.locator('[data-fx-row="exp-arx-1"] b')).toHaveText('כניסה - שם חדש');
    // delete with the typed name
    await panel.locator('[data-fx-row="exp-arx-1"] [data-fx-delete-btn]').click();
    const del = page.locator('[data-fx-delete]');
    await expect(del.locator('[data-fx-delete-ok]')).toHaveAttribute('disabled', '');
    await del.locator('[data-fx-delete-typed]').fill('לא השם');
    await expect(del.locator('[data-fx-delete-ok]')).toHaveAttribute('disabled', '');
    await del.locator('[data-fx-delete-typed]').fill('כניסה - שם חדש');
    await shot(page, 'settings-export-delete');
    await del.locator('[data-fx-delete-ok]').click();
    await expect.poll(() => writes(m, 'exports/exp-arx-1/delete').length).toBe(1);
    expect(writes(m, 'exports/exp-arx-1/delete')[0]).toContain('"confirm":true');
    await expect(panel.locator('[data-fx-row="exp-arx-1"]')).toHaveCount(0);
    await tab(box, 'יומן שינויים').click();
    await expect(box.locator('[data-change]').first()).toContainText('ייצוא נמחק');
  });

  test('exports with the class off: the list is read, the chip says so and nothing can be created; the first write without supervision is refused with the server sentence', async ({ page }) => {
    await start(page, '/system/setup', {}, { classes: { ...ALL_ON, exports: false } });
    const box = await openCard(page);
    await tab(box, 'ייצואים').click();
    const panel = box.locator('[data-frigate-exports]');
    await expect(panel.locator('[data-fx-off]')).toHaveText('סוג הפעולה כבוי');
    await expect(panel.locator('[data-fx-new]')).toHaveAttribute('disabled', '');
    await expect(panel.locator('[data-fx-row="exp-arx-1"] [data-fx-rename]')).toHaveCount(0);
    // class on, first write pending: the create dialog carries the supervision box; a non-administrator would be blocked (the server says so)
    await page.goto('about:blank');
    const m = await start(page, '/system/setup', { perms: ALL_PERMS.filter((p) => p !== 'system.configure' && p !== 'rbac.assign').concat('system.configure') });
    const box2 = await openCard(page);
    await tab(box2, 'ייצואים').click();
    const p2 = box2.locator('[data-frigate-exports]');
    await expect(p2.locator('[data-fx-first-pending]')).toBeVisible();
    await p2.locator('[data-fx-new]').click();
    const dlg = page.locator('[data-fx-create]');
    await dlg.locator('[data-fx-name]').fill('ראשון');
    await expect(dlg.locator('[data-supervised-box="export_create"]')).toBeVisible();
    await expect(dlg.locator('[data-fx-create-ok]')).toHaveAttribute('disabled', '');
    await dlg.locator('[data-supervised-box="export_create"] input').check();
    await expect(dlg.locator('[data-supervised-box="export_create"] input')).toBeChecked();
    await expect(dlg.locator('[data-fx-create-ok]')).not.toHaveAttribute('disabled', '');
    await dlg.locator('[data-fx-create-ok]').click();
    await expect.poll(() => writes(m, 'POST frigate/nvr-2/exports').length).toBe(1);
    expect(writes(m, 'POST frigate/nvr-2/exports')[0]).toContain('"supervised":true');
    expect(m.ctl.firstWrites.export_create).toBe(true);
  });

  test('cases: list, create, rename and typed delete, Arx-created only', async ({ page }) => {
    const m = await start(page, '/system/setup', {}, { firstWrites: { case_create: true, case_rename: true, case_delete: true } });
    const box = await openCard(page);
    await tab(box, 'תיקים').click();
    const panel = box.locator('[data-frigate-cases]');
    await expect(panel.locator('[data-fc-row]')).toHaveCount(2);
    await expect(panel.locator('[data-fc-row="case-fr-1"] [data-fc-delete-btn]')).toHaveCount(0);
    await noOverflow(page);
    await shot(page, 'settings-cases', 'light');
    await panel.locator('[data-fc-new]').click();
    const dlg = page.locator('[data-fc-create]');
    await dlg.locator('[data-fc-name]').fill('רכב חשוד');
    await dlg.locator('[data-fc-description]').fill('שלוש התראות מהחניה');
    await dlg.locator('[data-fc-create-ok]').click();
    await expect.poll(() => writes(m, 'POST frigate/nvr-2/cases').length).toBe(1);
    expect(writes(m, 'POST frigate/nvr-2/cases')[0]).toContain('"description":"שלוש התראות מהחניה"');
    await expect(panel.locator('[data-fc-row]')).toHaveCount(3);
    await panel.locator('[data-fc-row="case-arx-1"] [data-fc-rename]').click();
    await panel.locator('[data-fc-rename-input]').fill('חבילה - נסגר');
    await panel.locator('[data-fc-rename-input]').press('Enter');
    await expect.poll(() => writes(m, 'PATCH frigate/nvr-2/cases/case-arx-1').length).toBe(1);
    await panel.locator('[data-fc-row="case-arx-1"] [data-fc-delete-btn]').click();
    await page.locator('[data-fc-delete] [data-fc-delete-typed]').fill('חבילה - נסגר');
    await page.locator('[data-fc-delete] [data-fc-delete-ok]').click();
    await expect.poll(() => writes(m, 'cases/case-arx-1/delete').length).toBe(1);
    await expect(panel.locator('[data-fc-row="case-arx-1"]')).toHaveCount(0);
  });

  test('manual events: a labelled event on one camera (timed or open), the open ones created here can be ended; the events class gates it', async ({ page }) => {
    const m = await start(page, '/system/setup', {}, { firstWrites: { event_create: true, event_end: true } });
    const box = await openCard(page);
    await tab(box, 'אירועים ידניים').click();
    const panel = box.locator('[data-frigate-events]');
    await expect(panel.locator('[data-fe-empty]')).toBeVisible();
    await panel.locator('[data-fe-create]').click();
    await expect(panel.locator('[data-fe-error]')).toHaveText('יש להזין תווית');
    await panel.locator('[data-fe-label]').fill('בדיקת מערכת');
    await panel.locator('[data-fe-duration]').fill('900');
    await panel.locator('[data-fe-create]').click();
    await expect(panel.locator('[data-fe-error]')).toHaveText('משך בין 1 ל־600 שניות');
    await panel.locator('[data-fe-open]').check();
    await panel.locator('[data-fe-sub-label]').fill('טכנאי');
    await noOverflow(page);
    await shot(page, 'settings-events', 'light');
    await panel.locator('[data-fe-create]').click();
    await expect.poll(() => writes(m, '/events/manual').length).toBe(1);
    expect(writes(m, '/events/manual')[0]).toContain('{"label":"בדיקת מערכת","duration_s":null,"sub_label":"טכנאי"}');
    expect(writes(m, '/events/manual')[0]).toContain('cameras/fg-front/');
    await expect(panel.locator('[data-fe-open-row]')).toHaveCount(1);
    await expect(panel.locator('[data-fe-open-row]')).toContainText('בדיקת מערכת');
    await panel.locator('[data-fe-end]').click();
    await expect.poll(() => writes(m, '/end').length).toBe(1);
    await expect(panel.locator('[data-fe-open-row]')).toHaveCount(0);
    await expect(panel.locator('[data-fe-msg]')).toContainText('האירוע הסתיים');
    // class off: the form is locked and says so
    await page.goto('about:blank');
    await start(page, '/system/setup', {}, { classes: { ...ALL_ON, events: false } });
    const box2 = await openCard(page);
    await tab(box2, 'אירועים ידניים').click();
    await expect(box2.locator('[data-frigate-events] [data-fe-off]')).toBeVisible();
    await expect(box2.locator('[data-frigate-events] [data-fe-create]')).toHaveAttribute('disabled', '');
  });

  test('supervision: every kind with its state; the clip read opens the clip Arx streams, the first read of a recorder supervised', async ({ page }) => {
    const m = await start(page, '/system/setup', {}, { firstWrites: { export_create: true } });
    const box = await openCard(page);
    await tab(box, 'פיקוח').click();
    const panel = box.locator('[data-frigate-supervision]');
    await expect(panel.locator('[data-fs-kind]')).toHaveCount(12); // FRGS: + config_zone, config_settings
    await expect(panel.locator('[data-fs-kind="export_create"]')).toHaveAttribute('data-done', 'true');
    await expect(panel.locator('[data-fs-kind="clip_read"]')).toHaveAttribute('data-done', 'false');
    await expect(panel.locator('[data-fs-open]')).toHaveAttribute('disabled', ''); // the supervision box first
    await panel.locator('[data-supervised-box="clip_read"] input').check();
    await panel.locator('[data-fs-start]').fill('2026-10-06T08:00');
    await panel.locator('[data-fs-end]').fill('2026-10-06T09:30'); // over an hour
    await panel.locator('[data-fs-open]').click();
    await expect(panel.locator('[data-fs-error]')).toHaveText('חלון של עד שעה, לא בעתיד');
    await panel.locator('[data-fs-end]').fill('2026-10-06T08:30');
    await noOverflow(page);
    await shot(page, 'settings-supervision', 'light');
    // FRG-polish: the clip plays here first - a dialog with the video over the same GET; the mock's bytes are no video, so the error line shows
    await panel.locator('[data-fs-play]').click();
    const viewer = panel.locator('[data-fs-viewer]');
    await expect(viewer.locator('[data-fs-video]')).toHaveAttribute('src', /\/api\/v1\/frigate\/nvr-2\/cameras\/fg-front\/clip\.mp4\?start=\d+&end=\d+&supervised=true$/);
    await expect(viewer.locator('[data-fs-clip-state]')).toHaveAttribute('data-fs-clip-state', 'error');
    await expect(viewer.locator('[data-fs-clip-state]')).toContainText('הקטע לא זמין');
    await expect.poll(() => m.ctl.clips.length).toBe(1);
    expect(m.ctl.clips[0]).toMatch(/^fg-front \d+ \d+ true$/);
    await shot(page, 'settings-clip-viewer', 'light');
    await viewer.locator('[data-fs-viewer-close]').click();
    await expect(panel.locator('[data-fs-viewer]')).toHaveCount(0);
    const opened: string[] = [];
    await page.exposeFunction('__noteOpen', (u: string) => opened.push(u));
    await page.evaluate(() => {
      window.open = ((u: string) => {
        (window as unknown as { __noteOpen: (s: string) => void }).__noteOpen(String(u));
        return null;
      }) as typeof window.open;
    });
    await panel.locator('[data-fs-open]').click();
    await expect.poll(() => opened.length).toBe(1);
    expect(opened[0]).toMatch(/\/api\/v1\/frigate\/nvr-2\/cameras\/fg-front\/clip\.mp4\?start=\d+&end=\d+&supervised=true$/);
    expect(m.ctl.clips).toHaveLength(1); // the tab is opened by the browser; only the in-app viewer above fetched the clip
  });

  test('a viewer who may only export sees the exports tab and no toggles; the card never names the platform', async ({ page }) => {
    await start(page, '/system/setup', { perms: [...ADMIN, 'analytics.exports', 'video.export'] });
    const box = await openCard(page);
    const text = await box.innerText();
    expect(text).not.toMatch(/Home Assistant|Ingress|\bHA\b/);
    await expect(box.locator('[data-fcs-tabs]').getByRole('button', { name: 'ייצואים' })).toBeVisible();
    await expect(box.locator('[data-fcs-tabs]').getByRole('button', { name: 'תיקים' })).toBeVisible(); // system.configure opens every tab
  });

  test('dark: the management card', async ({ page }) => {
    test.skip(test.info().project.name === 'tablet', 'two projects are enough');
    await start(page, '/system/setup', {}, { auto: { mode: 'suggest', consent: true, consent_at: '2026-10-06T20:00:00Z', items: [{ id: 'au1', alarm_state: 'armed_away', profile: 'away', mode: 'suggest', status: 'suggested', reason: null, change_id: null, at: '2026-10-07T06:00:00Z', processed_at: null }] } }, '&scheme=dark');
    const box = await openCard(page);
    await shot(page, 'settings-classes', 'dark');
    await tab(box, 'פרופילים').click();
    await expect(box.locator('[data-auto-item="au1"]')).toBeVisible();
    await shot(page, 'settings-profiles', 'dark');
    await tab(box, 'ייצואים').click();
    await expect(box.locator('[data-fx-row]')).toHaveCount(2);
    await noOverflow(page);
    await shot(page, 'settings-exports', 'dark');
  });
});
