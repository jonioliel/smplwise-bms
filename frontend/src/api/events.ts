/** Event centre (chapter 26): scoped listing, timeline markers, acknowledge and the push socket. */
import { apiResponse, apiUrl, del, get, post } from './client';
import { openReconnectingSocket, wsUrl, type SocketEnv } from './reconnecting-socket';
import { tr } from '../i18n/msg/api-video';
import type * as Wire from './generated/wire-events';
import type { CaseRouteConfirm } from './generated/wire-cases';

export type EventKind = 'motion' | 'person' | 'vehicle' | 'line' | 'field' | 'offline' | 'tamper' | 'door' | 'io' | 'storage' | 'system' | 'coverage_gap' | 'manual' | 'other';

/* The wire shapes are the backend's response models (smplwise_vms/backend/smplwise/wire/events.py, generated into
 * ./generated/wire-events.ts): a field the server renames or drops is a compile error here (code review 07:F8 step 2). Narrowed on
 * purpose: the stored strings `source`, `type`, `state`, `severity` and `confidence` (several writers fill the events table, the server
 * types them `string`) to the values the screens know; the list-only fields stay optional (camera markers, the push socket and the
 * demo events have none of them). */
type EventWire = Wire.EventListed;
export interface VmsEvent
  extends Pick<EventWire, 'id' | 'raw_type' | 'camera_id' | 'channel' | 'occurred_at' | 'ended_at' | 'received_at' | 'count' | 'details' | 'acked_at' | 'acked_by_username'>,
    Partial<Pick<EventWire, 'camera_name' | 'recorder_id' | 'thumbnail'>> {
  source: 'alertstream' | 'recording' | 'system' | 'ha';
  type: EventKind;
  state: 'active' | 'inactive' | 'none';
  severity: 'info' | 'alert' | 'critical';
  confidence: 'measured' | 'inferred';
}
/** Where the event's camera sits (its current anchor); `zone` is the smallest room / zone containing the pin. */
type EventLocation = Wire.EventLocation;
export interface EventDetail extends VmsEvent {
  location: EventLocation | null;
  timezone: string;
  /** Not from the server; the page fills it for display only. */
  playerHint?: string;
}

/** Review window (design M26): adjacent events of one camera; the raw events stay reachable by id. 0.1.62: `group` / `camera_ids`
 * say what the window spans; M047: `spotlight` (the deterministic verdict) and `manual_group_id` (an operator's own grouping). Narrowed:
 * `dominant_type` / `severity` (stored strings); the grouping fields stay optional for the demo windows. */
type WindowWire = Wire.EventWindow;
export interface EventWindow
  extends Pick<WindowWire, 'id' | 'camera_id' | 'channel' | 'start' | 'end' | 'count' | 'types' | 'acked_count' | 'acked' | 'first_event_id' | 'last_event_id' | 'event_ids' | 'thumbnail' | 'thumbnail_event_id' | 'confidence'>,
    Partial<Pick<WindowWire, 'camera_name' | 'group' | 'group_label' | 'camera_ids' | 'camera_names' | 'spotlight' | 'manual_group_id'>> {
  dominant_type: EventKind;
  severity: 'info' | 'alert' | 'critical';
}

type SpotlightRule = Wire.EventSpotlightRule;

type WindowsResponse = Omit<Wire.EventWindows, 'windows' | 'ingest' | 'spotlights' | 'spotlight_rules'> & {
  windows: EventWindow[];
  /** M047: how many of the day's windows are lit (before the `spotlight` filter). */
  spotlights?: number;
  spotlight_rules?: SpotlightRule[];
  ingest: IngestState;
};

/** The alert-stream listener's state; the push socket's heartbeat carries it too (without the queue counters on older servers). */
export type IngestState = Pick<Wire.EventIngest, 'connected' | 'last_heartbeat_at' | 'last_event_at' | 'last_error' | 'reconnects' | 'events_stored' | 'started_at'>;

type DeriveState = Wire.EventDerive;

/** Filters echoed back; `unsupported` names filters that cannot match by construction (T062). */
type EventsResponse = Omit<Wire.EventList, 'events' | 'types' | 'ingest'> & { events: VmsEvent[]; types: EventKind[]; ingest: IngestState };

