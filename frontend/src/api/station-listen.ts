/**
 * WKAUDIN-295: listening to a station (its audio TO the operator's screen) - the typed endpoints of backend routers/intercom_listen.py.
 *
 * - `GET access-control/stations/{id}/listen`: whether the drawer may offer listening, or why not (never a source, an address or a token).
 * - `POST access-control/stations/{id}/listen` (the call permission `access.call` on the station, like talk): reserves one listen session;
 *   `POST access-control/listen/{session}/stop` ends it; the session's socket carries the station's G.711 frames to the browser
 *   (wiskey/listen-session.ts). Read-only toward the station: nothing is ever sent to it.
 * All of it sits behind the administrator setting `access.station_listen` (off by default).
 */
import { get, post } from './client';
import { relayWsUrl } from './media';

export interface ListenCapability {
  station_id: string;
  available: boolean;
  /** Why not: `off`, `forbidden`, `feed`, `offline`, `unavailable`, `unsupported`, `no_listen`. */
  reason: string | null;
  codec: 'pcmu' | 'pcma';
  sample_rate: number;
  frame_ms: number;
  max_seconds: number | null;
  listeners: number;
}

export interface ListenStartReply {
  session: string;
  ws_path: string;
  expires_at: string;
  max_seconds: number;
  attach_within_s: number;
  codec: 'pcmu' | 'pcma';
  sample_rate: number;
  frame_ms: number;
  request_id: string | null;
}

const station = (id: string) => `access-control/stations/${encodeURIComponent(id)}`;

export const getListenCapability = (id: string) => get<ListenCapability>(`${station(id)}/listen`);

/** One request per start of listening; never retried (a refusal is shown, the operator starts again). */
export const startListen = (id: string, clientRequestId: string) => post<ListenStartReply>(`${station(id)}/listen`, { client_request_id: clientRequestId });

export const stopListen = (session: string) => post<{ stopped: boolean }>(`access-control/listen/${encodeURIComponent(session)}/stop`);

export const listenSocketUrl = (wsPath: string): string => relayWsUrl(wsPath);

/** The settings key (routers/settings.py) and its three values, in the order Settings offers them. */
export const STATION_LISTEN_KEY = 'access.station_listen';
export const STATION_LISTEN_MODES = ['off', 'on', 'probe'] as const;
export type StationListenMode = (typeof STATION_LISTEN_MODES)[number];

/** The administrator setting as the screen reads it; anything unreadable is `off`. */
export function parseListenMode(settings: Record<string, unknown> | null | undefined): StationListenMode {
  const v = settings?.[STATION_LISTEN_KEY];
  return v === 'on' || v === 'probe' ? v : 'off';
}

/** A random client request id (8-64 url-safe characters): one per start, carried into the audit row. */
export function newListenRequestId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `lst-${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}
