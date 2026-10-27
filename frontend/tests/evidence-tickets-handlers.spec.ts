import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installTicketsMock, url } from './tickets-mocks';
import { installS4Mock, serveBuiltApp, type S4Mock, type S4MockOptions } from './tickets-s4-mocks';
import { drawnSkin } from './helpers/frozen-skins';

// CR-038 owner request 2026-10-14 evidence: "מטפלים וספקים" (#/tickets/handlers), the fifth entry of the area - handlers with an account
// (department members: add / role / alert / remove), employees WITHOUT an account (a directory kind of their own), vendors and contacts;
// the readiness strip (only when something is missing); the Settings link card and the old `?tab=contacts` address; and the assign
// dialog that ALWAYS shows its three groups, each one that cannot be used saying why with the link to its setting - the owner's state
// after installing 2.5.0 (nobody to assign, nothing set up) first. The REAL build against the mock layer (fake data). Desktop 1440 and
// phone 390, light / dark, classic / domus (bubble once). Also asserts what the screens send.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-tickets-handlers.spec.ts --project=desktop --project=mobile --workers=1
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/tickets-handlers');
const H = 'sw-app tickets-handlers';
const L = 'sw-app tickets-list';
const D = `${L} ticket-detail`;
const NAME = { one: 'בקשת שירות', many: 'בקשות שירות', gender: 'f' };
const FRESH = '0000000000000a02';

async function go(page: Page, hash: string, o: S4MockOptions = {}, scheme: 'light' | 'dark' = 'light', skin = 'classic'): Promise<S4Mock> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  const base = test.info().project.use.baseURL;
  if (process.env.SW_DIST_ROUTE === '1' && base) await serveBuiltApp(page, new URL(base).origin);
  await installTicketsMock(page, { persona: o.persona ?? 'admin', name: NAME });
  const mock = await installS4Mock(page, o);
  await page.goto('about:blank');
  await page.goto(url(hash, skin, scheme));
  return mock;
}

async function shot(page: Page, name: string, scheme: 'light' | 'dark' = 'light', skin = 'classic', full = true): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${name}: horizontal overflow`).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}-${scheme}-${skin}.png`), fullPage: full });
}

const last = (mock: S4Mock, method: string, re: RegExp) => [...mock.calls].reverse().find((c) => c.method === method && re.test(c.path));

async function openAssign(page: Page): Promise<void> {
  await page.waitForSelector(`${D} [data-ticket-detail="${FRESH}"]`);
  await page.locator(`${D} [data-assign]`).click();
  await page.waitForSelector(`${D} [data-assign-kinds]`);
}

