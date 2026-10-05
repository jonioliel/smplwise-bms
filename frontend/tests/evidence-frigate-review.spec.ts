import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inPageCheck, summarize } from './layout-guard';
import { ADMIN, installFrigate, newFrigateMock, openApp, type FrigateMock } from './frigate-mocks';

// NN5-F1B: the review screen ("סקירה") of a Frigate recorder - cards, layers, filters, per-user reviewed state with bulk marking and
// keys, the drawer with the tracked-object timeline and the recording action, and every state (loading, empty, all reviewed, offline,
// error, no permission, no Frigate recorder). Against a MOCKED backend (page.route on api/v1); the three projects (desktop, tablet,
// mobile). SW_SHOTS=1 writes evidence screenshots to docs/design/evidence/nn5-f1b. No real frame, host or credential.
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/nn5-f1b');
const SKINS = ['classic', 'domus', 'tesla', 'bubble'] as const;

const SCREEN = 'investigate-reviews';
const cards = (page: Page) => page.locator(`${SCREEN} frigate-review-card`);
const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);

async function shot(page: Page, name: string) {
  if (!process.env.SW_SHOTS) return;
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}.png`) });
}

async function start(page: Page, over: Partial<FrigateMock> = {}, query = ''): Promise<FrigateMock> {
  const m = newFrigateMock(over);
  await installFrigate(page, m);
  await openApp(page, '/investigate/reviews', query);
  return m;
}

test('cards: one per review item with layer, camera, time, where, objects, zones and the reviewed state; the layer counts and the new dots', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await start(page);
  await expect(page.locator(`${SCREEN} [data-review-screen]`)).toBeVisible();
  // the default view: the alert layer, unreviewed ones
  await expect(cards(page)).toHaveCount(4);
  await expect(page.locator(`${SCREEN} [data-review-layer="alert"]`)).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator(`${SCREEN} [data-review-layer="alert"] .n`)).toHaveText('5');
  await expect(page.locator(`${SCREEN} [data-review-layer="detection"] .n`)).toHaveText('2');
  await expect(page.locator(`${SCREEN} [data-review-layer="motion"] .n`)).toHaveText('2');
  const first = cards(page).first();
  await expect(first.locator('.layer')).toContainText('התראה');
  await expect(first.locator('.cam')).toHaveText('כניסה ראשית');
  await expect(first.locator('[data-review-where]')).toHaveText('כניסה · קומת קרקע');
  await expect(first.locator('[data-obj="person"]')).toHaveText('אדם');
  await expect(first.locator('.zones')).toHaveText('מדרגות כניסה');
  await expect(first.locator('[data-review-state]')).toHaveAttribute('data-review-state', 'new');
  await expect(first.locator('img')).toHaveAttribute('src', /^data:image\/svg/);
  // a camera with no plan anchor and a long name: no where line, the name truncates, nothing overflows
  const long = cards(page).filter({ hasText: 'שער צדדי' });
  await expect(long.locator('[data-review-where]')).toHaveCount(0);
  await expect(long.locator('.none')).toContainText('אין תמונה'); // no still yet
  await noOverflow(page);
  await shot(page, 'review-ready');
  expect(errors).toEqual([]);
});

test('filters become the query; layers switch; the status filter shows the reviewed ones', async ({ page }) => {
  const m = await start(page);
  await expect(cards(page)).toHaveCount(4);
  await page.locator(`${SCREEN} [data-review-layer="detection"]`).click();
  await expect(cards(page)).toHaveCount(2);
  await expect(cards(page).first().locator('.layer')).toContainText('זיהוי');
  expect(m.hits.some((h) => /analytics\/reviews\?.*layer=detection/.test(h))).toBe(true);
  await page.locator(`${SCREEN} [data-review-layer="alert"]`).click();
  // camera filter
  await page.locator(`${SCREEN} [data-review-filter="camera"]`).click();
  await page.getByRole('option', { name: 'חצר אחורית' }).click();
  await expect.poll(() => m.hits.some((h) => /camera_id=fg-yard/.test(h))).toBe(true);
  await expect(cards(page)).toHaveCount(0); // its one alert is already reviewed
  await expect(page.locator(`${SCREEN} [data-review-state="all-reviewed"]`)).toBeVisible();
  // status: all -> the reviewed one is back, dimmed with the "נסקר" state
  const mark = m.hits.length;
  await page.locator(`${SCREEN} [data-review-filter="status"]`).click();
  await page.getByRole('option', { name: 'הכול' }).click();
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first().locator('[data-review-state]')).toHaveAttribute('data-review-state', 'reviewed');
  expect(m.hits.slice(mark).some((h) => /analytics\/reviews\?/.test(h) && /reviewed=/.test(h))).toBe(false); // status "all" sends no reviewed filter
  // object filter
  await page.locator(`${SCREEN} [data-review-filter="camera"]`).click();
  await page.getByRole('option', { name: 'כל המצלמות' }).click();
  await page.locator(`${SCREEN} [data-review-filter="object"]`).click();
  await page.getByRole('option', { name: 'כלב' }).click();
  await expect.poll(() => m.hits.some((h) => /object=dog/.test(h))).toBe(true);
  await expect(cards(page)).toHaveCount(1);
});

test('reviewed: one card, the bulk bar, "mark all shown" and un-marking - at once, saved per user', async ({ page }) => {
  const m = await start(page);
  await expect(cards(page)).toHaveCount(4);
  // one card
  await cards(page).first().locator('[data-review-toggle]').click();
  await expect(cards(page).first().locator('[data-review-state]')).toHaveAttribute('data-review-state', 'reviewed');
  await expect(page.locator(`${SCREEN} [data-review-layer="alert"] [data-review-new]`)).toHaveAttribute('title', '3 חדש');
  await expect.poll(() => m.marks).toEqual([{ ids: ['rv-1'], reviewed: true }]);
  // select two, mark through the bulk bar
  await cards(page).nth(1).locator('[data-review-select]').check();
  await cards(page).nth(2).locator('[data-review-select]').check();
  await expect(page.locator(`${SCREEN} [data-review-bulk]`)).toContainText('2 נבחרו');
  await page.locator(`${SCREEN} [data-review-bulk-mark]`).click();
  await expect.poll(() => m.marks[1]).toEqual({ ids: ['rv-2', 'rv-4'], reviewed: true });
  await expect(page.locator(`${SCREEN} [data-review-bulk]`)).toHaveCount(0);
  // the last one through "mark all shown"; afterwards nothing is left to mark
  await page.locator(`${SCREEN} [data-review-mark-shown]`).click();
  await expect.poll(() => m.marks[2]).toEqual({ ids: ['rv-5'], reviewed: true });
  await expect(page.locator(`${SCREEN} [data-review-mark-shown]`)).toBeDisabled();
  await expect(page.locator(`${SCREEN} [data-review-layer="alert"] [data-review-new]`)).toHaveCount(0);
  // un-mark one
  await cards(page).first().locator('[data-review-toggle]').click();
  await expect(cards(page).first().locator('[data-review-state]')).toHaveAttribute('data-review-state', 'new');
  await expect.poll(() => m.marks[3]).toEqual({ ids: ['rv-1'], reviewed: false });
  await shot(page, 'review-marked');
});

test('a mark the server refuses is put back and says so', async ({ page }) => {
  await start(page, { markFails: true });
  await cards(page).first().locator('[data-review-toggle]').click();
  await expect(page.locator(`${SCREEN} [data-review-notice]`)).toHaveText('הסימון לא נשמר');
  await expect(cards(page).first().locator('[data-review-state]')).toHaveAttribute('data-review-state', 'new');
});

test('keys: J/K and arrows move, space selects, R reviews, Ctrl+A selects all, Enter opens, Esc closes and clears', async ({ page }) => {
  const m = await start(page);
  await expect(cards(page)).toHaveCount(4);
  await page.keyboard.press('j');
  await expect(cards(page).nth(0)).toHaveAttribute('focused', '');
  await page.keyboard.press('ArrowDown');
  await expect(cards(page).nth(1)).toHaveAttribute('focused', '');
  await page.keyboard.press('k');
  await expect(cards(page).nth(0)).toHaveAttribute('focused', '');
  await page.keyboard.press(' ');
  await expect(cards(page).nth(0).locator('[data-review-select]')).toBeChecked();
  await page.keyboard.press('r'); // the selection is the target
  await expect.poll(() => m.marks[0]).toEqual({ ids: ['rv-1'], reviewed: true });
  await page.keyboard.press('Control+a');
  await expect(page.locator(`${SCREEN} [data-review-bulk]`)).toContainText('4 נבחרו');
  await page.keyboard.press('Escape');
  await expect(page.locator(`${SCREEN} [data-review-bulk]`)).toHaveCount(0);
  await page.keyboard.press('Enter'); // the focused card opens
  await expect(page.locator(`${SCREEN} [data-review-drawer]`)).toBeVisible();
  await page.keyboard.press('r'); // inside the drawer R toggles that item
  await expect.poll(() => m.marks[1]).toEqual({ ids: ['rv-1'], reviewed: false });
  await page.keyboard.press('Escape');
  await expect(page.locator(`${SCREEN} [data-review-drawer]`)).toHaveCount(0);
  // typing in a filter's search never triggers a shortcut
  const before = m.marks.length;
  await page.locator(`${SCREEN} [data-review-filter="camera"]`).click();
  await page.keyboard.type('r');
  expect(m.marks.length).toBe(before);
});

test('drawer: the tracked-object timeline (data only) and the recording action - offered when the backend says so, otherwise unavailable with the reason', async ({ page }) => {
  await start(page);
  // rv-2: person + dog, two zones, recording not ready
  await cards(page).nth(1).locator('[data-review-open]').click();
  const drawer = page.locator(`${SCREEN} [data-review-drawer]`);
  await expect(drawer.locator('[data-review-detail="rv-2"]')).toBeVisible();
  await expect(drawer.locator('[data-tracked]')).toHaveCount(2);
  await expect(drawer.locator('[data-tracked="rv-2-o0"] [data-timeline-row]')).toHaveCount(5);
  await expect(drawer.locator('[data-tracked="rv-2-o0"] [data-timeline-row="zone"]').first()).toContainText('נכנס לאזור: מדרגות כניסה');
  await expect(drawer.locator('[data-tracked="rv-2-o0"]')).toContainText('ביטחון 87%');
  const play = drawer.locator('[data-review-play]');
  await expect(play).toHaveText(/פתח הקלטה/);
  await expect(play).toHaveAttribute('disabled', '');
  await expect(drawer.locator('[data-review-play-why]')).toHaveText('ההקלטה עדיין לא זמינה לנגינה מכאן');
  await shot(page, 'review-drawer-unavailable');
  await page.keyboard.press('Escape');
  // rv-1: the recording can be opened through the existing playback screen
  await cards(page).first().locator('[data-review-open]').click();
  await expect(drawer.locator('[data-review-play-why]')).toHaveCount(0);
  await expect(drawer.locator('[data-review-play]')).not.toHaveAttribute('disabled', '');
  await drawer.locator('[data-review-play]').click();
  await expect.poll(() => page.evaluate(() => location.hash)).toMatch(/^#\/investigate\/playback\?camera=fg-front&t=2026-10-06T07%3A48%3A00\.000Z$/);
});

test('drawer: an item without a timeline (motion) and one with no still still open; the drawer can mark reviewed', async ({ page }) => {
  const m = await start(page);
  await page.locator(`${SCREEN} [data-review-layer="motion"]`).click();
  await expect(cards(page)).toHaveCount(2);
  await cards(page).first().locator('[data-review-open]').click();
  const drawer = page.locator(`${SCREEN} [data-review-drawer]`);
  await expect(drawer.locator('[data-review-no-timeline]')).toHaveText('אין פירוט נוסף על הפריט הזה');
  await drawer.locator('[data-review-detail-toggle]').click();
  await expect.poll(() => m.marks[0]).toEqual({ ids: ['rv-8'], reviewed: true });
  await expect(drawer.locator('[data-review-detail-toggle]')).toHaveText(/סמן כלא נסקר/);
});

test('states: loading, empty, offline with the last data, error with retry, no permission, and no Frigate recorder (the event windows)', async ({ page }) => {
  // loading
  await start(page, { delayMs: 1500 });
  await expect(page.locator(`${SCREEN} [data-review-state="loading"]`)).toBeVisible();
  await expect(cards(page).first()).toBeVisible();

  // empty
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await start(page, { reviews: 'empty' });
  await expect(page.locator(`${SCREEN} [data-review-state="empty"]`)).toContainText('אין פריטים לסינון הזה');
  await shot(page, 'review-empty');

  // offline: the list is the last one kept, and the banner says so
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await start(page, { reviews: 'offline' });
  await expect(page.locator(`${SCREEN} [data-review-offline]`)).toContainText('המקליט לא מגיב');
  await expect(cards(page)).toHaveCount(4);
  await shot(page, 'review-offline');

  // error, then retry once the recorder answers again
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  const m = await start(page, { reviews: 'error' });
  await expect(page.locator(`${SCREEN} [data-review-state="error"]`)).toContainText('לא ניתן לטעון את הסקירה');
  m.reviews = 'ok';
  await page.locator(`${SCREEN} [data-review-state="error"]`).getByRole('button', { name: 'נסה שוב' }).click();
  await expect(cards(page)).toHaveCount(4);

  // no permission: the server says 403
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await start(page, { reviews: 'forbidden' });
  await expect(page.locator(`${SCREEN} [data-review-state="forbidden"]`)).toContainText('אין לך הרשאה לסקירה');
  await shot(page, 'review-forbidden');

  // analytics permission without the events permission: the route opens (the shell's gate knows both)
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await start(page, { perms: ['video.live', 'map.read', 'analytics.read'] });
  await expect(cards(page)).toHaveCount(4);
  await expect(page.locator(`${SCREEN} [data-review-toggle]`)).toHaveCount(0); // read only: no review permission

  // events permission only (no analytics): the event windows, exactly as before this feature
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  const legacy = await start(page, { perms: ['video.live', 'map.read', 'events.read'] });
  await expect(page.locator(`${SCREEN} investigate-events`)).toBeVisible();
  expect(legacy.hits.some((h) => h.includes('analytics/reviews'))).toBe(false);

  // no Frigate recorder (available: false) and an old server (404): the event windows too
  for (const reviews of ['none', 'missing'] as const) {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await start(page, { reviews });
    await expect(page.locator(`${SCREEN} investigate-events`)).toBeVisible();
    await expect(cards(page)).toHaveCount(0);
  }
});

test('a viewer who may read but not review sees no tick and no mark buttons', async ({ page }) => {
  await start(page, { perms: ADMIN.filter((p) => p !== 'analytics.review') });
  await expect(cards(page)).toHaveCount(4);
  await expect(page.locator(`${SCREEN} [data-review-toggle]`)).toHaveCount(0);
  await expect(page.locator(`${SCREEN} [data-review-select]`)).toHaveCount(0);
  await expect(page.locator(`${SCREEN} [data-review-mark-shown]`)).toHaveCount(0);
  await page.keyboard.press('j');
  await page.keyboard.press(' ');
  await expect(page.locator(`${SCREEN} [data-review-bulk]`)).toHaveCount(0);
});

test('the screen is RTL, the still is never mirrored, and the page does not scroll sideways', async ({ page }) => {
  await start(page);
  await expect(cards(page)).toHaveCount(4);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).direction)).toBe('rtl');
  expect(await cards(page).first().locator('img').evaluate((el) => getComputedStyle(el).direction)).toBe('ltr');
  await noOverflow(page);
});

test('layout guard: the review screen in four skins, light and dark', async ({ page }) => {
  test.skip(test.info().project.name !== 'mobile' && test.info().project.name !== 'desktop', 'two projects are enough');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const m = newFrigateMock();
  await installFrigate(page, m);
  const findings: { cls: string }[] = [];
  for (const skin of SKINS) {
    for (const scheme of ['light', 'dark'] as const) {
      await page.goto('about:blank');
      await page.goto(`/?design=a&skin=${skin}&scheme=${scheme}#/investigate/reviews`);
      await page.waitForSelector(`${SCREEN} frigate-review-card`);
      await cards(page).nth(1).locator('[data-review-select]').check();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(150);
      const found = await page.evaluate(inPageCheck, { ctx: `${skin} ${scheme}`, bubble: '.card, .chip', skip: '.skl, sw-icon, svg, img', roots: [SCREEN] });
      findings.push(...found.filter((f) => f.cls !== 'target' && f.cls !== 'floating'));
      if (skin === 'classic' || skin === 'bubble') await shot(page, `review-${skin}-${scheme}`);
    }
  }
  const { lines } = summarize(findings as never);
  expect(errors, 'page errors').toEqual([]);
  expect(lines, 'layout findings').toEqual([]);
});
