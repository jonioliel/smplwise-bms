import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN, installFrigate, newFrigateMock } from './frigate-mocks';
import { LONG_HE, UNBREAK, digest, measure } from './breakui-worst';

// BREAKUI-295: the "Bridge key" card (Settings > Connections) against WORST-CASE status: a key id of 90 unbreakable characters, a generation
// of 10^11, a result code and a block reason that nothing knows, 50 history rows, a failing read with a long message, off and not permitted.
// Synthetic key ids only, never key material. SW_SHOTS=1 -> docs/design/evidence/BREAKUI-295.
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/BREAKUI-295');
const C = 'sw-app system-setup sw-bridge-key-card';
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const KID = 'g9-' + UNBREAK;
const KEY = { kid: KID, generation: 99999999999, state: 'current', created_at: '2026-10-20T08:00:00Z', activated_at: '2026-10-20T08:01:00Z', verify_until: null, ended_at: null, readable: true };
const ROT = (state: string, over: Record<string, unknown> = {}) => ({
  id: 'r-1', mode: 'routine', state, kid_from: 'g8-' + UNBREAK, kid_to: KID, gen_from: 99999999998, gen_to: 99999999999, started_at: '2026-10-20T08:00:00Z',
  switched_at: '2026-10-20T08:01:00Z', ended_at: state === 'switched' ? null : '2026-10-20T08:02:30Z', result_code: null, anchor_eligible: false, ...over,
});
const status = (over: Record<string, unknown> = {}) => ({
  enabled: true, go_live_permitted: true, peer_available: true, adopted: true, key: KEY, keys: [KEY], rotation: null, last: ROT('verified'),
  history: Array.from({ length: 50 }, (_, i) => ROT(i % 3 ? 'verified' : 'needs_repair', { id: `r-${i}`, result_code: 'code_' + UNBREAK })), reminder_days: 365, reminder_values: [0, 30, 90, 180, 365], reminder_due: true,
  can_start: true, blocked_by: null, ...over,
});
const CASES: [string, unknown, number?][] = [
  ['worst-ready', status()],
  ['worst-repair', status({ last: ROT('needs_repair', { result_code: 'commit_outcome_unknown_' + UNBREAK }), can_start: false, blocked_by: 'repair_required_' + UNBREAK })],
  ['worst-rotating', status({ rotation: { ...ROT('switched'), retire_at: '2026-10-20T08:02:30Z' }, can_start: false, blocked_by: 'rotation_in_progress' })],
  ['off-not-permitted', status({ enabled: false, go_live_permitted: false, can_start: false, blocked_by: 'rotation_off', last: null, history: [], key: null, keys: [], adopted: false, reminder_due: false })],
  ['error-500', null, 500],
];

async function shot(page: Page, name: string) {
  if (!process.env.SW_SHOTS) return;
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}.png`) });
}

for (const scheme of ['light', 'dark'] as const) {
  for (const [name, body, code] of CASES) {
    test(`bridge key worst case [${name}, ${scheme}]`, async ({ page }) => {
      const w = test.info().project.name === 'mobile' ? 400 : 1440;
      await page.setViewportSize({ width: w, height: w === 400 ? 844 : 900 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await installFrigate(page, newFrigateMock({ perms: ADMIN }));
      await page.route('**/api/v1/system/bridge-key**', (route) => {
        if (code) return json(route, { code: 'internal', user_message: LONG_HE + ' ' + UNBREAK, retryable: false, correlation_id: 'mock', details: {} }, code);
        return route.request().method() === 'POST' ? json(route, { rotation: ROT('switched') }) : json(route, body);
      });
      await page.goto(`/?design=a&scheme=${scheme}#/system/setup`);
      const card = page.locator(code ? `${C} sw-card, ${C} p.err` : `${C} [data-bridge-key]`).first();
      await expect(card).toBeVisible({ timeout: 20_000 });
      await card.scrollIntoViewIfNeeded();
      const run = async (label: string) => {
        const r = await measure(page, label, 'sw-bridge-key-card');
        const text = digest(label, r);
        console.log(text);
        expect(r.scroll, `${label} horizontal page scroll`).toBeLessThanOrEqual(1);
        expect(r.found, text).toEqual([]);
        if (w <= 480) expect(r.targets, text).toEqual([]);
      };
      await run(`${name} ${scheme}`);
      await shot(page, `bk-${name}-${scheme}`);
      if (!code && (await page.locator(`${C} [data-bridge-key-rotate]:not([disabled])`).count())) {
        await page.locator(`${C} [data-bridge-key-rotate]`).click();
        await expect(page.locator(`${C} [data-bridge-key-confirm]`)).toBeVisible();
        await run(`${name}-confirm ${scheme}`);
        await shot(page, `bk-${name}-confirm-${scheme}`);
      }
    });
  }
}
