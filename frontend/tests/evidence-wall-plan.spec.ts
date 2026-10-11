import { test, expect, type Locator, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { demoRooms } from '../src/fixtures/demo';
import { demoSceneInput } from '../src/fixtures/demo-3d';
import { DEFAULT_VIEW } from '../src/api/plan-view';
import { skinTable } from '../src/design/css';

// Plan Studio 6, slice S5-B (CR-029 sections 3.3 / 3.4, CR-030 sections 4 / 8; docs/changes/CR-029-ST7-S5B-NOTES.md): the plan in the map
// band of a portrait wall display, against a mocked backend. The wall user's profile carries the screen's own plan setting; the band
// draws the baked stills (no WebGL) or the live 3D in the bare kiosk view; the screen's setting beats the installation's dials, `follow`
// hands a dial down; a live view idles into the baked still and wakes on a touch; the plan takes the wall's theme; a profile with no
// floor keeps the empty surface; a pushed configuration changes the band live. Plus the settings drawer's map section.
// Run on the runner: `run_smart.py spec <branch> tests/evidence-wall-plan.spec.ts --project=desktop`; screenshots: SW_SHOTS=../docs/evidence/ST7-S5B.
const SHOTS = process.env.SW_SHOTS ?? '';

type Dev = { w: number; h: number; touch: boolean; mobile: boolean };
const TABLET_P: Dev = { w: 800, h: 1280, touch: true, mobile: false };
const TABLET_L: Dev = { w: 1280, h: 800, touch: true, mobile: false };

async function asDevice(page: Page, d: Dev) {
  await page.setViewportSize({ width: d.w, height: d.h });
  await page.addInitScript((dev) => {
    Object.defineProperty(window.screen, 'width', { get: () => dev.w });
    Object.defineProperty(window.screen, 'height', { get: () => dev.h });
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => (dev.touch ? 5 : 0) });
    Object.defineProperty(navigator, 'userAgentData', { get: () => ({ mobile: dev.mobile }) });
    const mm = window.matchMedia.bind(window);
    window.matchMedia = (q: string) => {
      if (/pointer:\s*coarse|hover:\s*none/.test(q)) return { ...mm('all'), matches: dev.touch, media: q } as MediaQueryList;
      return mm(q);
    };
  }, d);
}

// ---- the mocked floor: the demo structure with one lamp circuit, two rooms, a set of stills drawn as SVG
const input = demoSceneInput('f0')!;
const rooms = demoRooms('f0');
const zones = rooms.map((r, i) => ({ id: `z${i}`, floor_id: 'f1', plan_version_id: 'pv1', name: `חדר ${i}`, kind: 'room', polygon: [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }], color: '#888', source: 'manual', searchable: true, level_id: 'L0' }));
const doc = { ...input.doc, circuits: [{ id: 'c1', name: 'מנורות', switch_entity_id: 'switch.c1', member_ids: ['dl0'], color_token: 'light', power_w: 40 }] };
const LIBRARY = {
  catalog_version: '2026.10.1', revision: 'rev1', categories: [], icons: [], color_tokens: [],
  items: [
    { id: 'light.ceiling', category: 'lighting', names: { he: 'מנורה', en: 'lamp' }, tags: [], role: 'light', shape: 'cylinder', size: { w_m: 0.4, d_m: 0.4, h_m: 0.1 }, z_ref: 'ceiling', z_m: -0.3, params: {}, params_schema: {}, icon: 'bulb', color_token: 'light', anchor_kinds: ['light'], ifc: { class: 'IfcLamp', predefined_type: 'NOTDEFINED' }, custom: false, based_on: null },
    { id: 'chair.basic', category: 'furniture', names: { he: 'כיסא', en: 'chair' }, tags: [], role: 'furniture', shape: 'box', size: { w_m: 0.45, d_m: 0.45, h_m: 0.85 }, z_ref: 'floor', z_m: 0, params: {}, params_schema: {}, icon: 'chair', color_token: 'furniture', anchor_kinds: [], ifc: { class: 'IfcFurniture', predefined_type: 'NOTDEFINED' }, custom: false, based_on: null },
  ],
};
const STILL_W = 800;
const STILL_H = 500;
/** A still as an SVG picture: the floor plate in the style's colour, two room slabs, warm slabs when the lights are on. */
function stillSvg(style: 'light' | 'dark', variant: 'off' | 'on'): string {
  const bg = style === 'light' ? '#dfe6ef' : '#0f1626';
  const slab = variant === 'on' ? '#ffd28a' : style === 'light' ? '#f4f6fa' : '#1c2740';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${STILL_W} ${STILL_H}" width="${STILL_W}" height="${STILL_H}"><rect width="${STILL_W}" height="${STILL_H}" fill="${bg}"/>`
    + `<g stroke="${style === 'light' ? '#56617a' : '#8fa0c0'}" stroke-width="6" fill="${slab}"><rect x="60" y="120" width="300" height="300"/><rect x="420" y="120" width="320" height="300"/></g></svg>`;
}
const MASK = {
  version: 1, preset: 'iso', width: STILL_W, height: STILL_H,
  rooms: [
    { id: 'z0', floor: [[60, 120], [360, 120], [360, 420], [60, 420]], top: [[60, 120], [360, 120], [360, 420], [60, 420]], centre: [210, 270] },
    { id: 'z1', floor: [[420, 120], [740, 120], [740, 420], [420, 420]], top: [[420, 120], [740, 120], [740, 420], [420, 420]], centre: [580, 270] },
  ],
  doors: [], cameras: [],
};
const bakesWire = () => {
  const still = (id: string) => ({ url: `floors/f1/bakes/${id}/file`, width: STILL_W, height: STILL_H, recipe: 'still-q2.1' });
  return {
    bake_key: 'k1', complete: true, stale_count: 0, recipes: ['still-q2.1'],
    levels: { L0: { stills: { 'iso/light/day/off': still('ld0'), 'iso/light/day/on': still('ld1'), 'iso/dark/day/off': still('dd0'), 'iso/dark/day/on': still('dd1') }, masks: { iso: { url: 'floors/f1/bakes/mask/file' } }, lightmap: null } },
  };
};

