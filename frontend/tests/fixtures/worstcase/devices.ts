// BREAKUI-297 (P6): worst-case payloads for the device screens (the building / home screen, the area screen, the floors / areas tree),
// shaped exactly like the mocked backend of tests/bubble-mocks.ts (`/devices/tree`, `/devices/areas/<id>`). Data only.
// Datasets: worst (every name from strings.ts, huge counts, extreme values), empty (no floors / no devices), one (exactly one of each,
// pluralisation), huge (12 floors x 42 areas = 504 areas; an area with 500 lights), offline (bridge disconnected, every device
// unavailable, missing optional fields, a device with no friendly name).
import { areaDetail, row, tree } from '../../bubble-mocks';
import { demoHome } from '../../../src/screens/home-demo';
import { ENTITY_ID_AS_NAME, HE_LONG, NAMES, NEG_FLOOR, NUM, ONE } from './strings';

export type Dataset = 'demo' | 'worst' | 'empty' | 'one' | 'huge' | 'offline';
export const DATASETS: readonly Dataset[] = ['demo', 'worst', 'empty', 'one', 'huge', 'offline'];

type Counts = Record<string, number | string | null>;
type TreeCounts = ReturnType<typeof tree>['building'];
export const counts = (o: Counts = {}): TreeCounts => ({ entities: 0, lights: 0, lights_on: 0, switches: 0, switches_on: 0, covers: 0, covers_open: 0, climate: 0, climate_active: 0, heating: 0, heating_active: 0, media: 0, media_on: 0, locks: 0, locks_locked: 0, alarm: null, cameras: 0, sensors: 0, ...o }) as unknown as TreeCounts;

const SYNC_OK = { connected: true, last_snapshot_at: '2026-10-27T10:00:00Z', last_event_at: '2026-10-27T10:00:00Z', last_registry_at: '2026-10-27T09:00:00Z', last_error: null, reconnects: 0, sequence: 10, entities: 40, started_at: '2026-10-27T08:00:00Z', ha_version: null };
const SYNC_DOWN = { ...SYNC_OK, connected: false, last_event_at: '2026-10-25T03:12:00Z', last_error: 'ConnectTimeout', reconnects: 4182 };

const name = (i: number) => NAMES[i % NAMES.length];
const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o)) as T;

function area(area_id: string, nm: string, floor_id: string, c: Counts, temperature: number | null = null, open = 0) {
  return { area_id, name: nm, icon: null, floor_id, counts: counts(c), has_camera: !!c.cameras, can_bulk: true, climate: [], temperature, open_count: open };
}
function floor(floor_id: string, nm: string, level: number, areas: ReturnType<typeof area>[], c: Counts) {
  return { floor_id, name: nm, level, icon: null, areas, counts: counts(c), can_bulk: true, climate: [] };
}

/** The home block the backend always sends with the tree (routers/devices.py `body["home"]`): the demo's for every dataset except offline,
 * where the weather, calendar and alarm sources are unavailable; worst carries an unbreakable weather name and an extreme forecast. */
function homeBlock(ds: Dataset) {
  const h = demoHome(new Date('2026-10-27T10:00:00Z'));
  if (ds === 'offline') {
    if (h.data.weather) { h.data.weather.available = false; h.data.weather.values = {}; h.data.weather.forecast = []; h.data.weather.forecast_len = 0; h.data.weather.condition = null; }
    for (const s of Object.values(h.data.sensors)) { s.available = false; s.state = 'unavailable'; }
    if (h.data.alarm) { h.data.alarm.available = false; h.data.alarm.state = 'unavailable'; }
  }
  if (ds === 'worst' && h.data.weather) {
    h.data.weather.name = ENTITY_ID_AS_NAME;
    h.data.weather.values = { temperature: { v: NUM.hot, unit: '°C' }, humidity: { v: 100, unit: '%' }, wind: { v: 187.4, unit: 'km/h' }, pressure: { v: 1086, unit: 'hPa' } };
    h.data.weather.forecast = h.data.weather.forecast.map((f, i) => ({ ...f, temperature: i % 2 ? 118 : -45, templow: -45 }));
    h.data.sensors['sensor.jewish_calendar_weekly_portion'].state = 'נצבים-וילך (חול המועד סוכות, שבת חתן ומבוא לספר דברים)';
  }
  return h;
}

