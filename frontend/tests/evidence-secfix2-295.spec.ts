import { test, expect, type Page, type Route, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { url } from './access-control-mocks';
import { installExternalMock, XNOW } from './access-external-mocks';
import { settlePage } from './pixel-settle';

// SECFIX2-295 (owner decisions 2026-10-21) against a mocked backend (invented names, no phone number anywhere):
//   - the external-access screen's panel of technicians vendors typed on the public page that nobody decided (name, vendor, the request as
//     text while tickets are on, how long waiting, the auto-delete countdown; approve / reject-and-delete through the existing routes);
//     hidden when the server refuses the list (403) or it is empty;
//   - Settings > Security > Public interface: the retention period and the cap (system administrators), the portal's separate sign-in
//     queue and the uniform-answer switch, each saved through its existing route.
// Desktop and phone (run with --project=desktop and --project=mobile). Evidence: docs/design/evidence/SECFIX2-295/.
// Needs the Vite dev server or a built preview (SW_BASE_URL).
const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE = path.resolve(HERE, '..', '..', 'docs', 'design', 'evidence', 'SECFIX2-295');
const SCREEN = 'sw-app access-external-screen';

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const PENDING = [
  { contact_id: 'pc-1', name: 'אבי כהן', vendor: 'מיזוג הצפון בע"מ', ticket_number: 1042, since: '2026-07-20T08:00:00Z', days: 86, days_left: 4 },
  { contact_id: 'pc-2', name: 'Dana Levi', vendor: 'Lift Service Ltd', ticket_number: null, since: '2026-10-12T08:00:00Z', days: 9, days_left: 81 },
];

interface Calls {
  posts: string[];
  policyPuts: Record<string, unknown>[];
  ticketsPuts: Record<string, unknown>[];
  patches: Record<string, unknown>[];
}

async function extraRoutes(page: Page, o: { pending?: 'rows' | 'empty' | 'forbidden'; policy?: 'admin' | 'forbidden' } = {}): Promise<Calls> {
  const calls: Calls = { posts: [], policyPuts: [], ticketsPuts: [], patches: [] };
  let rows = [...PENDING];
  const policy = { pending_retention_days: 90, pending_max_per_vendor: 10 };
  const settings: Record<string, string> = { 'ui.design': 'a', 'tickets.enabled': 'true', 'access.unknown_person_uniform_404': 'false' };
  let tickets = { revision: 4, vendor_portal: { enabled: false, start_worker: false } };
  // registered after the external mock: these routes win for their paths
  await page.route('**/api/v1/access-grants/pending-contacts**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    if (o.pending === 'forbidden') return json(route, { code: 'forbidden', user_message: '', retryable: false, correlation_id: 'mock', details: {} }, 403);
    if (req.method() === 'POST') {
      calls.posts.push(p);
      const id = p.split('/')[2];
      rows = rows.filter((r) => r.contact_id !== id);
      return json(route, { contact_id: id, rejected: p.endsWith('/reject'), deleted: p.endsWith('/reject'), accepted: p.endsWith('/accept') });
    }
    return json(route, { pending: o.pending === 'empty' ? [] : rows, retention_days: 90, max_per_vendor: 10, tickets_on: true });
  });
  await page.route('**/api/v1/access-grants/settings', async (route) => {
    const req = route.request();
    if (o.policy === 'forbidden') return json(route, { code: 'not_system_admin', user_message: '', retryable: false, correlation_id: 'mock', details: {} }, 403);
    if (req.method() === 'PUT') {
      const body = JSON.parse(req.postData() ?? '{}') as Record<string, number>;
      calls.policyPuts.push(body);
      Object.assign(policy, body);
    }
    return json(route, { external_grants: 'off', go_live_permitted: false, max_days: 14, max_days_cap: 14, max_doors: 4, phone_fresh_days: 180, code_hour: 18, local_approvers: 'off',
      digest_channel: 'app', digest_day: 0, digest_hour: 8, name_sync: 'manual', placement: 'access', ...policy });
  });
  await page.route('**/api/v1/settings', async (route) => {
    const req = route.request();
    if (req.method() === 'PATCH') {
      const body = JSON.parse(req.postData() ?? '{}') as Record<string, string>;
      calls.patches.push(body);
      Object.assign(settings, body);
    }
    return json(route, { settings, can_edit: true, nvr_channels: null, warnings: [] });
  });
  await page.route('**/api/v1/tickets/settings', async (route) => {
    const req = route.request();
    if (req.method() === 'PUT') {
      const body = JSON.parse(req.postData() ?? '{}') as { vendor_portal?: { start_worker?: boolean } };
      calls.ticketsPuts.push(body);
      tickets = { revision: tickets.revision + 1, vendor_portal: { ...tickets.vendor_portal, ...(body.vendor_portal ?? {}) } };
    }
    return json(route, tickets);
  });
  return calls;
}

async function boot(page: Page, hash: string, o: Parameters<typeof extraRoutes>[1] = {}, scheme: 'light' | 'dark' = 'light') {
  await installExternalMock(page, {});
  const calls = await extraRoutes(page, o);
  await page.clock.setFixedTime(XNOW);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('about:blank');
  await page.goto(url(hash, 'classic', scheme));
  return { calls, errors };
}

async function shot(page: Page, info: TestInfo, name: string) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await settlePage(page);
  await page.screenshot({ path: path.join(EVIDENCE, `${name}-${info.project.name}.png`), fullPage: true });
}

const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

