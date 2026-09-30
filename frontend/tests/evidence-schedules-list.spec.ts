import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ScheduleDemoStore } from '../src/api/schedules-mock';
import { ApiError } from '../src/api/client';

// CR-014 S3: the schedules list ("תזמונים", the second tab of the home area), its drawer, the trash, the review list and
// הגדרות › תזמונים - in demo mode (no backend: api/schedules-mock.ts answers, personas through localStorage
// `sw.demo.schedules`). The last describe block runs with a session (a mocked backend that answers the schedules routes from an
// in-process demo store) and checks the permission-gated navigation and what the client sends.
//   SW_BASE_URL=http://127.0.0.1:4791/ npx playwright test tests/evidence-schedules-list.spec.ts --project=desktop --project=mobile --workers=1

const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/evidence/CR014-s3');

interface Control {
  persona?: 'admin' | 'manager' | 'viewer' | 'none';
  availability?: 'ok' | 'component_missing' | 'ha_unavailable' | 'feature_disabled' | 'error';
  empty?: boolean;
}
type Info = { project: { name: string } };

/** Test doubles for S4's elements (not part of this branch): the list only renders them by tag, so their contract is checked here. */
async function installDoubles(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __doubles: Record<string, unknown> };
    w.__doubles = {};
    class Week extends HTMLElement {
      set schedules(v: unknown[]) {
        this.setAttribute('data-count', String(v.length));
        this.textContent = `week ${v.length}`;
      }
      set snap(v: number) {
        this.setAttribute('data-snap', String(v));
      }
      set sun(v: unknown) {
        this.setAttribute('data-sun', v ? 'set' : 'none');
      }
    }
    class Create extends HTMLElement {
      set open(v: boolean) {
        this.setAttribute('data-open', String(v));
        if (v && !this.querySelector('button')) {
          const b = document.createElement('button');
          b.textContent = 'create-double';
          b.setAttribute('data-create-double', '');
          b.onclick = () => this.dispatchEvent(new CustomEvent('created', { detail: { id: '3f9a1c' }, bubbles: true }));
          this.append(b);
        }
      }
    }
    class Lowering extends HTMLElement {
      set summary(v: { text: string }) {
        (window as unknown as { __doubles: Record<string, unknown> }).__doubles.lowering = v;
        let t = this.querySelector('span');
        if (!t) {
          t = document.createElement('span');
          this.prepend(t);
        }
        t.textContent = v.text;
      }
      set needsCode(_v: boolean) {
        /* the double has no code field */
      }
      set open(v: boolean) {
        if (v && !this.querySelector('button')) {
          const b = document.createElement('button');
          b.textContent = 'confirm-double';
          b.setAttribute('data-lowering-confirm', '');
          b.onclick = () => this.dispatchEvent(new CustomEvent('confirm', { detail: { alarm_code: null }, bubbles: true }));
          this.append(b);
        }
      }
    }
    customElements.define('schedules-week-view', Week);
    customElements.define('schedule-create-dialog', Create);
    customElements.define('schedule-lowering-dialog', Lowering);
  });
}

async function open(page: Page, hash: string, control: Control = {}) {
  // demo mode whatever runs on the preview's proxy target: no backend answers this page
  await page.route('**/api/v1/**', (route) => route.abort());
  await page.addInitScript((c) => {
    try {
      localStorage.setItem('sw.demo.schedules', JSON.stringify(c));
      localStorage.removeItem('sw.schedules.view');
      localStorage.removeItem('sw.schedules.filters');
    } catch {
      /* storage unavailable */
    }
  }, control);
  await page.goto('about:blank');
  await page.goto(`/?design=a#${hash}`);
  await page.waitForSelector('sw-app');
}

const phone = (info: Info) => info.project.name === 'mobile';
const size = (info: Info) => (phone(info) ? '390' : '1440');
const scr = (page: Page) => page.locator('sw-app devices-schedules');
const card = (page: Page, id: string) => scr(page).locator(`article.card[data-schedule="${id}"]`);
const hashOf = (page: Page) => page.evaluate(() => location.hash);

async function shot(page: Page, name: string, info: Info) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(EVIDENCE, `${name}-${size(info)}.png`) });
}

