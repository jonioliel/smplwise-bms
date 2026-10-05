import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inPageCheck, summarize } from './layout-guard';
import { installFrigate, newFrigateMock, openApp, type FrigateMock } from './frigate-mocks';

// NN5-F1B: the review screen ("סקירה") of a Frigate recorder - cards, layers, filters, per-user reviewed state with bulk marking and
// keys, the drawer and the recording action, paging, the motion layer, and every state (loading, empty, all reviewed, offline, error,
// no permission, no Frigate recorder). Against a MOCKED backend (page.route on api/v1; the routes of routers/frigate.py) on the three
// projects (desktop, tablet, mobile), and once in demo mode (no backend). SW_SHOTS=1 writes evidence screenshots to
// docs/design/evidence/nn5-f1b. No real frame, host or credential.
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

const marks = (m: FrigateMock) => m.marks.map((x) => ({ ids: x.ids, reviewed: x.reviewed }));

test('cards: one per review item with layer, camera, time, objects, zones and the reviewed state; the layer counts and the new dots; partial coverage is said', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await start(page);
  await expect(page.locator(`${SCREEN} [data-review-screen]`)).toBeVisible();
  // the default view: the alert layer, unreviewed ones
  await expect(cards(page)).toHaveCount(4);
  await expect(page.locator(`${SCREEN} [data-review-layer="alert"]`)).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator(`${SCREEN} [data-review-layer="alert"] .n`)).toHaveText('5');
  await expect(page.locator(`${SCREEN} [data-review-layer="detection"] .n`)).toHaveText('2');
  await expect(page.locator(`${SCREEN} [data-review-layer="motion"] .n`)).toHaveCount(0); // read only when shown
  await expect(page.locator(`${SCREEN} [data-review-partial]`)).toHaveText('הקלטה על תנועה בלבד: כיסוי חלקי');
  const first = cards(page).first();
  await expect(first.locator('.layer')).toContainText('התראה');
  await expect(first.locator('.cam')).toHaveText('כניסה ראשית');
  await expect(first.locator('[data-obj="person"]')).toHaveText('אדם');
  await expect(first.locator('.zones')).toHaveText('מדרגות כניסה');
  await expect(first.locator('[data-review-state]')).toHaveAttribute('data-review-state', 'new');
  await expect(first.locator('img')).toHaveAttribute('src', /\/api\/v1\/frigate\/nvr-2\/reviews\/rv-1\/thumbnail$/); // through Arx, never a Frigate address
  // a camera with a long name whose still is missing: the name truncates, the placeholder says so, nothing overflows
  const long = cards(page).filter({ hasText: 'שער צדדי' });
  await expect(long.locator('.none')).toContainText('אין תמונה');
  await noOverflow(page);
  await shot(page, 'review-ready');
  expect(errors).toEqual([]);
});

test('filters become the query; layers switch; the status filter shows the reviewed ones; the object filter narrows the page', async ({ page }) => {
  const m = await start(page);
  await expect(cards(page)).toHaveCount(4);
  await page.locator(`${SCREEN} [data-review-layer="detection"]`).click();
  await expect(cards(page)).toHaveCount(2);
  await expect(cards(page).first().locator('.layer')).toContainText('זיהוי');
  expect(m.hits.some((h) => /frigate\/nvr-2\/reviews\?.*severity=detection/.test(h))).toBe(true);
  await page.locator(`${SCREEN} [data-review-layer="alert"]`).click();
  // camera filter: only the cameras of the Frigate recorder are offered
  await page.locator(`${SCREEN} [data-review-filter="camera"]`).click();
  await expect(page.getByRole('option', { name: 'לובי' })).toHaveCount(0); // a Hikvision camera
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
  expect(m.hits.slice(mark).some((h) => /frigate\/nvr-2\/reviews\?/.test(h) && /reviewed=/.test(h))).toBe(false); // status "all" sends no reviewed filter
  // object filter (the server has none: it narrows the loaded page)
  await page.locator(`${SCREEN} [data-review-filter="camera"]`).click();
  await page.getByRole('option', { name: 'כל המצלמות' }).click();
  await expect(cards(page)).toHaveCount(5);
  await page.locator(`${SCREEN} [data-review-filter="object"]`).click();
  await page.getByRole('option', { name: 'כלב' }).click();
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first().locator('.cam')).toHaveText('כניסה ראשית');
});

test('paging: the server returns a page, "טען עוד" continues from where it stopped and adds only new cards', async ({ page }) => {
  const m = await start(page, { pageLimit: 2 });
  await expect(cards(page)).toHaveCount(2);
  await page.locator(`${SCREEN} [data-review-more]`).click();
  await expect(cards(page)).toHaveCount(4);
  expect(m.hits.some((h) => /reviews\?.*before=\d/.test(h))).toBe(true);
  await expect(page.locator(`${SCREEN} [data-review-more]`)).toHaveCount(0);
});

