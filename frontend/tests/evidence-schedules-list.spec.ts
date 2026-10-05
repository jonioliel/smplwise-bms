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

/** The instant the page believes it is (it keeps ticking from here): a Monday noon in Asia/Jerusalem, so "the runs still to come
 *  today" and the demo store's upcoming list do not depend on the wall clock of the machine running the suite. */
const PINNED_NOW = new Date('2026-10-05T09:00:00Z');
const pinned = new WeakSet<Page>();
async function pinClock(page: Page) {
  if (pinned.has(page)) return; // a test may open the screen more than once; the clock is installed once per page
  pinned.add(page);
  await page.clock.install({ time: PINNED_NOW });
}

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
  await pinClock(page);
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
const card = (page: Page, id: string) => scr(page).locator(`article.acard[data-schedule="${id}"]`);
const cardsOf = (page: Page) => scr(page).locator('article.acard');
const hashOf = (page: Page) => page.evaluate(() => location.hash);

async function shot(page: Page, name: string, info: Info) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(EVIDENCE, `${name}-${size(info)}.png`) });
}

async function ready(page: Page) {
  await expect(scr(page).locator('[data-sched-grid], [data-sched-table], .statebox').first()).toBeVisible();
}

/** 2026-10-04 (the automations screen's layout): the area, days, conditions, tags, grouping and sorting sit behind "סינון". */
async function filters(page: Page) {
  const toggle = scr(page).locator('[data-filters-toggle]');
  if ((await scr(page).locator('[data-sched-filters]').count()) === 0) await toggle.click();
  await expect(scr(page).locator('[data-sched-filters]')).toBeVisible();
}

/** A sw-dropdown filter (the owner's rule: dropdown chips, never a native select): open it, choose the option. */
async function pick(page: Page, filter: string, id: string) {
  const dd = scr(page).locator(`sw-dropdown[data-filter="${filter}"]`);
  await dd.locator('[data-dropdown-chip]').click();
  await dd.locator(`[role="option"][data-id="${id}"]`).click();
}