/** The floors / areas tree (`GET /devices/tree`). */
export function worstTree(ds: Dataset) {
  return { ...treeOf(ds), home: homeBlock(ds) };
}

function treeOf(ds: Dataset) {
  if (ds === 'demo') return tree();
  const base = { unassigned: { area_id: 'unassigned', name: 'ללא שיוך', counts: counts() }, building_climate: [], scoped: false, can_bulk: true, sync: SYNC_OK };
  if (ds === 'empty') return { ...base, floors: [], building: counts() };
  if (ds === 'one') {
    const a = area('living', 'סלון', 'g', { entities: 1, lights: 1, lights_on: 1, sensors: 1, cameras: 1 }, 1, 1);
    return { ...base, floors: [floor('g', 'קומה 1', 1, [a], { entities: 1, lights: 1, lights_on: 1 })], unassigned: { ...base.unassigned, counts: counts({ entities: 1, switches: 1 }) }, building: counts({ entities: 1, lights: 1, lights_on: 1, switches: 1, switches_on: 1, covers: 1, covers_open: 1, climate: 1, climate_active: 1, heating: 1, heating_active: 1, media: 1, media_on: 1, locks: 1, locks_locked: 1, alarm: 'armed_home', cameras: 1, sensors: 1 }) };
  }
  if (ds === 'huge') {
    const floors = Array.from({ length: 12 }, (_, f) => {
      const fid = `f${f}`;
      const areas = Array.from({ length: 42 }, (_, a) => area(a === 0 && f === 0 ? 'living' : `${fid}-a${a}`, `${name(a + f)} ${a + 1}`, fid, { entities: 120, lights: 107, lights_on: 98, climate: 6, climate_active: 6, covers: 12, covers_open: 11, sensors: 40 }, 21 + (a % 7) / 10, a % 9));
      return floor(fid, `${f === 0 ? NEG_FLOOR : HE_LONG.slice(0, 20 + f * 3)} ${f}`, f - 2, areas, { entities: 5040, lights: 4494, lights_on: 4116, covers: 504, covers_open: 462, climate: 252, climate_active: 252, sensors: 1680 });
    });
    return { ...base, floors, unassigned: { ...base.unassigned, counts: counts({ entities: 377, switches: 377 }) }, building: counts({ entities: 60480, lights: 53928, lights_on: 49392, switches: 3021, switches_on: 2999, covers: 6048, covers_open: 5544, climate: 3024, climate_active: 3024, heating: 404, heating_active: 403, media: 812, media_on: 799, locks: 377, locks_locked: 12, alarm: 'triggered', cameras: 1284, sensors: 20160 }) };
  }
  const t = clone(tree()) as ReturnType<typeof tree>;
  if (ds === 'worst') {
    t.floors.forEach((f, i) => {
      f.name = [HE_LONG, NEG_FLOOR, ONE][i % 3];
      f.counts = counts({ entities: NUM.bigCount2, lights: NUM.bigCount, lights_on: NUM.bigCount - 1, covers: 512, covers_open: 511, climate: 96, climate_active: 95, media: 44, media_on: 43, sensors: 999 });
      f.areas.forEach((a, j) => {
        a.name = name(i * 5 + j);
        a.counts = counts({ entities: 1500 + j, lights: 999, lights_on: 998, climate: 12, climate_active: 12, covers: 64, covers_open: 63, media: 9, media_on: 9, sensors: 120 });
        a.temperature = j % 3 === 0 ? NUM.negTemp : j % 3 === 1 ? NUM.hot : null;
        (a as { open_count: number }).open_count = 99;
      });
    });
    t.unassigned.name = HE_LONG;
    t.building = counts({ entities: 60480, lights: NUM.bigCount2, lights_on: NUM.bigCount, switches: 3021, switches_on: 2999, covers: 6048, covers_open: 5544, climate: 3024, climate_active: 3024, heating: 404, heating_active: 403, media: 812, media_on: 799, locks: 377, locks_locked: 12, alarm: 'triggered', cameras: 1284, sensors: 20160 }) as typeof t.building;
    return t;
  }
  // offline: the bridge is down, the counts are stale, temperatures unknown
  t.sync = SYNC_DOWN as unknown as typeof t.sync;
  t.floors.forEach((f) => f.areas.forEach((a) => { a.temperature = null; a.counts = counts({ entities: (a.counts.entities as number) ?? 0 }); }));
  return t;
}

