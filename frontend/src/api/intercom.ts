/**
 * WisKey (hikvision_intercom) through SMPLWISE (CR-005). This is the transport boundary of the port: where WisKey's own
 * panel calls `hass.callWS({ type: 'hikvision_intercom/overview' })`, the SMPLWISE screen calls `getIntercomOverview()`,
 * which asks the SMPLWISE backend; only the backend talks to Home Assistant. Phase 1a: read-only entry center; phase 1b:
 * the read-only activity log (`getIntercomEvents`). Phase 3 (access.release): door release, call answer / reject / hang up, and a spoken announcement.
 */
import { ApiError, apiUrl, get, post } from './client';

/** A display zone as WisKey sends it (time.ts `DisplayZone`): an IANA zone, or a device's own DST rule. */
export type DisplayZone =
  | { kind: 'iana'; name: string }
  | { kind: 'device'; name: string; standard: number; delta: number; start: number[] | null; end: number[] | null };

/** WisKey types.ts `LastAccess`. */
export interface IntercomLastAccess {
  timestamp: string;
  time_source: 'device' | 'received';
  person_name: string | null;
  employee_no: string | null;
  authentication: string;
  result: string;
  event_type: string;
  recovered: boolean;
  door: number | null;
}

export interface IntercomLock {
  physical_index: number;
  name: string | null;
}

/** The part of WisKey's `Station` the entry center shows (the backend drops the rest). */
export interface IntercomStation {
  id: string;
  name: string;
  online: boolean;
  call_state: string;
  sync_state: string;
  lock_enabled: boolean;
  lock_count: number;
  /** The relays a release may name (WisKey `integrated_locks`, without the device's own api_id). */
  locks: IntercomLock[];
  has_camera: boolean;
  last_error: string | null;
  last_seen: string | null;
  pending_user_count: number;
  managed_user_count: number | null;
  zone: DisplayZone | null;
  last_access: IntercomLastAccess | null;
}

export interface IntercomOverview {
  version: string | null;
  api_version: number | null;
  default_zone: DisplayZone | null;
  user_count: number;
  stations: IntercomStation[];
}

export type IntercomFeedState = 'ha_not_configured' | 'connecting' | 'ha_unavailable' | 'not_installed' | 'forbidden' | 'error' | 'ready';

export interface IntercomFeed {
  state: IntercomFeedState;
  configured: boolean;
  /** False for a copy kept from before a disconnect: shown as last-known, never as current. */
  fresh: boolean;
  fetched_at: string | null;
  last_error: string | null;
  /** Null whenever there is nothing honest to show. */
  overview: IntercomOverview | null;
  /** The server's clock (epoch ms) when it answered. */
  server_time_ms?: number;
}

/** Server clock minus this device's clock (ms), learned from each overview reply. Physical commands' `expires_at` is
 * computed on the SERVER's time line with it, so a device whose clock is minutes off can still act - and still cannot
 * act late (T054 final review S-3). 0 until the first overview arrives (no action control renders before that). */
let serverOffsetMs = 0;

export function serverNow(): number {
  return Date.now() + serverOffsetMs;
}

export async function getIntercomOverview(): Promise<IntercomFeed> {
  const sentAt = Date.now();
  const feed = await get<IntercomFeed>('intercom/overview');
  const receivedAt = Date.now();
  // the server read its clock somewhere during the round trip: assume the middle (error <= half the round trip)
  if (typeof feed.server_time_ms === 'number') serverOffsetMs = feed.server_time_ms - (sentAt + receivedAt) / 2;
  return feed;
}

// ---------------------------------------------------------------- activity log (access.read, read-only)

/** One `events/list` row as the backend projects it (intercom_sync EVENT_KEYS): WisKey's AuditEvent without the masked
 * card, portrait, evidence block and raw ISAPI codes. */
export interface IntercomEvent {
  id: string;
  station_id: string;
  timestamp: string;
  received_at: string | null;
  time_source: 'device' | 'received' | string | null;
  person_name: string | null;
  employee_no: string | null;
  authentication: string;
  result: string;
  event_type: string;
  recovered: boolean;
  door: number | null;
}

