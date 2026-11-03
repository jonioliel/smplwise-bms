import type { Page, Route } from '@playwright/test';
import { installStationsMock, newMock, NOW_ISO, STATIONS_ROUTE, type StationsMock } from './wiskey-stations-mocks';

// WISKEY-INBOUND-CALLS-2382: a mocked backend for the incoming-call banner (components/sw-incoming-call.ts), the station call log and the
// banner setting - layered OVER the stations mock (tests/wiskey-stations-mocks.ts: the real shell, invented stations, drawn stills,
// recorded call / door commands). Playwright runs the handler registered LAST first, so this one answers the calls endpoints and the
// station media / talk, and hands everything else to the stations mock (`route.fallback()`). No WisKey, no Home Assistant, no station.

export interface CallsMock {
  stations: StationsMock;
  /** GET intercom/calls/active, as the server would answer this user now (mutable: a spec flips it between steps). */
  active: {
    enabled: boolean;
    mode: 'off' | 'everyone' | 'roles';
    sound: 'ring' | 'silent';
    sound_reason: 'setting_off' | 'quiet_hours' | null;
    calls: Record<string, unknown>[];
  };
  /** The station media descriptor per station: talk offered or not (`off` = the setting says no media). */
  media: Record<string, 'talk' | 'off' | 'unsupported'>;
  log: Record<string, unknown>[];
  settings: { mode: string; roles: string[]; stations: string[]; sound: boolean };
  // recorded
  activeReads: number;
  talkStarts: string[];
  saved: Record<string, unknown>[];
}

export const GATE_CALL = {
  call_id: 'call-gate-1',
  station_id: 'gate',
  station_name: 'שער ראשי',
  state: 'ringing',
  rang_at: '2026-10-12T08:13:55.000Z',
  answered_at: null,
  answered_by_me: false,
  elapsed_s: 12,
  online: true,
  has_camera: true,
  still: true,
  can_open_door: true,
  locks: [{ physical_index: 1, name: 'שער' }],
};

export const LOBBY_CALL = {
  ...GATE_CALL,
  call_id: 'call-lobby-1',
  station_id: 'lobby',
  station_name: 'לובי',
  rang_at: '2026-10-12T08:14:01.000Z',
  elapsed_s: 6,
  locks: [{ physical_index: 1, name: 'כניסה' }, { physical_index: 2, name: 'מחסום' }],
};

export const LOG_ROWS = [
  { id: 'l1', station_id: 'gate', station_name: 'שער ראשי', rang_at: '2026-10-12T07:58:00.000Z', observed: 'ringing', state: 'ended', outcome: 'answered', answered_at: '2026-10-12T07:58:06.000Z', answered_via: 'arx', answered_by_name: 'דנה', answered_by_me: false, ended_at: '2026-10-12T07:59:41.000Z', ended_by_name: 'דנה', door_opened_at: '2026-10-12T07:59:20.000Z', door_opened_by_name: 'דנה', updated_at: '2026-10-12T07:59:41.000Z' },
  { id: 'l2', station_id: 'gate', station_name: 'שער ראשי', rang_at: '2026-10-12T07:31:00.000Z', observed: 'ringing', state: 'ended', outcome: 'missed', answered_at: null, answered_via: null, answered_by_name: null, answered_by_me: false, ended_at: '2026-10-12T07:31:40.000Z', ended_by_name: null, door_opened_at: null, door_opened_by_name: null, updated_at: '2026-10-12T07:31:40.000Z' },
  { id: 'l3', station_id: 'gate', station_name: 'שער ראשי', rang_at: '2026-10-11T18:02:00.000Z', observed: 'ringing', state: 'ended', outcome: 'answered', answered_at: '2026-10-11T18:02:05.000Z', answered_via: 'elsewhere', answered_by_name: null, answered_by_me: false, ended_at: '2026-10-11T18:03:00.000Z', ended_by_name: null, door_opened_at: null, door_opened_by_name: null, updated_at: '2026-10-11T18:03:00.000Z' },
  { id: 'l4', station_id: 'gate', station_name: 'שער ראשי', rang_at: '2026-10-11T12:10:00.000Z', observed: 'ringing', state: 'ended', outcome: 'rejected', answered_at: null, answered_via: null, answered_by_name: null, answered_by_me: false, ended_at: '2026-10-11T12:10:09.000Z', ended_by_name: 'עומר', door_opened_at: null, door_opened_by_name: null, updated_at: '2026-10-11T12:10:09.000Z' },
];

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

