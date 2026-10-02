import type { Page, Route } from '@playwright/test';

// Bubble phase C (2026-10-02): a mocked backend for the REAL area screen (devices-area draws nothing without an API session).
// Every name is synthetic; no device, no Home Assistant. `/me` carries the device permissions, `/devices/tree` the two floors,
// `/devices/areas/living` a room with every card the screen knows (lights with and without brightness, switches, covers with a
// position, a tilt and a door, an air conditioner with modes, a thermostat, a fan, a humidifier, players, a lock, the alarm,
// sensors of every main-strip slot), and `/ha/entities/<id>/actions` answers "confirmed" at once so the optimistic phases settle.
// The multimedia card is left out (no media.read): the media rows are plain pills. Used by layout-bubble-screens.spec.ts and
// evidence-bubble-screens.spec.ts; needs the Vite DEV server like the other bubble specs (they import /src/design/look.ts).

const NOT_FOUND = { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: '', details: {} };
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

export const AREA_PERMS = ['devices.read', 'devices.control', 'devices.control_bulk', 'map.read'];

function me(perms: string[]) {
  return {
    user: { id: 'u-bubble', username: 'bubble', display_name: 'יוני', source: 'ingress' }, channel: 'local', remote: null, bindings: [],
    permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, bootstrap_state: 'done',
  };
}

const counts = (o: Partial<Record<string, number | string | null>> = {}) => ({ entities: 0, lights: 0, lights_on: 0, switches: 0, switches_on: 0, covers: 0, covers_open: 0, climate: 0, climate_active: 0, heating: 0, heating_active: 0, media: 0, media_on: 0, locks: 0, locks_locked: 0, alarm: null, cameras: 0, sensors: 0, ...o });

const SYNC = { connected: true, last_snapshot_at: '2026-10-02T10:00:00Z', last_event_at: '2026-10-02T10:00:00Z', last_registry_at: '2026-10-02T09:00:00Z', last_error: null, reconnects: 0, sequence: 10, entities: 40, started_at: '2026-10-02T08:00:00Z', ha_version: null };

export function row(entity_id: string, name: string, state: string, extra: Record<string, unknown> = {}) {
  const domain = entity_id.split('.')[0];
  const active = ['on', 'playing', 'open', 'cool', 'heat', 'locked', 'armed_home'].includes(state);
  return { entity_id, name, domain, device_class: null, state, available: state !== 'unavailable', fresh: true, active, icon: null, last_changed: '2026-10-02T09:40:00Z', can_control: true, ...extra };
}

