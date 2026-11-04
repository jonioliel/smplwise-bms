import { test, expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { install, newMock } from './wiskey-people-mock';
import { installWrites, newWrites } from './wiskey-writes-mock';
import { installStationPeople, newStationPeople, type StationPeopleMock } from './station-people-mock';

// WISKEY-PEOPLE-COMPLETE-2390 (owner decision Q3 "a", 03.11): evidence for the "people on stations only" view of the people screen
// (אנשים > בעמדות בלבד), its three actions (adopt, ignore, delete from the station) with their confirmations and honest per-station
// results, the duplicate warning of the people screen and the editor's PIN check - against the S7 people mock, the writes mock and
// tests/station-people-mock.ts. No Home Assistant, no access-control integration, no station: nothing here can change a real user.
// Functional specs run on the desktop project; the layout specs on desktop and mobile. Screenshots go to the test's output folder
// (no pixel baseline in this branch).
//   npx playwright test tests/evidence-station-people-2390.spec.ts --workers=1        (against the built preview, or SW_BASE_URL)

const SCREEN = 'wiskey-people';
const VIEW = 'wiskey-station-people';
const NOW = '2026-11-03T10:00:00Z';
const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const desktopOnly = (info: TestInfo) => test.skip(info.project.name !== 'desktop', 'desktop project: functional spec');
const layoutOnly = (info: TestInfo) => test.skip(!['desktop', 'mobile'].includes(info.project.name), 'desktop and mobile layout');
const shot = (page: Page, info: TestInfo, name: string) => settle(page).then(() => page.screenshot({ path: info.outputPath(`${name}.png`) }));

async function open(page: Page, m: StationPeopleMock): Promise<void> {
  await page.clock.setFixedTime(new Date(NOW));
  const st = newMock('admin');
  await install(page, st);
  await installWrites(page, st, newWrites());
  await installStationPeople(page, m);
  await page.goto('/?design=a&skin=classic&scheme=light#/wiskey/people');
  await page.waitForSelector('sw-app');
  await expect(page.locator(`${SCREEN} sw-page`)).toHaveAttribute('data-people-phase', 'ready', { timeout: 20_000 });
}

async function openView(page: Page): Promise<Locator> {
  await page.locator(`${SCREEN} [data-people-station-only]`).click();
  const dialog = page.locator(`${VIEW} sw-dialog[data-station-people]`);
  await expect(dialog).toHaveAttribute('open', ''); // the host itself has no box (its backdrop is fixed): check what it shows
  await expect(dialog.locator('.intro')).toBeVisible();
  await expect(dialog).toHaveAttribute('data-station-people-loading', 'false', { timeout: 10_000 });
  return dialog;
}

const row = (page: Page, no: string) => page.locator(`${VIEW} [data-station-user="${no}"]`);
const action = (page: Page) => page.locator(`${VIEW} sw-dialog[data-station-action]`);

async function plainCopy(where: Locator): Promise<void> {
  const text = await where.evaluate((root) => {
    const out: string[] = [];
    const walk = (n: Node) => {
      if (n.nodeType === Node.TEXT_NODE) out.push(n.textContent ?? '');
      if (n instanceof Element) {
        if (n.tagName === 'STYLE' || n.tagName === 'SCRIPT') return;
        for (const a of ['aria-label', 'title', 'placeholder', 'heading', 'subheading', 'label']) if (n.hasAttribute(a)) out.push(n.getAttribute(a)!);
        if (n.shadowRoot) n.shadowRoot.childNodes.forEach(walk);
      }
      n.childNodes.forEach(walk);
    };
    walk(root);
    return out.join(' ');
  });
  expect(text.length).toBeGreaterThan(10);
  expect(text).not.toMatch(/WisKey|Home Assistant|Ingress|\bHA\b|CR-\d|access\.[a-z]|review_token/);
}

test('the view lists station-only users across stations, says why a station was not read, and hides ignored ones', async ({ page }, info) => {
  desktopOnly(info);
  const m = newStationPeople();
  await open(page, m);
  const dialog = await openView(page);
  await expect(page.locator(`${VIEW} [data-station-user]`)).toHaveCount(5); // 2001 (two stations), 2002, 2003, 1002, 2004; 2005 ignored
  await expect(row(page, '2001').locator('[data-station-chip]')).toHaveCount(2);
  await expect(row(page, '2001').locator('[data-cred="pin"]')).toBeVisible();
  await expect(row(page, '2001').locator('[data-cred="cards"]')).toContainText('2');
  await expect(row(page, '2002').locator('[data-station-user-block="unsupported_credentials"]')).toBeVisible();
  await expect(row(page, '2002').locator('[data-station-user-act="adopt"]')).toHaveCount(0);
  await expect(page.locator(`${VIEW} [data-station-people-station="park"]`)).toHaveAttribute('data-station-state', 'error');
  await expect(page.locator(`${VIEW} [data-station-people-station="lab"]`)).toHaveAttribute('data-station-state', 'numbers_hidden');
  expect(m.reads.sort()).toEqual(['gate', 'lobby', 'park'].sort()); // the hidden-number station is never read
  await page.locator(`${VIEW} [data-station-people-show-ignored]`).check();
  await expect(row(page, '2005')).toHaveAttribute('data-station-user-ignored', 'true');
  await page.locator(`${VIEW} [data-station-people-search]`).fill('2003');
  await expect(page.locator(`${VIEW} [data-station-user]`)).toHaveCount(1);
  await plainCopy(dialog);
  await shot(page, info, 'station-people-desktop');
});

test('adopt links to the existing person with the same number and opens them', async ({ page }, info) => {
  desktopOnly(info);
  const m = newStationPeople();
  await open(page, m);
  await openView(page);
  await row(page, '1002').locator('[data-station-user-act="adopt"]').click();
  await expect(action(page)).toHaveAttribute('data-station-action', 'adopt');
  await expect(page.locator(`${VIEW} [data-station-check="link"]`)).toContainText('יוסי לוי');
  await page.locator(`${VIEW} [data-station-action-confirm]`).click();
  await expect(action(page)).toHaveAttribute('data-station-action-step', 'done');
  await expect(page.locator(`${VIEW} [data-station-result]`)).toHaveAttribute('data-station-result', 'ok');
  const sent = m.sent.find((s) => s.path.endsWith('/adopt'))!.body;
  expect(sent).toMatchObject({ employee_no: '1002', station_ids: ['gate'], confirmed: true, allow_possible_duplicate: false });
  expect(typeof sent.client_request_id).toBe('string');
  await shot(page, info, 'station-people-adopt-done');
  await page.locator(`${VIEW} [data-station-action-open-person]`).click();
  await expect(page.locator('wiskey-person-drawer sw-drawer[open]')).toBeVisible();
});

test('a possible duplicate blocks adopt until the operator says it is another person', async ({ page }, info) => {
  desktopOnly(info);
  const m = newStationPeople();
  await open(page, m);
  await openView(page);
  await row(page, '2004').locator('[data-station-user-act="adopt"]').click();
  await expect(page.locator(`${VIEW} [data-station-check="maybe"]`)).toBeVisible();
  await expect(page.locator(`${VIEW} [data-station-check-match="p1"]`)).toContainText('דנה כהן');
  const confirm = page.locator(`${VIEW} [data-station-action-confirm]`);
  await expect(confirm).toHaveJSProperty('disabled', true);
  await page.locator(`${VIEW} [data-station-check-accept]`).check();
  await expect(confirm).toHaveJSProperty('disabled', false);
  await confirm.click();
  await expect(page.locator(`${VIEW} [data-station-result]`)).toHaveAttribute('data-station-result', 'ok');
  expect(m.sent.find((s) => s.path.endsWith('/adopt'))!.body.allow_possible_duplicate).toBe(true);
});

test('a partial failure shows one honest result per station', async ({ page }, info) => {
  desktopOnly(info);
  const m = newStationPeople();
  m.failAt.lobby = { outcome: 'refused', code: 'review_stale', message: 'המשתמש השתנה בעמדה מאז שנקרא. רעננו את הרשימה ונסו שוב.' };
  await open(page, m);
  await openView(page);
  await row(page, '2001').locator('[data-station-user-act="adopt"]').click();
  await page.locator(`${VIEW} [data-station-action-confirm]`).click();
  await expect(page.locator(`${VIEW} [data-station-result]`)).toHaveAttribute('data-station-result', 'partial');
  await expect(page.locator(`${VIEW} [data-station-result-row="gate"]`)).toHaveAttribute('data-outcome', 'ok');
  await expect(page.locator(`${VIEW} [data-station-result-row="lobby"]`)).toHaveAttribute('data-outcome', 'refused');
  await expect(page.locator(`${VIEW} [data-station-result-row="lobby"]`)).toContainText('רעננו');
  await shot(page, info, 'station-people-partial');
});

test('ignore hides the row (reversible) and delete needs the typed number', async ({ page }, info) => {
  desktopOnly(info);
  const m = newStationPeople();
  await open(page, m);
  await openView(page);
  await row(page, '2003').locator('[data-station-user-act="ignore"]').click();
  await page.locator(`${VIEW} [data-station-action-confirm]`).click();
  await expect(page.locator(`${VIEW} [data-station-result]`)).toHaveAttribute('data-station-result', 'ok');
  await page.locator(`${VIEW} [data-station-action-close]`).click();
  await expect(row(page, '2003')).toHaveCount(0);
  await page.locator(`${VIEW} [data-station-people-show-ignored]`).check();
  await row(page, '2003').locator('[data-station-user-act="unignore"]').click();
  await page.locator(`${VIEW} [data-station-action-confirm]`).click();
  await page.locator(`${VIEW} [data-station-action-close]`).click();
  await expect(row(page, '2003')).toHaveAttribute('data-station-user-ignored', 'false');
  expect(m.sent.filter((s) => s.path.endsWith('/ignore')).map((s) => s.body.ignored)).toEqual([true, false]);

  await row(page, '2003').locator('[data-station-user-act="delete"]').click();
  const confirm = page.locator(`${VIEW} [data-station-action-confirm]`);
  await expect(confirm).toHaveJSProperty('disabled', true);
  await page.locator(`${VIEW} [data-station-action-typed]`).fill('2001');
  await expect(confirm).toHaveJSProperty('disabled', true);
  await page.locator(`${VIEW} [data-station-action-typed]`).fill('2003');
  await expect(confirm).toHaveJSProperty('disabled', false);
  await shot(page, info, 'station-people-delete-ask');
  await confirm.click();
  await expect(page.locator(`${VIEW} [data-station-result]`)).toHaveAttribute('data-station-result', 'ok');
  await expect(page.locator(`${VIEW} [data-station-result]`)).toContainText('בסנכרון');
  expect(m.sent.find((s) => s.path.endsWith('/delete'))!.body).toMatchObject({ employee_no: '2003', typed: '2003', confirmed: true });
});

test('the people screen warns about people who may be listed twice, with a link to each', async ({ page }, info) => {
  desktopOnly(info);
  await open(page, newStationPeople());
  const strip = page.locator(`${SCREEN} [data-people-duplicates]`);
  await expect(strip).toHaveAttribute('data-people-duplicates', '2');
  await strip.locator('[data-people-duplicates-toggle]').click();
  await expect(strip.locator('[data-people-duplicate-group]')).toHaveCount(2);
  await shot(page, info, 'people-duplicates');
  await strip.locator('[data-people-duplicate-person="p5"]').click();
  await expect(page.locator('wiskey-person-drawer sw-drawer[open]')).toBeVisible();
  await plainCopy(strip);
});

test('the editor says when a typed PIN is already in use', async ({ page }, info) => {
  desktopOnly(info);
  const m = newStationPeople();
  await open(page, m);
  await page.locator(`${SCREEN} [data-wiskey-people-add]`).click();
  const pin = page.locator('wiskey-person-editor [data-wiskey-editor-pin]');
  await expect(pin).toBeVisible();
  await pin.fill('4321');
  await pin.blur();
  await expect(page.locator('wiskey-person-editor [data-wiskey-editor-pin-check="taken"]')).toBeVisible();
  await pin.fill('8642');
  await expect(page.locator('wiskey-person-editor [data-wiskey-editor-pin-check]')).toHaveCount(0); // typing clears the old answer
  await pin.blur();
  await expect(page.locator('wiskey-person-editor [data-wiskey-editor-pin-check="free"]')).toBeVisible();
  expect(m.sent.filter((s) => s.path.endsWith('pin-check'))).toHaveLength(2);
});

test('layout: the view fits the screen with no sideways scroll, actions reachable', async ({ page }, info) => {
  layoutOnly(info);
  await open(page, newStationPeople());
  const dialog = await openView(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const box = await row(page, '2001').boundingBox();
  const vw = page.viewportSize()!.width;
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(vw + 1);
  const adopt = await row(page, '2001').locator('[data-station-user-act="adopt"]').boundingBox();
  expect(adopt!.x + adopt!.width).toBeLessThanOrEqual(vw + 1);
  await expect(dialog.locator('[data-station-people-close]')).toBeVisible();
  await shot(page, info, `station-people-${info.project.name}`);
  await row(page, '2003').locator('[data-station-user-act="delete"]').click();
  await expect(action(page)).toHaveAttribute('data-station-action', 'delete');
  const ask = await action(page).locator('[data-station-action-typed]').boundingBox();
  expect(ask!.x + ask!.width).toBeLessThanOrEqual(vw + 1);
  await shot(page, info, `station-people-delete-${info.project.name}`);
});
