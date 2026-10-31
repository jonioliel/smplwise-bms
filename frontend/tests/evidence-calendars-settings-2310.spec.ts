import { test, expect, type Page, type Locator } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { url } from './generator-mocks';

// CALENDARS-UI-2310 slice C: הגדרות › יומנים (every tab; a change persists, the reset, the retention confirm, the purge with the typed word),
// הגדרות › חיבורי יומן (the "המשך" of a connection that needs a new authorisation follows the setting; flags keep / cancel) and the resident
// phone flow (book -> confirm -> done -> mine -> cancel; the displaced alternatives; the time-bar picker; the cancel cutoff), in demo mode
// (src/calendars/demo.ts, invented data) at a pinned clock (Thursday 29.10.2026 10:40, like the mock-up). Every screen: no page scroll, no
// sideways overflow, light and dark, worst-case data.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-calendars-settings-2310.spec.ts
const OUT = process.env.SW_CAL_SHOTS || path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../../../smplwisebms/private/design-system-2026-10-27/round9/calendars-ui/shots');
const CLOCK = new Date('2026-10-29T10:40:00+02:00');
const proj = () => test.info().project.name;
const phone = () => proj() === 'mobile';
const S = 'sw-app system-calendars';
const Y = 'sw-app system-calendar-sync';
const R = 'sw-app calendars-page cal-resident';

async function open(page: Page, hash: string, scheme: 'light' | 'dark' = 'light') {
  await page.clock.setFixedTime(CLOCK);
  await page.goto('about:blank');
  await page.goto(url(hash, 'classic', scheme));
}

