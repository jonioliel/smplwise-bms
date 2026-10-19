import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installTicketsMock, url, type Persona } from './tickets-mocks';
import { installS4Mock, serveBuiltApp } from './tickets-s4-mocks';

// NEEDSREVIEW (2.8.0) evidence: "מטפלים וספקים" › "דורש בחינה" - the privacy review report for the directory's editors (tickets.configure):
// technicians pending too long ("דחייה ומחיקה" = the existing reject route) and idle people ("מחיקה עכשיו" = the directory erase), each
// after a confirmation dialog; a row linked to the door system carries the note that removing it there is a separate manual step; the
// thresholds card. The REAL build against the mock layer (fake data only). Desktop 1440 and phone 390, light / dark. Asserts what is sent.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-tickets-needs-review.spec.ts --project=desktop --project=mobile --workers=1
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/tickets-needs-review');
const H = 'sw-app tickets-handlers';
const R = `${H} tickets-needs-review`;
const NAME = { one: 'בקשת שירות', many: 'בקשות שירות', gender: 'f' };

const PENDING = { contact_id: 'c00000000000nr01', name: 'טכנאי לדוגמה', vendor: 'ספק לדוגמה', phone: '•••• 0101', section: 'pending', since: '2026-09-01T08:00:00Z', days: 47,
  door_system_linked: false, door_system_created: false, action: 'reject' };
const IDLE = { contact_id: 'c00000000000nr02', name: 'איש קשר לא פעיל', vendor: null, phone: '•••• 0102', section: 'idle', since: '2025-08-10T08:00:00Z', months: 14,
  door_system_linked: true, door_system_created: true, action: 'erase' };

interface Sent { method: string; path: string; body: unknown }

async function go(page: Page, persona: Persona, scheme: 'light' | 'dark' = 'light'): Promise<Sent[]> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  const base = test.info().project.use.baseURL;
  if (process.env.SW_DIST_ROUTE === '1' && base) await serveBuiltApp(page, new URL(base).origin);
  await installTicketsMock(page, { persona, name: NAME });
  await installS4Mock(page, {});
  const sent: Sent[] = [];
  let rows = [PENDING, IDLE];
  let limits = { review_pending_days: 30, review_idle_months: 12 };
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  const log = (route: Route) => {
    const req = route.request();
    sent.push({ method: req.method(), path: new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, ''), body: req.postDataJSON?.() ?? null });
  };
  await page.route('**/api/v1/tickets/contacts-review', (route) => {
    if (persona !== 'admin') return json(route, { code: 'forbidden', user_message: 'אין הרשאה', retryable: false, details: {} }, 403);
    return json(route, { pending_days: limits.review_pending_days, idle_months: limits.review_idle_months, at: '2026-10-18T08:00:00Z',
      pending: rows.filter((r) => r.section === 'pending'), idle: rows.filter((r) => r.section === 'idle') });
  });
  await page.route('**/api/v1/access-grants/pending-contacts/*/reject', (route) => {
    log(route);
    const id = route.request().url().split('/').slice(-2)[0];
    rows = rows.filter((r) => r.contact_id !== id);
    return json(route, { contact_id: id, rejected: true, deleted: true, requests_ended: 1 });
  });
  await page.route('**/api/v1/tickets/contacts-review/*/delete', (route) => {
    log(route);
    const id = route.request().url().split('/').slice(-2)[0];
    rows = rows.filter((r) => r.contact_id !== id);
    return json(route, { contact_id: id, deleted: true, door_system_linked: true, links_revoked: 0 });
  });
  await page.route('**/api/v1/tickets/settings', (route) => {
    if (persona !== 'admin') return json(route, { code: 'forbidden', user_message: 'אין הרשאה', retryable: false, details: {} }, 403);
    if (route.request().method() === 'PUT') {
      log(route);
      const b = route.request().postDataJSON() as { directory?: typeof limits };
      limits = { ...limits, ...(b.directory ?? {}) };
    }
    return json(route, { revision: 3, ui: { detail: 'drawer_fullscreen', new_ticket: 'sheet' }, directory: { managers_full_phones: false, ...limits } });
  });
  await page.goto('about:blank');
  await page.goto(url('/tickets/handlers?seg=review', 'classic', scheme));
  return sent;
}

async function shot(page: Page, name: string, scheme: 'light' | 'dark'): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${name}: horizontal overflow`).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}-${scheme}.png`), fullPage: true });
}

