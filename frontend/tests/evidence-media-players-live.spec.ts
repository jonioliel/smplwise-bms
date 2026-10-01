import { test, expect, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * CR-016 (S4) live evidence for multimedia phase 2 - players, speakers, groups - against a THROWAWAY backend started by
 * tests/fixtures/media_fake_ha.py (the real backend with a fake Home Assistant and a fake bridge; never the lab, never a
 * real Home Assistant or Music Assistant). Written against the contract (docs/architecture/MEDIA_PLAYERS_API.md, section 3) before
 * S1-S3 merged, so it is staged like the CR-015 spec:
 *
 *   part A  "the fixture"   runs on any backend: both houses seed, the group / queue / library shapes of the fake bridge, the
 *                           bridge 0.5.0 services, the registry write. Runs today.
 *   part B  "the players API" needs the CR-016 routes (S1). Without them it is SKIPPED with the reason ("S1 not merged"), never green.
 *                           Asserts the model: one device per physical thing, groups by the union rule, caps from live endpoints, up
 *                           next, favourites, the command and group paths with honest per-room outcomes.
 *   part C  "the screens"   needs the tabs, the cards, the panel and the settings sections (S2 / S3). SKIPPED with the reason when the
 *                           UI is absent. The locators are in SEL below, taken from MEDIA_PLAYERS_API.md section 5 and the mockup
 *                           (docs/design/mockups/media/players-index.html); a locator that no longer matches fails by its name.
 *
 * UNVERIFIED until S1-S3 merge: part B and C have never met a server that implements the contract. The first run will tell which
 * assertion was a guess (envelope names, response keys, locator names); each one says what it checks.
 *
 * One house per run, one throwaway backend per house (the registry of the previous house would stay in the backend's own tables):
 *   SW_PORT=4481 SW_DATA_DIR=<empty dir> SW_DEV_USER=joni SW_BOOTSTRAP_ADMIN=joni SW_FAKE_HOUSE=ma \
 *       <repo>/.venv/Scripts/python.exe frontend/tests/fixtures/media_fake_ha.py          (the control server is SW_PORT + 1)
 *   SW_LIVE=1 SW_MEDIA_FIXTURE=1 SW_HOUSE=ma SW_API_PORT=4481 SW_BASE_URL=http://127.0.0.1:4191/ \
 *       npx playwright test tests/evidence-media-players-live.spec.ts --workers=1
 *   (then the same with SW_HOUSE=sonos, SW_FAKE_HOUSE=sonos and ports 4484 / 4485)
 * Part B runs once, in the desktop project (it changes the model); part C draws 1440 / 820 / 390 when SW_SHOTS=<dir>
 * (docs/design/evidence/CR-016 for the committed set).
 */
const SHOTS = process.env.SW_SHOTS ?? '';
const HOUSE = (process.env.SW_HOUSE ?? 'ma') as 'ma' | 'sonos';
const CONTROL = `http://127.0.0.1:${process.env.SW_FAKE_HA_CONTROL_PORT ?? String(Number(process.env.SW_API_PORT ?? '8099') + 1)}`;
const API = '/api/v1';

// ------------------------------------------------------------------------------------------------ the houses (mirror fixtures/media_fake_ha.py)

/** Independent literals (not read from the fixture) so a drifting fixture, backend or UI is caught. `eps` = every entity of the device
 *  after the owner took the suggestions; `link` = the endpoint the wizard (or a manual link) must join into the device of `into`. */
interface Player { name: string; kind: 'speaker' | 'receiver' | 'screen' | 'group'; floor: string | null; area: string | null; eps: string[]; hidden?: string[]; link?: { endpoint: string; into: string } }
const e = (s: string) => `media_player.cr016_${s}`;
const wiim = (slug: string, name: string, area: string | null, hidden: boolean): Player => ({ name, kind: 'speaker', floor: area ? 'cr016_ground' : null, area, eps: [e(`wiim_${slug}`), e(`wiim_${slug}_cast`), e(`wiim_${slug}_ma`)], hidden: hidden ? [e(`wiim_${slug}_cast`)] : [] });
const MA_PLAYERS: Record<string, Player> = {
  wiim_living: wiim('living', 'רמקול סלון', 'cr016_living', true),
  wiim_kitchen: wiim('kitchen', 'רמקול מטבח', 'cr016_kitchen', true),
  wiim_terrace: wiim('terrace', 'רמקול פרגולה', 'cr016_terrace', true),
  wiim_study: wiim('study', 'WiiM Amp-4F2A', null, false),
  mini: { name: 'רמקול משרד', kind: 'speaker', floor: 'cr016_upper', area: 'cr016_office', eps: [e('mini_cast'), e('mini_ma')] },
  nest: { name: 'רמקול חדר שינה', kind: 'speaker', floor: 'cr016_upper', area: 'cr016_bedroom', eps: [e('nest_cast'), e('nest_ma_refuses')] },
  denon_a: { name: 'מגבר קולנוע', kind: 'receiver', floor: 'cr016_ground', area: 'cr016_living', eps: [e('denon_a'), e('denon_a_zone2'), e('denon_a_heos'), e('denon_a_ma')] },
  denon_b: { name: 'Denon B', kind: 'receiver', floor: null, area: null, eps: [e('denon_b'), e('denon_b_zone2'), e('denon_b_heos'), e('denon_b_ma')], link: { endpoint: e('denon_b_heos'), into: e('denon_b') } },
  tv1: { name: 'OLED55C3', kind: 'screen', floor: null, area: null, eps: [e('tv1_cast'), e('tv1_ma')], link: { endpoint: e('tv1_ma'), into: e('tv1_cast') } },
  tv2: { name: 'OLED55C3', kind: 'screen', floor: null, area: null, eps: [e('tv2_cast'), e('tv2_ma')], link: { endpoint: e('tv2_ma'), into: e('tv2_cast') } },
  tv3: { name: 'OLED65G3', kind: 'screen', floor: 'cr016_upper', area: 'cr016_bedroom', eps: [e('tv3_cast'), e('tv3_ma')] },
  console: { name: 'קונסולה', kind: 'speaker', floor: null, area: null, eps: [e('console_ma')] },
  old_a: { name: 'רמקול מחסן', kind: 'speaker', floor: null, area: null, eps: [e('old_a_ma')] },
  old_b: { name: 'רמקול מרתף', kind: 'speaker', floor: null, area: null, eps: [e('old_b_ma')] },
  garden: { name: 'רמקול גינה', kind: 'speaker', floor: null, area: null, eps: [e('garden_ma')] },
  group_outside: { name: 'קבוצת חוץ', kind: 'group', floor: null, area: null, eps: [e('group_outside_ma')] },
};
const sonos = (slug: string, name: string, area: string | null): Player => ({
  name, kind: 'speaker', floor: null, area, eps: [e(`sonos_${slug}${slug === 'terrace' ? '_refuses' : ''}`), e(`st_${slug}`)], hidden: [e(`st_${slug}`)], link: { endpoint: e(`st_${slug}`), into: e(`sonos_${slug}${slug === 'terrace' ? '_refuses' : ''}`) },
});
const SONOS_PLAYERS: Record<string, Player> = {
  sonos_living: sonos('living', 'סלון', 'cr016_living'), sonos_kitchen: sonos('kitchen', 'מטבח', 'cr016_kitchen'), sonos_bedroom: sonos('bedroom', 'חדר שינה', 'cr016_bedroom'),
  sonos_study: sonos('study', 'משרד', 'cr016_study'), sonos_terrace: sonos('terrace', 'מרפסת', 'cr016_terrace'), sonos_spare: sonos('spare', 'רמקול 6', null),
  tv_living: { name: 'טלוויזיה סלון', kind: 'screen', floor: null, area: 'cr016_living', eps: [e('tv_living'), 'remote.cr016_tv_living', e('st_tv_living')] },
  tv_bedroom: { name: 'טלוויזיה חדר שינה', kind: 'screen', floor: null, area: 'cr016_bedroom', eps: [e('tv_bedroom'), 'remote.cr016_tv_bedroom', e('st_tv_bedroom')] },
};
const H = HOUSE === 'ma'
  ? { players: MA_PLAYERS, rowsBefore: 19, suggestions: ['3b', '3b', '3b', '3b'], entities: 35, devices: 33, floors: 2, restoredNames: ['קונסולה', 'רמקול מחסן', 'רמקול מרתף'], nonPhysical: 0 }
  : { players: SONOS_PLAYERS, rowsBefore: 14, suggestions: ['5', '5', '5', '5', '5b'], entities: 34, devices: 31, floors: 0, restoredNames: [], nonPhysical: 13 };
const AUDIO = (Object.entries(H.players) as [string, Player][]).filter(([, p]) => p.kind !== 'screen');
const SCREENS = (Object.entries(H.players) as [string, Player][]).filter(([, p]) => p.kind === 'screen');
/** Nothing of the server's private side may reach a browser: entity ids, MACs, addresses, MA uris and image URLs, fixture identifiers. */
const PRIVATE = /\b(?:media_player|remote)\.[a-z0-9_]+|\b(?:[0-9a-f]{2}:){5}[0-9a-f]{2}\b|192\.0\.2\.|imageproxy|library:\/\/|\.invalid|provider_mappings|queue_item_id|stream_details|spotify--|media_player_proxy|token=SYNTH|cr016_(?:dev|reg|ce)_|00000000-0000-4000|RINCON_|1100000001/i;

// ------------------------------------------------------------------------------------------------ helpers

interface LogEntry { n: number; domain: string; service: string; entity_id: string; kind: string; result: string; effect: boolean; members?: string[]; media_id?: string; media_type?: string; enqueue?: string; source_player?: string; source?: string; position?: number; shuffle?: boolean; repeat?: string; volume_level?: number; area_id?: string; query?: string }
interface Group { role: 'leader' | 'member' | 'none'; leader_key: string | null; member_keys: string[]; name: string | null; static: boolean; layer: 'ma' | 'vendor' | null; conflict: boolean }
interface Dev {
  key: string; name: string; kind: string; floor_id: string | null; area_id: string | null; music_provider: string; volume_max: number | null; volume_night: { from: string; to: string; max: number } | null; virtual_members: string[] | null;
  zones: { id: string; name: string; power: string; volume: number | null }[] | null;
  live: { power: string; play: string | null; confirmed: boolean; shuffle: boolean | null; repeat: string | null; group: Group; queue: { count: number; index: number | null } | null; caps_known: boolean; now: { title: string | null; artist: string | null; album: string | null; kind: string; artwork: string | null; duration_s: number | null }; volume: { level: number | null; muted: boolean | null } };
  caps: { shuffle: boolean; repeat: boolean; group: boolean; volume_group: boolean; up_next: boolean; favourites: boolean; stations: boolean; playlists: boolean; transfer: boolean; volume_set: boolean };
  can: { control: boolean; power: boolean; group: boolean };
}
interface Row { key: string; kind: string; approved: boolean; anchor_entity_id: string; endpoints: { endpoint_id: string; platform: string; role: string; rule: string | number; hidden: boolean; primary_for: string[] }[] }
interface Suggestion { id: string; endpoint_id: string; device_key: string; rule: string; reason: string; endpoint_label: string; device_name: string }
interface Outcome { device_key: string; area_name: string | null; outcome: string; level?: number }

let prepared: { keys: Record<string, string>; rows: Row[] } | null = null;
let rid = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const newId = () => `cr016-${Date.now().toString(36)}-${(rid += 1)}`;
const expiry = (ms = 30_000) => new Date(Date.now() + ms).toISOString();
const NON_PHYSICAL = ['session', 'virtual_group', 'service'];

async function ctl<T = Record<string, any>>(request: APIRequestContext, route: string, data?: unknown): Promise<T> {
  const r = data === undefined ? await request.get(`${CONTROL}${route}`) : await request.post(`${CONTROL}${route}`, { data });
  expect(r.status(), `the fixture control server at ${CONTROL}${route} (is tests/fixtures/media_fake_ha.py the backend?)`).toBe(200);
  return (await r.json()) as T;
}
const logSince = async (request: APIRequestContext, since = 0) => ctl<{ entries: LogEntry[]; next: number; pending: number }>(request, `/media-log?since=${since}`);
const mark = async (request: APIRequestContext) => (await logSince(request)).next;
async function callsSince(request: APIRequestContext, since: number, settleMs = 200) {
  await sleep(settleMs);
  return (await logSince(request, since)).entries;
}
/** The state of a fixture entity as the add-on mirrors it (attributes the add-on keeps). */
const mirrored = async (request: APIRequestContext, entity: string) => (await (await request.get(`${API}/ha/entities/${entity}`)).json()) as { state: string; attributes: Record<string, any> };

async function post(request: APIRequestContext, url: string, body: Record<string, unknown>, headers?: Record<string, string>) {
  const r = await request.post(`${API}${url}`, { headers, data: body });
  return { status: r.status(), body: (await r.json().catch(() => ({}))) as Record<string, any> };
}
async function put(request: APIRequestContext, url: string, body: Record<string, unknown>, headers?: Record<string, string>) {
  const r = await request.put(`${API}${url}`, { headers, data: body });
  return { status: r.status(), body: (await r.json().catch(() => ({}))) as Record<string, any> };
}
const stamped = (body: Record<string, unknown>) => ({ ...body, client_request_id: newId(), expires_at: expiry() });
const cmd = (request: APIRequestContext, key: string, body: Record<string, unknown>, headers?: Record<string, string>) => post(request, `/multimedia/devices/${key}/commands`, stamped(body), headers);
async function pollAction(request: APIRequestContext, id: string, until: (s: string) => boolean, timeoutMs = 15_000) {
  const end = Date.now() + timeoutMs;
  let status = 'pending';
  while (Date.now() < end) {
    status = ((await (await request.get(`${API}/ha/actions/${id}`)).json()) as { status: string }).status;
    if (until(status)) return status;
    await sleep(250);
  }
  return status;
}
/** Waits for a group / bulk run to finish and returns the per-room outcomes (`GET /devices/actions/{bulk_id}`, CR-016 section 2). */
async function outcomes(request: APIRequestContext, bulkId: string): Promise<Outcome[]> {
  let rec: { done: boolean; items: Outcome[] } = { done: false, items: [] };
  await expect.poll(async () => { rec = (await (await request.get(`${API}/devices/actions/${bulkId}`)).json()) as typeof rec; return rec.done; }, { timeout: 30_000 }).toBe(true);
  return rec.items;
}
const byKey = (items: Outcome[], key: string) => items.find((i) => i.device_key === key)?.outcome;

const devices = async (request: APIRequestContext, query = 'kind=speaker,player,receiver,group', headers?: Record<string, string>) => ((await (await request.get(`${API}/multimedia/devices?${query}`, { headers })).json()) as { devices: Dev[] }).devices;
const device = async (request: APIRequestContext, key: string, headers?: Record<string, string>) => (await (await request.get(`${API}/multimedia/devices/${key}`, { headers })).json()) as Dev;
async function adminRows(request: APIRequestContext, query = ''): Promise<Row[]> {
  const r = await request.get(`${API}/multimedia/admin/devices${query}`);
  return r.status() === 200 ? (((await r.json()) as { devices: Row[] }).devices.filter((d) => d.endpoints.some((x) => x.endpoint_id.includes('cr016_')))) : [];
}
const suggestions = async (request: APIRequestContext): Promise<Suggestion[]> => {
  const j = (await (await request.get(`${API}/multimedia/admin/suggestions`)).json()) as Suggestion[] | { suggestions: Suggestion[] };
  return Array.isArray(j) ? j : j.suggestions;
};
const rowOf = (rows: Row[], entity: string) => rows.find((r) => r.endpoints.some((x) => x.endpoint_id === `ha:${entity}`));

/** S1 present = the CR-016 routes answer. */
const playersPresent = async (request: APIRequestContext) => (await request.get(`${API}/multimedia/groups`)).status() === 200;

async function waitModel(request: APIRequestContext): Promise<Row[]> {
  let rows: Row[] = [];
  for (let i = 0; i < 60; i += 1) {
    rows = await adminRows(request);
    const seen = new Set(rows.flatMap((r) => r.endpoints.map((x) => x.endpoint_id.replace(/^ha:/, ''))));
    if (Object.values(H.players).every((p) => seen.has(p.eps[0]) || seen.has(p.eps[1]))) return rows;
    await sleep(500);
  }
  return rows;
}
/** Seeds the house, takes the suggestions and makes the manual links (the merge wizard), approves every physical device. Idempotent. */
async function prepare(request: APIRequestContext): Promise<NonNullable<typeof prepared>> {
  if (prepared) return prepared;
  const seeded = await ctl<{ registry_ok: boolean; states_ok: boolean }>(request, '/seed-media', { house: HOUSE });
  expect(seeded.registry_ok && seeded.states_ok, 'the fixture seeded the registries and the states').toBe(true);
  await ctl(request, '/media-config', { bridge_version: '0.5.0', allow_reset: true });
  let rows = await waitModel(request);
  expect(rows.length, 'the model has one device per cluster of the automatic rungs').toBeGreaterThanOrEqual(Object.keys(H.players).length);
  for (const p of Object.values(H.players)) {
    if (!p.link) continue;
    const into = rowOf(rows, p.link.into);
    expect(into, `a device holds ${p.link.into}`).toBeTruthy();
    if (rowOf(rows, p.link.endpoint)?.key !== into!.key) {
      const r = await post(request, '/multimedia/admin/links', { op: 'link', endpoint_id: `ha:${p.link.endpoint}`, device_key: into!.key });
      expect(r.status, `link ${p.link.endpoint} into ${p.name}`).toBeLessThan(300);
    }
  }
  rows = await adminRows(request);
  const keys: Record<string, string> = {};
  for (const [slug, p] of Object.entries(H.players)) {
    const row = rowOf(rows, p.eps[0]) ?? rowOf(rows, p.eps[1]);
    expect(row, `a device was built for ${slug}`).toBeTruthy();
    keys[slug] = row!.key;
  }
  const ap = await post(request, '/multimedia/admin/approve', { device_keys: Object.values(keys), approved: true });
  expect(ap.status).toBeLessThan(300);
  prepared = { keys, rows };
  return prepared;
}
/** A fresh start for a test that changes state: the fake house again (groups, queues, volumes, states), the links and approvals stay. */
async function fresh(request: APIRequestContext) {
  await ctl(request, '/seed-media', { house: HOUSE });
  await ctl(request, '/media-config', { bridge_version: '0.5.0', allow_reset: true, join_refuse: [], query_fail: false, ma_loaded: true, search_enabled: false });
  await sleep(1200);
}

async function bindUser(request: APIRequestContext, username: string, roleId: string): Promise<string> {
  const me = await (await request.get(`${API}/me`, { headers: { 'X-SW-Dev-User': username } })).json();
  const r = await request.post(`${API}/access/bindings`, { data: { subject_kind: 'user', subject_id: me.user.id, role_id: roleId, scope_type: 'installation', scope_id: '*' } });
  expect(r.status()).toBeLessThan(300);
  return ((await r.json()) as { id: string }).id;
}
async function mkRole(request: APIRequestContext, name: string, permissions: string[], sensitive: string[] = []): Promise<string> {
  const r = await request.post(`${API}/access/roles`, { data: { name: `${name} ${Date.now()}`, description: 'CR-016 evidence', permissions, sensitive } });
  expect(r.status(), `custom role ${name} (${permissions.join(',')})`).toBeLessThan(300);
  return ((await r.json()) as { id: string }).id;
}
interface Who { user: string; headers: Record<string, string> }
const as = (user: string): Who => ({ user, headers: { 'X-SW-Dev-User': user } });

async function shot(page: Page, name: string, info: TestInfo) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}-${HOUSE}-${{ desktop: 1440, tablet: 820, mobile: 390 }[info.project.name] ?? info.project.name}.png`) });
}
async function frame(page: Page, info: TestInfo) {
  if (info.project.name === 'tablet') await page.setViewportSize({ width: 820, height: 1180 });
}

// ------------------------------------------------------------------------------------------------ UI locators (S2 / S3 components, MEDIA_PLAYERS_API.md 5)

const SEL = {
  tabs: 'sw-app [data-mm-tabs], sw-app nav[aria-label*="מולטימדיה"]',
  tab: (label: string) => `sw-app [role="tab"]:has-text("${label}"), sw-app a:has-text("${label}")`,
  card: 'media-player-card',
  cardName: (name: string) => `media-player-card:has-text("${name}")`,
  openPlayer: (name: string) => `media-player-card:has-text("${name}") button[aria-label="נגן · ${name}"]`,
  panel: 'media-player-panel',
  unplaced: 'sw-app :text("לא משויכים")',
  groupCard: '[data-mm-group-card]',
  settings: 'sw-app',
};
const SETTINGS_SECTIONS = ['נגנים ורמקולים', 'איחוד כפילויות', 'רכיבים לא פיזיים', 'קבוצות שמורות', 'מועדפים ותחנות', 'חיבור', 'הרשאות'];
const PLATFORM_WORDS = /Home Assistant|\bHA\b|Ingress|Supervisor|Music Assistant|\bMA\b|SmartThings|Jellyfin|DLNA|HEOS|Cast|MusicCast|Spotify/i;

// ================================================================================================ part A: the fixture (runs today)

test.describe(`players fixture: the ${HOUSE} house, the fake bridge 0.5.0 (real backend)`, () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the fixture backend running');
  test.skip(process.env.SW_MEDIA_FIXTURE !== '1', 'needs tests/fixtures/media_fake_ha.py as the backend (SW_MEDIA_FIXTURE=1)');

  test('the house is seeded: the registries, every enabled entity with its state, the disabled ones only in the registry', async ({ request }) => {
    const seeded = await ctl<{ registry_ok: boolean; states_ok: boolean; house: string; expect: Record<string, number>; players: Record<string, unknown> }>(request, '/seed-media', { house: HOUSE });
    expect(seeded.registry_ok && seeded.states_ok && seeded.house).toBe(HOUSE);
    expect(seeded.expect.entities).toBe(H.entities);
    expect(seeded.expect.devices).toBe(H.devices);
    expect(seeded.expect.floors).toBe(H.floors);
    expect(Object.keys(seeded.players)).toHaveLength(Object.keys(H.players).length);
    for (const p of Object.values(H.players)) {
      const m = await mirrored(request, p.eps.find((x) => x.startsWith('media_player.'))!);
      expect(m.state, `${p.name} has a state`).toBeTruthy();
    }
    if (HOUSE === 'sonos') {
      const off = (await (await request.get(`${API}/ha/entities/media_player.cr016_jf_d1`)).json()) as { disabled: boolean; state: string | null };
      expect([off.disabled, off.state], 'a disabled entity is in the registry and has no state at all').toEqual([true, null]);
    }
  });

  test('the probes\' shapes reach the add-on: four "ungrouped" encodings, the inconsistent group, restored and degraded masks', async ({ request }) => {
    await ctl(request, '/seed-media', { house: HOUSE });
    if (HOUSE === 'ma') {
      expect((await mirrored(request, e('wiim_terrace_ma'))).attributes.group_members, 'MA ungrouped: []').toEqual([]);
      expect((await mirrored(request, e('wiim_study'))).attributes.group_members, 'wiim grouped: lists both').toHaveLength(2);
      expect((await mirrored(request, e('denon_a_heos'))).attributes.group_members, 'HEOS ungrouped: the key with null').toBeNull();
      for (const absent of ['denon_a', 'mini_cast', 'wiim_living_cast']) expect((await mirrored(request, e(absent))).attributes, `${absent}: cast and denonavr never carry it`).not.toHaveProperty('group_members');
      const lists = await Promise.all(['denon_a_ma', 'denon_b_ma', 'mini_ma', 'nest_ma_refuses'].map(async (s) => (await mirrored(request, e(s))).attributes));
      expect(lists.map((a) => (a.group_members as string[]).length), 'the leader and one member list all four, two list nothing').toEqual([4, 4, 0, 0]);
      expect(new Set(lists.map((a) => a.active_queue)).size, 'but every active_queue is the leader\'s').toBe(1);
      const old = await mirrored(request, e('old_a_ma'));
      expect(old.state).toBe('unavailable');
      expect(old.attributes.supported_features, 'a restored MA player keeps the degraded mask').toBe(7795251);
      expect(old.attributes.restored).toBe(true);
    } else {
      expect((await mirrored(request, e('sonos_living'))).attributes.group_members, 'Sonos alone: [self]').toHaveLength(1);
      const st = await mirrored(request, e('st_living'));
      expect(st.attributes.supported_features, 'the SmartThings twin: the poor cloud mask').toBe(21517);
      expect((await mirrored(request, e('sonos_living'))).attributes.supported_features, 'Sonos: the full native mask').toBe(8321599);
      expect((await mirrored(request, e('helper_sonos'))).attributes, 'a helper is no group').not.toHaveProperty('group_members');
      expect((await mirrored(request, e('spotify'))).state).toBe('unavailable');
    }
  });

  test('the fake bridge drives the groups in each layer: an unjoin and a join change the leader and the members as the integration would', async ({ request }) => {
    await ctl(request, '/seed-media', { house: HOUSE });
    await ctl(request, '/media-config', { allow_extra: [['media_player', 'join'], ['media_player', 'unjoin']] });
    const exec = (service: string, data: Record<string, unknown>) => ctl<{ ok: boolean; error?: string }>(request, '/bridge-exec', { domain: 'media_player', service, data });
    if (HOUSE === 'ma') {
      expect((await exec('unjoin', { entity_id: e('nest_ma_refuses') })).ok).toBe(true);
      await expect.poll(async () => (await mirrored(request, e('denon_a_ma'))).attributes.group_members.length, { timeout: 8000 }).toBe(3);
      expect((await mirrored(request, e('nest_ma_refuses'))).attributes.group_members).toEqual([]);
      const refused = await exec('join', { entity_id: e('mini_ma'), group_members: [e('nest_ma_refuses')] });
      expect(refused.ok, 'the call is accepted ...').toBe(true);
      await sleep(900);
      expect((await mirrored(request, e('nest_ma_refuses'))).attributes.active_queue, '... the member that refuses does not join: its queue stays its own').not.toBe((await mirrored(request, e('mini_ma'))).attributes.active_queue);
      expect(await exec('join', { entity_id: e('mini_ma'), group_members: [e('mini_cast')] }), 'a Cast entity is not groupable').toEqual({ ok: false, error: 'HomeAssistantError' });
    } else {
      expect((await exec('join', { entity_id: e('sonos_living'), group_members: [e('sonos_kitchen'), e('sonos_terrace_refuses')] })).ok).toBe(true);
      await expect.poll(async () => (await mirrored(request, e('sonos_kitchen'))).attributes.group_members.length, { timeout: 8000 }).toBe(2);
      expect((await mirrored(request, e('sonos_terrace_refuses'))).attributes.group_members, 'the Sonos that refuses stays alone').toHaveLength(1);
      expect(await exec('join', { entity_id: e('sonos_living'), group_members: [e('st_study')] }), 'a SmartThings twin is no group member').toEqual({ ok: false, error: 'HomeAssistantError' });
      expect(await exec('join', { entity_id: e('helper_sonos'), group_members: [e('sonos_study')] }), 'a helper has no GROUPING').toEqual({ ok: false, error: 'HomeAssistantError' });
    }
    await ctl(request, '/media-config', { allow_reset: true });
    await ctl(request, '/seed-media', { house: HOUSE });
  });

  test('get_queue, get_library and search: the real HA shapes, the bridge\'s trimmed answers, no URL or uri a browser must never see', async ({ request }) => {
    await ctl(request, '/seed-media', { house: HOUSE });
    await ctl(request, '/media-config', { bridge_version: '0.5.0' });
    const q = (body: Record<string, unknown>) => ctl<{ service_response: Record<string, any> }>(request, '/bridge-query', { request_id: 'r-1', ...body }).then((r) => r.service_response);
    if (HOUSE === 'ma') {
      const raw = await ctl<Record<string, any>>(request, `/raw?service=get_queue&entity_id=${e('wiim_living_ma')}`);
      expect(Object.keys(raw[e('wiim_living_ma')]).sort()).toEqual(['active', 'current_index', 'current_item', 'elapsed_time', 'items', 'name', 'next_item', 'queue_id', 'repeat_mode', 'shuffle_enabled'].sort());
      expect(raw[e('wiim_living_ma')].items, '`items` is a count, never the list').toBe(4);
      expect(JSON.stringify(raw), 'the raw answer carries what the bridge must strip').toMatch(/imageproxy|stream_details|provider_mappings/);
      const queue = await q({ query: 'queue', entity_id: e('wiim_living_ma') });
      expect(queue).toMatchObject({ ok: true, provider: 'ma', result: { count: 4, index: 0, shuffle: false, repeat: 'off', current: { name: 'שיר לדוגמה א', artist: 'אמן לדוגמה' }, next: { name: 'שיר לדוגמה ב' } } });
      const lib = await q({ query: 'library', entity_id: e('wiim_living_ma'), media_type: 'radio', favorite: true, limit: 50, offset: 0, order_by: 'name' });
      expect(lib.result.items.map((i: { name: string }) => i.name)).toEqual(['תחנה לדוגמה 1', 'תחנה לדוגמה 2']);
      expect(JSON.stringify([queue, lib]), 'trimmed: no image url, no provider mapping, no queue item id').not.toMatch(/imageproxy|\.invalid|provider_mappings|queue_item_id|stream_details|192\.0\.2\./);
      expect((await q({ query: 'search', entity_id: e('wiim_living_ma'), search: 'x' })).error, 'search is phase 2b').toBe('query_not_allowed');
      expect((await q({ query: 'library', entity_id: e('wiim_living_ma'), media_type: 'radio', limit: 101 })).error).toBe('arguments_invalid');
      expect((await q({ query: 'queue', entity_id: e('wiim_living') })).error, 'a WiiM entity has no music layer').toBe('no_library');
      await ctl(request, '/media-config', { ma_loaded: false });
      expect((await q({ query: 'queue', entity_id: e('wiim_living_ma') })).error, 'no MA entry loaded: no library').toBe('no_library');
      await ctl(request, '/media-config', { ma_loaded: true, query_fail: true });
      expect((await q({ query: 'queue', entity_id: e('wiim_living_ma') })).error, 'a failed read is "לא זמין", never empty').toBe('timeout');
      await ctl(request, '/media-config', { query_fail: false });
    } else {
      const queue = await q({ query: 'queue', entity_id: e('sonos_living') });
      expect(queue).toMatchObject({ ok: true, provider: 'sonos', result: { count: 12, index: 3, current: null, next: null } });
      const fav = await q({ query: 'library', entity_id: e('sonos_living'), media_type: 'track', favorite: true });
      expect(fav.result.items.map((i: { name: string }) => i.name)).toContain('פלייליסט ערב');
      expect((await q({ query: 'library', entity_id: e('sonos_living'), media_type: 'playlist' })).result.items, 'no playlists with the Sonos provider').toEqual([]);
      expect((await q({ query: 'queue', entity_id: e('st_living') })).error, 'a cloud twin has no library').toBe('no_library');
    }
    const old = await ctl<{ service_response?: unknown; message?: string }>(request, '/bridge-query', { query: 'queue', entity_id: e(HOUSE === 'ma' ? 'wiim_living_ma' : 'sonos_living') });
    expect(old.service_response).toBeTruthy();
    await ctl(request, '/media-config', { bridge_version: '0.4.0' });
    const r = await request.post(`${CONTROL}/bridge-query`, { data: { query: 'queue', entity_id: e(HOUSE === 'ma' ? 'wiim_living_ma' : 'sonos_living') } });
    expect(r.status(), 'a bridge older than 0.5.0 does not know the service (the add-on answers bridge_outdated)').toBe(400);
    await ctl(request, '/media-config', { bridge_version: '0.5.0' });
  });

  test('placing a device writes the entity registry through the bridge and tells the sync', async ({ request }) => {
    await ctl(request, '/seed-media', { house: HOUSE });
    const entity = HOUSE === 'ma' ? e('wiim_study_ma') : e('sonos_spare');
    const area = HOUSE === 'ma' ? 'cr016_office' : 'cr016_study';
    const since = await mark(request);
    const ok = await ctl<{ ok: boolean }>(request, '/bridge-area', { entity_id: entity, area_id: area, request_id: 'r-area' });
    expect(ok.ok).toBe(true);
    await expect.poll(async () => ((await (await request.get(`${API}/ha/entities/${entity}`)).json()) as { area_id: string | null }).area_id, { timeout: 15_000 }).toBe(area);
    expect((await callsSince(request, since)).find((c) => c.kind === 'set_area')).toMatchObject({ entity_id: entity, area_id: area, result: 'ok' });
    expect((await ctl<{ ok: boolean; error?: string }>(request, '/bridge-area', { entity_id: entity, area_id: 'cr016_nowhere' })).error).toBe('area_not_found');
    await ctl(request, '/seed-media', { house: HOUSE });
  });

  test('S1 landed? the real bridge\'s allow-list carries the 0.5.0 services (skipped until it does)', async ({ request }) => {
    const missing = (await ctl<{ allowed_missing: string[] }>(request, '/status')).allowed_missing;
    test.skip(missing.length > 0, `S1 not merged: the real bridge integration does not allow ${missing.join(', ')} yet (the fixture refuses them as service_not_allowed)`);
    expect(missing).toEqual([]);
  });
});

// ================================================================================================ part B: the players API (needs S1)

test.describe(`players API on the ${HOUSE} house (needs S1: the CR-016 routes)`, () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the fixture backend running');
  test.skip(process.env.SW_MEDIA_FIXTURE !== '1', 'needs tests/fixtures/media_fake_ha.py as the backend (SW_MEDIA_FIXTURE=1)');

  const roles: string[] = [];
  const bindings: string[] = [];

  async function ready(request: APIRequestContext, info: TestInfo): Promise<NonNullable<typeof prepared>> {
    test.skip(info.project.name !== 'desktop', 'the API checks change the model and run once, in the desktop project');
    test.skip(!(await playersPresent(request)), 'S1 is not merged: GET /api/v1/multimedia/groups does not answer 200 (the CR-016 routes are missing)');
    return prepare(request);
  }

  test.afterAll(async ({ playwright }) => {
    const request = await playwright.request.newContext({ baseURL: process.env.SW_BASE_URL || 'http://127.0.0.1:4173/' });
    try {
      for (const id of bindings.splice(0)) await request.delete(`${API}/access/bindings/${id}`).catch(() => {});
      for (const id of roles.splice(0)) await request.delete(`${API}/access/roles/${id}`).catch(() => {});
      await request.post(`${CONTROL}/media-config`, { data: { bridge_version: '0.5.0', allow_reset: true, join_refuse: [], query_fail: false, ma_loaded: true, search_enabled: false } }).catch(() => {});
    } finally {
      await request.dispose();
    }
  });

  test('before the wizard: one device per cluster of the automatic rungs; the suggestions are exactly the declared ones and none is a non-physical thing', async ({ request }, info) => {
    test.skip(info.project.name !== 'desktop', 'the API checks change the model and run once, in the desktop project');
    test.skip(!(await playersPresent(request)), 'S1 is not merged: GET /api/v1/multimedia/groups does not answer 200 (the CR-016 routes are missing)');
    await ctl(request, '/seed-media', { house: HOUSE });
    await ctl(request, '/media-config', { bridge_version: '0.5.0', allow_reset: true });
    const rows = (await waitModel(request)).filter((r) => !NON_PHYSICAL.includes(r.kind));
    test.skip(rows.length < H.rowsBefore, `the wizard was already applied on this backend (${rows.length} devices, ${H.rowsBefore} expected before it): start a fresh data dir for this check`);
    expect(rows.length, 'devices the automatic rungs made').toBe(H.rowsBefore);
    const list = await suggestions(request);
    expect(list.map((s) => s.rule).sort(), 'the wizard\'s rows').toEqual([...H.suggestions].sort());
    expect(new Set(list.map((s) => s.reason))).toEqual(new Set(HOUSE === 'ma' ? ['same_model'] : ['same_name_area', 'same_name_area_one_side']));
    expect(list.every((s) => s.endpoint_label && s.device_name)).toBe(true);
    if (HOUSE === 'ma') {
      const rule = (entity: string) => String(rowOf(rows, entity)!.endpoints.find((x) => x.endpoint_id === `ha:${entity}`)!.rule);
      expect(rule(e('wiim_living_ma')), 'the MA id embeds the WiiM id').toBe('2c');
      expect(rule(e('wiim_living_cast')), 'the Cast device: manufacturer + model').toBe('3b');
      expect(rule(e('denon_a_ma')), 'the MA id EQUALS the HEOS id').toBe('2b');
      expect(rule(e('denon_a_zone2')), 'Zone2: the same HA device').toBe('1');
      expect(rule(e('mini_ma')), 'a shortened Cast model is a prefix').toBe('3b');
      expect(rule(e('tv3_ma')), 'the one TV of its model merges').toBe('3b');
      expect(rowOf(rows, e('tv1_cast'))!.key, 'two TVs of one model do NOT merge on their own').not.toBe(rowOf(rows, e('tv1_ma'))!.key);
      expect(rowOf(rows, e('denon_b'))!.key, 'receiver B: another HEOS model string, no area: no automatic link').not.toBe(rowOf(rows, e('denon_b_heos'))!.key);
    } else {
      expect(list.filter((s) => s.rule === '5').length).toBe(4);
      expect(rowOf(rows, e('sonos_spare'))!.key, 'the sixth pair has no area anywhere: never suggested').not.toBe(rowOf(rows, e('st_spare'))!.key);
      expect(rowOf(rows, e('tv_living'))!.endpoints.some((x) => x.endpoint_id === `ha:${e('st_tv_living')}` && String(x.rule) === '3b'), 'the TV twin: manufacturer + model').toBe(true);
    }
    const nonPhysical = await adminRows(request, '?kind=session,virtual_group,service');
    expect(nonPhysical.length).toBe(H.nonPhysical);
  });

  test('the wizard: take the suggestions, link the manual ones, approve - one device per physical thing, named by its room', async ({ request }, info) => {
    const p = await ready(request, info);
    const rows = await adminRows(request);
    expect(rows.filter((r) => !NON_PHYSICAL.includes(r.kind)).length, 'one device per physical thing').toBe(Object.keys(H.players).length);
    expect((await suggestions(request)).length, 'no open suggestion is left').toBe(0);
    for (const [slug, pl] of Object.entries(H.players)) {
      const row = rows.find((r) => r.key === p.keys[slug])!;
      expect(row.approved, `${slug} approved`).toBe(true);
      expect(row.kind, slug).toBe(pl.kind);
      for (const ent of pl.eps) expect(row.endpoints.some((x) => x.endpoint_id === `ha:${ent}`), `${ent} is an endpoint of ${slug}`).toBe(true);
      for (const h of pl.hidden ?? []) expect(row.endpoints.find((x) => x.endpoint_id === `ha:${h}`)!.hidden, `${h} is a hidden duplicate`).toBe(true);
    }
    if (HOUSE === 'sonos') {
      for (const slug of ['sonos_living', 'sonos_terrace', 'sonos_spare']) {
        const twin = rows.find((r) => r.key === p.keys[slug])!.endpoints.find((x) => x.endpoint_id.includes('cr016_st_'))!;
        expect(twin.role, 'the cloud twin is a mirror').toBe('mirror');
        expect(twin.primary_for, 'a mirror is never the primary of anything').toEqual([]);
      }
    }
  });

  test('one card per physical device: names, kinds, floors and rooms, the unplaced bucket, no identifier leaves the server', async ({ request }, info) => {
    const p = await ready(request, info);
    const r = await request.get(`${API}/multimedia/devices?kind=speaker,player,receiver,group`);
    expect(r.status()).toBe(200);
    const raw = await r.text();
    expect(raw, 'no entity id, MAC, address, uri or image URL in the list').not.toMatch(PRIVATE);
    const list = (JSON.parse(raw) as { devices: Dev[] }).devices;
    expect(list.map((d) => d.name).sort()).toEqual(AUDIO.map(([, pl]) => pl.name).sort());
    for (const [slug, pl] of AUDIO) {
      const d = list.find((x) => x.key === p.keys[slug])!;
      expect([d.kind, d.floor_id, d.area_id], slug).toEqual([pl.kind, pl.floor, pl.area]);
      expect('anchor_entity_id' in d, 'the anchor entity id is for system.configure only').toBe(false);
    }
    expect((await devices(request, 'kind=screen')).map((d) => d.name).sort(), 'screens stay on the screens list').toEqual(SCREENS.map(([, pl]) => pl.name).sort());
    const unplaced = await devices(request, 'kind=speaker,player,receiver,group&area=none');
    expect(unplaced.map((d) => d.name).sort(), 'the "לא משויכים" bucket').toEqual(AUDIO.filter(([, pl]) => !pl.area).map(([, pl]) => pl.name).sort());
    for (const k of Object.values(p.keys)) expect(await (await request.get(`${API}/multimedia/devices/${k}`)).text()).not.toMatch(PRIVATE);
    const st = await (await request.get(`${API}/multimedia/status`)).json();
    expect(await (await request.get(`${API}/multimedia/status`)).text()).not.toMatch(PRIVATE);
    expect(st.floors, HOUSE === 'ma' ? 'floors exist: grouped by floor' : 'no floors: grouped by area').toBe(HOUSE === 'ma');
    expect(st.counts.unplaced).toBe(AUDIO.filter(([, pl]) => !pl.area).length);
    expect(st.library.provider).toBe(HOUSE === 'ma' ? 'ma' : 'sonos');
    expect(st.bridge.players_ready).toBe(true);
    if (HOUSE === 'sonos') {
      const hidden = await devices(request, 'kind=speaker,player,receiver,group,session,virtual_group,service');
      expect(hidden.some((d) => NON_PHYSICAL.includes(d.kind)), 'sessions, helpers and the Spotify source are not devices of the operator lists').toBe(false);
      const admin = await adminRows(request, '?kind=session,virtual_group,service');
      expect(admin.map((a) => a.kind).sort(), 'listed in settings under "רכיבים לא פיזיים"').toEqual([...Array(10).fill('session'), 'service', 'virtual_group', 'virtual_group'].sort());
    }
  });

  test('capabilities come from an available endpoint only: an unavailable or restored player is "לא זמין", never a device without capabilities', async ({ request }, info) => {
    const p = await ready(request, info);
    await fresh(request);
    if (HOUSE === 'ma') {
      for (const slug of ['console', 'old_a', 'old_b', 'garden', 'tv1', 'tv3']) {
        const d = await device(request, p.keys[slug]);
        expect([d.live.caps_known, d.live.power], `${slug}: no available endpoint`).toEqual([false, 'unavailable']);
      }
      const live = await device(request, p.keys.wiim_living);
      expect(live.live.caps_known).toBe(true);
      expect(live.caps).toMatchObject({ shuffle: true, repeat: true, group: true, up_next: true, favourites: true, stations: true, playlists: true, transfer: true, volume_set: true });
      const zones = (await device(request, p.keys.denon_a)).zones!;
      expect(zones.map((z) => z.name).length, 'a receiver with Main and Zone2 is ONE device').toBe(2);
      const cast = await device(request, p.keys.mini);
      expect(cast.music_provider).toBe('ma');
    } else {
      const d = await device(request, p.keys.sonos_living);
      expect(d.music_provider).toBe('sonos');
      expect(d.caps).toMatchObject({ shuffle: true, repeat: true, group: true, up_next: true, favourites: true, playlists: false, transfer: false });
      expect(d.caps.group, 'grouping is the Sonos layer\'s, never the SmartThings mirror\'s').toBe(true);
      for (const slug of ['tv_living', 'tv_bedroom']) expect((await device(request, p.keys[slug])).kind).toBe('screen');
    }
  });

  test('the TV house is untouched: screens keep their cards, remote profile and caps next to the players', async ({ request }, info) => {
    const p = await ready(request, info);
    for (const [slug, pl] of SCREENS) {
      const d = await device(request, p.keys[slug]);
      expect([d.kind, d.name], slug).toEqual(['screen', pl.name]);
    }
    expect((await devices(request, 'kind=speaker')).every((d) => d.kind === 'speaker')).toBe(true);
  });

  if (HOUSE === 'ma') {
    test('live groups by the union rule: the cross-brand group of four lists, the WiiM pair in both layers, the conflict, the static group', async ({ request }, info) => {
      const p = await ready(request, info);
      await fresh(request);
      const g = async (slug: string) => (await device(request, p.keys[slug])).live.group;
      const cross = await g('denon_a');
      expect([cross.role, cross.layer, cross.conflict, cross.static]).toEqual(['leader', 'ma', false, false]);
      expect([...cross.member_keys].sort(), 'the union of the lists: two members listed nothing and are still members').toEqual([p.keys.denon_b, p.keys.mini, p.keys.nest].sort());
      for (const slug of ['denon_b', 'mini', 'nest']) {
        const m = await g(slug);
        expect([m.role, m.leader_key], slug).toEqual(['member', p.keys.denon_a]);
      }
      const pair = await g('wiim_living');
      expect([pair.role, pair.layer, pair.member_keys], 'grouped in both layers: one group, read through MA').toEqual(['leader', 'ma', [p.keys.wiim_kitchen]]);
      expect((await g('wiim_kitchen')).leader_key).toBe(p.keys.wiim_living);
      for (const slug of ['wiim_terrace', 'wiim_study']) {
        const c = await g(slug);
        expect(c.conflict, `${slug}: grouped in the vendor layer only: "קיבוץ לא תואם"`).toBe(true);
        expect((await device(request, p.keys[slug])).can.group, 'and join is disabled').toBe(false);
      }
      const st = await g('group_outside');
      expect(st.static, 'a device of kind group').toBe(true);
      const groups = ((await (await request.get(`${API}/multimedia/groups`)).json()) as { groups: { leader_key: string; name: string; static: boolean; floor_ids: string[]; members: { key: string; available: boolean }[] }[] }).groups;
      const led = (slug: string) => groups.find((x) => x.leader_key === p.keys[slug])!;
      expect(led('denon_a').members.length).toBe(4);
      expect(led('wiim_living').members.map((m) => m.key).sort()).toEqual([p.keys.wiim_living, p.keys.wiim_kitchen].sort());
      expect(led('group_outside').static).toBe(true);
      expect(JSON.stringify(groups)).not.toMatch(PRIVATE);
      const playing = await device(request, p.keys.wiim_living);
      expect([playing.live.now.title, playing.live.now.artist, playing.live.now.album, playing.live.queue]).toEqual(['שיר לדוגמה א', 'אמן לדוגמה', 'אלבום לדוגמה', { count: 4, index: 0 }]);
      expect(playing.live.now.artwork, 'a proxied, versioned relative URL - never the HA URL').toMatch(/multimedia\/devices\/[a-f0-9]{32}\/artwork\?v=/);
    });
  }

  test('transport: a command is confirmed by the state, goes to the music layer, and a member\'s command is executed on its leader', async ({ request }, info) => {
    const p = await ready(request, info);
    await fresh(request);
    const lead = HOUSE === 'ma' ? 'wiim_living' : 'sonos_living';
    const leaderEntity = HOUSE === 'ma' ? e('wiim_living_ma') : e('sonos_living');
    const since = await mark(request);
    const pause = await cmd(request, p.keys[lead], { command: 'transport', action: 'pause' });
    expect([pause.status, pause.body.status]).toEqual([202, 'accepted']);
    expect(await pollAction(request, pause.body.action_id, (s) => s !== 'pending')).toBe('confirmed');
    const calls = (await callsSince(request, since)).filter((c) => c.service === 'media_pause');
    expect(calls.map((c) => c.entity_id), 'the music layer owns the playback, not the Cast or the SmartThings twin').toEqual([leaderEntity]);
    await expect.poll(async () => (await device(request, p.keys[lead])).live.play).toBe('paused');
    if (HOUSE === 'ma') {
      const before = await mark(request);
      const play = await cmd(request, p.keys.wiim_kitchen, { command: 'transport', action: 'play' });
      expect(play.status, 'a member of a live group: the command is accepted').toBe(202);
      expect((await callsSince(request, before)).filter((c) => c.service === 'media_play').map((c) => c.entity_id), 'and executed on the leader').toEqual([e('wiim_living_ma')]);
    }
  });

  test('seek, shuffle, repeat: exact calls; the new commands need bridge 0.5.0, screens keep working with 0.4.0', async ({ request }, info) => {
    const p = await ready(request, info);
    await fresh(request);
    const key = p.keys[HOUSE === 'ma' ? 'wiim_living' : 'sonos_living'];
    const entity = HOUSE === 'ma' ? e('wiim_living_ma') : e('sonos_living');
    const since = await mark(request);
    for (const body of [{ command: 'seek', position_s: 100 }, { command: 'shuffle', on: true }, { command: 'repeat', mode: 'all' }]) {
      const r = await cmd(request, key, body);
      expect(r.status, JSON.stringify(body)).toBe(202);
      await sleep(600); // 2 per second and device
    }
    const calls = (await callsSince(request, since)).filter((c) => ['seek', 'shuffle', 'repeat'].includes(c.kind));
    expect(calls.map((c) => [c.kind, c.entity_id, c.position ?? c.shuffle ?? c.repeat])).toEqual([['seek', entity, 100], ['shuffle', entity, true], ['repeat', entity, 'all']]);
    await expect.poll(async () => (await device(request, key)).live.shuffle).toBe(true);
    const bad = await cmd(request, key, { command: 'seek', position_s: -5 });
    expect([bad.status, bad.body.code]).toEqual([422, 'validation']);
    const announce = await cmd(request, key, { command: 'announce', text: 'x' });
    expect([announce.status, announce.body.code], 'announcements are not in 0.1.150 (6א)').toEqual([422, 'validation']);
    await ctl(request, '/media-config', { bridge_version: '0.4.0' });
    try {
      const old = await cmd(request, key, { command: 'repeat', mode: 'off' });
      expect([old.status, old.body.code]).toEqual([503, 'bridge_outdated']);
      expect((await (await request.get(`${API}/multimedia/status`)).json()).bridge.players_ready).toBe(false);
    } finally {
      await ctl(request, '/media-config', { bridge_version: '0.5.0' });
    }
  });

  test('volume: nothing is clamped where no ceiling is set, a ceiling and a night window clamp, a group member is never touched by a single set', async ({ request }, info) => {
    const p = await ready(request, info);
    await fresh(request);
    const slug = HOUSE === 'ma' ? 'mini' : 'sonos_study';
    const key = p.keys[slug];
    const entity = HOUSE === 'ma' ? e('mini_ma') : e('sonos_study');
    expect((await device(request, key)).volume_max, 'no default ceiling (7ב)').toBeNull();
    let since = await mark(request);
    expect((await cmd(request, key, { command: 'volume_set', level: 95 })).status).toBe(202);
    expect((await callsSince(request, since)).find((c) => c.entity_id === entity && c.volume_level !== undefined)?.volume_level, '95 goes out as 0.95: no clamp').toBe(0.95);
    expect((await put(request, `/multimedia/admin/devices/${key}`, { volume_max: 30 })).status).toBeLessThan(300);
    await sleep(600);
    since = await mark(request);
    expect((await cmd(request, key, { command: 'volume_set', level: 95 })).status).toBe(202);
    expect((await callsSince(request, since)).find((c) => c.volume_level !== undefined)?.volume_level, 'a ceiling of 30 clamps to 0.3').toBe(0.3);
    await put(request, `/multimedia/admin/devices/${key}`, { volume_max: null });
    const night = await put(request, `/multimedia/admin/devices/${key}`, { volume_night: { from: '00:00', to: '23:59', max: 20 } });
    expect(night.status).toBeLessThan(300);
    await sleep(600);
    since = await mark(request);
    expect((await cmd(request, key, { command: 'volume_set', level: 60 })).status).toBe(202);
    expect((await callsSince(request, since)).find((c) => c.volume_level !== undefined)?.volume_level, 'inside the night window the window\'s ceiling applies').toBe(0.2);
    await put(request, `/multimedia/admin/devices/${key}`, { volume_night: null });
    expect((await device(request, key)).volume_night).toBeNull();
  });

  if (HOUSE === 'ma') {
    test('up next, favourites, stations, playlists and play_item: only what the server listed is playable; a failed read is not "empty"', async ({ request }, info) => {
      const p = await ready(request, info);
      await fresh(request);
      const key = p.keys.wiim_living;
      const next = await (await request.get(`${API}/multimedia/devices/${key}/up-next`)).json();
      expect(next).toMatchObject({ confirmed: true, count: 4, index: 0, shuffle: false, repeat: 'off', current: { name: 'שיר לדוגמה א' }, next: { name: 'שיר לדוגמה ב' } });
      expect(JSON.stringify(next)).not.toMatch(PRIVATE);
      const empty = await (await request.get(`${API}/multimedia/devices/${p.keys.wiim_terrace}/up-next`)).json();
      expect([empty.confirmed, empty.count, empty.next], 'an empty queue is not unavailable').toEqual([true, 0, null]);
      const lib = async (kind: string) => (await (await request.get(`${API}/multimedia/devices/${key}/library?kind=${kind}`)).json()) as { items: { item_ref: string; name: string; kind: string }[]; provider: string; curated: boolean };
      const [fav, stations, lists] = [await lib('favourites'), await lib('stations'), await lib('playlists')];
      expect(JSON.stringify([fav, stations, lists]), 'no uri, no image url, nothing but an opaque reference').not.toMatch(PRIVATE);
      expect(stations.items.map((i) => i.name)).toEqual(['תחנה לדוגמה 1', 'תחנה לדוגמה 2']);
      expect(lists.items.map((i) => i.name).sort()).toEqual(['פלייליסט בוקר', 'פלייליסט ערב']);
      expect(fav.items.length).toBeGreaterThan(0);
      expect(fav.items.every((i) => /^[a-f0-9]{24}$/.test(i.item_ref))).toBe(true);
      expect(fav.provider).toBe('ma');
      const since = await mark(request);
      const station = stations.items[0];
      const play = await cmd(request, p.keys.mini, { command: 'play_item', item_ref: station.item_ref });
      expect([play.status, play.body.status]).toEqual([202, 'accepted']);
      const calls = (await callsSince(request, since)).filter((c) => c.kind === 'play_item');
      expect(calls.map((c) => [c.entity_id, c.media_type, c.media_id, c.enqueue, c.result])).toEqual([[e('mini_ma'), 'radio', 'library://radio/r1', 'play', 'ok']]);
      await expect.poll(async () => (await device(request, p.keys.mini)).live.now.title).toBe('תחנה לדוגמה 1');
      expect((await device(request, p.keys.mini)).live.now.kind, 'a station: no progress, "שידור חי"').toBe('station');
      const unknown = await cmd(request, p.keys.mini, { command: 'play_item', item_ref: 'a'.repeat(24) });
      expect([unknown.status, unknown.body.code]).toEqual([422, 'unknown_item']);
      const url = await cmd(request, p.keys.mini, { command: 'play_item', item_ref: 'https://example.invalid/a.mp3' });
      expect(url.status, 'a URL is not an item_ref').toBe(422);
      // transfer: the queue of a playing player moves here; a player that is not playing cannot be the source
      await sleep(1100);
      const t0 = await mark(request);
      const tr = await cmd(request, p.keys.wiim_terrace, { command: 'transfer', from_key: p.keys.wiim_living });
      expect([tr.status, tr.body.status]).toEqual([202, 'accepted']);
      expect((await callsSince(request, t0)).filter((c) => c.kind === 'transfer').map((c) => [c.entity_id, c.source_player])).toEqual([[e('wiim_terrace_ma'), e('wiim_living_ma')]]);
      await sleep(1100);
      const idle = await cmd(request, p.keys.wiim_study, { command: 'transfer', from_key: p.keys.garden });
      expect([idle.status, idle.body.code]).toEqual([409, 'not_playing']);
      // a failed read and a missing MA entry
      await fresh(request);
      await ctl(request, '/media-config', { query_fail: true });
      await sleep(2200); // the 2 s cache
      const failed = await (await request.get(`${API}/multimedia/devices/${key}/up-next`)).json();
      expect([failed.confirmed, failed.next], 'unconfirmed: the panel shows "לא זמין"').toEqual([false, null]);
      await ctl(request, '/media-config', { query_fail: false, ma_loaded: false });
      await sleep(2200);
      const none = await request.get(`${API}/multimedia/devices/${key}/library?kind=favourites`);
      expect([none.status(), (await none.json()).code]).toEqual([503, 'no_library']);
      expect((await (await request.get(`${API}/multimedia/status`)).json()).library.state).toBe('unavailable');
      await ctl(request, '/media-config', { ma_loaded: true });
    });

    test('groups: leave, join with a member that refuses (named by its room), the party confirmation, groups that cannot be joined', async ({ request }, info) => {
      const p = await ready(request, info);
      await fresh(request);
      const lead = p.keys.mini;
      // 1. the cross-brand group of four: two members leave
      let r = await post(request, '/multimedia/groups/leave', stamped({ device_keys: [p.keys.mini, p.keys.nest] }));
      expect(r.status).toBe(202);
      let out = await outcomes(request, r.body.bulk_id);
      expect([byKey(out, p.keys.mini), byKey(out, p.keys.nest)]).toEqual(['left', 'left']);
      expect(out.find((o) => o.device_key === p.keys.mini)!.area_name, 'the outcome names the room, not an entity').toBe('משרד');
      expect((await device(request, p.keys.denon_a)).live.group.member_keys).toEqual([p.keys.denon_b]);
      // 2. join: the Nest refuses (the fake MA entity accepts the call and does not join)
      const since = await mark(request);
      r = await post(request, '/multimedia/groups/join', stamped({ leader_key: lead, member_keys: [p.keys.nest] }));
      expect(r.status).toBe(202);
      out = await outcomes(request, r.body.bulk_id);
      expect(byKey(out, p.keys.nest), 'honest: read back, not assumed').toBe('not_joined');
      const joinCalls = (await callsSince(request, since)).filter((c) => c.kind === 'join');
      expect(joinCalls.map((c) => [c.entity_id, c.members])).toEqual([[e('mini_ma'), [e('nest_ma_refuses')]]]);
      // 3. not groupable: a member of another live group, a vendor-only group, an unavailable player, a screen
      for (const bad of [p.keys.denon_b, p.keys.wiim_terrace, p.keys.garden, p.keys.tv3]) {
        const x = await post(request, '/multimedia/groups/join', stamped({ leader_key: lead, member_keys: [bad] }));
        expect([x.status, x.body.code], bad).toEqual([422, 'not_groupable']);
      }
      expect((await callsSince(request, since)).filter((c) => c.kind === 'join').length, 'nothing was sent for them').toBe(1);
      // 4. the party rule: four devices (and two floors) need an explicit confirmation, with a preview
      await sleep(1200);
      const party = { leader_key: p.keys.wiim_living, member_keys: [p.keys.mini, p.keys.nest] };
      const ask = await post(request, '/multimedia/groups/join', stamped(party));
      expect([ask.status, ask.body.code]).toEqual([409, 'confirm_required']);
      expect(ask.body.preview).toMatchObject({ devices: 4, needs_confirmation: true });
      expect(JSON.stringify(ask.body)).not.toMatch(PRIVATE);
      const before = await mark(request);
      expect((await callsSince(request, before)).filter((c) => c.kind === 'join')).toEqual([]);
      const go = await post(request, '/multimedia/groups/join', stamped({ ...party, confirmed: true }));
      expect(go.status).toBe(202);
      out = await outcomes(request, go.body.bulk_id);
      expect([byKey(out, p.keys.mini), byKey(out, p.keys.nest)], 'one joined, one did not').toEqual(['joined', 'not_joined']);
      // 5. one join in flight per leader
      const quick = await post(request, '/multimedia/groups/join', stamped({ leader_key: p.keys.wiim_living, member_keys: [p.keys.mini] }));
      expect([409, 202]).toContain(quick.status);
    });

    test('group volume: relative keeps the balance, absolute sets one level; a ceiling clamps ONLY where it is set; muted members are skipped', async ({ request }, info) => {
      const p = await ready(request, info);
      await fresh(request);
      const leader = p.keys.wiim_living;
      const base = async (slug: string) => (await device(request, p.keys[slug])).live.volume.level as number;
      let since = await mark(request);
      let r = await post(request, `/multimedia/groups/${leader}/volume`, stamped({ level: 50, mode: 'absolute' }));
      expect(r.status).toBe(202);
      let out = await outcomes(request, r.body.bulk_id);
      expect([byKey(out, p.keys.wiim_living), byKey(out, p.keys.wiim_kitchen)]).toEqual(['set', 'set']);
      const sets = (await callsSince(request, since)).filter((c) => c.volume_level !== undefined);
      expect(sets.map((c) => [c.entity_id, c.volume_level]).sort(), 'one set per member, no ceiling set: no clamp').toEqual([[e('wiim_kitchen_ma'), 0.5], [e('wiim_living_ma'), 0.5]]);
      // a ceiling on the kitchen only
      await put(request, `/multimedia/admin/devices/${p.keys.wiim_kitchen}`, { volume_max: 30 });
      await sleep(800);
      since = await mark(request);
      r = await post(request, `/multimedia/groups/${leader}/volume`, stamped({ level: 80, mode: 'absolute' }));
      out = await outcomes(request, r.body.bulk_id);
      expect([byKey(out, p.keys.wiim_living), byKey(out, p.keys.wiim_kitchen)], 'clamped only where a ceiling is set').toEqual(['set', 'clamped']);
      expect((await callsSince(request, since)).filter((c) => c.volume_level !== undefined).map((c) => [c.entity_id, c.volume_level]).sort()).toEqual([[e('wiim_kitchen_ma'), 0.3], [e('wiim_living_ma'), 0.8]]);
      await put(request, `/multimedia/admin/devices/${p.keys.wiim_kitchen}`, { volume_max: null });
      // relative: the same factor on every member (the balance of 0.8 : 0.3 stays)
      await sleep(1200);
      const [l1, k1] = [await base('wiim_living'), await base('wiim_kitchen')];
      expect(l1, 'the absolute set of 80 is where the relative step starts').toBeCloseTo(0.8, 1);
      r = await post(request, `/multimedia/groups/${leader}/volume`, stamped({ level: Math.round(Math.max(l1, k1) * 100 / 2), mode: 'relative' }));
      out = await outcomes(request, r.body.bulk_id);
      expect([byKey(out, p.keys.wiim_living), byKey(out, p.keys.wiim_kitchen)]).toEqual(['set', 'set']);
      await sleep(900);
      const [l2, k2] = [await base('wiim_living'), await base('wiim_kitchen')];
      expect(l2 / k2, 'relative keeps the ratio').toBeCloseTo(l1 / k1, 1);
      // a muted member is skipped, a member that is not allowed is not an error
      await post(request, `/multimedia/devices/${p.keys.wiim_kitchen}/commands`, stamped({ command: 'mute', muted: true }));
      await sleep(900);
      r = await post(request, `/multimedia/groups/${leader}/volume`, stamped({ level: 40, mode: 'absolute' }));
      out = await outcomes(request, r.body.bulk_id);
      expect([byKey(out, p.keys.wiim_living), byKey(out, p.keys.wiim_kitchen)]).toEqual(['set', 'skipped_muted']);
    });

    test('saved groups: create, apply as a diff with honest per-room outcomes, a stale revision is a 409, a missing member is named', async ({ request }, info) => {
      const p = await ready(request, info);
      await fresh(request);
      const role = await mkRole(request, 'CR-016 plain', ['map.read', 'media.read', 'media.control']);
      roles.push(role);
      const plain = as(`cr016plain${info.project.name}`);
      bindings.push(await bindUser(request, plain.user, role));
      const body = { name: 'מסיבה', leader_key: p.keys.mini, member_keys: [p.keys.nest, p.keys.wiim_terrace], volumes: { [p.keys.mini]: 30 } };
      expect((await post(request, '/multimedia/groups/presets', stamped(body), plain.headers)).status, 'saving needs media.layout').toBe(403);
      const made = await post(request, '/multimedia/groups/presets', stamped(body));
      expect(made.status).toBeLessThan(300);
      const preset = made.body as { id: string; revision: number };
      const list = ((await (await request.get(`${API}/multimedia/groups/presets`)).json()) as { presets: { id: string; name: string; missing: string[]; running: unknown }[] }).presets;
      expect(list.find((x) => x.id === preset.id)).toMatchObject({ name: 'מסיבה', missing: [], running: null });
      const stale = await put(request, `/multimedia/groups/presets/${preset.id}`, { ...body, name: 'מסיבה 2', base_revision: preset.revision + 5 });
      expect([stale.status, stale.body.code]).toEqual([409, 'revision_conflict']);
      // apply: terrace is in a vendor-only group (not groupable): the diff names it, the others are done
      await sleep(900);
      const since = await mark(request);
      const run = await post(request, `/multimedia/groups/presets/${preset.id}/apply`, stamped({ confirmed: true }));
      expect(run.status).toBeLessThan(300);
      const out = await outcomes(request, run.body.bulk_id);
      expect(byKey(out, p.keys.nest), 'the Nest refuses').toBe('not_joined');
      expect(byKey(out, p.keys.wiim_terrace), 'a conflicted device is not joined').not.toBe('joined');
      expect((await callsSince(request, since)).filter((c) => c.kind === 'join').every((c) => c.entity_id === e('mini_ma'))).toBe(true);
      expect(JSON.stringify(out)).not.toMatch(PRIVATE);
      const del = await request.delete(`${API}/multimedia/groups/presets/${preset.id}`);
      expect(del.status()).toBeLessThan(300);
    });

    test('floor "עצור מוזיקה": only playing players of the floor are paused; unplaced, idle and unavailable ones are skipped with their reason', async ({ request }, info) => {
      const p = await ready(request, info);
      await fresh(request);
      const pv = await (await request.get(`${API}/multimedia/actions/preview?scope=floor&id=cr016_ground&kind=players_pause`)).json();
      const will = Object.fromEntries((pv.devices as { key: string; will: string; reason: string | null }[]).map((d) => [d.key, d.will]));
      expect(will[p.keys.wiim_living], 'playing').toBe('pause');
      expect(will[p.keys.wiim_terrace] ?? 'skip', 'idle: skipped').toBe('skip');
      expect(Object.keys(will).includes(p.keys.garden), 'an unplaced player is not part of a floor').toBe(false);
      expect(Object.keys(will).includes(p.keys.mini), 'the other floor').toBe(false);
      const since = await mark(request);
      const body = { scope: 'floor', id: 'cr016_ground', kind: 'players_pause', confirmed: true };
      const noConfirm = await post(request, '/multimedia/actions', stamped({ ...body, confirmed: false }));
      expect(noConfirm.status).toBeGreaterThanOrEqual(400);
      const run = await post(request, '/multimedia/actions', stamped(body));
      expect(run.status).toBe(202);
      await outcomes(request, run.body.bulk_id);
      const paused = (await callsSince(request, since)).filter((c) => c.service === 'media_pause').map((c) => c.entity_id);
      expect(paused.length).toBeGreaterThan(0);
      expect(paused.every((x) => [e('wiim_living_ma'), e('wiim_kitchen_ma')].includes(x)), 'only the playing players of the ground floor').toBe(true);
    });

    test('favourites curation: one list for everyone, hidden items vanish for all, a stale revision is a 409; placing an unplaced device moves it out of the bucket', async ({ request }, info) => {
      const p = await ready(request, info);
      await fresh(request);
      const key = p.keys.wiim_living;
      const stations = ((await (await request.get(`${API}/multimedia/devices/${key}/library?kind=stations`)).json()) as { items: { item_ref: string; name: string }[] }).items;
      const cur = await (await request.get(`${API}/multimedia/favourites`)).json();
      const hide = await put(request, '/multimedia/favourites', { kinds_on: ['favourites', 'stations'], items: [{ item_ref: stations[0].item_ref, hidden: true, order: 0 }], base_revision: cur.revision });
      expect(hide.status).toBeLessThan(300);
      const after = ((await (await request.get(`${API}/multimedia/devices/${key}/library?kind=stations`)).json()) as { items: { name: string }[]; curated: boolean });
      expect(after.items.map((i) => i.name), 'the hidden station is gone for everyone').toEqual(['תחנה לדוגמה 2']);
      expect(after.curated).toBe(true);
      const lists = await request.get(`${API}/multimedia/devices/${key}/library?kind=playlists`);
      expect(lists.status() === 200 ? ((await lists.json()) as { items: unknown[] }).items : [], 'a kind that is switched off is not offered').toEqual([]);
      const stale = await put(request, '/multimedia/favourites', { kinds_on: ['favourites'], items: [], base_revision: cur.revision });
      expect([stale.status, stale.body.code]).toEqual([409, 'revision_conflict']);
      await put(request, '/multimedia/favourites', { kinds_on: ['favourites', 'stations', 'playlists'], items: [], base_revision: hide.body.revision });
      // placing: an administrator puts the unplaced WiiM in the office; the bridge writes the registry and the device leaves the bucket
      const since = await mark(request);
      const placed = await put(request, `/multimedia/admin/devices/${p.keys.wiim_study}`, { area_id: 'cr016_office' });
      expect(placed.status).toBeLessThan(300);
      expect((await callsSince(request, since, 500)).find((c) => c.kind === 'set_area'), 'the entity registry write').toMatchObject({ area_id: 'cr016_office', result: 'ok' });
      await expect.poll(async () => (await device(request, p.keys.wiim_study)).area_id, { timeout: 15_000 }).toBe('cr016_office');
      expect((await device(request, p.keys.wiim_study)).floor_id).toBe('cr016_upper');
      expect((await devices(request, 'kind=speaker,player,receiver,group&area=none')).some((d) => d.key === p.keys.wiim_study)).toBe(false);
    });
  } else {
    test('Sonos without Music Assistant: favourites from the speaker\'s own list, no playlists, no transfer; position and size only in up next', async ({ request }, info) => {
      const p = await ready(request, info);
      await fresh(request);
      const key = p.keys.sonos_living;
      const next = await (await request.get(`${API}/multimedia/devices/${key}/up-next`)).json();
      expect(next).toMatchObject({ confirmed: true, count: 12, next: null });
      const fav = (await (await request.get(`${API}/multimedia/devices/${key}/library?kind=favourites`)).json()) as { items: { item_ref: string; name: string }[]; provider: string };
      expect(fav.provider).toBe('sonos');
      expect(fav.items.map((i) => i.name)).toContain('פלייליסט ערב');
      expect(JSON.stringify(fav)).not.toMatch(PRIVATE);
      const lists = await request.get(`${API}/multimedia/devices/${key}/library?kind=playlists`);
      expect(lists.status() === 200 ? ((await lists.json()) as { items: unknown[] }).items : [], 'no playlists tab with the Sonos provider').toEqual([]);
      const since = await mark(request);
      const pick = fav.items.find((i) => i.name === 'פלייליסט ערב')!;
      const play = await cmd(request, p.keys.sonos_bedroom, { command: 'play_item', item_ref: pick.item_ref });
      expect([play.status, play.body.status]).toEqual([202, 'accepted']);
      expect((await callsSince(request, since)).filter((c) => c.service === 'select_source').map((c) => [c.domain, c.entity_id, c.source]), 'a Sonos favourite is started with select_source on the Sonos entity').toEqual([['media_player', e('sonos_bedroom'), 'פלייליסט ערב']]);
      const tr = await cmd(request, p.keys.sonos_bedroom, { command: 'transfer', from_key: p.keys.sonos_living });
      expect([tr.status, tr.body.code], 'transfer is MA only').toEqual([422, 'not_supported']);
    });

    test('Sonos groups: join on the Sonos layer with a member that refuses, never a SmartThings twin, never a helper; the helpers are shortcuts, not groups', async ({ request }, info) => {
      const p = await ready(request, info);
      await fresh(request);
      const since = await mark(request);
      const r = await post(request, '/multimedia/groups/join', stamped({ leader_key: p.keys.sonos_living, member_keys: [p.keys.sonos_kitchen, p.keys.sonos_terrace] }));
      expect(r.status).toBe(202);
      const out = await outcomes(request, r.body.bulk_id);
      expect([byKey(out, p.keys.sonos_kitchen), byKey(out, p.keys.sonos_terrace)], 'the terrace Sonos refuses').toEqual(['joined', 'not_joined']);
      const join = (await callsSince(request, since)).find((c) => c.kind === 'join')!;
      expect([join.entity_id, join.members], 'the Sonos entities, never the twins').toEqual([e('sonos_living'), [e('sonos_kitchen'), e('sonos_terrace_refuses')]]);
      const g = (await device(request, p.keys.sonos_living)).live.group;
      expect([g.role, g.layer, g.member_keys]).toEqual(['leader', 'vendor', [p.keys.sonos_kitchen]]);
      const virtual = await adminRows(request, '?kind=virtual_group');
      expect(virtual.length).toBe(2);
      const helper = await post(request, '/multimedia/groups/join', stamped({ leader_key: p.keys.sonos_study, member_keys: [virtual[0].key] }));
      expect([404, 422]).toContain(helper.status);
      const leave = await post(request, '/multimedia/groups/leave', stamped({ device_keys: [p.keys.sonos_kitchen] }));
      expect(leave.status).toBe(202);
      expect(byKey(await outcomes(request, leave.body.bulk_id), p.keys.sonos_kitchen)).toBe('left');
    });
  }

  test('permissions: a view-only user sees the state and cannot send anything; control without media.group cannot group', async ({ request }, info) => {
    const p = await ready(request, info);
    await fresh(request);
    const viewRole = await mkRole(request, 'CR-016 view only', ['map.read', 'media.read']);
    roles.push(viewRole);
    const viewer = as(`cr016view${info.project.name}`);
    bindings.push(await bindUser(request, viewer.user, viewRole));
    const ctrlRole = await mkRole(request, 'CR-016 control', ['map.read', 'media.read', 'media.control']);
    roles.push(ctrlRole);
    const op = as(`cr016ctl${info.project.name}`);
    bindings.push(await bindUser(request, op.user, ctrlRole));
    const lead = p.keys[HOUSE === 'ma' ? 'wiim_living' : 'sonos_living'];
    const seen = await device(request, lead, viewer.headers);
    expect([seen.can.control, seen.can.group]).toEqual([false, false]);
    const denied = await cmd(request, lead, { command: 'transport', action: 'pause' }, viewer.headers);
    expect([denied.status, denied.body.code]).toEqual([403, 'forbidden']);
    expect((await device(request, lead, op.headers)).can.control).toBe(true);
    const nogroup = await post(request, '/multimedia/groups/join', stamped({ leader_key: p.keys[HOUSE === 'ma' ? 'mini' : 'sonos_kitchen'], member_keys: [p.keys[HOUSE === 'ma' ? 'nest' : 'sonos_study']] }), op.headers);
    expect([nogroup.status, nogroup.body.code], 'grouping needs media.group').toEqual([403, 'forbidden']);
    const list = await devices(request, 'kind=speaker,player,receiver,group', viewer.headers);
    expect(list.length).toBeGreaterThan(0);
    expect((await request.get(`${API}/multimedia/admin/suggestions`, { headers: viewer.headers })).status(), 'the wizard is for system.configure').toBe(403);
  });
});

// ================================================================================================ part C: screens, panel, settings (needs S2 + S3)

test.describe(`players screens on the ${HOUSE} house (needs S2 + S3)`, () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the fixture backend running');
  test.skip(process.env.SW_MEDIA_FIXTURE !== '1', 'needs tests/fixtures/media_fake_ha.py as the backend (SW_MEDIA_FIXTURE=1)');

  /** Opens a hash route; skips with the reason when the CR-016 routes or the player cards are not there yet. */
  async function open(page: Page, request: APIRequestContext, info: TestInfo, hash: string, expect_selector: string, why: string): Promise<NonNullable<typeof prepared>> {
    test.skip(!(await playersPresent(request)), 'S1 is not merged: the CR-016 routes are missing');
    const p = await prepare(request);
    await frame(page, info);
    await page.goto(`/?design=a#${hash}`);
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1500);
    test.skip((await page.locator(expect_selector).count()) === 0, why);
    return p;
  }
  const names = () => AUDIO.map(([, pl]) => pl.name).sort((a, b) => b.length - a.length);
  /** The page text with the owner's own device names removed: what is left is the product's copy, which names no platform. */
  async function productCopy(page: Page): Promise<string> {
    let text = await page.locator('sw-app').innerText();
    for (const n of [...names(), ...SCREENS.map(([, pl]) => pl.name)]) text = text.split(n).join('');
    return text;
  }

  test('the players page: tabs, one card per physical device, rooms by floor (or one list without floors), "לא משויכים", no platform names', async ({ page, request }, info) => {
    const p = await open(page, request, info, '/multimedia/players', SEL.card, 'S2 is not merged: no <media-player-card> on #/multimedia/players');
    await expect(page.locator(SEL.card), 'one card per physical speaker / receiver (screens stay on their own tab; static groups are on the groups tab)').toHaveCount(AUDIO.filter(([, pl]) => pl.kind !== 'group').length, { timeout: 30_000 });
    for (const [, pl] of AUDIO.filter(([, x]) => x.kind !== 'group')) await expect(page.locator(SEL.cardName(pl.name)), pl.name).toHaveCount(1);
    await expect(page.locator(SEL.unplaced).first(), 'unplaced devices are listed last').toBeVisible();
    const text = await productCopy(page);
    expect(text, 'operator screens name no platform (UI_COPY_RULES)').not.toMatch(PLATFORM_WORDS);
    if (HOUSE === 'sonos') expect(text, 'no floors: one list, the floor menu is gone').toContain('כל החדרים');
    else expect(text).toContain('קומת קרקע');
    for (const label of ['מסכים', 'נגנים ורמקולים', 'קבוצות']) await expect(page.locator(SEL.tab(label)).first(), `tab ${label}`).toBeVisible();
    expect(p.keys).toBeTruthy();
    await shot(page, 'media-players-live', info);
  });

  test('the player panel: now playing, transport confirmed by the state, up next, library tabs by provider, the group section', async ({ page, request }, info) => {
    test.setTimeout(90_000);
    const first = HOUSE === 'ma' ? MA_PLAYERS.wiim_living : SONOS_PLAYERS.sonos_living;
    await open(page, request, info, '/multimedia/players', SEL.card, 'S2 is not merged: no <media-player-card> on #/multimedia/players');
    await fresh(request);
    await page.reload();
    await page.waitForSelector(SEL.card, { timeout: 30_000 });
    const trigger = page.locator(SEL.openPlayer(first.name));
    test.skip((await trigger.count()) === 0, `S3 is not merged: no button[aria-label="נגן · ${first.name}"] on the card`);
    await trigger.click();
    await expect(page.locator(SEL.panel)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(SEL.panel)).toContainText('שיר לדוגמה');
    await expect(page.locator(SEL.panel), 'up next is read from the server').toContainText(/הבא בתור/);
    await shot(page, 'media-player-panel-live', info);
    const tabs = await page.locator(SEL.panel).innerText();
    expect(tabs, 'favourites and stations in both houses').toMatch(/מועדפים/);
    if (HOUSE === 'sonos') expect(tabs, 'no playlists tab with the Sonos provider').not.toMatch(/פלייליסטים/);
    else expect(tabs).toMatch(/פלייליסטים/);
    const since = await mark(request);
    await page.locator(`${SEL.panel} button[aria-label*="השהה"], ${SEL.panel} [data-mpp-pause]`).first().click();
    await expect.poll(async () => (await callsSince(request, since, 0)).some((c) => c.service === 'media_pause'), { timeout: 15_000 }).toBe(true);
    expect(PRIVATE.test(await page.locator(SEL.panel).innerHTML()), 'no identifier in the panel markup').toBe(false);
  });

  test('the groups page: live groups with their rooms, the conflict, static and saved groups; a join with a refusing member names the room', async ({ page, request }, info) => {
    test.setTimeout(90_000);
    await open(page, request, info, '/multimedia/groups', SEL.groupCard, 'S2 is not merged: no group card on #/multimedia/groups');
    await fresh(request);
    await page.reload();
    await page.waitForSelector(SEL.groupCard, { timeout: 30_000 });
    if (HOUSE === 'ma') {
      await expect(page.locator(SEL.groupCard).filter({ hasText: 'מגבר קולנוע' }), 'the cross-brand group of four rooms').toContainText('רמקול חדר שינה');
      await expect(page.locator('sw-app'), 'the vendor-only pair is a conflict').toContainText('קיבוץ לא תואם');
    } else {
      await expect(page.locator('sw-app'), 'helper groups are shortcuts: "קבוצה וירטואלית"').toContainText('קבוצה וירטואלית');
    }
    expect(await productCopy(page)).not.toMatch(PLATFORM_WORDS);
    await shot(page, 'media-groups-live', info);
  });

  test('settings › מולטימדיה: players and speakers, the merge wizard, non-physical components, saved groups, favourites, connection, permissions', async ({ page, request }, info) => {
    test.setTimeout(90_000);
    await open(page, request, info, '/system/multimedia', 'sw-app', 'the settings screen is missing');
    await page.waitForTimeout(1500);
    const text = await page.locator('sw-app').innerText();
    test.skip(!text.includes('נגנים ורמקולים'), 'S2 is not merged: the settings screen has no "נגנים ורמקולים" section');
    for (const s of SETTINGS_SECTIONS.filter((x) => HOUSE === 'sonos' || x !== 'רכיבים לא פיזיים')) expect(text, `section ${s}`).toContain(s);
    if (HOUSE === 'sonos') expect(text, 'the connection line says what answers music here').toMatch(/לא מותקן/);
    else expect(text).toMatch(/מחובר/);
    await shot(page, 'media-settings-players-live', info);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow, 'no horizontal page scroll').toBe(false);
  });

  test('view-only user: the cards and the state are visible, no control is drawn; the phone sheet fits', async ({ page, browser, request }, info) => {
    await open(page, request, info, '/multimedia/players', SEL.card, 'S2 is not merged: no <media-player-card> on #/multimedia/players');
    const role = await mkRole(request, 'CR-016 ui viewer', ['map.read', 'media.read']);
    const who = as(`cr016uiview${info.project.name}`);
    const bid = await bindUser(request, who.user, role);
    try {
      const ctx = await browser.newContext({ extraHTTPHeaders: who.headers, viewport: page.viewportSize() ?? { width: 1440, height: 900 }, locale: 'he-IL' });
      const pp = await ctx.newPage();
      await pp.goto(`/?design=a#/multimedia/players`);
      await expect(pp.locator(SEL.card).first()).toBeVisible({ timeout: 30_000 });
      await expect(pp.locator(`${SEL.card} button[aria-label*="השהה"], ${SEL.card} [data-mpc-play]`), 'no play / pause for a caller without media.control').toHaveCount(0);
      await shot(pp, 'media-players-view-only-live', info);
      expect(await pp.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
      await ctx.close();
    } finally {
      await request.delete(`${API}/access/bindings/${bid}`);
      await request.delete(`${API}/access/roles/${role}`);
    }
  });
});
