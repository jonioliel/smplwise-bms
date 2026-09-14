/** Media, settings and snapshots against the add-on backend. */
import { apiUrl, get, patch, post } from './client';

export type Transport = 'auto' | 'webrtc' | 'mse';

export interface ProductSettings {
  'media.transport_default': Transport;
  'media.max_live_sessions': number;
  'media.wall_profile': 'sub' | 'main';
  'snapshots.max_age_s': number;
}

export const getSettings = () => get<{ settings: ProductSettings; can_edit: boolean }>('settings');
export const patchSettings = (body: Partial<ProductSettings>) => patch<{ settings: ProductSettings; can_edit: boolean }>('settings', body);

export interface LiveInfo {
  camera_id: string;
  profile: 'sub' | 'main';
  ws_path: string;
  transport_default: Transport;
  max_live_sessions: number;
  active_sessions: number;
  media_configured: boolean;
}

export const liveInfo = (cameraId: string, profile: 'sub' | 'main') => get<LiveInfo>(`media/live/${cameraId}?profile=${profile}`);
export const syncStreams = () => post<{ created: number; updated: number; unchanged: number; streams: string[]; foreign_streams_untouched: number }>('media/streams/sync');
export const listStreams = () => get<{ go2rtc: Record<string, unknown>; streams: { name: string; online: boolean; sources: string[] }[]; foreign_streams: number }>('media/streams');
export const listSessions = () => get<{ sessions: { id: string; camera_id: string; stream: string; username: string; seconds: number; bytes_down: number }[]; max_live_sessions: number }>('media/sessions');

/** Snapshot URL; `bust` forces the browser past its cache (the server keeps its own max-age). */
export function snapshotUrl(cameraId: string, bust?: number): string {
  return apiUrl(`cameras/${cameraId}/snapshot.jpg${bust ? `?t=${bust}` : ''}`);
}

/** ws(s):// URL of the live relay for a camera, relative to the page (works under Ingress). */
export function liveWsUrl(cameraId: string, profile: 'sub' | 'main'): string {
  const u = new URL(apiUrl(`media/live/${cameraId}/ws?profile=${profile}`));
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  return u.toString();
}

const TRANSPORT_KEY = 'sw.transport';

/** Per-browser override of the transport (set from the player); '' = follow the product default. */
export function transportOverride(): Transport | '' {
  try {
    const v = localStorage.getItem(TRANSPORT_KEY);
    return v === 'webrtc' || v === 'mse' || v === 'auto' ? v : '';
  } catch {
    return '';
  }
}

export function setTransportOverride(v: Transport | '') {
  try {
    if (v) localStorage.setItem(TRANSPORT_KEY, v);
    else localStorage.removeItem(TRANSPORT_KEY);
  } catch {
    /* per-browser convenience only */
  }
}