/** One area (`GET /devices/areas/<id>`). */
export function worstArea(ds: Dataset) {
  const d = clone(areaDetail('living')) as ReturnType<typeof areaDetail> & Record<string, unknown>;
  if (ds === 'demo') return d;
  type Card = { id: string; label: string; entities: Record<string, unknown>[]; count: number; active: number };
  const cards = d.cards as Record<string, Card>;
  const recount = () => { for (const c of Object.values(cards)) { c.count = c.entities.length; c.active = c.entities.filter((e) => e.active).length; } };
  if (ds === 'empty') {
    // the backend always sends every card id (services/devices.py build_cards), each with an empty list
    for (const c of Object.values(cards)) c.entities = [];
    recount();
    d.floor_areas = d.floor_areas.slice(0, 1);
    d.counts = counts() as typeof d.counts;
    d.area.name = 'מחסן';
    return d;
  }
  if (ds === 'one') {
    for (const c of Object.values(cards)) c.entities = c.entities.slice(0, 1);
    recount();
    d.counts = counts({ entities: 8, lights: 1, lights_on: 1, switches: 1, switches_on: 1, covers: 1, covers_open: 1, climate: 1, climate_active: 1, heating: 1, heating_active: 1, media: 1, media_on: 1, locks: 1, locks_locked: 1, cameras: 1, sensors: 1 }) as typeof d.counts;
    d.floor_areas = d.floor_areas.slice(0, 1);
    return d;
  }
  if (ds === 'huge') {
    cards.lighting.entities = Array.from({ length: 500 }, (_, i) => row(`light.huge_${i}`, `${name(i)} ${i + 1}`, i % 3 ? 'on' : 'off', { brightness_pct: i % 3 ? (i * 7) % 100 : 0 }));
    cards.sensors.entities = Array.from({ length: 120 }, (_, i) => row(`sensor.huge_${i}`, `${name(i)} ${i + 1}`, String(NUM.huge), { device_class: 'energy', value: NUM.huge, unit: 'kWh', group: 'power', can_control: false, active: false }));
    recount();
    d.floor_areas = Array.from({ length: 42 }, (_, i) => ({ area_id: i ? `a${i}` : 'living', name: `${name(i)} ${i + 1}`, icon: null, counts: counts({ entities: 120, lights: 107, lights_on: 98 }) })) as typeof d.floor_areas;
    d.counts = counts({ entities: 640, lights: 500, lights_on: 333, sensors: 120 }) as typeof d.counts;
    return d;
  }
  if (ds === 'worst') {
    let i = 0;
    for (const c of Object.values(cards)) for (const e of c.entities) {
      e.name = name(i++);
      if (typeof e.media_title === 'string') e.media_title = `${HE_LONG} · ${ENTITY_ID_AS_NAME}`;
      if (typeof e.value === 'number') { e.value = NUM.huge; e.state = String(NUM.huge); }
      if (typeof e.current_temperature === 'number') { e.current_temperature = NUM.negTemp; e.target_temperature = 30; }
    }
    d.area.name = HE_LONG;
    d.area.floor_name = NEG_FLOOR;
    d.floor_areas.forEach((a, j) => { a.name = name(j + 3); });
    return d;
  }
  // offline: every device unavailable, optional fields missing, one device named by its entity id, the bridge down
  for (const c of Object.values(cards)) for (const e of c.entities) {
    e.state = 'unavailable';
    e.available = false;
    e.active = false;
    e.fresh = false;
    for (const k of ['brightness_pct', 'position', 'tilt', 'current_temperature', 'target_temperature', 'value', 'unit', 'media_title', 'volume_pct', 'source', 'current_humidity', 'hvac_modes', 'fan_modes', 'percentage']) if (k in e) e[k] = null;
    e.last_changed = null;
  }
  cards.lighting.entities[0].name = ENTITY_ID_AS_NAME;
  recount();
  d.sync = SYNC_DOWN as unknown as typeof d.sync;
  return d;
}