async function ready(page: Page) {
  await expect(scr(page).locator('[data-sched-grid], [data-sched-table], .empty')).toBeVisible();
}

/** On the phone the filters sit behind "סינון". */
async function filters(page: Page) {
  const toggle = scr(page).locator('[data-filters-toggle]');
  if (await toggle.isVisible()) {
    if ((await scr(page).locator('.extra[data-open]').count()) === 0) await toggle.click();
  }
}

test.describe('the schedules list (demo mode)', () => {
  test('cards: the summary strip, the toolbar, one card per schedule; the home tabs', async ({ page }, info) => {
    await open(page, '/devices/schedules');
    await ready(page);
    await expect(page.locator('sw-app .subnav sw-tabs a')).toHaveText(['מבט על', 'תזמונים']);
    await expect(page.locator('sw-app .subnav sw-tabs a[aria-current="page"]')).toHaveText('תזמונים');
    await expect(scr(page).locator('article.card')).toHaveCount(13);
    await expect(scr(page).locator('[data-kpi="active"] .big')).toContainText('10');
    await expect(scr(page).locator('[data-upcoming]').first()).toBeVisible();
    // the conditional next run says "בתנאי" (never a promise)
    await expect(card(page, '3f9a1c').locator('[data-next-run]')).toContainText('בתנאי');
    await expect(card(page, '3f9a1c').locator('schedule-condition-chip')).toHaveCount(1);
    await expect(card(page, 'e19b70').locator('sw-schedule-markers')).toHaveCount(1);
    await shot(page, '01-list-cards', info);
  });

  test('table: one row per schedule with the slots, the condition column and the next run', async ({ page }, info) => {
    await open(page, '/devices/schedules');
    await ready(page);
    await scr(page).locator('[data-view-btn="table"]').click();
    await expect(scr(page).locator('[data-sched-table] .tr[data-schedule]')).toHaveCount(13);
    await expect.poll(() => hashOf(page)).toContain('view=table');
    await expect(scr(page).locator('.tr[data-schedule="3f9a1c"] schedule-condition-chip')).toHaveCount(1);
    await expect(scr(page).locator('.tr[data-schedule="3f9a1c"] .sr')).toHaveCount(3); // three slots shown, the rest behind "ועוד"
    await shot(page, '02-list-table', info);
    // a reload keeps the view (the address carries it)
    await page.reload();
    await expect(scr(page).locator('[data-sched-table]')).toBeVisible();
  });

  test('week: the view is S4\'s element, rendered by tag with the visible schedules; a bar opens the drawer', async ({ page }) => {
    await installDoubles(page);
    await open(page, '/devices/schedules?view=week');
    const week = scr(page).locator('schedules-week-view');
    await expect(week).toHaveAttribute('data-count', '13');
    await expect(week).toHaveAttribute('data-snap', '15');
    await week.evaluate((el) => el.dispatchEvent(new CustomEvent('open-schedule', { detail: { id: '4d6e0a' }, bubbles: true })));
    await expect.poll(() => hashOf(page)).toContain('/devices/schedules/4d6e0a');
  });

  test('"תזמון חדש": S4\'s create dialog when it exists (created → the drawer of the new schedule), else the editor route', async ({ page }) => {
    await open(page, '/devices/schedules');
    await ready(page);
    await scr(page).locator('[data-new-schedule]').first().click();
    await expect.poll(() => hashOf(page)).toBe('#/devices/schedules/new/edit');

    await installDoubles(page);
    await open(page, '/devices/schedules');
    await ready(page);
    await scr(page).locator('[data-new-schedule]').first().click();
    await expect(scr(page).locator('schedule-create-dialog')).toHaveAttribute('data-open', 'true');
    await scr(page).locator('[data-create-double]').click();
    await expect.poll(() => hashOf(page)).toContain('/devices/schedules/3f9a1c');
    await expect(scr(page).locator('schedule-drawer sw-drawer')).toHaveAttribute('open', '');
  });

  test('the drawer: slots, conditions with their state, next and last runs; closing returns to the list', async ({ page }, info) => {
    await open(page, '/devices/schedules');
    await ready(page);
    await card(page, '4d6e0a').locator('a.name').click();
    await expect.poll(() => hashOf(page)).toContain('/devices/schedules/4d6e0a');
    const drawer = scr(page).locator('schedule-drawer');
    await expect(drawer.locator('sw-drawer')).toHaveAttribute('heading', 'תאורת משרדים – שעות עבודה');
    await expect(drawer.locator('[data-slot-row]')).toHaveCount(2);
    await expect(drawer.locator('[data-drawer-conditions]')).toContainText('איסור מלאכה');
    await expect(drawer.locator('[data-drawer-conditions]')).toContainText('כרגע: מתקיים'); // "לא בשבת ובחג" = the sensor is off, and it is off in the demo
    await expect(drawer.locator('[data-drawer-upcoming] .li').first()).toBeVisible();
    await expect(drawer.locator('[data-drawer-runs] .li').first()).toBeVisible();
    await shot(page, '04-detail-drawer', info);
    await drawer.locator('sw-drawer [data-drawer-close]').click();
    await expect.poll(() => hashOf(page)).toBe('#/devices/schedules');
  });

  test('search, the Shabbat / holiday filters, a day, grouping and sorting; the address keeps them', async ({ page }) => {
    await open(page, '/devices/schedules');
    await ready(page);
    await filters(page);
    const cards = scr(page).locator('article.card');
    await scr(page).locator('[data-filter="q"]').fill('תריס');
    await expect(cards).toHaveCount(1);
    await expect.poll(() => hashOf(page)).toContain('q=');
    await scr(page).locator('[data-filter="q"]').fill('');
    await expect(cards).toHaveCount(13);

    await scr(page).locator('[data-chip-preset="not_holy_days"]').click();
    await expect(cards).toHaveCount(3);
    await expect.poll(() => hashOf(page)).toContain('preset=not_holy_days');
    await scr(page).locator('[data-chip-preset="only_holy_days"]').click();
    await expect(cards).toHaveCount(3);
    await scr(page).locator('[data-chip-has-cond]').click();
    await scr(page).locator('[data-clear-filters]').first().click();
    await expect(cards).toHaveCount(13);

    await scr(page).locator('[data-chip-tag="שבת-חג"]').click();
    await expect(cards).toHaveCount(4);
    await scr(page).locator('[data-clear-filters]').first().click();

    await scr(page).locator('[data-day-filter="sat"]').click(); // the Sunday-to-Thursday schedules drop out
    await expect(cards).toHaveCount(10);
    await scr(page).locator('[data-clear-filters]').first().click();

    await scr(page).locator('[data-filter="group"]').selectOption('tag');
    await expect(scr(page).locator('.group[data-group]')).toHaveCount(5); // שבת-חג, משרדים, חוץ, אולם, and the catch-all "ללא תג"
    await expect(scr(page).locator('.group[data-group]').last()).toHaveAttribute('data-group', 'ללא תג');
    await scr(page).locator('[data-filter="group"]').selectOption('');
    await scr(page).locator('[data-filter="sort"]').selectOption('name');
    await expect(cards.first().locator('a.name')).toHaveText('דריכת אזעקה – לילה');
  });

  test('a filter that matches nothing says so and offers to clear it', async ({ page }) => {
    await open(page, '/devices/schedules');
    await ready(page);
    await filters(page);
    await scr(page).locator('[data-filter="q"]').fill('zzzz');
    await expect(scr(page).locator('[data-sched-state="no-match"]')).toBeVisible();
    await scr(page).locator('[data-sched-state="no-match"] [data-clear-filters]').click();
    await expect(scr(page).locator('article.card')).toHaveCount(13);
  });

  test('a card toggle switches the schedule; the bulk bar disables several at once; a lowering schedule is enabled one by one', async ({ page }) => {
    await installDoubles(page);
    await open(page, '/devices/schedules');
    await ready(page);
    const toggle = (id: string) => card(page, id).locator('sw-toggle');
    await expect(card(page, '8b21d4')).toHaveAttribute('data-enabled', 'false');
    await toggle('8b21d4').locator('button').click();
    await expect(card(page, '8b21d4')).toHaveAttribute('data-enabled', 'true');
    await expect(scr(page).locator('[data-sched-note]')).toContainText('הופעל');

    // bulk: two selected, "השבתה"
    await card(page, '3f9a1c').locator('input[data-select]').check();
    await card(page, 'c07e55').locator('input[data-select]').check();
    await expect(scr(page).locator('[data-bulk-bar]')).toContainText('2 נבחרו');
    await scr(page).locator('[data-bulk-disable]').click();
    await expect(card(page, '3f9a1c')).toHaveAttribute('data-enabled', 'false');
    await expect(card(page, 'c07e55')).toHaveAttribute('data-enabled', 'false');
    await expect(scr(page).locator('[data-sched-note]')).toContainText('הושבתו 2');
    await expect(scr(page).locator('[data-bulk-bar]')).toHaveCount(0);

    // a lowering schedule: enabling goes through S4's confirmation, with the summary sentence
    await expect(card(page, 'd8e3a7')).toHaveAttribute('data-enabled', 'false');
    await toggle('d8e3a7').locator('button').click();
    await expect(scr(page).locator('schedule-actions schedule-lowering-dialog')).toContainText('יפתח שער חניה');
    await scr(page).locator('[data-lowering-confirm]').click();
    await expect(card(page, 'd8e3a7')).toHaveAttribute('data-enabled', 'true');
    // and bulk enable skips it
    await toggle('d8e3a7').locator('button').click();
    await expect(scr(page).locator('schedule-lowering-dialog')).toHaveCount(0); // disabling needs no confirmation
    await expect(card(page, 'd8e3a7')).toHaveAttribute('data-enabled', 'false');
    await card(page, 'd8e3a7').locator('input[data-select]').check();
    await scr(page).locator('[data-bulk-enable]').click();
    await expect(scr(page).locator('[data-sched-note]')).toContainText('אחד־אחד');
    await expect(card(page, 'd8e3a7')).toHaveAttribute('data-enabled', 'false');
  });

  test('run now: the slot is chosen, the request is confirmed; copy asks for a name; delete asks, then offers the undo', async ({ page }) => {
    await open(page, '/devices/schedules/5a13f2');
    const drawer = scr(page).locator('schedule-drawer');
    await expect(drawer.locator('sw-drawer')).toHaveAttribute('open', '');
    await drawer.locator('[data-drawer-run]').click();
    const confirm = drawer.locator('[data-run-confirm]');
    await expect(confirm.locator('button')).toBeDisabled(); // two slots: none chosen yet
    await drawer.locator('[data-run-slot="1"]').check();
    await confirm.click();
    await expect(drawer.locator('[data-drawer-status]')).toContainText('הבקשה נשלחה');

    await drawer.locator('[data-drawer-copy]').click();
    await expect(drawer.locator('[data-copy-name]')).toHaveValue('העתק של תריס אולם – קיץ');
    await drawer.locator('[data-copy-confirm]').click();
    await expect(drawer.locator('sw-drawer')).toHaveAttribute('heading', 'העתק של תריס אולם – קיץ');
    await expect(scr(page).locator('article.card')).toHaveCount(14);

    await drawer.locator('[data-drawer-delete]').click();
    await drawer.locator('[data-delete-confirm]').click();
    await expect.poll(() => hashOf(page)).toBe('#/devices/schedules');
    await expect(scr(page).locator('article.card')).toHaveCount(13);
    await expect(scr(page).locator('[data-sched-note]')).toContainText('נשמר בסל המחזור');
    await scr(page).locator('[data-note-action]').click();
    await expect(scr(page).locator('article.card')).toHaveCount(14);
  });

  test('the trash: the deleted schedule with its remaining days, restore', async ({ page }, info) => {
    await open(page, '/devices/schedules/trash');
    const item = scr(page).locator('[data-trash-item]');
    await expect(item).toHaveCount(1);
    await expect(item).toContainText('תאורת לובי – ישן');
    await expect(item).toContainText('נשמר עוד 27 ימים');
    await shot(page, '10-trash', info);
    await item.locator('[data-restore]').click();
    await expect(scr(page).locator('[data-sched-state="trash-empty"]')).toBeVisible();
    await expect(scr(page).locator('[data-sched-note]')).toContainText('שוחזר');
  });

  test('the review list (administrator): the issues, a bulk disable', async ({ page }, info) => {
    await open(page, '/devices/schedules/review');
    const items = scr(page).locator('[data-review-item]');
    await expect(items).toHaveCount(2);
    await expect(scr(page).locator('[data-issue="owner_lost_rights"]')).toBeVisible();
    await expect(scr(page).locator('[data-issue="unsupported_content"]')).toBeVisible();
    await shot(page, '11-review', info);
    await scr(page).locator('input[data-review-select="a0f4c9"]').check();
    await scr(page).locator('[data-review-disable]').click();
    await expect(scr(page).locator('[data-sched-note]')).toContainText('הושבתו 1');
  });
});

