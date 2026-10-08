import type { Page, Route } from '@playwright/test';
import { installBubbleMock, areaDetail, row, AREA_PERMS, type BubbleMockState } from './bubble-mocks';

// DEVHIST (CR-032, 2026-10-05): the mocked backend of the device activity popup, layered over tests/bubble-mocks.ts (the routes here answer
// first, everything else falls back to it). The area screen's rows get the server fields `activity` / `activity_kind`; GET
// /devices/<id>/activity answers from a per-test mode (ok | empty | forbidden | unavailable | partial | slow) with a second page;
// GET /schedules?entity= answers a small list (one editable, one read-only, one disabled). Synthetic names only. The real routes of
// pilot/DEVHIST-backend replace these once that branch is merged; the spec then runs against the fixture backend unchanged.

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

export type FeedMode = 'ok' | 'empty' | 'forbidden' | 'unavailable' | 'partial' | 'slow';
export type SchedMode = 'ok' | 'empty' | 'forbidden';

export interface DevhistState {
  bubble: BubbleMockState;
  feedMode: FeedMode;
  schedMode: SchedMode;
  /** The activity requests the page sent (entity id + query string). */
  feedCalls: { entity: string; query: string }[];
  /** Schedule ids whose switch was flipped, with the new value. */
  toggles: { id: string; enabled: boolean }[];
  /** Commands the page sent (a tap must still reach the device). */
  actions: BubbleMockState['actions'];
  /** CARD1: fields laid over the area rows (a state, can_control: false ...), the schedules POSTed (one-off auto-offs) and the deletes. */
  rows: DhRowOverrides;
  created: { draft: Record<string, unknown>; schedule: Row }[];
  deleted: string[];
}

export const DH_NOW = '2026-10-05T13:00:00Z';
const ago = (min: number) => new Date(Date.parse(DH_NOW) - min * 60_000).toISOString();

/** Which rows of the area the server flags, and with which kind. The sensors, media, security and the door cover are NOT flagged. */
export const DH_FLAGS: Record<string, string> = {
  'light.living_main': 'light', 'light.living_spots': 'light', 'light.living_strip': 'light', 'light.living_read': 'light', 'light.living_plain': 'light',
  // CARD1: the server names a boiler / tap wired through a switch from its display name; a valve.* / vacuum.* entity by its domain
  'switch.boiler': 'water_heater', 'water_heater.tank': 'water_heater', 'switch.irrigation': 'valve', 'valve.garden': 'valve', 'vacuum.robo': 'vacuum',
  'cover.living_big': 'cover', 'cover.living_balcony': 'cover',
  'climate.living_ac': 'climate', 'climate.dining_ac': 'climate', 'climate.floor_heat': 'heater', 'fan.living_fan': 'fan',
};

/** CARD1: the equipment the switches card lists read-only (a valve entity, a robot vacuum) - the activity window holds their controls. */
export const DH_EQUIPMENT: Record<string, unknown>[] = [
  row('valve.garden', 'ברז גינה', 'closed', { position: 0, moving: false, active: false, last_changed: '2026-10-05T06:30:00Z' }),
  row('vacuum.robo', 'שואב רובוטי', 'docked', { battery_level: 81, fan_speed: 'quiet', status: 'Charging', active: false, last_changed: '2026-10-05T11:20:00Z' }),
];

/** VER1: a native water_heater.* entity (not a relay-wired boiler); listed only when a spec passes it as `extra`, so the other specs' counts stay put. */
export const DH_WATER_HEATER: Record<string, unknown> = row('water_heater.tank', 'דוד חשמלי', 'eco', { target_temperature: 55, active: true, last_changed: '2026-10-05T05:00:00Z' });

export interface DhRowOverrides {
  /** Per entity: fields laid over the area row (a state, can_control: false ...). */
  [entityId: string]: Record<string, unknown>;
}

function flagged(over: DhRowOverrides = {}, extra: Record<string, unknown>[] = []) {
  const d = areaDetail('living') as unknown as { cards: Record<string, { entities: Record<string, unknown>[]; count: number }> };
  d.cards.switches.entities.push(...DH_EQUIPMENT.map((e) => ({ ...e })), ...extra.map((e) => ({ ...e })));
  d.cards.switches.count = d.cards.switches.entities.length;
  for (const c of Object.values(d.cards)) {
    for (const e of c.entities) {
      if (DH_FLAGS[e.entity_id as string]) Object.assign(e, { activity: true, activity_kind: DH_FLAGS[e.entity_id as string] });
      if (over[e.entity_id as string]) Object.assign(e, over[e.entity_id as string]);
    }
  }
  return d;
}

/** GET /devices/entities?ids= : the card rows by id (the same rows the area answers, plus their card and area). */
function entityRows(ids: string[], over: DhRowOverrides, extra: Record<string, unknown>[] = []) {
  const d = flagged(over, extra);
  const out: Record<string, unknown>[] = [];
  for (const [card, c] of Object.entries(d.cards)) for (const e of c.entities) if (ids.includes(e.entity_id as string)) out.push({ ...e, card, area_id: 'living', area_name: 'סלון' });
  return { entities: out };
}

