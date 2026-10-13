import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installTicketsMock, url, type TicketsMock, type TicketsMockOptions } from './tickets-mocks';

// CR-038 slice 1 evidence: the tickets screens from the REAL build against the mock layer (fake data), desktop 1440 and phone 390, light and
// dark, the classic and domus skins (the five-skin sweep is layout-tickets.spec.ts). Also asserts behaviour: the area follows the module
// switch, every name is the configured one (D33), a card opens the drawer (D18) and the create form (D22), the moves post to the API.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-tickets.spec.ts --project=desktop --project=mobile --workers=1
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/tickets-s1');
const L = 'sw-app tickets-list';
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
  await page.waitForTimeout(350);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${name}: horizontal overflow`).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}-${scheme}-${skin}.png`) });
}

test.describe('tickets evidence', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'desktop 1440 and phone 390');
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('list: cards, filters, chips - light / dark x classic / domus', async ({ page }) => {
    for (const skin of ['classic', 'domus'])
      for (const scheme of ['light', 'dark'] as const) {
        await go(page, '/tickets/mine', {}, scheme, skin);
        await page.waitForSelector(`${L} ticket-card`);
        await expect(page.locator(`${L} [data-tickets-title]`)).toHaveText('קריאות');
        await shot(page, 'list', scheme, skin);
      }
    const cards = page.locator(`${L} ticket-card`);
    await expect(cards).toHaveCount(7); // the open ones: closed tickets are behind the "סגורות" filter
    await page.locator(`${L} [data-status-filter="closed"]`).click();
    await expect(cards).toHaveCount(1);
    await expect(page).toHaveURL(/status=closed/);
  });

  test('drawer: the ticket over the list (D18 drawer + full screen), strip, handler, timeline', async ({ page }) => {
    for (const skin of ['classic', 'domus'])
      for (const scheme of ['light', 'dark'] as const) {
        await go(page, '/tickets/mine?t=0000000000000a01', {}, scheme, skin);
        await page.waitForSelector(`${L} ticket-detail [data-ticket-detail="0000000000000a01"]`);
        await shot(page, 'drawer', scheme, skin);
      }
    const d = page.locator(`${L} ticket-detail`);
    await expect(d.locator('[data-strip] button[aria-pressed="true"]')).toHaveText('ממתין לחלק');
    await expect(d.locator('[data-strip] [data-move="in_progress"]')).toBeEnabled();
    await expect(d.locator('[data-strip] [data-move="new"]')).toBeDisabled();
    await expect(d.locator('[data-timeline] li')).toHaveCount(5);
    await expect(d.locator('[data-full-screen]')).toHaveAttribute('href', '#/tickets/0000000000000a01');
  });

  test('a card opens the drawer; a move posts to the API with the revision', async ({ page }) => {
    const mock = await go(page, '/tickets/mine');
    await page.locator(`${L} ticket-card`).first().waitFor();
    await page.locator(`${L} ticket-card`).first().locator('a.name').click();
    await expect(page).toHaveURL(/[?&]t=0000000000000a04/);
    const d = page.locator(`${L} ticket-detail`);
    await d.locator('[data-ticket-detail]').waitFor();
    await page.goto(url('/tickets/mine?t=0000000000000a07'));
    await d.locator('[data-ticket-detail="0000000000000a07"]').waitFor();
    await d.locator('[data-move="in_progress"]').click();
    await expect.poll(() => mock.calls.find((c) => c.method === 'POST' && c.path.endsWith('/status'))?.body).toEqual({ to: 'in_progress', revision: 3 });
    // closing without "done" asks for the reason first (the server requires it)
    await d.locator('[data-move="closed"]').click();
    await expect(d.locator('sw-dialog[data-dialog="move"] [data-dialog-text]')).toBeVisible(); // (the dialog's host is display: contents)
    await d.locator('sw-dialog[data-dialog="move"] [data-dialog-ok]').click();
    await expect(d.locator('[data-dialog-error]')).toBeVisible();
    await shot(page, 'dialog-close');
    await d.locator('sw-dialog[data-dialog="move"] [data-dialog-text]').fill('כפילות של קריאה אחרת');
    await d.locator('sw-dialog[data-dialog="move"] [data-dialog-ok]').click();
    await expect.poll(() => mock.calls.filter((c) => c.method === 'POST' && c.path.endsWith('/status')).at(-1)?.body).toMatchObject({ to: 'closed', note: 'כפילות של קריאה אחרת' });
  });

  test('full screen (D18): #/tickets/<id>', async ({ page }) => {
    for (const skin of ['classic', 'domus'])
      for (const scheme of ['light', 'dark'] as const) {
        await go(page, '/tickets/0000000000000a01', {}, scheme, skin);
        await page.waitForSelector('sw-app tickets-detail ticket-detail [data-ticket-page]');
        await shot(page, 'full', scheme, skin);
      }
    await expect(page.locator('sw-app tickets-detail ticket-detail [data-ticket-title]')).toHaveText('מזגן לא מקרר - חדר 102');
    await expect(page.locator('sw-app tickets-detail ticket-detail [data-to-drawer]')).toHaveAttribute('href', /t=0000000000000a01/);
  });

  test('create: the side sheet (D22 default) and the centred dialog; the request carries a client request id', async ({ page }) => {
    for (const skin of ['classic', 'domus'])
      for (const scheme of ['light', 'dark'] as const) {
        await go(page, '/tickets/mine?new=1', {}, scheme, skin);
        await page.waitForSelector(`${L} ticket-create [data-create-form]`);
        await shot(page, 'create-sheet', scheme, skin);
      }
    const c = page.locator(`${L} ticket-create`);
    await c.locator('[data-create-submit]').click();
    await expect(c.locator('[data-create-title][aria-invalid="true"]')).toBeVisible();
    await c.locator('[data-create-title]').fill('נורה שרופה במסדרון');
    await c.locator('[data-create-priority="urgent"]').click();
    const mock = await (async () => {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      return installTicketsMock(page);
    })();
    await c.locator('[data-create-submit]').click();
    await expect.poll(() => mock.calls.find((x) => x.method === 'POST' && x.path === 'tickets')?.body).toMatchObject({ title: 'נורה שרופה במסדרון', priority_id: 'dept-maintenance-urgent', client_request_id: expect.stringMatching(/^t[0-9a-z]{8,}/) });
    await expect(page).toHaveURL(/[?&]t=/);
    await go(page, '/tickets/mine?new=1', { ui: { new_ticket: 'dialog' } });
    await page.waitForSelector(`${L} ticket-create sw-dialog[data-create="dialog"] [data-create-form]`);
    await shot(page, 'create-dialog');
  });

  test('states: empty, module off (no area in the navigation), no permission', async ({ page }) => {
    await go(page, '/tickets/mine', { empty: true });
    await page.waitForSelector(`${L} [data-tickets-state="empty"]`);
    await shot(page, 'empty');
    await go(page, '/tickets/mine', { enabled: false, persona: 'admin' });
    await page.waitForSelector(`${L} [data-tickets-state="off"]`);
    await expect(page.locator(`${L} [data-open-settings]`)).toBeVisible();
    await shot(page, 'off');
    await expect(page.locator('sw-app [data-nav="tickets"]'), 'the area is not offered while the module is off').toHaveCount(0);
    await expect(page.locator('sw-app [data-nav="security"]').first()).toBeAttached(); // (the navigation itself is there)
  });

  test('D33: a renamed module - the title, the rail, the card chips and the settings tab carry the new name', async ({ page }) => {
    await go(page, '/tickets/mine', { name: { one: 'תקלה', many: 'תקלות', gender: 'f' } });
    await page.waitForSelector(`${L} ticket-card`);
    await expect(page.locator(`${L} [data-tickets-title]`)).toHaveText('תקלות');
    await expect(page.locator('sw-app [data-nav="tickets"]').first()).toHaveAttribute('aria-label', 'תקלות');
    const texts = await page.evaluate(() => {
      const out: string[] = [];
      const walk = (root: ParentNode) => {
        for (const el of Array.from(root.querySelectorAll('*'))) {
          if (el.shadowRoot) walk(el.shadowRoot);
          for (const n of Array.from(el.childNodes)) if (n.nodeType === 3 && n.textContent?.trim()) out.push(n.textContent.trim());
        }
      };
      walk(document);
      return out.join(' | ');
    });
    expect(texts).toContain('תקלות');
    expect(texts, 'the default name appears nowhere once renamed').not.toMatch(/קריא(ה|ות)/);
    await shot(page, 'renamed');
    await page.locator(`${L} [data-new]`).click();
    await expect(page.locator(`${L} ticket-create`).locator('[data-create-submit]')).toContainText('פתיחת תקלה');
  });

  test('settings: the switch, the name editor (D33, live preview), display (D18 / D22), departments, permissions', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await go(page, '/system/tickets', { persona: 'admin' }, scheme);
      await page.waitForSelector('sw-app system-tickets [data-name-editor]');
      await shot(page, 'settings-general', scheme);
    }
    const s = page.locator('sw-app system-tickets');
    await s.locator('[data-name-one="he"]').fill('תקלה');
    await s.locator('[data-name-many="he"]').fill('תקלות');
    await expect(s.locator('[data-name-preview]')).toContainText('תקלה חדשה');
    await s.locator('[data-name-many="he"]').fill('<b>');
    await expect(s.locator('[data-name-many="he"][aria-invalid="true"]')).toBeVisible();
    await s.locator('[data-name-many="he"]').fill('תקלות');
    await s.locator('sw-button[data-name-save]').click();
    await expect(page.locator('sw-app system-tickets').locator('[data-tickets-settings-ok]')).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.querySelector('sw-app')?.shadowRoot?.textContent ?? '')).toContain('תקלות');
    await go(page, '/system/tickets?tab=departments', { persona: 'admin' });
    await page.waitForSelector('sw-app system-tickets [data-dept="dept-maintenance"]');
    await shot(page, 'settings-departments');
    await go(page, '/system/tickets?tab=permissions', { persona: 'admin' });
    await page.waitForSelector('sw-app system-tickets [data-holder]');
    await page.locator('sw-app system-tickets [data-grant-user]').selectOption('u-yossi');
    await shot(page, 'settings-permissions');
    await go(page, '/system/tickets', { persona: 'admin', enabled: false });
    await page.waitForSelector('sw-app system-tickets [data-tickets-enabled]');
    await expect(page.locator('sw-app system-tickets [data-name-editor]')).toHaveCount(0);
    await shot(page, 'settings-off');
  });

  test('phone: the bottom navigation offers the area; the drawer is a bottom sheet', async ({ page }) => {
    test.skip(!isPhone(page), 'phone only');
    await go(page, '/tickets/mine?t=0000000000000a04');
    await page.waitForSelector(`${L} ticket-detail [data-ticket-detail]`);
    await shot(page, 'drawer-returned');
    // a user who is offered every area: the tickets area is the last of the dock, which still fits the phone's width
    await go(page, '/tickets/mine', { persona: 'admin', extraPerms: ['media.read', 'access.read', 'energy.view', 'generator.view', 'video.live', 'events.read'] });
    await page.waitForSelector(`${L} ticket-card`);
    await shot(page, 'dock-every-area');
  });
});
