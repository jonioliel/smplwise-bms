import type { Page, Route } from '@playwright/test';
import { mockHome, overview, type HomeDataset, type HomeMock } from './home-simple-mocks';

// HOME-V3-P3-2432: the mock layer of the phase 3 specs, on top of the home interface's own (tests/home-simple-mocks.ts): the media
// devices, the announcement areas, an electricity account with its periods, water, the generator / lifts / temperatures - each in the
// WIRE shape of its existing route. Invented names (the round-27 mockup's family house), nothing real; every control request is recorded
// in `calls` and answered as accepted, nothing is sent anywhere.

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const iso = (d: Date) => d.toISOString().slice(0, 10);

const KEYS = ['up', 'down', 'left', 'right', 'ok', 'back', 'home', 'volup', 'voldown', 'chup', 'chdown', 'mute'];
function dev(key: string, name: string, kind: string, area: string, areaName: string, floor: string, on: boolean, playing: boolean, title: string | null, extra: Record<string, unknown> = {}) {
  const tv = kind === 'screen';
  return {
    key, name, kind, profile: 'generic', floor_id: floor, floor_name: null, area_id: area, area_name: areaName, public: false,
    live: {
      power: on ? 'on' : 'off', play: playing ? 'playing' : on ? 'paused' : null, confirmed: true, since: null, sound_output: null,
      now: { kind: tv ? 'channel' : 'music', label: tv ? 'טלוויזיה' : '', app_id: null, source_id: tv && on ? 'tv' : null, title, artist: tv ? null : title ? 'רשימת ההשמעה של הבית' : null, album: null, channel: null, position_s: playing && !tv ? 80 : null, duration_s: playing && !tv ? 200 : null, position_at: null, artwork: null, glyph: 'music', hue: null },
      volume: { level: 35, muted: false, target: 'screen', step_only: false },
      group: { role: 'none', leader_key: null, member_keys: [], name: null, static: false, layer: tv ? null : 'ma', conflict: false },
      shuffle: null, repeat: null, queue: null, caps_known: true,
    },
    caps: {
      power_on: true, power_off: true, power_on_reason: null, volume_set: true, volume_step: true, mute: true, sources: tv, apps: false, sound_outputs: [],
      transport: { play: true, pause: true, stop: true, next: !tv, previous: !tv, seek: false }, keys: tv ? KEYS : [], text: false, touchpad: false, art_mode: false,
      shuffle: false, repeat: false, group: !tv, volume_group: false, up_next: false, favourites: !tv, stations: false, playlists: false, transfer: false,
    },
    audio_link: null, can: { control: true, power: true, public_ok: true, bulk: false, group: !tv }, volume_max: null, volume_night: null, music_provider: tv ? 'none' : 'ma', zones: null, virtual_members: null,
    ...extra,
  };
}

export interface P3Opts { ds?: HomeDataset; policy?: Record<string, unknown>; perms?: string[]; modules?: string[]; media?: 'on' | 'off' | 'empty'; announce?: boolean; bills?: boolean; water?: 'ok' | 'leak' | 'off'; systems?: 'ok' | 'bad' | 'none'; groupConfirm?: boolean }

export const P3_PERMS = ['alarm.view', 'devices.read', 'devices.control', 'ha.entity.control', 'devices.control_bulk', 'video.live', 'map.read', 'energy.view', 'energy.bills', 'access.call',
  'media.read', 'media.control', 'media.power', 'media.group', 'media.announce', 'generator.view', 'water.view'];

