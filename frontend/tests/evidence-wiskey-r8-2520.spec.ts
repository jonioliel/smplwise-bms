import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN, installFrigate, newFrigateMock } from './frigate-mocks';
import { gotoApp } from './helpers/app-ready';

// WISKEY-R8-2520: the read-only "service approval from WisKey" block of the Bridge key card (Settings › Connections) against a MOCKED
// backend (synthetic answers only; no grant reference ever reaches the browser). Every state the server can answer, Hebrew (RTL) and
// English, light and dark, desktop and phone: the honest text of each state, the approved actions only when active, "cards not
// included", the pointer to WisKey's own tools screen, no action button, no sideways scroll. SW_SHOTS=1 writes the card shots for the
// before / after page (SW_SHOTS_DIR, default docs/design/evidence/wiskey-r8-2520); SW_R8_BEFORE=1 runs the "before" side (no block).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-wiskey-r8-2520.spec.ts --workers=2
const OUT = process.env.SW_SHOTS_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/wiskey-r8-2520');
const C = 'sw-app system-setup sw-bridge-key-card';
// a system administrator who may open the embedded panel (`access.read` at installation): the pointer to WisKey's tools screen is a link
const PERMS = [...ADMIN, 'access.read'];
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const KEY = { kid: 'g3-1a2b3c4d', generation: 3, state: 'current', created_at: '2026-10-20T08:00:00Z', activated_at: '2026-10-20T08:01:00Z', verify_until: null, ended_at: null, readable: true };
const ROT = { id: 'r-1', mode: 'routine', state: 'verified', kid_from: 'g2-0f0e0d0c', kid_to: 'g3-1a2b3c4d', gen_from: 2, gen_to: 3, started_at: '2026-10-20T08:00:00Z',
  switched_at: '2026-10-20T08:01:00Z', ended_at: '2026-10-20T08:02:30Z', result_code: null, anchor_eligible: false };
const STATUS = {
  enabled: true, go_live_permitted: true, peer_available: true, adopted: true, key: KEY, keys: [KEY], rotation: null, last: ROT, history: [ROT],
  reminder_days: 0, reminder_values: [0, 30, 90, 180, 365], reminder_due: false, can_start: true, blocked_by: null, automatic: 'idle',
};
const CMDS = ['users/create', 'users/pin_generate', 'users/temporary_cancel', 'users/update'];
function grant(state: string, over: Record<string, unknown> = {}) {
  return {
    state, reason: null, wiskey_code: null, revision: state === 'active' ? 3 : null, fetched_at: '2026-11-25T08:00:00Z',
    contract: 'wiskey-native-service-write.v3', commands: state === 'active' ? CMDS : [], cards_granted: false,
    owner_actions_in: 'wiskey_owner_screen', owner_screen_tab: 'tools', message_he: 'x', message_en: 'x', card_off_he: 'x', card_off_en: 'x', ...over,
  };
}

const STATES: [string, unknown, number][] = [
  ['active', grant('active'), 200],
  ['absent', grant('absent_or_revoked', { revision: 0 }), 200],
  ['refused', grant('refused', { reason: 'wiskey_refused', wiskey_code: 'Unauthorized' }), 200],
  ['unknown', grant('unknown', { reason: 'contract_mismatch' }), 200],
  ['unsupported', grant('unsupported', { reason: 'v3_needs_direct_v2' }), 200],
  ['unavailable', grant('unavailable', { reason: 'direct_not_installed' }), 200],
];

async function setup(page: Page, body: unknown, code = 200, perms: string[] = PERMS) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installFrigate(page, newFrigateMock({ perms }));
  const calls: { method: string; path: string }[] = [];
  await page.route('**/api/v1/system/bridge-key**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname;
    calls.push({ method: req.method(), path: p });
    if (p.endsWith('/service-grant')) {
      if (process.env.SW_R8_BEFORE) return json(route, { code: 'not_found', user_message: 'x', retryable: false, correlation_id: 'mock', details: {} }, 404);
      if (code !== 200) return json(route, { code: code === 403 ? 'not_system_admin' : 'internal', user_message: 'שגיאה', retryable: false, correlation_id: 'mock', details: {} }, code);
      return json(route, body);
    }
    if (p.endsWith('/notice')) return json(route, { show: false, open: 0, contacts_set: false });
    return json(route, STATUS);
  });
  return calls;
}

async function toEnglish(page: Page) {
  await page.evaluate(() => {
    document.documentElement.setAttribute('lang', 'en');
    document.documentElement.setAttribute('dir', 'ltr');
    (document.querySelector('sw-app')?.shadowRoot?.querySelector('system-setup')?.shadowRoot?.querySelector('sw-bridge-key-card') as (HTMLElement & { requestUpdate(): void }) | null)?.requestUpdate();
  });
  await page.locator('html[data-lang-words="en"]').waitFor({ state: 'attached', timeout: 0 });
}