test.describe('states (demo mode)', () => {
  test('loading: skeleton cards', async ({ page }, info) => {
    await open(page, '/devices/schedules?state=loading');
    await expect(scr(page).locator('[data-sched-state="loading"]')).toBeVisible();
    await shot(page, '13-state-loading', info);
  });

  test('empty: no schedules yet', async ({ page }, info) => {
    await open(page, '/devices/schedules', { empty: true });
    await expect(scr(page).locator('[data-sched-state="empty"]')).toContainText('אין עדיין תזמונים');
    await expect(scr(page).locator('[data-sched-state="empty"] [data-new-schedule]')).toBeVisible();
    await shot(page, '14-state-empty', info);
  });

  test('component missing: the operator wording, and the administrator\'s with the way to the settings', async ({ page }, info) => {
    await open(page, '/devices/schedules', { persona: 'viewer', availability: 'component_missing' });
    const s = scr(page).locator('[data-sched-state="missing"]');
    await expect(s).toContainText('אין תזמונים להצגה');
    await expect(s).toContainText('הפעלת התזמונים מנוהלת בהגדרות.');
    await expect(s).not.toContainText(/Home Assistant|HA\b/);
    await shot(page, '14-state-missing-operator', info);

    await open(page, '/devices/schedules', { persona: 'admin', availability: 'component_missing' });
    const a = scr(page).locator('[data-sched-state="missing_admin"]');
    await expect(a).toContainText('רכיב התזמונים אינו מחובר');
    await expect(a).not.toContainText(/Home Assistant|HA\b/);
    await shot(page, '15-state-missing-admin', info);
    await a.locator('[data-open-settings]').click();
    await expect.poll(() => hashOf(page)).toBe('#/system/schedules');
  });

  test('view only: read-only banner, nothing to create, toggles and run disabled', async ({ page }, info) => {
    await open(page, '/devices/schedules', { persona: 'viewer' });
    await ready(page);
    await expect(scr(page).locator('[data-sched-readonly]')).toContainText('מצב צפייה');
    await expect(scr(page).locator('[data-new-schedule]').first().locator('button')).toBeDisabled();
    await expect(card(page, '4d6e0a').locator('sw-toggle button')).toBeDisabled();
    await expect(card(page, '4d6e0a').locator('[data-run] button')).toBeDisabled();
    await shot(page, '16-state-view-only', info);
    await card(page, '4d6e0a').locator('a.name').click();
    const drawer = scr(page).locator('schedule-drawer');
    await expect(drawer.locator('[data-drawer-readonly]')).toBeVisible();
    await expect(drawer.locator('[data-drawer-delete] button')).toBeDisabled();
  });

  test('a floor-scoped editor: the sensitive schedule is read only, a condition outside the scope is locked', async ({ page }) => {
    await open(page, '/devices/schedules/e19b70', { persona: 'manager' });
    const drawer = scr(page).locator('schedule-drawer');
    await expect(drawer.locator('[data-drawer-readonly]')).toContainText('הרשאה');
    await expect(drawer.locator('[data-drawer-edit] button')).toBeDisabled();
    await open(page, '/devices/schedules/2c9f61', { persona: 'manager' });
    await expect(scr(page).locator('schedule-drawer [data-condition-locked]')).toContainText('מחוץ להרשאתך');
  });

  test('stale: the list from the last known data, with the connection notice', async ({ page }) => {
    await open(page, '/devices/schedules', { availability: 'ha_unavailable' });
    await ready(page);
    await expect(scr(page).locator('[data-sched-stale]')).toContainText('המידע אינו מעודכן');
    await expect(scr(page).locator('[data-sched-stale]')).not.toContainText(/Home Assistant|HA\b/);
    await expect(scr(page).locator('[data-new-schedule]').first().locator('button')).toBeDisabled();
  });

  test('feature off, and no view permission', async ({ page }) => {
    await open(page, '/devices/schedules', { availability: 'feature_disabled' });
    await expect(scr(page).locator('[data-sched-state="feature_disabled"]')).toContainText('התזמונים כבויים');
    await open(page, '/devices/schedules', { persona: 'none' });
    await expect(scr(page).locator('[data-sched-state="no_permission"]')).toBeVisible();
  });

  test('a schedule that does not exist: the drawer says so', async ({ page }) => {
    await open(page, '/devices/schedules/ffffff');
    await expect(scr(page).locator('schedule-drawer [data-drawer-missing]')).toBeVisible();
  });
});