function mediaBody(stationId: string, kind: 'talk' | 'off' | 'unsupported') {
  if (kind === 'off') return { station_id: stationId, mode: 'off', state: 'off', reason: 'off', video: null, talk: null, listen: false, expires_at: null };
  return {
    station_id: stationId,
    mode: 'video_talk',
    state: 'ready',
    reason: null,
    video: null,
    talk: kind === 'talk' ? { available: true, reason: null, transport: 'arx', codec: 'pcmu', duplex: 'full', max_seconds: 300, sample_rate: 8000, frame_ms: 20, busy: false } : { available: false, reason: 'unsupported' },
    listen: false,
    expires_at: null,
  };
}

export async function installCallsMock(page: Page, over: Partial<CallsMock> = {}, stationsOver: Partial<StationsMock> = {}): Promise<CallsMock> {
  const stations = newMock(stationsOver);
  await installStationsMock(page, stations);
  const m: CallsMock = {
    stations,
    active: { enabled: true, mode: 'everyone', sound: 'ring', sound_reason: null, calls: [{ ...GATE_CALL }] },
    media: { gate: 'off', lobby: 'off' },
    log: LOG_ROWS.map((r) => ({ ...r })),
    settings: { mode: 'off', roles: [], stations: [], sound: true },
    activeReads: 0,
    talkStarts: [],
    saved: [],
    ...over,
  };
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    if (p === 'intercom/calls/active') {
      m.activeReads += 1;
      return json(route, { ...m.active, feed: 'ready', server_time_ms: Date.parse(NOW_ISO) });
    }
    if (p === 'intercom/calls') {
      const sid = url.searchParams.get('station_id');
      return json(route, { calls: m.log.filter((r) => !sid || r.station_id === sid), next: null, retention_days: 90 });
    }
    if (p === 'intercom/calls/settings') {
      if (req.method() === 'PUT') {
        const body = req.postDataJSON() as CallsMock['settings'];
        m.saved.push(body);
        m.settings = body;
      }
      return json(route, {
        settings: m.settings,
        defaults: { mode: 'off', roles: [], stations: [], sound: true },
        roles: [{ id: 'operator', name: 'מפעיל' }, { id: 'site_admin', name: 'מנהל אתר' }, { id: 'system_admin', name: 'מנהל מערכת' }],
        stations: stations.stations.map((s) => ({ id: s.id, name: s.name })),
      });
    }
    const media = /^access-control\/stations\/([^/]+)\/(media|talk)$/.exec(p);
    if (media) {
      const sid = decodeURIComponent(media[1]);
      if (media[2] === 'media') return json(route, mediaBody(sid, m.media[sid] ?? 'off'));
      m.talkStarts.push(sid);
      return json(route, { code: 'intercom_talk_unavailable', user_message: 'דיבור אינו זמין (בדיקה)', retryable: false, correlation_id: 't', details: {} }, 503);
    }
    return route.fallback();
  });
  return m;
}

/** Opens a screen of the real shell (the stations list by default) with the fixed clock of the stations mock. */
export async function openApp(page: Page, hash = STATIONS_ROUTE, o: { skin?: string; scheme?: 'light' | 'dark' } = {}): Promise<void> {
  await page.clock.setFixedTime(new Date(NOW_ISO));
  await page.goto('about:blank');
  const q = new URLSearchParams({ design: 'a', skin: o.skin ?? 'classic', scheme: o.scheme ?? 'light', look: 'performance:full' });
  await page.goto(`/?${q}${hash}`);
  await page.waitForSelector('sw-app');
}

export const BANNER = 'sw-app sw-incoming-call section[data-incoming-call]';
