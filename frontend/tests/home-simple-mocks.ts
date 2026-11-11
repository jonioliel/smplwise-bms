import type { Page, Route } from '@playwright/test';

// HOME-SIMPLE-2420: the mock layer of the home interface specs. An invented family house (the round-25 mockup's demo names, no real
// device, no real person): /me says the interface is the home one, /home/overview carries the rooms in the WIRE shape of
// routers/home_interface.build_overview, and the other reads (scenes, cameras, alerts, meters, the call log) answer in their own
// wire shapes. Every control request is recorded in `calls` and answered as accepted, nothing is sent anywhere.

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const row = (id: string, name: string, on: boolean, extra: Record<string, unknown> = {}) => ({ entity_id: id, name, domain: id.split('.')[0], state: on ? 'on' : 'off', available: true, active: on, can_control: true, ...extra });
const light = (id: string, name: string, on: boolean, pct = 70) => row(`light.${id}`, name, on, { brightness_pct: on ? pct : null, dimmable: true, kind: 'light' });
const swl = (id: string, name: string, on: boolean) => row(`switch.${id}`, name, on, { brightness_pct: null, dimmable: false, kind: 'switch' });
const load = (id: string, name: string, on: boolean, prot = false, type: string | null = null) => ({ ...row(`switch.${id}`, name, on, { brightness_pct: null, dimmable: false, kind: 'switch' }), protected: prot, load_type: type });
const ac = (id: string, name: string, mode: string, cur: number, target: number) => ({
  ...row(`climate.${id}`, name, mode !== 'off'), state: mode, climate_kind: 'ac', hvac_mode: mode, hvac_modes: ['off', 'cool', 'heat', 'auto'], hvac_action: mode === 'off' ? 'off' : 'cooling',
  current_temperature: cur, target_temperature: target, min_temp: 16, max_temp: 30, target_temp_step: 1, preset_mode: null, preset_modes: null, unit: '°C',
});
const cover = (id: string, name: string, pos: number) => ({ ...row(`cover.${id}`, name, pos > 0), state: pos > 0 ? 'open' : 'closed', position: pos, moving: false });
const lock = (id: string, name: string, locked: boolean, wiskey = false) => ({ ...row(`lock.${id}`, name, locked), state: locked ? 'locked' : 'unlocked', locked, wiskey_door: wiskey });
const room = (id: string, name: string, floor: string, temp: number | null, parts: Partial<Record<'lights' | 'switches' | 'climate' | 'shades' | 'locks', unknown[]>> = {}) => ({
  id, name, floor_id: floor, temperature: temp, open_count: 0, can_bulk: true, lights: [], switches: [], climate: [], shades: [], locks: [], ...parts,
});

export type HomeDataset = 'demo' | 'worst' | 'empty';