test('reviewed: one card, the bulk bar, "mark all shown" and un-marking - at once, saved per user and recorder', async ({ page }) => {
  const m = await start(page);
  await expect(cards(page)).toHaveCount(4);
  // one card
  await cards(page).first().locator('[data-review-toggle]').click();
  await expect(cards(page).first().locator('[data-review-state]')).toHaveAttribute('data-review-state', 'reviewed');
  await expect(page.locator(`${SCREEN} [data-review-layer="alert"] [data-review-new]`)).toHaveAttribute('title', '3 חדש');
  await expect.poll(() => marks(m)).toEqual([{ ids: ['rv-1'], reviewed: true }]);
  expect(m.marks[0].recorder).toBe('nvr-2');
  // select two, mark through the bulk bar
  await cards(page).nth(1).locator('[data-review-select]').check();
  await cards(page).nth(2).locator('[data-review-select]').check();
  await expect(page.locator(`${SCREEN} [data-review-bulk]`)).toContainText('2 נבחרו');
  await page.locator(`${SCREEN} [data-review-bulk-mark]`).click();
  await expect.poll(() => marks(m)[1]).toEqual({ ids: ['rv-2', 'rv-4'], reviewed: true });
  await expect(page.locator(`${SCREEN} [data-review-bulk]`)).toHaveCount(0);
  // the last one through "mark all shown"; afterwards nothing is left to mark
  await page.locator(`${SCREEN} [data-review-mark-shown]`).click();
  await expect.poll(() => marks(m)[2]).toEqual({ ids: ['rv-5'], reviewed: true });
  await expect(page.locator(`${SCREEN} [data-review-mark-shown]`)).toBeDisabled();
  await expect(page.locator(`${SCREEN} [data-review-layer="alert"] [data-review-new]`)).toHaveCount(0);
  // un-mark one
  await cards(page).first().locator('[data-review-toggle]').click();
  await expect(cards(page).first().locator('[data-review-state]')).toHaveAttribute('data-review-state', 'new');
  await expect.poll(() => marks(m)[3]).toEqual({ ids: ['rv-1'], reviewed: false });
  await shot(page, 'review-marked');
});

test('a mark the server refuses is put back and says so', async ({ page }) => {
  await start(page, { markFails: true });
  await cards(page).first().locator('[data-review-toggle]').click();
  await expect(page.locator(`${SCREEN} [data-review-notice]`)).toHaveText('הסימון לא נשמר');
  await expect(cards(page).first().locator('[data-review-state]')).toHaveAttribute('data-review-state', 'new');
});

test('keys: J/K and arrows move, space selects, R reviews, Ctrl+A selects all, Enter opens, Esc closes and clears; a dropdown\'s typeahead is never a shortcut', async ({ page }) => {
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
  await expect.poll(() => marks(m)[0]).toEqual({ ids: ['rv-1'], reviewed: true });
  await page.keyboard.press('Control+a');
  await expect(page.locator(`${SCREEN} [data-review-bulk]`)).toContainText('4 נבחרו');
  await page.keyboard.press('Escape');
  await expect(page.locator(`${SCREEN} [data-review-bulk]`)).toHaveCount(0);
  await page.keyboard.press('Enter'); // the focused card opens
  await expect(page.locator(`${SCREEN} [data-review-drawer]`)).toBeVisible();
  await page.keyboard.press('r'); // inside the drawer R toggles that item
  await expect.poll(() => marks(m)[1]).toEqual({ ids: ['rv-1'], reviewed: false });
  await page.keyboard.press('Escape');
  await expect(page.locator(`${SCREEN} [data-review-drawer]`)).toHaveCount(0);
  // a key typed while a dropdown has the focus belongs to the dropdown
  const before = m.marks.length;
  await page.locator(`${SCREEN} [data-review-filter="camera"]`).click();
  await page.keyboard.type('r');
  expect(m.marks.length).toBe(before);
});

test('drawer: the facts the server has (span, detections), the recording action unavailable until the anchors are proven, the drawer can mark reviewed', async ({ page }) => {
  const m = await start(page);
  await cards(page).nth(1).locator('[data-review-open]').click(); // rv-2: person + dog, two zones
  const drawer = page.locator(`${SCREEN} [data-review-drawer]`);
  await expect(drawer.locator('[data-review-detail="rv-2"]')).toBeVisible();
  await expect(drawer.locator('[data-review-detections]')).toHaveText('2');
  await expect(drawer.locator('[data-review-activity] [data-timeline-row]')).toHaveText([/תחילת הפעילות/, /סוף הפעילות/]);
  const play = drawer.locator('[data-review-play]');
  await expect(play).toHaveText(/פתח הקלטה/);
  await expect(play).toHaveAttribute('disabled', '');
  await expect(drawer.locator('[data-review-play-why]')).toHaveText('ההקלטה עדיין לא זמינה לנגינה מכאן');
  await shot(page, 'review-drawer');
  await drawer.locator('[data-review-detail-toggle]').click();
  await expect.poll(() => marks(m)[0]).toEqual({ ids: ['rv-2'], reviewed: true });
  await expect(drawer.locator('[data-review-detail-toggle]')).toHaveText(/סמן כלא נסקר/);
  // the open item (rv-5 has no end yet) says that the activity goes on
  await page.keyboard.press('Escape');
  await cards(page).filter({ hasText: 'שער צדדי' }).locator('[data-review-open]').click();
  await expect(page.locator(`${SCREEN} [data-review-activity] [data-timeline-row]`)).toHaveText([/תחילת הפעילות/, /הפעילות נמשכת/]);
});

