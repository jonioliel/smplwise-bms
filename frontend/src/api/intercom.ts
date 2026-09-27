/**
 * WisKey (hikvision_intercom) through SMPLWISE (CR-005). This is the transport boundary of the port: where WisKey's own
 * panel calls `hass.callWS({ type: 'hikvision_intercom/overview' })`, the SMPLWISE screen calls `getIntercomOverview()`,
 * which asks the SMPLWISE backend; only the backend talks to Home Assistant. Phase 1a: read-only entry center.
 */
import { apiUrl, get } from './client';

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

/** The part of WisKey's `Station` the entry center shows (the backend drops the rest). */
export interface IntercomStation {
  id: string;
  name: string;
  online: boolean;
  call_state: string;
  sync_state: string;
  lock_enabled: boolean;
  lock_count: number;
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
}

export const getIntercomOverview = () => get<IntercomFeed>('intercom/overview');

export type IntercomPush = { type: 'intercom_refresh' } | { type: 'intercom_state'; state: IntercomFeedState } | { type: 'heartbeat' };

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
