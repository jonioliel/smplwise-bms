/** Event centre (chapter 26): scoped listing, timeline markers, acknowledge and the push socket. */
import { apiUrl, get, post } from './client';

export type EventKind = 'motion' | 'person' | 'vehicle' | 'line' | 'field' | 'offline' | 'tamper' | 'door' | 'io' | 'storage' | 'system' | 'coverage_gap' | 'manual' | 'other';

export interface VmsEvent {
  id: string;
  source: 'alertstream' | 'recording' | 'system';
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

export function listEvents(opts: { date?: string; cameraId?: string; type?: string; unacked?: boolean; limit?: number } = {}) {
  const q = new URLSearchParams();
  if (opts.date) q.set('date', opts.date);
  if (opts.cameraId) q.set('camera_id', opts.cameraId);
  if (opts.type) q.set('type', opts.type);
  if (opts.unacked) q.set('unacked', 'true');
  if (opts.limit) q.set('limit', String(opts.limit));
  const qs = q.toString();
  return get<EventsResponse>(`events${qs ? `?${qs}` : ''}`);
}
export const eventsSummary = () => get<EventsSummary>('events/summary');
export const cameraEvents = (cameraId: string, date: string) => get<{ camera_id: string; date: string; timezone: string; events: VmsEvent[] }>(`cameras/${cameraId}/events?date=${date}`);
export const ackEvent = (id: string) => post<VmsEvent>(`events/${id}/ack`);

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
        if (env.type === 'event_added') onEvent(env.payload as VmsEvent);
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