test('motion layer: spans from the activity, not items - no reviewed state, no marking, counted when shown, capped at 24 h', async ({ page }) => {
  const m = await start(page);
  await page.locator(`${SCREEN} [data-review-layer="motion"]`).click();
  await expect(cards(page)).toHaveCount(2);
  await expect(page.locator(`${SCREEN} [data-review-layer="motion"] .n`)).toHaveText('2');
  expect(m.hits.some((h) => /frigate\/nvr-2\/activity\?from=\d+&to=\d+/.test(h))).toBe(true);
  await expect(cards(page).first().locator('.layer')).toContainText('תנועה');
  await expect(cards(page).first().locator('[data-review-state]')).toHaveCount(0);
  await expect(page.locator(`${SCREEN} [data-review-toggle]`)).toHaveCount(0);
  await expect(page.locator(`${SCREEN} [data-review-select]`)).toHaveCount(0);
  await expect(page.locator(`${SCREEN} [data-review-mark-shown]`)).toHaveCount(0);
  await page.keyboard.press('j');
  await page.keyboard.press('r'); // nothing to mark
  expect(m.marks).toEqual([]);
  await cards(page).first().locator('[data-review-open]').click();
  const drawer = page.locator(`${SCREEN} [data-review-drawer]`);
  await expect(drawer.locator('[data-review-activity] [data-timeline-row]')).toHaveCount(2);
  await expect(drawer.locator('[data-review-detail-toggle]')).toHaveCount(0);
  await page.keyboard.press('Escape');
  // a longer period still reads at most 24 h of motion: the screen says so
  await expect(page.locator(`${SCREEN} [data-review-motion-cap]`)).toHaveCount(0);
  await page.locator(`${SCREEN} [data-review-filter="period"]`).click();
  await page.getByRole('option', { name: '7 ימים' }).click();
  await expect(page.locator(`${SCREEN} [data-review-motion-cap]`)).toHaveText('תנועה: עד 24 שעות אחורה');
  await shot(page, 'review-motion');
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

  // offline: the recorder's sync reports an error, the list is the last one kept, and the banner says so
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

  // no Frigate recorder (an empty list) and an old server (404): the event windows, exactly as before this feature
  for (const reviews of ['none', 'missing'] as const) {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await start(page, { reviews });
    await expect(page.locator(`${SCREEN} investigate-events`)).toBeVisible();
    await expect(cards(page)).toHaveCount(0);
  }
});

test('demo mode (no backend): fixture cards labelled as demo, the timeline of a tracked object, the recording opens through the existing screen where the item allows', async ({ page }) => {
  await page.goto('about:blank');
  await page.goto('/?design=a#/investigate/reviews');
  await page.waitForSelector(`${SCREEN} frigate-review-card`);
  await expect(page.locator(`${SCREEN} sw-page`)).toHaveAttribute('subheading', /נתוני הדגמה/);
  await expect(cards(page)).toHaveCount(4);
  // rv-2: tracked objects with a lifecycle timeline, recording not ready
  await cards(page).nth(1).locator('[data-review-open]').click();
  const drawer = page.locator(`${SCREEN} [data-review-drawer]`);
  await expect(drawer.locator('[data-tracked]')).toHaveCount(2);
  await expect(drawer.locator('[data-tracked="rv-2-o0"] [data-timeline-row]')).toHaveCount(5);
  await expect(drawer.locator('[data-tracked="rv-2-o0"] [data-timeline-row="zone"]').first()).toContainText('נכנס לאזור: מדרגות כניסה');
  await expect(drawer.locator('[data-tracked="rv-2-o0"]')).toContainText('ביטחון 87%');
  await expect(drawer.locator('[data-review-play]')).toHaveAttribute('disabled', '');
  await page.keyboard.press('Escape');
  // rv-1: the recording can be opened
  await cards(page).first().locator('[data-review-open]').click();
  await expect(drawer.locator('[data-review-play-why]')).toHaveCount(0);
  await drawer.locator('[data-review-play]').click();
  await expect.poll(() => page.evaluate(() => location.hash)).toMatch(/^#\/investigate\/playback\?camera=fg-front&t=2026-10-06T07%3A48%3A00\.000Z$/);
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