/** Owner rule 2026-10-24: no page scroll in a control screen, and nothing wider than the window. */
async function fits(page: Page) {
  await page.waitForTimeout(250);
  const m = await page.evaluate(() => {
    const main = document.querySelector('sw-app')?.shadowRoot?.querySelector('main');
    return { sh: main?.scrollHeight ?? 0, ch: main?.clientHeight ?? 0, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
  });
  expect(m.sh, 'page scroll').toBeLessThanOrEqual(m.ch + 1);
  expect(m.sw, 'sideways overflow').toBeLessThanOrEqual(m.cw + 1);
}

async function shot(page: Page, name: string, scheme = 'light') {
  if (!fs.existsSync(path.dirname(OUT))) return; // the screenshots folder is the lead's (private, local); elsewhere only the assertions run
  try {
    fs.mkdirSync(OUT, { recursive: true });
    await page.screenshot({ path: path.join(OUT, `${name}-${proj()}-${scheme}.png`), animations: 'disabled' });
  } catch {
    /* the screenshots folder is the lead's (private, local); a runner without it still runs the assertions */
  }
}

const opt = (page: Page, key: string, value: string): Locator => page.locator(`${S} [data-setting="${key}"] [data-opt="${value}"]`);
/** The behaviour tab pages its rows (no page scroll): page forward until the row is there. */
async function toSetting(page: Page, key: string) {
  for (let i = 0; i < 12 && !(await page.locator(`${S} [data-setting="${key}"]`).count()); i += 1) await page.locator(`${S} [data-calset-next]`).click();
  await expect(page.locator(`${S} [data-setting="${key}"]`)).toBeVisible();
}

test.describe('calendars settings (הגדרות › יומנים)', () => {
  for (const scheme of ['light', 'dark'] as const) {
    for (const tab of ['overlap', 'behavior', 'approval', 'perm', 'retention'] as const) {
      test(`tab ${tab} ${scheme}: renders, fits`, async ({ page }) => {
        await open(page, `/system/calendars?tab=${tab}`, scheme);
        await expect(page.locator(`${S} [data-calset-tab="${tab}"]`)).toBeVisible();
        if (tab === 'behavior' || tab === 'approval' || tab === 'perm') await expect(page.locator(`${S} [data-calset-rows] > *`).first()).toBeVisible();
        await fits(page);
        await shot(page, `settings-${tab}`, scheme);
      });
    }
  }

  test('worst-case data: every tab fits', async ({ page }) => {
    for (const tab of ['overlap', 'behavior', 'approval', 'perm', 'retention']) {
      await open(page, `/system/calendars?tab=${tab}&data=worst`);
      await expect(page.locator(`${S} [data-calset-tab="${tab}"]`)).toBeVisible();
      await fits(page);
      if (tab === 'approval') await shot(page, 'settings-approval-worst');
    }
  });

  test('error state', async ({ page }) => {
    await open(page, '/system/calendars?data=error');
    await expect(page.locator(`${S} [data-calset-state="error"]`)).toBeVisible();
  });

  test('the overlap mode is chosen and kept; a calendar may override in both directions by default', async ({ page }) => {
    await open(page, '/system/calendars?tab=overlap');
    await expect(page.locator(`${S} [data-overlap="first_holds"]`)).toHaveAttribute('aria-checked', 'true');
    await page.locator(`${S} [data-overlap="block"]`).click();
    await expect(page.locator(`${S} [data-overlap="block"]`)).toHaveAttribute('aria-checked', 'true');
    await expect(opt(page, 'override_scope', 'both')).toHaveAttribute('aria-pressed', 'true');
    if (!phone()) await expect(page.locator(`${S} [data-override]`)).toHaveCount(2);
    await page.locator(`${S} [data-calset-tabbtn="behavior"]`).click();
    await page.locator(`${S} [data-calset-tabbtn="overlap"]`).click();
    await expect(page.locator(`${S} [data-overlap="block"]`)).toHaveAttribute('aria-checked', 'true'); // saved, not a local draft
  });

  test('behaviour: every answered setting is a switch with its default and a reset', async ({ page }) => {
    await open(page, '/system/calendars?tab=behavior');
    const keys = ['menu_position', 'contested_order', 'allow_displace', 'displace_approver', 'phone_time_picker', 'tablet_panels', 'resident_pending_display', 'resident_rooms',
      'sync_conflict_display', 'reauth_mode', 'purge_confirm', 'loading_style', 'resident_cancel_until'];
    const seen = new Set<string>();
    for (let i = 0; i < 12; i += 1) {
      await fits(page); // waits for the panel's measure: the rows per page are settled before they are read
      for (const k of await page.locator(`${S} [data-setting]`).evaluateAll((els) => els.map((e) => e.getAttribute('data-setting') ?? ''))) seen.add(k);
      const next = page.locator(`${S} [data-calset-next]`);
      if (!(await next.count()) || (await next.isDisabled())) break;
      await next.click();
    }
    for (const k of keys) expect(seen, k).toContain(k);
    // the placement has three options, the side rail by default (owner, 2026-10-30 night)
    await open(page, '/system/calendars?tab=behavior'); // back on the first page (a hash-only goto keeps the page turned above)
    await expect(opt(page, 'menu_position', 'rail')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(`${S} [data-setting="menu_position"] [data-opt]`)).toHaveCount(3);
    await expect(page.locator(`${S} [data-setting="menu_position"] .sub`)).toContainText('ברירת מחדל: סרגל צד');
    await opt(page, 'menu_position', 'both').click();
    await expect(opt(page, 'menu_position', 'both')).toHaveAttribute('aria-pressed', 'true');
    await page.locator(`${S} [data-reset="menu_position"]`).click();
    await expect(opt(page, 'menu_position', 'rail')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(`${S} [data-reset="menu_position"]`)).toHaveCount(0);
    // answer 11B: automatic first come is the default
    await toSetting(page, 'contested_order');
    await expect(opt(page, 'contested_order', 'first_come')).toHaveAttribute('aria-pressed', 'true');
    // auto-move of a displaced booking was not built: shown, not selectable
    await open(page, '/system/calendars?tab=behavior');
    await toSetting(page, 'displaced');
    await expect(page.locator(`${S} [data-setting="displaced"] [data-opt="auto"]`)).toBeDisabled();
  });

  test('approval per calendar: the overlap choice of a room follows the override scope (desktop table)', async ({ page }) => {
    test.skip(phone(), 'the phone shows the approval switch only');
    await open(page, '/system/calendars?tab=behavior');
    await open(page, '/system/calendars?tab=overlap');
    await opt(page, 'override_scope', 'none').click();
    await page.locator(`${S} [data-calset-tabbtn="approval"]`).click();
    await expect(page.locator(`${S} tr[data-approval="alon"]`)).toContainText('לפי ההתקנה');
    await expect(page.locator(`${S} tr[data-approval="alon"] select`)).toHaveCount(1); // only the approval mode
    await page.locator(`${S} tr[data-approval="alon"] [data-approval-mode]`).selectOption('always');
    await expect(page.locator(`${S} tr[data-approval="alon"] select`)).toHaveCount(2); // the decision time appears
  });

  test('retention: lowering asks first; the purge needs the typed word', async ({ page }) => {
    await open(page, '/system/calendars?tab=retention');
    await page.locator(`${S} [data-setting="guest_retention_days"] button[aria-label="פחות"]`).click();
    await page.locator(`${S} [data-retention-save]`).click();
    await expect(page.locator(`${S} sw-dialog[data-retention-confirm]`)).toHaveAttribute('open', '');
    await page.locator(`${S} [data-confirm-ok]`).click();
    await expect(page.locator(`${S} [data-calset-toast]`)).toContainText('יימחקו בהרצה הבאה');
    await expect(page.locator(`${S} [data-retention]`)).toHaveValue('29');
    await page.locator(`${S} [data-purge]`).click();
    await expect(page.locator(`${S} [data-purge-ok]`)).toBeDisabled();
    await page.locator(`${S} [data-purge-word]`).fill('מחיקה');
    await shot(page, 'settings-purge');
    await page.locator(`${S} [data-purge-ok]`).click();
    await expect(page.locator(`${S} [data-calset-toast]`)).toContainText('נמחקו');
  });

  test('purge_confirm = one_click: the dialog asks without the word', async ({ page }) => {
    await open(page, '/system/calendars?tab=behavior');
    await toSetting(page, 'purge_confirm');
    await opt(page, 'purge_confirm', 'one_click').click();
    await page.locator(`${S} [data-calset-tabbtn="retention"]`).click();
    await page.locator(`${S} [data-purge]`).click();
    await expect(page.locator(`${S} [data-purge-word]`)).toHaveCount(0);
    await expect(page.locator(`${S} [data-purge-ok]`)).toBeEnabled();
  });

  test('read-only without calendar.configure', async ({ page }) => {
    await open(page, '/system/calendars?tab=behavior&role=operator');
    await expect(page.locator(`${S} [data-calset-ro]`)).toBeVisible();
    await expect(opt(page, 'menu_position', 'both')).toBeDisabled();
  });
});

test.describe('calendar connections (הגדרות › חיבורי יומן)', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`renders and fits ${scheme}`, async ({ page }) => {
      await open(page, '/system/calendar-sync', scheme);
      await expect(page.locator(`${Y} [data-sync-screen]`)).toBeVisible();
      await expect(page.locator(`${Y} [data-provider]`)).toHaveCount(phone() ? 1 : 3);
      await fits(page);
      await shot(page, 'sync', scheme);
    });
  }

  test('providers in order iCal, Google, Microsoft', async ({ page }) => {
    test.skip(phone(), 'one provider at a time on the phone');
    await open(page, '/system/calendar-sync');
    expect(await page.locator(`${Y} [data-provider]`).evaluateAll((els) => els.map((e) => e.getAttribute('data-provider')))).toEqual(['ical', 'google', 'microsoft']);
  });

  test('answer 21: "המשך" with reauth_and_continue (default), gone with reauth_only', async ({ page }) => {
    await open(page, '/system/calendar-sync');
    const ms = page.locator(`${Y} [data-provider="microsoft"]`);
    await expect(ms.locator('[data-reauth]')).toBeVisible(); // the phone opens on the provider that needs attention
    await expect(ms.locator('[data-continue]')).toBeVisible();
    if (phone()) {
      await open(page, '/system/calendars?tab=behavior');
      await toSetting(page, 'reauth_mode');
      await opt(page, 'reauth_mode', 'reauth_only').click();
      await page.evaluate(() => (location.hash = '#/system/calendar-sync'));
    } else {
      await page.locator(`${Y} [data-setting="reauth_mode"] [data-opt="reauth_only"]`).click();
    }
    await expect(page.locator(`${Y} [data-provider="microsoft"] [data-reauth]`)).toBeVisible();
    await expect(page.locator(`${Y} [data-provider="microsoft"] [data-continue]`)).toHaveCount(0);
  });

  test('"המשך" resumes the connection', async ({ page }) => {
    await open(page, '/system/calendar-sync');
    await page.locator(`${Y} [data-provider="microsoft"] [data-continue]`).click();
    await expect(page.locator(`${Y} [data-provider="microsoft"]`)).toHaveAttribute('data-conn-state', 'ok');
  });

  test('flags: keep and cancel take the entry off the list', async ({ page }) => {
    await open(page, '/system/calendar-sync');
    await expect(page.locator(`${Y} [data-flags-count]`)).toHaveText('2');
    await page.locator(`${Y} [data-flag] [data-flag-keep]`).first().click();
    await expect(page.locator(`${Y} [data-flags-count]`)).toHaveText('1');
    await page.locator(`${Y} [data-flag] [data-flag-cancel]`).first().click();
    await expect(page.locator(`${Y} [data-flags-empty]`)).toBeVisible();
  });

  test('remove asks first; new connection explains the owner-created account', async ({ page }) => {
    await open(page, '/system/calendar-sync');
    await page.locator(`${Y} [data-provider="microsoft"] [data-remove]`).click();
    await expect(page.locator(`${Y} sw-dialog[data-remove-confirm]`)).toHaveAttribute('open', '');
    await page.locator(`${Y} [data-remove-ok]`).click();
    await expect(page.locator(`${Y} [data-sync-toast]`)).toContainText('נותק');
    if (!phone()) {
      await page.locator(`${Y} [data-sync-new]`).click();
      await expect(page.locator(`${Y} sw-dialog[data-new-dialog]`)).toContainText('לא יוצר חשבון');
    }
  });

  test('worst-case and empty data fit', async ({ page }) => {
    for (const data of ['worst', 'empty']) {
      await open(page, `/system/calendar-sync?data=${data}`);
      await expect(page.locator(`${Y} [data-sync-screen]`)).toBeVisible();
      await fits(page);
    }
  });
});