export function areaDetail(areaId = 'living') {
  const card = (id: string, label: string, entities: Record<string, unknown>[]) => ({ id, label, entities, count: entities.length, active: entities.filter((e) => e.active).length });
  const lights = [
    row('light.living_main', 'תאורה מרכזית', 'on', { brightness_pct: 72 }),
    row('light.living_spots', 'ספוטים קיר', 'on', { brightness_pct: 40 }),
    row('light.living_strip', 'פס לד ספרייה ארוך מאוד בשם', 'on', { brightness_pct: 25 }),
    row('light.living_read', 'מנורת קריאה', 'off', { brightness_pct: 0 }),
    row('light.living_plain', 'מנורת תקרה', 'off', { brightness_pct: null }),
    row('light.living_out', 'מנורת חוץ', 'unavailable', { brightness_pct: null, active: false }),
  ];
  const switches = [row('switch.boiler', 'דוד שמש', 'on'), row('switch.irrigation', 'השקיה', 'off'), row('input_boolean.guest', 'מצב אורחים', 'off', { can_control: false })];
  const covers = [
    row('cover.living_big', 'תריס חלון גדול', 'open', { device_class: 'shutter', position: 60, tilt: null, moving: false }),
    row('cover.living_balcony', 'תריס מרפסת', 'closed', { device_class: 'blind', position: 0, tilt: 30, moving: false, active: false }),
    row('cover.garage', 'דלת מוסך', 'closed', { device_class: 'garage', position: null, tilt: null, door_class: true, can_control: false, active: false }),
  ];
  const climate = [
    row('climate.living_ac', 'מזגן סלון', 'cool', { hvac_mode: 'cool', hvac_action: 'cooling', climate_kind: 'ac', current_temperature: 25.5, target_temperature: 23, hvac_modes: ['off', 'cool', 'heat', 'dry', 'fan_only', 'auto'], fan_modes: ['low', 'medium', 'high', 'auto'], fan_mode: 'auto', swing_modes: ['off', 'vertical'], swing_mode: 'off', min_temp: 16, max_temp: 30, target_temp_step: 0.5, current_humidity: 48 }),
    row('climate.dining_ac', 'מזגן פינת אוכל', 'off', { hvac_mode: 'off', hvac_action: 'off', climate_kind: 'ac', current_temperature: 25, target_temperature: 24, hvac_modes: ['off', 'cool', 'heat'], min_temp: 16, max_temp: 30, target_temp_step: 1, active: false }),
    row('fan.living_fan', 'מאוורר תקרה', 'on', { percentage: 66 }),
    row('humidifier.living_hum', 'מכשיר אדים', 'on', { mode: 'auto', available_modes: ['auto', 'sleep', 'boost'], current_humidity: 48, target_humidity: 55, min_humidity: 30, max_humidity: 80 }),
  ];
  const heating = [row('climate.floor_heat', 'חימום תת-רצפתי', 'heat', { hvac_mode: 'heat', hvac_action: 'heating', climate_kind: 'heating', current_temperature: 22.5, target_temperature: 24, hvac_modes: ['off', 'heat'], min_temp: 10, max_temp: 35, target_temp_step: 1, preset_modes: ['home', 'away', 'eco'], preset_mode: 'home' })];
  const security = [
    row('lock.front', 'דלת כניסה', 'locked', { kind: 'lock', locked: true, can_control: false }),
    row('alarm_control_panel.home', 'אזעקה', 'armed_home', { kind: 'alarm', armed: true, can_control: false }),
    row('binary_sensor.terrace_door', 'דלת מרפסת', 'off', { kind: 'binary_sensor', device_class: 'door', can_control: false, active: false }),
    row('camera.living', 'מצלמת סלון', 'idle', { kind: 'camera', can_control: false, active: false }),
  ];
  const media = [
    row('media_player.living_speaker', 'רמקול סלון', 'playing', { device_class: 'speaker', media_title: 'אור של ערב · אנסמבל צפון', volume_pct: 34, muted: false }),
    row('media_player.living_tv', 'טלוויזיה סלון', 'on', { device_class: 'tv', source: 'HDMI 1', volume_pct: 18, muted: false }),
  ];
  const sensors = [
    row('sensor.living_temp', 'טמפרטורה', '25.5', { device_class: 'temperature', value: 25.5, unit: '°C', group: 'temperature', can_control: false, active: false }),
    row('sensor.living_hum', 'לחות', '48', { device_class: 'humidity', value: 48, unit: '%', group: 'humidity', can_control: false, active: false }),
    row('binary_sensor.living_motion', 'תנועה', 'off', { device_class: 'motion', on: false, group: 'other', can_control: false, active: false }),
    row('binary_sensor.living_window', 'חלון', 'on', { device_class: 'window', on: true, group: 'other', can_control: false, active: false }),
    row('sensor.living_power', 'צריכת חשמל', '142', { device_class: 'power', value: 142, unit: 'W', group: 'power', can_control: false, active: false }),
    row('sensor.living_lux', 'תאורה סביבתית', '320', { device_class: 'illuminance', value: 320, unit: 'lx', group: 'illuminance', can_control: false, active: false }),
    row('sensor.remote_battery', 'סוללת שלט', '81', { device_class: 'battery', value: 81, unit: '%', group: 'battery', can_control: false, active: false }),
    row('sensor.living_co2', 'CO2', '610', { device_class: 'carbon_dioxide', value: 610, unit: 'ppm', group: 'co2', can_control: false, active: false }),
  ];
  const all = [...lights, ...switches, ...covers, ...climate, ...heating, ...security, ...media, ...sensors];
  return {
    area: { area_id: areaId, name: 'סלון', icon: null, floor_id: 'g', floor_name: 'קומת קרקע', level: 0 },
    floor_areas: [
      { area_id: 'living', name: 'סלון', icon: null, counts: counts({ entities: all.length }) },
      { area_id: 'kitchen', name: 'מטבח', icon: null, counts: counts({ entities: 6, lights: 2, lights_on: 1 }) },
      { area_id: 'dining', name: 'פינת אוכל', icon: null, counts: counts({ entities: 3, lights: 1 }) },
      { area_id: 'office', name: 'חדר עבודה', icon: null, counts: counts({ entities: 5, lights: 2, lights_on: 1 }) },
    ],
    cards: {
      lighting: card('lighting', 'תאורה', lights),
      switches: card('switches', 'מתגים', switches),
      climate: card('climate', 'מיזוג', climate),
      heating: card('heating', 'חימום', heating),
      covers: card('covers', 'תריסים', covers),
      security: card('security', 'אבטחה', security),
      media: card('media', 'מסכים ונגנים', media),
      sensors: card('sensors', 'חיישנים', sensors),
    },
    counts: counts({ entities: all.length, lights: 6, lights_on: 3, switches: 3, switches_on: 1, covers: 3, covers_open: 1, climate: 4, climate_active: 3, heating: 1, heating_active: 1, media: 2, media_on: 2, locks: 1, locks_locked: 1, alarm: 'armed_home', cameras: 1, sensors: 8 }),
    scoped: false,
    can_bulk: true,
    sync: SYNC,
  };
}

