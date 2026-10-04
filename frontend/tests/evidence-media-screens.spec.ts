import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApiError } from '../src/api/client';
import { resetMediaMock, type MediaMockStore } from '../src/api/media-screens-mock';
import { mediaAdmin, resetMediaAdminDemo } from '../src/api/media-admin';
import type { MediaDevice } from '../src/api/media-screens';

// CR-015 S2: the multimedia screens page ("מולטימדיה › מסכים"), its card, the layout editor (installation layout and the
// personal override), the floor "כבה מסכים" confirmation and the settings page "הגדרות › מולטימדיה". Static preview + a MOCKED
// backend (page.route on api/v1, like evidence-tabs-ui.spec.ts): the routes are answered by the S0 client's own MOCK store
// (src/api/media-screens-mock.ts, the eight mockup screens), so the shapes are the contract's; what is checked is what the client
// does with the permissions and answers it is given and what it sends. The server's rules are S1's tests, the real round trip is
// S4's live spec. The remote (`<media-remote>`) is S3's: a stub element stands in for it here, only to prove the wiring
// (`.deviceKey`, `.open`, `@close`, the address). Screenshots: docs/design/evidence/CR-015/s2/ at 1440, 820 and 390.
//   SW_BASE_URL=http://127.0.0.1:4361/ npx playwright test tests/evidence-media-screens.spec.ts --project=desktop --workers=1

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/CR-015/s2');
const SIZES = { '1440': { width: 1440, height: 900 }, '820': { width: 820, height: 1180 }, '390': { width: 390, height: 844 } } as const;
type Size = keyof typeof SIZES;

const BASE = ['devices.read', 'map.read', 'entity.state.read', 'events.read', 'video.live'];
const VIEW_ONLY = [...BASE, 'media.read'];
const OPERATOR = [...VIEW_ONLY, 'media.control', 'media.power'];
const EDITOR = [...OPERATOR, 'media.layout'];
const PERSONAL = [...OPERATOR, 'screen.personalize'];
const ADMIN = [...OPERATOR, 'access.read', 'media.public', 'media.bulk', 'media.layout', 'screen.personalize', 'system.configure', 'sources.configure', 'audit.read'];

interface Call { method: string; path: string; body: unknown }
interface St {
  perms: string[];
  store: MediaMockStore;
  personal: unknown;
  scheme: 'light' | 'dark';
  enabled: boolean;
  emptyList: boolean;
  failList: boolean;
  listDelay: number;
  calls: Call[];
  admin: ReturnType<typeof mediaAdmin>;
  /** what GET ha/actions/<id> says of an accepted command: the screen confirmed it, or did not */
  actionStatus: 'confirmed' | 'unknown';
}

const fresh = (perms: string[]): St => {
  resetMediaAdminDemo();
  return { perms, store: resetMediaMock(), personal: null, scheme: 'light', enabled: true, emptyList: false, failList: false, listDelay: 0, calls: [], admin: mediaAdmin(), actionStatus: 'confirmed' };
};

/** The contract's `can` of this caller for one device (the mock store says yes to everything). */
function forCaller(st: St, d: MediaDevice): MediaDevice {
  const has = (p: string) => st.perms.includes(p);
  return { ...d, can: { control: has('media.control'), power: has('media.power'), public_ok: !d.public || has('media.public'), bulk: has('media.bulk') } };
}