test.describe('handlers and vendors page + the assign dialog readiness (owner 2026-10-14)', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));
  test.beforeEach(async ({ page }, info) => {
    test.setTimeout(240_000);
    test.skip(info.project.name === 'tablet', 'desktop 1440 and phone 390');
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('the page: three segments - handlers (members + employees), vendors, contacts; light / dark x classic / domus', async ({ page }) => {
    for (const skin of ['classic', 'domus'])
      for (const scheme of ['light', 'dark'] as const) {
        await go(page, '/tickets/handlers', {}, scheme, skin);
        await page.waitForSelector(`${H} tickets-handlers-members [data-member="user:u-ronit"]`);
        await page.waitForSelector(`${H} tickets-contacts[kind="employee"] [data-contacts-list]`);
        await expect(page.locator(`${H} [data-readiness]`)).toHaveCount(0); // everything ready: no strip (clean screens)
        await shot(page, 'handlers', scheme, skin);
        await page.locator(`${H} [data-handlers-tabs] [data-seg="vendors"]`).click();
        await page.waitForSelector(`${H} tickets-contacts[kind="vendor"] [data-contacts-list]`);
        await expect(page).toHaveURL(/#\/tickets\/handlers\?seg=vendors/);
        await shot(page, 'vendors', scheme, skin);
      }
    await go(page, '/tickets/handlers?seg=contacts', {}, 'light', drawnSkin('bubble')); // BUBBLE-FREEZE-295: domus while frozen
    await page.waitForSelector(`${H} tickets-contacts[kind="person"] [data-contacts-list]`);
    // the contacts segment lists persons only (the vendor and the employee are in their own segments)
    await expect(page.locator(`${H} tickets-contacts [data-contact-item="c000000000000v01"]`)).toHaveCount(0);
    await expect(page.locator(`${H} tickets-contacts [data-contact-item="c000000000000e01"]`)).toHaveCount(0);
    await expect(page.locator(`${H} tickets-contacts [data-contact-item="c000000000000p01"]`)).toBeVisible();
    await shot(page, 'contacts', 'light', drawnSkin('bubble'));
  });

  test('handlers with an account: add a user to a department as a handler, make a manager, remove', async ({ page }) => {
    const M = `${H} tickets-handlers-members`;
    const mock = await go(page, '/tickets/handlers');
    await page.waitForSelector(`${M} [data-member="user:u-ronit"]`);
    await page.locator(`${H} [data-handlers-new]`).click(); // the page's "+ מטפל" opens the add panel
    await page.locator(`${M} [data-member-pick]`).selectOption('user:u-yossi');
    await page.locator(`${M} [data-member-add]`).click();
    await expect.poll(() => last(mock, 'PUT', /members\/user\/u-yossi$/)?.body).toEqual({ role: 'member' });
    await expect(page.locator(`${M} [data-member="user:u-yossi"]`)).toBeVisible();
    await expect(page.locator(`${M} [data-members-add]`)).toHaveCount(0); // the panel closes after the add
    await page.locator(`${M} [data-member="user:u-yossi"] [data-member-toggle]`).click(); // "ניהול" opens the card's own panel
    await page.locator(`${M} [data-member="user:u-yossi"] [data-member-role="manager"]`).click();
    await expect.poll(() => last(mock, 'PUT', /members\/user\/u-yossi$/)?.body).toEqual({ role: 'manager' });
    await page.locator(`${M} [data-member="user:u-yossi"] [data-member-remove]`).click();
    await expect.poll(() => last(mock, 'DELETE', /members\/user\/u-yossi$/)).toBeTruthy();
    await expect(page.locator(`${M} [data-member="user:u-yossi"]`)).toHaveCount(0);
    // another department
    await page.locator(`${H} [data-handlers-dept="dept-cleaning"]`).click();
    await expect(page.locator(`${M} [data-member="user:u-dana"]`)).toBeVisible();
    await expect(page.locator(`${M} [data-member="user:u-ronit"]`)).toHaveCount(0);
  });

  test('TKSTAFF1: a handler with an account gets a mobile line - number, language, WhatsApp on assignment', async ({ page }) => {
    const M = `${H} tickets-handlers-members`;
    const mock = await go(page, '/tickets/handlers');
    await page.waitForSelector(`${M} [data-member="user:u-ronit"]`);
    await page.locator(`${H} [data-handlers-new]`).click();
    await page.locator(`${M} [data-member-pick]`).selectOption('user:u-yossi');
    await page.locator(`${M} [data-member-add]`).click();
    await page.locator(`${M} [data-member="user:u-yossi"] [data-member-toggle]`).click();
    const line = `${M} [data-member-mobile="u-yossi"]`;
    await page.waitForSelector(line);
    await expect(page.locator(`${line} [data-member-whatsapp]`)).toHaveCount(0); // no number yet: no switch
    await page.locator(`${line} [data-member-mobile-input]`).fill('050-000-0091');
    await page.locator(`${line} [data-member-mobile-lang]`).selectOption('ar');
    await page.locator(`${line} [data-member-mobile-save]`).click();
    await expect.poll(() => last(mock, 'PUT', /^tickets\/admin\/staff\/u-yossi$/)?.body).toEqual({ phone: '050-000-0091', lang: 'ar' });
    await expect(page.locator(`${line} [data-member-whatsapp]`)).toHaveCount(1);
    await expect(page.locator(`${line} [data-member-mobile-pending]`)).toBeVisible(); // review F3: until the employee confirms
    await expect(page.locator(`${line} [data-member-mobile-input]`)).toHaveValue('050-000-0091');
    await shot(page, 'handlers-mobile', 'light', 'classic', false);
    await page.locator(`${line} [data-member-whatsapp] button[role="switch"]`).click();
    await expect.poll(() => last(mock, 'PUT', /^tickets\/admin\/staff\/u-yossi$/)?.body).toEqual({ notify_whatsapp: false });
  });

  test('an employee without an account: created from the page with only his fields', async ({ page }) => {
    const E = `${H} tickets-contacts[kind="employee"]`;
    const mock = await go(page, '/tickets/handlers');
    await page.waitForSelector(`${E} [data-contacts-list]`);
    await page.locator(`${E} [data-contact-new]`).click();
    await page.waitForSelector(`${E} [data-card="contact-editor"][data-contact-kind="employee"]`);
    for (const hidden of ['company', 'vendor_id', 'require_code', 'labor_rate']) await expect(page.locator(`${E} [data-field="${hidden}"]`)).toHaveCount(0);
    await page.locator(`${E} [data-field="display_name"]`).fill('דני טכנאי');
    await page.locator(`${E} [data-field="phone"]`).fill('050-000-0090');
    await page.locator(`${E} [data-dept="dept-maintenance"]`).click();
    if (test.info().project.name === 'mobile') await shot(page, 'employee-new', 'light', 'classic', true);
    await page.locator(`${E} [data-contact-save]`).click();
    await expect.poll(() => last(mock, 'POST', /^tickets\/contacts$/)?.body).toMatchObject({ kind: 'employee', display_name: 'דני טכנאי', phone: '050-000-0090', departments: ['dept-maintenance'] });
  });

  test('a manager without the settings right: no member card, the employees with masked phones, nothing to edit', async ({ page }) => {
    await go(page, '/tickets/handlers', { persona: 'manager' });
    const E = `${H} tickets-contacts[kind="employee"]`;
    await page.waitForSelector(`${E} [data-contacts-list]`);
    await expect(page.locator(`${H} tickets-handlers-members [data-card="handlers-members"]`)).toHaveCount(0);
    await expect(page.locator(`${E} [data-contact-new]`)).toHaveCount(0);
    await page.locator(`${E} [data-contact-item="c000000000000e01"]`).click();
    await expect(page.locator(`${E} [data-card="contact"]`)).toContainText('•••• 0080');
  });

  test('the readiness strip: only what is missing, each a link to its setting', async ({ page }) => {
    await go(page, '/tickets/handlers', { publicReady: false, readiness: { master_switch: false } });
    await page.waitForSelector(`${H} [data-readiness]`);
    await expect(page.locator(`${H} [data-readiness-item="page_off"]`)).toHaveAttribute('href', '#/system/tickets');
    await expect(page.locator(`${H} [data-readiness-item="address"]`)).toHaveAttribute('href', '#/system/tickets');
    await expect(page.locator(`${H} [data-readiness-item="switch"]`)).toHaveAttribute('href', '#/system/tickets?tab=channel');
    await shot(page, 'readiness-strip', 'light', 'classic', false);
    await go(page, '/tickets/handlers', { readiness: { account_mapped: false } });
    await page.waitForSelector(`${H} [data-readiness-item="account"]`);
    await expect(page.locator(`${H} [data-readiness-item="account"]`)).toHaveAttribute('href', '#/system/messaging-accounts');
    await expect(page.locator(`${H} [data-readiness-item]`)).toHaveCount(1);
  });

  test('Settings: the tab is gone, a link card leads to the page, the old address lands on the vendors', async ({ page }) => {
    await go(page, '/system/tickets');
    await page.waitForSelector('sw-app system-tickets [data-card="handlers-link"]');
    await expect(page.locator('sw-app system-tickets [data-to-handlers]')).toHaveAttribute('href', '#/tickets/handlers');
    await expect(page.locator('sw-app system-tickets [data-tickets-settings-tabs] [role="tab"]', { hasText: 'ספקים ואנשי קשר' })).toHaveCount(0);
    await go(page, '/system/tickets?tab=contacts');
    await expect(page).toHaveURL(/#\/tickets\/handlers\?seg=vendors/);
    await page.waitForSelector(`${H} tickets-contacts[kind="vendor"] [data-contacts-list]`);
  });

  test('departments: a name only; the delete says what it affects (blocked with open requests); a deleted one is restored', async ({ page }) => {
    const S = 'sw-app system-tickets';
    const E = `${S} tickets-dept-editor`;
    const mock = await go(page, '/system/tickets?tab=departments');
    await page.waitForSelector(`${S} [data-dept-item="dept-maintenance"]`);
    await expect(page.locator(`${S} [data-dept-new-key]`)).toHaveCount(0);
    await page.locator(`${S} [data-dept-new-name]`).fill('חניון');
    await expect(page.locator(`${S} [data-dept-add]`)).toBeEnabled();
    await page.locator(`${S} [data-dept-add]`).click();
    await expect.poll(() => last(mock, 'POST', /^tickets\/admin\/departments$/)?.body).toEqual({ name: 'חניון' });
    // maintenance holds open requests: the confirm says so and offers no delete
    await page.locator(`${S} [data-dept-item="dept-maintenance"]`).click();
    await page.locator(`${E} [data-dept-delete]`).click();
    await expect(page.locator(`${E} [data-dept-delete-blocked]`)).toContainText('3');
    await expect(page.locator(`${E} [data-dept-delete-ok]`)).toHaveCount(0);
    await shot(page, 'dept-delete-blocked', 'light', 'classic', false);
    await page.locator(`${E} [data-dept-delete-cancel]`).click();
    // cleaning: the members are counted, it can be restored; deleted -> listed -> restored
    await page.locator(`${S} [data-dept-item="dept-cleaning"]`).click();
    await page.locator(`${E} [data-dept-delete]`).click();
    await expect(page.locator(`${E} [data-dept-delete-confirm]`)).toHaveAttribute('data-members', '1');
    await expect(page.locator(`${E} [data-dept-delete-confirm]`)).toContainText('מחלקות שנמחקו');
    await page.locator(`${E} [data-dept-delete-ok]`).click();
    await expect.poll(() => last(mock, 'DELETE', /^tickets\/admin\/departments\/dept-cleaning$/)).toBeTruthy();
    await page.locator(`${S} [data-dept-deleted] summary`).click();
    await expect(page.locator(`${S} [data-dept-deleted-item="dept-cleaning"]`)).toBeVisible();
    await shot(page, 'dept-deleted-list', 'light', 'classic', false);
    await page.locator(`${S} [data-dept-restore="dept-cleaning"]`).click();
    await expect.poll(() => last(mock, 'POST', /^tickets\/admin\/departments\/dept-cleaning\/restore$/)).toBeTruthy();
    await expect(page.locator(`${S} [data-dept-item="dept-cleaning"]`)).toBeVisible();
    await expect(page.locator(`${S} [data-card="dept-deleted"]`)).toHaveCount(0);
  });

  test('2.5.0 regression: the הרשאות tab renders the real holders shapes (cost permissions, no scope name, no user name); a failed load offers "try again"', async ({ page }) => {
    const S = 'sw-app system-tickets';
    await go(page, '/system/tickets?tab=permissions');
    const g = (perms: string[], via: string, extra: Record<string, unknown> = {}) => ({ binding_id: `b-${via}-${perms.length}`, permissions: perms, via, role_id: 'system_admin',
      role_name: 'מנהל מערכת', group_name: via === 'group' ? 'טכנאים' : null, scope_type: 'floor', scope_id: 'f-gone', scope_name: null, effect: 'allow', expires_at: '2026-12-31T21:59:59Z', ...extra });
    const ALL = ['tickets.view', 'tickets.create', 'tickets.manage', 'tickets.external', 'tickets.all_departments', 'tickets.configure', 'tickets.costs.view', 'tickets.costs'];
    let fail = true;
    await page.route('**/api/v1/tickets/admin/holders', (route) => (fail
      ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'internal', user_message: 'שגיאה', details: {} }) })
      : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        users: [
          { id: 'u-ronit', name: 'רונית לוי', active: true, grants: [g(ALL, 'role', { scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', expires_at: null })] },
          { id: 'u-gone', name: null, active: false, grants: [g(['tickets.costs.view'], 'grant'), g(['tickets.view'], 'group')] },
        ],
        grant_roles: ['tickets_view', 'tickets_create', 'tickets_manage', 'tickets_all_departments', 'tickets_external', 'tickets_configure', 'tickets_costs_view', 'tickets_costs'],
        roles: [{ id: 'system_admin', name: 'מנהל מערכת', builtin: true, permissions: ALL }, { id: 'viewer', name: 'צופה', builtin: true, permissions: [] },
          { id: 'tickets_costs', name: null, builtin: true, permissions: ['tickets.costs'] }],
      }) })));
    await page.goto(url('/system/tickets?tab=permissions', 'classic', 'light'));
    await expect(page.locator(`${S} [data-perms-error]`)).toBeVisible(); // a failed load: an error state, not a spinner
    fail = false;
    await page.locator(`${S} [data-perms-retry]`).click();
    await expect(page.locator(`${S} [data-card="holders"]`)).toBeVisible();
    await expect(page.locator(`${S} [data-card="matrix"]`)).toContainText('אישור עלויות');
    await expect(page.locator(`${S} [data-holder="u-ronit"]`)).toContainText('צפייה בעלויות');
    await expect(page.locator(`${S} [data-holder="u-gone"]`)).toBeVisible();
    await expect(page.locator(`${S} [data-holder="u-gone"]`)).not.toContainText('null');
    await expect(page.locator(`${S} [data-tickets-settings-error]`)).toHaveCount(0); // the retry cleared the failed load's line
    await shot(page, 'permissions-tab', 'light', 'classic', false);
  });

  test('the assign dialog, the owner\'s state (nobody, nothing set up): three groups, each says why with a link', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await go(page, `/tickets/mine?t=${FRESH}`, { empty: true, publicReady: false }, scheme);
      await openAssign(page);
      await expect(page.locator(`${D} [data-assign-kind]`)).toHaveCount(3);
      await expect(page.locator(`${D} [data-assign-kind="user"]`)).toHaveAttribute('data-kind-blocked', 'no_members');
      await expect(page.locator(`${D} [data-eligible-none] [data-blocked-link="no_members"]`)).toHaveAttribute('href', '#/tickets/handlers');
      await expect(page.locator(`${D} [data-assign-kind="employee"]`)).toHaveAttribute('data-kind-blocked', 'page_off');
      await shot(page, 'assign-nobody', scheme, 'classic', false);
      await page.locator(`${D} [data-assign-kind="person"]`).click();
      await expect(page.locator(`${D} [data-blocked-link="page_off"]`)).toHaveAttribute('href', '#/system/tickets');
    }
    // the handler page set up, still nobody in the directory: the reason moves on to "no one yet", with the page's link
    await go(page, `/tickets/mine?t=${FRESH}`, { empty: true });
    await openAssign(page);
    await page.locator(`${D} [data-assign-kind="employee"]`).click();
    await expect(page.locator(`${D} [data-blocked-link="no_employees"]`)).toHaveAttribute('href', '#/tickets/handlers');
    await page.locator(`${D} [data-assign-kind="person"]`).click();
    await expect(page.locator(`${D} [data-blocked-link="no_contacts"]`)).toHaveAttribute('href', '#/tickets/handlers?seg=vendors');
    await page.locator(`${D} [data-blocked-link="no_contacts"]`).click();
    await expect(page).toHaveURL(/#\/tickets\/handlers\?seg=vendors/);
  });

  test('the assign dialog, a manager without the outside permission: staff without an account are handlers, the outside group says why', async ({ page }) => {
    // TKSTAFF2: an employee without an account is assigned like an account holder (no "send outside" permission); vendors still need it
    const mock = await go(page, `/tickets/mine?t=${FRESH}`, { persona: 'manager' });
    await openAssign(page);
    await expect(page.locator(`${D} [data-assign-kind="employee"]`)).toHaveAttribute('data-kind-blocked', '');
    await expect(page.locator(`${D} [data-assign-kind="person"]`)).toHaveAttribute('data-kind-blocked', 'external');
    await page.locator(`${D} [data-assign-kind="employee"]`).click();
    await expect(page.locator(`${D} [data-handler="contact:c000000000000e01"]`)).toContainText('אבי לוי');
    await page.locator(`${D} [data-handler="contact:c000000000000e01"] input`).check();
    await page.locator(`${D} [data-dialog-ok]`).click();
    await expect.poll(() => last(mock, 'POST', new RegExp(`^tickets/${FRESH}/assign$`))?.body).toMatchObject({ assignee: { kind: 'contact', id: 'c000000000000e01' } });
  });

  test('everything ready: an employee without an account is assigned through the handler link; WhatsApp off shows a note', async ({ page }) => {
    const mock = await go(page, `/tickets/mine?t=${FRESH}`);
    await openAssign(page);
    await page.locator(`${D} [data-assign-kind="employee"]`).click();
    await expect(page.locator(`${D} [data-contact-kind="vendor"]`)).toHaveCount(0);
    // TKSTAFF2: the staff group is the same handler picker as the account holders (one list, one submit)
    await expect(page.locator(`${D} [data-handler^="user:"]`)).toHaveCount(0);
    await page.locator(`${D} [data-handler="contact:c000000000000e01"] input`).check();
    await shot(page, 'assign-employee', 'light', 'classic', false);
    await page.locator(`${D} [data-dialog-ok]`).click();
    await expect.poll(() => last(mock, 'POST', new RegExp(`^tickets/${FRESH}/assign$`))?.body).toMatchObject({ assignee: { kind: 'contact', id: 'c000000000000e01' } });
    // vendors and contacts: one group, a heading each; the WhatsApp switch off is a note (the link is still sent another way)
    await go(page, `/tickets/mine?t=${FRESH}`, { readiness: { master_switch: false } });
    await openAssign(page);
    await page.locator(`${D} [data-assign-kind="person"]`).click();
    await expect(page.locator(`${D} [data-group="vendors"]`)).toBeVisible();
    await expect(page.locator(`${D} [data-group="contacts"]`)).toBeVisible();
    await expect(page.locator(`${D} [data-blocked="switch"] a`)).toHaveAttribute('href', '#/system/tickets?tab=channel');
    await shot(page, 'assign-outside-switch-off', 'light', 'classic', false);
  });
});