export function tree() {
  const area = (area_id: string, name: string, floor_id: string, c: Record<string, number | string | null>, temperature: number | null = null) => ({ area_id, name, icon: null, floor_id, counts: counts(c), has_camera: false, can_bulk: true, climate: [], temperature, open_count: 0 });
  const g = [
    area('living', 'סלון', 'g', { entities: 31, lights: 6, lights_on: 3, climate: 2, climate_active: 1, covers: 3, covers_open: 1, media: 2, media_on: 2, sensors: 8 }, 25.5),
    area('kitchen', 'מטבח', 'g', { entities: 6, lights: 2, lights_on: 1, switches: 1, sensors: 1 }, 24.1),
    area('dining', 'פינת אוכל', 'g', { entities: 3, lights: 1, sensors: 1 }, 24.3),
    area('office', 'חדר עבודה', 'g', { entities: 5, lights: 2, lights_on: 1, media: 1 }, 23.8),
    area('guest_wc', 'שירותי אורחים', 'g', { entities: 1, lights: 1 }),
  ];
  const f1 = [
    area('parents', 'חדר שינה הורים', 'f1', { entities: 6, lights: 2, climate: 1, covers: 1 }, 22.9),
    area('kids', 'חדר ילדים', 'f1', { entities: 4, lights: 2, lights_on: 1 }, 23.4),
    area('bath', 'חדר רחצה', 'f1', { entities: 2, lights: 1 }, 26),
    area('hall', 'מסדרון', 'f1', { entities: 2, lights: 1, lights_on: 1 }),
  ];
  const out = [area('yard', 'חצר', 'out', { entities: 4, lights: 2, lights_on: 2, cameras: 1 }), area('parking', 'חניה', 'out', { entities: 2, lights: 1, lights_on: 1 })];
  const floor = (floor_id: string, name: string, level: number, areas: ReturnType<typeof area>[], c: Record<string, number | string | null>) => ({ floor_id, name, level, icon: null, areas, counts: counts(c), can_bulk: true, climate: [] });
  return {
    floors: [floor('g', 'קומת קרקע', 0, g, { entities: 46, lights: 12, lights_on: 5, covers: 3, covers_open: 1, climate: 2, climate_active: 1, media: 3, media_on: 2, sensors: 10 }), floor('f1', 'קומה א׳', 1, f1, { entities: 14, lights: 6, lights_on: 2, climate: 1, covers: 1 }), floor('out', 'חוץ', -1, out, { entities: 6, lights: 3, lights_on: 3, cameras: 1 })],
    unassigned: { area_id: 'unassigned', name: 'ללא שיוך', counts: counts({ entities: 1, switches: 1 }) },
    building: counts({ entities: 67, lights: 21, lights_on: 10, switches: 4, switches_on: 1, covers: 4, covers_open: 1, climate: 3, climate_active: 1, heating: 1, heating_active: 1, media: 3, media_on: 2, locks: 1, locks_locked: 1, alarm: 'armed_home', cameras: 2, sensors: 10 }),
    building_climate: [],
    scoped: false,
    can_bulk: true,
    sync: SYNC,
  };
}