async function install(page: Page, st: St) {
  await page.route('**/api/v1/**', async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    const body = req.postData() ? (req.postDataJSON() as unknown) : null;
    if (p.startsWith('multimedia') || p.startsWith('me/prefs') || p.startsWith('devices/actions') || p.startsWith('ha/actions')) st.calls.push({ method, path: p + url.search, body });
    const json = (b: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    const err = (status: number, code: string, msg: string) => json({ code, user_message: msg, retryable: false, correlation_id: '', details: {} }, status);
    const has = (perm: string) => st.perms.includes(perm);
    const guard = async <T>(fn: () => Promise<T>): Promise<T | null> => {
      try {
        return await fn();
      } catch (e) {
        if (e instanceof ApiError) {
          await err(e.status, e.code, e.body.user_message);
          return null;
        }
        throw e;
      }
    };
    try {
      if (p === 'me') {
        return json({
          channel: 'local', remote: null,
          user: { id: 'u-test', username: 'u-test', display_name: 'יוני', source: 'ingress' },
          active: true, bindings: [{ id: 'b1', role_id: 'r', role_name: 'בדיקה', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
          permissions_installation: st.perms, permissions_any: st.perms, has_access: true, permission_revision: 1,
          permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full',
        });
      }
      if (p === 'me/prefs' && method === 'GET') return json({ prefs: { 'nav.order': ['devices', 'security', 'explore', 'multimedia', 'wiskey'], ...(has('screen.personalize') ? { 'multimedia.personal': st.personal } : {}) }, stored: [], updated_at: null });
      if (p === 'me/prefs' && method === 'PUT') {
        const b = body as Record<string, unknown>;
        if ('multimedia.personal' in b) {
          if (!has('screen.personalize')) return err(403, 'personalize_required', 'אין הרשאה להתאמה אישית.');
          st.personal = b['multimedia.personal'];
        }
        return json({ prefs: { 'nav.order': [], 'multimedia.personal': st.personal }, stored: ['multimedia.personal'], updated_at: null });
      }
      if (p === 'settings' && method === 'PATCH') {
        if (body && 'multimedia.enabled' in (body as object)) st.enabled = String((body as Record<string, unknown>)['multimedia.enabled']) !== 'false';
        return json({ settings: {}, can_edit: true });
      }
      if (p === 'settings') {
        return json({
          settings: { 'ui.design': 'a', 'ui.start_route': 'devices', 'ui.hide_map': 'false', 'ui.hide_wiskey': 'false', 'ui.hide_search': 'false', 'ui.security_snapshot': 'true', 'ui.tabs': {}, 'devices.style': 'smplwise', 'devices.scheme': st.scheme, 'devices.theme': 'default', 'multimedia.enabled': String(st.enabled) },
          can_edit: has('system.configure'),
        });
      }
      if (p === 'multimedia/status') {
        const ds = st.store.rows.map((r) => r.device);
        return json({
          enabled: st.enabled, bridge: { paired: true, version: '0.4.0', media_ready: true },
          can: { read: has('media.read'), control: has('media.control'), power: has('media.power'), public: has('media.public'), bulk: has('media.bulk'), layout: has('media.layout'), configure: has('system.configure'), personalize: has('screen.personalize') },
          counts: { screens: st.emptyList ? 0 : ds.length, on: ds.filter((d) => d.live.power === 'on').length, pending_approval: has('system.configure') ? 0 : null }, profiles_version: 1,
        });
      }
      if (p === 'multimedia/devices') {
        if (st.listDelay) await new Promise((r) => setTimeout(r, st.listDelay));
        if (st.failList) return err(500, 'internal', 'שגיאה בטעינת המסכים');
        if (st.emptyList) return json({ devices: [] });
        const r = await st.store.list({ floor: url.searchParams.get('floor') ?? undefined, area: url.searchParams.get('area') ?? undefined, q: url.searchParams.get('q') ?? undefined });
        return json({ devices: r.devices.map((d) => forCaller(st, d)) });
      }
      const dev = /^multimedia\/devices\/([^/]+)(\/commands)?$/.exec(p);
      if (dev && !dev[2] && method === 'GET') {
        const r = await guard(() => st.store.get(decodeURIComponent(dev[1])));
        return r ? json(forCaller(st, r)) : undefined;
      }
      if (dev && dev[2] && method === 'POST') {
        if (!has('media.control') && !has('media.power')) return err(403, 'forbidden', 'אין הרשאה');
        const r = await guard(() => st.store.command(decodeURIComponent(dev[1]), body as never));
        return r ? json(r, 202) : undefined;
      }
      if (p === 'multimedia/layout' && method === 'GET') {
        return json({ installation: st.store.layoutState.layout, personal: has('screen.personalize') ? st.personal : null, revision: st.store.layoutState.revision, can_edit: has('media.layout'), can_personalize: has('screen.personalize') });
      }
      if (p === 'multimedia/layout' && method === 'PUT') {
        if (!has('media.layout')) return err(403, 'forbidden', 'אין הרשאה');
        const b = body as { layout: never; base_revision: number };
        const r = await guard(() => st.store.saveLayout(b.layout, b.base_revision));
        return r ? json({ ...r, personal: has('screen.personalize') ? st.personal : null }) : undefined;
      }
      if (p === 'multimedia/layout' && method === 'DELETE') {
        await st.store.resetLayout();
        return route.fulfill({ status: 204 });
      }
      if (p === 'multimedia/remote-default' && method === 'GET') return json(await st.store.remoteDefault());
      if (p === 'multimedia/remote-default' && method === 'PUT') return json(await st.store.saveRemoteDefault({ ...(body as object), scope: 'default' } as never));
      if (p === 'multimedia/actions/preview') return json(await st.store.bulkPreview(url.searchParams.get('scope') as never, url.searchParams.get('id') ?? ''));
      if (p === 'multimedia/actions' && method === 'POST') {
        const b = body as { scope: never; id: string; client_request_id: string };
        if (!has('media.bulk')) return err(403, 'forbidden', 'אין הרשאה');
        return json(await st.store.bulkRun(b.scope, b.id, b.client_request_id, ''), 202);
      }
      if (p.startsWith('devices/actions/mock-bulk')) {
        const off = st.store.sent.length;
        return json({ id: p.split('/').pop(), scope: 'floor', scope_id: 'g', scope_name: 'קומת קרקע', kind: 'screens_off', kind_label: 'כיבוי מסכים', status: 'done', done: true, all_confirmed: true, counts: { queued: 0, accepted: 0, confirmed: 3 + off * 0, sent: 0, not_confirmed: 0, refused: 0, unknown: 0, total: 3 }, items: [], note: '' });
      }
      if (p === 'multimedia/admin/devices' && method === 'GET') return json(await st.admin.list());
      const adm = /^multimedia\/admin\/devices\/([^/]+)$/.exec(p);
      if (adm && method === 'PUT') return json(await st.admin.update(decodeURIComponent(adm[1]), body as never));
      if (p === 'multimedia/admin/links') return json(await st.admin.link(body as never));
      if (p === 'multimedia/admin/approve') return json(await st.admin.approve((body as { device_keys: string[]; approved: boolean }).device_keys, (body as { approved: boolean }).approved));
      if (p.startsWith('ha/actions/')) return json({ id: p.split('/').pop(), entity_id: 'media_player.demo', action_id: 'media_player.turn_off', status: st.actionStatus, error: null, requested_at: '', confirmed_at: null });
      if (p === 'devices/tree') return json({ floors: [{ floor_id: 'g', name: 'קומת קרקע' }, { floor_id: 'u1', name: 'קומה 1' }, { floor_id: 'b', name: 'מרתף' }].map((f) => ({ ...f, level: null, icon: null, areas: [], counts: {}, climate: [] })), scoped: false });
      // the shell's own reads
      if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-09-30T00:00:00Z', version: 'test' });
      if (p === 'health') return json({ status: 'ok', version: 'test', nvr_configured: true, mode: 'full', discovery: { cameras: 8, cameras_last_ok: null, cameras_last_error: null }, events: { ingest: { connected: true, last_error: null } } });
      if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
      if (p === 'alarm/panels') return json({ panels: [], counts: { panels: 0 } });
      if (p === 'sites' || p.startsWith('sites?')) return json({ sites: [], can_create_site: false });
      if (p === 'cameras') return json({ cameras: [], recorder: null, can_sync: false });
      return err(404, 'not_found', 'לא נמצא (בדיקה)');
    } catch {
      // the page went away while a delayed answer was pending
    }
  });
}

const hashOf = (page: Page) => page.evaluate(() => location.hash);

async function open(page: Page, hash: string, size: Size = '1440') {
  await page.setViewportSize(SIZES[size]);
  await page.goto('about:blank');
  await page.goto(`/?design=a#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(400);
}

async function shot(page: Page, name: string, size: Size) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.waitForTimeout(350); // let the entrance / glow settle
  await page.screenshot({ path: path.join(OUT, `${name}-${size}.png`) });
}

const page$ = (page: Page) => page.locator('sw-app multimedia-screens');
const cards = (page: Page) => page.locator('sw-app multimedia-screens media-screen-card');

test.describe('multimedia screens (mocked backend)', () => {
  let st: St;

  test.beforeEach(async ({ page }) => {
    st = fresh(ADMIN);
    await page.addInitScript(() => {
      try {
        localStorage.removeItem('sw.nav.order');
        localStorage.removeItem('sw.security.section');
      } catch {
        /* storage unavailable */
      }
    });
  });

  test('the rail entry sits between the map and WisKey for a holder of media.read, and is absent without it', async ({ page }) => {
    await install(page, st);
    await open(page, '/multimedia/screens');
    const ids = () => page.locator('sw-app nav.rail a[data-nav]').evaluateAll((els) => els.map((e) => e.getAttribute('data-nav')));
    expect(await ids()).toEqual(['devices', 'security', 'explore', 'multimedia', 'wiskey']);
    await expect(page.locator('sw-app nav.rail a[data-nav="multimedia"]')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('sw-app nav.rail a[data-nav="multimedia"]')).toHaveText('מולטימדיה');
    await expect(page.locator('sw-app .subnav sw-tabs')).toHaveCount(0); // one tab in 0.1.149: no tab row

    st.perms = BASE;
    await open(page, '/devices/building');
    expect(await ids()).toEqual(['devices', 'security', 'explore']); // (WisKey needs access.read, which BASE lacks)
  });

  test('ready: one card per physical screen, grouped by floor, with the state summary', async ({ page }) => {
    await install(page, st);
    for (const size of ['1440', '820', '390'] as const) {
      await open(page, '/multimedia/screens', size);
      await expect(cards(page)).toHaveCount(8);
      await shot(page, 'ready', size);
    }
    await open(page, '/multimedia/screens');
    await expect(page$(page).locator('section[data-group]')).toHaveCount(3);
    expect(await page$(page).locator('section[data-group] h2').allTextContents()).toEqual(['קומת קרקע', 'קומה 1', 'מרתף']);
    await expect(page$(page).locator('.amb')).toContainText('4 פועלים מתוך 8');
    // a screen card: name, state line, the controls the capabilities allow
    const living = page$(page).locator('media-screen-card[data-screen-card="md-living"]');
    await expect(living).toContainText('טלוויזיה סלון');
    await expect(living.locator('.pw.on')).toHaveCount(1);
    await expect(living.locator('.vrock .vv')).toContainText('32');
    // no brand names, no hint paragraphs: Netflix is an app NAME (what the TV reports), not a logo
    await expect(page$(page).locator('img')).toHaveCount(0);
  });

  test('ready, dark scheme (devices.scheme): the same screen, dark glass', async ({ page }) => {
    st.scheme = 'dark';
    await install(page, st);
    for (const size of ['1440', '390'] as const) {
      await open(page, '/multimedia/screens', size);
      await expect(cards(page)).toHaveCount(8);
      await expect(page$(page)).toHaveAttribute('data-devices-scheme', 'dark');
      await shot(page, 'ready-dark', size);
    }
  });

  test('loading, empty and error states', async ({ page }) => {
    await install(page, st);
    st.listDelay = 4000;
    await open(page, '/multimedia/screens');
    await expect(page$(page).locator('[data-mm-state="loading"]')).toHaveCount(1);
    for (const size of ['1440', '820', '390'] as const) {
      await page.setViewportSize(SIZES[size]);
      await shot(page, 'loading', size);
    }
    st.listDelay = 0;
    st.emptyList = true;
    for (const size of ['1440', '820', '390'] as const) {
      await open(page, '/multimedia/screens', size);
      await expect(page$(page).locator('[data-mm-state="empty"]')).toContainText('אין מסכים');
      await shot(page, 'empty', size);
    }
    await expect(page$(page).locator('[data-mm-state="empty"] a[href="#/system/multimedia"]')).toHaveCount(1); // the administrator's way to the settings
    st.emptyList = false;
    st.failList = true;
    for (const size of ['1440', '820', '390'] as const) {
      await open(page, '/multimedia/screens', size);
      await expect(page$(page).locator('[data-mm-state="error"]')).toContainText('לא ניתן לטעון את המסכים');
      await shot(page, 'error', size);
    }
    st.failList = false;
    await page$(page).locator('[data-mm-retry]').click();
    await expect(cards(page)).toHaveCount(8); // the retry reads again
  });

  test('view-only (media.read): the state is visible, the controls are absent, the remote entry stays on the poster', async ({ page }) => {
    st.perms = VIEW_ONLY;
    await install(page, st);
    for (const size of ['1440', '820', '390'] as const) {
      await open(page, '/multimedia/screens', size);
      await expect(cards(page)).toHaveCount(8);
      await shot(page, 'view-only', size);
    }
    await open(page, '/multimedia/screens');
    await expect(page$(page).locator('media-screen-card .pw')).toHaveCount(0);
    await expect(page$(page).locator('media-screen-card .rbtn')).toHaveCount(0);
    await expect(page$(page).locator('media-screen-card .vrock')).toHaveCount(0);
    await expect(page$(page).locator('[data-bulk-off]')).toHaveCount(0);
    await expect(page$(page).locator('media-screen-card[data-screen-card="md-living"] .shot')).toHaveCount(1);
    // and the user menu offers no edit mode
    await page.locator('sw-app [data-profile-menu]').click();
    await expect(page.locator('sw-app sw-user-menu [data-menu-screen-edit]')).toHaveCount(0);
  });

  test('a screen that cannot be powered on from here keeps its power button disabled with the reason; an unavailable screen shows since when', async ({ page }) => {
    await install(page, st);
    await open(page, '/multimedia/screens');
    const office = page$(page).locator('media-screen-card[data-screen-card="md-office"] .pw');
    await expect(office).toBeDisabled();
    await expect(office).toHaveAttribute('title', 'אין הפעלה מרחוק');
    const gym = page$(page).locator('media-screen-card[data-screen-card="md-gym"]');
    await expect(gym).toContainText('לא זמין מאז');
    await expect(gym.locator('.pw')).toBeDisabled();
  });

  test('filters: a room chip, the state filter and the search narrow the cards and keep the address', async ({ page }) => {
    await install(page, st);
    await open(page, '/multimedia/screens');
    await page$(page).locator('[data-room="kitchen"]').click();
    await expect(cards(page)).toHaveCount(1);
    await expect.poll(() => hashOf(page)).toContain('area=kitchen');
    await page$(page).locator('[data-room=""]').click();
    await expect(cards(page)).toHaveCount(8);
    await page$(page).locator('[data-state-filter="on"]').click();
    await expect(cards(page)).toHaveCount(4);
    await page$(page).locator('[data-state-filter="un"]').click();
    await expect(cards(page)).toHaveCount(1);
    await page$(page).locator('[data-state-filter="all"]').click();
    await page$(page).locator('[data-search]').fill('ילדים');
    await expect(cards(page)).toHaveCount(1);
    await expect.poll(() => hashOf(page)).toContain('q=');
    await page$(page).locator('[data-search]').fill('אין כזה');
    await expect(page$(page).locator('[data-mm-state="filtered"]')).toContainText('לא נמצאו מסכים');
    await page$(page).locator('[data-clear-filters]').click();
    await expect(cards(page)).toHaveCount(8);
    // the floor menu
    await page$(page).locator('[data-floor-menu]').click();
    await page$(page).locator('[data-floor-pick="b"]').click();
    await expect(cards(page)).toHaveCount(2);
    await expect(page$(page).locator('[data-floor-menu]')).toContainText('מרתף');
  });

  test('the power button sends ONE power command; the card follows the confirmed state', async ({ page }) => {
    await install(page, st);
    await open(page, '/multimedia/screens');
    const kitchen = page$(page).locator('media-screen-card[data-screen-card="md-kitchen"]');
    await expect(kitchen.locator('.pw.on')).toHaveCount(1);
    await kitchen.locator('.pw').click();
    await expect(kitchen.locator('.pw.on')).toHaveCount(0);
    await expect(kitchen).toContainText('כבוי');
    expect(st.store.sent.map((s) => `${s.key}:${s.command.command}`)).toEqual(['md-kitchen:power_off']);
    // no auto power-on: the remote button of an off screen opens the remote, nothing is sent
    await kitchen.locator('.rbtn').click();
    expect(st.store.sent).toHaveLength(1);
  });

  test('the source menu reads the curated sources and apps of the detail; a pick sends that source', async ({ page }) => {
    await install(page, st);
    await open(page, '/multimedia/screens');
    const living = page$(page).locator('media-screen-card[data-screen-card="md-living"]');
    await living.locator('button[aria-haspopup="menu"]').click();
    await expect(living.locator('.pop [role="menuitemradio"]').first()).toBeVisible();
    await shot(page, 'source-menu', '1440');
    await living.locator('.pop [role="menuitemradio"]', { hasText: 'HDMI 1' }).click();
    await expect.poll(() => st.store.sent.map((s) => s.command.command)).toEqual(['source']);
    expect(st.store.sent[0].command).toMatchObject({ command: 'source', source_id: 'HDMI1' });
  });

  test('volume: one step per press and a press over the rate limit is dropped, never queued', async ({ page }) => {
    await install(page, st);
    await open(page, '/multimedia/screens');
    const kitchen = page$(page).locator('media-screen-card[data-screen-card="md-kitchen"]');
    await kitchen.locator('.vrock button[aria-label="הגבר"]').click();
    await expect(kitchen.locator('.vrock .vv')).toContainText('20');
    expect(st.store.sent.map((s) => s.command.command)).toEqual(['volume_step']);
    const t0 = Date.now();
    for (let i = 0; i < 14; i += 1) await kitchen.locator('.vrock button[aria-label="הגבר"]').dispatchEvent('click');
    // a burst of 8 (+ the first press), refilled at 5 a second while the loop ran (a loaded machine runs it slowly), the rest dropped
    const allowed = 9 + Math.ceil(((Date.now() - t0) / 1000) * 5);
    expect(st.store.sent.length).toBeLessThanOrEqual(allowed);
    expect(st.store.sent.length, 'some presses were dropped, not queued').toBeLessThan(15);
  });

  test('the remote opens by tag from the poster and the button; the address carries it; Back and close end it', async ({ page }) => {
    await install(page, st);
    await open(page, '/multimedia/screens');
    await page$(page).locator('media-screen-card[data-screen-card="md-living"] .rbtn').click();
    const drawer = page.locator('media-remote[open] sw-drawer');
    await expect(drawer).toHaveAttribute('heading', 'טלוויזיה סלון');
    expect(await hashOf(page)).toContain('remote=md-living');
    await page.keyboard.press('Escape');
    await expect(page.locator('media-remote')).toHaveCount(0);
    expect(await hashOf(page)).not.toContain('remote=');
    // the poster opens it too, and Back closes it
    await page$(page).locator('media-screen-card[data-screen-card="md-kids"] .shot').click();
    await expect(page.locator('media-remote[open] sw-drawer')).toHaveAttribute('heading', 'מסך ילדים');
    await page.goBack();
    await expect(page.locator('media-remote')).toHaveCount(0);
  });

  test('the floor "כבה מסכים": a short confirmation, then the honest result; screens that were off are not counted', async ({ page }) => {
    await install(page, st);
    await open(page, '/multimedia/screens');
    await expect(page$(page).locator('[data-bulk-off="g"]')).toHaveCount(1);
    await expect(page$(page).locator('[data-bulk-off="u1"]')).toHaveCount(1); // the kids' screen is paused = on
    await expect(page$(page).locator('[data-bulk-off="b"]')).toHaveCount(1); // the home cinema is idle = on
    await page$(page).locator('[data-bulk-off="g"]').click();
    const dlg = page$(page).locator('media-bulk-dialog sw-dialog[open]');
    await expect(dlg).toHaveAttribute('heading', 'לכבות 3 מסכים בקומת קרקע?');
    await shot(page, 'floor-off-dialog', '1440');
    // "פרטים" is folded
    await expect(dlg.locator('details')).not.toHaveAttribute('open', '');
    await dlg.locator('[data-bulk-confirm]').click();
    await expect(page$(page).locator('media-bulk-dialog [data-bulk-result="ok"]')).toHaveCount(1);
    expect(st.calls.some((c) => c.method === 'POST' && c.path === 'multimedia/actions')).toBe(true);
    await dlg.locator('[data-bulk-cancel]').click();
    await expect(page$(page).locator('media-screen-card[data-screen-card="md-living"] .pw.on')).toHaveCount(0);
  });

  test('a phone shows the compact horizontal cards and the floor menu', async ({ page }) => {
    await install(page, st);
    await open(page, '/multimedia/screens', '390');
    await expect(page$(page).locator('media-screen-card').first()).toHaveAttribute('compact', '');
    // every control of a card and of the header is a 44 px touch target
    const small = await page.evaluate(() => {
      const out: string[] = [];
      const host = document.querySelector('sw-app')!.shadowRoot!.querySelector('multimedia-screens')!;
      const check = (root: ParentNode, sel: string) => root.querySelectorAll<HTMLElement>(sel).forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width && (r.width < 43.5 || r.height < 43.5)) out.push(`${el.className || el.tagName} ${Math.round(r.width)}x${Math.round(r.height)}`);
      });
      host.shadowRoot!.querySelectorAll('media-screen-card').forEach((c) => check(c.shadowRoot!, '.pw, .rb, .rbtn, .vrock button'));
      check(host.shadowRoot!, '.rc, .floorbtn, .search, .seg button');
      return out;
    });
    expect(small).toEqual([]);
    await page$(page).locator('[data-floor-menu]').click();
    await shot(page, 'floor-menu', '390');
    await expect(page$(page).locator('[data-floor-pick]')).toHaveCount(4);
  });

  test('the settings switch: multimedia.enabled off takes the rail entry away and the page answers "כבויה"', async ({ page }) => {
    st.enabled = false;
    await install(page, st);
    await open(page, '/multimedia/screens');
    await expect(page$(page).locator('[data-mm-state="disabled"]')).toContainText('המולטימדיה כבויה');
    await expect(page.locator('sw-app nav.rail a[data-nav="multimedia"]')).toHaveCount(0);
  });

  test('a command the screen does not confirm: "המסך לא אישר את הפקודה" and the last confirmed state is shown again', async ({ page }) => {
    st.actionStatus = 'unknown';
    await install(page, st);
    await open(page, '/multimedia/screens');
    const kitchen = page$(page).locator('media-screen-card[data-screen-card="md-kitchen"]');
    await kitchen.locator('.pw').click();
    await expect(kitchen.locator('small.bad')).toHaveText('המסך לא אישר את הפקודה');
    await expect(kitchen.locator('.pw.nack')).toHaveCount(1);
    await shot(page, 'not-confirmed', '1440');
    // the note goes by itself; nothing was sent twice
    expect(st.store.sent).toHaveLength(1);
    await expect(kitchen.locator('small.bad')).toHaveCount(0, { timeout: 9000 });
  });

  // ---------------------------------------------------------------------------------------------- the layout editor

  const enterEditFromMenu = async (page: Page) => {
    await page.locator('sw-app [data-profile-menu]').click();
    await page.locator('sw-app sw-user-menu [data-menu-screen-edit="multimedia-layout"]').click();
    await expect(page$(page).locator('[data-mm-editbar]')).toBeVisible();
  };
  const layoutPuts = () => st.calls.filter((c) => c.method === 'PUT' && c.path === 'multimedia/layout');
  const prefsPuts = () => st.calls.filter((c) => c.method === 'PUT' && c.path === 'me/prefs');

  test('the editor: entered from the user menu, it edits order, pinning, size and visibility (desktop and phone) and saves the installation layout', async ({ page }) => {
    await install(page, st);
    await open(page, '/multimedia/screens');
    await enterEditFromMenu(page);
    await expect.poll(() => hashOf(page)).toContain('edit=1');
    await expect(page$(page).locator('[data-mm-row]')).toHaveCount(8);
    await expect(page$(page).locator('[data-scope]')).toHaveCount(2); // לכולם / רק אני (this admin holds both)
    await expect(page$(page).locator('[data-room]')).toHaveCount(0); // the filters are not part of editing
    for (const size of ['1440', '820', '390'] as const) {
      await page.setViewportSize(SIZES[size]);
      await shot(page, 'editor', size);
    }
    await page.setViewportSize(SIZES['1440']);
    // hide the gym screen, enlarge the living room, pin the kids' screen, hide the cinema on the phone only, move the pergola up
    await page$(page).locator('[data-mm-on="md-gym"]').uncheck();
    await expect(page$(page).locator('media-screen-card[data-screen-card="md-gym"]')).toHaveAttribute('data-dimmed', '');
    await page$(page).locator('[data-mm-size="md-living:l"]').click();
    await expect(page$(page).locator('media-screen-card[data-screen-card="md-living"]')).toHaveAttribute('data-size', 'l');
    await page$(page).locator('[data-mm-pin="md-kids"]').click();
    await expect(page$(page).locator('section[data-group]').first()).toHaveAttribute('data-group', 'pinned');
    await expect(page$(page).locator('[data-mm-phone]')).toHaveCount(0); // folded until asked for
    await page$(page).locator('[data-mm-phone-toggle="md-cinema"]').click();
    await page$(page).locator('[data-mm-phone-on="md-cinema"]').uncheck();
    const order = () => page$(page).locator('[data-group="g"] media-screen-card').evaluateAll((els) => els.map((e) => e.getAttribute('data-screen-card')));
    expect(await order()).toEqual(['md-kitchen', 'md-living', 'md-pergola']);
    await page$(page).locator('[data-mm-row="md-pergola"] [data-mm-up]').click();
    expect(await order()).toEqual(['md-kitchen', 'md-pergola', 'md-living']);
    await page$(page).locator('[data-mm-save]').click();
    await expect(page$(page).locator('[data-mm-editbar]')).toHaveCount(0);
    await expect.poll(() => hashOf(page)).not.toContain('edit=1');
    const put = layoutPuts();
    expect(put).toHaveLength(1);
    const saved = put[0].body as { layout: { pinned: string[]; cards: Record<string, { on: boolean; size: string; phone_on: boolean | null }>; order: string[]; floor_order: string[] }; base_revision: number };
    expect(saved.base_revision).toBe(1);
    expect(saved.layout.pinned).toEqual(['md-kids']);
    expect(saved.layout.cards['md-gym'].on).toBe(false);
    expect(saved.layout.cards['md-living'].size).toBe('l');
    expect(saved.layout.cards['md-cinema']).toMatchObject({ on: true, phone_on: false });
    expect(saved.layout.order).toHaveLength(8);
    expect(saved.layout.floor_order).toEqual([]); // the floors still follow the home screen
    expect(prefsPuts()).toHaveLength(0); // nothing personal was written
    // the page now shows the saved layout: the gym screen is gone, the kids' screen leads the "מועדפים" row
    await expect(cards(page)).toHaveCount(7);
    expect(await page$(page).locator('section[data-group] h2').first().textContent()).toBe('מועדפים');
    expect(await order()).toEqual(['md-kitchen', 'md-pergola', 'md-living']);
    // and on a phone the cinema is hidden
    await open(page, '/multimedia/screens', '390');
    await expect(page$(page).locator('media-screen-card[data-screen-card="md-cinema"]')).toHaveCount(0);
    await expect(cards(page)).toHaveCount(6);
  });

  test('the editor: "ברירת מחדל" asks first, then brings the automatic layout back for everyone', async ({ page }) => {
    await install(page, st);
    await open(page, '/multimedia/screens?edit=1');
    await expect(page$(page).locator('[data-mm-editbar]')).toBeVisible(); // ?edit=1 enters it (this user may edit)
    await page$(page).locator('[data-mm-on="md-gym"]').uncheck();
    await page$(page).locator('[data-mm-save]').click();
    await expect(cards(page)).toHaveCount(7);
    await enterEditFromMenu(page);
    await page$(page).locator('[data-mm-reset]').click();
    await expect(page$(page).locator('[data-mm-confirm="reset"]')).toHaveAttribute('heading', 'להחזיר את המסך לברירת המחדל לכולם?');
    await page$(page).locator('[data-mm-confirm-no]').click();
    expect(st.calls.some((c) => c.method === 'DELETE')).toBe(false);
    await page$(page).locator('[data-mm-reset]').click();
    await page$(page).locator('[data-mm-confirm-yes]').click();
    await expect(cards(page)).toHaveCount(8);
    expect(st.calls.filter((c) => c.method === 'DELETE' && c.path === 'multimedia/layout')).toHaveLength(1);
  });

  test('the editor: a layout saved elsewhere meanwhile is a conflict, not an overwrite; "טען מחדש" starts again', async ({ page }) => {
    await install(page, st);
    await open(page, '/multimedia/screens');
    await enterEditFromMenu(page);
    await page$(page).locator('[data-mm-on="md-gym"]').uncheck();
    st.store.layoutState.revision += 1; // someone else saved
    await page$(page).locator('[data-mm-save]').click();
    await expect(page$(page).locator('[data-mm-editbar] [role="alert"]')).toHaveText('המסך נערך במקום אחר');
    await expect(page$(page).locator('[data-mm-save]')).toBeDisabled();
    await page$(page).locator('[data-mm-editbar] .btn', { hasText: 'טען מחדש' }).click();
    await expect(page$(page).locator('[data-mm-editbar] [role="alert"]')).toHaveCount(0);
    await expect(page$(page).locator('[data-mm-on="md-gym"]')).toBeChecked(); // the draft started again from the saved layout
  });

  test('the editor: cancel with changes asks; without changes it just closes', async ({ page }) => {
    await install(page, st);
    await open(page, '/multimedia/screens');
    await enterEditFromMenu(page);
    await page$(page).locator('[data-mm-cancel]').click(); // nothing changed
    await expect(page$(page).locator('[data-mm-editbar]')).toHaveCount(0);
    await enterEditFromMenu(page);
    await page$(page).locator('[data-mm-on="md-gym"]').uncheck();
    await page$(page).locator('[data-mm-cancel]').click();
    await expect(page$(page).locator('[data-mm-confirm="cancel"]')).toHaveAttribute('heading', 'לבטל את השינויים?');
    await page$(page).locator('[data-mm-confirm-no]').click();
    await expect(page$(page).locator('[data-mm-editbar]')).toBeVisible();
    await page$(page).locator('[data-mm-cancel]').click();
    await page$(page).locator('[data-mm-confirm-yes]').click();
    await expect(page$(page).locator('[data-mm-editbar]')).toHaveCount(0);
    expect(layoutPuts()).toHaveLength(0);
  });

  test('the personal override: a holder of screen.personalize alone keeps their own layout in /me/prefs; the installation layout is untouched', async ({ page }) => {
    st.perms = [...PERSONAL, 'access.read'];
    await install(page, st);
    await open(page, '/multimedia/screens');
    await enterEditFromMenu(page);
    await expect(page$(page).locator('[data-scope]')).toHaveCount(0); // only one scope: no choice offered
    await expect(page$(page).locator('[data-mm-pin]')).toHaveCount(0); // "מועדפים", phone rows, floor order: installation only
    await expect(page$(page).locator('[data-mm-phone-toggle]')).toHaveCount(0);
    await expect(page$(page).locator('[data-mm-floors-col]')).toHaveCount(0);
    await page$(page).locator('[data-mm-on="md-gym"]').uncheck();
    await page$(page).locator('[data-mm-size="md-kitchen:l"]').click();
    await page$(page).locator('[data-mm-group="none"]').click();
    await page$(page).locator('[data-mm-save]').click();
    await expect(page$(page).locator('[data-mm-editbar]')).toHaveCount(0);
    expect(layoutPuts()).toHaveLength(0);
    const put = prefsPuts();
    expect(put).toHaveLength(1);
    expect((put[0].body as Record<string, unknown>)['multimedia.personal']).toEqual({ group_by: 'none', order: null, cards: { 'md-gym': { on: false }, 'md-kitchen': { size: 'l' } } });
    await expect(cards(page)).toHaveCount(7);
    await expect(page$(page).locator('section[data-group]')).toHaveCount(1); // one flat list
    expect(st.store.layoutState.layout.group_by).toBe('floor'); // the installation layout is as it was
    // "ברירת מחדל" of the personal scope clears the override (null), nothing more
    await enterEditFromMenu(page);
    await page$(page).locator('[data-mm-reset]').click();
    await expect(page$(page).locator('[data-mm-confirm="reset"]')).toHaveAttribute('heading', 'להחזיר את המסך שלי לברירת המחדל?');
    await page$(page).locator('[data-mm-confirm-yes]').click();
    await expect(cards(page)).toHaveCount(8);
    expect((prefsPuts().at(-1)!.body as Record<string, unknown>)['multimedia.personal']).toBeNull();
    expect(st.calls.some((c) => c.method === 'DELETE')).toBe(false);
  });

  test('both scopes: "לכולם" writes the installation layout, "רק אני" the personal override - one at a time', async ({ page }) => {
    await install(page, st);
    await open(page, '/multimedia/screens');
    await enterEditFromMenu(page);
    await page$(page).locator('[data-scope="me"]').click();
    await expect(page$(page).locator('[data-mm-pin]')).toHaveCount(0);
    await page$(page).locator('[data-mm-on="md-office"]').uncheck();
    await page$(page).locator('[data-mm-save]').click();
    await expect(cards(page)).toHaveCount(7);
    expect(layoutPuts()).toHaveLength(0);
    expect(prefsPuts()).toHaveLength(1);
    await enterEditFromMenu(page);
    await page$(page).locator('[data-scope="all"]').click();
    await expect(page$(page).locator('[data-mm-pin]')).toHaveCount(8);
    await page$(page).locator('[data-mm-on="md-gym"]').uncheck();
    await page$(page).locator('[data-mm-save]').click();
    await expect.poll(() => layoutPuts().length).toBe(1);
    // the personal override (office hidden) and the installation layout (gym hidden) both apply now
    await expect(cards(page)).toHaveCount(6);
  });

  test('without media.layout and screen.personalize there is no edit mode: the menu has no entry and ?edit=1 is dropped', async ({ page }) => {
    st.perms = OPERATOR;
    await install(page, st);
    await open(page, '/multimedia/screens?edit=1');
    await expect(cards(page)).toHaveCount(8);
    await expect(page$(page).locator('[data-mm-editbar]')).toHaveCount(0);
    await expect.poll(() => hashOf(page)).not.toContain('edit=1');
    await page.locator('sw-app [data-profile-menu]').click();
    await expect(page.locator('sw-app sw-user-menu [data-menu-screen-edit]')).toHaveCount(0);
  });

  // ---------------------------------------------------------------------------------------------- הגדרות › מולטימדיה

  test('settings › מולטימדיה: approval, public flag, connections, merge suggestion, remote default and the feature switch', async ({ page }) => {
    await install(page, st);
    await open(page, '/system/multimedia');
    const sys = page.locator('sw-app system-multimedia');
    await expect(sys.locator('[data-mm-devices] [data-mm-admin-device]'), 'the screens card lists the six screens').toHaveCount(6);
    await expect(sys.locator('[data-mm-players] [data-mm-admin-device]'), 'the players card lists every player of the demo house, approved or not').toHaveCount(17);
    await expect(page.locator('sw-app .subnav sw-tabs a[aria-current="page"]')).toHaveText('מולטימדיה');
    await expect(sys.locator('[data-mm-display]')).toHaveText('זכוכית תמיד; בהיר/כהה לפי חשמל והתקנים');
    await expect(sys.locator('[data-mm-bridge]')).toContainText('0.4.0');
    for (const size of ['1440', '390'] as const) {
      await page.setViewportSize(SIZES[size]);
      await shot(page, 'settings', size);
    }
    await page.setViewportSize(SIZES['1440']);
    // "אשר את כל המסכים שזוהו": one action for every screen still waiting
    await expect(sys.locator('[data-mm-approve-all]')).toContainText('(1)');
    await sys.locator('[data-mm-approve-all]').click();
    await expect.poll(() => st.calls.find((c) => c.path === 'multimedia/admin/approve')?.body).toEqual({ device_keys: ['md-new'], approved: true });
    // the full forms open on demand under the compact rows (0.1.162)
    for (const k of ['md-kitchen', 'md-living', 'md-kids']) await sys.locator(`[data-mm-edit="${k}"]`).click();
    // the public flag is one write of one field
    await sys.locator('sw-toggle[data-mm-public="md-kitchen"]').click();
    await expect.poll(() => st.calls.filter((c) => c.method === 'PUT' && c.path === 'multimedia/admin/devices/md-kitchen').length).toBe(1);
    expect(st.calls.find((c) => c.path === 'multimedia/admin/devices/md-kitchen')?.body).toEqual({ public: true });
    // a volume ceiling
    await sys.locator('[data-mm-volmax="md-kitchen"]').fill('55');
    await sys.locator('[data-mm-volmax="md-kitchen"]').press('Enter');
    await sys.locator('[data-mm-name="md-kitchen"]').focus();
    await expect.poll(() => st.calls.filter((c) => c.path === 'multimedia/admin/devices/md-kitchen').map((c) => c.body)).toContainEqual({ volume_max: 55 });
    // model extras are enabled per screen (never guessed); a generic screen has no key vocabulary to extend
    await sys.locator('[data-mm-extra-keys="md-living"] label', { hasText: 'מידע' }).locator('input').check();
    await expect.poll(() => st.calls.filter((c) => c.path === 'multimedia/admin/devices/md-living').map((c) => c.body)).toContainEqual({ model_keys: ['info'] });
    await expect(sys.locator('[data-mm-extra-keys="md-kids"]')).toHaveCount(0);
    // connections: the endpoints of the living-room TV (one answers, three are hidden duplicates); ignore one
    await sys.locator('[data-mm-toggle-endpoints="md-living"]').click();
    await expect(sys.locator('[data-mm-endpoints="md-living"] [data-mm-endpoint]')).toHaveCount(4);
    await expect(sys.locator('[data-mm-endpoints="md-living"] sw-badge[label="מוסתר"]')).toHaveCount(3);
    await sys.locator('[data-mm-ignore="ha:media_player.demo_living"]').click();
    await expect.poll(() => st.calls.find((c) => c.path === 'multimedia/admin/links')?.body).toEqual({ op: 'ignore', endpoint_id: 'ha:media_player.demo_living' });
    // a weak suggestion is never automatic: one press merges
    await sys.locator('[data-mm-merge]').click();
    await expect.poll(() => st.calls.filter((c) => c.path === 'multimedia/admin/links').at(-1)?.body).toMatchObject({ op: 'link', device_key: 'md-kitchen' });
    await expect(sys.locator('[data-mm-suggestions]')).toHaveCount(0);
    // the remote's default sections
    await sys.locator('[data-mm-section="colors"] sw-toggle').click();
    await sys.locator('[data-mm-save-remote]').click();
    await expect.poll(() => st.calls.find((c) => c.path === 'multimedia/remote-default' && c.method === 'PUT')?.body).toBeTruthy();
    const sections = (st.calls.find((c) => c.path === 'multimedia/remote-default' && c.method === 'PUT')!.body as { sections: { id: string; on: boolean }[] }).sections;
    expect(sections.find((s) => s.id === 'colors')?.on).toBe(false);
    expect(sections).toHaveLength(11);
    // the switch: off = the rail entry leaves for everyone (this page too)
    await expect(page.locator('sw-app nav.rail a[data-nav="multimedia"]')).toHaveCount(1);
    await sys.locator('sw-toggle[data-mm-enabled]').click();
    await expect.poll(() => st.enabled).toBe(false);
    await expect(page.locator('sw-app nav.rail a[data-nav="multimedia"]')).toHaveCount(0);
  });

  test('settings › מולטימדיה needs system.configure: anyone else sees the closed state', async ({ page }) => {
    st.perms = EDITOR;
    await install(page, st);
    await open(page, '/system/multimedia');
    await expect(page.locator('sw-app system-multimedia [data-mm-admin-state="forbidden"]')).toHaveCount(1);
    await expect(page.locator('sw-app system-multimedia [data-mm-admin-device]')).toHaveCount(0);
  });

  test('the static demo (no backend): the mock adapter answers, editing is kept in memory, personal included', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.clear());
    await page.setViewportSize(SIZES['1440']);
    await page.goto('about:blank');
    await page.goto('/?design=a#/multimedia/screens');
    await page.waitForSelector('sw-app');
    await expect(cards(page)).toHaveCount(8);
    await expect(page$(page).locator('section[data-group] h2')).toHaveText(['קומת קרקע', 'קומה 1', 'מרתף']); // the demo's own floor order
    await shot(page, 'demo-ready', '1440');
    await page.locator('sw-app [data-profile-menu]').click();
    await page.locator('sw-app sw-user-menu [data-menu-screen-edit="multimedia-layout"]').click();
    await page$(page).locator('[data-scope="me"]').click();
    await page$(page).locator('[data-mm-on="md-gym"]').uncheck();
    await page$(page).locator('[data-mm-save]').click();
    await expect(cards(page)).toHaveCount(7);
    // a command reaches the mock
    await page$(page).locator('media-screen-card[data-screen-card="md-kitchen"] .pw').click();
    await expect(page$(page).locator('media-screen-card[data-screen-card="md-kitchen"] .pw.on')).toHaveCount(0);
  });
});
