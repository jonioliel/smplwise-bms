import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// CR-018 S3: the notification center (opened from the user menu's bell) and the Settings tab "התראות", in MOCK mode (the S0 client's in-memory adapter: no backend,
// the static preview of `npm run build`). A scenario is set before the page loads (sessionStorage `sw-notify-mock`: viewer admin | operator | door, quiet hours now,
// push support, mail, step-up, a forced loading / empty / error state, the centre layout, the colour scheme). The fixture's clock is the mockup's 14:10.
//   npm run build   (in frontend/)
//   SW_BASE_URL=http://127.0.0.1:4671/ npx playwright test tests/evidence-notifications.spec.ts --project=desktop --project=mobile --workers=1
// Screenshots: docs/design/evidence/CR-018/s3/ (1440, 820, 390; light and dark). Mockup: docs/design/mockups/notifications/index.html.

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/CR-018/s3');
type Scenario = { viewer?: 'admin' | 'operator' | 'door' | 'planner'; quietNow?: boolean; push?: string; registered?: number; emailConfigured?: boolean; emailHost?: string; stepUp?: boolean; state?: 'loading' | 'empty' | 'error'; layout?: 'sheet' | 'page'; scheme?: 'light' | 'dark' };
type Info = { project: { name: string } };
const phone = (info: Info) => info.project.name === 'mobile';
/** The settings screen switches to its compact form (cards, one section at a time) below 1100 px: the phone and a 1024 px tablet. */
const narrow = (page: Page, info: Info) => phone(info) || (page.viewportSize()?.width ?? 1440) < 1100;
const vp = (info: Info) => (phone(info) ? '390' : '1440');

