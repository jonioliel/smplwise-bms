import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { url } from './generator-mocks';

// CALENDARS-UI-2310 slice B: the management views of the calendars module from the REAL build in demo mode (src/calendars/demo.ts, invented
// data): אישורים (the contested window, approve + displace, reject with a note, a series with per-occurrence rejection), תחזוקה (the list and
// the drawer in the four overlap modes), ניהול יומנים (the list, a calendar's members and roles, a new calendar), worst-case and empty data.
// Every screen: no page scroll, no sideways overflow, in light and dark, at the three widths. Screenshots for the owner's review page.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-calendars-manage-2310.spec.ts
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../smplwisebms/private/design-system-2026-10-27/round9/calendars-ui/shots');
const P = 'sw-app calendars-page';
const proj = () => test.info().project.name;
const phone = () => proj() === 'mobile';

async function open(page: Page, hash: string, scheme: 'light' | 'dark' = 'light') {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('about:blank');
  await page.goto(url(hash, 'classic', scheme));
  await page.waitForSelector(`${P} [data-cal-body]`, { timeout: 30_000 });
}

/** The owner rule 2026-10-24: no page scroll in a control screen, and nothing sideways. */
async function fits(page: Page) {
  const m = await page.evaluate(() => {
    const main = document.querySelector('sw-app')?.shadowRoot?.querySelector('main') as HTMLElement | null;
    return { sh: main?.scrollHeight ?? 0, ch: main?.clientHeight ?? 0, w: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  expect(m.sh, 'page scroll inside the shell').toBeLessThanOrEqual(m.ch + 1);
  expect(m.w, 'sideways overflow').toBeLessThanOrEqual(1);
}

async function shot(page: Page, name: string, scheme: string) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, `${name}-${proj()}-${scheme}.png`) });
}