test('pending technicians: the panel lists them, closest to deletion first, no phone number', async ({ page }, info) => {
  const { errors } = await boot(page, '/wiskey/external');
  const s = page.locator(SCREEN);
  const panel = s.locator('[data-pending-panel]');
  await expect(panel).toBeVisible({ timeout: 30_000 });
  await expect(panel.locator('[data-pending-count]')).toHaveText('2');
  await expect(panel.locator('[data-pending]')).toHaveCount(2);
  await expect(panel.locator('[data-pending]').first()).toHaveAttribute('data-pending', 'pc-1'); // 4 days left
  await expect(panel.locator('[data-pending="pc-1"] [data-left]')).toHaveAttribute('data-tone', 'err');
  const text = await panel.innerText();
  expect(text).toContain('1042');
  expect(text).not.toMatch(/05\d[- ]?\d{3}[- ]?\d{4}|9725\d{8}/);
  expect(text).not.toMatch(/home assistant|ingress/i);
  await panel.scrollIntoViewIfNeeded();
  await noOverflow(page);
  await shot(page, info, '01-pending-panel');
  expect(errors).toEqual([]);
});

test('pending technicians: reject and delete goes through the existing route after a confirmation', async ({ page }, info) => {
  const { calls } = await boot(page, '/wiskey/external');
  const s = page.locator(SCREEN);
  await s.locator('[data-pending="pc-2"] [data-pending-reject]').click();
  const dlg = s.locator('sw-dialog[data-confirm-dialog]');
  await expect(dlg).toBeVisible();
  await shot(page, info, '02-pending-reject-confirm');
  await dlg.locator('[data-confirm-ok]').click();
  await expect.poll(() => calls.posts).toEqual(['access-grants/pending-contacts/pc-2/reject']);
  await expect(s.locator('[data-pending="pc-2"]')).toHaveCount(0);
  await s.locator('[data-pending="pc-1"] [data-pending-approve]').click();
  await s.locator('sw-dialog[data-confirm-dialog] [data-confirm-ok]').click();
  await expect.poll(() => calls.posts).toEqual(['access-grants/pending-contacts/pc-2/reject', 'access-grants/pending-contacts/pc-1/accept']);
  await expect(s.locator('[data-pending-panel]')).toHaveCount(0); // nothing left: the panel goes
});

test('pending technicians: hidden for a caller the server refuses, and when there are none', async ({ page }) => {
  await boot(page, '/wiskey/external', { pending: 'forbidden' });
  const s = page.locator(SCREEN);
  await expect(s.locator('.kpis')).toBeVisible({ timeout: 30_000 });
  await expect(s.locator('[data-pending-panel]')).toHaveCount(0);
  await boot(page, '/wiskey/external', { pending: 'empty' });
  await expect(page.locator(SCREEN).locator('.kpis')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(SCREEN).locator('[data-pending-panel]')).toHaveCount(0);
});

test('public interface settings: the three groups, the defaults, validation and the saves', async ({ page }, info) => {
  const { calls, errors } = await boot(page, '/system/security/public');
  const p = page.locator('sw-app system-security-public');
  await expect(p.locator('[data-public-settings]')).toBeVisible({ timeout: 30_000 });
  await expect(p.locator('[data-public-group]')).toHaveCount(3);
  await expect(p.locator('[data-public-retention]')).toHaveValue('90');
  await expect(p.locator('[data-public-cap]')).toHaveValue('10');
  await expect(p.locator('[data-public-switch="start_worker"]')).toHaveAttribute('aria-checked', 'false');
  await expect(p.locator('[data-public-switch="uniform_404"]')).toHaveAttribute('aria-checked', 'false');
  await expect(p.locator('[data-public-save]')).toHaveAttribute('disabled', ''); // nothing changed
  await noOverflow(page);
  await shot(page, info, '03-public-settings');
  await p.locator('[data-public-retention]').fill('3');
  await expect(p.locator('[data-public-retention]')).toHaveAttribute('aria-invalid', 'true');
  await expect(p.locator('[data-public-save]')).toHaveAttribute('disabled', '');
  await shot(page, info, '04-public-settings-invalid');
  await p.locator('[data-public-retention]').fill('30');
  await p.locator('[data-public-cap]').fill('5');
  await p.locator('[data-public-save]').click();
  await expect.poll(() => calls.policyPuts).toEqual([{ pending_retention_days: 30, pending_max_per_vendor: 5 }]);
  await expect(p.locator('[data-public-saved]')).toBeVisible();
  await p.locator('[data-public-switch="start_worker"]').click();
  await expect.poll(() => calls.ticketsPuts.length).toBe(1);
  expect(calls.ticketsPuts[0]).toEqual({ revision: 4, vendor_portal: { start_worker: true } });
  await expect(p.locator('[data-public-switch="start_worker"]')).toHaveAttribute('aria-checked', 'true');
  await p.locator('[data-public-switch="uniform_404"]').click();
  await expect.poll(() => calls.patches).toEqual([{ 'access.unknown_person_uniform_404': 'true' }]);
  expect(errors).toEqual([]);
});

test('public interface settings: a caller who is not a system administrator does not get the retention group', async ({ page }, info) => {
  await boot(page, '/system/security/public', { policy: 'forbidden' }, 'dark');
  const p = page.locator('sw-app system-security-public');
  await expect(p.locator('[data-public-settings]')).toBeVisible({ timeout: 30_000 });
  await expect(p.locator('[data-public-group="pending"]')).toHaveCount(0);
  await expect(p.locator('[data-public-group]')).toHaveCount(2);
  await shot(page, info, '05-public-settings-no-admin-dark');
});

