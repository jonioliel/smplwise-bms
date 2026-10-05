import type { Page, Route } from '@playwright/test';
import { installBubbleMock, areaDetail, AREA_PERMS, type BubbleMockState } from './bubble-mocks';

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
}

export const DH_NOW = '2026-10-05T13:00:00Z';
const ago = (min: number) => new Date(Date.parse(DH_NOW) - min * 60_000).toISOString();

/** Which rows of the area the server flags, and with which kind. The sensors, media, security and the door cover are NOT flagged. */
export const DH_FLAGS: Record<string, string> = {
  'light.living_main': 'light', 'light.living_spots': 'light', 'light.living_strip': 'light', 'light.living_read': 'light', 'light.living_plain': 'light',
  'switch.boiler': 'switch', 'switch.irrigation': 'valve',
  'cover.living_big': 'cover', 'cover.living_balcony': 'cover',
  'climate.living_ac': 'climate', 'climate.dining_ac': 'climate', 'climate.floor_heat': 'heater', 'fan.living_fan': 'fan',
};

function flagged() {
  const d = areaDetail('living') as unknown as { cards: Record<string, { entities: Record<string, unknown>[] }> };
  for (const c of Object.values(d.cards)) for (const e of c.entities) if (DH_FLAGS[e.entity_id as string]) Object.assign(e, { activity: true, activity_kind: DH_FLAGS[e.entity_id as string] });
  return d;
}

type Row = Record<string, unknown>;

function feedPage(mode: FeedMode, cursor: string | null, query: URLSearchParams) {
  const person = (id: string, min: number, name: string, from: unknown, to: unknown): Row => ({ id, at: ago(min), kind: 'power', actor: { type: 'person', name }, from, to, via: 'arx', confidence: 'exact' });
  const base: Row[] = [
    person('e1', 15, 'דנה כהן', { state: 'on' }, { state: 'off' }),
    { id: 'e2', at: ago(140), kind: 'power', actor: { type: 'schedule', name: 'תאורת ערב' }, source: { type: 'schedule', name: 'תאורת ערב' }, from: { state: 'off' }, to: { state: 'on' }, via: 'ha', confidence: 'exact' },
    { id: 'e3', at: ago(150), kind: 'value', attribute: 'brightness', actor: { type: 'device' }, from: { value: 100 }, to: { value: 60 }, unit: '%', via: 'device', confidence: 'inferred' },
    { id: 'e4', at: ago(24 * 60 + 20), kind: 'power', actor: { type: 'scene', name: 'לילה טוב' }, from: { state: 'on' }, to: { state: 'off' }, note: 'הופעלה ע״י יואב כהן', via: 'ha', confidence: 'exact' },
    { id: 'e5', at: ago(24 * 60 + 600), kind: 'power', actor: { type: 'automation', name: 'זריחה' }, from: { state: 'off' }, to: { state: 'on' }, via: 'ha', confidence: 'exact' },
    { id: 'e6', at: ago(24 * 60 + 610), kind: 'availability', actor: { type: 'system' }, from: { state: 'unavailable' }, to: { state: 'off' }, note: 'אחרי הפסקת חשמל', via: 'ha', confidence: 'exact' },
    { id: 'e7', at: ago(48 * 60), kind: 'power', actor: { type: 'unknown' }, from: { state: 'on' }, to: { state: 'off' }, via: 'unknown', confidence: 'unknown' },
  ];
  const more: Row[] = [person('e8', 3 * 24 * 60, 'יואב כהן', { state: 'off' }, { state: 'on' }), person('e9', 3 * 24 * 60 + 30, 'יואב כהן', { state: 'on' }, { state: 'off' })];
  const actor = query.get('actor');
  const kind = query.get('kind');
  const filtered = !!(actor || kind);
  const pick = (rows: Row[]) => rows.filter((r) => (!actor || (r.actor as { type: string }).type === actor) && (!kind || r.kind === kind));
  const items = mode === 'empty' ? [] : cursor ? pick(more) : pick(base);
  return {
    items,
    next_cursor: !cursor && mode !== 'empty' && !filtered ? 'p2' : null,
    retention_days: 90,
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

export async function installDevhistMock(page: Page, opts: { perms?: string[]; feed?: FeedMode; sched?: SchedMode } = {}): Promise<DevhistState> {
  const perms = [...(opts.perms ?? AREA_PERMS), 'schedule.view', 'schedule.manage'];
  const bubble = await installBubbleMock(page, { perms });
  const st: DevhistState = { bubble, feedMode: opts.feed ?? 'ok', schedMode: opts.sched ?? 'ok', feedCalls: [], toggles: [], actions: bubble.actions };
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    if (p === 'devices/areas/living') return json(route, flagged());
    const feed = /^devices\/([^/]+)\/activity$/.exec(p);
    if (feed) {
      st.feedCalls.push({ entity: decodeURIComponent(feed[1]), query: url.search });
      if (st.feedMode === 'forbidden') return json(route, FORBIDDEN, 403);
      if (st.feedMode === 'unavailable') return json(route, UNAVAILABLE, 503);
      if (st.feedMode === 'slow') await new Promise((r) => setTimeout(r, 1500));
      return json(route, feedPage(st.feedMode, url.searchParams.get('cursor'), url.searchParams));
    }
    if (p === 'schedules' && req.method() === 'GET') {
      if (st.schedMode === 'forbidden') return json(route, FORBIDDEN, 403);
      const items =
        st.schedMode === 'empty'
          ? []
          : [
              schedule('a1b2c3', 'תאורת ערב'),
              schedule('d4e5f6', 'שבת', { can: { edit: false, toggle: false, run: false, delete: false, copy: false }, read_only: { reasons: [{ code: 'no_manage_permission', message: '' }] } }),
              schedule('0a9b8c', 'חופשה', { enabled: false, state: 'off', next_run: null }),
            ];
      return json(route, { items, total: items.length, offset: 0, limit: 50, status: { available: 'ok', stale: false, last_sync_at: DH_NOW } });
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
