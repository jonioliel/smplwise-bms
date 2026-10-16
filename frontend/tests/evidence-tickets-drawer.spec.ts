import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installTicketsMock, url, SKINS, type TicketsMock, type TicketsMockOptions } from './tickets-mocks';

// TKUI1 (2.6.0) evidence: the v5 request drawer from the REAL build against the mock layer (fake data) - the status block, the one sentence,
// the role-resolved primary, the four tabs, the three sizes and the phone sheets, the full page, the settings rows, the default tab and the
// deep link `?tab=`; desktop 1440 and phone 390, light and dark, the five skins (overview). Screenshots: docs/design/evidence/tickets-ui1/.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-tickets-drawer.spec.ts --project=desktop --project=mobile --workers=1
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/tickets-ui1');
const L = 'sw-app tickets-list ticket-detail';
const isPhone = (p: Page) => (p.viewportSize()?.width ?? 1440) < 768;

async function go(page: Page, hash: string, o: TicketsMockOptions = {}, scheme: 'light' | 'dark' = 'light', skin = 'classic'): Promise<TicketsMock> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  const mock = await installTicketsMock(page, o);
  await page.goto('about:blank');
  await page.goto(url(hash, skin, scheme));
  return mock;
}

async function shot(page: Page, name: string, scheme: 'light' | 'dark' = 'light', skin = 'classic'): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${name}: horizontal overflow`).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}-${scheme}-${skin}.png`) });
}

const d = (page: Page) => page.locator(L);