export function overview(ds: HomeDataset = 'demo', policy: Record<string, unknown> = {}) {
  const pol = { default_interface: 'home', may_switch: true, home_only: false, kiosk: false, kiosk_area_id: null, rooms: null, modules: null, interface: 'home', configured: true, admin: false, kiosk_code_set: true, ...policy };
  const floors = [{ id: 'g', name: 'קומת קרקע', rooms: ['living', 'kitchen', 'dining', 'entry', 'office'] }, { id: 'f1', name: 'קומה ראשונה', rooms: ['master', 'yuval', 'maya', 'bath'] }, { id: 'out', name: 'חוץ וגינה', rooms: ['garden', 'parking'] }];
  let rooms = [
    room('living', 'סלון', 'g', 24, { lights: [light('l_main', 'תאורה ראשית', true, 70), light('l_read', 'מנורת קריאה', true, 40), swl('l_shelf', 'פס תאורה במדפים', false), light('l_corner', 'מנורת פינה', true, 55)], switches: [load('l_heater', 'מפזר חום', false, false, 'heater')], climate: [ac('living', 'מזגן סלון', 'cool', 24, 23)], shades: [cover('l_win', 'וילון חלון גדול', 60), cover('l_door', 'תריס דלת המרפסת', 0)] }),
    room('kitchen', 'מטבח', 'g', 24, { lights: [light('k_main', 'תאורה ראשית', true, 90), light('k_counter', 'תאורת משטח עבודה', true, 100), swl('k_island', 'מנורות מעל האי', false)], switches: [load('k_fridge', 'מקרר', true, true, null), load('k_boiler', 'דוד מים', true, false, 'water_heater')], shades: [cover('k_win', 'תריס חלון', 100)] }),
    room('dining', 'פינת אוכל', 'g', 24, { lights: [light('d_chand', 'נברשת', false), light('d_wall', 'תאורת קיר', false)] }),
    room('entry', 'כניסה', 'g', 23, { lights: [light('e_main', 'תאורת כניסה', true, 60)], locks: [lock('front', 'דלת הכניסה', true, true)] }),
    room('office', 'חדר עבודה', 'g', 25, { lights: [light('o_main', 'תאורה ראשית', false), light('o_desk', 'מנורת שולחן', false)], climate: [ac('office', 'מזגן חדר עבודה', 'off', 25, 24)], shades: [cover('o_win', 'תריס חלון', 30)] }),
    room('master', 'חדר שינה הורים', 'f1', 23, { lights: [light('m_main', 'תאורה ראשית', false), light('m_r', 'מנורת לילה ימין', true, 20), light('m_l', 'מנורת לילה שמאל', false)], climate: [ac('master', 'מזגן הורים', 'cool', 23, 22)], shades: [cover('m_c', 'וילון', 0), cover('m_s', 'תריס', 0)] }),
    room('yuval', 'החדר של יובל', 'f1', 24, { lights: [light('y_main', 'תאורה ראשית', true, 80), light('y_desk', 'מנורת שולחן', false)], climate: [ac('yuval', 'מזגן יובל', 'cool', 24, 23)], shades: [cover('y_s', 'תריס', 50)] }),
    room('maya', 'החדר של מאיה', 'f1', 23, { lights: [light('ma_main', 'תאורה ראשית', false), light('ma_n', 'מנורת לילה', false)], shades: [cover('ma_s', 'תריס', 0)] }),
    room('bath', 'חדר רחצה', 'f1', 25, { lights: [light('b_main', 'תאורה', false), light('b_mirror', 'תאורת מראה', false)] }),
    room('garden', 'גינה', 'out', 22, { lights: [light('g_path', 'תאורת שביל', false), light('g_trees', 'תאורת עצים', false), swl('g_perg', 'תאורת פרגולה', false)], switches: [load('g_pump', 'משאבת השקיה', false, false, 'valve')] }),
    room('parking', 'חניה', 'out', 22, { lights: [swl('p_main', 'תאורת חניה', false)], locks: [lock('gate', 'שער החניה', true, true)] }),
  ];
  if (ds === 'worst') {
    rooms[0] = { ...rooms[0], name: 'הסלון הגדול עם פינת הישיבה והספרייה של סבא', lights: Array.from({ length: 14 }, (_, i) => light(`w${i}`, i === 2 ? 'פס תאורה נסתר מאחורי הספרייה הגדולה בקיר המזרחי' : `גוף תאורה שקוע ${i + 1}`, i % 3 !== 0, 30 + (i * 5) % 70)) };
  }
  if (ds === 'empty') {
    rooms = [room('living', 'סלון', 'g', null, { lights: [light('l_main', 'תאורה ראשית', true, 70)] }), room('kitchen', 'מטבח', 'g', null)];
    floors.splice(1);
    floors[0].rooms = ['living', 'kitchen'];
  }
  return { weather: { t: 22, text: 'בהיר' }, floors, rooms, can_bulk: true, scoped: false, modules: ['alerts', 'cameras', 'climate', 'doors', 'energy', 'intercom', 'lights', 'log', 'recordings', 'scenes', 'security', 'shades'], policy: pol }; // HOME-V3-FOLLOWUP-A-2431: the server's default (every category) holds the recordings, the house log and the intercom
}

const scene = (id: string, name: string, areas: { id: string; name: string }[] = [], description = '') => ({
  kind: 'scene', id, config_id: id, entity_id: `scene.${id}`, name, description, icon: null, source: 'ui', state: 'scene', sentence: '', floors: [], areas, targets: [], sensitive: false, sensitive_classes: [], locked_count: 0,
  unknown_effects: false, mode: null, extras: [], labels: [], category: null, last_run: null, runs_7d: null, created_via: 'arx', owner: null, updated_at: null, revision: null, pinned: false, favourite: false, hidden: false,
  can: { edit: false, code_view: false, toggle: false, run: true, delete: false, copy: false }, read_only: null, warnings: [],
});

export interface HomeMock { calls: { method: string; path: string; body: unknown }[]; ring: (on: boolean) => void }