export interface BubbleMockState {
  /** Every action the page sent: entity id, action id, args, confirmation grant. */
  actions: { entity_id: string; action_id: string; args: Record<string, unknown>; confirmed: boolean }[];
  /** The installation's ui.look (what /settings answers). */
  look: Record<string, unknown>;
}

/** Installs the mocked API on `page`; returns the recorded state. */
export async function installBubbleMock(page: Page, opts: { perms?: string[]; look?: Record<string, unknown> } = {}): Promise<BubbleMockState> {
  const st: BubbleMockState = { actions: [], look: opts.look ?? { density: 'regular', surface: 'fill', popup: 'sheet', radius: 'pill', transparency: 72, scale: 100, touch: 44, palette: 'default' } };
  const perms = opts.perms ?? AREA_PERMS;
  let seq = 0;
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    if (p === 'me') return json(route, me(perms));
    if (p === 'me/prefs') {
      if (req.method() === 'PUT') return json(route, { prefs: req.postDataJSON() ?? {}, stored: Object.keys(req.postDataJSON() ?? {}) });
      return json(route, { prefs: {}, stored: [] });
    }
    if (p === 'settings') return json(route, { settings: { 'ui.design': 'a', 'ui.skin': 'bubble', 'ui.scheme': 'light', 'ui.look': st.look, 'devices.style': 'smplwise', 'devices.area_design': 'tiles' }, can_edit: false });
    if (p === 'devices/tree') return json(route, tree());
    const area = /^devices\/areas\/([^/]+)$/.exec(p);
    if (area) return area[1] === 'living' ? json(route, areaDetail()) : json(route, NOT_FOUND, 404);
    const act = /^ha\/entities\/([^/]+)\/actions$/.exec(p);
    if (act && req.method() === 'POST') {
      const body = (req.postDataJSON() ?? {}) as { allowed_action_id?: string; arguments?: Record<string, unknown>; confirmation_grant?: unknown };
      st.actions.push({ entity_id: decodeURIComponent(act[1]), action_id: body.allowed_action_id ?? '', args: body.arguments ?? {}, confirmed: !!body.confirmation_grant });
      return json(route, { id: `a${++seq}`, entity_id: decodeURIComponent(act[1]), action_id: body.allowed_action_id, status: 'confirmed', confirmation: 'state', error: null, requested_at: '2026-10-02T10:00:00Z', confirmed_at: '2026-10-02T10:00:01Z' });
    }
    if (p.startsWith('devices/layouts/')) return json(route, NOT_FOUND, 404);
    if (p === 'notifications/summary' || p.startsWith('notifications')) return json(route, { unread: 0, items: [] });
    return json(route, NOT_FOUND, 404);
  });
  return st;
}