async function shot(page: Page, name: string) {
  if (!process.env.SW_SHOTS) return;
  fs.mkdirSync(OUT, { recursive: true });
  const target = process.env.SW_R8_BEFORE ? page.locator(`${C} [data-bridge-key]`) : page.locator(`${C} [data-bridge-key-grant]`);
  await target.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  await page.locator(`${C} [data-bridge-key]`).screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}.png`) });
}

if (process.env.SW_R8_BEFORE) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`before: the bridge key card without the service approval block [${scheme}]`, async ({ page }) => {
      await setup(page, null);
      await gotoApp(page, `/?design=a&scheme=${scheme}#/system/setup`);
      await expect(page.locator(`${C} [data-bridge-key]`)).toBeVisible({ timeout: 20_000 });
      await shot(page, `before-he-${scheme}`);
    });
  }
} else {
  for (const scheme of ['light', 'dark'] as const) {
    for (const [name, body] of STATES) {
      test(`service approval block: ${name} [${scheme}]`, async ({ page }) => {
        const calls = await setup(page, body);
        await gotoApp(page, `/?design=a&scheme=${scheme}#/system/setup`);
        const block = page.locator(`${C} [data-bridge-key-grant]`);
        await expect(block).toBeVisible({ timeout: 20_000 });
        const state = (body as { state: string }).state;
        await expect(block).toHaveAttribute('data-bridge-key-grant', state);
        await expect(block).not.toContainText('undefined');
        await expect(block.locator('sw-button, button, input, select')).toHaveCount(0); // read only: no grant, preview, commit or revoke
        await expect(block.locator('[data-bridge-key-grant-open]')).toHaveAttribute('href', '#/wiskey/tools');
        await expect(block.locator('[data-bridge-key-grant-actions]')).toHaveCount(state === 'active' ? 1 : 0);
        await expect(block.locator('[data-bridge-key-grant-no-cards]')).toHaveCount(state === 'active' ? 1 : 0);
        await expect(block.locator('[data-bridge-key-grant-code]')).toHaveCount(state === 'refused' ? 1 : 0);
        if (state === 'active') await expect(block).toContainText('יצירה · עדכון · הפקת קוד · ביטול זמני');
        if (state === 'refused') await expect(block).toContainText('Unauthorized');
        expect(calls.filter((c) => c.path.endsWith('/service-grant')).map((c) => c.method)).toEqual(['GET']); // one read, never a write
        const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(over, 'no sideways page scroll').toBeLessThanOrEqual(1);
        await shot(page, `${name}-he-${scheme}`);
        await toEnglish(page);
        await expect(block).toContainText('Service approval from WisKey');
        if (state === 'active') await expect(block).toContainText('Cards are not included');
        await shot(page, `${name}-en-${scheme}`);
      });
    }
  }

  for (const code of [404, 403]) {
    test(`an older server or a refused caller (${code}): no block, the rest of the card unchanged`, async ({ page }) => {
      await setup(page, null, code);
      await gotoApp(page, '/?design=a#/system/setup');
      await expect(page.locator(`${C} [data-bridge-key]`)).toBeVisible({ timeout: 20_000 });
      await expect(page.locator(`${C} [data-bridge-key-kid]`)).toBeVisible();
      await expect(page.locator(`${C} [data-bridge-key-grant]`)).toHaveCount(0);
    });
  }

  test('a server error is said in the block as unknown, never as a grant', async ({ page }) => {
    await setup(page, null, 500);
    await gotoApp(page, '/?design=a#/system/setup');
    const block = page.locator(`${C} [data-bridge-key-grant]`);
    await expect(block).toBeVisible({ timeout: 20_000 });
    await expect(block).toHaveAttribute('data-bridge-key-grant', 'unknown');
    await expect(block.locator('[data-bridge-key-grant-actions]')).toHaveCount(0);
  });

  test('a caller who may not open the embedded panel reads the pointer without a link', async ({ page }) => {
    await setup(page, grant('active'), 200, ADMIN);
    await gotoApp(page, '/?design=a#/system/setup');
    const block = page.locator(`${C} [data-bridge-key-grant]`);
    await expect(block).toBeVisible({ timeout: 20_000 });
    await expect(block.locator('[data-bridge-key-grant-owner]')).toContainText('WisKey');
    await expect(block.locator('[data-bridge-key-grant-open]')).toHaveCount(0);
  });

  test('an answer this client does not know is unknown (never an assumed grant)', async ({ page }) => {
    await setup(page, grant('active', { commands: [] }));
    await gotoApp(page, '/?design=a#/system/setup');
    const block = page.locator(`${C} [data-bridge-key-grant]`);
    await expect(block).toBeVisible({ timeout: 20_000 });
    await expect(block).toHaveAttribute('data-bridge-key-grant', 'unknown');
  });
}
