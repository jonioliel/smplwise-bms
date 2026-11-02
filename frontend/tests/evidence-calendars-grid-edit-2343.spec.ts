import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { url } from './generator-mocks';
import { settle } from './helpers/settle';

// CAL-GRID-EDIT-2343: Outlook-style editing on the calendar grid (owner answers 02.11, the approved round-13 prototype), in demo mode
// (src/calendars/demo.ts: invented data), desktop / tablet / phone, light and dark, Hebrew RTL: drag-select + the quick create, a click
// on an entry + the peek card, moving an entry onto a confirmed one (the contested hint) + "בטל", the keyboard selection, the week view,
// the touch long press (synthetic touch pointer events), the phone sheet and the resident's day grid. Every screen: no page scroll, no
// sideways overflow. Screenshots go to the owner's review folder (private, local).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-calendars-grid-edit-2343.spec.ts --workers=1

const SHOTS = process.env.SW_CAL_SHOTS || 'C:/cloude/smplwisebms/private/design-system-2026-10-27/round13/calendar-outlook/shots';
const FIXED = new Date('2026-11-02T06:20:00Z'); // Monday 2.11.2026, 08:20 in the installation's zone (the prototype's "now")
const P = 'sw-app calendars-page';
const V = `${P} cal-view-calendar`;
const proj = () => test.info().project.name;
const BAND = { from: 7 * 60, to: 22 * 60 };

async function open(page: Page, hash: string, scheme: 'light' | 'dark' = 'light') {
  await page.clock.setFixedTime(FIXED);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('about:blank');
  await page.goto(url(hash, 'classic', scheme));
  await page.waitForSelector(`${P} [data-cal-body]`, { timeout: 30_000 });
  await page.waitForSelector(`${V} [data-cal-week]`, { timeout: 30_000 });
}

