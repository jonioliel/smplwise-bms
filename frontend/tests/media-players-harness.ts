import { type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApiError } from '../src/api/client';
import { resetMediaMock, type MediaMockStore } from '../src/api/media-screens-mock';
import { mediaAdmin, resetMediaAdminDemo } from '../src/api/media-admin';
import type { AdminDevice, AdminDevicePatch } from '../src/api/media-admin';
import { PLAYER_KINDS, type PlayerDevice, type PlayerKind } from '../src/api/media-players';
import { resetPlayersMock, type MockHouse, type PlayersMockStore } from '../src/api/media-players-mock';

// CR-016 S2: one harness for the players specs. Static preview + a MOCKED backend (page.route on api/v1, like
// evidence-media-screens.spec.ts): the routes are answered by the S0 client's own MOCK stores (players: src/api/media-players-mock.ts,
// two houses; screens: src/api/media-screens-mock.ts for the shared layout document), so the shapes are the contract's. What is
// checked is what the pages do with the permissions and answers they are given and what they send. The server's rules are S1's tests.

export const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/CR-016/s2');
export const SIZES = { '1440': { width: 1440, height: 900 }, '820': { width: 820, height: 1180 }, '390': { width: 390, height: 844 } } as const;
export type Size = keyof typeof SIZES;

export const BASE = ['devices.read', 'map.read', 'entity.state.read', 'events.read', 'video.live'];
export const VIEW_ONLY = [...BASE, 'media.read'];
export const OPERATOR = [...VIEW_ONLY, 'media.control', 'media.power', 'media.group'];
export const EDITOR = [...OPERATOR, 'media.layout'];
export const ADMIN = [...OPERATOR, 'access.read', 'media.public', 'media.bulk', 'media.layout', 'screen.personalize', 'system.configure', 'sources.configure', 'audit.read'];

export interface Call { method: string; path: string; body: unknown }
export interface St {
  perms: string[];
  house: MockHouse;
  players: PlayersMockStore;
  screens: MediaMockStore;
  scheme: 'light' | 'dark';
  enabled: boolean;
  emptyList: boolean;
  failList: boolean;
  listDelay: number;
  /** answer every player command with 429 rate_limited */
  rateLimit: boolean;
  /** MA unavailable: `library.state` */
  library: 'ready' | 'none' | 'unavailable' | null;
  calls: Call[];
  /** the settings' admin list (built from the players store, plus two new unapproved devices) */
  admin: AdminDevice[];
  answered: Set<string>;
  hidden: Set<string>;
  actionStatus: 'confirmed' | 'unknown';
}

export const fresh = (perms: string[], house: MockHouse = 'ma'): St => {
  resetMediaAdminDemo();
  return {
    perms, house, players: resetPlayersMock(house), screens: resetMediaMock(), scheme: 'light', enabled: true, emptyList: false, failList: false, listDelay: 0, rateLimit: false,
    library: null, calls: [], admin: [], answered: new Set(), hidden: new Set(), actionStatus: 'confirmed',
  };
};