/** One page of WisKey's bounded event cache, newest first. `next` is the cursor for the following (older) page. */
export interface IntercomEventPage {
  records: IntercomEvent[];
  next: string | null;
  retention_days: number | null;
  capacity: number | null;
  membership_basis: string | null;
  storage_failed: boolean;
  stations: Record<string, { stream: string | null; history: string | null }>;
}

export type IntercomEventResult = 'granted' | 'denied' | 'unknown';
export type IntercomEventAuth = 'card' | 'pin' | 'unknown';

/** The filters GET /intercom/events accepts (routers/access_control.py), all optional. `start` / `end` are aware ISO
 * instants. WisKey's own `current_group` / `current_profile` / `event_type` filters are not offered here. */
export interface IntercomEventFilters {
  station_id?: string;
  person?: string;
  result?: IntercomEventResult;
  authentication?: IntercomEventAuth;
  door?: 1 | 2;
  start?: string;
  end?: string;
}

/** `events` is null unless `state` is `ready`; `state` can also be `unsupported` (this WisKey has no `events/list`). */
export type IntercomEventsReply = { state: IntercomFeedState | 'unsupported'; configured: boolean; last_error: string | null; fetched_at: string | null; events: IntercomEventPage | null };

/** WisKey's own page size for the activity log (events.ts `limit: 100`). */
export const EVENTS_PAGE = 100;

/** One page of the activity log. `before` is the previous page's `events.next` ("load more"); a pruned cursor comes
 * back as a 422 `intercom_cursor_expired`. WisKey has no event push: the caller refetches on the `intercom_refresh`
 * notice, as WisKey's own panel does. */
export function getIntercomEvents(filters: IntercomEventFilters, before?: string | null, limit = EVENTS_PAGE): Promise<IntercomEventsReply> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  qs.set('limit', String(limit));
  if (before) qs.set('before', before);
  return get<IntercomEventsReply>(`intercom/events?${qs.toString()}`);
}

// ---------------------------------------------------------------- physical actions (access.release)

/** A one-off action's reply (the read endpoints' shape): `<key>` holds WisKey's projected answer. Anything short of
 * success is thrown as an ApiError whose `details.outcome` is `not_sent`, `refused` or `unknown`. */
type ActionReply<K extends string, T> = { state: IntercomFeedState | 'unsupported'; configured: boolean; last_error: string | null; fetched_at: string | null } & { [P in K]: T | null };

/** `accepted` only: WisKey took the command. It is not a confirmation that the door moved. */
export type IntercomReleaseReply = ActionReply<'release', { accepted: boolean }> & { note: string };

/** WisKey's CallResult (`media/signal`). `acknowledged: null` = the device's answer was lost. */
export interface IntercomCallResult {
  command: string;
  acknowledged: boolean | null;
  physical_result: string | null;
  before_state: string | null;
  observed_state: string | null;
  observation: 'state_changed' | 'unchanged' | 'unavailable' | string | null;
  checked_at: string | null;
}

export type IntercomCallCommand = 'answer' | 'reject' | 'hangUp';

export interface IntercomTtsEngine {
  engine_id: string;
  name: string;
  supported_languages: string[];
  default_language: string | null;
}

export interface IntercomTtsEngines {
  default: string | null;
  engines: IntercomTtsEngine[];
}

/** An announcement's progress (the POST reply, then `intercom_tts` notices). `completed` carries physical_result
 * "unverified": WisKey played the audio, nobody confirmed it was heard. */
export interface IntercomTtsStatus {
  station_id: string;
  state: 'started' | 'generating' | 'speaking' | 'completed' | 'closed';
  reason: string | null;
  physical_result: string | null;
  at: string;
}

const station = (id: string) => `intercom/stations/${encodeURIComponent(id)}`;

/** How long a physical command stays valid: a request delayed longer than this (a stalled phone connection, say) is
 * refused by the backend instead of actuating a door late (MASTER_SPEC §15, the HA bridge's own envelope). */
const COMMAND_TTL_MS = 15_000;