test.describe('calendars management views (demo)', () => {
  test.describe.configure({ timeout: 120_000 });

  for (const scheme of ['light', 'dark'] as const) {
    test(`approvals: the inbox and the contested window (${scheme})`, async ({ page }) => {
      await open(page, '/calendars/approvals', scheme);
      await expect(page.locator(`${P} [data-req]`).first()).toBeVisible();
      await expect(page.locator(`${P} [data-chip="contest"]`).first()).toBeVisible();
      if (proj() === 'desktop') await expect(page.locator(`${P} [data-detail="contested"]`)).toBeVisible();
      await fits(page);
      await shot(page, 'approvals', scheme);
      if (proj() !== 'desktop') {
        // owner answer 23 (collapse, default): the panel opens on tap
        await page.locator(`${P} [data-req] [data-chip="contest"]`).first().click();
        await expect(page.locator(`${P} [data-detail="contested"]`)).toBeVisible();
        await fits(page);
        await shot(page, 'approvals-contested', scheme);
      }
    });

    test(`maintenance: the list and the drawer per overlap mode (${scheme})`, async ({ page }) => {
      await open(page, '/calendars/maint', scheme);
      await expect(page.locator(`${P} [data-maint-list]`)).toBeVisible();
      await fits(page);
      await shot(page, 'maint-list', scheme);
      for (const mode of ['first_holds', 'block', 'ask', 'override_notify'] as const) {
        await open(page, `/calendars/maint?mode=${mode}`, scheme);
        await page.locator(`${P} [data-cal-new]`).click();
        const d = page.locator(`${P} cal-maint-drawer`);
        const t = new Date();
        const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
        await d.locator('input[type="date"]').fill(today);
        await d.locator('input[type="date"]').dispatchEvent('change');
        await d.locator('[data-maint-from]').fill('15:30');
        await d.locator('[data-maint-from]').dispatchEvent('change');
        await d.locator('[data-maint-to]').fill('18:00');
        await d.locator('[data-maint-to]').dispatchEvent('change');
        await d.locator('[data-maint-title]').fill('החלפת גוף תאורה ובדיקת גלאים');
        await d.locator('[data-room="class2"]').click();
        await expect(d.locator('[data-overlaps]')).toBeVisible();
        await expect(d.locator('[data-maint-drawer]')).toHaveAttribute('data-mode', mode);
        const save = d.locator('[data-maint-save]');
        if (mode === 'block') await expect(save).toBeDisabled();
        else await expect(save).toBeEnabled();
        if (mode === 'ask') {
          await d.locator('[data-decision="block"]').click();
          await expect(save).toBeDisabled();
          await expect(d.locator('[data-alternatives]')).toBeVisible();
          await d.locator('[data-decision="override_notify"]').click();
        }
        if (mode === 'first_holds') await expect(save).toContainText('שמירה כממתין להחלטה');
        await fits(page);
        await shot(page, `maint-drawer-${mode}`, scheme);
      }
    });

    test(`manage: the list, a calendar's members, a new calendar (${scheme})`, async ({ page }) => {
      await open(page, '/calendars/manage', scheme);
      await expect(page.locator(`${P} [data-cal-row]`).first()).toBeVisible();
      await expect(page.locator(`${P} [data-pager] [data-page]`)).toContainText('/');
      await fits(page);
      await shot(page, 'manage-list', scheme);
      await open(page, '/calendars/manage/hall', scheme);
      await expect(page.locator(`${P} [data-members="hall"]`)).toBeVisible();
      await expect(page.locator(`${P} [data-member]`).first()).toBeVisible();
      if (proj() === 'desktop') await expect(page.locator(`${P} [data-roles-card]`)).toBeVisible();
      await fits(page);
      await shot(page, 'members', scheme);
      if (proj() !== 'desktop' && !phone()) {
        await page.locator(`${P} [data-roles-open]`).click();
        await expect(page.locator(`${P} [data-roles-card]`)).toBeVisible();
        await shot(page, 'members-roles', scheme);
      }
      await open(page, '/calendars/manage/new', scheme);
      await expect(page.locator(`${P} [data-cal-form="new"]`)).toBeVisible();
      await fits(page);
      await shot(page, 'calendar-new', scheme);
    });
  }

  test('approve + displace the holder of a contested window', async ({ page }) => {
    test.skip(phone(), 'one width proves the flow; the phone layout is covered above');
    await open(page, '/calendars/approvals');
    await page.locator(`${P} [data-req="r2"]`).click();
    const det = page.locator(`${P} [data-detail="contested"]`);
    await expect(det).toBeVisible();
    // the first in line is preselected (owner answer 11B: automatic, first come)
    await expect(det.locator('[data-first-in-line]')).toBeVisible();
    await expect(det.locator('[data-pick]')).toHaveValue('r5');
    await expect(det.locator('[data-lane="holder"]')).toHaveCount(1);
    await expect(det.locator('[data-apply]')).toContainText('אישור ודחיקה');
    await det.locator('[data-apply]').click();
    await expect(page.locator(`${P} [data-cal-toast]`)).toContainText('נדחקה');
    await expect(page.locator(`${P} [data-req="r5"]`)).toHaveCount(0);
    await page.locator(`${P} [data-seg="decided"]`).click();
    await expect(page.locator(`${P} [data-decided="r5"]`)).toBeVisible();
  });

  test('keep the holder: every request of the window is rejected', async ({ page }) => {
    test.skip(phone(), 'one width proves the flow');
    await open(page, '/calendars/approvals');
    await page.locator(`${P} [data-req="r2"]`).click();
    const det = page.locator(`${P} [data-detail="contested"]`);
    await det.locator('[data-choice="keep"]').click();
    await expect(det.locator('[data-apply]')).toContainText('דחיית הבקשות');
    await det.locator('[data-apply]').click();
    await expect(page.locator(`${P} [data-req="r2"]`)).toHaveCount(0);
    await expect(page.locator(`${P} [data-req="r6"]`)).toHaveCount(0);
  });

  test('reject with a note; a series approved except one date', async ({ page }) => {
    await open(page, '/calendars/approvals');
    // the phone pages the requests: forward until r3 is there
    await expect(page.locator(`${P} [data-req-list]`)).toBeVisible();
    for (let i = 0; i < 6 && !(await page.locator(`${P} [data-reject="r3"]`).count()); i += 1) await page.locator(`${P} [data-pager] button[aria-label="הבא"]`).click();
    await page.locator(`${P} [data-reject="r3"]`).click();
    await page.locator(`${P} [data-reject-note]`).fill('החדר שמור לישיבת הנהלה');
    await page.locator(`${P} [data-reject-confirm]`).click();
    await expect(page.locator(`${P} [data-req="r3"]`)).toHaveCount(0);
    if (phone()) return;
    await page.locator(`${P} [data-req="r1"]`).click();
    if (proj() === 'tablet') await expect(page.locator(`${P} [data-detail="series"]`)).toBeVisible();
    const det = page.locator(`${P} [data-detail="series"]`);
    await expect(det).toBeVisible();
    const dates = det.locator('[data-date]');
    if (await dates.count()) {
      await dates.first().click();
      await expect(det.locator('[data-apply]')).toContainText('אישור למעט');
    }
    await det.locator('[data-apply]').click();
    await expect(page.locator(`${P} [data-req="r1"]`)).toHaveCount(0);
  });

  test('members: a role change is saved at once; add and remove a member', async ({ page }) => {
    test.skip(phone(), 'the phone shows the same list as cards');
    await open(page, '/calendars/manage/hall');
    const row = page.locator(`${P} [data-member="role:operator"]`);
    await row.locator('[data-role="edit"]').click();
    await expect(row.locator('[data-role="edit"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(`${P} [data-cal-toast]`)).toContainText('עריכת הכול');
    await page.locator(`${P} [data-member="user:p-o"] [data-remove]`).click();
    await expect(page.locator(`${P} [data-member="user:p-o"]`)).toHaveCount(0);
    await page.locator(`${P} [data-add-member]`).click();
    await page.locator(`${P} [data-add-row] select`).first().selectOption('department');
    await page.locator(`${P} [data-add-who]`).fill('d-new');
    await page.locator(`${P} [data-add-confirm]`).click();
    await expect(page.locator(`${P} [data-cal-toast]`)).toContainText('נוסף');
  });

  test('new calendar: created and opened on its members', async ({ page }) => {
    await open(page, '/calendars/manage/new');
    await page.locator(`${P} [data-f-name]`).fill('חדר ישיבות חדש');
    await page.locator(`${P} [data-f-color="violet"]`).click();
    await page.locator(`${P} [data-f-approval]`).selectOption('always');
    await page.locator(`${P} [data-f-save]`).click();
    await expect(page).toHaveURL(/#\/calendars\/manage\/c\d+/);
    await expect(page.locator(`${P} [data-members]`)).toBeVisible();
  });

  test('archive from the "..." menu', async ({ page }) => {
    test.skip(phone(), 'the phone list opens a calendar on tap (no menu)');
    await open(page, '/calendars/manage');
    await page.locator(`${P} [data-cal-menu="brosh"]`).click();
    await page.locator(`${P} [data-archive="brosh"]`).click();
    await page.locator(`${P} [data-archive-confirm]`).click();
    await expect(page.locator(`${P} [data-cal-row="brosh"]`)).toHaveCount(0);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`break-ui worst case: approvals, manage, members (${scheme})`, async ({ page }) => {
      for (const [view, name] of [['approvals', 'worst-approvals'], ['manage', 'worst-manage'], ['manage/hall', 'worst-members'], ['maint', 'worst-maint']] as const) {
        await open(page, `/calendars/${view}?data=worst`, scheme);
        await page.waitForTimeout(400);
        await fits(page);
        await shot(page, name, scheme);
      }
    });
  }

  test('empty data: approvals, maintenance and manage show their empty states', async ({ page }) => {
    for (const view of ['approvals', 'maint', 'manage']) {
      await open(page, `/calendars/${view}?data=empty`);
      await expect(page.locator(`${P} [data-cal-state="empty"]`).first()).toBeVisible();
      await fits(page);
      await shot(page, `empty-${view}`, 'light');
    }
  });
});