test.describe('resident phone flow', () => {
  test.beforeEach(() => test.skip(!phone(), 'the resident flow is the phone layout'));

  for (const scheme of ['light', 'dark'] as const) {
    test(`rooms, slots, confirm, mine ${scheme}: fit`, async ({ page }) => {
      await open(page, '/calendars/cal?role=resident', scheme);
      await expect(page.locator(`${R} [data-res-view="rooms"]`)).toBeVisible();
      await fits(page);
      await shot(page, 'res-rooms', scheme);
      await page.locator(`${R} [data-res-room="alon"]`).click();
      await expect(page.locator(`${R} [data-res-view="slot"][data-picker="grid"]`)).toBeVisible();
      await fits(page);
      await page.locator(`${R} [data-res-slot]:not([disabled])`).first().click();
      await shot(page, 'res-slot', scheme);
      await page.locator(`${R} [data-res-continue]`).click();
      await expect(page.locator(`${R} [data-res-sheet="confirm"]`)).toBeVisible();
      await shot(page, 'res-confirm', scheme);
      await page.locator(`${R} [data-res-sheet="confirm"] .x`).click();
      await page.locator(`${R} [data-res-tab="mine"]`).click();
      await expect(page.locator(`${R} [data-res-view="mine"]`)).toBeVisible();
      await fits(page);
      await shot(page, 'res-mine', scheme);
    });
  }

  test('book -> confirm -> done -> mine -> cancel', async ({ page }) => {
    await open(page, '/calendars/cal?role=resident');
    await page.locator(`${R} [data-res-room="alon"]`).click();
    await page.locator(`${R} [data-res-dur="60"]`).click();
    await page.locator(`${R} [data-res-slot="11:30"]`).click();
    await expect(page.locator(`${R} [data-res-continue]`)).toContainText('11:30–12:30');
    await page.locator(`${R} [data-res-continue]`).click();
    await page.locator(`${R} [data-res-title]`).fill('שיעור בית');
    await page.locator(`${R} [data-res-submit]`).click();
    await expect(page.locator(`${R} [data-res-done]`)).toBeVisible();
    await shot(page, 'res-done');
    const mine = page.locator(`${R} [data-res-booking]`, { hasText: 'שיעור בית' });
    await expect(mine).toHaveCount(1);
    await mine.locator('[data-res-cancel]').click();
    await expect(page.locator(`${R} [data-res-sheet="cancel"]`)).toBeVisible();
    await shot(page, 'res-cancel');
    await page.locator(`${R} [data-res-cancel-ok]`).click();
    await expect(page.locator(`${R} [data-res-booking]`, { hasText: 'שיעור בית' })).toHaveCount(0);
  });

  test('a contested window: "2 מבקשים" (answer 13A) and the request goes to the manager', async ({ page }) => {
    await open(page, '/calendars/cal?role=resident');
    await page.locator(`${R} [data-res-room="hall"]`).click();
    await page.locator(`${R} [data-res-dur="120"]`).click();
    const contested = page.locator(`${R} [data-res-slot][data-look="contest"]`).first();
    await expect(contested).toContainText('מבקשים');
    await contested.click();
    await page.locator(`${R} [data-res-continue]`).click();
    await expect(page.locator(`${R} [data-res-approval]`)).toContainText('הבקשה תישלח ל');
  });

  test('the displaced booking offers alternatives and rebooks', async ({ page }) => {
    await open(page, '/calendars/cal?role=resident');
    await page.locator(`${R} [data-res-tab="mine"]`).click();
    await page.locator(`${R} [data-res-booking="res2"] [data-res-alts]`).click();
    await expect(page.locator(`${R} [data-res-sheet="displaced"] [data-res-alt]`).first()).toBeVisible();
    await shot(page, 'res-displaced');
    await page.locator(`${R} [data-res-alt-ok]`).click();
    await expect(page.locator(`${R} [data-res-booking="res2"]`)).toHaveCount(0);
    await expect(page.locator(`${R} [data-res-done]`)).toBeVisible();
  });

  test('answer 14 as a setting: 24h before - this evening\'s booking can no longer be cancelled', async ({ page }) => {
    await open(page, '/system/calendars?tab=behavior');
    await toSetting(page, 'resident_cancel_until');
    await opt(page, 'resident_cancel_until', '24h').click();
    await page.evaluate(() => (location.hash = '#/calendars/cal?role=resident'));
    await page.locator(`${R} [data-res-tab="mine"]`).click();
    await expect(page.locator(`${R} [data-res-booking="res3"] [data-res-cancel]`)).toBeDisabled();
    await expect(page.locator(`${R} [data-res-booking="res3"] [data-res-closed]`)).toContainText('24 שעות');
  });

  test('answer 16 as a setting: the time bar', async ({ page }) => {
    await open(page, '/system/calendars?tab=behavior');
    await toSetting(page, 'phone_time_picker');
    await opt(page, 'phone_time_picker', 'timeline').click();
    await page.evaluate(() => (location.hash = '#/calendars/cal?role=resident'));
    // the phone pages the room cards: forward until the quiet room is there
    await expect(page.locator(`${R} [data-res-view="rooms"]`)).toBeVisible();
    for (let i = 0; i < 6 && !(await page.locator(`${R} [data-res-room="quiet"]`).count()); i += 1) await page.locator(`${R} [data-res-next]`).click();
    await page.locator(`${R} [data-res-room="quiet"]`).click();
    await expect(page.locator(`${R} [data-res-view="slot"][data-picker="timeline"]`)).toBeVisible();
    const bar = page.locator(`${R} [data-res-bar]`);
    const box = await bar.boundingBox();
    if (!box) throw new Error('no bar');
    await page.mouse.click(box.x + box.width * 0.9, box.y + box.height / 2);
    await expect(page.locator(`${R} [data-res-tlsel]`)).toContainText('–');
    await expect(page.locator(`${R} [data-res-continue]`)).toBeEnabled();
    await fits(page);
    await shot(page, 'res-timeline');
  });

  test('answer 13 as a setting: "blocked" disables the contested starts', async ({ page }) => {
    await open(page, '/system/calendars?tab=behavior');
    await toSetting(page, 'resident_pending_display');
    await opt(page, 'resident_pending_display', 'blocked').click();
    await page.evaluate(() => (location.hash = '#/calendars/cal?role=resident'));
    await page.locator(`${R} [data-res-room="hall"]`).click();
    await page.locator(`${R} [data-res-dur="120"]`).click();
    await expect(page.locator(`${R} [data-res-slot][data-look="contest"]`)).toHaveCount(0);
    await expect(page.locator(`${R} [data-res-slot][data-look="blocked"]`).first()).toBeDisabled();
  });

  test('worst-case, empty and error data', async ({ page }) => {
    await open(page, '/calendars/cal?role=resident&data=worst');
    await expect(page.locator(`${R} [data-res-view="rooms"]`)).toBeVisible();
    await fits(page);
    await shot(page, 'res-rooms-worst');
    await page.locator(`${R} [data-res-tab="mine"]`).click();
    await fits(page);
    await open(page, '/calendars/cal?role=resident&data=error');
    await expect(page.locator('sw-app calendars-page [data-cal-state="error"]')).toBeVisible();
  });
});
