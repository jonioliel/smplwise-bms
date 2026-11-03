import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installGeneratorMock, url } from './generator-mocks';
import { lobbyFeed } from './notice-tv-fixtures';

// BOARD-MGMT-2381 (owner answers 03.11): question 5 - "העתק קישור" copies the CURRENT link and changes nothing; "החלף קישור" is a separate
// button behind the owner's confirmation; question 6 - the manual "שלח שוב" (row action + "שמירה ושליחה שוב" in the compose dialog), never
// automatic after an edit. The REAL build against fake data; every call is recorded.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-board-mgmt-2381.spec.ts
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../test-results/board-mgmt-2381');
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const NOW = '2026-10-23T06:12:00Z';
const CAN = { view: true, manage: true, manage_all: true, push: true, boards: true, configure: true };
const SETTINGS = {
  enabled: true, default_days: 7, default_severity: 'info', push_default: 'by_severity', reads_names: true, retention_days: 365, boards_remote: true, boards_max: 10,
  weather_entity: '', weather_fallback: false, news_custom: true, building_name: '', boards_origin: 'http://192.0.2.10:18094', news_sources: [],
};
const STORED = 'Qq1Ww2Ee3Rr4Tt5Yy6Uu7Ii8Oo9Pp0AaSsDdFfGgHh';
const NEW = 'Zz9Xx8Cc7Vv6Bb5Nn4Mm3Ll2Kk1JjHhGgFfDdSsAa';
const BOARD = { id: 'b1', name: 'לוח הלובי', slug: 'lobby', enabled: true, display: lobbyFeed().board.display, has_token: true, has_stored_link: true,
  token_rotated_at: '2026-10-15T08:00:00Z', last_seen_at: '2026-10-23T06:11:40Z', item_count: 2, created_at: '2026-10-02T08:00:00Z', updated_at: NOW };
const NOTICES = [
  { id: 'n1', title: 'הפסקת מים מחר 10:00-12:00', body: 'עקב עבודות תאגיד המים ברחוב.', severity: 'alert', starts_at: '2026-10-23T05:30:00Z', ends_at: '2026-10-24T09:00:00Z', pinned: false,
    state: 'active', dwell_s: null, when_text: null, published_at: '2026-10-23T05:40:00Z', updated_at: NOW, boards: ['b1'], audience: { everyone: true }, status: 'published', reads: 84,
    push_requested: true, pushed_at: '2026-10-23T05:40:00Z', push_generation: 0 },
  { id: 'n2', title: 'לוחות בלבד', body: 'רק בטלוויזיה.', severity: 'info', starts_at: '2026-10-23T05:30:00Z', ends_at: '2026-10-25T09:00:00Z', pinned: false, state: 'active',
    dwell_s: null, when_text: null, published_at: '2026-10-23T05:40:00Z', updated_at: NOW, boards: ['b1'], audience: {}, status: 'published', reads: 0 },
  { id: 'n3', title: 'פג תוקף', body: '', severity: 'info', starts_at: '2026-10-20T05:30:00Z', ends_at: '2026-10-21T09:00:00Z', pinned: false, state: 'expired',
    dwell_s: null, when_text: null, published_at: '2026-10-20T05:40:00Z', updated_at: NOW, boards: [], audience: { everyone: true }, status: 'published', reads: 3 },
  { id: 'n4', title: 'טיוטה', body: '', severity: 'info', starts_at: '2026-10-23T06:00:00Z', ends_at: '2026-10-30T06:00:00Z', pinned: false, state: 'draft',
    dwell_s: null, when_text: null, published_at: null, updated_at: NOW, boards: [], audience: { everyone: true }, status: 'draft', reads: 0 },
];

type Call = { method: string; path: string; body: unknown };