const CAMS = Array.from({ length: 4 }, (_, i) => ({ id: `cam-${i + 1}`, name: `מצלמה ${i + 1}` }));
const BASE_CFG = {
  cameras: [], scope: 'floor', layout: 'auto', grid: 'auto', rotate_s: 0, stream: 'sub', strip: ['clock', 'date', 'health'], state_entities: [], show_map: true, theme: 'dark',
  alerts: { enabled: true, categories: ['safety'], min_severity: 'alert', ack_allowed: false, takeover_timeout_s: 120, sound: false },
  frame: { enabled: false, folder: null, idle_min: 10, interval_s: 30, fit: 'contain', clock: true, motion: 'none' },
  burn_in: { shift: true, dim_after_min: 30, dim_to: 0.6, shuffle_h: 1 },
  schedule: { windows: [], wake_on_alert_severity: 'critical', wake_on_touch: true },
  offline: { show_last_frame_s: 60, then: 'clock' },
};
type PlanCfg = { mode: string; quality: string; idle_s: string | number };
interface Mock {
  plan: PlanCfg | null; // null: a configuration from before the block existed
  floor: string | null;
  dials: Partial<typeof DEFAULT_VIEW>;
  skin: 'classic' | 'bubble';
  scheme: 'light' | 'dark';
  theme: 'dark' | 'light' | 'follow';
  circuit: 'on' | 'off';
  version: number;
  admin: boolean;
  patched: Record<string, unknown>[];
  ws: { send: (m: string) => void } | null;
  maps: number;
}
const newMock = (over: Partial<Mock> = {}): Mock => ({ plan: { mode: 'follow', quality: 'follow', idle_s: 'follow' }, floor: 'f1', dials: {}, skin: 'classic', scheme: 'dark', theme: 'dark', circuit: 'on', version: 1, admin: false, patched: [], ws: null, maps: 0, ...over });

function profile(st: Mock) {
  const config = { ...BASE_CFG, theme: st.theme, cameras: CAMS.map((c) => c.id), ...(st.plan ? { plan: st.plan } : {}) };
  return { user_id: 'u-wall', username: 'reception', display_name: 'קבלה', title: 'קבלה', area_id: null, floor_id: st.floor, enabled: true, remote_allowed: false, version: st.version, config, status: 'connected', connections: 1, last_seen_at: new Date().toISOString(), last_channel: 'local',
    created_at: '2026-10-05T08:00:00Z', updated_at: '2026-10-05T08:00:00Z', camera_names: CAMS.map((c) => c.name) };
}