export async function mockHome(page: Page, opts: { ds?: HomeDataset; policy?: Record<string, unknown>; perms?: string[]; layout?: Record<string, unknown>; ringing?: boolean; lockReasons?: Record<string, string> } = {}): Promise<HomeMock> {
  const mock: HomeMock = { calls: [], ring: () => undefined };
  const ds = opts.ds ?? 'demo';
  const perms = opts.perms ?? ['alarm.view', 'alarm.arm', 'alarm.disarm', 'devices.read', 'devices.control', 'ha.entity.control', 'devices.control_bulk', 'video.live', 'map.read', 'energy.view', 'access.call', 'access.doors.open'];
  const ringing = { active: !!opts.ringing };
  const ov = overview(ds, opts.policy);
  // HOME-SIMPLE-2421: every lock carries the server's unlock_reason (the door rule); 'ok' unless the spec says otherwise
  for (const r of ov.rooms) for (const l of r.locks as { entity_id: string; unlock_reason?: string; can_unlock?: boolean }[]) { l.unlock_reason = opts.lockReasons?.[l.entity_id] ?? 'ok'; l.can_unlock = l.unlock_reason === 'ok'; }
  const prefs = { favourites: {}, layout: { welcomed: true, ...(opts.layout ?? {}) }, seed: {} };
  await page.route('**/api/v1/**', (r) => json(r, { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: 'mock', details: {} }, 404));
  await page.route('**/api/v1/me?**', (r) => json(r, me(perms, ov.policy)));
  await page.route('**/api/v1/me', (r) => json(r, me(perms, ov.policy)));
  await page.route('**/api/v1/home/overview', (r) => json(r, ov));
  await page.route('**/api/v1/home/interface', (r) => json(r, ov.policy));
  await page.route('**/api/v1/home/prefs', (r) => {
    if (r.request().method() === 'PUT') {
      const b = r.request().postDataJSON() as { favourites?: Record<string, unknown>; layout?: Record<string, unknown> };
      mock.calls.push({ method: 'PUT', path: 'home/prefs', body: b });
      Object.assign(prefs.favourites, b.favourites ?? {});
      Object.assign(prefs.layout, b.layout ?? {});
    }
    return json(r, prefs);
  });
  await page.route('**/api/v1/automations?**', (r) => json(r, { items: ds === 'empty' ? [] : [
    scene('morning', 'בוקר', [], 'פותח תריסים, מכבה אורות לילה'), scene('leave', 'יציאה מהבית', [], 'מכבה הכל, סוגר תריסים'), scene('evening', 'ערב', [], 'אור רך בסלון, במטבח ובכניסה'),
    scene('night', 'לילה', [], 'מכבה הכל, משאיר אור עמום במסדרון'), scene('arrive', 'חזרה הביתה', [], 'מדליק כניסה וסלון'),
    scene('cinema', 'קולנוע', [{ id: 'living', name: 'סלון' }]), scene('reading', 'קריאה', [{ id: 'living', name: 'סלון' }]),
  ], total: 7 }));
  await page.route('**/api/v1/cameras', (r) => json(r, { cameras: ds === 'empty' ? [] : [
    { id: 'cam1', name: 'כניסה לבית', can_view_live: true, recorder_enabled: true, area_id: 'entry' }, { id: 'cam2', name: 'חניה', can_view_live: true, recorder_enabled: true, area_id: 'parking' },
    { id: 'cam3', name: 'גינה', can_view_live: true, recorder_enabled: true, area_id: 'garden' }, { id: 'cam4', name: 'מרפסת', can_view_live: false, recorder_enabled: true },
  ], recorders: [], recorder: null, can_sync: false, media: {} }));
  await page.route('**/api/v1/cameras/*/snapshot.jpg**', (r) => r.fulfill({ status: 404, body: '' }));
  const now = Date.now();
  await page.route('**/api/v1/notifications?**', (r) => json(r, { notifications: ds === 'empty' ? [] : [
    notif('a1', 'דלת המרפסת פתוחה כבר 20 דקות', 'alert', 'open', now - 20 * 60000, 'doors'), notif('a2', 'דוד המים דולק כבר 3 שעות', 'alert', 'open', now - 12 * 60000, 'water'),
    notif('a3', 'מישהו צלצל בשער החניה ולא נענה', 'info', 'acknowledged', now - 5 * 3600000, 'intercom'),
  ] }));
  await page.route('**/api/v1/notifications/*/ack', (r) => { mock.calls.push({ method: 'POST', path: r.request().url(), body: null }); return json(r, {}); });
  await page.route('**/api/v1/intercom/calls?**', (r) => json(r, { calls: ds === 'empty' ? [] : [
    { id: 'c1', station_id: 's1', station_name: 'דלת הכניסה', rang_at: new Date(now - 40 * 60000).toISOString(), observed: 'ringing', state: 'ended', outcome: 'answered', answered_at: null, answered_via: 'arx', answered_by_name: 'נועה', answered_by_me: true, ended_at: null, ended_by_name: null, door_opened_at: new Date(now - 39 * 60000).toISOString(), door_opened_by_name: 'נועה', updated_at: '' },
    { id: 'c2', station_id: 's2', station_name: 'שער החניה', rang_at: new Date(now - 5 * 3600000).toISOString(), observed: 'ringing', state: 'ended', outcome: 'missed', answered_at: null, answered_via: null, answered_by_name: null, answered_by_me: false, ended_at: null, ended_by_name: null, door_opened_at: null, door_opened_by_name: null, updated_at: '' },
  ], next: null, retention_days: 30 }));
  await page.route('**/api/v1/intercom/calls/active', (r) => json(r, { server_time_ms: Date.now(), enabled: true, sound: 'silent', sound_reason: null, calls: ringing.active ? [{
    call_id: 'call-1', station_id: 'st-front', station_name: 'דלת הכניסה', state: 'ringing', rang_at: new Date(now - 4000).toISOString(), answered_at: null, answered_by_me: false,
    elapsed_s: 4, online: true, has_camera: true, still: true, can_open_door: true, locks: [{ physical_index: 0, name: null }],
  }] : [] }));
  await page.route('**/api/v1/access-control/stations/*/media', (r) => json(r, { station_id: 'st-front', mode: 'native', state: 'ready', reason: null, listen: true, expires_at: null,
    video: { profiles: ['sub'], default_profile: 'sub', allowed: true, paths: { sub: 'media/station/st-front/sub' }, max_viewers: 4, viewers: 0 },
    talk: { available: true, reason: null, transport: 'ws', codec: 'pcmu', duplex: 'full', sample_rate: 8000, frame_ms: 20 } }));
  await page.route('**/api/v1/intercom/overview', (r) => json(r, { state: 'ready', server_time_ms: Date.now(), stations: [{ id: 'st-front', name: 'דלת הכניסה', online: true, call_state: 'idle', sync_state: 'ok', lock_enabled: true, lock_count: 1, locks: [], has_camera: true, camera_entity: null, last_error: null, last_seen: null }] }));
  await page.route('**/api/v1/intercom/stations/*/release', (r) => { mock.calls.push({ method: 'POST', path: 'intercom/release', body: r.request().postDataJSON() }); return json(r, { status: 'sent', result: {} }); });
  await page.route('**/api/v1/intercom/stations/*/camera-snapshot.jpg**', (r) => r.fulfill({ status: 404, body: '' }));
  await page.route('**/api/v1/energy/tariffs', (r) => json(r, { items: [{ id: 't1', name: 'ביתי', currency: 'ILS', kind: 'fixed', versions: [], current: { price: '0.6400' }, used_by: 1 }] }));
  await page.route('**/api/v1/energy/meters', (r) => json(r, { items: ds === 'empty' ? [] : [
    meter('m1', 'מונה ראשי', 'kitchen', 'מטבח', 4.6), meter('m2', 'סלון', 'living', 'סלון', 3.1), meter('m3', 'חדר כביסה', null, null, 2.4),
  ] }));
  await page.route('**/api/v1/energy/meters/*/series?**', (r) => {
    const u = new URL(r.request().url());
    const step = u.searchParams.get('step');
    const from = Date.parse(u.searchParams.get('from') ?? '');
    const to = Date.parse(u.searchParams.get('to') ?? '');
    const dt = step === '1d' ? 86_400_000 : 3_600_000;
    const items = [];
    for (let t = from; t < to; t += dt) { const h = new Date(t).getHours(); items.push({ start: new Date(t).toISOString(), end: new Date(t + dt).toISOString(), kwh: step === '1d' ? 6 + (new Date(t).getDay() % 3) : 0.1 + (h >= 17 && h <= 21 ? 0.5 : h >= 7 && h <= 9 ? 0.35 : 0.08) }); }
    return json(r, { items });
  });
  await page.route('**/api/v1/energy/consumption?**', (r) => json(r, { items: [] }));
  await page.route('**/api/v1/ha/entities/*/actions', (r) => {
    mock.calls.push({ method: 'POST', path: new URL(r.request().url()).pathname.replace(/^.*api\/v1\//, ''), body: r.request().postDataJSON() });
    return json(r, { id: 'act-' + mock.calls.length, status: 'confirmed', confirmation: 'state' }, 202);
  });
  await page.route('**/api/v1/ha/actions/*', (r) => json(r, { id: 'x', status: 'confirmed', confirmation: 'state' }));
  await page.route('**/api/v1/devices/actions/preview?**', (r) => { mock.calls.push({ method: 'GET', path: 'devices/actions/preview?' + new URL(r.request().url()).searchParams, body: null }); return json(r, { targets: [], by_domain: {}, skipped: [], excluded: [], digest: 'd1' }); });
  await page.route('**/api/v1/devices/actions', (r) => { mock.calls.push({ method: 'POST', path: 'devices/actions', body: r.request().postDataJSON() }); return json(r, { id: 'b1', scope: 'area', scope_id: 'x', scope_name: null, kind: 'lights_off', kind_label: '', status: 'done', done: true, all_confirmed: true, counts: { total: 1, confirmed: 1, sent: 0 }, items: [] }, 202); });
  await page.route('**/api/v1/automations/scene/*/apply', (r) => { mock.calls.push({ method: 'POST', path: new URL(r.request().url()).pathname.replace(/^.*api\/v1\//, ''), body: r.request().postDataJSON() }); return json(r, { run_id: null }); });
  await page.route('**/api/v1/alarm/panels', (r) => json(r, { panels: ds === 'empty' ? [] : [{
    entity_id: 'alarm_control_panel.house', name: 'אזעקת הבית', platform: null, integration: '', integration_note: '', config_entry_id: null, state: 'disarmed', available: true, fresh: true,
    last_changed: null, changed_by: null, arm_modes: ['arm_home', 'arm_away', 'arm_night'], features_reported: true, code_format: 'number', code_arm_required: false, needs_code_arm: false,
    needs_code_disarm: true, area_name: null, open_sensors: [], bypassed_sensors: [], zones: [], unpaired_controls: [], ready: { ready: true, open: [], faults: [] },
    can: { arm: true, disarm: true, bypass: false, restore: false }, panel_code_set: false, code: { arm: 'none', disarm: 'pin', bypass: 'none' },
  }], counts: { panels: 1, zones: 0, open: 0, bypassed: 0, faults: 0 }, channel: 'local', remote: { control: true, disarm: true, codeless: false }, code_mode: 'personal_pin',
    me: { arm_policy: 'no_code', disarm_policy: 'code_required', pin_set: true }, can_configure: false }));
  await page.route('**/api/v1/alarm/panels/*/actions', (r) => { mock.calls.push({ method: 'POST', path: 'alarm/actions', body: r.request().postDataJSON() }); return json(r, { id: 'al1', status: 'sent' }, 202); });
  await page.route('**/api/v1/me/interface', (r) => { mock.calls.push({ method: 'PUT', path: 'me/interface', body: r.request().postDataJSON() }); return json(r, ov.policy); });
  mock.ring = (on) => { ringing.active = on; };
  return mock;
}

function notif(id: string, title: string, severity: string, state: string, at: number, category: string) {
  const iso = new Date(at).toISOString();
  return { id, source: 'rule.alert', category, severity, title, body: '', subject: { kind: 'area', id: null, area_id: null }, place_name: null, link: '', count: 1, first_at: iso, last_at: iso, state, acked_at: null, acked_by_display: null, resolved_at: null, me: { read_at: null, snoozed_until: null }, can_ack: true, has_snapshot: false, door: null, timeline: [] };
}

function meter(id: string, name: string, area: string | null, areaName: string | null, today: number) {
  return { id, display_name: name, device_id: null, device_name: null, entity_name: null, source_ref: 'sensor.x', unit: 'kWh', area_id: area, area_name: areaName, status: 'active', status_reason: null, revision: 1, state: 'reporting', last_report_at: null, value_kwh: 100, today_kwh: today, used_in: [], month_kwh: 0, floor: { id: 'g', name: 'קומת קרקע' } };
}

function me(perms: string[], policy: Record<string, unknown>) {
  return {
    user: { id: 'dev-noa', username: 'noa', display_name: 'נועה לביא', source: 'ingress' }, channel: 'local', remote: null,
    bindings: [{ id: 'b1', role_id: 'operator', role_name: 'מפעיל', scope_type: 'installation', scope_id: '*', effect: 'allow' }],
    permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, permissions_fingerprint: 'f', permissions_changed: false, bootstrap_state: 'done',
    active: true, mode: 'full', interface: policy, modules: { notices: false, tickets: false, incidents: false, announce: false },
  };
}
