import type { Page, Route } from '@playwright/test';

// Mocked-backend data for the guide screenshots of screens that only draw against an API session (T091 / release 0.1.149):
//   "mock-wall" - the wall arrangement dialog ("סידור הקיר", the per-camera "מוצגת" switch),
//   "mock-settings" - a settings page of an administrator (editable controls: the demo mode shows them read-only),
//   "mock-area" - an area screen with the multimedia card, an air-conditioning card and the heating card.
// All answer `api/v1/*` from page.route (no backend, no Home Assistant, no device): every name below is synthetic. They are
// used by guide-screenshots.spec.ts for a screen whose `data` field in docs/user-guide/he/screens.json says so, and follow the
// patterns of evidence-wall-hide.spec.ts and evidence-media-remote.spec.ts ("the area screen in API mode").
// "mock-area" imports the multimedia mock store by path from the page (`/src/api/media-screens-mock.ts`), so it needs the Vite
// dev server (`npm run dev`, SW_GUIDE_BASE_URL / SW_BASE_URL pointing at it); a preview of the built `dist/` has no such module.

export type MockKind = 'wall' | 'area' | 'settings';

const NOT_FOUND = { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: '', details: {} };
const MOCK_URL = '/src/api/media-screens-mock.ts';

function meBody(perms: string[]) {
  return {
    user: { id: 'u-guide', username: 'guide', display_name: 'יוני', source: 'ingress' }, channel: 'local', remote: null, bindings: [],
    permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, bootstrap_state: 'done',
  };
}

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

// ------------------------------------------------------------------------------------------------------------------ the wall

const WALL_CAMS = ['כניסה ראשית', 'לובי', 'חניה', 'אולם', 'מסדרון', 'גג'];

/** A soft synthetic "room" picture per camera (an SVG served where the snapshot JPEG would be): no real footage, no text. */
function roomSvg(i: number): string {
  const hue = 200 + i * 28;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hue} 18% 86%)"/><stop offset="1" stop-color="hsl(${hue} 14% 62%)"/></linearGradient></defs><rect width="320" height="180" fill="url(#g)"/><rect x="${40 + i * 12}" y="34" width="96" height="62" rx="4" fill="hsl(${hue} 40% 92%)" opacity=".85"/><rect x="0" y="118" width="320" height="62" fill="hsl(${hue} 12% 46%)" opacity=".55"/><rect x="${190 - i * 8}" y="92" width="86" height="36" rx="6" fill="hsl(${hue} 22% 34%)" opacity=".7"/></svg>`;
}

type WallCam = { id: string; channel: number; name: string; sort_order: number; grid_col_span: number; wall_hidden: boolean; enabled: boolean };

async function installWall(page: Page): Promise<() => Promise<void>> {
  const cams: WallCam[] = WALL_CAMS.map((name, i) => ({ id: `c${i + 1}`, channel: i + 1, name, sort_order: i, grid_col_span: 1, wall_hidden: false, enabled: true }));
  await page.addInitScript(() => {
    try {
      localStorage.setItem('sw.wall.count', '32');
      localStorage.removeItem('sw.wall.cols');
    } catch {
      /* storage unavailable */
    }
  });
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    if (p === 'me') return json(route, meBody(['video.live', 'sources.configure', 'map.read']));
    if (p === 'cameras') {
      const sorted = [...cams].sort((a, b) => a.sort_order - b.sort_order || a.channel - b.channel);
      return json(route, { cameras: sorted.map((c) => ({ ...c, recorder_id: 'r', name_source: 'nvr', alias: null, main_track: 1, sub_track: 2, status: 'online', last_seen_at: null, can_view_live: false })), recorder: null, can_sync: true, media: {} });
    }
    const m = /^cameras\/([^/]+)$/.exec(p);
    if (m && req.method() === 'PATCH') {
      Object.assign(cams.find((c) => c.id === m[1])!, req.postDataJSON());
      return json(route, cams.find((c) => c.id === m[1]));
    }
    const snap = /^cameras\/c(\d+)\/snapshot\.jpg$/.exec(p);
    if (snap) return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: roomSvg(Number(snap[1])) });
    if (p === 'settings') return json(route, { settings: { 'media.transport_default': 'mse', 'media.max_live_sessions': 16, 'media.wall_profile': 'sub', 'snapshots.max_age_s': 60 }, can_edit: false });
    return json(route, NOT_FOUND, 404);
  });
  return async () => undefined;
}