async function install(page: Page, st: Mock) {
  await page.routeWebSocket(/\/api\/v1\/wall\/ws/, (ws) => {
    ws.onMessage(() => {});
    ws.send(JSON.stringify({ version: 1, type: 'hello', payload: { version: st.version, state: 'ok' } }));
    st.ws = ws;
  });
  await page.routeWebSocket(/\/api\/v1\/me\/ws/, () => {});
  await page.routeWebSocket(/\/api\/v1\/ha\/ws/, () => {});
  await page.route('**/api/v1/**', async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const perms = st.admin ? ['system.configure', 'rbac.assign', 'map.read', 'video.live', 'entity.state.read', 'devices.read'] : ['map.read', 'video.live', 'wall.view'];
    if (p === 'me') {
      return json({
        channel: 'local', remote: null, user: { id: 'u-wall', username: 'reception', display_name: 'קבלה', source: 'ingress' }, active: true,
        bindings: [{ id: 'b1', role_id: st.admin ? 'system_admin' : 'kiosk', role_name: st.admin ? 'מנהל' : 'קיוסק', scope_type: st.admin ? 'installation' : 'floor', scope_id: st.admin ? '*' : 'f1', scope_name: 'x', effect: 'allow' }],
        permissions_installation: st.admin ? perms : [], permissions_any: perms, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false,
        bootstrap_state: 'done', mode: 'full', wall: st.admin ? null : { enabled: true, profile_version: st.version },
      });
    }
    if (p === 'me/prefs') return json({ prefs: {}, stored: [], updated_at: null });
    if (p === 'settings') return json({ settings: { 'ui.design': 'a', 'ui.skin': st.skin, 'ui.scheme': st.scheme, 'ui.start_route': 'devices', 'ui.hide_map': 'false', 'ui.hide_wiskey': 'false', 'ui.hide_search': 'false', 'ui.tabs': {}, 'media.transport_default': 'mse', 'plan.quality': 'auto' }, can_edit: st.admin });
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-10-05T00:00:00Z', version: 'test' });
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    if (p === 'wall/config') {
      const pf = profile(st);
      return json({ title: pf.title, area_id: null, floor_id: st.floor, version: st.version, config: pf.config, cameras: CAMS, server_time: new Date().toISOString(), zone: 'Asia/Jerusalem', alerts: [] });
    }
    if (p.startsWith('wall/states')) return json({ states: [] });
    if (p === 'wall/profiles') return json({ profiles: [profile(st)], max_profiles: 20 });
    if (p.startsWith('wall/profiles/') && req.method() === 'PATCH') {
      const body = req.postDataJSON() as { config?: Record<string, unknown> };
      st.patched.push(body);
      return json(profile(st));
    }
    if (p === 'wall/photo-sets') return json({ sets: [], limits: { max_files: 200, max_bytes: 8388608, formats: [] } });
    if (p === 'cameras') return json({ cameras: CAMS.map((c, i) => ({ ...c, recorder_id: 'r', channel: i + 1, name_source: c.name, alias: null, enabled: true, sort_order: i })), recorder: null, can_sync: false });
    if (p.startsWith('sites')) return json({ sites: [] });
    if (p.startsWith('media/live/')) return json({ code: 'media_unavailable', user_message: 'אין מדיה' }, 503);
    if (p === 'plan-view/prefs') {
      const { default_view: _d, ...site } = { ...DEFAULT_VIEW, ...st.dials };
      return json({ site, own: {}, effective: { ...DEFAULT_VIEW, ...st.dials }, personal_dials: [], can_edit_site: false });
    }
    if (p === 'floors/f1/map') {
      st.maps++;
      return json({
        floor: { id: 'f1', building_id: 'b1', name: 'קומה 1', level: 1, sort_order: 0, ha_area_id: null, has_plan: true, published_version_id: 'pv1', plan_width_px: input.width, plan_height_px: input.height, draft_version_id: null, anchor_count: 0, camera_count: 0 },
        building: { id: 'b1', site_id: 's1', name: 'בניין', sort_order: 0, updated_at: '' }, site: { id: 's1', name: 'אתר', address: '', timezone: 'Asia/Jerusalem', sort_order: 0, updated_at: '' },
        plan: { id: 'pv1', floor_id: 'f1', asset_id: 'a1', page: 1, rotation: 0, crop: null, width_px: input.width, height_px: input.height, scale_m_per_px: 1 / 60, status: 'published', revision: 1, notes: '', created_at: '', published_at: '2026-10-01T00:00:00Z', image_url: 'plan-assets/a1/image' },
        geometry: { id: 'g1', doc_hash: 'h1', status: 'published', revision: 1, published_at: '2026-10-01T00:00:00Z' }, catalog_revision: 'rev1', levels: doc.levels,
        circuit_states: { c1: { entity_id: 'switch.c1', name: null, color_token: null, member_ids: ['dl0'], power_w: 40, state: st.circuit, known: true, fresh: true } },
        bakes: bakesWire(), anchors: [], zones, needs_alignment: false, permissions: { edit: false, publish: false, import: false, structure: false }, cameras: [],
      });
    }
    if (p.startsWith('plan-versions/pv1/geometry')) return json({ geometry: { id: 'g1', doc_hash: 'h1', status: 'published', revision: 1 }, doc, issues: [], published_hash: 'h1' });
    if (p === 'catalog/objects') return json(LIBRARY);
    const still = /^floors\/f1\/bakes\/(ld0|ld1|dd0|dd1)\/file$/.exec(p);
    if (still) return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: stillSvg(still[1].startsWith('l') ? 'light' : 'dark', still[1].endsWith('1') ? 'on' : 'off') });
    if (p === 'floors/f1/bakes/mask/file') return json(MASK);
    return json({}, 200);
  });
}

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

