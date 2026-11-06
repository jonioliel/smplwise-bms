import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN, installFrigate, newFrigateMock } from './frigate-mocks';

// WXH-LEFTOVERS-2405: the bridge-key card's owner contacts, watchdog lines and hand-over row, and the Settings banner, against a MOCKED
// backend (synthetic ids and names only, never key material). Hebrew (RTL) and English; the banner on two Settings screens and absent
// without an open notice. SW_SHOTS=1 writes screenshots to docs/design/evidence/wxh-leftovers-2405.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-wxh-leftovers-2405.spec.ts --workers=1
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/wxh-leftovers-2405');
const C = 'sw-app system-setup sw-bridge-key-card';
const BANNER = 'sw-app sw-bridge-key-banner [data-bridge-key-banner]';

async function shot(page: Page, name: string, sel = `${C} [data-bridge-key]`) {
  if (!process.env.SW_SHOTS) return;
  fs.mkdirSync(OUT, { recursive: true });
  await page.locator(sel).screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}.png`) });
}
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const KEY = { kid: 'g2-1a2b3c4d', generation: 2, state: 'current', created_at: '2026-11-01T08:00:00Z', activated_at: '2026-11-01T08:01:00Z', verify_until: null, ended_at: null, readable: true };
const ROT = (state: string, over: Record<string, unknown> = {}) => ({
  id: 'r-7', mode: 'routine', state, kid_from: 'g1-0f0e0d0c', kid_to: 'g2-1a2b3c4d', gen_from: 1, gen_to: 2, started_at: '2026-11-01T08:00:00Z',
  switched_at: '2026-11-01T08:01:00Z', ended_at: '2026-11-01T08:02:30Z', result_code: null, anchor_eligible: false, ...over,
});
const NAMES: Record<string, string> = { 'u-1': 'מנהלת ראשית', 'u-2': 'מנהל שני', 'u-3': 'מנהל לשעבר' };
const CONTACTS = (ids: string[]) => ({
  ids,
  users: ids.map((id) => ({ id, name: NAMES[id] ?? id, valid: id !== 'u-3' })),
  candidates: [{ id: 'u-1', name: NAMES['u-1'] }, { id: 'u-2', name: NAMES['u-2'] }],
  set: ids.some((i) => i !== 'u-3'),
  max: 5,
  recipients: 2,
});
function status(over: Record<string, unknown> = {}) {
  return {
    enabled: true, go_live_permitted: true, peer_available: true, adopted: true, key: KEY, keys: [KEY], rotation: null, last: ROT('verified'),
    history: [ROT('verified')], reminder_days: 0, reminder_values: [0, 30, 90, 180, 365], reminder_due: false, can_start: false,
    blocked_by: 'wiskey_present', automatic: 'off', owner_contacts: CONTACTS([]), notice_banner: { show: false, open: 0, contacts_set: false }, watchdog: [],
    hand_over: { key_generation: 2, last_rotation: null, anchor_decrease_available: false, bridge_generation: null }, ...over,
  };
}

async function setup(page: Page, body: unknown, banner = false) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installFrigate(page, newFrigateMock({ perms: ADMIN }));
  const calls: { method: string; path: string; body: unknown }[] = [];
  let current = body as Record<string, unknown>; // the server keeps what a PUT saved (the card reloads with a GET after every change)
  await page.route('**/api/v1/system/bridge-key**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname;
    calls.push({ method: req.method(), path: p, body: req.method() === 'GET' ? null : req.postDataJSON() });
    if (p.endsWith('/notice')) return json(route, { show: banner, open: banner ? 1 : 0, contacts_set: false });
    if (req.method() === 'PUT') current = { ...current, owner_contacts: CONTACTS((req.postDataJSON() as { user_ids: string[] }).user_ids) };
    return json(route, current);
  });
  return calls;
}

const SCREENS: [string, unknown][] = [
  ['contacts-none', status()],
  ['contacts-set', status({ owner_contacts: CONTACTS(['u-1', 'u-3']) })],
  ['watchdog-overdue', status({ rotation: { ...ROT('switched', { ended_at: null }), retire_at: null }, watchdog: [{ code: 'overlap_overdue', rotation_id: 'r-7', since: '2026-11-01T08:00:00Z' }] })],
  ['watchdog-repair-mismatch', status({
    last: ROT('needs_repair'), watchdog: [{ code: 'needs_repair', rotation_id: 'r-7' }, { code: 'generation_mismatch', arx_generation: 2, bridge_generation: 3 }],
    hand_over: { key_generation: 2, last_rotation: null, anchor_decrease_available: false, bridge_generation: 3 },
  })],
  ['anchor-eligible', status({
    last: ROT('verified', { mode: 'hard_cut', anchor_eligible: true }),
    hand_over: {
      key_generation: 2, anchor_decrease_available: false, bridge_generation: 2,
      last_rotation: { rotation_id: 'r-7', mode: 'hard_cut', state: 'verified', verified_old_rejected: true, anchor_eligible: true, completed_at: '2026-11-01T08:02:30Z' },
    },
  })],
];

for (const [name, body] of SCREENS) {
  test(`bridge key leftovers: ${name}`, async ({ page }) => {
    await setup(page, body);
    await page.goto('/?design=a#/system/setup');
    const card = page.locator(`${C} [data-bridge-key]`);
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card).not.toContainText('undefined');
    await expect(page.locator(`${C} [data-bridge-key-owners]`)).toBeVisible();
    await expect(page.locator(`${C} [data-bridge-key-hand-over]`)).toBeVisible();
    await shot(page, `${name}-he`);
    await page.evaluate(() => {
      document.documentElement.setAttribute('lang', 'en');
      document.documentElement.setAttribute('dir', 'ltr');
      (document.querySelector('sw-app')?.shadowRoot?.querySelector('system-setup')?.shadowRoot?.querySelector('sw-bridge-key-card') as (HTMLElement & { requestUpdate(): void }) | null)?.requestUpdate();
    });
    await expect(card).toContainText('Owner contacts');
    await shot(page, `${name}-en`);
  });
}

test('the watchdog lines and the anchor note follow the server', async ({ page }) => {
  await setup(page, SCREENS[3][1]);
  await page.goto('/?design=a#/system/setup');
  await expect(page.locator(`${C} [data-bridge-key-watchdog]`)).toHaveCount(2, { timeout: 20_000 });
  await expect(page.locator(`${C} [data-bridge-key-watchdog="generation_mismatch"]`)).toContainText('3');
  await expect(page.locator(`${C} [data-bridge-key-anchor]`)).toHaveCount(0);
  const p2 = await page.context().newPage();
  await setup(p2, SCREENS[4][1]);
  await p2.goto('/?design=a#/system/setup');
  await expect(p2.locator(`${C} [data-bridge-key-anchor]`)).toBeVisible({ timeout: 20_000 });
  await expect(p2.locator(`${C} [data-bridge-key-watchdog]`)).toHaveCount(0);
});

test('adding and removing an owner contact sends the whole list', async ({ page }) => {
  const calls = await setup(page, status());
  await page.goto('/?design=a#/system/setup');
  const add = page.locator(`${C} [data-bridge-key-owner-add]`);
  await expect(add).toBeVisible({ timeout: 20_000 });
  await add.selectOption('u-2');
  await expect.poll(() => calls.filter((c) => c.method === 'PUT').length).toBe(1);
  expect(calls.find((c) => c.method === 'PUT')!.body).toEqual({ user_ids: ['u-2'] });
  await expect(page.locator(`${C} [data-bridge-key-owner="u-2"]`)).toBeVisible();
  await page.locator(`${C} [data-bridge-key-owner="u-2"] [data-bridge-key-owner-remove]`).click();
  await expect.poll(() => calls.filter((c) => c.method === 'PUT').length).toBe(2);
  expect(calls.filter((c) => c.method === 'PUT')[1].body).toEqual({ user_ids: [] });
});

test('the banner is on every Settings screen while the server says so, and absent otherwise', async ({ page }) => {
  await setup(page, status(), true);
  await page.goto('/?design=a#/system/setup');
  const banner = page.locator(BANNER);
  await expect(banner).toBeVisible({ timeout: 20_000 });
  await expect(banner.locator('a[href="#/system/notifications"]')).toBeVisible();
  await shot(page, 'banner-setup-he', BANNER);
  await page.goto('/?design=a#/system/diagnostics');
  await expect(banner).toBeVisible({ timeout: 20_000 });
  const p2 = await page.context().newPage();
  await setup(p2, status(), false);
  await p2.goto('/?design=a#/system/setup');
  await expect(p2.locator(`${C} [data-bridge-key]`)).toBeVisible({ timeout: 20_000 });
  await expect(p2.locator(BANNER)).toHaveCount(0);
});
