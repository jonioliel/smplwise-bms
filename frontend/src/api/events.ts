/** Event centre (chapter 26): scoped listing, timeline markers, acknowledge and the push socket. */
import { apiUrl, get, post } from './client';

export type EventKind = 'motion' | 'person' | 'vehicle' | 'line' | 'field' | 'offline' | 'tamper' | 'door' | 'io' | 'storage' | 'system' | 'coverage_gap' | 'manual' | 'other';

export interface VmsEvent {
  id: string;
  source: 'alertstream' | 'recording' | 'system' | 'ha';
  raw_type: string;
  type: EventKind;
  camera_id: string | null;
  camera_name?: string | null;
  channel: number | null;
  occurred_at: string;
  ended_at: string | null;
  received_at: string;
  state: 'active' | 'inactive' | 'none';
  count: number;
  severity: 'info' | 'alert' | 'critical';
  confidence: 'measured' | 'inferred';
  details: Record<string, unknown>;
  acked_at: string | null;
  acked_by_username: string | null;
  /** Picture from the recording at the event time: ready | pending (being grabbed) | unavailable | none (not asked yet). */
  thumbnail?: 'ready' | 'pending' | 'unavailable' | 'none';
}

/** Where the event's camera sits (its current anchor); `zone` is the smallest room / zone containing the pin. */
export interface EventLocation {
  anchor_id: string;
  floor_id: string;
  floor_name: string;
  building_id: string;
  building_name: string;
  x: number;
  y: number;
  zone: string | null;
  has_plan: boolean;
}

export interface EventDetail extends VmsEvent {
  location: EventLocation | null;
  timezone: string;
  /** Not from the server; the page fills it for display only. */
  playerHint?: string;
}

/** Review window (design M26): adjacent events of one camera; the raw events stay reachable by id. */
export interface EventWindow {
  id: string;
  camera_id: string | null;
  camera_name?: string | null;
  /** 0.1.62: what the window spans and the cameras inside it (group modes other than 'camera'). */
  group?: WindowGroup;
  group_label?: string | null;
  camera_ids?: string[];
  camera_names?: string[];
  channel: number | null;
  start: string;
  end: string;
  count: number;
  types: Record<string, number>;
  dominant_type: EventKind;
  severity: 'info' | 'alert' | 'critical';
  acked_count: number;
  acked: boolean;
  first_event_id: string;
  last_event_id: string;
  event_ids: string[];
  thumbnail: 'ready' | 'pending' | 'unavailable' | 'none';
  thumbnail_event_id: string;
  confidence: 'measured' | 'inferred';
}

export interface WindowsResponse {
  windows: EventWindow[];
  from: string;
  to: string;
  timezone: string;
  gap_seconds: number;
  events_total: number;
  ingest: IngestState;
}

export interface IngestState {
  connected: boolean;
  last_heartbeat_at: string | null;
  last_event_at: string | null;
  last_error: string | null;
  reconnects: number;
  events_stored: number;
  started_at: string | null;
}

export interface DeriveState {
  last_run: string | null;
  last_ok: string | null;
  last_error: string | null;
  derived: number;
}

export interface EventsResponse {
  /** Filters echoed back; `unsupported` names filters that cannot match by construction (T062). */
  filters?: { applied: Record<string, string>; unsupported: UnsupportedFilter[] };
  events: VmsEvent[];
  from: string;
  to: string;
  timezone: string;
  ingest: IngestState;
  derive: DeriveState;
  types: EventKind[];
}

export interface EventsSummary {
  today: { total: number; unacked: number; by_type: Record<string, number>; measured: number; inferred: number };
  ingest: IngestState;
  derive: DeriveState;
}

export function listEvents(opts: { date?: string; from?: string; to?: string; cameraId?: string; type?: string; unacked?: boolean; acked?: boolean; limit?: number ; floorId?: string; zoneId?: string; buildingId?: string; siteId?: string; source?: string; severity?: string; query?: string } = {}) {
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
  const qs = q.toString();
  return get<EventsResponse>(`events${qs ? `?${qs}` : ''}`);
}
export const eventsSummary = () => get<EventsSummary>('events/summary');
export const cameraEvents = (cameraId: string, date: string) => get<{ camera_id: string; date: string; timezone: string; events: VmsEvent[] }>(`cameras/${cameraId}/events?date=${date}`);
export const ackEvent = (id: string) => post<VmsEvent>(`events/${id}/ack`);
export const ackMany = (ids: string[]) => post<{ acked: string[]; skipped: string[] }>('events/ack-many', { event_ids: ids });
export type WindowGroup = 'camera' | 'all' | 'zone' | 'floor';
export const WINDOW_GROUP_LABEL: Record<WindowGroup, string> = { camera: 'לפי מצלמה', all: 'כל המצלמות יחד', zone: 'לפי חדר', floor: 'לפי קומה' };

export function listWindows(opts: { date?: string; cameraId?: string; gap?: number; limit?: number; by?: WindowGroup } = {}) {
  const q = new URLSearchParams();
  if (opts.date) q.set('date', opts.date);
  if (opts.cameraId) q.set('camera_id', opts.cameraId);
  if (opts.gap) q.set('gap', String(opts.gap));
  if (opts.by) q.set('by', opts.by);
  if (opts.limit) q.set('limit', String(opts.limit));
  const qs = q.toString();
  return get<WindowsResponse>(`events/windows${qs ? `?${qs}` : ''}`);
}
export const getEvent = (id: string) => get<EventDetail>(`events/${id}`);
export const thumbnailUrl = (id: string, v = 0) => apiUrl(`events/${id}/thumbnail${v ? `?v=${v}` : ''}`);