const band = (page: Page): Locator => page.locator('sw-wall [data-wall-map-slot]');
const stills = (page: Page): Locator => band(page).locator('sw-wall-plan [data-wall-plan="stills"] sw-plan-stills');
const live = (page: Page): Locator => band(page).locator('sw-wall-plan [data-wall-plan="live"] sw-plan-3d[kiosk]');

async function open(page: Page, st: Mock, dev: Dev = TABLET_P) {
  await install(page, st);
  await asDevice(page, dev);
  await page.goto('/?design=a#/');
  await expect(page.locator('sw-wall [data-wall-state="base"]')).toBeVisible();
}

test.describe('the plan in the map band of a portrait wall (mocked backend)', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'the device is emulated by the spec itself; one project is enough');
  });

  test('stills by the screen\'s own setting: the lit room comes from the circuit, no WebGL is drawn, nothing is operable', async ({ page }) => {
    await open(page, newMock({ scheme: 'light', plan: { mode: 'stills', quality: 'follow', idle_s: 'follow' } }));
    await expect(stills(page)).toHaveCount(1);
    await expect(band(page).locator('sw-plan-3d')).toHaveCount(0);
    await expect(stills(page).locator('svg[data-stills]')).toBeVisible();
    await expect(stills(page).locator('[data-lit-room="z0"]')).toHaveCount(1); // the lamp's circuit is on: its room shows the lights-on picture
    await expect(stills(page).locator('[data-lit-room]')).toHaveCount(1);
    expect(await stills(page).evaluate((n) => n.shadowRoot!.querySelectorAll('canvas').length)).toBe(0);
    await expect(stills(page).locator('svg[data-stills]')).toHaveAttribute('data-style', 'dark'); // the wall is dark: so is the plan, whatever the installation's scheme
    await expect(band(page)).toHaveAttribute('role', 'img');
    await shot(page, 'wall-plan-stills-dark');
  });

  test('a lamp circuit switched off leaves its room dark on the next refresh of the floor', async ({ page }) => {
    const st = newMock({ plan: { mode: 'stills', quality: 'follow', idle_s: 'follow' } });
    await open(page, st);
    await expect(stills(page).locator('[data-lit-room="z0"]')).toHaveCount(1);
    st.circuit = 'off';
    await page.evaluate(() => (document.querySelector('sw-wall')!.shadowRoot!.querySelector('sw-wall-plan') as unknown as { refresh(): Promise<void> }).refresh());
    await expect(stills(page).locator('[data-lit-room]')).toHaveCount(0);
  });

  for (const [name, plan, dials, want] of [
    ["the installation says live, the screen says stills -> stills", { mode: 'stills', quality: 'follow', idle_s: 'follow' }, { wall_display: 'live' }, 'stills'],
    ['the installation says stills, the screen follows -> stills', { mode: 'follow', quality: 'follow', idle_s: 'follow' }, { wall_display: 'stills' }, 'stills'],
    ['the installation says stills, the screen says live -> the live 3D', { mode: 'live', quality: 'follow', idle_s: 'follow' }, { wall_display: 'stills' }, 'live'],
    ['a configuration from before the block existed reads as follow', null, { wall_display: 'stills' }, 'stills'],
  ] as const) {
    test(`the screen's setting beats the installation, follow hands the dial down: ${name}`, async ({ page }) => {
      test.setTimeout(90_000);
      await open(page, newMock({ plan: plan as PlanCfg | null, dials }));
      if (want === 'stills') {
        await expect(stills(page)).toHaveCount(1);
        await expect(band(page).locator('sw-plan-3d')).toHaveCount(0);
      } else {
        await expect(live(page)).toHaveCount(1);
        await expect(live(page)).toHaveAttribute('data-ready', '', { timeout: 30_000 });
      }
    });
  }

  test('live: the bare kiosk view; the screen forces its quality over the viewer\'s own choice', async ({ page }) => {
    test.setTimeout(120_000);
    await page.addInitScript(() => { try { localStorage.setItem('sw.plan3d.quality', '2'); } catch { /* storage */ } }); // this browser's person chose "full"
    await open(page, newMock({ plan: { mode: 'live', quality: 'schematic', idle_s: 0 } }));
    const el = live(page);
    await expect(el).toHaveAttribute('data-ready', '', { timeout: 30_000 });
    await expect(el).toHaveAttribute('data-quality-mode', 'schematic');
    await expect(el).toHaveAttribute('data-quality', '1');
    await expect(el.locator('[data-3d-bar]')).toBeHidden();
    await expect(el.locator('[data-3d-strip]')).toBeHidden();
    expect(await el.evaluate((n) => (n as unknown as { idleS: number }).idleS)).toBe(0);
    expect(await el.evaluate((n) => getComputedStyle(n.shadowRoot!.querySelector('.stage') as HTMLElement).pointerEvents)).toBe('none'); // a touch on the plan is a touch on the wall
    await shot(page, 'wall-plan-live-schematic');
  });

  test('live: after the idle time the baked still takes the band and the frame loop stops; a touch wakes it', async ({ page }) => {
    test.setTimeout(150_000);
    await open(page, newMock({ plan: { mode: 'live', quality: 'schematic', idle_s: 10 } }));
    const el = live(page);
    await expect(el).toHaveAttribute('data-ready', '', { timeout: 30_000 });
    await expect(el).toHaveAttribute('data-idle', '', { timeout: 40_000 });
    await expect(el).toHaveAttribute('data-paused', '');
    await expect(el.locator('.idle-still[data-on]')).toBeVisible();
    await expect(el.locator('sw-plan-stills[slot="idle-still"] svg[data-stills]')).toBeVisible();
    await shot(page, 'wall-plan-idle-still');
    const frozen = Number((await el.getAttribute('data-frames')) ?? 0);
    await page.waitForTimeout(2500);
    expect(Number((await el.getAttribute('data-frames')) ?? 0)).toBe(frozen);
    await page.mouse.move(400, 900);
    await page.mouse.down();
    await page.mouse.up();
    await expect(el).not.toHaveAttribute('data-idle', '');
    await expect(el.locator('.idle-still[data-on]')).toHaveCount(0);
  });

  test('a profile with no floor keeps the empty surface; the band takes no copy', async ({ page }) => {
    await open(page, newMock({ floor: null }));
    await expect(band(page)).toHaveCount(1);
    await expect(band(page).locator('sw-wall-plan')).toHaveCount(0);
    await expect(band(page)).toHaveAttribute('aria-hidden', 'true');
    expect((await band(page).innerText()).trim()).toBe('');
  });

  test('a pushed configuration changes the band live: stills -> live -> stills', async ({ page }) => {
    test.setTimeout(120_000);
    const st = newMock({ plan: { mode: 'stills', quality: 'follow', idle_s: 'follow' } });
    await open(page, st);
    await expect(stills(page)).toHaveCount(1);
    await expect.poll(() => st.ws !== null).toBe(true);
    st.plan = { mode: 'live', quality: 'schematic', idle_s: 'follow' };
    st.version = 2;
    st.ws!.send(JSON.stringify({ version: 1, type: 'config', payload: { version: 2 } }));
    await expect(live(page)).toHaveCount(1, { timeout: 30_000 });
    await expect(live(page)).toHaveAttribute('data-quality-mode', 'schematic', { timeout: 30_000 });
    st.plan = { mode: 'stills', quality: 'follow', idle_s: 'follow' };
    st.version = 3;
    st.ws!.send(JSON.stringify({ version: 1, type: 'config', payload: { version: 3 } }));
    await expect(stills(page)).toHaveCount(1, { timeout: 30_000 });
    await expect(band(page).locator('sw-plan-3d')).toHaveCount(0);
  });

  for (const skin of ['classic', 'bubble'] as const) {
    for (const [scheme, theme] of [['light', 'dark'], ['dark', 'light'], ['light', 'follow']] as const) {
      test(`the plan takes the wall's theme, not the installation's: ${skin} installation ${scheme}, wall ${theme}`, async ({ page }) => {
        await open(page, newMock({ skin, scheme, theme, plan: { mode: 'stills', quality: 'follow', idle_s: 'follow' } }));
        await expect(stills(page).locator('svg[data-stills]')).toBeVisible();
        const want = theme === 'follow' ? scheme : theme;
        await expect(stills(page).locator('svg[data-stills]')).toHaveAttribute('data-style', want === 'dark' ? 'dark' : 'light');
        // the backdrop token inside the band is the wanted column's, whatever the page's scheme
        const bg = await band(page).locator('sw-wall-plan').evaluate((n) => {
          const fill = n.shadowRoot!.querySelector('.fill') as HTMLElement;
          return getComputedStyle(fill).getPropertyValue('--sw-map-bg').trim();
        });
        expect(bg.toLowerCase()).toBe(skinTable(skin)['--sw-map-bg'][want === 'dark' ? 'dark' : 'light'].toLowerCase());
        await shot(page, `wall-plan-${skin}-inst-${scheme}-wall-${theme}`);
      });
    }
  }

  test('landscape tablets have no map band', async ({ page }) => {
    await open(page, newMock(), TABLET_L);
    await expect(page.locator('sw-wall [data-wall-map-slot]')).toHaveCount(0);
  });
});