export type EventsSummary = Omit<Wire.EventSummary, 'ingest'> & { ingest: IngestState; derive: DeriveState };
export function listEvents(opts: { date?: string; from?: string; to?: string; cameraId?: string; type?: string; unacked?: boolean; acked?: boolean; limit?: number ; floorId?: string; zoneId?: string; buildingId?: string; siteId?: string; source?: string; severity?: string; query?: string; recorderId?: string } = {}) {
  const q = new URLSearchParams();
  if (opts.date) q.set('date', opts.date);
  if (opts.from && opts.to) {
    q.set('from', opts.from);
    q.set('to', opts.to);
  }
  if (opts.acked) q.set('acked', 'true');
  if (opts.cameraId) q.set('camera_id', opts.cameraId);
  if (opts.type) q.set('type', opts.type);
  if (opts.unacked) q.set('unacked', 'true');
  if (opts.limit) q.set('limit', String(opts.limit));
  if (opts.floorId) q.set('floor_id', opts.floorId);
  if (opts.zoneId) q.set('zone_id', opts.zoneId);
  if (opts.buildingId) q.set('building_id', opts.buildingId);
  if (opts.siteId) q.set('site_id', opts.siteId);
  if (opts.source) q.set('source', opts.source);
  if (opts.severity) q.set('severity', opts.severity);
  if (opts.query) q.set('q', opts.query);
  if (opts.recorderId) q.set('recorder_id', opts.recorderId); // CR-024: the multi-source event log, one recorder
  const qs = q.toString();
  return get<EventsResponse>(`events${qs ? `?${qs}` : ''}`);
}
export const eventsSummary = () => get<EventsSummary>('events/summary');
export const cameraEvents = (cameraId: string, date: string) => get<Omit<Wire.EventCameraDay, 'events'> & { events: VmsEvent[] }>(`cameras/${cameraId}/events?date=${date}`);
export const ackEvent = (id: string) => post<VmsEvent>(`events/${id}/ack`);
export const ackMany = (ids: string[]) => post<Wire.EventAckMany>('events/ack-many', { event_ids: ids });
export type WindowGroup = 'camera' | 'all' | 'zone' | 'floor';
export const WINDOW_GROUP_LABEL: Record<WindowGroup, string> = { camera: tr('לפי מצלמה'), all: tr('כל המצלמות יחד'), zone: tr('לפי חדר'), floor: tr('לפי קומה') };

export function listWindows(opts: { date?: string; cameraId?: string; gap?: number; limit?: number; by?: WindowGroup; spotlight?: boolean } = {}) {
  const q = new URLSearchParams();
  if (opts.date) q.set('date', opts.date);
  if (opts.cameraId) q.set('camera_id', opts.cameraId);
  if (opts.gap) q.set('gap', String(opts.gap));
  if (opts.by) q.set('by', opts.by);
  if (opts.limit) q.set('limit', String(opts.limit));
  if (opts.spotlight) q.set('spotlight', 'true');
  const qs = q.toString();
  return get<WindowsResponse>(`events/windows${qs ? `?${qs}` : ''}`);
}
/** M047: the named events form one review window from now on (a split or a join); the raw events are untouched. */
export const groupWindowEvents = (eventIds: string[], note = '') => post<Wire.EventWindowGroup>('events/windows/groups', { event_ids: eventIds, note });
export const ungroupWindow = (groupId: string) => del(`events/windows/groups/${groupId}`);
export const getEvent = (id: string) => get<EventDetail>(`events/${id}`);
export const thumbnailUrl = (id: string, v = 0) => apiUrl(`events/${id}/thumbnail${v ? `?v=${v}` : ''}`);

/** Ask for the picture: 200 → ready, 202 → still being grabbed, anything else → unavailable. */
export async function pollThumbnail(id: string): Promise<'ready' | 'pending' | 'unavailable'> {
  try {
    const r = await apiResponse(thumbnailUrl(id), { cache: 'no-store' });
    if (r.status === 200) return 'ready';
    if (r.status === 202) return 'pending';
    return 'unavailable';
  } catch {
    return 'pending';
  }
}

export const EVENT_LABEL: Record<EventKind, string> = {
  motion: tr('תנועה'),
  person: tr('אדם'),
  vehicle: tr('רכב'),
  line: tr('חציית קו'),
  field: tr('חדירה לאזור'),
  offline: tr('אובדן וידאו'),
  tamper: tr('חבלה במצלמה'),
  door: tr('דלת'),
  io: tr('כניסת חיווי'),
  storage: tr('אחסון'),
  system: tr('מערכת'),
  coverage_gap: tr('פער בקליטת אירועים'),
  manual: tr('הקלטה ידנית'),
  other: tr('אחר'),
};

/** The kinds the timeline setting colours (הגדרות › וידאו ומדיה › צבעי ציר הזמן) are drawn with its custom properties, so the lists, chips and
 * dots agree with the timeline; a field intrusion follows the line, an input signal the door, a manual recording the recording. */