/** A robot vacuum's feed: cleaning runs started by a person and a schedule, docked again by the device. */
function vacuumFeed(): Row[] {
  return [
    { id: 'v1', at: ago(95), kind: 'power', actor: { type: 'device' }, from: { state: 'returning' }, to: { state: 'docked' }, via: 'device', confidence: 'inferred' },
    { id: 'v2', at: ago(100), kind: 'power', actor: { type: 'person', name: 'דנה כהן' }, from: { state: 'cleaning' }, to: { state: 'returning' }, via: 'arx', confidence: 'exact' },
    { id: 'v3', at: ago(140), kind: 'power', actor: { type: 'person', name: 'דנה כהן' }, from: { state: 'docked' }, to: { state: 'cleaning' }, via: 'arx', confidence: 'exact' },
    { id: 'v4', at: ago(24 * 60 + 300), kind: 'power', actor: { type: 'schedule', name: 'ניקוי בוקר' }, source: { type: 'schedule', name: 'ניקוי בוקר' }, from: { state: 'docked' }, to: { state: 'cleaning' }, via: 'ha', confidence: 'exact' },
  ];
}

type Row = Record<string, unknown>;

function feedPage(mode: FeedMode, cursor: string | null, query: URLSearchParams, entity = 'light.living_main') {
  const person = (id: string, min: number, name: string, from: unknown, to: unknown): Row => ({ id, at: ago(min), kind: 'power', actor: { type: 'person', name }, from, to, via: 'arx', confidence: 'exact' });
  const base: Row[] = [
    person('e1', 15, 'דנה כהן', { state: 'on' }, { state: 'off' }),
    { id: 'e2', at: ago(140), kind: 'power', actor: { type: 'schedule', name: 'תאורת ערב' }, source: { type: 'schedule', name: 'תאורת ערב' }, from: { state: 'off' }, to: { state: 'on' }, via: 'ha', confidence: 'exact' },
    { id: 'e3', at: ago(150), kind: 'value', changed: ['brightness_pct'], actor: { type: 'device' }, from: { state: 'on', brightness_pct: 100 }, to: { state: 'on', brightness_pct: 60 }, via: 'device', confidence: 'inferred' },
    { id: 'e4', at: ago(24 * 60 + 20), kind: 'power', actor: { type: 'scene', name: 'לילה טוב' }, from: { state: 'on' }, to: { state: 'off' }, via: 'ha', confidence: 'exact' },
    { id: 'e5', at: ago(24 * 60 + 600), kind: 'power', actor: { type: 'automation', name: 'זריחה' }, from: { state: 'off' }, to: { state: 'on' }, via: 'ha', confidence: 'exact' },
    { id: 'e6', at: ago(24 * 60 + 610), kind: 'availability', actor: { type: 'system' }, from: { state: 'unavailable' }, to: { state: 'off' }, via: 'ha', confidence: 'exact' },
    { id: 'e7', at: ago(48 * 60), kind: 'power', actor: { type: 'unknown' }, from: { state: 'on' }, to: { state: 'off' }, via: 'unknown', confidence: 'unknown' },
  ];
  const more: Row[] = [person('e8', 3 * 24 * 60, 'יואב כהן', { state: 'off' }, { state: 'on' }), person('e9', 3 * 24 * 60 + 30, 'יואב כהן', { state: 'on' }, { state: 'off' })];
  const actor = query.get('actor');
  const kind = query.get('kind');
  const filtered = !!(actor || kind);
  const pick = (rows: Row[]) => rows.filter((r) => (!actor || (r.actor as { type: string }).type === actor) && (!kind || r.kind === kind));
  const items = mode === 'empty' ? [] : cursor ? pick(more) : pick(entity.startsWith('vacuum.') ? vacuumFeed() : base);
  return {
    items,
    next_cursor: !cursor && mode !== 'empty' && !filtered ? 'p2' : null,
    retention_days: 90,
    tracked_since: ago(6 * 24 * 60),
    entity: { entity_id: 'light.living_main', name: 'תאורה מרכזית', domain: 'light', activity_kind: 'light', virtual: false, power: null },
    coverage: { from: ago(6 * 24 * 60), gaps: mode === 'partial' ? [{ from: ago(30 * 60), to: ago(29 * 60) }] : [] },
    availability: mode === 'partial' ? 'partial' : 'ok',
  };
}

function schedule(id: string, name: string, over: Row = {}): Row {
  return {
    id, entity_id: null, name, display_name: name, enabled: true, state: 'on', days: { tokens: ['daily'], kind: 'daily', days: null }, start_date: null, end_date: null, repeat: 'repeat',
    slots: [], conditions: { items: [], type: null, track: false, uniform: true, summary: null, preset: null }, entities: [{ entity_id: 'light.living_main', name: 'תאורה מרכזית' }],
    tags: [], folder_id: null, order: null, pinned: false, next_run: { at: new Date(Date.parse(DH_NOW) + 5 * 3600_000).toISOString(), slot_index: 0, source: 'computed', conditional: false }, upcoming: [],
    last_run: null, sensitive: false, sensitive_classes: [], lowering: false, source: 'arx', owner: null, created_at: null, updated_at: null, revision: 'r1',
    can: { edit: true, toggle: true, run: true, delete: true, copy: true }, read_only: null, warnings: [], ...over,
  };
}

