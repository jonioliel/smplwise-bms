import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installTicketsMock, url } from './tickets-mocks';
import { installS4Mock, serveBuiltApp, type S4Mock, type S4MockOptions } from './tickets-s4-mocks';
import { skinsUnderTest } from './helpers/frozen-skins';

// TKUI6 (release 2.6.0) evidence: the redesigned "מטפלים וספקים" page and the service-management settings, from the REAL build against the
// mock layer (fake data only). Mock-up v5: the page frame of the automations pages, handler cards with the load counts (department
// managers only), vendor cards with the channel selector and the code chip, contact rows, the readiness banner only when something is
// missing; the settings in the automations-settings look with the seven tabs. Desktop 1440 and phone 390, light / dark, the five skins.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-tickets-ui6.spec.ts --project=desktop --project=mobile --workers=1
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/tickets-ui6');
const H = 'sw-app tickets-handlers';
const S = 'sw-app system-tickets';
const NAME = { one: 'בקשת שירות', many: 'בקשות שירות', gender: 'f' };
const SKINS = skinsUnderTest(['classic', 'domus', 'tesla', 'bubble', 'crystal'] as const);
const isPhone = (p: Page) => (p.viewportSize()?.width ?? 1440) < 768;
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

/** The manager board's answer (only what the handlers page reads: the open requests with their handler, waiting side and stuck mark). */
const OPEN = (key: string, n: number, over: Record<string, unknown>[] = []) => Array.from({ length: n }, (_, i) => ({ id: `${key}-${i}`, assignee_key: key, waiting_on: 'none', stuck: null, ...(over[i] ?? {}) }));
const BOARD_ITEMS = [
  ...OPEN('user:u-ronit', 4, [{ waiting_on: 'assignee' }, { waiting_on: 'assignee' }, { stuck: { kind: 'stuck', level: 1, reminders: 1, since: null } }]),
  ...OPEN('user:u-avi', 3), ...OPEN('user:u-dana', 2, [{ waiting_on: 'assignee' }]), ...OPEN('contact:c000000000000e01', 1), { id: 'x', assignee_key: 'none', waiting_on: 'manager', stuck: null },
];

const ACCOUNT = 'entry:01JDEMOACCOUNT';
const ACCOUNT_LABEL = 'שירות ····0191';
const at = (h: number) => new Date(Date.parse('2026-10-13T10:42:00Z') - h * 3_600_000).toISOString().replace(/\.\d+Z$/, 'Z');