function commandId(): string {
  // crypto.randomUUID exists only in secure contexts; HA reached over plain http on the LAN is not one
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** A fresh command id and expiry for one physical command - one per deliberate user action, never reused on a retry. */
function envelope() {
  return { client_request_id: commandId(), expires_at: new Date(serverNow() + COMMAND_TTL_MS).toISOString().replace(/\.\d{3}Z$/, 'Z') };
}

type Actioned<T> = T & { command_id: string };

/** Release one relay. `confirmed` is sent only from the confirmation dialog: the backend refuses a release without it. */
export const releaseIntercomDoor = (stationId: string, lock: number) => post<Actioned<IntercomReleaseReply>>(`${station(stationId)}/release`, { lock, confirmed: true, ...envelope() });

export const signalIntercomCall = (stationId: string, command: IntercomCallCommand) =>
  post<Actioned<ActionReply<'call', IntercomCallResult>>>(`${station(stationId)}/call`, { command, ...envelope() });

export const getIntercomTtsEngines = () => get<ActionReply<'tts', IntercomTtsEngines>>('intercom/tts/engines');

export const speakAtIntercom = (stationId: string, body: { engine_id: string; language: string | null; message: string }) =>
  post<Actioned<ActionReply<'tts', IntercomTtsStatus>>>(`${station(stationId)}/tts`, { ...body, ...envelope() });

/** What is known about a physical command that did not come back as a success. Only a structured answer from the
 * SMPLWISE backend saying so (`details.outcome` `not_sent` / `refused`, or the permission check's 403) means nothing
 * happened; anything else - a dropped connection, a proxy's bare 502 / 504, an unexpected 500, or the backend's own
 * `unknown` - means the command may or may not have been carried out. */
export function actionOutcome(err: unknown): 'not_sent' | 'refused' | 'unknown' {
  if (err instanceof ApiError) {
    const outcome = err.body?.details?.outcome;
    if (outcome === 'not_sent' || outcome === 'refused') return outcome;
    if (err.status === 403 && err.code === 'forbidden') return 'not_sent';
  }
  return 'unknown';
}

export type IntercomPush =
  | { type: 'intercom_refresh' }
  | { type: 'intercom_state'; state: IntercomFeedState }
  | { type: 'intercom_tts'; status: IntercomTtsStatus }
  | { type: 'heartbeat' };

/** Change notices for the entry center (data-free, like WisKey's own `subscribe`): refetch on each. Returns a stop
 * function; `onSocket` reports whether the notices are flowing, so the screen can fall back to polling. */
export function subscribeIntercom(onMessage: (m: IntercomPush) => void, onSocket?: (connected: boolean) => void): () => void {
  let ws: WebSocket | null = null;
  let stopped = false;
  let delay = 2000;
  const url = (() => {
    const u = new URL(apiUrl('intercom/ws'));
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
    return u.toString();
  })();
  const open = () => {
    if (stopped) return;
    try {
      ws = new WebSocket(url);
    } catch {
      return;
    }
    ws.onopen = () => {
      delay = 2000;
      onSocket?.(true);
    };
    ws.onmessage = (m) => {
      try {
        const env = JSON.parse(m.data as string) as { type: string; payload: Record<string, unknown> };
        if (env.type === 'intercom_refresh') onMessage({ type: 'intercom_refresh' });
        else if (env.type === 'intercom_state') onMessage({ type: 'intercom_state', state: env.payload.state as IntercomFeedState });
        else if (env.type === 'intercom_tts') onMessage({ type: 'intercom_tts', status: env.payload as unknown as IntercomTtsStatus });
        else if (env.type === 'heartbeat') onMessage({ type: 'heartbeat' });
      } catch {
        /* ignore malformed frames */
      }
    };
    ws.onclose = (ev) => {
      onSocket?.(false);
      if (!stopped && ev.code !== 4403 && ev.code !== 4401) {
        window.setTimeout(open, delay);
        delay = Math.min(30000, delay * 2);
      }
    };
  };
  open();
  return () => {
    stopped = true;
    ws?.close();
  };
}
