import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { baseView, installMessagingMock, waUrl } from './messaging-mocks';
import { AR, BIDI, EMAIL, EMOJI, LONG_HE, MIXED, ONE, RU, UNBREAK, UNBREAK_HE, digest, measure } from './breakui-worst';

// BREAKUI-295: Settings > messaging channel with its WhatsApp pacing card against WORST-CASE data: 12 accounts with very long / unbreakable /
// one-letter / Arabic / Russian / mixed / emoji / bidi labels, department names of the same kinds, counters at 10^11, a wait of 30 years, a backoff,
// a budget that is off, a reader without the manage permission, and a pacing read that fails. Mocked backend (tests/messaging-mocks.ts); fake data only.
// SW_SHOTS=1 -> docs/design/evidence/BREAKUI-295.
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/BREAKUI-295');
const S = 'sw-app system-messaging-accounts';
const NAMES = [LONG_HE, UNBREAK, UNBREAK_HE, EMAIL, MIXED, AR, RU, ONE, EMOJI, BIDI];

type Mode = 'worst' | 'off-reader' | 'pacing-error' | 'no-accounts';

async function boot(page: Page, mode: Mode, scheme: 'light' | 'dark') {
  const persona = mode === 'off-reader' ? 'configure' : 'admin';
  await installMessagingMock(page, { persona, empty: mode === 'no-accounts' });
  const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route('**/api/v1/messaging/whatsapp', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const v: any = baseView({ persona }, persona === 'admin'); // eslint-disable-line @typescript-eslint/no-explicit-any
    if (mode === 'worst') {
      const base = v.accounts[0];
      v.accounts = Array.from({ length: 12 }, (_, i) => ({ ...base, key: `entry:01JW${i}`, label: NAMES[i % NAMES.length] + (i > 9 ? ` ${i}` : ''), uses: i < 2 ? ['tickets.messages'] : [], state: i % 3 ? 'connected' : 'disconnected', sends_24h: 99999999999 }));
      v.uses[0].value = v.accounts[0].key;
      v.uses[0].resolved = v.accounts[0].key;
      v.uses[0].departments = NAMES.map((n, i) => ({ id: `d${i}`, name: n, value: null, resolved: v.accounts[i % 12].key }));
      v.mapping = { 'tickets.messages': v.accounts[0].key };
      v.warnings = [];
    }
    return route.fulfill(json(v));
  });
  await page.route('**/api/v1/messaging/whatsapp/pacing', async (route) => {
    if (mode === 'pacing-error') return route.fulfill(json({ code: 'internal', user_message: UNBREAK + ' ' + LONG_HE, retryable: false, correlation_id: 'x', details: {} }, 500));
    if (route.request().method() !== 'GET') return route.fulfill(json({}, 200));
    const accounts = Array.from({ length: mode === 'no-accounts' ? 0 : 12 }, (_, i) => ({
      account_key: i % 4 === 3 ? `entry:${UNBREAK}${i}` : `entry:01JW${i}`, wiskey: { mapped: true, verified: true, unknown: i % 2 === 0, charged: null, throttled_until: null, leases_active: 0 },
      sends_1h: 99999999999, sends_24h: 99999999999, wiskey_1h: 88888888888, wiskey_24h: 1, waiting: 77777777777, waiting_by_class: {}, oldest_wait_s: i % 3 === 0 ? 946_080_000 : i % 3 === 1 ? null : 0,
      counters_24h: { sent: 1, deferred: 66666666666, backoff: 55555555555, pair_backoff: 44444444444, expired: 33333333333 }, backoff: i % 2 ? { level: 9, until: '2026-11-02T07:10:00Z' } : null, pairs_in_backoff: 22222222222,
    }));
    return route.fulfill(json({
      mode: 'conservative', wiskey_shared: true, max_wait_min: { alert: 99999999, code: 0, ticket: 360, reminder: 720 }, budget: mode === 'worst' ? { per_minute: 99999999, burst: 88888888, burst_window_s: 10 } : null,
      per_minute: null, burst: null, shared_budget_guaranteed: false, share_pct: { alert: 100, code: 95, ticket: 80, reminder: 60 }, accounts, can_manage: persona === 'admin', applies: mode !== 'off-reader',
    }));
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('about:blank');
  await page.goto(waUrl('/system/messaging-accounts', 'classic', scheme));
  await page.waitForSelector(`${S} [data-messaging-accounts][data-state="ready"]`, { timeout: 30_000 });
  await page.waitForSelector(`${S} messaging-pacing-card [data-card="pacing"]`, { timeout: 30_000 });
  return errors;
}
async function shot(page: Page, name: string) {
  if (!process.env.SW_SHOTS) return;
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}.png`) });
}
async function check(page: Page, label: string) {
  const r = await measure(page, label, S);
  const text = digest(label, r);
  console.log(text);
  expect(r.scroll, `${label} horizontal page scroll`).toBeLessThanOrEqual(1);
  expect(r.found, text).toEqual([]);
  if ((page.viewportSize()?.width ?? 1440) <= 480) expect(r.targets, text).toEqual([]);
}

for (const scheme of ['light', 'dark'] as const) {
  for (const mode of ['worst', 'off-reader', 'pacing-error', 'no-accounts'] as const) {
    test(`messaging pacing worst case [${mode}, ${scheme}]`, async ({ page }) => {
      const w = test.info().project.name === 'mobile' ? 400 : 1440;
      await page.setViewportSize({ width: w, height: w === 400 ? 844 : 900 });
      const errors = await boot(page, mode, scheme);
      await check(page, `screen ${mode} ${scheme}`);
      await shot(page, `wa-${mode}-${scheme}`);
      await page.locator(`${S} messaging-pacing-card`).scrollIntoViewIfNeeded();
      await shot(page, `wa-pacing-${mode}-${scheme}`);
      if (mode === 'worst') {
        await page.locator(`${S} [data-pacing-toggle]`).click().catch(() => undefined);
        await check(page, `screen-pacing-open ${scheme}`);
      }
      expect(errors).toEqual([]);
    });
  }
}