/** Ask for the picture: 200 → ready, 202 → still being grabbed, anything else → unavailable. */
export async function pollThumbnail(id: string): Promise<'ready' | 'pending' | 'unavailable'> {
  try {
    const r = await fetch(thumbnailUrl(id), { credentials: 'include', cache: 'no-store' });
    if (r.status === 200) return 'ready';
    if (r.status === 202) return 'pending';
    return 'unavailable';
  } catch {
    return 'pending';
  }
}

export const EVENT_LABEL: Record<EventKind, string> = {
  motion: 'תנועה',
  person: 'אדם',
  vehicle: 'רכב',
  line: 'חציית קו',
  field: 'חדירה לאזור',
  offline: 'אובדן וידאו',
  tamper: 'חבלה במצלמה',
  door: 'דלת',
  io: 'כניסת חיווי',
  storage: 'אחסון',
  system: 'מערכת',
  coverage_gap: 'פער בקליטת אירועים',
  manual: 'הקלטה ידנית',
  other: 'אחר',
};

export const EVENT_TONE: Record<EventKind, string> = {
  motion: '#ef4444',
  person: '#2f6bff',
  vehicle: '#22c55e',
  line: '#f59e0b',
  field: '#f59e0b',
  offline: '#6b7280',
  tamper: '#b45309',
  door: '#8b5cf6',
  io: '#8b5cf6',
  storage: '#6b7280',
  system: '#6b7280',
  coverage_gap: '#6b7280',
  manual: '#2f6bff',
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

/** Subscribe to pushed events; returns a stop function. Reconnects with back-off while the page is open. */
export function subscribeEvents(onEvent: (ev: VmsEvent) => void, onState?: (s: IngestState | null, connected: boolean) => void): () => void {
  let ws: WebSocket | null = null;
  let stopped = false;
  let delay = 2000;
  const url = (() => {
    const u = new URL(apiUrl('events/ws'));
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
      onState?.(null, true);
    };
    ws.onmessage = (m) => {
      try {
        const env = JSON.parse(m.data as string) as { type: string; payload: unknown };
        if (env.type === 'event_added' || env.type === 'event_updated') onEvent(env.payload as VmsEvent);
        else if (env.type === 'heartbeat') onState?.((env.payload as { ingest: IngestState }).ingest, true);
      } catch {
        /* ignore */
      }
    };
    ws.onclose = () => {
      onState?.(null, false);
      if (!stopped) {
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

/** Door–camera–sensor neighbourhood of an event (T053): every link carries its certainty; a command is never proof. */
export type Certainty = 'measured' | 'inferred' | 'command' | 'availability';
export const CERTAINTY_LABEL: Record<Certainty, string> = { measured: 'נמדד', inferred: 'נגזר', command: 'פקודה', availability: 'זמינות' };
export interface CorrelationLink {
  kind: 'sensor' | 'command' | 'camera';
  event_id?: string;
  action_id?: string;
  entity_id?: string;
  camera_id?: string;
  name: string;
  type?: string;
  action?: string;
  status?: string;
  by?: string | null;
  at: string;
  delta_s: number;
  label: string;
  certainty: Certainty;
  note: string;
}
export interface Correlation {
  event_id: string;
  window_s: number;
  subject: { kind: 'camera' | 'entity' | 'system'; id: string | null };
  spatial: boolean;
  location: { floor_id: string; floor_name: string; building_name: string; x: number; y: number; zone: string | null; radius: number } | null;
  entities: { entity_id: string; name: string; domain: string; device_class: string | null; tracked_as: string | null; state: string | null; last_changed: string | null; state_missing: boolean; distance: number | null; same_zone: boolean }[];
  cameras: { camera_id: string; distance: number | null; same_zone: boolean }[];
  links: CorrelationLink[];
  notes: { code: string; text: string }[];
  policy: string;
  event: { id: string; type: string; source: string; camera_id: string | null; camera_name: string | null; occurred_at: string; received_at: string; confidence: string; details: Record<string, unknown> };
}
export const getCorrelation = (id: string, windowS = 120) => get<Correlation>(`events/${id}/correlation?window=${windowS}`);

/** A filter that cannot match by construction, with the reason (T062). */
export interface UnsupportedFilter {
  field: string;
  value: string;
  reason: string;
}
export interface EventFacets {
  days: number;
  since: string;
  types: { type: string; count: number }[];
  sources: { source: string; count: number }[];
  severities: { severity: string; count: number }[];
  unavailable_types: { type: string; reason: string }[];
  places: { id: string; name: string; buildings: { id: string; name: string; floors: { id: string; name: string; cameras: number; sensors: number; zones: { id: string; name: string; kind: string; cameras: number; sensors: number }[] }[] }[] }[];
  notes: string[];
}
export const getEventFacets = (days = 90) => get<EventFacets>(`events/facets?days=${days}`);
export const SOURCE_LABEL: Record<string, string> = { alertstream: 'אירוע NVR', recording: 'נגזר מהקלטה', system: 'מערכת', ha: 'חיישן HA' };

/** Suggested next cameras after an event (T064): topology only, always hypothetical, never an action. */
export interface EventRoute {
  event_id: string;
  hypothetical: true;
  spatial: boolean;
  subject: { camera_id: string; name: string; zone: string | null } | null;
  location: { floor_id: string; floor_name: string; building_name: string } | null;
  window: { from: string; to: string };
  suggestions: { camera_id: string; name: string; relation: 'same_zone' | 'adjacent_zone' | 'nearby'; relation_label: string; distance: number; zone: string | null; activity_events: number; playback_at: string }[];
  notes: string[];
  policy: string;
}
export const getEventRoute = (id: string, windowS = 90) => get<EventRoute>(`events/${id}/route?window=${windowS}`);