test.describe('the schedules list (demo mode)', () => {
  test('cards: the header (title, floors, state filter with counts), "today", one card per schedule; the home tabs', async ({ page }, info) => {
    await open(page, '/devices/schedules');
    await ready(page);
    await expect(page.locator('sw-app .subnav sw-tabs a')).toHaveText(['מבט על', 'קברניט']);
    await expect(page.locator('sw-app .subnav sw-tabs a[aria-current="page"]')).toHaveText('קברניט');
    await expect(cardsOf(page)).toHaveCount(14);
    await expect(scr(page).locator('h1[data-sched-title]')).toHaveText('תזמונים');
    await expect(scr(page).locator('[data-state-filter="enabled"] small')).toHaveText('11');
    await expect(scr(page).locator('[data-state-filter="all"] small')).toHaveText('14');
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
    await expect(scr(page).locator('[data-sched-table] .tr[data-schedule]')).toHaveCount(14);
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
    await expect(week).toHaveAttribute('data-count', '14');
    await expect(week).toHaveAttribute('data-snap', '15');
    await week.evaluate((el) => el.dispatchEvent(new CustomEvent('open-schedule', { detail: { id: '4d6e0a' }, bubbles: true })));
    await expect.poll(() => hashOf(page)).toContain('/devices/schedules/4d6e0a');
  });

  test('"תזמון חדש": S4\'s create dialog when it exists (created → the drawer of the new schedule), else the editor route', async ({ page }) => {
    await open(page, '/devices/schedules');
    await ready(page);
    await scr(page).locator('[data-new-schedule]').first().click();
    // S4's real dialog is registered by the bundle since the merge: it opens (the editor route is only the fallback for a
    // missing tag, which the product no longer has)
    await expect(scr(page).locator('schedule-create-dialog')).toHaveAttribute('open', '');

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
    const cards = cardsOf(page);
    await scr(page).locator('[data-filter="q"]').fill('תריס');
    await expect(cards).toHaveCount(1);
    await expect.poll(() => hashOf(page)).toContain('q=');
    await scr(page).locator('[data-filter="q"]').fill('');
    await expect(cards).toHaveCount(14);

    await scr(page).locator('[data-chip-preset="not_holy_days"]').click();
    await expect(cards).toHaveCount(3);
    await expect.poll(() => hashOf(page)).toContain('preset=not_holy_days');
    await scr(page).locator('[data-chip-preset="only_holy_days"]').click();
    await expect(cards).toHaveCount(3);
    await scr(page).locator('[data-chip-has-cond]').click();
    await scr(page).locator('[data-clear-filters]').first().click();
    await expect(cards).toHaveCount(14);

    await scr(page).locator('[data-chip-tag="שבת-חג"]').click();
    await expect(cards).toHaveCount(4);
    await scr(page).locator('[data-clear-filters]').first().click();

    await scr(page).locator('[data-day-filter="sat"]').click(); // the Sunday-to-Thursday schedules drop out
    await expect(cards).toHaveCount(10);
    await scr(page).locator('[data-clear-filters]').first().click();

    await pick(page, 'group', 'tag');
    await expect(scr(page).locator('.group[data-group]')).toHaveCount(5); // שבת-חג, משרדים, חוץ, אולם, and the catch-all "ללא תג"
    await expect(scr(page).locator('.group[data-group]').last()).toHaveAttribute('data-group', 'ללא תג');
    await expect(scr(page).locator('.group[data-group] .sh h2').first()).toBeVisible(); // the scenes' section heading
    await pick(page, 'group', '');
    await expect(scr(page).locator('.group[data-group]')).toHaveCount(1);
    await pick(page, 'sort', 'name');
    await expect(cards.first().locator('a.name')).toHaveText('דריכת אזעקה – לילה');
    await expect.poll(() => hashOf(page)).toContain('sort=name');
  });

  test('the floors are chips in the title row, as on the automations screen; the state filter narrows the list', async ({ page }) => {
    await open(page, '/devices/schedules');
    await ready(page);
    const floors = scr(page).locator('.dh-row .rooms button[data-floor]');
    await expect(floors.first()).toHaveText('הכל');
    expect(await floors.count()).toBeGreaterThan(1);
    const second = floors.nth(1);
    const id = await second.getAttribute('data-floor');
    await second.click();
    await expect(second).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => hashOf(page)).toContain(`floor=${encodeURIComponent(id ?? '')}`);
    await floors.first().click();
    await expect(cardsOf(page)).toHaveCount(14);
    // the state segments (folded behind "סינון" on the phone, like the automations screen's)
    if (!(await scr(page).locator('[data-state-filter="disabled"]').isVisible())) await scr(page).locator('[data-filters-toggle]').click();
    await scr(page).locator('[data-state-filter="disabled"]').click();
    await expect(cardsOf(page)).toHaveCount(3);
    await expect.poll(() => hashOf(page)).toContain('state=disabled');
    await scr(page).locator('[data-state-filter="all"]').click();
    await expect(cardsOf(page)).toHaveCount(14);
  });

  test('the card: the automation card\'s shape - the name opens the drawer, the "⋯" menu lists what the caller may do', async ({ page }) => {
    await open(page, '/devices/schedules');
    await ready(page);
    const c = card(page, '4d6e0a');
    await expect(c.locator('h3 a.name[data-card-open]')).toBeVisible();
    await expect(c.locator('.where')).toBeVisible();
    await expect(c.locator('button.tog[role="switch"]')).toHaveAttribute('aria-checked', 'true');
    await c.locator('[data-card-menu]').click();
    await expect(c.locator('[role="menu"] [data-card-action]')).toHaveText(['עריכה', 'הרץ עכשיו', 'שכפול', 'מחיקה']);
    await c.locator('[data-card-action="copy"]').click();
    await expect(scr(page).locator('schedule-actions [data-copy-name]')).toHaveValue('העתק של תאורת משרדים – שעות עבודה');
    await scr(page).locator('schedule-actions [data-dialog-cancel]').click();
    await c.locator('[data-card-menu]').click();
    await c.locator('[data-card-action="edit"]').click();
    await expect.poll(() => hashOf(page)).toContain('/devices/schedules/4d6e0a/edit');
  });

  test('a filter that matches nothing says so and offers to clear it', async ({ page }) => {
    await open(page, '/devices/schedules');
    await ready(page);
    await filters(page);
    await scr(page).locator('[data-filter="q"]').fill('zzzz');
    await expect(scr(page).locator('[data-sched-state="no-match"]')).toBeVisible();
    await scr(page).locator('[data-sched-state="no-match"] [data-clear-filters]').click();
    await expect(cardsOf(page)).toHaveCount(14);
  });

  test('a card toggle switches the schedule; the bulk bar disables several at once; a lowering schedule is enabled one by one', async ({ page }) => {
    await installDoubles(page);
    await open(page, '/devices/schedules');
    await ready(page);
    const toggle = (id: string) => card(page, id).locator('[data-toggle]');
    await expect(card(page, '8b21d4')).toHaveAttribute('data-enabled', 'false');
    await toggle('8b21d4').click();
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
    await toggle('d8e3a7').click();
    await expect(scr(page).locator('schedule-actions schedule-lowering-dialog')).toContainText('יפתח שער חניה');
    await scr(page).locator('[data-lowering-confirm]').click();
    await expect(card(page, 'd8e3a7')).toHaveAttribute('data-enabled', 'true');
    // and bulk enable skips it
    await toggle('d8e3a7').click();
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
    await expect(confirm).toBeDisabled(); // two slots: none chosen yet
    await drawer.locator('[data-run-slot="1"]').check();
    await confirm.click();
    await expect(drawer.locator('[data-drawer-status]')).toContainText('הבקשה נשלחה');

    await drawer.locator('[data-drawer-copy]').click();
    await expect(drawer.locator('[data-copy-name]')).toHaveValue('העתק של תריס אולם – קיץ');
    await drawer.locator('[data-copy-confirm]').click();
    await expect(drawer.locator('sw-drawer')).toHaveAttribute('heading', 'העתק של תריס אולם – קיץ');
    await expect(cardsOf(page)).toHaveCount(15);

    await drawer.locator('[data-drawer-delete]').click();
    await drawer.locator('[data-delete-confirm]').click();
    await expect.poll(() => hashOf(page)).toBe('#/devices/schedules');
    await expect(cardsOf(page)).toHaveCount(14);
    await expect(scr(page).locator('[data-sched-note]')).toContainText('נמחק');
    await scr(page).locator('[data-note-action]').click();
    await expect(cardsOf(page)).toHaveCount(15);
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
    await scr(page).locator('input[data-review-select="6e2d90"]').check();
    await scr(page).locator('[data-review-disable]').click();
    await expect(scr(page).locator('[data-sched-note]')).toContainText('הושבתו 1');
  });

  test('the review list: an administrator acknowledges a warning ("אושר"), and undoes it', async ({ page }, info) => {
    await open(page, '/devices/schedules/review');
    const row = scr(page).locator('[data-review-item="6e2d90"]');
    await expect(row.locator('[data-issue="unsupported_content"]')).toBeVisible();
    await expect(scr(page).locator('[data-review-item="d8e3a7"] [data-ack]')).toHaveCount(0); // "owner lost rights" is not acknowledgeable
    await row.locator('[data-ack="unsupported_content"]').click();
    await expect(row.locator('[data-acked="unsupported_content"]')).toHaveText(/אושר/);
    await expect(row.locator('[data-issue="unsupported_content"]')).toHaveCount(0);
    await shot(page, '11b-review-acknowledged', info);
    await row.locator('[data-unack="unsupported_content"]').click();
    await expect(row.locator('[data-issue="unsupported_content"]')).toBeVisible();
    await expect(row.locator('[data-acked]')).toHaveCount(0);
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
    await expect(s.locator('p')).toHaveCount(0); // a clean operator screen: a title, no explanatory paragraph (the automations screen's state box)
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

  test('view only: as on the automations screen - nothing to create, a state chip instead of the switch, no "⋯" menu, no banner', async ({ page }, info) => {
    await open(page, '/devices/schedules', { persona: 'viewer' });
    await ready(page);
    await expect(scr(page).locator('[data-sched-readonly]')).toHaveCount(0);
    await expect(scr(page).locator('[data-new-schedule]')).toHaveCount(0);
    await expect(card(page, '4d6e0a').locator('[data-toggle]')).toHaveCount(0);
    await expect(card(page, '4d6e0a').locator('[data-card-state]')).toHaveText('פעיל');
    await expect(card(page, '4d6e0a').locator('[data-card-menu]')).toHaveCount(0);
    await shot(page, '16-state-view-only', info);
    await card(page, '4d6e0a').locator('a.name').click();
    const drawer = scr(page).locator('schedule-drawer');
    await expect(drawer.locator('[data-drawer-readonly]')).toBeVisible();
    // the drawer keeps every action, disabled with the reason (the schedules contract: the server's reason is shown)
    await expect(drawer.locator('[data-drawer-delete]')).toBeDisabled();
    await expect(drawer.locator('[data-drawer-run]')).toBeDisabled();
    await expect(drawer.locator('[data-drawer-toggle]')).toHaveCount(0);
  });

  test('a floor-scoped editor: the sensitive schedule is read only, a condition outside the scope is locked', async ({ page }) => {
    await open(page, '/devices/schedules/e19b70', { persona: 'manager' });
    const drawer = scr(page).locator('schedule-drawer');
    await expect(drawer.locator('[data-drawer-readonly]')).toContainText('הרשאה');
    await expect(drawer.locator('[data-drawer-edit]')).toBeDisabled();
    await open(page, '/devices/schedules/2c9f61', { persona: 'manager' });
    await expect(scr(page).locator('schedule-drawer [data-condition-locked]')).toContainText('מחוץ להרשאתך');
  });

  test('stale: the list from the last known data, with the connection notice', async ({ page }) => {
    await open(page, '/devices/schedules', { availability: 'ha_unavailable' });
    await ready(page);
    await expect(scr(page).locator('[data-sched-stale]')).toContainText('המידע אינו מעודכן');
    await expect(scr(page).locator('[data-sched-stale]')).not.toContainText(/Home Assistant|HA\b/);
    await expect(scr(page).locator('[data-sched-stale] [data-banner-retry]')).toBeVisible();
    await expect(scr(page).locator('[data-new-schedule]').first()).toBeDisabled();
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
    await expect(page.locator('sw-app .subnav sw-tabs a')).toHaveText(['מבט על', 'קברניט']);
    await expect(page.locator('sw-app .subnav sw-tabs a[aria-current="page"]')).toHaveText('מבט על');
    await shot(page, '20-home-overview-tab', info);
    await page.locator('sw-app .subnav sw-tabs a', { hasText: 'קברניט' }).click();
    await expect(page.locator('sw-app devices-schedules')).toHaveCount(1);
  });

  test('הגדרות › תזמונים: connection, switch, the sensor picker, classes, defaults, who may do what; saved changes', async ({ page }, info) => {
    await open(page, '/system/schedules');
    const s = page.locator('sw-app system-schedules');
    await expect(s.locator('[data-schedules-settings]')).toBeVisible();
    await expect(s.locator('[data-component-line]')).toContainText('גרסה 3.3.8');
    await expect(s.locator('[data-shabbat-sensor] option')).toContainText(['ללא חיישן', 'איסור מלאכה']); // the suggested sensor first, in its own group
    await expect(s.locator('[data-class]')).toHaveCount(17); // 2026-10-04: + scripts, scenes, helpers, humidifiers, vacuums; + sirens, players, numbers, selects
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

  test('הגדרות › תזמונים: disarming in schedules is allowed by default; an administrator restricts it and lifts it with the typed word', async ({ page }, info) => {
    await open(page, '/system/schedules');
    const s = page.locator('sw-app system-schedules');
    const card = s.locator('[data-sched-disarm]');
    await expect(card.locator('[data-disarm-state]')).toContainText('נטרול אזעקה בתזמונים: מותר (ניתן להגביל)');
    await card.locator('[data-allow-disarm]').locator('button').click(); // restricting needs no word
    await expect(card.locator('[data-disarm-state]')).toContainText('מוגבל');
    await card.locator('[data-allow-disarm]').locator('button').click();
    const dlg = s.locator('[data-disarm-confirm]');
    await expect(dlg.locator('[data-disarm-word]')).toBeVisible();
    await expect(dlg.locator('[data-disarm-ok] button')).toBeDisabled();
    await dlg.locator('[data-disarm-word]').fill('אפשר');
    await expect(dlg.locator('[data-disarm-ok] button')).toBeDisabled();
    await dlg.locator('[data-disarm-word]').fill('אפשר נטרול');
    await shot(page, '12b-settings-disarm-confirm', info);
    await dlg.locator('[data-disarm-ok]').click();
    await expect(s.locator('[data-disarm-confirm]')).toHaveCount(0);
    await expect(card.locator('[data-disarm-state]')).toContainText('מותר (ניתן להגביל)');
  });

  test('הגדרות › תזמונים: a script that disarms is schedulable only once an administrator marks it "allowed in schedules"', async ({ page }, info) => {
    await open(page, '/system/schedules');
    const s = page.locator('sw-app system-schedules');
    const row = s.locator('[data-sched-scripts] [data-script-row="script.night_alarm"]');
    await expect(row).toContainText('לא מסומן');
    await expect(s.locator('[data-sched-scripts] [data-script-row="script.morning_routine"]')).toHaveCount(0); // an ordinary script needs no mark
    await row.locator('[data-script-mark]').locator('button').click();
    await expect(row).toContainText('מותר בתזמונים');
    await expect(row).toContainText('יוני');
    await shot(page, '12c-settings-script-marks', info);
    await row.locator('[data-script-mark]').locator('button').click();
    await expect(row).toContainText('לא מסומן');
  });

  test('הגדרות › תזמונים: a sensor that is not a calendar one is confirmed before it is saved', async ({ page }) => {
    await open(page, '/system/schedules');
    const s = page.locator('sw-app system-schedules');
    await expect(s.locator('[data-shabbat-sensor] optgroup').first()).toHaveAttribute('label', /לוח שנה יהודי/);
    await s.locator('[data-shabbat-sensor]').selectOption('binary_sensor.office_occupancy');
    await s.locator('[data-settings-save]').click();
    await expect(s.locator('[data-sensor-confirm]')).toContainText('להשתמש בו בכל זאת');
    await s.locator('[data-sensor-force]').click();
    await expect(s.locator('[data-settings-saved]')).toBeVisible();
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
  /** PATCH /settings bodies, in order */
  patches: Record<string, unknown>[];
  /** enable / disable answers this error instead (the write failures of the real component tests) */
  failEnable: { status: number; code: string } | null;
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
    if (p === 'settings' && req.method() === 'PATCH') {
      // the server's rule: a sensor that is not a Jewish-calendar one needs `schedules.shabbat_sensor_force`, which is never stored
      const body = req.postDataJSON() as Record<string, unknown>;
      st.patches.push(body);
      const sensor = String(body['schedules.shabbat_sensor'] ?? '');
      if (sensor && sensor !== 'binary_sensor.shabbat_mode' && body['schedules.shabbat_sensor_force'] !== true) return err(422, 'not_calendar_sensor', 'זה לא נראה כחיישן של לוח השנה היהודי.');
      const { 'schedules.shabbat_sensor_force': _force, ...stored } = body;
      Object.assign(st.settings, stored);
    }
    if (p === 'settings') return json({ settings: { 'ui.design': 'a', 'ui.start_route': 'devices', 'ui.security_snapshot': 'true', ...st.settings }, can_edit: st.perms.includes('system.configure') });
    if (p.startsWith('schedules')) {
      const body = req.method() === 'GET' ? null : req.postDataJSON();
      st.calls.push({ method: req.method(), path: p + url.search, body });
      const s = st.store;
      try {
        // the status answers only holders of schedule.view
        if (p === 'schedules/status') return st.perms.includes('schedule.view') ? json(await s.status()) : err(403, 'forbidden', 'אין הרשאה לפעולה זו בהיקף המבוקש.');
        if (p.startsWith('schedules/condition-candidates')) return json(await s.conditionCandidates({}));
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
        if ((m?.[2] === 'enable' || m?.[2] === 'disable') && st.failEnable) return err(st.failEnable.status, st.failEnable.code, 'internal wording');
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
  await pinClock(page);
  await page.goto('about:blank');
  await page.goto(`/?design=a#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(600);
}

const rowTabs = (page: Page) => page.locator('sw-app .subnav sw-tabs a').allTextContents();

test.describe('with a session: permissions, the setting, ui.tabs and what the client sends', () => {
  let st: ApiState;

  test.beforeEach(async ({ page }) => {
    st = { perms: [...VIEWER_PERMS, 'schedule.view', 'schedule.manage', 'system.configure'], settings: {}, store: new ScheduleDemoStore(), calls: [], listStatus: 200, refreshes: 0, patches: [], failEnable: null };
    await install(page, st);
  });

  test('schedule.view adds the tab; without a schedule permission the home screen has no tab row', async ({ page }) => {
    st.perms = VIEWER_PERMS;
    await openApi(page, '/devices/building');
    expect(await rowTabs(page)).toEqual([]);
    st.perms = [...VIEWER_PERMS, 'schedule.view'];
    await openApi(page, '/devices/building');
    await expect.poll(() => rowTabs(page)).toEqual(['מבט על', 'קברניט']);
  });

  test('schedule.manage without devices.read: the home area opens on the schedules, one tab, no row', async ({ page }) => {
    st.perms = ['video.live', 'schedule.view', 'schedule.manage'];
    await openApi(page, '/devices/schedules');
    await expect(page.locator('sw-app devices-schedules [data-sched-grid]')).toBeVisible();
    expect(await rowTabs(page)).toEqual([]);
    await expect(page.locator('sw-app nav.rail a[data-nav="devices"], sw-app nav.bottom a[data-nav="devices"]').first()).toHaveAttribute('href', '#/devices/schedules');
  });

  test('schedules.enabled off hides the tab; ui.tabs orders and hides the home tabs', async ({ page }) => {
    st.settings = { 'schedules.enabled': 'false' };
    await openApi(page, '/devices/building');
    expect(await rowTabs(page)).toEqual([]);
    st.settings = { 'ui.tabs': { devices: { order: ['automations', 'building'], hidden: [] } } };
    await openApi(page, '/devices/building');
    await expect.poll(() => rowTabs(page)).toEqual(['קברניט', 'מבט על']);
    st.settings = { 'ui.tabs': { devices: { order: [], hidden: ['building'] } } };
    await openApi(page, '/devices/schedules');
    expect(await rowTabs(page)).toEqual([]); // one tab left: no row
  });

  test('the user menu keeps "עריכת המסך הראשי" on the overview tab, where the row is hidden', async ({ page }) => {
    await openApi(page, '/devices/building?edit=1');
    await expect(page.locator('sw-app devices-building')).toHaveCount(1);
    await expect(page.locator('sw-app .subnav sw-tabs')).toHaveCount(0);
    await openApi(page, '/devices/building');
    await expect.poll(() => rowTabs(page)).toEqual(['מבט על', 'קברניט']);
  });

  test('toggle, bulk and delete send the contract\'s requests', async ({ page }) => {
    await openApi(page, '/devices/schedules');
    await expect(page.locator('sw-app devices-schedules [data-sched-grid]')).toBeVisible();
    const post = (re: RegExp) => st.calls.filter((c) => c.method === 'POST' && re.test(c.path));
    await page.locator('sw-app devices-schedules article[data-schedule="8b21d4"] [data-toggle]').click();
    await expect.poll(() => post(/schedules\/8b21d4\/enable/).length).toBe(1);
    expect(post(/schedules\/8b21d4\/enable/)[0].body).toMatchObject({ confirm_lowering: false, alarm_code: null });
    expect(String((post(/enable/)[0].body as { client_request_id: string }).client_request_id).length).toBeGreaterThanOrEqual(8);
    // the enable re-sorts the list by the next run (time-of-day dependent); pick only after that refresh has rendered
    await expect(page.locator('sw-app devices-schedules article[data-schedule="8b21d4"] [data-toggle]')).toHaveAttribute('aria-checked', 'true');
    const pick = page.locator('sw-app devices-schedules article[data-schedule="4d6e0a"] input[data-select]');
    await pick.check();
    await expect(pick).toBeChecked();
    await expect(page.locator('sw-app devices-schedules input[data-select]:checked')).toHaveCount(1);
    await page.locator('sw-app devices-schedules [data-bulk-disable]').click();
    await expect.poll(() => post(/schedules\/bulk/).length).toBe(1);
    expect(post(/schedules\/bulk/)[0].body).toMatchObject({ op: 'disable', ids: ['4d6e0a'], confirm: true });
    // the bulk result re-renders the list (selection cleared, bar gone): open the drawer only after that settles,
    // or the refresh can swallow the click / close the drawer before the delete dialog opens
    await expect(page.locator('sw-app devices-schedules [data-bulk-disable]')).toHaveCount(0);
    const del = page.locator('sw-app devices-schedules [data-drawer-delete]');
    await expect(async () => {
      if (!(await del.isVisible())) await page.locator('sw-app devices-schedules article[data-schedule="5a13f2"] a.name').click();
      await expect(del).toBeVisible({ timeout: 2000 });
      await del.click();
      await expect(page.locator('sw-app devices-schedules [data-delete-confirm]')).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 20_000 });
    await page.locator('sw-app devices-schedules [data-delete-confirm]').click();
    await expect.poll(() => post(/schedules\/5a13f2\/delete/).length).toBe(1);
    expect(post(/delete/)[0].body).toMatchObject({ confirm: true });
    expect(typeof (post(/delete/)[0].body as { base_revision: string }).base_revision).toBe('string');
  });

  // Its own test (it was the tail of the one above): the pair did three page loads and a dozen UI steps inside one 60 s test budget,
  // which a loaded workstation (several workers, other agents) used up - the failures were test timeouts at a different step each time.
  test('a failing list shows the error state with a retry', async ({ page }, info) => {
    st.listStatus = 500;
    await openApi(page, '/devices/schedules');
    const panel = page.locator('sw-app devices-schedules .statebox[data-sched-state="error"]');
    await expect(panel).toBeVisible();
    await shot(page, '19-state-error', info);
    st.listStatus = 200;
    await panel.locator('[data-sched-retry]').click();
    await expect(page.locator('sw-app devices-schedules [data-sched-grid]')).toBeVisible();
  });

  test('the status refuses a caller without schedule.view: the screen says "no permission", not "failed"', async ({ page }) => {
    st.perms = ['video.live', 'schedule.manage'];
    await openApi(page, '/devices/schedules');
    await expect(page.locator('sw-app devices-schedules [data-sched-state="no_permission"]')).toBeVisible();
  });

  test('write failures: entity_unknown (422) and idempotency_conflict (409) get a sensible Hebrew message', async ({ page }) => {
    await openApi(page, '/devices/schedules');
    const toggle = page.locator('sw-app devices-schedules article[data-schedule="8b21d4"] [data-toggle]');
    const note = page.locator('sw-app devices-schedules [data-sched-note]');
    st.failEnable = { status: 422, code: 'entity_unknown' };
    await toggle.click();
    await expect(note).toContainText('אחד ההתקנים בתזמון אינו מוכר או מחוץ להרשאתך');
    await expect(note).not.toContainText('internal wording');
    st.failEnable = { status: 409, code: 'idempotency_conflict' };
    await toggle.click();
    await expect(note).toContainText('הבקשה כבר נשלחה בתוכן אחר');
  });

  test('הגדרות › תזמונים: calendar sensors first; another sensor is confirmed, sent with the override flag, never stored; a refusal shows its message', async ({ page }) => {
    await openApi(page, '/system/schedules');
    const s = page.locator('sw-app system-schedules');
    await expect(s.locator('[data-schedules-settings]')).toBeVisible();
    const groups = s.locator('[data-shabbat-sensor] optgroup');
    await expect(groups).toHaveCount(2);
    await expect(groups.first()).toHaveAttribute('label', /לוח שנה יהודי/);
    await expect(groups.first().locator('option')).toHaveText(['איסור מלאכה']);
    // a suggested sensor: no confirmation, no flag
    await s.locator('[data-shabbat-sensor]').selectOption('');
    await s.locator('[data-shabbat-sensor]').selectOption('binary_sensor.shabbat_mode');
    await s.locator('[data-class="fan"] button').click();
    await s.locator('[data-settings-save]').click();
    await expect.poll(() => st.patches.length).toBe(1);
    expect(st.patches[0]).not.toHaveProperty('schedules.shabbat_sensor_force');
    // the save must have finished (the screen reloads its draft) before the next edit, or the edit is overwritten and the button detaches
    await expect(s.locator('[data-settings-saved]')).toBeVisible();
    // another sensor: asked first; cancelling sends nothing
    await s.locator('[data-shabbat-sensor]').selectOption('binary_sensor.office_occupancy');
    await s.locator('[data-settings-save]').click();
    await expect(s.locator('[data-sensor-confirm]')).toContainText('חיישן שאינו לוח שנה יהודי - להשתמש בו בכל זאת?');
    await s.locator('[data-sensor-cancel]').click();
    expect(st.patches.length).toBe(1);
    await s.locator('[data-settings-save]').click();
    await s.locator('[data-sensor-force]').click();
    await expect.poll(() => st.patches.length).toBe(2);
    expect(st.patches[1]).toMatchObject({ 'schedules.shabbat_sensor': 'binary_sensor.office_occupancy', 'schedules.shabbat_sensor_force': true });
    await expect(s.locator('[data-settings-saved]')).toBeVisible();
    expect(st.settings).not.toHaveProperty('schedules.shabbat_sensor_force');
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
