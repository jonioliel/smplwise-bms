import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installAccessMock, NOW, url } from './access-control-mocks';
import { XNOW } from './access-external-mocks';
import { installRequestMock } from './access-request-mocks';
import { installMessagingSettings } from './wiskey-messaging-settings';
import { PERMS, installCastMock } from './cast-mocks';
import { settlePage } from './pixel-settle';

// POLISH4-WP8-SETMOD-2370: the settings screens of work package 8 (external access, the access-control segments, public transport, voice
// announcements, notifications) at the widths of each project, with the page's overflow measured in every capture: how far the shell's
// main area scrolls (mainScroll), the document (docScroll) and any sideways scroll. Mocked backend only (invented sample data).
// SW_SHOT_PHASE=before records only (the same captures on the unchanged base); the default phase "after" also asserts the package's rules:
//   - external access (owner Q9a): from 1024 px up the page does not scroll, the grants list scrolls inside its card;
//   - every captured screen: no sideways scroll at any width (390 included);
//   - the access-control card subtitles carry no integration call names (D16), the device registration names no platform (D6);
//   - on a phone the long settings pages keep their save row in view (owner Q7: position sticky).
//   SW_SHOT_PHASE=after SW_BASE_URL=http://127.0.0.1:4203/ npx playwright test tests/evidence-polish4-wp8.spec.ts --workers=1
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PHASE = process.env.SW_SHOT_PHASE || 'before';
const AFTER = PHASE !== 'before';
const OUT = path.resolve(HERE, '..', '..', 'docs', 'evidence', 'POLISH4-WP8-SETMOD-2370', PHASE);

const VIEWS: Record<string, { name: string; width: number; height: number }[]> = {
  desktop: [{ name: '1440', width: 1440, height: 900 }, { name: '1920', width: 1920, height: 1080 }],
  tablet: [{ name: '1180', width: 1180, height: 820 }, { name: '1024', width: 1024, height: 768 }],
  mobile: [{ name: '390', width: 390, height: 844 }],
};
const views = () => VIEWS[test.info().project.name] ?? VIEWS.desktop;
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

type Metrics = { mainScroll: number; docScroll: number; sideways: number };

async function metrics(page: Page): Promise<Metrics> {
  return page.evaluate(() => {
    const main = document.querySelector('sw-app')?.shadowRoot?.querySelector('main') as HTMLElement | null;
    return {
      mainScroll: main ? main.scrollHeight - main.clientHeight : 0,
      docScroll: document.documentElement.scrollHeight - innerHeight,
      sideways: Math.max(document.documentElement.scrollWidth - innerWidth, main ? main.scrollWidth - main.clientWidth : 0),
    };
  });
}

function record(name: string, m: Record<string, unknown>) {
  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, `metrics-${test.info().project.name}.json`);
  const all = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>) : {};
  all[name] = m;
  fs.writeFileSync(file, `${JSON.stringify(all, null, 1)}\n`);
  console.log(`WP8_METRICS ${PHASE} ${test.info().project.name} ${name} ${JSON.stringify(m)}`);
}

/** Each named view: resize, settle, shoot, measure; returns the metrics per view. */
async function atViews(page: Page, name: string, extra?: (page: Page) => Promise<Record<string, unknown>>) {
  const out: Array<{ view: string; width: number; m: Metrics }> = [];
  for (const v of views()) {
    await page.setViewportSize({ width: v.width, height: v.height });
    fs.mkdirSync(OUT, { recursive: true });
    await settlePage(page, { timeout: 8000 }).catch(() => undefined);
    await page.screenshot({ path: path.join(OUT, `${name}-${v.name}.png`) });
    const m = await metrics(page);
    record(`${name}-${v.name}`, { ...m, ...(extra ? await extra(page) : {}) });
    out.push({ view: v.name, width: v.width, m });
  }
  return out;
}