async function install(page: Page, o: { board?: Partial<typeof BOARD>; push?: boolean } = {}): Promise<Call[]> {
  await page.clock.setFixedTime(new Date(NOW));
  const can = { ...CAN, push: o.push ?? true };
  const board = { ...BOARD, ...(o.board ?? {}) };
  await installGeneratorMock(page, { perms: ['devices.read', 'notices.view', 'notices.manage', 'notices.push', 'notices.boards', 'system.configure'], count: 0,
    modules: { tickets: false, notices: true } as { tickets: boolean } });
  const calls: Call[] = [];
  await page.route('**/api/v1/notices**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    let body: unknown = null;
    try { body = method === 'GET' ? null : req.postDataJSON(); } catch { body = null; }
    calls.push({ method, path: p, body });
    if (p === 'notices/module') return json(route, { enabled: true, can });
    if (p === 'notices/settings' && method === 'GET') return json(route, { settings: SETTINGS, can, weather_entities: [], company_logo: false, listener: true, building_fallback: 'מגדל הים' });
    if (p === 'notices' && method === 'GET') return json(route, { notices: NOTICES, can, now: NOW, defaults: { default_days: 7, default_severity: 'info', push_default: 'by_severity' } });
    const one = /^notices\/(n\d)(?:\/(archive|publish|resend))?$/.exec(p);
    if (one) {
      const n = NOTICES.find((x) => x.id === one[1])!;
      if (one[2] === 'resend') return json(route, { notice: { ...n, push_generation: 1 }, push: { requested: true, sent: true, recipients: 118, generation: 1 } });
      return json(route, { notice: { ...n, ...(body as object) } });
    }
    if (p === 'notices/boards' && method === 'GET') return json(route, { boards: [board], full: true, max: 10, remote: true });
    if (p === 'notices/boards/b1' && method === 'GET') return json(route, { board, notices: NOTICES.slice(0, 2).map((n, i) => ({ ...n, position: i })) });
    if (p === 'notices/boards/b1/link' && method === 'GET') {
      return board.has_stored_link ? json(route, { token: STORED })
        : json(route, { code: 'no_stored_link', user_message: 'ללוח הזה אין קישור שמור.', retryable: false, correlation_id: 'mock', details: {} }, 409);
    }
    if (p === 'notices/boards/b1/rotate-token') return json(route, { token: NEW, board: { ...board, has_stored_link: true, token_rotated_at: NOW } });
    if (p === 'notices/boards/b1/preview') return json(route, lobbyFeed());
    if (p === 'notices/audience/preview') return json(route, { users: 118, in_scope: true });
    if (p === 'notices/audience/options') return json(route, { floors: [{ id: 'f1', name: 'קומה 1', building: 'מבנה א' }], groups: [], roles: [] });
    return json(route, { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: 'mock', details: {} }, 404);
  });
  return calls;
}

const rotations = (calls: Call[]) => calls.filter((c) => c.path.endsWith('rotate-token') || c.path.endsWith('issue-link')).length;

async function shot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}.png`) });
}

test.describe('question 5: copy never replaces the link', () => {
  test('the boards table: "העתק קישור" reads the stored link and replaces nothing', async ({ page }) => {
    const calls = await install(page);
    await page.goto('about:blank');
    await page.goto(url('/system/notices'));
    const root = page.locator('sw-app system-notices');
    if (test.info().project.name === 'mobile') return; // the table is the desktop view; the board page below covers the phone
    const copy = root.locator('tr[data-board="lobby"] [data-copy-link]');
    await expect(copy).toHaveText('העתק קישור');
    await copy.click();
    await expect(root.locator('[data-board-link]')).toContainText(`#t=${STORED}`);
    await expect(root.locator('[data-link-dialog]')).toHaveAttribute('subheading', 'הקישור הקבוע של הלוח. אפשר להעתיק אותו שוב בכל עת.');
    await expect(root.locator('[data-rotate-confirm]')).not.toHaveAttribute('open', '');
    expect(calls.filter((c) => c.method === 'GET' && c.path === 'notices/boards/b1/link').length).toBe(1);
    expect(rotations(calls)).toBe(0);
    await shot(page, 'copy-link');
  });

  test('the board page: "העתק קישור" and a separate "החלף קישור" with the owner\'s confirmation', async ({ page }) => {
    const calls = await install(page);
    await page.goto('about:blank');
    await page.goto(url('/system/notices/b1'));
    const root = page.locator('sw-app system-notices');
    await expect(root.locator('.top [data-copy-link]')).toHaveText('העתק קישור');
    await expect(root.locator('.top [data-rotate]')).toHaveText('החלף קישור');
    await root.locator('.top [data-copy-link]').click();
    await expect(root.locator('[data-board-link]')).toContainText(`#t=${STORED}`);
    await root.locator('[data-link-dialog] sw-button[variant="primary"]').click();
    expect(rotations(calls)).toBe(0);
    // replace: asks first; cancel replaces nothing
    await root.locator('.top [data-rotate]').click();
    const ask = root.locator('[data-rotate-confirm]');
    await expect(ask).toHaveAttribute('heading', 'החלפת הקישור של "לוח הלובי"');
    await expect(ask).toContainText('טלוויזיות שמחוברות בקישור הנוכחי יתנתקו. להחליף?');
    await expect(ask.locator('[data-no-stored-link]')).toHaveCount(0);
    await expect(ask.locator('[data-rotate-go]')).toHaveText('החלף קישור');
    await shot(page, 'replace-confirm');
    await ask.locator('sw-button').first().click();
    expect(rotations(calls)).toBe(0);
    // confirmed: exactly one rotation, and the new link is shown
    await root.locator('.top [data-rotate]').click();
    await ask.locator('[data-rotate-go]').click();
    await expect(root.locator('[data-board-link]')).toContainText(`#t=${NEW}`);
    await expect(root.locator('[data-link-dialog]')).toHaveAttribute('subheading', 'הקישור הוחלף. טלוויזיות שהיו מחוברות בקישור הקודם התנתקו.');
    expect(calls.filter((c) => c.method === 'POST' && c.path === 'notices/boards/b1/rotate-token').length).toBe(1);
  });

  test('a board without a stored copy: copy explains and replaces only on the explicit confirmation', async ({ page }) => {
    const calls = await install(page, { board: { has_stored_link: false } });
    await page.goto('about:blank');
    await page.goto(url('/system/notices/b1'));
    const root = page.locator('sw-app system-notices');
    await root.locator('.top [data-copy-link]').click();
    const ask = root.locator('[data-rotate-confirm]');
    await expect(ask.locator('[data-no-stored-link]')).toContainText('אי אפשר להעתיק אותו');
    await expect(ask).toContainText('טלוויזיות שמחוברות בקישור הנוכחי יתנתקו. להחליף?');
    expect(calls.some((c) => c.path === 'notices/boards/b1/link')).toBe(false);
    expect(rotations(calls)).toBe(0);
    await shot(page, 'legacy-copy');
    await ask.locator('[data-rotate-go]').click();
    await expect(root.locator('[data-board-link]')).toContainText(`#t=${NEW}`);
    expect(rotations(calls)).toBe(1);
  });
});