async function shot(page: Page, name: string) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}
async function setup(page: Page, sc: Scenario = {}) {
  await page.addInitScript((s) => {
    try {
      sessionStorage.setItem('sw-notify-mock', JSON.stringify(s));
      localStorage.removeItem('sw.nav.order');
    } catch {
      /* storage unavailable */
    }
  }, sc);
}
async function open(page: Page, hash = '/devices/building') {
  await page.goto('about:blank');
  await page.goto(`/?design=a#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(500);
}
const me = (page: Page, info: Info) => page.locator(phone(info) ? 'sw-app [data-nav-me]' : 'sw-app [data-profile-menu]');
const center = (page: Page) => page.locator('sw-app notify-center');
const panel = (page: Page) => page.locator('sw-app notify-center [data-notify-center]');
const rowOf = (page: Page, id: string) => page.locator(`sw-app notify-center notify-row [data-notify-row="${id}"]`);
const N = (n: number) => `ntf-${String(n).padStart(3, '0')}`; // the fixture's row ids, in the seed order (api/notifications-mock.ts)

async function openCenter(page: Page, info: Info) {
  await me(page, info).click();
  await page.locator('sw-app sw-user-menu [data-menu-alerts]').click();
  await expect(center(page)).toHaveAttribute('open', '');
  await expect(panel(page)).toBeVisible();
  await page.waitForTimeout(350);
}
async function openRow(page: Page, id: string) {
  await rowOf(page, id).locator('[data-row-open]').click();
  await expect(page.locator('sw-app notify-center notify-detail [data-notify-detail]')).toHaveAttribute('data-notify-detail', id);
}
/** Reads the mock store the page runs on (api/notifications-mock.ts: door releases, the clock). */
const doorOpens = (page: Page): Promise<[string, string][]> =>
  page.evaluate(() => (window as unknown as { __swNotifyMock: { doorOpens: { origin: string; door_id: string }[] } }).__swNotifyMock.doorOpens.map((o) => [o.origin, o.door_id] as [string, string]));

// ---------------------------------------------------------------------------------------------------------------------
test.describe('the notification center (mock)', () => {
  test('the bell opens the center: pinned critical on top, day groups, folded counts, unread chip, avatar dot; light and dark', async ({ page }, info) => {
    await setup(page);
    await open(page);
    // the avatar's red dot = an open critical row; the menu chip = the unread count (summary, not the legacy rule alerts)
    await expect(me(page, info).locator('[data-alert-dot]')).toHaveCount(1);
    await me(page, info).click();
    await expect(page.locator('sw-app sw-user-menu [data-menu-alerts] [data-alert-count]')).toHaveText('2');
    await page.waitForTimeout(300);
    await shot(page, `usermenu-${vp(info)}-light`);
    await page.locator('sw-app sw-user-menu [data-menu-alerts]').click();
    await expect(center(page)).toHaveAttribute('open', '');
    await expect(center(page)).toHaveAttribute('data-presentation', phone(info) ? 'bottom_sheet' : 'sheet');
    await expect(page.locator('sw-app notify-center [data-center-state="ready"]')).toBeVisible();
    // pinned: the open critical leak row alone, above the day groups
    const groups = page.locator('sw-app notify-center [data-group]');
    await expect(groups.first()).toHaveAttribute('data-group', 'pinned');
    await expect(page.locator('sw-app notify-center [data-group="pinned"] + notify-row [data-notify-row]')).toHaveAttribute('data-notify-row', N(1));
    await expect(rowOf(page, N(1))).toHaveAttribute('data-severity', 'critical');
    await expect(rowOf(page, N(1)).locator('[data-unread-dot]')).toHaveCount(1);
    // folded repeats: the camera that dropped five times and the person seen three times
    await expect(rowOf(page, N(4)).locator('[data-fold]')).toHaveText('×5');
    await expect(rowOf(page, N(5)).locator('[data-fold]')).toHaveText('×3');
    // state tags: acknowledged by, resolved, snoozed until, delivery failed
    await expect(rowOf(page, N(3)).locator('[data-row-tag="ack"]')).toContainText('אושר · דנה');
    await expect(rowOf(page, N(6)).locator('[data-row-tag="res"]')).toContainText('נפתר');
    await expect(rowOf(page, N(8)).locator('[data-row-tag="snz"]')).toContainText('הושתק עד 15:10');
    await expect(rowOf(page, N(10)).locator('[data-row-tag="fail"]')).toContainText('המסירה נכשלה');
    // day groups: today, yesterday, then older days; newest first inside a day
    const labels = await page.locator('sw-app notify-center [data-group] span').allInnerTexts();
    expect(labels.slice(0, 2)).toEqual(['היום', 'אתמול']);
    await expect(page.locator('sw-app notify-center [data-center-unread]')).toHaveText('2');
    await expect(page.locator('sw-app notify-center [data-center-sub]')).toHaveText('24 ב־30 הימים האחרונים'); // the administrator knows the retention
    await shot(page, `center-${vp(info)}-light`);
    await center(page).evaluate((el) => el.setAttribute('data-devices-scheme', 'dark'));
    await shot(page, `center-${vp(info)}-dark`);
    if (!phone(info)) {
      await page.setViewportSize({ width: 820, height: 1180 });
      await center(page).evaluate((el) => el.setAttribute('data-devices-scheme', 'light'));
      await shot(page, 'center-820-light');
    }
  });

  test('RTL: the sheet sits at the start edge beside the rail; Escape closes it; the page behind is untouched', async ({ page }, info) => {
    test.skip(phone(info), 'the sheet is the wide-screen presentation');
    await setup(page);
    await open(page);
    expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl');
    await openCenter(page, info);
    const box = (await panel(page).boundingBox())!;
    const rail = (await page.locator('sw-app nav.rail').boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(rail.x + 2); // the sheet's right edge is at (or left of) the rail's left edge: the start side
    expect(box.x + box.width).toBeGreaterThan(rail.x - 30);
    expect(box.width).toBeGreaterThan(440);
    expect(box.width).toBeLessThan(520);
    await page.keyboard.press('Escape');
    await expect(center(page)).not.toHaveAttribute('open', '');
    await expect(page.locator('sw-app devices-building')).toHaveCount(1);
  });

  test('the avatar dot and the unread chip follow the summary and the live events', async ({ page }, info) => {
    await setup(page);
    await open(page);
    await expect(me(page, info).locator('[data-alert-dot]')).toHaveCount(1);
    // a colleague acknowledged the only open critical row, and the unread count moved on another device (the socket's events)
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('sw-notify-event', { detail: { type: 'notify_summary', payload: { unread: 5, open_critical: 0 } } })));
    await expect(me(page, info).locator('[data-alert-dot]')).toHaveCount(0);
    await me(page, info).click();
    await expect(page.locator('sw-app sw-user-menu [data-menu-alerts] [data-alert-count]')).toHaveText('5');
    await expect(me(page, info)).toHaveAttribute('aria-label', /5 התראות שלא נקראו/);
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('sw-notify-event', { detail: { type: 'notify_summary', payload: { unread: 2, open_critical: 1 } } })));
    await expect(me(page, info).locator('[data-alert-dot]')).toHaveCount(1);
    await expect(me(page, info)).toHaveAttribute('aria-label', /התראה קריטית פתוחה/);
  });

  test('filters: unread / critical / the source filter; "הכל נקרא" empties the unread count', async ({ page }, info) => {
    await setup(page);
    await open(page);
    await openCenter(page, info);
    const rows = page.locator('sw-app notify-center notify-row');
    const all = await rows.count();
    expect(all).toBeGreaterThan(15);
    await page.locator('sw-app notify-center [data-filter="unread"]').click();
    await expect(rows).toHaveCount(2);
    await expect(page.locator('sw-app notify-center [data-filter="unread"] small')).toHaveText('2');
    await page.locator('sw-app notify-center [data-filter="critical"]').click();
    await expect(rows).toHaveCount(7); // leak, alarm, smoke, gas, co, nvr storage, nvr offline
    for (const sev of await page.locator('sw-app notify-center notify-row [data-notify-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-severity')))) expect(sev).toBe('critical');
    await shot(page, `filter-critical-${vp(info)}-light`);
    await page.locator('sw-app notify-center [data-filter="all"]').click();
    // the source filter: a category with its count, then back to all
    await page.locator('sw-app notify-center [data-source-filter]').click();
    await expect(page.locator('sw-app notify-center [data-source-menu] [data-source-opt]')).toHaveCount(8); // all + 7 categories
    await center(page).evaluate((el) => el.setAttribute('data-devices-scheme', 'dark'));
    await shot(page, `sourcefilter-${vp(info)}-dark`);
    await center(page).evaluate((el) => el.setAttribute('data-devices-scheme', 'light'));
    await page.locator('sw-app notify-center [data-source-opt="safety"]').click();
    await expect(rows).toHaveCount(6); // leak, alarm, arm failed, smoke, gas, co
    await expect(page.locator('sw-app notify-center [data-source-filter]')).toContainText('בטיחות');
    await page.locator('sw-app notify-center [data-source-filter]').click();
    await page.locator('sw-app notify-center [data-source-opt="all"]').click();
    await expect(rows).toHaveCount(all);
    await page.locator('sw-app notify-center [data-center-readall]').click();
    await expect(page.locator('sw-app notify-center [data-center-unread]')).toHaveCount(0);
    await expect(page.locator('sw-app notify-center [data-unread-dot]')).toHaveCount(0);
    await expect(page.locator('sw-app notify-center [data-center-readall]')).toBeDisabled();
  });

  test('the row menu: snooze for an hour, until the morning, acknowledge, mark read, open the device', async ({ page }, info) => {
    await setup(page);
    await open(page);
    await openCenter(page, info);
    // snooze one hour: the row says until when, the menu no longer offers it
    const camera = rowOf(page, N(4));
    await camera.locator('[data-row-more]').click({ force: true });
    await shot(page, `rowmenu-${vp(info)}-light`);
    await camera.locator('[data-row-act="snooze"]').click();
    await expect(camera.locator('[data-row-tag="snz"]')).toContainText('הושתק עד 15:10');
    await expect(page.locator('sw-app notify-center [data-center-toast]')).toContainText('הושתק לשעה');
    await camera.locator('[data-row-more]').click({ force: true });
    await expect(camera.locator('[data-row-act="snooze"]')).toHaveCount(0);
    await page.keyboard.press('Escape');
    // until the morning: 07:00 tomorrow (the clock is 14:10)
    const person = rowOf(page, N(5));
    await person.locator('[data-row-more]').click({ force: true });
    await person.locator('[data-row-act="snooze_morning"]').click();
    await expect(person.locator('[data-row-tag="snz"]')).toContainText('הושתק עד 07:00');
    // acknowledge the leak (the administrator may): the pinned row goes, the avatar dot goes with the last open critical row
    const leak = rowOf(page, N(1));
    await leak.locator('[data-row-more]').click({ force: true });
    await leak.locator('[data-row-act="ack"]').click();
    await expect(leak).toHaveAttribute('data-state', 'acknowledged');
    await expect(leak.locator('[data-row-tag="ack"]')).toContainText('אושר · יוני');
    await expect(page.locator('sw-app notify-center [data-group="pinned"]')).toHaveCount(0);
    await expect(me(page, info).locator('[data-alert-dot]')).toHaveCount(0);
    // mark read: the unread dot of the doorbell goes, the count follows
    const ring = rowOf(page, N(2));
    await expect(ring.locator('[data-unread-dot]')).toHaveCount(1);
    await ring.locator('[data-row-more]').click({ force: true });
    await ring.locator('[data-row-act="read"]').click();
    await expect(ring.locator('[data-unread-dot]')).toHaveCount(0);
    await expect(page.locator('sw-app notify-center [data-center-unread]')).toHaveCount(0);
    // open the device: the center closes and the address follows the row's link
    await camera.locator('[data-row-more]').click({ force: true });
    await camera.locator('[data-row-act="open"]').click();
    await expect.poll(() => page.evaluate(() => location.hash)).toContain('#/live/cameras/cam-parking');
    await expect(center(page)).not.toHaveAttribute('open', '');
  });

  test('the detail: what / where / when, severity and state, the escalation timeline with the step still to come, actions', async ({ page }, info) => {
    await setup(page);
    await open(page);
    await openCenter(page, info);
    await openRow(page, N(1));
    const det = page.locator('sw-app notify-center notify-detail');
    await expect(det.locator('h4')).toHaveText('דליפת מים · מטבח');
    await expect(det.locator('[data-detail-severity="critical"]')).toHaveText('קריטי');
    await expect(det.locator('[data-detail-state="open"]')).toBeVisible();
    await expect(det.locator('.kv')).toContainText('התקן · מטבח');
    await expect(det.locator('[data-detail-delivery="ok"]')).toContainText('נשלח לטלפון · 14:02');
    // created, escalation 1 (sent again to the administrators), then the pending step 2 and nothing else
    await expect(det.locator('[data-detail-timeline] .tlh')).toHaveText('ציר ההסלמה');
    expect(await det.locator('[data-tl]').evaluateAll((els) => els.map((e) => e.getAttribute('data-tl')))).toEqual(['created', 'escalated', 'pending']);
    await expect(det.locator('[data-tl="pending"]')).toContainText('הסלמה 2');
    await expect(det.locator('[data-detail-act]')).toHaveCount(4); // פתח, אישור, השתק לשעה, עד הבוקר (no door on a leak)
    await expect(det.locator('[data-detail-act="door"]')).toHaveCount(0);
    await shot(page, `detail-leak-${vp(info)}-light`);
    await center(page).evaluate((el) => el.setAttribute('data-devices-scheme', 'dark'));
    await shot(page, `detail-leak-${vp(info)}-dark`);
    // the acknowledged state: the timeline says who and that the escalation stopped; no pending step
    await det.locator('[data-detail-act="ack"]').click();
    await expect(det.locator('[data-detail-state="acknowledged"]')).toContainText('אושר · יוני');
    expect(await det.locator('[data-tl]').evaluateAll((els) => els.map((e) => e.getAttribute('data-tl')))).toEqual(['created', 'escalated', 'acknowledged']);
    await expect(det.locator('[data-tl="acknowledged"]')).toContainText('ההסלמה נעצרה');
    await expect(det.locator('[data-detail-act="ack"]')).toHaveCount(0);
    await shot(page, `escalation-acked-${vp(info)}-dark`);
    // back to the list
    await page.locator('sw-app notify-center [data-detail-back]').click();
    await expect(page.locator('sw-app notify-center [data-center-list]')).toBeVisible();
  });

  test('a folded camera row: the span of the repeats; a rule alert shows its snapshot inside the app', async ({ page }, info) => {
    await setup(page);
    await open(page);
    await openCenter(page, info);
    await openRow(page, N(4));
    const det = page.locator('sw-app notify-center notify-detail');
    await expect(det.locator('.dhead .tag.n')).toHaveText('×5');
    await expect(det.locator('.kv')).toContainText('11:20');
    await expect(det.locator('.kv')).toContainText('13:30');
    await expect(det.locator('[data-detail-delivery="held"]')).toContainText('לא נשלח · שעות שקט');
    await expect(det.locator('[data-detail-snapshot]')).toHaveCount(0);
    await shot(page, `detail-camera-fold-${vp(info)}-light`);
    await page.locator('sw-app notify-center [data-detail-back]').click();
    await openRow(page, N(5));
    await expect(det.locator('[data-detail-snapshot] img')).toHaveCount(1);
    await expect(det.locator('[data-detail-snapshot]')).toContainText('תמונה מהמצלמה');
    await shot(page, `detail-snapshot-${vp(info)}-light`);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
test.describe('the doorbell: "פתח דלת" never opens by itself (CR §9)', () => {
  test('press -> in-app confirmation -> only the confirm sends the release (origin: the notification); cancel sends nothing', async ({ page }, info) => {
    await setup(page);
    await open(page);
    await openCenter(page, info);
    await openRow(page, N(2));
    const det = page.locator('sw-app notify-center notify-detail');
    await expect(det.locator('h4')).toHaveText('צלצול בדלת · כניסה ראשית');
    await shot(page, `detail-doorbell-${vp(info)}-light`);
    await det.locator('[data-detail-act="door"]').click();
    const dlg = page.locator('sw-app notify-center [data-door-dialog]');
    await expect(dlg).toHaveAttribute('data-door-dialog', 'confirm');
    await expect(dlg.locator('[data-door-text]')).toHaveText('האם אתה בטוח שברצונך לפתוח את דלת הכניסה?');
    await expect(dlg).toContainText('מחובר כ־יוני');
    expect(await doorOpens(page)).toEqual([]); // the press alone sent nothing
    await shot(page, `door-confirm-${vp(info)}-light`);
    await dlg.locator('[data-door-cancel]').click();
    await expect(dlg).toHaveCount(0);
    expect(await doorOpens(page)).toEqual([]);
    // Escape cancels too
    await det.locator('[data-detail-act="door"]').click();
    await page.keyboard.press('Escape');
    await expect(dlg).toHaveCount(0);
    expect(await doorOpens(page)).toEqual([]);
    // confirm: the existing release route with the notification as its origin; the result text names the door
    await det.locator('[data-detail-act="door"]').click();
    await dlg.locator('[data-door-confirm]').click();
    await expect(dlg).toHaveAttribute('data-door-dialog', 'done');
    await expect(dlg.locator('[data-door-text]')).toHaveText('הפקודה נשלחה אל דלת הכניסה');
    expect(await doorOpens(page)).toEqual([[`notification:${N(2)}`, 'st-main']]);
    await shot(page, `door-done-${vp(info)}-light`);
    await dlg.locator('[data-door-close]').click();
    await expect(dlg).toHaveCount(0);
  });

  test('a step-up is a phase of the flow: the dialog asks for verification, the command goes out once after it', async ({ page }, info) => {
    await setup(page, { stepUp: true });
    await open(page);
    await openCenter(page, info);
    await openRow(page, N(2));
    await page.locator('sw-app notify-center notify-detail [data-detail-act="door"]').click();
    const dlg = page.locator('sw-app notify-center [data-door-dialog]');
    await dlg.locator('[data-door-confirm]').click();
    await expect(dlg).toHaveAttribute('data-door-dialog', 'step_up');
    await expect(dlg.locator('[data-door-text]')).toHaveText('נדרש אימות נוסף');
    expect(await doorOpens(page)).toEqual([]);
    await dlg.locator('[data-door-stepup]').click();
    await expect(dlg).toHaveAttribute('data-door-dialog', 'done');
    expect(await doorOpens(page)).toHaveLength(1);
  });

  test('the push button is a deep link: #/doors/<id>?confirm=<notification> opens the center on that row with the confirmation, and sends nothing', async ({ page }, info) => {
    await setup(page);
    await open(page, `/doors/st-main?confirm=${N(2)}`);
    const dlg = page.locator('sw-app notify-center [data-door-dialog]');
    await expect(center(page)).toHaveAttribute('open', '');
    await expect(dlg).toHaveAttribute('data-door-dialog', 'confirm');
    await expect(dlg.locator('[data-door-text]')).toHaveText('האם אתה בטוח שברצונך לפתוח את דלת הכניסה?');
    await expect(page.locator('sw-app notify-center notify-detail [data-notify-detail]')).toHaveAttribute('data-notify-detail', N(2));
    expect(await doorOpens(page)).toEqual([]);
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/devices/building'); // the address falls back: Back does not repeat the link
    await shot(page, `door-deeplink-${vp(info)}-light`);
  });

  test('every push opens #/notifications/<id>: the center on that row, nothing sent', async ({ page }, info) => {
    await setup(page);
    await open(page, `/notifications/${N(1)}`);
    await expect(center(page)).toHaveAttribute('open', '');
    await expect(page.locator('sw-app notify-center notify-detail [data-notify-detail]')).toHaveAttribute('data-notify-detail', N(1));
    await expect(page.locator('sw-app notify-center [data-door-dialog]')).toHaveCount(0);
    expect(await doorOpens(page)).toEqual([]);
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/devices/building');
    void info;
  });

  test('a user without the door-open permission has no "פתח דלת" and no manager rows; one who holds it has the button', async ({ page }, info) => {
    await setup(page, { viewer: 'operator' });
    await open(page);
    await openCenter(page, info);
    await expect(rowOf(page, N(7))).toHaveCount(0); // the backup failure is for the administrators
    await shot(page, `operator-center-${vp(info)}-light`);
    await openRow(page, N(2));
    const det = page.locator('sw-app notify-center notify-detail');
    await expect(det.locator('[data-detail-act="door"]')).toHaveCount(0);
    await expect(det.locator('[data-detail-act="open"]')).toBeVisible();
    await shot(page, `operator-doorbell-${vp(info)}-light`);
    // the same ring for the user who holds door.unlock at the entrance
    await setup(page, { viewer: 'door' });
    await open(page);
    await openCenter(page, info);
    await openRow(page, N(2));
    await expect(page.locator('sw-app notify-center notify-detail [data-detail-act="door"]')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------------------------------------------------
test.describe('the states of the center', () => {
  test('loading: skeleton rows; the header and the footer stay', async ({ page }, info) => {
    await setup(page, { state: 'loading' });
    await open(page);
    await openCenter(page, info);
    await expect(page.locator('sw-app notify-center [data-center-state="loading"]')).toBeVisible();
    await expect(page.locator('sw-app notify-center [data-center-state="loading"] .skl').first()).toBeVisible();
    await expect(page.locator('sw-app notify-center [data-center-settings]')).toBeVisible();
    await shot(page, `state-loading-${vp(info)}-light`);
  });

  test('empty: "אין התראות"; the filters stay', async ({ page }, info) => {
    await setup(page, { state: 'empty' });
    await open(page);
    await openCenter(page, info);
    const s = page.locator('sw-app notify-center [data-center-state="empty"]');
    await expect(s).toContainText('אין התראות');
    await expect(s).toContainText('30 הימים האחרונים');
    await expect(page.locator('sw-app notify-center [data-center-readall]')).toBeDisabled();
    await shot(page, `state-empty-${vp(info)}-light`);
  });

  test('error: a clear line and "נסה שוב"; retry loads again', async ({ page }, info) => {
    await setup(page, { state: 'error' });
    await open(page);
    await openCenter(page, info);
    await expect(page.locator('sw-app notify-center [data-center-state="error"]')).toContainText('לא ניתן לטעון התראות');
    await expect(page.locator('sw-app notify-center [data-center-retry]')).toBeVisible();
    await shot(page, `state-error-${vp(info)}-light`);
    // the scenario clears: the retry now answers
    await page.evaluate(() => sessionStorage.setItem('sw-notify-mock', JSON.stringify({})));
    await page.locator('sw-app notify-center [data-center-retry]').click();
    await expect(page.locator('sw-app notify-center [data-center-state="ready"]')).toBeVisible();
  });

  test('quiet hours active: the banner says until when and what still passes', async ({ page }, info) => {
    await setup(page, { quietNow: true });
    await open(page);
    await openCenter(page, info);
    await expect(page.locator('sw-app notify-center [data-banner="quiet"]')).toHaveText(/שעות שקט עד 16:00 · נשלח רק קריטי/);
    await shot(page, `state-quiet-${vp(info)}-light`);
  });

  test('push unavailable on this device: the banner and its way out', async ({ page }, info) => {
    await setup(page, { push: 'unsupported', registered: 0 });
    await open(page);
    await openCenter(page, info);
    await expect(page.locator('sw-app notify-center [data-banner="push"]')).toContainText('התראות דחיפה לא נתמכות במכשיר הזה');
    await expect(page.locator('sw-app notify-center [data-banner="push"] [data-banner-act]')).toHaveText('איך מפעילים');
    await shot(page, `state-nopush-${vp(info)}-light`);
    await page.locator('sw-app notify-center [data-banner="push"] [data-banner-act]').click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/system/notifications');
  });

  test('delivery failed: the banner counts the rows and the failed row says so; dark', async ({ page }, info) => {
    await setup(page, { scheme: 'dark' });
    await open(page);
    await openCenter(page, info);
    await expect(page.locator('sw-app notify-center [data-banner="failed"]')).toContainText('המסירה לטלפון נכשלה · התראה אחת');
    await expect(rowOf(page, N(10)).locator('[data-row-tag="fail"]')).toBeVisible();
    await shot(page, `state-deliveryfail-${vp(info)}-dark`);
    // the banner's button opens the delivery log of the Settings tab
    await page.locator('sw-app notify-center [data-banner="failed"] [data-banner-act]').click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/system/notifications?section=log');
    await expect(sys(page).locator('#sec-log')).toBeVisible();
  });

  test('the full-screen presentation (notify.center_layout = page) on a wide screen; a phone always gets the bottom sheet', async ({ page }, info) => {
    await setup(page, { layout: 'page' });
    await open(page);
    await openCenter(page, info);
    await expect(center(page)).toHaveAttribute('data-presentation', phone(info) ? 'bottom_sheet' : 'page');
    if (!phone(info)) {
      const box = (await panel(page).boundingBox())!;
      expect(box.width).toBeGreaterThan(800); // the content column beside the rail, not a 480 px sheet
      await shot(page, 'center-page-1440-light');
    }
  });

  test('44 px targets on the phone: the bell, the filters, the row, its menu, the footer', async ({ page }, info) => {
    test.skip(!phone(info), 'the phone sheet');
    await setup(page);
    await open(page);
    await openCenter(page, info);
    const sel = ['[data-center-close]', '[data-center-readall]', '[data-filter="all"]', '[data-source-filter]', '[data-row-open]', '[data-row-more]', '[data-center-settings]'];
    for (const s of sel) {
      const b = (await page.locator(`sw-app notify-center ${s}`).first().boundingBox())!;
      expect(b.height, s).toBeGreaterThanOrEqual(43.5);
      expect(b.width, s).toBeGreaterThanOrEqual(43.5);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------
const sys = (page: Page) => page.locator('sw-app system-notifications');
const sec = (page: Page, id: string) => sys(page).locator(`[data-set-section="${id}"]`);
type MockApi = { settingsRow: Record<string, any>; policyRows: Record<string, any>[]; wouldSend: (s: string, c: string, e?: boolean) => boolean }; // eslint-disable-line @typescript-eslint/no-explicit-any
const mockState = <T,>(page: Page, fn: (m: MockApi) => T): Promise<T> => page.evaluate(`(${fn.toString()})(window.__swNotifyMock)`) as Promise<T>;
async function openSettings(page: Page, sc: Scenario = {}) {
  await setup(page, sc);
  await open(page, '/system/notifications');
  await expect(sys(page).locator('[data-notify-settings]')).toBeVisible();
}
async function scrollTo(page: Page, id: string) {
  await sec(page, id).evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(250);
}

test.describe('הגדרות › התראות (notify.manage)', () => {
  test('the eight sections in order, the matrix of every source, the two owner choices; 1440 / 820 light and dark', async ({ page }, info) => {
    await openSettings(page);
    await expect(sys(page).locator('[data-set-state="ready"]')).toBeVisible();
    await expect(page.locator('sw-app .subnav sw-tabs [aria-current="page"]')).toHaveText('התראות');
    if (!narrow(page, info)) {
      expect(await sys(page).locator('[data-set-section]').evaluateAll((els) => els.map((e) => e.getAttribute('data-set-section')))).toEqual(['sources', 'quiet', 'esc', 'lock', 'keep', 'mail', 'chan', 'log']);
      expect(await sys(page).locator('[data-set-nav]').evaluateAll((els) => els.map((e) => (e.textContent ?? '').trim()))).toEqual([
        'מקורות והרשאות – מה נשלח', 'שעות שקט ומה עובר', 'הסלמה', 'פרטיות מסך נעול', 'שמירה', 'דואר יוצא', 'ערוצים', 'יומן מסירה וכשלים',
      ]);
      await expect(sys(page).locator('[data-pol-row]')).toHaveCount(28); // every source of CR §5
      await expect(sys(page).locator('[data-pol-count]')).toHaveText('24 מתוך 28 פעילים'); // the rule-only sources and alarm.state are off by default
    }
    // the reserved channels are slots, never switches
    await expect(sys(page).locator('[data-pol-row="sensor.leak"] .chip.soon').first()).toHaveAttribute('aria-disabled', 'true');
    await expect(sys(page).locator('[data-pol-row="sensor.leak"] [data-pol-ch="sensor.leak:inbox"]')).toHaveCount(0);
    // the owner's second choice lives here: schedule / automation failures go to the administrators or to everyone who sees them
    await expect(sec(page, 'sources').locator('[data-failures-audience="admins"]')).toHaveAttribute('aria-pressed', 'true');
    await shot(page, `settings-${vp(info)}-light`);
    if (!narrow(page, info)) {
      await sys(page).evaluate((el) => el.setAttribute('data-devices-scheme', 'dark'));
      await shot(page, 'settings-1440-dark');
      await scrollTo(page, 'quiet');
      await shot(page, 'settings-scroll-quiet-esc-1440-dark');
      await scrollTo(page, 'lock');
      await shot(page, 'settings-lock-1440-dark');
      await sys(page).evaluate((el) => el.setAttribute('data-devices-scheme', 'light'));
      await scrollTo(page, 'mail');
      await shot(page, 'settings-scroll-mail-log-1440-light');
      await page.setViewportSize({ width: 820, height: 1180 }); // below 1100 px: the compact form, one section at a time
      await sys(page).locator('[data-set-nav="sources"]').click();
      await expect(sys(page).locator('[data-pol-row]')).toHaveCount(28);
      await shot(page, 'settings-820-light');
    }
  });

  test('sources: switch off, severity, recipients, channels - saved at once through the revisioned PUT, and shown again after a reload', async ({ page }, info) => {
    test.skip(narrow(page, info), 'the matrix is the wide-screen form; the phone has the cards (below)');
    await openSettings(page);
    const row = (s: string) => sys(page).locator(`[data-pol-row="${s}"]`);
    await row('sensor.leak').locator('[data-pol-on]').click();
    await expect(sys(page).locator('[data-pol-count]')).toHaveText('23 מתוך 28 פעילים');
    await expect.poll(() => mockState(page, (m) => m.policyRows.find((p) => p.source === 'sensor.leak')!.enabled)).toBe(false);
    await row('camera.offline').locator('[data-pol-sev="camera.offline:critical"]').click();
    await expect.poll(() => mockState(page, (m) => m.policyRows.find((p) => p.source === 'camera.offline')!.severity)).toBe('critical');
    await row('door.ring').locator('[data-pol-ch="door.ring:email"]').click();
    await expect.poll(() => mockState(page, (m) => m.policyRows.find((p) => p.source === 'door.ring')!.channels.email)).toBe(true);
    await row('door.ring').locator('select').selectOption('managers');
    await expect.poll(() => mockState(page, (m) => m.policyRows.find((p) => p.source === 'door.ring')!.recipients.rule)).toBe('managers');
    await expect(page.locator('sw-app system-notifications [data-set-toast]')).toBeVisible();
    // the revision moved with every save (no lost update): the policy row of the mock is at revision 2+
    expect(await mockState(page, (m) => m.policyRows.find((p) => p.source === 'sensor.leak')!.revision)).toBe(2);
    // a failure notification's recipients follow the owner's choice, not the row: the select is locked
    await expect(row('schedule.not_confirmed').locator('select')).toBeDisabled();
    await sec(page, 'sources').locator('[data-failures-audience="visible"]').click();
    await expect.poll(() => mockState(page, (m) => m.settingsRow.failures_audience)).toBe('visible');
    await expect(row('schedule.not_confirmed').locator('select')).toHaveValue('scope');
    // named users: the picker, saved only with at least one person
    await row('bulk.partial').locator('select').selectOption('users');
    await expect(page.locator('sw-app system-notifications [data-user-picker] .box')).toBeVisible();
    await expect(page.locator('sw-app system-notifications [data-pick-save]')).toBeDisabled();
    await page.locator('sw-app system-notifications [data-pick="u-dana"]').click();
    await page.locator('sw-app system-notifications [data-pick-save]').click();
    await expect.poll(() => mockState(page, (m) => JSON.stringify(m.policyRows.find((p) => p.source === 'bulk.partial')!.recipients))).toBe('{"rule":"users","user_ids":["u-dana"]}');
    await expect(row('bulk.partial').locator('select option:checked')).toContainText('משתמשים נבחרים (1)');
    // leave and come back: the server's rows are what is shown (the mock keeps its state until the page itself reloads)
    await page.evaluate(() => { location.hash = '#/system/diagnostics'; });
    await expect(sys(page)).toHaveCount(0);
    await page.evaluate(() => { location.hash = '#/system/notifications'; });
    await expect(sys(page).locator('[data-pol-count]')).toHaveText('23 מתוך 28 פעילים');
    await expect(sys(page).locator('[data-pol-row="sensor.leak"] [data-pol-on]')).toHaveAttribute('aria-checked', 'false');
  });

  test('the phone shows one card per source and one section at a time', async ({ page }, info) => {
    test.skip(!narrow(page, info), 'the phone form');
    await openSettings(page);
    await expect(sys(page).locator('[data-pol-row]')).toHaveCount(28);
    expect(await sys(page).locator('[data-set-section]').count()).toBe(1);
    await expect(sys(page).locator('[data-set-nav="sources"]')).toHaveAttribute('aria-current', 'true');
    for (const [id, name] of [['quiet', 'sec-quiet'], ['esc', 'sec-esc'], ['lock', 'sec-lock'], ['mail', 'sec-mail'], ['log', 'sec-log']]) {
      await sys(page).locator(`[data-set-nav="${id}"]`).click();
      await expect(sys(page).locator(`#${name}`)).toBeVisible();
      expect(await sys(page).locator('[data-set-section]').count()).toBe(1);
      await shot(page, `settings-${id}-390-light`);
    }
  });

  test('quiet hours: switch, times, days, the pass-through matrix; equal times are refused before the server is asked', async ({ page }, info) => {
    await openSettings(page, { quietNow: true });
    if (narrow(page, info)) await sys(page).locator('[data-set-nav="quiet"]').click();
    const q = sec(page, 'quiet');
    // default: only critical passes on push and mail
    expect(await mockState(page, (m) => [m.wouldSend('critical', 'webpush'), m.wouldSend('alert', 'webpush')])).toEqual([true, false]);
    await q.locator('[data-pass="alert:webpush"]').click();
    await expect(q.locator('[data-pass="alert:webpush"]')).toHaveAttribute('aria-checked', 'true');
    await expect.poll(() => mockState(page, (m) => m.settingsRow.pass_through.alert.webpush)).toBe(true);
    await q.locator('[data-pass="critical:email"]').click();
    await expect.poll(() => mockState(page, (m) => m.settingsRow.pass_through.critical.email)).toBe(false);
    await expect(q.locator('button[aria-label="Companion – בקרוב"]').first()).toBeDisabled();
    await q.locator('[data-quiet-day="fri"]').click();
    await expect.poll(() => mockState(page, (m) => m.settingsRow.quiet.days.includes('fri'))).toBe(false);
    await q.locator('[data-quiet-from]').fill('23:30');
    await expect.poll(() => mockState(page, (m) => m.settingsRow.quiet.from)).toBe('23:30');
    // from == to: refused here, nothing saved
    const rev = await mockState(page, (m) => m.settingsRow.revision);
    await q.locator('[data-quiet-to]').fill('23:30');
    await expect(q.locator('[data-set-error]')).toHaveText('שעת ההתחלה והסיום של שעות השקט זהות');
    expect(await mockState(page, (m) => m.settingsRow.revision)).toBe(rev);
    await q.locator('[data-quiet-to]').fill('06:15');
    await expect(q.locator('[data-set-error]')).toHaveCount(0);
    await expect.poll(() => mockState(page, (m) => m.settingsRow.quiet.to)).toBe('06:15');
    // off: the rows dim and the controls stop
    await q.locator('[data-tog="quiet-on"]').click();
    await expect(q.locator('[data-quiet-from]')).toBeDisabled();
    await expect(q.locator('[data-pass="critical:webpush"]')).toBeDisabled();
  });

  test('escalation: minutes, steps, whom; the preview follows; named users through the picker', async ({ page }, info) => {
    await openSettings(page);
    if (narrow(page, info)) await sys(page).locator('[data-set-nav="esc"]').click();
    const e = sec(page, 'esc');
    await expect(e.locator('[data-esc-min]')).toContainText('5');
    expect(await e.locator('[data-esc-preview] .ev').count()).toBe(4); // first send, 2 steps, the stop
    await e.locator('[data-esc-step="1"]').click();
    await e.locator('[data-esc-step="1"]').click();
    await expect(e.locator('[data-esc-min]')).toContainText('7');
    await e.locator('[data-esc-steps="3"]').click();
    expect(await e.locator('[data-esc-preview] .ev').count()).toBe(5);
    await expect(e.locator('[data-esc-preview] .ev').nth(1).locator('.t')).toHaveText('14:09'); // 14:02 + 7 min
    await expect.poll(() => mockState(page, (m) => JSON.stringify([m.settingsRow.escalation.after_min, m.settingsRow.escalation.steps]))).toBe('[7,3]');
    await e.locator('[data-esc-to="users"]').click();
    await page.locator('sw-app system-notifications [data-pick="u-yoni"]').click();
    await page.locator('sw-app system-notifications [data-pick="u-dana"]').click();
    await page.locator('sw-app system-notifications [data-pick-save]').click();
    await expect(e.locator('[data-esc-names]')).toHaveText('יוני, דנה');
    await expect.poll(() => mockState(page, (m) => JSON.stringify(m.settingsRow.escalation.to))).toBe('["u-yoni","u-dana"]');
    await expect(e.locator('[data-esc-preview]')).toContainText('יוני, דנה');
    await e.locator('[data-esc-to="managers"]').click();
    await expect.poll(() => mockState(page, (m) => m.settingsRow.escalation.to)).toBe('managers');
    // minutes stop at 1; the stop is always on
    for (let i = 0; i < 8; i += 1) await e.locator('[data-esc-step="-1"]').click();
    await expect(e.locator('[data-esc-min]')).toContainText('1');
    await shot(page, `settings-esc-${vp(info)}-light`);
    await e.locator('[data-tog="esc-on"]').click();
    await expect(e.locator('[data-esc-steps="2"]')).toBeVisible();
    expect(await e.locator('[data-esc-preview] .ev').count()).toBe(1);
  });

  test('lock-screen privacy: three phone previews built by the push code, the selected one marked; nothing carries a name or an image', async ({ page }, info) => {
    await openSettings(page);
    if (narrow(page, info)) await sys(page).locator('[data-set-nav="lock"]').click();
    const l = sec(page, 'lock');
    const text = async (level: string) => (await l.locator(`[data-lock-phone="${level}"]`).innerText()).replace(/\s+/g, ' ');
    if (!narrow(page, info)) {
      await expect(l.locator('[data-lock-phone]')).toHaveCount(3);
      expect(await text('generic')).toContain('התראה חדשה');
      expect(await text('generic')).not.toContain('מטבח');
      expect(await text('type_place')).toContain('דליפת מים · מטבח');
      expect(await text('type_place')).toContain('קריטי · 14:02');
      expect(await text('full')).toContain('חיישן ההצפה מתחת לכיור');
    }
    await expect(l.locator('[data-lock-phone][data-lock-selected="true"]')).toHaveAttribute('data-lock-phone', 'type_place'); // the default level
    await expect(l.locator('[data-lock-phone="type_place"]')).toContainText('פתח דלת'); // the doorbell button is a plain deep-link button
    await expect(l.locator('[data-lock-phone="generic"]')).not.toContainText('פתח דלת');
    await l.locator('[data-lock-level="full"]').click();
    await expect(l.locator('[data-lock-phone][data-lock-selected="true"]')).toHaveAttribute('data-lock-phone', 'full');
    await expect.poll(() => mockState(page, (m) => m.settingsRow.lockscreen)).toBe('full');
    expect(await l.locator('img').count()).toBe(0);
    // the two "soon" switches are off and locked
    await expect(l.locator('[data-tog="image-in-push"]')).toBeDisabled();
    await expect(l.locator('[data-tog="critical-sound"]')).toBeDisabled();
    await expect(l).toContainText('בקרוב');
    await shot(page, `settings-lock-${vp(info)}-light`);
    if (narrow(page, info)) {
      await sys(page).evaluate((el) => el.setAttribute('data-devices-scheme', 'dark'));
      await l.locator('[data-lock-level="generic"]').click();
      await shot(page, 'settings-lock-390-dark');
    }
  });

  test('retention, outgoing mail (validation, the write-only password, the test button and its result), the channels and the centre layout', async ({ page }, info) => {
    await openSettings(page);
    if (narrow(page, info)) await sys(page).locator('[data-set-nav="keep"]').click();
    await sec(page, 'keep').locator('[data-keep="60"]').click();
    await expect.poll(() => mockState(page, (m) => m.settingsRow.retention_days)).toBe(60);
    await expect(sec(page, 'keep')).toContainText('14');
    // mail
    if (narrow(page, info)) await sys(page).locator('[data-set-nav="mail"]').click();
    const m = sec(page, 'mail');
    await expect(m.locator('[data-mail-last]')).toContainText('נבדק 09:12 · תקין');
    await expect(m.locator('[data-mail-host]')).toHaveValue('mail.example.net');
    await expect(m.locator('[data-mail-linkbase]')).toHaveValue('');
    await expect(m.locator('[data-mail-linkbase]').locator('xpath=..')).toContainText('כתובת Arx לקישור');
    await expect(m.locator('[data-mail-password]')).toHaveValue('••••••••••'); // never the password: only that one is set
    await expect(m.locator('[data-mail-password]')).toHaveAttribute('readonly', '');
    expect(await sys(page).evaluate((el) => el.shadowRoot!.innerHTML.includes('hunter2'))).toBe(false);
    await m.locator('[data-mail-test]').click();
    await expect(m.locator('[data-mail-result="ok"]')).toHaveText('נשלח מייל בדיקה');
    await m.locator('[data-mail-host]').fill('bad host!');
    await m.locator('[data-mail-save]').click();
    await expect(m.locator('[data-mail-error]')).toHaveText('פרטי הדוא"ל אינם תקינים');
    await m.locator('[data-mail-host]').fill('smtp.example.net');
    await m.locator('[data-mail-linkbase]').fill('ftp://not-an-arx-address');
    await m.locator('[data-mail-save]').click();
    await expect(m.locator('[data-mail-error]')).toHaveText('פרטי הדוא"ל אינם תקינים'); // the link must be an http(s) address
    await m.locator('[data-mail-linkbase]').fill('https://arx.example.net/');
    await m.locator('[data-mail-host]').fill('smtp.bad.example');
    await m.locator('[data-mail-pw-change]').click();
    await m.locator('[data-mail-password]').fill('hunter2');
    await m.locator('[data-mail-save]').click();
    await expect(page.locator('sw-app system-notifications [data-set-toast]')).toContainText('הגדרות הדואר נשמרו');
    await expect(m.locator('[data-mail-password]')).toHaveValue('••••••••••'); // after the save the password is not in the form again
    expect(await sys(page).evaluate((el) => el.shadowRoot!.innerHTML.includes('hunter2'))).toBe(false);
    await m.locator('[data-mail-test]').click();
    await expect(m.locator('[data-mail-result="bad"]')).toHaveText('החיבור לשרת נדחה (connect)');
    expect(await mockState(page, (s) => s.settingsRow.email.link_base)).toBe('https://arx.example.net/'); // the link base reached the save
    await shot(page, `settings-mail-${vp(info)}-light`);
    // channels: the center, push, mail, and the two slots that are only slots; the centre layout is a choice here
    if (narrow(page, info)) await sys(page).locator('[data-set-nav="chan"]').click();
    const c = sec(page, 'chan');
    await expect(c.locator('[data-channel="inbox"]')).toContainText('פעיל תמיד');
    await expect(c.locator('[data-channel="ha_mobile"]')).toContainText('בקרוב');
    await expect(c.locator('[data-channel="whatsapp"]')).toContainText('בקרוב');
    await expect(c.locator('[data-channel="email"]')).toContainText('פעיל');
    await expect(c.locator('arx-notifications-settings')).toHaveCount(1); // this device's registration lives here
    await c.locator('[data-layout="page"]').click();
    await expect.poll(() => mockState(page, (s) => s.settingsRow.center_layout)).toBe('page');
    await shot(page, `settings-channels-${vp(info)}-light`);
    // the center now opens as a full screen on a wide screen (a phone keeps its bottom sheet)
    await page.evaluate(() => { location.hash = '#/devices/building'; }); // in the same page: the mock keeps its state until a reload
    await expect(page.locator('sw-app devices-building')).toHaveCount(1);
    await me(page, info).click();
    await page.locator('sw-app sw-user-menu [data-menu-alerts]').click();
    await expect(center(page)).toHaveAttribute('data-presentation', phone(info) ? 'bottom_sheet' : 'page');
  });

  test('the delivery log: the failures panel by channel, the table, "רק כשלים"', async ({ page }, info) => {
    await openSettings(page);
    if (narrow(page, info)) await sys(page).locator('[data-set-nav="log"]').click();
    const l = sec(page, 'log');
    await expect(l.locator('[data-fail-card="webpush"]')).toContainText('נכשלו');
    await expect(l.locator('[data-fail-card="webpush"] b')).toHaveText('2'); // the last 24 h; the table below reaches back 14 days
    await expect(l.locator('[data-fail-card="email"]')).toContainText('נשלחו');
    await expect(l.locator('[data-log-window]')).toHaveText('14 יום'); // the table's window; the panel's cards say "24 שעות"
    await expect(l.locator('[data-fail-card="webpush"] .ch')).toContainText('24 שעות');
    await expect(l.locator('[data-log-row]')).toHaveCount(14);
    await expect(l.locator('[data-log-filter="failed"] small')).toHaveText('3');
    await l.locator('[data-log-filter="failed"]').click();
    await expect(l.locator('[data-log-row]')).toHaveCount(3);
    for (const s of await l.locator('[data-log-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-log-status')))) expect(s).toBe('failed');
    await expect(l.locator('[data-log-row]').first()).toContainText('ההרשמה פגה (410)');
    await shot(page, `settings-log-${vp(info)}-dark-pre`);
    await sys(page).evaluate((el) => el.setAttribute('data-devices-scheme', 'dark'));
    await shot(page, `settings-log-${vp(info)}-dark`);
    // no endpoint or address anywhere in the log
    const textAll = await l.innerText();
    expect(textAll).not.toMatch(/https?:\/\//);
    expect(textAll).not.toContain('owner@example.net');
  });

  test('a stale revision: the screen says so and loads the server\'s state again', async ({ page }, info) => {
    test.skip(narrow(page, info), 'logic is the same on the phone');
    await openSettings(page);
    await mockState(page, (m) => { m.settingsRow.revision += 5; m.settingsRow.retention_days = 90; return 1; });
    await sec(page, 'keep').locator('[data-keep="14"]').click();
    await expect(page.locator('sw-app system-notifications [data-set-toast]')).toContainText('ההגדרות עודכנו במקום אחר');
    await expect(sec(page, 'keep').locator('[data-keep="90"]')).toHaveAttribute('aria-pressed', 'true');
  });

  test('a user without notify.manage: this device\'s registration only - no sections, no matrix', async ({ page }, info) => {
    await openSettings(page, { viewer: 'operator' });
    await expect(sys(page).locator('[data-set-state="user"]')).toBeVisible();
    await expect(sys(page).locator('[data-set-section]')).toHaveCount(0);
    await expect(sys(page).locator('[data-set-nav]')).toHaveCount(0);
    await expect(sys(page).locator('arx-notifications-settings')).toHaveCount(1);
    await expect(sys(page).locator('arx-notifications-settings [data-push-cat]')).toHaveCount(0); // no personal categories (owner 4ב)
    await expect(sys(page).locator('arx-notifications-settings [data-push-save]')).toHaveCount(0);
    await shot(page, `settings-user-${vp(info)}-light`);
  });

  test('mail not configured: "לא מוגדר", an empty form, the test waits for a saved configuration; the channel card says so', async ({ page }, info) => {
    await openSettings(page, { emailConfigured: false });
    if (narrow(page, info)) await sys(page).locator('[data-set-nav="mail"]').click();
    const m = sec(page, 'mail');
    await expect(m.locator('[data-mail-last]')).toHaveText('לא מוגדר');
    await expect(m.locator('[data-mail-host]')).toHaveValue('');
    await expect(m.locator('[data-mail-password]')).not.toHaveAttribute('readonly', ''); // nothing set yet: the field is open
    await expect(m.locator('[data-mail-test]')).toBeDisabled();
    await m.locator('[data-mail-host]').fill('smtp.example.net');
    await m.locator('[data-mail-user]').fill('arx@example.net');
    await m.locator('[data-mail-password]').fill('s3cret-value');
    await m.locator('[data-mail-from]').fill('Arx <arx@example.net>');
    await m.locator('[data-mail-recipients]').fill('owner@example.net');
    await m.locator('[data-mail-save]').click();
    await expect(page.locator('sw-app system-notifications [data-set-toast]')).toContainText('הגדרות הדואר נשמרו');
    await expect(m.locator('[data-mail-test]')).toBeEnabled();
    await expect(m.locator('[data-mail-password]')).toHaveValue('••••••••••');
    expect(await sys(page).evaluate((el) => el.shadowRoot!.innerHTML.includes('s3cret-value'))).toBe(false);
    if (narrow(page, info)) await sys(page).locator('[data-set-nav="chan"]').click();
    await expect(sec(page, 'chan').locator('[data-channel="email"]')).toContainText('פעיל');
  });
});