test.describe('settings, package 8 (POLISH4-WP8)', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.setTimeout(240_000);

  test('external access: the page does not scroll from 1024 px up, the grants list scrolls in its card', async ({ page }) => {
    await installRequestMock(page, {});
    await page.clock.setFixedTime(XNOW);
    await page.goto('about:blank');
    await page.goto(url('/wiskey/external'));
    const host = page.locator('sw-app access-external-screen');
    await expect(host.locator('.kpis').first()).toBeVisible({ timeout: 30_000 });
    const list = async (p: Page) =>
      p.evaluate(() => {
        const h = document.querySelector('sw-app')?.shadowRoot?.querySelector('access-external-screen') as HTMLElement | null;
        const body = h?.shadowRoot?.querySelector('.tcard.grants > .gl-body') as HTMLElement | null;
        const side = h?.shadowRoot?.querySelector('.side') as HTMLElement | null;
        return {
          rows: h?.shadowRoot?.querySelectorAll('.gl-r').length ?? 0,
          listOverflowY: body ? getComputedStyle(body).overflowY : '',
          listScroll: body ? body.scrollHeight - body.clientHeight : -1,
          sideScroll: side ? side.scrollHeight - side.clientHeight : -1,
          headShown: !!h?.shadowRoot?.querySelector('.gl-h') && getComputedStyle(h!.shadowRoot!.querySelector('.gl-h')!).display !== 'none',
        };
      });
    const res = await atViews(page, 'external', list);
    for (const r of res) {
      expect(r.m.sideways, `sideways scroll at ${r.view}`).toBeLessThanOrEqual(1);
      if (AFTER && r.width >= 1024) expect(r.m.mainScroll, `page scroll at ${r.view}`).toBeLessThanOrEqual(1);
    }
    if (AFTER && views()[0].width >= 1024) {
      // the list region scrolls inside its card (auto), and the page above it stays put
      const l = await list(page);
      expect(l.listOverflowY).toBe('auto');
    }
    // a narrow window keeps the page scroll (a phone is not trapped in a small inner list)
    if (AFTER && views()[0].width < 768) {
      const l = await list(page);
      expect(l.listOverflowY).not.toBe('auto');
    }
  });

  test('access control segments: no sideways scroll, no integration call names in the card subtitles', async ({ page }) => {
    const PANEL = 'sw-app system-access-control';
    for (const [hash, name, ready] of [
      ['/system/access-control', 'ac-status', `${PANEL} system-access-status [data-access-status="ready"]`],
      ['/system/access-control/audit', 'ac-audit', `${PANEL} system-access-audit [data-access-audit-table]`],
      ['/system/access-control/groups', 'ac-groups', `${PANEL} system-access-groups [data-access-card]`],
      ['/system/access-control/policy', 'ac-policy', `${PANEL} system-access-policy`],
    ] as const) {
      await installAccessMock(page, { persona: 'admin' });
      await page.clock.setFixedTime(NOW);
      await page.goto('about:blank');
      await page.goto(url(hash));
      await expect(page.locator(ready).first()).toBeVisible({ timeout: 30_000 });
      const res = await atViews(page, name);
      for (const r of res) expect(r.m.sideways, `${name} sideways at ${r.view}`).toBeLessThanOrEqual(1);
      if (AFTER) {
        const subs = await page.locator(`${PANEL} .ch .sub`).allTextContents();
        for (const t of subs) expect(t, `${name} subtitle`).not.toMatch(/[a-z_]+\/[a-z_]+/);
      }
    }
    await installMessagingSettings(page, { persona: 'admin' });
    await page.clock.setFixedTime(NOW);
    await page.goto('about:blank');
    await page.goto(url('/system/access-control/messaging'));
    await expect(page.locator(`${PANEL} system-access-messaging [data-access-status="ready"]`)).toBeVisible({ timeout: 30_000 });
    const sticky = async (p: Page) => ({ actionsPosition: await p.locator(`${PANEL} system-access-messaging [data-msg-actions]`).evaluate((e) => getComputedStyle(e).position) });
    const res = await atViews(page, 'ac-messaging', sticky);
    for (const r of res) expect(r.m.sideways, `messaging sideways at ${r.view}`).toBeLessThanOrEqual(1);
    if (AFTER) expect((await sticky(page)).actionsPosition).toBe(views()[0].width < 768 ? 'sticky' : 'static');
  });

  test('public transport settings: no sideways scroll; a stop keeps its name field wide on a phone', async ({ page }) => {
    await installAccessMock(page, { persona: 'admin' });
    const range = (a: number, b: number): [number, number] => [a, b];
    const SETTINGS = {
      config: {
        enabled: true, clock_after_min: 15, stale_grace_min: 10, hide_closer_min: 2, poll_s: 60, poll_floor_ack: false, refresh_s: 30, position_fresh_min: 5, show_distance: true, outage_warn_h: 6,
        stops: [
          { code: 21345, name: 'הכניסה הראשית', catalogue_name: 'שדרות הדוגמה/הגפן', city: 'עיר לדוגמה' },
          { code: 21346, name: '', catalogue_name: 'רחוב הניסוי 12', city: 'עיר לדוגמה' },
          { code: 9001, name: 'צד מערבי', catalogue_name: 'מסוף לדוגמה', city: 'עיר אחרת' },
        ],
      },
      catalogue: { count: 28114, date: '2026-10-30', ok_at: '2026-10-31T02:10:00Z', error: null, error_at: null },
      health: { enabled: true, state: 'stale', codes_in_use: 3, age_s: 840, last_ok_at: '2026-10-31T08:40:00Z', errors: 4, consecutive_errors: 2, last_error: 'upstream_timeout: the public source did not answer within 8 s', last_error_at: '2026-10-31T08:52:00Z', backoff_until: null },
      limits: {
        max_stops: 4, windows: [30, 60], window_range: range(10, 120), rows_range: range(1, 8), dwell_range: range(5, 60), clock_after_range: range(0, 60), grace_range: range(0, 60), outage_warn_range: range(1, 72),
        walk_range: range(0, 15), poll_range: range(15, 300), poll_floor_s: 30, refresh_range: range(10, 120), position_fresh_range: range(1, 30), layouts: ['side', 'strip'], groups: ['line', 'stop'],
      },
      can: { configure: true, boards: true },
    };
    await page.route((u) => /\/api\/v1\/transit(\/|$)/.test(u.pathname), (route) => {
      const p = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1\/transit\/?/, '');
      if (p === 'settings') return json(route, SETTINGS);
      if (p.startsWith('cities')) return json(route, { cities: ['עיר לדוגמה', 'עיר אחרת'] });
      if (p.startsWith('stops')) return json(route, { stops: [], catalogue: SETTINGS.catalogue });
      if (p === 'check' && route.request().method() === 'POST') {
        return json(route, { check: { codes: 3, fetched: 3, ok: true, error: null, skipped: null, retry_after_s: null, at: '2026-10-31T09:00:00Z' },
          health: { ...SETTINGS.health, state: 'off', codes_in_use: 0, consecutive_errors: 0, last_ok_at: '2026-10-31T09:00:00Z', backoff_until: null } });
      }
      return json(route, {});
    });
    await page.clock.setFixedTime(NOW);
    await page.goto('about:blank');
    await page.goto(url('/system/transit'));
    const host = page.locator('sw-app system-transit');
    await expect(host.locator('[data-transit-stops]')).toBeVisible({ timeout: 30_000 });
    const nameField = async (p: Page) => ({ nameWidth: Math.round((await p.locator('sw-app system-transit [data-stop="21345"] .inp').boundingBox())?.width ?? 0) });
    const res = await atViews(page, 'transit', nameField);
    for (const r of res) expect(r.m.sideways, `transit sideways at ${r.view}`).toBeLessThanOrEqual(1);
    if (AFTER) {
      expect((await nameField(page)).nameWidth).toBeGreaterThanOrEqual(160);
      // the owner-approved "check now" (POST /transit/check): the answer line, and the idle note once no screen uses the stops
      await host.locator('[data-transit-check]').click();
      await expect(host.locator('[data-transit-check-result="ok"]')).toBeVisible();
      await expect(host.locator('[data-transit-idle]')).toBeVisible();
      await expect(host.locator('[data-transit-last-error]')).toContainText('לפני');
    }
  });

  test('voice announcements tab: no sideways scroll', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await installCastMock(page, { perms: [...PERMS.admin, 'media.announce'] });
    const config = {
      enabled: true, engine: 'tts.demo_engine', engine_kind: 'local', cloud_enabled: false, cloud_key_set: false, emergency_languages: ['he', 'en', 'ru'], language: 'he', devices: ['sp-1'], max_per_minute: 6, max_text: 200,
      cooldown_s: 5, volume: 60, pause_music: true,
      quiet: { enabled: true, from: '22:00', to: '07:00', days: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'], mode: 'lower', night_volume: 20 },
      notify: { enabled: true, scope: 'area', ref: 'living', categories: ['alarm'], min_severity: 'alert' },
    };
    const answer = {
      config, engines: ['tts.demo_engine'], templates: [{ id: 'evac', kind: 'emergency', name: { he: 'פינוי', en: 'Evacuation' }, text: { he: 'נא לצאת מהבניין בשקט ובסדר', en: 'Please leave the building calmly' } }],
      speakers: [
        { key: 'sp-1', name: 'רמקול לובי', kind: 'speaker', floor_name: 'קומת קרקע', area_id: 'living', area_name: 'לובי', allowed: true },
        { key: 'sp-2', name: 'רמקול חדר ישיבות עם שם ארוך במיוחד', kind: 'speaker', floor_name: 'קומה 2', area_id: 'meet', area_name: 'חדר ישיבות', allowed: false },
      ],
      history: [
        { id: 'h1', at: '2026-10-31T09:00:00Z', source: 'manual', username: 'demo', rule_id: null, scope: 'area', scope_ref: 'living', targets: 1, message: 'בדיקת מערכת הכריזה של הבניין, נא להתעלם מההודעה הזאת', status: 'sent', error: null },
        { id: 'h2', at: '2026-10-31T08:00:00Z', source: 'test', username: 'demo', rule_id: null, scope: 'device', scope_ref: 'sp-1', targets: 1, message: 'x', status: 'failed', error: 'timeout' },
      ],
    };
    await page.route(/\/api\/v1\/announcements(\/|\?|$)/, (route) => {
      const p = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1\/announcements\/?/, '');
      if (p === 'config') return json(route, answer);
      if (p === 'areas') return json(route, { enabled: true, max_text: 200, areas: [{ area_id: 'living', name: 'לובי', floor_name: 'קומת קרקע', devices: [{ key: 'sp-1', name: 'רמקול לובי' }] }] });
      return json(route, {});
    });
    await page.goto('about:blank');
    await page.goto('/?design=a#/system/multimedia?tab=announce');
    const tab = page.locator('sw-app system-multimedia system-announcements');
    await expect(tab.locator('[data-announce]')).toBeVisible({ timeout: 30_000 });
    const res = await atViews(page, 'announce');
    for (const r of res) expect(r.m.sideways, `announce sideways at ${r.view}`).toBeLessThanOrEqual(1);
  });

  test('notifications (in-memory demo): no sideways scroll; the device registration names no platform', async ({ page }) => {
    await page.goto('about:blank');
    await page.goto('/?design=a#/system/notifications');
    await expect(page.locator('sw-app system-notifications').first()).toBeVisible({ timeout: 30_000 });
    const res2 = await atViews(page, 'notifications');
    for (const r of res2) expect(r.m.sideways, `notifications sideways at ${r.view}`).toBeLessThanOrEqual(1);
    await page.goto('about:blank');
    await page.goto('/?design=a#/system/notifications?section=chan');
    const reg = page.locator('sw-app arx-notifications-settings [data-push-settings]').first();
    if (await reg.count()) {
      await expect(reg).toBeVisible({ timeout: 30_000 });
      if (AFTER) await expect(reg).not.toContainText(/Home Assistant|\bHA\b/);
    }
  });
});