const FORBIDDEN = { code: 'forbidden', user_message: 'אין הרשאה', retryable: false, correlation_id: '', details: {} };
const UNAVAILABLE = { code: 'unavailable', user_message: 'לא זמין', retryable: true, correlation_id: '', details: {} };

export async function installDevhistMock(page: Page, opts: { perms?: string[]; feed?: FeedMode; sched?: SchedMode; rows?: DhRowOverrides; extra?: Record<string, unknown>[] } = {}): Promise<DevhistState> {
  const perms = [...(opts.perms ?? AREA_PERMS), 'schedule.view', 'schedule.manage'];
  const bubble = await installBubbleMock(page, { perms });
  const st: DevhistState = { bubble, feedMode: opts.feed ?? 'ok', schedMode: opts.sched ?? 'ok', feedCalls: [], toggles: [], actions: bubble.actions, rows: opts.rows ?? {}, created: [], deleted: [] };
  let seq = 0;
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    if (p === 'devices/areas/living') return json(route, flagged(st.rows, opts.extra));
    if (p === 'devices/entities') return json(route, entityRows((url.searchParams.get('ids') ?? '').split(',').filter(Boolean), st.rows, opts.extra));
    const feed = /^devices\/([^/]+)\/activity$/.exec(p);
    if (feed) {
      st.feedCalls.push({ entity: decodeURIComponent(feed[1]), query: url.search });
      if (st.feedMode === 'forbidden') return json(route, FORBIDDEN, 403);
      if (st.feedMode === 'unavailable') return json(route, UNAVAILABLE, 503);
      if (st.feedMode === 'slow') await new Promise((r) => setTimeout(r, 1500));
      return json(route, feedPage(st.feedMode, url.searchParams.get('cursor'), url.searchParams, decodeURIComponent(feed[1])));
    }
    if (p === 'schedules' && req.method() === 'GET') {
      if (st.schedMode === 'forbidden') return json(route, FORBIDDEN, 403);
      const entity = url.searchParams.get('entity');
      const items =
        st.schedMode === 'empty'
          ? []
          : [
              schedule('a1b2c3', 'תאורת ערב'),
              schedule('d4e5f6', 'שבת', { can: { edit: false, toggle: false, run: false, delete: false, copy: false }, read_only: { reasons: [{ code: 'no_manage_permission', message: '' }] } }),
              schedule('0a9b8c', 'חופשה', { enabled: false, state: 'off', next_run: null }),
              // CARD1: the one-off auto-offs this page created, for their own device only
              ...st.created.filter((c) => !entity || (c.schedule.entities as { entity_id: string }[]).some((e) => e.entity_id === entity)).map((c) => c.schedule),
            ];
      return json(route, { items, total: items.length, offset: 0, limit: 50, status: { available: 'ok', stale: false, last_sync_at: DH_NOW } });
    }
    if (p === 'schedules' && req.method() === 'POST') {
      // CARD1: the one-off auto-off - a `single` schedule with one slot and one "off" action; echoed back as the component would list it
      const body = (req.postDataJSON() ?? {}) as { draft: { name: string; repeat: string; slots: { start: string; actions: { service: string; entity_id: string }[] }[] } };
      const d = body.draft;
      const slot = d.slots[0];
      const act = slot.actions[0];
      const at = new Date(Date.parse(`2026-10-05T${slot.start}+03:00`));
      const s = schedule(`auto${++seq}`, d.name, {
        repeat: d.repeat, entities: [{ entity_id: act.entity_id, name: act.entity_id }],
        slots: [{ index: 0, start: { kind: 'fixed', time: slot.start.slice(0, 5), raw: slot.start }, stop: null, actions: [{ service: act.service, entity_id: act.entity_id, data: {}, supported: true, class: 'switch', sensitive: false, lowering: false }], supported: true, unsupported: [] }],
        next_run: { at: at.toISOString(), slot_index: 0, source: 'computed', conditional: false },
      });
      st.created.push({ draft: d as unknown as Record<string, unknown>, schedule: s });
      return json(route, { schedule: s, op_id: `op${seq}` }, 201);
    }
    const del = /^schedules\/([^/]+)\/delete$/.exec(p);
    if (del && req.method() === 'POST') {
      st.deleted.push(del[1]);
      st.created = st.created.filter((c) => c.schedule.id !== del[1]);
      return json(route, { trash_id: `t${del[1]}`, expires_at: '2026-10-12T13:00:00Z' });
    }
    const en = /^schedules\/([^/]+)\/(enable|disable)$/.exec(p);
    if (en && req.method() === 'POST') {
      st.toggles.push({ id: en[1], enabled: en[2] === 'enable' });
      return json(route, { schedule: schedule(en[1], 'תאורת ערב', { enabled: en[2] === 'enable' }), changed: true });
    }
    return route.fallback();
  });
  return st;
}