/** The settings' device list from the players store: every device approved, plus two new ones waiting (invented). */
export async function buildAdmin(st: St): Promise<AdminDevice[]> {
  const list = (await st.players.list()).devices;
  const ep = (id: string, platform: string, role: AdminDevice['endpoints'][number]['role'], rule: string, hidden: boolean, primary: AdminDevice['endpoints'][number]['primary_for'] = []) => ({
    endpoint_id: `ha:media_player.${id}`, platform, role, rule, link_source: 'auto' as const, hidden, primary_for: primary,
  });
  const out = list.map((d): AdminDevice => {
    const id = d.key.slice(3);
    const ma = d.music_provider === 'ma';
    const endpoints = [
      ep(`${id}_music`, d.music_provider === 'sonos' ? 'sonos' : d.music_provider === 'heos' ? 'heos' : ma ? 'music_assistant' : 'cast', d.music_provider === 'none' ? 'cast' : 'music', d.music_provider === 'none' ? '1' : '2b', false, d.music_provider === 'none' ? ['volume', 'now_playing'] : ['power', 'volume', 'now_playing']),
      ...(id === 'per' || id === 'liv' ? [ep(`${id}_cast`, 'cast', 'cast', '3b', true)] : []),
    ];
    return {
      key: d.key, name: d.name, kind: d.kind, kind_source: 'auto', approved: true, public: false, profile: 'generic', profile_source: 'auto',
      confidence: id === 'per' || id === 'balc' ? 'weak' : d.music_provider === 'none' ? 'strong' : 'exact', anchor_entity_id: `media_player.${id}`,
      floor_name: d.floor_name, area_name: d.area_name, area_id: d.area_id, audio_link_key: null, audio_default: 'screen', volume_max: d.volume_max, volume_night: d.volume_night,
      music_provider: d.music_provider, zones: d.zones?.map((z) => ({ id: z.id, name: z.name })) ?? null, model_keys: [], also_turns_on: [], endpoints,
    };
  });
  const fresh2 = (key: string, name: string, kind: PlayerKind, platform: string): AdminDevice => ({
    key, name, kind, kind_source: 'auto', approved: false, public: false, profile: 'generic', profile_source: 'auto', confidence: 'weak', anchor_entity_id: `media_player.${key.slice(3)}`,
    floor_name: null, area_name: null, area_id: null, audio_link_key: null, audio_default: 'screen', volume_max: null, volume_night: null, music_provider: 'none', zones: null, model_keys: [], also_turns_on: [],
    endpoints: [ep(key.slice(3), platform, 'cast', '1', false, ['volume'])],
  });
  const screens = (await mediaAdmin().list()).devices.filter((d) => d.kind === 'screen');
  return [...screens, ...out, fresh2('mp-new1', 'רמקול חדש שזוהה', 'speaker', 'cast'), fresh2('mp-new2', 'נגן חדש שזוהה', 'player', 'dlna_dmr')];
}

/** The contract's `can` of this caller for one device (the mock store says yes to everything). */
export function forCaller(st: St, d: PlayerDevice): PlayerDevice {
  const has = (p: string) => st.perms.includes(p);
  return { ...d, can: { control: has('media.control'), power: has('media.power'), public_ok: true, bulk: has('media.bulk'), group: has('media.group') && d.caps.group } };
}