/** The channel, templates, costs and locations screens' routes (fake data) - the tabs of the settings that the base mock layers do not answer. */
async function installTabsMock(page: Page): Promise<void> {
  await page.route('**/api/v1/tickets/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    if (p === 'tickets/channel' && method === 'GET') {
      return json(route, {
        revision: 3, whatsapp: { enabled: true, use_buttons: false, reply_window_h: 72 }, email_fallback: true,
        uses: [
          { key: 'tickets.messages', label: 'הודעות', value: ACCOUNT, resolved: ACCOUNT, inherits: null, inherits_label: null, required: true, queued: 1,
            departments: [{ id: 'dept-maintenance', name: 'אחזקה', value: null, resolved: ACCOUNT }] },
          { key: 'tickets.codes', label: 'קודי אימות', value: null, resolved: ACCOUNT, inherits: 'tickets.messages', inherits_label: 'הודעות', required: false, queued: 0 },
        ],
        accounts: [{ key: ACCOUNT, label: ACCOUNT_LABEL, last4: '0191', state: 'connected', kind: 'discovered', uses: ['tickets.messages'], sends_24h: 7, per_day: 150,
          last_send_at: at(0.2), last_ok_at: at(0.2), shared_outside: false, ticket: true }],
        warnings: [], ws_connected: true, email: { configured: true }, inbound: { wanted: true }, test_send: { enabled: false },
        health: { worker: { running: true, inbound_wanted: true }, outbox: { depth: { queued: 1 }, oldest_open_s: 3600, last_24h: { [ACCOUNT]: { sent: 7 } } },
          inbound: { last_24h: { status: 3, note: 1 }, queue: 0, queue_overflow: 0 } },
        accounts_href: '#/system/messaging-accounts',
      });
    }
    if (p === 'tickets/admin/message-templates' && method === 'GET') {
      return json(route, {
        purposes: ['assign', 'reminder', 'code', 'closed', 'reassigned', 'reopened', 'update'], langs: ['he', 'en', 'ar', 'ru'],
        placeholders: ['name', 'number', 'department', 'title', 'place', 'link', 'code', 'module_name'],
        rules: { link_required: ['assign', 'reminder', 'reopened', 'update'], code_only: ['code'], code_forbidden: ['link', 'place', 'title'], max_rendered: 1000 },
        items: [], starters: { assign: { he: 'שלום {name},\n{module_name} {number} ({department}): {title}\n{place}\nלעדכון הטיפול: {link}' } }, samples: {},
        departments: [{ id: 'dept-maintenance', name: 'אחזקה' }, { id: 'dept-cleaning', name: 'ניקיון' }],
      });
    }
    if (p === 'tickets/admin/message-templates/preview') {
      return json(route, { text: 'שלום דני,\nבקשת שירות 1042 (אחזקה): מזגן לא מקרר\nקומה 1 · חדר 102\nלעדכון הטיפול: [קישור]', problems: [], length: 90, max: 1000 });
    }
    if (p === 'tickets/admin/locations' && method === 'GET') {
      const loc = (id: string, name: string, street: string, city: string, is_default: boolean, sort_order: number, lat: number | null, lng: number | null, references: number) => ({
        id, name, street, city, details: '', is_default, sort_order, has_coordinates: lat !== null, map_url: '', lat, lng, active: true,
        nav_url: lat !== null ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` : '', references, revision: 1, updated_at: at(48) });
      return json(route, {
        locations: [loc('loc-main', 'הבניין הראשי', 'הרצל 1', 'תל אביב', true, 0, 32.0853, 34.7818, 4), loc('loc-store', 'המחסן', 'התעשייה 7', 'חולון', false, 1, null, null, 0)],
        default_id: 'loc-main', department_defaults: { 'dept-maintenance': 'loc-main' }, max: 50,
      });
    }
    if (p === 'tickets/costs/departments' && method === 'GET') {
      return json(route, {
        installation: { mode: 'optional', claim_window_days: 14 },
        departments: [{ id: 'dept-maintenance', key: 'maintenance', name: 'אחזקה', active: true, cost_claim: 'required', claim_window_days: null }, { id: 'dept-cleaning', key: 'cleaning', name: 'ניקיון', active: true, cost_claim: null, claim_window_days: 7 }],
      });
    }
    return route.fallback();
  });
}

const boardCalls = { n: 0 };
/** HANDLERLOAD: the `days` of every GET tickets/handler-load, and the installation default the mock answers with. */
const loadCalls: (string | null)[] = [];
let handledDefault = 7;
async function go(page: Page, hash: string, o: S4MockOptions & { board?: boolean } = {}, scheme: 'light' | 'dark' = 'light', skin = 'classic'): Promise<S4Mock> {
  boardCalls.n = 0;
  loadCalls.length = 0;
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  const base = test.info().project.use.baseURL;
  if (process.env.SW_DIST_ROUTE === '1' && base) await serveBuiltApp(page, new URL(base).origin);
  await installTicketsMock(page, { persona: o.persona ?? 'admin', name: NAME });
  const mock = await installS4Mock(page, o);
  await installTabsMock(page);
  if (o.board !== false) {
    await page.route('**/api/v1/tickets/board**', (route) => (boardCalls.n++, json(route, {
      items: BOARD_ITEMS, closed: [], counts: { all: BOARD_ITEMS.length, waiting: 0, stuck: 1, unassigned: 1, closed_week: 0, closed_all: 0 }, handling: [], departments: [], tree: [],
      truncated: false, all_departments: true, now: '2026-10-13T10:42:00Z', ui: {},
    })));
  }
  if (o.board !== false) {
    await page.route('**/api/v1/tickets/handler-load**', (route) => {
      const days = new URL(route.request().url()).searchParams.get('days');
      loadCalls.push(days);
      const d = Number(days ?? handledDefault);
      return json(route, { days: d, default_days: handledDefault, since: '2026-10-11T00:00:00Z', now: '2026-10-17T10:00:00Z', truncated: false,
        handled: { 'user:u-ronit': d === 1 ? 2 : d === 7 ? 9 : 31 } });
    });
  }
  await page.goto('about:blank');
  await page.goto(url(hash, skin, scheme));
  return mock;
}

/** The page scrolls inside its own host: the viewport is raised to the host's full height for the picture, then put back. */
async function shot(page: Page, name: string, scheme: 'light' | 'dark' = 'light', skin = 'classic', full = true): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${name}: horizontal overflow`).toBeLessThanOrEqual(1);
  const vp = page.viewportSize();
  let raised = false;
  if (full && vp) {
    const host = await page.locator('sw-app tickets-handlers, sw-app system-tickets').first().evaluate((el) => el.scrollHeight).catch(() => 0);
    if (host > vp.height - 60) {
      await page.setViewportSize({ width: vp.width, height: Math.min(host + 80, 3200) });
      await page.waitForTimeout(250);
      raised = true;
    }
  }
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}-${scheme}-${skin}.png`) });
  if (raised && vp) await page.setViewportSize(vp);
}

test.describe('TKUI6: handlers & vendors page and the service-management settings (mock-up v5)', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));
  test.beforeEach(async ({ page }, info) => {
    test.setTimeout(240_000);
    test.skip(info.project.name === 'tablet', 'desktop 1440 and phone 390');
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('handlers: member cards with the load counts for the department manager, the employees without an account; light / dark x five skins', async ({ page }) => {
    const runs: [string, 'light' | 'dark'][] = isPhone(page) ? [['classic', 'light'], ['classic', 'dark']] : [...SKINS.map((s) => [s, 'light'] as [string, 'light']), ['classic', 'dark']];
    for (const [skin, scheme] of runs) {
      await go(page, '/tickets/handlers', {}, scheme, skin);
      await page.waitForSelector(`${H} tickets-handlers-members [data-member="user:u-ronit"]`);
      await page.waitForSelector(`${H} tickets-contacts[kind="employee"] [data-contact-card="c000000000000e01"]`);
      // the load counts: open / waiting for them / stuck - the three of Ronit (a manager of maintenance, the admin persona manages it)
      await expect(page.locator(`${H} tickets-handlers-members [data-member="user:u-ronit"] [data-stat="open"]`)).toHaveText('4');
      await expect(page.locator(`${H} tickets-handlers-members [data-member="user:u-ronit"] [data-stat="waiting"]`)).toHaveText('2');
      await expect(page.locator(`${H} tickets-handlers-members [data-member="user:u-ronit"] [data-stat="stuck"]`)).toHaveText('1');
      await expect(page.locator(`${H} [data-readiness]`)).toHaveCount(0); // everything ready: no strip
      await shot(page, 'handlers', scheme, skin);
    }
  });

  test('handlers: the handled number - default period, the selector, the remembered choice, phone width', async ({ page }) => {
    handledDefault = 7;
    await go(page, '/tickets/handlers');
    const card = `${H} tickets-handlers-members [data-member="user:u-ronit"]`;
    await page.waitForSelector(`${card} [data-stat="handled"]`);
    await expect(page.locator(`${card} [data-stat="handled"]`)).toHaveText('9'); // the installation default: 7 days
    await expect(page.locator(`${card} [data-stat-period]`)).toHaveText('7 ימים');
    await expect(page.locator(`${H} [data-handled-period]`)).toHaveValue('7');
    await page.locator(`${H} [data-handled-period]`).selectOption('30');
    await expect(page.locator(`${card} [data-stat="handled"]`)).toHaveText('31');
    expect(loadCalls.at(-1)).toBe('30');
    // the open / waiting / stuck numbers are the current state: the period does not touch them
    await expect(page.locator(`${card} [data-stat="open"]`)).toHaveText('4');
    await shot(page, 'handlers-handled', 'light', 'classic');
    // the choice is remembered for this viewer and wins over the installation default
    handledDefault = 1;
    await go(page, '/tickets/handlers');
    await page.waitForSelector(`${card} [data-stat="handled"]`);
    await expect(page.locator(`${H} [data-handled-period]`)).toHaveValue('30');
    expect(loadCalls[0]).toBe('30');
  });

  test('handlers: the load is for department managers only - nobody else sees a count', async ({ page }) => {
    // the "manager" persona manages maintenance only and has no settings right: the member cards are not offered (403), the employee card shows its own load
    await go(page, '/tickets/handlers', { persona: 'manager' });
    await page.waitForSelector(`${H} tickets-contacts[kind="employee"] [data-contact-card="c000000000000e01"]`);
    await expect(page.locator(`${H} tickets-contacts[kind="employee"] [data-contact-card="c000000000000e01"] [data-stat="open"]`)).toHaveText('1');
    // a user who manages no department: no numbers at all, and the board is never asked
    await go(page, '/tickets/handlers', { persona: 'operator' });
    await page.waitForTimeout(800);
    await expect(page.locator(`${H} [data-stat]`)).toHaveCount(0);
    expect(boardCalls.n).toBe(0);
  });

  test('vendors and contacts: vendor cards with the channel selector and the code chip; contact rows; the drawer editor', async ({ page }) => {
    const runs: [string, 'light' | 'dark'][] = isPhone(page) ? [['classic', 'light'], ['classic', 'dark']] : [['classic', 'light'], ['classic', 'dark'], ['domus', 'light']];
    for (const [skin, scheme] of runs) {
      const mock = await go(page, '/tickets/handlers?seg=vendors', {}, scheme, skin);
      await page.waitForSelector(`${H} tickets-contacts[kind="vendor"] [data-contact-card="c000000000000v01"]`);
      await expect(page.locator(`${H} tickets-contacts [data-contact-card="c000000000000v01"] [data-contact-channel="whatsapp"]`)).toHaveAttribute('aria-checked', 'true');
      await expect(page.locator(`${H} tickets-contacts [data-contact-card="c000000000000v01"] [data-contact-code]`)).toContainText('ללא קוד');
      if (skin === 'classic' && scheme === 'light') {
        // a quick channel change from the card writes the preferred channel only
        await page.locator(`${H} tickets-contacts [data-contact-card="c000000000000v01"] [data-contact-channel="email"]`).click();
        await expect.poll(() => [...mock.calls].reverse().find((c) => c.method === 'PATCH' && /^tickets\/contacts\/c000000000000v01$/.test(c.path))?.body).toMatchObject({ preferred_channel: 'email' });
      }
      await shot(page, 'vendors', scheme, skin);
      await page.locator(`${H} [data-handlers-tabs] [data-seg="contacts"]`).click();
      await page.waitForSelector(`${H} tickets-contacts[kind="person"] [data-contact-item="c000000000000p01"]`);
      await shot(page, 'contacts', scheme, skin);
    }
    await go(page, '/tickets/handlers?seg=vendors');
    await page.locator(`${H} tickets-contacts [data-contact-item="c000000000000v01"]`).click();
    await page.waitForSelector(`${H} tickets-contacts [data-card="contact-editor"]`);
    await shot(page, 'vendor-editor', 'light', 'classic', false);
  });

  test('the readiness banner appears only when something is missing, with a link to each setting', async ({ page }) => {
    await go(page, '/tickets/handlers', { publicReady: false, readiness: { master_switch: false } });
    await page.waitForSelector(`${H} [data-readiness]`);
    await expect(page.locator(`${H} [data-readiness-item]`)).toHaveCount(3);
    await shot(page, 'handlers-readiness', 'light', 'classic', false);
  });

  test('settings: the eight tabs, every tab renders; light / dark, desktop and phone', async ({ page }) => {
    const tabs = ['general', 'departments', 'locations', 'display', 'channel', 'messages', 'costs', 'rules', 'permissions'];
    const waits: Record<string, string> = {
      general: `${S} [data-name-editor]`, departments: `${S} tickets-dept-editor`, locations: `${S} tickets-locations-settings [data-card="locations"]`, display: `${S} ticket-board-settings [data-ui-board]`, channel: `${S} tickets-channel-settings [data-channel-settings]`,
      messages: `${S} tickets-message-templates [data-message-templates]`, costs: `${S} tickets-costs-settings [data-costs-settings]`,
      rules: `${S} tickets-rules-settings` /* integ/291: TKRULES-291 added the tab; the mock serves no rules document, so the element is the proof */, permissions: `${S} [data-holder]`,
    };
    for (const scheme of ['light', 'dark'] as const) {
      await go(page, '/system/tickets', {}, scheme);
      await page.waitForSelector(waits.general);
      await expect(page.locator(`${S} [data-tickets-settings-tabs] [role="tab"]`)).toHaveCount(tabs.length);
      for (const t of tabs) {
        await page.locator(`${S} [data-settings-tab="${t}"]`).click();
        await page.waitForSelector(waits[t], { timeout: 15_000 });
        await expect(page.locator(`${S} [data-settings-tab="${t}"]`)).toHaveAttribute('aria-selected', 'true');
        await shot(page, `settings-${t}`, scheme);
      }
    }
  });

  test('settings: the display tab carries the opening / board / device rows and the place of the drawer settings; the general tab keeps the links, the hours and the handler page', async ({ page }) => {
    const mock = await go(page, '/system/tickets?tab=display');
    await page.waitForSelector(`${S} [data-display-tab]`);
    await expect(page.locator(`${S} [data-ui-detail]`)).toHaveCount(3);
    await expect(page.locator(`${S} [data-ui-new]`)).toHaveCount(2);
    await expect(page.locator(`${S} [data-long-press]`)).toHaveCount(1);
    await page.locator(`${S} [data-ui-new="dialog"]`).click();
    await expect.poll(() => [...mock.calls].reverse().find((c) => c.method === 'PUT' && /^tickets\/settings$/.test(c.path))?.body).toMatchObject({ ui: { new_ticket: 'dialog' } });
    await go(page, '/system/tickets');
    await page.waitForSelector(`${S} [data-card="links"]`);
    await expect(page.locator(`${S} [data-card="hours"]`)).toBeVisible();
    await expect(page.locator(`${S} tickets-public-card`)).toBeVisible();
    await expect(page.locator(`${S} [data-card="display"]`)).toHaveCount(0);
  });

  test('settings: keyboard - arrow keys move between the tabs (RTL: left is forward), Home and End jump, one tab stop', async ({ page }) => {
    await go(page, '/system/tickets');
    await page.waitForSelector(`${S} [data-name-editor]`);
    await page.locator(`${S} [data-settings-tab="general"]`).focus();
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator(`${S} [data-settings-tab="departments"]`)).toBeFocused();
    await expect(page.locator(`${S} [data-settings-tab="departments"]`)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('End');
    await expect(page.locator(`${S} [data-settings-tab="permissions"]`)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator(`${S} [data-settings-tab][tabindex="0"]`)).toHaveCount(1);
  });
});
