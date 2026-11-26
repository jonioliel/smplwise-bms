import type { Page, Route } from '@playwright/test';
import { installBubbleMock } from './bubble-mocks';

// AREA-HONEST-COUNT-2540 (deep review SCR-10 / SCR-09, the FULL interface): the building screen against a mocked backend (bubble-mocks'
// session and routes) whose tree carries locks and alarm panels the server cannot read. Invented names, nothing is sent anywhere.
// The area row lists the locks and the alarm (devices.area_row) and the cards-mode rows show indicators (home.screen.row_actions).
//   entry  - two locks: one locked, one offline (locks_unknown 1); two panels: one armed_home, one offline -> "armed (home)" + 1 unknown
//   back   - the only lock offline, the only panel unavailable -> "לא ידוע" / "לא זמינה", both grey
//   office - two locks: one open, one offline; the panel disarmed -> the warm "0/2" and the grey "1 לא ידוע" apart
//   kitchen - one lock, locked; no panel
// `legacy: true` serves the same areas the way the base server did (no locks_unknown / alarms_unknown, the old alarm summary that let
// "unavailable" win), for the before / after compare captures.

const json = (route: Route, body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

const counts = (o: Record<string, number | string | null>) => ({ entities: 0, lights: 0, lights_on: 0, switches: 0, switches_on: 0, switch_entities: 0, switch_entities_on: 0, covers: 0, covers_open: 0, climate: 0, climate_active: 0, heating: 0, heating_active: 0, media: 0, media_on: 0, locks: 0, locks_locked: 0, locks_unknown: 0, alarm: null, alarms_unknown: 0, cameras: 0, sensors: 0, ...o });

const SYNC = { connected: true, last_snapshot_at: '2026-11-26T10:00:00Z', last_event_at: '2026-11-26T10:00:00Z', last_registry_at: '2026-11-26T09:00:00Z', last_error: null, reconnects: 0, sequence: 10, entities: 20, started_at: '2026-11-26T08:00:00Z', ha_version: null };

/** The four areas' counts as the new server sends them, and as the base server sent the same entities. */
export const AREAS: Record<string, { name: string; now: Record<string, number | string | null>; before: Record<string, number | string | null> }> = {
  entry: {
    name: 'כניסה',
    now: { entities: 6, lights: 2, lights_on: 1, locks: 2, locks_locked: 1, locks_unknown: 1, alarm: 'armed_home', alarms_unknown: 1, sensors: 2 },
    // the base summary: the offline panel came first and stayed "unavailable" (the armed one was hidden)
    before: { entities: 6, lights: 2, lights_on: 1, locks: 2, locks_locked: 1, alarm: 'unavailable', sensors: 2 },
  },
  back: {
    name: 'דלת אחורית',
    now: { entities: 3, lights: 1, locks: 1, locks_locked: 0, locks_unknown: 1, alarm: 'unavailable', alarms_unknown: 1, sensors: 1 },
    before: { entities: 3, lights: 1, locks: 1, locks_locked: 0, alarm: 'unavailable', sensors: 1 },
  },
  office: {
    name: 'משרד',
    now: { entities: 5, lights: 2, lights_on: 2, locks: 2, locks_locked: 0, locks_unknown: 1, alarm: 'disarmed', sensors: 1 },
    before: { entities: 5, lights: 2, lights_on: 2, locks: 2, locks_locked: 0, alarm: 'disarmed', sensors: 1 },
  },
  kitchen: {
    name: 'מטבח',
    now: { entities: 4, lights: 3, lights_on: 1, locks: 1, locks_locked: 1 },
    before: { entities: 4, lights: 3, lights_on: 1, locks: 1, locks_locked: 1 },
  },
};

const AREA_ROW = { items: ['lights', 'locks', 'alarm'], climate: 'temp', show_empty: false, climate_mode: 'mean', climate_lead: {}, only_active: ['openings', 'locks'] };

function sum(list: Record<string, number | string | null>[], legacy: boolean) {
  const out = counts({});
  for (const c of list) for (const [k, v] of Object.entries(c)) if (k !== 'alarm' && typeof v === 'number') (out as Record<string, unknown>)[k] = ((out as Record<string, number>)[k] ?? 0) + v;
  out.alarm = (legacy ? 'unavailable' : 'armed_home') as never;
  if (legacy) {
    delete (out as Record<string, unknown>).locks_unknown;
    delete (out as Record<string, unknown>).alarms_unknown;
  }
  return out;
}

export function honestTree(legacy = false) {
  const areas = Object.entries(AREAS).map(([id, a]) => {
    const c = counts(legacy ? a.before : a.now);
    if (legacy) {
      delete (c as Record<string, unknown>).locks_unknown;
      delete (c as Record<string, unknown>).alarms_unknown;
    }
    return { area_id: `ahc_${id}`, name: a.name, icon: null, floor_id: 'ahc_g', counts: c, has_camera: false, can_bulk: true, climate: [], temperature: null, open_count: 0 };
  });
  const total = sum(Object.values(AREAS).map((a) => (legacy ? a.before : a.now)), legacy);
  return {
    floors: [{ floor_id: 'ahc_g', name: 'קומת קרקע', level: 0, icon: null, areas, counts: total, can_bulk: true, climate: [] }],
    unassigned: { area_id: 'unassigned', name: 'ללא שיוך', counts: counts({}) },
    building: total,
    building_climate: [],
    scoped: false,
    can_bulk: true,
    sync: SYNC,
  };
}

export async function mockHonestArea(page: Page, opts: { legacy?: boolean; scheme?: 'light' | 'dark' } = {}) {
  const mock = await installBubbleMock(page);
  const scheme = opts.scheme ?? 'light';
  await page.route((u) => u.pathname.endsWith('/api/v1/settings'), (route) =>
    json(route, { settings: { 'ui.design': 'a', 'ui.skin': 'domus', 'ui.scheme': scheme, 'devices.scheme': scheme, 'devices.area_row': AREA_ROW, 'home.screen': { row_actions: 'indicators' }, 'home.info_style': 'bar' }, can_edit: false }),
  );
  await page.route((u) => u.pathname.endsWith('/api/v1/devices/tree'), (route) => json(route, honestTree(opts.legacy === true)));
  await page.addInitScript(() => {
    try {
      localStorage.setItem('sw.devices.layout', 'cards');
      localStorage.removeItem('sw.tiles.override');
    } catch {
      /* storage unavailable */
    }
  });
  return mock;
}

/** The building screen, open and drawn (domus, the product's default skin). */
export async function openBuilding(page: Page, scheme: 'light' | 'dark' = 'light') {
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
  await page.goto('about:blank');
  await page.goto(`/?design=a&skin=domus&scheme=${scheme}#/devices/building`);
  await page.waitForSelector('sw-app devices-building');
  await page.locator('devices-building a.arow[data-area-row="ahc_entry"]').waitFor({ timeout: 30_000 });
  await page.waitForTimeout(400);
}