export async function install(page: Page, st: St) {
  st.admin = await buildAdmin(st);
  await page.route('**/api/v1/**', async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    const body = req.postData() ? (req.postDataJSON() as unknown) : null;
    if (p.startsWith('multimedia') || p.startsWith('me/prefs') || p.startsWith('devices/actions') || p.startsWith('ha/actions')) st.calls.push({ method, path: p + url.search, body });
    const json = (b: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    const err = (status: number, code: string, msg: string, details: Record<string, unknown> = {}) => json({ code, user_message: msg, retryable: false, correlation_id: '', details }, status);
    const has = (perm: string) => st.perms.includes(perm);
    const guard = async <T>(fn: () => Promise<T>): Promise<T | null> => {
      try {
        return await fn();
      } catch (e) {
        if (e instanceof ApiError) {
          await err(e.status, e.code, e.body.user_message, (e.body.details ?? {}) as Record<string, unknown>);
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
      if (p === 'me/prefs' && method === 'GET') return json({ prefs: { 'nav.order': ['devices', 'security', 'explore', 'multimedia', 'wiskey'] }, stored: [], updated_at: null });
      if (p === 'me/prefs' && method === 'PUT') return json({ prefs: { 'nav.order': [] }, stored: [], updated_at: null });
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
        const s = await st.players.status();
        const none = st.emptyList;
        return json({
          ...s, enabled: st.enabled,
          can: { read: has('media.read'), control: has('media.control'), power: has('media.power'), public: has('media.public'), bulk: has('media.bulk'), layout: has('media.layout'), configure: has('system.configure'), personalize: has('screen.personalize'), group: has('media.group') },
          counts: { ...s.counts, screens: 8, players: none ? 0 : s.counts.players, groups: none ? 0 : s.counts.groups, pending_approval: has('system.configure') ? 2 : null },
          library: st.library ? { provider: st.library === 'ready' ? s.library.provider : 'none', state: st.library } : s.library,
        });
      }
      if (p === 'multimedia/devices') {
        if (st.listDelay) await new Promise((r) => setTimeout(r, st.listDelay));
        if (st.failList) return err(500, 'internal', 'שגיאה בטעינת הנגנים');
        if (st.emptyList) return json({ devices: [] });
        const kinds = (url.searchParams.get('kind') ?? 'screen').split(',') as PlayerKind[];
        if (kinds.includes('screen') && kinds.length === 1) return json(await st.screens.list({}));
        const r = await st.players.list({
          kind: kinds.filter((k) => PLAYER_KINDS.includes(k)), floor: url.searchParams.get('floor') ?? undefined, area: url.searchParams.get('area') ?? undefined,
          q: url.searchParams.get('q') ?? undefined, state: (url.searchParams.get('state') ?? undefined) as never,
        });
        return json({ devices: r.devices.map((d) => forCaller(st, d)) });
      }
      const dev = /^multimedia\/devices\/([^/]+)(\/commands|\/up-next|\/library)?$/.exec(p);
      if (dev && !dev[2] && method === 'GET') {
        const r = await guard(() => st.players.get(decodeURIComponent(dev[1])));
        return r ? json(forCaller(st, r)) : undefined;
      }
      if (dev && dev[2] === '/commands' && method === 'POST') {
        if (!has('media.control') && !has('media.power')) return err(403, 'forbidden', 'אין הרשאה');
        if (st.rateLimit) return err(429, 'rate_limited', 'יותר מדי לחיצות');
        const r = await guard(() => st.players.command(decodeURIComponent(dev[1]), body as never));
        return r ? json(r, 202) : undefined;
      }
      if (dev && dev[2] === '/up-next') {
        const r = await guard(() => st.players.upNext(decodeURIComponent(dev[1])));
        return r ? json(r) : undefined;
      }
      if (dev && dev[2] === '/library') {
        const r = await guard(() => st.players.library(decodeURIComponent(dev[1]), (url.searchParams.get('kind') ?? 'favourites') as never));
        return r ? json(r) : undefined;
      }
      if (p === 'multimedia/groups' && method === 'GET') return json({ groups: await st.players.groups() });
      if (p === 'multimedia/groups/join') {
        if (!has('media.group')) return err(403, 'forbidden', 'אין הרשאה');
        const r = await guard(() => st.players.join(body as never));
        return r ? json(r, 202) : undefined;
      }
      if (p === 'multimedia/groups/leave') {
        if (!has('media.group')) return err(403, 'forbidden', 'אין הרשאה');
        const r = await guard(() => st.players.leave(body as never));
        return r ? json(r, 202) : undefined;
      }
      const gv = /^multimedia\/groups\/([^/]+)\/volume$/.exec(p);
      if (gv) {
        if (st.rateLimit) return err(429, 'rate_limited', 'יותר מדי לחיצות');
        const r = await guard(() => st.players.groupVolume(decodeURIComponent(gv[1]), body as never));
        return r ? json(r, 202) : undefined;
      }
      if (p === 'multimedia/groups/presets' && method === 'GET') return json({ presets: await st.players.presets() });
      if (p === 'multimedia/groups/presets' && method === 'POST') {
        if (!has('media.layout')) return err(403, 'forbidden', 'אין הרשאה');
        const r = await guard(() => st.players.createPreset(body as never));
        return r ? json(r, 201) : undefined;
      }
      const pre = /^multimedia\/groups\/presets\/([^/]+)(\/apply)?$/.exec(p);
      if (pre && pre[2] && method === 'POST') {
        if (!has('media.group')) return err(403, 'forbidden', 'אין הרשאה');
        const r = await guard(() => st.players.applyPreset(pre[1], body as never));
        return r ? json(r, 202) : undefined;
      }
      if (pre && method === 'PUT') {
        if (!has('media.layout')) return err(403, 'forbidden', 'אין הרשאה');
        const b = body as { base_revision: number } & Record<string, never>;
        const r = await guard(() => st.players.savePreset(pre[1], b as never, b.base_revision));
        return r ? json(r) : undefined;
      }
      if (pre && method === 'DELETE') {
        if (!has('media.layout')) return err(403, 'forbidden', 'אין הרשאה');
        const r = await guard(() => st.players.deletePreset(pre[1], Number(url.searchParams.get('base_revision'))));
        return r === null && false ? undefined : route.fulfill({ status: 204 });
      }
      if (p === 'multimedia/favourites' && method === 'GET') return json(await st.players.favourites());
      if (p === 'multimedia/favourites' && method === 'PUT') {
        if (!has('media.layout')) return err(403, 'forbidden', 'אין הרשאה');
        const b = body as { base_revision: number; kinds_on: never; items: never };
        const r = await guard(() => st.players.saveFavourites({ kinds_on: b.kinds_on, items: b.items }, b.base_revision));
        return r ? json(r) : undefined;
      }
      if (p === 'multimedia/layout' && method === 'GET') {
        return json({ installation: st.screens.layoutState.layout, personal: null, revision: st.screens.layoutState.revision, can_edit: has('media.layout'), can_personalize: false });
      }
      if (p === 'multimedia/layout' && method === 'PUT') {
        if (!has('media.layout')) return err(403, 'forbidden', 'אין הרשאה');
        const b = body as { layout: never; base_revision: number };
        const r = await guard(() => st.screens.saveLayout(b.layout, b.base_revision));
        return r ? json({ ...r, personal: null }) : undefined;
      }
      if (p === 'multimedia/layout' && method === 'DELETE') {
        await st.screens.resetLayout();
        return route.fulfill({ status: 204 });
      }
      if (p === 'multimedia/remote-default') return json(await st.screens.remoteDefault());
      if (p === 'multimedia/actions/preview') return json(await st.players.pausePreview(url.searchParams.get('scope') as never, url.searchParams.get('id') ?? ''));
      if (p === 'multimedia/actions' && method === 'POST') {
        const b = body as { scope: never; id: string; client_request_id: string; kind: string };
        if (!has('media.bulk')) return err(403, 'forbidden', 'אין הרשאה');
        return json(await st.players.pauseRun(b.scope, b.id, b.client_request_id, ''), 202);
      }
      if (p.startsWith('devices/actions/mock-pause')) return err(404, 'not_found', 'לא נמצא');
      const rec = /^devices\/actions\/(mock-[^/]+)$/.exec(p);
      if (rec) {
        const r = await guard(() => st.players.groupRecord(rec[1]));
        return r ? json(r) : undefined;
      }
      // CR-016 phase 2b: the full queue, the library tab, the direct connection (CR §17.7)
      const qd = /^multimedia\/devices\/([^/]+)\/(queue|browse)$/.exec(p);
      if (qd && qd[2] === 'queue' && method === 'GET') {
        const off = url.searchParams.get('offset');
        const r = await guard(() => st.players.queue(decodeURIComponent(qd[1]), off !== null ? Number(off) : undefined));
        return r ? json(r) : undefined;
      }
      if (qd && qd[2] === 'queue' && method === 'POST') {
        const r = await guard(() => st.players.queueEdit(decodeURIComponent(qd[1]), body as never));
        return r ? json(r, 202) : undefined;
      }
      if (qd && qd[2] === 'browse') {
        const r = await guard(() => st.players.browse(decodeURIComponent(qd[1]), (url.searchParams.get('type') ?? 'track') as never, url.searchParams.get('q') ?? undefined, Number(url.searchParams.get('offset') ?? 0)));
        return r ? json(r) : undefined;
      }
      if (p === 'multimedia/admin/ma-connection' && method === 'GET') {
        if (!has('system.configure')) return err(403, 'forbidden', 'אין הרשאה');
        return json(await st.players.maConnection());
      }
      if (p === 'multimedia/admin/ma-connection' && method === 'PUT') {
        if (!has('system.configure')) return err(403, 'forbidden', 'אין הרשאה');
        const r = await guard(() => st.players.saveMaConnection(body as never));
        return r ? json(r) : undefined;
      }
      if (p === 'multimedia/admin/ma-connection/test' && method === 'POST') {
        if (!has('system.configure')) return err(403, 'forbidden', 'אין הרשאה');
        return json(await st.players.testMaConnection());
      }
      // the settings' routes
      if (p === 'multimedia/admin/devices' && method === 'GET') {
        const kinds = url.searchParams.get('kind');
        if (kinds) return json(await st.players.nonPhysical());
        return json({ devices: st.admin, suggestions: [] });
      }
      const adm = /^multimedia\/admin\/devices\/([^/]+)$/.exec(p);
      if (adm && method === 'PUT') {
        const d = st.admin.find((x) => x.key === decodeURIComponent(adm[1]));
        if (!d) return err(404, 'not_found', 'לא נמצא');
        const patch = body as AdminDevicePatch;
        if (patch.display_name !== undefined) d.name = patch.display_name?.trim() || d.name;
        if (patch.kind) d.kind = patch.kind;
        if (patch.approved !== undefined) d.approved = patch.approved;
        if (patch.audio_link_key !== undefined) d.audio_link_key = patch.audio_link_key;
        if (patch.volume_max !== undefined) d.volume_max = patch.volume_max;
        if (patch.volume_night !== undefined) d.volume_night = patch.volume_night;
        if (patch.area_id !== undefined) {
          d.area_id = patch.area_id;
          d.area_name = patch.area_id ? ({ living: 'סלון', balcony: 'מרפסת', kitchen: 'מטבח' } as Record<string, string>)[patch.area_id] ?? patch.area_id : null;
        }
        return json(d);
      }
      if (p === 'multimedia/admin/links') {
        const b = body as { op: 'link' | 'unlink' | 'ignore' | 'restore'; endpoint_id: string; device_key?: string };
        // `ignore` + the row's device dismisses that merge suggestion only; a plain `ignore` hides the endpoint (the CR-015 meaning)
        if (!(b.op === 'ignore' && b.device_key)) for (const d of st.admin) for (const e of d.endpoints) if (e.endpoint_id === b.endpoint_id) e.hidden = b.op === 'ignore' ? true : b.op === 'restore' ? false : e.hidden;
        if (b.op === 'link' || b.op === 'ignore') st.players.answerSuggestion(b.op, b.endpoint_id, b.device_key);
        return json({ devices: st.admin });
      }
      if (p === 'multimedia/admin/approve') {
        // by key, or - without keys - every detected device of the named kinds (the server's `kinds`, "אשר את כל הנגנים שזוהו")
        const b = body as { device_keys?: string[]; approved?: boolean; kinds?: string[] };
        const approved = b.approved !== false;
        const hit = st.admin.filter((d) => (b.device_keys ? b.device_keys.includes(d.key) : (b.kinds ?? ['screen']).includes(d.kind)));
        let changed = 0;
        for (const d of hit) if (d.approved !== approved) { d.approved = approved; changed += 1; }
        const players = st.admin.filter((d) => ['speaker', 'player', 'receiver', 'group'].includes(d.kind));
        return json({ requested: hit.length, changed, approved: st.admin.filter((d) => d.kind === 'screen' && d.approved).length, pending_approval: st.admin.filter((d) => d.kind === 'screen' && !d.approved).length,
          ...(b.kinds?.length ? { approved_players: players.filter((d) => d.approved).length, pending_players: players.filter((d) => !d.approved).length } : {}) });
      }
      if (p === 'multimedia/admin/suggestions') return json({ suggestions: await st.players.suggestions() });
      if (p === 'multimedia/admin/areas') return json({ areas: [] });
      if (p.startsWith('ha/actions/')) return json({ id: p.split('/').pop(), entity_id: 'media_player.demo', action_id: 'media_player.media_pause', status: st.actionStatus, error: null, requested_at: '', confirmed_at: null });
      if (p === 'devices/tree') {
        const areas = (ids: [string, string][]) => ids.map(([area_id, name]) => ({ area_id, name, icon: null, floor_id: null, floor_name: null, level: null, counts: {} }));
        return json({
          floors: [
            { floor_id: 'g', name: 'קומת קרקע', level: 0, icon: null, areas: areas([['living', 'סלון'], ['balcony', 'מרפסת']]), counts: {}, climate: [] },
            { floor_id: 'u1', name: 'קומה 1', level: 1, icon: null, areas: [], counts: {}, climate: [] },
            { floor_id: 'b', name: 'מרתף', level: -1, icon: null, areas: [], counts: {}, climate: [] },
          ], scoped: false,
        });
      }
      // the shell's own reads
      if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-10-01T00:00:00Z', version: 'test' });
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

export const hashOf = (page: Page) => page.evaluate(() => location.hash);

export async function open(page: Page, hash: string, size: Size = '1440') {
  await page.setViewportSize(SIZES[size]);
  await page.goto('about:blank');
  await page.goto(`/?design=a#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(450);
}

export async function shot(page: Page, name: string, size: Size) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.waitForTimeout(400); // let the entrance / glow settle
  await page.screenshot({ path: path.join(OUT, `${name}-${size}.png`) });
}

export const playersPage = (page: Page) => page.locator('sw-app multimedia-players');
export const groupsPage = (page: Page) => page.locator('sw-app multimedia-groups');
export const pcards = (page: Page) => page.locator('sw-app multimedia-players media-player-card');
export const sectionIds = (page: Page) => playersPage(page).locator('section[data-group]').evaluateAll((els) => els.map((e) => e.getAttribute('data-group')));