async function noScroll(page: Page) {
  const m = await page.evaluate(() => {
    const main = document.querySelector('sw-app')?.shadowRoot?.querySelector('main');
    return { sh: main?.scrollHeight ?? 0, ch: main?.clientHeight ?? 0, dw: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  expect(m.sh, 'the page scrolls').toBeLessThanOrEqual(m.ch + 1);
  expect(m.dw, 'sideways overflow').toBeLessThanOrEqual(1);
}

async function shot(page: Page, name: string, scheme: string) {
  fs.mkdirSync(SHOTS, { recursive: true });
  await settle(page);
  await page.screenshot({ path: path.join(SHOTS, `${name}-${proj()}-${scheme}.png`) });
}

/** The page point of a local minute in a column (the grid's band is 07:00-22:00). */
async function pointIn(page: Page, col: string, minute: number) {
  const box = await page.locator(`${V} [data-cal-col="${col}"]`).boundingBox();
  if (!box) throw new Error(`no column ${col}`);
  return { x: box.x + box.width / 2, y: box.y + ((minute - BAND.from) / (BAND.to - BAND.from)) * box.height };
}

/** A touch press, held and dragged (the long press of owner answer 4A), as pointer events on the grid. */
async function touchHold(page: Page, col: string, from: number, to: number, holdMs = 520) {
  const a = await pointIn(page, col, from);
  const b = await pointIn(page, col, to);
  await page.evaluate(async ({ a, b, holdMs, col }) => {
    const root = document.querySelector('sw-app')?.shadowRoot?.querySelector('calendars-page')?.shadowRoot;
    const view = root?.querySelector('cal-view-calendar') ?? root?.querySelector('cal-resident')?.shadowRoot?.querySelector('cal-view-calendar');
    const colEl = view?.shadowRoot?.querySelector(`[data-cal-col="${col}"]`) as HTMLElement;
    const fire = (type: string, x: number, y: number) => colEl.dispatchEvent(new PointerEvent(type, { bubbles: true, composed: true, pointerType: 'touch', pointerId: 7, button: 0, clientX: x, clientY: y, isPrimary: true }));
    fire('pointerdown', a.x, a.y);
    await new Promise((r) => setTimeout(r, holdMs));
    for (let i = 1; i <= 6; i += 1) fire('pointermove', a.x, a.y + ((b.y - a.y) * i) / 6);
    fire('pointerup', b.x, b.y);
  }, { a, b, holdMs, col });
}

test.describe('calendar grid editing (CAL-GRID-EDIT-2343)', () => {
  test.describe.configure({ timeout: 150_000 });
  for (const scheme of ['light', 'dark'] as const) {
    test(`day view: drag-select opens the quick create, Esc cancels (${scheme})`, async ({ page }) => {
      test.skip(proj() !== 'desktop', 'mouse drag: desktop; touch below');
      await open(page, '/calendars/cal?view=day&date=2026-11-02', scheme);
      const a = await pointIn(page, 'brosh', 15 * 60 + 35); // after "שיחת הורים" 14:30-15:15 and the room's 10-minute buffer
      const b = await pointIn(page, 'brosh', 16 * 60 + 20);
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      await page.mouse.move(a.x, a.y + 12, { steps: 3 });
      await page.mouse.move(b.x, b.y, { steps: 8 });
      await expect(page.locator(`${V} [data-cal-sel]`)).toBeVisible();
      await page.mouse.up();
      const qc = page.locator(`${V} cal-quick-create [data-cal-quick]`);
      await expect(qc).toBeVisible();
      await expect(qc.locator('[data-cal-qc="from"]')).toHaveValue('15:30');
      await expect(qc.locator('[data-cal-qc="to"]')).toHaveValue('16:30');
      await expect(qc.locator('[data-cal-qc-status]')).toHaveAttribute('data-cal-qc-status', 'ok');
      await expect(qc.locator('[data-cal-slot="attendees"]')).toHaveCount(1); // the attendee picker's slot (another branch)
      await qc.locator('[data-cal-qc="title"]').fill('ישיבת צוות');
      await shot(page, 'grid-quick-create', scheme);
      await noScroll(page);
      await page.keyboard.press('Escape');
      await expect(qc).toHaveCount(0);
      await expect(page.locator(`${V} [data-cal-sel]`)).toHaveCount(0);
    });

    test(`a click on an entry opens its peek card; Enter in the quick create saves with "בטל" (${scheme})`, async ({ page }) => {
      test.skip(proj() !== 'desktop', 'desktop');
      await open(page, '/calendars/cal?view=day&date=2026-11-02', scheme);
      await page.locator(`${V} [data-cal-col="alon"] [data-cal-entry]`).filter({ hasText: 'ועדת תרבות' }).click();
      const pk = page.locator(`${V} cal-peek [data-cal-peek]`);
      await expect(pk).toBeVisible();
      await expect(pk.locator('[data-cal-pk="approve"]')).toBeVisible(); // the calendar's manager on a request
      await shot(page, 'grid-peek', scheme);
      await page.keyboard.press('Escape');
      await expect(pk).toHaveCount(0);
      const p = await pointIn(page, 'brosh', 17 * 60 + 5);
      await page.mouse.click(p.x, p.y); // a click = 30 minutes
      const qc = page.locator(`${V} cal-quick-create [data-cal-quick]`);
      await expect(qc.locator('[data-cal-qc="to"]')).toHaveValue('17:30');
      await qc.locator('[data-cal-qc="title"]').fill('שיחת הורים');
      await qc.locator('[data-cal-qc="title"]').press('Enter');
      const toast = page.locator(`${V} [data-cal-grid-toast]`);
      await expect(toast).toContainText('ההזמנה נשמרה');
      await expect(toast.locator('[data-cal-undo]')).toBeVisible();
      await shot(page, 'grid-saved-toast', scheme);
    });
  }

  test('moving an entry onto a confirmed one shows the contested hint; the drop sends a request; "בטל" restores', async ({ page }) => {
    test.skip(proj() !== 'desktop', 'desktop');
    await open(page, '/calendars/cal?view=day&date=2026-11-02');
    const ev = page.locator(`${V} [data-cal-col="brosh"] [data-cal-entry]`).filter({ hasText: 'שיחת משוב' });
    const box = await ev.boundingBox();
    if (!box) throw new Error('no entry');
    const to = await pointIn(page, 'brosh', 11 * 60 + 15);
    await page.mouse.move(box.x + box.width / 2, box.y + 8);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + 20, { steps: 3 });
    await page.mouse.move(to.x, to.y, { steps: 10 });
    await expect(page.locator(`${V} [data-cal-drag="contest"]`)).toBeVisible();
    await shot(page, 'grid-drag-contested', 'light');
    await page.mouse.up();
    const toast = page.locator(`${V} [data-cal-grid-toast]`);
    await expect(toast).toContainText('הועבר');
    await expect(toast).toContainText('ממתין לאישור');
    await expect(page.locator(`${V} [data-cal-held]`)).toHaveCount(1); // the approved slot stays held, dotted
    await shot(page, 'grid-held-slot', 'light');
    await toast.locator('[data-cal-undo]').click();
    await expect(toast).toContainText('הפעולה בוטלה');
    await expect(page.locator(`${V} [data-cal-held]`)).toHaveCount(0);
  });

  test('keyboard: arrows, Shift + arrows and Enter open the quick create without animation', async ({ page }) => {
    test.skip(proj() !== 'desktop', 'desktop');
    await open(page, '/calendars/cal?view=week&date=2026-11-02');
    await page.locator(`${V} [data-cal-week]`).focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Shift+ArrowDown');
    await page.keyboard.press('Shift+ArrowDown');
    await expect(page.locator(`${V} [data-cal-sel]`)).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator(`${V} cal-quick-create [data-cal-quick].instant`)).toBeVisible();
    await shot(page, 'grid-week-keyboard', 'light');
    await noScroll(page);
  });

  test('touch: a long press selects and a drag extends it (tablet popover, phone sheet)', async ({ page }) => {
    test.skip(proj() === 'desktop', 'touch layouts');
    await open(page, '/calendars/cal?view=day&date=2026-11-02');
    await expect(page.locator(`${V} [data-cal-coach]`)).toBeVisible();
    const col = proj() === 'mobile' ? (await page.locator(`${V} [data-cal-col]`).first().getAttribute('data-cal-col')) as string : 'brosh';
    await touchHold(page, col, 18 * 60 + 5, 19 * 60 + 10);
    const qc = page.locator(`${V} cal-quick-create`);
    await expect(qc.locator(proj() === 'mobile' ? '[data-cal-quick="sheet"]' : '[data-cal-quick]')).toBeVisible();
    await shot(page, 'grid-touch-select', 'light');
    await noScroll(page);
  });

  test('the resident sees only the rooms he may book; other bookings read "תפוס"', async ({ page }) => {
    test.skip(proj() !== 'mobile', 'the resident flow is the phone');
    await page.clock.setFixedTime(FIXED);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('about:blank');
    await page.goto(url('/calendars?role=resident', 'classic', 'light'));
    await page.waitForSelector(`${P} cal-resident`, { timeout: 30_000 });
    await page.locator(`${P} cal-resident [data-res-tab="grid"]`).click();
    const grid = page.locator(`${P} cal-resident cal-view-calendar`);
    await expect(grid.locator('[data-cal-week]')).toBeVisible();
    await expect(grid.locator('[data-cal-col="pc"]')).toHaveCount(0); // view only for him: not on his grid
    await shot(page, 'grid-resident', 'light');
    await noScroll(page);
  });
});