// ------------------------------------------------------------------------------------------------------------------ the area

const PERMS = ['devices.read', 'devices.control', 'devices.control_bulk', 'media.read', 'media.control', 'media.power', 'media.bulk', 'media.layout', 'system.configure'];

function row(entity_id: string, name: string, state: string, extra: Record<string, unknown> = {}) {
  return { entity_id, name, domain: entity_id.split('.')[0], device_class: null, state, available: true, fresh: true, active: state === 'playing' || state === 'on', icon: null, last_changed: '2026-09-30T18:00:00Z', can_control: true, ...extra };
}

const emptyCounts = { entities: 0, lights: 0, lights_on: 0, switches: 0, switches_on: 0, covers: 0, covers_open: 0, climate: 0, climate_active: 0, heating: 0, heating_active: 0, media: 0, media_on: 0, locks: 0, locks_locked: 0, alarm: null, cameras: 0, sensors: 0 };

function areaDetail() {
  const card = (id: string, label: string, entities: unknown[], active = entities.length) => ({ id, label, entities, count: entities.length, active });
  const ac = (id: string, name: string, mode: string, action: string, cur: number, target: number) =>
    row(`climate.${id}`, name, mode, { hvac_mode: mode, hvac_action: action, climate_kind: 'ac', current_temperature: cur, target_temperature: target, hvac_modes: ['off', 'cool', 'heat', 'dry', 'fan_only', 'auto'], min_temp: 16, max_temp: 30, target_temp_step: 1, active: mode !== 'off' });
  const heater = row('climate.living_floor_heat', 'חימום תת-רצפתי סלון', 'heat', { hvac_mode: 'heat', hvac_action: 'heating', climate_kind: 'heating', current_temperature: 22.5, target_temperature: 24, hvac_modes: ['off', 'heat'], min_temp: 10, max_temp: 35, target_temp_step: 1, active: true });
  const media = [
    row('media_player.living_tv_vendor', 'טלוויזיה סלון', 'playing', { device_class: 'tv', media_title: 'סדרה' }),
    row('media_player.living_tv_cast', 'טלוויזיה סלון (הקרנה)', 'playing', { device_class: 'tv' }),
    row('media_player.living_amp', 'מגבר סלון', 'on', { device_class: 'receiver' }),
    row('media_player.kitchen_radio', 'רמקול מטבח', 'off', { device_class: 'speaker' }),
  ];
  const lights = [row('light.living_ceiling', 'תקרה', 'on', { brightness_pct: 80 }), row('light.living_corner', 'פינת ישיבה', 'on', { brightness_pct: 45 }), row('light.living_shelf', 'מדפים', 'off', { brightness_pct: 0 })];
  return {
    area: { area_id: 'living', name: 'סלון', icon: null, floor_id: 'g', floor_name: 'קומת קרקע', level: 0 },
    floor_areas: [{ area_id: 'living', name: 'סלון', icon: null, counts: { ...emptyCounts, entities: 9 } }],
    cards: {
      lighting: card('lighting', 'תאורה', lights, 2),
      switches: card('switches', 'מתגים', []),
      climate: card('climate', 'מיזוג', [ac('living_ac_1', 'מזגן סלון', 'cool', 'cooling', 25, 23), ac('living_ac_2', 'מזגן פינת אוכל', 'off', 'off', 25, 23)], 1),
      heating: card('heating', 'חימום', [heater], 1),
      covers: card('covers', 'תריסים', []),
      security: card('security', 'אבטחה', []),
      media: card('media', 'מסכים', media, 2),
      sensors: card('sensors', 'חיישנים', []),
    },
    counts: { ...emptyCounts, entities: 9, lights: 3, lights_on: 2, climate: 2, climate_active: 1, heating: 1, heating_active: 1, media: 4, media_on: 2 },
    scoped: false,
    can_bulk: true,
    sync: { connected: true, last_snapshot_at: '2026-09-30T18:00:00Z', last_event_at: '2026-09-30T18:00:00Z', last_registry_at: null },
  };
}