export const EVENT_TONE: Record<EventKind, string> = {
  motion: 'var(--sw-tl-motion)',
  person: 'var(--sw-tl-person)',
  vehicle: 'var(--sw-tl-vehicle)',
  line: 'var(--sw-tl-line)',
  field: 'var(--sw-tl-line)',
  offline: 'var(--sw-tl-offline)',
  tamper: '#b45309',
  door: 'var(--sw-tl-door)',
  io: 'var(--sw-tl-door)',
  storage: '#6b7280',
  system: '#6b7280',
  coverage_gap: '#6b7280',
  manual: 'var(--sw-tl-recording)',
  other: '#6b7280',
};

/** Timeline marker kinds are a fixed palette; map the product types onto it. */
export function markerKind(t: EventKind): 'person' | 'vehicle' | 'motion' | 'line' | 'offline' | 'door' {
  if (t === 'person' || t === 'vehicle' || t === 'motion' || t === 'line' || t === 'offline' || t === 'door') return t;
  if (t === 'field') return 'line';
  if (t === 'io') return 'door';
  if (t === 'tamper' || t === 'coverage_gap' || t === 'storage' || t === 'system') return 'offline';
  return 'motion';
}

/** Subscribe to pushed events; returns a stop function. Reconnects with back-off while the page is open.
 * CR-SOCKETS-2439 (07:F6): the shared reconnecting socket (api/reconnecting-socket.ts) - back-off 2 s .. 30 s as before (now with a
 * small jitter), a constructor that throws is retried, and a socket silent past SOCKET_SILENT_MS (the server's heartbeat is every 30 s)
 * or stuck connecting is replaced at once, also on resume. `env`: tests only (fake clock and sockets). */
export function subscribeEvents(onEvent: (ev: VmsEvent) => void, onState?: (s: IngestState | null, connected: boolean) => void, env?: SocketEnv): () => void {
  return openReconnectingSocket({
    url: wsUrl('events/ws'),
    env,
    maxDelayMs: 30_000,
    onOpen: () => onState?.(null, true),
    onDown: () => onState?.(null, false),
    onMessage: (data) => {
      try {
        const m = JSON.parse(data) as { type: string; payload: unknown };
        if (m.type === 'event_added' || m.type === 'event_updated') onEvent(m.payload as VmsEvent);
        else if (m.type === 'heartbeat') onState?.((m.payload as { ingest: IngestState }).ingest, true);
      } catch {
        /* ignore */
      }
    },
  });
}

/** Door–camera–sensor neighbourhood of an event (T053): every link carries its certainty; a command is never proof. */
export type Certainty = 'measured' | 'inferred' | 'command' | 'availability';
export const CERTAINTY_LABEL: Record<Certainty, string> = { measured: tr('נמדד'), inferred: tr('נגזר'), command: tr('פקודה'), availability: tr('זמינות') };
/* T053: the link's kind-specific keys are absent for the other kinds; `certainty` narrowed to the four the server sends. */
type CorrelationLink = Omit<Wire.EventCorrelationLink, 'certainty'> & { certainty: Certainty };
export type Correlation = Omit<Wire.EventCorrelation, 'links'> & { links: CorrelationLink[] };
export const getCorrelation = (id: string, windowS = 120) => get<Correlation>(`events/${id}/correlation?window=${windowS}`);

/** A filter that cannot match by construction, with the reason (T062). */
export type UnsupportedFilter = Wire.EventUnsupportedFilter;
export type EventFacets = Wire.EventFacets;
export const getEventFacets = (days = 90) => get<EventFacets>(`events/facets?days=${days}`);
export const SOURCE_LABEL: Record<string, string> = { alertstream: tr('אירוע NVR'), recording: tr('נגזר מהקלטה'), system: tr('מערכת'), ha: tr('חיישן התקן') };

/** Suggested next cameras after an event (T064): topology only, always hypothetical, never an action. M064: the
 * floors reached through the published stairs / elevators near the camera rank last, each naming its connector. */
type RouteRelation = Wire.EventRouteSuggestion['relation'];
export type EventRoute = Wire.EventRoute;
export const getEventRoute = (id: string, windowS = 90) => get<EventRoute>(`events/${id}/route?window=${windowS}`);

/** M064: one click from the suggested route into a case - the event and a clip per chosen camera over the route window
 * (the backend's model: smplwise_vms/backend/smplwise/wire/cases.py). Narrowed: a clip's `relation`. */
export type RouteConfirmResult = Omit<CaseRouteConfirm, 'added'> & { added: (Omit<CaseRouteConfirm['added'][number], 'relation'> & { relation?: RouteRelation })[] };
export const confirmEventRoute = (id: string, body: { camera_ids: string[]; case_id?: string; title?: string; note?: string; window?: number }) => post<RouteConfirmResult>(`events/${id}/route/confirm`, body);
