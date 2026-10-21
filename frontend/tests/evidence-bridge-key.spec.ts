import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN, installFrigate, newFrigateMock } from './frigate-mocks';

// CR-WISKEY-HMAC-ROTATION-295: the "Bridge key" card in Settings › Connections against a MOCKED backend (fake data, synthetic key ids
// only, never key material): ready / off (switch disabled without the go-live permit) / rotating / needs attention / reminder due /
// error, Hebrew (RTL) and English, hidden on 403. SW_SHOTS=1 writes screenshots to docs/design/evidence/hmacrot-295.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-bridge-key.spec.ts --workers=1
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/hmacrot-295');
const C = 'sw-app system-setup sw-bridge-key-card';

async function shot(page: Page, name: string) {
  if (!process.env.SW_SHOTS) return;
  fs.mkdirSync(OUT, { recursive: true });
  await page.locator(`${C} [data-bridge-key]`).screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}.png`) });
}
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const KEY = { kid: 'g3-1a2b3c4d', generation: 3, state: 'current', created_at: '2026-10-20T08:00:00Z', activated_at: '2026-10-20T08:01:00Z', verify_until: null, ended_at: null, readable: true };
const ROT = (state: string, over: Record<string, unknown> = {}) => ({
  id: 'r-1', mode: 'routine', state, kid_from: 'g2-0f0e0d0c', kid_to: 'g3-1a2b3c4d', gen_from: 2, gen_to: 3, started_at: '2026-10-20T08:00:00Z',
  switched_at: '2026-10-20T08:01:00Z', ended_at: state === 'switched' ? null : '2026-10-20T08:02:30Z', result_code: null, anchor_eligible: false, ...over,
});
function status(over: Record<string, unknown> = {}) {
  return {
    enabled: true, go_live_permitted: true, peer_available: true, adopted: true, key: KEY, keys: [KEY], rotation: null, last: ROT('verified'),
    history: [ROT('verified')], reminder_days: 0, reminder_values: [0, 30, 90, 180, 365], reminder_due: false, can_start: true, blocked_by: null, ...over,
  };
}

async function setup(page: Page, body: unknown, code = 200) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installFrigate(page, newFrigateMock({ perms: ADMIN }));
  const calls: { method: string; path: string; body: unknown }[] = [];
  await page.route('**/api/v1/system/bridge-key**', async (route) => {
    const req = route.request();
    calls.push({ method: req.method(), path: new URL(req.url()).pathname, body: req.method() === 'GET' ? null : req.postDataJSON() });
    if (code !== 200) return json(route, { code: code === 403 ? 'not_system_admin' : 'internal', user_message: 'שגיאה', retryable: false, correlation_id: 'mock', details: {} }, code);
    if (req.method() === 'POST') return json(route, { rotation: ROT('switched') });
    return json(route, body);
  });
  return calls;
}

const SCREENS: [string, unknown][] = [
  ['ready', status()],
  ['off-not-permitted', status({ enabled: false, go_live_permitted: false, can_start: false, blocked_by: 'rotation_off', last: null, history: [], key: null, keys: [], adopted: false })],
  ['rotating', status({ rotation: { ...ROT('switched'), retire_at: '2026-10-20T08:02:30Z' }, can_start: false, blocked_by: 'rotation_in_progress' })],
  ['needs-repair', status({ last: ROT('needs_repair', { result_code: 'commit_outcome_unknown' }), can_start: false, blocked_by: 'repair_required' })],
  ['reminder-due', status({ reminder_days: 90, reminder_due: true })],
];

for (const [name, body] of SCREENS) {
  test(`bridge key card: ${name}`, async ({ page }) => {
    await setup(page, body);
    await page.goto('/?design=a#/system/setup');
    const card = page.locator(`${C} [data-bridge-key]`);
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card).not.toContainText('undefined');
    await shot(page, `${name}-he`);
    await page.evaluate(() => {
      document.documentElement.setAttribute('lang', 'en');
      document.documentElement.setAttribute('dir', 'ltr');
      (document.querySelector('sw-app')?.shadowRoot?.querySelector('system-setup')?.shadowRoot?.querySelector('sw-bridge-key-card') as (HTMLElement & { requestUpdate(): void }) | null)?.requestUpdate();
    });
    await expect(card).toContainText('Bridge key');
    await shot(page, `${name}-en`);
  });
}

test('the switch is disabled without the permit; rotate asks once and sends confirm', async ({ page }) => {
  const calls = await setup(page, status());
  await page.goto('/?design=a#/system/setup');
  await expect(page.locator(`${C} [data-bridge-key]`)).toBeVisible({ timeout: 20_000 });
  await page.locator(`${C} [data-bridge-key-rotate]`).click();
  await expect(page.locator(`${C} [data-bridge-key-confirm="routine"]`)).toBeVisible();
  await shot(page, 'confirm-he');
  await page.locator(`${C} [data-bridge-key-confirm-yes]`).click();
  await expect.poll(() => calls.filter((c) => c.method === 'POST').length).toBe(1);
  expect(calls.find((c) => c.method === 'POST')!.body).toEqual({ mode: 'routine', confirm: true });

  const p2 = await page.context().newPage();
  await setup(p2, status({ enabled: false, go_live_permitted: false, can_start: false, blocked_by: 'rotation_off' }));
  await p2.goto('/?design=a#/system/setup');
  await expect(p2.locator(`${C} [data-bridge-key-switch]`)).toHaveAttribute('disabled', '');
  await expect(p2.locator(`${C} [data-bridge-key-rotate]`)).toHaveAttribute('disabled', '');
});

test('hidden on 403; an error is shown otherwise', async ({ page }) => {
  await setup(page, null, 403);
  await page.goto('/?design=a#/system/setup');
  await expect(page.locator('sw-app system-setup sw-secrets-card')).toBeAttached({ timeout: 20_000 });
  await expect(page.locator(`${C} [data-bridge-key]`)).toHaveCount(0);
  const p2 = await page.context().newPage();
  await setup(p2, null, 500);
  await p2.goto('/?design=a#/system/setup');
  await expect(p2.locator(`${C} p.err`)).toBeVisible({ timeout: 20_000 });
});
