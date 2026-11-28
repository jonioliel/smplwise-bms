import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// FIX-CORE-DATA-2570: הגדרות › בריאות ועבודות, the HA sync card of the health report shows the state feed counters (refused frames,
// full re-reads, the last periodic state reconcile) and the rule notification counters (queued, waiting, dropped by the bound,
// skipped as too old) - `meta.state_feed` / `meta.delivery` of the `ha_sync` check (additive). Hebrew and English; an older server
// that sends no counters shows the card as before. MOCKED backend (page.route on api/v1; every value is fake).
//   npx playwright test tests/ha-feed-counters-2570.spec.ts --project=desktop --project=mobile --workers=1
// SW_SHOTS_DIR=<dir> also saves a screenshot of the card (light + dark) for the before / after compare page.

const ADMIN = ['video.live', 'video.playback', 'map.read', 'events.read', 'devices.read', 'system.configure', 'rbac.assign'];
const AT = '2026-11-28T08:00:00Z';
const META = {
  connected: true, entities: 412, last_snapshot_at: AT, last_event_at: AT,
  delivery: { queued: 37, done: 30, skipped_old: 2, dropped_full: 1, waiting: 5, max_queue: 200, max_age_s: 120 },
  state_feed: {
    state_overflows: 7, state_resyncs: 1, dropped_frames: 3, worker: { depth: 0, max_depth: 40, refused: 7, done: 9000, failed: 0, max_wait_ms: 900 },
    last_reconcile: { read: 412, repaired: 3, older: 1, same: 405, live: 3, removed: 0, unknown_time: 0, failed: 0, ms: 140, reason: 'periodic', at: AT },
  },
};

async function boot(page: Page, o: { lang?: 'he' | 'en'; meta?: Record<string, unknown>; scheme?: 'light' | 'dark' } = {}) {
  if (o.lang === 'en') await page.addInitScript(() => {
    try {
      localStorage.setItem('sw.ui.lang', 'en');
    } catch {
      /* about:blank has no storage */
    }
  });
  await page.route('**/api/v1/**', async (route) => {
    const p = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p === 'me') return json({ channel: 'local', remote: null, user: { id: 'u-admin', username: 'u-admin', display_name: 'מנהל', source: 'ingress' }, active: true, bindings: [], permissions_installation: ADMIN, permissions_any: ADMIN, has_access: true, permission_revision: 1, bootstrap_state: 'done', mode: 'full' });
    if (p === 'me/prefs') return json({ prefs: o.lang === 'en' ? { 'ui.lang': 'en' } : {}, stored: o.lang === 'en' ? ['ui.lang'] : [], updated_at: null });
    if (p === 'settings') return json({ settings: { 'time.zone': 'Asia/Jerusalem' }, can_edit: true, nvr_channels: 16, warnings: [] });
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: AT, version: 'test' });
    if (p === 'health') return json({ status: 'ok', version: 'test', mode: 'full' });
    if (p.startsWith('health/report')) {
      return json({ status: 'ok', mode: 'full', version: 'test', uptime_s: 7200, checked_at: AT, probe_ttl_s: 20, checks: [
        { id: 'db', label: o.lang === 'en' ? 'Database' : 'מסד נתונים', status: 'ok', detail: o.lang === 'en' ? 'OK' : 'תקין', meta: {} },
        { id: 'ha_sync', label: o.lang === 'en' ? 'Infrastructure sync' : 'סנכרון תשתית', status: 'ok', detail: o.lang === 'en' ? 'Connected · 412 entities' : 'מחובר · 412 ישויות', meta: o.meta ?? META },
      ] });
    }
    if (p === 'recorder-health') return json({ recorders: [], interval_s: 60, can_manage: true });
    if (p === 'camera-image-health/settings') return json({ values: { enabled: false }, ranges: {}, cameras: [], source: 'camera.image' });
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    if (p === 'sites') return json({ sites: [], can_create_site: false });
    return json({ code: 'not_found', user_message: 'לא נמצא (בדיקה)', retryable: false, correlation_id: '', details: {} }, 404);
  });
  await page.goto('about:blank');
  await page.goto(`/?scheme=${o.scheme ?? 'light'}#/system/diagnostics?tab=health`);
}

const CARD = 'system-diagnostics [data-health-card="ha_sync"]';

async function shot(page: Page, name: string) {
  const dir = process.env.SW_SHOTS_DIR;
  if (!dir) return;
  fs.mkdirSync(dir, { recursive: true });
  await page.locator(CARD).screenshot({ path: path.join(dir, `${name}-${test.info().project.name}.png`) });
}

test.describe('HA sync card: state feed and rule notification counters (FIX-CORE-DATA-2570)', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  for (const scheme of ['light', 'dark'] as const) {
    test(`Hebrew: every counter is shown under the card (${scheme})`, async ({ page }) => {
      await boot(page, { scheme });
      const card = page.locator(CARD);
      await expect(card).toBeVisible({ timeout: 20_000 });
      await shot(page, `he-${scheme}`);
      await expect(card.locator('[data-ha-feed-state]')).toHaveText('עדכוני מצב: 7 לא נכנסו לתור · 1 קריאות מחדש מלאות · 3 לא הגיעו למסכים פתוחים');
      await expect(card.locator('[data-ha-feed-reconcile="done"]')).toContainText('3 תוקנו · 1 חדשים יותר נשמרו · 3 עודכנו בזמן אמת · 0 לא נכתבו');
      await expect(card.locator('[data-ha-feed-delivery]')).toHaveText('התראות של כללים: 37 נשלחו לתור · 5 ממתינות · 1 נזרקו כשהתור היה מלא · 2 דולגו כי התיישנו');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, 'no sideways page scroll').toBeLessThanOrEqual(0);
    });
  }

  test('English labels', async ({ page }) => {
    await boot(page, { lang: 'en' });
    const card = page.locator(CARD);
    await expect(card).toBeVisible({ timeout: 20_000 });
    await shot(page, 'en-light');
    await expect(card.locator('[data-ha-feed-state]')).toHaveText('State updates: 7 did not fit the queue · 1 full re-reads · 3 did not reach open screens');
    await expect(card.locator('[data-ha-feed-reconcile="done"]')).toContainText('412 read · 3 repaired · 1 newer kept · 3 updated live · 0 not written');
    await expect(card.locator('[data-ha-feed-delivery]')).toHaveText('Rule notifications: 37 queued · 5 waiting · 1 dropped (queue full) · 2 skipped (too old)');
  });

  test('no reconcile yet, a skipped one, and an older server without counters', async ({ page }) => {
    await boot(page, { meta: { ...META, state_feed: { ...META.state_feed, last_reconcile: null } } });
    await expect(page.locator(`${CARD} [data-ha-feed-reconcile="none"]`)).toHaveText('השוואת מצבים תקופתית: עוד לא רצה', { timeout: 20_000 });
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await boot(page, { meta: { ...META, state_feed: { ...META.state_feed, last_reconcile: { skipped: 'busy', reason: 'periodic', at: AT } } } });
    await expect(page.locator(`${CARD} [data-ha-feed-reconcile="skipped"]`)).toContainText('דולגה', { timeout: 20_000 });
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await boot(page, { meta: { connected: true, entities: 412 } });
    await expect(page.locator(CARD)).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(`${CARD} [data-ha-feed-counters]`)).toHaveCount(0);
  });
});