test.describe('the home tabs and the settings page (demo mode)', () => {
  test('"מבט על" is the home screen as it was, the first of two tabs (the layout editor\'s row rule is under "with a session")', async ({ page }, info) => {
    await open(page, '/devices/building');
    await expect(page.locator('sw-app devices-building')).toHaveCount(1);
    await expect(page.locator('sw-app .subnav sw-tabs a')).toHaveText(['מבט על', 'תזמונים']);
    await expect(page.locator('sw-app .subnav sw-tabs a[aria-current="page"]')).toHaveText('מבט על');
    await shot(page, '20-home-overview-tab', info);
    await page.locator('sw-app .subnav sw-tabs a', { hasText: 'תזמונים' }).click();
    await expect(page.locator('sw-app devices-schedules')).toHaveCount(1);
  });

  test('הגדרות › תזמונים: connection, switch, the sensor picker, classes, defaults, who may do what; saved changes', async ({ page }, info) => {
    await open(page, '/system/schedules');
    const s = page.locator('sw-app system-schedules');
    await expect(s.locator('[data-schedules-settings]')).toBeVisible();
    await expect(s.locator('[data-component-line]')).toContainText('גרסה 3.3.8');
    await expect(s.locator('[data-shabbat-sensor] option')).toContainText(['ללא חיישן', 'איסור מלאכה · מומלץ']);
    await expect(s.locator('[data-class]')).toHaveCount(8);
    await expect(s.locator('[data-sched-roles] tbody tr')).toHaveCount(5);
    await shot(page, '12-settings', info);
    await expect(s.locator('[data-settings-bar]')).toHaveCount(0);
    await s.locator('[data-class="fan"]').locator('button').click();
    await s.locator('[data-snap="30"]').click();
    await s.locator('[data-shabbat-sensor]').selectOption('');
    await expect(s.locator('[data-settings-bar]')).toContainText('שינויים שלא נשמרו');
    await s.locator('[data-settings-save]').click();
    await expect(s.locator('[data-settings-saved]')).toBeVisible();
    await expect(s.locator('[data-settings-bar]')).toHaveCount(1); // the confirmation stays a moment, without buttons
    await expect(s.locator('[data-settings-save]')).toHaveCount(0);
    await s.locator('[data-help-toggle]').click();
    await expect(s.locator('[data-help]')).toContainText('2024.11.0');
  });

  test('הגדרות › תזמונים is for the administrator only', async ({ page }) => {
    await open(page, '/system/schedules', { persona: 'viewer' });
    await expect(page.locator('sw-app system-schedules [data-schedules-settings-forbidden]')).toBeVisible();
  });
});

