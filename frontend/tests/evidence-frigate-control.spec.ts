import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN, installFrigate, newControlMock, newFrigateMock, openApp, type FrigateControlMock, type FrigateMock } from './frigate-mocks';

// NN5-F2: the Frigate control screens against a MOCKED backend (page.route on api/v1; the routes of routers/frigate_control.py): the operator's
// camera drawer on the live camera page (switches, the confirmation of a recording change, the profile) and the management in Settings (the
// write classes, the alarm mapping, the change log with undo). Three projects; SW_SHOTS=1 writes evidence screenshots to
// docs/design/evidence/nn5-f2. Names are made up: no real host, frame or credential.
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/nn5-f2');
const CONTROL_PERMS = [...ADMIN, 'analytics.control', 'analytics.record_control', 'analytics.profile'];
const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);

async function shot(page: Page, name: string) {
  if (!process.env.SW_SHOTS) return;
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}.png`) });
}

async function start(page: Page, hash: string, over: Partial<FrigateMock> = {}, ctl: Partial<FrigateControlMock> = {}): Promise<FrigateMock> {
  const m = newFrigateMock({ perms: CONTROL_PERMS, ctl: newControlMock({ classes: { analytics: true, record: true, profile: true, review: false, events: false, ptz: false }, ...ctl }), ...over });
  await installFrigate(page, m);
  await openApp(page, hash);
  return m;
}

const DRAWER = 'live-camera [data-frigate-camera-control]';
const writes = (m: FrigateMock, needle: string) => m.ctl.writes.filter((w) => w.includes(needle));

test.describe('operator: the camera drawer', () => {
  test('a camera of the Frigate recorder shows its switches; an analytics switch is one tap and nothing else', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const m = await start(page, '/live/cameras/fg-front');
    const box = page.locator(DRAWER);
    await expect(box).toBeVisible();
    await expect(box.locator('[data-fcc-group="analytics"] [data-fcc-row]')).toHaveCount(9);
    await expect(box.locator('[data-fcc-group="record"] [data-fcc-row]')).toHaveCount(3);
    await expect(box.locator('[data-fcc-switch="detect"]')).toHaveAttribute('checked', '');
    await expect(box.locator('[data-fcc-switch="audio"]')).not.toHaveAttribute('checked', '');
    const text = await box.innerText();
    expect(text).not.toMatch(/Home Assistant|Ingress|\bHA\b/);
    await noOverflow(page);
    await shot(page, 'drawer');
    await box.locator('[data-fcc-switch="audio"]').click();
    await expect.poll(() => writes(m, '/control/audio').length).toBe(1);
    expect(writes(m, '/control/audio')[0]).toContain('{"value":true,"confirm":false}');
    await expect(box.locator('[data-fcc-msg]')).toBeVisible();
    await expect(page.locator('[data-fcc-confirm]')).toHaveCount(0); // no dialog for analytics
    expect(errors).toEqual([]);
  });

  test('turning recording off asks first: cancelling sends nothing and puts the switch back; confirming sends confirm: true', async ({ page }) => {
    const m = await start(page, '/live/cameras/fg-front');
    const box = page.locator(DRAWER);
    await expect(box).toBeVisible();
    await box.locator('[data-fcc-switch="recordings"]').click();
    const dlg = page.locator('[data-fcc-confirm]');
    await expect(dlg.locator('[data-fcc-ok]')).toBeVisible();
    await expect(dlg).toHaveAttribute('heading', 'לכבות את ההקלטה?');
    await expect(dlg).toContainText('לא יישמרו קטעים');
    await shot(page, 'drawer-confirm');
    await dlg.locator('[data-fcc-cancel]').click();
    await expect(page.locator('[data-fcc-confirm]')).toHaveCount(0);
    expect(writes(m, '/control/recordings')).toHaveLength(0);
    await expect(box.locator('[data-fcc-switch="recordings"]')).toHaveAttribute('checked', '');
    await box.locator('[data-fcc-switch="recordings"]').click();
    await page.locator('[data-fcc-confirm] [data-fcc-ok]').click();
    await expect.poll(() => writes(m, '/control/recordings').length).toBe(1);
    expect(writes(m, '/control/recordings')[0]).toContain('{"value":false,"confirm":true}');
    await expect(box.locator('[data-fcc-switch="recordings"]')).not.toHaveAttribute('checked', '');
  });

  test('a refused change shows the server\'s own sentence and the switch goes back', async ({ page }) => {
    const m = await start(page, '/live/cameras/fg-front');
    const box = page.locator(DRAWER);
    await expect(box).toBeVisible();
    m.ctl.failWith = 'frigate_write_forbidden';
    await box.locator('[data-fcc-switch="motion"]').click();
    await expect(box.locator('[data-fcc-msg]')).toContainText('השינוי לא נשמר');
    await expect(box.locator('[data-fcc-msg]')).toContainText('המקליט דחה את השינוי');
    await expect(box.locator('[data-fcc-switch="motion"]')).toHaveAttribute('checked', ''); // as Frigate still has it
  });

  test('the profile is a select; a change asks for a confirmation and sends confirm: true', async ({ page }) => {
    const m = await start(page, '/live/cameras/fg-front');
    const box = page.locator(DRAWER);
    await expect(box.locator('[data-fcc-profile] select')).toHaveValue('home');
    await box.locator('[data-fcc-profile] select').selectOption('away');
    await expect(page.locator('[data-fcc-confirm]')).toHaveAttribute('heading', 'פרופיל: away');
    await page.locator('[data-fcc-confirm] [data-fcc-ok]').click();
    await expect.poll(() => writes(m, 'frigate/nvr-2/profile ').length).toBe(1);
    expect(writes(m, 'frigate/nvr-2/profile ')[0]).toContain('{"profile":"away","confirm":true}');
    expect(m.ctl.active).toBe('away');
  });

  test('without the permission, with the class off, or on a camera of another recorder, nothing is drawn', async ({ page }) => {
    await start(page, '/live/cameras/fg-front', { perms: ADMIN }); // no analytics.* permission
    await expect(page.locator('live-camera [data-live-still]')).toBeVisible();
    await expect(page.locator('live-camera frigate-camera-control [data-frigate-camera-control]')).toHaveCount(0);
    await page.goto('about:blank');
    await start(page, '/live/cameras/fg-front', {}, { classes: { analytics: false, record: false, profile: false, review: false, events: false, ptz: false } });
    await expect(page.locator('live-camera [data-live-still]')).toBeVisible();
    await expect(page.locator('live-camera frigate-camera-control [data-frigate-camera-control]')).toHaveCount(0);
    await page.goto('about:blank');
    await start(page, '/live/cameras/hk-1');
    await expect(page.locator('live-camera')).toBeVisible();
    await expect(page.locator('live-camera frigate-camera-control [data-frigate-camera-control]')).toHaveCount(0);
  });

  test('only the analytics permission: the recording group and the profile are not drawn', async ({ page }) => {
    await start(page, '/live/cameras/fg-front', { perms: [...ADMIN, 'analytics.control'] });
    const box = page.locator(DRAWER);
    await expect(box).toBeVisible();
    await expect(box.locator('[data-fcc-group="analytics"]')).toBeVisible();
    await expect(box.locator('[data-fcc-group="record"]')).toHaveCount(0);
    await expect(box.locator('[data-fcc-profile]')).toHaveCount(0);
  });
});

test.describe('settings: management of the writes', () => {
  async function openCard(page: Page, m: FrigateMock) {
    void m;
    await page.locator('nvr-recorders-card [data-recorder="nvr-2"] [data-recorder-connection]').click();
    const box = page.locator('nvr-recorders-card [data-frigate-control-settings]');
    await expect(box).toBeVisible();
    return box;
  }

  test('every class is listed, off until switched on; switching one on sends exactly that class; PTZ is not offered', async ({ page }) => {
    const m = await start(page, '/system/setup', {}, { classes: { analytics: false, record: false, profile: false, review: false, events: false, ptz: false, exports: false, cases: false } });
    const box = await openCard(page, m);
    await expect(box.locator('[data-fcs-class]')).toHaveCount(7); // FRGD: + exports and cases (F2b)
    await expect(box.locator('[data-fcs-class="ptz"]')).toHaveCount(0);
    for (const c of ['analytics', 'record', 'profile', 'review', 'events', 'exports', 'cases']) await expect(box.locator(`[data-fcs-toggle="${c}"]`)).not.toHaveAttribute('checked', '');
    await expect(box.locator('[data-fcs-class="record"]')).toContainText('דורש אישור בכל פעולה');
    await expect(box.locator('[data-fcs-class="analytics"]')).not.toContainText('דורש אישור בכל פעולה');
    await expect(box.locator('[data-fcs-class="exports"]')).toContainText('דורש אישור במחיקה');
    await box.locator('[data-fcs-toggle="analytics"]').click();
    await expect.poll(() => writes(m, 'control/policy').length).toBe(1);
    expect(writes(m, 'control/policy')[0]).toContain('{"classes":{"analytics":true}}');
    await expect(box.locator('[data-fcs-toggle="analytics"]')).toHaveAttribute('checked', '');
    // the summary above no longer claims the connection is read only
    await expect(page.locator('nvr-recorders-card [data-frigate-readonly]')).toContainText('חלק מהשינויים ב־Frigate מופעלים');
    await noOverflow(page);
    await shot(page, 'settings-classes');
  });

  test('a refused class change is reported and the switch goes back', async ({ page }) => {
    const m = await start(page, '/system/setup', {}, { classes: { analytics: false, record: false, profile: false, review: false, events: false, ptz: false } });
    const box = await openCard(page, m);
    m.ctl.failWith = 'frigate_ptz_not_released';
    await box.locator('[data-fcs-toggle="events"]').click();
    await expect(box.locator('[data-fcs-msg]')).toContainText('לא ניתן לשנות את ההגדרה');
    await expect(box.locator('[data-fcs-toggle="events"]')).not.toHaveAttribute('checked', '');
  });

  test('the alarm mapping stores a profile per state (a mapping only) and the log undoes a change, asking first for recording and profile', async ({ page }) => {
    const m = await start(page, '/system/setup');
    const box = await openCard(page, m);
    // FRGD: the card has tabs - the mapping sits under "פרופילים", the log under "יומן שינויים"
    await box.locator('[data-fcs-tabs]').getByRole('button', { name: 'פרופילים' }).click();
    await expect(box.locator('[data-fcs-rule="armed_away"]')).toHaveValue('away');
    await box.locator('[data-fcs-rule="disarmed"]').selectOption('home');
    await expect.poll(() => writes(m, 'profile-rules').length).toBe(1);
    expect(writes(m, 'profile-rules')[0]).toContain('{"rules":{"disarmed":"home"}}');
    expect(writes(m, 'frigate/nvr-2/profile ')).toHaveLength(0); // nothing was switched
    await box.locator('[data-fcs-tabs]').getByRole('button', { name: 'יומן שינויים' }).click();
    await expect(box.locator('[data-change]')).toHaveCount(3);
    await expect(box.locator('[data-change="ch1"]')).toContainText('זיהוי אובייקטים: כבוי');
    await expect(box.locator('[data-change="ch3"] [data-change-status="reverted"]')).toBeVisible();
    await expect(box.locator('[data-change="ch3"] [data-change-undo]')).toHaveCount(0);
    await noOverflow(page);
    await shot(page, 'settings-log');
    if (process.env.SW_SHOTS) {
      fs.mkdirSync(OUT, { recursive: true });
      await box.screenshot({ path: path.join(OUT, `settings-control-card-${test.info().project.name}.png`) });
    }
    await box.locator('[data-change="ch1"] [data-change-undo]').click();
    await expect.poll(() => writes(m, 'changes/ch1/revert').length).toBe(1);
    expect(writes(m, 'changes/ch1/revert')[0]).toContain('{"confirm":false}');
    await expect(box.locator('[data-change="ch1"] [data-change-status="reverted"]')).toBeVisible();
    await box.locator('[data-change="ch2"] [data-change-undo]').click();
    await expect(page.locator('[data-fcs-confirm] [data-fcs-ok]')).toBeVisible();
    expect(writes(m, 'changes/ch2/revert')).toHaveLength(0);
    await page.locator('[data-fcs-confirm] [data-fcs-ok]').click();
    await expect.poll(() => writes(m, 'changes/ch2/revert').length).toBe(1);
    expect(writes(m, 'changes/ch2/revert')[0]).toContain('{"confirm":true}');
  });
});

test.describe('operator: the review detail (retain and sub-label)', () => {
  const EVENT_PERMS = [...CONTROL_PERMS, 'analytics.events'];
  const reviewStart = async (page: Page, perms: string[], eventsOn: boolean, ctl: Partial<FrigateControlMock> = {}) => {
    const m = newFrigateMock({ perms, ctl: newControlMock({ classes: { analytics: false, record: false, profile: false, review: false, events: eventsOn, ptz: false }, ...ctl }) });
    await installFrigate(page, m);
    await openApp(page, '/investigate/reviews');
    const card = page.locator('investigate-reviews frigate-review-card').nth(1); // rv-2: person + dog
    await card.locator('[data-review-open]').click();
    await expect(page.locator('investigate-reviews [data-review-detail]')).toBeVisible();
    return m;
  };
  const ROW = (id: string) => `investigate-reviews frigate-event-control [data-event-control="${id}"]`;

  test('a person who may change events sees one row per tracked object: retain is one tap, the sub-label saves on its button', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const m = await reviewStart(page, EVENT_PERMS, true);
    const sec = page.locator('investigate-reviews [data-review-events]');
    await expect(sec.locator('frigate-event-control[ready]')).toHaveCount(2);
    const first = page.locator(ROW('rv-2-d0'));
    await expect(first).toBeVisible();
    await expect(first.locator('.lead')).toHaveText('אדם');
    await expect(page.locator(ROW('rv-2-d1')).locator('.lead')).toHaveText('כלב');
    const text = await sec.innerText();
    expect(text).not.toMatch(/Home Assistant|Ingress|HA/);
    await noOverflow(page);
    await shot(page, 'review-event-controls');

    await first.locator('[data-event-retain]').click();
    await expect.poll(() => writes(m, '/events/rv-2-d0/retain').length).toBe(1);
    expect(writes(m, '/events/rv-2-d0/retain')[0]).toContain('{"retain":true}');
    await expect(first.locator('[data-event-msg]')).toContainText('נשמר');
    await expect(first.locator('[data-event-retain]')).toHaveAttribute('checked', '');

    const save = first.locator('[data-event-sub-label-save]');
    await expect(save).toHaveAttribute('disabled', '');
    await first.locator('[data-event-sub-label]').fill('דנה');
    await expect(save).not.toHaveAttribute('disabled', '');
    await save.click();
    await expect.poll(() => writes(m, '/events/rv-2-d0/sub-label').length).toBe(1);
    expect(writes(m, '/events/rv-2-d0/sub-label')[0]).toContain('{"sub_label":"דנה"}');
    await expect(save).toHaveAttribute('disabled', ''); // nothing left to save
    expect(m.ctl.events['rv-2-d0']).toEqual({ retain: true, sub_label: 'דנה' });
    expect(writes(m, '/events/rv-2-d1')).toHaveLength(0);
    expect(errors).toEqual([]);
  });

  test('a refused change shows the server sentence, puts the switch back and keeps the controls', async ({ page }) => {
    const m = await reviewStart(page, EVENT_PERMS, true);
    m.ctl.failWith = 'frigate_write_forbidden';
    const row = page.locator(ROW('rv-2-d0'));
    await row.locator('[data-event-retain]').click();
    await expect(row.locator('[data-event-msg]')).toContainText('המקליט דחה את השינוי');
    await expect(row.locator('[data-event-retain]')).not.toHaveAttribute('checked', '');
    expect(m.ctl.events['rv-2-d0'].retain).toBe(false);
  });

  test('nothing is drawn without the permission or while the events class is off (and no event is read without the permission)', async ({ page }) => {
    const off = await reviewStart(page, EVENT_PERMS, false);
    await expect(page.locator('investigate-reviews [data-review-detail]')).toBeVisible();
    await expect.poll(() => off.hits.filter((h) => h.includes('/events/')).length).toBeGreaterThan(0);
    await expect(page.locator('investigate-reviews frigate-event-control[ready]')).toHaveCount(0);
    await expect(page.locator('investigate-reviews [data-review-events]')).toBeHidden();
    expect(off.ctl.writes).toEqual([]);
  });

  test('without analytics.events the review detail never asks about events', async ({ page }) => {
    const m = await reviewStart(page, CONTROL_PERMS, true);
    await expect(page.locator('investigate-reviews [data-review-detail]')).toBeVisible();
    await expect(page.locator('investigate-reviews [data-review-events]')).toHaveCount(0);
    expect(m.hits.filter((h) => h.includes('/events/'))).toEqual([]);
  });
});