/** The app as an API session whose `/multimedia/*` and `/devices/actions/*` answers come from the multimedia mock store of a second
 * page (the same store the demo mode uses), and whose area screen is `areaDetail()`. */
async function installArea(page: Page): Promise<() => Promise<void>> {
  const holder = await page.context().newPage();
  await holder.goto('./');
  await holder.waitForFunction(() => !!customElements.get('media-remote'));
  await holder.evaluate(async (url) => (await import(/* @vite-ignore */ url)).resetMediaMock(), MOCK_URL);
  await holder.evaluate(async (url) => {
    const m = (await import(/* @vite-ignore */ url)).mediaMock();
    const k = m.rows.find((r: { device: { key: string } }) => r.device.key === 'md-kitchen').device;
    k.area_id = 'living';
    k.area_name = 'סלון';
    k.floor_id = 'g';
  }, MOCK_URL);
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    if (p === 'me') return json(route, meBody(PERMS));
    if (p === 'devices/areas/living') return json(route, areaDetail());
    if (p.startsWith('multimedia/') || p.startsWith('devices/actions/')) {
      const body = req.postDataJSON?.() ?? null;
      const out = await holder.evaluate(
        async ([murl, m, path, q]) => {
          const s = (await import(/* @vite-ignore */ murl)).mediaMock();
          try {
            if (path === 'multimedia/status') return { ok: await s.status() };
            if (path === 'multimedia/devices') return { ok: await s.list(q) };
            const x = /^multimedia\/devices\/([^/]+)$/.exec(path);
            if (x) return { ok: await s.get(decodeURIComponent(x[1])) };
            if (path === 'multimedia/remote-default') return { ok: await s.remoteDefault() };
            if (path === 'multimedia/layout' && m === 'GET') return { ok: { installation: s.layoutState.layout, personal: null, revision: s.layoutState.revision, can_edit: true, can_personalize: true } };
            return { fail: { status: 404, body: { code: 'not_found', user_message: 'nf', retryable: false, correlation_id: 'x', details: {} } } };
          } catch (e) {
            const er = e as { status?: number; body?: unknown };
            return { fail: { status: er.status ?? 500, body: er.body ?? { code: 'error', user_message: String(e), retryable: false, correlation_id: 'x', details: {} } } };
          }
        },
        [MOCK_URL, req.method(), p, Object.fromEntries(url.searchParams), body] as const,
      );
      if ((out as { fail?: { status: number; body: unknown } }).fail) return json(route, (out as { fail: { status: number; body: unknown } }).fail.body, (out as { fail: { status: number } }).fail.status);
      return json(route, (out as { ok: unknown }).ok);
    }
    return json(route, NOT_FOUND, 404);
  });
  return async () => {
    await holder.close();
  };
}

// ------------------------------------------------------------------------------------------------------------------ settings

/** The settings page as an administrator sees it: `/me` with system.configure and `/settings` with can_edit, every other read 404. */
async function installSettings(page: Page): Promise<() => Promise<void>> {
  await page.route('**/api/v1/**', async (route) => {
    const p = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1\//, '');
    if (p === 'me') return json(route, meBody(['system.configure', 'devices.read', 'map.read', 'video.live', 'access.read', 'audit.read', 'sources.configure']));
    if (p === 'settings') return json(route, { settings: { 'ui.design': 'a', 'devices.style': 'glass', 'devices.scheme': 'light' }, can_edit: true });
    return json(route, NOT_FOUND, 404);
  });
  return async () => undefined;
}

/** Installs the mocked API for `kind` on `page`; returns the cleanup to call after the screenshot. */
export function installMock(page: Page, kind: MockKind): Promise<() => Promise<void>> {
  return kind === 'wall' ? installWall(page) : kind === 'settings' ? installSettings(page) : installArea(page);
}