export async function mockP3(page: Page, o: P3Opts = {}): Promise<HomeMock> {
  const mock = await mockHome(page, { ds: o.ds, policy: o.policy, perms: o.perms ?? P3_PERMS });
  const ov = overview(o.ds ?? 'demo', o.policy);
  ov.modules = (o.modules ?? [...ov.modules, 'media', 'announce', 'bills', 'water', 'systems', 'map']) as typeof ov.modules;
  for (const r of ov.rooms) for (const l of r.locks as { unlock_reason?: string; can_unlock?: boolean }[]) { l.unlock_reason = 'ok'; l.can_unlock = true; }
  await page.route('**/api/v1/home/overview', (r) => json(r, ov));
  const rec = (r: Route, path: string) => { mock.calls.push({ method: r.request().method(), path, body: r.request().postDataJSON() }); };

  // ---- music and screens
  const devices = o.media === 'empty' ? [] : [
    dev('sp_living', 'רמקולים בסלון', 'speaker', 'living', 'סלון', 'g', true, true, 'ערב רגוע'),
    dev('tv_living', 'טלוויזיה בסלון', 'screen', 'living', 'סלון', 'g', false, false, null),
    dev('sp_kitchen', 'רמקול במטבח', 'speaker', 'kitchen', 'מטבח', 'g', true, true, 'חדשות הערב'),
    dev('tv_master', 'טלוויזיה בחדר השינה', 'screen', 'master', 'חדר שינה הורים', 'f1', false, false, null),
    dev('sp_yuval', 'רמקול של יובל', 'speaker', 'yuval', 'החדר של יובל', 'f1', false, false, null),
  ];
  await page.route('**/api/v1/multimedia/status', (r) => json(r, { enabled: o.media !== 'off', bridge: { paired: true, version: '1', media_ready: true }, can: { read: true, control: true, power: true, public: false, bulk: false, layout: false, configure: false, personalize: false }, counts: { screens: 2, on: 0, pending_approval: null }, profiles_version: 1 }));
  await page.route('**/api/v1/multimedia/devices?**', (r) => json(r, { devices }));
  await page.route('**/api/v1/multimedia/devices/*', (r) => {
    const key = decodeURIComponent(new URL(r.request().url()).pathname.split('/').pop() ?? '');
    const d = devices.find((x) => x.key === key);
    return d ? json(r, { ...d, sources: [{ id: 'tv', label: 'טלוויזיה', kind: 'source', glyph: 'antenna', hue: null }, { id: 'hdmi1', label: 'סרטים', kind: 'source', glyph: 'hdmi', hue: null }], apps: [], recent: [], remote: { sections: [], more: [], scope: 'default' }, model_keys: [] }) : json(r, { code: 'not_found' }, 404);
  });
  await page.route('**/api/v1/multimedia/devices/*/library?**', (r) => json(r, { kind: 'favourites', items: [{ item_ref: 'a'.repeat(24), kind: 'playlist', name: 'מוזיקה', artist: null, glyph: 'music', hue: null }, { item_ref: 'b'.repeat(24), kind: 'radio', name: 'רדיו', artist: null, glyph: 'music', hue: null }], curated: false, read_at: '', provider: 'ma' }));
  await page.route('**/api/v1/multimedia/devices/*/commands', (r) => { rec(r, 'media/' + new URL(r.request().url()).pathname.split('/').slice(-2)[0]); return json(r, { command_id: 'c', status: 'accepted', action_id: null, confirm: 'none', error: null }, 202); });
  let joins = 0;
  await page.route('**/api/v1/multimedia/groups/join', (r) => {
    rec(r, 'media/join');
    const b = r.request().postDataJSON() as { confirmed?: boolean };
    if (o.groupConfirm && !b.confirmed && joins++ === 0) return json(r, { code: 'confirm_required', user_message: 'צריך אישור', retryable: false, correlation_id: 'm', details: {} }, 409);
    return json(r, { bulk_id: 'g1', status: 'accepted' }, 202);
  });
  await page.route('**/api/v1/multimedia/groups/leave', (r) => { rec(r, 'media/leave'); return json(r, { bulk_id: 'g2', status: 'accepted' }, 202); });

  // ---- announcements (routine templates only: the emergency one is never offered in the home interface)
  await page.route('**/api/v1/announcements/areas', (r) => json(r, o.announce === false ? { enabled: false, areas: [], templates: [], max_text: 400 } : {
    enabled: true, max_text: 400, languages: ['he'], default_language: 'he',
    areas: [{ area_id: 'living', name: 'סלון', floor_name: 'קומת קרקע', devices: [{ key: 'sp_living', name: 'רמקולים בסלון' }], screens: 0 }, { area_id: 'kitchen', name: 'מטבח', floor_name: 'קומת קרקע', devices: [{ key: 'sp_kitchen', name: 'רמקול במטבח' }], screens: 0 }],
    templates: [{ id: 'dinner', kind: 'routine', name: { he: 'ארוחת ערב מוכנה' }, text: { he: 'ארוחת ערב מוכנה, כולם לשולחן' } }, { id: 'leave', kind: 'routine', name: { he: 'יוצאים בעוד חמש דקות' }, text: { he: 'יוצאים בעוד חמש דקות' } }, { id: 'fire', kind: 'emergency', name: { he: 'שריפה' }, text: { he: 'יש לצאת מהבית' } }],
  }));
  await page.route('**/api/v1/announcements', (r) => { rec(r, 'announcements'); return json(r, { status: 'spoken' }); });
  await page.route('**/api/v1/announcements/emergency', (r) => { rec(r, 'announcements/emergency'); return json(r, {}); });

  // ---- the electricity bill (money only with energy.bills)
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const prev = (k: number) => { const a = new Date(today.getFullYear(), today.getMonth() - k, 1); const b = new Date(today.getFullYear(), today.getMonth() - k + 1, 0); return { from: iso(a), to: iso(b), end_exclusive: iso(new Date(b.getTime() + 86_400_000)), state: 'billed', bill: { id: 'b' + k, total: String(380 + k * 22), state: k === 1 ? 'issued' : 'paid', due_date: iso(new Date(b.getTime() + 15 * 86_400_000)), number: 'N' + k } }; };
  await page.route('**/api/v1/energy/accounts', (r) => json(r, { items: o.bills === false ? [] : [{ id: 'acc1', name: 'הבית', status: 'active' }] }));
  await page.route('**/api/v1/energy/accounts/*/status', (r) => json(r, { period: { from: iso(start), to: iso(end) }, kwh_so_far: 210, meters: [], notes: [], amount_so_far: '214.6' }));
  await page.route('**/api/v1/energy/accounts/*/periods?**', (r) => json(r, { periods: [prev(3), prev(2), prev(1), { from: iso(start), to: iso(end), end_exclusive: '', state: 'open', bill: null }] }));

  // ---- water
  await page.route('**/api/v1/infra/water/status', (r) => json(r, { enabled: o.water !== 'off', can_view: true, can_manage: false, can_configure: false, can_ack: false, can_bills: false, meters: 1 }));
  await page.route('**/api/v1/infra/water/meters', (r) => json(r, { items: [{ id: 'w1', display_name: 'מונה ראשי', status: 'active', today_l: 412, month_l: 9800 }], stale_after_minutes: 60 }));
  await page.route('**/api/v1/infra/water/events/summary', (r) => json(r, { open: o.water === 'leak' ? 1 : 0, open_leaks: o.water === 'leak' ? 1 : 0, acked: 0, snoozed: 0, home_tile: { show: false, leaks: 0, link: '' } }));
  await page.route('**/api/v1/infra/water/consumption?**', (r) => {
    const series = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i); series.push({ start: d.toISOString(), end: d.toISOString(), date: iso(d), litres: i === 0 ? 412 : 380 + (i * 37) % 90 }); }
    return json(r, { items: [], unit: 'L', total_litres: 3000, series, bucket: '1d' });
  });

  // ---- the house systems (read only)
  const bad = o.systems === 'bad';
  await page.route('**/api/v1/generator/devices/live', (r) => json(r, { at: '', open_alerts: 0, devices: o.systems === 'none' ? [] : [{
    id: 'g1', name: 'גנרטור', area_id: null, status: 'detected', availability: 'online', stale: false, open_alerts: 0, open_critical: 0,
    roles: ['engine_state', 'mains_available', 'fuel_pct', 'supply_source'], summary: { engine_state: { value: 'stopped', unit: '' }, mains_available: { value: true, unit: '' }, fuel_pct: { value: 82, unit: '%' }, supply_source: { value: 'mains', unit: '' } },
  }] }));
  await page.route('**/api/v1/infra/elevators', (r) => json(r, { at: '', stale: false, summary: {}, elevators: o.systems === 'none' ? [] : [
    { id: 'e1', name: 'מעלית ראשית', area_id: null, area_name: null, state: 'active', reason: '', partial: false, stale: false, since: null, roles: [], extras: [] },
    { id: 'e2', name: 'מעלית שירות', area_id: null, area_name: null, state: bad ? 'fault' : 'waiting', reason: '', partial: false, stale: false, since: null, roles: [], extras: [] },
  ] }));
  await page.route((u) => u.pathname.endsWith('/api/v1/infra/temperature'), (r) => json(r, { at: '', stale: false, summary: {}, can_manage: false, can_ack: false, grouping: 'area', home_widget: true, ticket_department_id: null, explain: false, units: o.systems === 'none' ? [] : [
    { id: 't1', name: 'מקרר יין', kind: 'fridge', status: 'ok', value: 12, value_last: 12, stale: false },
    { id: 't2', name: 'חדר שרתים', kind: 'server', status: 'ok', value: 22, value_last: 22, stale: false },
    { id: 't3', name: 'מקפיא במחסן', kind: 'freezer', status: bad ? 'alarm' : 'ok', value: -18, value_last: -18, stale: false },
  ] }));
  return mock;
}