// ------------------------------------------------------------------------------------------------ with a session

const VIEWER_PERMS = ['video.live', 'video.playback', 'devices.read', 'map.read', 'entity.state.read', 'events.read'];

interface ApiState {
  perms: string[];
  settings: Record<string, unknown>;
  store: ScheduleDemoStore;
  calls: { method: string; path: string; body: unknown }[];
  listStatus: number;
  refreshes: number;
}

async function install(page: Page, st: ApiState) {
  await page.route('**/api/v1/**', async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const err = (status: number, code: string, msg: string) => json({ code, user_message: msg, retryable: false, correlation_id: '', details: {} }, status);
    if (p === 'me') {
      return json({
        channel: 'local', remote: null,
        user: { id: 'u-test', username: 'u-test', display_name: 'בודק', source: 'ingress' },
        active: true, bindings: [{ id: 'b1', role_id: 'r', role_name: 'בדיקה', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
        permissions_installation: st.perms, permissions_any: st.perms, has_access: true, permission_revision: 1,
        permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full',
      });
    }
    if (p === 'me/prefs') return json({ prefs: { 'nav.order': ['devices', 'security', 'explore', 'wiskey'] }, stored: [], updated_at: null });
    if (p === 'settings') return json({ settings: { 'ui.design': 'a', 'ui.start_route': 'devices', 'ui.security_snapshot': 'true', ...st.settings }, can_edit: st.perms.includes('system.configure') });
    if (p.startsWith('schedules')) {
      const body = req.method() === 'GET' ? null : req.postDataJSON();
      st.calls.push({ method: req.method(), path: p + url.search, body });
      const s = st.store;
      try {
        if (p === 'schedules/status') return json(await s.status());
        if (p === 'schedules' && req.method() === 'GET') {
          st.refreshes += 1;
          if (st.listStatus !== 200) return err(st.listStatus, 'internal', 'שגיאה בשרת (בדיקה)');
          return json(await s.list({ limit: 500 }));
        }
        if (p === 'schedules/trash') return json(await s.trash());
        if (p === 'schedules/review') return json(await s.review());
        if (p === 'schedules/runs') return json(await s.runs({}));
        if (p === 'schedules/bulk') return json(await s.bulk((body as { op: 'enable' | 'disable' }).op, (body as { ids: string[] }).ids));
        const m = /^schedules\/([0-9a-f]{6})(?:\/(enable|disable|delete|run))?$/.exec(p);
        if (m && !m[2]) return json(await s.get(m[1]));
        if (m?.[2] === 'enable' || m?.[2] === 'disable') return json(await s.setEnabled(m[1], m[2] === 'enable', false));
        if (m?.[2] === 'delete') return json(await s.remove(m[1], (body as { base_revision: string }).base_revision));
      } catch (e) {
        if (e instanceof ApiError) return json(e.body, e.status);
        throw e;
      }
      return err(404, 'not_found', 'לא נמצא (בדיקה)');
    }
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-09-30T00:00:00Z', version: 'test' });
    if (p === 'health') return json({ status: 'ok', version: 'test', nvr_configured: true, mode: 'full', discovery: { cameras: 0, cameras_last_ok: null, cameras_last_error: null }, events: { ingest: { connected: true, last_error: null } } });
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    if (p === 'alarm/panels') return json({ panels: [], counts: { panels: 0 } });
    return err(404, 'not_found', 'לא נמצא (בדיקה)');
  });
}

async function openApi(page: Page, hash: string) {
  await page.goto('about:blank');
  await page.goto(`/?design=a#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(600);
}

const rowTabs = (page: Page) => page.locator('sw-app .subnav sw-tabs a').allTextContents();

test.describe('with a session: permissions, the setting, ui.tabs and what the client sends', () => {
  let st: ApiState;

  test.beforeEach(async ({ page }) => {
    st = { perms: [...VIEWER_PERMS, 'schedule.view', 'schedule.manage', 'system.configure'], settings: {}, store: new ScheduleDemoStore(), calls: [], listStatus: 200, refreshes: 0 };
    await install(page, st);
  });

  test('schedule.view adds the tab; without a schedule permission the home screen has no tab row', async ({ page }) => {
    st.perms = VIEWER_PERMS;
    await openApi(page, '/devices/building');
    expect(await rowTabs(page)).toEqual([]);
    st.perms = [...VIEWER_PERMS, 'schedule.view'];
    await openApi(page, '/devices/building');
    expect(await rowTabs(page)).toEqual(['מבט על', 'תזמונים']);
  });

  test('schedule.manage without devices.read: the home area opens on the schedules, one tab, no row', async ({ page }) => {
    st.perms = ['video.live', 'schedule.manage'];
    await openApi(page, '/devices/schedules');
    await expect(page.locator('sw-app devices-schedules [data-sched-grid]')).toBeVisible();
    expect(await rowTabs(page)).toEqual([]);
    await expect(page.locator('sw-app nav.rail a[data-nav="devices"], sw-app nav.bottom a[data-nav="devices"]').first()).toHaveAttribute('href', '#/devices/schedules');
  });

  test('schedules.enabled off hides the tab; ui.tabs orders and hides the home tabs', async ({ page }) => {
    st.settings = { 'schedules.enabled': 'false' };
    await openApi(page, '/devices/building');
    expect(await rowTabs(page)).toEqual([]);
    st.settings = { 'ui.tabs': { devices: { order: ['schedules', 'building'], hidden: [] } } };
    await openApi(page, '/devices/building');
    expect(await rowTabs(page)).toEqual(['תזמונים', 'מבט על']);
    st.settings = { 'ui.tabs': { devices: { order: [], hidden: ['building'] } } };
    await openApi(page, '/devices/schedules');
    expect(await rowTabs(page)).toEqual([]); // one tab left: no row
  });

  test('the user menu keeps "עריכת המסך הראשי" on the overview tab, where the row is hidden', async ({ page }) => {
    await openApi(page, '/devices/building?edit=1');
    await expect(page.locator('sw-app devices-building')).toHaveCount(1);
    await expect(page.locator('sw-app .subnav sw-tabs')).toHaveCount(0);
    await openApi(page, '/devices/building');
    expect(await rowTabs(page)).toEqual(['מבט על', 'תזמונים']);
  });

  test('toggle, bulk and delete send the contract\'s requests; a failing list shows the error state with a retry', async ({ page }, info) => {
    await openApi(page, '/devices/schedules');
    await expect(page.locator('sw-app devices-schedules [data-sched-grid]')).toBeVisible();
    const post = (re: RegExp) => st.calls.filter((c) => c.method === 'POST' && re.test(c.path));
    await page.locator('sw-app devices-schedules article[data-schedule="8b21d4"] sw-toggle button').click();
    await expect.poll(() => post(/schedules\/8b21d4\/enable/).length).toBe(1);
    expect(post(/schedules\/8b21d4\/enable/)[0].body).toMatchObject({ confirm_lowering: false, alarm_code: null });
    expect(String((post(/enable/)[0].body as { client_request_id: string }).client_request_id).length).toBeGreaterThanOrEqual(8);
    await page.locator('sw-app devices-schedules article[data-schedule="4d6e0a"] input[data-select]').check();
    await page.locator('sw-app devices-schedules [data-bulk-disable]').click();
    await expect.poll(() => post(/schedules\/bulk/).length).toBe(1);
    expect(post(/schedules\/bulk/)[0].body).toMatchObject({ op: 'disable', ids: ['4d6e0a'], confirm: true });
    await page.locator('sw-app devices-schedules article[data-schedule="5a13f2"] a.name').click();
    await page.locator('sw-app devices-schedules [data-drawer-delete]').click();
    await page.locator('sw-app devices-schedules [data-delete-confirm]').click();
    await expect.poll(() => post(/schedules\/5a13f2\/delete/).length).toBe(1);
    expect(post(/delete/)[0].body).toMatchObject({ confirm: true });
    expect(typeof (post(/delete/)[0].body as { base_revision: string }).base_revision).toBe('string');

    st.listStatus = 500;
    await openApi(page, '/devices/schedules');
    const panel = page.locator('sw-app devices-schedules sw-state-panel[data-sched-state="error"]');
    await expect(panel).toBeVisible();
    await shot(page, '19-state-error', info);
    st.listStatus = 200;
    await panel.locator('sw-button').click();
    await expect(page.locator('sw-app devices-schedules [data-sched-grid]')).toBeVisible();
  });

  test('a schedules_changed push refetches the list', async ({ page }) => {
    await page.routeWebSocket('**/ha/ws', (ws) => {
      setTimeout(() => ws.send(JSON.stringify({ type: 'schedules_changed', payload: {} })), 1500);
    });
    await openApi(page, '/devices/schedules');
    await expect(page.locator('sw-app devices-schedules [data-sched-grid]')).toBeVisible();
    const before = st.refreshes;
    await expect.poll(() => st.refreshes, { timeout: 8000 }).toBeGreaterThan(before);
  });
});
