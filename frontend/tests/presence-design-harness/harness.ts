// PRESENCE-DESIGN-2300 test harness: the building presence home widget (in a real <home-widgets> band with two neighbours, so it is judged
// beside the R5 widgets it lives with) and the settings page <system-building-presence>. Served by the Vite DEV server at
// /tests/presence-design-harness/. Invented data only; the settings page's API answers come from the spec's page.route mocks. No backend.
import '../../src/design/boot';
import '../../src/styles/focus-policy';
import '../../src/screens/home-widgets';
import '../../src/screens/system-building-presence';
import { defaultConfig, resolveWidgets, type HomeData, type WidgetId } from '../../src/api/home-config';
import type { BuildingPresenceSettings, BuildingSnapshot, OccupancyStatus } from '../../src/api/building-presence';
import { presenceWidgetAvailable } from '../../src/api/building-presence-logic';

export type PresenceDataset = 'ready' | 'empty' | 'unknown' | 'one' | 'worst' | 'error' | 'loading';

const LONG_HE = 'חדר הישיבות הגדול של הנהלת המבנה הצפוני בקומת הקרקע';
const UNB = 'ConferenceRoomNorthWingLevel3B';
const NOW = Date.now();
const ago = (min: number) => new Date(NOW - min * 60_000).toISOString();

function snapshot(ds: PresenceDataset, card: Partial<BuildingPresenceSettings> = {}): BuildingSnapshot | null {
  if (ds === 'loading' || ds === 'error') return null;
  // PRESENCE-COMPACT-2310: the card's display options come in from the spec (defaults = the owner's answers)
  const settings: BuildingPresenceSettings = { enabled: true, retention_days: 30, home_display: 'card', map_tint: true, hold_seconds: 60, empty_minutes: 10, ...card };
  type R = { name: string; status: OccupancyStatus; empty_since?: string | null };
  let rooms: R[];
  if (ds === 'worst') {
    const names = [LONG_HE, UNB, 'א', 'חדר שרתים Rack-12 (קומה 3)', 'מטבחון', 'לובי'];
    rooms = Array.from({ length: 500 }, (_, i) => ({ name: i < names.length ? names[i] : `משרד ${i + 1}`, status: (['occupied', 'clear', 'unknown'] as const)[i % 3], empty_since: i % 3 === 1 ? ago(40 + i) : null }));
  } else if (ds === 'one') {
    rooms = [{ name: 'לובי', status: 'clear', empty_since: ago(25) }];
  } else {
    rooms = [
      { name: 'לובי', status: 'occupied' },
      { name: 'אופן ספייס', status: 'occupied' },
      { name: 'חדר ישיבות קטן', status: 'clear', empty_since: ago(38) },
      { name: 'משרד מנהל', status: 'unknown' },
      { name: 'מטבחון', status: 'clear', empty_since: ago(95) },
    ];
    if (ds === 'empty') rooms = rooms.map((r, i) => ({ ...r, status: 'clear', empty_since: ago(20 + i * 7) }));
    if (ds === 'unknown') rooms = rooms.map((r) => ({ ...r, status: 'unknown', empty_since: null }));
  }
  const occ = rooms.filter((r) => r.status === 'occupied').length;
  const status: OccupancyStatus = ds === 'unknown' ? 'unknown' : occ ? 'occupied' : 'clear';
  return {
    configured: true, enabled: true, fresh: true, settings, status, occupied_rooms: occ, at: ago(0), empty_since: status === 'clear' ? ago(20) : null,
    rooms: rooms.map((r, i) => ({ area_id: `a${i}`, name: r.name, status: r.status, sensors: 1, empty_since: r.empty_since ?? null, floor: ds === 'one' ? null : ds === 'worst' ? `קומה ${1 + (i % 12)}` : ['קרקע', 'קומה 2', 'קומה 2', 'קומה 3', 'קומה 3'][i] ?? null })),
  };
}

const root = document.getElementById('root') as HTMLElement;
root.style.cssText = 'display:block;min-height:100vh;background:var(--sw-bg);color:var(--sw-text);font-family:var(--sw-font);padding:16px;box-sizing:border-box';

/** The home band: clock, alarm and the presence card, in the layout the home picks for this width. */
(window as unknown as Record<string, unknown>).pdMountHome = async (ds: PresenceDataset, layout: string, size: 's' | 'm' | 'l' = 'm', card: Partial<BuildingPresenceSettings> = {}) => {
  const cfg = defaultConfig();
  cfg.alarm.entity = 'alarm_control_panel.x';
  const data: HomeData = {
    weather: null, sensors: {}, agenda: { calendars: [], events: [] }, names: {},
    alarm: { entity_id: 'alarm_control_panel.x', name: 'אזעקה', state: 'disarmed', since: ago(300), available: true },
  } as HomeData;
  const ids: WidgetId[] = ['clock', 'alarm', 'presence'];
  cfg.order = [...ids, ...cfg.order.filter((x) => !ids.includes(x))];
  const el0 = snapshot(ds, card); // the home asks the same rule the screen does (no card for style "off")
  const found = resolveWidgets(cfg, 'a', data, { quickAllowed: { lights_off: true, all_off: true }, elevatorsAvailable: false, temperatureAvailable: false, generatorsAvailable: false, doorsAvailable: false, noticesAvailable: false, presenceAvailable: ds === 'error' || presenceWidgetAvailable(el0), mediaAvailable: false });
  const el = document.createElement('home-widgets') as unknown as HTMLElement & Record<string, unknown>;
  el.config = cfg;
  el.data = data;
  el.items = ids.map((id) => found.find((x) => x.id === id)).filter((x) => !!x).map((x) => (x!.id === 'presence' ? { ...x!, size } : x!));
  el.layout = layout;
  el.quick = { allowed: { lights_off: true, all_off: true }, lightsOn: 0, switchesOn: 0 };
  el.presence = el0;
  el.failed = ds === 'error' ? ['presence'] : [];
  el.alarmLink = true;
  root.replaceChildren(el);
  await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
  await new Promise((r) => setTimeout(r, 200));
};

/** The settings page (an editor). Its answers come from the spec's route mocks. */
(window as unknown as Record<string, unknown>).pdMountSettings = async () => {
  const el = document.createElement('system-building-presence') as unknown as HTMLElement & Record<string, unknown>;
  el.editable = true;
  root.replaceChildren(el);
  await new Promise((r) => setTimeout(r, 600));
};
(window as unknown as Record<string, unknown>).pdReady = true;
