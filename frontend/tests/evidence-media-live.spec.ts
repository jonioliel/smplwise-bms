import { test, expect, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * CR-015 (S4) live evidence for the multimedia screens and the remote, against a THROWAWAY backend started by
 * tests/fixtures/media_fake_ha.py (the real backend with a fake Home Assistant and a fake bridge; never the lab, never a
 * real Home Assistant). Written against the contract (docs/architecture/MEDIA_API.md) before S1-S3 merged:
 *
 *   part A  "the fixture"       runs on any backend: seeding, the real action route, confirmation, the stuck TV.
 *   part B  "the multimedia API" needs the /multimedia/* routes (S1). Without them it is SKIPPED with the reason, never green.
 *   part C  "the screens, the remote and the editors" needs the rail entry, <media-remote> and the editors (S2 / S3).
 *           The UI locators are in SEL below, aligned with the merged components (release 0.1.149); a locator that no longer
 *           matches fails with its name, it does not silently pass.
 *
 * Run (see the fixture's docstring): SW_LIVE=1 SW_MEDIA_FIXTURE=1 SW_API_PORT=4381 SW_BASE_URL=http://127.0.0.1:4191/ \
 *   npx playwright test tests/evidence-media-live.spec.ts --workers=1        (the control server is SW_API_PORT + 1)
 * Screenshots (part C): SW_SHOTS=<dir> (docs/design/evidence/CR-015 for the committed set), 1440 / 820 / 390.
 */
const SHOTS = process.env.SW_SHOTS ?? '';
const CONTROL = `http://127.0.0.1:${process.env.SW_FAKE_HA_CONTROL_PORT ?? String(Number(process.env.SW_API_PORT ?? '8099') + 1)}`;
const API = '/api/v1';

// ------------------------------------------------------------------------------------------------ the world (mirrors fixtures/media_fake_ha.py)

/** Expected result per screen. Independent literals (not read from the fixture) so a drifting fixture or backend is caught. */
const SCREENS = {
  living: { name: 'טלוויזיה סלון', profile: 'samsung_smart', vendor: 'media_player.cr015_living_tv', floor: 'cr015_ground', area: 'cr015_living' },
  kitchen: { name: 'טלוויזיה מטבח', profile: 'samsung_smart', vendor: 'media_player.cr015_kitchen_tv', floor: 'cr015_ground', area: 'cr015_kitchen' },
  bedroom: { name: 'טלוויזיה חדר שינה', profile: 'lg_webos', vendor: 'media_player.cr015_bedroom_tv', floor: 'cr015_upper', area: 'cr015_bedroom' },
  hall: { name: 'טלוויזיה מסדרון', profile: 'lg_webos', vendor: 'media_player.cr015_hall_tv', floor: 'cr015_upper', area: 'cr015_hall' },
  office: { name: 'טלוויזיה משרד', profile: 'android_tv', vendor: 'media_player.cr015_office_tv', floor: 'cr015_upper', area: 'cr015_office' },
  lobby: { name: 'מסך לובי', profile: 'generic', vendor: 'media_player.cr015_lobby_display', floor: 'cr015_ground', area: 'cr015_lobby' },
  lounge: { name: 'טלוויזיה פינת מנוחה', profile: 'samsung_smart', vendor: 'media_player.cr015_lounge_stuck', floor: 'cr015_upper', area: 'cr015_lounge' },
} as const;
type ScreenId = keyof typeof SCREENS;
const RECEIVER = { name: 'מגבר סלון', vendor: 'media_player.cr015_avr_living' };
const SPEAKER = { vendor: 'media_player.cr015_kitchen_speaker' };
const DUPLICATES_OF_LIVING = ['media_player.cr015_living_tv_st', 'media_player.cr015_living_tv_cast', 'media_player.cr015_living_tv_dlna', 'media_player.cr015_living_tv_ma'];

/** The exact platform codes each profile sends for a sample of our key ids (TV notes section 6), as the bridge log shows them. */
const CODES: Record<'samsung_smart' | 'lg_webos' | 'android_tv', Record<string, string>> = {
  samsung_smart: { up: 'KEY_UP', ok: 'KEY_ENTER', back: 'KEY_RETURN', home: 'KEY_HOME', menu: 'KEY_MENU', mute: 'KEY_MUTE', n7: 'KEY_7', red: 'KEY_RED', play: 'KEY_PLAY', chup: 'KEY_CHUP', volup: 'KEY_VOLUP' },
  lg_webos: { up: 'UP', ok: 'ENTER', back: 'BACK', home: 'HOME', menu: 'MENU', mute: 'MUTE', n7: '7', red: 'RED', blue: 'BLUE', play: 'PLAY', chup: 'CHANNELUP', volup: 'VOLUMEUP' },
  android_tv: { up: 'DPAD_UP', ok: 'DPAD_CENTER', back: 'BACK', home: 'HOME', menu: 'MENU', mute: 'MUTE', n7: '7', red: 'PROG_RED', play: 'MEDIA_PLAY', chup: 'CHANNEL_UP', volup: 'VOLUME_UP' },
};
/** What the bridge call of each profile looks like: [domain, service, the argument that carries the code]. */
const TRANSPORT = { samsung_smart: ['media_player', 'play_media'], lg_webos: ['webostv', 'button'], android_tv: ['remote', 'send_command'] } as const;
const SECTIONS = ['recent', 'nav', 'dpad', 'touch', 'vol', 'ch', 'pbk', 'nums', 'colors', 'text', 'xtra'];
const PRIVATE = /\b(?:media_player|remote|webostv)\.[a-z0-9_]+|\b(?:[0-9a-f]{2}:){5}[0-9a-f]{2}\b|192\.0\.2\.|media_player_proxy|token=SYNTH|cr015_dev_|cr015_reg_|cr015_ce_|00000000-0000-4000/i;

// ------------------------------------------------------------------------------------------------ helpers

interface LogEntry { n: number; domain: string; service: string; entity_id: string; kind: string; result: string; effect: boolean; code?: string; text?: string; source?: string; activity?: string; output?: string; volume_level?: number }
interface Dev { key: string; name: string; kind: string; profile: string; public: boolean; floor_id: string | null; area_id: string | null; live: { power: string; confirmed: boolean; play: string | null; now: { label: string; artwork: string | null }; volume: { level: number | null; target: string } }; caps: { keys: string[]; text: boolean; apps: boolean; sources: boolean; power_on: boolean; power_on_reason: string | null; power_off: boolean; volume_set: boolean; volume_step: boolean; touchpad: boolean; sound_outputs: string[] }; audio_link: { key: string; name: string; default: string } | null; can: { control: boolean; power: boolean; public_ok: boolean; bulk: boolean } }
interface AdminRow { key: string; kind: string; approved: boolean; public: boolean; profile: string; anchor_entity_id: string; endpoints: { endpoint_id: string; platform: string; role: string; rule: string | number; hidden: boolean; primary_for: string[] }[] }
interface Prepared { project: string; keys: Record<ScreenId | 'avr' | 'speaker', string>; admin: AdminRow[] }

let prepared: Prepared | null = null;
let rid = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const newId = () => `cr015-${Date.now().toString(36)}-${(rid += 1)}`;
const expiry = (ms = 30_000) => new Date(Date.now() + ms).toISOString();

async function ctl<T = Record<string, unknown>>(request: APIRequestContext, route: string, data?: unknown): Promise<T> {
  const r = data === undefined ? await request.get(`${CONTROL}${route}`) : await request.post(`${CONTROL}${route}`, { data });
  expect(r.status(), `the fixture control server at ${CONTROL}${route} (is tests/fixtures/media_fake_ha.py the backend?)`).toBe(200);
  return (await r.json()) as T;
}
const logSince = async (request: APIRequestContext, since = 0) => (await ctl<{ entries: LogEntry[]; next: number; pending: number }>(request, `/media-log?since=${since}`));
const mark = async (request: APIRequestContext) => (await logSince(request)).next;
/** The bridge calls made after `since` that touch a media entity (waits briefly: a call is logged as the add-on's request is answered). */
async function callsSince(request: APIRequestContext, since: number, settleMs = 150) {
  await sleep(settleMs);
  return (await logSince(request, since)).entries;
}
async function setDevice(request: APIRequestContext, entity_id: string, state?: string, attributes?: Record<string, unknown>) {
  await ctl(request, '/media-set', { entity_id, state, attributes });
}

async function cmd(request: APIRequestContext, key: string, body: Record<string, unknown>, headers?: Record<string, string>) {
  const r = await request.post(`${API}/multimedia/devices/${key}/commands`, { headers, data: { ...body, client_request_id: newId(), expires_at: expiry() } });
  const j = await r.json().catch(() => ({}));
  return { status: r.status(), body: j as Record<string, any> };
}
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
const device = async (request: APIRequestContext, key: string, headers?: Record<string, string>) => (await (await request.get(`${API}/multimedia/devices/${key}`, { headers })).json()) as Dev & { sources: { id: string; label: string; kind: string }[]; apps: { id: string; label: string }[]; remote: { scope: string; sections: { id: string; on: boolean }[]; more: string[] }; recent: { id: string }[] };
async function liveOf(request: APIRequestContext, key: string) {
  return (await device(request, key)).live;
}

async function multimediaPresent(request: APIRequestContext): Promise<boolean> {
  return (await request.get(`${API}/multimedia/status`)).status() === 200;
}

/** Seeds the synthetic house, waits for the model, approves every device, links the amplifier to the living room screen. */
async function prepare(request: APIRequestContext, project: string): Promise<Prepared> {
  if (prepared && prepared.project === project) return prepared;
  const seeded = await ctl<{ registry_ok: boolean; states_ok: boolean; expect: { screens: number } }>(request, '/seed-media', {});
  expect(seeded.registry_ok && seeded.states_ok, 'the fixture seeded the registries and the states').toBe(true);
  let admin: AdminRow[] = [];
  for (let i = 0; i < 40; i += 1) {
    const r = await request.get(`${API}/multimedia/admin/devices`);
    if (r.status() === 200) admin = ((await r.json()) as { devices: AdminRow[] }).devices.filter((d) => String(d.anchor_entity_id).includes('cr015_'));
    if (admin.length >= 9) break;
    await sleep(500);
  }
  expect(admin.length, 'the model built 7 screens + 1 receiver + 1 speaker from the seeded registries').toBe(9);
  const byAnchor = (eid: string) => admin.find((d) => d.anchor_entity_id === eid)?.key ?? '';
  const keys = { ...Object.fromEntries((Object.entries(SCREENS) as [ScreenId, (typeof SCREENS)[ScreenId]][]).map(([id, s]) => [id, byAnchor(s.vendor)])), avr: byAnchor(RECEIVER.vendor), speaker: byAnchor(SPEAKER.vendor) } as Prepared['keys'];
  for (const [id, k] of Object.entries(keys)) expect(k, `a device was built for ${id}`).toBeTruthy();
  const ap = await request.post(`${API}/multimedia/admin/approve`, { data: { device_keys: Object.values(keys), approved: true } });
  expect(ap.status()).toBeLessThan(300);
  const link = await request.put(`${API}/multimedia/admin/devices/${keys.living}`, { data: { audio_link_key: keys.avr, audio_default: 'linked', public: false } });
  expect(link.status()).toBeLessThan(300);
  for (const id of ['kitchen', 'lobby', 'bedroom', 'hall', 'office', 'lounge'] as ScreenId[]) await request.put(`${API}/multimedia/admin/devices/${keys[id]}`, { data: { public: id === 'lobby' } });
  prepared = { project, keys, admin };
  return prepared;
}

async function bindUser(request: APIRequestContext, username: string, roleId: string): Promise<string> {
  const me = await (await request.get(`${API}/me`, { headers: { 'X-SW-Dev-User': username } })).json();
  const r = await request.post(`${API}/access/bindings`, { data: { subject_kind: 'user', subject_id: me.user.id, role_id: roleId, scope_type: 'installation', scope_id: '*' } });
  expect(r.status()).toBeLessThan(300);
  return ((await r.json()) as { id: string }).id;
}
async function mkRole(request: APIRequestContext, name: string, permissions: string[], sensitive: string[] = []): Promise<string> {
  const r = await request.post(`${API}/access/roles`, { data: { name: `${name} ${Date.now()}`, description: 'CR-015 evidence', permissions, sensitive } });
  expect(r.status(), `custom role ${name} (${permissions.join(',')})`).toBeLessThan(300);
  return ((await r.json()) as { id: string }).id;
}
interface Who { user: string; headers: Record<string, string> }
const as = (user: string): Who => ({ user, headers: { 'X-SW-Dev-User': user } });

async function shot(page: Page, name: string, info: TestInfo) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}-${{ desktop: 1440, tablet: 820, mobile: 390 }[info.project.name] ?? info.project.name}.png`) });
}
async function frame(page: Page, info: TestInfo) {
  if (info.project.name === 'tablet') await page.setViewportSize({ width: 820, height: 1180 });
}

// ------------------------------------------------------------------------------------------------ UI locators (S2 / S3 components)

const SEL = {
  rail: 'sw-app nav.rail a[href="#/multimedia/screens"]',
  bottom: 'sw-app nav.bottom a[href="#/multimedia/screens"]',
  card: 'media-screen-card',
  areaCard: 'media-area-card',
  remote: 'media-remote',
  remoteKey: (k: string) => `media-remote [data-key="${k}"]`,
  editMenu: '[data-menu-screen-edit="multimedia-layout"]',
  userMenuButton: 'sw-app [data-profile-menu]:visible, sw-app [data-nav-me]:visible',
  editPanel: 'multimedia-edit-panel',
  cardName: (name: string) => `media-screen-card:has-text("${name}")`,
  /** The "שלט" button of one card (aria-label "שלט · <name>", components/media-screen-card.ts); the picture opens the remote too. */
  openRemote: (name: string) => `media-screen-card:has-text("${name}") button[aria-label="שלט · ${name}"]`,
  power: 'media-remote [data-mr-power]',
  moveDown: 'multimedia-edit-panel [data-mm-down]:not([disabled])',
  save: '[data-mm-save]',
};

// ================================================================================================ part A: the fixture (runs today)

test.describe('media fixture: the synthetic house and the fake bridge (real backend, real action route)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the fixture backend running');
  test.skip(process.env.SW_MEDIA_FIXTURE !== '1', 'needs tests/fixtures/media_fake_ha.py as the backend (SW_MEDIA_FIXTURE=1)');

  test('the world is seeded: registries with devices and areas, every entity present with its state', async ({ request }) => {
    const seeded = await ctl<{ registry_ok: boolean; states_ok: boolean; expect: { screens: number; entities: number; devices: number }; screens: Record<string, { vendor: string; duplicates: string[] }> }>(request, '/seed-media', {});
    expect(seeded.registry_ok && seeded.states_ok).toBe(true);
    expect(seeded.expect).toEqual({ screens: 7, entities: 19, devices: 15 });
    for (const [id, s] of Object.entries(SCREENS)) {
      const e = await (await request.get(`${API}/ha/entities/${s.vendor}`)).json();
      expect(['on', 'playing'], id).toContain(e.state);
      expect(e.area_id, `${id} takes its area from its HA device`).toBe(s.area);
      expect(e.ha_floor_id).toBe(s.floor);
      expect(e.platform).toBe({ samsung_smart: 'samsungtv_smart', lg_webos: 'webostv', android_tv: 'androidtv_remote', generic: 'cast' }[s.profile]);
    }
    for (const dup of DUPLICATES_OF_LIVING) expect((await request.get(`${API}/ha/entities/${dup}`)).status(), dup).toBe(200);
    const hall = await (await request.get(`${API}/ha/entities/media_player.cr015_hall_tv`)).json();
    expect(hall.attributes.supported_features & 128, 'the LG without a turn-on automation has no TURN_ON').toBe(0);
    expect(hall.attributes.supported_features & 4, 'and no VOLUME_SET with an external speaker').toBe(0);
    const world = await ctl<{ screens: Record<string, unknown>; receivers: Record<string, unknown> }>(request, '/world');
    expect(Object.keys(world.screens)).toHaveLength(7);
    expect(Object.keys(world.receivers)).toEqual(['avr_living']);
  });

  test('a power command through the real action route is confirmed by a real state change, and the fake bridge logged it', async ({ request }) => {
    await ctl(request, '/seed-media', {});
    const since = await mark(request);
    const tv = SCREENS.bedroom.vendor;
    const exp = new Date(Date.now() + 30_000).toISOString();
    const r = await request.post(`${API}/ha/entities/${tv}/actions`, { data: { allowed_action_id: 'media_player.turn_off', arguments: {}, client_request_id: newId(), expires_at: exp } });
    expect(r.status()).toBe(202);
    const id = ((await r.json()) as { id: string }).id;
    expect(await pollAction(request, id, (s) => s !== 'pending')).toBe('confirmed');
    const calls = await callsSince(request, since);
    expect(calls.map((c) => [c.domain, c.service, c.entity_id, c.result, c.effect])).toEqual([['media_player', 'turn_off', tv, 'ok', true]]);
    expect((await (await request.get(`${API}/ha/entities/${tv}`)).json()).state).toBe('off');
    await ctl(request, '/seed-media', {});
  });

  test('a stuck TV accepts the command and never confirms; an unsupported service fails like Home Assistant', async ({ request }) => {
    await ctl(request, '/seed-media', {});
    const since = await mark(request);
    const post = (entity: string, action: string) => request.post(`${API}/ha/entities/${entity}/actions`, { data: { allowed_action_id: action, arguments: {}, client_request_id: newId(), expires_at: new Date(Date.now() + 30_000).toISOString() } });
    const stuck = await post(SCREENS.lounge.vendor, 'media_player.turn_off');
    expect(stuck.status()).toBe(202);
    const stuckId = ((await stuck.json()) as { id: string }).id;
    await sleep(1800);
    expect(await pollAction(request, stuckId, () => true, 1000), 'still pending: nothing was reported').toBe('pending');
    const hall = await post(SCREENS.hall.vendor, 'media_player.turn_on'); // the LG without a turn-on automation
    expect(hall.status()).toBe(202);
    const hallId = ((await hall.json()) as { id: string }).id;
    expect(await pollAction(request, hallId, (s) => s !== 'pending', 10_000)).not.toBe('confirmed');
    const calls = await callsSince(request, since);
    expect(calls.find((c) => c.entity_id === SCREENS.lounge.vendor)).toMatchObject({ service: 'turn_off', result: 'ok', effect: false });
    expect(calls.find((c) => c.entity_id === SCREENS.hall.vendor)).toMatchObject({ service: 'turn_on', result: 'HomeAssistantError', effect: false });
    await ctl(request, '/seed-media', {});
  });

  test('the bridge version is re-paired on request (media commands need 0.4.0)', async ({ request }) => {
    const old = await ctl<{ ping: number; bridge_version: string }>(request, '/media-config', { bridge_version: '0.3.9' });
    expect([old.ping, old.bridge_version]).toEqual([200, '0.3.9']);
    const now = await ctl<{ ping: number }>(request, '/media-config', { bridge_version: '0.4.0' });
    expect(now.ping).toBe(200);
    expect((await ctl<{ bridge_version: string; entities: number }>(request, '/status')).bridge_version).toBe('0.4.0');
  });

  test('a device can change on its own: power loss, unavailable, a new source', async ({ request }) => {
    await ctl(request, '/seed-media', {});
    await setDevice(request, SCREENS.office.vendor, 'off');
    await setDevice(request, SCREENS.hall.vendor, 'unavailable');
    await setDevice(request, SCREENS.kitchen.vendor, undefined, { source: 'HDMI 3' });
    await expect.poll(async () => (await (await request.get(`${API}/ha/entities/${SCREENS.office.vendor}`)).json()).state).toBe('off');
    const hall = await (await request.get(`${API}/ha/entities/${SCREENS.hall.vendor}`)).json();
    expect(hall.state).toBe('unavailable');
    expect(hall.attributes.source_list, 'an unavailable entity keeps only its capability attributes').toBeUndefined();
    expect((await (await request.get(`${API}/ha/entities/${SCREENS.kitchen.vendor}`)).json()).attributes.source).toBe('HDMI 3');
    await ctl(request, '/seed-media', {});
  });
});

// ================================================================================================ part B: the multimedia API (needs S1)

test.describe('multimedia API on the fixture (needs S1: /multimedia/* routes)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the fixture backend running');
  test.skip(process.env.SW_MEDIA_FIXTURE !== '1', 'needs tests/fixtures/media_fake_ha.py as the backend (SW_MEDIA_FIXTURE=1)');

  const roles: string[] = [];
  const bindings: string[] = [];

  async function ready(request: APIRequestContext, info: TestInfo): Promise<Prepared> {
    test.skip(!(await multimediaPresent(request)), 'S1 is not merged: GET /api/v1/multimedia/status does not answer 200 (routes missing)');
    return prepare(request, info.project.name);
  }

  test.afterAll(async ({ playwright }) => {
    // hooks run outside a test: the test-scoped `request` is not available, so a context of our own
    const request = await playwright.request.newContext({ baseURL: process.env.SW_BASE_URL || 'http://127.0.0.1:4173/' });
    try {
      for (const id of bindings.splice(0)) await request.delete(`${API}/access/bindings/${id}`).catch(() => {});
      for (const id of roles.splice(0)) await request.delete(`${API}/access/roles/${id}`).catch(() => {});
      if (await multimediaPresent(request).catch(() => false)) await request.delete(`${API}/multimedia/layout`).catch(() => {});
    } finally {
      await request.dispose();
    }
  });

  test('one card per physical TV: five duplicates of the living room TV collapse into one device; no private identifier leaves the server', async ({ request }, info) => {
    const p = await ready(request, info);
    const r = await request.get(`${API}/multimedia/devices?kind=screen`);
    expect(r.status()).toBe(200);
    const raw = await r.text();
    expect(raw, 'no entity id, MAC, IP, artwork URL or fixture identifier in the list').not.toMatch(PRIVATE);
    const list = (JSON.parse(raw) as { devices: Dev[] }).devices;
    expect(list.map((d) => d.name).sort()).toEqual(Object.values(SCREENS).map((s) => s.name).sort());
    for (const [id, s] of Object.entries(SCREENS)) {
      const d = list.find((x) => x.key === p.keys[id as ScreenId])!;
      expect(d, id).toBeTruthy();
      expect([d.kind, d.profile, d.floor_id, d.area_id], id).toEqual(['screen', s.profile, s.floor, s.area]);
      expect('anchor_entity_id' in d, 'the anchor entity id is for system.configure only').toBe(false);
    }
    expect(list.find((d) => d.key === p.keys.living)!.audio_link).toMatchObject({ key: p.keys.avr, name: RECEIVER.name, default: 'linked' });
    expect(list.filter((d) => d.audio_link).length).toBe(1);
    // the receiver and the speaker are devices, not screens
    const all = (await (await request.get(`${API}/multimedia/devices?kind=screen`)).json()).devices as Dev[];
    expect(all.some((d) => d.key === p.keys.avr || d.key === p.keys.speaker)).toBe(false);
    // detail: nothing private either
    for (const k of Object.values(p.keys).slice(0, 7)) expect(await (await request.get(`${API}/multimedia/devices/${k}`)).text()).not.toMatch(PRIVATE);
    expect(await (await request.get(`${API}/multimedia/status`)).text()).not.toMatch(PRIVATE);
  });

  test('the connections list (settings): who joined the living room TV by which rung, the two Samsungs stay two', async ({ request }, info) => {
    const p = await ready(request, info);
    const rows = (await (await request.get(`${API}/multimedia/admin/devices`)).json()) as { devices: AdminRow[] };
    const byKey = (k: string) => rows.devices.find((d) => d.key === k)!;
    const living = byKey(p.keys.living);
    expect(living.endpoints.map((e) => e.endpoint_id.replace(/^ha:/, '')).sort()).toEqual([SCREENS.living.vendor, 'remote.cr015_living_tv', ...DUPLICATES_OF_LIVING].sort());
    const ep = (eid: string) => living.endpoints.find((e) => e.endpoint_id.endsWith(eid))!;
    expect(ep(SCREENS.living.vendor).role).toBe('vendor');
    expect(ep('remote.cr015_living_tv').role).toBe('remote');
    expect(ep('living_tv_st').role).toBe('smartthings');
    expect(ep('living_tv_cast').role).toBe('cast');
    expect(ep('living_tv_dlna').role).toBe('dlna');
    expect(ep('living_tv_ma').role).toMatch(/^ma_(export|import)$/);
    for (const d of ['living_tv_st', 'living_tv_cast', 'living_tv_dlna', 'living_tv_ma']) expect(ep(d).hidden, `${d} is a hidden duplicate`).toBe(true);
    expect(ep(SCREENS.living.vendor).hidden).toBe(false);
    // SmartThings and DLNA joined through the MAC (one rung), the Cast through the UUID (another), the MA export by its player id (a third)
    expect(String(ep('living_tv_st').rule)).toBe(String(ep('living_tv_dlna').rule));
    expect(new Set([ep('living_tv_st').rule, ep('living_tv_cast').rule, ep('living_tv_ma').rule]).size, 'three different rungs').toBe(3);
    expect(ep(SCREENS.living.vendor).primary_for).toContain('power');
    expect(ep('living_tv_cast').primary_for, 'Cast never owns power').not.toContain('power');
    // the second Samsung (same platform, same model) is a device of its own, with no duplicate endpoint
    const kitchen = byKey(p.keys.kitchen);
    expect(kitchen.endpoints.map((e) => e.endpoint_id.replace(/^ha:/, '')).sort()).toEqual([SCREENS.kitchen.vendor, 'remote.cr015_kitchen_tv']);
    expect(byKey(p.keys.office).endpoints).toHaveLength(3); // remote + media_player + Cast
    expect(byKey(p.keys.avr).kind).toBe('receiver');
    expect(byKey(p.keys.speaker).kind).toBe('speaker');
    expect(rows.devices.filter((d) => d.anchor_entity_id.includes('cr015_')).every((d) => d.approved)).toBe(true);
  });

  test('capabilities follow the live endpoint and the profile: LG without wake, external speaker, Android keys, generic has no keys', async ({ request }, info) => {
    const p = await ready(request, info);
    const d = (id: ScreenId) => device(request, p.keys[id]);
    const hall = await d('hall');
    expect(hall.caps.power_on).toBe(false);
    expect(hall.caps.power_on_reason).toBe('no_remote_wake');
    expect(hall.caps.volume_set, 'external speaker: no slider').toBe(false);
    expect(hall.caps.volume_step).toBe(true);
    expect(hall.caps.keys).toEqual(expect.arrayContaining(['up', 'ok', 'back', 'volup']));
    expect(hall.caps.keys, 'LG rew / ff stay off until verified').not.toEqual(expect.arrayContaining(['rew']));
    const bedroom = await d('bedroom');
    expect(bedroom.caps.power_on).toBe(true);
    expect(bedroom.caps.volume_set).toBe(true);
    expect(bedroom.caps.text, 'LG text entry is unverified').toBe(false);
    const living = await d('living');
    expect(living.caps.keys).toEqual(expect.arrayContaining(['up', 'down', 'left', 'right', 'ok', 'back', 'home', 'menu', 'n0', 'n9', 'red', 'play']));
    expect(living.caps.keys, 'Samsung blue (KEY_CYAN) is unverified and off').not.toContain('blue');
    expect(living.caps.text).toBe(true);
    expect(living.caps.sources && living.caps.apps).toBe(true);
    const office = await d('office');
    expect(office.caps.apps, 'Android apps come from the remote activities').toBe(true);
    expect(office.caps.sources, 'the Android media_player has no SELECT_SOURCE').toBe(false);
    expect(office.caps.keys).toEqual(expect.arrayContaining(['ok', 'volup', 'chup', 'n5', 'red']));
    expect(office.caps.text).toBe(true);
    const lobby = await d('lobby');
    expect(lobby.profile).toBe('generic');
    expect(lobby.caps.keys).toEqual([]);
    expect(lobby.caps.text || lobby.caps.touchpad).toBe(false);
    for (const id of ['living', 'kitchen', 'bedroom', 'hall', 'office', 'lobby', 'lounge'] as ScreenId[]) {
      const caps = (await d(id)).caps;
      expect(JSON.stringify(caps.keys), `${id}: no power key in any vocabulary`).not.toMatch(/power/i);
    }
  });

  test('confirmed: power off is accepted, confirmed by the state, a second power command within 8 s is refused; power on restores', async ({ request }, info) => {
    const p = await ready(request, info);
    await ctl(request, '/seed-media', {});
    await sleep(800);
    const since = await mark(request);
    const off = await cmd(request, p.keys.bedroom, { command: 'power_off' });
    expect(off.status).toBe(202);
    expect(off.body).toMatchObject({ status: 'accepted', error: null });
    expect(typeof off.body.action_id).toBe('string');
    const again = await cmd(request, p.keys.bedroom, { command: 'power_off' });
    expect([again.status, again.body.code]).toEqual([409, 'power_pending']);
    expect(await pollAction(request, off.body.action_id, (s) => s !== 'pending')).toBe('confirmed');
    await expect.poll(async () => (await liveOf(request, p.keys.bedroom)).power).toBe('off');
    expect((await liveOf(request, p.keys.bedroom)).confirmed).toBe(true);
    const calls = await callsSince(request, since);
    expect(calls.filter((c) => c.kind === 'power').map((c) => [c.service, c.entity_id])).toEqual([['turn_off', SCREENS.bedroom.vendor]]);
    // anything but power-on on an off screen is refused
    const vol = await cmd(request, p.keys.bedroom, { command: 'key', key: 'ok' });
    expect([vol.status, vol.body.code]).toEqual([409, 'screen_off']);
    await sleep(2200); // at least 2 s between power commands
    const on = await cmd(request, p.keys.bedroom, { command: 'power_on' });
    expect(on.status).toBe(202);
    expect(await pollAction(request, on.body.action_id, (s) => s !== 'pending')).toBe('confirmed');
    // the LG without a turn-on automation: power-on is not offered, and the server refuses it
    const hallOn = await cmd(request, p.keys.hall, { command: 'power_on' });
    expect([hallOn.status, hallOn.body.code]).toEqual([422, 'not_supported']);
    expect((await callsSince(request, since)).filter((c) => c.entity_id === SCREENS.hall.vendor)).toEqual([]);
  });

  test('not confirmed: the stuck TV accepts power off and never reports it; its state stays unconfirmed until it reports again', async ({ request }, info) => {
    const p = await ready(request, info);
    await ctl(request, '/seed-media', {});
    await sleep(800);
    const since = await mark(request);
    const off = await cmd(request, p.keys.lounge, { command: 'power_off' });
    expect(off.status).toBe(202);
    expect(off.body.status).toBe('accepted');
    await sleep(1500);
    expect(await pollAction(request, off.body.action_id, () => true, 500), 'nothing was reported: the action stays pending (unknown after 20 s)').toBe('pending');
    const live = await liveOf(request, p.keys.lounge);
    expect(live.confirmed, 'nothing reported since our command: the state is not confirmed').toBe(false);
    expect(live.power, 'the last confirmed state is kept: it is not "off"').toBe('on');
    expect((await callsSince(request, since)).find((c) => c.entity_id === SCREENS.lounge.vendor)).toMatchObject({ service: 'turn_off', result: 'ok', effect: false });
    await setDevice(request, SCREENS.lounge.vendor, 'on'); // the TV reports again
    await expect.poll(async () => (await liveOf(request, p.keys.lounge)).confirmed, { timeout: 10_000 }).toBe(true);
  });

  test('exact key codes per profile reach the bridge (Samsung, LG, Android); nothing the bridge would refuse is ever sent', async ({ request }, info) => {
    test.setTimeout(120_000);
    const p = await ready(request, info);
    await ctl(request, '/seed-media', {});
    await sleep(800);
    const since = await mark(request);
    const targets: [ScreenId, keyof typeof CODES][] = [['living', 'samsung_smart'], ['bedroom', 'lg_webos'], ['office', 'android_tv']];
    for (const [id, profile] of targets) {
      const [domain, service] = TRANSPORT[profile];
      for (const [keyId, code] of Object.entries(CODES[profile])) {
        const before = await mark(request);
        const r = await cmd(request, p.keys[id], { command: 'key', key: keyId });
        expect(r.status, `${id} ${keyId}: ${JSON.stringify(r.body)}`).toBe(202);
        expect(r.body.status, `${id} ${keyId}: keys are sent, not confirmable`).toBe('sent');
        expect(r.body.action_id).toBeNull();
        const calls = await callsSince(request, before);
        expect(calls.map((c) => [c.domain, c.service, c.kind, c.code, c.result]), `${id} ${keyId}`).toEqual([[domain, service, 'key', code, 'ok']]);
        await sleep(260); // under 5 keys per second and device
      }
    }
    // Samsung blue (unverified) and LG rew / ff are not in the vocabulary: refused by the server before the bridge
    const blue = await cmd(request, p.keys.living, { command: 'key', key: 'blue' });
    expect([blue.status, blue.body.code]).toEqual([422, 'not_supported']);
    const rew = await cmd(request, p.keys.bedroom, { command: 'key', key: 'rew' });
    expect([rew.status, rew.body.code]).toEqual([422, 'not_supported']);
    // a generic screen has no keys at all
    const generic = await cmd(request, p.keys.lobby, { command: 'key', key: 'ok' });
    expect([generic.status, generic.body.code]).toEqual([422, 'not_supported']);
    // a power key does not exist: not as a KeyId, not as a raw code
    for (const key of ['power', 'KEY_POWER', 'POWER', 'KEY_POWEROFF']) {
      const r = await cmd(request, p.keys.living, { command: 'key', key });
      expect([r.status, r.body.code], key).toEqual([422, 'validation']);
    }
    const all = (await callsSince(request, since, 300)).filter((c) => c.kind !== 'other');
    expect(all.filter((c) => c.result !== 'ok'), 'the bridge refused nothing: the add-on never sends what the bridge would refuse').toEqual([]);
    expect(all.some((c) => /POWER/i.test(c.code ?? '')), 'no power key was sent').toBe(false);
  });

  test('text, sources and apps: typed text reaches the TV as typed, a source is the TV\'s own string, an unknown or hidden one is refused', async ({ request }, info) => {
    test.setTimeout(90_000);
    const p = await ready(request, info);
    await ctl(request, '/seed-media', {});
    await sleep(800);
    const since = await mark(request);
    const t1 = await cmd(request, p.keys.living, { command: 'text', text: 'שלום עולם' });
    expect([t1.status, t1.body.status]).toEqual([202, 'sent']);
    await sleep(1100);
    const t2 = await cmd(request, p.keys.office, { command: 'text', text: 'movie night' });
    expect([t2.status, t2.body.status]).toEqual([202, 'sent']);
    await sleep(1100);
    const tl = await cmd(request, p.keys.bedroom, { command: 'text', text: 'x' });
    expect([tl.status, tl.body.code], 'LG text entry is off until verified').toEqual([422, 'not_supported']);
    const tooLong = await cmd(request, p.keys.living, { command: 'text', text: 'x'.repeat(201) });
    expect([tooLong.status, tooLong.body.code]).toEqual([422, 'validation']);
    // a source: the entity's own string; confirmed through the attribute
    const detail = await device(request, p.keys.living);
    expect(detail.sources.map((s) => s.id)).toEqual(expect.arrayContaining(['TV', 'HDMI 1', 'HDMI 2']));
    expect(detail.apps.map((a) => a.id)).toEqual(expect.arrayContaining(['Netflix', 'YouTube']));
    const s1 = await cmd(request, p.keys.living, { command: 'source', source_id: 'HDMI 2' });
    expect([s1.status, s1.body.status]).toEqual([202, 'accepted']);
    expect(await pollAction(request, s1.body.action_id, (s) => s !== 'pending')).toBe('confirmed');
    const unknown = await cmd(request, p.keys.living, { command: 'source', source_id: 'HDMI 9' });
    expect([unknown.status, unknown.body.code]).toEqual([422, 'not_supported']);
    // the Android app goes through the remote's activity
    const a1 = await cmd(request, p.keys.office, { command: 'app', app_id: 'netflix://' });
    expect([a1.status, a1.body.status]).toEqual([202, 'accepted']);
    expect(await pollAction(request, a1.body.action_id, (s) => s !== 'pending')).toBe('confirmed');
    const badApp = await cmd(request, p.keys.office, { command: 'app', app_id: 'https://example.invalid' });
    expect([badApp.status, badApp.body.code]).toEqual([422, 'not_supported']);
    const calls = (await callsSince(request, since)).filter((c) => c.kind === 'text' || c.kind === 'source' || c.kind === 'app');
    expect(calls.map((c) => [c.domain, c.service, c.kind, c.text ?? c.source ?? c.activity, c.result])).toEqual([
      ['media_player', 'play_media', 'text', 'שלום עולם', 'ok'],
      ['remote', 'send_command', 'text', 'movie night', 'ok'],
      ['media_player', 'select_source', 'source', 'HDMI 2', 'ok'],
      ['remote', 'turn_on', 'app', 'netflix://', 'ok'],
    ]);
    // the recent row keeps the confirmed picks
    await expect.poll(async () => (await device(request, p.keys.living)).recent.map((r) => r.id)).toContain('HDMI 2');
  });

  test('429: a storm of keys is dropped beyond the burst, never queued', async ({ request }, info) => {
    const p = await ready(request, info);
    await ctl(request, '/seed-media', {});
    await sleep(2000); // a fresh bucket
    const since = await mark(request);
    const results = await Promise.all(Array.from({ length: 16 }, () => cmd(request, p.keys.kitchen, { command: 'key', key: 'volup' })));
    const ok = results.filter((r) => r.status === 202).length;
    const limited = results.filter((r) => r.status === 429);
    expect(ok, 'the burst of 8 (plus what the bucket refilled meanwhile)').toBeGreaterThanOrEqual(8);
    expect(ok).toBeLessThanOrEqual(11);
    expect(limited.length).toBeGreaterThanOrEqual(5);
    expect(limited.every((r) => r.body.code === 'rate_limited')).toBe(true);
    const first = (await callsSince(request, since)).filter((c) => c.code === 'KEY_VOLUP');
    expect(first.length, 'exactly the accepted presses reached the bridge').toBe(ok);
    await sleep(2500);
    expect((await callsSince(request, since, 0)).filter((c) => c.code === 'KEY_VOLUP').length, 'the dropped presses were never queued: nothing arrives later').toBe(ok);
  });

  test('bridge older than 0.4.0: media commands are refused with bridge_outdated; the status says so', async ({ request }, info) => {
    const p = await ready(request, info);
    await ctl(request, '/media-config', { bridge_version: '0.3.9' });
    try {
      const st = await (await request.get(`${API}/multimedia/status`)).json();
      expect(st.bridge.media_ready).toBe(false);
      const since = await mark(request);
      const r = await cmd(request, p.keys.kitchen, { command: 'key', key: 'up' });
      expect([r.status, r.body.code]).toEqual([503, 'bridge_outdated']);
      expect(await callsSince(request, since)).toEqual([]);
    } finally {
      await ctl(request, '/media-config', { bridge_version: '0.4.0' });
    }
    await expect.poll(async () => (await (await request.get(`${API}/multimedia/status`)).json()).bridge.media_ready).toBe(true);
  });

  test('public screens: source, app and text need media.public; control does not; the generic action route refuses a managed screen', async ({ request }, info) => {
    const p = await ready(request, info);
    const role = await mkRole(request, 'CR-015 operator', ['map.read', 'media.read', 'media.control', 'media.power']);
    roles.push(role);
    const op = as(`cr015op${info.project.name}`);
    bindings.push(await bindUser(request, op.user, role));
    const viewRole = await mkRole(request, 'CR-015 view only', ['map.read', 'media.read']);
    roles.push(viewRole);
    const viewer = as(`cr015view${info.project.name}`);
    bindings.push(await bindUser(request, viewer.user, viewRole));
    await request.put(`${API}/multimedia/admin/devices/${p.keys.kitchen}`, { data: { public: true } });
    try {
      const dev = await device(request, p.keys.kitchen, op.headers);
      expect(dev.public).toBe(true);
      expect([dev.can.control, dev.can.power, dev.can.public_ok]).toEqual([true, true, false]);
      const adminView = await device(request, p.keys.kitchen);
      expect(adminView.can.public_ok, 'the administrator holds media.public').toBe(true);
      const src = await cmd(request, p.keys.kitchen, { command: 'source', source_id: 'HDMI 2' }, op.headers);
      expect([src.status, src.body.code]).toEqual([403, 'public_screen']);
      const txt = await cmd(request, p.keys.kitchen, { command: 'text', text: 'hello' }, op.headers);
      expect([txt.status, txt.body.code]).toEqual([403, 'public_screen']);
      await sleep(300);
      const key = await cmd(request, p.keys.kitchen, { command: 'key', key: 'ok' }, op.headers);
      expect(key.status, 'a key is control, allowed on a public screen').toBe(202);
      const since = await mark(request);
      const ok = await cmd(request, p.keys.kitchen, { command: 'source', source_id: 'HDMI 2' });
      expect(ok.status).toBe(202);
      expect((await callsSince(request, since)).find((c) => c.kind === 'source')).toMatchObject({ source: 'HDMI 2' });
      // a not public screen: the operator changes the source
      const normal = await cmd(request, p.keys.living, { command: 'source', source_id: 'HDMI 1' }, op.headers);
      expect(normal.status).toBe(202);
      // view only: the state is visible, nothing can be sent
      const v = await device(request, p.keys.kitchen, viewer.headers);
      expect([v.can.control, v.can.power]).toEqual([false, false]);
      const denied = await cmd(request, p.keys.kitchen, { command: 'key', key: 'ok' }, viewer.headers);
      expect([denied.status, denied.body.code]).toEqual([403, 'forbidden']);
      // the generic action route refuses a managed screen and any raw play_media (CR section 5.2)
      const generic = await request.post(`${API}/ha/entities/${SCREENS.kitchen.vendor}/actions`, { data: { allowed_action_id: 'media_player.turn_off', arguments: {}, client_request_id: newId(), expires_at: expiry() } });
      expect(generic.status()).toBe(409);
      expect((await generic.json()).code).toBe('use_media_screen');
      const raw = await request.post(`${API}/ha/entities/${SCREENS.kitchen.vendor}/actions`, { data: { allowed_action_id: 'media_player.play_media', arguments: { media_content_type: 'send_key', media_content_id: 'KEY_POWER' }, client_request_id: newId(), expires_at: expiry() } });
      expect([409, 422]).toContain(raw.status());
    } finally {
      await request.put(`${API}/multimedia/admin/devices/${p.keys.kitchen}`, { data: { public: false } });
    }
  });

  test('bulk "כבה מסכים": only screens confirmed on are sent, the rest are skipped with their reason; receivers and speakers are never touched', async ({ request }, info) => {
    test.setTimeout(120_000);
    const p = await ready(request, info);
    await ctl(request, '/seed-media', {});
    await sleep(1000);
    // the upper floor: bedroom on (send), office off (already off), hall unavailable, lounge accepted a command and never reported (not confirmed)
    await setDevice(request, SCREENS.office.vendor, 'off');
    await setDevice(request, SCREENS.hall.vendor, 'unavailable');
    const stuck = await cmd(request, p.keys.lounge, { command: 'power_off' });
    expect(stuck.status).toBe(202);
    await expect.poll(async () => (await liveOf(request, p.keys.office)).power).toBe('off');
    await expect.poll(async () => (await liveOf(request, p.keys.hall)).power).toBe('unavailable');
    const preview = await (await request.get(`${API}/multimedia/actions/preview?scope=floor&id=cr015_upper`)).json();
    expect(preview.counts).toEqual({ send: 1, already_off: 1, not_confirmed: 1, unavailable: 1, not_allowed: 0 });
    const will = Object.fromEntries((preview.devices as { key: string; will: string; reason: string | null }[]).map((d) => [d.key, [d.will, d.reason]]));
    expect(will[p.keys.bedroom]).toEqual(['off', null]);
    expect(will[p.keys.office]).toEqual(['skip', 'already_off']);
    expect(will[p.keys.hall]).toEqual(['skip', 'unavailable']);
    expect(will[p.keys.lounge]).toEqual(['skip', 'not_confirmed']);
    expect(Object.keys(will), 'only this floor\'s screens').toHaveLength(4);
    const area = await (await request.get(`${API}/multimedia/actions/preview?scope=area&id=cr015_living`)).json();
    expect((area.devices as { key: string }[]).map((d) => d.key), 'the receiver in the same room is never part of "כבה הכל"').toEqual([p.keys.living]);
    const building = await request.get(`${API}/multimedia/actions/preview?scope=building&id=x`);
    expect(building.status(), 'no building-wide off (decision 7b was not taken)').toBe(422);
    // a caller without media.bulk cannot even preview
    const role = await mkRole(request, 'CR-015 no bulk', ['map.read', 'media.read', 'media.control', 'media.power']);
    roles.push(role);
    const nb = as(`cr015nobulk${info.project.name}`);
    bindings.push(await bindUser(request, nb.user, role));
    expect((await request.get(`${API}/multimedia/actions/preview?scope=floor&id=cr015_upper`, { headers: nb.headers })).status()).toBe(403);
    // the run: unconfirmed is refused, confirmed goes; afterwards exactly one turn_off reached the bridge
    await sleep(8200); // the stuck TV's own pending power command is over
    const since = await mark(request);
    const body = { scope: 'floor', id: 'cr015_upper', kind: 'screens_off', client_request_id: newId(), expires_at: expiry() };
    const noConfirm = await request.post(`${API}/multimedia/actions`, { data: { ...body, confirmed: false } });
    expect(noConfirm.status()).toBeGreaterThanOrEqual(400);
    const run = await request.post(`${API}/multimedia/actions`, { data: { ...body, client_request_id: newId(), confirmed: true } });
    expect(run.status()).toBe(202);
    const bulkId = ((await run.json()) as { bulk_id: string }).bulk_id;
    await expect.poll(async () => ((await (await request.get(`${API}/devices/actions/${bulkId}`)).json()) as { done: boolean }).done, { timeout: 30_000 }).toBe(true);
    const record = (await (await request.get(`${API}/devices/actions/${bulkId}`)).json()) as { counts: { total: number; confirmed: number }; items: { entity_id: string; outcome: string }[] };
    expect([record.counts.total, record.counts.confirmed], 'one screen sent, honestly confirmed by its own report').toEqual([1, 1]);
    expect(record.items.map((i) => [i.entity_id, i.outcome]), 'the power endpoint of the screen, not one of its duplicates').toEqual([[SCREENS.bedroom.vendor, 'confirmed']]);
    const calls = (await callsSince(request, since)).filter((c) => c.kind === 'power');
    expect(calls.map((c) => [c.service, c.entity_id, c.result]), 'one power-off, to the one screen that was confirmed on').toEqual([['turn_off', SCREENS.bedroom.vendor, 'ok']]);
    expect(calls.some((c) => c.entity_id === RECEIVER.vendor || c.entity_id === SPEAKER.vendor)).toBe(false);
    await ctl(request, '/seed-media', {});
  });

  test('layout and remote configuration: revision conflict, installation layout, personal override only for screen.personalize, per-screen curation', async ({ request }, info) => {
    const p = await ready(request, info);
    const name = info.project.name;
    const role = await mkRole(request, 'CR-015 personalizer', ['map.read', 'media.read', 'media.control', 'screen.personalize']);
    roles.push(role);
    const holder = as(`cr015pers${name}`);
    bindings.push(await bindUser(request, holder.user, role));
    const plainRole = await mkRole(request, 'CR-015 plain', ['map.read', 'media.read']);
    roles.push(plainRole);
    const plain = as(`cr015plain${name}`);
    bindings.push(await bindUser(request, plain.user, plainRole));
    await request.delete(`${API}/multimedia/layout`);
    await request.put(`${API}/me/prefs`, { headers: holder.headers, data: { 'multimedia.personal': null } });
    const l0 = await (await request.get(`${API}/multimedia/layout`)).json();
    expect([l0.can_edit, typeof l0.revision]).toEqual([true, 'number']);
    const layout = { version: 1, group_by: 'area', floor_order: ['cr015_upper', 'cr015_ground'], pinned: [p.keys.living], order: [p.keys.kitchen, p.keys.living], cards: { [p.keys.kitchen]: { on: false, size: 'l', phone_on: null, phone_size: null } } };
    const saved = await request.put(`${API}/multimedia/layout`, { data: { layout, base_revision: l0.revision } });
    expect(saved.status()).toBe(200);
    const l1 = await saved.json();
    expect(l1.revision).toBeGreaterThan(l0.revision);
    expect(l1.installation).toMatchObject({ group_by: 'area', pinned: [p.keys.living] });
    const stale = await request.put(`${API}/multimedia/layout`, { data: { layout, base_revision: l0.revision } });
    expect([stale.status(), (await stale.json()).code]).toEqual([409, 'revision_conflict']);
    expect((await request.put(`${API}/multimedia/layout`, { headers: plain.headers, data: { layout, base_revision: l1.revision } })).status(), 'media.layout is needed to edit').toBe(403);
    // personal: only with screen.personalize - refused on write and hidden on read without it
    const mine = { group_by: 'none', order: [p.keys.living, p.keys.kitchen], cards: { [p.keys.lobby]: { on: false } } };
    const denied = await request.put(`${API}/me/prefs`, { headers: plain.headers, data: { 'multimedia.personal': mine } });
    expect([denied.status(), (await denied.json()).code]).toEqual([403, 'personalize_required']);
    expect((await request.put(`${API}/me/prefs`, { headers: holder.headers, data: { 'multimedia.personal': mine } })).status()).toBe(200);
    const theirs = await (await request.get(`${API}/multimedia/layout`, { headers: holder.headers })).json();
    expect([theirs.can_personalize, theirs.personal?.group_by, theirs.personal?.order]).toEqual([true, 'none', [p.keys.living, p.keys.kitchen]]);
    expect(theirs.installation.group_by, 'the installation layout is untouched by a personal one').toBe('area');
    const others = await (await request.get(`${API}/multimedia/layout`, { headers: plain.headers })).json();
    expect([others.can_personalize, others.personal]).toEqual([false, null]);
    expect((await (await request.get(`${API}/multimedia/layout`)).json()).personal, 'and not visible to the administrator\'s own view').toBeNull();
    // reset
    expect((await request.delete(`${API}/multimedia/layout`)).status()).toBe(204);
    expect((await (await request.get(`${API}/multimedia/layout`)).json()).installation.pinned).toEqual([]);
    await request.put(`${API}/me/prefs`, { headers: holder.headers, data: { 'multimedia.personal': null } });

    // the remote default, then one screen's own curation (rename, hide, order) and its return to the default
    const d0 = await (await request.get(`${API}/multimedia/remote-default`)).json();
    expect(d0.sections.map((s: { id: string }) => s.id).sort()).toEqual([...SECTIONS].sort());
    const swapped = { sections: d0.sections, more: ['nums', 'colors', 'text', 'xtra', 'ch'] };
    expect((await request.put(`${API}/multimedia/remote-default`, { data: swapped })).status()).toBe(200);
    expect((await (await request.get(`${API}/multimedia/devices/${p.keys.kitchen}`)).json()).remote.more).toContain('ch');
    expect((await request.put(`${API}/multimedia/remote-default`, { data: { sections: d0.sections, more: d0.more } })).status()).toBe(200);
    const custom = {
      remote: { sections: SECTIONS.map((id) => ({ id, on: id !== 'colors' })), more: ['nums', 'text', 'xtra'] },
      sources: [{ id: 'HDMI 2', label: 'HDMI 2 · ממיר', hidden: false, kind: 'source', glyph: 'hdmi' }, { id: 'HDMI 3', label: null, hidden: true, kind: 'source', glyph: null }],
      apps: [{ id: 'YouTube', label: null, hidden: false, glyph: null }],
    };
    const put = await request.put(`${API}/multimedia/devices/${p.keys.kitchen}/remote`, { data: custom });
    expect(put.status()).toBe(200);
    const k = await put.json();
    expect(k.remote.scope).toBe('device');
    expect(k.sources[0]).toMatchObject({ id: 'HDMI 2', label: 'HDMI 2 · ממיר' });
    expect(k.sources.some((s: { id: string }) => s.id === 'HDMI 3'), 'a hidden source is omitted for everyone').toBe(false);
    expect(k.apps[0].id, 'the curated order comes first').toBe('YouTube');
    const hidden = await cmd(request, p.keys.kitchen, { command: 'source', source_id: 'HDMI 3' });
    expect([hidden.status, hidden.body.code]).toEqual([422, 'not_supported']);
    expect((await request.put(`${API}/multimedia/devices/${p.keys.kitchen}/remote`, { headers: plain.headers, data: custom })).status()).toBe(403);
    const reset = await request.put(`${API}/multimedia/devices/${p.keys.kitchen}/remote`, { data: { remote: null, sources: [], apps: [] } });
    expect(reset.status()).toBe(200);
    expect((await reset.json()).remote.scope).toBe('default');
  });

  test('artwork: only real content art is proxied, never an HA URL; an app-less screen has none', async ({ request }, info) => {
    const p = await ready(request, info);
    await ctl(request, '/seed-media', {});
    await sleep(1200);
    const office = await device(request, p.keys.office);
    const art = office.live.now;
    expect(art.artwork, 'the Cast entity of the office TV carries content metadata').toBeTruthy();
    expect(art.artwork, 'a relative proxy URL of the add-on, versioned').toMatch(/^(\/?api\/v1\/)?multimedia\/devices\/[a-f0-9]{32}\/artwork\?v=/);
    const u = art.artwork!;
    const img = await request.get(u.startsWith('/') ? u : u.startsWith('api/') ? `/${u}` : `${API}/${u}`);
    expect(img.status()).toBe(200);
    expect(img.headers()['content-type']).toMatch(/^image\/(jpeg|png|webp)/);
    expect(img.headers()['cache-control']).toMatch(/private/);
    expect((await ctl<{ artwork_fetches: number }>(request, '/status')).artwork_fetches).toBeGreaterThanOrEqual(1);
    expect((await request.get(`${API}/multimedia/devices/${p.keys.hall}/artwork?v=x`)).status(), 'no content art for a channel screen').toBe(404);
  });
});

// ================================================================================================ part C: screens, remote, editors (needs S2 + S3)

test.describe('multimedia screens, the remote and the editors on the fixture (needs S2 + S3)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the fixture backend running');
  test.skip(process.env.SW_MEDIA_FIXTURE !== '1', 'needs tests/fixtures/media_fake_ha.py as the backend (SW_MEDIA_FIXTURE=1)');

  async function open(page: Page, request: APIRequestContext, info: TestInfo, hash: string): Promise<Prepared> {
    test.skip(!(await multimediaPresent(request)), 'S1 is not merged: the /multimedia routes are missing');
    const p = await prepare(request, info.project.name);
    await frame(page, info);
    await page.goto(`/?design=a#${hash}`);
    await page.waitForSelector('sw-app');
    const entry = info.project.name === 'mobile' ? SEL.bottom : SEL.rail;
    const n = await page.locator(entry).count();
    test.skip(n === 0, 'S2 is not merged: the rail has no "מולטימדיה" entry (a[href="#/multimedia/screens"])');
    return p;
  }

  test('the screens page: one card per physical TV, grouped by floor, no platform names', async ({ page, request }, info) => {
    await open(page, request, info, '/multimedia/screens');
    await expect(page.locator(SEL.card), 'one card per physical screen (the five duplicates of the living room TV are one)').toHaveCount(7, { timeout: 30_000 });
    for (const s of Object.values(SCREENS)) await expect(page.locator(SEL.cardName(s.name)), s.name).toHaveCount(1);
    const text = await page.locator('sw-app').innerText();
    expect(text).not.toMatch(/Home Assistant|\bHA\b|Ingress|Supervisor|SmartThings|Music Assistant|DLNA|Cast/i);
    await shot(page, 'media-screens-live', info);
  });

  test('the remote from a card: a key reaches the bridge with the exact code; volume goes to the linked amplifier; power is never a key', async ({ page, request }, info) => {
    const p = await open(page, request, info, '/multimedia/screens');
    await ctl(request, '/seed-media', {});
    await expect(page.locator(SEL.card)).toHaveCount(7, { timeout: 30_000 });
    await page.locator(SEL.openRemote(SCREENS.living.name)).click();
    await expect(page.locator(SEL.remote)).toBeVisible({ timeout: 15_000 });
    await shot(page, 'media-remote-samsung-live', info);
    const since = await mark(request);
    await page.locator(SEL.remoteKey('ok')).click();
    await expect.poll(async () => (await callsSince(request, since, 0)).map((c) => c.code)).toContain('KEY_ENTER');
    await page.locator(SEL.remoteKey('back')).click();
    await expect.poll(async () => (await callsSince(request, since, 0)).map((c) => c.code)).toContain('KEY_RETURN');
    // volume follows the linked amplifier
    const vol = page.locator(SEL.remoteKey('volup')).first();
    await vol.click();
    await expect.poll(async () => (await callsSince(request, since, 0)).some((c) => c.entity_id === RECEIVER.vendor && /volume_up|volume_set/.test(c.service))).toBe(true);
    const all = await callsSince(request, since, 300);
    expect(all.some((c) => /POWER/i.test(c.code ?? '')), 'no power key ever').toBe(false);
    expect(p.keys.living).toBeTruthy();
    // opening a remote does not power anything on
    expect(all.some((c) => c.kind === 'power')).toBe(false);
  });

  test('the remote on an LG and an Android screen sends that profile\'s codes', async ({ page, request }, info) => {
    await open(page, request, info, '/multimedia/screens');
    await ctl(request, '/seed-media', {});
    await expect(page.locator(SEL.card)).toHaveCount(7, { timeout: 30_000 });
    for (const [screen, code] of [[SCREENS.bedroom, 'ENTER'], [SCREENS.office, 'DPAD_CENTER']] as const) {
      await page.locator(SEL.openRemote(screen.name)).click();
      await expect(page.locator(SEL.remote)).toBeVisible({ timeout: 15_000 });
      const since = await mark(request);
      await page.locator(SEL.remoteKey('ok')).click();
      await expect.poll(async () => (await callsSince(request, since, 0)).map((c) => c.code)).toContain(code);
      await shot(page, `media-remote-${screen.profile}-live`, info);
      await page.keyboard.press('Escape');
      await expect(page.locator(SEL.remote)).toBeHidden({ timeout: 10_000 });
    }
  });

  test('confirmed and not confirmed in the remote: a power-off on the stuck TV ends with "המסך לא אישר את הפקודה" after 8 s', async ({ page, request }, info) => {
    test.setTimeout(90_000);
    await open(page, request, info, '/multimedia/screens');
    await ctl(request, '/seed-media', {});
    await expect(page.locator(SEL.card)).toHaveCount(7, { timeout: 30_000 });
    await page.locator(SEL.openRemote(SCREENS.lounge.name)).click();
    await expect(page.locator(SEL.remote)).toBeVisible({ timeout: 15_000 });
    await page.locator(SEL.power).first().click();
    await expect(page.locator('sw-app')).toContainText('המסך לא אישר את הפקודה', { timeout: 20_000 });
    await shot(page, 'media-remote-not-confirmed-live', info);
    await ctl(request, '/seed-media', {});
  });

  test('the area card: the same remote opens from the area screen, one card per TV of the room', async ({ page, request }, info) => {
    await open(page, request, info, '/devices/areas/cr015_living');
    await ctl(request, '/seed-media', {});
    const card = page.locator(SEL.areaCard);
    await expect(card, 'the area screen has a media card').toBeVisible({ timeout: 30_000 });
    await expect(card.locator(SEL.card), 'one card for the living room TV (the duplicates and the amplifier are not cards of their own)').toHaveCount(1);
    await shot(page, 'media-area-card-live', info);
    await card.getByRole('button', { name: 'שלט' }).first().click();
    await expect(page.locator(SEL.remote)).toBeVisible({ timeout: 15_000 });
    const since = await mark(request);
    await page.locator(SEL.remoteKey('ok')).click();
    await expect.poll(async () => (await callsSince(request, since, 0)).map((c) => c.code)).toContain('KEY_ENTER');
    await page.keyboard.press('Escape');
    // "כבה הכל" of the area turns off only the screens confirmed on
    const before = await mark(request);
    await card.getByRole('button', { name: /כבה הכל/ }).click();
    await page.getByRole('button', { name: /כיבוי|אישור|כבה/ }).last().click();
    await expect.poll(async () => (await callsSince(request, before, 0)).filter((c) => c.kind === 'power').map((c) => c.entity_id), { timeout: 20_000 }).toEqual([SCREENS.living.vendor]);
    await ctl(request, '/seed-media', {});
  });

  test('the editor: edit mode from the user menu, a saved order survives a reload; a personal override only with screen.personalize', async ({ page, request, browser }, info) => {
    test.setTimeout(120_000);
    const p = await open(page, request, info, '/multimedia/screens');
    await request.delete(`${API}/multimedia/layout`);
    await expect(page.locator(SEL.card)).toHaveCount(7, { timeout: 30_000 });
    await page.locator(SEL.userMenuButton).first().click();
    await expect(page.locator(SEL.editMenu), 'the user menu offers "עריכת מסך המולטימדיה" to a media.layout holder').toBeVisible();
    await page.locator(SEL.editMenu).click();
    await expect(page).toHaveURL(/edit=1/);
    await expect(page.locator(SEL.editPanel), 'the edit panel (screens/multimedia-edit-panel.ts)').toBeVisible({ timeout: 15_000 });
    await shot(page, 'media-editor-live', info);
    // move the first card down once through the panel, then save
    const order = async () => (await page.locator(SEL.card).evaluateAll((els) => els.map((e) => e.textContent ?? ''))).map((t) => t.slice(0, 40));
    const before = await order();
    await page.locator(SEL.moveDown).first().click();
    await page.locator(SEL.save).click();
    await expect.poll(async () => ((await (await request.get(`${API}/multimedia/layout`)).json()).installation.order as string[]).length, { timeout: 15_000 }).toBeGreaterThan(0);
    await page.goto(`/?design=a#/multimedia/screens`);
    await expect(page.locator(SEL.card)).toHaveCount(7, { timeout: 30_000 });
    expect(await order(), 'the saved order is what the page draws after a reload').not.toEqual(before);
    // a personal override: the user menu entry exists only for screen.personalize
    const roleId = await mkRole(request, 'CR-015 ui personalizer', ['map.read', 'media.read', 'screen.personalize']);
    const who = as(`cr015uipers${info.project.name}`);
    const bid = await bindUser(request, who.user, roleId);
    const plainRole = await mkRole(request, 'CR-015 ui plain', ['map.read', 'media.read']);
    const plain = as(`cr015uiplain${info.project.name}`);
    const pid = await bindUser(request, plain.user, plainRole);
    try {
      expect((await request.put(`${API}/me/prefs`, { headers: plain.headers, data: { 'multimedia.personal': { group_by: 'none', order: [p.keys.kitchen], cards: {} } } })).status()).toBe(403);
      expect((await request.put(`${API}/me/prefs`, { headers: who.headers, data: { 'multimedia.personal': { group_by: 'none', order: [p.keys.kitchen, p.keys.living], cards: {} } } })).status()).toBe(200);
      const ctx = await browser.newContext({ extraHTTPHeaders: who.headers, viewport: page.viewportSize() ?? { width: 1440, height: 900 }, locale: 'he-IL' });
      const pp = await ctx.newPage();
      await pp.goto(`/?design=a#/multimedia/screens`);
      await expect(pp.locator(SEL.card)).toHaveCount(7, { timeout: 30_000 });
      const first = await pp.locator(SEL.card).first().innerText();
      expect(first, 'the personal order puts the kitchen TV first, in a single group').toContain(SCREENS.kitchen.name);
      await ctx.close();
    } finally {
      await request.put(`${API}/me/prefs`, { headers: who.headers, data: { 'multimedia.personal': null } });
      await request.delete(`${API}/access/bindings/${bid}`);
      await request.delete(`${API}/access/bindings/${pid}`);
      await request.delete(`${API}/access/roles/${roleId}`);
      await request.delete(`${API}/access/roles/${plainRole}`);
      await request.delete(`${API}/multimedia/layout`);
    }
  });

  test('view-only user: the state is visible and no control is drawn; 390 px bottom sheet fits the phone', async ({ page, browser, request }, info) => {
    const p = await open(page, request, info, '/multimedia/screens');
    const roleId = await mkRole(request, 'CR-015 ui viewer', ['map.read', 'media.read']);
    const who = as(`cr015uiview${info.project.name}`);
    const bid = await bindUser(request, who.user, roleId);
    try {
      const ctx = await browser.newContext({ extraHTTPHeaders: who.headers, viewport: page.viewportSize() ?? { width: 1440, height: 900 }, locale: 'he-IL' });
      const pp = await ctx.newPage();
      await pp.goto(`/?design=a#/multimedia/screens`);
      await expect(pp.locator(SEL.card)).toHaveCount(7, { timeout: 30_000 });
      await pp.locator(SEL.openRemote(SCREENS.living.name)).click();
      await expect(pp.locator(SEL.remote)).toBeVisible({ timeout: 15_000 });
      await expect(pp.locator(SEL.remoteKey('ok')), 'no key is drawn for a caller without media.control').toHaveCount(0);
      await shot(pp, 'media-remote-view-only-live', info);
      const overflow = await pp.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow, 'no horizontal page scroll').toBe(false);
      await ctx.close();
    } finally {
      await request.delete(`${API}/access/bindings/${bid}`);
      await request.delete(`${API}/access/roles/${roleId}`);
    }
    expect(p.keys.living).toBeTruthy();
  });
});