test.describe('הגדרות › מסכי קיר: the drawer\'s map section (mocked backend)', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'one project is enough for the drawer');
  });

  test('show the map, choose the plan view, the quality and the idle time; follow is the default; the PATCH carries the plan block', async ({ page }) => {
    const st = newMock({ admin: true, plan: { mode: 'follow', quality: 'follow', idle_s: 'follow' } });
    await install(page, st);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?design=a#/system/wall');
    await page.locator('system-wall [data-wall-edit="u-wall"]').first().click();
    const drawer = page.locator('sw-drawer[data-wall-drawer]');
    const map = drawer.locator('[data-wall-section="map"]');
    await expect(map).toContainText('מפה');
    // the map is shown on this mocked profile: the three dials are there, every one on "like the installation"
    await expect(map.locator('select[data-wall-field="plan-mode"]')).toHaveValue('follow');
    await expect(map.locator('select[data-wall-field="plan-quality"]')).toHaveValue('follow');
    await expect(map.locator('select[data-wall-field="plan-idle"]')).toHaveValue('follow');
    await map.locator('select[data-wall-field="plan-mode"]').selectOption('stills');
    await map.locator('select[data-wall-field="plan-quality"]').selectOption('schematic');
    await map.locator('select[data-wall-field="plan-idle"]').selectOption('120');
    await shot(page, 'wall-settings-drawer-map');
    await drawer.locator('[data-wall-save]').click();
    await expect.poll(() => st.patched.length).toBe(1);
    const plan = (st.patched[0].config as { plan: unknown }).plan;
    expect(plan).toEqual({ mode: 'stills', quality: 'schematic', idle_s: 120 }); // idle is a number on the wire, not a string
  });

  test('the toggle shows and hides the three dials; a wall with no floor says the map will not show', async ({ page }) => {
    const st = newMock({ admin: true, floor: null });
    await install(page, st);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?design=a#/system/wall');
    await page.locator('system-wall [data-wall-edit="u-wall"]').first().click();
    const map = page.locator('sw-drawer[data-wall-drawer] [data-wall-section="map"]');
    await expect(map.locator('select[data-wall-field="plan-mode"]')).toBeVisible();
    await expect(map.locator('[data-wall-map-nofloor]')).toContainText('המפה לא תוצג');
    await map.locator('sw-toggle[data-wall-field="show-map"]').click();
    await expect(map.locator('select[data-wall-field="plan-mode"]')).toHaveCount(0);
    await expect(map.locator('[data-wall-map-nofloor]')).toHaveCount(0);
  });
});