test.describe('needs review report (NEEDSREVIEW 2.8.0)', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));
  test.beforeEach(async ({ page }, info) => {
    test.setTimeout(180_000);
    test.skip(info.project.name === 'tablet', 'desktop 1440 and phone 390');
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('the report: both lists, the door-system tag, the thresholds; light / dark', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await go(page, 'admin', scheme);
      await page.waitForSelector(`${R} [data-review-row="${PENDING.contact_id}"]`);
      await expect(page.locator(`${H} [data-handlers-tabs] [data-seg="review"]`)).toHaveAttribute('aria-checked', 'true');
      await expect(page.locator(`${H} [data-handlers-tabs] [data-seg="review"] small`)).toHaveText('2');
      await expect(page.locator(`${R} [data-review-list="pending"] [data-review-action="reject"]`)).toHaveCount(1);
      await expect(page.locator(`${R} [data-review-list="idle"] [data-review-action="erase"]`)).toHaveCount(1);
      await expect(page.locator(`${R} [data-review-row="${IDLE.contact_id}"] [data-review-door]`)).toBeVisible();
      await expect(page.locator(`${R} [data-review-limits]`)).toBeVisible();
      await expect(page.locator(`${H} [data-handlers-new]`)).toHaveCount(0); // no "+" on the report
      await shot(page, 'report', scheme);
    }
  });

  test('reject and delete: the dialog, then the existing reject route; delete now: the door note, then the erase', async ({ page }) => {
    const sent = await go(page, 'admin');
    await page.locator(`${R} [data-review-row="${PENDING.contact_id}"] [data-review-action="reject"]`).click();
    await expect(page.locator(`${R} [data-review-dialog="reject"] [data-review-confirm]`)).toBeVisible(); // the host is a zero-size wrapper of a fixed backdrop
    await expect(page.locator(`${R} [data-review-door-note]`)).toHaveCount(0);
    await shot(page, 'reject-dialog', 'light');
    await page.locator(`${R} [data-review-cancel]`).click();
    await expect(page.locator(`${R} [data-review-dialog]`)).toHaveCount(0);
    expect(sent.filter((s) => s.method === 'POST')).toHaveLength(0); // cancel sends nothing
    await page.locator(`${R} [data-review-row="${PENDING.contact_id}"] [data-review-action="reject"]`).click();
    await page.locator(`${R} [data-review-confirm]`).click();
    await expect(page.locator(`${R} [data-review-row="${PENDING.contact_id}"]`)).toHaveCount(0);
    expect(sent.find((s) => s.path === `access-grants/pending-contacts/${PENDING.contact_id}/reject`)?.method).toBe('POST');
    await expect(page.locator(`${H} [data-handlers-ok]`)).toBeVisible();

    await page.locator(`${R} [data-review-row="${IDLE.contact_id}"] [data-review-action="erase"]`).click();
    await expect(page.locator(`${R} [data-review-dialog="erase"] [data-review-door-note]`)).toBeVisible();
    await shot(page, 'delete-dialog', 'light');
    await page.locator(`${R} [data-review-confirm]`).click();
    await expect(page.locator(`${R} [data-review-row="${IDLE.contact_id}"]`)).toHaveCount(0);
    const del = sent.find((s) => s.path === `tickets/contacts-review/${IDLE.contact_id}/delete`);
    expect(del?.body).toEqual({ confirm: true });
    await expect(page.locator(`${R} [data-review-empty]`)).toHaveCount(2);
    expect(sent.some((s) => /wiskey|links\/.*\/delete-person/.test(s.path))).toBe(false); // never the door system
  });

  test('the thresholds save through the installation settings', async ({ page }) => {
    const sent = await go(page, 'admin');
    await page.waitForSelector(`${R} [data-review-limits]`);
    await page.locator(`${R} [data-review-pending-days]`).fill('45');
    await page.locator(`${R} [data-review-limits-save]`).click();
    await expect(page.locator(`${R} [data-review-list="pending"]`)).toHaveAttribute('heading', /45/);
    const put = sent.find((s) => s.method === 'PUT' && s.path === 'tickets/settings');
    expect(put?.body).toEqual({ revision: 3, directory: { review_pending_days: 45, review_idle_months: 12 } });
  });

  test('a department manager without tickets.configure does not see the segment', async ({ page }) => {
    await go(page, 'manager');
    await page.waitForSelector(`${H} [data-handlers-tabs]`);
    await expect(page.locator(`${H} [data-handlers-tabs] [data-seg="review"]`)).toHaveCount(0);
    await expect(page.locator(`${H} [data-handlers-tabs] [data-seg="handlers"]`)).toHaveAttribute('aria-checked', 'true');
  });
});