test.describe('question 6: the manual "שלח שוב"', () => {
  test('the row action: offered on a live notice with recipients, asks with the count, sends once', async ({ page }) => {
    const calls = await install(page);
    await page.goto('about:blank');
    await page.goto(url('/devices/notices'));
    const root = page.locator('sw-app devices-notices');
    if (test.info().project.name === 'mobile') {
      await expect(root.locator('.card').first()).toBeVisible();
      return;
    }
    await expect(root.locator('tr[data-notice="n1"] [data-resend]')).toHaveText('שלח שוב');
    for (const id of ['n2', 'n3', 'n4']) await expect(root.locator(`tr[data-notice="${id}"] [data-resend]`)).toHaveCount(0); // TV only, expired, draft
    await root.locator('tr[data-notice="n1"] [data-resend]').click();
    const ask = root.locator('[data-resend-confirm]');
    await expect(ask).toHaveAttribute('heading', 'לשלוח שוב את "הפסקת מים מחר 10:00-12:00"?');
    await expect(ask).toContainText('ל־118 נמענים');
    expect(calls.some((c) => c.path.endsWith('/resend'))).toBe(false);
    await shot(page, 'resend-confirm');
    await ask.locator('[data-resend-go]').click();
    await expect(root.locator('.toast')).toContainText('ההודעה נשלחה שוב ל־118 נמענים');
    expect(calls.filter((c) => c.method === 'POST' && c.path === 'notices/n1/resend').length).toBe(1);
  });

  test('an edit never re-sends; "שמירה ושליחה שוב" asks, then saves and sends', async ({ page }) => {
    const calls = await install(page);
    await page.goto('about:blank');
    await page.goto(url('/devices/notices'));
    const root = page.locator('sw-app devices-notices');
    const open = () => (test.info().project.name === 'mobile' ? root.locator('.card', { hasText: 'הפסקת מים' }).click() : root.locator('tr[data-notice="n1"]').click());
    await open();
    const dlg = root.locator('notice-compose');
    await dlg.locator('#nt-title').fill('הפסקת מים מחר 11:00-13:00');
    await dlg.locator('[data-publish]').click();
    await expect(root.locator('.toast')).toContainText('לא נשלחה שוב');
    expect(calls.some((c) => c.method === 'PATCH' && c.path === 'notices/n1')).toBe(true);
    expect(calls.some((c) => c.path.endsWith('/resend'))).toBe(false);
    await open();
    const both = dlg.locator('[data-save-resend]');
    await expect(both).toHaveText('שמירה ושליחה שוב');
    await both.click();
    await expect(both).toHaveText('לשמור ולשלוח שוב ל־118 נמענים?');
    expect(calls.some((c) => c.path.endsWith('/resend'))).toBe(false);
    await shot(page, 'save-resend-confirm');
    await both.click();
    await expect(root.locator('.toast')).toContainText('ההודעה נשלחה שוב ל־118 נמענים');
    expect(calls.filter((c) => c.path === 'notices/n1/resend').length).toBe(1);
  });

  test('without the push right nothing offers a re-send', async ({ page }) => {
    await install(page, { push: false });
    await page.goto('about:blank');
    await page.goto(url('/devices/notices'));
    const root = page.locator('sw-app devices-notices');
    await expect(root.locator('[data-kpis]')).toBeVisible();
    await expect(root.locator('[data-resend]')).toHaveCount(0);
    await (test.info().project.name === 'mobile' ? root.locator('.card', { hasText: 'הפסקת מים' }).click() : root.locator('tr[data-notice="n1"]').click());
    await expect(root.locator('notice-compose [data-publish]')).toBeVisible();
    await expect(root.locator('notice-compose [data-save-resend]')).toHaveCount(0);
  });
});