test.describe('TKUI1 drawer evidence', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'desktop 1440 and phone 390 (the tablet runs the layout guard)');
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('overview: the status block, the sentence, one primary - five skins, light and dark', async ({ page }) => {
    for (const skin of SKINS)
      for (const scheme of ['light', 'dark'] as const) {
        await go(page, '/tickets/all?t=0000000000000a01', {}, scheme, skin);
        await d(page).locator('[data-tab-panel="overview"]').waitFor();
        if (skin === 'classic' || skin === 'domus' || scheme === 'light') await shot(page, 'overview', scheme, skin);
      }
    const b = d(page).locator('[data-status-block]');
    await expect(b.locator('[data-status-chip]')).toContainText('בטיפול');
    await expect(b.locator('[data-waiting-sub]')).toHaveText('ממתין לחלק');
    await expect(b.locator('[data-sentence]')).toHaveText(/^אבי כהן ממתין\/ה לחלק · צפי /);
    await expect(b.locator('[data-flow] li')).toHaveCount(6);
    await expect(b.locator('[data-flow] li[aria-current="step"]')).toHaveText('בטיפול');
    await expect(b.locator('[data-primary]')).toHaveText('עדכון לאבי'); // the ball is with the handler: the softest push, quiet
    await expect(b.locator('[data-primary]')).toHaveClass(/quiet/);
    await expect(d(page).locator('[data-ov="people"] [data-person="handler"]')).toContainText('אבי כהן');
    await expect(d(page).locator('[data-now="last"]')).toContainText('הקבל של המדחס שרוף');
    await expect(d(page).locator('[data-fact="description"]')).toBeVisible();
    // the old six clickable steps are gone: the flow is read-only
    await expect(d(page).locator('[data-strip], [data-move]')).toHaveCount(0);
  });

  test('the sizes 520 / 640 / full (remembered per browser) and the other tabs', async ({ page }) => {
    test.skip(isPhone(page), 'desktop');
    await go(page, '/tickets/all?t=0000000000000a01');
    for (const size of ['drawer', 'wide', 'full'] as const) {
      await d(page).locator(`[data-size-btn="${size}"]`).click();
      await expect(d(page).locator(`[data-size-btn="${size}"]`)).toHaveAttribute('aria-pressed', 'true');
      await shot(page, `size-${size}`);
    }
    await page.reload();
    await d(page).locator('[data-status-block]').waitFor();
    await expect(d(page).locator('[data-size-btn="full"]'), 'the viewer\'s own size is remembered').toHaveAttribute('aria-pressed', 'true');
    await d(page).locator('[data-size-btn="wide"]').click();
    for (const tab of ['conv', 'costs', 'history'] as const) {
      await d(page).locator(`[role="tab"][data-tab="${tab}"]`).click();
      await expect(d(page).locator(`[data-tab-content="${tab}"]`)).toBeVisible();
      await shot(page, `tab-${tab}`);
    }
    await expect(d(page).locator('[data-tab-content="history"] [data-timeline] li')).toHaveCount(5);
    for (const scheme of ['dark'] as const) {
      await go(page, '/tickets/all?t=0000000000000a01&tab=conv', {}, scheme, 'domus');
      await expect(d(page).locator('[data-tab-content="conv"]')).toBeVisible();
      await shot(page, 'tab-conv', scheme, 'domus');
    }
  });

  test('every state: the sentence and the role-resolved primary (manager), the handler\'s "קיבלתי"', async ({ page }) => {
    const cases: [string, RegExp, string | null][] = [
      ['0000000000000a02', /^ממתין לשיוך מטפל · נפתחה /, 'שיוך מטפל'],
      ['0000000000000a03', /^נמסר ליוסי מזרחי · ממתין לאישור קבלה$/, 'עדכון ליוסי'],
      ['0000000000000a04', /^יוסי מזרחי החזיר\/ה: לא באחריות האחזקה/, 'שיוך מחדש'],
      ['0000000000000a05', /^אבי כהן סימן\/ה "בוצע" .* · ממתין לאישורך ולסגירה$/, 'אישור וסגירה'],
      ['0000000000000a07', /^רונית לוי אישר\/ה קבלה · צפי: לא נמסר$/, 'עדכון לרונית'],
      ['0000000000000a08', /^נסגרה .* על ידי רונית לוי · הוחלף גוף התאורה\.$/, 'פתיחה מחדש'],
    ];
    for (const [id, sentence, primary] of cases) {
      await go(page, `/tickets/all?status=all&t=${id}`);
      const b = d(page).locator('[data-status-block]');
      await expect(b.locator('[data-sentence]'), id).toHaveText(sentence);
      if (primary) await expect(b.locator('[data-primary]'), id).toHaveText(primary);
      if (id === '0000000000000a05') await shot(page, 'state-done');
      if (id === '0000000000000a02') await shot(page, 'state-new');
    }
    // the done primary closes through the dialog (the server asks for a summary when it requires one)
    const mock = await go(page, '/tickets/all?t=0000000000000a05');
    await d(page).locator('[data-primary]').click();
    await expect(d(page).locator('sw-dialog[data-dialog="move"][data-to="closed"]')).toHaveCount(1);
    await d(page).locator('sw-dialog[data-dialog="move"] [data-dialog-ok]').click();
    await expect.poll(() => mock.calls.find((c) => c.method === 'POST' && c.path.endsWith('/status'))?.body).toMatchObject({ to: 'closed' });
    // a handler (operator persona, assigned to the ticket): "קיבלתי" moves the flow, the part toggle is the quiet action
    const h = await go(page, '/tickets/all?t=0000000000000a03', { persona: 'operator' });
    await expect(d(page).locator('[data-status-block]')).toHaveAttribute('data-role', 'handler');
    await expect(d(page).locator('[data-primary]')).toHaveText('קיבלתי');
    await expect(d(page).locator('[data-sentence]')).toHaveText('נמסר לך · ממתין לאישור הקבלה שלך');
    await shot(page, 'handler-assigned');
    await d(page).locator('[data-primary]').click();
    await expect.poll(() => h.calls.find((c) => c.method === 'POST' && c.path.endsWith('/status'))?.body).toEqual({ to: 'acknowledged', revision: 3 });
  });

  test('the "⋯" menu holds every other action; the 2.5.8 assign picker opens from it', async ({ page }) => {
    const mock = await go(page, '/tickets/all?t=0000000000000a01');
    await d(page).locator('[data-more]').click();
    const menu = d(page).locator('[data-drawer-menu]');
    await expect(menu.locator('[data-waiting-toggle="back"]')).toHaveText('חזרה לטיפול');
    await expect(menu.locator('[data-move="done"]')).toBeVisible();
    await expect(menu.locator('[data-full-screen]')).toHaveAttribute('href', '#/tickets/0000000000000a01');
    await shot(page, 'menu');
    await menu.locator('[data-waiting-toggle="back"]').click();
    await expect.poll(() => mock.calls.find((c) => c.method === 'POST' && c.path.endsWith('/status'))?.body).toEqual({ to: 'in_progress', revision: 3 });
    await go(page, '/tickets/all?t=0000000000000a01');
    await d(page).locator('[data-more]').click();
    await d(page).locator('[data-drawer-menu] [data-assign]').click();
    await expect(d(page).locator('sw-dialog[data-dialog="assign"]')).toHaveCount(1);
  });

  test('the default tab setting and the deep link ?tab= (the link wins)', async ({ page }) => {
    await go(page, '/tickets/all?t=0000000000000a01', { ui: { detail_tab: 'history' } });
    await expect(d(page).locator('[role="tab"][aria-selected="true"]')).toHaveAttribute('data-tab', 'history');
    await go(page, '/tickets/all?t=0000000000000a01&tab=costs', { ui: { detail_tab: 'history' } });
    await expect(d(page).locator('[role="tab"][aria-selected="true"]')).toHaveAttribute('data-tab', 'costs');
    await go(page, '/tickets/all?t=0000000000000a01&view=timeline');
    await expect(d(page).locator('[role="tab"][aria-selected="true"]')).toHaveAttribute('data-tab', 'history');
    await go(page, '/tickets/0000000000000a01?tab=conv');
    await expect(page.locator('sw-app tickets-detail ticket-detail [role="tab"][aria-selected="true"]')).toHaveAttribute('data-tab', 'conv');
  });

  test('phone: the full sheet and the half sheet (setting), "הצג הכול"', async ({ page }) => {
    test.skip(!isPhone(page), 'phone');
    for (const scheme of ['light', 'dark'] as const) {
      await go(page, '/tickets/all?t=0000000000000a01', {}, scheme, 'domus');
      await d(page).locator('[data-tab-panel="overview"]').waitFor();
      await shot(page, 'phone-full', scheme, 'domus');
    }
    await go(page, '/tickets/all?t=0000000000000a01', { ui: { phone_sheet: 'half' } });
    await expect(d(page).locator('[data-half-sheet]')).toBeVisible();
    await expect(d(page).locator('[data-half-sheet] [data-now]')).not.toHaveCount(0);
    await shot(page, 'phone-half');
    await d(page).locator('[data-show-all]').click();
    await expect(d(page).locator('[role="tablist"]')).toBeVisible();
  });

  test('the full page: the status block as the hero, the same tabs in one card', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await go(page, '/tickets/0000000000000a01', {}, scheme);
      await page.locator('sw-app tickets-detail ticket-detail [data-ticket-page]').waitFor();
      await shot(page, 'page', scheme);
    }
    const p = page.locator('sw-app tickets-detail ticket-detail');
    await expect(p.locator('[data-ticket-title]')).toHaveText('מזגן לא מקרר - חדר 102');
    await expect(p.locator('.hero [data-status-block]')).toBeVisible();
    await expect(p.locator('[data-to-drawer]')).toHaveAttribute('href', /t=0000000000000a01/);
  });

  test('settings › display: the default tab, the drawer size, the phone sheet', async ({ page }) => {
    const mock = await go(page, '/system/tickets', { persona: 'admin' });
    const s = page.locator('sw-app system-tickets');
    await s.locator('[data-setting="detail_tab"]').waitFor();
    await s.locator('[data-setting="detail_tab"]').scrollIntoViewIfNeeded();
    await shot(page, 'settings-drawer');
    await s.locator('[data-ui-drawer="tab:costs"]').click();
    await expect.poll(() => mock.calls.filter((c) => c.method === 'PUT' && c.path === 'tickets/settings').at(-1)?.body).toMatchObject({ ui: { detail_tab: 'costs' } });
    await s.locator('[data-ui-drawer="sheet:half"]').click();
    await expect.poll(() => mock.calls.filter((c) => c.method === 'PUT' && c.path === 'tickets/settings').at(-1)?.body).toMatchObject({ ui: { phone_sheet: 'half' } });
  });
});
